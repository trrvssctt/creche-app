import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Presence extends Model {}

Presence.init({
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:     { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  classeId:     { type: DataTypes.UUID, allowNull: false, field: 'classe_id' },
  eleveId:      { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  enseignantId: { type: DataTypes.UUID, field: 'enseignant_id' },
  date:         { type: DataTypes.DATEONLY, allowNull: false },
  statut:       { type: DataTypes.ENUM('PRESENT', 'ABSENT', 'RETARD'), allowNull: false, defaultValue: 'PRESENT' },
  motif:        { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'presence',
  tableName: 'presences',
  underscored: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'classe_id', 'eleve_id', 'date'] }
  ],
});
