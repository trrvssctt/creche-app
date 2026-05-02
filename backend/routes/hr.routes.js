import { Router } from 'express';
import { checkPermission } from '../middlewares/rbac.js';
import { EmployeeController } from '../controllers/EmployeeController.js';
import { DepartmentController } from '../controllers/DepartmentController.js';
import { ContractController } from '../controllers/ContractController.js';
import { PayrollController } from '../controllers/PayrollController.js';
import { PayrollSettingsController } from '../controllers/PayrollSettingsController.js';
import { PayrollItemController } from '../controllers/PayrollItemController.js';
import { PayslipController } from '../controllers/PayslipController.js';
import { AttendanceController } from '../controllers/AttendanceController.js';
import { LeaveController, leaveDocumentUpload } from '../controllers/LeaveController.js';
import { EmployeeDocumentController } from '../controllers/EmployeeDocumentController.js';
import { JobOfferController } from '../controllers/JobOfferController.js';
import { CandidateController } from '../controllers/CandidateController.js';
import { TrainingController } from '../controllers/TrainingController.js';
import { PerformanceReviewController } from '../controllers/PerformanceReviewController.js';
import { DeclarationController } from '../controllers/DeclarationController.js';
import { HRRuleController } from '../controllers/HRRuleController.js';
import { NotificationController } from '../controllers/NotificationController.js';
import { OvertimeController } from '../controllers/OvertimeController.js';
import multer from 'multer';

// Configuration multer pour l'upload de fichiers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement PDF, JPG, PNG
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez PDF, JPG ou PNG.'), false);
    }
  }
});

const router = Router();

// ========== EMPLOYEES ==========
router.get('/employees/orgchart', checkPermission(['ADMIN','ACCOUNTANT','STOCK_MANAGER','HR_MANAGER']), EmployeeController.getOrgChart);
router.get('/employees/hr-stats', checkPermission(['ADMIN','ACCOUNTANT','STOCK_MANAGER','HR_MANAGER']), EmployeeController.getHRStats);
router.get('/employees', checkPermission(['ADMIN','ACCOUNTANT','STOCK_MANAGER','HR_MANAGER']), EmployeeController.list);
router.post('/employees', checkPermission(['ADMIN','HR_MANAGER']), EmployeeController.create);
router.get('/employees/:id/current-month-salary', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), EmployeeController.getCurrentMonthSalary);
router.get('/employees/:id/advance-deductions', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), EmployeeController.getAdvanceDeductions);
router.get('/employees/:id', checkPermission(['ADMIN','ACCOUNTANT','STOCK_MANAGER','EMPLOYEE','HR_MANAGER']), EmployeeController.get);
router.put('/employees/:id', checkPermission(['ADMIN','HR_MANAGER']), EmployeeController.update);
router.delete('/employees/:id', checkPermission(['ADMIN','HR_MANAGER']), EmployeeController.remove);

