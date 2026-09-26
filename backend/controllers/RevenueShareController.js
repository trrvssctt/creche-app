import { RevenueShareService } from '../services/RevenueShareService.js';
import { Tenant, AcademicYear } from '../models/index.js';

/**
 * Pilotage de la redevance contractuelle sur le chiffre d'affaires.
 * Réservé au SUPER_ADMIN (cf. admin.routes.js).
 */
export class RevenueShareController {

  static parseOptions(req) {
    return {
      periodType:     req.query.periodType === 'ACADEMIC_YEAR' ? 'ACADEMIC_YEAR' : 'CIVIL_YEAR',
      civilYear:      req.query.civilYear,
      academicYearId: req.query.academicYearId,
      basis:          req.query.basis,
    };
  }

  /** Vue consolidée de tous les établissements. */
  static async getOverview(req, res) {
    try {
      const data = await RevenueShareService.computeOverview(RevenueShareController.parseOptions(req));
      res.json(data);
    } catch (err) {
      console.error('[REVENUE_SHARE] overview', err);
      res.status(500).json({ error: 'RevenueShareError', message: err.message });
    }
  }

  /** Détail d'un établissement : CA, ventilation mensuelle, redevance. */
  static async getTenantDetail(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.params.tenantId, { attributes: ['id', 'name'] });
      if (!tenant) return res.status(404).json({ error: 'NotFound', message: 'Établissement introuvable.' });

      const data = await RevenueShareService.computeForTenant(tenant.id, RevenueShareController.parseOptions(req));
      const academicYears = await AcademicYear.findAll({
        where: { tenantId: tenant.id },
        attributes: ['id', 'label', 'startDate', 'endDate', 'status'],
        order: [['startDate', 'DESC']],
      });

      res.json({ ...data, tenantName: tenant.name, academicYears });
    } catch (err) {
      console.error('[REVENUE_SHARE] detail', err);
      res.status(500).json({ error: 'RevenueShareError', message: err.message });
    }
  }

  /** Paramètres de redevance d'un établissement. */
  static async getSettings(req, res) {
    try {
      const settings = await RevenueShareService.getSettings(req.params.tenantId);
      res.json(RevenueShareService.normalizeSettings(settings));
    } catch (err) {
      console.error('[REVENUE_SHARE] getSettings', err);
      res.status(500).json({ error: 'RevenueShareError', message: err.message });
    }
  }

  /** Réglage du taux (0,50 % – 1,00 %) et de la base de calcul. */
  static async updateSettings(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.params.tenantId, { attributes: ['id'] });
      if (!tenant) return res.status(404).json({ error: 'NotFound', message: 'Établissement introuvable.' });

      const settings = await RevenueShareService.updateSettings(
        tenant.id,
        req.body,
        { id: req.user?.id, name: req.user?.name }
      );
      res.json(settings);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: 'ValidationError', message: err.message });
      console.error('[REVENUE_SHARE] updateSettings', err);
      res.status(500).json({ error: 'RevenueShareError', message: err.message });
    }
  }

  /** Journal des changements de taux. */
  static async getRateHistory(req, res) {
    try {
      const history = await RevenueShareService.getRateHistory(req.params.tenantId);
      res.json(history);
    } catch (err) {
      console.error('[REVENUE_SHARE] history', err);
      res.status(500).json({ error: 'RevenueShareError', message: err.message });
    }
  }
}

export default RevenueShareController;
