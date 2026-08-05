import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CollectionAction extends Model {}

CollectionAction.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  caseId:         { type: DataTypes.UUID, allowNull: false, field: 'case_id' },
  actionType:     { type: DataTypes.STRING(30), allowNull: false, field: 'action_type' },
  channel:        { type: DataTypes.STRING(20) },
  performedBy:    { type: DataTypes.UUID, allowNull: false, field: 'performed_by' },
  performedAt:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'performed_at' },
  content:        { type: DataTypes.TEXT },
  result:         { type: DataTypes.STRING(30) },
  nextActionDate: { type: DataTypes.DATEONLY, field: 'next_action_date' },
  metadata:       { type: DataTypes.JSONB, defaultValue: {} },
}, {
  sequelize,
  modelName: 'collectionAction',
  tableName: 'collection_actions',
  underscored: true,
  updatedAt: false,
});
