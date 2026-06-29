import { Op } from 'sequelize';
import { Tenant, Eleve } from '../models/index.js';

// Résout le tenant depuis l'Origin/Referer de la requête
async function resolveTenantFromRequest(req) {
  const raw = req.headers.origin || req.headers.referer || '';
  let tenant = null;

  // Tentative de résolution depuis le domaine
  if (raw) {
    try {
      const hostname = new URL(raw).hostname;

      // Cherche par domaine exact
      tenant = await Tenant.findOne({ where: { domain: hostname } });

      // Fallback : domaine sans sous-domaine (letoitdesanges.com)
      if (!tenant && hostname.includes('.')) {
        const baseDomain = hostname.split('.').slice(-2).join('.');
        tenant = await Tenant.findOne({ where: { domain: baseDomain } });
      }
    } catch {
      // URL invalide — on continue vers le fallback
    }
  }

  // Dernier recours : variable d'env CRECHE_TENANT_ID (dev local, multi-tenant)
  if (!tenant && process.env.CRECHE_TENANT_ID) {
    tenant = await Tenant.findOne({ where: { id: process.env.CRECHE_TENANT_ID } });
  }

  return tenant;
}

export class PublicController {

  // GET /api/public/ecole — branding public (logo, nom) pour la page d'inscription
  static async getEcoleBranding(req, res) {
    try {
      const tenant = await resolveTenantFromRequest(req);
      if (!tenant) return res.status(404).json({ error: 'École introuvable.' });
      res.json({
        name:    tenant.name    || null,
        logoUrl: tenant.logoUrl || null,
      });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/public/admission — dépôt de dossier sans compte parent
  static async submitAdmission(req, res) {
    try {
      const tenant = await resolveTenantFromRequest(req);
      if (!tenant) {
        return res.status(404).json({ error: 'École introuvable. Vérifiez l\'URL.' });
      }

      const {
        nom, prenom, dateNaissance, lieuNaissance, sexe, niveau,
        cantine, transportBus, besoinSpecifique,
        ficheSanitaire, parent1, parent2, contactUrgence, notes,
      } = req.body;

      if (!nom?.trim() || !prenom?.trim()) {
        return res.status(400).json({ error: 'Le nom et le prénom de l\'enfant sont requis.' });
      }
      if (!parent1?.telephone && !parent1?.email) {
        return res.status(400).json({ error: 'Un numéro de téléphone ou email parent est requis.' });
      }

      const anneeResolue = tenant.anneeActive || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);

      const notesDossier = [
        'Dossier soumis via le formulaire public en ligne.',
        notes ? notes.trim() : null,
      ].filter(Boolean).join('\n');

      const eleve = await Eleve.create({
        tenantId:        tenant.id,
        nom:             nom.trim(),
        prenom:          prenom.trim(),
        dateNaissance:   dateNaissance  || null,
        lieuNaissance:   lieuNaissance  || null,
        sexe:            sexe           || null,
        niveau:          niveau         || 'PS',
        cantine:         !!cantine,
        transportBus:    !!transportBus,
        besoinSpecifique: besoinSpecifique || null,
        ficheSanitaire:  ficheSanitaire || null,
        parent1:         parent1        || null,
        parent2:         parent2        || null,
        contactUrgence:  contactUrgence || null,
        anneeScolaire:   anneeResolue,
        statut:          'EN_ATTENTE',
        notes:           notesDossier,
      });

      // Référence lisible : PRE-AAAA-XXXX
      const ref = `PRE-${new Date().getFullYear()}-${eleve.id.slice(0, 6).toUpperCase()}`;

      return res.status(201).json({
        success: true,
        reference: ref,
        message:   `Votre dossier a été transmis à ${tenant.name || "l'école"}. Conservez votre référence : ${ref}. Vous serez contacté(e) pour la suite.`,
      });
    } catch (err) {
      console.error('[PublicController.submitAdmission]', err);
      return res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/public/admission/:reference — suivi public d'un dossier de préinscription
  static async trackAdmission(req, res) {
    const raw = (req.params.reference || '').toUpperCase().trim();

    // Format attendu : PRE-YYYY-XXXXXX (6 chars alphanumériques)
    const match = raw.match(/^PRE-(\d{4})-([A-Z0-9]{6})$/);
    if (!match) {
      return res.status(400).json({ error: 'Format de référence invalide. Exemple : PRE-2026-C0C91A' });
    }

    const idPrefix = match[2]; // ex: C0C91A — première partie de l'UUID

    try {
      const tenant = await resolveTenantFromRequest(req);
      if (!tenant) return res.status(404).json({ error: 'École introuvable.' });

      // Cherche l'élève dont l'UUID commence par idPrefix (6 premiers chars en majuscules)
      const eleve = await Eleve.findOne({
        where: {
          tenantId: tenant.id,
          [Op.and]: Eleve.sequelize.literal(`UPPER(LEFT(id::text, 6)) = '${idPrefix}'`),
        },
        attributes: ['id', 'nom', 'prenom', 'niveau', 'statut', 'createdAt'],
      });

      if (!eleve) {
        return res.status(404).json({ error: 'Dossier introuvable. Vérifiez votre numéro de référence.' });
      }

      return res.json({
        reference: raw,
        prenom:      eleve.prenom,
        nomInitiale: (eleve.nom || 'X')[0].toUpperCase() + '.',
        niveau:      eleve.niveau,
        statut:      eleve.statut || 'EN_ATTENTE',
        dateDepot:   eleve.createdAt,
      });
    } catch (err) {
      console.error('[PublicController.trackAdmission]', err);
      return res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }
}
