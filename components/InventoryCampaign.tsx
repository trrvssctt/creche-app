
import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Plus, Search, Calendar, ChevronRight, 
  Trash2, Loader2, FileText, CheckCircle2, AlertCircle, RefreshCw, X, ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { apiClient } from '../services/api';
import InventoryCampaignAudit from './InventoryCampaignAudit';
import { useToast } from './ToastProvider';

const InventoryCampaign = ({ settings }: { settings: any }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState(`Inventaire du ${new Date().toLocaleDateString()}`);
  const [actionLoading, setActionLoading] = useState(false);
  const [itemActionLoading, setItemActionLoading] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [query, setQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/stock/campaigns');
      setCampaigns(data || []);
    } catch (e) {
      console.error("Fetch Campaigns error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async () => {
    if (!newCampaignName.trim()) return;
    setActionLoading(true);
    setCreationError(null);
    try {
      const data = await apiClient.post('/stock/campaigns', { name: newCampaignName });
      setCampaigns([data, ...campaigns]);
      setActiveCampaign(data);
      setShowCreateModal(false);
    } catch (e: any) {
      // Affichage du message d'erreur spécifique demandé
      setCreationError(e.message || "Une campagne d'inventaire est déjà en cours. Veuillez la clôturer avant d'en créer une nouvelle.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setCreationError(null);
    setActionLoading(true);
    try {
      const data = await apiClient.get('/stock/campaigns');
      setCampaigns(data || []);
      const draft = data.find((c: any) => c.status === 'DRAFT');
      
      if (draft) {
        showToast("Une campagne d'inventaire est déjà en cours. Veuillez la clôturer avant d'en créer une nouvelle.", 'error');
        return;
      }
      
      setNewCampaignName(`Inventaire du ${new Date().toLocaleDateString()}`);
      setShowCreateModal(true);
    } catch (e) {
      showToast("Impossible de vérifier l'état du Kernel.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = (campaign: any) => {
    setSelectedCampaign(campaign);
    setShowSuspendModal(true);
  };

  const confirmSuspend = async () => {
    if (!selectedCampaign) return;
    setItemActionLoading(selectedCampaign.id);
    try {
      await apiClient.post(`/stock/campaigns/${selectedCampaign.id}/suspend`);
      showToast('Campagne suspendue.', 'success');
      setShowSuspendModal(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (e: any) {
      showToast(e.message || 'Impossible de suspendre la campagne.', 'error');
    } finally {
      setItemActionLoading(null);
    }
  };

  const handleCancel = (campaign: any) => {
    setSelectedCampaign(campaign);
    setShowCancelModal(true);
  };

  const handleResume = async (campaign: any) => {
    if (!campaign) return;
    setItemActionLoading(campaign.id);
    try {
      await apiClient.post(`/stock/campaigns/${campaign.id}/resume`);
      showToast('Campagne relancée.', 'success');
      fetchCampaigns();
    } catch (e: any) {
      showToast(e.message || 'Impossible de relancer la campagne.', 'error');
    } finally {
      setItemActionLoading(null);
    }
  };

  const confirmCancel = async () => {
    if (!selectedCampaign) return;
    setItemActionLoading(selectedCampaign.id);
    try {
      await apiClient.post(`/stock/campaigns/${selectedCampaign.id}/cancel`);
      showToast('Campagne annulée.', 'success');
      setShowCancelModal(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (e: any) {
      showToast(e.message || 'Impossible d\'annuler la campagne.', 'error');
    } finally {
      setItemActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      {activeCampaign ? (
        <InventoryCampaignAudit 
          campaign={activeCampaign} 
          settings={settings} 
          onBack={() => { setActiveCampaign(null); fetchCampaigns(); }} 
          onNewCampaign={handleOpenCreateModal}
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                <ClipboardCheck className="text-indigo-600" size={32} /> Audit Inventaire
              </h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Saisie Physique & Réconciliation</p>
            </div>
            <button 
              onClick={handleOpenCreateModal}
              disabled={actionLoading}
              className={`px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest active:scale-95 ${actionLoading ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
            >
              {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> NOUVELLE CAMPAGNE</>}
            </button>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
            <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              <div className="relative w-full lg:w-1/2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher une campagne par nom ou ID..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div className="flex items-center gap-3">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none">
                  <option value="ALL">Tous statuts</option>
                  <option value="DRAFT">En cours</option>
                  <option value="SUSPENDED">Suspendue</option>
                  <option value="CANCELLED">Annulée</option>
                  <option value="VALIDATED">Archivée</option>
                </select>
                <div className="flex items-center gap-2">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-sm" />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-sm" />
                </div>
                <button onClick={() => { setQuery(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); }} className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black">Réinitialiser</button>
              </div>
            </div>

            {loading && campaigns.length === 0 ? (
              <div className="py-40 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Initialisation des registres...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-40 text-center flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2.5rem] flex items-center justify-center">
                  <ClipboardCheck size={40} />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aucune campagne d'inventaire archivée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                      <th className="px-10 py-6">Campagne</th>
                      <th className="px-10 py-6">Date de création</th>
                      <th className="px-10 py-6 text-center">État</th>
                      <th className="px-10 py-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const q = query.trim().toLowerCase();
                      const visible = campaigns.filter((c) => {
                        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
                        // date filtering
                        if (dateFrom) {
                          const from = new Date(dateFrom);
                          const created = new Date(c.createdAt);
                          if (created < from) return false;
                        }
                        if (dateTo) {
                          const to = new Date(dateTo);
                          // include entire day for dateTo
                          to.setHours(23,59,59,999);
                          const created = new Date(c.createdAt);
                          if (created > to) return false;
                        }
                        if (!q) return true;
                        return (c.name || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q);
                      });
                      return visible.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-10 py-6">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{c.name}</p>
                          <p className="text-[8px] font-mono text-slate-400">ID: {c.id.slice(0,8)}</p>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-slate-300" />
                            <span className="text-xs font-bold text-slate-600">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center">
                          {c.status === 'VALIDATED' && (
                            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">ARCHIVÉ / SCELLÉ</span>
                          )}
                          {c.status === 'DRAFT' && (
                            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">EN COURS</span>
                          )}
                          {c.status === 'SUSPENDED' && (
                            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-yellow-50 text-yellow-700 border-yellow-100">SUSPENDUE</span>
                          )}
                          {c.status === 'CANCELLED' && (
                            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-rose-50 text-rose-600 border-rose-100">ANNULÉE</span>
                          )}
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {c.status === 'VALIDATED' ? (
                              <button 
                                onClick={() => setActiveCampaign(c)}
                                className="px-6 py-2.5 bg-white border border-slate-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                              >
                                <FileText size={14}/> VOIR RAPPORT
                              </button>
                            ) : c.status === 'DRAFT' ? (
                              <button 
                                onClick={() => setActiveCampaign(c)}
                                className="px-6 py-2.5 bg-white border border-slate-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                              >
                                <ChevronRight size={14}/> REPRENDRE LA SAISIE
                              </button>
                            ) : null}

                            {c.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={() => handleSuspend(c)}
                                  disabled={itemActionLoading === c.id}
                                  className="px-3 py-2 bg-white border border-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                  title="Suspendre"
                                >
                                  {itemActionLoading === c.id ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14} />}
                                </button>
                                <button
                                  onClick={() => handleCancel(c)}
                                  disabled={itemActionLoading === c.id}
                                  className="px-3 py-2 bg-white border border-slate-100 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                  title="Annuler"
                                >
                                  {itemActionLoading === c.id ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14} />}
                                </button>
                              </>
                            )}

                            {c.status === 'SUSPENDED' && (
                              <>
                                <button
                                  onClick={() => handleResume(c)}
                                  disabled={itemActionLoading === c.id}
                                  className="px-3 py-2 bg-white border border-slate-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                                  title="Relancer"
                                >
                                  {itemActionLoading === c.id ? <Loader2 className="animate-spin" size={14}/> : <ArrowRight size={14} />}
                                </button>
                                <button
                                  onClick={() => handleCancel(c)}
                                  disabled={itemActionLoading === c.id}
                                  className="px-3 py-2 bg-white border border-slate-100 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                  title="Annuler"
                                >
                                  {itemActionLoading === c.id ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14} />}
                                </button>
                              </>
                            )}

                            {c.status === 'CANCELLED' && (
                              <div className="text-xs font-black text-rose-500 uppercase">Aucune action</div>
                            )}
                          </div>
                        </td>
                      </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3"><ClipboardCheck size={24}/><h3 className="text-lg font-black uppercase">Initialisation Audit</h3></div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
            </div>
            <div className="p-10 space-y-6">
              {creationError && (
                <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 flex items-start gap-4 animate-in shake">
                  <ShieldAlert size={24} className="shrink-0" />
                  <p className="text-[10px] font-black uppercase leading-relaxed">
                    {creationError}
                  </p>
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2 block">Désignation de la campagne</label>
                <input 
                  type="text" 
                  value={newCampaignName} 
                  onChange={e => setNewCampaignName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" 
                />
              </div>
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <p className="text-[9px] font-bold text-indigo-700 uppercase leading-relaxed">Cette opération fige les quantités théoriques actuelles pour permettre une comparaison fidèle avec vos stocks physiques.</p>
              </div>
              <button 
                onClick={handleCreate}
                disabled={actionLoading}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${actionLoading ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-slate-900'}`}
              >
                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> DÉMARRER LA CAMPAGNE</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSuspendModal && selectedCampaign && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600"><RefreshCw size={24} /></div>
              <div>
                <h3 className="text-lg font-black uppercase">Suspendre la campagne</h3>
                <p className="text-sm text-slate-500 mt-1">Mettez la campagne en pause pour reprendre la saisie ultérieurement.</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[12px] font-bold text-slate-700">Confirmez la suspension de :</p>
                <p className="mt-2 text-sm font-black text-slate-900 uppercase tracking-tight">{selectedCampaign.name}</p>
                <p className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedCampaign.id?.slice(0,8)}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowSuspendModal(false); setSelectedCampaign(null); }} className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black uppercase text-xs">Annuler</button>
                <button onClick={confirmSuspend} disabled={itemActionLoading === selectedCampaign.id} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase ${itemActionLoading === selectedCampaign.id ? 'bg-slate-100 text-slate-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
                  {itemActionLoading === selectedCampaign.id ? <Loader2 className="animate-spin" size={16}/> : 'Suspendre la campagne'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && selectedCampaign && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-rose-50 border-b border-rose-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600"><Trash2 size={24} /></div>
              <div>
                <h3 className="text-lg font-black uppercase">Annuler la campagne</h3>
                <p className="text-sm text-slate-500 mt-1">Cette action est irréversible et supprimera l'état actif de la campagne.</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[12px] font-bold text-slate-700">Confirmez l'annulation de :</p>
                <p className="mt-2 text-sm font-black text-slate-900 uppercase tracking-tight">{selectedCampaign.name}</p>
                <p className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedCampaign.id?.slice(0,8)}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowCancelModal(false); setSelectedCampaign(null); }} className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black uppercase text-xs">Retour</button>
                <button onClick={confirmCancel} disabled={itemActionLoading === selectedCampaign.id} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase ${itemActionLoading === selectedCampaign.id ? 'bg-slate-100 text-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                  {itemActionLoading === selectedCampaign.id ? <Loader2 className="animate-spin" size={16}/> : 'Annuler définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCampaign;
