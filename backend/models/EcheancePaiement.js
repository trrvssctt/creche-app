import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class EcheancePaiement extends Model {}

EcheancePaiement.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  abonnementId:   { type: DataTypes.UUID, allowNull: false, field: 'abonnement_id' },
  eleveId:        { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  serviceId:      { type: DataTypes.UUID, allowNull: false, field: 'service_id' },
  montant:        { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  dateEcheance:   { type: DataTypes.DATEONLY, allowNull: false, field: 'date_echeance' },
  periodeLabel:   { type: DataTypes.STRING(50), field: 'periode_label' }, // ex: "Mai 2026"
  statut:         { type: DataTypes.STRING(20), defaultValue: 'EN_ATTENTE' }, // EN_ATTENTE, PAYE, EN_RETARD, ANNULE
  paidAt:         { type: DataTypes.DATE, field: 'paid_at' },
  saleId:         { type: DataTypes.UUID, field: 'sale_id' },
  reminderSentAt: { type: DataTypes.DATE, field: 'reminder_sent_at' },
}, {
  sequelize,
  modelName: 'echeance_paiement',
  tableName: 'echeances_paiements',
  underscored: true,
});
