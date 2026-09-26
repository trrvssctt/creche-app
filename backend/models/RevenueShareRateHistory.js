import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Journal des modifications du taux de redevance (traçabilité contractuelle).
 */
export class RevenueShareRateHistory extends Model {}

RevenueShareRateHistory.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  previousRate:  { type: DataTypes.DECIMAL(6, 5), field: 'previous_rate' },
  newRate:       { type: DataTypes.DECIMAL(6, 5), allowNull: false, field: 'new_rate' },
  previousBasis: { type: DataTypes.STRING(20), field: 'previous_basis' },
  newBasis:      { type: DataTypes.STRING(20), field: 'new_basis' },
  changedBy:     { type: DataTypes.UUID, field: 'changed_by' },
  changedByName: { type: DataTypes.STRING(255), field: 'changed_by_name' },
  reason:        { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'revenueShareRateHistory',
  tableName: 'revenue_share_rate_history',
  underscored: true,
  updatedAt: false,
});

export default RevenueShareRateHistory;
