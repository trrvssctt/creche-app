import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, ChevronRight, ArrowRight,
  Receipt, Percent, CreditCard, Banknote,
  PiggyBank, FileText, MessageSquare,
  Users, BarChart2, CalendarDays,
  CheckCircle2, Clock, Target,
  Landmark, ArrowDownRight, ArrowUpRight,
  Layers, DollarSign,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { apiClient } from '../services/api';
import { User } from '../types';

const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

interface Props {
  user: User;
  currency: string;
  onNavigate?: (tab: string, meta?: any) => void;
}

const GradientKpi = ({ icon: Icon, label, value, sub, gradient, onClick, badge }: any) => (
  <div
    onClick={onClick}
    className={`${gradient} rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
  >
    <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={80} className="text-white" />
    </div>
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-white" />
      </div>
      {badge && (
        <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
    <div>
      <p className="text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">{label}</p>
      {sub && <p className="text-[9px] text-white/60 font-semibold mt-0.5">{sub}</p>}
    </div>
  </div>
);

const KpiCard = ({ icon: Icon, label, value, sub, color, trend, onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between overflow-hidden relative group ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all' : ''}`}
  >
    <div className="absolute -right-2 -top-2 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
      <Icon size={80} />
    </div>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
      </div>
      {trend === 'up' && <TrendingUp size={14} className="text-emerald-500 mt-1" />}
      {trend === 'down' && <TrendingDown size={14} className="text-rose-500 mt-1" />}
    </div>
    <div>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
      {sub && <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{sub}</p>}
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, label, color = 'text-slate-700' }: any) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={16} className={color} />
    <h3 className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</h3>
  </div>
);

const TRANCHE_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  '0':      { bar: 'from-sky-300 to-sky-500',       text: 'text-sky-700',    bg: 'bg-sky-50' },
  '1-30':   { bar: 'from-amber-300 to-amber-500',   text: 'text-amber-700',  bg: 'bg-amber-50' },
  '31-60':  { bar: 'from-orange-400 to-orange-600',  text: 'text-orange-700', bg: 'bg-orange-50' },
  '61-90':  { bar: 'from-red-400 to-red-600',        text: 'text-red-700',    bg: 'bg-red-50' },
  '91-180': { bar: 'from-rose-500 to-rose-700',      text: 'text-rose-700',   bg: 'bg-rose-50' },
  '>180':   { bar: 'from-rose-600 to-rose-900',      text: 'text-rose-900',   bg: 'bg-rose-100' },
};
const TRANCHE_LABELS: Record<string, string> = {
  '0': 'Mois en cours', '1-30': '1-30 jours', '31-60': '31-60 jours',
  '61-90': '61-90 jours', '91-180': '91-180 jours', '>180': '> 180 jours',
};

const METHOD_COLORS: Record<string, string> = {
  CASH: '#10b981', MOBILE_MONEY: '#f59e0b', VIREMENT: '#3b82f6',
  CHEQUE: '#8b5cf6', WAVE: '#06b6d4', ORANGE_MONEY: '#f97316', CARTE: '#6366f1',
};
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money', VIREMENT: 'Virement',
  CHEQUE: 'Chèque', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', CARTE: 'Carte',
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1', '#ef4444'];

