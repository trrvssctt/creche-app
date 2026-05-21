import { Router } from 'express';
import { ScheduleController } from '../controllers/ScheduleController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const ALL_STAFF = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'MAITRESSE', 'ASSISTANTE'];
const WRITE_ROLES = ['ADMIN', 'DIRECTEUR'];

router.get('/my',  checkPermission(ALL_STAFF),  ScheduleController.mySchedule);
router.get('/',    checkPermission(ALL_STAFF),  ScheduleController.list);
router.post('/',   checkPermission(WRITE_ROLES), ScheduleController.create);
router.put('/:id', checkPermission(WRITE_ROLES), ScheduleController.update);
router.delete('/:id', checkPermission(WRITE_ROLES), ScheduleController.delete);

export default router;
