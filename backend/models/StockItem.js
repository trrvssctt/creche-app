
import { DataTypes, Model, Op } from 'sequelize';
import { sequelize } from '../config/database.js';

export class StockItem extends Model {}

StockItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  sku: { type: DataTypes.STRING(100), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(100) },
  subcategoryId: { type: DataTypes.UUID, field: 'subcategory_id' },
  imageUrl: { type: DataTypes.TEXT, field: 'image_url' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0, field: 'quantity' },
  currentLevel: { type: DataTypes.INTEGER, defaultValue: 0, field: 'current_level' },
  minThreshold: { type: DataTypes.INTEGER, defaultValue: 5, field: 'min_threshold' },
  forecastedLevel: { type: DataTypes.INTEGER, field: 'forecasted_level' },
  // Prix d'achat moyen pondéré (PUMP) — mis à jour à chaque livraison
  purchasePrice: { type: DataTypes.NUMERIC(15, 2), defaultValue: 0, field: 'purchase_price' },
  // Prix de vente unitaire (affiché aux clients)
  unitPrice: { type: DataTypes.NUMERIC(15, 2), allowNull: false, field: 'unit_price', defaultValue: 0 },
  location: { type: DataTypes.STRING(100) },
  status: { 
    type: DataTypes.STRING(20), 
    defaultValue: 'actif',
    allowNull: false 
  },
  deletedAt: { 
    type: DataTypes.DATE, 
    field: 'deleted_at' 
  }
}, { 
  sequelize, 
  modelName: 'stock_item',
  tableName: 'stock_items',
  underscored: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'sku'], where: { status: 'actif' } },
    { unique: false, fields: ['tenant_id', 'name'] }
  ]
});
