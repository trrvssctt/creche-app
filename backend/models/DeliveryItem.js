import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class DeliveryItem extends Model {}

DeliveryItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  deliveryId: { type: DataTypes.UUID, allowNull: false, field: 'delivery_id' },
  stockItemId: { type: DataTypes.UUID, allowNull: false, field: 'stock_item_id' },
  // Quantité reçue dans cette livraison
  quantityReceived: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quantity_received' },
  // Prix d'achat unitaire pour cette livraison (peut varier d'une livraison à l'autre)
  purchasePrice: { type: DataTypes.NUMERIC(15, 2), allowNull: false, defaultValue: 0, field: 'purchase_price' },
  // Total ligne = quantityReceived * purchasePrice
  totalHt: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'total_ht' }
}, {
  sequelize,
  modelName: 'delivery_item',
  tableName: 'delivery_items',
  underscored: true
});

export default DeliveryItem;
