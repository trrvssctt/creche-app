import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Classe extends Model {}

Classe.init({
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:       { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  nom:            { type: DataTypes.STRING(100), allowNull: false },
  niveau:         { type: DataTypes.STRING(20), allowNull: false }, // PS, MS, GS, CP, CE1, etc.
  enseignantId:   { type: DataTypes.UUID, field: 'enseignant_id' },
  capaciteMax:    { type: DataTypes.INTEGER, defaultValue: 30, field: 'capacite_max' },
  anneeScolaire:  { type: DataTypes.STRING(10), allowNull: false, field: 'annee_scolaire' },
  description:    { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'classe',
  tableName: 'classes',
  underscored: true,
});
