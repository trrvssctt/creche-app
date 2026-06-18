import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, CheckCircle2, Loader2, Printer, Download,
  Search, Package, RefreshCw, FileText, Plus,
  AlertTriangle, ArrowRight, ShieldCheck, History,
  X, Info, Database, Zap, Trash2
} from 'lucide-react';
import { apiClient } from '../services/api';
import InventoryAuditReport from './InventoryAuditReport';
import { useToast } from './ToastProvider';
import { buildExportHandlers, exportToImage, ExportColumn } from '../services/exportUtils';

interface Props {
  campaign: any;
  settings: any;
  onBack: () => void;
  onNewCampaign: () => void;
}

const InventoryCampaignAudit: React.FC<Props> = ({ campaign, settings, onBack, onNewCampaign }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [shouldSyncStock, setShouldSyncStock] = useState(true);
  const [dirtyCounts, setDirtyCounts] = useState<Record<string, string>>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const saveIntervalRef = useRef<number | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const showToast = useToast();

  // Colonnes pour export CSV/Excel/PDF du rapport d'audit
  const auditExportColumns: ExportColumn[] = [
    { key: 'stock_item', label: 'Article', format: (_v, row) => row.stock_item?.name || '' },
    { key: 'stock_item', label: 'SKU', format: (_v, row) => row.stock_item?.sku || '' },
    { key: 'systemQty', label: 'Qté Système', format: (v) => Number(v || 0) },
    { key: 'countedQty', label: 'Qté Comptée', format: (v) => Number(v || 0) },
    { key: 'countedQty', label: 'Écart', format: (_v, row) => Number(row.countedQty || 0) - Number(row.systemQty || 0) },
    {
      key: 'countedQty', label: 'Constat',
      format: (_v, row) => {
        const diff = Math.abs((Number(row.countedQty || 0) - Number(row.systemQty || 0)));
        const pct = Number(row.systemQty) > 0 ? (diff / Number(row.systemQty)) * 100 : 0;
        if (Number(row.countedQty) === Number(row.systemQty)) return 'Normal';
        if (pct <= 5) return 'Cohérent';
        return 'Incohérent';
      }
    },
  ];

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/stock/campaigns/${campaign.id}`);
      // restore any locally saved counted quantities so user can resume where they left off
      const lsKey = `inventory_campaign_${campaign.id}_counts`;
      let saved: Record<string, string> = {};
      try { saved = JSON.parse(localStorage.getItem(lsKey) || '{}'); } catch (e) { saved = {}; }
      const items = (data.items || []).map((i: any) => ({
        ...i,
        // for a new draft campaign we want inputs empty; otherwise use server value; prefer locally saved value if present
        countedQty: saved[i.id] !== undefined ? saved[i.id] : (campaign.status === 'DRAFT' ? '' : (i.countedQty ?? 0))
      }));
      setItems(items);
      // initialize dirty map from saved local values so subsequent edits merge rather than overwrite
      setDirtyCounts(saved || {});
    } catch (e) {
      console.error("Fetch Campaign Items error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [campaign.id]);

  // periodic autosave interval
  useEffect(() => {
    if (saveIntervalRef.current) window.clearInterval(saveIntervalRef.current);
    saveIntervalRef.current = window.setInterval(() => {
      batchSave();
    }, 10000);
    const onUnload = () => { batchSave(); };
    window.addEventListener('beforeunload', onUnload);
    const onVisibility = () => { if (document.visibilityState === 'hidden') batchSave(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (saveIntervalRef.current) window.clearInterval(saveIntervalRef.current);
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // Update local state and mark item as dirty; actual server sync is batched
  const persistToLocal = (map: Record<string, string>) => {
    const lsKey = `inventory_campaign_${campaign.id}_counts`;
    try { localStorage.setItem(lsKey, JSON.stringify(map)); } catch (e) { /* ignore */ }
  };

  const handleUpdateQty = (itemId: string, val: string) => {
    // keep the raw string so empty value is preserved for UI
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, countedQty: val } : i));
    setDirtyCounts(prev => {
      const next = { ...prev, [itemId]: val };
      persistToLocal(next);
      return next;
    });
  };

  // Batch-save dirty items to server in chunks
  const batchSave = async () => {
    const entries = Object.entries(dirtyCounts);
    if (entries.length === 0) return;
    setIsAutoSaving(true);
    const chunkSize = 50;
    try {
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async ([itemId, val]) => {
          const parsed = parseInt(String(val));
          const body: any = { countedQty: Number.isNaN(parsed) ? null : parsed };
          try {
            await apiClient.put(`/stock/campaigns/${campaign.id}/items/${itemId}`, body);
            // on success, remove from dirty map
            setDirtyCounts(prev => {
              const copy = { ...prev };
              delete copy[itemId];
              persistToLocal(copy);
              return copy;
            });
          } catch (e) {
            console.error('Batch save error', e);
          }
        }));
      }
    } finally {
      setIsAutoSaving(false);
    }
  };

  const finalizeClosure = async () => {
    // double-check that all fields are filled before finalizing
    const stillMissing = items.some(i => {
      const v = i.countedQty;
      return v === '' || v === null || v === undefined || Number.isNaN(parseInt(String(v)));
    });
    if (stillMissing) { showToast('Impossible de clôturer : toutes les quantités ne sont pas remplies.', 'error'); return; }

    setIsValidating(true);
    try {
      await batchSave();
      await apiClient.post(`/stock/campaigns/${campaign.id}/validate`, { syncStock: shouldSyncStock });
      campaign.status = 'VALIDATED';
      // clear local saved counts on successful validation
      try { localStorage.removeItem(`inventory_campaign_${campaign.id}_counts`); } catch (e) { /* ignore */ }
      setShowValidationModal(false);
      setShowReport(true);
    } catch (e: any) {
      showToast(e.message || "Erreur lors de la clôture.", 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const filteredItems = items.filter(i => 
    (i.stock_item?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.stock_item?.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  const isLocked = campaign.status === 'VALIDATED';

  // Ensure all lines have a counted quantity (non-empty and numeric) before allowing closure
  const allCounted = items.length > 0 && items.every(i => {
    const v = i.countedQty;
    if (v === '' || v === null || v === undefined) return false;
    const n = parseInt(String(v));
    return !Number.isNaN(n);
  });

  if (showReport || isLocked) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
           <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-inner"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{campaign.name}</h2>
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                <ShieldCheck size={12}/> AUDIT SCELLÉ & ARCHIVÉ
              </p>
            </div>
          </div>
          <div className="flex gap-4">
             <button 
                onClick={onNewCampaign}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
              >
                <Plus size={18} /> NOUVELLE CAMPAGNE
              </button>
              {/* MENU EXPORT RAPPORT AUDIT */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-6 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-sm hover:bg-slate-50"
                >
                  <Download size={18}/> Exporter
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 w-52 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {(() => {
                      const fname = `audit-${(campaign?.name || campaign?.id || 'rapport').replace(/\s+/g, '-').toLowerCase()}`;
                      const exportInfo = buildExportHandlers({
                        data: items,
                        columns: auditExportColumns,
                        options: {
                          filename: fname,
                          sheetName: 'Audit',
                          title: `Rapport d'Audit — ${campaign?.name || ''}`,
                          companyInfo: {
                            name: settings?.name,
                            address: settings?.address,
                            phone: settings?.phone,
                            email: settings?.email,
                          }
                        },
                        tableElementId: 'document-render',
                        showToast,
                      });
                      const menuItems = [
                        { label: 'CSV (.csv)', action: exportInfo.csv, icon: '📄' },
                        { label: 'Excel (.xlsx)', action: exportInfo.excel, icon: '📊' },
                        { label: 'PDF (impression)', action: exportInfo.pdf, icon: '🖨️' },
                        {
                          label: 'Image PNG',
                          action: () => exportToImage('document-render', fname, 'png')
                            .then(() => showToast('Export PNG réussi', 'success'))
                            .catch((e: any) => showToast(e.message || 'Erreur image', 'error')),
                          icon: '🖼️'
                        },
                        {
                          label: 'Image JPG',
                          action: () => exportToImage('document-render', fname, 'jpg')
                            .then(() => showToast('Export JPG réussi', 'success'))
                            .catch((e: any) => showToast(e.message || 'Erreur image', 'error')),
                          icon: '📷'
                        },
                      ];
                      return menuItems.map(({ label, action, icon }) => (
                        <button
                          key={label}
                          onClick={() => { action(); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                        >
                          <span>{icon}</span> {label}
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
          </div>
        </div>
        
        <div id="document-render" className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm p-10">
          <InventoryAuditReport items={items} settings={settings} campaign={campaign} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-inner"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{campaign.name}</h2>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic">
              INVENTAIRE À L'AVEUGLE : SAISIE PHYSIQUE UNIQUEMENT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {campaign.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setShowSuspendModal(true)}
                className="px-6 py-3 bg-white border border-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50"
              >
                {isActing ? <Loader2 className="animate-spin"/> : <RefreshCw size={16} />} SUSPENDRE
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white"
              >
                {isActing ? <Loader2 className="animate-spin"/> : <Trash2 size={16} />} ANNULER
              </button>
            </>
          )}

          {campaign.status === 'SUSPENDED' && (
            <>
              <button
                onClick={async () => {
                  setIsActing(true);
                  try {
                    await apiClient.post(`/stock/campaigns/${campaign.id}/resume`);
                    showToast('Campagne relancée.', 'success');
                    campaign.status = 'DRAFT';
                    fetchItems();
                  } catch (err: any) {
                    showToast(err?.message || 'Impossible de relancer la campagne.', 'error');
                  } finally { setIsActing(false); }
                }}
                className="px-6 py-3 bg-white border border-indigo-100 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white"
              >
                {isActing ? <Loader2 className="animate-spin"/> : <ArrowRight size={16} />} RELANCER
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white"
              >
                {isActing ? <Loader2 className="animate-spin"/> : <Trash2 size={16} />} ANNULER
              </button>
            </>
          )}

          {/* Suspend/Cancel modals */}
          {showSuspendModal && (
            <div className="fixed inset-0 z-[1150] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
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
                    <p className="mt-2 text-sm font-black text-slate-900 uppercase tracking-tight">{campaign.name}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">ID: {campaign.id?.slice(0,8)}</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setShowSuspendModal(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black uppercase text-xs">Annuler</button>
                    <button onClick={async () => {
                      setIsActing(true);
                      try {
                        await apiClient.post(`/stock/campaigns/${campaign.id}/suspend`);
                        showToast('Campagne suspendue.', 'success');
                        setShowSuspendModal(false);
                        onBack();
                      } catch (err: any) {
                        showToast(err?.message || 'Impossible de suspendre la campagne.', 'error');
                      } finally { setIsActing(false); }
                    }} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-amber-600 text-white hover:bg-amber-700`}>{isActing ? <Loader2 className="animate-spin"/> : 'Suspendre la campagne'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCancelModal && (
            <div className="fixed inset-0 z-[1150] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
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
                    <p className="mt-2 text-sm font-black text-slate-900 uppercase tracking-tight">{campaign.name}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">ID: {campaign.id?.slice(0,8)}</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setShowCancelModal(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black uppercase text-xs">Retour</button>
                    <button onClick={async () => {
                      setIsActing(true);
                      try {
                        await apiClient.post(`/stock/campaigns/${campaign.id}/cancel`);
                        showToast('Campagne annulée.', 'success');
                        setShowCancelModal(false);
                        onBack();
                      } catch (err: any) {
                        showToast(err?.message || 'Impossible d\'annuler la campagne.', 'error');
                      } finally { setIsActing(false); }
                    }} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-rose-600 text-white hover:bg-rose-700`}>{isActing ? <Loader2 className="animate-spin"/> : 'Annuler définitivement'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {campaign.status === 'CANCELLED' && (
            <div className="px-6 py-3 text-rose-600 font-black uppercase text-xs">Campagne annulée — aucune action possible</div>
          )}

          <button
            onClick={() => {
              if (!allCounted) {
                alert('Veuillez saisir toutes les quantités avant de clôturer l\'audit.');
                return;
              }
              setShowValidationModal(true);
            }}
              disabled={!allCounted || campaign.status !== 'DRAFT'}
              className={`px-10 py-5 rounded-[1.5rem] font-black transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest active:scale-95 ${allCounted && campaign.status === 'DRAFT' ? 'bg-indigo-600 text-white hover:bg-slate-900' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <CheckCircle2 size={18} /> CLÔTURER L'AUDIT
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher un article à compter..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-[1.5rem] pl-16 pr-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" 
          />
        </div>
        <div className="flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-[10px] font-black uppercase">
          <RefreshCw size={14} className={isAutoSaving ? 'animate-spin' : ''} /> SAUVEGARDE AUTO
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/80 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b">
              <th className="px-10 py-6">Désignation de l'Article</th>
              <th className="px-10 py-6 text-center">Quantité Physique Comptée</th>
              <th className="px-10 py-6 text-right">Statut Saisie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" /></td></tr>
            ) : filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/30 transition-all group">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors"><Package size={24}/></div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.stock_item?.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 font-bold uppercase">SKU: {item.stock_item?.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6 text-center">
                  <div className="relative inline-block w-40">
                    <input 
                      type="number" 
                      min="0"
                      value={item.countedQty} 
                      onChange={e => handleUpdateQty(item.id, e.target.value)}
                      className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-center text-xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${isSaving === item.id ? 'opacity-50' : ''}`} 
                    />
                    {isSaving === item.id && (
                      <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-indigo-600"><Loader2 className="animate-spin" size={14}/></div>
                    )}
                  </div>
                </td>
                <td className="px-10 py-6 text-right">
                  {item.countedQty > 0 ? (
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 justify-end">
                       <CheckCircle2 size={12}/> COMPTÉ
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 justify-end">
                       À COMPTER
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE VALIDATION AVANT CLÔTURE AVEC DEMANDE DE SYNCHRONISATION */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
             <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="text-amber-400" size={28}/>
                  <h3 className="text-xl font-black uppercase tracking-tight">Clôture & Réconciliation</h3>
                </div>
                <button onClick={() => setShowValidationModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} className="text-white"/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-4">
                   <Info size={24} className="text-amber-600 shrink-0" />
                   <p className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed">
                     Voici les écarts détectés entre votre comptage physique et le stock théorique du système. 
                     Veuillez choisir si vous souhaitez synchroniser les stocks réels.
                   </p>
                </div>

                <InventoryAuditReport items={items} settings={settings} campaign={campaign} />

                {/* Question de réconciliation */}
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 shadow-2xl border border-white/10">
                   <div className="flex items-start gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${shouldSyncStock ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                         {shouldSyncStock ? <RefreshCw className="animate-spin-slow" size={24}/> : <Database size={24}/>}
                      </div>
                      <div className="flex-1">
                         <h4 className="text-lg font-black uppercase tracking-tight">Réajustement Logistique Automatique</h4>
                         <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1 uppercase tracking-widest">
                           Souhaitez-vous aligner les quantités du catalogue sur vos saisies physiques ?
                         </p>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                         <button 
                           onClick={() => setShouldSyncStock(true)}
                           className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${shouldSyncStock ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                         >
                           OUI (SYNCHRO)
                         </button>
                         <button 
                           onClick={() => setShouldSyncStock(false)}
                           className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${!shouldSyncStock ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                         >
                           NON (ARCHIVE)
                         </button>
                      </div>
                   </div>
                   
                   {shouldSyncStock && (
                     <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
                        <Zap size={20} className="text-indigo-400" />
                        <p className="text-[9px] font-bold text-indigo-300 uppercase leading-relaxed">
                          Chaque écart générera une écriture de type "ADJUSTMENT" dans votre registre de mouvements flux pour une traçabilité totale.
                        </p>
                     </div>
                   )}
                </div>
             </div>

             <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                <button 
                  onClick={() => setShowValidationModal(false)}
                  className="flex-1 py-5 border-2 border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
                >
                  ANNULER / REPRENDRE
                </button>
                <button 
                  onClick={finalizeClosure}
                  disabled={isValidating}
                  className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${shouldSyncStock ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}
                >
                  {isValidating ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18}/> {shouldSyncStock ? "VALIDER & RÉAJUSTER LES STOCKS" : "VALIDER & ARCHIVER SANS MODIF"}</>}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCampaignAudit;