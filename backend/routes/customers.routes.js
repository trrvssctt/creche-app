
import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Lecture : ERP standard + rôles crèche (pour le module Admissions et l'inscription d'élèves)
const READ_ROLES  = ['ADMIN', 'SALES', 'ACCOUNTANT', 'EMPLOYEE', 'STOCK_MANAGER',
                     'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE', 'HR_MANAGER'];
// Écriture : ERP standard + rôles crèche autorisés
const WRITE_ROLES = ['ADMIN', 'SALES', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ACCOUNTANT'];

router.get('/',    checkPermission(READ_ROLES),  CustomerController.list);
router.get('/:id', checkPermission(READ_ROLES),  CustomerController.getDetails);
router.post('/',   checkPermission(WRITE_ROLES), CustomerController.create);
router.put('/:id', checkPermission(WRITE_ROLES), CustomerController.update);

// Suppression : Uniquement ADMIN
router.delete('/:id', checkPermission(['ADMIN']), CustomerController.delete);

export default router;