// ========== DEPARTMENTS ==========
router.get('/departments', checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER']), DepartmentController.list);
router.post('/departments', checkPermission(['ADMIN','HR_MANAGER']), DepartmentController.create);
router.get('/departments/:id', checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER']), DepartmentController.get);
router.put('/departments/:id', checkPermission(['ADMIN','HR_MANAGER']), DepartmentController.update);
router.delete('/departments/:id', checkPermission(['ADMIN','HR_MANAGER']), DepartmentController.remove);

// ========== CONTRACTS ==========
router.get('/contracts', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), ContractController.list);
router.post('/contracts', checkPermission(['ADMIN','HR_MANAGER']), ContractController.create);
router.get('/contracts/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), ContractController.get);
router.put('/contracts/:id', checkPermission(['ADMIN','HR_MANAGER']), ContractController.update);
router.delete('/contracts/:id', checkPermission(['ADMIN','HR_MANAGER']), ContractController.remove);
router.post('/contracts/:id/terminate', checkPermission(['ADMIN','HR_MANAGER']), ContractController.terminate);
router.post('/contracts/:id/suspend', checkPermission(['ADMIN','HR_MANAGER']), ContractController.suspend);
router.post('/contracts/:id/reactivate', checkPermission(['ADMIN','HR_MANAGER']), ContractController.reactivate);
router.post('/contracts/:id/renew', checkPermission(['ADMIN','HR_MANAGER']), ContractController.renew);
router.get('/contracts/employee/:employeeId/history', checkPermission(['ADMIN','HR_MANAGER']), ContractController.getContractHistory);
router.get('/contracts/alerts/expiring', checkPermission(['ADMIN','HR_MANAGER']), ContractController.getExpiringContracts);

// ========== PAYROLL ==========
router.get('/payrolls', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.list);
router.post('/payrolls', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.create);
router.get('/payrolls/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.get);
router.post('/payrolls/:id/generate', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.generatePaystub);
router.post('/payroll/generate-monthly', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.generateMonthlyPayroll);
router.get('/payroll/validate-eligibility', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.validatePayrollEligibility);
router.get('/payroll/pre-payroll-check', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.prePayrollCheck);

// ========== PAYSLIPS (FICHES DE PAIE) ==========
router.get('/payslips', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayslipController.list);
router.post('/payslips/generate', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayslipController.generate);
router.post('/payslips/generate-bulk', checkPermission(['ADMIN','HR_MANAGER']), PayslipController.generateBulkPayslips);
router.delete('/payslips/:payslipId', checkPermission(['ADMIN','HR_MANAGER']), PayslipController.deletePayslip);
router.get('/employees/:employeeId/payslips', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER','EMPLOYEE']), PayslipController.getEmployeePayslips);
router.get('/payslips/download', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER','EMPLOYEE']), PayslipController.downloadPayslip);
router.get('/payslips/download-all-zip', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayslipController.downloadAllAsZip);

// ========== PAYROLL SETTINGS ==========
router.get('/payroll-settings', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollSettingsController.get);
router.put('/payroll-settings', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollSettingsController.update);
router.post('/payroll-settings/calculate', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollSettingsController.calculatePayroll);

// ========== PAYROLL ITEMS (RUBRIQUES) ==========
router.get('/payroll-items', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.list);
router.post('/payroll-items', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.create);
router.get('/payroll-items/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.get);
router.put('/payroll-items/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.update);
router.delete('/payroll-items/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.delete);

// ========== AVANCES SUR SALAIRE ==========
router.get('/advances', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.listAdvances);
router.post('/advances', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.createAdvance);
router.post('/advances/:id/approve', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.approveAdvance);
router.post('/advances/:id/reject', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.rejectAdvance);
router.get('/employees/:employeeId/monthly-deductions', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.getMonthlyDeductions);
router.get('/employees/:employeeId/monthly-salary', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.calculateMonthlySalary);

// ========== PRIMES EXCEPTIONNELLES ==========
router.get('/primes', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.listPrimes);
router.post('/primes', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.createPrime);
router.put('/primes/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.updatePrime);
router.delete('/primes/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollController.deletePrime);
router.patch('/payroll-items/:id/toggle-status', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), PayrollItemController.toggleStatus);
router.post('/payroll-items/initialize-defaults', checkPermission(['ADMIN','HR_MANAGER']), PayrollItemController.initializeDefaultItems);

// ========== ATTENDANCE ==========
// Routes self-service : tous les rôles non-admin peuvent pointer
const POINTAGE_ROLES = ['EMPLOYEE','ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES'];
// Routes spécifiques employee (AVANT les routes génériques /:id)
router.get('/attendance/my/today',           checkPermission(POINTAGE_ROLES), AttendanceController.myToday);
router.get('/attendance/my/overtime-summary',checkPermission(POINTAGE_ROLES), AttendanceController.myOvertimeSummary);
router.get('/attendance/my',                 checkPermission(POINTAGE_ROLES), AttendanceController.myHistory);
router.post('/attendance/clock-in',          checkPermission(POINTAGE_ROLES), AttendanceController.clockIn);
router.post('/attendance/clock-out',         checkPermission(POINTAGE_ROLES), AttendanceController.clockOut);
router.post('/attendance/auto-clockout',     checkPermission(POINTAGE_ROLES), AttendanceController.autoClockout);
// Bilan heures supp/absences (vue admin/RH)
router.get('/attendance/overtime-summary',   checkPermission(['ADMIN','HR_MANAGER']), AttendanceController.overtimeSummaryAdmin);
// Pointage admin pour un employé spécifique
router.post('/attendance/admin/clock-in',    checkPermission(['ADMIN','HR_MANAGER']), AttendanceController.adminClockIn);
router.post('/attendance/admin/clock-out',   checkPermission(['ADMIN','HR_MANAGER']), AttendanceController.adminClockOut);
// Tous les pointages du jour (admin)
router.get('/attendance/today',              checkPermission(['ADMIN','HR_MANAGER']), AttendanceController.today);
// Routes admin/RH génériques
router.get('/attendance',  checkPermission(['ADMIN','STOCK_MANAGER','EMPLOYEE','HR_MANAGER']), AttendanceController.list);
router.post('/attendance', checkPermission(['ADMIN','STOCK_MANAGER','EMPLOYEE','HR_MANAGER']), AttendanceController.create);
router.put('/attendance/:id', checkPermission(['ADMIN','STOCK_MANAGER','HR_MANAGER']), AttendanceController.update);

// ========== OVERTIME REQUESTS (HEURES SUPPLÉMENTAIRES) ==========
const OVERTIME_ROLES = ['EMPLOYEE','ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES'];
router.get('/overtime/my',              checkPermission(OVERTIME_ROLES),              OvertimeController.myList);
router.post('/overtime',                checkPermission(OVERTIME_ROLES),              OvertimeController.create);
router.get('/overtime',                 checkPermission(['ADMIN','HR_MANAGER']),       OvertimeController.list);
router.get('/overtime/summary',         checkPermission(['ADMIN','HR_MANAGER']),       OvertimeController.summary);
router.post('/overtime/:id/approve',    checkPermission(['ADMIN','HR_MANAGER']),       OvertimeController.approve);
router.post('/overtime/:id/reject',     checkPermission(['ADMIN','HR_MANAGER']),       OvertimeController.reject);
router.post('/overtime/:id/complete',   checkPermission(['ADMIN','HR_MANAGER']),       OvertimeController.complete);

// ========== LEAVES (CONGÉS) ==========
router.post('/leaves/my/justify-absence', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','STOCK_MANAGER','SALES','ACCOUNTANT']), LeaveController.justifyAbsence);
router.get('/leaves', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','STOCK_MANAGER','SALES','ACCOUNTANT']), LeaveController.list);
router.post('/leaves', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','STOCK_MANAGER','SALES','ACCOUNTANT']), leaveDocumentUpload, LeaveController.create);
router.get('/leaves/:id', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','STOCK_MANAGER','SALES','ACCOUNTANT']), LeaveController.get);
router.put('/leaves/:id', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','STOCK_MANAGER','SALES','ACCOUNTANT']), leaveDocumentUpload, LeaveController.update);
router.post('/leaves/:id/approve', checkPermission(['ADMIN','HR_MANAGER']), LeaveController.approve);
router.delete('/leaves/:id', checkPermission(['ADMIN','HR_MANAGER']), LeaveController.remove);

// ========== EMPLOYEE DOCUMENTS ==========
router.get('/employee-documents', checkPermission(['ADMIN','HR_MANAGER']), EmployeeDocumentController.list);
router.post('/employee-documents', checkPermission(['ADMIN','HR_MANAGER']), EmployeeDocumentController.create);
router.post('/employee-documents/upload-local', 
  checkPermission(['ADMIN','HR_MANAGER']), 
  upload.single('file'), 
  EmployeeDocumentController.uploadLocal
);
router.get('/employee-documents/:id', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), EmployeeDocumentController.get);
router.put('/employee-documents/:id', checkPermission(['ADMIN','HR_MANAGER']), EmployeeDocumentController.update);
router.delete('/employee-documents/:id', checkPermission(['ADMIN','HR_MANAGER']), EmployeeDocumentController.remove);
router.get('/employees/:employeeId/documents', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), EmployeeDocumentController.getByEmployee);

// ========== RECRUITMENT - JOB OFFERS ==========
router.get('/job-offers', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.list);
router.post('/job-offers', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.create);
router.get('/job-offers/:id', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.get);
router.put('/job-offers/:id', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.update);
router.delete('/job-offers/:id', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.remove);
router.post('/job-offers/:id/publish', checkPermission(['ADMIN','HR_MANAGER']), JobOfferController.publish);

// ========== RECRUITMENT - CANDIDATES ==========
router.get('/candidates', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.list);
router.post('/candidates', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.create);
router.get('/candidates/:id', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.get);
router.put('/candidates/:id', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.update);
router.post('/candidates/:id/status', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.updateStatus);
router.delete('/candidates/:id', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.remove);
router.get('/job-offers/:jobOfferId/candidates', checkPermission(['ADMIN','HR_MANAGER']), CandidateController.getByJobOffer);

// ========== TRAINING ==========
router.get('/trainings', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), TrainingController.list);
router.post('/trainings', checkPermission(['ADMIN','HR_MANAGER']), TrainingController.create);
router.get('/trainings/:id', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), TrainingController.get);
router.put('/trainings/:id', checkPermission(['ADMIN','HR_MANAGER']), TrainingController.update);
router.delete('/trainings/:id', checkPermission(['ADMIN','HR_MANAGER']), TrainingController.remove);
router.post('/trainings/:id/participants', checkPermission(['ADMIN','HR_MANAGER']), TrainingController.addParticipant);

// ========== PERFORMANCE REVIEWS ==========
router.get('/performance-reviews', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), PerformanceReviewController.list);
router.post('/performance-reviews', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.create);
router.get('/performance-reviews/:id', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE']), PerformanceReviewController.get);
router.put('/performance-reviews/:id', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.update);
router.post('/performance-reviews/:id/submit', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.submit);
router.post('/performance-reviews/:id/approve', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.approve);
router.post('/performance-reviews/:id/finalize', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.finalize);
router.delete('/performance-reviews/:id', checkPermission(['ADMIN','HR_MANAGER']), PerformanceReviewController.remove);

// ========== MOTEUR DE RÈGLES RH ==========
router.get('/rules', checkPermission(['ADMIN','HR_MANAGER','ACCOUNTANT']), HRRuleController.list);
router.post('/rules', checkPermission(['ADMIN','HR_MANAGER']), HRRuleController.create);
router.put('/rules/:id', checkPermission(['ADMIN','HR_MANAGER']), HRRuleController.update);
router.delete('/rules/:id', checkPermission(['ADMIN','HR_MANAGER']), HRRuleController.remove);
router.patch('/rules/:id/toggle', checkPermission(['ADMIN','HR_MANAGER']), HRRuleController.toggle);

// ========== SOLDE DE CONGÉS ==========
router.get('/leaves/balance/:employeeId', checkPermission(['ADMIN','HR_MANAGER','EMPLOYEE','ACCOUNTANT']), LeaveController.getLeaveBalance);

// ========== DECLARATIONS SOCIALES & FISCALES ==========
router.get('/declarations/settings', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.getDeclarationSettings);
router.put('/declarations/settings', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.updateDeclarationSettings);
router.get('/declarations/dashboard', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.getDeclarationsDashboard);
router.get('/declarations', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.getDeclarations);
router.post('/declarations', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.createDeclaration);
router.get('/declarations/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.getDeclaration);
router.put('/declarations/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.updateDeclaration);
router.delete('/declarations/:id', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.deleteDeclaration);
router.post('/declarations/:id/submit', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.submitDeclaration);
router.post('/declarations/:id/calculate', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.calculateDeclarationAmounts);
router.post('/declarations/generate-monthly', checkPermission(['ADMIN','ACCOUNTANT','HR_MANAGER']), DeclarationController.generateMonthlyDeclarations);

// --- NOTIFICATIONS TENANT ---
// Ordre important : routes spécifiques avant /:id
router.get('/notifications/unread-count', checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES','EMPLOYEE']), NotificationController.unreadCount);
router.get('/notifications/users',        checkPermission(['ADMIN','HR_MANAGER']), NotificationController.getUsers);
router.post('/notifications/read-all',    checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES','EMPLOYEE']), NotificationController.markAllRead);
router.get('/notifications',              checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES','EMPLOYEE']), NotificationController.getAll);
router.post('/notifications',             checkPermission(['ADMIN','HR_MANAGER']), NotificationController.create);
router.post('/notifications/:id/read',    checkPermission(['ADMIN','HR_MANAGER','STOCK_MANAGER','ACCOUNTANT','SALES','EMPLOYEE']), NotificationController.markRead);
router.delete('/notifications/:id',       checkPermission(['ADMIN','HR_MANAGER']), NotificationController.delete);

export default router;
