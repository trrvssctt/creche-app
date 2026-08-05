import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class TariffPlanSnapshot extends Model {}

TariffPlanSnapshot.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  serviceId:      { type: DataTypes.UUID, allowNull: false, field: 'service_id' },
  academicYearId: { type: DataTypes.UUID, allowNull: false, field: 'academic_year_id' },
  snapshotDate:   { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW, field: 'snapshot_date' },
  name:           { type: DataTypes.STRING(255), allowNull: false },
  typeOffre:      { type: DataTypes.STRING(20), allowNull: false, field: 'type_offre' },
  price:          { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  niveauxCibles:  { type: DataTypes.JSONB, defaultValue: [], field: 'niveaux_cibles' },
  dureeMois:      { type: DataTypes.INTEGER, field: 'duree_mois' },
  estRecurrent:   { type: DataTypes.BOOLEAN, defaultValue: true, field: 'est_recurrent' },
  metadata:       { type: DataTypes.JSONB, defaultValue: {} },
}, {
  sequelize,
  modelName: 'tariffPlanSnapshot',
  tableName: 'tariff_plan_snapshots',
  underscored: true,
  updatedAt: false,
});
