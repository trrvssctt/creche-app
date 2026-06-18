import React, { useState, useEffect, useCallback } from 'react';
import { User, Delivery, Supplier, StockItem } from '../types';
import { apiClient } from '../services/api';
import { UserRole } from '../types';
import {
  Plus, Search, Eye, X, Truck, Package, CheckCircle2, AlertCircle,
  Loader2, Calendar, Hash, ClipboardList, Ban, RefreshCw,
  ShieldAlert, TrendingUp, Clock
} from 'lucide-react';

interface DeliveriesProps {
  user: User;
  currency: string;
}

const ITEMS_PER_PAGE = 8;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'En attente',  cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  RECEIVED:  { label: 'Reçue',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  PARTIAL:   { label: 'Partielle',   cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  CANCELLED: { label: 'Annulée',     cls: 'bg-rose-50 text-rose-700 border-rose-100' }
};

const emptyForm = {
  supplierId: '',
  deliveryDate: new Date().toISOString().slice(0, 10),
  purchaseOrderRef: '',
  notes: '',
  status: 'PENDING' as const,
  items: [] as { stockItemId: string; quantityReceived: number; purchasePrice: number }[]
};

const initialsFor = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

const Deliveries: React.FC<DeliveriesProps> = ({ user, currency }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'validate' | 'cancel'; delivery: Delivery } | null>(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const roles = Array.isArray((user as any).roles) ? (user as any).roles : [user.role];
  const canModify = roles.some((r: UserRole) => [UserRole.ADMIN, UserRole.STOCK_MANAGER].includes(r));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSupplier) params.set('supplierId', filterSupplier);
      const data = await apiClient.get(`/deliveries?${params.toString()}`);
      setDeliveries(Array.isArray(data) ? data : []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSupplier]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiClient.get('/suppliers').then((d: any) => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
    apiClient.get('/stock').then((d: any) => setStockItems(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const notify = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const filtered = deliveries.filter(d =>
    d.reference.toLowerCase().includes(search.toLowerCase()) ||
    (d.supplier as any)?.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const kpiPending = deliveries.filter(d => d.status === 'PENDING').length;
  const kpiReceived = deliveries.filter(d => d.status === 'RECEIVED').length;
  const kpiTotalHt = deliveries.reduce((s, d) => s + parseFloat(String(d.totalHt || 0)), 0);

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { stockItemId: '', quantityReceived: 1, purchasePrice: 0 }]
  }));

  const removeItem = (idx: number) => setForm(f => ({
    ...f,
    items: f.items.filter((_, i) => i !== idx)
  }));

  const updateItem = (idx: number, field: string, value: any) => setForm(f => ({
    ...f,
    items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
  }));

  const totalHt = form.items.reduce((s, i) => s + (i.quantityReceived * i.purchasePrice), 0);

  const handleCreate = async () => {
    if (!form.supplierId) { setError('Veuillez sélectionner un fournisseur.'); return; }
    if (!form.deliveryDate) { setError('La date de livraison est obligatoire.'); return; }
    if (form.items.length === 0) { setError('Ajoutez au moins un produit.'); return; }
    const invalid = form.items.find(i => !i.stockItemId || i.quantityReceived <= 0 || i.purchasePrice < 0);
    if (invalid) { setError('Vérifiez les lignes produits (produit, quantité, prix d\'achat).'); return; }

    setSaving(true);
    setError('');
    try {
      await apiClient.post('/deliveries', form);
      notify('Livraison créée avec succès.');
      setShowCreate(false);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (delivery: Delivery) => {
    setSaving(true);
    try {
      await apiClient.post(`/deliveries/${delivery.id}/validate`, {});
      notify('Livraison validée — stock mis à jour.');
      setConfirmAction(null);
      load();
    } catch (e: any) {
      notify(e?.message || 'Erreur lors de la validation.', true);
      setConfirmAction(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (delivery: Delivery) => {
    setSaving(true);
    try {
      await apiClient.post(`/deliveries/${delivery.id}/cancel`, {});
      notify('Livraison annulée.');
      setConfirmAction(null);
      load();
    } catch (e: any) {
      notify(e?.message || 'Erreur lors de l\'annulation.', true);
      setConfirmAction(null);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (d: Delivery) => {
    try {
      const data = await apiClient.get(`/deliveries/${d.id}`);
      setShowDetail(data);
    } catch {
      notify('Erreur lors du chargement des détails.', true);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <Truck className="text-indigo-600" size={32} /> Livraisons fournisseurs
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Réceptions & approvisionnement • {deliveries.length} livraison{deliveries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={load} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          {canModify && (
            suppliers.length === 0 ? (
              <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <AlertCircle size={16} /> Créez d'abord un fournisseur
              </div>
            ) : (
              <button
                onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }}
                className="bg-slate-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
                <Plus size={18} /> Nouvelle livraison
              </button>
            )
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <CheckCircle2 size={24} /> {success}
        </div>
      )}
      {error && !showCreate && (
        <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-4 shadow-sm">
          <AlertCircle size={24} /> {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: deliveries.length, icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'En attente', value: kpiPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Reçues', value: kpiReceived, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: `Total HT`, value: kpiTotalHt.toLocaleString('fr-FR'), icon: TrendingUp, color: 'text-slate-700', bg: 'bg-slate-50' },
        ].map(k => (
          <div key={k.label} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${k.bg} rounded-2xl flex items-center justify-center shrink-0`}>
              <k.icon size={20} className={k.color} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{k.label}</p>
              <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Référence, fournisseur…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-4 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); load(); }}
          className="bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-w-[160px]">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={filterSupplier}
          onChange={e => { setFilterSupplier(e.target.value); setPage(1); load(); }}
          className="bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-w-[180px]">
          <option value="">Tous les fournisseurs</option>
          {suppliers.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.companyName}{s.status === 'inactif' ? ' (inactif)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-[2rem] animate-pulse border border-slate-100" />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center">
          <ClipboardList size={48} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {search || filterStatus || filterSupplier ? 'Aucun résultat pour ces filtres.' : 'Commencez par enregistrer une livraison.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Référence</th>
                  <th className="text-left px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Fournisseur</th>
                  <th className="text-left px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="text-right px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Total HT</th>
                  <th className="text-center px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Statut</th>
                  <th className="text-center px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((d) => {
                  const st = STATUS_LABELS[d.status] || { label: d.status, cls: 'bg-slate-50 text-slate-600 border-slate-100' };
                  const supplierName = (d.supplier as any)?.companyName || '';
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Hash size={13} className="text-indigo-400" />
                          <div>
                            <p className="font-black text-sm text-slate-800">{d.reference}</p>
                            {d.purchaseOrderRef && (
                              <p className="text-[9px] text-slate-400 font-semibold">BC: {d.purchaseOrderRef}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                            {supplierName ? initialsFor(supplierName) : <Truck size={14} />}
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{supplierName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold">
                          <Calendar size={13} className="text-slate-400" />
                          {new Date(d.deliveryDate).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="font-black text-sm text-slate-900">{parseFloat(String(d.totalHt)).toLocaleString('fr-FR')} {currency}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetail(d)}
                            className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1.5 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all">
                            <Eye size={13} /> Voir
                          </button>
                          {canModify && d.status === 'PENDING' && (
                            <button
                              onClick={() => setConfirmAction({ type: 'validate', delivery: d })}
                              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 border border-emerald-100">
                              <CheckCircle2 size={12} /> Valider
                            </button>
                          )}
                          {canModify && (d.status === 'PENDING' || d.status === 'PARTIAL') && (
                            <button
                              onClick={() => setConfirmAction({ type: 'cancel', delivery: d })}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-100">
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${p === page
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Modal Création ── */}
      {showCreate && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-auto rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Truck size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Nouvelle livraison</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Enregistrer une réception fournisseur</p>
                </div>
              </div>
              <button onClick={() => { setShowCreate(false); setError(''); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Fournisseur */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Fournisseur <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.supplierId}
                    onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                    className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${!form.supplierId ? 'border-rose-200 bg-rose-50' : 'border-slate-100'}`}>
                    <option value="">— Sélectionner un fournisseur —</option>
                    {suppliers.filter((s: any) => s.status === 'actif').map((s: any) => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                  {!form.supplierId && (
                    <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1 px-1">Champ obligatoire</p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date livraison <span className="text-rose-500">*</span></label>
                  <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>

                {/* Réf. BC */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Réf. bon de commande</label>
                  <input value={form.purchaseOrderRef} onChange={e => setForm(f => ({ ...f, purchaseOrderRef: e.target.value }))}
                    placeholder="BC-2024-XXX"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>

                {/* Statut */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Statut initial</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all">
                    <option value="PENDING">En attente</option>
                    <option value="RECEIVED">Reçue (met à jour le stock)</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Remarques optionnelles"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>

              {/* Lignes produits */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Produits livrés <span className="text-rose-500">*</span></p>
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                    <Plus size={13} /> Ajouter un produit
                  </button>
                </div>

                {form.items.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <Package size={28} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Aucun produit ajouté</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ligne {idx + 1}</span>
                          <button onClick={() => removeItem(idx)} className="text-rose-400 hover:text-rose-600 transition-colors">
                            <X size={15} />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-3">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Produit *</label>
                            <select value={item.stockItemId} onChange={e => updateItem(idx, 'stockItemId', e.target.value)}
                              className="w-full px-3 py-2.5 bg-white rounded-xl text-xs font-semibold border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/10">
                              <option value="">— Sélectionner —</option>
                              {stockItems
                                .filter(s => !form.items.some((it, i) => i !== idx && it.stockItemId === s.id))
                                .map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.sku})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Quantité *</label>
                            <input type="number" min={1} value={item.quantityReceived}
                              onChange={e => updateItem(idx, 'quantityReceived', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2.5 bg-white rounded-xl text-xs font-semibold border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/10" />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Prix achat ({currency}) *</label>
                            <input type="number" min={0} step="0.01" value={item.purchasePrice}
                              onChange={e => updateItem(idx, 'purchasePrice', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2.5 bg-white rounded-xl text-xs font-semibold border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/10" />
                          </div>
                          <div className="flex items-end">
                            <div className="w-full px-3 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Sous-total</p>
                              <p className="text-xs font-black text-indigo-700">
                                {(item.quantityReceived * item.purchasePrice).toLocaleString('fr-FR')} {currency}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between p-5 bg-slate-900 rounded-2xl">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-300">Total HT</span>
                      <span className="text-xl font-black text-white">{totalHt.toLocaleString('fr-FR')} {currency}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-8 border-t border-slate-100 shrink-0">
              <button onClick={() => { setShowCreate(false); setError(''); }}
                className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Enregistrer la livraison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détail ── */}
      {showDetail && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-auto rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl uppercase">
                  {showDetail.supplier?.companyName ? initialsFor(showDetail.supplier.companyName) : <Truck size={24} />}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{showDetail.reference}</h3>
                  <p className="text-slate-400 text-sm font-semibold mt-1">{showDetail.supplier?.companyName || 'Fournisseur inconnu'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {(() => {
                      const st = STATUS_LABELS[showDetail.status];
                      return st ? (
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                      ) : null;
                    })()}
                    {showDetail.purchaseOrderRef && (
                      <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-full">BC: {showDetail.purchaseOrderRef}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all">
                <X size={28} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</p>
                  <p className="text-sm font-black text-slate-900">{new Date(showDetail.deliveryDate).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="p-5 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Total HT</p>
                  <p className="text-sm font-black">{parseFloat(showDetail.totalHt).toLocaleString('fr-FR')} {currency}</p>
                </div>
                <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Produits</p>
                  <p className="text-sm font-black text-slate-900">{(showDetail.items || []).length}</p>
                </div>
              </div>

              {showDetail.notes && (
                <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm">
                  <p className="text-sm font-semibold text-slate-600">{showDetail.notes}</p>
                </div>
              )}

              {/* Lignes produits */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                  <Package size={14} /> Lignes produits
                </h4>
                <div className="space-y-3">
                  {(showDetail.items || []).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                          <Package size={16} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{item.stock_item?.name || '—'}</p>
                          <p className="text-[9px] text-slate-400 font-semibold">{item.stock_item?.sku}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-sm font-black text-slate-700">{item.quantityReceived} unité{item.quantityReceived > 1 ? 's' : ''}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{parseFloat(item.purchasePrice).toLocaleString('fr-FR')} {currency}/u</p>
                        <p className="text-sm font-black text-indigo-600">{parseFloat(item.totalHt).toLocaleString('fr-FR')} {currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Infos fournisseur */}
              {showDetail.supplier && (
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Truck size={14} /> Fournisseur
                  </h4>
                  <p className="text-sm font-black text-slate-900">{showDetail.supplier.companyName}</p>
                  {showDetail.supplier.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Package size={13} /></div>
                      <p className="text-sm text-slate-600 font-semibold">{showDetail.supplier.phone}</p>
                    </div>
                  )}
                  {showDetail.supplier.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Package size={13} /></div>
                      <p className="text-sm text-slate-600 font-semibold">{showDetail.supplier.email}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex gap-4 shrink-0">
              <button onClick={() => setShowDetail(null)}
                className="px-10 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md mx-auto rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center animate-in zoom-in-95">
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner ${confirmAction.type === 'validate' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
              {confirmAction.type === 'validate'
                ? <CheckCircle2 size={40} />
                : <ShieldAlert size={40} />}
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
              {confirmAction.type === 'validate' ? 'Valider la livraison' : 'Annuler la livraison'}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">{confirmAction.delivery.reference}</p>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
              {confirmAction.type === 'validate'
                ? 'Le stock sera mis à jour et le prix moyen pondéré (PUMP) recalculé pour chaque produit.'
                : 'La livraison sera marquée comme annulée. Cette action est irréversible.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => confirmAction.type === 'validate' ? handleValidate(confirmAction.delivery) : handleCancel(confirmAction.delivery)}
                disabled={saving}
                className={`w-full py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 ${
                  confirmAction.type === 'validate'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}>
                {saving ? <RefreshCw className="animate-spin" size={16} /> : null}
                Confirmer
              </button>
              <button onClick={() => setConfirmAction(null)}
                className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deliveries;
