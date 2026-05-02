
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Settings,
  Play,
  ClipboardList,
  TrendingUp,
  CreditCard,
  FileCheck,
  Download,
  FolderDown,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle2,
  CheckCircle,
  Send,
  Eye,
  Image,
  RefreshCw,
  Trash2,
  AlertTriangle,
  AlertCircle,
  History,
  PieChart,
  Globe,
  Briefcase,
  Users,
  Layers,
  FileText,
  X,
  Shield,
  MinusCircle,
  Zap,
  ToggleLeft,
  ToggleRight,
  Clock,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import DeclarationsSocialesFiscales from './DeclarationsSocialesFiscales';
import PayslipPreview from './PayslipPreview';
import { api } from '../../services/api';
import { authBridge } from '../../services/authBridge';

interface PayrollManagementProps {
  onNavigate: (tab: string, meta?: any) => void;
  initialTab?: string;
}

const PayrollManagement: React.FC<PayrollManagementProps> = ({ onNavigate, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'generation');
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isPrimeModalOpen, setIsPrimeModalOpen] = useState(false);
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [payrollSettings, setPayrollSettings] = useState<any>(null);
  const [payrollItems, setPayrollItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // États pour les employés
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  // États pour les avances et primes
  const [advances, setAdvances] = useState<any[]>([]);
  const [primes, setPrimes] = useState<any[]>([]);
  // États pour les filtres
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [primeEmployeeSearchTerm, setPrimeEmployeeSearchTerm] = useState('');
  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    months: 1,
    reason: '',
    currency: 'F CFA'
  });
  const [primeForm, setPrimeForm] = useState({
    employeeId: '',
    amount: '',
    reason: '',
    type: 'PERFORMANCE',
    currency: 'F CFA'
  });
  const [settingsForm, setSettingsForm] = useState({
    employerSocialChargeRate: 18.5,
    employeeSocialChargeRate: 8.2,
    currency: 'F CFA',
    paymentDay: 28,
    workStartTime: '08:00',
    workEndTime: '17:00',
    workingDaysPerMonth: 26
  });
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    type: 'EARNING',
    category: 'ALLOWANCE'
  });
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  // États pour les modals d'avances
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  // États pour les déductions mensuelles
  const [monthlyDeductions, setMonthlyDeductions] = useState<Record<string, any>>({});
  const [loadingDeductions, setLoadingDeductions] = useState(false);

  // États pour la consultation des bulletins
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [payslipFilters, setPayslipFilters] = useState({
    month: new Date().toISOString().substring(0, 7),
    employeeId: '',
    status: 'ALL'
  });
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [isPayslipViewModalOpen, setIsPayslipViewModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [regeneratingPayslip, setRegeneratingPayslip] = useState(false);
  const [confirmPayroll, setConfirmPayroll] = useState(false);

  // ---- États Pré-Paie & Jour de Paie ----
  const [prePayrollData, setPrePayrollData] = useState<any>(null);
  const [loadingPrePayroll, setLoadingPrePayroll] = useState(false);
  const [showPrePayrollDetails, setShowPrePayrollDetails] = useState(false);

  // États pour la prévisualisation des bulletins
  const [selectedEmployeeForPreview, setSelectedEmployeeForPreview] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPayslipData, setPreviewPayslipData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    displayName: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  });

  // ---- États Moteur de Règles RH ----
  const [hrRules, setHrRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'LATE',
    conditionOperator: 'GT',
    conditionValue: '',
    conditionUnit: 'MINUTES',
    actionType: 'DEDUCT_SALARY_HOURS',
    actionValue: '',
    isActive: true
  });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [zipDownloading, setZipDownloading] = useState(false);

  // ---- Calcul du jour de paie ----
  const paydayInfo = useMemo(() => {
    const payDay = payrollSettings?.paymentDay || 28;
    const today = new Date();
    const todayDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Prochaine date de paie
    let nextPayDate: Date;
    if (todayDay <= payDay) {
      nextPayDate = new Date(currentYear, currentMonth, payDay);
    } else {
      nextPayDate = new Date(currentYear, currentMonth + 1, payDay);
    }

    const diffTime = nextPayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isPayday = todayDay === payDay;
    const isSoon = diffDays <= 3 && !isPayday;

    const nextPayDateStr = nextPayDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return { payDay, isPayday, isSoon, diffDays, nextPayDateStr };
  }, [payrollSettings?.paymentDay]);

  // ---- Charger la vérification pré-paie ----
  const loadPrePayrollCheck = async () => {
    try {
      setLoadingPrePayroll(true);
      const currentMonth = new Date().toISOString().substring(0, 7);
      const data = await api.get(`/hr/payroll/pre-payroll-check?month=${currentMonth}`);
      setPrePayrollData(data);
    } catch (error) {
      console.error('Erreur chargement pré-paie:', error);
      setPrePayrollData(null);
    } finally {
      setLoadingPrePayroll(false);
    }
  };

  // Ouvrir le modal de génération avec chargement automatique de la vérification
  const handleOpenGenModal = () => {
    setIsGenModalOpen(true);
    setPrePayrollData(null);
    setShowPrePayrollDetails(false);
    setConfirmPayroll(false);
    loadPrePayrollCheck();
  };

  const handleDownloadAllZip = async () => {
    try {
      setZipDownloading(true);
      const month = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`;
      const session = authBridge.getSession();
      const token = session?.token;

      const url = new URL('http://localhost:3000/api/hr/payslips/download-all-zip');
      //const url = new URL('https://gestock.realtechprint.com/api/hr/payslips/download-all-zip');
      url.searchParams.set('month', month);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Erreur ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `fiches_paie_${month}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setAlertMessage(`ZIP des fiches de paie (${month}) téléchargé avec succès`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 4000);
    } catch (error: any) {
      setAlertMessage(error.message || 'Erreur lors du téléchargement du ZIP');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 4000);
    } finally {
      setZipDownloading(false);
    }
  };

  const loadHrRules = async () => {
    try {
      setRulesLoading(true);
      const data = await api.get('/hr/rules');
      setHrRules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erreur chargement règles RH:', err);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name || !ruleForm.conditionValue || !ruleForm.actionValue) return;
    try {
      setRulesSaving(true);
      if (editingRuleId) {
        await api.put(`/hr/rules/${editingRuleId}`, ruleForm);
      } else {
        await api.post('/hr/rules', ruleForm);
      }
      setRuleForm({ name: '', description: '', type: 'LATE', conditionOperator: 'GT', conditionValue: '', conditionUnit: 'MINUTES', actionType: 'DEDUCT_SALARY_HOURS', actionValue: '', isActive: true });
      setEditingRuleId(null);
      await loadHrRules();
    } catch (err: any) {
      console.error('Erreur sauvegarde règle:', err);
    } finally {
      setRulesSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Supprimer cette règle ?')) return;
    try {
      await api.delete(`/hr/rules/${id}`);
      await loadHrRules();
    } catch (err: any) {
      console.error('Erreur suppression règle:', err);
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      await api.patch(`/hr/rules/${id}/toggle`);
      await loadHrRules();
    } catch (err: any) {
      console.error('Erreur toggle règle:', err);
    }
  };

  const handleEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name || '',
      description: rule.description || '',
      type: rule.type || 'LATE',
      conditionOperator: rule.conditionOperator || 'GT',
      conditionValue: String(rule.conditionValue || ''),
      conditionUnit: rule.conditionUnit || 'MINUTES',
      actionType: rule.actionType || 'DEDUCT_SALARY_HOURS',
      actionValue: String(rule.actionValue || ''),
      isActive: rule.isActive !== false
    });
  };

  const RULE_TYPE_LABELS: Record<string, string> = {
    LATE: 'Retard', ABSENCE: 'Absence', OVERTIME: 'Heures sup', UNPAID_LEAVE: 'Congé non payé'
  };
  const ACTION_TYPE_LABELS: Record<string, string> = {
    DEDUCT_FIXED: 'Montant fixe (F CFA)', DEDUCT_SALARY_HOURS: 'N heures de salaire', DEDUCT_SALARY_DAYS: 'N jours de salaire', DEDUCT_PERCENT: '% du salaire de base'
  };
  const OPERATOR_LABELS: Record<string, string> = { GT: '>', GTE: '≥', LT: '<', LTE: '≤', EQ: '=' };
  const UNIT_LABELS: Record<string, string> = { MINUTES: 'min', HOURS: 'h', DAYS: 'jour(s)' };

  const tabs = [
    { id: 'generation', label: 'Génération Paie', icon: <Play size={16} /> },
    { id: 'slips', label: 'Bulletins', icon: <ClipboardList size={16} /> },
    { id: 'advances', label: 'Avances & Primes', icon: <TrendingUp size={16} /> },
    { id: 'declarations', label: 'Déclarations', icon: <FileCheck size={16} /> },
    { id: 'rules', label: 'Règles RH', icon: <Zap size={16} /> },
    { id: 'settings', label: 'Paramétrage', icon: <Settings size={16} /> },
  ];

  // Charger les données au montage du composant
  useEffect(() => {
    loadPayrollSettings();
    loadEmployees();
    // Toujours charger les avances et primes pour les calculs de paie
    loadAdvances();
    loadPrimes();

    if (activeTab === 'settings') {
      loadPayrollItems();
    }
    if (activeTab === 'advances') {
      // Charger les déductions mensuelles après avoir chargé les employés et avances
      if (employees.length > 0 && advances.length > 0) {
        loadMonthlyDeductions();
      }
    }
    if (activeTab === 'slips') {
      loadPayslips();
    }
    if (activeTab === 'rules') {
      loadHrRules();
    }
  }, [activeTab]);

  // Fonction pour charger les paramètres de paie
  const loadPayrollSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/hr/payroll-settings');
      const data = response?.data || response || {}; // Handle different response structures
      console.log('Settings response:', data); // Debug log
      setPayrollSettings(data);
      setSettingsForm({
        employerSocialChargeRate: data?.employerSocialChargeRate || 18.5,
        employeeSocialChargeRate: data?.employeeSocialChargeRate || 8.2,
        currency: data?.currency || 'F CFA',
        paymentDay: data?.paymentDay || 28,
        workStartTime: data?.workStartTime || '08:00',
        workEndTime: data?.workEndTime || '17:00',
        workingDaysPerMonth: data?.workingDaysPerMonth || 26
      });
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      // Utiliser les valeurs par défaut en cas d'erreur
      setPayrollSettings({
        employerSocialChargeRate: 18.5,
        employeeSocialChargeRate: 8.2,
        currency: 'F CFA'
      });
      setSettingsForm({
        employerSocialChargeRate: 18.5,
        employeeSocialChargeRate: 8.2,
        currency: 'F CFA'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour charger les rubriques de paie
  const loadPayrollItems = async () => {
    try {
      const response = await api.get('/hr/payroll-items');
      const data = response?.data || response || []; // Handle different response structures
      console.log('Items response:', data); // Debug log
      setPayrollItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des rubriques:', error);
      setPayrollItems([]); // Ensure it's always an array
    }
  };

  // Fonction pour charger les employés avec leurs contrats actifs
  const loadEmployees = async () => {
    try {
      // Charger les employés
      const employeesResponse = await api.get('/hr/employees');
      const employeesData = employeesResponse?.rows || employeesResponse || [];

      // Charger les contrats actifs
      const contractsResponse = await api.get('/hr/contracts');
      const contractsData = contractsResponse?.rows || contractsResponse || [];

      // Mapper les employés avec leurs contrats actifs
      const employeesWithContracts = employeesData.map(employee => {
        const activeContract = contractsData.find(contract =>
          contract.employeeId === employee.id &&
          contract.status === 'ACTIVE'
        );

        return {
          ...employee,
          activeContract,
          // Récupérer le salaire du contrat actif ou fallback sur baseSalary
          currentSalary: activeContract?.salary || employee.baseSalary || 0,
          hasActiveContract: !!activeContract
        };
      });

      setEmployees(Array.isArray(employeesWithContracts) ? employeesWithContracts : []);
    } catch (error) {
      console.error('Erreur lors du chargement des employés:', error);
      setEmployees([]);
    }
  };

  // Fonction pour charger les avances
  const loadAdvances = async () => {
    try {
      const response = await api.get('/hr/advances');
      const data = response?.rows || response || [];
      setAdvances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des avances:', error);
      setAdvances([]);
    }
  };

  // Fonction pour charger les primes
  const loadPrimes = async () => {
    try {
      const response = await api.get('/hr/primes');
      const data = response?.rows || response || [];
      setPrimes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des primes:', error);
      setPrimes([]);
    }
  };

  // Fonction pour charger les déductions mensuelles de tous les employés
  const loadMonthlyDeductions = async () => {
    try {
      setLoadingDeductions(true);
      const deductionsData: Record<string, any> = {};

      // Charger les déductions pour chaque employé ayant des avances actives
      const employeesWithAdvances = employees.filter(emp =>
        advances.some(advance =>
          advance.employeeId === emp.id &&
          advance.status === 'APPROVED'
        )
      );

      for (const employee of employeesWithAdvances) {
        try {
          const response = await api.get(`/hr/employees/${employee.id}/monthly-deductions`);
          if (response && response.totalMonthlyDeduction > 0) {
            deductionsData[employee.id] = response;
          }
        } catch (error) {
          console.error(`Erreur lors du chargement des déductions pour ${employee.firstName}:`, error);
        }
      }

      setMonthlyDeductions(deductionsData);
    } catch (error) {
      console.error('Erreur lors du chargement des déductions mensuelles:', error);
    } finally {
      setLoadingDeductions(false);
    }
  };

  // Fonction pour charger les bulletins de paie
  const loadPayslips = async () => {
    try {
      setLoadingPayslips(true);
      const response = await api.get('/hr/payslips', {
        params: payslipFilters
      });
      const data = response?.rows || response || [];
      setPayslips(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des bulletins:', error);
      setPayslips([]);
    } finally {
      setLoadingPayslips(false);
    }
  };

  // Fonction pour prévisualiser un bulletin de paie
  const handlePreviewPayslip = async (employee: any) => {
    try {
      setLoadingPreview(true);
      setSelectedEmployeeForPreview(employee);

      // Calculer les données du bulletin
      const employeePrimes = primes.filter(p => p.employeeId === employee.id && p.status === 'APPROVED');
      const employeeAdvances = advances.filter(a => a.employeeId === employee.id && a.status === 'APPROVED');

      // Vérifier que l'employé a un contrat actif
      if (!employee.hasActiveContract) {
        setAlertMessage('Cet employé n\'a pas de contrat actif valide');
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 3000);
        return;
      }

      // Fonction pour valider et nettoyer les montants
      const validateAmount = (amount: any): number => {
        const num = parseFloat(amount || 0);
        return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
      };

      const baseSalary = validateAmount(employee.currentSalary);
      const totalPrimes = employeePrimes.reduce((sum, p) => sum + validateAmount(p.amount), 0);
      const grossSalary = baseSalary + totalPrimes;
      const socialChargeRate = validateAmount(payrollSettings?.employeeSocialChargeRate) || 8.2;
      const employerChargeRate = validateAmount(payrollSettings?.employerSocialChargeRate) || 18.5;
      const taxRate = validateAmount(payrollSettings?.taxRate) || 10.0;
      const socialChargesEmployee = Math.round(grossSalary * socialChargeRate) / 100;
      const socialChargesEmployer = Math.round(grossSalary * employerChargeRate) / 100;
      // Impôt sur le revenu (base imposable = brut - charges sociales salarié)
      const taxableBase = Math.max(0, grossSalary - socialChargesEmployee);
      const incomeTax = Math.round(taxableBase * taxRate) / 100;
      // Calculer les déductions mensuelles des avances correctement
      const totalAdvanceDeductions = employeeAdvances.reduce((sum, a) => {
        const monthlyDeduction = validateAmount(a.monthlyDeduction) > 0
          ? validateAmount(a.monthlyDeduction)
          : validateAmount(a.amount) / Math.max(1, a.months || 1);
        return sum + monthlyDeduction;
      }, 0);
      const netSalary = Math.max(0, grossSalary - socialChargesEmployee - incomeTax - totalAdvanceDeductions);

      // Préparer les données pour PayslipPreview
      const payslipData = {
        employee: {
          ...employee,
          firstName: employee.firstName || employee.first_name || 'N/A',
          lastName: employee.lastName || employee.last_name || 'N/A',
          departmentInfo: employee.departmentInfo || { name: employee.departmentName || 'N/A' },
          hireDate: employee.hireDate || employee.hire_date,
          position: employee.position || 'N/A',
          matricule: employee.matricule || `EMP${employee.id}`,
          country: employee.country || 'Sénégal'
        },
        contract: {
          type: employee.activeContract?.type || 'CDI',
          salary: baseSalary,
          startDate: employee.activeContract?.startDate || employee.hireDate
        },
        tenant: {
          name: 'GeStockPro Enterprise',
          siret: '12345678901234',
          address: 'Dakar, Sénégal',
          phone: '+221 33 123 45 67',
          email: 'contact@gestockpro.com',
          currency: payrollSettings?.currency || 'F CFA',
          logoUrl: null,
          invoiceFooter: 'Bulletin généré automatiquement par GeStockPro'
        },
        salaryCalculation: {
          baseSalary: baseSalary,
          grossSalary: grossSalary,
          netSalary: netSalary,
          totalPrimes: totalPrimes,
          socialChargesEmployee: socialChargesEmployee,
          socialChargesEmployer: socialChargesEmployer,
          totalAdvanceDeductions: totalAdvanceDeductions,
          incomeTax: incomeTax,
          ruleDeductions: 0,
          currency: payrollSettings?.currency || 'F CFA'
        },
        month: currentPeriod.month,
        year: currentPeriod.year
      };

      setPreviewPayslipData(payslipData);
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error('Erreur lors de la préparation du bulletin:', error);
      setAlertMessage('Erreur lors de la prévisualisation du bulletin');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Fonction pour changer la période de paie
  const handleChangePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentPeriod.year, direction === 'next' ? currentPeriod.month : currentPeriod.month - 2, 1);
    setCurrentPeriod({
      month: newDate.getMonth() + 1,
      year: newDate.getFullYear(),
      displayName: newDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    });
  };

  const handleDownloadPayslip = async (payslip: any, format: 'pdf' | 'png' = 'pdf') => {
    try {
      const employee = employees.find(emp => emp.id === payslip.employeeId);
      if (!employee) return;

      // Utiliser fetch directement comme dans DocumentPreview.tsx pour un meilleur contrôle des erreurs
      const session = authBridge.getSession();
      const token = session?.token;

      //const url = new URL('https://gestock.realtechprint.com/api/hr/payslips/download');
      const url = new URL('http://localhost:3000/api/hr/payslips/download');
      url.searchParams.set('employeeId', payslip.employeeId);
      url.searchParams.set('month', payslip.month);
      url.searchParams.set('format', format);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Téléchargement échoué (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Bulletin_${employee.firstName}_${employee.lastName}_${payslip.month}.${format === 'pdf' ? 'pdf' : 'html'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setAlertMessage(`Bulletin téléchargé avec succès (${format.toUpperCase()})`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      setAlertMessage(error.message || 'Erreur lors du téléchargement du bulletin');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    }
  };

  // Fonction pour visualiser un bulletin
  const handleViewPayslip = (payslip: any) => {
    setSelectedPayslip(payslip);
    setIsPayslipViewModalOpen(true);
  };

  // Fonction pour régénérer un bulletin
  const handleRegeneratePayslip = async () => {
    if (!selectedPayslip) return;

    try {
      setRegeneratingPayslip(true);

      // Utiliser l'endpoint de génération existant pour régénérer
      await api.post('/hr/payslips/generate', {
        employeeId: selectedPayslip.employeeId,
        month: selectedPayslip.month
      });

      setIsRegenerateModalOpen(false);
      setAlertMessage('Bulletin régénéré avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      await loadPayslips();
    } catch (error: any) {
      console.error('Erreur lors de la régénération:', error);
      setAlertMessage(error.response?.data?.message || 'Erreur lors de la régénération');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setRegeneratingPayslip(false);
    }
  };

  // Fonction pour supprimer un bulletin
  const handleDeletePayslip = async (payslipId: string) => {
    try {
      await api.delete(`/hr/payslips/${payslipId}`);
      setAlertMessage('Bulletin supprimé avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      await loadPayslips();
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      setAlertMessage('Erreur lors de la suppression du bulletin');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    }
  };

  // Filtrer les bulletins
  const getFilteredPayslips = () => {
    return payslips.filter(payslip => {
      const matchesMonth = !payslipFilters.month || payslip.month === payslipFilters.month;
      const matchesEmployee = !payslipFilters.employeeId || payslip.employeeId === payslipFilters.employeeId;
      const matchesStatus = payslipFilters.status === 'ALL' || payslip.status === payslipFilters.status;
      return matchesMonth && matchesEmployee && matchesStatus;
    });
  };

  // Statistiques des bulletins
  const getPayslipStats = () => {
    const filtered = getFilteredPayslips();
    return {
      total: filtered.length,
      generated: filtered.filter(p => p.status === 'GENERATED').length,
      sent: filtered.filter(p => p.status === 'SENT').length,
      error: filtered.filter(p => p.status === 'ERROR').length
    };
  };

  // Gestion de la sélection des employés
  const handleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
    setSelectAll(!selectAll);
  };

  // Fonction pour calculer le salaire maximum d'avance
  const getMaxAdvanceAmount = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee?.hasActiveContract) {
      return 0; // Pas d'avance possible sans contrat actif
    }
    const salary = parseFloat(employee.currentSalary || 0);
    return isNaN(salary) || salary < 0 ? 0 : Math.round(salary * 100) / 100;
  };

  // Fonction pour filtrer les employés dans les modals (seulement ceux avec contrat actif)
  const getFilteredEmployees = (searchTerm: string, departmentFilter: string) => {
    return employees.filter(employee => {
      // Vérifier qu'il a un contrat actif et un salaire
      const hasValidContract = employee.hasActiveContract && (employee.currentSalary || 0) > 0;

      const matchesSearch = searchTerm === '' ||
        employee.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.matricule?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = departmentFilter === '' ||
        employee.departmentInfo?.name === departmentFilter;

      return hasValidContract && matchesSearch && matchesDepartment;
    });
  };

  // Obtenir la liste unique des départements
  const getDepartments = () => {
    const departments = employees
      .map(emp => emp.departmentInfo?.name)
      .filter(dept => dept)
      .filter((dept, index, self) => self.indexOf(dept) === index);
    return departments;
  };

  // Fonction pour filtrer les employés pour les primes (seulement ceux avec contrat actif)
  const getFilteredEmployeesForPrimes = () => {
    return employees.filter(employee => {
      // Vérifier qu'il a un contrat actif et un salaire
      const hasValidContract = employee.hasActiveContract && (employee.currentSalary || 0) > 0;

      const matchesSearch = primeEmployeeSearchTerm === '' ||
        employee.firstName?.toLowerCase().includes(primeEmployeeSearchTerm.toLowerCase()) ||
        employee.lastName?.toLowerCase().includes(primeEmployeeSearchTerm.toLowerCase()) ||
        employee.matricule?.toLowerCase().includes(primeEmployeeSearchTerm.toLowerCase());

      return hasValidContract && matchesSearch;
    });
  };

  // Fonction pour vérifier les prérequis avant le traitement de paie
  const checkPayrollPrerequisites = async () => {
    const errors = [];

    // 1. Vérifier que les rubriques de paie sont configurées
    try {
      const itemsResponse = await api.get('/hr/payroll-items');
      const items = itemsResponse?.data || itemsResponse || [];
      const activeItems = Array.isArray(items) ? items.filter(item => item.isActive !== false) : [];

      if (activeItems.length === 0) {
        errors.push('Aucune rubrique de paie configurée. Veuillez configurer les rubriques dans l\'onglet Paramétrage.');
      }
    } catch (error) {
      errors.push('Impossible de vérifier les rubriques de paie. Veuillez configurer le paramétrage.');
    }

    // 2. Vérifier qu'il y a au moins un employé actif
    try {
      const employeesResponse = await api.get('/hr/employees', { params: { status: 'ACTIVE' } });
      const employeesList = employeesResponse?.rows || employeesResponse || [];

      if (!Array.isArray(employeesList) || employeesList.length === 0) {
        errors.push('Aucun employé actif trouvé. Veuillez ajouter des employés avant de lancer la paie.');
      }
    } catch (error) {
      errors.push('Impossible de vérifier les employés. Veuillez vous assurer qu\'il y a des employés actifs.');
    }

    // 3. Vérifier qu'il y a au moins un contrat actif
    try {
      const contractsResponse = await api.get('/hr/contracts');
      const contractsList = contractsResponse?.rows || contractsResponse || [];
      const activeContracts = Array.isArray(contractsList) ? contractsList.filter(contract => contract.status === 'ACTIVE') : [];

      if (activeContracts.length === 0) {
        errors.push('Aucun contrat actif trouvé. Veuillez créer des contrats actifs pour vos employés.');
      }
    } catch (error) {
      errors.push('Impossible de vérifier les contrats. Veuillez vous assurer qu\'il y a des contrats actifs.');
    }

    return errors;
  };

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier que la confirmation est cochée
    if (!confirmPayroll) {
      setAlertMessage('Veuillez confirmer le lancement du traitement de paie');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier les prérequis avant de continuer
      console.log('Vérification des prérequis pour le traitement de paie...');
      const prerequisiteErrors = await checkPayrollPrerequisites();

      if (prerequisiteErrors.length > 0) {
        setIsLoading(false);
        setAlertMessage(`Prérequis manquants : ${prerequisiteErrors.join(' • ')}`);
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 8000);
        return;
      }

      // 4. Vérifier qu'il y a des employés avec contrat actif
      const employeesWithActiveContracts = employees.filter(emp =>
        emp.status === 'ACTIVE' && emp.hasActiveContract && (emp.currentSalary || 0) > 0
      );

      if (employeesWithActiveContracts.length === 0) {
        setIsLoading(false);
        setAlertMessage('Aucun employé avec contrat actif et salaire défini trouvé pour le traitement de paie.');
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 8000);
        return;
      }

      console.log(`Tous les prérequis sont remplis, lancement du traitement pour ${employeesWithActiveContracts.length} employé(s)...`);

    } catch (error) {
      setIsLoading(false);
      setAlertMessage('Erreur lors de la vérification des prérequis');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    try {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
      const currentYear = new Date().getFullYear();
      const currentMonthName = new Date().toLocaleDateString('fr-FR', { month: 'long' });

      console.log(`Lancement du traitement de paie pour ${currentMonthName} ${currentYear}`);

      // Appeler l'endpoint de génération de paie pour le mois courant
      // Traite automatiquement tous les employés avec contrat actif
      const response = await api.post('/hr/payroll/generate-monthly', {
        month: currentMonth,
        year: currentYear,
        includeAdvances: true,
        generateFiles: true,
        fileFormat: 'png' // jpg/png selon les besoins
      });

      const result = response.data || response;

      setIsGenModalOpen(false);
      setSelectedEmployees([]);
      setSelectAll(false);
      setConfirmPayroll(false);

      if (result.success) {
        const { processedEmployees, generatedFiles, totalAmount, skippedEmployees } = result;
        let message = `Traitement de paie terminé: ${processedEmployees} employé(s) traité(s)`;

        if (generatedFiles > 0) {
          message += `, ${generatedFiles} fiche(s) de paie générée(s)`;
        }

        if (totalAmount) {
          message += `. Montant total: ${totalAmount.toLocaleString('fr-FR')} F CFA`;
        }

        if (skippedEmployees && skippedEmployees.length > 0) {
          message += ` (${skippedEmployees.length} employé(s) sans contrat actif)`;
        }

        setAlertMessage(message);
      } else {
        setAlertMessage(`Traitement partiel: ${result.message || 'Certains employés n\'ont pas pu être traités'}`);
      }

      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 5000);

      // Recharger les données pour refléter les nouveaux bulletins
      await Promise.all([
        loadPayslips(),
        loadMonthlyDeductions(),
        loadEmployees()
      ]);

    } catch (error: any) {
      console.error('Erreur lors du traitement de paie:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors du traitement de la paie';
      setAlertMessage(`Erreur: ${errorMsg}`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedEmployees.length === 0) {
      setAlertMessage('Veuillez sélectionner au moins un employé');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    if (!advanceForm.amount || parseFloat(advanceForm.amount) <= 0) {
      setAlertMessage('Veuillez saisir un montant valide');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    if (!advanceForm.reason.trim()) {
      setAlertMessage('Veuillez saisir une raison pour l\'avance');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    // Validation du montant par rapport au salaire
    const amount = parseFloat(advanceForm.amount);
    const totalMonthlyAmount = amount * advanceForm.months;

    for (const employeeId of selectedEmployees) {
      const maxAmount = getMaxAdvanceAmount(employeeId) * advanceForm.months;
      if (totalMonthlyAmount > maxAmount) {
        const employee = employees.find(emp => emp.id === employeeId);
        setAlertMessage(`Le montant dépasse le salaire maximum pour ${employee?.firstName} ${employee?.lastName} (${maxAmount.toLocaleString('fr-FR')} F CFA pour ${advanceForm.months} mois)`);
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 5000);
        return;
      }
    }

    try {
      setIsLoading(true);

      // Créer une avance pour chaque employé sélectionné
      for (const employeeId of selectedEmployees) {
        await api.post('/hr/advances', {
          employeeId,
          amount: parseFloat(advanceForm.amount),
          months: advanceForm.months,
          reason: advanceForm.reason.trim(),
          currency: advanceForm.currency,
          status: 'PENDING'
        });
      }

      setIsAdvanceModalOpen(false);
      setAdvanceForm({ amount: '', months: 1, reason: '', currency: 'F CFA' });
      setSelectedEmployees([]);
      setSelectAll(false);
      setAlertMessage(`Avances créées pour ${selectedEmployees.length} employé(s)`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les avances
      await loadAdvances();
    } catch (error: any) {
      console.error('Erreur lors de la création des avances:', error);
      setAlertMessage(error.response?.data?.message || 'Erreur lors de la création des avances');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour sauvegarder une prime exceptionnelle
  const handleSavePrime = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!primeForm.employeeId) {
      setAlertMessage('Veuillez sélectionner un employé');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    if (!primeForm.amount || parseFloat(primeForm.amount) <= 0) {
      setAlertMessage('Veuillez saisir un montant valide');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    if (!primeForm.reason.trim()) {
      setAlertMessage('Veuillez expliquer la raison de cette prime');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    try {
      setIsLoading(true);

      await api.post('/hr/primes', {
        employeeId: primeForm.employeeId,
        amount: parseFloat(primeForm.amount),
        reason: primeForm.reason.trim(),
        type: primeForm.type,
        currency: primeForm.currency,
        status: 'APPROVED' // Les primes sont automatiquement approuvées
      });

      setIsPrimeModalOpen(false);
      setPrimeForm({ employeeId: '', amount: '', reason: '', type: 'PERFORMANCE', currency: 'F CFA' });
      setAlertMessage('Prime exceptionnelle créée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les primes
      await loadPrimes();
    } catch (error: any) {
      console.error('Erreur lors de la création de la prime:', error);
      setAlertMessage(error.response?.data?.message || 'Erreur lors de la création de la prime');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour sauvegarder les paramètres de paie
  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      await api.put('/hr/payroll-settings', {
        employerSocialChargeRate: parseFloat(settingsForm.employerSocialChargeRate.toString()),
        employeeSocialChargeRate: parseFloat(settingsForm.employeeSocialChargeRate.toString()),
        currency: settingsForm.currency,
        paymentDay: parseInt(settingsForm.paymentDay.toString()),
        workStartTime: settingsForm.workStartTime,
        workEndTime: settingsForm.workEndTime,
        workingDaysPerMonth: parseInt(settingsForm.workingDaysPerMonth.toString())
      });

      setIsSettingModalOpen(false);
      setAlertMessage('Paramètres de paie mis à jour avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les paramètres
      await loadPayrollSettings();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setAlertMessage('Erreur lors de la sauvegarde des paramètres');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour sauvegarder une nouvelle rubrique
  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      // Générer un code automatiquement basé sur le nom
      const code = newItemForm.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .substring(0, 20);

      await api.post('/hr/payroll-items', {
        name: newItemForm.name,
        code: code,
        type: newItemForm.type,
        category: newItemForm.category
      });

      setIsSettingModalOpen(false);
      setNewItemForm({ name: '', type: 'EARNING', category: 'ALLOWANCE' });
      setAlertMessage('Nouvelle rubrique créée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les rubriques
      await loadPayrollItems();
    } catch (error) {
      console.error('Erreur lors de la création de la rubrique:', error);
      setAlertMessage('Erreur lors de la création de la rubrique');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour éditer une rubrique existante
  const handleEditItem = (item: any) => {
    setEditingItem({
      ...item,
      name: item.name,
      type: item.type,
      category: item.category,
      isActive: item.isActive
    });
    setIsEditModalOpen(true);
  };

  // Fonction pour sauvegarder les modifications
  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setIsLoading(true);

      // Pour les éléments système, n'envoyer que le statut isActive
      const updateData = editingItem.isSystemItem
        ? { isActive: editingItem.isActive }
        : {
          name: editingItem.name,
          type: editingItem.type,
          category: editingItem.category,
          isActive: editingItem.isActive
        };

      await api.put(`/hr/payroll-items/${editingItem.id}`, updateData);

      setIsEditModalOpen(false);
      setEditingItem(null);
      setAlertMessage('Rubrique modifiée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les rubriques
      await loadPayrollItems();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      setAlertMessage('Erreur lors de la modification de la rubrique');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour confirmer la suppression
  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // Fonction pour supprimer définitivement
  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      setIsLoading(true);

      await api.delete(`/hr/payroll-items/${itemToDelete.id}`);

      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setAlertMessage('Rubrique supprimée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les rubriques
      await loadPayrollItems();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setAlertMessage('Erreur lors de la suppression de la rubrique');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour activer/désactiver une rubrique
  const handleToggleItemStatus = async (item: any) => {
    try {
      await api.patch(`/hr/payroll-items/${item.id}/toggle-status`);
      setAlertMessage(`Rubrique ${item.isActive ? 'désactivée' : 'activée'} avec succès`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les rubriques
      await loadPayrollItems();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };

  // Fonction pour ouvrir le modal d'approbation
  const handleApproveAdvance = (advance: any) => {
    setSelectedAdvance(advance);
    setIsApproveModalOpen(true);
  };

  // Fonction pour ouvrir le modal de rejet
  const handleRejectAdvance = (advance: any) => {
    setSelectedAdvance(advance);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  // Fonction pour confirmer l'approbation
  const confirmApprovalAdvance = async () => {
    if (!selectedAdvance) return;

    try {
      setIsLoading(true);
      await api.post(`/hr/advances/${selectedAdvance.id}/approve`, {});

      setIsApproveModalOpen(false);
      setSelectedAdvance(null);
      setAlertMessage('Avance approuvée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les avances
      await loadAdvances();

      // Recharger les déductions mensuelles
      if (employees.length > 0) {
        await loadMonthlyDeductions();
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'approbation:', error);
      setAlertMessage(error.response?.data?.message || 'Erreur lors de l\'approbation de l\'avance');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour confirmer le rejet
  const confirmRejectAdvance = async () => {
    if (!selectedAdvance || !rejectReason.trim()) {
      setAlertMessage('Veuillez indiquer la raison du rejet');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      return;
    }

    try {
      setIsLoading(true);
      await api.post(`/hr/advances/${selectedAdvance.id}/reject`, {
        reason: rejectReason.trim()
      });

      setIsRejectModalOpen(false);
      setSelectedAdvance(null);
      setRejectReason('');
      setAlertMessage('Avance rejetée avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);

      // Recharger les avances
      await loadAdvances();

      // Recharger les déductions mensuelles
      if (employees.length > 0) {
        await loadMonthlyDeductions();
      }
    } catch (error: any) {
      console.error('Erreur lors du rejet:', error);
      setAlertMessage(error.response?.data?.message || 'Erreur lors du rejet de l\'avance');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Success Alert */}
      <AnimatePresence>
        {showSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black uppercase text-[10px] tracking-widest"
          >
            <CheckCircle2 size={20} /> {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('rh')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestion de la Paie</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Traitement des salaires & charges</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <History size={16} /> Historique
          </button>
          {!paydayInfo.isPayday && (
            <div className="flex flex-col items-end mr-2">
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">Prochaine paie : {paydayInfo.nextPayDateStr}</span>
              <span className="text-[8px] text-slate-400 uppercase">Traitement groupé limité au jour J</span>
            </div>
          )}
          <button
            onClick={handleOpenGenModal}
            disabled={!paydayInfo.isPayday && authBridge.getSession()?.user?.role !== 'ADMIN'} // Allow ADMIN to bypass for emergencies if needed
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95 ${paydayInfo.isPayday
                ? "bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-200"
                : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 shadow-none border border-slate-200"
              }`}
            title={!paydayInfo.isPayday ? `Disponible uniquement le ${paydayInfo.payDay} du mois` : "Lancer le traitement de la paie"}
          >
            <Play size={16} /> {paydayInfo.isPayday ? "Lancer Traitement" : "En attente du " + paydayInfo.payDay}
          </button>
        </div>
      </div>

      {/* ══════  BANDEAU JOUR DE PAIE  ══════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-[2rem] border p-5 flex items-center gap-4 ${paydayInfo.isPayday
          ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
          : paydayInfo.isSoon
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
            : 'bg-gradient-to-r from-slate-50 to-indigo-50 border-slate-200'
          }`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${paydayInfo.isPayday
          ? 'bg-emerald-500 text-white'
          : paydayInfo.isSoon
            ? 'bg-amber-500 text-white'
            : 'bg-white text-indigo-500'
          }`}>
          {paydayInfo.isPayday ? <DollarSign size={22} /> : <Clock size={22} />}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-black uppercase tracking-tight ${paydayInfo.isPayday ? 'text-emerald-800' : paydayInfo.isSoon ? 'text-amber-800' : 'text-slate-800'
            }`}>
            {paydayInfo.isPayday
              ? '🎉 C\'est le jour de paie !'
              : paydayInfo.isSoon
                ? `⏰ Paie dans ${paydayInfo.diffDays} jour${paydayInfo.diffDays > 1 ? 's' : ''}`
                : `Prochain jour de paie : le ${paydayInfo.nextPayDateStr}`
            }
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${paydayInfo.isPayday ? 'text-emerald-600' : paydayInfo.isSoon ? 'text-amber-600' : 'text-slate-400'
            }`}>
            Jour de versement configuré : le {paydayInfo.payDay} de chaque mois
          </p>
        </div>
        {paydayInfo.isPayday && (
          <button
            onClick={handleOpenGenModal}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
          >
            <Play size={14} /> Lancer la Paie
          </button>
        )}
      </motion.div>

      {/* Generation Modal */}
      <HRModal
        isOpen={isGenModalOpen}
        onClose={() => { setIsGenModalOpen(false); setPrePayrollData(null); }}
        title="Lancer le traitement de la paie"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setIsGenModalOpen(false);
                setConfirmPayroll(false);
                setPrePayrollData(null);
              }}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleRunPayroll}
              disabled={!confirmPayroll || isLoading || loadingPrePayroll}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Traitement en cours...' : 'Démarrer le Traitement'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Période */}
          <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Période : {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Traitement automatique - Employés avec contrat actif
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Le traitement va calculer automatiquement les salaires de tous les employés avec contrat actif,
              incluant les avances, primes et charges sociales, puis générer les fiches de paie.
            </p>
          </div>

          {/* ══════  VÉRIFICATION PRÉ-PAIE  ══════ */}
          <div className="rounded-[2rem] border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserCheck size={20} className="text-indigo-500" />
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Vérification des heures & présence</h4>
              </div>
              {loadingPrePayroll && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <RefreshCw size={14} className="animate-spin" /> Vérification...
                </div>
              )}
            </div>

            {prePayrollData && !loadingPrePayroll && (
              <div className="p-5 space-y-4">
                {/* Résumé global */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-2xl font-black text-emerald-700">{prePayrollData.summary?.readyForFullPay || 0}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                      <CheckCircle size={12} /> Salaire complet
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                    <p className="text-2xl font-black text-amber-700">{prePayrollData.summary?.readyForPartialPay || 0}</p>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle size={12} /> Avertissements
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                    <p className="text-2xl font-black text-red-700">{prePayrollData.summary?.blocked || 0}</p>
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                      <UserX size={12} /> Bloqués
                    </p>
                  </div>
                </div>

                {/* Détail par employé (toggle) */}
                <button
                  onClick={() => setShowPrePayrollDetails(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <span>Détail par employé ({prePayrollData.employees?.length || 0})</span>
                  {showPrePayrollDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <AnimatePresence>
                  {showPrePayrollDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {(prePayrollData.employees || []).map((emp: any, idx: number) => {
                          const isReady = emp.eligibility?.isEligibleForFullPay;
                          const isBlocked = emp.eligibility?.isBlocked;
                          const isWarning = !isReady && !isBlocked;
                          return (
                            <div
                              key={emp.employeeId || idx}
                              className={`p-4 rounded-2xl border flex items-start gap-3 ${isReady
                                ? 'bg-emerald-50/50 border-emerald-100'
                                : isBlocked
                                  ? 'bg-red-50/50 border-red-100'
                                  : 'bg-amber-50/50 border-amber-100'
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${isReady ? 'bg-emerald-500 text-white' : isBlocked ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                }`}>
                                {isReady ? <CheckCircle size={16} /> : isBlocked ? <UserX size={16} /> : <AlertTriangle size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {emp.employeeName || 'Employé'}
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                  <p className="text-[10px] text-slate-500">
                                    <span className="font-bold">Présence:</span> {emp.attendance?.attendanceRate || 0}%
                                    ({emp.attendance?.presentDays || 0}/{emp.attendance?.totalWorkDaysInPeriod || 0} jours)
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    <span className="font-bold">Heures:</span> {emp.hours?.totalWorkedHours || 0}h
                                    / {emp.hours?.expectedMonthlyHours || 0}h attendues
                                  </p>
                                  {emp.attendance?.lateDays > 0 && (
                                    <p className="text-[10px] text-amber-600 font-bold">
                                      ⚠ {emp.attendance.lateDays} jour(s) de retard
                                    </p>
                                  )}
                                  {emp.attendance?.totalAbsentDays > 0 && (
                                    <p className="text-[10px] text-red-600 font-bold">
                                      ✗ {emp.attendance.totalAbsentDays} jour(s) d'absence
                                    </p>
                                  )}
                                </div>
                                {emp.warnings && emp.warnings.length > 0 && (
                                  <div className="mt-2 space-y-0.5">
                                    {emp.warnings.map((w: string, i: number) => (
                                      <p key={i} className="text-[9px] text-amber-700 font-medium">• {w}</p>
                                    ))}
                                  </div>
                                )}
                                {isReady && (
                                  <p className="text-[10px] text-emerald-700 font-bold mt-1">
                                    ✓ Heures complètes — éligible au salaire complet
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">Traitement Automatique</h4>
                  <div className="text-xs text-amber-700 mt-2 space-y-1">
                    <p>• Seuls les employés avec contrat actif seront traités</p>
                    <p>• Les avances du mois seront automatiquement déduites</p>
                    <p>• Les primes du mois seront incluses dans le calcul</p>
                    <p>• Les fiches de paie seront générées au format PNG</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="confirm"
                checked={confirmPayroll}
                onChange={(e) => setConfirmPayroll(e.target.checked)}
                className="w-5 h-5 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="confirm" className="text-xs font-bold text-slate-700">
                J'ai vérifié la présence des employés et confirme le lancement du traitement
              </label>
            </div>
          </div>
        </div>
      </HRModal>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[2rem] w-fit overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'generation' && (
            <div className="space-y-8">
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                      <Calendar className="text-indigo-500" /> Paie en cours : {currentPeriod.displayName}
                    </h3>
                    <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">En préparation</span>
                  </div>

                  <div className="space-y-8">
                    <div className="grid sm:grid-cols-3 gap-8">
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Effectif à payer</p>
                        <p className="text-3xl font-black text-slate-900">
                          {employees.filter(emp => emp.status === 'ACTIVE' && emp.hasActiveContract).length}
                        </p>
                        <p className="text-[8px] text-slate-400 font-medium mt-1">
                          ({employees.filter(emp => emp.status === 'ACTIVE' && !emp.hasActiveContract).length} sans contrat)
                        </p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Masse Brute Est.</p>
                        <p className="text-3xl font-black text-slate-900">
                          {(() => {
                            const validateAmount = (amount: any): number => {
                              const num = parseFloat(amount || 0);
                              return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
                            };
                            const total = employees
                              .filter(emp => emp.status === 'ACTIVE' && emp.hasActiveContract)
                              .reduce((sum, emp) => sum + validateAmount(emp.currentSalary), 0);
                            return total.toLocaleString('fr-FR');
                          })()} F CFA
                        </p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Charges Est.</p>
                        <p className="text-3xl font-black text-slate-900">
                          {(() => {
                            const validateAmount = (amount: any): number => {
                              const num = parseFloat(amount || 0);
                              return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
                            };
                            const total = employees
                              .filter(emp => emp.status === 'ACTIVE' && emp.hasActiveContract)
                              .reduce((sum, emp) => sum + (validateAmount(emp.currentSalary) * 0.27), 0);
                            return total.toLocaleString('fr-FR');
                          })()} F CFA
                        </p>
                      </div>
                    </div>

                    <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                          <Play size={28} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Prêt pour le calcul global</h4>
                          <p className="text-xs font-medium text-slate-500">
                            {advances.filter(a => a.status === 'APPROVED').length} avances approuvées, {primes.length} primes du mois.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsGenModalOpen(true)}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
                      >
                        Calculer la Paie
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full"></div>
                  <h3 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                    <AlertCircle className="text-amber-400" /> Vérifications Pré-Paie
                  </h3>
                  <div className="space-y-6 relative z-10">
                    {(() => {
                      const anomalies = [];

                      // Vérifier les employés sans contrat actif
                      const noContractEmps = employees.filter(emp => emp.status === 'ACTIVE' && !emp.hasActiveContract);
                      noContractEmps.forEach(emp => {
                        anomalies.push({
                          emp: `${emp.firstName} ${emp.lastName}`,
                          issue: 'Aucun contrat actif',
                          type: 'CRITICAL'
                        });
                      });

                      // Vérifier les employés avec contrat mais sans salaire de base défini
                      const noSalaryEmps = employees.filter(emp =>
                        emp.status === 'ACTIVE' && emp.hasActiveContract && (!emp.currentSalary || emp.currentSalary === 0)
                      );
                      noSalaryEmps.forEach(emp => {
                        anomalies.push({
                          emp: `${emp.firstName} ${emp.lastName}`,
                          issue: 'Salaire non défini dans le contrat',
                          type: 'CRITICAL'
                        });
                      });

                      // Vérifier les primes exceptionnelles
                      primes.filter(prime => prime.amount > 500000).forEach(prime => {
                        const emp = employees.find(e => e.id === prime.employeeId);
                        if (emp) {
                          anomalies.push({
                            emp: `${emp.firstName} ${emp.lastName}`,
                            issue: `Prime exceptionnelle: ${(prime.amount / 1000).toFixed(0)}K F CFA`,
                            type: 'WARNING'
                          });
                        }
                      });

                      return anomalies.length > 0 ? anomalies.slice(0, 3).map((anomaly, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${anomaly.type === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">{anomaly.emp}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{anomaly.issue}</p>
                          </div>
                        </div>
                      )) : [
                        <div key="no-issues" className="flex items-start gap-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-emerald-300">Aucune anomalie détectée</p>
                            <p className="text-[10px] text-emerald-400 font-medium">Tous les employés sont prêts pour le traitement</p>
                          </div>
                        </div>
                      ];
                    })()}
                    <div className="pt-4">
                      <button
                        onClick={() => onNavigate('rh', { tab: 'employees' })}
                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
                      >
                        Gérer les employés
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <Users className="text-indigo-500" /> Détail par Employé
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadAllZip}
                      disabled={zipDownloading || employees.filter(e => e.hasActiveContract).length === 0}
                      className="px-6 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50 flex items-center gap-2"
                      title="Télécharger toutes les fiches de paie du mois en ZIP"
                    >
                      {zipDownloading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <FolderDown size={14} />
                      )}
                      {zipDownloading ? 'Génération…' : 'Tout en ZIP'}
                    </button>
                    <button
                      onClick={() => {
                        if (employees.length > 0) {
                          handlePreviewPayslip(employees.find(emp => emp.status === 'ACTIVE'));
                        }
                      }}
                      disabled={employees.length === 0}
                      className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      <Eye size={14} className="inline mr-2" /> Prévisualiser
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                        <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire Base</th>
                        <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Primes</th>
                        <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avances</th>
                        <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Estimé</th>
                        <th className="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees
                        .filter(emp => emp.status === 'ACTIVE')
                        .sort((a, b) => {
                          // Employés avec contrat actif en premier
                          if (a.hasActiveContract && !b.hasActiveContract) return -1;
                          if (!a.hasActiveContract && b.hasActiveContract) return 1;
                          return 0;
                        })
                        .slice(0, 15).map((employee, i) => {
                          // Fonction pour valider les montants dans la liste des employés
                          const validateAmount = (amount: any): number => {
                            const num = parseFloat(amount || 0);
                            return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
                          };

                          const employeePrimes = primes.filter(p => p.employeeId === employee.id && p.status === 'APPROVED');
                          const employeeAdvances = advances.filter(a => a.employeeId === employee.id && a.status === 'APPROVED');
                          const totalPrimes = employeePrimes.reduce((sum, p) => sum + validateAmount(p.amount), 0);
                          // Calculer les déductions mensuelles des avances
                          const totalAdvances = employeeAdvances.reduce((sum, a) => {
                            const monthlyDeduction = validateAmount(a.monthlyDeduction) > 0
                              ? validateAmount(a.monthlyDeduction)
                              : validateAmount(a.amount) / Math.max(1, a.months || 1);
                            return sum + monthlyDeduction;
                          }, 0);
                          const baseSalary = validateAmount(employee.currentSalary);
                          const socialChargeRate = validateAmount(payrollSettings?.employeeSocialChargeRate) || 8.2;
                          const socialCharges = Math.round(baseSalary * socialChargeRate) / 100;
                          const netEstimated = Math.max(0, baseSalary + totalPrimes - totalAdvances - socialCharges);

                          const contractInfo = employee.activeContract ? {
                            type: employee.activeContract.type || 'N/A',
                            startDate: employee.activeContract.startDate ? new Date(employee.activeContract.startDate).toLocaleDateString('fr-FR') : 'N/A'
                          } : null;

                          return (
                            <tr key={employee.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!employee.hasActiveContract ? 'opacity-60 bg-red-50' : ''
                              }`}>
                              <td className="py-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center relative">
                                    {employee.photoUrl ? (
                                      <img src={employee.photoUrl} className="w-full h-full object-cover" alt={employee.firstName} referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="text-xs font-bold text-slate-500">
                                        {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                                      </span>
                                    )}
                                    {!employee.hasActiveContract && (
                                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" title="Pas de contrat actif" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-slate-900">{employee.firstName} {employee.lastName}</span>
                                      {contractInfo && (
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase">
                                          {contractInfo.type}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                      {employee.departmentInfo?.name || 'N/A'}
                                      {!employee.hasActiveContract && ' • SANS CONTRAT'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className="text-sm font-bold text-slate-900">
                                  {baseSalary > 0 ? `${baseSalary.toLocaleString('fr-FR')} F CFA` : '-'}
                                </div>
                                {contractInfo && (
                                  <p className="text-[8px] text-slate-400 font-medium">
                                    du {contractInfo.startDate}
                                  </p>
                                )}
                              </td>
                              <td className="py-6 text-sm font-bold text-emerald-600">
                                {totalPrimes > 0 ? `+${totalPrimes.toLocaleString('fr-FR')} F CFA` : '-'}
                              </td>
                              <td className="py-6 text-sm font-bold text-rose-600">
                                {totalAdvances > 0 ? `-${totalAdvances.toLocaleString('fr-FR')} F CFA` : '-'}
                              </td>
                              <td className="py-6 text-sm font-black text-slate-900">
                                {employee.hasActiveContract && baseSalary > 0 ? `${netEstimated.toLocaleString('fr-FR')} F CFA` : 'N/A'}
                              </td>
                              <td className="py-6 text-right">
                                <button
                                  onClick={() => handlePreviewPayslip(employee)}
                                  disabled={!employee.hasActiveContract || baseSalary === 0}
                                  className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={employee.hasActiveContract ? "Prévisualiser le bulletin" : "Contrat requis"}
                                >
                                  <Eye size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      {employees.filter(emp => emp.status === 'ACTIVE').length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-4">
                              <Users className="text-slate-300" size={48} />
                              <p className="text-sm font-bold">Aucun employé actif trouvé</p>
                              <button
                                onClick={() => onNavigate('rh', { tab: 'employees' })}
                                className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                              >
                                Gérer les employés
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {employees.filter(emp => emp.status === 'ACTIVE').length > 0 &&
                        employees.filter(emp => emp.status === 'ACTIVE' && emp.hasActiveContract).length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center">
                              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mx-4">
                                <div className="flex items-center justify-center gap-3 text-amber-600 mb-3">
                                  <AlertCircle size={20} />
                                  <span className="text-sm font-bold">Aucun contrat actif</span>
                                </div>
                                <p className="text-xs text-amber-700 mb-4">
                                  Les employés actifs n'ont pas de contrat valide pour le traitement de paie
                                </p>
                                <button
                                  onClick={() => onNavigate('rh', { tab: 'contracts' })}
                                  className="px-6 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-all"
                                >
                                  Gérer les contrats
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-10 flex items-center gap-3">
                  <Globe className="text-indigo-500" /> Paramétrage Pays (Sénégal)
                </h3>
                <div className="space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Charges Sociales (Employeur)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={settingsForm.employerSocialChargeRate}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, employerSocialChargeRate: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Charges Sociales (Salarié)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={settingsForm.employeeSocialChargeRate}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, employeeSocialChargeRate: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Devise de Paie</label>
                    <select
                      value={settingsForm.currency}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    >
                      <option value="F CFA">F CFA (XOF)</option>
                      <option value="EUR">Euro (€)</option>
                      <option value="USD">US Dollar ($)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jour de Paie</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={settingsForm.paymentDay}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, paymentDay: parseInt(e.target.value) || 28 }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    />
                    <p className="text-[9px] text-slate-400 font-medium">Jour du mois où la paie est versée (1-31)</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heure de Début</label>
                      <input
                        type="time"
                        value={settingsForm.workStartTime}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, workStartTime: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heure de Fin</label>
                      <input
                        type="time"
                        value={settingsForm.workEndTime}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, workEndTime: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jours Ouvrables / Mois</label>
                    <input
                      type="number"
                      min="20"
                      max="31"
                      value={settingsForm.workingDaysPerMonth}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, workingDaysPerMonth: parseInt(e.target.value) || 26 }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    />
                    <p className="text-[9px] text-slate-400 font-medium">Nombre de jours travaillés par mois (pour calcul taux journalier)</p>
                  </div>
                  <div className="pt-6">
                    <button
                      onClick={handleSaveSetting}
                      className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                    >
                      Enregistrer les paramètres pays
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <Layers className="text-indigo-500" /> Rubriques de Paie
                  </h3>
                  <button
                    onClick={() => setIsSettingModalOpen(true)}
                    className="w-10 h-10 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <HRModal
                  isOpen={isSettingModalOpen}
                  onClose={() => setIsSettingModalOpen(false)}
                  title="Nouvelle Rubrique de Paie"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button onClick={() => setIsSettingModalOpen(false)} className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Annuler</button>
                      <button
                        onClick={handleSaveNewItem}
                        disabled={isLoading}
                        className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Ajout...' : 'Ajouter'}
                      </button>
                    </div>
                  }
                >
                  <form className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom de la Rubrique</label>
                      <input
                        type="text"
                        placeholder="Ex: Prime de Panier"
                        value={newItemForm.name}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</label>
                        <select
                          value={newItemForm.type}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        >
                          <option value="EARNING">Gain (Earning)</option>
                          <option value="DEDUCTION">Retenue (Deduction)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie</label>
                        <select
                          value={newItemForm.category}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        >
                          {newItemForm.type === 'EARNING' ? (
                            <>
                              <option value="ALLOWANCE">Indemnité</option>
                              <option value="BONUS">Prime</option>
                              <option value="OVERTIME">Heures supplémentaires</option>
                              <option value="OTHER">Autre</option>
                            </>
                          ) : (
                            <>
                              <option value="SOCIAL_CHARGE">Charge Sociale</option>
                              <option value="TAX">Taxe</option>
                              <option value="ADVANCE">Avance</option>
                              <option value="OTHER">Autre</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  </form>
                </HRModal>

                {/* Edit Modal */}
                <HRModal
                  isOpen={isEditModalOpen}
                  onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  title="Modifier la Rubrique de Paie"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsEditModalOpen(false);
                          setEditingItem(null);
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveEditItem}
                        disabled={isLoading}
                        className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Modification...' : 'Modifier'}
                      </button>
                    </div>
                  }
                >
                  {editingItem && (
                    <form className="space-y-6">
                      {editingItem.isSystemItem ? (
                        // Pour les éléments système, afficher seulement le statut et une information
                        <div className="space-y-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-4 w-4 text-amber-600" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Rubrique Système</span>
                            </div>
                            <p className="text-xs text-amber-700">Cette rubrique fait partie du système de paie. Seul le statut actif/inactif peut être modifié.</p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom (non modifiable)</label>
                            <input
                              type="text"
                              value={editingItem.name}
                              disabled
                              className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl font-bold text-sm text-slate-500 cursor-not-allowed"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type (non modifiable)</label>
                              <input
                                type="text"
                                value={editingItem.type === 'EARNING' ? 'Gain (Earning)' : 'Retenue (Deduction)'}
                                disabled
                                className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl font-bold text-sm text-slate-500 cursor-not-allowed"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie (non modifiable)</label>
                              <input
                                type="text"
                                value={editingItem.category}
                                disabled
                                className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl font-bold text-sm text-slate-500 cursor-not-allowed"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="editActive"
                              checked={editingItem.isActive}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, isActive: e.target.checked }))}
                              className="w-5 h-5 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="editActive" className="text-xs font-bold text-slate-700">Rubrique active</label>
                          </div>
                        </div>
                      ) : (
                        // Pour les éléments non-système, afficher tous les champs
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom de la Rubrique</label>
                            <input
                              type="text"
                              placeholder="Ex: Prime de Panier"
                              value={editingItem.name}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</label>
                              <select
                                value={editingItem.type}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                              >
                                <option value="EARNING">Gain (Earning)</option>
                                <option value="DEDUCTION">Retenue (Deduction)</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie</label>
                              <select
                                value={editingItem.category}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                              >
                                {editingItem.type === 'EARNING' ? (
                                  <>
                                    <option value="ALLOWANCE">Indemnité</option>
                                    <option value="BONUS">Prime</option>
                                    <option value="OVERTIME">Heures supplémentaires</option>
                                    <option value="OTHER">Autre</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="SOCIAL_CHARGE">Charge Sociale</option>
                                    <option value="TAX">Taxe</option>
                                    <option value="ADVANCE">Avance</option>
                                    <option value="OTHER">Autre</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="editActive"
                              checked={editingItem.isActive}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, isActive: e.target.checked }))}
                              className="w-5 h-5 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="editActive" className="text-xs font-bold text-slate-700">Rubrique active</label>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </HRModal>

                {/* Delete Confirmation Modal */}
                <HRModal
                  isOpen={isDeleteModalOpen}
                  onClose={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                  }}
                  title="Confirmer la suppression"
                  size="sm"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                          setItemToDelete(null);
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmDeleteItem}
                        disabled={isLoading || (itemToDelete && itemToDelete.isSystemItem)}
                        className="px-4 md:px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  }
                >
                  {itemToDelete && (
                    <div className="space-y-4">
                      <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                            <AlertCircle size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">Êtes-vous sûr de vouloir supprimer cette rubrique ?</p>
                            <p className="text-xs text-slate-600 mt-1">"{itemToDelete.name}" - Cette action est irréversible.</p>
                          </div>
                        </div>
                      </div>
                      {itemToDelete.isSystemItem && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-xs text-amber-700 font-medium">⚠️ Attention : Cette rubrique système ne peut pas être supprimée.</p>
                        </div>
                      )}
                    </div>
                  )}
                </HRModal>

                <div className="space-y-4">
                  {(!payrollItems || payrollItems.length === 0) ? (
                    <div className="text-center py-8">
                      <p className="text-slate-400 font-medium">Aucune rubrique configurée</p>
                      <button
                        onClick={async () => {
                          try {
                            await api.post('/hr/payroll-items/initialize-defaults', {});
                            await loadPayrollItems();
                            setAlertMessage('Rubriques par défaut initialisées');
                            setShowSuccessAlert(true);
                            setTimeout(() => setShowSuccessAlert(false), 3000);
                          } catch (error) {
                            console.error('Erreur initialisation:', error);
                          }
                        }}
                        className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
                      >
                        Initialiser les rubriques par défaut
                      </button>
                    </div>
                  ) : (
                    (payrollItems || []).map((item: any, i: number) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${item.type === 'EARNING' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleItemStatus(item)}
                            className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${item.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            title={`${item.isActive ? 'Désactiver' : 'Activer'} la rubrique`}
                          >
                            {item.isActive ? 'Actif' : 'Inactif'}
                          </button>

                          <button
                            onClick={() => handleEditItem(item)}
                            className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                            title="Modifier la rubrique"
                          >
                            <Settings size={14} />
                          </button>

                          {!item.isSystemItem && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 transition-all"
                              title="Supprimer la rubrique"
                            >
                              <X size={14} />
                            </button>
                          )}

                          {item.isSystemItem && (
                            <div className="w-8 h-8 flex items-center justify-center text-slate-300" title="Rubrique système - Non supprimable">
                              <Settings size={14} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'slips' && (
            <div className="space-y-8">
              {/* Filtres et statistiques */}
              <div className="grid lg:grid-cols-4 gap-6">
                {/* Statistiques */}
                {(() => {
                  const stats = getPayslipStats();
                  return (
                    <>
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <FileCheck size={24} />
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bulletins</p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <CheckCircle size={24} />
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-slate-900">{stats.generated}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Générés</p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Send size={24} />
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-slate-900">{stats.sent}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Envoyés</p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                            <AlertTriangle size={24} />
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-slate-900">{stats.error}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Erreurs</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Filtres */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Mois de Paie
                    </label>
                    <input
                      type="month"
                      value={payslipFilters.month}
                      onChange={(e) => {
                        setPayslipFilters(prev => ({ ...prev, month: e.target.value }));
                        loadPayslips();
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Employé
                    </label>
                    <select
                      value={payslipFilters.employeeId}
                      onChange={(e) => {
                        setPayslipFilters(prev => ({ ...prev, employeeId: e.target.value }));
                        loadPayslips();
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    >
                      <option value="">Tous les employés</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Statut
                    </label>
                    <select
                      value={payslipFilters.status}
                      onChange={(e) => {
                        setPayslipFilters(prev => ({ ...prev, status: e.target.value }));
                        loadPayslips();
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    >
                      <option value="ALL">Tous les statuts</option>
                      <option value="GENERATED">Générés</option>
                      <option value="SENT">Envoyés</option>
                      <option value="ERROR">Erreurs</option>
                    </select>
                  </div>

                  <button
                    onClick={loadPayslips}
                    disabled={loadingPayslips}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingPayslips ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    Filtrer
                  </button>
                </div>
              </div>

              {/* Liste des bulletins */}
              <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                        Consultation des Bulletins
                      </h3>
                      <p className="text-slate-500 font-medium text-sm">
                        {getFilteredPayslips().length} bulletin(s) trouvé(s)
                      </p>
                    </div>
                  </div>
                </div>

                {loadingPayslips ? (
                  <div className="p-20 text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-slate-400" size={32} />
                    <p className="text-slate-500">Chargement des bulletins...</p>
                  </div>
                ) : getFilteredPayslips().length === 0 ? (
                  <div className="p-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <FileCheck size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun bulletin trouvé</h3>
                    <p className="text-slate-500">Aucun bulletin ne correspond aux critères sélectionnés.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Employé
                          </th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Mois
                          </th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Salaire Net
                          </th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Statut
                          </th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Généré le
                          </th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getFilteredPayslips().map((payslip, index) => {
                          const employee = employees.find(emp => emp.id === payslip.employeeId);
                          return (
                            <tr key={payslip.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-200 rounded-lg overflow-hidden">
                                    <img
                                      src={employee?.photoUrl || `https://picsum.photos/seed/${payslip.employeeId}/100/100`}
                                      alt={employee?.firstName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {employee ? `${employee.firstName} ${employee.lastName}` : 'Employé introuvable'}
                                    </p>
                                    <p className="text-xs text-slate-500">{employee?.position}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">
                                  {new Date(payslip.month + '-01').toLocaleDateString('fr-FR', {
                                    year: 'numeric',
                                    month: 'long'
                                  })}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">
                                  {payslip.netSalary ? `${payslip.netSalary.toLocaleString('fr-FR')} F CFA` : 'N/A'}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${payslip.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-600' :
                                  payslip.status === 'SENT' ? 'bg-blue-50 text-blue-600' :
                                    payslip.status === 'ERROR' ? 'bg-red-50 text-red-600' :
                                      'bg-slate-50 text-slate-600'
                                  }`}>
                                  {payslip.status === 'GENERATED' ? 'Généré' :
                                    payslip.status === 'SENT' ? 'Envoyé' :
                                      payslip.status === 'ERROR' ? 'Erreur' :
                                        payslip.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-slate-600">
                                  {payslip.createdAt ? new Date(payslip.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleViewPayslip(payslip)}
                                    className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-all"
                                    title="Visualiser"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadPayslip(payslip, 'pdf')}
                                    className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-100 transition-all"
                                    title="Télécharger PDF"
                                  >
                                    <Download size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadPayslip(payslip, 'png')}
                                    className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center hover:bg-purple-100 transition-all"
                                    title="Télécharger Image"
                                  >
                                    <Image size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedPayslip(payslip);
                                      setIsRegenerateModalOpen(true);
                                    }}
                                    className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-all"
                                    title="Régénérer"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayslip(payslip.id)}
                                    className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'advances' && (
            <div className="space-y-8">
              {/* Section des Avances sur Salaire */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <CreditCard className="text-indigo-500" /> Avances sur Salaire
                  </h3>
                  <button
                    onClick={() => setIsAdvanceModalOpen(true)}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                  >
                    <Plus size={16} /> Nouvelle Avance
                  </button>
                </div>

                {/* Modal Avances */}
                <HRModal
                  isOpen={isAdvanceModalOpen}
                  onClose={() => {
                    setIsAdvanceModalOpen(false);
                    setSelectedEmployees([]);
                    setSelectAll(false);
                    setAdvanceForm({ amount: '', months: 1, reason: '', currency: 'F CFA' });
                    setEmployeeSearchTerm('');
                    setSelectedDepartment('');
                  }}
                  title="Nouvelle Demande d'Avance sur Salaire"
                  size="lg"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsAdvanceModalOpen(false);
                          setSelectedEmployees([]);
                          setSelectAll(false);
                          setAdvanceForm({ amount: '', months: 1, reason: '', currency: 'F CFA' });
                          setEmployeeSearchTerm('');
                          setSelectedDepartment('');
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveAdvance}
                        disabled={isLoading || selectedEmployees.length === 0}
                        className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Enregistrement...' : `Créer ${selectedEmployees.length} Avance(s)`}
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-8">
                    {/* Sélection des employés */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sélection des Employés</label>
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {selectAll ? 'Désélectionner tout' : 'Sélectionner tout'}
                        </button>
                      </div>

                      {/* Filtres de recherche */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="text"
                            placeholder="Rechercher par nom ou matricule..."
                            value={employeeSearchTerm}
                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <select
                          value={selectedDepartment}
                          onChange={(e) => setSelectedDepartment(e.target.value)}
                          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        >
                          <option value="">Tous les départements</option>
                          {getDepartments().map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div className="max-h-64 overflow-y-auto bg-slate-50 rounded-2xl p-4 space-y-3">
                        {getFilteredEmployees(employeeSearchTerm, selectedDepartment).map((employee) => {
                          const isSelected = selectedEmployees.includes(employee.id);
                          const maxAmount = getMaxAdvanceAmount(employee.id);
                          return (
                            <div
                              key={employee.id}
                              onClick={() => handleEmployeeSelection(employee.id)}
                              className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-100 border-2 border-indigo-300' : 'bg-white border-2 border-transparent hover:bg-slate-50'
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleEmployeeSelection(employee.id)}
                                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{employee.firstName} {employee.lastName}</p>
                                  <p className="text-xs text-slate-500">{employee.position} • {employee.departmentInfo?.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-900">{maxAmount.toLocaleString('fr-FR')} F CFA</p>
                                <p className="text-xs text-slate-500">Salaire actuel</p>
                              </div>
                            </div>
                          );
                        })}
                        {getFilteredEmployees(employeeSearchTerm, selectedDepartment).length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-sm font-medium">
                              {employees.length === 0 ? 'Aucun employé disponible' : 'Aucun employé ne correspond aux filtres'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Détails de l'avance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Montant par employé</label>
                        <input
                          type="number"
                          placeholder="Ex: 200000"
                          value={advanceForm.amount}
                          onChange={(e) => setAdvanceForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre de mois</label>
                        <select
                          value={advanceForm.months}
                          onChange={(e) => setAdvanceForm(prev => ({ ...prev, months: parseInt(e.target.value) }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                        >
                          <option value={1}>1 mois</option>
                          <option value={2}>2 mois</option>
                          <option value={3}>3 mois</option>
                          <option value={6}>6 mois</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raison de l'avance *</label>
                      <textarea
                        placeholder="Ex: Avance pour frais médicaux urgents, Achat de véhicule, etc."
                        value={advanceForm.reason}
                        onChange={(e) => setAdvanceForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm resize-none"
                        rows={3}
                      />
                    </div>

                    {selectedEmployees.length > 0 && advanceForm.amount && (
                      <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-200">
                        <h4 className="text-sm font-black text-indigo-900 mb-4 uppercase tracking-widest">Récapitulatif</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Employés sélectionnés:</span>
                            <span className="font-bold text-slate-900">{selectedEmployees.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Montant par employé:</span>
                            <span className="font-bold text-slate-900">{parseFloat(advanceForm.amount || '0').toLocaleString('fr-FR')} F CFA</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Période:</span>
                            <span className="font-bold text-slate-900">{advanceForm.months} mois</span>
                          </div>
                          <div className="flex justify-between border-t border-indigo-200 pt-2">
                            <span className="text-indigo-900 font-black">Total général:</span>
                            <span className="font-black text-indigo-900">{(parseFloat(advanceForm.amount || '0') * selectedEmployees.length * advanceForm.months).toLocaleString('fr-FR')} F CFA</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </HRModal>

                {/* Liste des avances */}
                <div className="space-y-4">
                  {advances.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h4 className="text-lg font-bold text-slate-600 mb-2">Aucune avance enregistrée</h4>
                      <p className="text-slate-500 text-sm">Cliquez sur "Nouvelle Avance" pour commencer</p>
                    </div>
                  ) : (
                    advances.map((advance) => {
                      const employee = employees.find(emp => emp.id === advance.employeeId);
                      return (
                        <div key={advance.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              {employee?.photoUrl ? (
                                <img src={employee.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <CreditCard className="text-indigo-500" size={20} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{employee?.firstName} {employee?.lastName}</p>
                              <p className="text-[11px] font-medium text-slate-500">{advance.reason}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {advance.amount ? advance.amount.toLocaleString('fr-FR') : '0'} {advance.currency} • {advance.months} mois
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">{new Date(advance.createdAt).toLocaleDateString('fr-FR')}</p>
                              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${advance.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                advance.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                                  'bg-amber-50 text-amber-600'
                                }`}>
                                {advance.status === 'APPROVED' ? 'Approuvée' :
                                  advance.status === 'REJECTED' ? 'Refusée' : 'En attente'}
                              </span>
                            </div>
                            {advance.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveAdvance(advance)}
                                  className="w-8 h-8 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center"
                                  title="Approuver l'avance"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => handleRejectAdvance(advance)}
                                  className="w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                                  title="Rejeter l'avance"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal d'approbation d'avance */}
                <HRModal
                  isOpen={isApproveModalOpen}
                  onClose={() => {
                    setIsApproveModalOpen(false);
                    setSelectedAdvance(null);
                  }}
                  title="Approuver l'avance sur salaire"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsApproveModalOpen(false);
                          setSelectedAdvance(null);
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmApprovalAdvance}
                        disabled={isLoading}
                        className="px-4 md:px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Approbation...' : 'Approuver'}
                      </button>
                    </div>
                  }
                >
                  {selectedAdvance && (
                    <div className="space-y-6">
                      <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                              Confirmation d'approbation
                            </h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Avance sur salaire
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Employé</p>
                            <p className="text-sm font-bold text-slate-900">
                              {(() => {
                                const employee = employees.find(emp => emp.id === selectedAdvance.employeeId);
                                return `${employee?.firstName} ${employee?.lastName}`;
                              })()
                              }
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Montant</p>
                            <p className="text-sm font-bold text-slate-900">
                              {selectedAdvance.amount ? selectedAdvance.amount.toLocaleString('fr-FR') : '0'} {selectedAdvance.currency}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Raison</p>
                          <p className="text-sm text-slate-700">{selectedAdvance.reason}</p>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠️ Cette action approuvera définitivement l'avance sur salaire. Elle sera prise en compte dans le prochain traitement de paie.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </HRModal>

                {/* Modal de rejet d'avance */}
                <HRModal
                  isOpen={isRejectModalOpen}
                  onClose={() => {
                    setIsRejectModalOpen(false);
                    setSelectedAdvance(null);
                    setRejectReason('');
                  }}
                  title="Rejeter l'avance sur salaire"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsRejectModalOpen(false);
                          setSelectedAdvance(null);
                          setRejectReason('');
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmRejectAdvance}
                        disabled={isLoading || !rejectReason.trim()}
                        className="px-4 md:px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Rejet...' : 'Rejeter'}
                      </button>
                    </div>
                  }
                >
                  {selectedAdvance && (
                    <div className="space-y-6">
                      <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm">
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                              Confirmation de rejet
                            </h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Avance sur salaire
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Employé</p>
                            <p className="text-sm font-bold text-slate-900">
                              {(() => {
                                const employee = employees.find(emp => emp.id === selectedAdvance.employeeId);
                                return `${employee?.firstName} ${employee?.lastName}`;
                              })()
                              }
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Montant</p>
                            <p className="text-sm font-bold text-slate-900">
                              {selectedAdvance.amount ? selectedAdvance.amount.toLocaleString('fr-FR') : '0'} {selectedAdvance.currency}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Raison de la demande</p>
                          <p className="text-sm text-slate-700">{selectedAdvance.reason}</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Raison du rejet *
                          </label>
                          <textarea
                            placeholder="Ex: Montant trop élevé, dossier incomplet, ne respecte pas la politique de l'entreprise..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm resize-none"
                            rows={4}
                          />
                        </div>

                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠️ Cette action rejettera définitivement la demande d'avance. L'employé sera notifié avec la raison du rejet.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </HRModal>
              </div>

              {/* Section des Déductions Mensuelles en Cours */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <MinusCircle className="text-red-500" /> Déductions Mensuelles en Cours
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">
                    Montants à déduire des salaires ce mois-ci
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Employé</th>
                        <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Déduction Mensuelle</th>
                        <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Avances Actives</th>
                        <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Mois Restants</th>
                        <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(emp => monthlyDeductions[emp.id]?.totalMonthlyDeduction > 0).map(employee => {
                        const deductionInfo = monthlyDeductions[employee.id];

                        return (
                          <tr key={employee.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden">
                                  <img
                                    src={employee.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.firstName + ' ' + employee.lastName)}&background=6366f1&color=fff&size=40`}
                                    alt={`${employee.firstName} ${employee.lastName}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-900">{employee.firstName} {employee.lastName}</p>
                                  <p className="text-xs text-slate-500">{employee.position || 'N/A'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-6">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-red-600">
                                  -{deductionInfo.totalMonthlyDeduction ? deductionInfo.totalMonthlyDeduction.toLocaleString('fr-FR') : '0'} {deductionInfo.currency}
                                </span>
                                <span className="text-xs text-slate-500">/ mois</span>
                              </div>
                            </td>
                            <td className="py-6">
                              <div className="flex flex-wrap gap-1">
                                {deductionInfo.deductionDetails?.map((detail: any) => (
                                  <span key={detail.id} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                    {detail.monthlyAmount ? detail.monthlyAmount.toLocaleString('fr-FR') : '0'} {detail.currency}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-6">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                {Math.max(...(deductionInfo.deductionDetails?.map((d: any) => d.remainingMonths) || [0]))} mois
                              </span>
                            </td>
                            <td className="py-6">
                              <button
                                onClick={() => onNavigate('rh.employee', { employeeId: employee.id })}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                              >
                                Voir Détails
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {loadingDeductions ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                      </div>
                      <p className="text-slate-500 font-medium text-sm">Chargement des déductions mensuelles...</p>
                    </div>
                  ) : Object.keys(monthlyDeductions).filter(empId => monthlyDeductions[empId]?.totalMonthlyDeduction > 0).length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MinusCircle size={32} />
                      </div>
                      <p className="text-slate-500 font-medium text-sm">Aucune déduction mensuelle en cours</p>
                      <p className="text-slate-400 text-xs">Tous les employés sont à jour avec leurs avances</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Section des Primes Exceptionnelles */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <TrendingUp className="text-emerald-500" /> Primes Exceptionnelles
                  </h3>
                  <button
                    onClick={() => setIsPrimeModalOpen(true)}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl active:scale-95"
                  >
                    <Plus size={16} /> Nouvelle Prime
                  </button>
                </div>

                {/* Modal Primes */}
                <HRModal
                  isOpen={isPrimeModalOpen}
                  onClose={() => {
                    setIsPrimeModalOpen(false);
                    setPrimeForm({ employeeId: '', amount: '', reason: '', type: 'PERFORMANCE', currency: 'F CFA' });
                    setPrimeEmployeeSearchTerm('');
                  }}
                  title="Nouvelle Prime Exceptionnelle"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsPrimeModalOpen(false);
                          setPrimeForm({ employeeId: '', amount: '', reason: '', type: 'PERFORMANCE', currency: 'F CFA' });
                          setPrimeEmployeeSearchTerm('');
                        }}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSavePrime}
                        disabled={isLoading}
                        className="px-4 md:px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50"
                      >
                        {isLoading ? 'Enregistrement...' : 'Créer la Prime'}
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employé Bénéficiaire *</label>

                      {/* Champ de recherche pour les primes */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="Rechercher un employé..."
                          value={primeEmployeeSearchTerm}
                          onChange={(e) => setPrimeEmployeeSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                      </div>

                      <select
                        value={primeForm.employeeId}
                        onChange={(e) => setPrimeForm(prev => ({ ...prev, employeeId: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-sm"
                      >
                        <option value="">Sélectionner un employé...</option>
                        {getFilteredEmployeesForPrimes().map((employee) => {
                          const activeContracts = employee?.contracts || [];
                          const latestContract = activeContracts.length > 0
                            ? activeContracts.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
                            : null;
                          const currentSalary = latestContract?.salary || employee?.baseSalary || 0;
                          return (
                            <option key={employee.id} value={employee.id}>
                              {employee.firstName} {employee.lastName} - {employee.matricule} - {currentSalary ? currentSalary.toLocaleString('fr-FR') : '0'} F CFA
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Montant *</label>
                        <input
                          type="number"
                          placeholder="Ex: 150000"
                          value={primeForm.amount}
                          onChange={(e) => setPrimeForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Prime</label>
                        <select
                          value={primeForm.type}
                          onChange={(e) => setPrimeForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-sm"
                        >
                          <option value="PERFORMANCE">Performance</option>
                          <option value="EXCEPTIONAL">Exceptionnelle</option>
                          <option value="ANNUAL_BONUS">Prime annuelle</option>
                          <option value="PROJECT_BONUS">Prime de projet</option>
                          <option value="OTHER">Autre</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raison de la Prime *</label>
                      <textarea
                        placeholder="Ex: Excellent travail sur le projet X, Atteinte des objectifs trimestriels, Performance exceptionnelle..."
                        value={primeForm.reason}
                        onChange={(e) => setPrimeForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-sm resize-none"
                        rows={4}
                      />
                    </div>

                    {primeForm.employeeId && primeForm.amount && (
                      <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
                        <h4 className="text-sm font-black text-emerald-900 mb-4 uppercase tracking-widest">Aperçu</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Bénéficiaire:</span>
                            <span className="font-bold text-slate-900">
                              {(() => {
                                const emp = employees.find(e => e.id === primeForm.employeeId);
                                return emp ? `${emp.firstName} ${emp.lastName}` : '';
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Montant:</span>
                            <span className="font-bold text-slate-900">{parseFloat(primeForm.amount || '0').toLocaleString('fr-FR')} F CFA</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Type:</span>
                            <span className="font-bold text-slate-900">{primeForm.type}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </HRModal>

                {/* Liste des primes */}
                <div className="space-y-4">
                  {primes.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h4 className="text-lg font-bold text-slate-600 mb-2">Aucune prime enregistrée</h4>
                      <p className="text-slate-500 text-sm">Cliquez sur "Nouvelle Prime" pour commencer</p>
                    </div>
                  ) : (
                    primes.map((prime) => {
                      const employee = employees.find(emp => emp.id === prime.employeeId);
                      return (
                        <div key={prime.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              {employee?.photoUrl ? (
                                <img src={employee.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <TrendingUp className="text-emerald-500" size={20} />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-slate-900">{employee?.firstName} {employee?.lastName}</p>
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  {prime.type}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-slate-600 max-w-md">{prime.reason}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {prime.amount ? prime.amount.toLocaleString('fr-FR') : '0'} {prime.currency} • {new Date(prime.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                              Approuvée
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'declarations' && (
            <DeclarationsSocialesFiscales />
          )}

          {/* ==================== ONGLET RÈGLES RH ==================== */}
          {activeTab === 'rules' && (
            <div className="space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Moteur de Règles RH</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Définissez des règles automatiques de retenue sur salaire
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* ---- Formulaire (gauche) ---- */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6 sticky top-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <Zap size={18} className="text-indigo-500" />
                      </div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        {editingRuleId ? 'Modifier la règle' : 'Nouvelle règle'}
                      </h3>
                    </div>

                    <form onSubmit={handleSaveRule} className="space-y-5">
                      {/* Nom */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom de la règle *</label>
                        <input
                          type="text"
                          placeholder="Ex: Retard > 15 min → 1h déduite"
                          value={ruleForm.name}
                          onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                          required
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                        />
                      </div>

                      {/* Type */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Déclencheur</label>
                        <select
                          value={ruleForm.type}
                          onChange={e => setRuleForm(p => ({ ...p, type: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                        >
                          <option value="LATE">Retard</option>
                          <option value="ABSENCE">Absence injustifiée</option>
                          <option value="UNPAID_LEAVE">Congé non payé</option>
                          <option value="OVERTIME">Heures supplémentaires</option>
                        </select>
                      </div>

                      {/* Condition */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condition (si…)</label>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={ruleForm.conditionOperator}
                            onChange={e => setRuleForm(p => ({ ...p, conditionOperator: e.target.value }))}
                            className="px-3 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                          >
                            <option value="GT">&gt;</option>
                            <option value="GTE">≥</option>
                            <option value="EQ">=</option>
                            <option value="LTE">≤</option>
                            <option value="LT">&lt;</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            placeholder="Valeur"
                            value={ruleForm.conditionValue}
                            onChange={e => setRuleForm(p => ({ ...p, conditionValue: e.target.value }))}
                            required
                            className="px-3 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                          />
                          <select
                            value={ruleForm.conditionUnit}
                            onChange={e => setRuleForm(p => ({ ...p, conditionUnit: e.target.value }))}
                            className="px-3 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                          >
                            <option value="MINUTES">min</option>
                            <option value="HOURS">h</option>
                            <option value="DAYS">jour(s)</option>
                          </select>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alors déduire</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Valeur"
                            value={ruleForm.actionValue}
                            onChange={e => setRuleForm(p => ({ ...p, actionValue: e.target.value }))}
                            required
                            className="px-3 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                          />
                          <select
                            value={ruleForm.actionType}
                            onChange={e => setRuleForm(p => ({ ...p, actionType: e.target.value }))}
                            className="px-3 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                          >
                            <option value="DEDUCT_SALARY_HOURS">heures de salaire</option>
                            <option value="DEDUCT_SALARY_DAYS">jours de salaire</option>
                            <option value="DEDUCT_PERCENT">% du salaire</option>
                            <option value="DEDUCT_FIXED">montant fixe (F CFA)</option>
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description (optionnel)</label>
                        <textarea
                          rows={2}
                          placeholder="Explication de la règle..."
                          value={ruleForm.description}
                          onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium resize-none"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        {editingRuleId && (
                          <button
                            type="button"
                            onClick={() => { setEditingRuleId(null); setRuleForm({ name: '', description: '', type: 'LATE', conditionOperator: 'GT', conditionValue: '', conditionUnit: 'MINUTES', actionType: 'DEDUCT_SALARY_HOURS', actionValue: '', isActive: true }); }}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                          >
                            Annuler
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={rulesSaving}
                          className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-60"
                        >
                          {rulesSaving ? 'Sauvegarde...' : editingRuleId ? 'Modifier' : 'Créer la règle'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* ---- Liste des règles (droite) ---- */}
                <div className="lg:col-span-3 space-y-4">
                  {rulesLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                  ) : hrRules.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                        <Zap size={28} className="text-slate-400" />
                      </div>
                      <h3 className="text-base font-black text-slate-600 mb-2">Aucune règle configurée</h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Créez des règles pour automatiser les déductions de retard et d'absence.
                      </p>
                    </div>
                  ) : (
                    hrRules.map((rule: any) => (
                      <div key={rule.id} className={`bg-white rounded-[2rem] border p-6 transition-all ${rule.isActive ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="text-sm font-black text-slate-900">{rule.name}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${rule.type === 'LATE' ? 'bg-orange-50 text-orange-600' :
                                rule.type === 'ABSENCE' ? 'bg-red-50 text-red-600' :
                                  rule.type === 'OVERTIME' ? 'bg-emerald-50 text-emerald-600' :
                                    'bg-blue-50 text-blue-600'
                                }`}>
                                {RULE_TYPE_LABELS[rule.type] || rule.type}
                              </span>
                              {!rule.isActive && (
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-400">Inactive</span>
                              )}
                            </div>
                            {/* Résumé lisible */}
                            <p className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-xl px-3 py-2 inline-block">
                              Si {RULE_TYPE_LABELS[rule.type]?.toLowerCase()} {OPERATOR_LABELS[rule.conditionOperator]} {rule.conditionValue} {UNIT_LABELS[rule.conditionUnit]}
                              {' → '}déduire {rule.actionValue} {ACTION_TYPE_LABELS[rule.actionType]?.toLowerCase()}
                            </p>
                            {rule.description && (
                              <p className="text-[10px] text-slate-400 mt-2">{rule.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Toggle actif/inactif */}
                            <button
                              onClick={() => handleToggleRule(rule.id)}
                              title={rule.isActive ? 'Désactiver' : 'Activer'}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${rule.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                            >
                              {rule.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                            {/* Éditer */}
                            <button
                              onClick={() => handleEditRule(rule)}
                              className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center hover:bg-indigo-100 transition-all"
                            >
                              <Settings size={14} />
                            </button>
                            {/* Supprimer */}
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="w-8 h-8 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Exemples de règles fréquentes */}
                  {hrRules.length === 0 && (
                    <div className="bg-indigo-50 rounded-[2rem] border border-indigo-100 p-6">
                      <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Exemples de règles fréquentes</h4>
                      <div className="space-y-3">
                        {[
                          { label: 'Retard > 15 min → déduire 1h de salaire', type: 'LATE', conditionOperator: 'GT', conditionValue: '15', conditionUnit: 'MINUTES', actionType: 'DEDUCT_SALARY_HOURS', actionValue: '1' },
                          { label: 'Absence injustifiée ≥ 1 jour → déduire 1 jour de salaire', type: 'ABSENCE', conditionOperator: 'GTE', conditionValue: '1', conditionUnit: 'DAYS', actionType: 'DEDUCT_SALARY_DAYS', actionValue: '1' },
                        ].map((ex, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setRuleForm(p => ({ ...p, name: ex.label, type: ex.type, conditionOperator: ex.conditionOperator, conditionValue: ex.conditionValue, conditionUnit: ex.conditionUnit, actionType: ex.actionType, actionValue: ex.actionValue }))}
                            className="w-full text-left px-4 py-3 bg-white rounded-xl text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-all border border-indigo-100"
                          >
                            + {ex.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal de visualisation de bulletin */}
      <HRModal
        isOpen={isPayslipViewModalOpen}
        onClose={() => setIsPayslipViewModalOpen(false)}
        title={`Bulletin de ${selectedPayslip ?
          (() => {
            const emp = employees.find(e => e.id === selectedPayslip.employeeId);
            return emp ? `${emp.firstName} ${emp.lastName}` : 'Employé';
          })() : 'Employé'
          }`}
        size="lg"
      >
        {selectedPayslip && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Période
                  </label>
                  <p className="text-lg font-bold text-slate-900">
                    {new Date(selectedPayslip.month + '-01').toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Salaire Brut
                  </label>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedPayslip.grossSalary ? `${selectedPayslip.grossSalary.toLocaleString('fr-FR')} F CFA` : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Charges Sociales
                  </label>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedPayslip.socialCharges ? `${selectedPayslip.socialCharges.toLocaleString('fr-FR')} F CFA` : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Salaire Net
                  </label>
                  <p className="text-2xl font-black text-emerald-600">
                    {selectedPayslip.netSalary ? `${selectedPayslip.netSalary.toLocaleString('fr-FR')} F CFA` : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Avances Déduites
                  </label>
                  <p className="text-lg font-bold text-red-600">
                    {selectedPayslip.totalAdvances ? `${selectedPayslip.totalAdvances.toLocaleString('fr-FR')} F CFA` : '0 F CFA'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Primes Ajoutées
                  </label>
                  <p className="text-lg font-bold text-green-600">
                    {selectedPayslip.totalPrimes ? `${selectedPayslip.totalPrimes.toLocaleString('fr-FR')} F CFA` : '0 F CFA'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => handleDownloadPayslip(selectedPayslip, 'pdf')}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} /> Télécharger PDF
              </button>
              <button
                onClick={() => handleDownloadPayslip(selectedPayslip, 'png')}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
              >
                <Image size={16} /> Télécharger Image
              </button>
            </div>
          </div>
        )}
      </HRModal>

      {/* Modal de régénération de bulletin */}
      <HRModal
        isOpen={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        title="Régénérer le Bulletin"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setIsRegenerateModalOpen(false)}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleRegeneratePayslip}
              disabled={regeneratingPayslip}
              className="px-4 md:px-10 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {regeneratingPayslip ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Régénérer
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-amber-800">Attention - Régénération de Bulletin</h4>
                <p className="text-sm text-amber-700">
                  Cette action va recalculer et remplacer le bulletin existant.
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-amber-700">
              <p>• Le bulletin sera recalculé avec les données actuelles</p>
              <p>• Les avances et primes du mois seront recalculées</p>
              <p>• L'ancien fichier sera remplacé définitivement</p>
            </div>
          </div>

          {selectedPayslip && (
            <div className="p-4 bg-slate-50 rounded-xl">
              <h5 className="font-bold text-slate-900 mb-2">Bulletin à régénérer :</h5>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-200 rounded-lg overflow-hidden">
                  <img
                    src={employees.find(e => e.id === selectedPayslip.employeeId)?.photoUrl ||
                      `https://picsum.photos/seed/${selectedPayslip.employeeId}/100/100`}
                    alt="Employé"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {(() => {
                      const emp = employees.find(e => e.id === selectedPayslip.employeeId);
                      return emp ? `${emp.firstName} ${emp.lastName}` : 'Employé introuvable';
                    })()}
                  </p>
                  <p className="text-sm text-slate-600">
                    {new Date(selectedPayslip.month + '-01').toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </HRModal>

      {/* Modal de prévisualisation du bulletin */}
      <HRModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setSelectedEmployeeForPreview(null);
          setPreviewPayslipData(null);
        }}
        title={`Prévisualisation - ${selectedEmployeeForPreview?.firstName} ${selectedEmployeeForPreview?.lastName}`}
        size="full"
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleChangePeriod('prev')}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                ← Mois Précédent
              </button>
              <span className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                {currentPeriod.displayName}
              </span>
              <button
                onClick={() => handleChangePeriod('next')}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Mois Suivant →
              </button>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setSelectedEmployeeForPreview(null);
                  setPreviewPayslipData(null);
                }}
                className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  if (previewPayslipData) {
                    // Simulation du téléchargement - en réalité, il faudrait intégrer avec l'API
                    setAlertMessage('Fonctionnalité de téléchargement à implémenter');
                    setShowSuccessAlert(true);
                    setTimeout(() => setShowSuccessAlert(false), 3000);
                  }
                }}
                className="px-4 md:px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl"
              >
                <Download size={14} className="inline mr-2" /> Télécharger PDF
              </button>
            </div>
          </div>
        }
      >
        <div className="h-full overflow-auto bg-slate-50">
          {loadingPreview ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-sm font-medium text-slate-600">Génération du bulletin...</p>
              </div>
            </div>
          ) : previewPayslipData ? (
            <div className="flex justify-center p-8">
              <PayslipPreview
                employee={previewPayslipData.employee}
                contract={previewPayslipData.contract}
                tenant={previewPayslipData.tenant}
                salaryCalculation={previewPayslipData.salaryCalculation}
                month={previewPayslipData.month}
                year={previewPayslipData.year}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-4">
                <FileText className="w-16 h-16 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">Bulletin non disponible</p>
              </div>
            </div>
          )}
        </div>
      </HRModal>
    </div>
  );
};

export default PayrollManagement;
