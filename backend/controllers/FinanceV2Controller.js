import { AcademicYear, CivilPeriod, TariffPlanSnapshot, CashSession,
         FinanceAuditEvent, PaymentAllocation, CreditNote, Refund,
         OtherRevenue, CollectionCase, CollectionAction,
         Service, Eleve, User, EcheancePaiement, Payment,
         AbonnementEleve } from '../models/index.js';
import { FinanceV2Service } from '../services/FinanceV2Service.js';
import { sequelize } from '../config/database.js';

export class FinanceV2Controller {

  // ══════════════════════════════════════════════════════════════════════════
  // ANNÉES SCOLAIRES
  // ══════════════════════════════════════════════════════════════════════════

  static async listAcademicYears(req, res) {
    const years = await AcademicYear.findAll({
      where: { tenantId: req.user.tenantId },
      order: [['startDate', 'DESC']],
    });
    res.json(years);
  }

  static async createAcademicYear(req, res) {
    const { label, startDate, endDate, graceDays } = req.body;
    const tenantId = req.user.tenantId;

    const existing = await AcademicYear.findOne({ where: { tenantId, label } });
    if (existing) return res.status(409).json({ error: 'Cette année scolaire existe déjà.' });

    const year = await AcademicYear.create({
      tenantId, label, startDate, endDate,
      graceDays: graceDays || 5,
      status: 'PREPARATION',
    });

    // Générer les périodes civiles (sept → juin)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periods = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      const m = cursor.getMonth() + 1;
      const y = cursor.getFullYear();
      const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const lastDay = new Date(y, m, 0).getDate();

      periods.push({
        tenantId,
        academicYearId: year.id,
        civilYear: y,
        month: m,
        label: `${monthNames[m]} ${y}`,
        startDate: `${y}-${String(m).padStart(2, '0')}-01`,
        endDate: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    await CivilPeriod.bulkCreate(periods, { ignoreDuplicates: true });

    res.status(201).json({ academicYear: year, periodsCreated: periods.length });
  }

  static async updateAcademicYear(req, res) {
    const year = await AcademicYear.findByPk(req.params.id);
    if (!year || year.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Année non trouvée.' });

    await year.update(req.body);
    res.json(year);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SNAPSHOTS TARIFAIRES
  // ══════════════════════════════════════════════════════════════════════════

  static async snapshotTariffs(req, res) {
    const { academicYearId } = req.body;
    const tenantId = req.user.tenantId;

    const year = await AcademicYear.findByPk(academicYearId);
    if (!year || year.tenantId !== tenantId) return res.status(404).json({ error: 'Année non trouvée.' });

    const services = await Service.findAll({
      where: { tenantId, status: 'actif' },
    });

    const snapshots = [];
    for (const svc of services) {
      const [snapshot, created] = await TariffPlanSnapshot.findOrCreate({
        where: { tenantId, serviceId: svc.id, academicYearId },
        defaults: {
          tenantId,
          serviceId: svc.id,
          academicYearId,
          name: svc.name,
          typeOffre: svc.typeOffre,
          price: svc.price,
          niveauxCibles: svc.niveauxCibles || [],
          dureeMois: svc.dureeMois,
          estRecurrent: svc.estRecurrent,
          metadata: {
            fraisInscription: svc.fraisInscription,
            inclutCantine: svc.inclutCantine,
          },
        },
      });
      snapshots.push({ id: snapshot.id, name: snapshot.name, created });
    }

    res.status(201).json({ snapshots, count: snapshots.length });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SESSIONS DE CAISSE
  // ══════════════════════════════════════════════════════════════════════════

  static async openCashSession(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const existing = await CashSession.findOne({
      where: { tenantId, openedBy: userId, status: 'OPEN' },
    });
    if (existing) return res.status(409).json({ error: 'Vous avez déjà une caisse ouverte.', session: existing });

    const session = await CashSession.create({
      tenantId,
      openedBy: userId,
      openingBalance: req.body.openingBalance || 0,
    });

    await FinanceAuditEvent.create({
      tenantId,
      userId,
      userName: req.user.name,
      eventType: 'CASH_SESSION_OPENED',
      entityType: 'CashSession',
      entityId: session.id,
      newValues: { openingBalance: session.openingBalance },
      ipAddress: req.ip,
    });

    res.status(201).json(session);
  }

  static async closeCashSession(req, res) {
    const session = await CashSession.findByPk(req.params.id);
    if (!session || session.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Session non trouvée.' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'Session déjà fermée.' });

    const { closingBalance } = req.body;

    // Calculer le solde attendu
    const payments = await Payment.findAll({
      where: { cashSessionId: session.id },
      attributes: ['amount', 'method'],
    });
    const cashPayments = payments.filter(p => p.method === 'CASH');
    const expectedBalance = parseFloat(session.openingBalance) +
      cashPayments.reduce((s, p) => s + parseFloat(p.amount), 0);

    await session.update({
      closedBy: req.user.id,
      closedAt: new Date(),
      closingBalance: closingBalance,
      expectedBalance,
      difference: parseFloat(closingBalance) - expectedBalance,
      status: 'CLOSED',
    });

    await FinanceAuditEvent.create({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      eventType: 'CASH_SESSION_CLOSED',
      entityType: 'CashSession',
      entityId: session.id,
      newValues: { closingBalance, expectedBalance, difference: session.difference },
      ipAddress: req.ip,
    });

    res.json(session);
  }

  static async listCashSessions(req, res) {
    const sessions = await CashSession.findAll({
      where: { tenantId: req.user.tenantId },
      include: [
        { model: User, as: 'opener', attributes: ['id', 'name'] },
        { model: User, as: 'closer', attributes: ['id', 'name'] },
      ],
      order: [['openedAt', 'DESC']],
      limit: parseInt(req.query.limit || '30', 10),
    });
    res.json(sessions);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AVOIRS (CREDIT NOTES)
  // ══════════════════════════════════════════════════════════════════════════

  static async createCreditNote(req, res) {
    const { eleveId, echeanceId, abonnementId, amount, reason, type } = req.body;
    const tenantId = req.user.tenantId;

    const t = await sequelize.transaction();
    try {
      const count = await CreditNote.count({ where: { tenantId } });
      const reference = `AVO-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

      const note = await CreditNote.create({
        tenantId, reference, eleveId,
        echeanceId: echeanceId || null,
        abonnementId: abonnementId || null,
        amount, reason,
        type: type || 'REMISE',
        issuedBy: req.user.id,
      }, { transaction: t });

      if (echeanceId) {
        const ech = await EcheancePaiement.findByPk(echeanceId, { transaction: t });
        if (ech) {
          const newRemaining = Math.max(0, parseFloat(ech.amountRemaining || ech.montant) - parseFloat(amount));
          await ech.update({
            amountRemaining: newRemaining,
            statut: newRemaining <= 0 ? 'SOLDEE' : ech.statut,
          }, { transaction: t });
        }
      }

      await FinanceAuditEvent.create({
        tenantId, userId: req.user.id, userName: req.user.name,
        eventType: 'CREDIT_NOTE_ISSUED',
        entityType: 'CreditNote', entityId: note.id,
        newValues: { amount, reason, type, eleveId, echeanceId },
        ipAddress: req.ip,
      }, { transaction: t });

      await t.commit();
      res.status(201).json(note);
    } catch (err) {
      await t.rollback();
      res.status(500).json({ error: err.message });
    }
  }

  static async listCreditNotes(req, res) {
    const notes = await CreditNote.findAll({
      where: { tenantId: req.user.tenantId },
      include: [
        { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom'] },
        { model: User, as: 'issuer', attributes: ['id', 'name'] },
      ],
      order: [['issuedAt', 'DESC']],
    });
    res.json(notes);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RECETTES DIVERSES
  // ══════════════════════════════════════════════════════════════════════════

  static async createOtherRevenue(req, res) {
    const { eleveId, category, description, amount, revenueDate } = req.body;
    const tenantId = req.user.tenantId;

    const count = await OtherRevenue.count({ where: { tenantId } });
    const reference = `RD-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const revenue = await OtherRevenue.create({
      tenantId, reference, eleveId: eleveId || null,
      category, description, amount,
      revenueDate: revenueDate || new Date().toISOString().slice(0, 10),
    });

    res.status(201).json(revenue);
  }

  static async listOtherRevenues(req, res) {
    const { dateFrom, dateTo, category } = req.query;
    const where = { tenantId: req.user.tenantId };
    if (category) where.category = category;

    const revenues = await OtherRevenue.findAll({
      where,
      include: [
        { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom'] },
      ],
      order: [['revenueDate', 'DESC']],
    });
    res.json(revenues);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DOSSIERS DE RECOUVREMENT
  // ══════════════════════════════════════════════════════════════════════════

  static async listCollectionCases(req, res) {
    const { status, agingBucket, priority } = req.query;
    const where = { tenantId: req.user.tenantId };
    if (status) where.status = status;
    if (agingBucket) where.agingBucket = agingBucket;
    if (priority) where.priority = priority;

    const cases = await CollectionCase.findAll({
      where,
      include: [
        { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom', 'niveau', 'parent1'] },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
      ],
      order: [['totalOutstanding', 'DESC']],
    });
    res.json(cases);
  }

  static async getCollectionCase(req, res) {
    const caseObj = await CollectionCase.findByPk(req.params.id, {
      include: [
        { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom', 'niveau', 'parent1', 'whatsappPrincipal'] },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
        { model: CollectionAction, as: 'actions', include: [
          { model: User, as: 'performer', attributes: ['id', 'name'] },
        ], order: [['performedAt', 'DESC']] },
      ],
    });
    if (!caseObj || caseObj.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Dossier non trouvé.' });

    // Joindre les échéances en retard de l'élève
    const echeances = await EcheancePaiement.findAll({
      where: {
        tenantId: req.user.tenantId,
        eleveId: caseObj.eleveId,
        statut: ['EN_RETARD', 'EN_ATTENTE'],
      },
      include: [{ model: Service, as: 'service', attributes: ['name'] }],
      order: [['dateEcheance', 'ASC']],
    });

    res.json({ ...caseObj.toJSON(), echeancesEnRetard: echeances });
  }

  static async addCollectionAction(req, res) {
    const caseObj = await CollectionCase.findByPk(req.params.id);
    if (!caseObj || caseObj.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Dossier non trouvé.' });

    const { actionType, channel, content, result, nextActionDate } = req.body;

    const action = await CollectionAction.create({
      tenantId: req.user.tenantId,
      caseId: caseObj.id,
      actionType,
      channel: channel || null,
      performedBy: req.user.id,
      content, result,
      nextActionDate: nextActionDate || null,
    });

    if (req.body.status) {
      await caseObj.update({ status: req.body.status });
    }

    res.status(201).json(action);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD FINANCIER
  // ══════════════════════════════════════════════════════════════════════════

  static async getDashboard(req, res) {
    const tenantId = req.user.tenantId;
    const { academicYearId, civilYear } = req.query;

    let yearId = academicYearId;
    if (!yearId) {
      const active = await AcademicYear.findOne({
        where: { tenantId, status: 'EN_COURS' },
      });
      yearId = active?.id;
    }

    if (!yearId) return res.status(400).json({ error: 'Aucune année scolaire active.' });

    const year = parseInt(civilYear || new Date().getFullYear(), 10);
    const dashboard = await FinanceV2Service.getDashboard(tenantId, yearId, year);

    res.json(dashboard);
  }

  static async getCAEngagement(req, res) {
    const { academicYearId } = req.query;
    if (!academicYearId) return res.status(400).json({ error: 'academicYearId requis.' });
    const data = await FinanceV2Service.getCAEngagement(req.user.tenantId, academicYearId);
    res.json(data);
  }

  static async getCAComptable(req, res) {
    const { civilYear, month } = req.query;
    if (!civilYear) return res.status(400).json({ error: 'civilYear requis.' });
    const data = await FinanceV2Service.getCAComptable(req.user.tenantId, parseInt(civilYear), month ? parseInt(month) : null);
    res.json(data);
  }

  static async getBalanceAgee(req, res) {
    const data = await FinanceV2Service.getBalanceAgee(req.user.tenantId);
    res.json(data);
  }

  static async getCreancesAEchoir(req, res) {
    const data = await FinanceV2Service.getCreancesAEchoir(req.user.tenantId);
    res.json(data);
  }

  static async getEncaissements(req, res) {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateTo || new Date().toISOString().slice(0, 10);
    const data = await FinanceV2Service.getEncaissements(req.user.tenantId, from, to);
    res.json(data);
  }
}
