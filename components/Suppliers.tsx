import React, { useState, useEffect } from 'react';
import { User, Supplier } from '../types';
import { apiClient } from '../services/api';
import { UserRole } from '../types';
import {
  Plus, Search, Edit3, Trash2, Eye, X, Truck, Phone, Mail,
  MapPin, Globe, Building2, AlertCircle, CheckCircle2, Loader2,
  Clock, ShieldCheck, ExternalLink, RefreshCw, ArrowRight, Save,
  TrendingUp, BarChart3, ShieldAlert, Power, PowerOff
} from 'lucide-react';

interface SuppliersProps {
  user: User;
  currency: string;
}

const ITEMS_PER_PAGE = 6;

const emptyForm = {
  companyName: '',
  mainContact: '',
  email: '',
  phone: '',
  address: '',
  siret: '',
  tvaIntra: '',
  website: '',
  paymentTerms: 30
};

const initialsFor = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

const Suppliers: React.FC<SuppliersProps> = ({ user, currency }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Supplier | null>(null);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [showDelete, setShowDelete] = useState<Supplier | null>(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [globalError, setGlobalError] = useState('');

  const roles = Array.isArray((user as any).roles) ? (user as any).roles : [user.role];
  const canModify = roles.some((r: UserRole) => [UserRole.ADMIN, UserRole.STOCK_MANAGER].includes(r));
  const canDelete = roles.includes(UserRole.ADMIN);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // L'API retourne actif + inactif (pas les supprimés)
  const filtered = suppliers.filter(s =>
    s.companyName.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );
  const activeCount = suppliers.filter(s => (s as any).status === 'actif').length;
  const inactiveCount = suppliers.filter(s => (s as any).status === 'inactif').length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const avgPayment = suppliers.length
    ? Math.round(suppliers.reduce((s, x) => s + ((x as any).paymentTerms ?? 30), 0) / suppliers.length)
    : 0;

  const notify = (msg: string, isError = false) => {
    if (isError) setGlobalError(msg);
    else setSuccess(msg);
    setTimeout(() => { setGlobalError(''); setSuccess(''); }, 4000);
  };

  const openCreate = () => { setForm({ ...emptyForm }); setFormError(''); setShowCreate(true); };
  const openEdit = (s: Supplier) => {
    setForm({
      companyName: s.companyName || '',
      mainContact: s.mainContact || '',
      email: s.email || '',
      phone: s.phone || '',
      address: (s as any).address || '',
      siret: (s as any).siret || '',
      tvaIntra: (s as any).tvaIntra || '',
      website: (s as any).website || '',
      paymentTerms: (s as any).paymentTerms ?? 30
    });
    setFormError('');
    setShowEdit(s);
  };

  const openDetail = async (s: Supplier) => {
    try {
      const data = await apiClient.get(`/suppliers/${s.id}`);
      setShowDetail(data);
    } catch {
      notify('Erreur lors du chargement des détails.', true);
    }
  };

  const handleSave = async () => {
    if (!form.companyName.trim()) { setFormError('Le nom de la société est obligatoire.'); return; }
    if (!form.phone.trim()) { setFormError('Le numéro de téléphone est obligatoire.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (showEdit) {
        await apiClient.put(`/suppliers/${showEdit.id}`, form);
        setShowEdit(null);
        notify('Fournisseur mis à jour avec succès.');
      } else {
        await apiClient.post('/suppliers', form);
        setShowCreate(false);
        notify('Fournisseur créé avec succès.');
      }
      load();
    } catch (e: any) {
      setFormError(e?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    setSaving(true);
    try {
      await apiClient.delete(`/suppliers/${showDelete.id}`);
      notify('Fournisseur supprimé.');
      setShowDelete(null);
      load();
    } catch (e: any) {
      notify(e?.message || 'Suppression impossible.', true);
      setShowDelete(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: Supplier) => {
    setSaving(true);
    try {
      const updated = await apiClient.patch(`/suppliers/${s.id}/toggle`);
      setSuppliers(prev => prev.map(x => x.id === updated.id ? updated : x));
      const label = (updated as any).status === 'actif' ? 'réactivé' : 'désactivé';
      notify(`Fournisseur "${updated.companyName}" ${label}.`);
    } catch (e: any) {
      notify(e?.message || 'Erreur lors du changement de statut.', true);
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => { setShowCreate(false); setShowEdit(null); setFormError(''); };
  const formTitle = showEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur';

  const inputCls = "w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all";
  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1";

  /* ─── Formulaire inliné (évite remount au keystroke) ─── */
  const formJSX = (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg mx-auto rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Truck size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">{formTitle}</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Réseau fournisseurs</p>
            </div>
          </div>
          <button onClick={closeForm} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-8 space-y-5">
          {formError && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100">
              <AlertCircle size={15} className="shrink-0" /> {formError}
            </div>
          )}

          <div>
            <label className={labelCls}>Nom de la société <span className="text-rose-500">*</span></label>
            <input type="text" autoComplete="off" placeholder="Ex : Fournisseur SA"
              value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contact principal</label>
              <input type="text" autoComplete="off" placeholder="Prénom Nom"
                value={form.mainContact} onChange={e => setForm(f => ({ ...f, mainContact: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone <span className="text-rose-500">*</span></label>
              <input type="tel" autoComplete="off" placeholder="+33 6 00 00 00 00"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" autoComplete="off" placeholder="contact@fournisseur.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Adresse</label>
            <textarea rows={2} placeholder="Adresse complète"
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className={inputCls + ' resize-none'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SIRET</label>
              <input type="text" autoComplete="off" placeholder="12345678901234"
                value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>TVA Intra</label>
              <input type="text" autoComplete="off" placeholder="FR00 000000000"
                value={form.tvaIntra} onChange={e => setForm(f => ({ ...f, tvaIntra: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Site web</label>
              <input type="url" autoComplete="off" placeholder="https://..."
                value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Délai paiement (jours)</label>
              <input type="number" min={0}
                value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: parseInt(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-8 border-t border-slate-100 shrink-0">
          <button type="button" onClick={closeForm}
            className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
            Annuler
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {showEdit ? 'Mettre à jour' : 'Créer le fournisseur'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <Truck className="text-indigo-600" size={32} /> Fournisseurs
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Réseau d'approvisionnement • {suppliers.length} partenaire{suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={load} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          {canModify && (
            <button
              onClick={openCreate}
              className="bg-slate-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
              <Plus size={18} /> Nouveau fournisseur
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <CheckCircle2 size={24} /> {success}
        </div>
      )}
      {globalError && !showCreate && !showEdit && (
        <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-4 shadow-sm">
          <AlertCircle size={24} /> {globalError}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: suppliers.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Actifs', value: activeCount, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inactifs', value: inactiveCount, icon: PowerOff, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Délai moyen', value: `${avgPayment}j`, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
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

      {/* Barre de recherche */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, email, téléphone…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-4 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Grille fournisseurs */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-white rounded-[2.5rem] animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center">
          <Truck size={48} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {search ? 'Aucun résultat pour cette recherche.' : 'Aucun fournisseur enregistré.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {paginated.map(s => {
            const initials = initialsFor(s.companyName);
            const status = (s as any).status as string;
            const isActive = status === 'actif';
            const isInactive = status === 'inactif';
            return (
              <div key={s.id}
                className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all p-8 flex flex-col h-full group relative overflow-hidden border-b-4 border-transparent hover:border-indigo-500 ${isInactive ? 'opacity-70' : ''}`}>

                {/* Avatar + nom + statut */}
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform uppercase ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {initials}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {isActive ? 'Actif' : 'Inactif'}
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-lg uppercase truncate leading-none">{s.companyName}</h3>
                {s.mainContact && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest truncate">{s.mainContact}</p>
                )}

                {/* Infos contact */}
                <div className="mt-5 space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Phone size={14} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{s.phone}</span>
                  </div>
                  {s.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                        <Mail size={14} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 truncate">{s.email}</span>
                    </div>
                  )}
                  {(s as any).address && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin size={14} />
                      </div>
                      <span className="text-sm text-slate-500 font-semibold truncate">{(s as any).address}</span>
                    </div>
                  )}
                </div>

                {/* Délai paiement */}
                <div className="mt-5 grid grid-cols-1 gap-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-amber-500" />
                      <p className="text-[8px] font-black text-slate-400 uppercase">Délai paiement</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">{(s as any).paymentTerms ?? 30} jours</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-between gap-2 border-t border-slate-100 pt-6">
                  <button onClick={() => openDetail(s)}
                    className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
                    DÉTAILS <Eye size={16} />
                  </button>
                  <div className="flex gap-2">
                    {canModify && (
                      <>
                        {/* Toggle activer / désactiver */}
                        <button
                          onClick={() => handleToggle(s)}
                          disabled={saving}
                          title={isActive ? 'Désactiver ce fournisseur' : 'Réactiver ce fournisseur'}
                          className={`p-3 rounded-xl shadow-sm transition-all border ${isActive ? 'bg-white border-slate-100 text-slate-400 hover:text-amber-600 hover:border-amber-100 hover:bg-amber-50' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}>
                          {isActive ? <PowerOff size={18} /> : <Power size={18} />}
                        </button>
                        <button onClick={() => openEdit(s)}
                          className="p-3 rounded-xl shadow-sm transition-all bg-white border border-slate-100 text-slate-400 hover:text-amber-600">
                          <Edit3 size={18} />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button onClick={() => setShowDelete(s)}
                        className="p-3 rounded-xl shadow-sm transition-all bg-white border border-slate-100 text-slate-400 hover:text-rose-600">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* ── Modal Création / Édition ── */}
      {(showCreate || showEdit) && formJSX}

      {/* ── Modal Détail ── */}
      {showDetail && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-auto rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl font-black shadow-2xl uppercase">
                  {initialsFor(showDetail.supplier?.companyName || '?')}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{showDetail.supplier?.companyName}</h3>
                  {showDetail.supplier?.mainContact && (
                    <p className="text-slate-400 text-sm font-semibold mt-1">{showDetail.supplier.mainContact}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-full">
                      Délai : {showDetail.supplier?.paymentTerms ?? 30}j
                    </span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full">
                      Actif
                    </span>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-2 top-2 opacity-10"><TrendingUp size={60} /></div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 opacity-70">Total commandé</p>
                  <p className="text-3xl font-black">{Number(showDetail.stats?.totalOrdered || 0).toLocaleString('fr-FR')} <span className="text-sm uppercase">{currency}</span></p>
                </div>
                <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-2 top-2 opacity-10"><Truck size={60} /></div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 opacity-70">Livraisons</p>
                  <p className="text-3xl font-black">{showDetail.stats?.deliveryCount ?? 0}</p>
                </div>
              </div>

              {/* Coordonnées */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Phone size={14} /> Coordonnées
                </h4>
                <div className="space-y-3">
                  {showDetail.supplier?.phone && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Phone size={16} /></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">Téléphone</p><p className="text-sm font-bold text-slate-800">{showDetail.supplier.phone}</p></div>
                    </div>
                  )}
                  {showDetail.supplier?.email && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Mail size={16} /></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">Email</p><p className="text-sm font-bold text-slate-800">{showDetail.supplier.email}</p></div>
                    </div>
                  )}
                  {showDetail.supplier?.address && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><MapPin size={16} /></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">Adresse</p><p className="text-sm font-bold text-slate-800">{showDetail.supplier.address}</p></div>
                    </div>
                  )}
                  {showDetail.supplier?.website && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Globe size={16} /></div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Site web</p>
                        <a href={showDetail.supplier.website} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                          {showDetail.supplier.website} <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  )}
                  {showDetail.supplier?.siret && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Building2 size={16} /></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">SIRET</p><p className="text-sm font-bold text-slate-800">{showDetail.supplier.siret}</p></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dernières livraisons */}
              {showDetail.recentDeliveries?.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                    <Truck size={14} /> Dernières livraisons
                  </h4>
                  <div className="space-y-3">
                    {showDetail.recentDeliveries.slice(0, 5).map((d: any) => (
                      <div key={d.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Truck size={16} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase">{d.reference}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(d.deliveryDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">{parseFloat(d.totalHt).toLocaleString('fr-FR')} {currency}</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-[7px] font-black uppercase mt-1 ${
                            d.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-600' :
                            d.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                            d.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>{d.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* ── Modal Suppression ── */}
      {showDelete && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md mx-auto rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la suppression ?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
              Souhaitez-vous supprimer le fournisseur <span className="text-rose-600 font-black">"{showDelete.companyName}"</span> ?<br />
              Action bloquée s'il possède des livraisons liées.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDelete} disabled={saving}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200 disabled:opacity-50">
                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Oui, supprimer
              </button>
              <button onClick={() => setShowDelete(null)}
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

export default Suppliers;
