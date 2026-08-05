import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class FinanceAuditEvent extends Model {}

FinanceAuditEvent.init({
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:   { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  userId:     { type: DataTypes.UUID, field: 'user_id' },
  userName:   { type: DataTypes.STRING(255), field: 'user_name' },
  eventType:  { type: DataTypes.STRING(50), allowNull: false, field: 'event_type' },
  entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
  entityId:   { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
  oldValues:  { type: DataTypes.JSONB, field: 'old_values' },
  newValues:  { type: DataTypes.JSONB, field: 'new_values' },
  metadata:   { type: DataTypes.JSONB, defaultValue: {} },
  ipAddress:  { type: DataTypes.STRING(45), field: 'ip_address' },
}, {
  sequelize,
  modelName: 'financeAuditEvent',
  tableName: 'finance_audit_events',
  underscored: true,
  updatedAt: false,
});
