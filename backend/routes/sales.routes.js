
import { Router } from 'express';
import { SaleController } from '../controllers/SalesController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

router.get('/', checkPermission(['ADMIN', 'SALES', 'ACCOUNTANT', 'STOCK_MANAGER']), SaleController.list);
router.post('/', checkPermission(['ADMIN', 'SALES', 'ACCOUNTANT']), SaleController.create);
router.put('/:id', checkPermission(['ADMIN', 'SALES', 'ACCOUNTANT']), SaleController.updateSale);
router.post('/:id/payments', checkPermission(['ADMIN', 'SALES', 'ACCOUNTANT']), SaleController.addPayment);
router.put('/payments/:paymentId/status', checkPermission(['ADMIN', 'ACCOUNTANT']), SaleController.updatePaymentStatus);
router.post('/:id/delivery', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ACCOUNTANT']), SaleController.recordDelivery);
router.post('/:id/cancel', checkPermission(['ADMIN']), SaleController.cancelSale);

export default router;
