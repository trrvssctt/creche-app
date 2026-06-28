import { Tenant } from './Tenant.js';
import { User } from './User.js';
import { StockItem } from './StockItem.js';
import { ProductMovement } from './ProductMovement.js';
import { Category } from './Category.js';
import { Subcategory } from './Subcategory.js';
import { Customer } from './Customer.js';
import { Invoice } from './Invoice.js';
import { InvoiceItem } from './InvoiceItem.js';
import { Document } from './Document.js';
import { Subscription } from './Subscription.js';
import { Plan } from './Plan.js';
import { AuditLog } from './AuditLog.js';
import { Backup } from './Backup.js';
import { Sale } from './Sale.js';
import { SaleItem } from './SaleItem.js';
import { Payment } from './Payment.js';
import { Administrator } from './Administrator.js';
import { Service } from './Service.js';
import { ContactMessage } from './ContactMessage.js';
import { Message } from './Message.js';
import { PromptTemplate } from './PromptTemplate.js';
import { Employee } from './Employee.js';
import { Department } from './Department.js';
import { Contract } from './Contract.js';
import { Payroll } from './Payroll.js';
import { PayrollSettings } from './PayrollSettings.js';
import { PayrollItem } from './PayrollItem.js';
import { Attendance } from './Attendance.js';
import { Leave } from './Leave.js';
import { EmployeeDocument } from './EmployeeDocument.js';
import { JobOffer } from './JobOffer.js';
import { Candidate } from './Candidate.js';
import { Training } from './Training.js';
import { TrainingParticipant } from './TrainingParticipant.js';
import { PerformanceReview } from './PerformanceReview.js';
import { CompanyDeclarationSettings } from './CompanyDeclarationSettings.js';
import { Declaration } from './Declaration.js';
import { Advance } from './Advance.js';
import { Prime } from './Prime.js';
import { Session } from './Session.js';
import { SupportTicket } from './SupportTicket.js';
import { OvertimeRequest } from './OvertimeRequest.js';
import { Announcement } from './Announcement.js';
import { HRRule } from './HRRule.js';
import { Notification } from './Notification.js';
import { NotificationRead } from './NotificationRead.js';
import { Supplier } from './Supplier.js';
import { Delivery } from './Delivery.js';
import { DeliveryItem } from './DeliveryItem.js';
import { RegistrationIntent } from './RegistrationIntent.js';
import { Eleve } from './Eleve.js';
import { Bulletin } from './Bulletin.js';
import { Classe } from './Classe.js';
import { AbonnementEleve } from './AbonnementEleve.js';
import { EcheancePaiement } from './EcheancePaiement.js';
import { Presence } from './Presence.js';
import { CreneauHoraire } from './CreneauHoraire.js';
import { PlanningConfig } from './PlanningConfig.js';
import { PlanningException } from './PlanningException.js';
import { EleveDocument } from './EleveDocument.js';
import { SchoolEvent } from './SchoolEvent.js';

/**
 * ARCHITECTURE KERNEL V3.2.3
 */

// --- RELATIONS SAAS (BRIDGING VIA SUBSCRIPTION) ---

// Un Tenant a une seule souscription active
Tenant.hasOne(Subscription, { foreignKey: 'tenant_id', as: 'subscription' });
Subscription.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// Une Souscription est liée à un Plan
Subscription.belongsTo(Plan, { foreignKey: 'plan_id', as: 'planDetails' });
Plan.hasMany(Subscription, { foreignKey: 'plan_id' });

// --- RELATIONS ERP STANDARDS ---

Tenant.hasMany(User, { foreignKey: 'tenant_id' });
Tenant.hasMany(StockItem, { foreignKey: 'tenant_id' });
Tenant.hasMany(Customer, { foreignKey: 'tenant_id' });
Tenant.hasMany(Eleve, { foreignKey: 'tenant_id' });
Eleve.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(Classe, { foreignKey: 'tenant_id' });
Classe.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Classe.hasMany(Eleve, { foreignKey: 'classe_id', as: 'eleves' });
Eleve.belongsTo(Classe, { foreignKey: 'classe_id', as: 'classe' });
Classe.belongsTo(Employee, { foreignKey: 'enseignant_id', as: 'enseignant' });
Employee.hasMany(Classe, { foreignKey: 'enseignant_id', as: 'classesResponsable' });

