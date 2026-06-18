import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Contract extends Model {}

Contract.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  type: {
    type: DataTypes.ENUM('CDI', 'CDD', 'STAGE', 'FREELANCE'),
    field: 'contract_type'
  },
  startDate: { type: DataTypes.DATE, field: 'start_date' },
  endDate: { type: DataTypes.DATE, field: 'end_date' },
  salary: { type: DataTypes.DECIMAL },
  workingHours: { type: DataTypes.INTEGER, defaultValue: 40, field: 'working_hours' },
  currency: { type: DataTypes.STRING, defaultValue: 'F CFA' },
  workLocation: { type: DataTypes.STRING, allowNull: true, field: 'work_location' },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'EXPIRED', 'TERMINATED', 'SUSPENDED', 'RENEWED'),
    defaultValue: 'ACTIVE'
  },
  // Termination
  terminationDate: { type: DataTypes.DATE, field: 'termination_date' },
  terminationReason: { type: DataTypes.TEXT, field: 'termination_reason' },
  terminatedBy: { type: DataTypes.UUID, allowNull: true, field: 'terminated_by' },
  terminatedAt: { type: DataTypes.DATE, allowNull: true, field: 'terminated_at' },
  // Suspension
  suspensionDate: { type: DataTypes.DATE, field: 'suspension_date' },
  suspensionReason: { type: DataTypes.TEXT, field: 'suspension_reason' },
  // Trial period
  trialPeriodEnd: { type: DataTypes.DATE, field: 'trial_period_end' },
  // Document
  documentUrl: { type: DataTypes.TEXT, field: 'document_url' },
  signedDate: { type: DataTypes.DATE, field: 'signed_date' },
  // Renewal tracking
  previousContractId: { type: DataTypes.UUID, allowNull: true, field: 'previous_contract_id' },
  isRenewal: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_renewal' },
  renewalReason: { type: DataTypes.TEXT, allowNull: true, field: 'renewal_reason' },
  renewalCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'renewal_count' },
  maxRenewals: { type: DataTypes.INTEGER, allowNull: true, field: 'max_renewals' },
  renewedAt: { type: DataTypes.DATE, allowNull: true, field: 'renewed_at' },
  renewedBy: { type: DataTypes.UUID, allowNull: true, field: 'renewed_by' },
  // Modification tracking
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  lastModificationReason: { type: DataTypes.TEXT, allowNull: true, field: 'last_modification_reason' },
  // Backward compatibility alias
  contractType: { type: DataTypes.STRING, field: 'contract_type' },
  meta: { type: DataTypes.JSONB, allowNull: true }
}, {
  sequelize,
  modelName: 'contract',
  tableName: 'contracts',
  underscored: true
});

export default Contract;
