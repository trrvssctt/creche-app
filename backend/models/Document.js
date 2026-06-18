
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Document extends Model {}

Document.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: false },
  mimeType: { type: DataTypes.STRING },
  size: { type: DataTypes.INTEGER },
  path: { type: DataTypes.STRING, allowNull: false },
  
  // Signature pour la GED (Gestion Électronique de Documents)
  sha256: { type: DataTypes.STRING, allowNull: false },
  
  // Relations polymorphiques simplifiées
  linkedEntityType: { type: DataTypes.ENUM('INVOICE', 'PRODUCT', 'CUSTOMER', 'CONTRACT') },
  linkedEntityId: { type: DataTypes.STRING },
  
  uploadedBy: { type: DataTypes.UUID, allowNull: false }
}, { 
  sequelize, 
  modelName: 'document',
  indexes: [{ fields: ['tenantId', 'linkedEntityId'] }]
});
