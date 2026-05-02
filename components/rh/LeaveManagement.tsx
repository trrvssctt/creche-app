
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreVertical, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  X,
  Plane,
  Stethoscope,
  Baby,
  Heart,
  AlertTriangle,
  Loader2,
  Upload,
  FileText,
  Eye,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { leaveApi, employeeApi, apiClient } from '../../services/api';
import { authBridge } from '../../services/authBridge';
import { Leave, Employee, LeaveType, LeaveStatus, LeaveFormData, User, UserRole } from '../../types';
import HRModal from './HRModal';
import { useCurrentEmployeeAbsenceStatus, getLeaveTypeLabel, getDaysUntilReturn } from '../../services/employeeStatusService';

interface LeaveManagementProps {
  onNavigate: (tab: string, meta?: any) => void;
  user?: User;
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ onNavigate, user }) => {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LeaveFormData>({
    employeeId: '',
    type: 'PAID',
    startDate: '',
    endDate: '',
    reason: '',
    document: undefined
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [showActionModal, setShowActionModal] = useState(false);
  const [docPreviewId, setDocPreviewId] = useState<string | null>(null);
  const [actionLeave, setActionLeave] = useState<Leave | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLeave, setRejectLeave] = useState<Leave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  
  // Solde de congés payés
  const [leaveBalance, setLeaveBalance] = useState<{ acquiredDays: number; usedDays: number; remainingDays: number; year: number } | null>(null);

  const loadLeaveBalance = async (employeeId: string) => {
    try {
      const data = await apiClient.get(`/hr/leaves/balance/${employeeId}`);
      setLeaveBalance(data);
    } catch {
      setLeaveBalance(null);
    }
  };

  // Hook pour vérifier le statut d'absence de l'employé connecté
  const { absenceStatus, loading: absenceLoading } = useCurrentEmployeeAbsenceStatus();
  
  // Hook pour vérifier le statut d'absence de l'employé connecté

  // Détermine si l'utilisateur courant est un employé (mode employé uniquement)
  const isEmployeeMode = user && (() => {
    const roles = Array.isArray(user.roles) ? user.roles : [user.role];
    const canAccessLeaves = roles.some(role => 
      [UserRole.EMPLOYEE, UserRole.STOCK_MANAGER, UserRole.SALES, UserRole.ACCOUNTANT, UserRole.HR_MANAGER].includes(role)
    );
    const isAdminOrSuper = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN);
    return canAccessLeaves && !isAdminOrSuper;
  })();

  const statuses = ['All', 'PENDING', 'APPROVED', 'REJECTED'] as const;
  const leaveTypes: { value: LeaveType; label: string }[] = [
    { value: 'PAID', label: 'Congés Payés' },
    { value: 'SICK', label: 'Maladie' },
    { value: 'MATERNITY', label: 'Maternité/Paternité' },
    { value: 'UNPAID', label: 'Congé sans solde' },
    { value: 'ANNUAL', label: 'Congés annuels' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Récupérer l'Employee correspondant à l'utilisateur connecté
  const getCurrentEmployee = async () => {
    if (!user || !isEmployeeMode) return null;
    
    try {
      console.log('🔍 Debug user object:', {
        id: user.id,
        email: user.email,
        employeeId: user.employeeId,
        hasEmployee: !!(user as any).employee,
        allKeys: Object.keys(user)
      });
      
      // Si l'API /auth/me a déjà fourni les données Employee
      if ((user as any).employee) {
        console.log('✅ Données Employee déjà présentes dans user');
        return (user as any).employee;
      }
      
      // Si l'utilisateur a un employeeId, récupérer directement l'Employee
      if (user.employeeId) {
        console.log('✅ employeeId trouvé, récupération de l\'Employee...');
        const employee = await employeeApi.get(user.employeeId);
        return employee;
      }
      
      console.log('❌ Utilisateur sans données Employee - Rafraîchissement des données...');
      
      // Forcer un rafraîchissement des données utilisateur
      try {
        const session = authBridge.getSession();
        if (session?.token) {
          const freshUser = await authBridge.fetchMe(session.token);
          if (freshUser && (freshUser as any).employee) {
            console.log('✅ Données Employee récupérées après refresh');
            return (freshUser as any).employee;
          }
          if (freshUser && freshUser.employeeId) {
            const employee = await employeeApi.get(freshUser.employeeId);
            return employee;
          }
        }
      } catch (refreshError) {
        console.warn('Erreur lors du rafraîchissement:', refreshError);
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'employé:', error);
      return null;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Si c'est un employé, on charge seulement ses demandes
      if (isEmployeeMode && user) {
        // D'abord récupérer l'Employee correspondant
        const employee = await getCurrentEmployee();
        setCurrentEmployee(employee);
        if (employee) loadLeaveBalance(employee.id);

        if (employee) {
          const leavesResponse = await leaveApi.getAll({ 
            sortBy: 'start_date', 
            sortDir: 'DESC',
            employeeId: employee.id // Utiliser l'Employee ID, pas user.id
          });
          setLeaves(leavesResponse.rows || []);
        } else {
          // Si pas d'employeeId défini dans le User, afficher une erreur
          setError('Profil employé non associé. L\'association automatique a échoué. Contactez votre administrateur.');
          setLeaves([]);
        }
        // Pour un employé, pas besoin de charger tous les employés
        setEmployees([]);
      } else {
        // Mode administrateur : charger toutes les demandes et tous les employés
        const [leavesResponse, employeesResponse] = await Promise.all([
          leaveApi.getAll({ sortBy: 'start_date', sortDir: 'DESC' }),
          employeeApi.getAll()
        ]);
        setLeaves(leavesResponse.rows || []);
        setEmployees(employeesResponse.rows || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaves = Array.isArray(leaves) ? leaves.filter(leave => {
    const employee = leave.employee || (Array.isArray(employees) ? employees.find(emp => emp.id === leave.employeeId) : null);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : '';
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || leave.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) : [];

  // Vérifier si l'employé a une demande en cours ou un congé actif
  const hasPendingOrActiveLeave = useMemo(() => {
    if (!isEmployeeMode || !Array.isArray(leaves)) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return leaves.some(leave => {
      // Demande en attente
      if (leave.status === 'PENDING') {
        return true;
      }
      
      // Congé approuvé et actif (se termine aujourd'hui ou plus tard)
      if (leave.status === 'APPROVED') {
        const endDate = new Date(leave.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
      }
      
      return false;
    });
  }, [leaves, isEmployeeMode]);
  // Calculs pour les statistiques (seulement pour les administrateurs)
  const stats = !isEmployeeMode ? {
    activeToday: Array.isArray(leaves) ? leaves.filter(leave => {
      const today = new Date().toISOString().split('T')[0];
      return leave.status === 'APPROVED' && 
             leave.startDate <= today && 
             leave.endDate >= today;
    }).length : 0,
    pending: Array.isArray(leaves) ? leaves.filter(leave => leave.status === 'PENDING').length : 0,
    averageBalance: Math.floor(Math.random() * 20 + 15), // À calculer selon vos règles métier
    absenteeismRate: 2.4 // À calculer selon vos règles métier
  } : {
    // Stats pour employés : ses propres statistiques
    totalRequests: Array.isArray(leaves) ? leaves.length : 0,
    pending: Array.isArray(leaves) ? leaves.filter(leave => leave.status === 'PENDING').length : 0,
    approved: Array.isArray(leaves) ? leaves.filter(leave => leave.status === 'APPROVED').length : 0,
    rejected: Array.isArray(leaves) ? leaves.filter(leave => leave.status === 'REJECTED').length : 0
  };

  const validateFormData = (dataToValidate: LeaveFormData): boolean => {
    const errors: { [key: string]: string } = {};
    
    if (!dataToValidate.employeeId) {
      errors.employeeId = 'Employé requis';
    }
    
    if (!dataToValidate.type) errors.type = 'Type de congé requis';
    if (!dataToValidate.startDate) errors.startDate = 'Date de début requise';
    if (!dataToValidate.endDate) errors.endDate = 'Date de fin requise';
    
    // Validation des dates
    if (dataToValidate.startDate && dataToValidate.endDate) {
      const startDate = new Date(dataToValidate.startDate);
      const endDate = new Date(dataToValidate.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        errors.startDate = 'La date de début ne peut pas être dans le passé';
      }
      if (endDate < startDate) {
        errors.endDate = 'La date de fin doit être après la date de début';
      }
      
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 365) {
        errors.endDate = 'La durée ne peut pas dépasser 365 jours';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Pour les employés, créer finalFormData avec l'employeeId correct
    let finalFormData = { ...formData };
    if (isEmployeeMode && currentEmployee && !finalFormData.employeeId) {
      finalFormData.employeeId = currentEmployee.id;
      console.log('✅ employeeId ajouté pour employé:', currentEmployee.id);
    }

    console.log('📝 FormData avant validation:', finalFormData);

    if (!validateFormData(finalFormData)) return;

    try {
    if (selectedLeave) {
      // ✅ N'utiliser FormData QUE si un fichier est réellement sélectionné
      if (finalFormData.document) {
        const fd = new FormData();
        fd.append('employeeId', finalFormData.employeeId);
        fd.append('type', finalFormData.type);
        fd.append('startDate', finalFormData.startDate);
        fd.append('endDate', finalFormData.endDate);
        fd.append('reason', finalFormData.reason || '');
        fd.append('document', finalFormData.document);
        await leaveApi.update(selectedLeave.id, fd);
      } else {
        // ✅ Pas de fichier → JSON classique, multer n'est pas impliqué
        await leaveApi.update(selectedLeave.id, {
          employeeId: finalFormData.employeeId,
          type: finalFormData.type,
          startDate: finalFormData.startDate,
          endDate: finalFormData.endDate,
          reason: finalFormData.reason || ''
        });
      }
      setSuccessMessage('Demande de congé modifiée avec succès');
    } else {
      // ✅ Même logique que pour la modification : vérifier s'il y a un document
      if (finalFormData.document) {
        const fd = new FormData();
        fd.append('employeeId', finalFormData.employeeId);
        fd.append('type', finalFormData.type);
        fd.append('startDate', finalFormData.startDate);
        fd.append('endDate', finalFormData.endDate);
        fd.append('reason', finalFormData.reason || '');
        fd.append('document', finalFormData.document);
        console.log('📎 Envoi FormData avec fichier:', {
          employeeId: finalFormData.employeeId,
          type: finalFormData.type,
          hasDocument: !!finalFormData.document
        });
        await leaveApi.create(fd);
      } else {
        const jsonData = {
          employeeId: finalFormData.employeeId,
          type: finalFormData.type,
          startDate: finalFormData.startDate,
          endDate: finalFormData.endDate,
          reason: finalFormData.reason || ''
        };
        console.log('📎 Envoi JSON:', jsonData);
        await leaveApi.create(jsonData);
      }
      setSuccessMessage('Nouvelle demande de congé créée avec succès');
    }

    await loadData();
    setIsModalOpen(false);
    setSelectedLeave(null);
    resetForm();
    showSuccess();
  } catch (err: any) {
      console.error('Erreur API:', err);
      
      // Gestion spéciale des conflits de congés (status 409)
      if (err.status === 409 || err.message?.includes('conflit') || err.message?.includes('déjà un congé') || err.message?.includes('déjà en cours')) {
        if (err.message?.includes('déjà en cours de traitement')) {
          setError(`🚫 ${err.message}`);
        } else {
          setError(`⚠️ Conflit de planning : ${err.message}`);
        }
      } else {
        setError(err.message || 'Erreur lors de l\'enregistrement');
      }
    }
  };

  const handleApproveReject = async (leaveId: string, isApproval: boolean, rejectionReason?: string) => {
    try {
      if (!isApproval && (!rejectionReason || rejectionReason.trim().length === 0)) {
        setRejectionError('Le motif de refus est obligatoire');
        return;
      }
      
      await leaveApi.approve(leaveId, rejectionReason);
      await loadData();
      setSuccessMessage(`Demande ${isApproval ? 'approuvée' : 'refusée'} avec succès`);
      showSuccess();
      
      // Fermer les modals
      setShowActionModal(false);
      setShowRejectModal(false);
      setActionLeave(null);
      setRejectLeave(null);
      setRejectionReason('');
      setRejectionError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement');
    }
  };

  const openRejectModal = (leave: Leave) => {
    setRejectLeave(leave);
    setRejectionReason('');
    setRejectionError('');
    setShowActionModal(false);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      setRejectionError('Le motif de refus est obligatoire');
      return;
    }
    
    if (rejectLeave) {
      handleApproveReject(rejectLeave.id, false, rejectionReason.trim());
    }
  };

  const handleDelete = async (leaveId: string) => {
    try {
      await leaveApi.delete(leaveId);
      await loadData();
      setSuccessMessage('Demande supprimée avec succès');
      showSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: isEmployeeMode && currentEmployee ? currentEmployee.id : '', // Auto-assigner l'Employee ID correspondant
      type: 'PAID',
      startDate: '',
      endDate: '',
      reason: '',
      document: undefined
    });
    setFormErrors({});
  };

  const showSuccess = () => {
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const openModal = (leave?: Leave) => {
    if (leave) {
      setSelectedLeave(leave);
      setFormData({
        employeeId: leave.employeeId,
        type: leave.type,
        startDate: leave.startDate.split('T')[0],
        endDate: leave.endDate.split('T')[0],
        reason: leave.reason || '',
        document: undefined // On ne peut pas pré-remplir un fichier
      });
    } else {
      setSelectedLeave(null);
      resetForm();
    }
    setIsModalOpen(true);
  };

  const getPageTitle = () => {
    return isEmployeeMode ? 'Mes Congés & Absences' : 'Congés & Absences';
  };

  const getPageSubtitle = () => {
    return isEmployeeMode 
      ? 'Gestion de mes demandes personnelles' 
      : 'Gestion des temps de repos et planning';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status: LeaveStatus) => {
    switch(status) {
      case 'APPROVED': 
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
            <Check size={12} /> Approuvé
          </span>
        );
      case 'PENDING': 
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
            <Clock size={12} /> En attente
          </span>
        );
      case 'REJECTED': 
        return (
          <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
            <X size={12} /> Refusé
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
            <X size={12} /> Annulé
          </span>
        );
      default: return null;
    }
  };

  const getTypeIcon = (type: LeaveType) => {
    switch(type) {
      case 'PAID':
      case 'ANNUAL':
        return <Plane size={18} className="text-blue-500" />;
      case 'SICK':
        return <Stethoscope size={18} className="text-rose-500" />;
      case 'MATERNITY':
        return <Baby size={18} className="text-purple-500" />;
      default:
        return <Heart size={18} className="text-indigo-500" />;
    }
  };

  const getTypeLabel = (type: LeaveType) => {
    return leaveTypes.find(t => t.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

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
            <CheckCircle2 size={20} /> {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-rose-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black uppercase text-[10px] tracking-widest"
          >
            <AlertTriangle size={20} /> {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 hover:bg-rose-600 rounded p-1"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate(isEmployeeMode ? 'dashboard' : 'rh')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{getPageTitle()}</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">{getPageSubtitle()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => loadData()}
            className="px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={16} /> Actualiser
          </button>
          <button 
            onClick={() => openModal()}
            disabled={isEmployeeMode && hasPendingOrActiveLeave}
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95 ${
              isEmployeeMode && hasPendingOrActiveLeave 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-slate-900 text-white hover:bg-indigo-600'
            }`}
            title={isEmployeeMode && hasPendingOrActiveLeave ? 'Vous avez déjà une demande en cours ou un congé actif. Attendez sa fin avant de faire une nouvelle demande.' : ''}
          >
            <Plus size={16} /> Nouvelle Demande
          </button>
        </div>
      </div>

      {/* ---- Solde de congés payés ---- */}
      {leaveBalance && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Jours acquis', value: leaveBalance.acquiredDays, color: 'indigo', desc: `2,5 j/mois · ${leaveBalance.year}` },
            { label: 'Jours utilisés', value: leaveBalance.usedDays, color: 'orange', desc: 'Congés approuvés' },
            { label: 'Solde restant', value: leaveBalance.remainingDays, color: leaveBalance.remainingDays <= 2 ? 'red' : 'emerald', desc: leaveBalance.remainingDays <= 0 ? 'Solde épuisé' : 'Disponibles' }
          ].map(({ label, value, color, desc }) => (
            <div key={label} className={`bg-white rounded-[2rem] border border-${color}-100 p-6 text-center shadow-sm`}>
              <p className={`text-3xl font-black text-${color}-600 mb-1`}>{value}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
              <p className="text-[9px] text-slate-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Statut d'absence actuelle pour les employés */}
      {isEmployeeMode && !absenceLoading && absenceStatus && !absenceStatus.isPresent && absenceStatus.leave && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 p-6 rounded-[2rem] shadow-xl text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">VOUS ÊTES ACTUELLEMENT EN ABSENCE</h3>
                <p className="text-white/80 font-bold text-sm">
                  {getLeaveTypeLabel(absenceStatus.leaveType || 'OTHER')} • Du {new Date(absenceStatus.leave.startDate).toLocaleDateString('fr-FR')} au {new Date(absenceStatus.leave.endDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                <span className="text-xs font-black uppercase tracking-widest">
                  Retour dans {getDaysUntilReturn(absenceStatus.leave.endDate)} jour{getDaysUntilReturn(absenceStatus.leave.endDate) !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-xs font-semibold text-white/80">
                Status: {getStatusBadge('APPROVED')}
              </span>
            </div>
          </div>
          
          <div className="border-t border-white/20 pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-200 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-white/90 mb-2">
                  📋 <strong>Rappel Important :</strong> Vous consultez uniquement vos demandes de congés.
                </p>
                <div className="text-xs text-white/80 space-y-1 font-medium">
                  <p>• ⚠️ Évitez d'effectuer des traitements métier pendant votre absence</p>
                  <p>• 🔒 Toute action sera enregistrée dans l'audit de sécurité</p>
                  <p>• 📞 En cas d'urgence : contactez votre responsable hiérarchique</p>
                </div>
              </div>
            </div>
            
            {absenceStatus.leave.reason && (
              <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                  <FileText size={14} />
                  <span>Motif de l'absence :</span>
                </div>
                <p className="text-sm text-white mt-1 font-medium">{absenceStatus.leave.reason}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Summary Cards avec statistiques */}
      {!isEmployeeMode ? (
        // Statistiques administrateur
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">En cours aujourd'hui</p>
            <p className="text-2xl font-black text-slate-900">{(stats as any).activeToday}</p>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} /> Effectif suffisant
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Demandes en attente</p>
            <p className="text-2xl font-black text-amber-500">{(stats as any).pending}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">À valider sous 48h</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Solde Moyen</p>
            <p className="text-2xl font-black text-slate-900">{(stats as any).averageBalance} J</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Par collaborateur</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taux d'absentéisme</p>
            <p className="text-2xl font-black text-indigo-600">{(stats as any).absenteeismRate}%</p>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">-0.5% vs mois dernier</p>
          </div>
        </div>
      ) : (
        // Statistiques employé
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total demandes</p>
            <p className="text-2xl font-black text-slate-900">{(stats as any).totalRequests}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Depuis l'embauche</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">En attente</p>
            <p className="text-2xl font-black text-amber-500">{(stats as any).pending}</p>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2 flex items-center gap-1">
              <Clock size={12} /> En cours de traitement
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approuvées</p>
            <p className="text-2xl font-black text-emerald-600">{(stats as any).approved}</p>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2 flex items-center gap-1">
              <Check size={12} /> Validées
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Refusées</p>
            <p className="text-2xl font-black text-rose-500">{(stats as any).rejected}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Historique complet</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        {!isEmployeeMode && (
          <div className="relative flex-grow w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par employé..." 
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
        
        {isEmployeeMode && (
          <div className="flex-grow w-full text-center">
            <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Mes demandes de congés</p>
            {hasPendingOrActiveLeave ? (
              <p className="text-amber-600 text-xs font-medium">⚠️ Une demande est en cours ou un congé est actif - Nouvelle demande bloquée</p>
            ) : (
              <p className="text-slate-400 text-xs font-medium">Toutes vos demandes sont affichées ci-dessous</p>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 px-6 py-4 rounded-2xl">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest text-slate-600"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'All' ? 'Tous les Statuts' : status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leave List */}
      <div className="grid grid-cols-1 gap-6">
        {filteredLeaves.length === 0 ? (
          <div className="bg-white p-12 rounded-[3rem] border border-slate-100 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Aucune demande de congé trouvée</p>
          </div>
        ) : (
          filteredLeaves.map((leave) => {
            const employee = leave.employee || (Array.isArray(employees) ? employees.find(emp => emp.id === leave.employeeId) : null);
            const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Employé inconnu';
            
            return (
              <div key={leave.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                      {getTypeIcon(leave.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{employeeName}</h3>
                        {getStatusBadge(leave.status)}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                          {getTypeLabel(leave.type)} • {leave.daysCount} jour{leave.daysCount > 1 ? 's' : ''}
                        </p>
                        {leave.type === 'SICK' && (
                          <div className="flex items-center gap-1">
                            {leave.documentUrl ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                <FileText size={10} /> Avec justificatif
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                <AlertTriangle size={10} /> Sans justificatif
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-8">
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</p>
                        <p className="text-sm font-bold text-slate-900">
                          Du {formatDate(leave.startDate)} au {formatDate(leave.endDate)}
                        </p>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden md:block"></div>
                    </div>
                    
                    {!isEmployeeMode && (
                      <div className="flex items-center gap-3">
                        {leave.status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => handleApproveReject(leave.id, true)}
                              className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                            >
                              Approuver
                            </button>
                            <button 
                              onClick={() => openRejectModal(leave)}
                              className="px-6 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                            >
                              Refuser
                            </button>
                          </>
                        ) : (
                          <div className="relative">
                            <button 
                              onClick={() => {
                                setActionLeave(leave);
                                setShowActionModal(true);
                              }}
                              className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"
                            >
                              <MoreVertical size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Pour les employés : actions sur leurs propres demandes */}
                    {isEmployeeMode && (
                      <div className="flex items-center gap-3">
                        {/* Statut */}
                        {getStatusBadge(leave.status)}
                        
                        {/* Actions pour demandes PENDING seulement */}
                        {leave.status === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openModal(leave)}
                              className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
                            >
                              Modifier
                            </button>
                            <button 
                              onClick={() => {
                                setActionLeave(leave);
                                setShowActionModal(true);
                              }}
                              className="px-4 py-2 bg-slate-400 text-white rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-rose-500 transition-all"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {(leave.reason || leave.documentUrl || leave.type === 'SICK' || leave.rejectionReason) && (
                  <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                    {leave.reason && (
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Motif</p>
                        <p className="text-xs text-slate-700 italic font-medium">"{leave.reason}"</p>
                      </div>
                    )}
                    
                    {leave.rejectionReason && (
                      <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">Motif du refus</p>
                        <p className="text-xs text-rose-700 font-medium">"{leave.rejectionReason}"</p>
                      </div>
                    )}
                    
                    {leave.type === 'SICK' && (
                      <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Stethoscope className="text-rose-500 mt-0.5" size={16} />
                          <div className="flex-1">
                            <p className="text-rose-800 font-black text-xs uppercase tracking-widest mb-2">
                              Congé Maladie - Information Justificatif
                            </p>
                            {leave.documentUrl ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="text-emerald-600" size={14} />
                                  <span className="text-xs font-bold text-emerald-700">Justificatif médical fourni</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white border border-emerald-200 rounded-lg">
                                  <FileText className="text-blue-500" size={16} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-blue-800 uppercase tracking-widest">
                                      {leave.documentName || 'Justificatif médical'}
                                    </p>
                                    <p className="text-[10px] text-blue-600">
                                      Document uploadé le {new Date(leave.createdAt).toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setDocPreviewId(docPreviewId === leave.id ? null : leave.id)}
                                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                                    >
                                      <Eye size={12} /> {docPreviewId === leave.id ? 'Masquer' : 'Aperçu'}
                                    </button>
                                    <a
                                      href={leave.documentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                                    >
                                      <ExternalLink size={12} /> Ouvrir
                                    </a>
                                  </div>
                                </div>
                                {docPreviewId === leave.id && leave.documentUrl && (
                                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200">
                                    {leave.documentUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) || leave.documentUrl.includes('/image/') ? (
                                      <img
                                        src={leave.documentUrl}
                                        alt="Justificatif"
                                        className="w-full max-h-80 object-contain bg-slate-50"
                                      />
                                    ) : (
                                      <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(leave.documentUrl)}&embedded=true`}
                                        title="Justificatif médical"
                                        className="w-full border-0"
                                        style={{ height: '400px' }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="text-amber-500 mt-0.5" size={14} />
                                <div>
                                  <p className="text-xs font-bold text-amber-700 mb-1">Aucun justificatif fourni</p>
                                  <p className="text-[10px] text-amber-600">
                                    {leave.daysCount > 3 ? 
                                      'Justificatif médical requis pour les absences > 3 jours' : 
                                      'Justificatif optionnel pour les absences ≤ 3 jours'
                                    }
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Request Modal */}
      <HRModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLeave(null);
          resetForm();
        }} 
        title={selectedLeave ? "Modifier la Demande de Congés" : "Nouvelle Demande de Congés"}
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button 
              onClick={() => {
                setIsModalOpen(false);
                setSelectedLeave(null);
                resetForm();
              }} 
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button 
              onClick={handleSubmit} 
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
            >
              {selectedLeave ? 'Modifier' : 'Créer'} la Demande
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Champ Employé - visible seulement pour les administrateurs */}
          {!isEmployeeMode && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                Employé 
                <span className="text-rose-500">*</span>
              </label>
              <select 
                className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 transition-all font-bold text-sm ${
                  formErrors.employeeId ? 'ring-2 ring-rose-300 bg-rose-50' : 'focus:ring-indigo-500'
                }`}
                value={formData.employeeId}
                onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
              >
                <option value="">-- Sélectionner un employé --</option>
                {Array.isArray(employees) && employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} - {emp.position || 'Poste non défini'}
                  </option>
                ))}
              </select>
              {formErrors.employeeId && (
                <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {formErrors.employeeId}
                </p>
              )}
            </div>
          )}

          {/* Message pour les employés */}
          {isEmployeeMode && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-blue-500" size={20} />
                <div>
                  <p className="text-blue-800 font-black text-sm uppercase tracking-widest">Demande personnelle</p>
                  <p className="text-blue-600 text-xs font-medium">Cette demande sera automatiquement associée à votre compte.</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              Type de Congé 
              <span className="text-rose-500">*</span>
            </label>
            <select 
              className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 transition-all font-bold text-sm ${
                formErrors.type ? 'ring-2 ring-rose-300 bg-rose-50' : 'focus:ring-indigo-500'
              }`}
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as LeaveType }))}
            >
              {leaveTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {formErrors.type && (
              <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {formErrors.type}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                Date de Début 
                <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 transition-all font-bold text-sm ${
                  formErrors.startDate ? 'ring-2 ring-rose-300 bg-rose-50' : 'focus:ring-indigo-500'
                }`}
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]} // Empêcher dates passées
              />
              {formErrors.startDate && (
                <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {formErrors.startDate}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                Date de Fin 
                <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 transition-all font-bold text-sm ${
                  formErrors.endDate ? 'ring-2 ring-rose-300 bg-rose-50' : 'focus:ring-indigo-500'
                }`}
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate || new Date().toISOString().split('T')[0]}
              />
              {formErrors.endDate && (
                <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {formErrors.endDate}
                </p>
              )}
            </div>
          </div>

          {/* Affichage automatique du nombre de jours */}
          {formData.startDate && formData.endDate && new Date(formData.endDate) >= new Date(formData.startDate) && (
            <div className="bg-indigo-50 p-4 rounded-2xl">
              <p className="text-indigo-600 font-black text-sm uppercase tracking-widest text-center">
                Durée: {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} jour(s)
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Motif de l'absence
            </label>
            <textarea 
              rows={3} 
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
              placeholder="Justifiez votre demande (optionnel)..."
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>

          {/* Upload de document pour les congés maladie */}
          {formData.type === 'SICK' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                Justificatif médical 
                <span className="text-blue-500 text-[8px] normal-case">(PDF, JPG, PNG - 10MB max)</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Vérifier la taille (10MB max)
                      if (file.size > 10 * 1024 * 1024) {
                        setError('La taille du fichier ne doit pas dépasser 10MB');
                        e.target.value = '';
                        return;
                      }
                      setFormData(prev => ({ ...prev, document: file }));
                    }
                  }}
                  className="hidden"
                  id="documentUpload"
                />
                <label
                  htmlFor="documentUpload"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer flex items-center justify-center gap-3"
                >
                  <Upload size={20} className="text-slate-400" />
                  <div className="text-center">
                    {formData.document ? (
                      <>
                        <p className="text-sm font-bold text-indigo-600">{formData.document.name}</p>
                        <p className="text-xs text-slate-500">
                          {(formData.document.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-600">Cliquer pour sélectionner un fichier</p>
                        <p className="text-xs text-slate-400">ou glissez-déposez votre justificatif</p>
                      </>
                    )}
                  </div>
                </label>
                {formData.document && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, document: undefined }));
                      const input = document.getElementById('documentUpload') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {/* Affichage du document existant lors de la modification */}
              {selectedLeave && selectedLeave.documentUrl && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-blue-500" size={16} />
                      <div>
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-widest">
                          Document actuel
                        </p>
                        <p className="text-xs text-blue-600">
                          {selectedLeave.documentName || 'Document.pdf'}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={selectedLeave.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                    >
                      <ExternalLink size={12} /> Voir
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avertissement pour les congés de maladie */}
          {formData.type === 'SICK' && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-500 mt-0.5" size={16} />
                <div>
                  <p className="text-amber-800 font-bold text-xs uppercase tracking-widest">
                    Congé Maladie
                  </p>
                  <p className="text-amber-700 text-xs mt-1">
                    Un justificatif médical sera requis pour toute absence de plus de 3 jours consécutifs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation des weekends pour les congés payés */}
          {formData.type === 'PAID' && formData.startDate && formData.endDate && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <Calendar className="text-blue-500 mt-0.5" size={16} />
                <div>
                  <p className="text-blue-800 font-bold text-xs uppercase tracking-widest">
                    Congé Payé
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Les weekends et jours fériés ne sont pas décomptés de votre solde.
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </HRModal>

      {/* Action Modal */}
      <AnimatePresence>
        {showActionModal && actionLeave && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                  <MoreVertical size={24} className="text-indigo-600" />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                    {isEmployeeMode ? 'Gérer ma demande' : 'Actions disponibles'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {isEmployeeMode 
                      ? 'Vous pouvez modifier ou annuler cette demande tant qu\'elle n\'est pas traitée.'
                      : 'Que souhaitez-vous faire avec cette demande de congé ?'
                    }
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Pour employés : seulement si PENDING */}
                  {isEmployeeMode && actionLeave.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => {
                          setShowActionModal(false);
                          openModal(actionLeave);
                          setActionLeave(null);
                        }}
                        className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier ma demande
                      </button>

                      <button
                        onClick={() => {
                          setShowActionModal(false);
                          handleDelete(actionLeave.id);
                          setActionLeave(null);
                        }}
                        className="w-full px-6 py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-rose-600 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Annuler ma demande
                      </button>
                    </>
                  )}
                  
                  {/* Pour administrateurs : toutes les actions */}
                  {!isEmployeeMode && (
                    <>
                      <button
                        onClick={() => {
                          setShowActionModal(false);
                          openModal(actionLeave);
                          setActionLeave(null);
                        }}
                        className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier la demande
                      </button>

                      <button
                        onClick={() => {
                          setShowActionModal(false);
                          handleDelete(actionLeave.id);
                          setActionLeave(null);
                        }}
                        className="w-full px-6 py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-rose-600 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Supprimer la demande
                      </button>
                    </>
                  )}

                  {/* Message si l'employé tente d'agir sur une demande traitée */}
                  {isEmployeeMode && actionLeave.status !== 'PENDING' && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-amber-500" size={16} />
                        <p className="text-amber-700 text-xs font-medium">
                          Cette demande a été {actionLeave.status === 'APPROVED' ? 'approuvée' : 'refusée'} et ne peut plus être modifiée.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowActionModal(false);
                      setActionLeave(null);
                    }}
                    className="w-full px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
                  >
                    <X size={16} />
                    Annuler
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                      {getTypeIcon(actionLeave.type)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">
                        {getTypeLabel(actionLeave.type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(actionLeave.startDate)} → {formatDate(actionLeave.endDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && rejectLeave && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-rose-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                  <X size={24} className="text-rose-600" />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                    Refuser la demande
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Veuillez indiquer le motif du refus pour {rejectLeave.employee?.firstName} {rejectLeave.employee?.lastName}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Motif du refus <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 transition-all font-medium text-sm resize-none ${
                        rejectionError ? 'ring-2 ring-rose-300 bg-rose-50' : 'focus:ring-rose-500'
                      }`}
                      placeholder="Expliquez pourquoi cette demande est refusée..."
                      value={rejectionReason}
                      onChange={(e) => {
                        setRejectionReason(e.target.value);
                        if (rejectionError) setRejectionError('');
                      }}
                    />
                    {rejectionError && (
                      <p className="text-rose-500 text-xs font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> {rejectionError}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowRejectModal(false);
                        setRejectLeave(null);
                        setRejectionReason('');
                        setRejectionError('');
                      }}
                      className="flex-1 px-6 py-3 text-slate-500 hover:text-slate-700 transition-all font-black text-sm uppercase tracking-widest"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleRejectSubmit}
                      className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveManagement;
