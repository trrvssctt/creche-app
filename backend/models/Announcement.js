import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Announcement extends Model {}

Announcement.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  type: {
    type: DataTypes.ENUM('INFO', 'WARNING', 'UPDATE', 'PROMO', 'MAINTENANCE'),
    defaultValue: 'INFO',
    allowNull: false
  },
  targetPlan: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'target_plan'
    // null = tous les plans
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_pinned' },
  expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
  createdBy: { type: DataTypes.STRING(255), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' }
}, {
  sequelize,
  modelName: 'Announcement',
  tableName: 'announcements',
  timestamps: true,
  underscored: false,
  indexes: [
    { fields: ['is_active'] },
    { fields: ['created_at'] }
  ]
});

export default Announcement;
