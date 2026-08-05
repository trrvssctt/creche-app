import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Refund extends Model {}

Refund.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  reference:      { type: DataTypes.STRING(30), allowNull: false },
  creditNoteId:   { type: DataTypes.UUID, field: 'credit_note_id' },
  paymentId:      { type: DataTypes.UUID, field: 'payment_id' },
  eleveId:        { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  amount:         { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  method:         { type: DataTypes.STRING(20), allowNull: false },
  reason:         { type: DataTypes.TEXT, allowNull: false },
  status:         { type: DataTypes.STRING(20), defaultValue: 'PENDING' },
  approvedBy:     { type: DataTypes.UUID, field: 'approved_by' },
  executedBy:     { type: DataTypes.UUID, field: 'executed_by' },
  executedAt:     { type: DataTypes.DATE, field: 'executed_at' },
  cashSessionId:  { type: DataTypes.UUID, field: 'cash_session_id' },
}, {
  sequelize,
  modelName: 'refund',
  tableName: 'refunds',
  underscored: true,
});
