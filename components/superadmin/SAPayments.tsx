import React, { useState } from 'react';
import {
  Clock, History, Eye, Check, Ban, Search, CreditCard,
  CheckCircle2, AlertTriangle, Wallet, TrendingUp, Filter
} from 'lucide-react';

interface Props {
  tenants: any[];
  plans: any[];
  pendingValidations: any[];
  loading: boolean;
  onValidate: (v: any) => void;
  onReject: (v: any) => void;
  onOpenBilling: (id: string) => void;
  fmt: (n: number) => string;
  fmtDate: (d: any) => string;
}

const SubStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    ACTIVE:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    TRIAL:   'bg-sky-500/15 text-sky-400 border border-sky-500/20',
    PENDING: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    EXPIRED: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    REJECTED:'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${map[status] || 'bg-zinc-500/15 text-zinc-400'}`}>
      {status || '?'}
    </span>
  );
};

const SAPayments: React.FC<Props> = ({
  tenants, plans, pendingValidations, loading, onValidate, onReject, onOpenBilling, fmt, fmtDate
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const filteredTenants = tenants.filter(t => {
    const q = search.toLowerCase();
    if (q && !t.name?.toLowerCase().includes(q) && !t.id?.toLowerCase().includes(q)) return false;
    if (statusFilter !== 'ALL' && t.subscription?.status !== statusFilter) return false;
    if (dateFrom && t.subscription?.nextBillingDate) {
      if (new Date(t.subscription.nextBillingDate) < new Date(dateFrom)) return false;
    }
    if (dateTo && t.subscription?.nextBillingDate) {
      if (new Date(t.subscription.nextBillingDate) > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const resetFilters = () => { setSearch(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); };

  const displayTenants = pageSize === -1 ? filteredTenants : filteredTenants.slice(0, pageSize);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-400" />
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">En attente</p>
          </div>
          <p className="text-2xl font-black text-amber-400">{pendingValidations.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">validations requises</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Actifs</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{tenants.filter(t => t.subscription?.status === 'ACTIVE').length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">abonnements actifs</p>
        </div>
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-sky-400" />
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Essai</p>
          </div>
          <p className="text-2xl font-black text-sky-400">{tenants.filter(t => t.subscription?.status === 'TRIAL').length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">en période d'essai</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-rose-400" />
            <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Expirés</p>
          </div>
          <p className="text-2xl font-black text-rose-400">{tenants.filter(t => t.subscription?.status === 'EXPIRED' || t.subscription?.status === 'REJECTED').length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">expirés / rejetés</p>
        </div>
      </div>

      {/* Section validations en attente */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-700/50 bg-amber-500/5 flex items-center gap-3">
          <Clock size={16} className="text-amber-400 animate-pulse" />
          <h3 className="font-bold text-white">Validations en attente</h3>
          <span className="ml-1 bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full">{pendingValidations.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-700/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-3">Instance</th>
                <th className="px-5 py-3">Plan demandé</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Date demande</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/20">
              {pendingValidations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <CheckCircle2 size={32} className="text-emerald-500/40 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">Aucune validation en attente</p>
                  </td>
                </tr>
              ) : pendingValidations.map((v: any) => (
                <tr key={v.id || v.tenantId} className="hover:bg-zinc-700/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-white text-sm">{v.tenantName || v.tenant?.name || 'Inconnu'}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{v.tenantId || v.id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">{v.planId}</span>
                      {v.period && v.period !== '1M' && (
                        <div>
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                            {v.period === '3M' ? '3 Mois' : v.period === '1Y' ? '1 An' : v.period}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-black text-white">
                        {v.amount
                          ? `${fmt(v.amount)} F`
                          : (() => {
                              const p = plans.find((pl: any) => pl.id === v.planId);
                              return p ? `${fmt(p.priceMonthly)} F` : '—';
                            })()}
                      </span>
                      {v.period && v.period !== '1M' && (
                        <p className="text-[9px] text-zinc-500">
                          {v.period === '3M' ? '(3 mois payés d\'avance)' : v.period === '1Y' ? '(1 an payé d\'avance)' : ''}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    {v.requestedAt ? fmtDate(v.requestedAt) : v.nextBillingDate ? fmtDate(v.nextBillingDate) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onOpenBilling(v.tenantId || v.id)}
                        className="px-3 py-2 bg-zinc-700/50 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Eye size={12} /> Détails
                      </button>
                      <button
                        onClick={() => onValidate(v)}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Check size={12} /> Valider
                      </button>
                      <button
                        onClick={() => onReject(v)}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Ban size={12} /> Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registre abonnements */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-700/50 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <History size={16} className="text-zinc-400" />
              <h3 className="font-bold text-white">Registre des abonnements SaaS</h3>
              <span className="text-[10px] text-zinc-500 font-mono">({filteredTenants.length}/{tenants.length})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))}
                className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-3 py-2 rounded-xl outline-none">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={-1}>Tous</option>
              </select>
            </div>
          </div>
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[130px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
              <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-zinc-900/50 border border-zinc-700/50 text-xs text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30">
              <option value="ALL">Tous statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="TRIAL">Essai</option>
              <option value="PENDING">En attente</option>
              <option value="EXPIRED">Expiré</option>
              <option value="REJECTED">Rejeté</option>
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                title="Date début"
                className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 w-[130px]" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                title="Date fin"
                className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 w-[130px]" />
            </div>
            {(search || statusFilter !== 'ALL' || dateFrom || dateTo) && (
              <button onClick={resetFilters} className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1">
                <Filter size={11} /> Réinitialiser
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-700/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-3">Compte</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-center">Statut abonnement</th>
                <th className="px-5 py-3 text-center">Prochain prélèvement</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/20">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-zinc-500">Chargement...</td></tr>
              ) : displayTenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-5 py-4">
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{t.id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">{t.planName || 'N/A'}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <SubStatusBadge status={t.subscription?.status} />
                  </td>
                  <td className="px-5 py-4 text-center text-xs text-zinc-400">
                    {fmtDate(t.subscription?.nextBillingDate)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onOpenBilling(t.id)}
                        className="px-3 py-2 bg-zinc-700/50 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Eye size={12} /> Détails
                      </button>
                      {t.subscription?.status !== 'ACTIVE' && (
                        <button
                          onClick={() => onValidate({ tenantId: t.id, tenantName: t.name, planId: t.subscription?.planId })}
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                        >
                          <Check size={12} /> Valider
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredTenants.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-zinc-500">Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SAPayments;
