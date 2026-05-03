
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const RegistrationIntent = sequelize.define('RegistrationIntent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  stripeSessionId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  registrationData: {
    type: DataTypes.TEXT, // JSON stringified
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'registration_intents',
  underscored: true,
});
