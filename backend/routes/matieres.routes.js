import { Router } from 'express';
import { MatiereController } from '../controllers/MatiereController.js';
import { authorizeRoles } from '../middlewares/authorize.js';

const router = Router();

const READ_ROLES = ['ADMIN', 'DIRECTEUR', 'MAITRESSE', 'COMPTABLE'];
const WRITE_ROLES = ['ADMIN', 'DIRECTEUR'];

router.get('/', authorizeRoles(...READ_ROLES), MatiereController.list);
router.post('/', authorizeRoles(...WRITE_ROLES), MatiereController.create);
router.put('/:id', authorizeRoles(...WRITE_ROLES), MatiereController.update);
router.delete('/:id', authorizeRoles(...WRITE_ROLES), MatiereController.remove);

export default router;
