import React, { useState, useEffect } from 'react';
import {
  Mail, Search, Eye, Trash2, CheckCircle2, Circle, Users,
  X, RefreshCw, MessageCircle, ChevronLeft, ChevronRight, Send
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

interface Stats {
  total_messages: number;
  non_lus: number;
  lus: number;
  unique_contacts: number;
}

const SAMessages: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ total_messages: 0, non_lus: 0, lus: 0, unique_contacts: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'non_lus' | 'lus'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const showToast = useToast();

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (filter !== 'all') params.append('status', filter);
      if (search.trim()) params.append('search', search.trim());
      const res = await apiClient.get(`/admin/contact/messages?${params}`);
      if (res?.success) {
        setMessages(res.data?.messages || []);
        setPagination(res.data?.pagination);
        setStats(res.data?.stats || { total_messages: 0, non_lus: 0, lus: 0, unique_contacts: 0 });
      }
    } catch (e: any) {
      showToast(e?.message || 'Erreur chargement messages', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMessages(); }, [filter, page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchMessages(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const toggleRead = async (id: string, current: string) => {
    const newStatus = current === 'non_lus' ? 'lus' : 'non_lus';
    try {
      await apiClient.put(`/admin/contact/messages/${id}/status`, { status: newStatus });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
      setStats(prev => ({
        ...prev,
        non_lus: newStatus === 'lus' ? prev.non_lus - 1 : prev.non_lus + 1,
        lus: newStatus === 'lus' ? prev.lus + 1 : prev.lus - 1
      }));
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
  };

  const deleteMessage = async (id: string) => {
    try {
      await apiClient.delete(`/admin/contact/messages/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
      setStats(prev => ({ ...prev, total_messages: prev.total_messages - 1 }));
      if (selected?.id === id) setSelected(null);
      showToast('Message supprimé', 'success');
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
    finally { setConfirmDelete(null); }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total messages', value: stats.total_messages, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Non lus', value: stats.non_lus, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
          { label: 'Lus', value: stats.lus, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Contacts uniques', value: stats.unique_contacts, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-4`}>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border border-zinc-700/50">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'non_lus', label: 'Non lus' },
            { key: 'lus', label: 'Lus' },
          ].map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key as any); setPage(1); }}
              className={`px-4 py-2 text-xs font-bold transition-all ${filter === f.key ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}>
              {f.label}
              {f.key === 'non_lus' && stats.non_lus > 0 && (
                <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{stats.non_lus}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-2 bg-zinc-900/50 border border-zinc-700/50 text-xs text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <button onClick={fetchMessages} className="p-2.5 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Messages list */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* List */}
        <div className="xl:col-span-2 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-700/30 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <RefreshCw size={24} className="animate-spin text-zinc-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Chargement...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center">
                <MessageCircle size={32} className="text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">Aucun message</p>
              </div>
            ) : messages.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelected(m); if (m.status === 'non_lus') toggleRead(m.id, m.status); }}
                className={`w-full text-left p-4 hover:bg-zinc-700/30 transition-colors relative ${selected?.id === m.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''}`}
              >
                {m.status === 'non_lus' && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full" />
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.status === 'non_lus' ? 'bg-indigo-500/20' : 'bg-zinc-700'}`}>
                    <span className="text-[10px] font-black text-white">{(m.name || '?').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${m.status === 'non_lus' ? 'text-white' : 'text-zinc-300'}`}>{m.name || 'Inconnu'}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{m.email}</p>
                    <p className="text-[10px] text-zinc-400 truncate mt-1">{m.message}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-zinc-700/50">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] text-zinc-400">Page {page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="xl:col-span-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <Mail size={40} className="text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">Sélectionnez un message</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="p-5 border-b border-zinc-700/50 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{selected.name || 'Inconnu'}</h3>
                  <p className="text-xs text-indigo-400 mt-0.5">{selected.email}</p>
                  {selected.phone && <p className="text-xs text-zinc-500">{selected.phone}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => toggleRead(selected.id, selected.status)}
                    className="p-2 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl transition-all"
                    title={selected.status === 'non_lus' ? 'Marquer comme lu' : 'Marquer comme non lu'}
                  >
                    {selected.status === 'non_lus' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Circle size={14} className="text-zinc-400" />}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(selected)}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="p-5 flex-1 overflow-y-auto">
                {selected.subject && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sujet</p>
                    <p className="text-sm font-semibold text-zinc-300">{selected.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Message</p>
                  <div className="bg-zinc-900/50 rounded-xl p-4">
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>
                </div>
                {selected.createdAt && (
                  <p className="text-[10px] text-zinc-600 mt-4">
                    Reçu le {new Date(selected.createdAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-8 w-full max-w-sm text-center">
            <Trash2 size={32} className="text-rose-400 mx-auto mb-4" />
            <h3 className="font-black text-white mb-2">Supprimer ce message ?</h3>
            <p className="text-xs text-zinc-400 mb-6">De <span className="text-white font-bold">"{confirmDelete.name}"</span>. Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl">Annuler</button>
              <button onClick={() => deleteMessage(confirmDelete.id)} className="flex-1 py-3 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-400 transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SAMessages;
