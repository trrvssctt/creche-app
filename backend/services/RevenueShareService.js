import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { RevenueShareSetting, RevenueShareRateHistory, Tenant, AcademicYear } from '../models/index.js';

/**
 * Redevance contractuelle sur le chiffre d'affaires de l'établissement.
 *
 * Assiette (base de calcul, réglable par tenant) :
 *  - CA_COMPTABLE   : produits rattachés à la période de service (échéances de scolarité)
 *  - CA_ENCAISSE    : encaissements réels sur la période (trésorerie)
 *  - CA_ENGAGEMENT  : total net engagé sur une année scolaire (abonnements)
 *
 * Taux : borné contractuellement entre MIN_RATE (0,50 %) et MAX_RATE (1,00 %).
 */
export class RevenueShareService {

  static HARD_MIN_RATE = 0.005;   // 0,50 %
  static HARD_MAX_RATE = 0.01;    // 1,00 %
  static BASES = ['CA_COMPTABLE', 'CA_ENCAISSE', 'CA_ENGAGEMENT'];

  // ── Paramètres ────────────────────────────────────────────────────────────

  /** Récupère (ou crée au taux plancher) les paramètres de redevance d'un tenant. */
  static async getSettings(tenantId) {
    let settings = await RevenueShareSetting.findOne({ where: { tenantId } });
    if (!settings) {
      settings = await RevenueShareSetting.create({
        tenantId,
        commissionRate: this.HARD_MIN_RATE,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    }
    return settings;
  }

  static normalizeSettings(settings) {
    return {
      id: settings.id,
      tenantId: settings.tenantId,
      commissionRate: parseFloat(settings.commissionRate),
      commissionRatePct: Math.round(parseFloat(settings.commissionRate) * 100 * 1000) / 1000,
      minRate: parseFloat(settings.minRate),
      maxRate: parseFloat(settings.maxRate),
      calculationBasis: settings.calculationBasis,
      includeOtherRevenues: settings.includeOtherRevenues,
      contractReference: settings.contractReference,
      effectiveFrom: settings.effectiveFrom,
      isActive: settings.isActive,
      notes: settings.notes,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Met à jour le taux / la base de calcul. Refuse tout taux hors [0,5 % ; 1 %].
   * Journalise le changement dans revenue_share_rate_history.
   */
  static async updateSettings(tenantId, payload, actor = {}) {
    const settings = await this.getSettings(tenantId);
    const previousRate = parseFloat(settings.commissionRate);
    const previousBasis = settings.calculationBasis;
    const updates = {};

    if (payload.commissionRate !== undefined && payload.commissionRate !== null) {
      const rate = this.parseRate(payload.commissionRate);
      if (rate === null) {
        throw Object.assign(new Error('Taux invalide.'), { status: 400 });
      }
      const min = Math.max(parseFloat(settings.minRate), this.HARD_MIN_RATE);
      const max = Math.min(parseFloat(settings.maxRate), this.HARD_MAX_RATE);
      if (rate < min || rate > max) {
        throw Object.assign(
          new Error(`Le taux contractuel doit être compris entre ${(min * 100).toFixed(2)} % et ${(max * 100).toFixed(2)} %.`),
          { status: 400 }
        );
      }
      updates.commissionRate = rate;
    }

    if (payload.calculationBasis !== undefined) {
      if (!this.BASES.includes(payload.calculationBasis)) {
        throw Object.assign(new Error(`Base de calcul invalide (attendu : ${this.BASES.join(', ')}).`), { status: 400 });
      }
      updates.calculationBasis = payload.calculationBasis;
    }

    if (payload.includeOtherRevenues !== undefined) updates.includeOtherRevenues = !!payload.includeOtherRevenues;
    if (payload.contractReference !== undefined)    updates.contractReference = payload.contractReference || null;
    if (payload.effectiveFrom !== undefined)        updates.effectiveFrom = payload.effectiveFrom || null;
    if (payload.isActive !== undefined)             updates.isActive = !!payload.isActive;
    if (payload.notes !== undefined)                updates.notes = payload.notes || null;

    await settings.update(updates);

    const rateChanged  = updates.commissionRate !== undefined && updates.commissionRate !== previousRate;
    const basisChanged = updates.calculationBasis !== undefined && updates.calculationBasis !== previousBasis;
    if (rateChanged || basisChanged) {
      await RevenueShareRateHistory.create({
        tenantId,
        previousRate,
        newRate: parseFloat(settings.commissionRate),
        previousBasis,
        newBasis: settings.calculationBasis,
        changedBy: actor.id && /^[0-9a-f-]{36}$/i.test(String(actor.id)) ? actor.id : null,
        changedByName: actor.name || 'SUPER_ADMIN',
        reason: payload.reason || null,
      });
    }

    return this.normalizeSettings(settings);
  }

  /** Accepte 0.005 (fraction) ou 0.5 / "0,5" (pourcentage) et renvoie une fraction. */
  static parseRate(input) {
    const raw = typeof input === 'string' ? input.replace(',', '.').trim() : input;
    const value = parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    // > 0.02 : l'appelant a saisi un pourcentage (0,5 → 0,5 %)
    const fraction = value > 0.02 ? value / 100 : value;
    return Math.round(fraction * 1e5) / 1e5;
  }

  static async getRateHistory(tenantId, limit = 50) {
    return RevenueShareRateHistory.findAll({
      where: { tenantId },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  // ── Période de référence ──────────────────────────────────────────────────

  /**
   * Résout la période d'observation.
   * @param {'CIVIL_YEAR'|'ACADEMIC_YEAR'} periodType
   */
  static async resolvePeriod(tenantId, { periodType, civilYear, academicYearId } = {}) {
    if (periodType === 'ACADEMIC_YEAR') {
      let year = null;
      if (academicYearId) {
        year = await AcademicYear.findOne({ where: { id: academicYearId, tenantId } });
      } else {
        year = await AcademicYear.findOne({ where: { tenantId, status: 'EN_COURS' } })
            || await AcademicYear.findOne({ where: { tenantId }, order: [['startDate', 'DESC']] });
      }
      if (year) {
        return {
          type: 'ACADEMIC_YEAR',
          label: year.label,
          dateFrom: year.startDate,
          dateTo: year.endDate,
          academicYearId: year.id,
        };
      }
      // Aucune année scolaire déclarée : repli sur l'année civile
    }

    const y = parseInt(civilYear, 10) || new Date().getFullYear();
    return {
      type: 'CIVIL_YEAR',
      label: String(y),
      dateFrom: `${y}-01-01`,
      dateTo: `${y}-12-31`,
      academicYearId: null,
    };
  }

  // ── Composantes du chiffre d'affaires ─────────────────────────────────────

  /** CA comptable : échéances de scolarité rattachées à la période de service. */
  static async getCaComptableMensuel(tenantId, dateFrom, dateTo) {
    return sequelize.query(`
      SELECT TO_CHAR(COALESCE(ep.service_period_start, ep.date_echeance), 'YYYY-MM') AS mois,
             COALESCE(SUM(ep.montant), 0)     AS ca,
             COALESCE(SUM(ep.amount_paid), 0) AS encaisse,
             COUNT(*)                         AS nb
        FROM echeances_paiements ep
       WHERE ep.tenant_id = :tenantId
         AND COALESCE(ep.service_period_start, ep.date_echeance) BETWEEN :dateFrom AND :dateTo
         AND UPPER(COALESCE(ep.statut, '')) NOT IN ('ANNULE', 'ANNULEE', 'CANCELLED')
       GROUP BY 1
       ORDER BY 1
    `, { replacements: { tenantId, dateFrom, dateTo }, type: QueryTypes.SELECT });
  }

  /** CA encaissé : paiements réels (hors chèques non encaissés et paiements annulés). */
  static async getCaEncaisseMensuel(tenantId, dateFrom, dateTo) {
    return sequelize.query(`
      SELECT TO_CHAR(p.payment_date, 'YYYY-MM')  AS mois,
             COALESCE(SUM(p.amount), 0)          AS ca,
             COUNT(*)                            AS nb
        FROM payments p
       WHERE p.tenant_id = :tenantId
         AND p.payment_date BETWEEN :dateFrom AND :dateTo
         AND p.cancelled_at IS NULL
         AND UPPER(COALESCE(p.statut, 'PAID')) NOT IN ('ANNULE', 'ANNULEE', 'CANCELLED', 'REJECTED', 'FAILED')
         AND (p.method <> 'CHEQUE' OR UPPER(COALESCE(p.statut, '')) = 'PAID')
       GROUP BY 1
       ORDER BY 1
    `, { replacements: { tenantId, dateFrom, dateTo }, type: QueryTypes.SELECT });
  }

  /** Recettes diverses (inscriptions ponctuelles, ventes annexes saisies en caisse). */
  static async getAutresRecettesMensuel(tenantId, dateFrom, dateTo) {
    return sequelize.query(`
      SELECT TO_CHAR(orv.revenue_date, 'YYYY-MM') AS mois,
             COALESCE(SUM(orv.amount), 0)         AS ca,
             COUNT(*)                             AS nb
        FROM other_revenues orv
       WHERE orv.tenant_id = :tenantId
         AND orv.revenue_date BETWEEN :dateFrom AND :dateTo
       GROUP BY 1
       ORDER BY 1
    `, { replacements: { tenantId, dateFrom, dateTo }, type: QueryTypes.SELECT });
  }

  /** CA d'engagement : total net engagé sur l'année scolaire (abonnements élèves). */
  static async getCaEngagement(tenantId, academicYearId, dateFrom, dateTo) {
    const where = academicYearId
      ? 'ae.academic_year_id = :academicYearId'
      : 'ae.date_debut BETWEEN :dateFrom AND :dateTo';

    const rows = await sequelize.query(`
      SELECT COALESCE(SUM(ae.montant_net), 0)     AS ca_net,
             COALESCE(SUM(ae.montant_brut), 0)    AS ca_brut,
             COALESCE(SUM(ae.montant_bourse), 0)  AS total_bourses,
             COUNT(DISTINCT ae.eleve_id)          AS nb_inscrits
        FROM abonnements_eleves ae
       WHERE ae.tenant_id = :tenantId
         AND ${where}
         AND UPPER(COALESCE(ae.commitment_status, 'ACTIVE')) IN ('ACTIVE', 'CLOTUREE')
    `, { replacements: { tenantId, academicYearId, dateFrom, dateTo }, type: QueryTypes.SELECT });

    const r = rows[0] || {};
    return {
      caNet: parseFloat(r.ca_net || 0),
      caBrut: parseFloat(r.ca_brut || 0),
      totalBourses: parseFloat(r.total_bourses || 0),
      nbInscrits: parseInt(r.nb_inscrits || 0, 10),
    };
  }

  // ── Calcul de la redevance ────────────────────────────────────────────────

  /**
   * Calcule le CA et la redevance d'un tenant sur une période.
   * Retourne les trois lectures du CA pour permettre le contrôle contradictoire.
   */
  static async computeForTenant(tenantId, options = {}) {
    const settings = await this.getSettings(tenantId);
    const period = await this.resolvePeriod(tenantId, options);
    const basis = options.basis && this.BASES.includes(options.basis)
      ? options.basis
      : settings.calculationBasis;

    const [comptableRows, encaisseRows, autresRows, engagement] = await Promise.all([
      this.getCaComptableMensuel(tenantId, period.dateFrom, period.dateTo),
      this.getCaEncaisseMensuel(tenantId, period.dateFrom, period.dateTo),
      this.getAutresRecettesMensuel(tenantId, period.dateFrom, period.dateTo),
      this.getCaEngagement(tenantId, period.academicYearId, period.dateFrom, period.dateTo),
    ]);

    const sum = (rows) => rows.reduce((s, r) => s + parseFloat(r.ca || 0), 0);
    const caComptable    = sum(comptableRows);
    const caEncaisse     = sum(encaisseRows);
    const autresRecettes = sum(autresRows);
    const caEngagement   = engagement.caNet;

    const includeOthers = settings.includeOtherRevenues;
    // Les recettes diverses encaissées transitent déjà par `payments` : ne pas
    // les recompter sur la base trésorerie.
    const baseMap = {
      CA_COMPTABLE:  caComptable + (includeOthers ? autresRecettes : 0),
      CA_ENCAISSE:   caEncaisse,
      CA_ENGAGEMENT: caEngagement + (includeOthers ? autresRecettes : 0),
    };

    const assiette = Math.round((baseMap[basis] || 0) * 100) / 100;
    const rate = parseFloat(settings.commissionRate);
    const commissionAmount = Math.round(assiette * rate * 100) / 100;

    // Ventilation mensuelle de l'assiette (l'engagement n'est pas mensualisable :
    // on retombe alors sur la ventilation comptable, qui en est la traduction).
    const monthlySource = basis === 'CA_ENCAISSE' ? encaisseRows : comptableRows;
    const monthlyMap = new Map();
    for (const r of monthlySource) {
      monthlyMap.set(r.mois, { mois: r.mois, ca: parseFloat(r.ca || 0), autresRecettes: 0 });
    }
    if (includeOthers && basis !== 'CA_ENCAISSE') {
      for (const r of autresRows) {
        const entry = monthlyMap.get(r.mois) || { mois: r.mois, ca: 0, autresRecettes: 0 };
        entry.autresRecettes = parseFloat(r.ca || 0);
        entry.ca += parseFloat(r.ca || 0);
        monthlyMap.set(r.mois, entry);
      }
    }
    const monthly = [...monthlyMap.values()]
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .map(m => ({
        ...m,
        ca: Math.round(m.ca * 100) / 100,
        commission: Math.round(m.ca * rate * 100) / 100,
      }));

    return {
      tenantId,
      period,
      settings: this.normalizeSettings(settings),
      basis,
      revenue: {
        assiette,
        caComptable,
        caEncaisse,
        caEngagement,
        caEngagementBrut: engagement.caBrut,
        totalBourses: engagement.totalBourses,
        nbInscrits: engagement.nbInscrits,
        autresRecettes,
        includeOtherRevenues: includeOthers,
      },
      commission: {
        rate,
        ratePct: Math.round(rate * 100 * 1000) / 1000,
        amount: commissionAmount,
        minRate: parseFloat(settings.minRate),
        maxRate: parseFloat(settings.maxRate),
        // Fourchette contractuelle : ce que représenterait le plancher / le plafond
        amountAtMinRate: Math.round(assiette * parseFloat(settings.minRate) * 100) / 100,
        amountAtMaxRate: Math.round(assiette * parseFloat(settings.maxRate) * 100) / 100,
      },
      monthly,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Vue consolidée : tous les établissements avec leur CA et leur redevance. */
  static async computeOverview(options = {}) {
    const tenants = await Tenant.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    const rows = [];
    for (const t of tenants) {
      try {
        const detail = await this.computeForTenant(t.id, options);
        rows.push({
          tenantId: t.id,
          tenantName: t.name,
          period: detail.period,
          basis: detail.basis,
          settings: detail.settings,
          revenue: detail.revenue,
          commission: detail.commission,
        });
      } catch (err) {
        rows.push({ tenantId: t.id, tenantName: t.name, error: err.message });
      }
    }

    const valid = rows.filter(r => !r.error);
    const totals = {
      caTotal: valid.reduce((s, r) => s + r.revenue.assiette, 0),
      commissionTotal: valid.reduce((s, r) => s + r.commission.amount, 0),
      nbEtablissements: valid.length,
      tauxMoyen: valid.length
        ? Math.round((valid.reduce((s, r) => s + r.commission.rate, 0) / valid.length) * 1e5) / 1e5
        : 0,
    };

    return { totals, tenants: rows, generatedAt: new Date().toISOString() };
  }
}

export default RevenueShareService;
