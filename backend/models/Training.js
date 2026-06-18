import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Training extends Model {}

Training.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  provider: { type: DataTypes.STRING },
  trainer: { type: DataTypes.STRING },
  durationHours: { type: DataTypes.INTEGER, field: 'duration_hours' },
  startDate: { type: DataTypes.DATE, field: 'start_date' },
  endDate: { type: DataTypes.DATE, field: 'end_date' },
  location: { type: DataTypes.STRING },
  maxParticipants: { type: DataTypes.INTEGER, field: 'max_participants' },
  cost: { type: DataTypes.DECIMAL, defaultValue: 0 },
  currency: { type: DataTypes.STRING, defaultValue: 'F CFA' },
  status: { 
    type: DataTypes.ENUM('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'), 
    defaultValue: 'PLANNED' 
  },
  createdBy: { type: DataTypes.UUID, field: 'created_by' }
}, {
  sequelize,
  modelName: 'training',
  tableName: 'trainings',
  underscored: true
});

export default Training;