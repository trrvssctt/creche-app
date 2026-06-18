

import { AuthService } from '../services/AuthService.js';
import { User, Tenant, Subscription, Administrator, AuditLog, Payment, RegistrationIntent } from '../models/index.js';
import { Plan } from '../models/Plan.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { StripeService } from '../services/StripeService.js';

// ── Emails et domaines bloqués (spam / abus avérés) ──────────────────────────
const BLOCKED_EMAILS = new Set([
  'jm.koffi@agrobusiness.ci',
  'moussa.diop@example.com',
  'awa.ndiaye@fashion.sn',
]);

const BLOCKED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net',
  'test.com', 'test.org', 'test.net',
  'localhost.com',
  'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'trashmail.com',
  'maildrop.cc', 'discard.email', 'sharklasers.com',
  'spam4.me', 'fakeinbox.com', 'mailnull.com',
  'getairmail.com', 'dispostable.com', 'nospammail.net',
]);

/**
 * Retourne true si l'email est banni ou utilise un domaine suspect.
 */
function isBlockedEmail(email) {
  const normalized = email.toLowerCase().trim();
  if (BLOCKED_EMAILS.has(normalized)) return true;
  const domain = normalized.split('@')[1];
  return domain ? BLOCKED_DOMAINS.has(domain) : false;
}



export class AuthController {
  // Helper to send sanitized error responses (avoid exposing raw error payloads to clients)
  static sendSafeError(res, status, error, code = 'InternalServerError') {
    // Log detailed error server-side for diagnostics
    // eslint-disable-next-line no-console
    console.error('[AUTH ERROR]:', error);
    return res.status(status).json({ error: code, message: 'Une erreur est survenue. Veuillez réessayer plus tard.' });
  }
  /**
   * Connexion spécifique pour le Maître du Kernel (SuperAdmin)
   */


  static async verifyMFA(req, res) {
    try {
      const { userId, code } = req.body;
      const user = await User.findByPk(userId);
      
      if (!user) return res.status(404).json({ error: 'UserNotFound' });

      if (!code || code.length !== 6) {
        return res.status(401).json({ error: 'InvalidCode', message: 'Code de sécurité incorrect.' });
      }

      const token = AuthService.generateToken(user);
      return res.status(200).json({ token, user });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Réinitialisation de mot de passe (ADMIN ONLY)
   */
  static async resetUserPassword(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 12) {
         await transaction.rollback();
         return res.status(400).json({ error: 'SecurityError', message: 'La nouvelle clé doit contenir au moins 12 caractères.' });
      }

      const where = { id };
      if (req.user.role !== 'SUPER_ADMIN') {
        where.tenantId = req.user.tenantId;
      }
      
      const user = await User.findOne({ where, transaction });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({ error: 'UserNotFound', message: 'Utilisateur cible introuvable.' });
      }

      // Mise à jour cryptographique du hash avec un sel renforcé (cost: 12)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      await user.update({ password: hashedPassword }, { transaction });

      // Audit de l'action critique scellé par signature SHA-256
      const auditPayload = {
        timestamp: Date.now(),
        targetId: user.id,
        operatorId: req.user.id,
        action: 'RESET_PASSWORD'
      };

      const signature = crypto.createHash('sha256')
        .update(JSON.stringify(auditPayload) + (process.env.AUDIT_SECRET || 'GSP_SECRET'))
        .digest('hex');

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'USER_PASSWORD_RESET',
        resource: `User: ${user.email}`,
        severity: 'HIGH',
        status: 'SUCCESS',
        sha256Signature: signature
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Identifiants scellés avec succès.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return AuthController.sendSafeError(res, 500, error, 'KernelPanic');
    }
  }

  /**
   * Activation/Désactivation MFA
   */
  static async toggleMFA(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!user) return res.status(404).json({ error: 'UserNotFound' });

      user.mfaEnabled = !user.mfaEnabled;
      await user.save();

      return res.status(200).json({ mfaEnabled: user.mfaEnabled });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error, 'AuthError');
    }
  }
  static async superAdminLogin(req, res) {
    try {
      const emailInput = (req.body.email || '').toLowerCase().trim();
      const passwordInput = (req.body.password || '').trim();

      const admin = await Administrator.findOne({ 
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('email')),
          '=',
          emailInput
        )
      });

      if (!admin) {
        return res.status(401).json({ error: 'Accès refusé', message: 'Identifiants Maîtres invalides.' });
      }

      // Comparaison rigoureuse
      // Support legacy stored bcrypt hashes that may miss the algorithm prefix
      let storedHash = admin.password || '';
      if (!storedHash.startsWith('$2') && /\d+\$/.test(storedHash)) {
        storedHash = `$2b$${storedHash}`;
      }
      const isValid = await bcrypt.compare(passwordInput, storedHash);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Accès refusé', message: 'Identifiants Maîtres invalides.' });
      }

      const token = AuthService.generateToken({
        id: admin.id,
        name: admin.name,
        tenantId: 'SYSTEM',
        roles: ['SUPER_ADMIN']
      });

      await admin.update({ lastLogin: new Date() });

      return res.status(200).json({
        token,
        user: {
          id: admin.id,
          name: admin.name,
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN'],
          tenantId: 'SYSTEM'
        }
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error, 'AuthError');
    }
  }

