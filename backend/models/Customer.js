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
  sexe:             { type: DataTypes.STRING(1) },
  parent1Lien:      { type: DataTypes.STRING(20),  field: 'parent1_lien' },
  parent1Whatsapp:  { type: DataTypes.STRING(50),  field: 'parent1_whatsapp' },
  parent1TelDomicile: { type: DataTypes.STRING(50), field: 'parent1_tel_domicile' },
  parent1TelTravail:  { type: DataTypes.STRING(50), field: 'parent1_tel_travail' },
  parent1Adresse:     { type: DataTypes.TEXT,        field: 'parent1_adresse' },
  parent2Nom:       { type: DataTypes.STRING,      field: 'parent2_nom' },
  parent2Prenom:    { type: DataTypes.STRING,      field: 'parent2_prenom' },
  parent2Lien:      { type: DataTypes.STRING(20),  field: 'parent2_lien' },
  parent2Tel:       { type: DataTypes.STRING(50),  field: 'parent2_tel' },
  parent2TelDomicile: { type: DataTypes.STRING(50), field: 'parent2_tel_domicile' },
  parent2TelTravail:  { type: DataTypes.STRING(50), field: 'parent2_tel_travail' },
  urgenceNom:       { type: DataTypes.STRING,      field: 'urgence_nom' },
  urgenceTel:       { type: DataTypes.STRING(50),  field: 'urgence_tel' },
  urgenceLien:      { type: DataTypes.STRING(100), field: 'urgence_lien' },
  dateDepot:        { type: DataTypes.DATEONLY,    field: 'date_depot' },
  anneeScolaire:    { type: DataTypes.STRING(10),  field: 'annee_scolaire' },
  notes:            { type: DataTypes.TEXT },
  // ── Fiche sanitaire ───────────────────────────────────────────────────────
  vaccDiphterie:       { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_diphterie' },
  vaccDiphterieDate:   { type: DataTypes.DATEONLY, field: 'vacc_diphterie_date' },
  vaccTetanos:         { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_tetanos' },
  vaccTetanosDate:     { type: DataTypes.DATEONLY, field: 'vacc_tetanos_date' },
  vaccPolio:           { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_polio' },
  vaccPolioDate:       { type: DataTypes.DATEONLY, field: 'vacc_polio_date' },
  vaccCoqueluche:      { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_coqueluche' },
  vaccCoquelucheDate:  { type: DataTypes.DATEONLY, field: 'vacc_coqueluche_date' },
  vaccBCG:             { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_bcg' },
  vaccBCGDate:         { type: DataTypes.DATEONLY, field: 'vacc_bcg_date' },
  vaccHepB:            { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_hep_b' },
  vaccHepBDate:        { type: DataTypes.DATEONLY, field: 'vacc_hep_b_date' },
  vaccROR:             { type: DataTypes.BOOLEAN, defaultValue: false, field: 'vacc_ror' },
  vaccRORDate:         { type: DataTypes.DATEONLY, field: 'vacc_ror_date' },
  certifContrIndication:  { type: DataTypes.BOOLEAN, defaultValue: false, field: 'certif_contr_indication' },
  traitementMedical:      { type: DataTypes.BOOLEAN, defaultValue: false, field: 'traitement_medical' },
  traitementDetail:       { type: DataTypes.TEXT,    field: 'traitement_detail' },
  maladieRubeole:      { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_rubeole' },
  maladieVaricelle:    { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_varicelle' },
  maladieAngine:       { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_angine' },
  maladieRhumatisme:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_rhumatisme' },
  maladieScarlatine:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_scarlatine' },
  maladieCoqueluche:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_coqueluche' },
  maladieOtite:        { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_otite' },
  maladieRougeole:     { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_rougeole' },
  maladieOreillons:    { type: DataTypes.BOOLEAN, defaultValue: false, field: 'maladie_oreillons' },
  allergieAsthme:      { type: DataTypes.BOOLEAN, defaultValue: false, field: 'allergie_asthme' },
  allergieMedicament:  { type: DataTypes.BOOLEAN, defaultValue: false, field: 'allergie_medicament' },
  allergieAlimentaire: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'allergie_alimentaire' },
  allergieAutres:      { type: DataTypes.TEXT,    field: 'allergie_autres' },
  allergieConduite:    { type: DataTypes.TEXT,    field: 'allergie_conduite' },
  difficulteSante:     { type: DataTypes.TEXT,    field: 'difficulte_sante' },
  equipeLunettes:         { type: DataTypes.BOOLEAN, defaultValue: false, field: 'equipe_lunettes' },
  equipeLentilles:        { type: DataTypes.BOOLEAN, defaultValue: false, field: 'equipe_lentilles' },
  equipeProtheseAuditive: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'equipe_prothese_auditive' },
  equipeProtheseDentaire: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'equipe_prothese_dentaire' },
  equipePrecisions:       { type: DataTypes.TEXT,    field: 'equipe_precisions' },
  mouillerLit:         { type: DataTypes.STRING(20), field: 'mouiller_lit' },
  medecinNom:          { type: DataTypes.STRING,     field: 'medecin_nom' },
  medecinTel:          { type: DataTypes.STRING(50), field: 'medecin_tel' },
  autorisationPhoto:   { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'autorisation_photo' },
  autorisationSoins:   { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'autorisation_soins' },
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