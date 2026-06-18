import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Attendance extends Model {}

Attendance.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  date: { type: DataTypes.DATEONLY },
  clockIn: { type: DataTypes.DATE, field: 'clock_in' },
  clockOut: { type: DataTypes.DATE, field: 'clock_out' },
  source: { type: DataTypes.STRING, defaultValue: 'manual' },
  status: { type: DataTypes.STRING, defaultValue: 'PRESENT' },
  overtimeMinutes: { type: DataTypes.INTEGER, defaultValue: 0, field: 'overtime_minutes' },
  meta: { type: DataTypes.JSONB, allowNull: true }
}, {
  sequelize,
  modelName: 'attendance',
  tableName: 'attendances',
  underscored: true
});

export default Attendance;
