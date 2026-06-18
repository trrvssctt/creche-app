import React, { useState, useEffect } from 'react';
import {
  Send, Plus, Edit2, Trash2, Pin, Globe, Bell, Info,
  AlertTriangle, Star, Loader2, X, RefreshCw, Calendar
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

type AnnType = 'INFO' | 'WARNING' | 'SUCCESS' | 'URGENT';

const defaultForm = { title: '', body: '', type: 'INFO' as AnnType, targetPlan: '', isPinned: false, expiresAt: '' };

const TYPE_CONFIG: Record<AnnType, { label: string; color: string; bg: string; icon: any }> = {
  INFO:    { label: 'Information', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', icon: Info },
  WARNING: { label: 'Avertissement', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
  SUCCESS: { label: 'Succès / Nouveauté', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Star },
  URGENT:  { label: 'Urgent', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: Bell },
};

const SACommunication: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const showToast = useToast();

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/announcements');
      setAnnouncements(Array.isArray(res) ? res : []);
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { showToast('Titre et message requis', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await apiClient.patch(`/admin/announcements/${editId}`, form);
        showToast('Annonce mise à jour', 'success');
      } else {
        await apiClient.post('/admin/announcements', form);
        showToast('Annonce publiée', 'success');
      }
      setForm(defaultForm); setEditId(null); setShowForm(false);
      fetchAnnouncements();
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/admin/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      showToast('Annonce supprimée', 'success');
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
    finally { setConfirmDelete(null); }
  };

  const openEdit = (a: any) => {
    setForm({ title: a.title, body: a.body, type: a.type, targetPlan: a.targetPlan || '', isPinned: a.isPinned, expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '' });
    setEditId(a.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-lg">Communication & Annonces</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Diffuser des messages à tous vos clients SaaS</p>
        </div>
        <button
          onClick={() => { setForm(defaultForm); setEditId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95"
        >
          <Plus size={15} /> Nouvelle annonce
        </button>
      </div>

      {/* Types guide */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(TYPE_CONFIG) as [AnnType, typeof TYPE_CONFIG[AnnType]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = announcements.filter(a => a.type === key).length;
          return (
            <div key={key} className={`${cfg.bg} border rounded-xl p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={cfg.color} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-lg font-black text-white">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw size={24} className="animate-spin text-zinc-500 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Chargement...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-12 text-center">
          <Send size={40} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500">Aucune annonce publiée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => {
            const cfg = TYPE_CONFIG[a.type as AnnType] || TYPE_CONFIG.INFO;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className={`bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-5 hover:border-zinc-600/50 transition-all group`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-xl ${cfg.bg} border shrink-0`}>
                      <Icon size={15} className={cfg.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-white">{a.title}</h4>
                        {a.isPinned && (
                          <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                            <Pin size={8} /> ÉPINGLÉ
                          </span>
                        )}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label.toUpperCase()}</span>
                        {a.targetPlan && (
                          <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">→ {a.targetPlan}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{a.body}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-[10px] text-zinc-600">
                          Publié le {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </p>
                        {a.expiresAt && (
                          <p className="text-[10px] text-amber-500/70">
                            Expire le {new Date(a.expiresAt).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(a)}
                      className="p-2 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(a)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-white text-lg">{editId ? 'Modifier l\'annonce' : 'Nouvelle annonce'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Titre *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                  placeholder="Titre de l'annonce..."
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Message *</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required rows={4}
                  placeholder="Contenu de l'annonce..."
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AnnType }))}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40">
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Cible (plan)</label>
                  <input value={form.targetPlan} onChange={e => setForm(f => ({ ...f, targetPlan: e.target.value }))}
                    placeholder="BASIC, PREMIUM... (vide = tous)"
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Expire le</label>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-11 h-6 rounded-full transition-all ${form.isPinned ? 'bg-amber-500' : 'bg-zinc-700'}`}
                      onClick={() => setForm(f => ({ ...f, isPinned: !f.isPinned }))}>
                      <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all shadow ${form.isPinned ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs text-zinc-300 font-bold">Épingler</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {editId ? 'Mettre à jour' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-8 w-full max-w-sm text-center">
            <Trash2 size={32} className="text-rose-400 mx-auto mb-4" />
            <h3 className="font-black text-white mb-2">Supprimer l'annonce ?</h3>
            <p className="text-xs text-zinc-400 mb-6">"{confirmDelete.title}"</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 py-3 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-400 transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SACommunication;
