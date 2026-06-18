
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { checkRole } from '../middlewares/rbac.js';
import { concurrentLimiter, deduplicateRequests, loginSlowDown, registerSlowDown } from '../middlewares/floodProtection.js';

const router = Router();

// ── Rate limiters anti-brute-force ────────────────────────────────────────────

// Login : max 5 tentatives par IP toutes les 15 minutes
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Trop de tentatives de connexion. Veuillez patienter 15 minutes avant de réessayer." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login : max 3 tentatives par email toutes les 15 minutes (protection même si l'IP change)
const loginEmailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `email:${(req.body?.email || '').trim().toLowerCase()}`,
  skip: (req) => !(req.body?.email || '').trim(),
  message: { error: "Trop de tentatives pour cet identifiant. Veuillez patienter 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register : max 3 inscriptions par IP par heure
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Trop de tentatives d'inscription depuis cette adresse. Veuillez patienter 1 heure." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register : max 2 inscriptions par email par 24h (évite les doublons et abus)
const registerEmailRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  keyGenerator: (req) => {
    const email = req.body?.admin?.email || req.body?.email || '';
    return `reg_email:${email.trim().toLowerCase()}`;
  },
  skip: (req) => !((req.body?.admin?.email || req.body?.email || '').trim()),
  message: { error: "Une inscription a déjà été tentée avec cet email. Veuillez patienter 24 heures." },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- ROUTES PUBLIQUES ---
router.post('/login',
  concurrentLimiter(3),
  loginSlowDown,
  loginRateLimit,
  loginEmailRateLimit,
  deduplicateRequests(5_000, ['email']),
  AuthController.login
);

router.post('/register',
  concurrentLimiter(2),
  registerSlowDown,
  registerRateLimit,
  registerEmailRateLimit,
  deduplicateRequests(10_000, ['companyName']),
  AuthController.register
);

router.post('/register-stripe-init', AuthController.registerStripeInit);
router.get('/register-check/:sessionId', AuthController.registerCheck);

router.post('/superadmin/login',
  concurrentLimiter(1),
  loginSlowDown,
  loginRateLimit,
  AuthController.superAdminLogin
);

router.post('/mfa/verify',
  concurrentLimiter(3),
  loginSlowDown,
  AuthController.verifyMFA
);

// --- ROUTES PROTÉGÉES (IAM) ---
router.use(authenticateJWT);

router.get('/me', async (req, res) => {
  try {
    const user = req.user; // Données du JWT

    // Récupérer en base le tenant et l'abonnement pour avoir des données fraîches (pas celles du JWT)
    let tenantData = null;
    let subscriptionData = null;
    try {
      const { Tenant, Subscription } = await import('../models/index.js');
      const tenant = await Tenant.findByPk(user.tenantId, {
        attributes: ['id', 'isActive', 'paymentStatus', 'plan', 'primaryColor', 'buttonColor', 'fontFamily', 'baseFontSize', 'theme', 'isSuspended', 'suspendedAt', 'suspensionReason', 'pendingDeletion', 'deletionScheduledFor']
      });
      if (tenant) {
        tenantData = {
          isActive: tenant.isActive,
          paymentStatus: tenant.paymentStatus,
          plan: tenant.plan,
          primaryColor: tenant.primaryColor,
          buttonColor: tenant.buttonColor,
          fontFamily: tenant.fontFamily,
          baseFontSize: tenant.baseFontSize,
          theme: tenant.theme,
          isSuspended: !!tenant.isSuspended,
          suspendedAt: tenant.suspendedAt || null,
          suspensionReason: tenant.suspensionReason || null,
          pendingDeletion: !!tenant.pendingDeletion,
          deletionScheduledFor: tenant.deletionScheduledFor || null
        };
      }
      const sub = await Subscription.findOne({ where: { tenantId: user.tenantId } });
      if (sub) {
        subscriptionData = {
          planId: sub.planId,
          status: sub.status,
          nextBillingDate: sub.nextBillingDate
        };
      }
    } catch (dbErr) {
      console.warn('[/auth/me] Could not fetch tenant/subscription:', dbErr && dbErr.message);
    }

    // Si l'utilisateur a un employeeId, récupérer ses données Employee
    if (user.employeeId) {
      const { Employee } = await import('../models/index.js');
      const employee = await Employee.findOne({
        where: {
          id: user.employeeId,
          tenantId: user.tenantId
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId', 'status']
      });

      if (employee) {
        return res.json({
          ...user,
          tenant: tenantData,
          subscription: subscriptionData,
          email: employee.email,
          employee: employee.toJSON()
        });
      }
    }

    // Sinon, vérifier si c'est un employé par rôle et chercher Employee par email/nom
    const roles = Array.isArray(user.roles) ? user.roles : [user.role];
    const isEmployeeRole = roles.some(role =>
      ['EMPLOYEE', 'STOCK_MANAGER', 'SALES', 'ACCOUNTANT'].includes(role)
    );

    if (isEmployeeRole) {
      const { Employee, User } = await import('../models/index.js');

      const fullUser = await User.findByPk(user.id, {
        attributes: ['id', 'email', 'name', 'employeeId']
      });

      if (fullUser && fullUser.email) {
        const employee = await Employee.findOne({
          where: {
            email: fullUser.email,
            tenantId: user.tenantId
          },
          attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId', 'status']
        });

        if (employee) {
          if (!fullUser.employeeId) {
            await fullUser.update({ employeeId: employee.id });
            console.log(`✅ Auto-linked user ${fullUser.id} to employee ${employee.id}`);
          }

          return res.json({
            ...user,
            tenant: tenantData,
            subscription: subscriptionData,
            email: fullUser.email,
            employeeId: employee.id,
            employee: employee.toJSON()
          });
        }
      }
    }

    // Par défaut, retourner user enrichi avec tenant + subscription frais
    res.json({ ...user, tenant: tenantData, subscription: subscriptionData });
  } catch (error) {
    console.error('Error in /auth/me:', error);
    res.json(req.user); // Fallback
  }
});

// Gestion utilisateurs
router.get('/users', checkRole(['ADMIN']), AuthController.listUsers);
router.get('/available-employees', checkRole(['ADMIN']), AuthController.getAvailableEmployees);
router.post('/users', checkRole(['ADMIN']), AuthController.createUser);
router.put('/users/:id', checkRole(['ADMIN']), AuthController.updateUser);
router.delete('/users/:id', checkRole(['ADMIN']), AuthController.deleteUser);

// Nouvelles actions de sécurité
router.post('/users/:id/reset-password', checkRole(['ADMIN']), AuthController.resetUserPassword);
router.post('/users/:id/toggle-mfa', checkRole(['ADMIN']), AuthController.toggleMFA);

// Changement de mot de passe (auto)
router.post('/change-password', AuthController.changeOwnPassword);

// Désactivation / réactivation / suppression du compte par l'administrateur
router.post('/deactivate-account', AuthController.deactivateOwnAccount);
router.post('/reactivate-account', AuthController.reactivateOwnAccount);
router.delete('/delete-account', AuthController.deleteOwnAccount);

// --- ROUTES DE GESTION DE SESSION ---
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAll);
router.get('/sessions', AuthController.getActiveSessions);
router.post('/validate-session', AuthController.validateSession);

export default router;
