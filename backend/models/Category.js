import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Category extends Model {}

Category.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { 
    type: DataTypes.STRING(20), 
    defaultValue: 'actif',
    allowNull: false 
  },
  deletedAt: { 
    type: DataTypes.DATE, 
    field: 'deleted_at' 
  }
}, {
  sequelize,
  modelName: 'category',
  tableName: 'categories',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'name'], where: { status: 'actif' } }
  ]
});

export default Category;