import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class AcademicYear extends Model {}

AcademicYear.init({
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:  { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  label:     { type: DataTypes.STRING(20), allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
  endDate:   { type: DataTypes.DATEONLY, allowNull: false, field: 'end_date' },
  status:    { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PREPARATION' },
  graceDays: { type: DataTypes.INTEGER, defaultValue: 5, field: 'grace_days' },
}, {
  sequelize,
  modelName: 'academicYear',
  tableName: 'academic_years',
  underscored: true,
});
