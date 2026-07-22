import { Router } from 'express';
import { AbonnementController } from '../controllers/AbonnementController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();
const READ  = ['ADMIN', 'MAITRESSE', 'COMPTABLE', 'ASSISTANTE', 'ACCOUNTANT'];
const WRITE = ['ADMIN', 'COMPTABLE', 'ACCOUNTANT'];

// Synchronisation mensuelle (génère abonnements + échéances pour tous les élèves actifs)
router.post('/sync-mensuel',    checkPermission(WRITE), AbonnementController.syncMensuel);

// Abonnements
router.post('/',                checkPermission(WRITE), AbonnementController.create);
router.post('/batch',           checkPermission(WRITE), AbonnementController.createBatch);
router.get('/eleve/:eleveId',   checkPermission(READ),  AbonnementController.listByEleve);
router.put('/:id/desactiver',   checkPermission(WRITE), AbonnementController.deactivate);

// Échéances
router.get('/echeances',                          checkPermission(READ),  AbonnementController.listEcheances);
router.put('/echeances/:id/payer',                checkPermission(WRITE), AbonnementController.payEcheance);
router.post('/echeances/payer-tout/:eleveId',     checkPermission(WRITE), AbonnementController.payAllEleve);
router.post('/echeances/payer-selection',         checkPermission(WRITE), AbonnementController.paySelection);
router.post('/echeances/relancer',                checkPermission(WRITE), AbonnementController.sendReminder);
router.get('/echeances/facture/:eleveId',         checkPermission(READ),  AbonnementController.factureEleve);
router.post('/echeances/envoyer-facture-email',  checkPermission(WRITE), AbonnementController.sendFactureEmail);

export default router;
