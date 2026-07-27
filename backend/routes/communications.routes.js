import { Router } from 'express';
import { CommunicationController } from '../controllers/CommunicationController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const WRITE_ROLES = ['ADMIN', 'DIRECTEUR', 'ASSISTANTE'];
const READ_ROLES = [...WRITE_ROLES, 'ENSEIGNANT', 'MAITRESSE'];

// Envoi de messages
router.post('/send',    checkPermission(WRITE_ROLES), CommunicationController.send);
router.post('/preview', checkPermission(WRITE_ROLES), CommunicationController.preview);

// Historique
router.get('/',        checkPermission(READ_ROLES), CommunicationController.list);
router.get('/:id',    checkPermission(READ_ROLES), CommunicationController.getById);

// Templates
router.get('/templates',       checkPermission(READ_ROLES),  CommunicationController.listTemplates);
router.post('/templates',      checkPermission(WRITE_ROLES), CommunicationController.upsertTemplate);
router.delete('/templates/:id', checkPermission(WRITE_ROLES), CommunicationController.deleteTemplate);

export default router;
