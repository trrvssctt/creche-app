import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class TrainingParticipant extends Model {}

TrainingParticipant.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  trainingId: { type: DataTypes.UUID, allowNull: false, field: 'training_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  status: { 
    type: DataTypes.ENUM('ENROLLED', 'COMPLETED', 'DROPPED', 'ABSENT'), 
    defaultValue: 'ENROLLED' 
  },
  completionDate: { type: DataTypes.DATE, field: 'completion_date' },
  grade: { type: DataTypes.STRING(10) },
  certificateUrl: { type: DataTypes.TEXT, field: 'certificate_url' },
  feedback: { type: DataTypes.TEXT }
}, {
  sequelize,
  modelName: 'trainingParticipant',
  tableName: 'training_participants',
  underscored: true
});

export default TrainingParticipant;