const ComptableDashboard: React.FC<Props> = ({ user, currency, onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [encaissements, setEncaissements] = useState<any>(null);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dashRes, encRes, cashRes, debtRes] = await Promise.all([
        apiClient.get('/finance-v2/dashboard').catch(() => null),
        apiClient.get('/finance-v2/encaissements').catch(() => null),
        apiClient.get('/finance-v2/cash-sessions').catch(() => null),
        apiClient.get('/recovery/debtors').catch(() => null),
      ]);
      setData(dashRes?.data || dashRes || {});
      setEncaissements(encRes?.data || encRes || {});
      setCashSessions(Array.isArray(cashRes?.data || cashRes) ? (cashRes?.data || cashRes) : []);
      setDebtors(Array.isArray(debtRes?.data || debtRes) ? (debtRes?.data || debtRes) : []);
    } catch (e) {
      console.error('ComptableDashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';
  const todayStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const ca = data?.caEngagement || {};
  const bal = data?.balanceAgee || {};
  const crea = data?.creancesAEchoir || {};
  const caComptable = data?.caComptable || {};

  const caNet = parseFloat(ca.caNet || 0);
  const totalEncaisse = parseFloat(ca.totalEncaisse || 0);
  const resteAEncaisser = parseFloat(ca.resteAEncaisser || 0);
  const tauxEncaissement = parseFloat(ca.tauxEncaissement || 0);
  const nbInscrits = parseInt(ca.nbInscrits || 0);
  const totalBourses = parseFloat(ca.totalBourses || 0);

  const totalImpaye = parseFloat(bal.totalImpaye || 0);
  const balanceAgee: any[] = bal.tranches || [];

  const totalAEchoir = parseFloat(crea.total || 0);
  const creancesAEchoir: any[] = crea.mois || [];

  const caComptableDetails: any[] = caComptable.details || [];

  const encTotal = parseFloat(encaissements?.total || 0);
  const encParMethode = encaissements?.parMethode || {};

  const openSessions = cashSessions.filter((s: any) => !s.closedAt && !s.closed_at);

  const pieData = useMemo(() => {
    return Object.entries(encParMethode)
      .filter(([, v]) => Number(v) > 0)
      .map(([method, value], i) => ({
        name: METHOD_LABELS[method] || method,
        value: Number(value),
        color: METHOD_COLORS[method] || PIE_COLORS[i % PIE_COLORS.length],
      }));
  }, [encParMethode]);

  const chartComptable = useMemo(() => {
    return caComptableDetails.map((r: any) => ({
      mois: r.mois ? new Date(r.mois + '-01').toLocaleDateString('fr-FR', { month: 'short' }) : '—',
      facture: parseFloat(r.ca_comptable || 0),
      encaisse: parseFloat(r.encaisse || 0),
    }));
  }, [caComptableDetails]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">Chargement du tableau de bord comptable…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{todayStr}</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              {(user.name || user.email || '').split(' ')[0]}
            </span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            <span className="text-teal-600 font-black">Espace Comptable</span>
            {nbInscrits > 0 && <>{' · '}{nbInscrits} élèves inscrits</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
          {openSessions.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {openSessions.length} caisse{openSessions.length > 1 ? 's' : ''} ouverte{openSessions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs gradient — ligne 1 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientKpi
          icon={Landmark}
          label="CA net engagé"
          value={fmt(caNet)}
          sub={`${nbInscrits} élèves · ${fmt(parseFloat(ca.caBrut || 0))} brut`}
          gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
          onClick={() => onNavigate?.('facturation')}
          badge={currency}
        />
        <GradientKpi
          icon={ArrowDownRight}
          label="Total encaissé"
          value={fmt(totalEncaisse)}
          sub="Tous modes de paiement confondus"
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
          onClick={() => onNavigate?.('payments')}
          badge={currency}
        />
        <GradientKpi
          icon={ArrowUpRight}
          label="Reste à encaisser"
          value={fmt(resteAEncaisser)}
          sub={`${fmt(totalAEchoir)} ${currency} à échoir`}
          gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
          onClick={() => onNavigate?.('facturation')}
          badge={currency}
        />
        <GradientKpi
          icon={Percent}
          label="Taux de recouvrement"
          value={`${Math.round(tauxEncaissement)}%`}
          sub={tauxEncaissement >= 80 ? 'Bon niveau de recouvrement' : tauxEncaissement >= 50 ? 'À surveiller' : 'Situation critique'}
          gradient={tauxEncaissement >= 80
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : tauxEncaissement >= 50
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-rose-500 to-red-600'}
          onClick={() => onNavigate?.('recovery')}
        />
      </div>

      {/* ── KPIs secondaires — ligne 2 ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={AlertTriangle}
          label="Impayé total"
          value={`${fmt(totalImpaye)}`}
          sub={`${balanceAgee.reduce((s: number, r: any) => s + parseInt(r.nb_eleves || 0), 0)} élève(s) concerné(s)`}
          color={totalImpaye > 0 ? 'bg-rose-500' : 'bg-emerald-500'}
          trend={totalImpaye > 0 ? 'down' : 'up'}
          onClick={() => onNavigate?.('recovery')}
        />
        <KpiCard
          icon={PiggyBank}
          label="Bourses / Réductions"
          value={fmt(totalBourses)}
          sub={`${currency} de bourses accordées`}
          color="bg-violet-500"
        />
        <KpiCard
          icon={Banknote}
          label="Encaissements période"
          value={fmt(encTotal)}
          sub={`${pieData.length} mode${pieData.length > 1 ? 's' : ''} de paiement`}
          color="bg-teal-500"
          onClick={() => onNavigate?.('payments')}
        />
        <KpiCard
          icon={Layers}
          label="Sessions caisse"
          value={cashSessions.length}
          sub={`${openSessions.length} ouverte${openSessions.length > 1 ? 's' : ''}`}
          color={openSessions.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'}
        />
      </div>

      {/* ── CA Comptable + Encaissements par méthode ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* CA Comptable mensuel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionTitle icon={BarChart2} label="CA comptable mensuel" color="text-teal-600" />
            <button onClick={() => onNavigate?.('facturation')} className="text-[9px] font-black text-teal-600 flex items-center gap-1 hover:underline">
              Facturation <ChevronRight size={10} />
            </button>
          </div>
          {chartComptable.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <BarChart2 size={32} className="text-slate-200" />
              <p className="text-[10px] font-bold text-slate-400">Aucune donnée comptable disponible</p>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartComptable} barSize={14} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
                    formatter={(v: any, name: string) => [`${fmt(v)} ${currency}`, name === 'facture' ? 'Facturé' : 'Encaissé']}
                  />
                  <Bar dataKey="facture" name="facture" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="encaisse" name="encaisse" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {chartComptable.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-300" />
                <span className="text-[9px] font-bold text-slate-500">Facturé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-500" />
                <span className="text-[9px] font-bold text-slate-500">Encaissé</span>
              </div>
            </div>
          )}
        </div>

        {/* Encaissements par méthode */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={CreditCard} label="Par méthode" color="text-emerald-600" />
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <DollarSign size={32} className="text-slate-200" />
              <p className="text-[10px] font-bold text-slate-400">Aucun encaissement</p>
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }}
                      formatter={(v: any) => [`${fmt(Number(v))} ${currency}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-[10px] font-bold text-slate-600">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-800">{fmt(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Balance Âgée + Top Débiteurs ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Balance Âgée */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={BarChart2} label="Balance âgée" color="text-rose-600" />
            <button onClick={() => onNavigate?.('recovery')} className="text-[9px] font-black text-rose-600 flex items-center gap-1 hover:underline">
              Recouvrement <ArrowRight size={9} />
            </button>
          </div>
          {balanceAgee.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-[11px] font-black text-emerald-700">Aucun impayé en cours</p>
              <p className="text-[9px] text-slate-400 font-semibold">Tous les paiements sont à jour</p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {(() => {
                  const maxImpaye = Math.max(...balanceAgee.map((r: any) => parseFloat(r.total_impaye || 0)));
                  return balanceAgee.map((row: any, i: number) => {
                    const amt = parseFloat(row.total_impaye || 0);
                    const barW = pct(amt, maxImpaye);
                    const colors = TRANCHE_COLORS[row.tranche] || TRANCHE_COLORS['1-30'];
                    return (
                      <div key={i} className={`p-3 rounded-2xl ${colors.bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-black ${colors.text}`}>{TRANCHE_LABELS[row.tranche] || row.tranche}</span>
                          <span className="text-[10px] font-black text-slate-800">{fmt(amt)} {currency}</span>
                        </div>
                        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all`} style={{ width: `${barW}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[8px] font-semibold text-slate-400">{row.nb_eleves} élève(s)</span>
                          <span className="text-[8px] font-semibold text-slate-400">{row.nb_echeances} échéance(s)</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total impayé</span>
                <span className="text-sm font-black text-rose-600">{fmt(totalImpaye)} {currency}</span>
              </div>
            </>
          )}
        </div>

        {/* Top Débiteurs */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={Users} label="Principaux débiteurs" color="text-amber-600" />
            <button onClick={() => onNavigate?.('recovery')} className="text-[9px] font-black text-amber-600 flex items-center gap-1 hover:underline">
              Voir tout <ArrowRight size={9} />
            </button>
          </div>
          {debtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-[11px] font-black text-emerald-700">Aucun débiteur</p>
              <p className="text-[9px] text-slate-400 font-semibold">Tous les comptes sont soldés</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {debtors.slice(0, 8).map((d: any, i: number) => {
                const dette = parseFloat(d.totalDue || d.dette || d.outstanding || 0);
                const maxDette = Math.max(...debtors.slice(0, 8).map((x: any) => parseFloat(x.totalDue || x.dette || x.outstanding || 0)));
                const barW = pct(dette, maxDette);
                return (
                  <div key={i} className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-[10px] font-black text-slate-800 truncate">{d.customerName || d.nom || d.name || d.companyName || '—'}</p>
                      </div>
                      <span className="text-[10px] font-black text-rose-600 flex-shrink-0 ml-2">{fmt(dette)} {currency}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden ml-9">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Créances à Échoir ────────────────────────────────────────────────── */}
      {creancesAEchoir.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={CalendarDays} label="Créances à échoir" color="text-blue-600" />
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-400">Total : {fmt(totalAEchoir)} {currency}</span>
              <button onClick={() => onNavigate?.('facturation')} className="text-[9px] font-black text-blue-600 flex items-center gap-1 hover:underline">
                Facturation <ArrowRight size={9} />
              </button>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creancesAEchoir.map((r: any) => ({
                mois: r.mois ? new Date(r.mois + '-01').toLocaleDateString('fr-FR', { month: 'short' }) : '—',
                total: parseFloat(r.total || 0),
                nb: parseInt(r.nb_echeances || 0),
              }))} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
                  formatter={(v: any) => [`${fmt(v)} ${currency}`, 'À encaisser']}
                />
                <Bar dataKey="total" name="À encaisser" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                  {creancesAEchoir.map((_: any, i: number) => (
                    <Cell key={i} fill={i === 0 ? '#6366f1' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Sessions Caisse Récentes ─────────────────────────────────────────── */}
      {cashSessions.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={Banknote} label="Dernières sessions caisse" color="text-emerald-600" />
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b-2 border-slate-50">
                  {['Ouverture', 'Opérateur', 'Solde ouverture', 'Solde clôture', 'Écart', 'Statut'].map((h, i) => (
                    <th key={i} className={`${i >= 2 ? 'text-right' : 'text-left'} font-black text-slate-300 uppercase tracking-widest pb-3 pr-3`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashSessions.slice(0, 5).map((s: any, i: number) => {
                  const isOpen = !s.closedAt && !s.closed_at;
                  const openBal = parseFloat(s.openingBalance || s.opening_balance || 0);
                  const closeBal = parseFloat(s.closingBalance || s.closing_balance || 0);
                  const diff = parseFloat(s.difference || 0);
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-3 font-bold text-slate-600">
                        {new Date(s.openedAt || s.opened_at || s.createdAt || s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-500">{s.opener?.name || s.openerName || '—'}</td>
                      <td className="py-2.5 pr-3 text-right font-black text-slate-800">{fmt(openBal)}</td>
                      <td className="py-2.5 pr-3 text-right font-black text-slate-800">{isOpen ? '—' : fmt(closeBal)}</td>
                      <td className={`py-2.5 pr-3 text-right font-black ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isOpen ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {isOpen ? 'Ouverte' : 'Clôturée'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Actions rapides ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <SectionTitle icon={Target} label="Actions rapides" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { icon: Receipt,       label: 'Facturation\nscolaire',  tab: 'facturation',   color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100' },
            { icon: Wallet,        label: 'Encaisser\nun paiement', tab: 'payments',      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100' },
            { icon: AlertTriangle, label: 'Recouvrement\nimpayés',  tab: 'recovery',      color: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100' },
            { icon: MessageSquare, label: 'Relance\nWhatsApp',      tab: 'whatsapp',      color: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-100' },
            { icon: FileText,      label: 'Fiches\nde paie',        tab: 'rh',            color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100' },
            { icon: Clock,         label: 'Mon\npointage',          tab: 'employee-pointage', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100' },
          ].map(({ icon: Icon, label, tab, color }) => (
            <button
              key={tab}
              onClick={() => onNavigate?.(tab)}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-colors text-center border ${color}`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-wide leading-tight whitespace-pre-line">{label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ComptableDashboard;
