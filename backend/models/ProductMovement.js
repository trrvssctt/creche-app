
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class ProductMovement extends Model {}

ProductMovement.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false, 
    field: 'tenant_id' 
  },
  stockItemId: { 
    type: DataTypes.UUID, 
    allowNull: false, 
    field: 'stock_item_id' 
  },
  type: { 
    type: DataTypes.STRING(20), 
    allowNull: false 
  }, 
  qty: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  previousLevel: { 
    type: DataTypes.INTEGER, 
    field: 'previous_level' 
  },
  newLevel: { 
    type: DataTypes.INTEGER, 
    field: 'new_level' 
  },
  reason: { 
    type: DataTypes.STRING(255), 
    allowNull: false 
  },
  referenceId: { 
    type: DataTypes.STRING(100), 
    field: 'ref' 
  },
  userRef: { 
    type: DataTypes.STRING(255), 
    field: 'user' 
  },
  movementDate: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW, 
    field: 'movement_date' 
  }
}, { 
  sequelize, 
  modelName: 'product_movement',
  tableName: 'product_movements',
  underscored: true,
  //movement_date: 'movement_date',
  updatedAt: false 
});

export default ProductMovement;