// Créneaux horaires (emploi du temps)
Tenant.hasMany(CreneauHoraire, { foreignKey: 'tenant_id' });
CreneauHoraire.belongsTo(Tenant,   { foreignKey: 'tenant_id' });
CreneauHoraire.belongsTo(Classe,   { foreignKey: 'classe_id',     as: 'classe' });
CreneauHoraire.belongsTo(Employee, { foreignKey: 'enseignant_id', as: 'enseignant' });
Classe.hasMany(CreneauHoraire,     { foreignKey: 'classe_id',     as: 'creneaux' });
Employee.hasMany(CreneauHoraire,   { foreignKey: 'enseignant_id', as: 'creneauxEnseignant' });

// Planning récurrent (config période + exceptions par date)
Tenant.hasMany(PlanningConfig,    { foreignKey: 'tenant_id' });
PlanningConfig.belongsTo(Tenant,  { foreignKey: 'tenant_id' });
Tenant.hasMany(PlanningException, { foreignKey: 'tenant_id' });
PlanningException.belongsTo(Tenant,       { foreignKey: 'tenant_id' });
PlanningException.belongsTo(CreneauHoraire, { foreignKey: 'creneau_id', as: 'creneau' });
CreneauHoraire.hasMany(PlanningException,   { foreignKey: 'creneau_id', as: 'exceptions' });

// Présences élèves
Tenant.hasMany(Presence, { foreignKey: 'tenant_id' });
Presence.belongsTo(Tenant,   { foreignKey: 'tenant_id' });
Presence.belongsTo(Classe,   { foreignKey: 'classe_id',     as: 'classe' });
Presence.belongsTo(Eleve,    { foreignKey: 'eleve_id',      as: 'eleve' });
Presence.belongsTo(Employee, { foreignKey: 'enseignant_id', as: 'enseignant' });
Classe.hasMany(Presence,     { foreignKey: 'classe_id',     as: 'presences' });
Eleve.hasMany(Presence,      { foreignKey: 'eleve_id',      as: 'presences' });

// Abonnements & Échéances
Eleve.hasMany(AbonnementEleve, { foreignKey: 'eleve_id', as: 'abonnements' });
AbonnementEleve.belongsTo(Eleve, { foreignKey: 'eleve_id', as: 'eleve' });
AbonnementEleve.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
AbonnementEleve.hasMany(EcheancePaiement, { foreignKey: 'abonnement_id', as: 'echeances' });
EcheancePaiement.belongsTo(AbonnementEleve, { foreignKey: 'abonnement_id', as: 'abonnement' });
EcheancePaiement.belongsTo(Eleve, { foreignKey: 'eleve_id', as: 'eleve' });
EcheancePaiement.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

Tenant.hasMany(Bulletin, { foreignKey: 'tenant_id' });
Bulletin.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Eleve.hasMany(Bulletin, { foreignKey: 'eleve_id', as: 'bulletins' });
Bulletin.belongsTo(Eleve, { foreignKey: 'eleve_id', as: 'eleve' });

Tenant.hasMany(Sale, { foreignKey: 'tenant_id' });
Tenant.hasMany(Payment, { foreignKey: 'tenant_id' });
Tenant.hasMany(Service, { foreignKey: 'tenant_id' });
Tenant.hasMany(Employee, { foreignKey: 'tenant_id' });
Tenant.hasMany(Department, { foreignKey: 'tenant_id' });
Tenant.hasMany(Contract, { foreignKey: 'tenant_id' });
Tenant.hasMany(Payroll, { foreignKey: 'tenant_id' });
Tenant.hasMany(Attendance, { foreignKey: 'tenant_id' });
Tenant.hasMany(Leave, { foreignKey: 'tenant_id' });
Tenant.hasMany(EmployeeDocument, { foreignKey: 'tenant_id' });
Tenant.hasMany(JobOffer, { foreignKey: 'tenant_id' });
Tenant.hasMany(Candidate, { foreignKey: 'tenant_id' });
Tenant.hasMany(Training, { foreignKey: 'tenant_id' });
Tenant.hasMany(TrainingParticipant, { foreignKey: 'tenant_id' });
Tenant.hasMany(PerformanceReview, { foreignKey: 'tenant_id' });
Tenant.hasMany(Advance, { foreignKey: 'tenant_id' });
Tenant.hasMany(Prime, { foreignKey: 'tenant_id' });
Tenant.hasOne(PayrollSettings, { foreignKey: 'tenant_id' });
Tenant.hasMany(Session, { foreignKey: 'tenant_id' });

