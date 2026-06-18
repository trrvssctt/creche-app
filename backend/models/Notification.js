
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Notification extends Model {}

Notification.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  // NULL = broadcast à tous les employés du tenant
  targetUserId: { type: DataTypes.UUID, allowNull: true, field: 'target_user_id' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  type: {
    type: DataTypes.ENUM('INFO', 'WARNING', 'URGENT', 'PAYROLL', 'HR', 'LEAVE'),
    defaultValue: 'INFO',
    allowNull: false
  },
  actionLink: { type: DataTypes.STRING(255), allowNull: true, field: 'action_link' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' }
}, {
  sequelize,
  modelName: 'notification',
  tableName: 'notifications',
  underscored: true
});
