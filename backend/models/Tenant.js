
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Tenant extends Model {}

Tenant.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  domain: { type: DataTypes.STRING, unique: true, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  
  // Fiscalité & Localisation
  siret: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  currency: { type: DataTypes.STRING, defaultValue: 'F CFA' },
  timezone: { type: DataTypes.STRING, defaultValue: 'UTC' },
  language: { type: DataTypes.STRING, defaultValue: 'fr' },
  taxRate: { type: DataTypes.NUMERIC(5, 2), defaultValue: 18.00, field: 'tax_rate' },
  
  // Branding & UI
  logoUrl: { type: DataTypes.TEXT, field: 'logo_url' },
  primaryColor: { type: DataTypes.STRING(7), defaultValue: '#4f46e5', field: 'primary_color' },
    cachetUrl: { type: DataTypes.TEXT, field: 'cachet_url' }, // Nouveau
  // UI preferences persisted per-tenant
  theme: { type: DataTypes.STRING(10), defaultValue: 'light', field: 'theme' },
  fontFamily: { type: DataTypes.STRING, field: 'font_family' },
  baseFontSize: { type: DataTypes.INTEGER, defaultValue: 14, field: 'base_font_size' },
  buttonColor: { type: DataTypes.STRING(7), field: 'button_color' },
  
  // Paramètres Facturation
  invoicePrefix: { type: DataTypes.STRING(20), defaultValue: 'INV-', field: 'invoice_prefix' },
  invoiceFooter: { type: DataTypes.TEXT, field: 'invoice_footer' },
  
  // Sécurité Instance
  enforceMfa: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'enforce_mfa' },
  onboardingCompleted: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'onboarding_completed' },
  
  // Business Stats
  mrr: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0 },
  paymentStatus: { type: DataTypes.STRING(20), defaultValue: 'PENDING', field: 'payment_status' },
  lastPaymentDate: { type: DataTypes.DATE, field: 'last_payment_date' },
  lastPaymentAmount: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'last_payment_amount' },
  planId: { type: DataTypes.STRING(50), allowNull: true, field: 'plan_id' },
  subscriptionEndsAt: { type: DataTypes.DATE, allowNull: true, field: 'subscription_ends_at' },
  pendingPlanId: { type: DataTypes.STRING(50), allowNull: true, field: 'pending_plan_id' },
  pendingPeriod: { type: DataTypes.STRING(10), allowNull: true, field: 'pending_period' },

  // Suspension du compte par le tenant lui-même
  isSuspended: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_suspended' },
  suspendedAt: { type: DataTypes.DATE, allowNull: true, field: 'suspended_at' },
  suspensionReason: { type: DataTypes.TEXT, allowNull: true, field: 'suspension_reason' },

  // Suppression planifiée du compte (30 jours de délai de réflexion)
  pendingDeletion: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'pending_deletion' },
  deletionRequestedAt: { type: DataTypes.DATE, allowNull: true, field: 'deletion_requested_at' },
  deletionScheduledFor: { type: DataTypes.DATE, allowNull: true, field: 'deletion_scheduled_for' },
  deletionReason: { type: DataTypes.TEXT, allowNull: true, field: 'deletion_reason' },
  deletionBackupPath: { type: DataTypes.STRING(500), allowNull: true, field: 'deletion_backup_path' },

  // Stockage S3 utilisé (en octets)
  storageUsedBytes: { type: DataTypes.BIGINT, defaultValue: 0, field: 'storage_used_bytes' }
}, {
  sequelize,
  modelName: 'tenant',
  tableName: 'tenants',
  underscored: true
});
