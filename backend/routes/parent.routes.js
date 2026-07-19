import { Router } from 'express';
import multer from 'multer';
import { ParentController } from '../controllers/ParentController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { checkPermission } from '../middlewares/rbac.js';
import { tenantIsolation } from '../middlewares/tenant.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PARENT_ROLES = ['PARENT', 'TUTEUR'];

// Middleware commun à toutes les routes parent
router.use(authenticateJWT);
router.use(checkPermission(PARENT_ROLES));
router.use(tenantIsolation);

router.get('/me',                    ParentController.getMonProfil);
router.get('/mes-admissions',        ParentController.getMesAdmissions);
router.get('/ecole',                 ParentController.getEcoleInfo);
router.get('/enfants',               ParentController.getMesEnfants);
router.get('/enfants/:id',           ParentController.getMesEnfantById);
router.get('/echeances',             ParentController.getMesEcheances);
router.get('/factures',              ParentController.getMesFactures);
router.get('/bulletins',             ParentController.getMesBulletins);
router.get('/planning',              ParentController.getMonPlanning);
router.get('/actualites',            ParentController.getActualites);
router.get('/dossiers',              ParentController.getMesDossiers);
router.post('/dossiers/upload',      upload.single('file'), ParentController.uploadDocument);
router.post('/paiement/demander',    ParentController.demanderPaiement);
router.post('/admission',            ParentController.soumettreAdmission);
router.put('/admission/:id',         ParentController.resoumettreAdmission);

// Signature digitale
router.get('/signature',             ParentController.getSignature);
router.post('/signature',            ParentController.enregistrerSignature);
router.get('/documents-a-signer',    ParentController.getDocumentsASigner);
router.post('/signer-document',      ParentController.signerDocument);

export default router;
