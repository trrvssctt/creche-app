
import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController.js';
import { StockMovementController } from '../controllers/StockMovementController.js';
import { InventoryCampaignController } from '../controllers/InventoryCampaignController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Catalogue
// Catalogue (lecture) : inclure ACCOUNTANT pour accès en lecture aux pages financières/comptables
router.get('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'EMPLOYEE', 'ACCOUNTANT', 'ASSISTANTE']), InventoryController.list);
router.post('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryController.createItem);
router.put('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryController.updateItem);
router.delete('/:id', checkPermission(['ADMIN']), InventoryController.deleteItem);

// Mouvements
router.get('/movements', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), StockMovementController.list);
router.get('/movements/stats', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), StockMovementController.getStats);
router.post('/movements/bulk-in', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), StockMovementController.createBulkIn);

// Audit Inventaire (Nouveau) - lecture autorisée aux vendeurs pour afficher l'état des campagnes
router.get('/campaigns', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ASSISTANTE']), InventoryCampaignController.list);
router.post('/campaigns', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.create);
router.get('/campaigns/:id', checkPermission(['ADMIN', 'STOCK_MANAGER', 'SALES', 'ASSISTANTE']), InventoryCampaignController.getDetails);
router.put('/campaigns/:campaignId/items/:itemId', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.updateItem);
router.post('/campaigns/:id/validate', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.validate);
router.post('/campaigns/:id/suspend', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.suspend);
router.post('/campaigns/:id/cancel', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.cancel);
router.post('/campaigns/:id/resume', checkPermission(['ADMIN', 'STOCK_MANAGER', 'ASSISTANTE']), InventoryCampaignController.resume);

export default router;
