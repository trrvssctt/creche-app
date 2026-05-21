import { Router } from 'express';
import { PresenceController } from '../controllers/PresenceController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const TEACHER_ROLES = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'MAITRESSE'];

router.get('/presences',       checkPermission(TEACHER_ROLES), PresenceController.list);
router.post('/presences',      checkPermission(TEACHER_ROLES), PresenceController.save);
router.get('/presences/stats', checkPermission(TEACHER_ROLES), PresenceController.stats);

export default router;
