import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class CreneauHoraire extends Model {}

CreneauHoraire.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  classeId:      { type: DataTypes.UUID, allowNull: false, field: 'classe_id' },
  enseignantId:  { type: DataTypes.UUID, field: 'enseignant_id' },
  jour:          { type: DataTypes.INTEGER, allowNull: false },  // 0=Lun…4=Ven
  heureDebut:    { type: DataTypes.STRING(5), allowNull: false, field: 'heure_debut' },
  heureFin:      { type: DataTypes.STRING(5), allowNull: false, field: 'heure_fin' },
  matiere:         { type: DataTypes.STRING(100), allowNull: false },
  couleur:         { type: DataTypes.STRING(20), defaultValue: 'blue' },
  anneeScolaire:   { type: DataTypes.STRING(10), allowNull: false, field: 'annee_scolaire' },
  dateDebutEffet:  { type: DataTypes.DATEONLY, field: 'date_debut_effet' },
  dateSpecifique:  { type: DataTypes.DATEONLY, field: 'date_specifique' },
}, {
  sequelize,
  modelName: 'creneau_horaire',
  tableName: 'creneaux_horaires',
  underscored: true,
});
