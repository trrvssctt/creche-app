import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Payroll extends Model {}

Payroll.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  year: { type: DataTypes.INTEGER, field: 'period_year' },
  month: { type: DataTypes.INTEGER, field: 'period_month' },
  baseSalary: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'base_salary' },
  overtime: { type: DataTypes.DECIMAL, defaultValue: 0 },
  bonuses: { type: DataTypes.DECIMAL, defaultValue: 0 },
  deductions: { type: DataTypes.DECIMAL, defaultValue: 0 },
  socialCharges: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'social_charges' },
  taxes: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'tax_amount' },
  netSalary: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'net_salary' },
  status: { 
    type: DataTypes.ENUM('DRAFT', 'VALIDATED', 'PAID'), 
    defaultValue: 'DRAFT' 
  },
  documentUrl: { type: DataTypes.TEXT, field: 'document_url' },
  generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'generated_at' },
  paidAt: { type: DataTypes.DATE, field: 'paid_at' },
  // Backward compatibility
  periodStart: { type: DataTypes.DATE, field: 'period_start' },
  periodEnd: { type: DataTypes.DATE, field: 'period_end' },
  gross: { type: DataTypes.DECIMAL, defaultValue: 0 },
  net: { type: DataTypes.DECIMAL, defaultValue: 0 },
  meta: { type: DataTypes.JSONB, allowNull: true }
}, {
  sequelize,
  modelName: 'payroll',
  tableName: 'payrolls',
  underscored: true
});

export default Payroll;
