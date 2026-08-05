import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CollectionCase extends Model {}

CollectionCase.init({
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:         { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  reference:        { type: DataTypes.STRING(30), allowNull: false },
  eleveId:          { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  status:           { type: DataTypes.STRING(20), defaultValue: 'OPEN' },
  totalOutstanding: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'total_outstanding' },
  oldestDueDate:    { type: DataTypes.DATEONLY, field: 'oldest_due_date' },
  agingBucket:      { type: DataTypes.STRING(20), field: 'aging_bucket' },
  assignedTo:       { type: DataTypes.UUID, field: 'assigned_to' },
  priority:         { type: DataTypes.STRING(10), defaultValue: 'NORMAL' },
  openedAt:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'opened_at' },
  closedAt:         { type: DataTypes.DATE, field: 'closed_at' },
  closureReason:    { type: DataTypes.TEXT, field: 'closure_reason' },
  notes:            { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'collectionCase',
  tableName: 'collection_cases',
  underscored: true,
});
