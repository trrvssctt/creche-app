import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PlanningConfig extends Model {}

PlanningConfig.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  anneeScolaire: { type: DataTypes.STRING(10), allowNull: false, field: 'annee_scolaire' },
  dateDebut:     { type: DataTypes.DATEONLY, allowNull: false, field: 'date_debut' },
  dateFin:       { type: DataTypes.DATEONLY, allowNull: false, field: 'date_fin' },
  joursRepos:    { type: DataTypes.JSONB, defaultValue: [], field: 'jours_repos' },
}, {
  sequelize,
  modelName: 'planning_config',
  tableName: 'planning_config',
  underscored: true,
});
