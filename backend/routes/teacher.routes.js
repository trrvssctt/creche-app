import { Router } from 'express';
import { PresenceController } from '../controllers/PresenceController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const TEACHER_READ  = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'MAITRESSE', 'ASSISTANTE'];
const TEACHER_WRITE = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'ASSISTANTE'];

router.get('/presences',       checkPermission(TEACHER_READ),  PresenceController.list);
router.post('/presences',      checkPermission(TEACHER_WRITE), PresenceController.save);
router.get('/presences/stats', checkPermission(TEACHER_READ),  PresenceController.stats);

export default router;
