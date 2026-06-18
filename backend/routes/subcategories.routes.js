
import { Router } from 'express';
import { SubcategoryController } from '../controllers/SubcategoryController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Lecture : Ouvert aux Admins, Managers et Employés
// Lecture : Ouvert aux Admins, Managers, Employés et Comptables (lecture seule pour ACCOUNTANT)
router.get('/', checkPermission(['ADMIN', 'STOCK_MANAGER', 'EMPLOYEE', 'ACCOUNTANT']), SubcategoryController.list);

// Écriture : Autorisé pour ADMIN et STOCK_MANAGER
router.post('/', checkPermission(['ADMIN', 'STOCK_MANAGER']), SubcategoryController.create);
router.put('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER']), SubcategoryController.update);
router.delete('/:id', checkPermission(['ADMIN', 'STOCK_MANAGER']), SubcategoryController.delete);

export default router;
