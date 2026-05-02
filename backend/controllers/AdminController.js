
import { Tenant, User, Subscription, Plan, Payment, AuditLog, Sale, Customer, StockItem, ProductMovement, Category, Subcategory } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op, fn, col } from 'sequelize';
import crypto from 'crypto';

export class AdminController {
  /**
   * Dashboard Global : Stats, Revenus et Alertes
   */
  static async getGlobalDashboard(req, res) {
    try {
      // ── Period params: ?year=2024 &month=3 &day=15 &week=12 &semester=1 ───
      const now = new Date();
      const filterYear     = req.query.year     ? parseInt(req.query.year,     10) : null;
      const filterMonth    = req.query.month    ? parseInt(req.query.month,    10) : null;
      const filterDay      = req.query.day      ? parseInt(req.query.day,      10) : null;
      const filterWeek     = req.query.week     ? parseInt(req.query.week,     10) : null;
      const filterSemester = req.query.semester ? parseInt(req.query.semester, 10) : null;

      // Build period boundaries
      let periodStart = null;
      let periodEnd   = null;
      if (filterYear && filterMonth && filterDay) {
        periodStart = new Date(filterYear, filterMonth - 1, filterDay, 0, 0, 0, 0);
        periodEnd   = new Date(filterYear, filterMonth - 1, filterDay + 1, 0, 0, 0, 0);
      } else if (filterYear && filterMonth) {
        periodStart = new Date(filterYear, filterMonth - 1, 1);
        periodEnd   = new Date(filterYear, filterMonth, 1);
      } else if (filterYear && filterSemester) {
        periodStart = filterSemester === 1 ? new Date(filterYear, 0, 1) : new Date(filterYear, 6, 1);
        periodEnd   = filterSemester === 1 ? new Date(filterYear, 6, 1) : new Date(filterYear + 1, 0, 1);
      } else if (filterYear) {
        periodStart = new Date(filterYear, 0, 1);
        periodEnd   = new Date(filterYear + 1, 0, 1);
      } else if (filterWeek) {
        // ISO week of current year
        const wYear  = now.getFullYear();
        const jan4   = new Date(wYear, 0, 4);
        const dow    = jan4.getDay() || 7;
        const week1Mon = new Date(jan4.getTime() - (dow - 1) * 86400000);
        periodStart  = new Date(week1Mon.getTime() + (filterWeek - 1) * 7 * 86400000);
        periodEnd    = new Date(periodStart.getTime() + 7 * 86400000);
      }

      // Determine tenant scoping
      const isSuper = req.user && req.user.role === 'SUPER_ADMIN';
      const requestedTenantId = isSuper ? (req.headers['x-tenant-id'] || null) : (req.user ? req.user.tenantId : null);
      const tenantWhere = requestedTenantId ? { tenantId: requestedTenantId } : null;

      // High level tenant counts
      const totalTenants  = await Tenant.count();
      const activeTenants = await Tenant.count({ where: { isActive: true } });

      // ── Period filter helper ─────────────────────────────────────────────
      const withPeriod = (base = {}) => {
        const w = { ...(tenantWhere || {}), ...base };
        if (periodStart) w.createdAt = { [Op.gte]: periodStart, [Op.lt]: periodEnd };
        return w;
      };

      // ── Sales & finance ──────────────────────────────────────────────────
      const salesWhere = withPeriod({ status: { [Op.ne]: 'ANNULE' } });
      const totalSalesCount = await Sale.count({ where: salesWhere });
      const totalRevenue    = parseFloat(await Sale.sum('totalTtc', { where: salesWhere }) || 0);

      // totalCollected = paiements encaissés dans la période
      // Règle : tout paiement non-chèque est encaissé ; un chèque n'est encaissé qu'au statut PAID
      const chequesPendingStatusList = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];
      const encaishedWhere = {
        ...withPeriod({ saleId: { [Op.ne]: null } }),
        [Op.or]: [
          { method: { [Op.ne]: 'CHEQUE' } },
          { method: 'CHEQUE', status: 'PAID' }
        ]
      };
      const totalCollected = parseFloat(await Payment.sum('amount', { where: encaishedWhere }) || 0);

      // totalChequesPending = chèques reçus mais pas encore encaissés
      const chequesPendingStatuses = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];
      const chequesPendingWhere = {
        ...(tenantWhere || {}),
        saleId: { [Op.ne]: null },
        method: 'CHEQUE',
        status: { [Op.in]: chequesPendingStatuses }
      };
      const totalChequesPending = parseFloat(await Payment.sum('amount', { where: chequesPendingWhere }) || 0);

      // ── Revenus SaaS abonnements (paiements sans vente liée = paiements d'abonnement) ────
      // Ces paiements ont saleId IS NULL. COMPLETED = encaissé, PENDING = en attente de validation.
      const subsCollectedWhere = {
        saleId: null,
        status: { [Op.in]: ['COMPLETED', 'PAID'] },
        ...(periodStart ? { createdAt: { [Op.gte]: periodStart, [Op.lt]: periodEnd } } : {})
      };
      const totalSubscriptionRevenue = parseFloat(await Payment.sum('amount', { where: subsCollectedWhere }) || 0);

      const subsPendingWhere = {
        saleId: null,
        status: 'PENDING',
        ...(periodStart ? { createdAt: { [Op.gte]: periodStart, [Op.lt]: periodEnd } } : {})
      };
      const totalSubscriptionPending = parseFloat(await Payment.sum('amount', { where: subsPendingWhere }) || 0);

