import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PlanningException extends Model {}

PlanningException.init({
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:           { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  creneauId:          { type: DataTypes.UUID, allowNull: false, field: 'creneau_id' },
  dateException:      { type: DataTypes.DATEONLY, allowNull: false, field: 'date_exception' },
  typeException:      { type: DataTypes.ENUM('ANNULE', 'MODIFIE'), defaultValue: 'ANNULE', field: 'type_exception' },
  matiereOverride:    { type: DataTypes.STRING(100), field: 'matiere_override' },
  heureDebutOverride: { type: DataTypes.STRING(5), field: 'heure_debut_override' },
  heureFinOverride:   { type: DataTypes.STRING(5), field: 'heure_fin_override' },
  note:               { type: DataTypes.STRING(255) },
}, {
  sequelize,
  modelName: 'planning_exception',
  tableName: 'planning_exceptions',
  underscored: true,
  updatedAt: false,
});
