
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
      // Ajouter les infos de stockage S3
      const storageInfo = await getStorageInfo(req.user.tenantId, tenant.planId || 'BASIC');
      return res.status(200).json({ ...tenant.toJSON(), storage: storageInfo });
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
        currency, taxRate, invoicePrefix, 
        invoiceFooter, primaryColor, 
        logoUrl, cachetUrl, onboardingCompleted,
        theme, fontFamily, baseFontSize,
        buttonColor, button_color
      } = req.body;

      // Mise à jour robuste avec vérification de présence
      const updatedTenant = await tenant.update({
        // Accept name or companyName/company_name from payload
        name: name ?? companyName ?? company_name ?? tenant.name,
        siret: siret ?? tenant.siret,
        address: address ?? tenant.address,
        phone: phone ?? tenant.phone,
        email: email ?? tenant.email,
        currency: currency ?? tenant.currency,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : tenant.taxRate,
        invoicePrefix: invoicePrefix ?? tenant.invoicePrefix,
        invoiceFooter: invoiceFooter ?? tenant.invoiceFooter,
        // Apply provided value, else keep existing, else default
        primaryColor: primaryColor ?? tenant.primaryColor ?? tenant.primary_color ?? DEFAULT_PRIMARY_COLOR,
        logoUrl: logoUrl ?? tenant.logoUrl,
        cachetUrl: cachetUrl ?? tenant.cachetUrl,
        onboardingCompleted: onboardingCompleted ?? tenant.onboardingCompleted,
        // UI preferences
        theme: theme ?? tenant.theme,
        fontFamily: fontFamily ?? tenant.fontFamily,
        baseFontSize: baseFontSize !== undefined ? parseInt(baseFontSize, 10) : tenant.baseFontSize,
        // Button color: accept either camelCase or snake_case from frontend
        buttonColor: (buttonColor ?? button_color) ?? tenant.buttonColor ?? tenant.button_color ?? DEFAULT_BUTTON_COLOR
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