      // ── Créances : dettes non réglées à la fin de la période ────────────
      // On charge TOUTES les ventes créées avant la fin de la période,
      // et les paiements reçus avant la fin de la période pour calculer le solde réel.
      const creancesSalesWhere = tenantWhere
        ? { ...tenantWhere, status: { [Op.ne]: 'ANNULE' }, ...(periodEnd ? { createdAt: { [Op.lt]: periodEnd } } : {}) }
        : { status: { [Op.ne]: 'ANNULE' }, ...(periodEnd ? { createdAt: { [Op.lt]: periodEnd } } : {}) };

      const creancesPayBase = {
        saleId: { [Op.ne]: null },
        [Op.or]: [{ method: { [Op.ne]: 'CHEQUE' } }, { method: 'CHEQUE', status: 'PAID' }],
        ...(periodEnd ? { createdAt: { [Op.lt]: periodEnd } } : {})
      };
      const creancesPayWhere = tenantWhere ? { ...tenantWhere, ...creancesPayBase } : creancesPayBase;

      const [allSalesForCreances, allPaymentsForCreances] = await Promise.all([
        Sale.findAll({ where: creancesSalesWhere, include: [{ model: Customer }], attributes: ['id','totalTtc','status','customerId'] }),
        Payment.findAll({ where: creancesPayWhere, attributes: ['saleId','amount'] })
      ]);
      const paidBySale = {};
      allPaymentsForCreances.forEach(p => {
        paidBySale[p.saleId] = (paidBySale[p.saleId] || 0) + parseFloat(p.amount || 0);
      });
      const debtByCustomer = {};
      allSalesForCreances.forEach(s => {
        const paid = paidBySale[s.id] || 0;
        const due  = parseFloat(s.totalTtc || 0) - paid;
        if (due > 0) {
          const cid   = s.Customer?.id || 'PASSAGE';
          const cname = s.Customer?.companyName || s.Customer?.name || 'Client';
          debtByCustomer[cid] = debtByCustomer[cid] || { id: cid, name: cname, total: 0 };
          debtByCustomer[cid].total += due;
        }
      });
      const topDebtors  = Object.values(debtByCustomer).sort((a, b) => b.total - a.total).slice(0, 5);
      const totalUnpaid = Object.values(debtByCustomer).reduce((s, d) => s + d.total, 0);

      const overdueCount = await Sale.count({ where: withPeriod({ status: 'EN_COURS' }) });

      // Recent sales (in period)
      const recentSalesWhere = withPeriod({ status: { [Op.ne]: 'ANNULE' } });
      const recentSales = await Sale.findAll({ where: recentSalesWhere, include: [{ model: Customer }], order: [['createdAt','DESC']], limit: 20 });

      // Latest payments (in period) — uniquement les paiements liés à des ventes (saleId IS NOT NULL)
      const latestPaymentsWhere = {
        saleId: { [Op.ne]: null }, // exclure les paiements d'abonnement
        ...(tenantWhere || {}),
        ...(periodStart ? { createdAt: { [Op.gte]: periodStart, [Op.lt]: periodEnd } } : {})
      };
      const latestPayments = await Payment.findAll({
        where: latestPaymentsWhere,
        include: [{ model: Sale, include: [{ model: Customer }] }],
        order: [['createdAt','DESC']],
        limit: 10
      });

      // Customers
      const activeCustomersWhere = { ...(tenantWhere || {}), status: 'actif' };
      const customersCount   = await Customer.count({ where: activeCustomersWhere });
      const latestCustomers  = await Customer.findAll({ where: activeCustomersWhere, order: [['createdAt','DESC']], limit: 5 });

      // Stock (not time-scoped — reflects current state)
      const stocksTotal   = await StockItem.count({ where: tenantWhere || {} });
      const stocksRupture = await StockItem.count({ where: { ...(tenantWhere || {}), currentLevel: { [Op.lte]: 0 } } });
      const stocksLow     = await StockItem.count({ where: { ...(tenantWhere || {}), [Op.and]: [ { currentLevel: { [Op.gt]: 0 } }, { minThreshold: { [Op.ne]: null } }, sequelize.where(col('stock_item.current_level'), '<=', col('stock_item.min_threshold')) ] } });
      const recentStocks  = await StockItem.findAll({ where: tenantWhere || {}, order: [['updatedAt','DESC']], limit: 20 });

      // Movements (in period)
      const movementsWhere = tenantWhere
        ? { ...tenantWhere, ...(periodStart ? { createdAt: { [Op.gte]: periodStart, [Op.lt]: periodEnd } } : {}) }
        : { ...(periodStart ? { createdAt: { [Op.gte]: periodStart, [Op.lt]: periodEnd } } : {}) };
      const recentMovements = await ProductMovement.findAll({ where: movementsWhere, include: [{ model: StockItem }], order: [['createdAt','DESC']], limit: 10 });

      // Categories
      const categoriesCount    = await Category.count({ where: tenantWhere || {} });
      const subcategoriesCount = await Subcategory.count({ where: tenantWhere || {} });

