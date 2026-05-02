
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

// Subscription upgrade (tenant ADMIN → PENDING, validated by SuperAdmin)
router.post('/subscription/upgrade', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.upgradePlan);
router.get('/subscription', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.getMySubscription);
router.post('/subscription/payment', tenantIsolation, checkPermission(['ADMIN']), SubscriptionController.recordPayment);

// Routes admin pour la gestion des messages de contact (après JWT)
router.use('/admin/contact', contactAdminRoutes);

router.get('/settings', tenantIsolation, checkPermission(['ADMIN', 'SALES', 'STOCK_MANAGER', 'ACCOUNTANT']), TenantController.getSettings);
router.put('/settings', tenantIsolation, checkPermission(['ADMIN']), TenantController.updateSettings);

// Route pour récupérer les informations du tenant
router.get('/tenant/info', tenantIsolation, checkPermission(['ADMIN', 'SALES', 'STOCK_MANAGER', 'ACCOUNTANT', 'EMPLOYEE']), TenantController.getSettings);

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
