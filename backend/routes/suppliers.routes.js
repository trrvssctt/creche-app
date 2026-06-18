import { Router } from 'express';
import { SupplierController } from '../controllers/SupplierController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Lecture
router.get('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ACCOUNTANT', 'SALES']), SupplierController.list);
router.get('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ACCOUNTANT', 'SALES']), SupplierController.getDetails);

// Écriture
router.post('/', checkPermission(['ADMIN', 'STOCK_MANAGER']), SupplierController.create);
router.put('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER']), SupplierController.update);
router.patch('/:id/toggle', checkPermission(['ADMIN', 'STOCK_MANAGER']), SupplierController.toggle);

// Suppression
router.delete('/:id', checkPermission(['ADMIN']), SupplierController.delete);

export default router;
