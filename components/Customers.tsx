import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Search, Plus, Mail, Phone, Building2, Eye, Edit3, Trash2, X,
  ChevronRight, Star, UserCheck, AlertCircle, RefreshCw, ArrowRight, Save, Loader2, MapPin,
  History, DollarSign, FileText, Clock, Lock, ShieldCheck, TrendingUp, BarChart3,
  CreditCard, Activity, CheckCircle2, Calendar, Info, ShieldAlert
} from 'lucide-react';
import { Customer, UserRole, User } from '../types';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import YearMonthPicker from './YearMonthPicker';

interface CustomersProps {
  user: User;
  currency: string;
  plan?: any;
  refreshKey?: number;
}

const Customers: React.FC<CustomersProps> = ({ user, currency, plan, refreshKey }) => {
  const currentPlanId = String(plan?.id || plan?.name || plan?.plan || 'BASIC').toUpperCase();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSegment, setFilterSegment] = useState<'ALL' | 'ELITE' | 'RISK'>('ALL');
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [pageSize, setPageSize] = useState(6);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', minOutstanding: '', maxOutstanding: '', status: 'ALL' });

  // Year/Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    customers.forEach((c: any) => { if (c.createdAt) years.add(new Date(c.createdAt).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [customers]);

  useEffect(() => {
    if (selectedYear === null) {
      setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
      return;
    }
    const ms = selectedMonth !== null ? selectedMonth : 0;
    const me = selectedMonth !== null ? selectedMonth : 11;
    setFilters(f => ({
      ...f,
      dateFrom: new Date(selectedYear, ms, 1).toISOString().split('T')[0],
      dateTo:   new Date(selectedYear, me + 1, 0).toISOString().split('T')[0]
    }));
  }, [selectedYear, selectedMonth]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Customer | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Customer | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    mainContact: '',
    billingAddress: '',
    paymentTerms: 30,
  maxCreditLimit: 5000
  });
  const canModify = authBridge.canPerform(user, 'EDIT', 'customers');
  const customersAllowed = authBridge.isCreationAllowed(user, 'customers', customers.length);
  const isCustomersLimitReached = !customersAllowed;
  
  const roles = Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [];
  const isAccountant = roles.includes('ACCOUNTANT');
  

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setError(null);
    if (!formData.phone) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }
    setActionLoading(true);
    try {
      const payload = { ...formData, companyName: formData.companyName && String(formData.companyName).trim() !== '' ? formData.companyName : (formData.mainContact || 'Client') };
      const updated = await apiClient.put(`/customers/${showEditModal.id}`, payload);
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setShowEditModal(null);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Échec de la mise à jour.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.phone) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }
    setActionLoading(true);
    try {
      if (!authBridge.isCreationAllowed(user, 'customers', customers.length)) {
        if (currentPlanId === 'PRO') setError('Limite du plan PRO atteinte : maximum 12 clients.');
        else setError('Limite du plan Basic atteinte : maximum 5 clients.');
        setActionLoading(false);
        return;
      }
      const payload = { ...formData, companyName: formData.companyName && String(formData.companyName).trim() !== '' ? formData.companyName : (formData.mainContact || 'Client') };
      const data = await apiClient.post('/customers', payload);
      setCustomers([data, ...customers]);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Échec de l'enregistrement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/customers/${showDeleteConfirm.id}`);
      setCustomers(customers.filter(c => c.id !== showDeleteConfirm.id));
      const deletedName = showDeleteConfirm.companyName || 'Client';
      setShowDeleteConfirm(null);
      setShowSuccessMessage(`Le client "${deletedName}" a été supprimé avec succès.`);
      setTimeout(() => setShowSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression.");
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      companyName: '', email: '', phone: '',
      mainContact: '', billingAddress: '',
      paymentTerms: 30, maxCreditLimit: 5000
    });
  };

  const openEdit = (customer: Customer) => {
    if (isAccountant) {
      alert('Accès lecture seule : modifications non autorisées pour votre rôle.');
      return;
    }
    if (hasLinkedSales(customer.id)) {
      alert("Modification bloquée : Ce client possède un historique de ventes.");
      return;
    }
    setFormData({
      companyName: customer.companyName, email: customer.email,
      phone: customer.phone || '', mainContact: customer.mainContact || '',
      billingAddress: customer.billingAddress || '',
      paymentTerms: customer.paymentTerms || 30,
      maxCreditLimit: customer.maxCreditLimit || 5000
    });
    setError(null);
    setShowEditModal(customer);
  };

  const openDetails = async (customer: Customer) => {
    setShowDetailModal(customer);
    setHistoryLoading(true);
    setCustomerHistory([]);
    setCustomerStats(null);
    try {
      const response = await apiClient.get(`/customers/${customer.id}`);
      setCustomerHistory(response.recentSales || []);
      setCustomerStats(response.stats);
    } catch (err) {
      console.error("Erreur chargement historique client");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [custData, salesData] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/sales')
      ]);
      setCustomers(custData || []);
      setSales(salesData || []);
    } catch (err: any) {
      setError(err.message || 'Erreur de liaison Kernel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLinkedSales = (customerId: string) => {
    return sales.some(s => (s.customerId || s.customer_id) === customerId);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const searchStr = (search || '').toLowerCase();
      const matchesSearch = (c.companyName || '').toLowerCase().includes(searchStr) || 
                            (c.email || '').toLowerCase().includes(searchStr);
      if (!matchesSearch) return false;

      // Segment quick filters
      if (filterSegment === 'ELITE' && !((c.outstandingBalance || 0) > 10000)) return false;
      if (filterSegment === 'RISK' && !(c.healthStatus === 'CRITICAL')) return false;

      // Advanced filters
      if (filters.status && filters.status !== 'ALL' && (c.status || 'actif') !== filters.status) return false;

      const created = (c as any).createdAt ? new Date((c as any).createdAt).toISOString().split('T')[0] : '';
      if (filters.dateFrom && created && created < filters.dateFrom) return false;
      if (filters.dateTo && created && created > filters.dateTo) return false;

      const minO = filters.minOutstanding !== '' ? parseFloat(filters.minOutstanding) : null;
      const maxO = filters.maxOutstanding !== '' ? parseFloat(filters.maxOutstanding) : null;
      const out = Number(c.outstandingBalance || 0);
      if (minO !== null && out < minO) return false;
      if (maxO !== null && out > maxO) return false;

      return true;
    });
  }, [customers, search, filterSegment, filters]);

  const visibleCustomers = viewMode === 'CARD' ? filteredCustomers.slice(0, pageSize) : filteredCustomers;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> Hub Relation Clients
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Intelligence Commerciale • Instance Isolé</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={fetchData} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
            <button onClick={() => setViewMode('CARD')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'CARD' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>CARTE</button>
            <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>LISTE</button>
          </div>
          <button onClick={() => setShowFilters(s => !s)} className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>{showFilters ? 'Masquer filtres' : 'Filtres'}</button>
          {canModify && !isAccountant && (
            isCustomersLimitReached ? (
              <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Lock size={16} /> {currentPlanId === 'PRO' ? 'Limite du plan PRO atteinte : maximum 12 clients.' : 'Limite du plan Basic atteinte : maximum 5 clients.'}
              </div>
            ) : (
              <button 
                onClick={() => { resetForm(); setError(null); setShowCreateModal(true); }}
                className="bg-slate-900 text-white px-4 md:px-8 py-3 md:py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
              >
                <Plus size={18} /> CRÉER UN CLIENT
              </button>
            )
          )}
        </div>
      </div>

      {showSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
           <CheckCircle2 size={24} /> {showSuccessMessage}
        </div>
      )}

      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher par nom, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-4 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner" />
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          {(['ALL', 'ELITE', 'RISK'] as const).map(seg => (
            <button key={seg} onClick={() => setFilterSegment(seg)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterSegment === seg ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{seg === 'ALL' ? 'Tous' : seg === 'ELITE' ? 'VIP' : 'Risque'}</button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm mt-4 space-y-4">
          <YearMonthPicker
            dataYears={availableYears}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Date de création (début)</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mt-2" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Date de création (fin)</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mt-2" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Statut</label>
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mt-2">
                <option value="ALL">Tous</option>
                <option value="actif">Actifs</option>
                <option value="supprimer">Supprimés</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Encours min ({currency})</label>
              <input type="number" value={filters.minOutstanding} onChange={e => setFilters({...filters, minOutstanding: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mt-2" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Encours max ({currency})</label>
              <input type="number" value={filters.maxOutstanding} onChange={e => setFilters({...filters, maxOutstanding: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mt-2" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => { setFilters({ dateFrom: '', dateTo: '', minOutstanding: '', maxOutstanding: '', status: 'ALL' }); setSearch(''); }} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">RÉINITIALISER</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-white rounded-[2.5rem] animate-pulse border border-slate-100"></div>)}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center col-span-1 md:col-span-2 xl:col-span-3">
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucun client trouvé</p>
        </div>
      ) : (
        viewMode === 'CARD' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleCustomers.map(customer => {
                const isLinked = hasLinkedSales(customer.id);
                return (
                  <div key={customer.id} className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all p-8 flex flex-col h-full group relative overflow-hidden border-b-4 border-transparent hover:border-indigo-500 ${isLinked ? 'grayscale-[0.3]' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform uppercase">
                        {(customer.companyName || 'C').charAt(0)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${customer.healthStatus === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : customer.healthStatus === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {customer.healthStatus === 'GOOD' ? 'SOLVABLE' : customer.healthStatus === 'WARNING' ? 'VIGILANCE' : 'RISQUE'}
                      </div>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg uppercase truncate leading-none">{customer.companyName || 'Passage'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest truncate flex items-center gap-2"><Mail size={12}/> {customer.email}</p>
                    
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Encours</p>
                        <p className="text-sm font-black text-slate-900">{(customer.outstandingBalance || 0).toLocaleString()} {currency}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Délai</p>
                        <p className="text-sm font-black text-slate-900">{customer.paymentTerms || 30} Jours</p>
                      </div>
                    </div>

                    {isLinked && (
                      <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl w-fit">
                        <Info size={12} className="text-slate-400" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ventes liées détectées</span>
                      </div>
                    )}
                    
                    <div className="mt-8 flex justify-between gap-2 border-t pt-6">
                      <button onClick={() => openDetails(customer)} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">DÉTAILS <Eye size={16} /></button>
                      {canModify && !isAccountant && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openEdit(customer)} 
                            title={isLinked ? "Modification verrouillée" : "Modifier"}
                            className={`p-3 rounded-xl shadow-sm transition-all ${isLinked ? 'bg-slate-50 text-slate-200 cursor-not-allowed' : 'bg-white border border-slate-100 text-slate-400 hover:text-amber-600'}`}
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={() => !isLinked && setShowDeleteConfirm(customer)} 
                            title={isLinked ? "Suppression verrouillée" : "Supprimer"}
                            className={`p-3 rounded-xl shadow-sm transition-all ${isLinked ? 'bg-slate-50 text-slate-200 cursor-not-allowed' : 'bg-white border border-slate-100 text-slate-400 hover:text-rose-600'}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredCustomers.length > visibleCustomers.length && (
              <div className="flex justify-center mt-6">
                <button onClick={() => setPageSize(prev => prev + 6)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest">VOIR PLUS</button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                  <th className="px-3 md:px-6 py-3 md:py-4">Client</th>
                  <th className="px-3 md:px-6 py-3 md:py-4">Email</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-center">Solvabilité</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right">Encours</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCustomers.map(customer => {
                  const isLinked = hasLinkedSales(customer.id);
                  return (
                    <tr key={customer.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-black text-slate-900">{customer.companyName || '—'}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-slate-500 text-sm truncate max-w-[120px] md:max-w-[200px]">{customer.email}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center text-[11px] font-black">{customer.healthStatus === 'GOOD' ? 'SOLVABLE' : customer.healthStatus === 'WARNING' ? 'VIGILANCE' : 'RISQUE'}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right font-black">{(customer.outstandingBalance || 0).toLocaleString()} {currency}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right flex items-center justify-end gap-2">
                        <button onClick={() => openDetails(customer)} className="px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-600">Voir</button>
                        {canModify && !isAccountant && (
                          <>
                            <button onClick={() => openEdit(customer)} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}><Edit3 size={16} /></button>
                            <button onClick={() => !isLinked && setShowDeleteConfirm(customer)} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}><Trash2 size={16} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL CRÉATION / MODIFICATION */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[2rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 max-h-[90dvh] flex flex-col">
             <div className={`px-4 md:px-10 py-5 md:py-8 text-white flex justify-between items-center ${showEditModal ? 'bg-amber-500' : 'bg-slate-900'}`}>
                <div className="flex items-center gap-4">
                  {showEditModal ? <Edit3 size={28}/> : <Plus size={28}/>}
                  <h3 className="text-xl font-black uppercase tracking-tight">
                    {showEditModal ? 'Révision Fiche Client' : 'Nouveau Partenaire'}
                  </h3>
                </div>
                <button onClick={() => { setShowCreateModal(false); setShowEditModal(null); }} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
             </div>
             <form onSubmit={showEditModal ? handleUpdate : handleCreate} className="p-4 md:p-10 space-y-6 md:space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Identité Entreprise</label>
                      <input type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Raison Sociale (optionnel)" />
                      <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Email de contact (optionnel)" />
                      <input type="text" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Téléphone (obligatoire)" />
                      <input type="text" value={formData.mainContact} onChange={e => setFormData({...formData, mainContact: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Nom du responsable (optionnel)" />
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Logistique & Crédit</label>
                      <textarea value={formData.billingAddress} onChange={e => setFormData({...formData, billingAddress: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px]" placeholder="Adresse de facturation"></textarea>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase px-2">Délai (jours)</p>
                           <input type="number" value={formData.paymentTerms} onChange={e => setFormData({...formData, paymentTerms: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none" />
                         </div>
                         <div className="space-y-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase px-2">Plafond ({currency})</p>
                           <input type="number" value={formData.maxCreditLimit} onChange={e => setFormData({...formData, maxCreditLimit: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none" />
                         </div>
                      </div>
                   </div>
                </div>
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                    <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-rose-700 leading-relaxed">{error}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(null); setError(null); }} className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">ANNULER</button>
                  <button type="submit" disabled={actionLoading} className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${showEditModal ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <>{showEditModal ? 'METTRE À JOUR' : 'SCELLER LE PROFIL'} <ArrowRight size={18}/></>}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md mx-4 md:mx-auto rounded-[3rem] shadow-2xl overflow-hidden p-5 md:p-10 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la suppression ?</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
                Souhaitez-vous marquer le client <span className="text-rose-600 font-black">"{showDeleteConfirm.companyName}"</span> comme "supprimer" ?<br/>
                Cette action est enregistrée dans le journal d'audit AlwaysData.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmDelete} 
                  disabled={actionLoading}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  OUI, RÉVOQUER LE COMPTE
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                >
                  Annuler l'action
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DÉTAILS VUE 360 */}
      {showDetailModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 md:p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">

            {/* ── Header ── */}
            <div className="px-6 md:px-10 py-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-500/30 border border-indigo-400/30 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner shrink-0 uppercase">
                  {(showDetailModal.companyName || 'C').charAt(0)}
                </div>
                <div>
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Dossier Client 360°</p>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">{showDetailModal.companyName}</h3>
                  <p className="text-[9px] text-indigo-300/70 font-mono mt-1 uppercase tracking-widest">
                    REF: {showDetailModal.id.slice(0, 8)} &nbsp;·&nbsp;
                    <span className={showDetailModal.healthStatus === 'GOOD' ? 'text-emerald-400' : 'text-rose-400'}>
                      {showDetailModal.healthStatus === 'GOOD' ? 'Solvabilité bonne' : showDetailModal.healthStatus === 'WARNING' ? 'Solvabilité à surveiller' : 'Solvabilité critique'}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all shrink-0"><X size={22} /></button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/60 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Colonne gauche */}
                <div className="lg:col-span-1 space-y-4">

                  {/* KPI encours */}
                  <div className={`p-6 rounded-2xl text-white shadow-lg relative overflow-hidden ${(customerStats?.outstanding || 0) > 0 ? 'bg-gradient-to-br from-rose-600 to-rose-700' : 'bg-gradient-to-br from-emerald-600 to-emerald-700'}`}>
                    <div className="absolute -right-4 -bottom-4 opacity-10"><TrendingUp size={80} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-70 mb-3">Encours Actuel</p>
                    <p className="text-4xl font-black">{(customerStats?.outstanding || 0).toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{currency} en attente de règlement</p>
                  </div>

                  {/* KPI volume d'affaires */}
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10"><BarChart3 size={80} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-70 mb-3">Volume d'affaires</p>
                    <p className="text-4xl font-black">{(customerStats?.totalInvoiced || 0).toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{currency} facturés au total</p>
                  </div>

                  {/* Coordonnées */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Phone size={13} /> Coordonnées</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0"><Mail size={14} /></div>
                        <div className="overflow-hidden">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Email</p>
                          <p className="text-xs font-bold text-slate-800 truncate">{showDetailModal.email || 'Non renseigné'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0"><Phone size={14} /></div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Téléphone</p>
                          <p className="text-xs font-bold text-slate-800">{showDetailModal.phone || 'Non renseigné'}</p>
                        </div>
                      </div>
                      {showDetailModal.billingAddress && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><MapPin size={14} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Siège social</p>
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">{showDetailModal.billingAddress}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colonne droite */}
                <div className="lg:col-span-2 space-y-4">

                  {/* Chèques en attente */}
                  {(() => {
                    const pendingChequeStatuses = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];
                    const cheques = customerHistory.flatMap((sale: any) =>
                      (sale.payments || [])
                        .filter((p: any) => p.method === 'CHEQUE' && pendingChequeStatuses.includes(p.status))
                        .map((p: any) => ({ ...p, saleRef: sale.reference }))
                    );
                    if (cheques.length === 0) return null;
                    const total = cheques.reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0);
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                            <span className="w-5 h-5 bg-amber-500 rounded-lg flex items-center justify-center text-white text-[8px]">✓</span>
                            Chèques en Attente
                          </h4>
                          <p className="text-sm font-black text-amber-700">{total.toLocaleString()} <span className="text-[9px] font-bold">{currency}</span></p>
                        </div>
                        <div className="space-y-2">
                          {cheques.map((p: any) => (
                            <div key={p.id} className="bg-white border border-amber-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                              <div>
                                <p className="text-[9px] font-black text-slate-700">#{p.saleRef} — {p.chequeNumber || 'N° non renseigné'}</p>
                                <p className="text-[8px] text-slate-400 font-bold">{p.bankName || '—'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-amber-700">{parseFloat(p.amount).toLocaleString()} {currency}</p>
                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                  p.status === 'REGISTERED' ? 'bg-blue-100 text-blue-700' :
                                  p.status === 'DEPOSITED' ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>{p.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Historique des commandes */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between shrink-0">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <History size={14} className="text-indigo-400" /> Dernières commandes
                      </h4>
                      {historyLoading
                        ? <Loader2 className="animate-spin text-indigo-400" size={14} />
                        : <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">
                            {customerHistory.length} commande{customerHistory.length !== 1 ? 's' : ''}
                          </span>
                      }
                    </div>
                    <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[220px] max-h-[380px]">
                      {customerHistory.length === 0 && !historyLoading ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-300">
                          <FileText size={32} />
                          <p className="text-[9px] font-black uppercase tracking-widest">Aucune vente enregistrée</p>
                        </div>
                      ) : customerHistory.map((sale: any, idx: number) => (
                        <div key={sale.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black group-hover:scale-105 transition-transform ${sale.status === 'ANNULE' ? 'bg-rose-50 text-rose-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-black text-sm truncate ${sale.status === 'ANNULE' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>#{sale.reference}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">{new Date(sale.createdAt).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-black ${sale.status === 'ANNULE' ? 'text-slate-300' : 'text-slate-900'}`}>{parseFloat(sale.totalTtc).toLocaleString()} {currency}</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-[7px] font-black uppercase mt-1 ${
                              sale.status === 'TERMINE' ? 'bg-emerald-50 text-emerald-600' :
                              sale.status === 'ANNULE'  ? 'bg-rose-50 text-rose-500' :
                              'bg-amber-50 text-amber-600'
                            }`}>{sale.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 md:px-8 py-4 bg-white border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;