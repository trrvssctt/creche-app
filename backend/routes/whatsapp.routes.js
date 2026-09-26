import { Router } from 'express';
import { WhatsAppController } from '../controllers/WhatsAppController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const ADMIN_ROLES = ['ADMIN', 'DIRECTEUR'];
const SEND_ROLES = ['ADMIN', 'DIRECTEUR', 'ASSISTANTE', 'COMPTABLE', 'ACCOUNTANT', 'ENSEIGNANT', 'MAITRESSE'];

// Liaison du compte WhatsApp de l'établissement
router.get('/status',        checkPermission(SEND_ROLES),  WhatsAppController.status);
router.post('/connect',      checkPermission(ADMIN_ROLES), WhatsAppController.connect);
router.post('/pairing-code', checkPermission(ADMIN_ROLES), WhatsAppController.pairingCode);
router.post('/disconnect',   checkPermission(ADMIN_ROLES), WhatsAppController.disconnect);
router.post('/logout',       checkPermission(ADMIN_ROLES), WhatsAppController.logout);

// Envoi en arrière-plan + suivi
router.post('/send',      checkPermission(SEND_ROLES), WhatsAppController.send);
router.post('/send-bulk', checkPermission(SEND_ROLES), WhatsAppController.sendBulk);
router.get('/messages',   checkPermission(SEND_ROLES), WhatsAppController.messages);
router.get('/groups',     checkPermission(SEND_ROLES), WhatsAppController.groups);

export default router;
