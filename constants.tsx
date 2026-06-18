
import { UserRole, User, StockItem, Invoice, AuditLog, Customer, Employee, Contract, PayrollEntry, SubscriptionPlan } from './types';

// ─── Utilisateurs de l'établissement ────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Directrice',
    role: UserRole.ADMIN,
    roles: [UserRole.ADMIN],
    email: 'directrice@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
  },
  {
    id: '2',
    name: 'Fatou Mbaye',
    role: UserRole.MAITRESSE,
    roles: [UserRole.MAITRESSE],
    email: 'fatou.mbaye@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
    employeeId: 'EMP001',
  },
  {
    id: '3',
    name: 'Mariama Sow',
    role: UserRole.ENSEIGNANT,
    roles: [UserRole.ENSEIGNANT],
    email: 'mariama.sow@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
    employeeId: 'EMP002',
  },
  {
    id: '4',
    name: 'Ibrahima Diallo',
    role: UserRole.COMPTABLE,
    roles: [UserRole.COMPTABLE],
    email: 'compta@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
    employeeId: 'EMP003',
  },
  {
    id: '5',
    name: 'Aissatou Diop',
    role: UserRole.ASSISTANTE,
    roles: [UserRole.ASSISTANTE],
    email: 'assistante@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
  },
  {
    id: '6',
    name: 'Ousmane Ndiaye',
    role: UserRole.HR_MANAGER,
    roles: [UserRole.HR_MANAGER],
    email: 'rh@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
  },
  {
    id: '7',
    name: 'Modou Fall',
    role: UserRole.EMPLOYEE,
    roles: [UserRole.EMPLOYEE],
    email: 'gardien@toit-des-anges.sn',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    activeSession: true,
    isActive: true,
    tenantId: 'TOIT_DES_ANGES',
  },
];

// ─── Stock / Fournitures scolaires ───────────────────────────────────────────

export const MOCK_STOCKS: StockItem[] = [
  {
    id: 'S1',
    sku: 'LIV-CE1-FR',
    name: 'Manuel de Français CE1',
    category: 'Livres scolaires',
    currentLevel: 30,
    minThreshold: 5,
    forecastedLevel: 25,
    purchasePrice: 4500,
    unitPrice: 6000,
    location: 'Bibliothèque A',
    movements: [
      { id: 'M1', date: '2026-09-01', type: 'IN', qty: 30, reason: 'Rentrée scolaire 2026-2027', user: 'Directrice' }
    ]
  },
  {
    id: 'S2',
    sku: 'CAH-GS-05',
    name: 'Cahier grand format 100p',
    category: 'Fournitures',
    currentLevel: 120,
    minThreshold: 20,
    forecastedLevel: 80,
    purchasePrice: 800,
    unitPrice: 1200,
    location: 'Réserve',
    movements: []
  }
];

// ─── Factures ────────────────────────────────────────────────────────────────

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'FACT-2026-001',
    customer: 'DIOP Aminata Zaynab',
    customerId: 'C1',
    date: '2026-04-23',
    amount: 105000,
    status: 'PAID',
    type: 'SCOLARITE',
    taxAmount: 0,
    transmissionStatus: 'SENT',
    items: [
      { productId: 'SVC-CE1', name: 'Mensualité CE1 — Avril 2026', qty: 1, price: 105000, tva: 0 }
    ]
  }
];

// ─── Logs d'audit ─────────────────────────────────────────────────────────────

export const MOCK_LOGS: AuditLog[] = [
  {
    id: 'L1',
    timestamp: new Date().toISOString(),
    userId: '1',
    userName: 'Directrice',
    action: 'LOGIN',
    resource: 'Auth',
    status: 'SUCCESS',
    severity: 'LOW'
  }
];

// ─── Employés (personnel enseignant + administratif) ─────────────────────────

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'EMP001',
    tenantId: 'TOIT_DES_ANGES',
    firstName: 'Fatou',
    lastName: 'Mbaye',
    email: 'fatou.mbaye@toit-des-anges.sn',
    phone: '+221 77 123 4567',
    position: 'Maîtresse PS/MS',
    department: 'Maternelle',
    hireDate: '2020-09-01',
    baseSalary: 250000,
    status: 'ACTIVE',
    address: 'Ouakam, Dakar',
    birthDate: '1990-05-15',
    gender: 'F',
    createdAt: '2020-09-01T08:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'EMP002',
    tenantId: 'TOIT_DES_ANGES',
    firstName: 'Mariama',
    lastName: 'Sow',
    email: 'mariama.sow@toit-des-anges.sn',
    phone: '+221 78 234 5678',
    position: 'Enseignante CE1',
    department: 'Élémentaire',
    hireDate: '2021-09-01',
    baseSalary: 280000,
    status: 'ACTIVE',
    address: 'Ouakam, Dakar',
    birthDate: '1988-11-20',
    gender: 'F',
    createdAt: '2021-09-01T08:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'EMP003',
    tenantId: 'TOIT_DES_ANGES',
    firstName: 'Ibrahima',
    lastName: 'Diallo',
    email: 'ibrahima.diallo@toit-des-anges.sn',
    phone: '+221 76 345 6789',
    position: 'Comptable',
    department: 'Administration',
    hireDate: '2022-01-15',
    baseSalary: 220000,
    status: 'ACTIVE',
    address: 'Yoff, Dakar',
    birthDate: '1992-03-08',
    gender: 'M',
    createdAt: '2022-01-15T08:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

