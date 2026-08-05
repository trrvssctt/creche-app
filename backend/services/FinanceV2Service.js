import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

export class FinanceV2Service {

  // CA d'engagement = total net engagé sur une année scolaire
  static async getCAEngagement(tenantId, academicYearId) {
    const [rows] = await sequelize.query(`
      SELECT
        COALESCE(SUM(ae.montant_brut), 0)  AS ca_brut,
        COALESCE(SUM(ae.montant_net), 0)   AS ca_net,
        COALESCE(SUM(ae.montant_bourse), 0) AS total_bourses,
        COUNT(DISTINCT ae.eleve_id)         AS nb_inscrits,
        COALESCE(SUM(ep.total_paid), 0)    AS total_encaisse
      FROM abonnements_eleves ae
      LEFT JOIN (
        SELECT abonnement_id, SUM(amount_paid) AS total_paid
        FROM echeances_paiements
        WHERE tenant_id = :tenantId
        GROUP BY abonnement_id
      ) ep ON ep.abonnement_id = ae.id
      WHERE ae.tenant_id = :tenantId
        AND ae.academic_year_id = :academicYearId
        AND ae.commitment_status IN ('ACTIVE', 'CLOTUREE')
    `, {
      replacements: { tenantId, academicYearId },
      type: QueryTypes.SELECT,
    });

    const row = rows || {};
    const caBrut = parseFloat(row.ca_brut || 0);
    const caNet = parseFloat(row.ca_net || 0);
    const totalEncaisse = parseFloat(row.total_encaisse || 0);

    return {
      caBrut,
      caNet,
      totalBourses: parseFloat(row.total_bourses || 0),
      nbInscrits: parseInt(row.nb_inscrits || 0, 10),
      totalEncaisse,
      resteAEncaisser: caNet - totalEncaisse,
      tauxEncaissement: caNet > 0 ? Math.round((totalEncaisse / caNet) * 10000) / 100 : 0,
    };
  }

  // CA comptable = produits rattachés à une année civile (par période de service)
  static async getCAComptable(tenantId, civilYear, month = null) {
    let where = `ep.tenant_id = :tenantId AND EXTRACT(YEAR FROM ep.service_period_start) = :civilYear`;
    const replacements = { tenantId, civilYear };

    if (month) {
      where += ` AND EXTRACT(MONTH FROM ep.service_period_start) = :month`;
      replacements.month = month;
    }

    const rows = await sequelize.query(`
      SELECT
        TO_CHAR(ep.service_period_start, 'YYYY-MM') AS mois,
        COALESCE(SUM(ep.montant), 0) AS ca_comptable,
        COALESCE(SUM(ep.amount_paid), 0) AS encaisse,
        COUNT(*) AS nb_echeances
      FROM echeances_paiements ep
      WHERE ${where}
        AND ep.statut NOT IN ('ANNULE', 'ANNULEE')
      GROUP BY TO_CHAR(ep.service_period_start, 'YYYY-MM')
      ORDER BY mois
    `, {
      replacements,
      type: QueryTypes.SELECT,
    });

    const total = rows.reduce((s, r) => s + parseFloat(r.ca_comptable || 0), 0);
    return { civilYear, month, total, details: rows };
  }

  // Encaissements par période (flux de trésorerie réels)
  static async getEncaissements(tenantId, dateFrom, dateTo) {
    const rows = await sequelize.query(`
      SELECT
        p.method,
        DATE(p.payment_date) AS jour,
        COUNT(*) AS nb_paiements,
        COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      WHERE p.tenant_id = :tenantId
        AND p.statut IN ('PAID', 'PENDING')
        AND p.payment_date >= :dateFrom
        AND p.payment_date <= :dateTo
      GROUP BY p.method, DATE(p.payment_date)
      ORDER BY jour, p.method
    `, {
      replacements: { tenantId, dateFrom, dateTo },
      type: QueryTypes.SELECT,
    });

    const total = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
    const parMethode = {};
    rows.forEach(r => {
      parMethode[r.method] = (parMethode[r.method] || 0) + parseFloat(r.total || 0);
    });

    return { dateFrom, dateTo, total, parMethode, details: rows };
  }

  // Balance âgée : impayés par tranche d'ancienneté
  static async getBalanceAgee(tenantId) {
    const rows = await sequelize.query(`
      SELECT
        CASE
          WHEN CURRENT_DATE - ep.date_echeance <= 30 THEN '1-30'
          WHEN CURRENT_DATE - ep.date_echeance <= 60 THEN '31-60'
          WHEN CURRENT_DATE - ep.date_echeance <= 90 THEN '61-90'
          WHEN CURRENT_DATE - ep.date_echeance <= 180 THEN '91-180'
          ELSE '>180'
        END AS tranche,
        COUNT(*) AS nb_echeances,
        COUNT(DISTINCT ep.eleve_id) AS nb_eleves,
        COALESCE(SUM(ep.amount_remaining), 0) AS total_impaye
      FROM echeances_paiements ep
      WHERE ep.tenant_id = :tenantId
        AND ep.date_echeance < CURRENT_DATE
        AND ep.amount_remaining > 0
        AND ep.statut NOT IN ('ANNULE', 'ANNULEE', 'SOLDEE', 'PAYE')
      GROUP BY tranche
      ORDER BY MIN(CURRENT_DATE - ep.date_echeance)
    `, {
      replacements: { tenantId },
      type: QueryTypes.SELECT,
    });

    const totalImpaye = rows.reduce((s, r) => s + parseFloat(r.total_impaye || 0), 0);
    return { totalImpaye, tranches: rows };
  }

  // Créances à échoir (sommes futures attendues)
  static async getCreancesAEchoir(tenantId) {
    const rows = await sequelize.query(`
      SELECT
        TO_CHAR(ep.date_echeance, 'YYYY-MM') AS mois,
        COALESCE(SUM(ep.amount_remaining), 0) AS total,
        COUNT(*) AS nb_echeances
      FROM echeances_paiements ep
      WHERE ep.tenant_id = :tenantId
        AND ep.date_echeance > CURRENT_DATE
        AND ep.amount_remaining > 0
        AND ep.statut NOT IN ('ANNULE', 'ANNULEE')
      GROUP BY TO_CHAR(ep.date_echeance, 'YYYY-MM')
      ORDER BY mois
    `, {
      replacements: { tenantId },
      type: QueryTypes.SELECT,
    });

    const total = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
    return { total, mois: rows };
  }

  // Dashboard complet
  static async getDashboard(tenantId, academicYearId, civilYear) {
    const [caEngagement, caComptable, balanceAgee, creancesAEchoir] = await Promise.all([
      this.getCAEngagement(tenantId, academicYearId),
      this.getCAComptable(tenantId, civilYear),
      this.getBalanceAgee(tenantId),
      this.getCreancesAEchoir(tenantId),
    ]);

    return {
      caEngagement,
      caComptable,
      balanceAgee,
      creancesAEchoir,
      generatedAt: new Date().toISOString(),
    };
  }
}
