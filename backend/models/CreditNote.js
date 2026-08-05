import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CreditNote extends Model {}

CreditNote.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  reference:     { type: DataTypes.STRING(30), allowNull: false },
  eleveId:       { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  echeanceId:    { type: DataTypes.UUID, field: 'echeance_id' },
  abonnementId:  { type: DataTypes.UUID, field: 'abonnement_id' },
  amount:        { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  reason:        { type: DataTypes.TEXT, allowNull: false },
  type:          { type: DataTypes.STRING(30), defaultValue: 'REMISE' },
  issuedBy:      { type: DataTypes.UUID, allowNull: false, field: 'issued_by' },
  issuedAt:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'issued_at' },
}, {
  sequelize,
  modelName: 'creditNote',
  tableName: 'credit_notes',
  underscored: true,
  updatedAt: false,
});
