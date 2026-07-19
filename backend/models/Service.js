
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Service extends Model {}

Service.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  imageUrl: { type: DataTypes.TEXT, field: 'image_url' },
  price: { type: DataTypes.NUMERIC(15, 2), allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'actif',
    allowNull: false
  },
  typeOffre: {
    type: DataTypes.STRING(20),
    field: 'type_offre',
    defaultValue: 'MENSUALITE',
  },
  niveauxCibles: {
    type: DataTypes.JSONB,
    field: 'niveaux_cibles',
    defaultValue: [],
  },
  dureeMois: {
    type: DataTypes.INTEGER,
    field: 'duree_mois',
    defaultValue: 10,
  },
  inclutCantine: {
    type: DataTypes.BOOLEAN,
    field: 'inclut_cantine',
    defaultValue: false,
  },
  fraisInscription: {
    type: DataTypes.NUMERIC(15, 2),
    field: 'frais_inscription',
    defaultValue: 0,
  },
  estRecurrent: {
    type: DataTypes.BOOLEAN,
    field: 'est_recurrent',
    defaultValue: true,
  },
  anneeScolaire: {
    type: DataTypes.STRING(20),
    field: 'annee_scolaire',
    allowNull: true,
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  }
}, {
  sequelize,
  modelName: 'service',
  tableName: 'services',
  underscored: true,
  timestamps: true
});

export default Service;