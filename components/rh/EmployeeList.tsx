
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreVertical, 
  ChevronRight, 
  Mail, 
  Phone, 
  Briefcase, 
  Layers,
  FileText,
  UserPlus,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  RefreshCw,
  Camera,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import { uploadFile } from '../../services/uploadService';
import { useToast } from '../ToastProvider';
import HRModal from './HRModal';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  department?: string;
  position?: string;
  salary?: number;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  managerId?: string;
  photoUrl?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface EmployeeListProps {
  onNavigate: (tab: string, meta?: any) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterPresence, setFilterPresence] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [attendancesToday, setAttendancesToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: '',
    position: '',
    hireDate: '',
    photoUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  // Fonction utilitaire pour déterminer le statut de présence d'un employé
  const getEmployeePresenceStatus = (employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // Vérifier d'abord le pointage réel
    const attendance = attendancesToday.find(a => a.employeeId === employeeId);
    if (attendance) {
      return {
        isPresent: attendance.status !== 'ABSENT',
        attendanceStatus: attendance.status,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        leave: null
      };
    }

    // Sinon vérifier les congés approuvés
    const activeLeave = leaves.find(leave => {
      return leave.employeeId === employeeId &&
             leave.status === 'APPROVED' &&
             leave.startDate <= today &&
             leave.endDate >= today;
    });

    return {
      isPresent: false,
      attendanceStatus: activeLeave ? 'LEAVE' : 'NOT_CLOCKED',
      clockIn: null,
      clockOut: null,
      leave: activeLeave
    };
  };

  const getActiveContract = (employeeId: string) => {
    return contracts.find(
      (c: any) => String(c.employeeId) === String(employeeId) && c.status === 'ACTIVE'
    ) || null;
  };

  const getContractExpirationAlert = (contract: any) => {
    if (!contract?.endDate) return null;
    const diffDays = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7)  return { level: 'critical', days: diffDays };
    if (diffDays >= 0 && diffDays <= 30) return { level: 'warning', days: diffDays };
    return null;
  };

  // Calculer les statistiques de présence
  const getPresenceStats = () => {
    const activeEmployees = employees.filter(emp => emp.status === 'ACTIVE');
    const presentCount = activeEmployees.filter(emp => {
      const s = getEmployeePresenceStatus(emp.id);
      return s.isPresent || s.attendanceStatus === 'PRESENT' || s.attendanceStatus === 'LATE';
    }).length;
    const absentCount = activeEmployees.length - presentCount;

    return {
      total: activeEmployees.length,
      present: presentCount,
      absent: absentCount,
      presenceRate: activeEmployees.length > 0 ? Math.round((presentCount / activeEmployees.length) * 100) : 0
    };
  };

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [employeeData, departmentData, leavesData, contractsData, attendanceData] = await Promise.all([
        apiClient.get('/hr/employees'),
        apiClient.get('/hr/departments'),
        apiClient.get('/hr/leaves'),
        apiClient.get('/hr/contracts'),
        apiClient.get(`/hr/attendance?date=${today}`).catch(() => [])
      ]);

      setEmployees(employeeData?.rows || employeeData || []);
      setDepartments(departmentData?.rows || departmentData || []);
      setLeaves(leavesData?.rows || leavesData || []);
      setContracts(contractsData?.rows || contractsData || []);
      setAttendancesToday(attendanceData?.rows || attendanceData || []);
    } catch (err: any) {
      setError('Erreur de chargement des données');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const departmentOptions = ['All', ...departments.map(d => ({ id: d.id, name: d.name }))];

  const filteredEmployees = employees.filter(emp => {
    if (emp.status === 'DELETED') return false; // Don't show deleted employees
    
    const matchesSearch = (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || emp.departmentId === filterDept;
    
    // Filtre de présence
    let matchesPresence = true;
    if (filterPresence !== 'All') {
      const ps = getEmployeePresenceStatus(emp.id);
      if (filterPresence === 'Present') {
        matchesPresence = ps.attendanceStatus === 'PRESENT' || ps.attendanceStatus === 'LATE';
      } else if (filterPresence === 'Absent') {
        matchesPresence = ps.attendanceStatus === 'ABSENT' || ps.attendanceStatus === 'NOT_CLOCKED' || ps.attendanceStatus === 'LEAVE';
      }
    }
    
    return matchesSearch && matchesDept && matchesPresence;
  });

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: '',
      position: '',
      hireDate: '',
      photoUrl: ''
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadFile(file, 'employees');
      setFormData(prev => ({ ...prev, photoUrl: result.url }));
      showToast('Photo téléchargée avec succès', 'success');
    } catch (err) {
      console.error("Upload Error:", err);
      showToast("Échec de l'envoi de la photo.", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        departmentId: formData.departmentId || null,
        position: formData.position,
        hireDate: formData.hireDate,
        photoUrl: formData.photoUrl || null
      };
      
      await apiClient.post('/hr/employees', payload);
      await fetchData(); // Refresh the list
      setIsModalOpen(false);
      resetForm();
      showToast('Employé créé avec succès', 'success');
    } catch (error: any) {
      console.error('Error creating employee:', error);
      showToast(error.message || 'Erreur lors de la création', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone || '',
      departmentId: employee.departmentId || '',
      position: employee.position || '',
      hireDate: employee.hireDate,
      photoUrl: employee.photoUrl || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    setActionLoading(true);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        departmentId: formData.departmentId || null,
        position: formData.position,
        hireDate: formData.hireDate,
        photoUrl: formData.photoUrl || null
      };
      
      await apiClient.put(`/hr/employees/${selectedEmployee.id}`, payload);
      await fetchData(); // Refresh the list
      setIsEditModalOpen(false);
      setSelectedEmployee(null);
      resetForm();
      showToast('Employé mis à jour avec succès', 'success');
    } catch (error: any) {
      console.error('Error updating employee:', error);
      showToast(error.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    
    setActionLoading(true);
    try {
      // Set status to INACTIVE instead of hard delete
      await apiClient.put(`/hr/employees/${selectedEmployee.id}`, {
        status: 'INACTIVE'
      });
      
      await fetchData(); // Refresh the list
      setIsDeleteModalOpen(false);
      setSelectedEmployee(null);
      showToast('Employé désactivé avec succès', 'success');
    } catch (error: any) {
      console.error('Error deactivating employee:', error);
      
      // Gestion spécifique de l'erreur de contrat actif
      if (error.response?.data?.error === 'ActiveContractExists') {
        showToast(
          `${error.response.data.message} (${error.response.data.activeContracts} contrat(s) actif(s))`, 
          'error'
        );
        
        // Fermer le modal et suggérer d'aller aux contrats
        setIsDeleteModalOpen(false);
        setSelectedEmployee(null);
        
        // Optionnel: naviguer vers les contrats après un délai
        setTimeout(() => {
          showToast('💡 Conseil: Allez dans "Contrats" pour résilier les contrats actifs de cet employé', 'info');
        }, 3000);
      } else {
        showToast(error.message || 'Erreur lors de la désactivation', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin mr-2" />
        <span>Chargement des employés...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('rh')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">Liste des Employés</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Gestion du capital humain</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden sm:flex px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} /> Export PDF
          </button>
          {departments.length > 0 ? (
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              disabled={actionLoading}
              className="px-4 sm:px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
            >
              {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
              <span className="hidden sm:inline">Nouvel Employé</span>
            </button>
          ) : !loading && (
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
              <AlertCircle size={16} /> <span className="hidden sm:inline">Créez d'abord un département</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Creation */}
      <HRModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Nouvel Employé"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button 
              onClick={() => setIsModalOpen(false)}
              disabled={actionLoading}
              className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button 
              onClick={handleCreateEmployee}
              disabled={actionLoading}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Création...
                </>
              ) : (
                'Enregistrer l\'Employé'
              )}
            </button>
          </div>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prénom <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="Ex: Moussa" 
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="Ex: Diop" 
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Professionnel <span className="text-red-500">*</span></label>
            <input 
              type="email" 
              placeholder="moussa.diop@techcorp.com" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
            <input 
              type="text" 
              placeholder="+221 ..." 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Département</label>
            <select 
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
            >
              <option value="">Sélectionner un département</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poste</label>
            <input 
              type="text" 
              placeholder="Ex: Senior Developer" 
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date d'Embauche</label>
            <input 
              type="date" 
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Photo de Profil</label>
            <div className="flex items-center gap-4">
              {formData.photoUrl && (
                <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                  <img 
                    src={formData.photoUrl} 
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
                  id="photoUpload"
                />
                <label 
                  htmlFor="photoUpload"
                  className={`w-full px-6 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-indigo-300 transition-all cursor-pointer ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Statistiques de Présence */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {(() => {
          const stats = getPresenceStats();
          return (
            <>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Users size={24} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Employés</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-bold">
                    {stats.presenceRate}%
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.present}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Présents</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.absent}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absents</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">
                    {leaves.filter(l => l.status === 'PENDING').length}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demandes en attente</p>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un employé par nom, email..." 
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Filtre par département */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 md:px-6 py-3 md:py-4 rounded-2xl">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest text-slate-600"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="All">Tous les Départements</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          
          {/* Filtre par présence */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 md:px-6 py-3 md:py-4 rounded-2xl min-w-[140px] md:min-w-[180px]">
            <Users size={18} className="text-slate-400" />
            <select 
              className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest text-slate-600 w-full"
              value={filterPresence}
              onChange={(e) => setFilterPresence(e.target.value)}
            >
              <option value="All">Tous les statuts</option>
              <option value="Present">🟢 Présents</option>
              <option value="Absent">🔴 Absents</option>
            </select>
          </div>
          
          {/* Bouton de reset des filtres */}
          {(filterDept !== 'All' || filterPresence !== 'All' || searchTerm.trim() !== '') && (
            <button
              onClick={() => {
                setFilterDept('All');
                setFilterPresence('All');
                setSearchTerm('');
              }}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all text-xs font-bold"
              title="Réinitialiser les filtres"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
        {filteredEmployees.map((emp) => {
          const presenceStatus = getEmployeePresenceStatus(emp.id);
          return (
          <div 
            key={emp.id}
            onClick={() => onNavigate('rh.employee.profile', { employeeId: emp.id })}
            className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group cursor-pointer relative overflow-hidden"
          >
            {/* Indicateur de présence/absence */}
            <div className="absolute top-4 left-6 z-10">
              {(() => {
                const s = presenceStatus;
                if (s.attendanceStatus === 'PRESENT')
                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Présent {s.clockIn ? new Date(s.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  );
                if (s.attendanceStatus === 'LATE')
                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">En retard</span>
                    </div>
                  );
                if (s.attendanceStatus === 'LEAVE')
                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {s.leave?.type === 'SICK' ? 'Maladie' :
                         s.leave?.type === 'PAID' ? 'Congé' :
                         s.leave?.type === 'MATERNITY' ? 'Maternité' :
                         s.leave?.type === 'UNPAID' ? 'Sans solde' : 'Congé'}
                      </span>
                    </div>
                  );
                if (s.attendanceStatus === 'ABSENT')
                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Absent</span>
                    </div>
                  );
                // NOT_CLOCKED
                return (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-full shadow-sm">
                    <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Non pointé</span>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex items-start justify-between mb-8">
              <div className="relative">
                <div className="w-20 h-20 bg-slate-100 rounded-[2rem] overflow-hidden border-4 border-white shadow-lg group-hover:scale-105 transition-transform duration-500">
                  <img 
                    src={emp.photoUrl || `https://picsum.photos/seed/${emp.id}/200/200`} 
                    alt={emp.firstName} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white shadow-sm ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditEmployee(emp);
                  }}
                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteModal(emp);
                  }}
                  className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-1 mb-4">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{emp.firstName} {emp.lastName}</h3>
              <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">{emp.position}</p>
            </div>

            {/* Contract badge */}
            {(() => {
              const contract = getActiveContract(emp.id);
              if (!contract) return (
                <div className="mb-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Aucun contrat actif
                  </span>
                </div>
              );
              const alert = getContractExpirationAlert(contract);
              return (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {contract.type}
                  </span>
                  {alert && (
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                      alert.level === 'critical'
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Clock size={10} />
                      {alert.level === 'critical'
                        ? `Expire dans ${alert.days}j !`
                        : `${alert.days}j restants`}
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Layers size={14} />
                </div>
                <span className="text-xs font-bold">
                  {emp.departmentId ? 
                    departments.find(d => d.id === emp.departmentId)?.name || 'Non spécifié' : 
                    'Non spécifié'
                  }
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Mail size={14} />
                </div>
                <span className="text-xs font-bold truncate">{emp.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Phone size={14} />
                </div>
                <span className="text-xs font-bold">{emp.phone}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Embauché le {new Date(emp.hireDate).toLocaleDateString()}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <ChevronRight size={16} />
              </div>
            </div>
          </div>
        );})}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Aucun employé trouvé</h3>
          <div className="space-y-2 mb-4">
            {employees.length === 0 ? (
              <p className="text-slate-500 font-medium text-sm">Aucun employé dans la base de données.</p>
            ) : (
              <>
                <p className="text-slate-500 font-medium text-sm">
                  Aucun employé ne correspond aux critères de filtrage actuels.
                </p>
                {/* Afficher les filtres actifs */}
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {searchTerm && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                      Recherche: "{searchTerm}"
                    </span>
                  )}
                  {filterDept !== 'All' && (
                    <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-bold">
                      Département: {departments.find(d => d.id === filterDept)?.name}
                    </span>
                  )}
                  {filterPresence !== 'All' && (
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
                      Statut: {filterPresence === 'Present' ? '🟢 Présents' : '🔴 Absents'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setFilterDept('All');
                    setFilterPresence('All');
                    setSearchTerm('');
                  }}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold"
                >
                  Réinitialiser tous les filtres
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <HRModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Modifier ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              disabled={actionLoading}
              className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button 
              onClick={handleUpdateEmployee}
              disabled={actionLoading}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Mise à jour...
                </>
              ) : (
                'Mettre à jour'
              )}
            </button>
          </div>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prénom <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="Ex: Moussa" 
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="Ex: Diop" 
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Professionnel <span className="text-red-500">*</span></label>
            <input 
              type="email" 
              placeholder="moussa.diop@techcorp.com" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
            <input 
              type="text" 
              placeholder="+221 ..." 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Département</label>
            <select 
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
            >
              <option value="">Sélectionner un département</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poste</label>
            <input 
              type="text" 
              placeholder="Ex: Senior Developer" 
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date d'Embauche</label>
            <input 
              type="date" 
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm" 
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Photo de Profil</label>
            <div className="flex items-center gap-4">
              {formData.photoUrl && (
                <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                  <img 
                    src={formData.photoUrl} 
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
                  id="photoUploadEdit"
                />
                <label 
                  htmlFor="photoUploadEdit"
                  className={`w-full px-6 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-indigo-300 transition-all cursor-pointer ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Delete Confirmation Modal */}
      <HRModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Désactiver l'employé"
        size="sm"
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={actionLoading}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button 
              onClick={handleDeleteEmployee}
              disabled={actionLoading}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Désactivation...
                </>
              ) : (
                'Désactiver'
              )}
            </button>
          </div>
        }
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">
            Confirmer la désactivation
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Êtes-vous sûr de vouloir désactiver <strong>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</strong> ?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-amber-800 mb-1">⚠️ Contrainte importante :</p>
                  <p className="text-amber-700">
                    Si cet employé possède des <strong>contrats actifs</strong>, vous devez d'abord les <strong>résilier avec un motif valide</strong> dans la section "Contrats" avant de pouvoir le désactiver.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Cette action peut être annulée en réactivant l'employé ultérieurement.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            L'employé sera marqué comme inactif mais ses données seront conservées.
          </p>
        </div>
      </HRModal>
    </div>
  );
};

export default EmployeeList;