static async login(req, res) {
    try {
      const email = (req.body.email || '').toLowerCase().trim();
      const password = (req.body.password || '').trim();

      // Vérification email banni / domaine suspect avant toute requête DB
      if (!email || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ error: 'InvalidEmail', message: 'Adresse email invalide.' });
      }
      if (isBlockedEmail(email)) {
        console.warn(`[AUTH] Tentative de connexion bloquée: ${email}`);
        return res.status(403).json({ error: 'BlockedEmail', message: 'Accès refusé. Cette adresse email n\'est pas autorisée.' });
      }

      const user = await AuthService.validateCredentials(email, password);

      if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });
      // Bloquer les utilisateurs désactivés
      if (user.isActive === false || (user.dataValues && user.dataValues.is_active === false)) {
        return res.status(403).json({ error: 'AccountDisabled', message: 'Compte désactivé. Contactez un administrateur.' });
      }
      
      // 1. Récupération de l'état de l'instance (Tenant) et du Plan
      const tenant = await Tenant.findByPk(user.tenantId);
      if (!tenant) return res.status(404).json({ error: 'Instance introuvable.' });

      // 2a. Blocage total si suppression en attente — personne ne peut se connecter
      if (tenant.pendingDeletion) {
        const scheduled = tenant.deletionScheduledFor
          ? new Date(tenant.deletionScheduledFor).toLocaleDateString('fr-FR')
          : null;
        return res.status(410).json({
          error:   'AccountPendingDeletion',
          message: `Ce compte est en attente de suppression${scheduled ? ` (prévue le ${scheduled})` : ''}. Contactez le support pour annuler.`,
          deletionScheduledFor: tenant.deletionScheduledFor
        });
      }

      // 2b. Blocage si compte suspendu par le tenant lui-même
      if (tenant.isSuspended) {
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'EMPLOYEE'];
        const isAdminOrSuperAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
        if (!isAdminOrSuperAdmin) {
          return res.status(403).json({
            error: 'AccountSuspended',
            message: 'L\'accès à cette instance est temporairement suspendu. Contactez votre administrateur.',
            suspendedAt: tenant.suspendedAt,
            suspensionReason: tenant.suspensionReason
          });
        }
        // L'ADMIN peut se connecter mais sera notifié de la suspension
      }

      // 3. Blocage Flux-Paiement : Vérification si le compte est actif et à jour
      const isTrial = tenant.paymentStatus === 'TRIAL';
      const isUpToDate = tenant.paymentStatus === 'UP_TO_DATE' || isTrial;

      // If the tenant has been administratively deactivated, block access for everyone
      if (!tenant.isActive) {
        if (tenant.paymentStatus === 'PENDING') {
          // Paiement Wave soumis, en attente de validation SuperAdmin
          return res.status(403).json({
            error: 'WaveValidationPending',
            message: 'Votre compte est en cours de validation. Notre équipe vérifie votre paiement Wave et activera votre espace sous 24h. Vous recevrez une confirmation.'
          });
        }
        return res.status(403).json({ error: 'AccessBlocked', message: 'Instance désactivée. Contactez le support.' });
      }

      // If payments are not up-to-date, allow ADMIN or SUPER_ADMIN to login (for remediation), block others
      if (!isUpToDate) {
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'EMPLOYEE'];
        if (!(userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN'))) {
          return res.status(403).json({ 
            error: 'AccessBlocked', 
            message: 'Accès suspendu : Votre abonnement n’est pas à jour ou l’instance a été verrouillée. Veuillez régulariser votre situation dans l’onglet Paiement.' 
          });
        }
        // Admins are allowed to proceed
      }

      // 3. Récupération du Plan / Subscription depuis la table Subscription
      const sub = await Subscription.findOne({ where: { tenantId: user.tenantId } });
      const planId = sub ? sub.planId : 'FREE_TRIAL';
      // Récupérer les détails du plan pour exposer les modules/permissions
      let planDetails = null;
      if (sub && sub.planId) {
        const planRecord = await Plan.findByPk(sub.planId);
        if (planRecord) {
          planDetails = {
            id: planRecord.id,
            name: planRecord.name,
            priceMonthly: planRecord.priceMonthly,
            maxUsers: planRecord.maxUsers,
            hasAiChatbot: !!planRecord.hasAiChatbot,
            hasStockForecast: !!planRecord.hasStockForecast
          };
        }
      }

      // Update last login timestamp for the user and generate the token including planId
      try {
        await user.update({ lastLogin: new Date() });
      } catch (uErr) {
        // non-blocking: log but continue
      }

      // 4. Création de la session avec informations de connexion
      const sessionData = await AuthService.createSession(
        { ...user.toJSON(), planId: planId },
        req.ip || req.connection?.remoteAddress || null,
        req.get('User-Agent') || null,
        req.body.deviceInfo || null
      );

      const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'EMPLOYEE'];

      // 5. Construire une réponse enrichie contenant l'état du tenant, de l'abonnement et les modules du plan
      const responseUser = {
        id: user.id,
        name: user.name,
        role: userRoles[0],
        roles: userRoles,
        tenantId: user.tenantId,
        isActive: user.isActive === undefined ? true : user.isActive,
        planId: planDetails?.id || (sub ? sub.planId : planId),
        subscription: sub ? { planId: sub.planId, status: sub.status, nextBillingDate: sub.nextBillingDate } : null,
        plan: planDetails,
        tenant: {
          isActive: tenant.isActive,
          paymentStatus: tenant.paymentStatus,
          isSuspended: !!tenant.isSuspended,
          suspendedAt: tenant.suspendedAt || null,
          suspensionReason: tenant.suspensionReason || null
        }
      };

      // Include lastLogin timestamp in response (snake_case compatibility)
      responseUser.lastLogin = user.lastLogin || user.last_login || null;
      responseUser.last_login = responseUser.lastLogin;
      

      return res.status(200).json({ 
        token: sessionData.token, 
        sessionToken: sessionData.sessionToken,
        user: responseUser 
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  static async register(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const {
        companyName,
        company_name,
        siret,
        admin,
        planId,
        phone,
        address,
        primaryColor,
        primary_color,
        buttonColor,
        button_color,
        fontFamily,
        font_family,
        baseFontSize,
        base_font_size,
        theme
      } = req.body;

      const name = companyName || company_name || (admin && admin.companyName) || 'Nouvelle Entreprise';

      // ── Validation des champs obligatoires ──────────────────────────
      if (!admin?.email || !admin?.password || !admin?.name) {
        await transaction.rollback();
        return res.status(400).json({ error: 'MissingFields', message: 'Nom, email et mot de passe de l\'administrateur sont obligatoires.' });
      }

      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
      if (!EMAIL_REGEX.test(admin.email)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'InvalidEmail', message: 'Format d\'adresse email invalide.' });
      }

      // Vérification email banni / domaine suspect
      if (isBlockedEmail(admin.email)) {
        console.warn(`[AUTH] Tentative d'inscription bloquée: ${admin.email}`);
        await transaction.rollback();
        return res.status(403).json({ error: 'BlockedEmail', message: 'Cette adresse email n\'est pas autorisée. Veuillez utiliser une adresse professionnelle valide.' });
      }

      if (admin.password.length < 8) {
        await transaction.rollback();
        return res.status(400).json({ error: 'WeakPassword', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }

      // ── Vérification des doublons ────────────────────────────────────
      const normalizedEmail = admin.email.toLowerCase().trim();

      const existingUser = await User.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizedEmail) });
      if (existingUser) {
        await transaction.rollback();
        return res.status(409).json({ error: 'EmailAlreadyExists', message: 'Un compte existe déjà avec cette adresse email. Connectez-vous ou utilisez une autre adresse.' });
      }

      if (siret && siret.trim()) {
        const siretClean = siret.trim();
        const existingTenantBySiret = await Tenant.findOne({ where: { siret: siretClean } });
        if (existingTenantBySiret) {
          await transaction.rollback();
          return res.status(409).json({ error: 'SiretAlreadyExists', message: 'Une entreprise avec ce numéro SIRET est déjà enregistrée.' });
        }
      }

      if (phone && phone.trim()) {
        const phoneClean = phone.trim().replace(/\s+/g, '');
        const existingTenantByPhone = await Tenant.findOne({ where: sequelize.where(sequelize.fn('replace', sequelize.fn('replace', sequelize.col('phone'), ' ', ''), '-', ''), phoneClean.replace(/-/g, '')) });
        if (existingTenantByPhone) {
          await transaction.rollback();
          return res.status(409).json({ error: 'PhoneAlreadyExists', message: 'Ce numéro de téléphone est déjà utilisé par une autre entreprise.' });
        }
      }

      if (admin.email && admin.email.trim()) {
        const existingTenantByEmail = await Tenant.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizedEmail) });
        if (existingTenantByEmail) {
          await transaction.rollback();
          return res.status(409).json({ error: 'CompanyEmailAlreadyExists', message: 'Une entreprise est déjà enregistrée avec cette adresse email.' });
        }
      }

      const tenant = await Tenant.create({
        name,
        siret,
        phone: phone ?? null,
        address: address ?? null,
        email: (admin && admin.email) || null,
        domain: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}.gestock.pro`,
        paymentStatus: planId === 'FREE_TRIAL' ? 'TRIAL' : 'PENDING',
        // Les plans payants Wave démarrent inactifs — activation par le SuperAdmin après vérification du paiement
        isActive: planId === 'FREE_TRIAL' ? true : false,
        currency: 'F CFA',
        primaryColor: primaryColor || primary_color || undefined,
        buttonColor: buttonColor || button_color || undefined,
        fontFamily: fontFamily || font_family || undefined,
        baseFontSize: baseFontSize || base_font_size || undefined,
        theme: theme || undefined
      }, { transaction });

      const user = await User.create({
        email: admin.email,
        password: admin.password,
        name: admin.name || 'Propriétaire',
        role: 'ADMIN',
        roles: ['ADMIN'], 
        tenantId: tenant.id
      }, { transaction });

      await Subscription.create({
        tenantId: tenant.id,
        planId: planId || 'FREE_TRIAL',
        status: planId === 'FREE_TRIAL' ? 'TRIAL' : 'PENDING',
        nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }, { transaction });

      // Si un paiement mobile money est fourni, l'enregistrer en PENDING
      const { paymentInfo } = req.body;
      if (paymentInfo && planId !== 'FREE_TRIAL') {
        await Payment.create({
          tenantId: tenant.id,
          saleId: null,
          amount: Number(paymentInfo.amount) || 0,
          method: paymentInfo.method || 'WAVE',
          reference: paymentInfo.reference || `REG-${Date.now()}`,
          transactionId: paymentInfo.reference || null,
          status: 'PENDING',
          paymentDate: new Date(),
        }, { transaction });
      }

      await transaction.commit();
      const token = AuthService.generateToken(user);

      return res.status(201).json({ 
        token,
        user: { 
          id: user.id, 
          name: user.name, 
          role: 'ADMIN', 
          roles: ['ADMIN'], 
          tenantId: tenant.id,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            primaryColor: tenant.primaryColor,
            buttonColor: tenant.buttonColor,
            theme: tenant.theme,
            fontFamily: tenant.fontFamily,
            baseFontSize: tenant.baseFontSize,
            isActive: tenant.isActive,
            paymentStatus: tenant.paymentStatus
          }
        },
        subscription: {
          planId: planId || 'FREE_TRIAL',
          status: planId === 'FREE_TRIAL' ? 'TRIAL' : 'PENDING'
        }
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      // Doublon détecté par la contrainte unique DB (race condition)
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.fields ? Object.keys(error.fields)[0] : '';
        if (field.includes('email')) {
          return res.status(409).json({ error: 'EmailAlreadyExists', message: 'Un compte existe déjà avec cette adresse email.' });
        }
        if (field.includes('siret')) {
          return res.status(409).json({ error: 'SiretAlreadyExists', message: 'Une entreprise avec ce numéro SIRET est déjà enregistrée.' });
        }
        if (field.includes('phone')) {
          return res.status(409).json({ error: 'PhoneAlreadyExists', message: 'Ce numéro de téléphone est déjà utilisé par une autre entreprise.' });
        }
        return res.status(409).json({ error: 'DuplicateEntry', message: 'Ces informations sont déjà utilisées par un compte existant.' });
      }
      return AuthController.sendSafeError(res, 500, error, 'RegisterError');
    }
  }

  /**
   * Vérifie si un paiement Stripe d'inscription est complété et retourne un token si oui.
   * Utilisé par le frontend pour auto-connecter l'utilisateur après redirection Stripe.
   * GET /auth/register-check/:sessionId (public)
   */
  static async registerCheck(req, res) {
    try {
      const { sessionId } = req.params;
      const intent = await RegistrationIntent.findOne({ where: { stripeSessionId: sessionId } });

      if (!intent) return res.status(200).json({ status: 'not_found' });
      if (intent.status === 'FAILED') return res.status(200).json({ status: 'failed' });
      if (intent.status === 'EXPIRED' || intent.expiresAt < new Date()) return res.status(200).json({ status: 'expired' });
      if (intent.status === 'PENDING') {
        // Fallback local dev: webhook inaccessible → vérifier Stripe directement
        if (StripeService.isAvailable()) {
          try {
            const session = await StripeService.retrieveSession(sessionId);
            if (session.payment_status === 'paid') {
              let regData;
              try { regData = JSON.parse(intent.registrationData); } catch { return res.status(200).json({ status: 'failed' }); }

              const { companyName, siret, phone, address, planId: rPlanId, period: rPeriod, admin, primaryColor, buttonColor } = regData;

              const t = await sequelize.transaction();
              try {
                const tenant = await Tenant.create({
                  name: companyName,
                  siret,
                  phone: phone ?? null,
                  address: address ?? null,
                  email: admin.email,
                  domain: `${companyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}.gestock.pro`,
                  planId: rPlanId,
                  paymentStatus: 'UP_TO_DATE',
                  isActive: true,
                  currency: 'F CFA',
                  primaryColor: primaryColor || undefined,
                  buttonColor: buttonColor || undefined,
                }, { transaction: t });

                const user = await User.create({
                  email: admin.email,
                  password: admin.password,
                  name: admin.name || 'Propriétaire',
                  role: 'ADMIN',
                  roles: ['ADMIN'],
                  tenantId: tenant.id,
                }, { transaction: t });

                const PERIOD_MONTHS = { '1M': 1, '3M': 3, '1Y': 12 };
                const months = PERIOD_MONTHS[rPeriod] || 1;
                const nextBilling = new Date();
                nextBilling.setMonth(nextBilling.getMonth() + months);

                const subscription = await Subscription.create({
                  tenantId: tenant.id,
                  planId: rPlanId,
                  status: 'ACTIVE',
                  nextBillingDate: nextBilling,
                  autoRenew: true,
                }, { transaction: t });

                await Payment.create({
                  tenantId: tenant.id,
                  saleId: null,
                  amount: session.amount_total || 0,
                  method: 'STRIPE',
                  reference: session.id,
                  transactionId: session.payment_intent || session.id,
                  status: 'COMPLETED',
                  paymentDate: new Date(),
                }, { transaction: t });

                await intent.update({ status: 'COMPLETED' }, { transaction: t });

                await AuditLog.create({
                  tenantId: tenant.id,
                  userId: user.id,
                  userName: user.name,
                  action: 'TENANT_REGISTERED_VIA_STRIPE_FALLBACK',
                  resource: `plan:${rPlanId} period:${rPeriod}`,
                  severity: 'HIGH',
                  sha256Signature: crypto.createHash('sha256').update(`${tenant.id}:${session.id}:${Date.now()}`).digest('hex'),
                }, { transaction: t });

                await t.commit();

                const token = AuthService.generateToken(user);
                return res.status(200).json({
                  status: 'completed',
                  token,
                  user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    roles: user.roles || [user.role],
                    tenantId: tenant.id,
                    tenant: {
                      id: tenant.id, name: tenant.name, domain: tenant.domain,
                      primaryColor: tenant.primaryColor, buttonColor: tenant.buttonColor,
                      isActive: tenant.isActive, paymentStatus: tenant.paymentStatus
                    },
                    subscription: {
                      planId: subscription.planId, status: subscription.status, nextBillingDate: subscription.nextBillingDate
                    }
                  }
                });
              } catch (dbErr) {
                await t.rollback();
                console.error('[registerCheck/fallback] DB error:', dbErr.message);
                // Si l'utilisateur existe déjà (race condition webhook + fallback), tomber dans le chemin COMPLETED
                if (dbErr.name === 'SequelizeUniqueConstraintError') {
                  await intent.update({ status: 'COMPLETED' }).catch(() => {});
                  // laisser le code COMPLETED ci-dessous retrouver le user
                } else {
                  return res.status(200).json({ status: 'pending' });
                }
              }
            }
          } catch (stripeErr) {
            console.warn('[registerCheck] Stripe API error:', stripeErr.message);
          }
        }
        return res.status(200).json({ status: 'pending' });
      }

      // COMPLETED — trouver le user créé par le webhook
      let regData;
      try { regData = JSON.parse(intent.registrationData); } catch { return res.status(200).json({ status: 'failed' }); }

      const user = await User.findOne({ where: { email: regData.admin.email } }).catch(() => null);

      if (!user) return res.status(200).json({ status: 'pending' }); // webhook encore en cours

      const [tenant, subscription] = await Promise.all([
        Tenant.findByPk(user.tenantId, {
          attributes: ['id', 'name', 'domain', 'primaryColor', 'buttonColor', 'theme', 'fontFamily', 'baseFontSize', 'isActive', 'paymentStatus']
        }).catch(() => null),
        Subscription.findOne({ where: { tenantId: user.tenantId } }).catch(() => null)
      ]);

      const token = AuthService.generateToken(user);

      return res.status(200).json({
        status: 'completed',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roles: user.roles || [user.role],
          tenantId: user.tenantId,
          tenant: tenant ? {
            id: tenant.id, name: tenant.name, domain: tenant.domain,
            primaryColor: tenant.primaryColor, buttonColor: tenant.buttonColor,
            theme: tenant.theme, fontFamily: tenant.fontFamily, baseFontSize: tenant.baseFontSize,
            isActive: tenant.isActive, paymentStatus: tenant.paymentStatus
          } : null,
          subscription: subscription ? {
            planId: subscription.planId, status: subscription.status, nextBillingDate: subscription.nextBillingDate
          } : null
        }
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error, 'RegisterCheckError');
    }
  }

  /**
   * Initialise une session Stripe Checkout pour une nouvelle inscription.
   * Le compte n'est PAS créé ici — il le sera dans le webhook Stripe après paiement confirmé.
   * POST /auth/register-stripe-init (public)
   */
  static async registerStripeInit(req, res) {
    try {
      if (!StripeService.isAvailable()) {
        return res.status(503).json({ error: 'StripeUnavailable', message: 'Stripe n\'est pas configuré sur ce serveur.' });
      }

      const { companyName, siret, phone, address, planId, period, amount, admin, primaryColor, buttonColor } = req.body;

      if (!companyName || !admin?.email || !admin?.password || !admin?.name || !planId || !amount) {
        return res.status(400).json({ error: 'MissingParams', message: 'Champs requis manquants (companyName, admin, planId, amount).' });
      }

      const EMAIL_REGEX_STRIPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!EMAIL_REGEX_STRIPE.test(admin.email)) {
        return res.status(400).json({ error: 'InvalidEmail', message: 'Format d\'adresse email invalide.' });
      }
      if (admin.password.length < 8) {
        return res.status(400).json({ error: 'WeakPassword', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }

      // ── Vérification doublons avant de créer l'intent Stripe ─────────
      const normalizedEmailS = admin.email.toLowerCase().trim();

      const existingUserS = await User.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizedEmailS) });
      if (existingUserS) {
        return res.status(409).json({ error: 'EmailAlreadyExists', message: 'Un compte existe déjà avec cette adresse email. Connectez-vous ou utilisez une autre adresse.' });
      }

      if (siret && siret.trim()) {
        const existingBySiret = await Tenant.findOne({ where: { siret: siret.trim() } });
        if (existingBySiret) {
          return res.status(409).json({ error: 'SiretAlreadyExists', message: 'Une entreprise avec ce numéro SIRET est déjà enregistrée.' });
        }
      }

      if (phone && phone.trim()) {
        const phoneCleanS = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
        const existingByPhone = await Tenant.findOne({ where: sequelize.where(sequelize.fn('replace', sequelize.fn('replace', sequelize.col('phone'), ' ', ''), '-', ''), phoneCleanS) });
        if (existingByPhone) {
          return res.status(409).json({ error: 'PhoneAlreadyExists', message: 'Ce numéro de téléphone est déjà utilisé par une autre entreprise.' });
        }
      }

      const existingTenantEmailS = await Tenant.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizedEmailS) });
      if (existingTenantEmailS) {
        return res.status(409).json({ error: 'CompanyEmailAlreadyExists', message: 'Une entreprise est déjà enregistrée avec cette adresse email.' });
      }

      // Vérifier aussi dans les intents PENDING non expirés (éviter la double soumission Stripe)
      const pendingIntent = await RegistrationIntent.findOne({
        where: sequelize.where(
          sequelize.fn('lower', sequelize.cast(sequelize.fn('jsonb_extract_path_text', sequelize.cast(sequelize.col('registration_data'), 'jsonb'), 'admin', 'email'), 'text')),
          normalizedEmailS
        )
      }).catch(() => null);
      if (pendingIntent && pendingIntent.status === 'PENDING' && pendingIntent.expiresAt > new Date()) {
        return res.status(409).json({ error: 'RegistrationInProgress', message: 'Une inscription est déjà en cours avec cet email. Vérifiez votre email ou attendez l\'expiration (2h).' });
      }

      const plan = await Plan.findByPk(planId);
      if (!plan) return res.status(400).json({ error: 'InvalidPlan', message: 'Plan introuvable.' });

      // Stocker les données en base pour le webhook
      const intent = await RegistrationIntent.create({
        registrationData: JSON.stringify({ companyName, siret, phone, address, planId, period: period || '1M', admin, primaryColor, buttonColor }),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
      });

      const { url, sessionId } = await StripeService.createRegistrationCheckoutSession({
        planId,
        planName: plan.name,
        period: period || '1M',
        amount: Number(amount),
        intentId: intent.id,
      });

      await intent.update({ stripeSessionId: sessionId });

      return res.status(200).json({ url, sessionId });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error, 'RegisterStripeInitError');
    }
  }

  static async listUsers(req, res) {
    try {
      // Import Employee dynamiquement pour éviter les imports circulaires
      const { Employee } = await import('../models/Employee.js');
      
      const users = await User.findAll({ 
        where: { tenantId: req.user.tenantId },
        include: [
          {
            model: Employee,
            as: 'employeeProfile',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'departmentId', 'position'],
            required: false
          }
        ],
        order: [['name', 'ASC']]
      });
      return res.status(200).json(users);
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  static async getUser(req, res) {
    try {
      const user = await User.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(user);
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Récupérer les employés sans compte utilisateur associé (ENTERPRISE uniquement)
   */
  static async getAvailableEmployees(req, res) {
    try {
      // Import Employee dynamiquement pour éviter les imports circulaires
      const { Employee } = await import('../models/Employee.js');
      
      // Récupérer les employés qui n'ont pas de compte utilisateur associé
      const availableEmployees = await Employee.findAll({
        where: {
          tenantId: req.user.tenantId,
          id: {
            [Op.notIn]: sequelize.literal(`(
              SELECT employee_id 
              FROM users 
              WHERE employee_id IS NOT NULL 
              AND tenant_id = '${req.user.tenantId}'
            )`)
          }
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'departmentId', 'position'],
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

      return res.status(200).json(availableEmployees);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[AUTH GET AVAILABLE EMPLOYEES ERROR]:', error);
      return res.status(500).json({ error: 'InternalServerError', message: 'Une erreur est survenue.' });
    }
  }

  static async createUser(req, res) {
    try {
      const userData = { 
        ...req.body, 
        tenantId: req.user.tenantId 
      };

      // S'assurer que employeeId est null si non fourni ou vide 
      if (!req.body.employeeId || req.body.employeeId.trim() === '') {
        userData.employeeId = null;
      } else {
        // Pour les plans ENTERPRISE, permettre l'association avec un employé existant
        // Import Employee dynamiquement pour éviter les imports circulaires
        const { Employee } = await import('../models/Employee.js');
        
        // Vérifier que l'employé existe et appartient au bon tenant
        const employee = await Employee.findOne({
          where: {
            id: req.body.employeeId,
            tenantId: req.user.tenantId
          }
        });
        
        if (!employee) {
          return res.status(404).json({ 
            error: 'EmployeeNotFound', 
            message: 'Employé introuvable.' 
          });
        }

        // Vérifier qu'aucun utilisateur n'est déjà associé à cet employé
        const existingUser = await User.findOne({
          where: {
            employeeId: req.body.employeeId,
            tenantId: req.user.tenantId
          }
        });
        
        if (existingUser) {
          return res.status(409).json({
            error: 'UserAlreadyExists',
            message: 'Un utilisateur existe déjà pour cet employé.'
          });
        }

        userData.employeeId = req.body.employeeId;
      }

      const user = await User.create(userData);
      return res.status(201).json(user);
    } catch (error) {
      // Validation/client errors can still return the message, but avoid object dumps
      // eslint-disable-next-line no-console
      console.error('[AUTH CREATE USER ERROR]:', error);
      return res.status(400).json({ error: 'BadRequest', message: 'Requête invalide.' });
    }
  }

  static async updateUser(req, res) {
    try {
      const user = await User.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      // Empêcher la désactivation d'un ADMIN via l'API
      if ((req.body.hasOwnProperty('is_active') || req.body.hasOwnProperty('isActive')) && (req.body.is_active === false || req.body.isActive === false)) {
        const roles = Array.isArray(user.roles) ? user.roles : [user.role];
        if (roles.includes('ADMIN')) {
          return res.status(403).json({ error: 'Forbidden', message: 'Impossible de désactiver un administrateur.' });
        }
      }
      await user.update(req.body);
      return res.status(200).json(user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[AUTH UPDATE USER ERROR]:', error);
      return res.status(400).json({ error: 'BadRequest', message: 'Requête invalide.' });
    }
  }

  static async deleteUser(req, res) {
    try {
      const user = await User.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.destroy();
      return res.status(204).send();
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Déconnexion avec terminaison de session
   */
  static async logout(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
      
      if (!sessionToken) {
        return res.status(400).json({ 
          error: 'BadRequest', 
          message: 'Token de session manquant.' 
        });
      }

      const success = await AuthService.terminateSession(sessionToken);
      
      if (!success) {
        return res.status(404).json({ 
          error: 'SessionNotFound', 
          message: 'Session introuvable ou déjà terminée.' 
        });
      }

      return res.status(200).json({ 
        message: 'Déconnexion réussie.',
        success: true 
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Déconnexion de toutes les sessions d'un utilisateur
   */
  static async logoutAll(req, res) {
    try {
      const userId = req.user.id;
      const terminatedCount = await AuthService.terminateAllUserSessions(userId);

      return res.status(200).json({ 
        message: `${terminatedCount} session(s) terminée(s).`,
        terminatedSessions: terminatedCount 
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Récupérer les sessions actives de l'utilisateur connecté
   */
  static async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;
      const sessions = await AuthService.getUserActiveSessions(userId);

      const sessionsData = sessions.map(session => ({
        id: session.id,
        sessionToken: session.sessionToken,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        loginAt: session.loginAt,
        lastActivity: session.lastActivity,
        isActive: session.isActive
      }));

      return res.status(200).json({ sessions: sessionsData });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Vérifier si une session est toujours valide
   */
  static async validateSession(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
      
      if (!sessionToken) {
        return res.status(400).json({ 
          error: 'BadRequest', 
          message: 'Token de session manquant.' 
        });
      }

      const sessionData = await AuthService.validateSession(sessionToken);
      
      if (!sessionData) {
        return res.status(401).json({ 
          error: 'InvalidSession', 
          message: 'Session invalide ou expirée.' 
        });
      }

      return res.status(200).json({ 
        valid: true,
        user: {
          id: sessionData.user.id,
          name: sessionData.user.name,
          email: sessionData.user.email,
          roles: sessionData.user.roles
        },
        session: {
          lastActivity: sessionData.session.lastActivity,
          expiresAt: sessionData.session.expiresAt
        }
      });
    } catch (error) {
      return AuthController.sendSafeError(res, 500, error);
    }
  }

  /**
   * Désactivation du compte par l'administrateur lui-même (suspension du tenant)
   * POST /auth/deactivate-account
   */
  static async deactivateOwnAccount(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Forbidden', message: 'Seul un administrateur peut désactiver le compte.' });
      }

      const tenant = await Tenant.findByPk(req.user.tenantId, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      await tenant.update({
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: 'Désactivation volontaire par l\'administrateur.'
      }, { transaction });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'TENANT_SELF_DEACTIVATED',
        resource: `Tenant: ${tenant.name}`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${req.user.id}:self-deactivate:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Compte désactivé avec succès.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return AuthController.sendSafeError(res, 500, error, 'DeactivateAccountError');
    }
  }

  /**
   * Réactivation du compte suspendu par l'administrateur lui-même
   * POST /auth/reactivate-account
   */
  static async reactivateOwnAccount(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Forbidden', message: 'Seul un administrateur peut réactiver le compte.' });
      }

      const tenant = await Tenant.findByPk(req.user.tenantId, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      await tenant.update({
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null,
        pendingDeletion: false,
        deletionScheduledFor: null
      }, { transaction });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'TENANT_SELF_REACTIVATED',
        resource: `Tenant: ${tenant.name}`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${req.user.id}:self-reactivate:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Compte réactivé avec succès.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return AuthController.sendSafeError(res, 500, error, 'ReactivateAccountError');
    }
  }

  /**
   * Suppression définitive du compte (planification à 30 jours)
   * DELETE /auth/delete-account
   */
  static async deleteOwnAccount(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Forbidden', message: 'Seul un administrateur peut supprimer le compte.' });
      }

      const tenant = await Tenant.findByPk(req.user.tenantId, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

      await tenant.update({
        pendingDeletion: true,
        deletionScheduledFor: deletionDate,
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: 'Suppression définitive programmée par l\'administrateur.'
      }, { transaction });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'TENANT_DELETION_SCHEDULED',
        resource: `Tenant: ${tenant.name} — suppression prévue le ${deletionDate.toLocaleDateString('fr-FR')}`,
        severity: 'CRITICAL',
        sha256Signature: crypto.createHash('sha256').update(`${req.user.id}:schedule-deletion:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({
        message: 'Suppression planifiée avec succès.',
        deletionScheduledFor: deletionDate
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return AuthController.sendSafeError(res, 500, error, 'DeleteAccountError');
    }
  }

  /**
   * Changement de mot de passe par l'utilisateur lui-même
   */
  static async changeOwnPassword(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        await transaction.rollback();
        return res.status(400).json({ error: 'MissingFields', message: 'Mot de passe actuel et nouveau requis.' });
      }

      if (newPassword.length < 8) {
        await transaction.rollback();
        return res.status(400).json({ error: 'WeakPassword', message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      }

      const user = await User.findByPk(req.user.id, { transaction });
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({ error: 'UserNotFound' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        await transaction.rollback();
        return res.status(401).json({ error: 'InvalidPassword', message: 'Mot de passe actuel incorrect.' });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await user.update({ password: hashedPassword }, { transaction });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'USER_CHANGED_OWN_PASSWORD',
        resource: `User: ${user.email}`,
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`${req.user.id}:change-own-password:${Date.now()}`).digest('hex')
      }, { transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Mot de passe mis à jour avec succès.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return AuthController.sendSafeError(res, 500, error, 'PasswordChangeError');
    }
  }
}