User.belongsTo(Tenant, { foreignKey: 'tenant_id' });
StockItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Sale.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Payment.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Service.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// --- HR RELATIONS ---
// Employee relations
Employee.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'departmentInfo' });
Employee.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });
Employee.hasMany(Employee, { foreignKey: 'manager_id', as: 'subordinates' });
Employee.hasMany(Contract, { foreignKey: 'employee_id', as: 'contracts' });
Employee.hasMany(Payroll, { foreignKey: 'employee_id', as: 'payrolls' });
Employee.hasMany(Attendance, { foreignKey: 'employee_id', as: 'attendances' });
Employee.hasMany(Leave, { foreignKey: 'employee_id', as: 'leaves' });
Employee.hasMany(EmployeeDocument, { foreignKey: 'employee_id', as: 'documents' });
Employee.hasMany(TrainingParticipant, { foreignKey: 'employee_id', as: 'trainings' });
Employee.hasMany(PerformanceReview, { foreignKey: 'employee_id', as: 'reviews' });
Employee.hasMany(PerformanceReview, { foreignKey: 'reviewer_id', as: 'conductedReviews' });
Employee.hasMany(Advance, { foreignKey: 'employee_id', as: 'advances' });
Employee.hasMany(Prime, { foreignKey: 'employee_id', as: 'primes' });
Employee.hasOne(User, { foreignKey: 'employee_id', as: 'userAccount' });

// User-Employee relation (for ENTERPRISE plan)
User.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employeeProfile' });

// User-Session relations
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Session.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// Department relations  
Department.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Department.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });
Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });

// Contract relations
Contract.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Contract.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// Payroll relations
Payroll.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Payroll.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// PayrollSettings relations
PayrollSettings.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// PayrollItem relations
PayrollItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// CompanyDeclarationSettings relations
CompanyDeclarationSettings.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasOne(CompanyDeclarationSettings, { foreignKey: 'tenant_id', as: 'declarationSettings' });

// Declaration relations
Declaration.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Declaration.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Declaration.belongsTo(User, { foreignKey: 'submitted_by', as: 'submitter' });
Declaration.belongsTo(User, { foreignKey: 'last_modified_by', as: 'modifier' });
Tenant.hasMany(Declaration, { foreignKey: 'tenant_id', as: 'declarations' });

// Attendance relations
Attendance.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// OvertimeRequest relations
OvertimeRequest.belongsTo(Tenant, { foreignKey: 'tenant_id' });
OvertimeRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
OvertimeRequest.belongsTo(Employee, { foreignKey: 'reviewed_by', as: 'reviewer' });
Employee.hasMany(OvertimeRequest, { foreignKey: 'employee_id', as: 'overtimeRequests' });
Tenant.hasMany(OvertimeRequest, { foreignKey: 'tenant_id' });

// Leave relations
Leave.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Leave.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Leave.belongsTo(Employee, { foreignKey: 'approved_by', as: 'approver' });

// Employee Document relations
EmployeeDocument.belongsTo(Tenant, { foreignKey: 'tenant_id' });
EmployeeDocument.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
EmployeeDocument.belongsTo(Employee, { foreignKey: 'uploaded_by', as: 'uploader' });

// Job Offer relations
JobOffer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
JobOffer.belongsTo(Employee, { foreignKey: 'created_by', as: 'creator' });
JobOffer.hasMany(Candidate, { foreignKey: 'job_offer_id', as: 'candidates' });

// Candidate relations
Candidate.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Candidate.belongsTo(JobOffer, { foreignKey: 'job_offer_id', as: 'jobOffer' });

