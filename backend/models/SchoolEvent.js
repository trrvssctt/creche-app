import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SchoolEvent extends Model {}

SchoolEvent.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  titre:         { type: DataTypes.STRING(255), allowNull: false },
  description:   { type: DataTypes.TEXT },
  typeEvenement: { type: DataTypes.STRING(50), defaultValue: 'INFO', field: 'type_evenement' },
  statut:        { type: DataTypes.STRING(20), defaultValue: 'PUBLIE' },
  dateDebut:     { type: DataTypes.DATEONLY, allowNull: false, field: 'date_debut' },
  dateFin:       { type: DataTypes.DATEONLY, field: 'date_fin' },
  heureDebut:    { type: DataTypes.STRING(10), field: 'heure_debut' },
  heureFin:      { type: DataTypes.STRING(10), field: 'heure_fin' },
  lieu:          { type: DataTypes.STRING(255) },
  niveauxCibles: { type: DataTypes.TEXT, defaultValue: 'TOUS', field: 'niveaux_cibles' },
  diffuse:       { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'school_event',
  tableName: 'school_events',
  underscored: true,
});

export default SchoolEvent;
