
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Invoice extends Model {}

Invoice.init({
  id: { type: DataTypes.STRING(50), primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  saleId: { type: DataTypes.UUID, allowNull: true, field: 'sale_id' }, // Lien direct pour modification/annulation
  customerId: { type: DataTypes.UUID, allowNull: true, field: 'customer_id' },
  invoiceDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'invoice_date' },
  dueDate: { type: DataTypes.DATE, field: 'due_date' },
  amount: { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  taxAmount: { type: DataTypes.NUMERIC(15, 2), allowNull: false, field: 'tax_amount' },
  currency: { type: DataTypes.STRING(10), defaultValue: 'F CFA' },
  status: { type: DataTypes.STRING(20), defaultValue: 'DRAFT' },
  type: { type: DataTypes.STRING(20), defaultValue: 'FACTUR-X' },
  transmissionStatus: { type: DataTypes.STRING(20), defaultValue: 'PENDING', field: 'transmission_status' },
  sha256Signature: { type: DataTypes.TEXT, field: 'sha256_signature' }
}, { 
  sequelize, 
  modelName: 'invoice',
  tableName: 'invoices',
  underscored: true 
});
