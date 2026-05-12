import { Router } from 'express';
import { BulletinController } from '../controllers/BulletinController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const READ_ROLES  = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE', 'ACCOUNTANT'];
const WRITE_ROLES = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT'];

router.get('/',    checkPermission(READ_ROLES),  BulletinController.list);
router.get('/:id', checkPermission(READ_ROLES),  BulletinController.getById);
router.post('/',   checkPermission(WRITE_ROLES), BulletinController.upsert);
router.delete('/:id', checkPermission(['ADMIN']), BulletinController.delete);

export default router;