      // Users
      const usersCount     = await User.count({ where: tenantWhere || {} });
      const recentUsers    = await User.findAll({ where: tenantWhere || {}, order: [['lastLogin','DESC NULLS LAST']], limit: 5 });
      const usersByRoleRaw = await User.findAll({ attributes: ['role', [fn('COUNT', col('role')), 'cnt']], group: ['role'] });
      const usersByRole    = {};
      usersByRoleRaw.forEach(r => { usersByRole[r.role] = parseInt(r.get('cnt'), 10); });

      // Subscriptions
      const subsThreshold = new Date();
      subsThreshold.setDate(subsThreshold.getDate() + 7);
      const subsWhere = requestedTenantId ? { tenantId: requestedTenantId, nextBillingDate: { [Op.lte]: subsThreshold } } : { nextBillingDate: { [Op.lte]: subsThreshold } };
      const subs = await Subscription.findAll({ where: subsWhere, include: [{ model: Tenant, attributes: ['name'] }], limit: 50 });

      const pendingValidationsRaw = await Subscription.findAll({
        where: { status: 'PENDING' },
        include: [{ model: Tenant, attributes: ['id','name','domain','pending_plan_id','pending_period'] }],
        limit: 50
      });
      // Pour chaque souscription PENDING, récupérer le dernier paiement PENDING du tenant
      const pendingValidations = await Promise.all(pendingValidationsRaw.map(async (s) => {
        const tenantIdVal    = s.tenantId || s.Tenant?.id || null;
        const tenantNameVal  = s.Tenant?.name || null;
        const tenantDomainVal= s.Tenant?.domain || null;
        const pendingPeriod  = s.Tenant?.pendingPeriod || s.Tenant?.pending_period || s.currentPeriod || '1M';
        const pendingPlanId  = s.Tenant?.pendingPlanId || s.Tenant?.pending_plan_id || s.planId;

        // Récupérer le vrai montant payé depuis le dernier paiement PENDING
        let paidAmount = null;
        try {
          const lastPay = await Payment.findOne({
            where: { tenantId: tenantIdVal, saleId: null, status: 'PENDING' },
            order: [['created_at', 'DESC']]
          });
          if (lastPay) paidAmount = Number(lastPay.amount);
        } catch (_) {}

        return {
          id: tenantIdVal,
          tenant: { id: tenantIdVal, name: tenantNameVal, domain: tenantDomainVal },
          tenantName: tenantNameVal,
          tenantDomain: tenantDomainVal,
          planId: pendingPlanId,
          period: pendingPeriod,
          amount: paidAmount,
          status: s.status,
          nextBillingDate: s.nextBillingDate,
          requestedAt: s.updatedAt || s.createdAt,
        };
      }));

      // MRR
      let mrr = 0;
      try {
        const activeSubs = await Subscription.findAll({ where: { status: 'ACTIVE' }, include: [{ model: Plan, as: 'planDetails' }] });
        mrr = activeSubs.reduce((sum, s) => sum + Number(s.planDetails?.priceMonthly || 0), 0);
        if (!isFinite(mrr) || Number.isNaN(mrr)) mrr = 0;
      } catch (e) { console.error('[MRR CALC ERROR]', e.message || e); mrr = 0; }

      // ── Revenue stats : granularité adaptée à la période sélectionnée ──────
      // horaire  → jour précis  (year+month+day)
      // quotidien → semaine ou mois  (week | year+month)
      // mensuel  → semestre / année / tout  (default)
      let granularity = 'monthly';
      if (filterYear && filterMonth && filterDay) granularity = 'hourly';
      else if (filterWeek || (filterYear && filterMonth))  granularity = 'daily';

