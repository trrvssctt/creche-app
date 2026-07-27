import { CommunicationLog, CommunicationTemplate, Eleve, Classe } from '../models/index.js';
import { BotpressService } from '../services/BotpressService.js';
import { Op } from 'sequelize';

// Catégories de messages qui nécessitent un élève actif
const CATEGORIES_FINANCIERES = ['FINANCIER', 'PEDAGOGIQUE'];
const TYPES_FINANCIERS = ['FACTURE', 'RECU', 'RELANCE', 'BULLETIN'];

export class CommunicationController {

  // ── Envoi d'un message ────────────────────────────────────────────────────

  static async send(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const senderId = req.user.id;
      const {
        type = 'LIBRE',
        category = 'GENERAL',
        templateId,
        subject,
        body,
        targetType,     // ALL | NIVEAU | CLASSE | INDIVIDUEL
        targetNiveau,
        targetClasseId,
        targetEleveId,
        variables = {},
      } = req.body;

      if (!body || !targetType) {
        return res.status(400).json({ error: 'BadRequest', message: 'body et targetType sont obligatoires.' });
      }

      // ── Résolution des destinataires ─────────────────────────────────────
      const eleveWhere = { tenantId };
      const isFinancier = CATEGORIES_FINANCIERES.includes(category) || TYPES_FINANCIERS.includes(type);

      // Pour les messages financiers/pédagogiques : élèves actifs ou inscrits (INSCRIT = actif dans l'école)
      if (isFinancier) {
        eleveWhere.statut = { [Op.in]: ['ACTIF', 'INSCRIT'] };
      } else {
        // Pour les annonces/événements : tous les élèves inscrits ou actifs
        eleveWhere.statut = { [Op.in]: ['ACTIF', 'INSCRIT'] };
      }

      switch (targetType) {
        case 'INDIVIDUEL':
          if (!targetEleveId) {
            return res.status(400).json({ error: 'BadRequest', message: 'targetEleveId requis pour un envoi individuel.' });
          }
          eleveWhere.id = targetEleveId;
          break;
        case 'CLASSE':
          if (!targetClasseId) {
            return res.status(400).json({ error: 'BadRequest', message: 'targetClasseId requis pour un envoi par classe.' });
          }
          eleveWhere.classeId = targetClasseId;
          break;
        case 'NIVEAU':
          if (!targetNiveau) {
            return res.status(400).json({ error: 'BadRequest', message: 'targetNiveau requis pour un envoi par niveau.' });
          }
          eleveWhere.niveau = targetNiveau;
          break;
        case 'ALL':
          break;
        default:
          return res.status(400).json({ error: 'BadRequest', message: `targetType invalide: ${targetType}` });
      }

      const eleves = await Eleve.findAll({
        where: eleveWhere,
        include: [{ model: Classe, as: 'classe', attributes: ['id', 'nom'] }],
        attributes: ['id', 'nom', 'prenom', 'niveau', 'parent1', 'parent2', 'whatsappPrincipal', 'statut'],
      });

      if (eleves.length === 0) {
        return res.status(422).json({ error: 'NoRecipients', message: 'Aucun destinataire trouvé avec ces critères.' });
      }

      // ── Construction des messages personnalisés ───────────────────────────
      const recipients = [];
      const skipped = [];

      for (const eleve of eleves) {
        const phone = eleve.whatsappPrincipal
          || eleve.parent1?.whatsapp
          || eleve.parent1?.tel
          || eleve.parent1?.telephone
          || null;

        if (!phone) {
          skipped.push({ eleveId: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, reason: 'Pas de numéro WhatsApp' });
          continue;
        }

        // Vérification renforcée pour les messages financiers
        if (isFinancier && !['ACTIF', 'INSCRIT'].includes(eleve.statut)) {
          skipped.push({ eleveId: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, reason: 'Élève non actif — message financier refusé' });
          continue;
        }

        const parentPrenom = eleve.parent1?.prenom || '';
        const parentNom = eleve.parent1?.nom || '';
        const personalizedBody = renderMessage(body, {
          ...variables,
          prenom_enfant: eleve.prenom,
          nom_enfant: eleve.nom,
          niveau: eleve.niveau,
          classe: eleve.classe?.nom || eleve.niveau,
          prenom_parent: parentPrenom ? `${parentPrenom} ${parentNom}`.trim() : 'Parent',
        });

        recipients.push({ phone, message: personalizedBody, eleveId: eleve.id });
      }

      if (recipients.length === 0) {
        return res.status(422).json({
          error: 'NoValidRecipients',
          message: 'Aucun destinataire valide (pas de numéro WhatsApp ou élève non actif).',
          skipped,
        });
      }

      // ── Création du log ───────────────────────────────────────────────────
      const log = await CommunicationLog.create({
        tenantId,
        senderId,
        type,
        category,
        templateId,
        subject,
        body,
        channel: 'WHATSAPP',
        targetType,
        targetNiveau,
        targetClasseId,
        targetEleveId,
        recipientCount: recipients.length,
        status: 'SENDING',
      });

      // ── Envoi via Botpress ────────────────────────────────────────────────
      const result = await BotpressService.sendBulk(recipients, { delayMs: 1000 });

      // Mise à jour du log avec les résultats
      await log.update({
        deliveredCount: result.sent,
        failedCount: result.failed,
        status: result.failed === 0 ? 'SENT' : (result.sent === 0 ? 'FAILED' : 'PARTIAL'),
        details: { delivered: result.details, skipped },
      });

      return res.json({
        success: true,
        logId: log.id,
        sent: result.sent,
        failed: result.failed,
        skipped: skipped.length,
        total: recipients.length + skipped.length,
        details: result.details,
        skippedDetails: skipped,
      });

    } catch (err) {
      console.error('[COMMUNICATION] Erreur envoi:', err);
      return res.status(500).json({ error: 'SendError', message: err.message });
    }
  }

  // ── Prévisualisation (dry-run) ────────────────────────────────────────────

  static async preview(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const {
        type = 'LIBRE',
        category = 'GENERAL',
        body,
        targetType,
        targetNiveau,
        targetClasseId,
        targetEleveId,
      } = req.body;

      if (!body || !targetType) {
        return res.status(400).json({ error: 'BadRequest', message: 'body et targetType sont obligatoires.' });
      }

      const eleveWhere = { tenantId };
      const isFinancier = CATEGORIES_FINANCIERES.includes(category) || TYPES_FINANCIERS.includes(type);

      if (isFinancier) {
        eleveWhere.statut = { [Op.in]: ['ACTIF', 'INSCRIT'] };
      } else {
        eleveWhere.statut = { [Op.in]: ['ACTIF', 'INSCRIT'] };
      }

      switch (targetType) {
        case 'INDIVIDUEL': eleveWhere.id = targetEleveId; break;
        case 'CLASSE': eleveWhere.classeId = targetClasseId; break;
        case 'NIVEAU': eleveWhere.niveau = targetNiveau; break;
        case 'ALL': break;
      }

      const eleves = await Eleve.findAll({
        where: eleveWhere,
        include: [{ model: Classe, as: 'classe', attributes: ['id', 'nom'] }],
        attributes: ['id', 'nom', 'prenom', 'niveau', 'parent1', 'whatsappPrincipal', 'statut'],
      });

      const recipients = [];
      const skipped = [];

      for (const eleve of eleves) {
        const phone = eleve.whatsappPrincipal || eleve.parent1?.whatsapp || eleve.parent1?.tel || null;
        if (!phone) {
          skipped.push({ eleveId: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, reason: 'Pas de numéro WhatsApp' });
          continue;
        }
        if (isFinancier && eleve.statut !== 'ACTIF') {
          skipped.push({ eleveId: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, reason: 'Élève non actif' });
          continue;
        }
        recipients.push({
          eleveId: eleve.id,
          nom: `${eleve.prenom} ${eleve.nom}`,
          niveau: eleve.niveau,
          classe: eleve.classe?.nom || eleve.niveau,
          phone,
        });
      }

      return res.json({
        recipientCount: recipients.length,
        skippedCount: skipped.length,
        recipients: recipients.slice(0, 50), // Limiter la preview
        skipped: skipped.slice(0, 20),
      });

    } catch (err) {
      return res.status(500).json({ error: 'PreviewError', message: err.message });
    }
  }

  // ── Historique des envois ──────────────────────────────────────────────────

  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { page = 1, limit = 20, type, category, status } = req.query;
      const where = { tenantId };
      if (type) where.type = type;
      if (category) where.category = category;
      if (status) where.status = status;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const { rows, count } = await CommunicationLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        attributes: { exclude: ['details'] },
      });

      return res.json({ logs: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const log = await CommunicationLog.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!log) return res.status(404).json({ error: 'NotFound' });
      return res.json(log);
    } catch (err) {
      return res.status(500).json({ error: 'GetError', message: err.message });
    }
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  static async listTemplates(req, res) {
    try {
      const templates = await CommunicationTemplate.findAll({
        where: { tenantId: req.user.tenantId, isActive: true },
        order: [['category', 'ASC'], ['label', 'ASC']],
      });
      return res.json(templates);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async upsertTemplate(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id, code, label, description, category, body, variables } = req.body;

      if (!code || !label || !body) {
        return res.status(400).json({ error: 'BadRequest', message: 'code, label et body sont obligatoires.' });
      }

      const data = { tenantId, code, label, description, category: category || 'GENERAL', body, variables: variables || [] };

      if (id) {
        const existing = await CommunicationTemplate.findOne({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'NotFound' });
        if (existing.isSystem) return res.status(403).json({ error: 'Forbidden', message: 'Les templates système ne sont pas modifiables.' });
        await existing.update(data);
        return res.json(existing);
      }

      const template = await CommunicationTemplate.create(data);
      return res.status(201).json(template);
    } catch (err) {
      return res.status(500).json({ error: 'UpsertError', message: err.message });
    }
  }

  static async deleteTemplate(req, res) {
    try {
      const template = await CommunicationTemplate.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!template) return res.status(404).json({ error: 'NotFound' });
      if (template.isSystem) return res.status(403).json({ error: 'Forbidden', message: 'Les templates système ne sont pas supprimables.' });
      await template.update({ isActive: false });
      return res.json({ message: 'Template désactivé.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderMessage(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}
