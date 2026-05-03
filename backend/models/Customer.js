import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Customer extends Model {}

Customer.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  companyName: { type: DataTypes.STRING, allowNull: true, field: 'company_name' },
  mainContact: { type: DataTypes.STRING, field: 'main_contact' },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: false },
  billingAddress: { type: DataTypes.TEXT, field: 'billing_address' },
  siret: { type: DataTypes.STRING },
  tvaIntra: { type: DataTypes.STRING, field: 'tva_intra' },
  
  // Paramètres financiers
  outstandingBalance: { type: DataTypes.FLOAT, defaultValue: 0, field: 'outstanding_balance' },
  maxCreditLimit: { type: DataTypes.FLOAT, defaultValue: 5000, field: 'max_credit_limit' },
  paymentTerms: { type: DataTypes.INTEGER, defaultValue: 30, field: 'payment_terms' },
  
  // Statuts
  healthStatus: {
    type: DataTypes.ENUM('GOOD', 'WARNING', 'CRITICAL'),
    defaultValue: 'GOOD',
    field: 'health_status'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'actif',
    allowNull: false
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },

  // ── Champs spécifiques crèche ─────────────────────────────────────────────
  statut:           { type: DataTypes.STRING(20),  defaultValue: 'EN_ATTENTE' },
  niveau:           { type: DataTypes.STRING(10) },
  dateNaissance:    { type: DataTypes.DATEONLY,    field: 'date_naissance' },
  lieuNaissance:    { type: DataTypes.STRING,      field: 'lieu_naissance' },
  regimeFinancier:  { type: DataTypes.STRING(30),  defaultValue: 'NORMAL', field: 'regime_financier' },
  remisePct:        { type: DataTypes.INTEGER,     defaultValue: 0, field: 'remise_pct' },
  cantine:          { type: DataTypes.BOOLEAN,     defaultValue: false },
  transportBus:     { type: DataTypes.BOOLEAN,     defaultValue: false, field: 'transport_bus' },
  besoinSpecifique: { type: DataTypes.TEXT,        field: 'besoin_specifique' },
  parent1Lien:      { type: DataTypes.STRING(20),  field: 'parent1_lien' },
  parent1Whatsapp:  { type: DataTypes.STRING(50),  field: 'parent1_whatsapp' },
  urgenceNom:       { type: DataTypes.STRING,      field: 'urgence_nom' },
  urgenceTel:       { type: DataTypes.STRING(50),  field: 'urgence_tel' },
  urgenceLien:      { type: DataTypes.STRING(100), field: 'urgence_lien' },
  dateDepot:        { type: DataTypes.DATEONLY,    field: 'date_depot' },
  anneeScolaire:    { type: DataTypes.STRING(10),  field: 'annee_scolaire' },
  notes:            { type: DataTypes.TEXT },
}, { 
  sequelize, 
  modelName: 'customer',
  tableName: 'customers',
  underscored: true,
  hooks: {
    beforeCreate: (customer) => {
      if ((customer.companyName === null || customer.companyName === undefined || String(customer.companyName).trim() === '') && customer.mainContact) {
        customer.companyName = customer.mainContact;
      }
    },
    beforeUpdate: (customer) => {
      if ((customer.companyName === null || customer.companyName === undefined || String(customer.companyName).trim() === '') && customer.mainContact) {
        customer.companyName = customer.mainContact;
      }
    }
  },
  indexes: [
    { unique: true, fields: ['tenant_id', 'company_name'], where: { status: 'actif' } }
  ]
});

export default Customer;