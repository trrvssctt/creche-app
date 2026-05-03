import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PayrollItem extends Model {}

PayrollItem.init({
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
  name: { 
    type: DataTypes.STRING, 
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  code: { 
    type: DataTypes.STRING(50), 
    allowNull: false, 
    unique: true,
    validate: {
      notEmpty: true,
      is: /^[A-Z0-9_]+$/i  // Permet lettres, chiffres et underscores
    }
  },
  type: { 
    type: DataTypes.ENUM('EARNING', 'DEDUCTION'), 
    allowNull: false,
    defaultValue: 'EARNING'
  },
  category: { 
    type: DataTypes.ENUM(
      'BASE_SALARY',     // Salaire de base
      'ALLOWANCE',       // Indemnité/Prime
      'BONUS',          // Prime exceptionnelle 
      'OVERTIME',       // Heures supplémentaires
      'SOCIAL_CHARGE',  // Charges sociales
      'TAX',            // Impôts
      'ADVANCE',        // Avance
      'OTHER'           // Autre
    ), 
    allowNull: false 
  },
  calculationType: {
    type: DataTypes.ENUM('FIXED', 'PERCENTAGE', 'FORMULA'),
    allowNull: false,
    defaultValue: 'FIXED',
    field: 'calculation_type'
  },
  defaultValue: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0,
    field: 'default_value'
  },
  percentage: { 
    type: DataTypes.DECIMAL(5,2), 
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  formula: { 
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Formule de calcul en JavaScript pour les cas complexes'
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true,
    field: 'is_active' 
  },
  isSystemItem: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false,
    field: 'is_system_item',
    comment: 'Les éléments système ne peuvent pas être supprimés'
  },
  description: { 
    type: DataTypes.TEXT,
    allowNull: true 
  },
  sortOrder: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0,
    field: 'sort_order'
  }
}, {
  sequelize,
  modelName: 'payrollItem',
  tableName: 'payroll_items',
  underscored: true,
  timestamps: true,
  indexes: [
    {
      fields: ['tenant_id']
    },
    {
      fields: ['tenant_id', 'type']
    },
    {
      fields: ['tenant_id', 'category']
    },
    {
      fields: ['tenant_id', 'is_active']
    },
    {
      unique: true,
      fields: ['tenant_id', 'code']
    }
  ]
});

export default PayrollItem;