// ─── Contrats ─────────────────────────────────────────────────────────────────

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'CONT001',
    employeeId: 'EMP001',
    type: 'CDI',
    startDate: '2020-09-01',
    salary: 250000,
    workingHours: 35,
    status: 'ACTIVE',
    signedDate: '2020-08-25',
  },
  {
    id: 'CONT002',
    employeeId: 'EMP002',
    type: 'CDI',
    startDate: '2021-09-01',
    salary: 280000,
    workingHours: 35,
    status: 'ACTIVE',
    signedDate: '2021-08-20',
  },
  {
    id: 'CONT003',
    employeeId: 'EMP003',
    type: 'CDD',
    startDate: '2022-01-15',
    endDate: '2027-01-14',
    salary: 220000,
    workingHours: 40,
    status: 'ACTIVE',
    signedDate: '2022-01-10',
  },
];

// ─── Paie ─────────────────────────────────────────────────────────────────────

export const MOCK_PAYROLL: PayrollEntry[] = [
  {
    id: 'PAY001_2026_04',
    employeeId: 'EMP001',
    tenantId: 'TOIT_DES_ANGES',
    month: 4,
    year: 2026,
    baseSalary: 250000,
    overtime: 0,
    bonuses: 0,
    deductions: 0,
    socialCharges: 50000,
    taxes: 25000,
    netSalary: 175000,
    status: 'PAID',
    generatedAt: '2026-04-25T10:00:00Z',
    paidAt: '2026-04-30T14:00:00Z',
  },
];

// ─── Données mock congés ─────────────────────────────────────────────────────

export const MOCK_LEAVES = [
  {
    id: 'L001',
    employeeId: 'EMP001',
    type: 'PAID',
    employee: 'Fatou Mbaye',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    days: 61,
    status: 'APPROVED',
    reason: 'Vacances scolaires',
    createdAt: '2026-05-01T10:00:00Z',
    approvedAt: '2026-05-02T09:00:00Z',
  },
];

// ─── Documents RH ─────────────────────────────────────────────────────────────

export const MOCK_HR_DOCUMENTS = [
  {
    id: 'DOC001',
    employeeId: 'EMP001',
    name: 'CNI_Fatou_Mbaye.pdf',
    type: 'ID_CARD',
    category: 'Identité',
    employee: 'Fatou Mbaye',
    fileUrl: '/documents/cni_fatou.pdf',
    fileSize: 1200000,
    mimeType: 'application/pdf',
    uploadedAt: '2020-09-01T14:30:00Z',
    uploadedBy: 'Directrice',
  },
];

// ─── Paramètres de paie ───────────────────────────────────────────────────────

export const MOCK_PAYROLL_SETTINGS = {
  id: 'SETTINGS_001',
  tenantId: 'TOIT_DES_ANGES',
  socialChargeRate: 0.20,   // 20%
  taxRate: 0.10,            // 10%
  minimumWage: 100000,      // SMIG Sénégal
  currency: 'F CFA',
  paymentDay: 30,
  overtimeRate: 1.5,
  updatedAt: '2026-01-01T10:00:00Z',
};

// ─── Plans d'abonnement ───────────────────────────────────────────────────────

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'FREE_TRIAL', name: 'Essai Gratuit',
    priceMonthly: 0, priceThreeMonths: 0, priceYearly: 0,
    trialDays: 14, maxUsers: 5, hasAiChatbot: true, hasStockForecast: true,
    isActive: true, level: 0,
    features: ['14 jours complets', 'Quota: 1 Client, 5 Produits, 5 Ventes', '3 Catégories / 3 Sous-cat.'],
  },
  {
    id: 'BASIC', name: 'Starter AI',
    priceMonthly: 7900, priceThreeMonths: 20145, priceYearly: 66360,
    maxUsers: 1, hasAiChatbot: false, hasStockForecast: false,
    isActive: true, level: 1,
    features: ['100 Factures/mois', '1 Utilisateur', 'Support email'],
  },
  {
    id: 'PRO', name: 'Business Pro',
    priceMonthly: 19900, priceThreeMonths: 50745, priceYearly: 167160,
    maxUsers: 5, hasAiChatbot: true, hasStockForecast: true,
    isActive: true, level: 2, isPopular: true,
    features: ['Illimité', '5 Utilisateurs', 'IA Chatbot', 'Prévision Stock'],
  },
  {
    id: 'ENTERPRISE', name: 'Enterprise Cloud',
    priceMonthly: 69000, priceThreeMonths: 175950, priceYearly: 579600,
    maxUsers: 100, hasAiChatbot: true, hasStockForecast: true,
    isActive: true, level: 3,
    features: ['Multi-Entités', '100 Utilisateurs', 'Support Premium 24/7'],
  },
];
