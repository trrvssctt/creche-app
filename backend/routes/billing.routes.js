
import { Router } from 'express';
import { SubscriptionController } from '../controllers/SubscriptionController.js';
import { checkRole } from '../middlewares/rbac.js';
import { tenantIsolation } from '../middlewares/tenant.js';

const router = Router();

// Route publique pour l'inscription (choix initial)
router.get('/plans', SubscriptionController.listPlans);

// Routes sécurisées par Tenant
router.use(tenantIsolation);

/**
 * @route GET /api/billing/my-subscription
 * @desc  Récupère les détails de l'abonnement actuel et l'historique des paiements
 */
router.get('/my-subscription', checkRole(['ADMIN']), SubscriptionController.getMySubscription);

/**
 * @route POST /api/billing/upgrade
 * @desc  Upgrade le plan de l'instance
 */
router.post('/upgrade', checkRole(['ADMIN']), SubscriptionController.upgradePlan);

/**
 * @route POST /api/billing/pay
 * @desc  Enregistre un paiement d'abonnement (pending) pour validation admin
 */
router.post('/pay', checkRole(['ADMIN']), SubscriptionController.recordPayment);

/**
 * @route POST /api/billing/stripe/checkout
 * @desc  Crée une Stripe Checkout Session et retourne l'URL de redirection
 */
router.post('/stripe/checkout', checkRole(['ADMIN']), SubscriptionController.stripeCheckout);

/**
 * @route GET /api/billing/stripe/session/:sessionId
 * @desc  Vérifie le statut d'une session Stripe Checkout (page de succès)
 */
router.get('/stripe/session/:sessionId', checkRole(['ADMIN']), SubscriptionController.getStripeSession);

/**
 * @route GET /api/billing/invoice/:paymentId
 * @desc  Génère/Télécharge la facture d'un paiement d'abonnement
 */
router.get('/invoice/:paymentId', checkRole(['ADMIN']), SubscriptionController.downloadSubscriptionInvoice);

export default router;