      const revenueStats = [];
      try {
        const chequeOr = [{ method: { [Op.ne]: 'CHEQUE' } }, { method: 'CHEQUE', status: 'PAID' }];

        if (granularity === 'hourly' && periodStart) {
          // 24 tranches horaires
          for (let h = 0; h < 24; h++) {
            const start = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), h);
            const end   = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), h + 1);
            const sw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, status: { [Op.ne]: 'ANNULE' }, ...(tenantWhere || {}) };
            const pw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, saleId: { [Op.ne]: null }, [Op.or]: chequeOr, ...(tenantWhere || {}) };
            const total     = parseFloat((await Sale.sum('totalTtc', { where: sw })) || 0);
            const collected = parseFloat((await Payment.sum('amount',  { where: pw })) || 0);
            revenueStats.push({ label: `${String(h).padStart(2, '0')}h`, total, collected, creances: 0 });
          }
        } else if (granularity === 'daily' && periodStart && periodEnd) {
          // Un point par jour
          const nbDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
          for (let d = 0; d < nbDays; d++) {
            const start = new Date(periodStart.getTime() + d * 86400000);
            const end   = new Date(start.getTime() + 86400000);
            const sw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, status: { [Op.ne]: 'ANNULE' }, ...(tenantWhere || {}) };
            const pw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, saleId: { [Op.ne]: null }, [Op.or]: chequeOr, ...(tenantWhere || {}) };
            const total     = parseFloat((await Sale.sum('totalTtc', { where: sw })) || 0);
            const collected = parseFloat((await Payment.sum('amount',  { where: pw })) || 0);
            revenueStats.push({ label: start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), total, collected, creances: 0 });
          }
        } else {
          // Un point par mois
          const statsYear  = filterYear || now.getFullYear();
          let monthStart, nbMonths;
          if (filterYear && filterSemester) {
            monthStart = filterSemester === 1 ? 0 : 6;
            nbMonths   = 6;
          } else if (filterYear) {
            monthStart = 0;
            nbMonths   = 12;
          } else {
            monthStart = now.getMonth() - 5;
            nbMonths   = 6;
          }
          for (let i = 0; i < nbMonths; i++) {
            const start = new Date(statsYear, monthStart + i, 1);
            const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            const sw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, status: { [Op.ne]: 'ANNULE' }, ...(tenantWhere || {}) };
            const pw = { createdAt: { [Op.gte]: start, [Op.lt]: end }, saleId: { [Op.ne]: null }, [Op.or]: chequeOr, ...(tenantWhere || {}) };
            const total     = parseFloat((await Sale.sum('totalTtc', { where: sw })) || 0);
            const collected = parseFloat((await Payment.sum('amount',  { where: pw })) || 0);
            const creanceSalesUpTo = { createdAt: { [Op.lt]: end }, status: { [Op.ne]: 'ANNULE' }, ...(tenantWhere || {}) };
            const creancePayUpTo   = { createdAt: { [Op.lt]: end }, saleId: { [Op.ne]: null }, [Op.or]: chequeOr, ...(tenantWhere || {}) };
            const [salesTot, payTot] = await Promise.all([
              Sale.sum('totalTtc', { where: creanceSalesUpTo }),
              Payment.sum('amount', { where: creancePayUpTo })
            ]);
            const creances = Math.max(0, parseFloat(salesTot || 0) - parseFloat(payTot || 0));
            revenueStats.push({ label: start.toLocaleDateString('fr-FR', { month: 'short' }), total, collected, creances });
          }
        }
      } catch (e) { console.error('[REVENUE STATS ERROR]', e.message || e); }

      const latePayments = overdueCount;
      const pendingSub   = pendingValidations.length || 0;

      return res.status(200).json({
        // ── Period metadata (consumed by the frontend) ──
        period: {
          year:       filterYear     || now.getFullYear(),
          month:      filterMonth    || null,
          day:        filterDay      || null,
          week:       filterWeek     || null,
          semester:   filterSemester || null,
          isFiltered: !!(filterYear || filterWeek),
          granularity,
          label: filterYear
            ? (filterMonth && filterDay
                ? new Date(filterYear, filterMonth - 1, filterDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : filterMonth
                  ? new Date(filterYear, filterMonth - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                  : filterSemester
                    ? `Semestre ${filterSemester} — ${filterYear}`
                    : String(filterYear))
            : filterWeek
              ? `Semaine ${filterWeek} — ${now.getFullYear()}`
              : 'Toutes les années'
        },
        stats: {
          totalTenants, activeTenants, mrr, latePayments, pendingSub,
          totalSalesCount, totalRevenue, totalCollected, totalChequesPending, totalUnpaid,
          overdueCount, customersCount, stocksTotal, stocksRupture,
          stocksLow, categoriesCount, subcategoriesCount, usersCount,
          totalSubscriptionRevenue, totalSubscriptionPending
        },
        topDebtors,
        latestPayments: latestPayments.map(p => ({ id: p.id, amount: p.amount, createdAt: p.createdAt, saleId: p.saleId, customer: p.Sale?.Customer?.companyName || null })),
        recentSales: recentSales.map(s => ({ id: s.id, reference: s.reference, totalTtc: s.totalTtc, amountPaid: s.amountPaid || 0, status: s.status, createdAt: s.createdAt, customer: s.Customer?.companyName, operator: s.operator || s.operatorName || null })),
        latestCustomers: latestCustomers.map(c => ({ id: c.id, companyName: c.companyName || c.name, createdAt: c.createdAt })),
        recentMovements: recentMovements.map(m => ({ id: m.id, productName: m.productName || m.StockItem?.name, quantity: m.quantity, createdAt: m.createdAt, type: m.type, userRef: m.userRef || m.userName || (m.user ? m.user.name : null) })),
        users: { count: usersCount, byRole: usersByRole, recent: recentUsers.map(u => ({ id: u.id, name: u.name, email: u.email, lastLogin: u.lastLogin, role: u.role || 'EMPLOYEE' })) },
        subscriptionAlerts: subs.map(s => ({ tenant: s.Tenant?.name, nextBillingDate: s.nextBillingDate, status: s.status })),
        subscription: subs && subs.length > 0 ? { subscription: { nextBillingDate: subs[0].nextBillingDate, tenant: subs[0].Tenant?.name, status: subs[0].status, planId: subs[0].planId } } : null,
        stocks: recentStocks.map(s => ({ id: s.id, name: s.name, currentLevel: s.currentLevel, minThreshold: s.minThreshold, sku: s.sku })),
        pendingValidations,
        revenueStats
      });
    } catch (error) {
      console.error("[KERNEL ADMIN DASHBOARD ERROR]:", error);
      return res.status(500).json({ error: error.name, message: error.message });
    }
  }

  /**
   * Paiements récents depuis un timestamp donné (polling live)
   * GET /admin/payments/recent?since=<ISO>
   */
  static async getRecentPayments(req, res) {
    try {
      const since = req.query.since
        ? new Date(req.query.since)
        : new Date(Date.now() - 5 * 60 * 1000); // défaut : 5 dernières minutes

      const payments = await Payment.findAll({
        where: { createdAt: { [Op.gt]: since } },
        include: [
          { model: Tenant, attributes: ['name'] },
          { model: Sale, required: false, include: [{ model: Customer, attributes: ['companyName', 'name'] }] }
        ],
        order: [['createdAt', 'DESC']],
        limit: 20
      });

      return res.status(200).json({
        payments: payments.map(p => ({
          id:        p.id,
          amount:    Number(p.amount),
          method:    p.method,
          status:    p.status,
          createdAt: p.createdAt,
          type:      p.saleId ? 'vente' : 'abonnement',
          tenant:    p.Tenant?.name || null,
          customer:  p.Sale?.Customer?.companyName || p.Sale?.Customer?.name || null,
          reference: p.reference || null,
        })),
        checkedAt: new Date().toISOString(),
        count: payments.length
      });
    } catch (error) {
      console.error('[RECENT PAYMENTS ERROR]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Liste enrichie des comptes
   */
  static async listTenants(req, res) {
    try {
      const tenants = await Tenant.findAll({
        order: [['createdAt', 'DESC']],
        include: [
          { 
            model: Subscription, 
            as: 'subscription',
            include: [{ model: Plan, as: 'planDetails' }]
          }
        ]
      });
      
      const enriched = await Promise.all(tenants.map(async (t) => {
        const userCount = await User.count({ where: { tenantId: t.id } });
        return { 
          ...t.toJSON(), 
          userCount,
          planName: t.subscription?.planDetails?.name || 'SANS_PLAN',
          planMaxUsers: t.subscription?.planDetails?.maxUsers || 0,
          isUpToDate: t.paymentStatus === 'UP_TO_DATE' || t.paymentStatus === 'TRIAL'
        };
      }));

      return res.status(200).json(enriched);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Détails d'une souscription spécifique (Registry Billing)
   */
  static async getTenantBillingDetails(req, res) {
    try {
      const { id } = req.params;
      const tenant = await Tenant.findByPk(id, {
        include: [
          { 
            model: Subscription, 
            as: 'subscription',
            include: [{ model: Plan, as: 'planDetails' }]
          }
        ]
      });

      if (!tenant) return res.status(404).json({ error: 'Instance non trouvée' });

      const payments = await Payment.findAll({
        where: { tenantId: id, saleId: null },
        order: [['paymentDate', 'DESC']]
      });

      const userCount = await User.count({ where: { tenantId: id } });

      return res.status(200).json({
        tenant,
        payments,
        stats: { userCount }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Kill-Switch (Correction de l'audit)
   */
  static async toggleTenantLock(req, res) {
    try {
      const { id } = req.params;
      const tenant = await Tenant.findByPk(id);
      if (!tenant) return res.status(404).json({ error: 'Tenant non trouvé' });

      await tenant.update({ isActive: !tenant.isActive });
      
      // Audit: only set userId when the user exists in the users table.
      // Some master/system actors may exist outside of the tenants' users table,
      // so we fallback to recording only `userName` and a null `userId` to avoid FK violations.
      let auditUserId = null;
      let auditUserName = 'SYSTEM';
      try {
        if (req.user && req.user.id) {
          const found = await User.findByPk(req.user.id);
          if (found) auditUserId = req.user.id;
          auditUserName = req.user.name || (found ? found.name : auditUserName);
        }
      } catch (e) {
        // don't fail the main flow for audit lookup errors
      }

      await AuditLog.create({
        tenantId: id,
        userId: auditUserId,
        userName: auditUserName,
        action: tenant.isActive ? 'TENANT_UNLOCKED' : 'TENANT_LOCKED',
        resource: `Tenant: ${tenant.name} (${tenant.domain})`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`LOCK_ACTION:${id}:${Date.now()}`).digest('hex')
      });

      return res.status(200).json(tenant);
    } catch (error) {
      console.error("[TOGGLE LOCK ERROR]:", error);
      return res.status(500).json({ error: error.name, message: error.message });
    }
  }

  static async listPlans(req, res) {
    try {
      const plans = await Plan.findAll({ order: [['priceMonthly', 'ASC']] });
      return res.status(200).json(plans);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Retourne les logs d'audit (filtres: tenantId, userId, q, limit, offset)
   */
  static async getLogs(req, res) {
    try {
      const { tenantId, userId, q, limit = 200, offset = 0 } = req.query;
      const where = {};
      if (tenantId) where.tenantId = tenantId;
      if (userId) where.userId = userId;
      if (q) where[Op.or] = [
        { action: { [Op.iLike]: `%${q}%` } },
        { resource: { [Op.iLike]: `%${q}%` } },
        { userName: { [Op.iLike]: `%${q}%` } }
      ];

      const logs = await AuditLog.findAll({ where, order: [['createdAt', 'DESC']], limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
      return res.status(200).json(logs.map(l => ({ id: l.id, tenantId: l.tenantId, userId: l.userId, userName: l.userName, action: l.action, resource: l.resource, status: l.status, severity: l.severity, createdAt: l.createdAt })));
    } catch (error) {
      console.error('[GET LOGS ERROR]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Liste les utilisateurs d'un tenant (support pour SuperAdmin views)
   */
  static async listUsersForTenant(req, res) {
    try {
      const { id } = req.params;
      const users = await User.findAll({ where: { tenantId: id }, order: [['createdAt', 'DESC']] });
      return res.status(200).json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, lastLogin: u.lastLogin })));
    } catch (error) {
      console.error('[LIST USERS FOR TENANT ERROR]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur d'un tenant (SuperAdmin uniquement)
   */
  static async resetUserPassword(req, res) {
    try {
      const { tenantId, userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      }

      const user = await User.findOne({ where: { id: userId, tenantId } });
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur introuvable dans ce compte.' });
      }

      const hashed = await import('bcrypt').then(m => m.default.hash(newPassword.trim(), 10));
      await user.update({ password: hashed });

      // Audit log — vérifier que req.user existe dans la table users pour éviter la FK violation
      let auditUserId = null;
      let auditUserName = 'SUPER_ADMIN';
      if (req.user?.id) {
        const found = await User.findByPk(req.user.id);
        if (found) auditUserId = req.user.id;
        auditUserName = req.user.name || (found ? found.name : auditUserName);
      }

      await AuditLog.create({
        tenantId,
        userId: auditUserId,
        userName: auditUserName,
        action: 'RESET_PASSWORD',
        resource: 'User',
        resourceId: userId,
        description: `Mot de passe réinitialisé pour l'utilisateur ${user.name} (${user.email})`,
        severity: 'HIGH',
        status: 'SUCCESS',
        ipAddress: req.ip || null,
        sha256Signature: crypto.createHash('sha256').update(`RESET_PASSWORD:${userId}:${Date.now()}`).digest('hex'),
      });

      return res.status(200).json({ message: `Mot de passe de "${user.name}" réinitialisé avec succès.` });
    } catch (error) {
      console.error('[RESET USER PASSWORD ERROR]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async createPlan(req, res) {
    try {
      const plan = await Plan.create(req.body);
      return res.status(201).json(plan);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async updatePlan(req, res) {
    try {
      const plan = await Plan.findByPk(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Plan non trouvé' });
      await plan.update(req.body);
      return res.status(200).json(plan);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async deletePlan(req, res) {
    try {
      const plan = await Plan.findByPk(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Plan non trouvé' });
      await plan.update({ isActive: false });
      return res.status(200).json({ message: 'Plan désactivé.' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async sendEmailToOwner(req, res) {
    try {
      const { tenantId, tenantName, subject, body: bodyText, toEmail } = req.body || {};
      let tenant = null;
      if (tenantId) tenant = await Tenant.findByPk(tenantId);
      else if (tenantName) tenant = await Tenant.findOne({ where: { name: tenantName } });

      const recipients = [];
      if (toEmail) recipients.push(toEmail);
      if (tenant) {
        if (tenant.contactEmail) recipients.push(tenant.contactEmail);
        if (tenant.email) recipients.push(tenant.email);
        // find admin/owner users
        try {
          const admins = await User.findAll({ where: { tenantId: tenant.id, role: { [Op.in]: ['OWNER', 'ADMIN'] } } });
          admins.forEach(a => { if (a.email) recipients.push(a.email); });
        } catch (e) {
        }
      }

      // dedupe and filter
      const toList = Array.from(new Set((recipients || []).filter(Boolean)));
      if (toList.length === 0) return res.status(400).json({ error: 'Aucun destinataire trouvé' });

      const to = toList.join(',');

      // Prepare audit user info: only set `userId` when that user exists in `users` table
      let auditUserId = null;
      let auditUserName = 'SYSTEM';
      try {
        if (req.user && req.user.id) {
          const foundUser = await User.findByPk(req.user.id);
          if (foundUser) auditUserId = req.user.id;
          auditUserName = req.user.name || (foundUser ? foundUser.name : auditUserName);
        }
      } catch (e) {
      }

      // Attempt to send via SMTP if configured. Capture any SMTP error for diagnostics
      let smtpError = null;
      if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
          const nodemailer = (await import('nodemailer')).default;
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
          });

          const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@kernel-saas.local',
            to,
            subject: subject || 'Notification Kernel SaaS',
            text: bodyText || '',
            html: bodyText ? (String(bodyText).replace(/\n/g, '<br/>')) : undefined
          };

          const info = await transporter.sendMail(mailOptions);
          try {
            await AuditLog.create({
              tenantId: tenant ? tenant.id : null,
              userId: auditUserId,
              userName: auditUserName,
              action: 'EMAIL_SENT',
              resource: `To:${to} Subject:${mailOptions.subject}`,
              severity: 'LOW',
              sha256Signature: crypto.createHash('sha256').update(`EMAIL_SENT:${to}:${Date.now()}`).digest('hex')
            });
          } catch (auditErr) {
            console.error('[AUDIT CREATE FAILED AFTER SMTP SEND]', auditErr);
            // return success to client but include audit warning
            return res.status(200).json({ message: 'Email envoyé (audit log failed)', info, auditError: String(auditErr?.message || auditErr) });
          }

          return res.status(200).json({ message: 'Email envoyé', info });
        } catch (err) {
          console.error('[SMTP SEND ERROR]', err);
          smtpError = String(err?.message || err);
          // fallthrough to queued fallback
        }
      }

      // Fallback: queue/log the message in AuditLog when SMTP not configured or send failed
      try {
        await AuditLog.create({
          tenantId: tenant ? tenant.id : null,
          userId: auditUserId,
          userName: auditUserName,
          action: 'EMAIL_QUEUED',
          resource: `To:${to} Subject:${subject || 'no-subject'} Body:${String(bodyText || '').slice(0,240)}`,
          severity: 'LOW',
          sha256Signature: crypto.createHash('sha256').update(`EMAIL_QUEUE:${to}:${Date.now()}`).digest('hex')
        });
      } catch (auditErr) {
        console.error('[AUDIT CREATE FAILED FOR QUEUED EMAIL]', auditErr);
        // don't fail the request entirely; return a helpful 200 with diagnostic info
        return res.status(200).json({ message: 'SMTP non configuré ou envoi échoué, tentative de mise en file échouée (audit log)', queuedTo: to, smtpError, auditError: String(auditErr?.message || auditErr) });
      }

      return res.status(200).json({ message: 'SMTP non configuré ou envoi échoué, message mis en file (audit log)', queuedTo: to, smtpError });
    } catch (error) {
      console.error('[SEND EMAIL ERROR]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Validation manuelle d'une souscription par le SuperAdmin / Admin
   */
  static async validateSubscription(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params; // tenant id
      const tenant = await Tenant.findByPk(id, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Instance non trouvée' });
      }

      // Find or create subscription record first (needed to read existing planId)
      let sub = await Subscription.findOne({ where: { tenantId: id }, transaction });

      // Determine the plan to activate: pendingPlanId (upgrade) > existing subscription planId > FREE_TRIAL
      // period from body overrides stored pendingPeriod (admin can adjust at validation time)
      const PERIOD_MONTHS = { '1M': 1, '2M': 2, '3M': 3, '6M': 6, '1Y': 12 };
      const pendingPlan   = tenant.pendingPlanId || null;
      const pendingPeriod = req.body.period || tenant.pendingPeriod || '1M';
      const months        = PERIOD_MONTHS[pendingPeriod] || 1;
      const activatePlanId = pendingPlan || sub?.planId || 'FREE_TRIAL';
      // Base calculation on current subscriptionEndsAt if it's in the future (renewal before expiry)
      const currentEnd = tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt) : null;
      const baseDate = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
      const nextBilling = new Date(baseDate);
      nextBilling.setMonth(nextBilling.getMonth() + months);

      if (sub) {
        await sub.update({ status: 'ACTIVE', planId: activatePlanId, nextBillingDate: nextBilling, currentPeriod: pendingPeriod }, { transaction });
      } else {
        sub = await Subscription.create({ tenantId: id, planId: activatePlanId, status: 'ACTIVE', nextBillingDate: nextBilling, currentPeriod: pendingPeriod, autoRenew: true }, { transaction });
      }

      // Reactivate tenant, activate new plan, clear pending fields
      await tenant.update({
        isActive: true,
        paymentStatus: 'UP_TO_DATE',
        lastPaymentDate: new Date(),
        plan: activatePlanId,
        planId: activatePlanId,
        subscriptionEndsAt: nextBilling,
        ...(pendingPlan ? { pendingPlanId: null, pendingPeriod: null } : {})
      }, { transaction });

      // Marquer le paiement PENDING existant comme COMPLETED (évite les doublons)
      try {
        const existingPending = await Payment.findOne({
          where: { tenantId: id, saleId: null, status: 'PENDING' },
          order: [['created_at', 'DESC']],
          transaction
        });
        if (existingPending) {
          await existingPending.update({ status: 'COMPLETED', paymentDate: new Date() }, { transaction });
        } else {
          // Aucun paiement PENDING trouvé : créer un enregistrement de confirmation
          const { amount: bodyAmount, method: bodyMethod } = req.body || {};
          const planObj = await Plan.findByPk(activatePlanId, { transaction });
          const PERIOD_MONTHS_AMT = { '1M': 1, '3M': 3, '1Y': 12 };
          const mths = PERIOD_MONTHS_AMT[pendingPeriod] || 1;
          const fallbackAmount = bodyAmount
            ? Number(bodyAmount)
            : Math.round((planObj?.priceMonthly || 0) * mths);
          await Payment.create({
            tenantId: id,
            saleId: null,
            amount: fallbackAmount,
            method: bodyMethod || 'WAVE',
            reference: `VALID-${Date.now()}`,
            status: 'COMPLETED',
            paymentDate: new Date()
          }, { transaction });
        }
      } catch (e) {
        // don't fail the whole flow for payment logging issues
      }

      // Audit log - verify user exists to avoid FK violation
      let auditUserId = null;
      let auditUserName = 'SYSTEM';
      try {
        if (req.user && req.user.id) {
          const found = await User.findByPk(req.user.id, { transaction });
          if (found) auditUserId = req.user.id;
          auditUserName = req.user.name || (found ? found.name : auditUserName);
        }
      } catch (e) {
      }

      await AuditLog.create({
        tenantId: id,
        userId: auditUserId,
        userName: auditUserName,
        action: 'SUBSCRIPTION_VALIDATED',
        resource: `Tenant: ${tenant.name} (${tenant.domain})`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`VALIDATE_SUB:${id}:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();

      return res.status(200).json({ message: 'Abonnement validé.', tenant: { id: tenant.id, isActive: true } });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('[VALIDATE SUBSCRIPTION ERROR]:', error);
      return res.status(500).json({ error: 'ValidationError', message: 'Une erreur inattendue est survenue sur le serveur.' });
    }
  }

  /**
   * Reject a pending subscription/upgrade request
   */
  static async rejectSubscription(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params; // tenant id
      const tenant = await Tenant.findByPk(id, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Instance non trouvée' });
      }

      // Mark subscription as rejected
      const sub = await Subscription.findOne({ where: { tenantId: id }, transaction });
      if (sub) {
        await sub.update({ status: 'REJECTED' }, { transaction });
      }

      await tenant.update({ paymentStatus: 'REJECTED' }, { transaction });

      // Audit
      await AuditLog.create({
        tenantId: id,
        userId: req.user?.id || null,
        userName: req.user?.name || 'SYSTEM',
        action: 'SUBSCRIPTION_UPGRADE_REJECTED',
        resource: `Tenant: ${tenant.name} (${tenant.domain})`,
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`REJECT_SUB:${id}:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Demande d\'upgrade rejetée.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('[REJECT SUBSCRIPTION ERROR]:', error);
      return res.status(500).json({ error: 'RejectError', message: error.message });
    }
  }

  // ─── Gestion des suppressions de compte ────────────────────────────────────

  /**
   * GET /api/admin/tenants/pending-deletions
   * Liste tous les tenants en attente de suppression (SUPER_ADMIN).
   */
  static async listPendingDeletions(req, res) {
    try {
      const pending = await Tenant.findAll({
        where: { pendingDeletion: true },
        order: [['deletionScheduledFor', 'ASC']],
        attributes: [
          'id', 'name', 'domain', 'email', 'phone',
          'deletionRequestedAt', 'deletionScheduledFor', 'deletionReason',
          'deletionBackupPath', 'planId', 'createdAt'
        ]
      });

      const now     = new Date();
      const results = pending.map(t => ({
        ...t.toJSON(),
        daysRemaining: t.deletionScheduledFor
          ? Math.max(0, Math.ceil((new Date(t.deletionScheduledFor) - now) / 86400000))
          : null,
        isOverdue: t.deletionScheduledFor ? new Date(t.deletionScheduledFor) <= now : false
      }));

      return res.status(200).json({ total: results.length, tenants: results });
    } catch (error) {
      return res.status(500).json({ error: 'ListPendingError', message: error.message });
    }
  }

  /**
   * POST /api/admin/tenants/:id/force-delete
   * Force la suppression immédiate d'un tenant (backup 90j + delete opérationnel).
   * SUPER_ADMIN uniquement.
   */
  static async forceDeleteTenant(req, res) {
    try {
      const { id }    = req.params;
      const { reason } = req.body;

      const tenant = await Tenant.findByPk(id);
      if (!tenant) {
        return res.status(404).json({ error: 'NotFound', message: 'Tenant introuvable.' });
      }

      const deletionReason = reason?.trim() ||
        tenant.deletionReason ||
        'Suppression forcée par SUPER_ADMIN';

      // 1. Créer le backup de suppression (90 jours de rétention)
      const { BackupService } = await import('../services/BackupService.js');
      const backup = await BackupService.createDeletionBackup(id, deletionReason);

      // 2. Audit avant suppression
      await AuditLog.create({
        tenantId:  id,
        userId:    req.user?.id || null,
        userName:  req.user?.name || 'SUPER_ADMIN',
        action:    'ACCOUNT_FORCE_DELETED',
        resource:  `Tenant: ${tenant.name} (${tenant.domain})`,
        severity:  'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`FORCE_DELETE:${id}:${req.user?.id}:${Date.now()}`)
          .digest('hex')
      });

      // 3. Supprimer les données opérationnelles
      await BackupService.deleteTenantData(id);

      return res.status(200).json({
        message:     `Compte "${tenant.name}" supprimé définitivement.`,
        backupInfo: {
          id:          backup.id,
          storagePath: backup.storagePath,
          retainUntil: backup.retainUntil,
          sizeMB:      +((Number(backup.size) || 0) / 1024 / 1024).toFixed(2)
        }
      });
    } catch (error) {
      console.error('[FORCE DELETE TENANT ERROR]:', error);
      return res.status(500).json({ error: 'ForceDeleteError', message: error.message });
    }
  }

  /**
   * POST /api/admin/tenants/:id/cancel-deletion
   * Annule une demande de suppression en attente (SUPER_ADMIN).
   */
  static async cancelTenantDeletion(req, res) {
    try {
      const { id } = req.params;
      const tenant = await Tenant.findByPk(id);
      if (!tenant) {
        return res.status(404).json({ error: 'NotFound', message: 'Tenant introuvable.' });
      }
      if (!tenant.pendingDeletion) {
        return res.status(409).json({
          error:   'NoDeletionPending',
          message: 'Ce tenant n\'a pas de suppression en attente.'
        });
      }

      await tenant.update({
        pendingDeletion:      false,
        deletionRequestedAt:  null,
        deletionScheduledFor: null,
        deletionReason:       null,
        isSuspended:          false,
        suspendedAt:          null,
        suspensionReason:     null
      });

      await AuditLog.create({
        tenantId:  id,
        userId:    req.user?.id || null,
        userName:  req.user?.name || 'SUPER_ADMIN',
        action:    'ACCOUNT_DELETION_CANCELLED_BY_ADMIN',
        resource:  `Tenant: ${tenant.name}`,
        severity:  'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`CANCEL_DELETE:${id}:${req.user?.id}:${Date.now()}`)
          .digest('hex')
      });

      return res.status(200).json({
        message: `Suppression annulée pour "${tenant.name}". Le compte est de nouveau actif.`
      });
    } catch (error) {
      return res.status(500).json({ error: 'CancelDeletionError', message: error.message });
    }
  }
}
