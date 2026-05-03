import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Subcategory extends Model {}

Subcategory.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  categoryId: { type: DataTypes.UUID, allowNull: false, field: 'category_id' },
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
  modelName: 'subcategory',
  tableName: 'subcategories',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'category_id', 'name'], where: { status: 'actif' } }
  ]
});

export default Subcategory;