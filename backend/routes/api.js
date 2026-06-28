
import express, { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { tenantIsolation } from '../middlewares/tenant.js';
import { checkPermission } from '../middlewares/rbac.js';

import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import stockRoutes from './stock.routes.js';
import salesRoutes from './sales.routes.js';
import customerRoutes from './customers.routes.js';
import billingRoutes from './billing.routes.js';
import aiRoutes from './ai.routes.js';
import { AIController } from '../controllers/AIController.js';
import financeRoutes from './finance.routes.js';
import documentRoutes from './document.routes.js';
import resilienceRoutes from './resilience.routes.js';
import categoriesRoutes from './categories.routes.js';
import subcategoriesRoutes from './subcategories.routes.js';
import recoveryRoutes from './recovery.routes.js';
import servicesRoutes from './services.routes.js';
import { TenantController } from '../controllers/TenantController.js';
import { SubscriptionController } from '../controllers/SubscriptionController.js';
import { PaymentController } from '../controllers/PaymentController.js';
import { AnnouncementController } from '../controllers/AnnouncementController.js';
import hrRoutes from './hr.routes.js';
import uploadRoutes from './upload.routes.js';
import { UploadController } from '../controllers/UploadController.js';
import contactRoutes, { adminRouter as contactAdminRoutes } from './contact.routes.js';
import supportRoutes from './support.routes.js';
import supplierRoutes from './suppliers.routes.js';
import deliveryRoutes from './deliveries.routes.js';
import elevesRoutes from './eleves.routes.js';
import eleveDossierRoutes from './eleve-dossier.routes.js';
import bulletinsRoutes from './bulletins.routes.js';
import classesRoutes from './classes.routes.js';
import abonnementsRoutes from './abonnements.routes.js';
import teacherRoutes from './teacher.routes.js';
import scheduleRoutes from './schedule.routes.js';
import planningRoutes from './planning.routes.js';
import parentRoutes from './parent.routes.js';
import { AuthController } from '../controllers/AuthController.js';
import { SchoolEventController } from '../controllers/SchoolEventController.js';

const router = Router();

// --- ROUTES PUBLIQUES ---
router.post('/payments/callback', PaymentController.handleWebhook); // Route callback globale

// Webhook Stripe — doit être PUBLIC (pas de JWT) et recevoir le body brut
router.post(
  '/billing/stripe/webhook',
  express.raw({ type: 'application/json' }),
  SubscriptionController.stripeWebhook
);

router.use('/auth', authRoutes);
router.get('/plans', SubscriptionController.listPlans); 
// Expose bridge as public to allow server-side forwarding from clients without requiring JWT
router.post('/ai/bridge', AIController.bridgeWebhook);
// Route publique pour l'envoi de messages de contact depuis la landing page
router.use('/contact', contactRoutes);

// Route publique pour servir les fichiers S3 (génère une URL signée + redirige)
// DOIT être avant authenticateJWT pour que les <img src="/api/files?key=..."> fonctionnent
router.get('/files', UploadController.serveFile);

// --- PROTECTION JWT ---
router.use(authenticateJWT);

// Annonces/Notifications (visibles par tous les utilisateurs connectés)
router.get('/announcements', AnnouncementController.list);

router.use('/admin', adminRoutes);
router.use('/stock', tenantIsolation, stockRoutes);
router.use('/categories', tenantIsolation, categoriesRoutes);
router.use('/subcategories', tenantIsolation, subcategoriesRoutes);
router.use('/sales', tenantIsolation, salesRoutes);
router.use('/customers', tenantIsolation, customerRoutes);
router.use('/billing', tenantIsolation, billingRoutes);
router.use('/ai', tenantIsolation, aiRoutes);
router.use('/finance', tenantIsolation, financeRoutes);
router.use('/documents', tenantIsolation, documentRoutes);
router.use('/resilience', tenantIsolation, resilienceRoutes);
router.use('/recovery', tenantIsolation, recoveryRoutes);
router.use('/services', tenantIsolation, servicesRoutes);
router.use('/hr', tenantIsolation, hrRoutes);
router.use('/upload', tenantIsolation, uploadRoutes);

// Support tickets (tenant-scoped)
router.use('/support', tenantIsolation, supportRoutes);
router.use('/suppliers', tenantIsolation, supplierRoutes);
router.use('/deliveries', tenantIsolation, deliveryRoutes);
router.use('/eleves',    tenantIsolation, elevesRoutes);
router.use('/eleves/:eleveId/dossier', tenantIsolation, eleveDossierRoutes);
router.use('/bulletins', tenantIsolation, bulletinsRoutes);
router.use('/classes',      tenantIsolation, classesRoutes);
router.use('/abonnements',  tenantIsolation, abonnementsRoutes);
router.use('/teacher',      tenantIsolation, teacherRoutes);
router.use('/schedule',     tenantIsolation, scheduleRoutes);
router.use('/planning',    tenantIsolation, planningRoutes);

// ── Portail Parents / Tuteurs ─────────────────────────────────────────────────
// Les routes parent gèrent elles-mêmes authenticateJWT + checkPermission + tenantIsolation
router.use('/parent', parentRoutes);
// Création de compte parent par l'admin
router.get('/admin/parent-accounts',
  authenticateJWT, checkPermission(['ADMIN', 'DIRECTEUR']), tenantIsolation,
  AuthController.listParentAccounts
);
router.post('/admin/parent-accounts',
  authenticateJWT, checkPermission(['ADMIN', 'DIRECTEUR']), tenantIsolation,
  AuthController.createParentAccount
);

// ── Événements scolaires (agenda admin → visible parents) ─────────────────────
const SCHOOL_ROLES = ['ADMIN', 'DIRECTEUR', 'ASSISTANTE'];
router.get('/admin/school-events',        authenticateJWT, checkPermission(SCHOOL_ROLES), tenantIsolation, SchoolEventController.list);
router.post('/admin/school-events',       authenticateJWT, checkPermission(SCHOOL_ROLES), tenantIsolation, SchoolEventController.upsert);
router.put('/admin/school-events/:id',    authenticateJWT, checkPermission(SCHOOL_ROLES), tenantIsolation, SchoolEventController.upsert);
router.delete('/admin/school-events/:id', authenticateJWT, checkPermission(SCHOOL_ROLES), tenantIsolation, SchoolEventController.remove);

// Subscription upgrade (tenant ADMIN → PENDING, validated by SuperAdmin)
router.post('/subscription/upgrade', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.upgradePlan);
router.get('/subscription', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.getMySubscription);
router.post('/subscription/payment', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.recordPayment);

// Routes admin pour la gestion des messages de contact (après JWT)
router.use('/admin/contact', contactAdminRoutes);

// Lecture des paramètres tenant : tous les membres de l'établissement (branding, config année, etc.)
const ALL_TENANT_ROLES = ['ADMIN', 'SALES', 'STOCK_MANAGER', 'ACCOUNTANT', 'EMPLOYEE', 'HR_MANAGER', 'ENSEIGNANT', 'MAITRESSE', 'DIRECTEUR', 'ASSISTANTE'];
router.get('/settings', tenantIsolation, checkPermission(ALL_TENANT_ROLES), TenantController.getSettings);
router.put('/settings', tenantIsolation, checkPermission(['ADMIN']), TenantController.updateSettings);
// Anciennes routes (conservées pour compatibilité avec le frontend existant)
router.post('/settings/annee/cloturer', tenantIsolation, checkPermission(['ADMIN']), TenantController.cloturerAnnee);
router.post('/settings/annee/nouvelle', tenantIsolation, checkPermission(['ADMIN']), TenantController.demarrerNouvelleAnnee);
// Nouvelles routes — cycle de vie complet des années scolaires
router.post('/settings/annees',                                    tenantIsolation, checkPermission(['ADMIN']), TenantController.creerAnnee);
router.put( '/settings/annees/:annee/ouvrir-inscriptions',         tenantIsolation, checkPermission(['ADMIN']), TenantController.ouvrirInscriptions);
router.put( '/settings/annees/:annee/demarrer',                    tenantIsolation, checkPermission(['ADMIN']), TenantController.demarrerAnnee);
router.put( '/settings/annees/:annee/cloturer',                    tenantIsolation, checkPermission(['ADMIN']), TenantController.cloturerAnnee);
router.put( '/settings/annees/:annee/reactiver',                   tenantIsolation, checkPermission(['ADMIN']), TenantController.reactiverAnnee);

// Route pour récupérer les informations du tenant (alias de /settings en lecture)
router.get('/tenant/info', tenantIsolation, checkPermission(ALL_TENANT_ROLES), TenantController.getSettings);

// Suspension / Réactivation du compte par le tenant lui-même (ADMIN uniquement)
// Note : ces routes n'utilisent PAS tenantIsolation pour que la réactivation soit possible même compte suspendu
router.post('/tenant/suspend',    checkPermission(['ADMIN']), TenantController.suspendAccount);
router.post('/tenant/reactivate', checkPermission(['ADMIN']), TenantController.reactivateAccount);

// Suppression du compte (ADMIN uniquement)
// - POST /tenant/delete-request  → demande de suppression (30j de délai)
// - DELETE /tenant/delete-request → annulation de la demande pendant les 30j
// Ces routes n'utilisent PAS tenantIsolation (le compte est déjà suspendu au moment de la demande)
router.post(  '/tenant/delete-request', checkPermission(['ADMIN']), TenantController.requestDeletion);
router.delete('/tenant/delete-request', checkPermission(['ADMIN']), TenantController.cancelDeletion);

export default router;
