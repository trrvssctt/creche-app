import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class EleveDocument extends Model {}

EleveDocument.init({
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:      { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  eleveId:       { type: DataTypes.UUID, allowNull: false, field: 'eleve_id' },
  categorie:     { type: DataTypes.STRING(20), allowNull: false }, // 'ADMINISTRATIF' | 'ACADEMIQUE'
  anneeScolaire: { type: DataTypes.STRING(10), field: 'annee_scolaire' },
  typeDoc:       { type: DataTypes.STRING(50), defaultValue: 'AUTRE', field: 'type_doc' },
  nom:           { type: DataTypes.STRING(255), allowNull: false },
  fileUrl:       { type: DataTypes.TEXT, allowNull: false, field: 'file_url' },
  s3Key:         { type: DataTypes.TEXT, field: 's3_key' },
  mimeType:      { type: DataTypes.STRING(100), field: 'mime_type' },
  fileSize:      { type: DataTypes.BIGINT, field: 'file_size' },
  uploadedBy:    { type: DataTypes.UUID, field: 'uploaded_by' },
}, {
  sequelize,
  modelName: 'eleveDocument',
  tableName: 'eleve_documents',
  underscored: true,
});

export default EleveDocument;
