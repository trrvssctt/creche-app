
import { Tenant } from '../models/Tenant.js';

export const tenantIsolation = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Auth context missing' });
  }

  const tenantId = req.user.tenantId;
  let targetTenantId = tenantId;
  if (req.user.role === 'SUPER_ADMIN') {
    targetTenantId = req.headers['x-tenant-id'] || tenantId;
  }
  if (!targetTenantId) {
    return res.status(403).json({ error: 'Missing Tenant Identity' });
  }

  try {
    // Charge toutes les infos du tenant
    const t = await Tenant.findByPk(targetTenantId);
    if (!t) {
      return res.status(404).json({ error: 'TenantNotFound', message: 'Instance introuvable.' });
    }

    // Blocage total si suppression planifiée — personne ne peut accéder (sauf SUPER_ADMIN)
    if (t.pendingDeletion && req.user.role !== 'SUPER_ADMIN') {
      const scheduled = t.deletionScheduledFor
        ? new Date(t.deletionScheduledFor).toLocaleDateString('fr-FR')
        : null;
      return res.status(410).json({
        error:   'AccountPendingDeletion',
        message: `Ce compte est en cours de suppression${scheduled ? ` (prévue le ${scheduled})` : ''}. Contactez le support pour annuler.`,
        deletionScheduledFor: t.deletionScheduledFor,
        deletionReason:       t.deletionReason
      });
    }

    // Blocage transactions si compte suspendu par le tenant
    // Les SUPER_ADMIN peuvent toujours passer ; les GET sont autorisés pour consultation
    if (t.isSuspended && req.user.role !== 'SUPER_ADMIN') {
      const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (isWriteOperation) {
        return res.status(423).json({
          error: 'AccountSuspended',
          message: 'Votre compte est suspendu. Aucune transaction ne peut être effectuée. Veuillez réactiver votre compte pour reprendre l\'activité.',
          suspendedAt: t.suspendedAt,
          suspensionReason: t.suspensionReason
        });
      }
    }

    // Injection dans req.tenantFilter ET req.tenant (pour compatibilité)
    req.tenantFilter = {
      tenantId: t.id,
      company_name: t.name || t.company_name || t.companyName || 'Mon Entreprise',
      logo_url: t.logoUrl || t.logo_url || '',
      primary_color: t.primaryColor || t.primary_color || '#6366f1',
      secondary_color: t.secondaryColor || t.secondary_color || '#22d3ee',
      address: t.address || '',
      city: t.city || 'Dakar',
      country: t.country || 'Sénégal',
      phone: t.phone || '',
      email: t.email || '',
      website: t.website || '',
      ninea: t.ninea || '',
      rc: t.rc || '',
      tax_rate: t.taxRate || t.tax_rate || 18,
      currency: t.currency || 'FCFA',
      bank_name: t.bank_name || '',
      bank_iban: t.bank_iban || '',
      bank_swift: t.bank_swift || '',
      footer_mention: t.footer_mention || t.invoiceFooter || 'Merci pour votre confiance.',
      plan: t.plan || 'BASIC',
      // Ajout d'autres champs utiles si besoin
    };
    req.tenant = req.tenantFilter;
  } catch (err) {
    return res.status(500).json({ error: 'TenantLoadError', message: err.message });
  }

  next();
};