// Training relations
Training.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Training.belongsTo(Employee, { foreignKey: 'created_by', as: 'creator' });
Training.hasMany(TrainingParticipant, { foreignKey: 'training_id', as: 'participants' });

// Training Participant relations
TrainingParticipant.belongsTo(Tenant, { foreignKey: 'tenant_id' });
TrainingParticipant.belongsTo(Training, { foreignKey: 'training_id', as: 'training' });
TrainingParticipant.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// Performance Review relations
PerformanceReview.belongsTo(Tenant, { foreignKey: 'tenant_id' });
PerformanceReview.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
PerformanceReview.belongsTo(Employee, { foreignKey: 'reviewer_id', as: 'reviewer' });

// HRRule relations
HRRule.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(HRRule, { foreignKey: 'tenant_id', as: 'hrRules' });

// Notification relations
Notification.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Notification, { foreignKey: 'tenant_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'created_by', as: 'sender' });
Notification.belongsTo(User, { foreignKey: 'target_user_id', as: 'targetUser' });
NotificationRead.belongsTo(Notification, { foreignKey: 'notification_id' });
NotificationRead.belongsTo(User, { foreignKey: 'user_id' });
Notification.hasMany(NotificationRead, { foreignKey: 'notification_id', as: 'reads' });

// Avances et Primes
Advance.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Advance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Advance.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

Prime.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Prime.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Prime.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// --- RELATIONS FOURNISSEURS & LIVRAISONS ---
Tenant.hasMany(Supplier, { foreignKey: 'tenant_id' });
Supplier.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(Delivery, { foreignKey: 'tenant_id' });
Delivery.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Supplier.hasMany(Delivery, { foreignKey: 'supplier_id', as: 'deliveries' });
Delivery.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

Delivery.hasMany(DeliveryItem, { foreignKey: 'delivery_id', as: 'items' });
DeliveryItem.belongsTo(Delivery, { foreignKey: 'delivery_id' });

DeliveryItem.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stock_item' });
StockItem.hasMany(DeliveryItem, { foreignKey: 'stock_item_id', as: 'deliveryItems' });

// Ventes & Facturation
Sale.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(Sale, { foreignKey: 'customer_id' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });

SaleItem.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stock_item' });
SaleItem.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

Sale.hasMany(Payment, { foreignKey: 'sale_id', as: 'payments' });
Payment.belongsTo(Sale, { foreignKey: 'sale_id' });

// Factures
Invoice.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasOne(Invoice, { foreignKey: 'sale_id', as: 'invoice' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id' });

// Stocks & Catégories
StockItem.hasMany(ProductMovement, { foreignKey: 'stock_item_id' });
ProductMovement.belongsTo(StockItem, { foreignKey: 'stock_item_id' });

Category.hasMany(Subcategory, { foreignKey: 'category_id' });
Subcategory.belongsTo(Category, { foreignKey: 'category_id' });
Subcategory.hasMany(StockItem, { foreignKey: 'subcategory_id' });
StockItem.belongsTo(Subcategory, { foreignKey: 'subcategory_id' });

export {
  Presence,
  Tenant, User, StockItem, ProductMovement,
  Customer, Invoice, InvoiceItem, Subscription,
  Plan, AuditLog, Backup, Document, Category, Subcategory,
  Sale, SaleItem, Payment, Administrator, Service, ContactMessage,
  Message, PromptTemplate,
  Employee, Department, Contract, Payroll, PayrollSettings, PayrollItem, Attendance,
  Leave, EmployeeDocument, JobOffer, Candidate, Training,
  TrainingParticipant, PerformanceReview, CompanyDeclarationSettings, Declaration,
  Advance, Prime, Session, SupportTicket, Announcement, HRRule,
  Notification, NotificationRead, OvertimeRequest,
  Supplier, Delivery, DeliveryItem,
  RegistrationIntent, Eleve, Bulletin, Classe,
  AbonnementEleve, EcheancePaiement,
  CreneauHoraire,
  PlanningConfig, PlanningException,
  EleveDocument,
  SchoolEvent,
};
