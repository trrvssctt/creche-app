import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Leave extends Model {}

// APRÈS — propre, sans redondance
Leave.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  employeeId: { type: DataTypes.UUID, allowNull: false },
  type: { 
    type: DataTypes.ENUM('PAID', 'SICK', 'MATERNITY', 'UNPAID', 'ANNUAL'), 
    allowNull: false 
  },
  startDate: { type: DataTypes.DATE, allowNull: false },
  endDate: { type: DataTypes.DATE, allowNull: false },
  daysCount: { type: DataTypes.INTEGER, allowNull: false },
  status: { 
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), 
    defaultValue: 'PENDING' 
  },
  reason: { type: DataTypes.TEXT },
  approvedBy: { type: DataTypes.UUID },
  approvedAt: { type: DataTypes.DATE },
  rejectionReason: { type: DataTypes.TEXT },
  documentUrl: { type: DataTypes.STRING },
  documentName: { type: DataTypes.STRING },
}, {
  sequelize,
  modelName: 'leave',
  tableName: 'leaves',
  underscored: true
});

export default Leave;