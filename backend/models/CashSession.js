import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CashSession extends Model {}

CashSession.init({
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:        { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  openedBy:        { type: DataTypes.UUID, allowNull: false, field: 'opened_by' },
  closedBy:        { type: DataTypes.UUID, field: 'closed_by' },
  openedAt:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'opened_at' },
  closedAt:        { type: DataTypes.DATE, field: 'closed_at' },
  openingBalance:  { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'opening_balance' },
  closingBalance:  { type: DataTypes.NUMERIC(15, 2), field: 'closing_balance' },
  expectedBalance: { type: DataTypes.NUMERIC(15, 2), field: 'expected_balance' },
  difference:      { type: DataTypes.NUMERIC(15, 2) },
  status:          { type: DataTypes.STRING(20), defaultValue: 'OPEN' },
  notes:           { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'cashSession',
  tableName: 'cash_sessions',
  underscored: true,
});
