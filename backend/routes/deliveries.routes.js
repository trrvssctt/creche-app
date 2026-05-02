import { Router } from 'express';
import { DeliveryController } from '../controllers/DeliveryController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Liste et détail
router.get('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ACCOUNTANT']), DeliveryController.list);
router.get('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ACCOUNTANT']), DeliveryController.getDetails);

// Historique des livraisons par produit
router.get('/by-product/:stockItemId', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES']), DeliveryController.getByProduct);

// Création
router.post('/', checkPermission(['ADMIN', 'STOCK_MANAGER']), DeliveryController.create);

// Validation (PENDING → RECEIVED)
router.post('/:id/validate', checkPermission(['ADMIN', 'STOCK_MANAGER']), DeliveryController.validate);

// Annulation
router.post('/:id/cancel', checkPermission(['ADMIN', 'STOCK_MANAGER']), DeliveryController.cancel);

export default router;
