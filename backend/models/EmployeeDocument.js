import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class EmployeeDocument extends Model {}

EmployeeDocument.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { 
    type: DataTypes.ENUM('ID_CARD', 'CONTRACT', 'DIPLOMA', 'BANK_DETAILS', 'MEDICAL', 'OTHER'), 
    allowNull: false 
  },
  category: { type: DataTypes.STRING },
  fileUrl: { type: DataTypes.TEXT, allowNull: false, field: 'file_url' },
  fileSize: { type: DataTypes.BIGINT, field: 'file_size' },
  mimeType: { type: DataTypes.STRING, field: 'mime_type' },
  uploadedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'uploaded_at' },
  uploadedBy: { type: DataTypes.UUID, field: 'uploaded_by' }
}, {
  sequelize,
  modelName: 'employeeDocument',
  tableName: 'employee_documents',
  underscored: true
});

export default EmployeeDocument;