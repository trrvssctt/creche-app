
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class NotificationRead extends Model {}

NotificationRead.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  notificationId: { type: DataTypes.UUID, allowNull: false, field: 'notification_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  readAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'read_at' }
}, {
  sequelize,
  modelName: 'notification_read',
  tableName: 'notification_reads',
  underscored: true,
  timestamps: false,
  indexes: [
    { unique: true, fields: ['notification_id', 'user_id'] }
  ]
});
