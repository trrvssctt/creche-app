
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class InvoiceItem extends Model {}

InvoiceItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }, // FIX: UUID natif
  invoiceId: { type: DataTypes.STRING(50), allowNull: false, field: 'invoice_id' },
  productId: { type: DataTypes.UUID, field: 'product_id' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false, field: 'qty', defaultValue: 1 },
  price: { type: DataTypes.NUMERIC(15,2), allowNull: false, field: 'price' },
  tva: { type: DataTypes.NUMERIC(5,2), allowNull: false, field: 'tva', defaultValue: 0 }
}, {
  sequelize,
  modelName: 'invoice_item',
  tableName: 'invoice_items',
  underscored: true,
  timestamps: false
});
