import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, Search, RefreshCw, MessageCircle, Clock, CheckCircle2,
  AlertTriangle, Send, Loader2, ChevronRight, User, Calendar, Tag,
  X, Filter
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Ouvert',      color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
  IN_PROGRESS: { label: 'En cours',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  RESOLVED:    { label: 'Résolu',      color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  CLOSED:      { label: 'Fermé',       color: 'text-zinc-400',  bg: 'bg-zinc-500/10 border-zinc-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Faible',  color: 'text-zinc-400' },
  MEDIUM: { label: 'Moyen',   color: 'text-sky-400' },
  HIGH:   { label: 'Haute',   color: 'text-amber-400' },
  URGENT: { label: 'Urgent',  color: 'text-rose-400' },
};

const SASupport: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const showToast = useToast();

  const fetchSupport = async () => {
    setLoading(true);
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        apiClient.get(`/admin/support${statusFilter ? `?status=${statusFilter}` : ''}`),
        apiClient.get('/admin/support/stats')
      ]);
      setTickets((ticketsRes as any)?.tickets || ticketsRes || []);
      setStats((statsRes as any) || { total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 });
    } catch (e: any) {
      showToast(e?.message || 'Erreur', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSupport(); }, [statusFilter]);

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setReplyLoading(true);
    try {
      const res = await apiClient.patch(`/admin/support/${selected.id}`, {
        adminReply: reply,
        status: 'RESOLVED'
      });
      setSelected((res as any)?.ticket || { ...selected, adminReply: reply, status: 'RESOLVED' });
      setReply('');
      fetchSupport();
      showToast('Réponse envoyée', 'success');
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
    finally { setReplyLoading(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/admin/support/${id}`, { status });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      if (selected?.id === id) setSelected((prev: any) => prev ? { ...prev, status } : prev);
      showToast('Statut mis à jour', 'success');
    } catch (e: any) { showToast(e?.message || 'Erreur', 'error'); }
  };

  const filtered = tickets.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.subject?.toLowerCase().includes(q) || t.userName?.toLowerCase().includes(q) || t.tenantName?.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,      color: 'text-zinc-300', bg: 'bg-zinc-700/50 border-zinc-600/50' },
          { label: 'Ouverts',    value: stats.open,       color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'En cours',   value: stats.inProgress, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Résolus',    value: stats.resolved,   color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Urgents',    value: stats.urgent,     color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border border-zinc-700/50">
          {[
            { key: '', label: 'Tous' },
            { key: 'OPEN', label: 'Ouverts' },
            { key: 'IN_PROGRESS', label: 'En cours' },
            { key: 'RESOLVED', label: 'Résolus' },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-2 text-xs font-bold transition-all ${statusFilter === f.key ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par sujet, client..."
            className="w-full pl-8 pr-3 py-2 bg-zinc-900/50 border border-zinc-700/50 text-xs text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <button onClick={fetchSupport} className="p-2.5 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Tickets list */}
        <div className="xl:col-span-2 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-700/30 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <RefreshCw size={24} className="animate-spin text-zinc-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Chargement...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <LifeBuoy size={32} className="text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">Aucun ticket</p>
              </div>
            ) : filtered.map(t => {
              const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
              const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full text-left p-4 hover:bg-zinc-700/30 transition-colors ${selected?.id === t.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-white leading-tight flex-1 truncate">{t.subject || 'Sans titre'}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${st.bg} ${st.color} shrink-0`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1"><User size={9} /> {t.userName || t.tenantName || '?'}</span>
                    <span className={`font-bold ${pr.color}`}>{pr.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ticket detail */}
        <div className="xl:col-span-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <LifeBuoy size={40} className="text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">Sélectionnez un ticket</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-zinc-700/50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-black text-white leading-tight flex-1">{selected.subject}</h3>
                  <button onClick={() => setSelected(null)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-700 transition-all shrink-0">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.OPEN).bg} ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.OPEN).color}`}>
                    {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.OPEN).label}
                  </span>
                  {selected.priority && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-zinc-700 ${(PRIORITY_CONFIG[selected.priority] || PRIORITY_CONFIG.MEDIUM).color}`}>
                      {(PRIORITY_CONFIG[selected.priority] || PRIORITY_CONFIG.MEDIUM).label}
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map(s => (
                      <button key={s} onClick={() => handleStatusChange(selected.id, s)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${selected.status === s ? 'bg-indigo-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}>
                        {STATUS_CONFIG[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="flex gap-3 text-xs text-zinc-400">
                  {selected.userName && <span className="flex items-center gap-1"><User size={11} /> {selected.userName}</span>}
                  {selected.createdAt && <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(selected.createdAt).toLocaleDateString('fr-FR')}</span>}
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4">
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selected.message || selected.description}</p>
                </div>
                {selected.adminReply && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Réponse admin</p>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selected.adminReply}</p>
                  </div>
                )}
              </div>

              {/* Reply form */}
              {selected.status !== 'CLOSED' && (
                <div className="p-4 border-t border-zinc-700/50">
                  <div className="flex gap-3">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Rédiger une réponse..."
                      rows={2}
                      className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    />
                    <button
                      onClick={handleReply}
                      disabled={!reply.trim() || replyLoading}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2 self-end"
                    >
                      {replyLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SASupport;
