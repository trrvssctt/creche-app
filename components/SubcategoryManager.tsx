import React, { useState, useEffect } from 'react';
import { 
  GitMerge, Plus, Search, Edit3, Trash2, X, 
  Save, AlertCircle, RefreshCw, Layers, Eye, Package,
  ChevronRight, LayoutGrid, Info, FolderTree, ArrowRight, Lock,
  ShieldAlert, CheckCircle2
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { StockItem } from '../types';
import { useToast } from './ToastProvider';

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  categoryId: string;
  tenantId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const SubcategoryManager: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // View mode, pagination and filters (similar to CategoryManager)
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [pageSize, setPageSize] = useState<number>(6);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', linked: 'ALL' });
  const [showModal, setShowModal] = useState<'CREATE' | 'EDIT' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Subcategory | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<Subcategory | null>(null);
  const [showDetailsSub, setShowDetailsSub] = useState<Subcategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    categoryId: '' 
  });

  const currentUser = authBridge.getSession()?.user;
  const canModify = currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'subcategories') : false;
  const showToast = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subData, catData, stockData] = await Promise.all([
        apiClient.get('/subcategories'),
        apiClient.get('/categories'),
        apiClient.get('/stock')
      ]);
      setSubcategories(subData.map((s: any) => ({ ...s, categoryId: s.category_id || s.categoryId })));
      setCategories(catData || []);
      setStocks(stockData || []);
    } catch (err: any) { 
      setError("Erreur de liaison avec le Kernel.");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Vérifie si une sous-catégorie a des produits liés
  const hasLinkedProducts = (subId: string) => {
    return stocks.some(s => s.subcategoryId === subId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) return;
    
    setActionLoading(true);
    setError(null);

    try {
      if (showModal === 'CREATE') {
        const data = await apiClient.post('/subcategories', formData);
        setSubcategories([{...data, categoryId: data.category_id}, ...subcategories]);
      } else if (showModal === 'EDIT' && selectedSub) {
        const data = await apiClient.put(`/subcategories/${selectedSub.id}`, formData);
        setSubcategories(prev => prev.map(s => s.id === data.id ? {...data, categoryId: data.category_id} : s));
      }
      setShowModal(null);
      setFormData({ name: '', description: '', categoryId: categories[0]?.id || '' });
      setSelectedSub(null);
    } catch (err: any) {
      setError(err.message || "L'opération a été rejetée par le Kernel.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm || !canModify) return;
    
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/subcategories/${showDeleteConfirm.id}`);
      setSubcategories(subcategories.filter(s => s.id !== showDeleteConfirm.id));
      const deletedName = showDeleteConfirm.name;
      setShowDeleteConfirm(null);
      setShowSuccessMessage(`La sous-catégorie "${deletedName}" a été supprimée avec succès.`);
      setTimeout(() => setShowSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression.");
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (sub: Subcategory) => {
    if (hasLinkedProducts(sub.id)) {
      showToast("Modification bloquée : Cette sous-catégorie contient des produits actifs.", 'error');
      return;
    }
    setSelectedSub(sub);
    setFormData({ name: sub.name, description: sub.description || '', categoryId: sub.categoryId });
    setError(null);
    setShowModal('EDIT');
  };

  const getParentCategoryName = (catId: string) => {
    return categories.find(c => c.id === catId)?.name || 'Segment Parent';
  };

  const filteredSubcategories = subcategories.filter(s => {
    const q = filters.search || '';
    const matchesSearch = s.name.toLowerCase().includes(q.toLowerCase()) || (s.description || '').toLowerCase().includes(q.toLowerCase());

    const created = s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '';
    const matchesFrom = filters.dateFrom === '' || (created && created >= filters.dateFrom);
    const matchesTo = filters.dateTo === '' || (created && created <= filters.dateTo);

    const linkedFlag = hasLinkedProducts(s.id);
    const matchesLinked = filters.linked === 'ALL' || (filters.linked === 'LINKED' && linkedFlag) || (filters.linked === 'UNLINKED' && !linkedFlag);

    return matchesSearch && matchesFrom && matchesTo && matchesLinked;
  });

  const visibleSubcategories = viewMode === 'CARD' ? filteredSubcategories.slice(0, pageSize) : filteredSubcategories;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <GitMerge className="text-indigo-600 rotate-90" size={32} />
            Arborescence Catalogue
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
             {canModify ? 'Gestion des Sous-Segments' : 'Liste Consultative (Lecture Seule)'}
          </p>
        </div>
        {canModify ? (
          <button
            onClick={() => {
              setFormData({ name: '', description: '', categoryId: categories[0]?.id || '' });
              setError(null);
              setShowModal('CREATE');
            }}
            disabled={categories.length === 0}
            className={`px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest ${categories.length === 0 ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
          >
            <Plus size={18} /> CRÉER UN SOUS-SEGMENT
          </button>
        ) : (
          <div className="flex items-center gap-3 px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest">
            <Lock size={14} /> Mode Lecture Seule
          </div>
        )}
      </div>

      {showSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
           <CheckCircle2 size={24} /> {showSuccessMessage}
        </div>
      )}

      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un sous-segment..." 
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner" 
          />
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setViewMode('CARD')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'CARD' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}
          >
            Carte
          </button>
          <button
            onClick={() => setViewMode('LIST')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'LIST' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}
          >
            Liste
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            FILTRES
          </button>
        </div>

        <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3 animate-in shake">
          <AlertCircle size={16}/> {error}
        </div>
      )}

      {/* Filtres avancés */}
      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Recherche</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="Nom ou description..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Du)</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters({...filters, dateFrom: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Au)</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters({...filters, dateTo: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Liés</label>
            <select
              value={filters.linked}
              onChange={e => setFilters({...filters, linked: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="ALL">Tous</option>
              <option value="LINKED">Avec produits</option>
              <option value="UNLINKED">Sans produits</option>
            </select>
          </div>

          <div className="md:col-span-3 flex gap-2 pt-2">
            <button
              onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', linked: 'ALL' })}
              className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all w-full"
            >
              RÉINITIALISER LES FILTRES
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calcul de la structure...</p>
        </div>
      ) : filteredSubcategories.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center">
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucune sous-catégorie trouvée</p>
        </div>
      ) : (
        <>
          {viewMode === 'CARD' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleSubcategories.map(sub => {
                  const isLinked = hasLinkedProducts(sub.id);
                  return (
                    <div key={sub.id} className={`bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full border-b-4 border-b-transparent hover:border-b-indigo-500 ${isLinked ? 'grayscale-[0.5]' : ''}`}>
                       <div className="flex justify-between items-start mb-6 shrink-0">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                              {getParentCategoryName(sub.categoryId)}
                            </span>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate max-w-[200px]">{sub.name}</h3>
                          </div>
                          {canModify && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setShowDetailsSub(sub)}
                                title="Détails"
                                className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={() => openEdit(sub)} 
                                title={isLinked ? "Modification bloquée" : "Modifier"}
                                className={`p-2 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
                              >
                                <Edit3 size={18}/>
                              </button>
                              
                              <button 
                                onClick={() => !isLinked && setShowDeleteConfirm(sub)} 
                                title={isLinked ? "Suppression bloquée" : "Supprimer"}
                                className={`p-2 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                              >
                                <Trash2 size={18}/>
                              </button>
                            </div>
                          )}
                       </div>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6 flex-1 line-clamp-3">{sub.description || 'Spécialisation métier du catalogue.'}</p>
                       
                       {isLinked && (
                         <div className="mb-4 flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl w-fit">
                            <Info size={12} className="text-slate-400" />
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Articles liés en stock</span>
                         </div>
                       )}

                       <div className="pt-6 border-t border-slate-50 flex justify-between items-center shrink-0">
                          <span className="text-[8px] font-mono text-slate-300 font-bold uppercase tracking-widest">ID:{sub.id.slice(0,8)}</span>
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner group-hover:scale-110 transition-transform"><FolderTree size={16}/></div>
                       </div>
                    </div>
                  );
                })}
              </div>

              {filteredSubcategories.length > visibleSubcategories.length && (
                <div className="flex justify-center mt-6">
                  <button onClick={() => setPageSize(prev => prev + 6)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest">VOIR PLUS</button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                    <th className="px-6 py-4">Nom</th>
                    <th className="px-6 py-4">Segment Parent</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-center">Liés</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSubcategories.map(sub => {
                    const isLinked = hasLinkedProducts(sub.id);
                    return (
                      <tr key={sub.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-black text-slate-900">{sub.name}</td>
                        <td className="px-6 py-4 text-slate-600">{getParentCategoryName(sub.categoryId)}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{sub.description}</td>
                        <td className="px-6 py-4 text-center text-[11px] font-black">{isLinked ? 'Oui' : 'Non'}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          {canModify && (
                            <>
                             <button onClick={() => setShowDetailsSub(sub)} className="px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                <Eye size={16} />
                              </button>
                              <button onClick={() => openEdit(sub)} className={`px-3 py-2 rounded-xl ${isLinked ? 'bg-slate-50 text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}>
                                <Edit3 size={16} />
                              </button>
                             
                              <button onClick={() => !isLinked && setShowDeleteConfirm(sub)} className={`px-3 py-2 rounded-xl ${isLinked ? 'bg-slate-50 text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}>
                                <Trash2 size={16} />
                              </button>
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
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full mx-4 md:mx-auto max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
             <div className={`px-10 py-8 text-white flex justify-between items-center ${showModal === 'CREATE' ? 'bg-slate-900' : 'bg-amber-500'}`}>
                <h3 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  {showModal === 'CREATE' ? <Plus size={24}/> : <Edit3 size={24}/>}
                  {showModal === 'CREATE' ? 'Nouveau Sous-Segment' : 'Révision Sous-Segment'}
                </h3>
                <button onClick={() => setShowModal(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
             </div>
             <form onSubmit={handleSubmit} className="p-5 md:p-10 space-y-8">
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Segment Parent <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={formData.categoryId}
                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Désignation <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner" 
                        placeholder="Ex: Périphériques, Services Cloud..."
                      />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Description / Note technique</label>
                      <textarea 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[120px] shadow-inner"
                        placeholder="Précisez le périmètre de ce sous-segment..."
                      ></textarea>
                   </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                    <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-rose-700 leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(null); setError(null); }}
                    className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    ANNULER
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${showModal === 'CREATE' ? 'bg-indigo-600 hover:bg-slate-900' : 'bg-amber-600 hover:bg-amber-700'}`}
                  >
                    {actionLoading ? <RefreshCw className="animate-spin" size={18} /> : (
                      <>{showModal === 'CREATE' ? 'SCELLER LE SOUS-SEGMENT' : 'ENREGISTRER'} <ArrowRight size={18}/></>
                    )}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full mx-4 md:mx-auto max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-5 md:p-10 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la suppression ?</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
                Êtes-vous sûr de vouloir supprimer la sous-catégorie <span className="text-rose-600 font-black">"{showDeleteConfirm.name}"</span> ?<br/>
                Elle sera marquée comme "supprimer" dans le registre AlwaysData.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmDelete} 
                  disabled={actionLoading}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  OUI, SUPPRIMER LE SOUS-SEGMENT
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

      {/* DETAILS MODAL */}
      {showDetailsSub && (() => {
        const linkedProducts = stocks.filter(s => (s.subcategoryId || (s as any).subcategory_id) === showDetailsSub.id);
        const parentCatName = getParentCategoryName(showDetailsSub.categoryId);
        return (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 md:p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full mx-auto max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">

              {/* Header */}
              <div className="px-6 md:px-10 py-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-500/30 border border-indigo-400/30 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <FolderTree size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full uppercase tracking-widest">{parentCatName}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">{showDetailsSub.name}</h3>
                    <p className="text-[9px] text-indigo-300/70 font-mono mt-1 uppercase tracking-widest">REF: {showDetailsSub.id.slice(0,8)}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsSub(null)} className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all shrink-0"><X size={22}/></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/60 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* Left column */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Stat card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 opacity-10"><Package size={80}/></div>
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-70 mb-3">Produits en stock</p>
                      <p className="text-4xl font-black">{linkedProducts.length}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">
                        {linkedProducts.length === 0 ? 'Aucun article' : linkedProducts.length === 1 ? 'article référencé' : 'articles référencés'}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Description</h4>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        {showDetailsSub.description || <span className="text-slate-300 italic">Aucune description renseignée.</span>}
                      </p>
                    </div>

                    {/* Parent + status */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Catégorie parente</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-7 h-7 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center"><Layers size={14}/></div>
                          <p className="text-sm font-black text-slate-800">{parentCatName}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-50 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${linkedProducts.length > 0 ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {linkedProducts.length > 0 ? <Lock size={16}/> : <CheckCircle2 size={16}/>}
                        </div>
                        <p className="text-[9px] font-black text-slate-700 uppercase leading-relaxed">
                          {linkedProducts.length > 0 ? 'Lié — suppression verrouillée' : 'Libre — supprimable'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right column — product list */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Package size={14} className="text-indigo-400"/> Produits rattachés
                      </h4>
                      <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">{linkedProducts.length} article{linkedProducts.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[220px]">
                      {linkedProducts.length === 0 ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-300">
                          <Package size={32}/>
                          <p className="text-[9px] font-black uppercase tracking-widest">Aucun produit lié</p>
                        </div>
                      ) : (
                        linkedProducts.map(prod => {
                          const isLowStock = prod.currentLevel <= prod.minThreshold;
                          return (
                            <div key={prod.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isLowStock ? 'border-rose-100 bg-rose-50/40' : 'border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20'}`}>
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                {(prod as any).imageUrl ? <img src={(prod as any).imageUrl} className="w-full h-full object-cover" alt="" /> : <Package size={18} className="text-slate-400"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-800 text-sm truncate">{prod.name}</p>
                                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{(prod as any).sku || '—'}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-black ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>{prod.currentLevel ?? 0}</p>
                                <p className="text-[8px] text-slate-400 uppercase font-bold">{isLowStock ? 'Alerte stock' : 'En stock'}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SubcategoryManager;