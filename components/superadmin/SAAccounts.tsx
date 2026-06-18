import React, { useState } from 'react';
import {
  Search, Eye, Mail, Check, Ban, Power, Users, Globe,
  Building2, ChevronDown, Filter, X, ExternalLink,
  KeyRound, Loader2, ShieldCheck, UserCircle, RefreshCw
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

interface Props {
  tenants: any[];
  plans: any[];
  loading: boolean;
  onOpenBilling: (id: string) => void;
  onEmail: (tenantId: string, tenantName: string, subject?: string, body?: string) => void;
  onToggleLock: (tenantId: string, tenantName: string, currentStatus: boolean) => void;
  onValidate: (v: any) => void;
  fmt: (n: number) => string;
  fmtDate: (d: any) => string;
}

const PaymentBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    UP_TO_DATE: { label: 'À JOUR', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' },
    TRIAL:      { label: 'ESSAI',   cls: 'bg-sky-500/15 text-sky-400 border border-sky-500/25' },
    PENDING:    { label: 'EN ATTENTE', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' },
    REJECTED:   { label: 'REJETÉ', cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/25' },
    OVERDUE:    { label: 'RETARD',  cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/25' },
  };
  const s = map[status] || { label: status || '?', cls: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/25' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${s.cls}`}>{s.label}</span>
  );
};

const SAAccounts: React.FC<Props> = ({
  tenants, plans, loading, onOpenBilling, onEmail, onToggleLock, onValidate, fmt, fmtDate
}) => {
  const showToast = useToast();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'lastPayment'>('name');

  // Users panel
  const [usersPanel, setUsersPanel] = useState<{ tenant: any; users: any[] } | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  // Reset password modal
  const [resetModal, setResetModal] = useState<{ user: any; tenantId: string; tenantName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const openUsersPanel = async (tenant: any) => {
    setUsersLoading(true);
    setUsersPanel({ tenant, users: [] });
    try {
      const res = await apiClient.get(`/admin/tenants/${tenant.id}/users`);
      setUsersPanel({ tenant, users: Array.isArray(res) ? res : [] });
    } catch (e: any) {
      showToast(e?.message || 'Erreur chargement utilisateurs', 'error');
      setUsersPanel(null);
    } finally { setUsersLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal) return;
    if (newPassword.length < 6) { showToast('Minimum 6 caractères', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
    setResetLoading(true);
    try {
      const res: any = await apiClient.put(
        `/admin/tenants/${resetModal.tenantId}/users/${resetModal.user.id}/reset-password`,
        { newPassword }
      );
      showToast(res?.message || 'Mot de passe réinitialisé', 'success');
      setResetModal(null); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) { showToast(e?.message || 'Erreur reset', 'error'); }
    finally { setResetLoading(false); }
  };
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = tenants
    .filter(t => {
      const nameMatch = t.name?.toLowerCase().includes(search.toLowerCase()) || t.domain?.toLowerCase().includes(search.toLowerCase());
      const planMatch = planFilter === 'ALL' || t.planName === planFilter;
      const statusMatch = statusFilter === 'ALL' ||
        (statusFilter === 'UP_TO_DATE' && t.paymentStatus === 'UP_TO_DATE') ||
        (statusFilter === 'TRIAL' && t.paymentStatus === 'TRIAL') ||
        (statusFilter === 'OVERDUE' && (t.paymentStatus === 'PENDING' || t.paymentStatus === 'REJECTED')) ||
        (statusFilter === 'LOCKED' && !t.isActive);
      return nameMatch && planMatch && statusMatch;
    })
    .sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase() || ''; vb = b.name?.toLowerCase() || ''; }
      else if (sortBy === 'createdAt') { va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime(); }
      else { va = new Date(a.lastPaymentDate || 0).getTime(); vb = new Date(b.lastPaymentDate || 0).getTime(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  return (
    <>
    <div className="space-y-4 p-3 sm:p-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total comptes', value: tenants.length, color: 'text-indigo-400' },
          { label: 'Actifs', value: tenants.filter(t => t.isActive && t.paymentStatus === 'UP_TO_DATE').length, color: 'text-emerald-400' },
          { label: 'En essai', value: tenants.filter(t => t.paymentStatus === 'TRIAL').length, color: 'text-sky-400' },
          { label: 'En retard', value: tenants.filter(t => t.paymentStatus === 'PENDING' || t.paymentStatus === 'REJECTED').length, color: 'text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Rechercher par nom, domaine..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/50 border border-zinc-700/50 text-sm text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
            />
          </div>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="ALL">Toutes les offres</option>
            {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="UP_TO_DATE">À jour</option>
            <option value="TRIAL">Essai</option>
            <option value="OVERDUE">En retard</option>
            <option value="LOCKED">Verrouillé</option>
          </select>
          <span className="text-xs text-zinc-400 bg-zinc-700/50 px-3 py-2.5 rounded-xl">
            {filtered.length} résultat(s)
          </span>
          <div className="flex items-center gap-1 bg-zinc-900/50 border border-zinc-700/50 rounded-xl overflow-hidden">
            {([['name','Nom'],['createdAt','Date créa.'],['lastPayment','Dernier pmt']] as const).map(([col, lbl]) => (
              <button key={col} onClick={() => toggleSort(col as typeof sortBy)}
                className={`px-3 py-2.5 text-[10px] font-bold transition-all flex items-center gap-1 ${sortBy === col ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
                {lbl}
                {sortBy === col && (sortDir === 'asc' ? <ChevronDown size={10} className="rotate-180" /> : <ChevronDown size={10} />)}
              </button>
            ))}
          </div>
          {(search || planFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setSearch(''); setPlanFilter('ALL'); setStatusFilter('ALL'); }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile: cards ── Desktop: table ── */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">

        {/* Mobile card list (< md) */}
        <div className="md:hidden">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Chargement...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <Globe size={32} className="text-zinc-600" />
              <p className="text-sm text-zinc-500">Aucun compte trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-700/30">
              {filtered.map((t: any) => (
                <div key={t.id} className="p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${t.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{t.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{t.domain}</p>
                      </div>
                    </div>
                    <PaymentBadge status={t.paymentStatus} />
                  </div>
                  {/* Info row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">{t.planName || 'N/A'}</span>
                    <span className="text-[10px] text-zinc-400">{t.userCount} / {t.planMaxUsers || '∞'} users</span>
                    <span className="text-[10px] text-zinc-500">{fmtDate(t.lastPaymentDate)}</span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => openUsersPanel(t)} className="p-2 bg-violet-500/10 rounded-lg text-violet-400" title="Utilisateurs"><Users size={13} /></button>
                    <button onClick={() => onOpenBilling(t.id)} className="p-2 bg-zinc-700/50 rounded-lg text-zinc-400" title="Billing"><Eye size={13} /></button>
                    <button onClick={() => onEmail(t.id, t.name)} className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400" title="Email"><Mail size={13} /></button>
                    {t.paymentStatus === 'PENDING' && (
                      <button onClick={() => onValidate({ tenantId: t.id, tenantName: t.name, planId: t.subscription?.planId })}
                        className="flex-1 py-2 bg-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Check size={12} /> Valider
                      </button>
                    )}
                    <button onClick={() => onToggleLock(t.id, t.name, t.isActive)}
                      className={`p-2 rounded-lg ml-auto ${t.isActive ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                      title={t.isActive ? 'Verrouiller' : 'Déverrouiller'}>
                      {t.isActive ? <Ban size={13} /> : <Power size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-700/50 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-4">Entreprise</th>
                <th className="px-5 py-4">Offre</th>
                <th className="px-5 py-4 text-center">Utilisateurs</th>
                <th className="px-5 py-4 text-center">Paiement</th>
                <th className="px-5 py-4 text-center">Statut compte</th>
                <th className="px-5 py-4 text-center">Dernier paiement</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                      <p className="text-sm text-zinc-500">Chargement...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Globe size={32} className="text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">Aucun compte trouvé</p>
                  </td>
                </tr>
              ) : filtered.map((t: any) => (
                <tr key={t.id} className="hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400 shadow-sm shadow-rose-400/50'}`} />
                      <div>
                        <p className="text-sm font-bold text-white">{t.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{t.domain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">{t.planName || 'N/A'}</span>
                    {t.subscription?.planDetails?.priceMonthly > 0 && (
                      <p className="text-[10px] text-zinc-500 mt-1">{fmt(t.subscription.planDetails.priceMonthly)} F/mois</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-sm font-black text-white">{t.userCount}</span>
                    <span className="text-[10px] text-zinc-500"> / {t.planMaxUsers || '∞'}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <PaymentBadge status={t.paymentStatus} />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${t.isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                      {t.isActive ? '● ACTIF' : '● VERROUILLÉ'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-xs text-zinc-400">{fmtDate(t.lastPaymentDate)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openUsersPanel(t)} className="p-2 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg text-violet-400 hover:text-violet-300 transition-all" title="Gérer les utilisateurs"><Users size={13} /></button>
                      <button onClick={() => onOpenBilling(t.id)} className="p-2 bg-zinc-700/50 hover:bg-zinc-600 rounded-lg text-zinc-400 hover:text-white transition-all" title="Détails billing"><Eye size={13} /></button>
                      <button onClick={() => onEmail(t.id, t.name)} className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all" title="Envoyer email"><Mail size={13} /></button>
                      {t.paymentStatus === 'PENDING' && (
                        <button onClick={() => onValidate({ tenantId: t.id, tenantName: t.name, planId: t.subscription?.planId })} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-emerald-300 transition-all" title="Valider paiement"><Check size={13} /></button>
                      )}
                      <button onClick={() => onToggleLock(t.id, t.name, t.isActive)} className={`p-2 rounded-lg transition-all ${t.isActive ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300'}`} title={t.isActive ? 'Verrouiller' : 'Déverrouiller'}>
                        {t.isActive ? <Ban size={13} /> : <Power size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ══ USERS PANEL (slide-in) ══ */}
    {usersPanel && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-stretch justify-end bg-black/60 backdrop-blur-sm">
        <div className="w-full sm:max-w-lg sm:h-full bg-zinc-900 border-t sm:border-t-0 sm:border-l border-zinc-700/50 flex flex-col shadow-2xl rounded-t-3xl sm:rounded-none max-h-[90vh] sm:max-h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-700/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <h3 className="font-black text-white">{usersPanel.tenant.name}</h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Utilisateurs du compte · {usersPanel.users.length} trouvé(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openUsersPanel(usersPanel.tenant)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all" title="Actualiser">
                <RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setUsersPanel(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Users list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {usersLoading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Loader2 size={28} className="animate-spin text-violet-400" />
                <p className="text-xs text-zinc-500">Chargement des utilisateurs...</p>
              </div>
            ) : usersPanel.users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <UserCircle size={36} className="text-zinc-600" />
                <p className="text-sm text-zinc-500">Aucun utilisateur trouvé</p>
              </div>
            ) : usersPanel.users.map((u: any) => {
              const roleColor: Record<string, string> = {
                OWNER: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                ADMIN: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                MANAGER: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                EMPLOYEE: 'text-zinc-300 bg-zinc-700/50 border-zinc-600/50',
              };
              const roleCls = roleColor[u.role] || roleColor.EMPLOYEE;
              return (
                <div key={u.id} className="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl p-4 hover:border-zinc-600/60 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-violet-300">
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{u.email}</p>
                        {u.lastLogin && (
                          <p className="text-[9px] text-zinc-600 mt-0.5">
                            Dernière connexion: {new Date(u.lastLogin).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${roleCls}`}>
                        {u.role}
                      </span>
                      <button
                        onClick={() => { setResetModal({ user: u, tenantId: usersPanel.tenant.id, tenantName: usersPanel.tenant.name }); setNewPassword(''); setConfirmPassword(''); setShowPwd(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-xl transition-all"
                        title="Réinitialiser le mot de passe"
                      >
                        <KeyRound size={11} /> Reset MDP
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* ══ RESET PASSWORD MODAL ══ */}
    {resetModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center">
              <KeyRound size={18} className="text-rose-400" />
            </div>
            <div>
              <h3 className="font-black text-white">Réinitialiser le mot de passe</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                <span className="text-violet-400 font-bold">{resetModal.user.name}</span>
                {' '}· {resetModal.tenantName}
              </p>
            </div>
            <button onClick={() => setResetModal(null)} className="ml-auto p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
              <X size={16} />
            </button>
          </div>

          {/* User info recap */}
          <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-3 mb-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <span className="text-xs font-black text-violet-300">{(resetModal.user.name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{resetModal.user.name}</p>
              <p className="text-[10px] text-zinc-400">{resetModal.user.email}</p>
            </div>
            <span className="ml-auto text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {resetModal.user.role}
            </span>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                Nouveau mot de passe *
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères..."
                  required
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-bold">
                  {showPwd ? 'CACHER' : 'VOIR'}
                </button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-[10px] text-rose-400 mt-1">Au moins 6 caractères requis</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                Confirmer le mot de passe *
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Répéter le mot de passe..."
                required
                className={`w-full bg-zinc-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 transition-all ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-rose-500/50 focus:ring-rose-500/30'
                    : confirmPassword && confirmPassword === newPassword
                    ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                    : 'border-zinc-700/50 focus:ring-rose-500/30'
                }`}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-rose-400 mt-1">Les mots de passe ne correspondent pas</p>
              )}
              {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck size={10} /> Mots de passe identiques
                </p>
              )}
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <p className="text-[10px] text-amber-400/80">
                ⚠ L'utilisateur devra utiliser ce nouveau mot de passe à sa prochaine connexion. Cette action est enregistrée dans les logs d'audit.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setResetModal(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all">
                Annuler
              </button>
              <button type="submit" disabled={resetLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Réinitialiser
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
};

export default SAAccounts;
