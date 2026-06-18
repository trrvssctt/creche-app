
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class AuditLog extends Model {}

AuditLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  userId: { type: DataTypes.UUID, field: 'user_id' },
  userName: { type: DataTypes.STRING(255), field: 'user_name' },
  action: { type: DataTypes.STRING(100), allowNull: false },
  resource: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.STRING(20) },
  severity: { type: DataTypes.STRING(20) },
  sha256Signature: { type: DataTypes.TEXT, allowNull: false, field: 'sha256_signature' }
}, { 
  sequelize, 
  modelName: 'audit_log',
  tableName: 'audit_logs',
  underscored: true,
  updatedAt: false
});

export default AuditLog;
