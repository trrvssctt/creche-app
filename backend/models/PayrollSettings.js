import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PayrollSettings extends Model {}

PayrollSettings.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false, 
    field: 'tenant_id',
    unique: true 
  },
  employerSocialChargeRate: { 
    type: DataTypes.DECIMAL(5,2), 
    defaultValue: 18.5, 
    field: 'employer_social_charge_rate',
    comment: 'Taux des charges sociales employeur en pourcentage'
  },
  employeeSocialChargeRate: { 
    type: DataTypes.DECIMAL(5,2), 
    defaultValue: 8.2, 
    field: 'employee_social_charge_rate',
    comment: 'Taux des charges sociales salarié en pourcentage'
  },
  taxRate: { 
    type: DataTypes.DECIMAL(5,2), 
    defaultValue: 10.0, 
    field: 'tax_rate',
    comment: 'Taux d\'imposition en pourcentage'
  },
  minimumWage: { 
    type: DataTypes.DECIMAL, 
    defaultValue: 60000, 
    field: 'minimum_wage' 
  },
  currency: { 
    type: DataTypes.STRING, 
    defaultValue: 'F CFA' 
  },
  paymentDay: { 
    type: DataTypes.INTEGER, 
    defaultValue: 28, 
    field: 'payment_day' 
  },
  overtimeRate: {
    type: DataTypes.DECIMAL,
    defaultValue: 1.5,
    field: 'overtime_rate'
  },
  // Gestion des temps — déductions configurables
  deductionEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'deduction_enabled',
    comment: 'Active/désactive les déductions retard/absence sur le salaire'
  },
  workStartTime: {
    type: DataTypes.STRING(5),
    defaultValue: '08:00',
    field: 'work_start_time',
    comment: 'Heure d\'arrivée normale (HH:MM)'
  },
  workEndTime: {
    type: DataTypes.STRING(5),
    defaultValue: '17:00',
    field: 'work_end_time',
    comment: 'Heure de départ normale (HH:MM)'
  },
  workingDaysPerMonth: {
    type: DataTypes.INTEGER,
    defaultValue: 26,
    field: 'working_days_per_month',
    comment: 'Nombre de jours ouvrables par mois (pour calcul taux journalier)'
  }
}, {
  sequelize,
  modelName: 'payrollSettings',
  tableName: 'payroll_settings',
  underscored: true
});

export default PayrollSettings;