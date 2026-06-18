import { Router } from 'express';
import { EleveDossierController } from '../controllers/EleveDossierController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router({ mergeParams: true }); // mergeParams pour récupérer :eleveId

const READ_ROLES  = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE',
                     'ACCOUNTANT', 'SALES', 'HR_MANAGER', 'EMPLOYEE'];
const WRITE_ROLES = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE',
                     'ACCOUNTANT', 'SALES'];

router.get('/admin',                   checkPermission(READ_ROLES),  EleveDossierController.listAdmin);
router.get('/academique',              checkPermission(READ_ROLES),  EleveDossierController.listAnnees);
router.get('/academique/:annee',       checkPermission(READ_ROLES),  EleveDossierController.listAnneeDoc);
router.post('/',                       checkPermission(WRITE_ROLES), EleveDossierController.addDoc);
router.delete('/:docId',               checkPermission(WRITE_ROLES), EleveDossierController.deleteDoc);

export default router;
