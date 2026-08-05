import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CivilPeriod extends Model {}

CivilPeriod.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  academicYearId: { type: DataTypes.UUID, allowNull: false, field: 'academic_year_id' },
  civilYear:      { type: DataTypes.INTEGER, allowNull: false, field: 'civil_year' },
  month:          { type: DataTypes.INTEGER, allowNull: false },
  label:          { type: DataTypes.STRING(30), allowNull: false },
  startDate:      { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
  endDate:        { type: DataTypes.DATEONLY, allowNull: false, field: 'end_date' },
  isActive:       { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  sequelize,
  modelName: 'civilPeriod',
  tableName: 'civil_periods',
  underscored: true,
  updatedAt: false,
});
