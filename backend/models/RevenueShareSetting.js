import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Paramètres de la redevance contractuelle prélevée sur le chiffre d'affaires
 * de l'établissement. Taux borné contractuellement entre 0,50 % et 1,00 %.
 */
export class RevenueShareSetting extends Model {}

RevenueShareSetting.init({
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:             { type: DataTypes.UUID, allowNull: false, unique: true, field: 'tenant_id' },
  commissionRate:       { type: DataTypes.DECIMAL(6, 5), allowNull: false, defaultValue: 0.005, field: 'commission_rate' },
  minRate:              { type: DataTypes.DECIMAL(6, 5), allowNull: false, defaultValue: 0.005, field: 'min_rate' },
  maxRate:              { type: DataTypes.DECIMAL(6, 5), allowNull: false, defaultValue: 0.01,  field: 'max_rate' },
  calculationBasis:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CA_COMPTABLE', field: 'calculation_basis' },
  includeOtherRevenues: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'include_other_revenues' },
  contractReference:    { type: DataTypes.STRING(100), field: 'contract_reference' },
  effectiveFrom:        { type: DataTypes.DATEONLY, field: 'effective_from' },
  isActive:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  notes:                { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'revenueShareSetting',
  tableName: 'revenue_share_settings',
  underscored: true,
});

export default RevenueShareSetting;
