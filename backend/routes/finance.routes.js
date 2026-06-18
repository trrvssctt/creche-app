
import { Router } from 'express';
import { FinanceController } from '../controllers/FinanceController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

/**
 * @route GET /api/finance/report
 * @desc  Rapport financier complet (KPIs)
 */
router.get('/report', checkPermission(['ADMIN', 'ACCOUNTANT']), FinanceController.getFinancialReport);

/**
 * @route GET /api/finance/export
 * @desc  Export journal comptable
 */
router.get('/export', checkPermission(['ADMIN', 'ACCOUNTANT']), FinanceController.exportAccountingJournal);

export default router;
