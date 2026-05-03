import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Sale extends Model {}

Sale.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  customerId: { type: DataTypes.UUID, allowNull: true, field: 'customer_id' },
  reference: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  walkinName: { type: DataTypes.STRING(150), allowNull: true, field: 'walkin_name' },
  walkinPhone: { type: DataTypes.STRING(50), allowNull: true, field: 'walkin_phone' },
  status: {
    type: DataTypes.ENUM('EN_COURS', 'TERMINE', 'ANNULE', 'REMBOURSE', 'BROUILLON'),
    defaultValue: 'EN_COURS'
  },
  totalHt: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'total_ht' },
  totalTtc: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'total_ttc' },
  taxAmount: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'tax_amount' },
  amountPaid: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'amount_paid' },
  saleDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'sale_date' }
}, { 
  sequelize, 
  modelName: 'sale',
  tableName: 'sales',
  underscored: true 
});
