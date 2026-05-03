import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SupportTicket extends Model {}

SupportTicket.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
  userName: { type: DataTypes.STRING(255), allowNull: true, field: 'user_name' },
  userEmail: { type: DataTypes.STRING(255), allowNull: true, field: 'user_email' },
  subject: { type: DataTypes.STRING(500), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  category: {
    type: DataTypes.ENUM('BILLING', 'TECHNICAL', 'FEATURE_REQUEST', 'ACCOUNT', 'OTHER'),
    defaultValue: 'OTHER',
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
    defaultValue: 'NORMAL',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
    defaultValue: 'OPEN',
    allowNull: false
  },
  adminReply: { type: DataTypes.TEXT, allowNull: true, field: 'admin_reply' },
  adminId: { type: DataTypes.STRING(255), allowNull: true, field: 'admin_id' },
  resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' }
}, {
  sequelize,
  modelName: 'SupportTicket',
  tableName: 'support_tickets',
  timestamps: true,
  underscored: false,
  indexes: [
    { fields: ['tenant_id'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['created_at'] }
  ]
});

export default SupportTicket;
