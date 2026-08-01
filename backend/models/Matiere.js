import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Matiere = sequelize.define('Matiere', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  classeId: { type: DataTypes.UUID, allowNull: false, field: 'classe_id' },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  enseignantId: { type: DataTypes.UUID, allowNull: true, field: 'enseignant_id' },
  couleur: { type: DataTypes.STRING(20), defaultValue: 'blue' },
  coefficient: { type: DataTypes.DECIMAL(3, 1), defaultValue: 1 },
}, {
  tableName: 'matieres',
  underscored: true,
  timestamps: true,
});
