import React, { useState } from 'react';
import {
  TrendingUp, BarChart3, Globe, Users, AlertTriangle, Clock,
  DollarSign, CheckCircle2, TrendingDown, Eye, Check, ArrowUpRight,
  History, Layers, Activity, Calendar, Filter, RefreshCw,
  ArrowDown, ArrowUp, Minus
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell
} from 'recharts';

interface Props {
  data: any;
  tenants: any[];
  plans: any[];
  pendingValidations: any[];
  overdueTenantsRaw: any[];
  onValidate: (v: any) => void;
  onOpenBilling: (id: string) => void;
  onFetchWithPeriod: (year?: number, month?: number, day?: number, week?: number, semester?: number) => void;
  loading: boolean;
  fmt: (n: number) => string;
  fmtDate: (d: any) => string;
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const KpiCard = ({ title, value, icon: Icon, sub, color, trend }: any) => {
  const colorMap: Record<string, { bg: string; icon: string; border: string; glow: string }> = {
    indigo:  { bg: 'from-indigo-500/10 to-indigo-600/5',   icon: 'bg-indigo-500/20 text-indigo-400',   border: 'border-indigo-500/20',  glow: 'shadow-indigo-500/10' },
    violet:  { bg: 'from-violet-500/10 to-violet-600/5',   icon: 'bg-violet-500/20 text-violet-400',   border: 'border-violet-500/20',  glow: 'shadow-violet-500/10' },
    emerald: { bg: 'from-emerald-500/10 to-emerald-600/5', icon: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' },
    sky:     { bg: 'from-sky-500/10 to-sky-600/5',         icon: 'bg-sky-500/20 text-sky-400',         border: 'border-sky-500/20',     glow: 'shadow-sky-500/10' },
    amber:   { bg: 'from-amber-500/10 to-amber-600/5',     icon: 'bg-amber-500/20 text-amber-400',     border: 'border-amber-500/20',   glow: 'shadow-amber-500/10' },
    rose:    { bg: 'from-rose-500/10 to-rose-600/5',       icon: 'bg-rose-500/20 text-rose-400',       border: 'border-rose-500/20',    glow: 'shadow-rose-500/10' },
  };
  const c = colorMap[color] || colorMap.indigo;
  return (
    <div className={`relative bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-5 shadow-lg ${c.glow} hover:scale-[1.02] transition-all duration-200`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
            {trend >= 0 ? <ArrowUpRight size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl font-black text-white">{value}</h3>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
};

const SADashboard: React.FC<Props> = ({
  data, tenants, plans, pendingValidations, overdueTenantsRaw,
  onValidate, onOpenBilling, onFetchWithPeriod, loading, fmt, fmtDate
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
  const [selectedDay, setSelectedDay] = useState<number | ''>('');
  const [activePreset, setActivePreset] = useState<string>('all');

  // ISO week helper
  const getISOWeek = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day  = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };
  const currentWeek     = getISOWeek(now);
  const currentSemester = now.getMonth() < 6 ? 1 : 2;

  const clearSelects = () => { setSelectedYear(''); setSelectedMonth(''); setSelectedDay(''); };

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    clearSelects();
    if (preset === 'today') {
      const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
      setSelectedYear(y); setSelectedMonth(m); setSelectedDay(d);
      onFetchWithPeriod(y, m, d);
    } else if (preset === 'week') {
      onFetchWithPeriod(undefined, undefined, undefined, currentWeek);
    } else if (preset === 'month') {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      setSelectedYear(y); setSelectedMonth(m);
      onFetchWithPeriod(y, m);
    } else if (preset === 'semester') {
      const y = now.getFullYear();
      setSelectedYear(y);
      onFetchWithPeriod(y, undefined, undefined, undefined, currentSemester);
    } else if (preset === 'year') {
      const y = now.getFullYear();
      setSelectedYear(y);
      onFetchWithPeriod(y);
    } else {
      onFetchWithPeriod();
    }
  };

  const applyCustomFilter = () => {
    setActivePreset('custom');
    onFetchWithPeriod(
      selectedYear  ? Number(selectedYear)  : undefined,
      selectedMonth ? Number(selectedMonth) : undefined,
      selectedDay   ? Number(selectedDay)   : undefined,
    );
  };

  const resetFilters = () => {
    clearSelects();
    setActivePreset('all');
    onFetchWithPeriod();
  };

  /* ── Derived values ── */
  const mrr = Number(data?.stats?.mrr || 0);
  const arr = mrr * 12;
  const activeTenants = Number(data?.stats?.activeTenants || 0);
  const arpu = activeTenants > 0 ? mrr / activeTenants : 0;
  const upcomingAlerts: any[] = Array.isArray(data?.subscriptionAlerts) ? data.subscriptionAlerts : [];
  // Revenus SaaS réels : paiements d'abonnement encaissés (saleId IS NULL, status COMPLETED/PAID)
  const totalSubscriptionRevenue = Number(data?.stats?.totalSubscriptionRevenue || 0);
  const totalSubscriptionPending = Number(data?.stats?.totalSubscriptionPending || 0);
  const totalSaasExpected = totalSubscriptionRevenue + totalSubscriptionPending;
  const tauxEncaissementSaas = totalSaasExpected > 0 ? Math.round((totalSubscriptionRevenue / totalSaasExpected) * 100) : (totalSubscriptionRevenue > 0 ? 100 : 0);

  const planRevenue = plans.map((p: any) => ({
    name: p.name,
    count: tenants.filter(t => t.planName === p.name && t.subscription?.status === 'ACTIVE').length,
    revenue: tenants.filter(t => t.planName === p.name && t.subscription?.status === 'ACTIVE').length * (p.priceMonthly || 0)
  })).filter(p => p.count > 0);

  const granularity: string = data?.period?.granularity || 'monthly';

  const revenueChartData = Array.isArray(data?.revenueStats)
    ? data.revenueStats.map((r: any) => ({
        label:     r.label || '',
        total:     Number(r.total     || 0),
        collected: Number(r.collected || 0),
        creances:  Number(r.creances  || 0),
      }))
    : [];

  const chartSubtitle = granularity === 'hourly'  ? `Aujourd'hui — par heure`
    : granularity === 'daily'   ? activePreset === 'week' ? `Semaine ${currentWeek} — par jour` : `Par jour`
    : activePreset === 'semester' ? `Semestre ${currentSemester} ${now.getFullYear()} — par mois`
    : activePreset === 'year'   ? `${now.getFullYear()} — par mois`
    : '6 derniers mois';

  const periodLabel = activePreset === 'today'    ? `Aujourd'hui ${now.toLocaleDateString('fr-FR')}`
    : activePreset === 'week'     ? `Semaine ${currentWeek} — ${now.getFullYear()}`
    : activePreset === 'month'    ? MONTHS_FR[now.getMonth()] + ' ' + now.getFullYear()
    : activePreset === 'semester' ? `Semestre ${currentSemester} — ${now.getFullYear()}`
    : activePreset === 'year'     ? String(now.getFullYear())
    : activePreset === 'custom'   ? [selectedYear, selectedMonth ? MONTHS_FR[Number(selectedMonth)-1] : '', selectedDay].filter(Boolean).join(' / ')
    : 'Toutes périodes';

  /* ── Days for selected month ── */
  const daysInMonth = selectedYear && selectedMonth
    ? new Date(Number(selectedYear), Number(selectedMonth), 0).getDate()
    : 31;

  return (
    <div className="space-y-4 p-3 sm:p-6">

      {/* ══ PERIOD FILTER BAR ══ */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-3 sm:p-4">
        <div className="space-y-3">
          {/* Row 1 : label + presets + badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Filter size={14} />
              <span className="text-xs font-bold text-zinc-300">Période</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'all',      label: 'Tout' },
                { key: 'today',    label: "Auj." },
                { key: 'week',     label: 'Sem.' },
                { key: 'month',    label: 'Mois' },
                { key: 'semester', label: 'Sem.' },
                { key: 'year',     label: 'An' },
              ].map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all ${activePreset === p.key ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 bg-zinc-900/50 border border-zinc-700/50 hover:text-white hover:bg-zinc-700/50'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Active period badge */}
            <div className="ml-auto flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-2.5 py-1.5">
              <Calendar size={11} className="text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-300 truncate max-w-[120px] sm:max-w-none">{periodLabel}</span>
            </div>
          </div>

          {/* Row 2 : Custom selects */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value ? Number(e.target.value) : ''); setActivePreset('custom'); }}
              className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 min-w-[80px]">
              <option value="">Année</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value ? Number(e.target.value) : ''); setActivePreset('custom'); }}
              className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 min-w-[90px]">
              <option value="">Mois</option>
              {MONTHS_FR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={selectedDay} onChange={e => { setSelectedDay(e.target.value ? Number(e.target.value) : ''); setActivePreset('custom'); }}
              className="bg-zinc-900/50 border border-zinc-700/50 text-xs text-zinc-300 px-2.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 min-w-[70px]">
              <option value="">Jour</option>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={applyCustomFilter}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Appliquer</span>
            </button>
            {(selectedYear || selectedMonth || selectedDay) && (
              <button onClick={resetFilters} className="px-2.5 py-2 text-xs text-zinc-400 hover:text-rose-400 transition-colors flex-shrink-0">
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ KPI Row 1 ══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="MRR" value={`${fmt(mrr)} F`} icon={TrendingUp} sub="Revenus mensuels" color="indigo" />
        <KpiCard title="ARR" value={`${fmt(arr)} F`} icon={BarChart3} sub="Projection annuelle" color="violet" />
        <KpiCard title="Clients actifs" value={fmt(activeTenants)} icon={Globe} sub={`/ ${fmt(data?.stats?.totalTenants || 0)} total`} color="sky" />
        <KpiCard title="ARPU" value={`${fmt(Math.round(arpu))} F`} icon={Users} sub="Revenu moyen / client" color="emerald" />
        <KpiCard title="En retard" value={overdueTenantsRaw.length} icon={AlertTriangle} sub="Paiements manquants" color={overdueTenantsRaw.length > 0 ? 'rose' : 'emerald'} />
        <KpiCard title="À valider" value={pendingValidations.length} icon={Clock} sub="Requièrent approbation" color={pendingValidations.length > 0 ? 'amber' : 'emerald'} />
      </div>

      {/* ══ BÉNÉFICES & PERTES ══ */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
        <h4 className="font-bold text-white flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-indigo-400" /> Bénéfices, Pertes & Recouvrement
          <span className="ml-auto text-[10px] text-zinc-500 font-normal">{periodLabel}</span>
        </h4>

        {/* Summary cards — revenus SaaS (abonnements) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Encaissements SaaS */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg"><ArrowUp size={13} className="text-emerald-400" /></div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Encaissements SaaS</p>
            </div>
            <p className="text-xl font-black text-emerald-400">{fmt(totalSubscriptionRevenue)} F</p>
            <p className="text-[10px] text-zinc-500 mt-1">Abonnements validés (période)</p>
          </div>

          {/* Bénéfices = encaissements abonnements */}
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg"><DollarSign size={13} className="text-indigo-400" /></div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Bénéfices</p>
            </div>
            <p className="text-xl font-black text-indigo-300">{fmt(totalSubscriptionRevenue)} F</p>
            <p className="text-[10px] text-zinc-500 mt-1">Revenus réels encaissés</p>
          </div>

          {/* En attente de validation */}
          <div className={`${totalSubscriptionPending > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-zinc-900/60 border-zinc-700/50'} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${totalSubscriptionPending > 0 ? 'bg-amber-500/20' : 'bg-zinc-700/50'}`}>
                <ArrowDown size={13} className={totalSubscriptionPending > 0 ? 'text-amber-400' : 'text-zinc-400'} />
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">En attente</p>
            </div>
            <p className={`text-xl font-black ${totalSubscriptionPending > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>{fmt(totalSubscriptionPending)} F</p>
            <p className="text-[10px] text-zinc-500 mt-1">Abonnements à valider</p>
          </div>

          {/* Taux d'encaissement SaaS */}
          <div className={`${tauxEncaissementSaas >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' : tauxEncaissementSaas >= 50 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-rose-500/5 border-rose-500/20'} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${tauxEncaissementSaas >= 80 ? 'bg-emerald-500/20' : tauxEncaissementSaas >= 50 ? 'bg-amber-500/20' : 'bg-rose-500/20'}`}>
                <Minus size={13} className={tauxEncaissementSaas >= 80 ? 'text-emerald-400' : tauxEncaissementSaas >= 50 ? 'text-amber-400' : 'text-rose-400'} />
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Taux encaissement</p>
            </div>
            <p className={`text-xl font-black ${tauxEncaissementSaas >= 80 ? 'text-emerald-400' : tauxEncaissementSaas >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{tauxEncaissementSaas}%</p>
            <p className="text-[10px] text-zinc-500 mt-1">{totalSubscriptionRevenue > 0 ? 'des abonnements encaissés' : 'Aucun encaissement'}</p>
          </div>
        </div>

        {/* Visual bar */}
        {totalSaasExpected > 0 && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                <span>Encaissé</span>
                <span className="text-emerald-400 font-bold">{tauxEncaissementSaas}%</span>
              </div>
              <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, tauxEncaissementSaas)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                <span>En attente</span>
                <span className="text-amber-400 font-bold">{totalSaasExpected > 0 ? Math.round((totalSubscriptionPending / totalSaasExpected) * 100) : 0}%</span>
              </div>
              <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${totalSaasExpected > 0 ? Math.min(100, Math.round((totalSubscriptionPending / totalSaasExpected) * 100)) : 0}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ RECOUVREMENT ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Comptes SaaS en retard */}
        <div className={`rounded-2xl p-6 border ${overdueTenantsRaw.length > 0 ? 'bg-rose-500/5 border-rose-500/20' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
          <h4 className="font-bold text-white flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className={overdueTenantsRaw.length > 0 ? 'text-rose-400 animate-pulse' : 'text-zinc-500'} />
            Comptes SaaS — Recouvrement
            <span className={`ml-auto text-xs font-black px-2.5 py-1 rounded-full ${overdueTenantsRaw.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {overdueTenantsRaw.length}
            </span>
          </h4>
          {overdueTenantsRaw.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-emerald-500/50 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">Aucun impayé SaaS</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {overdueTenantsRaw.map((t: any) => {
                const planPrice = plans.find(p => p.name === t.planName)?.priceMonthly || 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-zinc-800/80 border border-rose-500/15 rounded-xl hover:border-rose-500/30 transition-all">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-400">{t.planName}</span>
                        {planPrice > 0 && <span className="text-[10px] font-bold text-rose-400">{fmt(planPrice)} F dû</span>}
                        <span className="text-[10px] text-zinc-500">• dernière MàJ: {fmtDate(t.lastPaymentDate)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => onOpenBilling(t.id)}
                        className="p-1.5 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors" title="Voir billing">
                        <Eye size={12} className="text-zinc-300" />
                      </button>
                      <button onClick={() => onValidate({ tenantId: t.id, tenantName: t.name, planId: t.subscription?.planId })}
                        className="p-1.5 bg-emerald-500/20 rounded-lg hover:bg-emerald-500/40 transition-colors" title="Valider paiement">
                        <Check size={12} className="text-emerald-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top débiteurs ERP */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
          <h4 className="font-bold text-white flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-amber-400" /> Top débiteurs (clients ERP)
            <span className="ml-auto text-xs text-zinc-500 font-normal">
              {Array.isArray(data?.topDebtors) ? `${data.topDebtors.length} client(s)` : '0'}
            </span>
          </h4>
          {Array.isArray(data?.topDebtors) && data.topDebtors.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.topDebtors.map((d: any, i: number) => {
                const maxDebt = Math.max(...data.topDebtors.map((x: any) => Number(x.total || 0)));
                const pct = maxDebt > 0 ? Math.round((Number(d.total) / maxDebt) * 100) : 0;
                return (
                  <div key={d.id} className="p-3 bg-zinc-900/60 border border-zinc-700/40 rounded-xl hover:border-amber-500/20 transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-amber-400 w-5">#{i + 1}</span>
                        <p className="text-xs font-semibold text-zinc-300">{d.name || d.customerName}</p>
                      </div>
                      <span className="text-xs font-black text-rose-400">{fmt(d.total)} F</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-emerald-500/50 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">Aucun débiteur ERP</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ Charts Row ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="xl:col-span-2 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" />
                <span className="truncate">Revenus — {periodLabel}</span>
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">{chartSubtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="text-[10px] text-zinc-400">Facturé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[10px] text-zinc-400">Encaissé</span>
              </div>
            </div>
          </div>
          {/* Totaux de la période */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Abonnements SaaS</span>
              <span className="text-sm font-black text-indigo-300">{fmt(totalSubscriptionRevenue)} F</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">En attente</span>
              <span className="text-sm font-black text-amber-400">{fmt(totalSubscriptionPending)} F</span>
            </div>
          </div>
          <div className="h-52">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fontSize: granularity === 'daily' && revenueChartData.length > 14 ? 9 : 11, fill: '#64748b' }}
                    interval={granularity === 'daily' && revenueChartData.length > 14 ? Math.floor(revenueChartData.length / 7) : 0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={55}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                    formatter={(v: any, name: string) => [`${Number(v).toLocaleString('fr-FR')} F`, name === 'total' ? 'Facturé' : 'Encaissé']}
                  />
                  <Area type="monotone" dataKey="total"     stroke="#6366f1" fill="url(#gradRevenue)"   strokeWidth={2} />
                  <Area type="monotone" dataKey="collected" stroke="#10b981" fill="url(#gradCollected)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 size={32} className="text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-xs">Aucune donnée disponible</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validations pending */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
          <h4 className="font-bold text-white flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-400" /> Validations en attente
            {pendingValidations.length > 0 && (
              <span className="ml-auto bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {pendingValidations.length}
              </span>
            )}
          </h4>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {pendingValidations.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 size={32} className="text-emerald-500/50 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Tout est à jour</p>
              </div>
            ) : pendingValidations.slice(0, 6).map((v: any) => {
              const name = v?.tenantName || v?.tenant?.name || 'Inconnu';
              return (
                <div key={v.tenantId || v.id} className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{name}</p>
                    <p className="text-[10px] text-amber-400/70">{v.planId}</p>
                  </div>
                  <button onClick={() => onValidate(v)}
                    className="ml-2 px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1 shrink-0">
                    <Check size={10} /> Valider
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Revenue per plan ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
          <h4 className="font-bold text-white flex items-center gap-2 mb-5">
            <Layers size={16} className="text-violet-400" /> Revenus par offre (MRR)
          </h4>
          <div className="space-y-4">
            {planRevenue.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Aucun compte actif</p>
            ) : planRevenue.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-300">{p.name}</span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white">{fmt(p.revenue)} F</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{p.count} client(s)</span>
                  </div>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${mrr > 0 ? Math.min(100, (p.revenue / mrr) * 100) : 0}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Payments */}
        {Array.isArray(data?.latestPayments) && data.latestPayments.length > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
            <h4 className="font-bold text-white flex items-center gap-2 mb-5">
              <History size={16} className="text-emerald-400" /> Derniers paiements reçus
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-700/50 text-[10px] text-zinc-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Client</th>
                    <th className="pb-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/30">
                  {data.latestPayments.slice(0, 8).map((p: any) => (
                    <tr key={p.id} className="hover:bg-zinc-700/30 transition-colors">
                      <td className="py-3 pr-4 text-zinc-400">{fmtDate(p.createdAt)}</td>
                      <td className="py-3 pr-4 font-medium text-zinc-300">{p.customer || '—'}</td>
                      <td className="py-3 text-right font-black text-emerald-400">{fmt(p.amount)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SADashboard;
