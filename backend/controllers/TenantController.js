
import { Tenant } from '../models/Tenant.js';
import { AuditLog } from '../models/AuditLog.js';
import crypto from 'crypto';
import { getStorageInfo } from '../services/S3Service.js';

// Defaults for tenant theming
const DEFAULT_PRIMARY_COLOR = '#0f172a';
const DEFAULT_BUTTON_COLOR = '#63452c';

export class TenantController {
  /**
   * Récupère les paramètres complets du Tenant
   */
  static async getSettings(req, res) {
    try {
      const tenant = await Tenant.findByPk(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }
      // Ensure frontend always receives sensible defaults for colors
      try {
        if (!tenant.primaryColor && !tenant.primary_color) tenant.primaryColor = DEFAULT_PRIMARY_COLOR;
        if (!tenant.buttonColor && !tenant.button_color) tenant.buttonColor = DEFAULT_BUTTON_COLOR;
        // Normalize name: some flows may send companyName/company_name
        if (!tenant.name && (tenant.companyName || tenant.company_name)) {
          tenant.name = tenant.companyName || tenant.company_name;
        }
      } catch (e) {
        // no-op
      }
      // Auto-population de anneeScolaireConfig depuis les données existantes (migration transparente)
      const rawConfig = tenant.anneeScolaireConfig || {};
      let configUpdated = false;
      const configToReturn = { ...rawConfig };

      if (tenant.anneeActive && !configToReturn[tenant.anneeActive]) {
        configToReturn[tenant.anneeActive] = { statut: 'EN_COURS', dateCreation: null, dateDemarrage: null };
        configUpdated = true;
      }
      const cloturees = Array.isArray(tenant.anneesCloturees) ? tenant.anneesCloturees : [];
      for (const annee of cloturees) {
        if (!configToReturn[annee]) {
          configToReturn[annee] = { statut: 'CLOTUREE', dateCreation: null, dateCloture: null };
          configUpdated = true;
        }
      }
      if (configUpdated) {
        await tenant.update({ anneeScolaireConfig: configToReturn });
      }

      // Ajouter les infos de stockage S3
      const storageInfo = await getStorageInfo(req.user.tenantId, tenant.planId || 'BASIC');
      return res.status(200).json({ ...tenant.toJSON(), anneeScolaireConfig: configToReturn, storage: storageInfo });
    } catch (error) {
      return res.status(500).json({ error: 'InternalError', message: error.message });
    }
  }

