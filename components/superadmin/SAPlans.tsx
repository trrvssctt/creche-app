import React, { useState } from 'react';
import {
  Layers, Plus, Edit2, Trash2, CheckCircle2, X, Save, Loader2,
  Users, Zap, BarChart3, DollarSign, TrendingUp, Star, Shield
} from 'lucide-react';
import { useToast } from '../ToastProvider';
import { apiClient } from '../../services/api';

interface Props {
  plans: any[];
  tenants: any[];
  onRefresh: () => void;
  fmt: (n: number) => string;
}

const defaultForm = {
  id: '', name: '', priceMonthly: 0, priceYearly: 0,
  maxUsers: 1, hasAiChatbot: false, hasStockForecast: false, isActive: true
};

const PLAN_COLORS = [
  { border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', icon: 'bg-indigo-500/20 text-indigo-400', badge: 'bg-indigo-500/15 text-indigo-400' },
  { border: 'border-violet-500/30', bg: 'bg-violet-500/5', icon: 'bg-violet-500/20 text-violet-400', badge: 'bg-violet-500/15 text-violet-400' },
  { border: 'border-sky-500/30', bg: 'bg-sky-500/5', icon: 'bg-sky-500/20 text-sky-400', badge: 'bg-sky-500/15 text-sky-400' },
  { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', icon: 'bg-emerald-500/20 text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400' },
  { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: 'bg-amber-500/20 text-amber-400', badge: 'bg-amber-500/15 text-amber-400' },
];

const SAPlans: React.FC<Props> = ({ plans, tenants, onRefresh, fmt }) => {
  const [showModal, setShowModal] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const showToast = useToast();

  const openCreate = () => {
    setForm(defaultForm);
    setShowModal({ mode: 'create' });
  };

  const openEdit = (p: any) => {
    setForm({ ...defaultForm, ...p });
    setShowModal({ mode: 'edit', id: p.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (showModal?.mode === 'edit' && showModal?.id) {
        await apiClient.put(`/admin/plans/${showModal.id}`, form);
        showToast('Offre mise à jour', 'success');
      } else {
        await apiClient.post('/admin/plans', form);
        showToast('Offre créée', 'success');
      }
      setShowModal(null);
      onRefresh();
    } catch (e: any) {
      showToast(e?.message || "Erreur lors de l'enregistrement", 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/admin/plans/${id}`);
      showToast('Offre désactivée', 'success');
      setConfirmDelete(null);
      onRefresh();
    } catch (e: any) {
      showToast(e?.message || 'Erreur', 'error');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-lg">Catalogue des offres</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{plans.length} offre(s) configurée(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl hover:from-indigo-400 hover:to-violet-400 transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
        >
          <Plus size={15} /> Nouvelle offre
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((p: any, i: number) => {
          const colors = PLAN_COLORS[i % PLAN_COLORS.length];
          const activeCount = tenants.filter(t => t.planName === p.name && t.subscription?.status === 'ACTIVE').length;
          return (
            <div key={p.id} className={`relative bg-zinc-800/50 border ${colors.border} ${colors.bg} rounded-2xl p-6 hover:scale-[1.01] transition-all duration-200 group`}>
              {/* Status badge */}
              <div className="flex items-center justify-between mb-5">
                <div className={`p-3 rounded-xl ${colors.icon}`}>
                  <Layers size={22} />
                </div>
                <span className={`px-2 py-1 text-[9px] font-black rounded-lg uppercase ${p.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'}`}>
                  {p.isActive ? '● ACTIF' : '● INACTIF'}
                </span>
              </div>

              {/* Plan name & price */}
              <div className="mb-5">
                <h4 className="text-xl font-black text-white">{p.name}</h4>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.id}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{fmt(p.priceMonthly)}</span>
                  <span className="text-xs text-zinc-400 mb-1">F CFA/mois</span>
                </div>
                {p.priceYearly > 0 && (
                  <p className="text-[10px] text-emerald-400 mt-0.5">ou {fmt(p.priceYearly)} F/an</p>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2.5 border-t border-zinc-700/50 pt-4 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Users size={12} /> Utilisateurs max
                  </div>
                  <span className="font-bold text-white">{p.maxUsers}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Zap size={12} /> IA Chatbot
                  </div>
                  <span className={`font-bold ${p.hasAiChatbot ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {p.hasAiChatbot ? '✓ Inclus' : '✗ Non'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <BarChart3 size={12} /> Prévisions IA
                  </div>
                  <span className={`font-bold ${p.hasStockForecast ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {p.hasStockForecast ? '✓ Inclus' : '✗ Non'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <TrendingUp size={12} /> Clients actifs
                  </div>
                  <span className={`font-black ${colors.badge.split(' ')[1]}`}>{activeCount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openEdit(p)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-700/50 hover:bg-zinc-600 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Edit2 size={12} /> Modifier
                </button>
                <button
                  onClick={() => setConfirmDelete(p)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-xl transition-all"
                >
                  <Trash2 size={12} /> Désactiver
                </button>
              </div>
            </div>
          );
        })}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-16">
            <Layers size={40} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucune offre configurée</p>
          </div>
        )}
      </div>

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-white text-lg">
                {showModal.mode === 'edit' ? 'Modifier l\'offre' : 'Nouvelle offre'}
              </h3>
              <button onClick={() => setShowModal(null)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Identifiant (ID)</label>
                  <input
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))}
                    placeholder="ex: BASIC, PREMIUM..."
                    required
                    disabled={showModal.mode === 'edit'}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Nom d'affichage</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ex: Basic, Premium, Enterprise..."
                    required
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Prix mensuel (F CFA)</label>
                  <input
                    type="number" min={0}
                    value={form.priceMonthly}
                    onChange={e => setForm(f => ({ ...f, priceMonthly: Number(e.target.value) }))}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Prix annuel (F CFA)</label>
                  <input
                    type="number" min={0}
                    value={form.priceYearly}
                    onChange={e => setForm(f => ({ ...f, priceYearly: Number(e.target.value) }))}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Utilisateurs max</label>
                  <input
                    type="number" min={1}
                    value={form.maxUsers}
                    onChange={e => setForm(f => ({ ...f, maxUsers: Number(e.target.value) }))}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-11 h-6 rounded-full transition-all ${form.isActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                      <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all shadow ${form.isActive ? 'ml-5.5 translate-x-5' : 'ml-0.5'}`} />
                    </div>
                    <span className="text-xs text-zinc-300 font-bold">Plan actif</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer flex-1 bg-zinc-800 rounded-xl p-3 border border-zinc-700/50">
                  <input type="checkbox" checked={form.hasAiChatbot} onChange={e => setForm(f => ({ ...f, hasAiChatbot: e.target.checked }))} className="accent-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-white">IA Chatbot</p>
                    <p className="text-[10px] text-zinc-500">Inclure le chatbot IA</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1 bg-zinc-800 rounded-xl p-3 border border-zinc-700/50">
                  <input type="checkbox" checked={form.hasStockForecast} onChange={e => setForm(f => ({ ...f, hasStockForecast: e.target.checked }))} className="accent-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-white">Prévisions IA</p>
                    <p className="text-[10px] text-zinc-500">Analyses prédictives stock</p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {showModal.mode === 'edit' ? 'Mettre à jour' : 'Créer l\'offre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-rose-400" />
            </div>
            <h3 className="font-black text-white text-lg mb-2">Désactiver l'offre</h3>
            <p className="text-xs text-zinc-400 mb-6">Désactiver <span className="text-white font-bold">"{confirmDelete.name}"</span> du catalogue ?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl hover:bg-zinc-700 transition-all">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 py-3 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-400 transition-all">Désactiver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SAPlans;
