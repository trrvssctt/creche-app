import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Delivery extends Model {}

Delivery.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  // Référence unique de livraison (ex: LIV-20240315-0001)
  reference: { type: DataTypes.STRING(100), allowNull: false },
  supplierId: { type: DataTypes.UUID, allowNull: false, field: 'supplier_id' },
  deliveryDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'delivery_date' },
  // Montant total HT de la livraison
  totalHt: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'total_ht' },
  // Statut de la livraison
  status: {
    type: DataTypes.ENUM('PENDING', 'RECEIVED', 'PARTIAL', 'CANCELLED'),
    defaultValue: 'PENDING',
    allowNull: false
  },
  notes: { type: DataTypes.TEXT },
  // Référence du bon de commande fournisseur (facultatif)
  purchaseOrderRef: { type: DataTypes.STRING(100), field: 'purchase_order_ref' },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  }
}, {
  sequelize,
  modelName: 'delivery',
  tableName: 'deliveries',
  underscored: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'reference'] }
  ]
});

export default Delivery;
