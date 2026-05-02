
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Layers,
  ShieldCheck,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  Download,
  Edit3,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Plus,
  History,
  FolderOpen,
  CreditCard,
  Activity,
  UserCheck,
  UserX,
  X,
  Camera,
  RefreshCw,
  ExternalLink,
  Image,
  Code,
  Search,
  Filter,
  BarChart3,
  Loader2
} from 'lucide-react';
import { apiClient, BASE_URL } from '../../services/api';
import { uploadFile } from '../../services/uploadService';
import { authBridge } from '../../services/authBridge';
import { useToast } from '../ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import PayslipPreview from './PayslipPreview';
import { createRoot } from 'react-dom/client';

interface EmployeeProfileProps {
  employeeId: string;
  onNavigate: (tab: string, meta?: any) => void;
}

// Helper functions pour la validation et l'affichage
const getContractTypeRules = (type: string) => {
  switch (type) {
    case 'CDI':
      return {
        needsEndDate: false,
        maxTrialPeriod: 4,
        helpText: 'CDI : Contrat permanent. Date de fin optionnelle (si omise, contrat permanent).'
      };
    case 'CDD':
      return {
        needsEndDate: true,
        maxTrialPeriod: 1,
        helpText: 'CDD : Contrat temporaire. Date de fin obligatoire (maximum 5 ans).'
      };
    case 'STAGE':
      return {
        needsEndDate: true,
        maxTrialPeriod: 0,
        maxDuration: 6,
        helpText: 'STAGE : Stage limité à 6 mois maximum. Pas de période d\'essai.'
      };
    default:
      return { needsEndDate: true, maxTrialPeriod: 4, helpText: 'Sélectionnez un type de contrat pour voir les règles.' };
  }
};

