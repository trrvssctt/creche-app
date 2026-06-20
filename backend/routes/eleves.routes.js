import { Router } from 'express';
import { EleveController } from '../controllers/EleveController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

// Rôles autorisés à consulter les fiches élèves
const READ_ROLES  = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE',
                     'ACCOUNTANT', 'SALES', 'HR_MANAGER', 'EMPLOYEE'];
// Rôles autorisés à créer / modifier
const WRITE_ROLES = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'SALES', 'COMPTABLE', 'ACCOUNTANT'];

// Routes statiques avant les routes paramétriques (:id)
router.post('/sync-abonnements',  checkPermission(['ADMIN']), EleveController.syncAbonnements);

router.get('/',       checkPermission(READ_ROLES),  EleveController.list);
router.get('/:id',    checkPermission(READ_ROLES),  EleveController.getById);
router.post('/',      checkPermission(WRITE_ROLES), EleveController.create);
router.put('/:id',    checkPermission(WRITE_ROLES), EleveController.update);
router.delete('/:id', checkPermission(['ADMIN']),   EleveController.delete);
router.post('/:id/facture-inscription', checkPermission(WRITE_ROLES), EleveController.factureInscription);
router.post('/:id/reinscription',       checkPermission(WRITE_ROLES), EleveController.reinscription);

export default router;
