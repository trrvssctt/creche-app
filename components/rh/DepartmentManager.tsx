import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Edit3, Trash2, X,
  RefreshCw, Lock, Eye, Save, AlertCircle,
  ShieldAlert, Info, CheckCircle2, Users, UserCheck, ArrowLeft,
  Loader2, TrendingUp
} from 'lucide-react';
import { authBridge } from '../../services/authBridge';
import { apiClient } from '../../services/api';
import {  } from '../../types';
import { useToast } from '../ToastProvider';

interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  employeeCount?: number;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  departmentId?: string;
}

const DepartmentManager: React.FC<{ plan?: any; onNavigate?: (tab: string) => void }> = ({ plan, onNavigate }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [pageSize, setPageSize] = useState<number>(6);

  const [filters, setFilters] = useState({
    search: '',
    hasManager: 'ALL' // 'ALL', 'WITH_MANAGER', 'WITHOUT_MANAGER'
  });
  
  const [showModal, setShowModal] = useState<'CREATE' | 'EDIT' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Department | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [showDetailsDepartment, setShowDetailsDepartment] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    managerId: '' 
  });

  const currentUser = authBridge.getSession()?.user;
  const canModify = currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'departments') : false;
  const showToast = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptData, empData] = await Promise.all([
        apiClient.get('/hr/departments'),
        apiClient.get('/hr/employees')
      ]);
      setDepartments(deptData?.rows || deptData || []);
      setEmployees(empData?.rows || empData || []);
    } catch (err: any) { 
      setError("Erreur de liaison avec le module RH.");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Vérifie si un département a des employés associés (double source : count API + liste locale)
  const hasEmployees = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    const countFromDept = dept ? (dept.employeeCount || 0) > 0 : false;
    const countFromList = employees.some(e => e.departmentId === deptId);
    return countFromDept || countFromList;
  };

  // Employés appartenant au département sélectionné (pour le select manager en mode EDIT)
  const deptEmployees = selectedDepartment
    ? employees.filter(e => e.departmentId === selectedDepartment.id)
    : [];

  const filteredDepartments = departments.filter(dept => {
    const matchSearch = !filters.search || 
      dept.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      (dept.description || '').toLowerCase().includes(filters.search.toLowerCase());
    
    const matchManager = filters.hasManager === 'ALL' ||
      (filters.hasManager === 'WITH_MANAGER' && dept.managerId) ||
      (filters.hasManager === 'WITHOUT_MANAGER' && !dept.managerId);
    
    return matchSearch && matchManager;
  });

  const displayedDepartments = viewMode === 'CARD' ? 
    filteredDepartments.slice(0, pageSize) : 
    filteredDepartments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) return;
    
    setActionLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        managerId: formData.managerId || null
      };

      if (showModal === 'CREATE') {
        const newDept = await apiClient.post('/hr/departments', payload);
        setDepartments([newDept, ...departments]);
        showToast('Département créé avec succès', 'success');
      } else if (showModal === 'EDIT' && selectedDepartment) {
        const updatedDept = await apiClient.put(`/hr/departments/${selectedDepartment.id}`, payload);
        setDepartments(departments.map(d => d.id === updatedDept.id ? updatedDept : d));
        showToast('Département modifié avec succès', 'success');
      }
      
      setShowModal(null);
      setFormData({ name: '', description: '', managerId: '' });
      setSelectedDepartment(null);
    } catch (err: any) {
      const message = err.message || "L'opération a été rejetée par le système.";
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm || !canModify) return;
    
    setActionLoading(true);
    setError(null);

    try {
      await apiClient.delete(`/hr/departments/${showDeleteConfirm.id}`);
      setDepartments(departments.filter(d => d.id !== showDeleteConfirm.id));
      setShowDeleteConfirm(null);
      showToast('Département supprimé avec succès', 'success');
    } catch (err: any) {
      const message = err.message || "Erreur lors de la suppression.";
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department);
    setFormData({ 
      name: department.name, 
      description: department.description || '', 
      managerId: department.managerId || '' 
    });
    setShowModal('EDIT');
  };

  const handleCreate = () => {
    setSelectedDepartment(null);
    setFormData({ name: '', description: '', managerId: '' });
    setShowModal('CREATE');
  };

  const totalEmployees = departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0);
  const withManager = departments.filter(d => d.managerId).length;
  const withoutManager = departments.length - withManager;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onNavigate && (
            <button
              onClick={() => onNavigate('rh')}
              className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <Building2 className="text-indigo-600" size={30} /> Départements
            </h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em] mt-1">
              Organisation des équipes & structures
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {canModify && (
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
            >
              <Plus size={16} /> Nouveau Département
            </button>
          )}
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Total */}
        <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-10"><Building2 size={80} /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Départements</p>
          <h3 className="text-4xl font-black">{loading ? '—' : departments.length}</h3>
          <p className="text-sm font-bold text-slate-400 mt-1">Structures actives</p>
        </div>

        {/* Avec Manager */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:rotate-12 transition-transform"><UserCheck size={60} /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avec Manager</p>
          <h3 className="text-3xl font-black text-slate-900">{loading ? '—' : withManager}</h3>
          <div className="w-full h-1.5 bg-slate-50 rounded-full mt-4 overflow-hidden shadow-inner">
            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: departments.length > 0 ? `${(withManager / departments.length) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Sans Manager */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:-rotate-12 transition-transform"><AlertCircle size={60} /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sans Manager</p>
          <h3 className={`text-3xl font-black ${withoutManager > 0 ? 'text-amber-500' : 'text-slate-900'}`}>{loading ? '—' : withoutManager}</h3>
          <div className="w-full h-1.5 bg-slate-50 rounded-full mt-4 overflow-hidden shadow-inner">
            <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: departments.length > 0 ? `${(withoutManager / departments.length) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Total Employés */}
        <div className="bg-indigo-50 p-6 md:p-8 rounded-[2.5rem] border border-indigo-100 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 p-4 opacity-20"><Users size={80} className="text-indigo-600" /></div>
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <TrendingUp size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Employés</span>
          </div>
          <p className="text-3xl font-black text-indigo-800">{loading ? '—' : totalEmployees}</p>
          <p className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">Répartis dans {departments.length} dép.</p>
        </div>
      </div>

      {/* ── Barre de recherche & filtres ── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un département..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={filters.hasManager}
            onChange={(e) => setFilters({ ...filters, hasManager: e.target.value })}
            className="px-4 py-3 bg-slate-50 border-none rounded-2xl font-black text-xs uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer appearance-none"
          >
            <option value="ALL">Tous</option>
            <option value="WITH_MANAGER">Avec manager</option>
            <option value="WITHOUT_MANAGER">Sans manager</option>
          </select>
          <button onClick={() => setViewMode('CARD')} className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'CARD' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Carte</button>
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'LIST' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Liste</button>
        </div>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Contenu ── */}
      {loading ? (
        /* Skeleton */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 bg-white rounded-[2.5rem] animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="py-24 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Building2 size={40} />
          </div>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Aucun département trouvé</p>
          <p className="text-slate-300 text-xs font-medium mt-2">
            {departments.length === 0 ? 'Créez votre premier département pour organiser vos équipes' : 'Aucun département ne correspond aux critères'}
          </p>
          {departments.length === 0 && canModify && (
            <button onClick={handleCreate} className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-2 mx-auto">
              <Plus size={14} /> Créer un département
            </button>
          )}
        </div>
      ) : viewMode === 'CARD' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedDepartments.map((department) => (
              <div key={department.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all group relative flex flex-col h-full border-b-4 border-b-transparent hover:border-b-indigo-500">
                {/* Icône + actions */}
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Building2 size={26} />
                  </div>
                  <div className="flex items-center gap-1">
                    {canModify && (
                      <>
                        <button onClick={() => handleEdit(department)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier">
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => !hasEmployees(department.id) && setShowDeleteConfirm(department)}
                          disabled={hasEmployees(department.id)}
                          className={`p-2 rounded-xl transition-all ${hasEmployees(department.id) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                          title={hasEmployees(department.id) ? 'Impossible : des employés sont associés' : 'Supprimer'}
                        >
                          {hasEmployees(department.id) ? <Lock size={15} /> : <Trash2 size={15} />}
                        </button>
                      </>
                    )}
                    <button onClick={() => setShowDetailsDepartment(department)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Détails">
                      <Eye size={15} />
                    </button>
                  </div>
                </div>

                {/* Nom + desc */}
                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1 truncate">{department.name}</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2 mb-5">
                    {department.description || 'Aucune description renseignée.'}
                  </p>
                </div>

                {/* Stats internes */}
                <div className="pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12} /> Employés</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${(department.employeeCount || 0) > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                      {department.employeeCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><UserCheck size={12} /> Manager</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black truncate max-w-[140px] ${department.manager ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                      {department.manager ? `${department.manager.firstName} ${department.manager.lastName}` : 'Non assigné'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredDepartments.length > pageSize && (
            <div className="flex justify-center mt-4">
              <button onClick={() => setPageSize(pageSize + 6)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Voir plus ({filteredDepartments.length - pageSize} restants)
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Vue Liste ── */
        <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Département</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-center">Employés</th>
                <th className="px-6 py-4">Manager</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDepartments.map((department) => (
                <tr key={department.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                        <Building2 size={16} />
                      </div>
                      <span className="font-black text-slate-900 text-sm uppercase tracking-tight">{department.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs max-w-[200px] truncate">{department.description || '—'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${(department.employeeCount || 0) > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                      {department.employeeCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {department.manager ? (
                      <span className="text-xs font-bold text-slate-700">{department.manager.firstName} {department.manager.lastName}</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-500 rounded-lg text-[10px] font-black">Non assigné</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setShowDetailsDepartment(department)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Eye size={15} /></button>
                      {canModify && (
                        <>
                          <button onClick={() => handleEdit(department)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit3 size={15} /></button>
                          <button
                            onClick={() => !hasEmployees(department.id) && setShowDeleteConfirm(department)}
                            disabled={hasEmployees(department.id)}
                            className={`p-2 rounded-xl transition-all ${hasEmployees(department.id) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                          >
                            {hasEmployees(department.id) ? <Lock size={15} /> : <Trash2 size={15} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL CRÉATION / MODIFICATION
      ══════════════════════════════════════ */}
      {!!showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            {/* En-tête */}
            <div className={`px-10 py-8 text-white flex justify-between items-center ${showModal === 'CREATE' ? 'bg-slate-900' : 'bg-amber-500'}`}>
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                {showModal === 'CREATE' ? <Plus size={22} /> : <Edit3 size={22} />}
                {showModal === 'CREATE' ? 'Nouveau Département' : 'Modifier le Département'}
              </h3>
              <button onClick={() => setShowModal(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={22} /></button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                  Nom du département <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
                  placeholder="Ex: Ressources Humaines"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner resize-none min-h-[90px]"
                  placeholder="Description du département..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Manager <span className="text-slate-300">(optionnel)</span></label>
                {showModal === 'EDIT' && deptEmployees.length === 0 ? (
                  <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <AlertCircle size={15} className="text-amber-500 shrink-0" />
                    <p className="text-xs font-bold text-amber-700">Aucun employé dans ce département. Affectez d'abord des employés pour désigner un manager.</p>
                  </div>
                ) : (
                  <select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer shadow-inner"
                  >
                    <option value="">— Aucun manager —</option>
                    {(showModal === 'EDIT' ? deptEmployees : employees).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}{emp.position ? ` — ${emp.position}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${showModal === 'CREATE' ? 'bg-indigo-600 hover:bg-slate-900' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Enregistrer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL SUPPRESSION
      ══════════════════════════════════════ */}
      {!!showDeleteConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la suppression ?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
              Supprimer le département <span className="text-rose-600 font-black">"{showDeleteConfirm.name}"</span> ?<br />
              Cette action est <span className="font-black">irréversible</span>.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Oui, supprimer
              </button>
              <button onClick={() => setShowDeleteConfirm(null)} className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Annuler l'action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL DÉTAILS
      ══════════════════════════════════════ */}
      {!!showDetailsDepartment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-500">
            {/* En-tête */}
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                  <Building2 size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{showDetailsDepartment.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-widest">
                      {showDetailsDepartment.employeeCount || 0} employé{(showDetailsDepartment.employeeCount || 0) > 1 ? 's' : ''}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${showDetailsDepartment.manager ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {showDetailsDepartment.manager ? 'Manager assigné' : 'Sans manager'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailsDepartment(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/30">
              {/* Description */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Info size={12} /> Description</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                  {showDetailsDepartment.description || 'Aucune description renseignée pour ce département.'}
                </p>
              </div>

              {/* Manager */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserCheck size={12} /> Manager</p>
                {showDetailsDepartment.manager ? (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black text-sm">
                      {showDetailsDepartment.manager.firstName[0]}{showDetailsDepartment.manager.lastName[0]}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{showDetailsDepartment.manager.firstName} {showDetailsDepartment.manager.lastName}</p>
                      <p className="text-xs text-slate-500">{showDetailsDepartment.manager.email}</p>
                    </div>
                    <CheckCircle2 size={18} className="text-emerald-500 ml-auto" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <AlertCircle size={18} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-700">Aucun manager assigné à ce département</p>
                  </div>
                )}
              </div>

              {/* Métadonnées */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Info size={12} /> Informations Système</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Créé le</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{new Date(showDetailsDepartment.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Modifié le</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{new Date(showDetailsDepartment.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Identifiant</p>
                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{showDetailsDepartment.id.slice(0, 16)}…</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Employés</p>
                    <p className="text-sm font-bold text-indigo-600 mt-1">{showDetailsDepartment.employeeCount || 0} assigné{(showDetailsDepartment.employeeCount || 0) > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-10 py-6 bg-white border-t border-slate-50 flex gap-3 shrink-0">
              {canModify && (
                <button
                  onClick={() => { setShowDetailsDepartment(null); handleEdit(showDetailsDepartment); }}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <Edit3 size={14} /> Modifier
                </button>
              )}
              <button
                onClick={() => setShowDetailsDepartment(null)}
                className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManager;