import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Eleve extends Model {}

Eleve.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  matricule:      { type: DataTypes.STRING(20) },
  nom:            { type: DataTypes.STRING(100), allowNull: false },
  prenom:         { type: DataTypes.STRING(100), allowNull: false },
  dateNaissance:  { type: DataTypes.DATEONLY, field: 'date_naissance' },
  lieuNaissance:  { type: DataTypes.STRING(150), field: 'lieu_naissance' },
  niveau:         { type: DataTypes.STRING(10), defaultValue: 'PS' },
  classeId:       { type: DataTypes.UUID, field: 'classe_id' },
  regimeFinancier:{ type: DataTypes.STRING(30), defaultValue: 'NORMAL', field: 'regime_financier' },
  remisePct:      { type: DataTypes.INTEGER, defaultValue: 0, field: 'remise_pct' },
  cantine:        { type: DataTypes.BOOLEAN, defaultValue: false },
  transportBus:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'transport_bus' },
  besoinSpecifique: { type: DataTypes.TEXT, field: 'besoin_specifique' },
  statut:         { type: DataTypes.STRING(20), defaultValue: 'EN_ATTENTE' },
  dateAdmission:  { type: DataTypes.DATEONLY, field: 'date_admission' },
  dateRadiation:  { type: DataTypes.DATEONLY, field: 'date_radiation' },
  parent1:        { type: DataTypes.JSONB },
  parent2:        { type: DataTypes.JSONB },
  contactUrgence: { type: DataTypes.JSONB, field: 'contact_urgence' },
  whatsappPrincipal: { type: DataTypes.STRING(50), field: 'whatsapp_principal' },
  anneeScolaire:  { type: DataTypes.STRING(10), field: 'annee_scolaire' },
  photoUrl:       { type: DataTypes.STRING(500), field: 'photo_url' },
  notes:          { type: DataTypes.TEXT },
  sexe:           { type: DataTypes.CHAR(1) },
  ficheSanitaire: { type: DataTypes.JSONB, field: 'fiche_sanitaire' },
}, {
  sequelize,
  modelName: 'eleve',
  tableName: 'eleves',
  underscored: true,
});
