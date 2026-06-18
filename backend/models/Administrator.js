
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcrypt';

export class Administrator extends Model {}

Administrator.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  lastLogin: { type: DataTypes.DATE, field: 'last_login' }
}, { 
  sequelize, 
  modelName: 'super_admin',
  tableName: 'super_admins',
  underscored: true,
  timestamps: true,
  updatedAt: false, // Désactive explicitement la colonne manquante en base
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
    }
  }
});

export default Administrator;