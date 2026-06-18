import { Router } from 'express';
import { AbonnementController } from '../controllers/AbonnementController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();
const READ  = ['ADMIN', 'MAITRESSE', 'COMPTABLE', 'ASSISTANTE', 'ACCOUNTANT'];
const WRITE = ['ADMIN', 'COMPTABLE', 'ACCOUNTANT'];

// Abonnements
router.post('/',                checkPermission(WRITE), AbonnementController.create);
router.get('/eleve/:eleveId',   checkPermission(READ),  AbonnementController.listByEleve);
router.put('/:id/desactiver',   checkPermission(WRITE), AbonnementController.deactivate);

// Échéances
router.get('/echeances',                    checkPermission(READ),  AbonnementController.listEcheances);
router.put('/echeances/:id/payer',          checkPermission(WRITE), AbonnementController.payEcheance);
router.post('/echeances/relancer',          checkPermission(WRITE), AbonnementController.sendReminder);
router.get('/echeances/facture/:eleveId',   checkPermission(READ),  AbonnementController.factureEleve);

export default router;
