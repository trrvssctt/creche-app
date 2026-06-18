import { Router } from 'express';
import { ClasseController } from '../controllers/ClasseController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const READ_ROLES  = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE', 'ACCOUNTANT'];
const WRITE_ROLES = ['ADMIN'];

router.get('/',    checkPermission(READ_ROLES),  ClasseController.list);
router.get('/:id', checkPermission(READ_ROLES),  ClasseController.getById);
router.post('/',   checkPermission(WRITE_ROLES), ClasseController.create);
router.put('/:id', checkPermission(WRITE_ROLES), ClasseController.update);
router.delete('/:id', checkPermission(['ADMIN']), ClasseController.delete);

export default router;
