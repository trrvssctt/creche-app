import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CommunicationLog extends Model {}

CommunicationLog.init({
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:     { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  senderId:     { type: DataTypes.UUID, allowNull: false, field: 'sender_id' },
  type:         { type: DataTypes.STRING(30), allowNull: false }, // FACTURE, RECU, RELANCE, BULLETIN, ANNONCE, EVENEMENT, LIBRE
  category:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'GENERAL' }, // FINANCIER, PEDAGOGIQUE, GENERAL
  templateId:   { type: DataTypes.STRING(100), field: 'template_id' },
  subject:      { type: DataTypes.STRING(255) },
  body:         { type: DataTypes.TEXT, allowNull: false },
  channel:      { type: DataTypes.STRING(20), defaultValue: 'WHATSAPP' }, // WHATSAPP, EMAIL, SMS
  // Ciblage
  targetType:   { type: DataTypes.STRING(20), allowNull: false, field: 'target_type' }, // ALL, NIVEAU, CLASSE, INDIVIDUEL
  targetNiveau: { type: DataTypes.STRING(10), field: 'target_niveau' },
  targetClasseId: { type: DataTypes.UUID, field: 'target_classe_id' },
  targetEleveId:  { type: DataTypes.UUID, field: 'target_eleve_id' },
  // Résultat
  recipientCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'recipient_count' },
  deliveredCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'delivered_count' },
  failedCount:    { type: DataTypes.INTEGER, defaultValue: 0, field: 'failed_count' },
  status:         { type: DataTypes.STRING(20), defaultValue: 'PENDING' }, // PENDING, SENDING, SENT, PARTIAL, FAILED
  details:        { type: DataTypes.JSONB }, // [{eleveId, phone, status, error?}]
}, {
  sequelize,
  modelName: 'communicationLog',
  tableName: 'communication_logs',
  underscored: true,
});
