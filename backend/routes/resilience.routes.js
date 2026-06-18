
import { Router } from 'express';
import { ResilienceController } from '../controllers/ResilienceController.js';
import { SecurityController } from '../controllers/SecurityController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

/**
 * @route GET /api/resilience/backups
 * @desc  Historique des snapshots de l'instance
 */
router.get('/backups', checkPermission(['ADMIN']), ResilienceController.getRestorePoints);

/**
 * @route POST /api/resilience/backups/trigger
 * @desc  Déclenche un backup manuel (avant opération critique)
 */
router.post('/backups/trigger', checkPermission(['ADMIN']), ResilienceController.triggerManualBackup);

/**
 * @route GET /api/resilience/health
 * @desc  Diagnostic d'intégrité du Kernel
 */
router.get('/health', checkPermission(['ADMIN']), ResilienceController.getHealthReport);

/**
 * @route GET /api/resilience/audit
 * @desc  Récupère le registre d'audit immuable de l'entreprise
 */
router.get('/audit', checkPermission(['ADMIN', 'ACCOUNTANT']), SecurityController.getAuditTrail);

export default router;
