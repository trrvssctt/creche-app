
export enum UserRole {
  ADMIN      = 'ADMIN',       // directeur / admin système (accès total)
  DIRECTEUR  = 'DIRECTEUR',   // alias métier de ADMIN
  ENSEIGNANT = 'ENSEIGNANT',
  MAITRESSE  = 'MAITRESSE',
  COMPTABLE  = 'COMPTABLE',
  ASSISTANTE = 'ASSISTANTE',
  HR_MANAGER = 'HR_MANAGER',  // conservé pour le module RH backend
  EMPLOYEE   = 'EMPLOYEE',    // personnel non-enseignant générique
  INFIRMIERE = 'INFIRMIERE',  // infirmière / agent de santé
  CHAUFFEUR  = 'CHAUFFEUR',   // chauffeur / transport scolaire
  PARENT  = 'PARENT',    // parent ou tuteur légal d'un élève
  TUTEUR  = 'TUTEUR',    // alias de PARENT
  // Aliases de compatibilité (anciens rôles ERP SaaS)
  SUPER_ADMIN   = 'ADMIN',
  ACCOUNTANT    = 'COMPTABLE',
  STOCK_MANAGER = 'EMPLOYEE',
  SALES         = 'ASSISTANTE',
}

export type Currency = 'F CFA' | '€' | '$';
export type Language = 'Français' | 'English';

export interface AppSettings {
  language: Language;
  currency: string;
  platformLogo: string;
  invoiceLogo: string;
  companyName: string;
  siret?: string;
  address?: string;
  phone?: string;
  email?: string;
  whatsappBusiness?: string;
  // Paramètres pénalités
  penaliteRetardPaiement?: number;  // FCFA/jour
  penaliteRetardGarde?: number;     // FCFA/heure
  // Année scolaire
  anneeScolaireDebut?: string;
  anneeScolaireFin?: string;
  nbMoisAnnee?: number;
  // Trimestres
  dateFinT1?: string;
  dateFinT2?: string;
  dateFinT3?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  email: string;
  mfaEnabled: boolean;
  lastLogin: string;
  activeSession: boolean;
  isActive: boolean;
  tenantId: string;
  token?: string;
  employeeId?: string;
}

// ─── ABONNEMENTS & PAIEMENTS ─────────────────────────────────────────────────

export type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'MTN_MOMO' | 'STRIPE';
export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceThreeMonths?: number;
  priceYearly?: number;
  price?: number;
  trialDays?: number;
  maxUsers?: number;
  hasAiChatbot?: boolean;
  hasStockForecast?: boolean;
  isActive?: boolean;
  level?: number;
  features?: string[];
  isPopular?: boolean;
  planId?: string;
}

export interface Subscription {
  planId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'EXPIRED';
  nextBillingDate: string;
  paymentHistory: Array<{
    id: string;
    date: string;
    amount: number;
    method: PaymentMethod;
    status: TransactionStatus;
  }>;
}

// ─── STOCK & INVENTAIRE ─────────────────────────────────────────────────────

export interface StockMovement {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  qty: number;
  reason: string;
  user: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentLevel: number;
  minThreshold: number;
  forecastedLevel: number;
  purchasePrice: number;
  unitPrice: number;
  location: string;
  imageUrl?: string;
  subcategoryId?: string;
  movements?: StockMovement[];
}

export interface InventoryCampaign {
  id: string;
  name: string;
  status: 'DRAFT' | 'VALIDATED';
  createdAt: string;
  items?: InventoryCampaignItem[];
}

export interface InventoryCampaignItem {
  id: string;
  stockItemId: string;
  stockItem?: StockItem;
  systemQty: number;
  countedQty: number;
}

// ─── FOURNISSEURS & LIVRAISONS ───────────────────────────────────────────────

export interface Supplier {
  id: string;
  companyName: string;
  mainContact?: string;
  email?: string;
  phone: string;
  address?: string;
  siret?: string;
  tvaIntra?: string;
  website?: string;
  paymentTerms: number;
  status: string;
  isActive: boolean;
  createdAt?: string;
}

export interface DeliveryItem {
  id: string;
  deliveryId: string;
  stockItemId: string;
  stock_item?: StockItem;
  quantityReceived: number;
  purchasePrice: number;
  totalHt: number;
}

export interface Delivery {
  id: string;
  tenantId: string;
  reference: string;
  supplierId: string;
  supplier?: Supplier;
  deliveryDate: string;
  totalHt: number;
  status: 'PENDING' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED';
  notes?: string;
  purchaseOrderRef?: string;
  items?: DeliveryItem[];
  createdAt?: string;
}

// ─── SERVICES / OFFRES DE SCOLARITÉ ─────────────────────────────────────────

export type Periodicite = 'HEBDOMADAIRE' | 'MENSUEL' | 'TRIMESTRIEL' | 'SEMESTRIEL' | 'ANNUEL';

export type StatutEcheance = 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD' | 'ANNULE';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  imageUrl?: string;
  status: string;
  createdAt: string;
  // Champs scolarité
  typeOffre?: string;
  niveauxCibles?: string[];
  dureeMois?: number;
  inclutCantine?: boolean;
  fraisInscription?: number;
  // Récurrence
  estRecurrent?: boolean;
  periodicite?: Periodicite;
}