  /**
   * Met à jour les paramètres de l'entreprise (Branding, Fiscalité, Coordonnées)
   */
  static async updateSettings(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const tenant = await Tenant.findByPk(tenantId);

      if (!tenant) {
        return res.status(404).json({ error: 'NotFound', message: 'Instance introuvable.' });
      }

      // Extraction de TOUS les champs de paramétrage
      const {
        name, companyName, company_name, siret, address, phone, email,
        whatsappNumber,
        currency, taxRate, invoicePrefix,
        invoiceFooter, primaryColor,
        logoUrl, cachetUrl, signatureDirectionUrl, onboardingCompleted,
        theme, fontFamily, baseFontSize,
        buttonColor, button_color,
        anneeActive
      } = req.body;

      // Mise à jour robuste avec vérification de présence
      const updatedTenant = await tenant.update({
        name: name ?? companyName ?? company_name ?? tenant.name,
        siret: siret ?? tenant.siret,
        address: address ?? tenant.address,
        phone: phone ?? tenant.phone,
        email: email ?? tenant.email,
        whatsappNumber: whatsappNumber ?? tenant.whatsappNumber,
        currency: currency ?? tenant.currency,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : tenant.taxRate,
        invoicePrefix: invoicePrefix ?? tenant.invoicePrefix,
        invoiceFooter: invoiceFooter ?? tenant.invoiceFooter,
        primaryColor: primaryColor ?? tenant.primaryColor ?? tenant.primary_color ?? DEFAULT_PRIMARY_COLOR,
        logoUrl: logoUrl ?? tenant.logoUrl,
        cachetUrl: cachetUrl ?? tenant.cachetUrl,
        signatureDirectionUrl: signatureDirectionUrl ?? tenant.signatureDirectionUrl,
        onboardingCompleted: onboardingCompleted ?? tenant.onboardingCompleted,
        theme: theme ?? tenant.theme,
        fontFamily: fontFamily ?? tenant.fontFamily,
        baseFontSize: baseFontSize !== undefined ? parseInt(baseFontSize, 10) : tenant.baseFontSize,
        buttonColor: (buttonColor ?? button_color) ?? tenant.buttonColor ?? tenant.button_color ?? DEFAULT_BUTTON_COLOR,
        anneeActive: anneeActive !== undefined ? anneeActive : tenant.anneeActive
      });

      // Audit de la modification des paramètres critiques
      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'TENANT_SETTINGS_UPDATED',
        resource: 'Settings',
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:${req.user.id}:settings:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: 'Paramètres mis à jour avec succès.',
        tenant: updatedTenant
      });
    } catch (error) {
      console.error("[KERNEL SETTINGS ERROR]:", error);
      return res.status(500).json({ error: 'UpdateSettingsError', message: error.message });
    }
  }

  /**
   * Suspension du compte par le tenant lui-même (ADMIN uniquement)
   * - Aucune transaction ne sera possible tant que le compte est suspendu
   * - Les employés ne pourront pas se connecter
   * - Les paiements d'abonnement ne seront pas déclenchés jusqu'à expiration
   */
  static async suspendAccount(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          error: 'MissingReason',
          message: 'Un motif de suspension est obligatoire.'
        });
      }

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      if (tenant.isSuspended) {
        return res.status(409).json({
          error: 'AlreadySuspended',
          message: 'Le compte est déjà suspendu.'
        });
      }

      await tenant.update({
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: reason.trim()
      });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        userName: req.user.name || req.user.email || 'Administrateur',
        action: 'ACCOUNT_SUSPENDED',
        resource: 'Tenant',
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:${req.user.id}:suspend:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: 'Compte suspendu avec succès. Aucune transaction ne peut être effectuée et vos employés ne peuvent plus se connecter.',
        suspendedAt: tenant.suspendedAt,
        suspensionReason: reason.trim()
      });
    } catch (error) {
      return res.status(500).json({ error: 'SuspendError', message: error.message });
    }
  }

  /**
   * Réactivation du compte suspendu (ADMIN uniquement)
   */
  static async reactivateAccount(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      if (!tenant.isSuspended) {
        return res.status(409).json({
          error: 'NotSuspended',
          message: 'Le compte n\'est pas suspendu.'
        });
      }

      await tenant.update({
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null
      });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        userName: req.user.name || req.user.email || 'Administrateur',
        action: 'ACCOUNT_REACTIVATED',
        resource: 'Tenant',
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:${req.user.id}:reactivate:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: 'Compte réactivé avec succès. Toutes les fonctionnalités sont de nouveau disponibles.'
      });
    } catch (error) {
      return res.status(500).json({ error: 'ReactivateError', message: error.message });
    }
  }

  /**
   * Demande de suppression du compte par l'administrateur du tenant.
   *
   * Processus :
   *  1. L'admin fournit un motif + confirmation "DELETE"
   *  2. Le compte passe en état PENDING_DELETION (accès totalement bloqué)
   *  3. Délai de réflexion : 30 jours
   *  4. Après 30 jours → backup 90j + suppression définitive des données opérationnelles
   *  5. L'admin peut annuler à tout moment pendant les 30 jours
   */
  static async requestDeletion(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { reason, confirm } = req.body;

      // Double confirmation obligatoire
      if (confirm !== 'DELETE') {
        return res.status(400).json({
          error:   'ConfirmationRequired',
          message: 'Envoyez "confirm: \\"DELETE\\"" dans le body pour confirmer la demande de suppression.',
          warning: 'Cette action déclenchera la suppression définitive de toutes vos données après 30 jours.'
        });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          error:   'MissingReason',
          message: 'Un motif de suppression est obligatoire.'
        });
      }

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      if (tenant.pendingDeletion) {
        const scheduled = tenant.deletionScheduledFor
          ? new Date(tenant.deletionScheduledFor).toLocaleDateString('fr-FR')
          : '?';
        return res.status(409).json({
          error:   'AlreadyPendingDeletion',
          message: `Une demande de suppression est déjà en cours. Suppression prévue le ${scheduled}.`,
          deletionScheduledFor: tenant.deletionScheduledFor
        });
      }

      const now                = new Date();
      const deletionScheduledFor = new Date(now);
      deletionScheduledFor.setDate(deletionScheduledFor.getDate() + 30);

      await tenant.update({
        pendingDeletion:      true,
        deletionRequestedAt:  now,
        deletionScheduledFor,
        deletionReason:       reason.trim(),
        // Bloquer aussi le compte
        isSuspended:          true,
        suspendedAt:          now,
        suspensionReason:     `Compte en attente de suppression : ${reason.trim()}`
      });

      await AuditLog.create({
        tenantId,
        userId:   req.user.id,
        userName: req.user.name || req.user.email || 'Administrateur',
        action:   'ACCOUNT_DELETION_REQUESTED',
        resource: 'Tenant',
        severity: 'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`${tenantId}:${req.user.id}:delete-request:${Date.now()}`)
          .digest('hex')
      });

      return res.status(200).json({
        message: 'Demande de suppression enregistrée. Vos données seront sauvegardées puis définitivement supprimées dans 30 jours.',
        deletionScheduledFor,
        retentionAfterDeletion: '90 jours (vos données resteront récupérables sur notre serveur de sauvegarde)',
        cancelBefore: deletionScheduledFor
      });
    } catch (error) {
      return res.status(500).json({ error: 'DeletionRequestError', message: error.message });
    }
  }

  /**
   * Annulation de la demande de suppression (pendant la période de 30 jours).
   */
  static async cancelDeletion(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
      }

      if (!tenant.pendingDeletion) {
        return res.status(409).json({
          error:   'NoDeletionPending',
          message: 'Aucune demande de suppression en cours pour ce compte.'
        });
      }

      // Vérifier que le délai de 30 jours n'est pas déjà dépassé
      if (tenant.deletionScheduledFor && new Date(tenant.deletionScheduledFor) < new Date()) {
        return res.status(410).json({
          error:   'DeletionAlreadyProcessed',
          message: 'Le délai de réflexion est dépassé. La suppression est en cours de traitement. Contactez le support.'
        });
      }

      await tenant.update({
        pendingDeletion:      false,
        deletionRequestedAt:  null,
        deletionScheduledFor: null,
        deletionReason:       null,
        // Lever aussi la suspension automatique liée à la demande de suppression
        isSuspended:          false,
        suspendedAt:          null,
        suspensionReason:     null
      });

      await AuditLog.create({
        tenantId,
        userId:   req.user.id,
        userName: req.user.name || req.user.email || 'Administrateur',
        action:   'ACCOUNT_DELETION_CANCELLED',
        resource: 'Tenant',
        severity: 'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`${tenantId}:${req.user.id}:delete-cancel:${Date.now()}`)
          .digest('hex')
      });

      return res.status(200).json({
        message: 'Demande de suppression annulée avec succès. Votre compte est de nouveau actif.'
      });
    } catch (error) {
      return res.status(500).json({ error: 'CancelDeletionError', message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GESTION DU CYCLE DE VIE DES ANNÉES SCOLAIRES
  // Cycle : PREPARATION → INSCRIPTIONS_OUVERTES → EN_COURS → CLOTUREE
  // ─────────────────────────────────────────────────────────────────────────────

  /** Helper interne : met à jour anneeScolaireConfig de façon atomique */
  static async _patchAnneeConfig(tenant, anneeLibelle, patch) {
    const config = { ...(tenant.anneeScolaireConfig || {}) };
    config[anneeLibelle] = { ...(config[anneeLibelle] || {}), ...patch };
    await tenant.update({ anneeScolaireConfig: config });
    return config;
  }

  /**
   * Créer une nouvelle année scolaire (statut: PREPARATION)
   * POST /settings/annees  { anneeLibelle: "2026-2027" }
   */
  static async creerAnnee(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { anneeLibelle } = req.body;

      if (!anneeLibelle || !/^\d{4}-\d{4}$/.test(anneeLibelle)) {
        return res.status(400).json({ error: 'InvalidAnneeFormat', message: 'Format attendu: YYYY-YYYY (ex: 2026-2027)' });
      }
      const [start, end] = anneeLibelle.split('-').map(Number);
      if (end !== start + 1) {
        return res.status(400).json({ error: 'InvalidAnneeRange', message: "L'année de fin doit être start + 1." });
      }

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'TenantNotFound' });

      const config = tenant.anneeScolaireConfig || {};
      if (config[anneeLibelle]) {
        return res.status(409).json({ error: 'AnneeDejaExistante', message: `L'année ${anneeLibelle} existe déjà (statut: ${config[anneeLibelle].statut}).` });
      }

      const newConfig = await TenantController._patchAnneeConfig(tenant, anneeLibelle, {
        statut: 'PREPARATION',
        dateCreation: new Date().toISOString()
      });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'ANNEE_CREEE',
        resource: `Année scolaire: ${anneeLibelle}`,
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:creer:${anneeLibelle}:${Date.now()}`).digest('hex')
      });

      return res.status(201).json({
        message: `Année scolaire ${anneeLibelle} créée en mode PREPARATION.`,
        anneeLibelle,
        config: newConfig[anneeLibelle]
      });
    } catch (error) {
      return res.status(500).json({ error: 'CreerAnneeError', message: error.message });
    }
  }

  /**
   * Ouvrir les inscriptions pour une année (PREPARATION → INSCRIPTIONS_OUVERTES)
   * PUT /settings/annees/:annee/ouvrir-inscriptions
   */
  static async ouvrirInscriptions(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const anneeLibelle = req.params.annee;

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'TenantNotFound' });

      const config = tenant.anneeScolaireConfig || {};
      const anneeConfig = config[anneeLibelle];
      const statutActuel = anneeConfig?.statut;

      // Accepte PREPARATION ou absence (migration d'une année non encore trackée)
      if (statutActuel && statutActuel !== 'PREPARATION') {
        return res.status(409).json({
          error: 'TransitionImpossible',
          message: `Impossible d'ouvrir les inscriptions depuis le statut "${statutActuel}". Statut requis: PREPARATION.`
        });
      }

      const newConfig = await TenantController._patchAnneeConfig(tenant, anneeLibelle, {
        statut: 'INSCRIPTIONS_OUVERTES',
        dateCreation: anneeConfig?.dateCreation || new Date().toISOString(),
        dateOuvertureInscriptions: new Date().toISOString()
      });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'INSCRIPTIONS_OUVERTES',
        resource: `Année scolaire: ${anneeLibelle}`,
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:ouvrir-inscriptions:${anneeLibelle}:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: `Inscriptions ouvertes pour l'année ${anneeLibelle}.`,
        anneeLibelle,
        config: newConfig[anneeLibelle]
      });
    } catch (error) {
      return res.status(500).json({ error: 'OuvrirInscriptionsError', message: error.message });
    }
  }

  /**
   * Démarrer officiellement une année scolaire (INSCRIPTIONS_OUVERTES → EN_COURS)
   * Met à jour anneeActive → toute l'application bascule sur cette année
   * PUT /settings/annees/:annee/demarrer
   */
  static async demarrerAnnee(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const anneeLibelle = req.params.annee;

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'TenantNotFound' });

      const config = tenant.anneeScolaireConfig || {};
      const anneeConfig = config[anneeLibelle];
      const statutActuel = anneeConfig?.statut;

      if (statutActuel && statutActuel !== 'INSCRIPTIONS_OUVERTES') {
        return res.status(409).json({
          error: 'TransitionImpossible',
          message: `Impossible de démarrer depuis le statut "${statutActuel}". Statut requis: INSCRIPTIONS_OUVERTES.`
        });
      }

      const ancienneAnnee = tenant.anneeActive;
      const newConfig = await TenantController._patchAnneeConfig(tenant, anneeLibelle, {
        statut: 'EN_COURS',
        dateCreation: anneeConfig?.dateCreation || new Date().toISOString(),
        dateOuvertureInscriptions: anneeConfig?.dateOuvertureInscriptions || null,
        dateDemarrage: new Date().toISOString()
      });
      await tenant.update({ anneeActive: anneeLibelle });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'ANNEE_DEMARREE',
        resource: `Année scolaire: ${anneeLibelle}`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:demarrer:${anneeLibelle}:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: `Année scolaire ${anneeLibelle} démarrée. L'application bascule sur cette année.`,
        anneeActive: anneeLibelle,
        ancienneAnnee: ancienneAnnee || null,
        config: newConfig[anneeLibelle]
      });
    } catch (error) {
      return res.status(500).json({ error: 'DemarrerAnneeError', message: error.message });
    }
  }

  /**
   * Clôturer une année scolaire (EN_COURS → CLOTUREE)
   * PUT /settings/annees/:annee/cloturer
   * Conserve aussi l'ancienne route POST /settings/annee/cloturer pour compat
   */
  static async cloturerAnnee(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'TenantNotFound' });

      // Support nouvelle route (params) et ancienne route (body)
      const anneeLibelle = req.params?.annee
        || tenant.anneeActive
        || req.body?.anneeLibelle
        || (() => {
          const now = new Date();
          const m = now.getMonth() + 1;
          const y = now.getFullYear();
          return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        })();

      const config = tenant.anneeScolaireConfig || {};
      const anneeConfig = config[anneeLibelle];
      const statutActuel = anneeConfig?.statut;

      if (statutActuel === 'CLOTUREE') {
        return res.status(409).json({ error: 'DejaClosee', message: `L'année ${anneeLibelle} est déjà clôturée.` });
      }

      // Mise à jour config + annees_cloturees
      const newConfig = await TenantController._patchAnneeConfig(tenant, anneeLibelle, {
        statut: 'CLOTUREE',
        dateCreation: anneeConfig?.dateCreation || null,
        dateOuvertureInscriptions: anneeConfig?.dateOuvertureInscriptions || null,
        dateDemarrage: anneeConfig?.dateDemarrage || null,
        dateCloture: new Date().toISOString()
      });
      const existing = Array.isArray(tenant.anneesCloturees) ? tenant.anneesCloturees : [];
      const updatePayload = {};
      if (!existing.includes(anneeLibelle)) {
        updatePayload.anneesCloturees = [...existing, anneeLibelle];
      }

      // Si l'année clôturée était l'année active, basculer sur la prochaine année disponible
      let nextAnnee = null;
      if (tenant.anneeActive === anneeLibelle) {
        const priorities = ['EN_COURS', 'INSCRIPTIONS_OUVERTES', 'PREPARATION'];
        for (const statut of priorities) {
          const found = Object.entries(newConfig).find(([k, v]) => k !== anneeLibelle && v.statut === statut);
          if (found) { nextAnnee = found[0]; break; }
        }
        updatePayload.anneeActive = nextAnnee;
      }

      if (Object.keys(updatePayload).length > 0) {
        await tenant.update(updatePayload);
      }

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'ANNEE_CLOTUREE',
        resource: `Année scolaire: ${anneeLibelle}`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:cloturer:${anneeLibelle}:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({
        message: `Année scolaire ${anneeLibelle} clôturée.`,
        annee: anneeLibelle,
        config: newConfig[anneeLibelle],
        anneeActive: nextAnnee !== undefined ? (nextAnnee || null) : tenant.anneeActive
      });
    } catch (error) {
      return res.status(500).json({ error: 'CloturerAnneeError', message: error.message });
    }
  }

  /**
   * Réactiver une année clôturée par erreur (CLOTUREE → EN_COURS)
   * PUT /settings/annees/:annee/reactiver
   */
  static async reactiverAnnee(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const anneeLibelle = req.params.annee;
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'TenantNotFound' });

      const config = tenant.anneeScolaireConfig || {};
      const anneeConfig = config[anneeLibelle] || {};

      const newConfig = await TenantController._patchAnneeConfig(tenant, anneeLibelle, {
        ...anneeConfig,
        statut: 'EN_COURS',
        dateCloture: null,
      });

      const existing = Array.isArray(tenant.anneesCloturees) ? tenant.anneesCloturees : [];
      await tenant.update({
        anneesCloturees: existing.filter(a => a !== anneeLibelle),
        anneeActive: anneeLibelle,
      });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'ANNEE_REACTIVEE',
        resource: `Année scolaire: ${anneeLibelle}`,
        severity: 'HIGH',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:reactiver:${anneeLibelle}:${Date.now()}`).digest('hex'),
      });

      return res.status(200).json({
        message: `Année scolaire ${anneeLibelle} réactivée.`,
        annee: anneeLibelle,
        config: newConfig[anneeLibelle],
        anneeActive: anneeLibelle,
        anneesCloturees: existing.filter(a => a !== anneeLibelle),
      });
    } catch (error) {
      return res.status(500).json({ error: 'ReactiverAnneeError', message: error.message });
    }
  }

  /**
   * Compat : ancienne route POST /settings/annee/nouvelle
   * Redirige vers demarrerAnnee avec body → params
   */
  static async demarrerNouvelleAnnee(req, res) {
    req.params = req.params || {};
    req.params.annee = req.body?.anneeLibelle;
    return TenantController.demarrerAnnee(req, res);
  }

  /**
   * Upload de logo (Simulation ou intégration cloud)
   */
  static async uploadLogo(req, res) {
    try {
      const { logoData } = req.body;
      const tenant = await Tenant.findByPk(req.user.tenantId);
      
      await tenant.update({ logoUrl: logoData });
      
      return res.status(200).json({ message: 'Logo mis à jour', logoUrl: logoData });
    } catch (error) {
      return res.status(500).json({ error: 'UploadError', message: error.message });
    }
  }
}
