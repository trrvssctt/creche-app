import { Router } from 'express';
import { FinanceV2Controller as C } from '../controllers/FinanceV2Controller.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

const read = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ACCOUNTANT'];
const write = ['ADMIN', 'DIRECTEUR', 'COMPTABLE'];

// Années scolaires
router.get('/academic-years',           checkPermission(read), C.listAcademicYears);
router.post('/academic-years',          checkPermission(write), C.createAcademicYear);
router.put('/academic-years/:id',       checkPermission(write), C.updateAcademicYear);

// Snapshots tarifaires
router.post('/tariff-snapshots',        checkPermission(write), C.snapshotTariffs);

// Sessions de caisse
router.get('/cash-sessions',            checkPermission(read), C.listCashSessions);
router.post('/cash-sessions',           checkPermission(write), C.openCashSession);
router.put('/cash-sessions/:id/close',  checkPermission(write), C.closeCashSession);

// Avoirs
router.get('/credit-notes',             checkPermission(read), C.listCreditNotes);
router.post('/credit-notes',            checkPermission(write), C.createCreditNote);

// Recettes diverses
router.get('/other-revenues',           checkPermission(read), C.listOtherRevenues);
router.post('/other-revenues',          checkPermission(write), C.createOtherRevenue);

// Recouvrement
router.get('/collection/cases',         checkPermission(read), C.listCollectionCases);
router.get('/collection/cases/:id',     checkPermission(read), C.getCollectionCase);
router.post('/collection/cases/:id/actions', checkPermission(write), C.addCollectionAction);

// Dashboard et reporting
router.get('/dashboard',                checkPermission(read), C.getDashboard);
router.get('/ca-engagement',            checkPermission(read), C.getCAEngagement);
router.get('/ca-comptable',             checkPermission(read), C.getCAComptable);
router.get('/balance-agee',             checkPermission(read), C.getBalanceAgee);
router.get('/creances-a-echoir',        checkPermission(read), C.getCreancesAEchoir);
router.get('/encaissements',            checkPermission(read), C.getEncaissements);

export default router;
