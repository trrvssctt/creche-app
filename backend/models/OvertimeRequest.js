import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class OvertimeRequest extends Model {}

OvertimeRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  requestedDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'requested_date' },
  startTime: { type: DataTypes.STRING(5), field: 'start_time' },   // HH:MM (heure début heures supp)
  endTime: { type: DataTypes.STRING(5), field: 'end_time' },       // HH:MM (heure fin heures supp)
  requestedMinutes: { type: DataTypes.INTEGER, defaultValue: 0, field: 'requested_minutes' },
  reason: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'),
    defaultValue: 'PENDING'
  },
  reviewedBy: { type: DataTypes.UUID, allowNull: true, field: 'reviewed_by' },
  reviewNote: { type: DataTypes.TEXT, allowNull: true, field: 'review_note' },
  actualMinutes: { type: DataTypes.INTEGER, defaultValue: 0, field: 'actual_minutes' },
  meta: { type: DataTypes.JSONB, allowNull: true }
}, {
  sequelize,
  modelName: 'overtimeRequest',
  tableName: 'overtime_requests',
  underscored: true
});

export default OvertimeRequest;
