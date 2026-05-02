import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkPermission } from '../middlewares/rbac.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { Op } from 'sequelize';
import { concurrentLimiter, deduplicateRequests, contactSlowDown } from '../middlewares/floodProtection.js';

// Router principal pour les routes contact
const router = express.Router();

// Router pour les routes publiques (sans authentification)
const publicRouter = express.Router();

// Router pour les routes admin (avec authentification)
const adminRouter = express.Router();

// ── Emails et domaines bloqués ───────────────────────────────────────────────

// Emails explicitement bannis (spam avéré)
const BLOCKED_EMAILS = new Set([
  'jm.koffi@agrobusiness.ci',
  'moussa.diop@example.com',
  'awa.ndiaye@fashion.sn',
]);

// Domaines de test / jetables / faux connus
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

// ── Rate limiting anti-spam — 2 couches ──────────────────────────────────────

// Couche 1 : par IP — max 1 message par heure (réduit de 2 → 1)
const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 1,
  message: {
    error: "Trop de messages envoyés depuis votre adresse. Veuillez patienter 1 heure avant de réessayer.",
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Couche 2 : par email — max 1 message par email par 2 heures
// Empêche le spam même si l'attaquant change d'IP.
const contactEmailRateLimit = rateLimit({
  windowMs: 2 * 60 * 60 * 1000, // 2 heures
  max: 1,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    return `email:${email}`;
  },
  skip: (req) => {
    // Pas d'email dans le body = pas de clé valide → on laisse passer (sera rejeté par validateContactMessage)
    return !(req.body?.email || '').trim();
  },
  message: {
    error: "Un message a déjà été envoyé depuis cette adresse email. Veuillez patienter 2 heures.",
    retryAfter: 2 * 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Supprime les balises HTML et les caractères de contrôle dangereux.
 * Protège contre le XSS stocké sans dépendance externe.
 */
const stripHtml = (str) =>
  str.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

// Middleware de validation pour les messages de contact
const validateContactMessage = (req, res, next) => {
  const { fullName, email, message, phone, website } = req.body;

  // Honeypot : champ caché rempli = bot
  if (website && website.trim() !== '') {
    // Répondre 200 pour ne pas alerter le bot
    return res.status(200).json({ success: true, message: 'Message reçu.' });
  }

  if (!fullName || fullName.trim().length < 2) {
    return res.status(400).json({
      error: 'Le nom complet est requis et doit contenir au moins 2 caractères.'
    });
  }
  if (fullName.trim().length > 100) {
    return res.status(400).json({ error: 'Le nom complet ne peut pas dépasser 100 caractères.' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({
      error: 'Une adresse email valide est requise.'
    });
  }
  if (email.trim().length > 254) {
    return res.status(400).json({ error: 'L\'adresse email ne peut pas dépasser 254 caractères.' });
  }

  // Vérification email explicitement banni
  const normalizedEmail = email.trim().toLowerCase();
  if (BLOCKED_EMAILS.has(normalizedEmail)) {
    console.warn(`[CONTACT] Email banni bloqué: ${normalizedEmail}`);
    return res.status(403).json({
      error: 'Cette adresse email n\'est pas autorisée à envoyer des messages.'
    });
  }

  // Vérification domaine jetable / de test
  const emailDomain = normalizedEmail.split('@')[1];
  if (BLOCKED_DOMAINS.has(emailDomain)) {
    console.warn(`[CONTACT] Domaine suspect bloqué: ${emailDomain} (${normalizedEmail})`);
    return res.status(400).json({
      error: 'Veuillez utiliser une adresse email professionnelle valide. Les adresses temporaires ou de test ne sont pas acceptées.'
    });
  }

  if (!message || message.trim().length < 10) {
    return res.status(400).json({
      error: 'Le message doit contenir au moins 10 caractères.'
    });
  }
  if (message.trim().length > 5000) {
    return res.status(400).json({ error: 'Le message ne peut pas dépasser 5000 caractères.' });
  }

  if (phone && phone.trim().length > 0) {
    if (phone.trim().length > 20) {
      return res.status(400).json({ error: 'Le numéro de téléphone ne peut pas dépasser 20 caractères.' });
    }
    if (!/^[+\d\s\-().]{5,20}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Le numéro de téléphone contient des caractères invalides.' });
    }
  }

  // Sanitiser les données (suppression des balises HTML)
  req.body.fullName = stripHtml(fullName.trim());
  req.body.email = email.trim().toLowerCase();
  req.body.message = stripHtml(message.trim());
  if (req.body.phone) {
    req.body.phone = stripHtml(req.body.phone.trim());
  }

  next();
};

/**
 * @route POST /api/contact
 * @desc Envoie un nouveau message de contact depuis la landing page
 * @access Public
 */
publicRouter.post('/',
  concurrentLimiter(2),
  contactSlowDown,
  contactRateLimit,
  contactEmailRateLimit,
  deduplicateRequests(15_000, ['email', 'message']),
  validateContactMessage,
  async (req, res) => {
  try {
    const { fullName, email, phone, message } = req.body;
    
    // Récupération des métadonnées de la requête
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || '';
    
    // Création du message avec Sequelize
    const newMessage = await ContactMessage.create({
      fullName,
      email,
      phone: phone || null,
      message,
      ipAddress,
      userAgent,
      status: 'non_lus',
      source: 'landing_page'
    });
    
    // Log de l'action pour audit
    console.log(`[CONTACT] Nouveau message reçu de ${email} (IP: ${ipAddress})`);
    
    res.status(201).json({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
      messageId: newMessage.id
    });
    
  } catch (error) {
    console.error('[CONTACT ERROR]', error);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi du message. Veuillez réessayer.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/admin/contact/messages
 * @desc Récupère tous les messages de contact (admin seulement)
 * @access Admin
 */
adminRouter.get('/messages', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construction des filtres Sequelize
    const whereClause = {};
    
    if (status && ['non_lus', 'lus'].includes(status)) {
      whereClause.status = status;
    }
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: searchTerm } },
        { email: { [Op.iLike]: searchTerm } },
        { message: { [Op.iLike]: searchTerm } }
      ];
    }
    
    // Requête principale avec pagination
    const { rows: messages, count: total } = await ContactMessage.findAndCountAll({
      where: whereClause,
      order: [
        ['status', 'ASC'], // non_lus en premier
        ['createdAt', 'DESC'] // Utiliser le nom d'attribut Sequelize
      ],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id', 'fullName', 'email', 'phone', 'message', 'status',
        'ipAddress', 'userAgent', 'adminNotes', 'repliedAt', 'repliedBy',
        'createdAt', 'updatedAt'
      ]
    });
    
    const totalPages = Math.ceil(total / parseInt(limit));
    
    // Statistiques rapides
    const stats = await ContactMessage.findAll({
      attributes: [
        [ContactMessage.sequelize.fn('COUNT', '*'), 'total_messages'],
        [ContactMessage.sequelize.fn('COUNT', ContactMessage.sequelize.literal("CASE WHEN status = 'non_lus' THEN 1 END")), 'non_lus'],
        [ContactMessage.sequelize.fn('COUNT', ContactMessage.sequelize.literal("CASE WHEN status = 'lus' THEN 1 END")), 'lus'],
        [ContactMessage.sequelize.fn('COUNT', ContactMessage.sequelize.literal('DISTINCT email')), 'unique_contacts']
      ],
      raw: true
    });
    
    res.json({
      success: true,
      data: {
        messages: messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        stats: stats[0] || {
          total_messages: 0,
          non_lus: 0,
          lus: 0,
          unique_contacts: 0
        }
      }
    });
    
  } catch (error) {
    console.error('[CONTACT MESSAGES ERROR]', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des messages.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PUT /api/admin/contact/messages/:id/status
 * @desc Met à jour le statut d'un message (marquer comme lu/non lu)
 * @access Admin
 */
adminRouter.put('/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    if (!['non_lus', 'lus'].includes(status)) {
      return res.status(400).json({
        error: 'Statut invalide. Utilisez "non_lus" ou "lus".'
      });
    }
    
    // Mise à jour du message
    const [updatedRowsCount] = await ContactMessage.update(
      { 
        status, 
        adminNotes: adminNotes || undefined
      },
      { 
        where: { id },
        returning: true // Pour PostgreSQL
      }
    );
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({
        error: 'Message non trouvé.'
      });
    }
    
    // Récupération du message mis à jour
    const updatedMessage = await ContactMessage.findByPk(id);
    
    res.json({
      success: true,
      message: `Message marqué comme ${status === 'lus' ? 'lu' : 'non lu'}.`,
      data: updatedMessage
    });
    
  } catch (error) {
    console.error('[UPDATE MESSAGE STATUS ERROR]', error);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour du statut.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route DELETE /api/admin/contact/messages/:id
 * @desc Supprime un message de contact
 * @access Admin
 */
adminRouter.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupération du message avant suppression
    const existingMessage = await ContactMessage.findByPk(id, {
      attributes: ['id', 'fullName', 'email']
    });
    
    if (!existingMessage) {
      return res.status(404).json({
        error: 'Message non trouvé.'
      });
    }
    
    // Suppression du message
    await ContactMessage.destroy({
      where: { id }
    });
    
    console.log(`[CONTACT] Message supprimé: ${existingMessage.email} (ID: ${id})`);
    
    res.json({
      success: true,
      message: 'Message supprimé avec succès.'
    });
    
  } catch (error) {
    console.error('[DELETE MESSAGE ERROR]', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression du message.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/admin/contact/messages/:id/reply
 * @desc Marque un message comme ayant une réponse
 * @access Admin
 */
adminRouter.post('/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { repliedBy, notes } = req.body;
    
    const [updatedRowsCount] = await ContactMessage.update(
      { 
        status: 'lus',
        repliedAt: new Date(),
        repliedBy: repliedBy || 'Admin',
        adminNotes: notes || undefined
      },
      { 
        where: { id }
      }
    );
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({
        error: 'Message non trouvé.'
      });
    }
    
    res.json({
      success: true,
      message: 'Message marqué comme répondu.'
    });
    
  } catch (error) {
    console.error('[REPLY MESSAGE ERROR]', error);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Toutes les routes admin nécessitent le rôle ADMIN ou SUPER_ADMIN
adminRouter.use(checkPermission(['ADMIN', 'SUPER_ADMIN']));

// Configure the main router
router.use('/', publicRouter);

// Export both public and admin routers
export default router;
export { adminRouter };