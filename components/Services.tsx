
import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Search, Edit3, Trash2, X, RefreshCw,
  Lock, Save, AlertCircle, ArrowRight, Loader2,
  Briefcase, ShieldAlert, CheckCircle2, XCircle, Info, Upload, ImageIcon, Eye, Tag,
  GraduationCap, Bus, UtensilsCrossed, Star, Award, CalendarDays
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { uploadFile } from '../services/uploadService';
import { useToast } from './ToastProvider';

// ─── Constantes scolaires ────────────────────────────────────────────────────

const TYPES_OFFRE = [
  { value: 'INSCRIPTION',   label: 'Inscription',          color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Star },
  { value: 'MENSUALITE',    label: 'Mensualité',           color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: CalendarDays },
  { value: 'REINSCRIPTION', label: 'Réinscription',        color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Award },
  { value: 'BUS',           label: 'Transport (Bus)',       color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Bus },
  { value: 'CANTINE',       label: 'Cantine',              color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: UtensilsCrossed },
  { value: 'ACTIVITE',      label: 'Activité Périscolaire', color: 'bg-rose-50 text-rose-700 border-rose-200',   icon: GraduationCap },
  { value: 'AUTRE',         label: 'Autre',                color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Tag },
] as const;

const NIVEAUX_SCOLAIRES = [
  { value: 'CRECHE', label: 'Crèche',    cycle: 'Crèche' },
  { value: 'PS',     label: 'PS',        cycle: 'Maternelle' },
  { value: 'MS',     label: 'MS',        cycle: 'Maternelle' },
  { value: 'GS',     label: 'GS',        cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',        cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',       cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',       cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',       cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',       cycle: 'Élémentaire' },
];

type TypeOffre = typeof TYPES_OFFRE[number]['value'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeOffre(value: string) {
  return TYPES_OFFRE.find(t => t.value === value) ?? TYPES_OFFRE[1];
}

function TypeBadge({ value }: { value: string }) {
  const t = getTypeOffre(value);
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${t.color}`}>
      <Icon size={10} /> {t.label}
    </span>
  );
}

function NiveauxBadges({ niveaux }: { niveaux: string[] }) {
  if (!niveaux || niveaux.length === 0) return <span className="text-slate-300 text-[9px]">Tous niveaux</span>;
  const tooMany = niveaux.length > 4;
  const shown = tooMany ? niveaux.slice(0, 4) : niveaux;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(n => (
        <span key={n} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase border border-indigo-100">{n}</span>
      ))}
      {tooMany && <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded text-[8px] font-black">+{niveaux.length - 4}</span>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const emptyOffre = () => ({
  name: '',
  description: '',
  price: 0,
  isActive: true,
  imageUrl: '',
  typeOffre: 'MENSUALITE' as TypeOffre,
  niveauxCibles: [] as string[],
  dureeMois: 10,
  inclutCantine: false,
  fraisInscription: 0,
});

const Services = ({ currency }: { currency: string }) => {
  const [services, setServices] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [pageSize, setPageSize] = useState<number>(6);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: 'ALL', typeOffre: 'ALL', minPrice: '', maxPrice: '' });
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formDataList, setFormDataList] = useState([emptyOffre()]);

  const currentUser = authBridge.getSession()?.user;
  const canModify = currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'services') : false;
  const showToast = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [srvData, salesData] = await Promise.all([
        apiClient.get('/services'),
        apiClient.get('/sales')
      ]);
      setServices(srvData || []);
      setSales(salesData || []);
    } catch { setError("Erreur de liaison avec le serveur."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const isServiceLinked = (serviceId: string) =>
    sales.some(sale => (sale.items || []).some((item: any) => (item.serviceId || item.service_id) === serviceId));

  const filteredServices = services.filter(s => {
    const q = filters.search || '';
    const matchesText = (s.name || '').toLowerCase().includes(q.toLowerCase()) || (s.description || '').toLowerCase().includes(q.toLowerCase());
    const statusMatch = filters.status === 'ALL' || (filters.status === 'ACTIVE' && s.isActive) || (filters.status === 'INACTIVE' && !s.isActive);
    const typeMatch = filters.typeOffre === 'ALL' || (s.typeOffre || s.type_offre || 'MENSUALITE') === filters.typeOffre;
    const price = Number(s.price || 0);
    const minOk = filters.minPrice === '' || price >= Number(filters.minPrice);
    const maxOk = filters.maxPrice === '' || price <= Number(filters.maxPrice);
    return matchesText && statusMatch && typeMatch && minOk && maxOk;
  });

  const visibleServices = viewMode === 'CARD' ? filteredServices.slice(0, pageSize) : filteredServices;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadFile(file, 'images');
      setFormDataList(prev => prev.map((f, i) => i === idx ? { ...f, imageUrl: result.url } : f));
    } catch { showToast("Échec de l'envoi de l'image.", 'error'); }
    finally { setIsUploading(false); }
  };

  const toggleNiveau = (idx: number, niveau: string) => {
    setFormDataList(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      const niveaux = f.niveauxCibles.includes(niveau)
        ? f.niveauxCibles.filter(n => n !== niveau)
        : [...f.niveauxCibles, niveau];
      return { ...f, niveauxCibles: niveaux };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) return;
    setActionLoading(true);
    setError(null);
    try {
      if (modalMode === 'CREATE') {
        const validForms = formDataList.filter(f => f.name && f.price);
        if (validForms.length === 0) { showToast("Veuillez remplir au moins une offre.", 'error'); return; }
        const created = await Promise.all(validForms.map(f => apiClient.post('/services', f)));
        setServices(prev => [...created, ...prev]);
      } else if (modalMode === 'EDIT' && selectedService) {
        const res = await apiClient.put(`/services/${selectedService.id}`, formDataList[0]);
        setServices(services.map(s => s.id === res.id ? res : s));
      }
      setModalMode(null);
    } catch (err: any) {
      setError(err.message || "L'opération a échoué.");
    } finally { setActionLoading(false); }
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm || !canModify) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/services/${showDeleteConfirm.id}`);
      setServices(services.filter(s => s.id !== showDeleteConfirm.id));
      const name = showDeleteConfirm.name;
      setShowDeleteConfirm(null);
      setShowSuccessMessage(`L'offre "${name}" a été supprimée.`);
      setTimeout(() => setShowSuccessMessage(null), 4000);
    } catch (err: any) { setError(err.message || "Erreur lors de la suppression."); }
    finally { setActionLoading(false); }
  };

  const openEdit = (service: any) => {
    if (isServiceLinked(service.id)) { showToast("Modification bloquée : cette offre est liée à une facture.", 'error'); return; }
    setSelectedService(service);
    setFormDataList([{
      name: service.name,
      description: service.description || '',
      price: Number(service.price),
      isActive: service.isActive,
      imageUrl: service.imageUrl || '',
      typeOffre: (service.typeOffre || service.type_offre || 'MENSUALITE') as TypeOffre,
      niveauxCibles: service.niveauxCibles || service.niveaux_cibles || [],
      dureeMois: service.dureeMois || service.duree_mois || 10,
      inclutCantine: service.inclutCantine || service.inclut_cantine || false,
      fraisInscription: Number(service.fraisInscription || service.frais_inscription || 0),
    }]);
    setModalMode('EDIT');
  };

  const openDetails = (service: any) => { setSelectedService(service); setModalMode('VIEW'); };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <BookOpen className="text-indigo-600" size={32} /> Offres de Scolarité
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Catalogue des forfaits & tarifs — Le Toit des Anges</p>
        </div>
        {canModify && (
          <button
            onClick={() => { setFormDataList([emptyOffre()]); setModalMode('CREATE'); setError(null); }}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
          >
            <Plus size={18} /> NOUVELLE OFFRE
          </button>
        )}
      </div>

      {showSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <CheckCircle2 size={24} /> {showSuccessMessage}
        </div>
      )}

      {/* ── Barre de recherche + vues ── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher une offre de scolarité..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => setViewMode('CARD')} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'CARD' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Carte</button>
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'LIST' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Liste</button>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>FILTRES</button>
        </div>
        <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Filtres avancés ── */}
      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Type d'offre</label>
            <select value={filters.typeOffre} onChange={e => setFilters({ ...filters, typeOffre: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
              <option value="ALL">Tous</option>
              {TYPES_OFFRE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Statut</label>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
              <option value="ALL">Tous</option>
              <option value="ACTIVE">Actifs</option>
              <option value="INACTIVE">Inactifs</option>
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Tarif (Min / Max)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="Min" value={filters.minPrice} onChange={e => setFilters({ ...filters, minPrice: e.target.value })} className="w-1/2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e => setFilters({ ...filters, maxPrice: e.target.value })} className="w-1/2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
          </div>
          <div className="md:col-span-4">
            <button onClick={() => setFilters({ search: '', status: 'ALL', typeOffre: 'ALL', minPrice: '', maxPrice: '' })} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all w-full">RÉINITIALISER</button>
          </div>
        </div>
      )}

      {/* ── Vue CARTE ── */}
      {viewMode === 'CARD' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-white rounded-[2.5rem] animate-pulse border border-slate-100" />)
              : filteredServices.length === 0
                ? (
                  <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center col-span-3">
                    <BookOpen size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucune offre trouvée</p>
                  </div>
                )
                : visibleServices.map(service => {
                  const isLinked = isServiceLinked(service.id);
                  const typeVal = service.typeOffre || service.type_offre || 'MENSUALITE';
                  const niveaux: string[] = service.niveauxCibles || service.niveaux_cibles || [];
                  const inclutCantine = service.inclutCantine || service.inclut_cantine || false;
                  return (
                    <div key={service.id} className={`bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all group relative flex flex-col h-full border-b-4 border-b-transparent hover:border-b-indigo-500 ${!service.isActive ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-start mb-4 shrink-0">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner overflow-hidden">
                          {service.imageUrl
                            ? <img src={service.imageUrl} className="w-full h-full object-cover" alt={service.name} />
                            : <BookOpen size={24} />}
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${service.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {service.isActive ? 'ACTIF' : 'INACTIF'}
                          </span>
                          {canModify && (
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(service)} title={isLinked ? "Lié à une facture" : "Modifier"} className={`p-2 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}><Edit3 size={16} /></button>
                              <button onClick={() => !isLinked && setShowDeleteConfirm(service)} title={isLinked ? "Lié à une facture" : "Supprimer"} className={`p-2 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}><Trash2 size={16} /></button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <TypeBadge value={typeVal} />
                        {inclutCantine && <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"><UtensilsCrossed size={8}/> Cantine incluse</span>}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1 truncate">{service.name}</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2 mb-3">{service.description || 'Offre de scolarité.'}</p>

                      <div className="mb-4">
                        <NiveauxBadges niveaux={niveaux} />
                      </div>

                      <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-50">
                        <button onClick={() => openDetails(service)} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">DÉTAILS <Eye size={16} /></button>
                        <div className="text-right">
                          <p className="text-2xl font-black text-indigo-600">{Number(service.price).toLocaleString()} <span className="text-[10px] text-slate-400">{currency}</span></p>
                          {(service.dureeMois || service.duree_mois) && <p className="text-[8px] text-slate-400 font-black uppercase">/ {service.dureeMois || service.duree_mois} mois</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
          {filteredServices.length > visibleServices.length && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setPageSize(prev => prev + 6)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest">VOIR PLUS</button>
            </div>
          )}
        </>
      ) : (
        /* ── Vue LISTE ── */
        <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                <th className="px-6 py-4">Offre</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Niveaux ciblés</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-right">Tarif mensuel</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? [...Array(6)].map((_, i) => <tr key={i} className="h-16 bg-slate-50 animate-pulse"><td colSpan={6} /></tr>)
                : filteredServices.length === 0
                  ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucune offre trouvée</td></tr>
                  : filteredServices.map(service => {
                    const isLinked = isServiceLinked(service.id);
                    const niveaux: string[] = service.niveauxCibles || service.niveaux_cibles || [];
                    return (
                      <tr key={service.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-black text-slate-900">{service.name}</td>
                        <td className="px-6 py-4"><TypeBadge value={service.typeOffre || service.type_offre || 'MENSUALITE'} /></td>
                        <td className="px-6 py-4"><NiveauxBadges niveaux={niveaux} /></td>
                        <td className="px-6 py-4 text-center text-[11px] font-black">{service.isActive ? <span className="text-emerald-600">Actif</span> : <span className="text-rose-600">Inactif</span>}</td>
                        <td className="px-6 py-4 text-right font-black">{Number(service.price).toLocaleString()} {currency}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button onClick={() => openDetails(service)} className="px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-600">Voir</button>
                          {canModify && (
                            <>
                              <button onClick={() => openEdit(service)} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}><Edit3 size={16} /></button>
                              <button onClick={() => !isLinked && setShowDeleteConfirm(service)} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}><Trash2 size={16} /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL CRÉER / MODIFIER ══ */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-500">
            <div className={`px-10 py-8 text-white flex justify-between items-center shrink-0 ${modalMode === 'CREATE' ? 'bg-slate-900' : 'bg-amber-500'}`}>
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                {modalMode === 'CREATE' ? <Plus size={24} /> : <Edit3 size={24} />}
                {modalMode === 'CREATE' ? 'Nouvelle Offre de Scolarité' : 'Modifier l\'Offre'}
              </h3>
              <button onClick={() => setModalMode(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto">
              {formDataList.map((fd, idx) => (
                <div key={idx} className={`space-y-5 ${modalMode === 'CREATE' && formDataList.length > 1 ? 'border-b border-slate-100 pb-6 mb-2' : ''}`}>
                  {modalMode === 'CREATE' && (
                    <div className="flex justify-between items-center">
                      <span className="font-black text-indigo-600 text-xs uppercase">Offre {idx + 1}</span>
                      {formDataList.length > 1 && (
                        <button type="button" onClick={() => setFormDataList(list => list.filter((_, i) => i !== idx))} className="text-rose-500 text-xs font-black hover:text-rose-700">Supprimer</button>
                      )}
                    </div>
                  )}

                  {/* Nom + Image */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom de l'offre <span className="text-rose-600">*</span></label>
                      <input type="text" required value={fd.name} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Ex: Mensualité PS sans cantine" />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Illustration</label>
                      <div>
                        <input type="file" id={`offre_img_${idx}`} hidden onChange={e => handleFileUpload(e, idx)} accept="image/*" />
                        <label htmlFor={`offre_img_${idx}`} className={`block p-4 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${fd.imageUrl ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-indigo-600'}`}>
                          {isUploading ? <Loader2 className="animate-spin mx-auto text-indigo-600" /> : fd.imageUrl ? <img src={fd.imageUrl} className="h-12 mx-auto rounded-lg object-contain" alt="Preview" /> : <div className="py-1"><ImageIcon className="mx-auto text-slate-300" size={22} /><p className="text-[8px] font-black uppercase mt-1 text-slate-500">Ajouter Image</p></div>}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Type d'offre + Tarif */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Type d'offre <span className="text-rose-600">*</span></label>
                      <select value={fd.typeOffre} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, typeOffre: e.target.value as TypeOffre } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer">
                        {TYPES_OFFRE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tarif mensuel ({currency}) <span className="text-rose-600">*</span></label>
                      <input type="number" required min={0} value={fd.price} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, price: Number(e.target.value) } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="90000" />
                    </div>
                  </div>

                  {/* Durée + Frais inscription */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée (mois)</label>
                      <input type="number" min={1} max={12} value={fd.dureeMois} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, dureeMois: Number(e.target.value) } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Frais d'inscription ({currency})</label>
                      <input type="number" min={0} value={fd.fraisInscription} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, fraisInscription: Number(e.target.value) } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="85000" />
                    </div>
                  </div>

                  {/* Niveaux ciblés */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Niveaux scolaires ciblés</label>
                    <div className="flex flex-wrap gap-2">
                      {NIVEAUX_SCOLAIRES.map(n => {
                        const selected = fd.niveauxCibles.includes(n.value);
                        return (
                          <button key={n.value} type="button" onClick={() => toggleNiveau(idx, n.value)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                            {n.label}
                          </button>
                        );
                      })}
                    </div>
                    {fd.niveauxCibles.length === 0 && <p className="text-[9px] text-slate-400 px-1">Aucun niveau sélectionné = applicable à tous.</p>}
                  </div>

                  {/* Cantine incluse */}
                  <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input type="checkbox" id={`cantine_${idx}`} checked={fd.inclutCantine} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, inclutCantine: e.target.checked } : f))} className="w-5 h-5 rounded accent-indigo-600" />
                    <label htmlFor={`cantine_${idx}`} className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><UtensilsCrossed size={14} /> Cantine incluse dans cette offre</label>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</label>
                    <textarea value={fd.description} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, description: e.target.value } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none min-h-[70px]" placeholder="Précisions sur l'offre (inclus, conditions…)" />
                  </div>

                  {/* Actif */}
                  <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input type="checkbox" id={`active_${idx}`} checked={fd.isActive} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, isActive: e.target.checked } : f))} className="w-5 h-5 rounded accent-indigo-600" />
                    <label htmlFor={`active_${idx}`} className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Offre active — disponible à la facturation</label>
                  </div>
                </div>
              ))}

              {modalMode === 'CREATE' && formDataList.length < 5 && (
                <button type="button" onClick={() => setFormDataList(list => [...list, emptyOffre()])} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all">+ Ajouter une offre</button>
              )}

              {error && <p className="text-rose-600 text-xs font-bold px-1">{error}</p>}

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">ANNULER</button>
                <button type="submit" disabled={actionLoading || isUploading} className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${modalMode === 'CREATE' ? 'bg-indigo-600 hover:bg-slate-900' : 'bg-amber-500 hover:bg-amber-600'}`}>
                  {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> {modalMode === 'CREATE' ? 'CRÉER L\'OFFRE' : 'ENREGISTRER'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL VUE DÉTAILLÉE ══ */}
      {modalMode === 'VIEW' && selectedService && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">
            <div className="px-10 py-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-500/30 border border-indigo-400/30 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                  {selectedService.imageUrl ? <img src={selectedService.imageUrl} className="w-full h-full object-cover" alt={selectedService.name} /> : <BookOpen size={26} />}
                </div>
                <div>
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Offre de Scolarité</p>
                  <h3 className="text-xl font-black uppercase tracking-tight">{selectedService.name}</h3>
                  <TypeBadge value={selectedService.typeOffre || selectedService.type_offre || 'MENSUALITE'} />
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all"><X size={22} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Colonne gauche — KPIs */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10"><BookOpen size={80} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-70 mb-1">Tarif mensuel</p>
                    <p className="text-4xl font-black">{Number(selectedService.price).toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{currency}/mois</p>
                  </div>

                  {(Number(selectedService.fraisInscription || selectedService.frais_inscription) > 0) && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Frais d'inscription</p>
                      <p className="text-2xl font-black text-amber-600">{Number(selectedService.fraisInscription || selectedService.frais_inscription).toLocaleString()} {currency}</p>
                    </div>
                  )}

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Caractéristiques</h4>
                    <div className="space-y-2 text-xs font-bold text-slate-700">
                      <div className="flex justify-between"><span className="text-slate-400">Durée</span><span>{selectedService.dureeMois || selectedService.duree_mois || 10} mois</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Cantine incluse</span><span className={(selectedService.inclutCantine || selectedService.inclut_cantine) ? 'text-emerald-600' : 'text-slate-400'}>{(selectedService.inclutCantine || selectedService.inclut_cantine) ? 'Oui' : 'Non'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Statut</span><span className={selectedService.isActive ? 'text-emerald-600' : 'text-rose-600'}>{selectedService.isActive ? 'Actif' : 'Inactif'}</span></div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Niveaux ciblés</h4>
                    <NiveauxBadges niveaux={selectedService.niveauxCibles || selectedService.niveaux_cibles || []} />
                  </div>
                </div>

                {/* Colonne droite — description */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description de l'offre</h4>
                  </div>
                  <div className="flex-1 p-6">
                    {selectedService.description
                      ? <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedService.description}</p>
                      : <div className="py-16 flex flex-col items-center gap-3 text-slate-300"><Info size={32} /><p className="text-[9px] font-black uppercase tracking-widest">Aucune description fournie.</p></div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL SUPPRESSION ══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner"><ShieldAlert size={40} /></div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Supprimer cette offre ?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
              Vous allez supprimer <span className="text-rose-600 font-black">"{showDeleteConfirm.name}"</span>.<br/>Cette action est irréversible.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleConfirmDelete} disabled={actionLoading} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200">
                {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />} OUI, SUPPRIMER
              </button>
              <button onClick={() => setShowDeleteConfirm(null)} className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
