
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcrypt';

export class User extends Model {}

User.init({
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
    allowNull: false 
  },
  email: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  password: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  roles: { 
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['EMPLOYEE'],
    allowNull: false
  },
  employeeId: { 
    type: DataTypes.UUID, 
    allowNull: true, 
    field: 'employee_id' 
  },
  role: { 
    type: DataTypes.STRING(30),
    defaultValue: 'EMPLOYEE'
  },
  mfaEnabled: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false, 
    field: 'mfa_enabled' 
  },
  lastLogin: { 
    type: DataTypes.DATE, 
    field: 'last_login' 
  },
  activeSession: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false, 
    field: 'active_session' 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true, 
    field: 'is_active' 
  }
}, { 
  sequelize, 
  modelName: 'user',
  tableName: 'users',
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
      if (!user.roles || user.roles.length === 0) {
        user.roles = [user.role || 'EMPLOYEE'];
      }
    }
  }
});
