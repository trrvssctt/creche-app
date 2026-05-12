import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Bulletin extends Model {}

Bulletin.init({
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:           { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  eleveId:            { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  trimestre:          { type: DataTypes.STRING(10), allowNull: false },
  anneeScolaire:      { type: DataTypes.STRING(10), allowNull: false, field: 'annee_scolaire' },
  niveau:             { type: DataTypes.STRING(10), allowNull: false },
  domaines:           { type: DataTypes.JSONB },
  matieres:           { type: DataTypes.JSONB },
  moyenneGenerale:    { type: DataTypes.FLOAT, field: 'moyenne_generale' },
  appreciationGenerale: { type: DataTypes.TEXT, field: 'appreciation_generale' },
  publie:             { type: DataTypes.BOOLEAN, defaultValue: false },
  datePublication:    { type: DataTypes.DATEONLY, field: 'date_publication' },
}, {
  sequelize,
  modelName: 'bulletin',
  tableName: 'bulletins',
  underscored: true,
});
