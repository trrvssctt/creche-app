import React, { useState, useEffect } from 'react';
import {
  Terminal, Search, RefreshCw, Filter, User, Globe,
  Shield, Clock, X, ChevronDown, Database
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

interface Props {
  tenants: any[];
}

const SALogs: React.FC<Props> = ({ tenants }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantFilter, setTenantFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const showToast = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q: string[] = [];
      if (tenantFilter) q.push(`tenantId=${encodeURIComponent(tenantFilter)}`);
      if (userFilter) q.push(`userId=${encodeURIComponent(userFilter)}`);
      if (search.trim()) q.push(`q=${encodeURIComponent(search.trim())}`);
      const res = await apiClient.get(`/admin/logs${q.length ? '?' + q.join('&') : ''}`);
      setLogs(res || []);
    } catch (e: any) {
      showToast(e?.message || 'Erreur', 'error');
      setLogs([]);
    } finally { setLoading(false); }
  };

  const fetchUsersForTenant = async (id: string | null) => {
    if (!id) { setUsers([]); return; }
    try {
      const res = await apiClient.get(`/admin/tenants/${id}/users`);
      setUsers(res || []);
    } catch { setUsers([]); }
  };

  useEffect(() => { fetchLogs(); }, [tenantFilter, userFilter]);
  useEffect(() => { fetchUsersForTenant(tenantFilter); }, [tenantFilter]);

  const getActionColor = (action: string) => {
    if (!action) return 'text-zinc-400';
    const a = action.toUpperCase();
    if (a.includes('DELETE') || a.includes('LOCK') || a.includes('REJECT')) return 'text-rose-400';
    if (a.includes('CREATE') || a.includes('REGISTER') || a.includes('VALIDATE')) return 'text-emerald-400';
    if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('MODIFY')) return 'text-amber-400';
    if (a.includes('LOGIN') || a.includes('AUTH')) return 'text-sky-400';
    return 'text-indigo-400';
  };

  const filtered = logs.filter(l => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const textMatch = l.action?.toLowerCase().includes(q) || l.tenantName?.toLowerCase().includes(q) ||
        l.userName?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q) || l.ipAddress?.toLowerCase().includes(q);
      if (!textMatch) return false;
    }
    if (actionType !== 'ALL') {
      const a = l.action?.toUpperCase() || '';
      if (actionType === 'CREATE' && !(a.includes('CREATE') || a.includes('REGISTER'))) return false;
      if (actionType === 'DELETE' && !(a.includes('DELETE') || a.includes('LOCK') || a.includes('REJECT'))) return false;
      if (actionType === 'UPDATE' && !(a.includes('UPDATE') || a.includes('EDIT') || a.includes('MODIFY'))) return false;
      if (actionType === 'LOGIN' && !(a.includes('LOGIN') || a.includes('AUTH'))) return false;
    }
    if (dateFrom && l.createdAt && new Date(l.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && l.createdAt && new Date(l.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Total logs</p>
          <p className="text-2xl font-black text-white">{logs.length}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Actions critiques</p>
          <p className="text-2xl font-black text-rose-400">
            {logs.filter(l => l.action?.toUpperCase().includes('DELETE') || l.action?.toUpperCase().includes('LOCK')).length}
          </p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Créations</p>
          <p className="text-2xl font-black text-emerald-400">
            {logs.filter(l => l.action?.toUpperCase().includes('CREATE') || l.action?.toUpperCase().includes('REGISTER')).length}
          </p>
        </div>
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Connexions</p>
          <p className="text-2xl font-black text-sky-400">
            {logs.filter(l => l.action?.toUpperCase().includes('LOGIN') || l.action?.toUpperCase().includes('AUTH')).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-3 sm:p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher action, tenant..."
              className="w-full pl-8 pr-3 py-2 bg-zinc-900/50 border border-zinc-700/50 text-xs text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <select
            value={tenantFilter || ''}
            onChange={e => { setTenantFilter(e.target.value || null); setUserFilter(null); }}
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 min-w-[120px]"
          >
            <option value="">Tous comptes</option>
            {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {users.length > 0 && (
            <select
              value={userFilter || ''}
              onChange={e => setUserFilter(e.target.value || null)}
              className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 min-w-[120px]"
            >
              <option value="">Tous utilisateurs</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          )}
          <select value={actionType} onChange={e => setActionType(e.target.value)}
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30">
            <option value="ALL">Toutes actions</option>
            <option value="CREATE">Créations</option>
            <option value="DELETE">Suppressions</option>
            <option value="UPDATE">Modifications</option>
            <option value="LOGIN">Connexions</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            title="Date début"
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 w-[130px]" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            title="Date fin"
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 w-[130px]" />
          {(tenantFilter || userFilter || actionType !== 'ALL' || dateFrom || dateTo) && (
            <button onClick={() => { setTenantFilter(null); setUserFilter(null); setUsers([]); setActionType('ALL'); setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors">
              <X size={12} /> Réinitialiser
            </button>
          )}
          <button onClick={fetchLogs} className="p-2 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-all ml-auto">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Logs list */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center gap-2">
          <Terminal size={14} className="text-zinc-400" />
          <span className="text-xs font-bold text-zinc-400">{filtered.length} entrée(s) affichée(s)</span>
        </div>
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw size={24} className="animate-spin text-zinc-500 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Database size={32} className="text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Aucun log trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-700/20 max-h-[600px] overflow-y-auto">
            {filtered.map((l: any) => (
              <div key={l.id} className="group">
                <div
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  className="px-3 sm:px-5 py-3 flex items-start sm:items-center gap-2 sm:gap-4 hover:bg-zinc-700/20 cursor-pointer transition-colors"
                >
                  {/* Timestamp */}
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-24 sm:w-28">
                    {l.createdAt ? new Date(l.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>

                  {/* Action */}
                  <span className={`text-[10px] font-black font-mono shrink-0 w-32 sm:w-40 truncate ${getActionColor(l.action)}`}>
                    {l.action || '?'}
                  </span>

                  {/* Tenant */}
                  {l.tenantName && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Globe size={11} className="text-zinc-500 shrink-0" />
                      <span className="text-[10px] text-zinc-400 truncate">{l.tenantName}</span>
                    </div>
                  )}

                  {/* User */}
                  {l.userName && (
                    <div className="flex items-center gap-1.5 min-w-0 ml-auto">
                      <User size={11} className="text-zinc-500 shrink-0" />
                      <span className="text-[10px] text-zinc-400 truncate">{l.userName}</span>
                    </div>
                  )}

                  <ChevronDown size={12} className={`text-zinc-600 shrink-0 transition-transform ml-auto ${expanded === l.id ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded detail */}
                {expanded === l.id && (
                  <div className="px-5 pb-4 bg-zinc-900/50">
                    <div className="bg-zinc-950 rounded-xl p-4 font-mono text-[10px] space-y-1.5">
                      {l.description && <p className="text-zinc-300"><span className="text-zinc-600">description:</span> {l.description}</p>}
                      {l.ipAddress && <p className="text-zinc-400"><span className="text-zinc-600">ip:</span> {l.ipAddress}</p>}
                      {l.tenantId && <p className="text-zinc-500"><span className="text-zinc-600">tenantId:</span> {l.tenantId}</p>}
                      {l.userId && <p className="text-zinc-500"><span className="text-zinc-600">userId:</span> {l.userId}</p>}
                      {l.metadata && (
                        <div>
                          <span className="text-zinc-600">metadata:</span>
                          <pre className="text-zinc-400 mt-1 overflow-x-auto">
                            {typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SALogs;
