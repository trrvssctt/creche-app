import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Supplier extends Model {}

Supplier.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  companyName: { type: DataTypes.STRING, allowNull: false, field: 'company_name' },
  mainContact: { type: DataTypes.STRING, field: 'main_contact' },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.TEXT },
  siret: { type: DataTypes.STRING },
  tvaIntra: { type: DataTypes.STRING, field: 'tva_intra' },
  website: { type: DataTypes.STRING },
  // Paramètres financiers
  paymentTerms: { type: DataTypes.INTEGER, defaultValue: 30, field: 'payment_terms' },
  // Statuts
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'actif',
    allowNull: false
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  sequelize,
  modelName: 'supplier',
  tableName: 'suppliers',
  underscored: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'company_name'], where: { status: 'actif' } }
  ]
});

export default Supplier;