const formatDateForDisplay = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const calculateContractDuration = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else if (diffDays <= 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} mois`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return `${years} an${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` et ${remainingMonths} mois` : ''}`;
  }
};

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ employeeId, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [employee, setEmployee] = useState<any | null>(null);
  const [tenant, setTenant] = useState<any | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();
  const [editForm, setEditForm] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [contractForm, setContractForm] = useState({
    type: 'CDI',
    startDate: '',
    endDate: '',
    salary: '',
    trialPeriodEnd: '',
    currency: 'F CFA'
  });
  const [terminationForm, setTerminationForm] = useState({ reason: '' });
  const [suspensionForm, setSuspensionForm] = useState({ reason: '' });
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    type: 'ID_CARD',
    category: '',
    file: null as File | null
  });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);
  const [isGeneratingPayslip, setIsGeneratingPayslip] = useState(false);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // États pour les filtres de fiches de paie
  const [payslipFilters, setPayslipFilters] = useState({
    search: '',
    month: '',
    displayCount: 10
  });

  // États pour la timeline de carrière
  const [careerTimeline, setCareerTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // États pour les primes et avances avec filtres avancés
  const [advances, setAdvances] = useState<any[]>([]);
  const [primes, setPrimes] = useState<any[]>([]);
  const [advanceFilters, setAdvanceFilters] = useState({
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    search: ''
  });
  const [primeFilters, setPrimeFilters] = useState({
    type: 'ALL',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    search: ''
  });

  // État pour le salaire du mois en cours
  const [currentMonthSalary, setCurrentMonthSalary] = useState<any>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);

  // États pour le pointage
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [adminClockForm, setAdminClockForm] = useState({ time: '' });
  const [adminClockLoading, setAdminClockLoading] = useState(false);

  // États pour la timeline de carrière
  const resetContractForm = () => {
    setContractForm({
      type: 'CDI',
      startDate: '',
      endDate: '',
      salary: '',
      trialPeriodEnd: '',
      currency: 'F CFA'
    });
  };

  // Fonction utilitaire pour déterminer le statut de présence d'un employé
  const getEmployeePresenceStatus = (employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const activeLeave = leaves.find(leave => {
      return leave.employeeId === employeeId &&
        leave.status === 'APPROVED' &&
        leave.startDate <= today &&
        leave.endDate >= today;
    });

    return {
      isPresent: !activeLeave,
      leave: activeLeave,
      leaveType: activeLeave?.type,
      leaveEndDate: activeLeave?.endDate
    };
  };

  const handleContractTypeChange = (newType: string) => {
    const updatedForm = { ...contractForm, type: newType };

    // Auto-nettoyage selon le type de contrat
    if (newType === 'CDI') {
      // CDI ne doit pas avoir de date de fin
      updatedForm.endDate = '';
    }

    if (newType === 'STAGE') {
      // Stage ne peut pas avoir de période d'essai
      updatedForm.trialPeriodEnd = '';
    }

    setContractForm(updatedForm);
  };

  const resetTerminationForm = () => {
    setTerminationForm({ reason: '' });
  };

  const resetSuspensionForm = () => {
    setSuspensionForm({ reason: '' });
  };

  const resetDocForm = () => {
    setDocForm({
      name: '',
      type: 'ID_CARD',
      category: '',
      file: null
    });
  };

  // Charger l'historique de pointage de l'employé
  const loadAttendance = async (empId: string) => {
    setLoadingAttendance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [history, todayRec] = await Promise.all([
        apiClient.get(`/hr/attendance?employeeId=${empId}`),
        apiClient.get(`/hr/attendance?employeeId=${empId}&date=${today}`)
      ]);
      const records: any[] = history?.rows || history || [];
      const todayRecords: any[] = todayRec?.rows || todayRec || [];
      setAttendanceHistory(records);
      setAttendanceToday(todayRecords[0] || null);
    } catch (err) {
      console.error('Erreur chargement pointage:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleAdminClockIn = async () => {
    if (!employee) return;
    setAdminClockLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload: any = { employeeId: employee.id, date: today };
      if (adminClockForm.time) payload.clockIn = adminClockForm.time;
      await apiClient.post('/hr/attendance/admin/clock-in', payload);
      showToast('Arrivée pointée avec succès', 'success');
      await loadAttendance(employee.id);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du pointage', 'error');
    } finally {
      setAdminClockLoading(false);
    }
  };

  const handleAdminClockOut = async () => {
    if (!employee) return;
    setAdminClockLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload: any = { employeeId: employee.id, date: today };
      if (adminClockForm.time) payload.clockOut = adminClockForm.time;
      await apiClient.post('/hr/attendance/admin/clock-out', payload);
      showToast('Départ pointé avec succès', 'success');
      await loadAttendance(employee.id);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du pointage', 'error');
    } finally {
      setAdminClockLoading(false);
    }
  };

  // Fonction pour calculer le salaire du mois en cours
  const calculateCurrentMonthSalary = async (employeeId: string) => {
    try {
      setLoadingSalary(true);
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format

      // Utiliser la nouvelle API backend pour le calcul précis
      const response = await apiClient.get(`/hr/employees/${employeeId}/monthly-salary?month=${currentMonth}`);

      if (response && response.baseSalary !== undefined) {
        setCurrentMonthSalary({
          baseSalary: response.baseSalary,
          totalPrimes: response.totalPrimes,
          totalAdvances: response.totalAdvanceDeductions,
          socialChargesEmployee: response.socialChargesEmployee,
          socialChargesEmployer: response.socialChargesEmployer,
          grossSalary: response.grossSalary,
          netSalary: response.netSalary,
          currency: response.currency,
          primesCount: response.details?.primesCount || 0,
          advancesCount: response.details?.advancesCount || 0,
          contractType: response.details?.contractType || 'N/A'
        });
      } else {
        // Fallback au calcul côté client si l'API échoue
        await calculateCurrentMonthSalaryFallback(employeeId);
      }
    } catch (error: any) {
      console.error('Error calculating current month salary via API:', error);
      // Fallback au calcul côté client en cas d'erreur API
      await calculateCurrentMonthSalaryFallback(employeeId);
    } finally {
      setLoadingSalary(false);
    }
  };

  // Méthode fallback pour le calcul côté client
  const calculateCurrentMonthSalaryFallback = async (employeeId: string) => {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);

      const activeContract = contracts.find(c => c.employeeId === employeeId && c.status === 'ACTIVE');
      if (!activeContract) {
        setCurrentMonthSalary(null);
        return;
      }

      // Validation et parsing sécurisé du salaire de base
      const baseSalary = parseFloat(activeContract.salary) || 0;

      // Validation des données de base
      if (baseSalary <= 0) {
        console.warn('Salaire de base invalide ou non défini');
        setCurrentMonthSalary(null);
        return;
      }

      // Récupérer les primes du mois en cours
      const currentMonthPrimes = primes.filter(prime => {
        const primeMonth = new Date(prime.createdAt).toISOString().substring(0, 7);
        return primeMonth === currentMonth && prime.status === 'APPROVED';
      });

      // Récupérer les avances ACTIVES pendant ce mois (pas créées ce mois)
      const monthStart = new Date(currentMonth + '-01');
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      const activeAdvances = advances.filter(advance => {
        if (advance.status !== 'APPROVED' || !advance.startDate || !advance.endDate) {
          return false;
        }

        const startDate = new Date(advance.startDate);
        const endDate = new Date(advance.endDate);

        // L'avance est active si elle chevauche avec le mois courant
        return startDate <= monthEnd && endDate >= monthStart;
      });

      // Calculer les totaux avec validation numérique
      const totalPrimes = currentMonthPrimes.reduce((sum, prime) => {
        const amount = parseFloat(prime.amount) || 0;
        return sum + amount;
      }, 0);

      const totalAdvances = activeAdvances.reduce((sum, advance) => {
        // advance.amount représente le montant mensuel à déduire
        const monthlyDeduction = parseFloat(advance.amount) || 0;
        return sum + monthlyDeduction;
      }, 0);

      // Validation des montants calculés
      const validTotalPrimes = isNaN(totalPrimes) ? 0 : totalPrimes;
      const validTotalAdvances = isNaN(totalAdvances) ? 0 : totalAdvances;

      // Calculs des charges sociales avec arrondi
      const socialChargesEmployee = Math.round(baseSalary * 0.22 * 100) / 100;
      const socialChargesEmployer = Math.round(baseSalary * 0.18 * 100) / 100;

      const grossSalary = Math.round((baseSalary + validTotalPrimes) * 100) / 100;
      const netSalary = Math.round((grossSalary - socialChargesEmployee - validTotalAdvances) * 100) / 100;

      setCurrentMonthSalary({
        baseSalary: Math.round(baseSalary * 100) / 100,
        totalPrimes: Math.round(validTotalPrimes * 100) / 100,
        totalAdvances: Math.round(validTotalAdvances * 100) / 100,
        socialChargesEmployee: Math.round(socialChargesEmployee * 100) / 100,
        socialChargesEmployer: Math.round(socialChargesEmployer * 100) / 100,
        grossSalary: Math.round(grossSalary * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        currency: activeContract.currency || 'F CFA',
        primesCount: currentMonthPrimes.length,
        advancesCount: activeAdvances.length,
        contractType: activeContract.type
      });
    } catch (error: any) {
      console.error('Error in fallback salary calculation:', error);
      setCurrentMonthSalary(null);
    }
  };

  // Fonction pour charger les avances et primes avec détails
  const loadAdvancesAndPrimes = async (employeeId: string) => {
    try {
      const [advancesResponse, primesResponse] = await Promise.all([
        apiClient.get('/hr/advances').catch(() => ({ data: [] })),
        apiClient.get('/hr/primes').catch(() => ({ data: [] }))
      ]);

      const allAdvances = advancesResponse.data || advancesResponse || [];
      const allPrimes = primesResponse.data || primesResponse || [];

      // Filtrer pour cet employé
      const employeeAdvances = allAdvances.filter((advance: any) => advance.employeeId === employeeId);
      const employeePrimes = allPrimes.filter((prime: any) => prime.employeeId === employeeId);

      setAdvances(employeeAdvances);
      setPrimes(employeePrimes);
    } catch (error: any) {
      console.error('Error loading advances and primes:', error);
      setAdvances([]);
      setPrimes([]);
    }
  };

  // Fonction pour charger la timeline de carrière
  const loadCareerTimeline = async (employeeId: string) => {
    try {
      setLoadingTimeline(true);

      // Charger les contrats, avances et primes en parallèle
      const [contractsResponse, advancesResponse, primesResponse] = await Promise.all([
        apiClient.get(`/hr/contracts/employee/${employeeId}/history`),
        apiClient.get(`/hr/advances`).catch(() => ({ data: [] })), // Fallback si endpoint n'existe pas encore
        apiClient.get(`/hr/primes`).catch(() => ({ data: [] }))    // Fallback si endpoint n'existe pas encore
      ]);

      const contracts = contractsResponse.timeline || [];
      const allAdvances = advancesResponse.data || advancesResponse || [];
      const allPrimes = primesResponse.data || primesResponse || [];

      // Filtrer les avances et primes de cet employé
      const employeeAdvances = allAdvances.filter((advance: any) => advance.employeeId === employeeId);
      const employeePrimes = allPrimes.filter((prime: any) => prime.employeeId === employeeId);

      // Créer les événements pour les avances
      const advanceEvents = employeeAdvances.map((advance: any) => ({
        type: 'ADVANCE',
        date: advance.createdAt,
        title: 'Avance sur Salaire',
        description: advance.reason || 'Avance accordée',
        amount: advance.amount,
        currency: advance.currency,
        months: advance.months,
        status: advance.status,
        details: {
          id: advance.id,
          amount: advance.amount,
          months: advance.months,
          totalAmount: advance.amount * advance.months,
          status: advance.status,
          approvedAt: advance.approvedAt,
          rejectionReason: advance.rejectionReason
        }
      }));

      // Créer les événements pour les primes
      const primeEvents = employeePrimes.map((prime: any) => ({
        type: 'PRIME',
        date: prime.createdAt,
        title: `Prime ${prime.type}`,
        description: prime.reason || 'Prime accordée',
        amount: prime.amount,
        currency: prime.currency,
        primeType: prime.type,
        status: prime.status,
        details: {
          id: prime.id,
          amount: prime.amount,
          type: prime.type,
          category: prime.category,
          status: prime.status,
          isPaid: prime.isPaid,
          paidAt: prime.paidAt,
          payrollMonth: prime.payrollMonth
        }
      }));

      // Combiner tous les événements et les trier par date
      const allEvents = [...contracts, ...advanceEvents, ...primeEvents];
      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCareerTimeline(allEvents);
    } catch (error: any) {
      console.error('Error loading career timeline:', error);
      setCareerTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const [empRes, deptRes, contractsRes, expiringRes, docsRes, leavesRes, tenantRes] = await Promise.all([
          apiClient.get(`/hr/employees/${employeeId}`),
          apiClient.get('/hr/departments'),
          apiClient.get('/hr/contracts'),
          apiClient.get('/hr/contracts/alerts/expiring'),
          apiClient.get(`/hr/employees/${employeeId}/documents`),
          apiClient.get('/hr/leaves'),
          apiClient.get('/tenant/info') // Récupérer les informations du tenant
        ]);
        setEmployee(empRes);
        setTenant(tenantRes);
        setDepartments(deptRes?.rows || deptRes || []);
        setContracts(contractsRes?.rows || contractsRes || []);
        setExpiringContracts(expiringRes || []);
        setDocuments(docsRes || []);
        setLeaves(leavesRes?.rows || leavesRes || []);

        // Charger les fiches de paie pour cet employé spécifique
        if (empRes?.id) {
          try {
            const payslipsRes = await apiClient.get(`/hr/employees/${empRes.id}/payslips`);
            setPayslips(payslipsRes || []);
          } catch (error) {
            console.error('Error loading payslips:', error);
            setPayslips([]);
          }
        }

        // Charger la timeline de carrière, les données enrichies et le pointage
        if (empRes?.id) {
          loadCareerTimeline(empRes.id);
          loadAdvancesAndPrimes(empRes.id);
          calculateCurrentMonthSalary(empRes.id);
          loadAttendance(empRes.id);
        }
      } catch (err: any) {
        console.error('Error loading employee profile:', err);
        setAlertMessage("Impossible de charger l'employé");
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 3000);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <RefreshCw className="animate-spin mr-2" />
        <span>Chargement du profil employé...</span>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <UserX size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Employé non trouvé</h3>
          <p className="text-slate-500 font-medium text-sm">L'employé demandé n'existe pas ou a été supprimé.</p>
          <button
            onClick={() => onNavigate('rh.employees')}
            className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
          >
            <ArrowLeft size={16} className="mr-2" /> Retour à la Liste
          </button>
        </div>
      </div>
    );
  }

  // Rechercher le contrat actif pour cet employé
  const contract = contracts.find((c: any) => String(c.employeeId) === String(employeeId) && c.status === 'ACTIVE');

  // Vérifier si l'employé a un contrat actif pour la génération de fiche de paie
  const hasActiveContract = contract !== undefined;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadFile(file, 'employees');
      setEditForm(prev => ({ ...prev, photoUrl: result.url }));
      showToast('Photo téléchargée avec succès', 'success');
    } catch (err) {
      console.error("Upload Error:", err);
      showToast("Échec de l'envoi de la photo.", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    try {
      const payload: any = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        position: editForm.position,
        departmentId: editForm.departmentId || null,
        hireDate: editForm.hireDate,
        photoUrl: editForm.photoUrl || null
      };
      await apiClient.put(`/hr/employees/${employee.id}`, payload);
      setIsEditModalOpen(false);
      showToast('Profil mis à jour', 'success');
      // Refresh
      const refreshed = await apiClient.get(`/hr/employees/${employeeId}`);
      setEmployee(refreshed);
    } catch (err: any) {
      console.error('Error updating employee profile:', err);
      showToast(err.message || "Erreur lors de la mise à jour", 'error');
    }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation stricte des dates
    if (!contractForm.type || !contractForm.startDate) {
      showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    const startDate = new Date(contractForm.startDate);
    const today = new Date();
    const maxPastDate = new Date();
    maxPastDate.setFullYear(today.getFullYear() - 10); // Max 10 ans dans le passé
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(today.getFullYear() + 2); // Max 2 ans dans le futur

    // Validation date de début
    if (startDate < maxPastDate) {
      showToast('La date de début ne peut pas être antérieure à 10 ans', 'error');
      return;
    }
    if (startDate > maxFutureDate) {
      showToast('La date de début ne peut pas être supérieure à 2 ans dans le futur', 'error');
      return;
    }

    // Validation date de fin pour CDD/Stage
    if ((contractForm.type === 'CDD' || contractForm.type === 'STAGE') && !contractForm.endDate) {
      showToast(`Une date de fin est obligatoire pour un contrat de type ${contractForm.type}`, 'error');
      return;
    }

    // Validation CDI ne doit pas avoir de date de fin
    if (contractForm.type === 'CDI' && contractForm.endDate) {
      showToast('Un contrat CDI ne peut pas avoir de date de fin', 'error');
      return;
    }

    if (contractForm.endDate) {
      const endDate = new Date(contractForm.endDate);

      // Date de fin doit être postérieure à la date de début
      if (endDate <= startDate) {
        showToast('La date de fin doit être postérieure à la date de début', 'error');
        return;
      }

      // Date de fin ne peut pas être trop lointaine
      const maxEndDate = new Date(startDate);
      maxEndDate.setFullYear(startDate.getFullYear() + 5); // Max 5 ans de contrat
      if (endDate > maxEndDate) {
        showToast('La durée du contrat ne peut pas excéder 5 ans', 'error');
        return;
      }

      // Validation durée minimale pour CDD (1 jour minimum)
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (contractForm.type === 'CDD' && diffDays < 1) {
        showToast('Un CDD doit avoir une durée minimale d\'1 jour', 'error');
        return;
      }

      // Validation durée Stage (max 6 mois)
      if (contractForm.type === 'STAGE') {
        const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (diffMonths > 6) {
          showToast('Un stage ne peut pas excéder 6 mois', 'error');
          return;
        }
      }
    }

    // Validation période d'essai
    if (contractForm.trialPeriodEnd) {
      const trialEnd = new Date(contractForm.trialPeriodEnd);

      if (trialEnd <= startDate) {
        showToast('La fin de période d\'essai doit être postérieure à la date de début', 'error');
        return;
      }

      if (contractForm.endDate && trialEnd >= new Date(contractForm.endDate)) {
        showToast('La période d\'essai doit se terminer avant la fin du contrat', 'error');
        return;
      }

      // Durée maximale période d'essai selon le type
      const maxTrialMonths = contractForm.type === 'CDI' ? 4 :
        contractForm.type === 'CDD' ? 1 :
          contractForm.type === 'STAGE' ? 0 : 2;

      if (maxTrialMonths === 0) {
        showToast('Les stages ne peuvent pas avoir de période d\'essai', 'error');
        return;
      }

      const trialMonths = (trialEnd.getFullYear() - startDate.getFullYear()) * 12 + (trialEnd.getMonth() - startDate.getMonth());
      if (trialMonths > maxTrialMonths) {
        showToast(`La période d'essai ne peut pas excéder ${maxTrialMonths} mois pour un ${contractForm.type}`, 'error');
        return;
      }
    }

    // Validation salaire
    if (contractForm.salary && parseFloat(contractForm.salary) < 0) {
      showToast('Le salaire ne peut pas être négatif', 'error');
      return;
    }

    try {
      const payload = {
        employeeId: employee.id,
        type: contractForm.type,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate || null,
        salary: contractForm.salary ? parseFloat(contractForm.salary) : null,
        trialPeriodEnd: contractForm.trialPeriodEnd || null,
        currency: contractForm.currency
      };

      await apiClient.post('/hr/contracts', payload);

      // Refresh contracts
      const contractsRes = await apiClient.get('/hr/contracts');
      setContracts(contractsRes?.rows || contractsRes || []);

      // Recharger la timeline de carrière
      if (employee?.id) {
        await loadCareerTimeline(employee.id);
      }

      setIsContractModalOpen(false);
      resetContractForm();
      showToast('Contrat créé avec succès', 'success');
    } catch (error: any) {
      console.error('Error creating contract:', error);
      showToast(error.response?.data?.error || 'Erreur lors de la création du contrat', 'error');
    }
  };

  const handleTerminateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !terminationForm.reason.trim()) return;

    try {
      await apiClient.post(`/hr/contracts/${selectedContract.id}/terminate`, {
        reason: terminationForm.reason.trim()
      });

      // Refresh contracts
      const contractsRes = await apiClient.get('/hr/contracts');
      setContracts(contractsRes?.rows || contractsRes || []);

      // Recharger la timeline de carrière
      if (employee?.id) {
        await loadCareerTimeline(employee.id);
      }

      setIsTerminateModalOpen(false);
      resetTerminationForm();
      setSelectedContract(null);
      showToast('Contrat résilié avec succès', 'success');
    } catch (error: any) {
      console.error('Error terminating contract:', error);
      showToast(error.response?.data?.error || 'Erreur lors de la résiliation', 'error');
    }
  };

  const handleSuspendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !suspensionForm.reason.trim()) return;

    try {
      await apiClient.post(`/hr/contracts/${selectedContract.id}/suspend`, {
        reason: suspensionForm.reason.trim()
      });

      // Refresh contracts
      const contractsRes = await apiClient.get('/hr/contracts');
      setContracts(contractsRes?.rows || contractsRes || []);

      // Recharger la timeline de carrière
      if (employee?.id) {
        await loadCareerTimeline(employee.id);
      }

      setIsSuspendModalOpen(false);
      resetSuspensionForm();
      setSelectedContract(null);
      showToast('Contrat suspendu avec succès', 'success');
    } catch (error: any) {
      console.error('Error suspending contract:', error);
      showToast(error.response?.data?.error || 'Erreur lors de la suspension', 'error');
    }
  };

  const handleReactivateContract = async (contractId: string) => {
    try {
      // Trouver le contrat à réactiver
      const contractToReactivate = contracts.find(c => c.id === contractId);
      if (!contractToReactivate) {
        showToast('Contrat non trouvé', 'error');
        return;
      }

      // Vérifier si l'employé a déjà un contrat actif
      const hasActiveContract = contracts.some(c =>
        c.employeeId === contractToReactivate.employeeId &&
        c.id !== contractId &&
        c.status === 'ACTIVE'
      );

      if (hasActiveContract) {
        showToast('Impossible de réactiver : cet employé a déjà un contrat actif. Un employé ne peut pas avoir plus d\'un contrat actif simultanément.', 'error');
        return;
      }

      await apiClient.post(`/hr/contracts/${contractId}/reactivate`, {});

      // Refresh contracts
      const contractsRes = await apiClient.get('/hr/contracts');
      setContracts(contractsRes?.rows || contractsRes || []);

      // Recharger la timeline de carrière
      if (employee?.id) {
        await loadCareerTimeline(employee.id);
      }

      showToast('Contrat réactivé avec succès', 'success');
    } catch (error: any) {
      console.error('Error reactivating contract:', error);
      showToast(error.response?.data?.error || 'Erreur lors de la réactivation', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation du type de fichier
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Type de fichier non autorisé. Utilisez PDF, JPG ou PNG.', 'error');
      return;
    }

    // Validation de la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showToast('Le fichier est trop volumineux. Taille maximale : 10MB.', 'error');
      return;
    }

    setDocForm({ ...docForm, file });
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!docForm.name.trim() || !docForm.file || !docForm.type) {
      showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    setIsUploadingDoc(true);

    try {
      const uploadResult = await uploadFile(docForm.file, 'employee_documents');

      // Sauvegarder en base de données
      const payload = {
        employeeId: employee.id,
        name: docForm.name.trim(),
        type: docForm.type,
        category: docForm.category.trim() || null,
        fileUrl: uploadResult.url,
        mimeType: docForm.file.type,
        fileSize: docForm.file.size
      };

      await apiClient.post('/hr/employee-documents', payload);

      // Refresh documents
      const docsRes = await apiClient.get(`/hr/employees/${employeeId}/documents`);
      setDocuments(docsRes || []);

      setIsDocModalOpen(false);
      resetDocForm();
      showToast('Document ajouté avec succès', 'success');
    } catch (error: any) {
      console.error('Error uploading document:', error);

      // Fallback: Upload vers le serveur local
      try {
        console.log('Tentative d\'upload vers le serveur local...');
        const localFormData = new FormData();
        localFormData.append('file', docForm.file);
        localFormData.append('employeeId', employee.id.toString());
        localFormData.append('name', docForm.name.trim());
        localFormData.append('type', docForm.type);
        localFormData.append('category', docForm.category.trim() || '');

        // Utiliser fetch directement pour éviter les problèmes de Content-Type avec FormData
        const session = authBridge.getSession();
        //const backendUrl = 'http://localhost:3000'; // Utiliser la même URL que dans api.ts
        const backendUrl = 'https://gestock.realtechprint.com'; // Utiliser la même URL que dans api.ts
        const uploadResponse = await fetch(`${backendUrl}/api/hr/employee-documents/upload-local`, {
          method: 'POST',
          body: localFormData,
          headers: {
            ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {})
          }
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Erreur lors de l\'upload');
        }

        const localUploadData = await uploadResponse.json();

        // Refresh documents
        const docsRes = await apiClient.get(`/hr/employees/${employeeId}/documents`);
        setDocuments(docsRes || []);

        setIsDocModalOpen(false);
        resetDocForm();
        showToast('Document ajouté avec succès (stockage local)', 'success');
      } catch (localError: any) {
        console.error('Erreur upload local:', localError);
        showToast('Erreur lors de l\'ajout du document. Veuillez réessayer.', 'error');
      }
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDownloadDoc = (doc: any) => {
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = doc.fileUrl;
    link.download = doc.originalName || doc.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteDoc = (doc: any) => {
    setDocToDelete(doc);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDoc = async () => {
    if (!docToDelete) return;

    try {
      await apiClient.delete(`/hr/employee-documents/${docToDelete.id}`);

      // Refresh documents
      const docsRes = await apiClient.get(`/hr/employees/${employeeId}/documents`);
      setDocuments(docsRes || []);

      setIsDeleteModalOpen(false);
      setDocToDelete(null);
      showToast('Document supprimé avec succès', 'success');
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
  };

  const handlePreviewDoc = (doc: any) => {
    setPreviewDoc(doc);
    setIsPreviewModalOpen(true);
  };

  const handleGeneratePayslip = async () => {
    if (!employee) return;

    // Vérifier qu'il y a un contrat actif avant de générer la fiche de paie
    if (!hasActiveContract) {
      showToast('Impossible de générer une fiche de paie : aucun contrat actif pour cet employé', 'error');
      return;
    }

    setIsGeneratingPayslip(true);

    try {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
      const response = await apiClient.post('/hr/payslips/generate', {
        employeeId: employee.id,
        month: currentMonth
      });

      if (response.pdfUrl) {
        // Télécharger automatiquement le PDF
        const link = document.createElement('a');
        link.href = response.pdfUrl;
        link.download = `Fiche_Paie_${employee.firstName}_${employee.lastName}_${currentMonth}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Refresh payslips list
        await loadPayslips();

        showToast('Fiche de paie générée et téléchargée avec succès', 'success');
      }
    } catch (error: any) {
      console.error('Error generating payslip:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la génération de la fiche de paie';
      showToast(errorMessage, 'error');
    } finally {
      setIsGeneratingPayslip(false);
    }
  };

  const handleDownloadPayslip = async (payslip: any, format: string = 'html') => {
    setDownloadLoading(payslip.month);

    if (!employee || !contract || !tenant) {
      showToast('Informations manquantes pour générer la fiche de paie', 'error');
      setDownloadLoading(null);
      return;
    }

    try {
      // Calculer les données de salaire pour le mois
      const [monthStr, yearStr] = payslip.month.split('-');
      const month = parseInt(monthStr);
      const year = parseInt(yearStr);

      const baseSalary = parseFloat(contract.salary) || 0;
      if (baseSalary <= 0) {
        showToast('Salaire de base non défini dans le contrat', 'error');
        setDownloadLoading(null);
        return;
      }

      // Calculer les primes du mois
      const monthPrimes = primes.filter(prime => {
        const primeDate = new Date(prime.createdAt);
        return primeDate.getMonth() + 1 === month &&
          primeDate.getFullYear() === year &&
          prime.status === 'APPROVED';
      });
      const totalPrimes = monthPrimes.reduce((sum, prime) => sum + (prime.amount || 0), 0);

      // Calculer les avances actives pour ce mois
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const activeAdvances = advances.filter(advance => {
        if (advance.status !== 'APPROVED') return false;
        const startDate = new Date(advance.createdAt);
        const endMonths = advance.months || 1;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + endMonths);
        return startDate <= monthEnd && endDate >= monthStart;
      });
      const totalAdvanceDeductions = activeAdvances.reduce((sum, advance) => {
        return sum + (advance.amount || 0);
      }, 0);

      // Calculer les charges sociales
      const grossSalary = baseSalary + totalPrimes;
      const socialChargesEmployee = Math.round(grossSalary * 0.22 * 100) / 100;
      const socialChargesEmployer = Math.round(grossSalary * 0.18 * 100) / 100;
      const netSalary = Math.round((grossSalary - socialChargesEmployee - totalAdvanceDeductions) * 100) / 100;

      const salaryCalculation = {
        baseSalary: Math.round(baseSalary * 100) / 100,
        grossSalary: Math.round(grossSalary * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        totalPrimes: Math.round(totalPrimes * 100) / 100,
        socialChargesEmployee: Math.round(socialChargesEmployee * 100) / 100,
        socialChargesEmployer: Math.round(socialChargesEmployer * 100) / 100,
        totalAdvanceDeductions: Math.round(totalAdvanceDeductions * 100) / 100,
        currency: contract.currency || tenant.currency || 'F CFA'
      };

      // Générer le bulletin selon le format
      if (format === 'html') {
        await downloadPayslipAsHtml(employee, contract, tenant, salaryCalculation, month, year);
      } else if (format === 'png' || format === 'jpg') {
        await downloadPayslipAsImage(employee, contract, tenant, salaryCalculation, month, year, format);
      } else if (format === 'pdf') {
        await downloadPayslipAsPdf(employee, contract, tenant, salaryCalculation, month, year);
      }

      showToast('Fiche de paie téléchargée avec succès', 'success');
    } catch (error: any) {
      console.error('Error downloading payslip:', error);
      showToast(`Erreur lors du téléchargement: ${error.message}`, 'error');
    } finally {
      setDownloadLoading(null);
    }
  };

  // Fonction pour télécharger la fiche de paie en HTML
  const downloadPayslipAsHtml = async (
    employee: any,
    contract: any,
    tenant: any,
    salaryCalculation: any,
    month: number,
    year: number
  ) => {
    // Créer un conteneur temporaire
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    document.body.appendChild(container);

    try {
      // Créer un root React pour le rendu
      const root = createRoot(container);

      // Rendre le composant PayslipPreview
      const payslipElement = React.createElement(PayslipPreview, {
        employee,
        contract,
        tenant,
        salaryCalculation,
        month,
        year
      });

      root.render(payslipElement);

      // Attendre que le rendu soit terminé
      await new Promise(resolve => setTimeout(resolve, 100));

      // Récupérer le HTML généré
      const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulletin de Paie - ${employee.firstName} ${employee.lastName}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${getPayslipStyles()}
  </style>
</head>
<body>
  ${container.innerHTML}
</body>
</html>`;

      // Créer et télécharger le fichier
      const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bulletin_Paie_${employee.firstName}_${employee.lastName}_${String(month).padStart(2, '0')}_${year}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Nettoyer
      root.unmount();
    } finally {
      document.body.removeChild(container);
    }
  };

  // Fonction pour télécharger la fiche de paie en image
  const downloadPayslipAsImage = async (
    employee: any,
    contract: any,
    tenant: any,
    salaryCalculation: any,
    month: number,
    year: number,
    format: string
  ) => {
    // Créer un conteneur temporaire
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    container.style.width = '794px'; // 210mm à 96 DPI
    container.style.height = '1123px'; // 297mm à 96 DPI
    document.body.appendChild(container);

    try {
      // Créer un root React pour le rendu
      const root = createRoot(container);

      // Rendre le composant PayslipPreview
      const payslipElement = React.createElement(PayslipPreview, {
        employee,
        contract,
        tenant,
        salaryCalculation,
        month,
        year
      });

      root.render(payslipElement);

      // Attendre que le rendu soit terminé
      await new Promise(resolve => setTimeout(resolve, 500));

      // Utiliser html2canvas pour capturer l'image
      const { default: html2canvas } = await import('html2canvas');

      const canvas = await html2canvas(container, {
        width: 794,
        height: 1123,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Convertir en blob et télécharger
      canvas.toBlob((blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Bulletin_Paie_${employee.firstName}_${employee.lastName}_${String(month).padStart(2, '0')}_${year}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        }
      }, `image/${format}`, 0.95);

      // Nettoyer
      root.unmount();
    } finally {
      document.body.removeChild(container);
    }
  };

  // Fonction pour télécharger la fiche de paie en PDF (via impression)
  const downloadPayslipAsPdf = async (
    employee: any,
    contract: any,
    tenant: any,
    salaryCalculation: any,
    month: number,
    year: number
  ) => {
    // Créer une nouvelle fenêtre avec le bulletin de paie
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    if (!newWindow) {
      throw new Error('Impossible d\'ouvrir une nouvelle fenêtre. Vérifiez les paramètres de votre navigateur.');
    }

    // Créer le contenu HTML
    const container = document.createElement('div');
    const root = createRoot(container);

    const payslipElement = React.createElement(PayslipPreview, {
      employee,
      contract,
      tenant,
      salaryCalculation,
      month,
      year
    });

    root.render(payslipElement);

    // Attendre que le rendu soit terminé
    await new Promise(resolve => setTimeout(resolve, 100));

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulletin de Paie - ${employee.firstName} ${employee.lastName}</title>
  <style>
    ${getPayslipStyles()}
    @media print {
      body { margin: 0; }
      #payslip-render { box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  ${container.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    newWindow.document.write(htmlContent);
    newWindow.document.close();

    // Nettoyer
    root.unmount();
  };

  // Fonction pour obtenir les styles CSS du bulletin de paie
  const getPayslipStyles = () => `
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0; 
      padding: 48px; 
      background: white; 
      color: #1e293b;
      width: 210mm;
      min-height: 297mm;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 40px;
      margin-bottom: 48px;
    }
    
    .company-info .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .logo-placeholder {
      width: 48px;
      height: 48px;
      background: #4f46e5;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    
    .company-name { 
      font-size: 24px; 
      font-weight: 900; 
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    
    .payslip-table { 
      width: 100%; 
      border-collapse: separate;
      border-spacing: 0;
      margin: 48px 0;
    }
    
    .payslip-table thead tr {
      background: #0f172a;
      color: white;
    }
    
    .payslip-table th { 
      padding: 20px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: left;
    }
    
    .payslip-table th:first-child { border-top-left-radius: 16px; }
    .payslip-table th:last-child { border-top-right-radius: 16px; }
    
    .payslip-table td { 
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
      font-weight: 600;
    }
    
    @media print { 
      body { margin: 0; padding: 20px; }
      .shadow-sm, .shadow-xl { box-shadow: none !important; }
      .border { border: none !important; }
    }
  `;


  const loadPayslips = async () => {
    if (!employee?.id) return;
    try {
      const response = await apiClient.get(`/hr/employees/${employee.id}/payslips`);
      setPayslips(response || []);
    } catch (error: any) {
      console.error('Error loading payslips:', error);
      setPayslips([]);
    }
  };

  // Fonctions pour les filtres de fiches de paie
  const handleFilterChange = (key: string, value: string | number) => {
    setPayslipFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setPayslipFilters({
      search: '',
      month: '',
      displayCount: 10
    });
  };

  // Filtrage des fiches de paie
  const getFilteredPayslips = () => {
    let filtered = [...payslips];

    // Sécurité : Filtrage par date d'embauche
    if (employee?.hireDate) {
      const hireDate = new Date(employee.hireDate);
      const hireMonthStart = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);
      filtered = filtered.filter(slip => {
        const slipDate = new Date(slip.month + '-01');
        return slipDate >= hireMonthStart;
      });
    }


    // Filtrage par recherche (nom de mois, année, statut)
    if (payslipFilters.search.trim()) {
      const searchTerm = payslipFilters.search.toLowerCase().trim();
      filtered = filtered.filter(slip => {
        const monthYear = new Date(slip.month + '-01').toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric'
        }).toLowerCase();
        const status = slip.status?.toLowerCase() || '';
        const netSalary = slip.netSalary?.toString() || '';

        return monthYear.includes(searchTerm) ||
          status.includes(searchTerm) ||
          netSalary.includes(searchTerm);
      });
    }

    // Filtrage par mois spécifique
    if (payslipFilters.month) {
      filtered = filtered.filter(slip => slip.month === payslipFilters.month);
    }

    // Limitation du nombre d'éléments affichés
    if (payslipFilters.displayCount !== 'all') {
      filtered = filtered.slice(0, payslipFilters.displayCount as number);
    }

    return filtered;
  };

  // Obtenir la liste unique des mois disponibles
  const getAvailableMonths = () => {
    const months = payslips.map(slip => slip.month);
    return [...new Set(months)].sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
  };

  // Fonctions de filtrage pour les avances
  const getFilteredAdvances = () => {
    let filtered = [...advances];

    // Filtrage par statut
    if (advanceFilters.status !== 'ALL') {
      filtered = filtered.filter(advance => advance.status === advanceFilters.status);
    }

    // Filtrage par recherche
    if (advanceFilters.search.trim()) {
      const searchTerm = advanceFilters.search.toLowerCase().trim();
      filtered = filtered.filter(advance =>
        advance.reason?.toLowerCase().includes(searchTerm) ||
        advance.amount?.toString().includes(searchTerm)
      );
    }

    // Filtrage par date
    if (advanceFilters.dateFrom) {
      filtered = filtered.filter(advance =>
        new Date(advance.createdAt) >= new Date(advanceFilters.dateFrom)
      );
    }
    if (advanceFilters.dateTo) {
      filtered = filtered.filter(advance =>
        new Date(advance.createdAt) <= new Date(advanceFilters.dateTo)
      );
    }

    // Filtrage par montant
    if (advanceFilters.amountMin) {
      filtered = filtered.filter(advance => advance.amount >= parseFloat(advanceFilters.amountMin));
    }
    if (advanceFilters.amountMax) {
      filtered = filtered.filter(advance => advance.amount <= parseFloat(advanceFilters.amountMax));
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Fonctions de filtrage pour les primes
  const getFilteredPrimes = () => {
    let filtered = [...primes];

    // Filtrage par type
    if (primeFilters.type !== 'ALL') {
      filtered = filtered.filter(prime => prime.type === primeFilters.type);
    }

    // Filtrage par recherche
    if (primeFilters.search.trim()) {
      const searchTerm = primeFilters.search.toLowerCase().trim();
      filtered = filtered.filter(prime =>
        prime.reason?.toLowerCase().includes(searchTerm) ||
        prime.type?.toLowerCase().includes(searchTerm) ||
        prime.amount?.toString().includes(searchTerm)
      );
    }

    // Filtrage par date
    if (primeFilters.dateFrom) {
      filtered = filtered.filter(prime =>
        new Date(prime.createdAt) >= new Date(primeFilters.dateFrom)
      );
    }
    if (primeFilters.dateTo) {
      filtered = filtered.filter(prime =>
        new Date(prime.createdAt) <= new Date(primeFilters.dateTo)
      );
    }

    // Filtrage par montant
    if (primeFilters.amountMin) {
      filtered = filtered.filter(prime => prime.amount >= parseFloat(primeFilters.amountMin));
    }
    if (primeFilters.amountMax) {
      filtered = filtered.filter(prime => prime.amount <= parseFloat(primeFilters.amountMax));
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Fonctions de gestion des filtres
  const handleAdvanceFilterChange = (key: string, value: string) => {
    setAdvanceFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePrimeFilterChange = (key: string, value: string) => {
    setPrimeFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetAdvanceFilters = () => {
    setAdvanceFilters({
      status: 'ALL',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      search: ''
    });
  };

  const resetPrimeFilters = () => {
    setPrimeFilters({
      type: 'ALL',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      search: ''
    });
  };

  // Statistiques pour les avances et primes
  const getAdvanceStats = () => {
    const approved = advances.filter(a => a.status === 'APPROVED');
    const pending = advances.filter(a => a.status === 'PENDING');
    const rejected = advances.filter(a => a.status === 'REJECTED');
    const totalAmount = approved.reduce((sum, a) => sum + (a.amount || 0), 0);

    return {
      total: advances.length,
      approved: approved.length,
      pending: pending.length,
      rejected: rejected.length,
      totalAmount,
      averageAmount: approved.length > 0 ? totalAmount / approved.length : 0
    };
  };

  const getPrimeStats = () => {
    const totalAmount = primes.reduce((sum, p) => sum + (p.amount || 0), 0);
    const byType = primes.reduce((acc, prime) => {
      acc[prime.type] = (acc[prime.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: primes.length,
      totalAmount,
      averageAmount: primes.length > 0 ? totalAmount / primes.length : 0,
      byType
    };
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return '📄';
    } else if (fileType.includes('image')) {
      return '🖼️';
    }
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Fonction utilitaire pour formater correctement les montants
  const formatAmount = (amount: any, currency: string = 'F CFA') => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0 ' + currency;
    // Convertir en nombre et supprimer les zéros inutiles
    const numAmount = parseFloat(amount.toString());
    if (numAmount === 0) return '0 ' + currency;
    return numAmount.toLocaleString('fr-FR') + ' ' + currency;
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // Utilitaire : capture un élément DOM → PDF A4 avec numéros de page
  // ──────────────────────────────────────────────────────────────────────────────
  const domToPdfBlob = async (el: HTMLElement, bgColor = '#f8fafc', docLabel = ''): Promise<Blob> => {
    const { default: jsPDFLib } = await import('jspdf');
    const { default: h2c } = await import('html2canvas');

    await new Promise(r => setTimeout(r, 200));

    const canvas = await h2c(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: 820,
      windowWidth: 820,
      height: el.scrollHeight,
      windowHeight: el.scrollHeight,
      backgroundColor: bgColor,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = 210, pdfH = 297;
    const imgH = (canvas.height * pdfW) / canvas.width;
    const totalPages = Math.max(1, Math.ceil(imgH / pdfH));

    for (let p = 0; p < totalPages; p++) {
      if (p > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -(p * pdfH), pdfW, imgH);
      // Numéro de page centré en bas
      pdf.setFontSize(7.5);
      pdf.setTextColor(160, 160, 160);
      const pageText = docLabel
        ? `${docLabel}  —  Page ${p + 1} / ${totalPages}`
        : `Page ${p + 1} / ${totalPages}`;
      pdf.text(pageText, 105, 292.5, { align: 'center' });
    }
    return pdf.output('blob') as Blob;
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // Téléchargement du dossier complet (ZIP)
  // ──────────────────────────────────────────────────────────────────────────────
  const handleDownloadDossierComplet = async () => {
    if (!employee) return;
    setDossierLoading(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      const empName = `${employee.firstName}_${employee.lastName}`;
      const currency = contract?.currency || 'F CFA';
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dept = departments.find((d: any) => d.id === employee.departmentId)?.name || 'Non spécifié';

      // ── 1. Fiche identitaire ──────────────────────────────────────────────
      const profileEl = document.createElement('div');
      profileEl.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;width:820px;padding:48px;box-sizing:border-box;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1e293b;font-size:13px;line-height:1.5;';
      const logoHtml = tenant?.logoUrl
        ? `<img src="${tenant.logoUrl}" style="height:52px;width:auto;object-fit:contain;margin-bottom:10px;max-width:180px;" />`
        : `<div style="font-size:20px;font-weight:900;color:#4f46e5;text-transform:uppercase;letter-spacing:-0.5px;margin-bottom:6px;">${tenant?.name || 'GESTOCKPRO'}</div>`;
      const statusBg = employee.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2';
      const statusClr = employee.status === 'ACTIVE' ? '#16a34a' : '#dc2626';
      profileEl.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:28px;margin-bottom:36px;">
  <div>${logoHtml}<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:#64748b;line-height:1.9;margin-top:4px;">
    ${tenant?.address ? `<div>${tenant.address}</div>` : ''}
    ${tenant?.phone ? `<div>Tél : ${tenant.phone}</div>` : ''}
    ${tenant?.email ? `<div>${tenant.email}</div>` : ''}
    ${tenant?.registrationNumber ? `<div>RCCM : ${tenant.registrationNumber}</div>` : ''}
  </div></div>
  <div style="text-align:right;">
    <h1 style="font-size:24px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 8px;">FICHE EMPLOYÉ</h1>
    <span style="font-size:9px;font-weight:700;color:#6366f1;background:#e0e7ff;padding:4px 14px;border-radius:8px;display:inline-block;">${today}</span>
  </div>
</div>
<div style="margin-bottom:28px;">
  <h2 style="font-size:22px;font-weight:900;color:#0f172a;margin:0 0 4px;">${employee.firstName} ${employee.lastName}</h2>
  <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#6366f1;margin:0 0 12px;">${employee.position || 'Employé'} — ${dept}</p>
  <span style="display:inline-block;padding:4px 16px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;background:${statusBg};color:${statusClr};">${employee.status === 'ACTIVE' ? 'Actif' : employee.status || '—'}</span>
</div>
<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#6366f1;border-bottom:2px solid #e0e7ff;padding-bottom:7px;margin:0 0 14px;">Informations personnelles</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-bottom:28px;">
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Email</div><div style="font-weight:700;">${employee.email || '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Téléphone</div><div style="font-weight:700;">${employee.phone || '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Adresse</div><div style="font-weight:700;">${employee.address || '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Date d'embauche</div><div style="font-weight:700;">${employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">N° Employé</div><div style="font-weight:700;">${employee.employeeNumber || '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Département</div><div style="font-weight:700;">${dept}</div></div>
</div>
<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#6366f1;border-bottom:2px solid #e0e7ff;padding-bottom:7px;margin:0 0 14px;">Contrat actif</div>
${contract ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-bottom:28px;">
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Type</div><div style="font-weight:700;">${contract.type}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Salaire de base</div><div style="font-weight:700;">${formatAmount(contract.salary, currency)}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Date de début</div><div style="font-weight:700;">${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px;">Date de fin</div><div style="font-weight:700;">${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Durée indéterminée'}</div></div>
</div>` : '<p style="color:#94a3b8;font-weight:700;margin-bottom:28px;">Aucun contrat actif</p>'}
<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#6366f1;border-bottom:2px solid #e0e7ff;padding-bottom:7px;margin:0 0 14px;">Bulletins de paie (${payslips.length})</div>
${payslips.length > 0 ? `<table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
  <thead><tr style="background:#0f172a;color:#fff;">
    <th style="padding:10px 14px;text-align:left;font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">Mois</th>
    <th style="padding:10px 14px;text-align:right;font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">Net à payer</th>
    <th style="padding:10px 14px;text-align:center;font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">Statut</th>
  </tr></thead>
  <tbody>${payslips.map((s: any) => `<tr style="border-bottom:1px solid #e2e8f0;">
    <td style="padding:10px 14px;font-weight:700;">${new Date(s.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>
    <td style="padding:10px 14px;text-align:right;font-weight:900;">${formatAmount(s.netSalary, currency)}</td>
    <td style="padding:10px 14px;text-align:center;"><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase;background:${s.status === 'VALIDATED' ? '#dcfce7' : '#e0e7ff'};color:${s.status === 'VALIDATED' ? '#16a34a' : '#4338ca'};">${s.status || '—'}</span></td>
  </tr>`).join('')}</tbody>
</table>` : '<p style="color:#94a3b8;font-weight:700;margin-bottom:28px;">Aucun bulletin disponible</p>'}
<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
  <span style="font-size:8px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${tenant?.name || 'GeStockPro'} • Système RH</span>
  <span style="font-size:8px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Généré le ${today}</span>
</div>`;
      document.body.appendChild(profileEl);
      const profilePdf = await domToPdfBlob(profileEl, '#f8fafc', `Fiche — ${employee.firstName} ${employee.lastName}`);
      document.body.removeChild(profileEl);
      zip.file(`01_Profil_${empName}.pdf`, profilePdf);

      // ── 2. Contrat actif ─────────────────────────────────────────────────
      if (contract) {
        const contractEl = document.createElement('div');
        contractEl.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;width:820px;padding:48px;box-sizing:border-box;min-height:1060px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;font-size:13px;line-height:1.5;';
        const logoContractHtml = tenant?.logoUrl
          ? `<img src="${tenant.logoUrl}" style="height:48px;width:auto;object-fit:contain;margin-bottom:10px;max-width:180px;filter:brightness(0) invert(1);" />`
          : `<div style="font-size:20px;font-weight:900;color:#818cf8;text-transform:uppercase;letter-spacing:-0.5px;margin-bottom:6px;">${tenant?.name || 'GESTOCKPRO'}</div>`;
        contractEl.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:28px;margin-bottom:36px;">
  <div>${logoContractHtml}<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,0.4);line-height:1.9;margin-top:4px;">
    ${tenant?.address ? `<div>${tenant.address}</div>` : ''}
    ${tenant?.phone ? `<div>Tél : ${tenant.phone}</div>` : ''}
    ${tenant?.email ? `<div>${tenant.email}</div>` : ''}
    ${tenant?.registrationNumber ? `<div>RCCM : ${tenant.registrationNumber}</div>` : ''}
  </div></div>
  <div style="text-align:right;">
    <h1 style="font-size:22px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 8px;">CONTRAT DE TRAVAIL</h1>
    <span style="font-size:9px;font-weight:700;color:#818cf8;background:rgba(99,102,241,0.2);padding:4px 14px;border-radius:8px;display:inline-block;">${today}</span>
  </div>
</div>
<div style="margin-bottom:28px;">
  <h2 style="font-size:22px;font-weight:900;color:#fff;margin:0 0 4px;">${employee.firstName} ${employee.lastName}</h2>
  <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#818cf8;margin:0 0 12px;">${employee.position || 'Employé'}</p>
  <span style="display:inline-block;padding:4px 16px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;background:#dcfce7;color:#16a34a;">${contract.status || 'ACTIVE'}</span>
</div>
<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:7px;margin:0 0 14px;">Informations du contrat</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-bottom:28px;">
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:3px;">Type de contrat</div><div style="font-weight:700;color:#fff;">${contract.type}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:3px;">Date de début</div><div style="font-weight:700;color:#fff;">${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div></div>
  <div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:3px;">Date de fin</div><div style="font-weight:700;color:#fff;">${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Durée indéterminée'}</div></div>
  ${contract.trialPeriodEnd ? `<div><div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:3px;">Fin période d'essai</div><div style="font-weight:700;color:#fff;">${new Date(contract.trialPeriodEnd).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>` : ''}
</div>
<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:7px;margin:0 0 14px;">Rémunération</div>
<p style="font-size:38px;font-weight:900;color:#fff;margin:6px 0 3px;">${formatAmount(contract.salary, currency)}</p>
<p style="font-size:10px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:0 0 28px;">${currency} / mois brut</p>
${contract.reason ? `<div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:7px;margin:0 0 14px;">Motif / Notes</div><p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:28px;">${contract.reason}</p>` : ''}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:48px;padding-top:28px;border-top:1px solid rgba(255,255,255,0.1);">
  <div>
    <p style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-bottom:56px;">Signature de l'employé</p>
    <div style="border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:6px;"></div>
    <p style="font-size:9px;color:rgba(255,255,255,0.4);font-weight:700;">${employee.firstName} ${employee.lastName}</p>
  </div>
  <div>
    <p style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-bottom:56px;">Signature &amp; cachet employeur</p>
    <div style="border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:6px;"></div>
    <p style="font-size:9px;color:rgba(255,255,255,0.4);font-weight:700;">${tenant?.name || 'Employeur'}</p>
  </div>
</div>
<div style="margin-top:28px;text-align:center;">
  <p style="font-size:7.5px;color:rgba(255,255,255,0.2);font-weight:700;text-transform:uppercase;letter-spacing:1px;">Document officiel — GeStockPro ERP • ${tenant?.name || ''}</p>
</div>`;
        document.body.appendChild(contractEl);
        const contractPdf = await domToPdfBlob(contractEl, '#0f172a', `Contrat — ${employee.firstName} ${employee.lastName}`);
        document.body.removeChild(contractEl);
        zip.file(`02_Contrat_${empName}.pdf`, contractPdf);
      }

      // ── 3. Bulletins de paie ─────────────────────────────────────────────
      if (payslips.length > 0 && contract) {
        const bulletinsFolder = zip.folder('03_Bulletins');
        const baseSalary = parseFloat(contract.salary) || 0;

        for (const slip of payslips) {
          try {
            const [monthStr, yearStr] = slip.month.split('-');
            const month = parseInt(monthStr);
            const year = parseInt(yearStr);
            const monthLabel = String(month).padStart(2, '0');

            const monthPrimes = primes.filter((p: any) => {
              const pd = new Date(p.createdAt);
              return pd.getMonth() + 1 === month && pd.getFullYear() === year && p.status === 'APPROVED';
            });
            const totalPrimes = monthPrimes.reduce((s: number, p: any) => s + (p.amount || 0), 0);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            const activeAdvances = advances.filter((a: any) => {
              if (a.status !== 'APPROVED') return false;
              const sd = new Date(a.createdAt);
              const ed = new Date(sd);
              ed.setMonth(ed.getMonth() + (a.months || 1));
              return sd <= monthEnd && ed >= monthStart;
            });
            const totalAdvDeductions = activeAdvances.reduce((s: number, a: any) => s + (a.amount || 0), 0);
            const grossSalary = baseSalary + totalPrimes;
            const socialEmp = Math.round(grossSalary * 0.22 * 100) / 100;
            const netSalary = Math.round((grossSalary - socialEmp - totalAdvDeductions) * 100) / 100;

            const salaryCalc = {
              baseSalary: Math.round(baseSalary * 100) / 100,
              grossSalary: Math.round(grossSalary * 100) / 100,
              netSalary,
              totalPrimes: Math.round(totalPrimes * 100) / 100,
              socialChargesEmployee: socialEmp,
              socialChargesEmployer: Math.round(grossSalary * 0.18 * 100) / 100,
              totalAdvanceDeductions: Math.round(totalAdvDeductions * 100) / 100,
              currency
            };

            // Rendre le composant PayslipPreview et capturer en PDF
            const { default: jsPDFSlip } = await import('jspdf');
            const { default: html2canvasSlip } = await import('html2canvas');

            const slipStyleEl = document.createElement('style');
            slipStyleEl.textContent = `body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}${getPayslipStyles()}`;
            document.head.appendChild(slipStyleEl);

            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-10000px;top:0;width:860px;background:#fff;z-index:-1';
            document.body.appendChild(container);
            const root = createRoot(container);
            root.render(React.createElement(PayslipPreview, { employee, contract, tenant, salaryCalculation: salaryCalc, month, year }));
            await new Promise(r => setTimeout(r, 180));

            const slipCanvas = await html2canvasSlip(container, {
              scale: 2,
              useCORS: true,
              logging: false,
              width: 860,
              windowWidth: 860,
              backgroundColor: '#ffffff',
            });

            root.unmount();
            document.body.removeChild(container);
            document.head.removeChild(slipStyleEl);

            const slipImgData = slipCanvas.toDataURL('image/png');
            const slipPdf = new jsPDFSlip({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const spW = 210, spH = 297;
            const spImgH = (slipCanvas.height * spW) / slipCanvas.width;
            let spLeft = spImgH;
            let spY = 0;
            slipPdf.addImage(slipImgData, 'PNG', 0, spY, spW, spImgH);
            spLeft -= spH;
            while (spLeft > 0) {
              spY -= spH;
              slipPdf.addPage();
              slipPdf.addImage(slipImgData, 'PNG', 0, spY, spW, spImgH);
              spLeft -= spH;
            }
            const slipPdfBlob = slipPdf.output('blob') as Blob;
            bulletinsFolder?.file(`Bulletin_${monthLabel}_${year}.pdf`, slipPdfBlob);
          } catch (slipErr) {
            console.warn('Erreur bulletin', slip.month, slipErr);
          }
        }
      }

      // ── 4. Documents uploadés ────────────────────────────────────────────
      if (documents.length > 0) {
        const docsFolder = zip.folder('04_Documents');
        for (const doc of documents) {
          if (!doc.fileUrl) continue;
          try {
            const response = await fetch(doc.fileUrl);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();
            const ext = doc.fileUrl.split('.').pop()?.split('?')[0] || 'bin';
            const safeName = (doc.name || doc.type || 'document').replace(/[^a-z0-9_\-]/gi, '_');
            docsFolder?.file(`${safeName}.${ext}`, arrayBuffer);
          } catch {
            // Ignorer les erreurs de fetch (CORS, etc.)
          }
        }
      }

      // ── 5. README ────────────────────────────────────────────────────────
      zip.file('README.txt', `DOSSIER COMPLET — ${employee.firstName.toUpperCase()} ${employee.lastName.toUpperCase()}
Généré le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Contenu du dossier :
  01_Profil_${empName}.pdf      — Fiche identitaire complète
  02_Contrat_${empName}.pdf     — Contrat de travail actif
  03_Bulletins/                 — Bulletins de paie en PDF (${payslips.length} bulletin${payslips.length > 1 ? 's' : ''})
  04_Documents/                 — Documents RH uploadés (${documents.length} fichier${documents.length > 1 ? 's' : ''})

GeStockPro ERP — Tous droits réservés`);

      // ── 6. Générer et télécharger le ZIP ─────────────────────────────────
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dossier_${empName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Dossier complet téléchargé avec succès', 'success');
    } catch (err: any) {
      console.error('Erreur dossier complet:', err);
      showToast(`Erreur lors de la génération du dossier: ${err.message}`, 'error');
    } finally {
      setDossierLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Général', icon: <UserCheck size={16} /> },
    { id: 'contracts', label: 'Contrats', icon: <FileText size={16} /> },
    { id: 'history', label: 'Historique', icon: <History size={16} /> },
    { id: 'documents', label: 'Documents', icon: <FolderOpen size={16} /> },
    { id: 'payroll', label: 'Paie', icon: <CreditCard size={16} /> },
    { id: 'attendance', label: 'Pointage', icon: <Clock size={16} /> },
    { id: 'performance', label: 'Performance', icon: <Activity size={16} /> },
  ];

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Success Alert */}
      <AnimatePresence>
        {showSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[200] max-w-[90vw] bg-emerald-500 text-white px-4 md:px-8 py-3 md:py-4 rounded-2xl shadow-2xl flex items-center gap-2 md:gap-4 font-black uppercase text-[10px] tracking-widest"
          >
            <CheckCircle2 size={20} /> {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('rh.employees')}
            className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl">
              <img
                src={employee.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.firstName + ' ' + employee.lastName)}&background=6366f1&color=fff&size=200&font-size=0.6`}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.firstName + ' ' + employee.lastName)}&background=6366f1&color=fff&size=200&font-size=0.6`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">{employee.firstName} {employee.lastName}</h1>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {employee.status}
                </span>

                {/* Indicateur de présence/absence */}
                {(() => {
                  const presenceStatus = getEmployeePresenceStatus(employee.id);
                  return presenceStatus.isPresent ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Présent</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full border border-red-200">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {presenceStatus.leaveType === 'SICK' ? 'En maladie' :
                            presenceStatus.leaveType === 'PAID' ? 'En congé payé' :
                              presenceStatus.leaveType === 'MATERNITY' ? 'Congé maternité' :
                                presenceStatus.leaveType === 'UNPAID' ? 'Congé sans solde' : 'Absent'}
                        </span>
                        {presenceStatus.leaveEndDate && (
                          <span className="text-[8px] text-red-500 font-medium">
                            Retour le {new Date(presenceStatus.leaveEndDate).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <p className="text-indigo-600 font-black uppercase text-xs tracking-widest">{employee.position} • {departments.find(d => d.id === employee.departmentId)?.name || 'Non spécifié'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadDossierComplet}
            disabled={dossierLoading}
            className="px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {dossierLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {dossierLoading ? 'Génération...' : 'Dossier Complet'}
          </button>
          <button
            onClick={() => {
              setEditForm({
                ...employee,
                hireDate: employee.hireDate?.split('T')[0] || '',
                photoUrl: employee.photoUrl || ''
              });
              setIsEditModalOpen(true);
            }}
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
          >
            <Edit3 size={16} /> Modifier Fiche
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      <HRModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modifier la Fiche Employé"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleUpdateEmployee}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
            >
              Mettre à jour
            </button>
          </div>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prénom <span className="text-red-500">*</span></label>
            <input type="text" value={editForm?.firstName || ''} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom <span className="text-red-500">*</span></label>
            <input type="text" value={editForm?.lastName || ''} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Professionnel <span className="text-red-500">*</span></label>
            <input type="email" value={editForm?.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
            <input type="text" value={editForm?.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Département</label>
            <select value={editForm?.departmentId || ''} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm">
              <option value="">Sélectionner un département</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poste</label>
            <input type="text" value={editForm?.position || ''} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date d'Embauche</label>
            <input type="date" value={editForm?.hireDate?.split('T')[0] || ''} onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Photo de Profil</label>
            <div className="flex items-center gap-4">
              {editForm?.photoUrl && (
                <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                  <img
                    src={editForm.photoUrl}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="photoUploadProfile"
                />
                <label
                  htmlFor="photoUploadProfile"
                  className={`w-full px-6 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-indigo-300 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {isUploading ? (
                    <><RefreshCw size={18} className="animate-spin mr-2" /> Téléchargement...</>
                  ) : (
                    <><Camera size={18} className="mr-2" /> Choisir une photo</>
                  )}
                </label>
              </div>
            </div>
          </div>
        </form>
      </HRModal>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1.5 rounded-[2rem] w-full sm:w-fit overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if ((tab.id === 'attendance' || tab.id === 'performance') && employee?.id) loadAttendance(employee.id); }}
            className={`px-3 sm:px-6 py-2.5 sm:py-3 rounded-full font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
          <>
            {activeTab === 'general' && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <UserCheck className="text-indigo-500" /> Informations Personnelles
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-10">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Professionnel</p>
                        <p className="text-sm font-bold text-slate-900">{employee.email || 'Non renseigné'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
                        <p className="text-sm font-bold text-slate-900">{employee.phone || 'Non renseigné'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Département</p>
                        <p className="text-sm font-bold text-slate-900">{departments.find(d => d.id === employee.departmentId)?.name || 'Non spécifié'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poste Actuel</p>
                        <p className="text-sm font-bold text-slate-900">{employee.position || 'Non spécifié'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'Embauche</p>
                        <p className="text-sm font-bold text-slate-900">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'Non renseignée'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut du Contrat</p>
                        <p className={`text-sm font-bold ${contract?.status === 'ACTIVE' ? 'text-emerald-600' :
                          contract?.status === 'SUSPENDED' ? 'text-amber-600' :
                            contract?.status === 'TERMINATED' ? 'text-red-600' :
                              'text-slate-500'
                          }`}>
                          {contract ? (
                            contract.status === 'ACTIVE' ? 'Contrat Actif' :
                              contract.status === 'SUSPENDED' ? 'Contrat Suspendu' :
                                contract.status === 'TERMINATED' ? 'Contrat Résilié' :
                                  contract.status
                          ) : 'Aucun contrat'}
                        </p>
                      </div>
                    </div>

                    {/* Contract status details */}
                    {contract && (contract.status === 'SUSPENDED' || contract.status === 'TERMINATED') && (
                      <div className="mt-8 p-6 bg-slate-50 rounded-2xl">
                        <h4 className="text-sm font-bold text-slate-900 mb-4">
                          Détails {contract.status === 'SUSPENDED' ? 'de la suspension' : 'de la résiliation'}
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-slate-500">Date:</p>
                            <p className="text-sm text-slate-900">
                              {contract.status === 'SUSPENDED' && contract.suspensionDate ?
                                new Date(contract.suspensionDate).toLocaleDateString('fr-FR') :
                                contract.status === 'TERMINATED' && contract.terminationDate ?
                                  new Date(contract.terminationDate).toLocaleDateString('fr-FR') :
                                  'Non renseignée'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500">Raison:</p>
                            <p className="text-sm text-slate-900">
                              {contract.status === 'SUSPENDED' ? contract.suspensionReason :
                                contract.status === 'TERMINATED' ? contract.terminationReason :
                                  'Non renseignée'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section Statut de Présence — lié au pointage du jour + congés */}
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Clock className="text-blue-500" /> Statut de Présence
                    </h3>
                    {loadingAttendance ? (
                      <div className="flex items-center justify-center h-20"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
                    ) : (() => {
                      const today = new Date().toISOString().split('T')[0];
                      const presenceStatus = getEmployeePresenceStatus(employee.id);

                      // Priorité 1 : congé approuvé en cours
                      if (!presenceStatus.isPresent && presenceStatus.leave) {
                        const leaveLabel = presenceStatus.leaveType === 'SICK' ? 'Arrêt maladie'
                          : presenceStatus.leaveType === 'PAID' ? 'Congé payé'
                            : presenceStatus.leaveType === 'MATERNITY' ? 'Congé maternité/paternité'
                              : presenceStatus.leaveType === 'UNPAID' ? 'Congé sans solde'
                                : 'Absence autorisée';
                        const start = new Date(presenceStatus.leave.startDate);
                        const end = new Date(presenceStatus.leave.endDate);
                        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        return (
                          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-4 h-4 rounded-full bg-amber-400" />
                                <div>
                                  <h4 className="text-lg font-black uppercase tracking-tighter text-amber-800">{leaveLabel}</h4>
                                  <p className="text-sm font-medium text-amber-600">Retour prévu le {new Date(presenceStatus.leaveEndDate!).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                </div>
                              </div>
                              <span className="px-3 py-1 bg-amber-200 text-amber-800 text-[9px] font-black uppercase rounded-full">{diffDays} j</span>
                            </div>
                            {presenceStatus.leave.reason && <p className="text-xs text-amber-700 font-medium border-t border-amber-200 pt-3">Motif : {presenceStatus.leave.reason}</p>}
                          </div>
                        );
                      }

                      // Priorité 2 : pointage du jour (section attendance)
                      if (attendanceToday) {
                        const clockIn = attendanceToday.clockIn ? new Date(attendanceToday.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
                        const clockOut = attendanceToday.clockOut ? new Date(attendanceToday.clockOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
                        const isLate = attendanceToday.status === 'LATE';
                        const isAbsent = attendanceToday.status === 'ABSENT';
                        const isWorking = clockIn && !clockOut;

                        if (isAbsent) {
                          return (
                            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200">
                              <div className="flex items-center gap-4">
                                <div className="w-4 h-4 rounded-full bg-rose-500" />
                                <div>
                                  <h4 className="text-lg font-black uppercase tracking-tighter text-rose-700">Absent aujourd'hui</h4>
                                  <p className="text-sm font-medium text-rose-500">Aucune présence enregistrée pour {today}</p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className={`p-6 rounded-2xl space-y-4 ${isLate ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-4 h-4 rounded-full ${isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                <div>
                                  <h4 className={`text-lg font-black uppercase tracking-tighter ${isLate ? 'text-amber-800' : 'text-emerald-800'}`}>
                                    {isWorking ? (isLate ? 'En service — arrivée tardive' : 'En service') : 'Journée terminée'}
                                  </h4>
                                  <p className={`text-sm font-medium ${isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {clockIn ? `Arrivée : ${clockIn}` : ''}
                                    {clockOut ? ` · Départ : ${clockOut}` : ''}
                                  </p>
                                </div>
                              </div>
                              {attendanceToday.overtimeMinutes > 0 && (
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded-full">
                                  +{Math.floor(attendanceToday.overtimeMinutes / 60)}h{attendanceToday.overtimeMinutes % 60 > 0 ? (attendanceToday.overtimeMinutes % 60) + 'm' : ''} supp.
                                </span>
                              )}
                            </div>
                            {isLate && attendanceToday.meta?.lateMinutes > 0 && (
                              <p className="text-xs text-amber-700 font-medium border-t border-amber-200 pt-3">Retard enregistré : {attendanceToday.meta.lateMinutes} min</p>
                            )}
                          </div>
                        );
                      }

                      // Priorité 3 : pas de pointage aujourd'hui, pas de congé → absent par défaut
                      return (
                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-4">
                            <div className="w-4 h-4 rounded-full bg-slate-300" />
                            <div>
                              <h4 className="text-lg font-black uppercase tracking-tighter text-slate-600">Pas encore pointé</h4>
                              <p className="text-sm font-medium text-slate-400">Aucun pointage enregistré pour aujourd'hui</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* KPI & Performance — calculés depuis l'historique de pointage */}
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <TrendingUp className="text-emerald-500" /> KPI & Performance Visuelle
                    </h3>
                    {loadingAttendance ? (
                      <div className="flex items-center justify-center h-20"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
                    ) : (() => {
                      const workRecords = attendanceHistory.filter(r => ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'].includes(r.status));
                      const totalDays = workRecords.length;
                      const presentDays = workRecords.filter(r => r.status === 'PRESENT').length;
                      const lateDays = workRecords.filter(r => r.status === 'LATE').length;
                      const absentDays = workRecords.filter(r => r.status === 'ABSENT').length;
                      const halfDays = workRecords.filter(r => r.status === 'HALF_DAY').length;
                      const totalOTMin = attendanceHistory.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
                      const assiduiteScore = totalDays > 0 ? Math.round(((presentDays + lateDays + halfDays * 0.5) / totalDays) * 100) : 0;
                      const ponctualiteScore = (presentDays + lateDays) > 0 ? Math.round((presentDays / (presentDays + lateDays)) * 100) : 100;
                      const otBonus = Math.min(10, Math.round(totalOTMin / 60));
                      const rawScore = totalDays > 0 ? Math.min(100, Math.round(assiduiteScore * 0.5 + ponctualiteScore * 0.4 + otBonus)) : null;
                      const grade = rawScore === null ? '—' : rawScore >= 95 ? 'A+' : rawScore >= 88 ? 'A' : rawScore >= 78 ? 'B+' : rawScore >= 65 ? 'B' : rawScore >= 50 ? 'C' : 'D';
                      const gradeColor = rawScore === null ? 'text-slate-400' : rawScore >= 88 ? 'text-emerald-500' : rawScore >= 65 ? 'text-indigo-500' : rawScore >= 50 ? 'text-amber-500' : 'text-rose-500';
                      const otHours = Math.floor(totalOTMin / 60);
                      const otMinRem = totalOTMin % 60;

                      if (totalDays === 0) {
                        return <p className="text-sm text-slate-400 font-medium text-center py-6">Aucun historique de pointage — les KPI seront disponibles après les premiers enregistrements.</p>;
                      }
                      return (
                        <div className="grid sm:grid-cols-3 gap-6">
                          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-2">
                            <p className={`text-3xl font-black ${assiduiteScore >= 90 ? 'text-emerald-600' : assiduiteScore >= 70 ? 'text-indigo-600' : assiduiteScore >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{assiduiteScore}%</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assiduité</p>
                            <p className="text-[9px] text-slate-400">{presentDays + lateDays} j travaillés / {totalDays}</p>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full ${assiduiteScore >= 90 ? 'bg-emerald-500' : assiduiteScore >= 70 ? 'bg-indigo-500' : assiduiteScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${assiduiteScore}%` }} />
                            </div>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-2">
                            <p className={`text-3xl font-black ${gradeColor}`}>{grade}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Global</p>
                            <p className="text-[9px] text-slate-400">{rawScore ?? '—'}/100 · {ponctualiteScore}% ponctualité</p>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full ${gradeColor.replace('text-', 'bg-')}`} style={{ width: `${rawScore ?? 0}%` }} />
                            </div>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-2">
                            <p className={`text-3xl font-black ${absentDays === 0 ? 'text-emerald-600' : absentDays <= 2 ? 'text-amber-500' : 'text-rose-500'}`}>{absentDays}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absences non just.</p>
                            <p className="text-[9px] text-slate-400">{otHours > 0 ? `${otHours}h${otMinRem > 0 ? otMinRem + 'm' : ''} heures supp.` : 'Aucune heure supp.'}</p>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full ${absentDays === 0 ? 'bg-emerald-500' : absentDays <= 2 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (absentDays / Math.max(totalDays, 1)) * 100 * 3)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Temps & Présence — données réelles */}
                  <div className="bg-slate-900 p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full"></div>
                    <h3 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                      <Clock className="text-indigo-400" /> Temps & Présence
                    </h3>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      // Congés approuvés futurs ou en cours
                      const upcomingLeaves = leaves.filter(l =>
                        String(l.employeeId) === String(employee.id) &&
                        l.status === 'APPROVED' &&
                        l.endDate >= today
                      );
                      const totalLeaveDays = upcomingLeaves.reduce((sum, l) => {
                        const s = new Date(l.startDate), e = new Date(l.endDate);
                        return sum + Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      }, 0);
                      // Heures sup du mois courant
                      const currentMonth = new Date().toISOString().substring(0, 7);
                      const monthOTMin = attendanceHistory
                        .filter(r => (r.date || r.createdAt || '').substring(0, 7) === currentMonth)
                        .reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
                      const otH = Math.floor(monthOTMin / 60);
                      const otM = monthOTMin % 60;
                      // Absences ce mois
                      const monthAbsences = attendanceHistory.filter(r =>
                        (r.date || r.createdAt || '').substring(0, 7) === currentMonth &&
                        r.status === 'ABSENT'
                      ).length;
                      return (
                        <div className="space-y-5 relative z-10">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">Congés approuvés</span>
                            <span className={`text-lg font-black ${totalLeaveDays > 0 ? 'text-amber-400' : 'text-white'}`}>
                              {totalLeaveDays > 0 ? `${totalLeaveDays} j` : '— '}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">Heures supp. (mois)</span>
                            <span className={`text-lg font-black ${monthOTMin > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {monthOTMin > 0 ? `+${otH}h${otM > 0 ? otM + 'm' : ''}` : '0h'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">Absences (mois)</span>
                            <span className={`text-lg font-black ${monthAbsences > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {monthAbsences > 0 ? `${monthAbsences} j` : '0'}
                            </span>
                          </div>
                          <div className="pt-2">
                            <button
                              onClick={() => { setActiveTab('attendance'); if (employee?.id) loadAttendance(employee.id); }}
                              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
                            >
                              Voir le pointage complet
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Alertes & Rappels — enrichies */}
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-3">
                      <AlertCircle className="text-amber-500" /> Alertes & Rappels
                    </h3>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const alerts: React.ReactNode[] = [];

                      // 1. Contrat expirant bientôt
                      expiringContracts.filter(c => c.employee_id === employee.id).forEach((c, i) => {
                        const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        alerts.push(
                          <div key={`exp-${i}`} className="flex items-start gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-xs font-black text-rose-800 uppercase">Contrat {c.type} expire dans {daysLeft} j</p>
                              <p className="text-[10px] text-rose-500 font-medium">{new Date(c.end_date).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                        );
                      });

                      // 2. Période d'essai en cours
                      if (contract?.trialPeriodEnd && new Date(contract.trialPeriodEnd) > new Date()) {
                        const daysLeft = Math.ceil((new Date(contract.trialPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        alerts.push(
                          <div key="trial" className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-xs font-black text-amber-800 uppercase">Période d'essai — {daysLeft} j restants</p>
                              <p className="text-[10px] text-amber-600 font-medium">Fin le {new Date(contract.trialPeriodEnd).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                        );
                      }

                      // 3. Congé approuvé à venir (dans les 7 prochains jours)
                      leaves.filter(l =>
                        String(l.employeeId) === String(employee.id) &&
                        l.status === 'APPROVED' &&
                        l.startDate >= today &&
                        Math.ceil((new Date(l.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7
                      ).forEach((l, i) => {
                        const daysUntil = Math.ceil((new Date(l.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const typeLabel = l.type === 'PAID' ? 'Congé payé' : l.type === 'SICK' ? 'Arrêt maladie' : l.type === 'MATERNITY' ? 'Maternité/Paternité' : 'Congé';
                        alerts.push(
                          <div key={`leave-${i}`} className="flex items-start gap-3 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                            <Calendar className="text-sky-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-xs font-black text-sky-800 uppercase">{typeLabel} dans {daysUntil === 0 ? 'aujourd\'hui' : `${daysUntil} j`}</p>
                              <p className="text-[10px] text-sky-500 font-medium">Du {new Date(l.startDate).toLocaleDateString('fr-FR')} au {new Date(l.endDate).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                        );
                      });

                      // 4. Avances en attente de validation
                      const pendingAdvances = advances.filter(a => a.status === 'PENDING');
                      if (pendingAdvances.length > 0) {
                        alerts.push(
                          <div key="adv" className="flex items-start gap-3 p-4 bg-violet-50 rounded-2xl border border-violet-100">
                            <CreditCard className="text-violet-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-xs font-black text-violet-800 uppercase">{pendingAdvances.length} avance{pendingAdvances.length > 1 ? 's' : ''} en attente</p>
                              <p className="text-[10px] text-violet-500 font-medium">À valider dans la section Paie</p>
                            </div>
                          </div>
                        );
                      }

                      // 5. Absentéisme élevé ce mois
                      const currentMonth = new Date().toISOString().substring(0, 7);
                      const monthAbsences = attendanceHistory.filter(r =>
                        (r.date || r.createdAt || '').substring(0, 7) === currentMonth && r.status === 'ABSENT'
                      ).length;
                      if (monthAbsences >= 3) {
                        alerts.push(
                          <div key="abs" className="flex items-start gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                            <UserX className="text-rose-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-xs font-black text-rose-800 uppercase">{monthAbsences} absences ce mois</p>
                              <p className="text-[10px] text-rose-500 font-medium">Suivi recommandé — voir onglet Performance</p>
                            </div>
                          </div>
                        );
                      }

                      // 6. Pas de contrat actif
                      if (!contract) {
                        alerts.push(
                          <div key="nocontract" className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <FileText className="text-blue-500 shrink-0 mt-0.5" size={16} />
                            <p className="text-xs font-medium text-blue-800">Aucun contrat actif pour cet employé.</p>
                          </div>
                        );
                      }

                      if (alerts.length === 0) {
                        return (
                          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                            <p className="text-xs font-medium text-emerald-800">Aucune alerte — situation normale.</p>
                          </div>
                        );
                      }
                      return <div className="space-y-3">{alerts}</div>;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contracts' && (
              <div className="space-y-8">

                {/* ── En-tête ── */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                      <FileText className="text-indigo-500" size={22} /> Gestion du Contrat
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Contrat de travail · {employee.firstName} {employee.lastName}</p>
                  </div>
                  {!contract && (
                    <button
                      onClick={() => { resetContractForm(); setIsContractModalOpen(true); }}
                      className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                    >
                      <Plus size={16} /> Créer Contrat
                    </button>
                  )}
                </div>

                {/* ── Carte contrat actif ── */}
                {contract ? (
                  <div className="space-y-6">

                    {/* Bandeau statut */}
                    <div className={`rounded-[2.5rem] overflow-hidden shadow-xl ${contract.status === 'ACTIVE' ? 'bg-gradient-to-br from-slate-900 to-indigo-950' :
                      contract.status === 'SUSPENDED' ? 'bg-gradient-to-br from-amber-900 to-amber-800' :
                        'bg-gradient-to-br from-rose-900 to-rose-800'
                      }`}>
                      {/* Header carte */}
                      <div className="px-6 md:px-10 pt-8 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                          <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg ${contract.status === 'ACTIVE' ? 'bg-indigo-500' :
                            contract.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}>
                            <Briefcase size={28} className="text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-black text-white tracking-tighter">{contract.contractType || contract.type || 'N/A'}</span>
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${contract.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                contract.status === 'SUSPENDED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                {contract.status === 'ACTIVE' ? '● Actif' : contract.status === 'SUSPENDED' ? '⏸ Suspendu' : '✕ Résilié'}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Contrat de travail</p>
                          </div>
                        </div>
                        {/* Salaire */}
                        {contract.salary && (
                          <div className="text-right">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Salaire de base</p>
                            <p className="text-2xl font-black text-white">{formatAmount(contract.salary, contract.currency)}</p>
                            <p className="text-[9px] text-white/40 font-medium">{contract.currency || 'F CFA'} / mois</p>
                          </div>
                        )}
                      </div>

                      {/* Grille dates */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-t border-white/10">
                        {[
                          { label: 'Date de début', value: contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : '—' },
                          { label: 'Date de fin', value: contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Indéterminée' },
                          { label: 'Durée', value: contract.startDate && contract.endDate ? calculateContractDuration(contract.startDate, contract.endDate) : contract.startDate ? `Depuis ${new Date(contract.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : '—' },
                          { label: "Fin d'essai", value: contract.trialPeriodEnd ? new Date(contract.trialPeriodEnd).toLocaleDateString('fr-FR') : 'N/A' },
                        ].map((item, i) => (
                          <div key={i} className="px-6 py-5 bg-white/5">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className="text-sm font-black text-white">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Période d'essai en cours */}
                      {contract.trialPeriodEnd && new Date(contract.trialPeriodEnd) > new Date() && (
                        <div className="mx-6 md:mx-10 mb-6 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                          <Clock size={16} className="text-amber-400 shrink-0" />
                          <p className="text-xs font-bold text-amber-300">
                            Période d'essai en cours — se termine le {new Date(contract.trialPeriodEnd).toLocaleDateString('fr-FR')} ({Math.ceil((new Date(contract.trialPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} jours restants)
                          </p>
                        </div>
                      )}

                      {/* Détails suspension / résiliation */}
                      {(contract.status === 'SUSPENDED' || contract.status === 'TERMINATED') && (
                        <div className={`mx-6 md:mx-10 mb-6 mt-4 p-5 rounded-2xl border ${contract.status === 'SUSPENDED' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${contract.status === 'SUSPENDED' ? 'text-amber-400' : 'text-rose-400'}`}>
                            {contract.status === 'SUSPENDED' ? 'Motif de suspension' : 'Motif de résiliation'}
                          </p>
                          <p className="text-sm font-medium text-white/80">
                            {contract.status === 'SUSPENDED' ? contract.suspensionReason : contract.terminationReason || '—'}
                          </p>
                          {(contract.suspensionDate || contract.terminationDate) && (
                            <p className={`text-[10px] font-bold mt-2 ${contract.status === 'SUSPENDED' ? 'text-amber-400' : 'text-rose-400'}`}>
                              Le {new Date(contract.suspensionDate || contract.terminationDate).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      )}

                    </div>

                    {/* ── Barre d'actions — en dehors de la carte sombre ── */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {contract.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => { resetSuspensionForm(); setSelectedContract(contract); setIsSuspendModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                          >
                            <Clock size={14} /> Suspendre
                          </button>
                          <button
                            onClick={() => { resetTerminationForm(); setSelectedContract(contract); setIsTerminateModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                          >
                            <X size={14} /> Résilier
                          </button>
                        </>
                      )}
                      {contract.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleReactivateContract(contract.id)}
                          className="flex items-center gap-2 px-5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                          <CheckCircle2 size={14} /> Réactiver
                        </button>
                      )}
                      <button className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ml-auto">
                        <Download size={14} /> Exporter
                      </button>
                    </div>

                  </div>
                ) : (
                  /* ── Aucun contrat ── */
                  <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 flex flex-col items-center text-center gap-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center">
                      <FileText size={36} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Aucun contrat actif</p>
                      <p className="text-sm text-slate-400 font-medium">Créez le premier contrat de travail pour cet employé.</p>
                    </div>
                    <button
                      onClick={() => { resetContractForm(); setIsContractModalOpen(true); }}
                      className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                    >
                      <Plus size={16} /> Créer le contrat
                    </button>
                  </div>
                )}

                {/* ── Modals (inchangés) ── */}
                <div className="hidden">
                  {/* Contract Modal */}
                  <HRModal
                    isOpen={isContractModalOpen}
                    onClose={() => {
                      resetContractForm();
                      setIsContractModalOpen(false);
                    }}
                    title="Créer un Contrat"
                    size="md"
                    footer={
                      <div className="flex justify-end gap-4">
                        <button onClick={() => {
                          resetContractForm();
                          setIsContractModalOpen(false);
                        }} className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Annuler</button>
                        <button onClick={handleAddContract} className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Créer</button>
                      </div>
                    }
                  >
                    <form className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Contrat <span className="text-red-500">*</span></label>
                          <select
                            value={contractForm.type}
                            onChange={(e) => handleContractTypeChange(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          >
                            <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
                            <option value="CDD">CDD (Contrat à Durée Déterminée)</option>
                            <option value="STAGE">Stage</option>
                            <option value="FREELANCE">Freelance</option>
                          </select>
                          <p className="text-[9px] text-slate-500 font-medium">
                            {contractForm.type === 'CDI' && 'Pas de date de fin requise'}
                            {contractForm.type === 'CDD' && 'Date de fin obligatoire'}
                            {contractForm.type === 'STAGE' && 'Durée max: 6 mois'}
                            {contractForm.type === 'FREELANCE' && 'Dates flexibles'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salaire de Base</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="Ex: 1500000"
                            value={contractForm.salary}
                            onChange={(e) => setContractForm({ ...contractForm, salary: e.target.value })}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          />
                          <p className="text-[9px] text-slate-500 font-medium">Montant en F CFA (optionnel)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de Début <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={contractForm.startDate}
                            onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                            min={(() => {
                              const minDate = new Date();
                              minDate.setFullYear(minDate.getFullYear() - 10);
                              return minDate.toISOString().split('T')[0];
                            })()}
                            max={(() => {
                              const maxDate = new Date();
                              maxDate.setFullYear(maxDate.getFullYear() + 2);
                              return maxDate.toISOString().split('T')[0];
                            })()}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          />
                          <p className="text-[9px] text-slate-500 font-medium">Entre -10 ans et +2 ans max</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Date de Fin
                            {(contractForm.type === 'CDD' || contractForm.type === 'STAGE') && <span className="text-red-500">*</span>}
                            {contractForm.type === 'CDI' && <span className="text-slate-400">(Non applicable)</span>}
                          </label>
                          <input
                            type="date"
                            value={contractForm.endDate}
                            onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                            min={contractForm.startDate || new Date().toISOString().split('T')[0]}
                            max={(() => {
                              if (!contractForm.startDate) return undefined;
                              const maxDate = new Date(contractForm.startDate);
                              if (contractForm.type === 'STAGE') {
                                maxDate.setMonth(maxDate.getMonth() + 6);
                              } else {
                                maxDate.setFullYear(maxDate.getFullYear() + 5);
                              }
                              return maxDate.toISOString().split('T')[0];
                            })()}
                            disabled={contractForm.type === 'CDI'}
                            className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm ${contractForm.type === 'CDI' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                          <p className="text-[9px] text-slate-500 font-medium">
                            {contractForm.type === 'CDI' && 'CDI = durée indéterminée'}
                            {contractForm.type === 'CDD' && 'Obligatoire pour CDD (max 5 ans)'}
                            {contractForm.type === 'STAGE' && 'Obligatoire pour stage (max 6 mois)'}
                            {contractForm.type === 'FREELANCE' && 'Optionnel (max 5 ans)'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Fin de Période d'Essai (Optionnel)
                          {contractForm.type === 'STAGE' && <span className="text-slate-400"> - Non applicable</span>}
                        </label>
                        <input
                          type="date"
                          value={contractForm.trialPeriodEnd}
                          onChange={(e) => setContractForm({ ...contractForm, trialPeriodEnd: e.target.value })}
                          min={contractForm.startDate || new Date().toISOString().split('T')[0]}
                          max={(() => {
                            if (!contractForm.startDate) return undefined;
                            const maxDate = new Date(contractForm.startDate);
                            const maxMonths = contractForm.type === 'CDI' ? 4 :
                              contractForm.type === 'CDD' ? 1 : 0;
                            maxDate.setMonth(maxDate.getMonth() + maxMonths);
                            return contractForm.type === 'STAGE' ? undefined : maxDate.toISOString().split('T')[0];
                          })()}
                          disabled={contractForm.type === 'STAGE'}
                          className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm ${contractForm.type === 'STAGE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <p className="text-[9px] text-slate-500 font-medium">
                          {contractForm.type === 'CDI' && 'Max 4 mois pour CDI'}
                          {contractForm.type === 'CDD' && 'Max 1 mois pour CDD'}
                          {contractForm.type === 'STAGE' && 'Pas de période d\'essai pour stages'}
                          {contractForm.type === 'FREELANCE' && 'Max 2 mois pour Freelance'}
                        </p>
                      </div>

                      {/* Résumé du contrat en temps réel */}
                      {(contractForm.startDate || contractForm.endDate || contractForm.salary) && (
                        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">Résumé du Contrat</h4>
                          <div className="space-y-2">
                            {contractForm.startDate && formatDateForDisplay(contractForm.startDate) && (
                              <p className="text-sm text-indigo-700">
                                <strong>Début :</strong> {formatDateForDisplay(contractForm.startDate)}
                              </p>
                            )}
                            {contractForm.endDate && formatDateForDisplay(contractForm.endDate) && (
                              <p className="text-sm text-indigo-700">
                                <strong>Fin :</strong> {formatDateForDisplay(contractForm.endDate)}
                              </p>
                            )}
                            {contractForm.startDate && contractForm.endDate && (
                              <p className="text-sm text-indigo-700">
                                <strong>Durée :</strong> {calculateContractDuration(contractForm.startDate, contractForm.endDate)}
                              </p>
                            )}
                            {contractForm.salary && (
                              <p className="text-sm text-indigo-700">
                                <strong>Salaire :</strong> {formatAmount(parseInt(contractForm.salary))}
                              </p>
                            )}
                            <p className="text-xs text-indigo-600 mt-3 p-3 bg-white rounded-xl">
                              💡 {getContractTypeRules(contractForm.type).helpText}
                            </p>
                          </div>
                        </div>
                      )}
                    </form>
                  </HRModal>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-50">
                          <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Début</th>
                          <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fin</th>
                          <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire de Base</th>
                          <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                          <th className="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contract ? (
                          <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-6">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${contract.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' :
                                contract.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-600' :
                                  contract.status === 'TERMINATED' ? 'bg-red-50 text-red-600' :
                                    'bg-slate-50 text-slate-600'
                                }`}>
                                {contract.contractType || contract.type || 'N/A'}
                              </span>
                            </td>
                            <td className="py-6 text-sm font-bold text-slate-900">{contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}</td>
                            <td className="py-6 text-sm font-bold text-slate-500">{contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Indéterminé'}</td>
                            <td className="py-6 text-sm font-black text-slate-900">{contract.salary ? formatAmount(contract.salary, contract.currency) : 'Confidentiel'}</td>
                            <td className="py-6">
                              <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${contract.status === 'ACTIVE' ? 'text-emerald-500' :
                                contract.status === 'SUSPENDED' ? 'text-amber-500' :
                                  contract.status === 'TERMINATED' ? 'text-red-500' :
                                    'text-slate-500'
                                }`}>
                                <CheckCircle2 size={14} />
                                {contract.status === 'ACTIVE' ? 'Actif' :
                                  contract.status === 'SUSPENDED' ? 'Suspendu' :
                                    contract.status === 'TERMINATED' ? 'Résilié' : contract.status}
                              </span>
                            </td>
                            <td className="py-6 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                {contract.status === 'ACTIVE' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        resetSuspensionForm();
                                        setSelectedContract(contract);
                                        setIsSuspendModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-100 transition-all"
                                    >
                                      Suspendre
                                    </button>
                                    <button
                                      onClick={() => {
                                        resetTerminationForm();
                                        setSelectedContract(contract);
                                        setIsTerminateModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-100 transition-all"
                                    >
                                      Résilier
                                    </button>
                                  </>
                                )}
                                {contract.status === 'SUSPENDED' && (
                                  <button
                                    onClick={() => handleReactivateContract(contract.id)}
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-100 transition-all"
                                  >
                                    Réactiver
                                  </button>
                                )}
                                <button className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                                  <Download size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center">
                                  <FileText size={32} />
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-slate-900 mb-1">Aucun contrat trouvé</p>
                                  <p className="text-sm text-slate-500">Créez le premier contrat pour cet employé.</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Termination Modal */}
                  <HRModal
                    isOpen={isTerminateModalOpen}
                    onClose={() => {
                      setIsTerminateModalOpen(false);
                      resetTerminationForm();
                      setSelectedContract(null);
                    }}
                    title="Résilier le Contrat"
                    size="md"
                    footer={
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            resetTerminationForm();
                            setSelectedContract(null);
                            setIsTerminateModalOpen(false);
                          }}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleTerminateContract}
                          disabled={terminationForm.reason.trim().length < 10}
                          className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Confirmer la Résiliation
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-6">
                      <div className="text-center p-6 bg-red-50 rounded-2xl">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-red-900 mb-2">Attention</h3>
                        <p className="text-sm text-red-700">Cette action va résilier définitivement le contrat. Cette opération ne peut pas être annulée.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raison de la résiliation <span className="text-red-500">*</span></label>
                        <textarea
                          value={terminationForm.reason}
                          onChange={(e) => setTerminationForm({ reason: e.target.value })}
                          placeholder="Décrivez la raison de la résiliation (minimum 10 caractères)..."
                          rows={4}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-2">{terminationForm.reason.length}/10 minimum</p>
                      </div>
                    </div>
                  </HRModal>

                  {/* Suspension Modal */}
                  <HRModal
                    isOpen={isSuspendModalOpen}
                    onClose={() => {
                      setIsSuspendModalOpen(false);
                      resetSuspensionForm();
                      setSelectedContract(null);
                    }}
                    title="Suspendre le Contrat"
                    size="md"
                    footer={
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            resetSuspensionForm();
                            setSelectedContract(null);
                            setIsSuspendModalOpen(false);
                          }}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSuspendContract}
                          disabled={suspensionForm.reason.trim().length < 10}
                          className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Confirmer la Suspension
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-6">
                      <div className="text-center p-6 bg-amber-50 rounded-2xl">
                        <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-amber-900 mb-2">Suspension Temporaire</h3>
                        <p className="text-sm text-amber-700">Le contrat sera suspendu temporairement. Il pourra être réactivé ultérieurement.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raison de la suspension <span className="text-red-500">*</span></label>
                        <textarea
                          value={suspensionForm.reason}
                          onChange={(e) => setSuspensionForm({ reason: e.target.value })}
                          placeholder="Décrivez la raison de la suspension (minimum 10 caractères)..."
                          rows={4}
                          className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all font-medium text-sm resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-2">{suspensionForm.reason.length}/10 minimum</p>
                      </div>
                    </div>
                  </HRModal>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-8">

                {/* ── En-tête ── */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                      <History className="text-indigo-500" size={22} /> Timeline Carrière
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Historique complet · contrats, primes, avances</p>
                  </div>
                  <button
                    onClick={() => employee?.id && loadCareerTimeline(employee.id)}
                    disabled={loadingTimeline}
                    className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loadingTimeline ? 'animate-spin' : ''} />
                    {loadingTimeline ? 'Actualisation...' : 'Actualiser'}
                  </button>
                </div>

                {/* ── Salaire du mois en cours ── */}
                <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl">
                  <div className="px-6 md:px-10 pt-8 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10">
                    <div>
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Salaire calculé</p>
                      <h4 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <CreditCard size={16} className="text-indigo-400" />
                        {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </h4>
                    </div>
                    {loadingSalary ? (
                      <div className="flex items-center gap-2 text-white/50">
                        <Loader2 size={16} className="animate-spin" /> <span className="text-xs font-bold">Calcul...</span>
                      </div>
                    ) : currentMonthSalary ? (
                      <p className="text-3xl font-black text-white">{formatAmount(currentMonthSalary.netSalary, currentMonthSalary.currency)} <span className="text-sm font-bold text-white/40">net</span></p>
                    ) : (
                      <p className="text-sm font-bold text-white/30">{contract ? 'Calcul indisponible' : 'Aucun contrat actif'}</p>
                    )}
                  </div>

                  {currentMonthSalary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5">
                      {[
                        { label: 'Salaire de base', value: formatAmount(currentMonthSalary.baseSalary, currentMonthSalary.currency), color: 'text-white' },
                        { label: `Primes (${currentMonthSalary.primesCount})`, value: `+${formatAmount(currentMonthSalary.totalPrimes, currentMonthSalary.currency)}`, color: 'text-emerald-400' },
                        { label: `Avances (${currentMonthSalary.advancesCount})`, value: `-${formatAmount(currentMonthSalary.totalAdvances, currentMonthSalary.currency)}`, color: 'text-rose-400' },
                        { label: 'Charges sociales', value: `-${formatAmount(currentMonthSalary.socialChargesEmployee, currentMonthSalary.currency)}`, color: 'text-amber-400' },
                      ].map((item, i) => (
                        <div key={i} className="px-6 py-5 bg-white/5">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">{item.label}</p>
                          <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Timeline des événements ── */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 md:p-10">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-50 pb-4">
                    Historique des événements
                  </h4>

                  {/* Salaire du Mois En Cours */}
                  <div className="mb-10 p-8 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-[2.5rem] border border-indigo-100">
                    <h4 className="text-sm font-black uppercase tracking-widest text-indigo-900 mb-6 flex items-center gap-2">
                      <CreditCard className="text-indigo-600" /> Salaire du Mois ({new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})
                    </h4>

                    {loadingSalary ? (
                      <div className="flex items-center gap-3 text-indigo-600">
                        <RefreshCw className="animate-spin" size={16} />
                        <span className="text-sm font-medium">Calcul en cours...</span>
                      </div>
                    ) : currentMonthSalary ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Salaire Base</p>
                          <p className="text-xl font-black text-slate-900">{formatAmount(currentMonthSalary.baseSalary, currentMonthSalary.currency)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Primes ({currentMonthSalary.primesCount})</p>
                          <p className="text-xl font-black text-emerald-600">+{formatAmount(currentMonthSalary.totalPrimes, currentMonthSalary.currency)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Avances ({currentMonthSalary.advancesCount})</p>
                          <p className="text-xl font-black text-red-600">-{formatAmount(currentMonthSalary.totalAdvances, currentMonthSalary.currency)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Net à Payer</p>
                          <p className="text-2xl font-black text-indigo-900">{formatAmount(currentMonthSalary.netSalary, currentMonthSalary.currency)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <AlertCircle className="text-amber-500 mx-auto mb-2" size={24} />
                        <p className="text-sm font-medium text-slate-600">
                          {contract ? 'Impossible de calculer le salaire du mois' : 'Aucun contrat actif'}
                        </p>
                      </div>
                    )}

                    {/* Détails des déductions d'avances si présentes */}
                    {currentMonthSalary?.advanceDetails && currentMonthSalary.advanceDetails.length > 0 && (
                      <div className="mt-6 p-6 bg-red-50 rounded-[2rem] border border-red-100">
                        <h5 className="text-sm font-black uppercase tracking-widest text-red-900 mb-4 flex items-center gap-2">
                          <TrendingDown className="text-red-600" size={16} /> Déductions Avances ce Mois
                        </h5>
                        <div className="space-y-3">
                          {currentMonthSalary.advanceDetails.map((advance: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-white rounded-xl border border-red-100">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900">{advance.reason}</p>
                                <p className="text-xs text-slate-500">
                                  Reste {advance.remainingMonths} mois • Total: {formatAmount(advance.totalAmount, currentMonthSalary.currency)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-red-600">-{formatAmount(advance.monthlyAmount, currentMonthSalary.currency)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Détails des primes si présentes */}
                    {currentMonthSalary?.primeDetails && currentMonthSalary.primeDetails.length > 0 && (
                      <div className="mt-6 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                        <h5 className="text-sm font-black uppercase tracking-widest text-emerald-900 mb-4 flex items-center gap-2">
                          <TrendingUp className="text-emerald-600" size={16} /> Primes ce Mois
                        </h5>
                        <div className="space-y-3">
                          {currentMonthSalary.primeDetails.map((prime: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-white rounded-xl border border-emerald-100">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900">{prime.reason}</p>
                                <p className="text-xs text-slate-500">
                                  Type: {prime.type} • Accordée le {new Date(prime.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-emerald-600">+{formatAmount(prime.amount, currentMonthSalary.currency)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {loadingTimeline ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 size={28} className="animate-spin text-indigo-400 mr-3" />
                      <span className="text-sm font-bold text-slate-400">Chargement de l'historique...</span>
                    </div>
                  ) : careerTimeline.length > 0 ? (
                    <div className="relative">
                      {/* Ligne verticale */}
                      <div className="absolute left-[22px] top-3 bottom-3 w-px bg-slate-100" />

                      <div className="space-y-4">
                        {careerTimeline.map((event: any, idx: number) => {
                          const isContract = (event.type || '').startsWith('CONTRACT');
                          const isAdvance = event.type === 'ADVANCE';
                          const isPrime = event.type === 'PRIME';

                          // Couleur du nœud
                          const nodeStyle = (() => {
                            if (isAdvance) return { dot: 'bg-blue-500', ring: 'ring-blue-100', icon: <CreditCard size={12} className="text-white" />, card: 'border-blue-100 bg-blue-50/50' };
                            if (isPrime) return { dot: 'bg-emerald-500', ring: 'ring-emerald-100', icon: <TrendingUp size={12} className="text-white" />, card: 'border-emerald-100 bg-emerald-50/50' };
                            switch (event.type) {
                              case 'CONTRACT_START': return { dot: 'bg-indigo-600', ring: 'ring-indigo-100', icon: <FileText size={12} className="text-white" />, card: 'border-indigo-100 bg-indigo-50/50' };
                              case 'CONTRACT_RENEWED':
                              case 'CONTRACT_MODIFICATION': return { dot: 'bg-sky-500', ring: 'ring-sky-100', icon: <RefreshCw size={12} className="text-white" />, card: 'border-sky-100 bg-sky-50/50' };
                              case 'CONTRACT_SUSPENDED': return { dot: 'bg-amber-500', ring: 'ring-amber-100', icon: <AlertCircle size={12} className="text-white" />, card: 'border-amber-100 bg-amber-50/50' };
                              case 'CONTRACT_TERMINATED': return { dot: 'bg-rose-500', ring: 'ring-rose-100', icon: <X size={12} className="text-white" />, card: 'border-rose-100 bg-rose-50/50' };
                              default: return { dot: 'bg-slate-400', ring: 'ring-slate-100', icon: <FileText size={12} className="text-white" />, card: 'border-slate-100 bg-slate-50' };
                            }
                          })();

                          // Badge statut
                          const statusBadge = (() => {
                            if (isAdvance) {
                              const s = event.status;
                              return s === 'APPROVED' ? { label: 'Approuvée', cls: 'bg-emerald-100 text-emerald-700' }
                                : s === 'REJECTED' ? { label: 'Refusée', cls: 'bg-rose-100 text-rose-700' }
                                  : { label: 'En attente', cls: 'bg-amber-100 text-amber-700' };
                            }
                            if (isPrime) {
                              const typeLabel: Record<string, string> = {
                                PERFORMANCE: 'Performance', EXCEPTIONAL: 'Exceptionnelle',
                                ANNUAL_BONUS: 'Annuelle', PROJECT_BONUS: 'Projet',
                              };
                              return { label: typeLabel[event.primeType] || event.primeType || 'Prime', cls: 'bg-emerald-100 text-emerald-700' };
                            }
                            if (isContract) {
                              const s = event.status;
                              return s === 'ACTIVE' ? { label: 'Actif', cls: 'bg-emerald-100 text-emerald-700' }
                                : s === 'TERMINATED' ? { label: 'Résilié', cls: 'bg-rose-100 text-rose-700' }
                                  : s === 'SUSPENDED' ? { label: 'Suspendu', cls: 'bg-amber-100 text-amber-700' }
                                    : { label: s || '—', cls: 'bg-slate-100 text-slate-600' };
                            }
                            return null;
                          })();

                          return (
                            <div key={event.id || idx} className="relative flex gap-5 pl-0">
                              {/* Nœud timeline */}
                              <div className={`relative z-10 mt-4 w-11 h-11 shrink-0 rounded-2xl ${nodeStyle.dot} ring-4 ${nodeStyle.ring} flex items-center justify-center shadow-sm`}>
                                {nodeStyle.icon}
                              </div>

                              {/* Carte événement */}
                              <div className={`flex-1 p-5 rounded-[1.5rem] border ${nodeStyle.card} mb-1`}>
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    {/* Date */}
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                      {new Date(event.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                    {/* Titre */}
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">
                                      {event.title}
                                    </p>
                                    {/* Description */}
                                    {event.description && (
                                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{event.description}</p>
                                    )}
                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {isContract && event.contractType && (
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${event.contractType === 'CDI' ? 'bg-indigo-100 text-indigo-700' :
                                          event.contractType === 'CDD' ? 'bg-blue-100 text-blue-700' :
                                            event.contractType === 'STAGE' ? 'bg-purple-100 text-purple-700' :
                                              'bg-slate-100 text-slate-600'
                                          }`}>{event.contractType}</span>
                                      )}
                                      {statusBadge && (
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge.cls}`}>
                                          {statusBadge.label}
                                        </span>
                                      )}
                                      {isAdvance && event.months > 1 && (
                                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                                          {event.months} mois
                                        </span>
                                      )}
                                      {isPrime && event.details?.isPaid && (
                                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
                                          Payée
                                        </span>
                                      )}
                                      {isContract && event.isRenewal && (
                                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-sky-100 text-sky-700">
                                          Renouvellement
                                        </span>
                                      )}
                                    </div>
                                    {/* Raison refus avance */}
                                    {isAdvance && event.details?.rejectionReason && (
                                      <p className="mt-2 text-[10px] text-rose-600 font-bold italic">Motif refus : {event.details.rejectionReason}</p>
                                    )}
                                  </div>

                                  {/* Montant */}
                                  {(event.amount || event.salary) && (
                                    <div className="text-right shrink-0">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                        {isAdvance ? 'Avance / mois' : isPrime ? 'Prime' : 'Salaire'}
                                      </p>
                                      <p className={`text-base font-black ${isAdvance ? 'text-blue-700' : isPrime ? 'text-emerald-700' : 'text-slate-900'}`}>
                                        {formatAmount(event.amount || event.salary, event.currency)}
                                      </p>
                                      {isAdvance && event.months > 1 && (
                                        <p className="text-[9px] text-slate-400 font-bold">
                                          Total : {formatAmount(event.amount * event.months, event.currency)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center">
                        <History size={28} className="text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-700 uppercase tracking-tight mb-1">Aucun historique disponible</p>
                        <p className="text-xs text-slate-400 font-medium">Les événements apparaîtront ici au fur et à mesure.</p>
                      </div>
                      <button
                        onClick={() => employee?.id && loadCareerTimeline(employee.id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        <RefreshCw size={13} /> Actualiser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <FolderOpen className="text-indigo-500" /> Dossier Numérique
                  </h3>
                  <button
                    onClick={() => setIsDocModalOpen(true)}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                  >
                    <Plus size={16} /> Ajouter Document
                  </button>
                </div>

                {/* Document Modal */}
                <HRModal
                  isOpen={isDocModalOpen}
                  onClose={() => {
                    setIsDocModalOpen(false);
                    resetDocForm();
                  }}
                  title="Ajouter un Document"
                  size="md"
                  footer={
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setIsDocModalOpen(false);
                          resetDocForm();
                        }}
                        className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleAddDoc}
                        disabled={isUploadingDoc || !docForm.name.trim() || !docForm.file}
                        className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploadingDoc ? 'Upload...' : 'Uploader'}
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom du Document <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="Ex: CNI_Recto.pdf"
                        value={docForm.name}
                        onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Document <span className="text-red-500">*</span></label>
                      <select
                        value={docForm.type}
                        onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      >
                        <option value="ID_CARD">Pièce d'Identité</option>
                        <option value="CONTRACT">Contrat</option>
                        <option value="DIPLOMA">Diplôme</option>
                        <option value="BANK_DETAILS">RIB/Compte Bancaire</option>
                        <option value="MEDICAL">Certificat Médical</option>
                        <option value="OTHER">Autre</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie (optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: CNI, Passeport, Permis..."
                        value={docForm.category}
                        onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                      />
                    </div>

                    {/* File Upload Area */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fichier <span className="text-red-500">*</span></label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        disabled={isUploadingDoc}
                        className="hidden"
                        id="documentUpload"
                      />
                      <label
                        htmlFor="documentUpload"
                        className={`p-10 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center hover:border-indigo-500 transition-all cursor-pointer group ${isUploadingDoc ? 'opacity-50 cursor-not-allowed' : ''
                          } ${docForm.file ? 'border-emerald-300 bg-emerald-50' : ''
                          }`}
                      >
                        {docForm.file ? (
                          <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 text-2xl">
                              {getFileIcon(docForm.file.type)}
                            </div>
                            <p className="text-sm font-bold text-emerald-700 mb-1">{docForm.file.name}</p>
                            <p className="text-xs font-medium text-emerald-600">{formatFileSize(docForm.file.size)}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Cliquez pour changer</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 group-hover:scale-110 transition-transform">
                              <Plus size={32} />
                            </div>
                            <p className="text-xs font-bold text-slate-500">Cliquez pour sélectionner un fichier</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">PDF, JPG, PNG (Max 10MB)</p>
                          </>
                        )}
                      </label>
                    </div>

                    {/* File Preview for Images */}
                    {docForm.file && docForm.file.type.startsWith('image/') && (
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Aperçu</p>
                        <div className="w-full h-40 bg-white rounded-xl overflow-hidden border border-slate-100">
                          <img
                            src={URL.createObjectURL(docForm.file)}
                            alt="Aperçu"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </HRModal>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {documents.length > 0 ? documents.map((doc) => (
                    <div key={doc.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-indigo-200 transition-all group">
                      <div className="flex items-start justify-between mb-6">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${doc.type === 'CONTRACT' ? 'bg-blue-50 text-blue-600' :
                          doc.type === 'ID_CARD' ? 'bg-green-50 text-green-600' :
                            doc.type === 'DIPLOMA' ? 'bg-purple-50 text-purple-600' :
                              doc.type === 'BANK_DETAILS' ? 'bg-amber-50 text-amber-600' :
                                doc.type === 'MEDICAL' ? 'bg-red-50 text-red-600' :
                                  'bg-slate-50 text-slate-600'
                          }`}>
                          {doc.type === 'CONTRACT' ? 'Contrat' :
                            doc.type === 'ID_CARD' ? 'Identité' :
                              doc.type === 'DIPLOMA' ? 'Diplôme' :
                                doc.type === 'BANK_DETAILS' ? 'Bancaire' :
                                  doc.type === 'MEDICAL' ? 'Médical' :
                                    'Autre'}
                          {doc.category && (
                            <span className="ml-2 opacity-75">• {doc.category}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handlePreviewDoc(doc)}
                            className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center gap-1 justify-center text-slate-400 hover:text-indigo-600 transition-all px-2"
                            title="Prévisualiser"
                          >
                            👁
                          </button>
                          <button
                            onClick={() => handleDownloadDoc(doc)}
                            className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all"
                            title="Télécharger"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 transition-all"
                            title="Supprimer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Preview pour images */}
                      {doc.mimeType && doc.mimeType.startsWith('image/') && (
                        <div className="w-full h-32 bg-white rounded-xl overflow-hidden border border-slate-100 mb-4">
                          <img
                            src={doc.fileUrl}
                            alt={doc.name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => handlePreviewDoc(doc)}
                          />
                        </div>
                      )}

                      {/* Icon pour PDF */}
                      {doc.mimeType && doc.mimeType.includes('pdf') && (
                        <div className="w-full h-32 bg-white rounded-xl border border-slate-100 mb-4 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"
                          onClick={() => handlePreviewDoc(doc)}>
                          <div className="text-center">
                            <div className="text-4xl mb-2">📄</div>
                            <p className="text-xs font-bold text-slate-500">Document PDF</p>
                            <p className="text-[9px] text-slate-400 mt-1">Cliquer pour prévisualiser</p>
                          </div>
                        </div>
                      )}

                      <h4 className="text-sm font-black text-slate-900 truncate mb-1">{doc.name}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {doc.fileSize ? formatFileSize(doc.fileSize) : 'N/A'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('fr-FR') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center">
                      <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <FolderOpen size={40} />
                      </div>
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Aucun document</h3>
                      <p className="text-slate-500 font-medium text-sm mb-6">Ajoutez le premier document à ce dossier employé.</p>
                      <button
                        onClick={() => setIsDocModalOpen(true)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
                      >
                        <Plus size={16} className="mr-2" /> Ajouter un Document
                      </button>
                    </div>
                  )}
                </div>

                {/* Modal de Prévisualisation */}
                <HRModal
                  isOpen={isPreviewModalOpen}
                  onClose={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewDoc(null);
                  }}
                  title={`Prévisualisation - ${previewDoc?.name || 'Document'}`}
                  size="xl"
                  footer={
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">
                          {previewDoc?.fileSize ? formatFileSize(previewDoc.fileSize) : 'N/A'} •
                          {previewDoc?.uploadedAt ? new Date(previewDoc.uploadedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => previewDoc && handleDownloadDoc(previewDoc)}
                          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all"
                        >
                          <Download size={16} /> Télécharger
                        </button>
                        <button
                          onClick={() => previewDoc?.fileUrl && window.open(previewDoc.fileUrl, '_blank')}
                          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
                        >
                          Ouvrir dans un nouvel onglet
                        </button>
                        <button
                          onClick={() => {
                            setIsPreviewModalOpen(false);
                            setPreviewDoc(null);
                          }}
                          className="px-6 py-3 border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  }
                >
                  {previewDoc && (
                    <div className="space-y-4">
                      {/* Informations du document */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-900 mb-2">{previewDoc.name}</h4>
                            <div className="flex items-center gap-6 text-sm text-slate-600">
                              <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${previewDoc.type === 'CONTRACT' ? 'bg-blue-50 text-blue-600' :
                                previewDoc.type === 'ID_CARD' ? 'bg-green-50 text-green-600' :
                                  previewDoc.type === 'DIPLOMA' ? 'bg-purple-50 text-purple-600' :
                                    previewDoc.type === 'BANK_DETAILS' ? 'bg-amber-50 text-amber-600' :
                                      previewDoc.type === 'MEDICAL' ? 'bg-red-50 text-red-600' :
                                        'bg-slate-50 text-slate-600'
                                }`}>
                                {previewDoc.type === 'CONTRACT' ? 'Contrat' :
                                  previewDoc.type === 'ID_CARD' ? 'Identité' :
                                    previewDoc.type === 'DIPLOMA' ? 'Diplôme' :
                                      previewDoc.type === 'BANK_DETAILS' ? 'Bancaire' :
                                        previewDoc.type === 'MEDICAL' ? 'Médical' :
                                          'Autre'}
                              </span>
                              {previewDoc.category && (
                                <span className="text-slate-500">Catégorie : {previewDoc.category}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Zone de prévisualisation */}
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        {previewDoc.mimeType && previewDoc.mimeType.startsWith('image/') && (
                          <div className="w-full flex items-center justify-center bg-slate-50 p-4">
                            <img
                              src={previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `${BASE_URL}${previewDoc.fileUrl}`}
                              alt={previewDoc.name}
                              className="max-w-full max-h-96 object-contain rounded-xl shadow-lg"
                              style={{ maxHeight: '500px' }}
                            />
                          </div>
                        )}

                        {previewDoc.mimeType && previewDoc.mimeType.includes('pdf') && (
                          <div className="w-full">
                            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-2xl">📄</div>
                                <div>
                                  <p className="font-bold text-slate-900">Document PDF</p>
                                  <p className="text-xs text-slate-500">Aperçu direct</p>
                                </div>
                              </div>
                            </div>
                            <iframe
                              src={previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `${BASE_URL}${previewDoc.fileUrl}`}
                              className="w-full h-[600px] border-none"
                              title="Aperçu PDF"
                            />
                          </div>
                        )}

                        {/* Fallback pour autres types de fichiers */}
                        {previewDoc.mimeType && !previewDoc.mimeType.startsWith('image/') && !previewDoc.mimeType.includes('pdf') && (
                          <div className="w-full h-64 flex items-center justify-center bg-slate-50">
                            <div className="text-center">
                              <div className="text-4xl mb-4">📎</div>
                              <p className="text-lg font-bold text-slate-900 mb-2">Prévisualisation non disponible</p>
                              <p className="text-sm text-slate-500 mb-4">Ce type de fichier ne peut pas être prévisualisé directement.</p>
                              <button
                                onClick={() => window.open(previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `${BASE_URL}${previewDoc.fileUrl}`, '_blank')}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
                              >
                                Ouvrir le fichier
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </HRModal>

                {/* Modal de Confirmation de Suppression */}
                <HRModal
                  isOpen={isDeleteModalOpen}
                  onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDocToDelete(null);
                  }}
                  title="Supprimer le Document"
                  size="md"
                  footer={
                    <div className="flex gap-4 w-full">
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                          setDocToDelete(null);
                        }}
                        className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmDeleteDoc}
                        className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95"
                      >
                        Supprimer Définitivement
                      </button>
                    </div>
                  }
                >
                  {docToDelete && (
                    <div className="space-y-6">
                      <div className="text-center p-8 bg-red-50 rounded-2xl border border-red-100">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <X size={32} className="text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-red-900 mb-2">Attention !</h3>
                        <p className="text-sm text-red-700 mb-4">
                          Cette action va supprimer définitivement le document.
                          <br />
                          Cette opération ne peut pas être annulée.
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <div className="flex items-start gap-4">
                          <div className="text-3xl">{getFileIcon(docToDelete.mimeType || '')}</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 truncate mb-2">
                              {docToDelete.name}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="px-2 py-1 bg-slate-200 rounded-lg font-medium">
                                {docToDelete.type?.replace('_', ' ')}
                              </span>
                              {docToDelete.category && (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium">
                                  {docToDelete.category}
                                </span>
                              )}
                              <span className="text-slate-600 font-medium">
                                {formatFileSize(docToDelete.fileSize || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center p-4 bg-slate-100 rounded-2xl">
                        <p className="text-sm font-bold text-slate-700">
                          Êtes-vous sûr de vouloir supprimer ce document ?
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Cette action est irréversible et le fichier sera définitivement perdu.
                        </p>
                      </div>
                    </div>
                  )}
                </HRModal>
              </div>
            )
            }

            {
              activeTab === 'payroll' && (
                <div className="space-y-8">
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                        <CreditCard className="text-indigo-500" /> Historique des Bulletins
                      </h3>
                      <div className="flex items-center gap-3">

                        <select className="bg-slate-50 border-none rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 px-4 py-2 focus:ring-2 focus:ring-indigo-500">
                          <option>Année 2026</option>
                          <option>Année 2025</option>
                          <option>Année 2024</option>
                        </select>
                      </div>
                    </div>

                    {/* Avertissement si pas de contrat actif */}
                    {!hasActiveContract && (
                      <div className="mb-8 flex items-start gap-4 p-6 bg-amber-50 rounded-2xl border border-amber-200">
                        <AlertCircle className="text-amber-500 shrink-0" size={20} />
                        <div>
                          <h4 className="font-black text-amber-800 uppercase text-xs tracking-widest mb-1">Aucun Contrat Actif</h4>
                          <p className="text-amber-700 text-sm font-medium">
                            Cet employé n'a pas de contrat actif. La génération de fiches de paie nécessite un contrat en statut "ACTIF".
                            {contracts.some(c => String(c.employeeId) === String(employeeId)) && (
                              <span className="block mt-2">
                                Vérifiez les contrats existants dans l'onglet "Contrats" ou créez un nouveau contrat actif.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Filtres et recherche */}
                    <div className="mb-8 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Barre de recherche */}
                        <div className="md:col-span-2 relative">
                          <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Rechercher par mois, année, statut..."
                            value={payslipFilters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
                          />
                        </div>

                        {/* Filtre par mois */}
                        <div className="relative">
                          <select
                            value={payslipFilters.month}
                            onChange={(e) => handleFilterChange('month', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm appearance-none cursor-pointer"
                          >
                            <option value="">Tous les mois</option>
                            {getAvailableMonths().map(month => (
                              <option key={month} value={month}>
                                {new Date(month + '-01').toLocaleDateString('fr-FR', {
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </option>
                            ))}
                          </select>
                          <Filter size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Nombre d'éléments à afficher */}
                        <div className="relative">
                          <select
                            value={payslipFilters.displayCount}
                            onChange={(e) => handleFilterChange('displayCount', e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm appearance-none cursor-pointer"
                          >
                            <option value={5}>5 bulletins</option>
                            <option value={10}>10 bulletins</option>
                            <option value={25}>25 bulletins</option>
                            <option value="all">Tous</option>
                          </select>
                        </div>
                      </div>

                      {/* Indicateurs et bouton reset */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-500 font-medium">
                            {getFilteredPayslips().length} sur {payslips.length} bulletin{payslips.length > 1 ? 's' : ''}
                          </span>
                          {(payslipFilters.search || payslipFilters.month || payslipFilters.displayCount !== 10) && (
                            <button
                              onClick={resetFilters}
                              className="text-indigo-600 hover:text-indigo-700 font-black text-xs uppercase tracking-widest transition-all"
                            >
                              Réinitialiser filtres
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {getFilteredPayslips().length > 0 ? getFilteredPayslips().map((slip, i) => (
                        <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100">
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                              <FileText size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                {new Date(slip.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                              </p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Net à payer: {formatAmount(slip.netSalary)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${slip.status === 'PAID' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                              slip.status === 'PENDING' ? 'text-amber-600 bg-amber-50 border border-amber-100' :
                                'text-slate-500 bg-slate-100 border border-slate-200'
                              }`}>
                              {slip.status === 'PAID' ? 'Payé' : slip.status === 'PENDING' ? 'En attente' : 'Brouillon'}
                            </span>

                            {/* Bouton PDF direct */}
                            <button
                              onClick={() => handleDownloadPayslip(slip, 'pdf')}
                              disabled={downloadLoading === slip.month}
                              title="Télécharger en PDF"
                              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {downloadLoading === slip.month ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Download size={13} />
                              )}
                              PDF
                            </button>

                            {/* Autres formats (discret) */}
                            <div className="relative group">
                              <button
                                disabled={downloadLoading === slip.month}
                                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all disabled:opacity-50"
                                title="Autres formats"
                              >
                                <MoreVertical size={15} />
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                                {[
                                  { fmt: 'png', icon: <Camera size={14} className="text-blue-500" />, label: 'PNG', sub: 'Image haute qualité' },
                                  { fmt: 'jpg', icon: <Image size={14} className="text-green-500" />, label: 'JPG', sub: 'Image compressée' },
                                  { fmt: 'html', icon: <Code size={14} className="text-indigo-500" />, label: 'HTML', sub: 'Format web' },
                                ].map(({ fmt, icon, label, sub }) => (
                                  <button
                                    key={fmt}
                                    onClick={() => handleDownloadPayslip(slip, fmt)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    {icon}
                                    <div className="text-left">
                                      <p className="font-black uppercase tracking-tight text-[11px]">{label}</p>
                                      <p className="text-[9px] text-slate-400">{sub}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={24} className="text-slate-400" />
                          </div>
                          {payslips.length === 0 ? (
                            <>
                              <h3 className="text-lg font-bold text-slate-600 mb-2">Aucune fiche de paie</h3>
                              <p className="text-sm text-slate-500 mb-6">Aucune fiche de paie n'a encore été générée pour cet employé.</p>
                              <button
                                onClick={handleGeneratePayslip}
                                disabled={isGeneratingPayslip}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isGeneratingPayslip ? 'Génération...' : 'Générer la première fiche'}
                              </button>
                            </>
                          ) : (
                            <>
                              <h3 className="text-lg font-bold text-slate-600 mb-2">Aucun résultat</h3>
                              <p className="text-sm text-slate-500 mb-6">Aucune fiche de paie ne correspond à vos critères de recherche.</p>
                              <button
                                onClick={resetFilters}
                                className="px-6 py-3 bg-slate-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                              >
                                Effacer les filtres
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <TrendingUp className="text-indigo-500" /> Primes & Avances
                    </h3>

                    {/* Statistiques Rapides */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
                      <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                        <div className="flex items-center gap-3 mb-2">
                          <TrendingUp className="text-emerald-600" size={20} />
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Primes Total</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{formatAmount(getPrimeStats().totalAmount)}</p>
                        <p className="text-xs text-slate-500 mt-1">{getPrimeStats().total} prime(s)</p>
                      </div>
                      <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100">
                        <div className="flex items-center gap-3 mb-2">
                          <CreditCard className="text-indigo-600" size={20} />
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Avances Total</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{formatAmount(getAdvanceStats().totalAmount)}</p>
                        <p className="text-xs text-slate-500 mt-1">{getAdvanceStats().total} avance(s)</p>
                      </div>
                      <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="text-amber-600" size={20} />
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">En Attente</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{getAdvanceStats().pending}</p>
                        <p className="text-xs text-slate-500 mt-1">avance(s) pending</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                          <BarChart3 className="text-slate-600" size={20} />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Moyenne Prime</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{Math.round(getPrimeStats().averageAmount).toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1">F CFA par prime</p>
                      </div>
                    </div>

                    {/* Section Primes avec Filtres Avancés */}
                    <div className="space-y-8">
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" size={18} />
                            Primes Exceptionnelles ({getFilteredPrimes().length})
                          </h4>
                          <button
                            onClick={resetPrimeFilters}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-all"
                          >
                            Réinitialiser filtres
                          </button>
                        </div>

                        {/* Filtres Primes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-6 bg-slate-50 rounded-2xl">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Recherche</label>
                            <input
                              type="text"
                              placeholder="Raison, type ou montant..."
                              value={primeFilters.search}
                              onChange={(e) => handlePrimeFilterChange('search', e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Type</label>
                            <select
                              value={primeFilters.type}
                              onChange={(e) => handlePrimeFilterChange('type', e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            >
                              <option value="ALL">Tous les types</option>
                              <option value="PERFORMANCE">Performance</option>
                              <option value="EXCEPTIONAL">Exceptionnelle</option>
                              <option value="ANNUAL_BONUS">Prime annuelle</option>
                              <option value="PROJECT_BONUS">Prime de projet</option>
                              <option value="OTHER">Autre</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Du</label>
                              <input
                                type="date"
                                value={primeFilters.dateFrom}
                                onChange={(e) => handlePrimeFilterChange('dateFrom', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Au</label>
                              <input
                                type="date"
                                value={primeFilters.dateTo}
                                onChange={(e) => handlePrimeFilterChange('dateTo', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Liste des Primes */}
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {getFilteredPrimes().length > 0 ? (
                            getFilteredPrimes().map((prime) => (
                              <div key={prime.id} className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="text-emerald-600" size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-widest">
                                        {prime.type}
                                      </span>
                                      <span className="text-sm font-bold text-slate-900">{formatAmount(prime.amount)}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 max-w-md">{prime.reason}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      {new Date(prime.createdAt).toLocaleDateString('fr-FR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold">
                                    Accordée
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                              <h4 className="text-lg font-bold text-slate-600 mb-2">Aucune prime trouvée</h4>
                              <p className="text-slate-500 text-sm">Aucune prime ne correspond aux critères de filtrage.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section Avances avec Filtres Avancés */}
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <CreditCard className="text-indigo-500" size={18} />
                            Avances sur Salaire ({getFilteredAdvances().length})
                          </h4>
                          <button
                            onClick={resetAdvanceFilters}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-all"
                          >
                            Réinitialiser filtres
                          </button>
                        </div>

                        {/* Filtres Avances */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-6 bg-slate-50 rounded-2xl">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Recherche</label>
                            <input
                              type="text"
                              placeholder="Raison ou montant..."
                              value={advanceFilters.search}
                              onChange={(e) => handleAdvanceFilterChange('search', e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Statut</label>
                            <select
                              value={advanceFilters.status}
                              onChange={(e) => handleAdvanceFilterChange('status', e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            >
                              <option value="ALL">Tous les statuts</option>
                              <option value="PENDING">En attente</option>
                              <option value="APPROVED">Approuvée</option>
                              <option value="REJECTED">Refusée</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Du</label>
                              <input
                                type="date"
                                value={advanceFilters.dateFrom}
                                onChange={(e) => handleAdvanceFilterChange('dateFrom', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Au</label>
                              <input
                                type="date"
                                value={advanceFilters.dateTo}
                                onChange={(e) => handleAdvanceFilterChange('dateTo', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Montant Min</label>
                              <input
                                type="number"
                                placeholder="0"
                                value={advanceFilters.amountMin}
                                onChange={(e) => handleAdvanceFilterChange('amountMin', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Montant Max</label>
                              <input
                                type="number"
                                placeholder="∞"
                                value={advanceFilters.amountMax}
                                onChange={(e) => handleAdvanceFilterChange('amountMax', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Liste des Avances */}
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {getFilteredAdvances().length > 0 ? (
                            getFilteredAdvances().map((advance) => (
                              <div key={advance.id} className={`flex items-center justify-between p-6 rounded-2xl border transition-all hover:shadow-lg ${advance.status === 'APPROVED' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-100' :
                                advance.status === 'PENDING' ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-100' :
                                  'bg-gradient-to-r from-red-50 to-rose-50 border-red-100'
                                }`}>
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${advance.status === 'APPROVED' ? 'bg-emerald-100' :
                                    advance.status === 'PENDING' ? 'bg-amber-100' :
                                      'bg-red-100'
                                    }`}>
                                    <CreditCard className={`${advance.status === 'APPROVED' ? 'text-emerald-600' :
                                      advance.status === 'PENDING' ? 'text-amber-600' :
                                        'text-red-600'
                                      }`} size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-bold text-slate-900">{formatAmount(advance.amount)}</span>
                                      <span className="text-xs text-slate-500">× {advance.months} mois</span>
                                      <span className="text-xs font-bold text-slate-700">
                                        = {formatAmount(advance.amount * advance.months)} total
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-600 max-w-md">{advance.reason}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      Demandée le {new Date(advance.createdAt).toLocaleDateString('fr-FR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${advance.status === 'APPROVED' ? 'bg-emerald-600 text-white' :
                                    advance.status === 'PENDING' ? 'bg-amber-600 text-white' :
                                      'bg-red-600 text-white'
                                    }`}>
                                    {advance.status === 'APPROVED' ? 'Approuvée' :
                                      advance.status === 'PENDING' ? 'En attente' :
                                        'Refusée'}
                                  </span>
                                  {advance.status === 'APPROVED' && advance.approvedAt && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      Approuvée le {new Date(advance.approvedAt).toLocaleDateString('fr-FR')}
                                    </p>
                                  )}
                                  {advance.status === 'REJECTED' && advance.rejectionReason && (
                                    <p className="text-xs text-red-600 mt-1 max-w-xs">
                                      {advance.rejectionReason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                              <h4 className="text-lg font-bold text-slate-600 mb-2">Aucune avance trouvée</h4>
                              <p className="text-slate-500 text-sm">Aucune avance ne correspond aux critères de filtrage.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            {
              activeTab === 'attendance' && (
                <div className="space-y-6">
                  {/* Pointage du jour — contrôle admin */}
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Clock className="text-indigo-500" /> Pointage du Jour
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Statut actuel */}
                      <div className="bg-slate-50 p-6 rounded-[2rem] space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut aujourd'hui</p>
                        {loadingAttendance ? (
                          <div className="flex items-center gap-2 text-slate-400"><RefreshCw size={16} className="animate-spin" /> Chargement...</div>
                        ) : attendanceToday ? (
                          <div className="space-y-3">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest ${attendanceToday.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                              attendanceToday.status === 'LATE' ? 'bg-amber-100 text-amber-700' :
                                attendanceToday.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-600'
                              }`}>
                              <div className={`w-2 h-2 rounded-full ${attendanceToday.status === 'PRESENT' ? 'bg-emerald-500 animate-pulse' :
                                attendanceToday.status === 'LATE' ? 'bg-amber-500 animate-pulse' :
                                  'bg-red-500'
                                }`}></div>
                              {attendanceToday.status === 'PRESENT' ? 'Présent' :
                                attendanceToday.status === 'LATE' ? 'En retard' :
                                  attendanceToday.status === 'ABSENT' ? 'Absent' : attendanceToday.status}
                            </div>
                            {attendanceToday.clockIn && (
                              <p className="text-sm font-bold text-slate-700">
                                Arrivée : <span className="text-indigo-600">{new Date(attendanceToday.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                {attendanceToday.meta?.lateMinutes > 0 && <span className="ml-2 text-amber-500 text-xs">({attendanceToday.meta.lateMinutes} min retard)</span>}
                              </p>
                            )}
                            {attendanceToday.clockOut && (
                              <p className="text-sm font-bold text-slate-700">
                                Départ : <span className="text-indigo-600">{new Date(attendanceToday.clockOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            )}
                            {attendanceToday.source === 'admin' && (
                              <p className="text-[10px] text-slate-400 font-medium">Pointé par l'administration</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 font-medium">Pas encore pointé aujourd'hui</p>
                        )}
                      </div>

                      {/* Actions admin */}
                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pointer pour cet employé</p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Heure (optionnel)</label>
                            <input
                              type="time"
                              value={adminClockForm.time}
                              onChange={e => setAdminClockForm({ time: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Si vide, l'heure actuelle est utilisée</p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={handleAdminClockIn}
                              disabled={adminClockLoading || !!attendanceToday?.clockIn}
                              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {adminClockLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              Arrivée
                            </button>
                            <button
                              onClick={handleAdminClockOut}
                              disabled={adminClockLoading || !attendanceToday?.clockIn || !!attendanceToday?.clockOut}
                              className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {adminClockLoading ? <RefreshCw size={14} className="animate-spin" /> : <Clock size={14} />}
                              Départ
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historique pointage */}
                  <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                        <History className="text-indigo-500" /> Historique (30 derniers)
                      </h3>
                      <button
                        onClick={() => employee?.id && loadAttendance(employee.id)}
                        disabled={loadingAttendance}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={loadingAttendance ? 'animate-spin' : ''} /> Actualiser
                      </button>
                    </div>
                    {loadingAttendance ? (
                      <div className="flex items-center gap-2 text-slate-400 py-8 justify-center"><RefreshCw size={16} className="animate-spin" /> Chargement...</div>
                    ) : attendanceHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Clock size={40} className="mx-auto mb-4 text-slate-200" />
                        <p className="font-medium">Aucun historique de pointage</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">Date</th>
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">Statut</th>
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">Arrivée</th>
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">Départ</th>
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">H. Supp</th>
                              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {attendanceHistory.slice(0, 30).map((rec: any) => (
                              <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 text-sm font-bold text-slate-900">
                                  {new Date(rec.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                </td>
                                <td className="py-4">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${rec.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' :
                                    rec.status === 'LATE' ? 'bg-amber-50 text-amber-600' :
                                      rec.status === 'ABSENT' ? 'bg-red-50 text-red-600' :
                                        rec.status === 'HOLIDAY' ? 'bg-purple-50 text-purple-600' :
                                          'bg-slate-100 text-slate-500'
                                    }`}>
                                    {rec.status === 'PRESENT' ? 'Présent' :
                                      rec.status === 'LATE' ? 'Retard' :
                                        rec.status === 'ABSENT' ? 'Absent' :
                                          rec.status === 'HOLIDAY' ? 'Congé' : rec.status}
                                  </span>
                                </td>
                                <td className="py-4 text-sm text-slate-600 font-medium">
                                  {rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td className="py-4 text-sm text-slate-600 font-medium">
                                  {rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td className="py-4 text-sm font-medium">
                                  {rec.overtimeMinutes > 0 ? (
                                    <span className="text-emerald-600 font-bold">+{Math.floor(rec.overtimeMinutes / 60)}h{rec.overtimeMinutes % 60 > 0 ? rec.overtimeMinutes % 60 + 'm' : ''}</span>
                                  ) : '—'}
                                </td>
                                <td className="py-4">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${rec.source === 'admin' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    {rec.source === 'admin' ? 'Admin' : 'Auto'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            {
              activeTab === 'performance' && (() => {
                // ── Calculs depuis l'historique de pointage ──────────────────────
                const workRecords = attendanceHistory.filter(r =>
                  ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'].includes(r.status)
                );
                const totalDays = workRecords.length;
                const presentDays = workRecords.filter(r => r.status === 'PRESENT').length;
                const lateDays = workRecords.filter(r => r.status === 'LATE').length;
                const absentDays = workRecords.filter(r => r.status === 'ABSENT').length;
                const halfDays = workRecords.filter(r => r.status === 'HALF_DAY').length;
                const totalLateMin = workRecords.reduce((s, r) => s + (r.meta?.lateMinutes || 0), 0);
                const totalOTMin = attendanceHistory.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);

                const assiduiteScore = totalDays > 0 ? Math.round(((presentDays + lateDays + halfDays * 0.5) / totalDays) * 100) : 0;
                const ponctualiteScore = (presentDays + lateDays) > 0 ? Math.round((presentDays / (presentDays + lateDays)) * 100) : 100;
                const otHours = Math.floor(totalOTMin / 60);
                const otMin = totalOTMin % 60;
                const avgLateMin = lateDays > 0 ? Math.round(totalLateMin / lateDays) : 0;

                // Score global pondéré : assiduité 50%, ponctualité 40%, bonus HS 10%
                const otBonus = Math.min(10, Math.round(totalOTMin / 60));
                const rawScore = Math.min(100, Math.round(assiduiteScore * 0.5 + ponctualiteScore * 0.4 + otBonus));
                const grade = rawScore >= 95 ? 'A+' : rawScore >= 88 ? 'A' : rawScore >= 78 ? 'B+' : rawScore >= 65 ? 'B' : rawScore >= 50 ? 'C' : 'D';
                const gradeColor = rawScore >= 88 ? 'text-emerald-500' : rawScore >= 65 ? 'text-indigo-500' : rawScore >= 50 ? 'text-amber-500' : 'text-rose-500';
                const gradeComment = rawScore >= 95
                  ? 'Ponctualité et présence exemplaires — performance remarquable.'
                  : rawScore >= 88
                    ? 'Très bonne assiduité avec un engagement constant.'
                    : rawScore >= 78
                      ? 'Bonne performance générale, quelques retards à surveiller.'
                      : rawScore >= 65
                        ? 'Performance correcte, marge d\'amélioration sur la ponctualité.'
                        : rawScore >= 50
                          ? 'Présence irrégulière — suivi recommandé.'
                          : 'Absentéisme ou retards fréquents — entretien nécessaire.';

                const metrics = [
                  {
                    label: 'Assiduité',
                    value: assiduiteScore,
                    color: assiduiteScore >= 90 ? 'bg-emerald-500' : assiduiteScore >= 70 ? 'bg-indigo-500' : assiduiteScore >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                    detail: `${presentDays + lateDays} jours travaillés / ${totalDays} jours`,
                  },
                  {
                    label: 'Ponctualité',
                    value: ponctualiteScore,
                    color: ponctualiteScore >= 90 ? 'bg-emerald-500' : ponctualiteScore >= 70 ? 'bg-indigo-500' : ponctualiteScore >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                    detail: `${lateDays} retard${lateDays > 1 ? 's' : ''} · moy. ${avgLateMin} min`,
                  },
                  {
                    label: 'Score Global',
                    value: rawScore,
                    color: rawScore >= 88 ? 'bg-emerald-500' : rawScore >= 65 ? 'bg-indigo-500' : rawScore >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                    detail: `Note : ${grade}`,
                  },
                ];

                return (
                  <div className="space-y-8">
                    {loadingAttendance ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 size={28} className="animate-spin text-indigo-400" />
                      </div>
                    ) : totalDays === 0 ? (
                      <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm text-center text-slate-400 text-sm font-medium">
                        Aucun historique de pointage disponible pour calculer la performance.
                      </div>
                    ) : (
                      <>
                        {/* ── Score global + badges ── */}
                        <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-10 flex items-center gap-3">
                            <Activity className="text-indigo-500" /> Évaluation de la Performance
                          </h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                            {/* Jauges métriques */}
                            <div className="space-y-8">
                              {metrics.map((m, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{m.label}</span>
                                    <span className="text-xs font-black text-slate-500">{m.value}%</span>
                                  </div>
                                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-700 ${m.color}`} style={{ width: `${m.value}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">{m.detail}</p>
                                </div>
                              ))}
                            </div>

                            {/* Grade central */}
                            <div className="bg-slate-50 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4">
                              <div className="w-28 h-28 bg-white rounded-[2rem] shadow-xl flex items-center justify-center border border-slate-100">
                                <TrendingUp size={44} className={gradeColor} />
                              </div>
                              <p className={`text-4xl md:text-5xl font-black tracking-tighter ${gradeColor}`}>{grade}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Global · {rawScore}/100</p>
                              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">{gradeComment}</p>
                            </div>
                          </div>
                        </div>

                        {/* ── Statistiques détaillées ── */}
                        <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                            <Clock size={20} className="text-indigo-500" /> Détail Pointage & Heures
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              { label: 'Jours présents', value: presentDays, sub: 'à l\'heure', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                              { label: 'Retards', value: lateDays, sub: `${totalLateMin} min cumulées`, color: 'text-amber-600', bg: 'bg-amber-50' },
                              { label: 'Absences', value: absentDays, sub: 'jours non justifiés', color: 'text-rose-600', bg: 'bg-rose-50' },
                              {
                                label: 'Heures supp.',
                                value: `${otHours}h${otMin > 0 ? otMin + 'm' : ''}`,
                                sub: `${Math.round(totalOTMin / 60 * 10) / 10}h totales`,
                                color: 'text-indigo-600',
                                bg: 'bg-indigo-50',
                              },
                            ].map((stat, i) => (
                              <div key={i} className={`${stat.bg} rounded-2xl p-5 flex flex-col gap-2`}>
                                <p className={`text-2xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{stat.label}</p>
                                <p className="text-[9px] text-slate-400 font-medium">{stat.sub}</p>
                              </div>
                            ))}
                          </div>

                          {/* Répartition par statut */}
                          {totalDays > 0 && (
                            <div className="mt-8">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition sur {totalDays} jours enregistrés</p>
                              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                {presentDays > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${(presentDays / totalDays) * 100}%` }} title="Présent" />}
                                {lateDays > 0 && <div className="bg-amber-400  h-full" style={{ width: `${(lateDays / totalDays) * 100}%` }} title="Retard" />}
                                {halfDays > 0 && <div className="bg-blue-400   h-full" style={{ width: `${(halfDays / totalDays) * 100}%` }} title="Demi-journée" />}
                                {absentDays > 0 && <div className="bg-rose-400   h-full" style={{ width: `${(absentDays / totalDays) * 100}%` }} title="Absent" />}
                              </div>
                              <div className="flex flex-wrap gap-4 mt-3">
                                {[
                                  { label: 'Présent', count: presentDays, color: 'bg-emerald-400' },
                                  { label: 'Retard', count: lateDays, color: 'bg-amber-400' },
                                  { label: 'Demi-j.', count: halfDays, color: 'bg-blue-400' },
                                  { label: 'Absent', count: absentDays, color: 'bg-rose-400' },
                                ].filter(l => l.count > 0).map((l, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                                    <span className="text-[10px] font-bold text-slate-500">{l.label} · {l.count}j</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()
            }
          </>
        </motion.div >
      </AnimatePresence >
    </div >
  );
};

const MessageSquare = ({ size, className }: { size: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export default EmployeeProfile;
