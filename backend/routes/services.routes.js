
import { Router } from 'express';
import { ServiceController } from '../controllers/ServiceController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Lecture : Tout le monde y compris les employés
router.get('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ACCOUNTANT', 'EMPLOYEE']), ServiceController.list);

// Écriture : Rôles opérationnels
router.post('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ACCOUNTANT']), ServiceController.create);
router.put('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ACCOUNTANT']), ServiceController.update);
router.delete('/:id', checkPermission(['ADMIN']), ServiceController.delete);

export default router;
