
import { Router } from 'express';
import { RecoveryController } from '../controllers/RecoveryController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

router.get('/debtors', checkPermission(['ADMIN', 'ACCOUNTANT']), RecoveryController.listDebtors);
router.post('/remind/email', checkPermission(['ADMIN', 'ACCOUNTANT']), RecoveryController.sendEmailReminder);

export default router;
