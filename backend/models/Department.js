import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Department extends Model {}

Department.init({
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
    type: DataTypes.STRING(255), 
    allowNull: false 
  },
  description: { 
    type: DataTypes.TEXT 
  },
  managerId: { 
    type: DataTypes.UUID, 
    allowNull: true, 
    field: 'manager_id' 
  }
}, {
  sequelize,
  modelName: 'Department',
  tableName: 'departments',
  underscored: true,
  timestamps: true,
  indexes: [
    // Contrainte d'unicité : deux départements ne peuvent pas avoir le même nom dans le même tenant
    { 
      unique: true, 
      fields: ['tenant_id', 'name'],
      name: 'departments_tenant_name_unique'
    },
    {
      fields: ['tenant_id']
    },
    {
      fields: ['manager_id']
    }
  ]
});

export default Department;