export interface AbonnementEleve {
  id: string;
  eleveId: string;
  serviceId: string;
  service?: Service;
  dateDebut: string;
  dateFin?: string;
  isActive: boolean;
  echeances?: EcheancePaiement[];
  createdAt: string;
  updatedAt?: string;
}

export interface EcheancePaiement {
  id: string;
  abonnementId: string;
  eleveId: string;
  serviceId: string;
  service?: Service;
  montant: number;
  dateEcheance: string;
  periodeLabel: string;
  statut: StatutEcheance;
  paidAt?: string;
  saleId?: string;
  createdAt: string;
}

// ─── CLIENTS (legacy — conservé pour la facturation) ────────────────────────

export interface Customer {
  id: string;
  companyName: string;
  mainContact: string;
  email: string;
  phone: string;
  billingAddress: string;
  siret?: string;
  tvaIntra?: string;
  outstandingBalance?: number;
  maxCreditLimit?: number;
  paymentTerms: number;
  healthStatus: 'GOOD' | 'WARNING' | 'CRITICAL';
}

// ─── FACTURATION ─────────────────────────────────────────────────────────────

export interface InvoiceItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  tva: number;
}

export interface Invoice {
  id: string;
  customer: string;
  customerId: string;
  date: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'DRAFT';
  type: string;
  taxAmount: number;
  transmissionStatus: string;
  items: InvoiceItem[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  status: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ─── MODULE RH ───────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  departmentId?: string;
  photoUrl?: string;
  hireDate?: string;
  baseSalary?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  address?: string;
  city?: string;
  country?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O';
  managerId?: string;
  contractType?: string;
  bankInfo?: any;
  meta?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  employeeId: string;
  type: 'CDI' | 'CDD' | 'STAGE' | 'FREELANCE';
  startDate: string;
  endDate?: string;
  salary: number;
  workingHours: number;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'SUSPENDED';
  signedDate: string;
  renewalDate?: string;
  previousContractId?: string;
  renewalCount?: number;
  maxRenewals?: number;
  currency?: string;
  trialPeriodEnd?: string;
  workLocation?: string;
  meta?: string;
  documentUrl?: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    departmentId?: string;
    photoUrl?: string;
  };
}

export interface PayrollSettings {
  id: string;
  tenantId: string;
  socialChargeRate: number;
  taxRate: number;
  minimumWage: number;
  currency: string;
  paymentDay: number;
  overtimeRate: number;
  updatedAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  tenantId: string;
  year: number;
  month: number;
  baseSalary: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  socialCharges: number;
  taxes: number;
  netSalary: number;
  status: 'DRAFT' | 'VALIDATED' | 'PAID';
  generatedAt: string;
  paidAt?: string;
}

