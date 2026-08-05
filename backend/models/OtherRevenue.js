import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class OtherRevenue extends Model {}

OtherRevenue.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  reference:     { type: DataTypes.STRING(30), allowNull: false },
  eleveId:       { type: DataTypes.UUID, field: 'eleve_id' },
  category:      { type: DataTypes.STRING(50), allowNull: false },
  description:   { type: DataTypes.TEXT },
  amount:        { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  paymentId:     { type: DataTypes.UUID, field: 'payment_id' },
  civilPeriodId: { type: DataTypes.UUID, field: 'civil_period_id' },
  revenueDate:   { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW, field: 'revenue_date' },
  cashSessionId: { type: DataTypes.UUID, field: 'cash_session_id' },
}, {
  sequelize,
  modelName: 'otherRevenue',
  tableName: 'other_revenues',
  underscored: true,
  updatedAt: false,
});
