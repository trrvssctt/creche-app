import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class AbonnementEleve extends Model {}

AbonnementEleve.init({
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:     { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  eleveId:      { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  serviceId:    { type: DataTypes.UUID, allowNull: false, field: 'service_id' },
  periodicite:  { type: DataTypes.STRING(20), allowNull: false },  // MENSUEL, HEBDOMADAIRE, etc.
  montant:      { type: DataTypes.NUMERIC(15, 2), allowNull: false },
  dateDebut:    { type: DataTypes.DATEONLY, allowNull: false, field: 'date_debut' },
  dateFin:      { type: DataTypes.DATEONLY, field: 'date_fin' },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  jourEcheance: { type: DataTypes.INTEGER, allowNull: true, field: 'jour_echeance' }, // jour du mois (1-28) pour les récurrents
}, {
  sequelize,
  modelName: 'abonnement_eleve',
  tableName: 'abonnements_eleves',
  underscored: true,
});
