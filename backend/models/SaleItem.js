
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SaleItem extends Model {}

SaleItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  saleId: { type: DataTypes.UUID, allowNull: false, field: 'sale_id' },
  stockItemId: { type: DataTypes.UUID, allowNull: true, field: 'stock_item_id' },
  serviceId: { type: DataTypes.UUID, allowNull: true, field: 'service_id' },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  quantityDelivered: { type: DataTypes.INTEGER, defaultValue: 0, field: 'quantity_delivered' },
  unitPrice: { type: DataTypes.NUMERIC(15, 2), allowNull: false, field: 'unit_price' },
  taxRate: { type: DataTypes.NUMERIC(5, 2), defaultValue: 18.00, field: 'tax_rate' },
  totalTtc: { type: DataTypes.NUMERIC(15, 2), allowNull: false, field: 'total_ttc' }
}, { 
  sequelize, 
  modelName: 'sale_item',
  tableName: 'sale_items',
  underscored: true,
  timestamps: false
});
