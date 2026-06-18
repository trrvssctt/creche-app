import { Router } from 'express';
import { PlanningController } from '../controllers/PlanningController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const ALL_STAFF  = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'MAITRESSE', 'ASSISTANTE'];
const WRITE_ROLES = ['ADMIN', 'DIRECTEUR'];

router.get('/config',            checkPermission(ALL_STAFF),   PlanningController.getConfig);
router.post('/config',           checkPermission(WRITE_ROLES), PlanningController.upsertConfig);
router.get('/exceptions',        checkPermission(ALL_STAFF),   PlanningController.listExceptions);
router.post('/exceptions',       checkPermission(WRITE_ROLES), PlanningController.createException);
router.delete('/exceptions/:id', checkPermission(WRITE_ROLES), PlanningController.deleteException);

export default router;
