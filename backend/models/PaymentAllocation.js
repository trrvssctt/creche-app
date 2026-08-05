import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PaymentAllocation extends Model {}

PaymentAllocation.init({
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:   { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  paymentId:  { type: DataTypes.UUID, allowNull: false, field: 'payment_id' },
  echeanceId: { type: DataTypes.UUID, allowNull: false, field: 'echeance_id' },
  amount:     { type: DataTypes.NUMERIC(15, 2), allowNull: false },
}, {
  sequelize,
  modelName: 'paymentAllocation',
  tableName: 'payment_allocations',
  underscored: true,
  updatedAt: false,
});