export type LeaveType = 'PAID' | 'SICK' | 'MATERNITY' | 'UNPAID' | 'ANNUAL';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Leave {
  id: string;
  tenantId: string;
  employeeId: string;
  employee?: Employee;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: LeaveStatus;
  reason?: string;
  approvedBy?: string;
  approver?: Employee;
  approvedAt?: string;
  rejectionReason?: string;
  documentUrl?: string;
  documentName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveFormData {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  document?: File;
}

export interface LeaveListResponse {
  rows: Leave[];
  count: number;
  page: number;
  perPage: number;
}

export interface HRDocument {
  id: string;
  employeeId: string;
  name: string;
  type: 'ID_CARD' | 'CONTRACT' | 'DIPLOMA' | 'BANK_DETAILS' | 'MEDICAL' | 'OTHER';
  category: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

// ─── MODULE SCOLAIRE ─────────────────────────────────────────────────────────

export type NiveauScolaire = string;

export type RegimeFinancier =
  | 'NORMAL'
  | 'CAS_SOCIAL_PARTIEL'
  | 'CAS_SOCIAL_TOTAL';

export type StatutAdmission =
  | 'EN_ATTENTE'
  | 'ADMIS'
  | 'INSCRIT'
  | 'ACTIF'
  | 'RADIE'
  | 'SUSPENDU'
  | 'REJETE';

export type Trimestre = 'T1' | 'T2' | 'T3';

export type StatutAnnee = 'PREPARATION' | 'INSCRIPTIONS_OUVERTES' | 'EN_COURS' | 'CLOTUREE';

export interface AnneeScolaireConfig {
  statut: StatutAnnee;
  dateCreation?: string | null;
  dateOuvertureInscriptions?: string | null;
  dateDemarrage?: string | null;
  dateCloture?: string | null;
}

// Maternelle : ACQUIS(A)/EN_COURS(B)/NON_ACQUIS(C) · Élémentaire : EN_COURS(EA)/ACQUIS(A)/MAITRISE(M)
export type NiveauCompetence = 'ACQUIS' | 'EN_COURS' | 'NON_ACQUIS' | 'MAITRISE';

export interface ContactParent {
  nom: string;
  prenom: string;
  telephone: string;
  whatsapp: string;
  email?: string;
  lien: 'PERE' | 'MERE' | 'TUTEUR';
  telDomicile?: string;
  telTravail?: string;
  adresse?: string;
  profession?: string;
  entreprise?: string;
}

// Personne autorisée à venir chercher l'enfant à la sortie
export interface PersonneAutorisee {
  nom: string;
  telephone?: string;
  lien?: string;
}

export interface ContactUrgence {
  nom: string;
  prenom: string;
  telephone: string;
  lien?: string;
}

export interface Eleve {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  niveau: NiveauScolaire;
  classeId?: string;
  regimeFinancier: RegimeFinancier;
  remisePct: number;        // 0-100 — remise cas social
  cantine: boolean;
  transportBus: boolean;
  garderie?: boolean;        // maternelle uniquement (CRECHE, PS, MS, GS)
  besoinSpecifique?: string; // enfants avec retard ou besoins particuliers
  statut: StatutAdmission;
  dateAdmission: string;
  dateRadiation?: string;
  parent1: ContactParent;
  parent2?: ContactParent;
  contactUrgence?: ContactUrgence;
  personneAutorisee?: PersonneAutorisee;
  whatsappPrincipal: string;
  anneeScolaire: string;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  // ── Fiche sanitaire ────────────────────────────────────────────────────────
  sexe?: 'M' | 'F' | '';
  // Vaccinations
  vaccDiphterie?: boolean;    vaccDiphterieDate?: string;
  vaccTetanos?: boolean;      vaccTetanosDate?: string;
  vaccPolio?: boolean;        vaccPolioDate?: string;
  vaccCoqueluche?: boolean;   vaccCoquelucheDate?: string;
  vaccBCG?: boolean;          vaccBCGDate?: string;
  vaccHepB?: boolean;         vaccHepBDate?: string;
  vaccROR?: boolean;          vaccRORDate?: string;
  certifContrIndication?: boolean;
  // Traitement médical
  traitementMedical?: boolean;
  traitementDetail?: string;
  // Maladies antérieures
  maladieRubeole?: boolean;
  maladieVaricelle?: boolean;
  maladieAngine?: boolean;
  maladieRhumatisme?: boolean;
  maladieScarlatine?: boolean;
  maladieCoqueluche?: boolean;
  maladieOtite?: boolean;
  maladieRougeole?: boolean;
  maladieOreillons?: boolean;
  // Allergies
  allergieAsthme?: boolean;
  allergieMedicament?: boolean;
  allergieAlimentaire?: boolean;
  allergieAutres?: string;
  allergieConduite?: string;
  // Difficultés de santé
  difficulteSante?: string;
  // Équipements portés
  equipeLunettes?: boolean;
  equipeLentilles?: boolean;
  equipeProtheseAuditive?: boolean;
  equipeProtheseDentaire?: boolean;
  equipePrecisions?: string;
  // Énurésie nocturne
  mouillerLit?: 'OUI' | 'NON' | 'OCCASIONNELLEMENT' | '';
  // Médecin traitant
  medecinNom?: string;
  medecinTel?: string;
  // Autorisations
  autorisationPhoto?: boolean;
  autorisationSoins?: boolean;
}

export interface Classe {
  id: string;
  nom: string;            // ex: "CE1 A"
  niveau: NiveauScolaire;
  enseignantId?: string;
  capaciteMax: number;
  anneeScolaire: string;
  elevesIds?: string[];
}

// ─── BULLETINS ───────────────────────────────────────────────────────────────

export interface CompetenceBulletin {
  libelle: string;
  niveau: NiveauCompetence;
}

export interface DomaineBulletin {
  nom: string;
  competences: CompetenceBulletin[];
}

export interface BulletinMaternelle {
  id: string;
  eleveId: string;
  classeId: string;
  trimestre: Trimestre;
  anneeScolaire: string;
  domaines: DomaineBulletin[];
  appreciationGenerale?: string;
  publie: boolean;
  datePublication?: string;
}

export interface SousMatiereBulletin {
  nom: string;
  coefficient: number;
  note: number;           // /20
}

export interface MatiereBulletin {
  nom: string;
  sousMatieres: SousMatiereBulletin[];
  moyenneMatiere: number;
  appreciation?: string;
}

export interface BulletinElementaire {
  id: string;
  eleveId: string;
  classeId: string;
  trimestre: Trimestre;
  anneeScolaire: string;
  matieres: MatiereBulletin[];
  moyenneGenerale: number;
  rang?: number;
  appreciationGenerale?: string;
  publie: boolean;
  datePublication?: string;
}

// ─── ÉVÉNEMENTS & COMMUNICATION ─────────────────────────────────────────────

export interface EvenementEcole {
  id: string;
  titre: string;
  description: string;
  dateEvenement: string;
  cible: 'TOUS' | NiveauScolaire | string;  // string peut être un classeId
  canal: ('WHATSAPP' | 'PORTAIL')[];
  pieceJointe?: string;
  envoye: boolean;
  dateEnvoi?: string;
  createdAt?: string;
}
