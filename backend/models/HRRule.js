import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class HRRule extends Model {}

HRRule.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },

  // Déclencheur : LATE (retard), ABSENCE (absence injustifiée), OVERTIME (heures sup), UNPAID_LEAVE (congé non payé)
  type: {
    type: DataTypes.ENUM('LATE', 'ABSENCE', 'OVERTIME', 'UNPAID_LEAVE'),
    allowNull: false
  },

  // Condition : si [retard en minutes] > [conditionValue]
  conditionOperator: {
    type: DataTypes.ENUM('GT', 'GTE', 'LT', 'LTE', 'EQ'),
    defaultValue: 'GT',
    field: 'condition_operator'
  },
  conditionValue: {
    type: DataTypes.NUMERIC(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'condition_value'
  },
  conditionUnit: {
    type: DataTypes.ENUM('MINUTES', 'HOURS', 'DAYS'),
    defaultValue: 'MINUTES',
    field: 'condition_unit'
  },

  // Déductions : DEDUCT_FIXED (montant fixe), DEDUCT_SALARY_HOURS (N heures de salaire),
  //              DEDUCT_SALARY_DAYS (N jours de salaire), DEDUCT_PERCENT (% du salaire de base)
  // Gains (heures sup) : ADD_FIXED (montant fixe), ADD_SALARY_HOURS (N × taux horaire),
  //                      ADD_PERCENT (% du salaire de base)
  actionType: {
    type: DataTypes.ENUM(
      'DEDUCT_FIXED', 'DEDUCT_SALARY_HOURS', 'DEDUCT_SALARY_DAYS', 'DEDUCT_PERCENT',
      'ADD_FIXED',    'ADD_SALARY_HOURS',    'ADD_PERCENT'
    ),
    allowNull: false,
    field: 'action_type'
  },
  actionValue: {
    type: DataTypes.NUMERIC(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'action_value'
  },

  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' }
}, {
  sequelize,
  modelName: 'hr_rule',
  tableName: 'hr_rules',
  underscored: true
});
