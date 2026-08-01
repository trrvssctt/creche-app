import { Router } from 'express';
import { MatiereController } from '../controllers/MatiereController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const READ_ROLES = ['ADMIN', 'DIRECTEUR', 'MAITRESSE', 'COMPTABLE'];
const WRITE_ROLES = ['ADMIN', 'DIRECTEUR'];

router.get('/', checkPermission(READ_ROLES), MatiereController.list);
router.post('/', checkPermission(WRITE_ROLES), MatiereController.create);
router.put('/:id', checkPermission(WRITE_ROLES), MatiereController.update);
router.delete('/:id', checkPermission(WRITE_ROLES), MatiereController.remove);

export default router;
