import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CommunicationTemplate extends Model {}

CommunicationTemplate.init({
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:    { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  code:        { type: DataTypes.STRING(50), allowNull: false },
  label:       { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255) },
  category:    { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'GENERAL' }, // FINANCIER, PEDAGOGIQUE, GENERAL
  body:        { type: DataTypes.TEXT, allowNull: false },
  variables:   { type: DataTypes.JSONB, defaultValue: [] }, // ['prenom_parent', 'prenom_enfant', ...]
  isSystem:    { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_system' },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  sequelize,
  modelName: 'communicationTemplate',
  tableName: 'communication_templates',
  underscored: true,
});
