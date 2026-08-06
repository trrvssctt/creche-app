import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Landmark, Wallet, TrendingUp, AlertTriangle, Clock, CheckCircle2,
  Users, Calendar, Search, RefreshCw, Download,
  Banknote, Smartphone, FileText,
  BarChart3, Eye, Zap, DollarSign, ArrowRight, X,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAnnee } from '../contexts/AnneeContext';
import { useToast } from './ToastProvider';

const fmtAmt = (n: number | string) => Number(n || 0).toLocaleString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const METHOD_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  CASH:         { label: 'Especes',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Banknote },
  WAVE:         { label: 'Wave',         color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200', icon: Zap },
  MOBILE_MONEY: { label: 'Mobile Money', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',icon: Smartphone },
  CHEQUE:       { label: 'Cheque',       color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',  icon: FileText },
  ORANGE_MONEY: { label: 'Orange Money', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', icon: Smartphone },
  TRANSFER:     { label: 'Virement',     color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',    icon: Landmark },
};

const AGING_LABELS: Record<string, string> = {
  '0': 'Mois en cours', '1-30': '1-30 jours', '31-60': '31-60 jours', '61-90': '61-90 jours',
  '91-180': '91-180 jours', '>180': '> 180 jours',
};
const AGING_COLORS: Record<string, { text: string; bg: string; bar: string }> = {
  '0':     { text: 'text-sky-700',    bg: 'bg-sky-50',    bar: 'bg-sky-500' },
  '1-30':  { text: 'text-amber-700',  bg: 'bg-amber-50',  bar: 'bg-amber-500' },
  '31-60': { text: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  '61-90': { text: 'text-rose-700',   bg: 'bg-rose-50',   bar: 'bg-rose-500' },
  '91-180':{ text: 'text-red-700',    bg: 'bg-red-50',    bar: 'bg-red-600' },
  '>180':  { text: 'text-slate-900',  bg: 'bg-slate-100', bar: 'bg-slate-900' },
};

const TABS = [
  { id: 'synthese', label: 'Synthese', icon: BarChart3 },
  { id: 'journal', label: 'Journal', icon: FileText },
  { id: 'balance', label: 'Balance Agee', icon: AlertTriangle },
  { id: 'creances', label: 'Creances', icon: Clock },
  { id: 'ca', label: 'CA Comptable', icon: TrendingUp },
] as const;

type TabId = typeof TABS[number]['id'];

const MethodBadge = ({ method }: { method: string }) => {
  const m = METHOD_META[method] || { label: method, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: DollarSign };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${m.bg} ${m.color} ${m.border}`}>
      <Icon size={8}/> {m.label}
    </span>
  );
};

const Payments = ({ currency, tenantSettings }: { currency: string; tenantSettings?: any }) => {
  const { annee: anneeScolaire } = useAnnee();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('synthese');

  const [dashData, setDashData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [encaissementsV2, setEncaissementsV2] = useState<any>(null);
  const [caComptableV2, setCaComptableV2] = useState<any>(null);

  const currentCivilYear = new Date().getFullYear();
  const [civilYear, setCivilYear] = useState(currentCivilYear);
  const civilYearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentCivilYear - 2; y <= currentCivilYear + 1; y++) years.push(y);
    return years;
  }, [currentCivilYear]);

  const [journalFilters, setJournalFilters] = useState({ search: '', dateFrom: '', dateTo: '', method: 'ALL' });
  const [journalPageSize, setJournalPageSize] = useState(30);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDates, setExportDates] = useState({
    from: new Date(currentCivilYear, new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const dash = await apiClient.get('/school-dashboard');
      setDashData(dash);
    } catch {
      toast('Erreur chargement tableau de bord', 'error');
    }
    try {
      const salesData = await apiClient.get('/sales', { params: { anneeScolaire } }) as any[];
      const all = salesData.flatMap((sale: any) =>
        (sale.payments || []).map((p: any) => ({
          ...p,
          saleRef: sale.reference,
          customer: sale.customer?.companyName || sale.customer?.name || sale.walkinName || 'Vente Directe',
          saleStatus: sale.status,
        }))
      ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(all);
    } catch { /* sales may fail silently */ }
    try {
      const enc = await apiClient.get('/finance-v2/encaissements');
      setEncaissementsV2(enc);
    } catch { /* v2 may not be set up */ }
    try {
      const ca = await apiClient.get('/finance-v2/ca-comptable', { params: { civilYear } });
      setCaComptableV2(ca);
    } catch { /* v2 may not be set up */ }
    setLoading(false);
    setRefreshing(false);
  }, [anneeScolaire, civilYear, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fv2 = dashData?.financeV2 || {};
  const ecs = dashData?.echeancesStats || {};
  const fs = dashData?.financeStats || {};

  const caEngagement = useMemo(() => parseFloat(fv2.caEngagementNet || 0), [fv2]);
  const totalEncaisse = useMemo(() => parseFloat(ecs.total_encaisse || 0), [ecs]);
  const totalFacture = useMemo(() => parseFloat(ecs.total_facture || 0), [ecs]);
  const totalAEchoir = useMemo(() => parseFloat(fv2.totalAEchoir || 0), [fv2]);
  const totalImpaye = useMemo(() => parseFloat(fv2.totalImpaye || 0), [fv2]);
  const balanceAgee: any[] = useMemo(() => fv2.balanceAgee || [], [fv2]);
  const creancesAEchoir: any[] = useMemo(() => fv2.creancesAEchoir || [], [fv2]);
  const caComptableAnnee = useMemo(() => parseFloat(fv2.caComptableAnnee || 0), [fv2]);
  const encaisseMois = useMemo(() => parseFloat(fs.encaisse_mois || 0), [fs]);
  const tauxEncaissement = useMemo(() => totalFacture > 0 ? pct(totalEncaisse, totalFacture) : 0, [totalEncaisse, totalFacture]);
  const nbElevesImpayes = useMemo(() => balanceAgee.reduce((s, r) => s + parseInt(r.nb_eleves || 0), 0), [balanceAgee]);
  const topDebtors: any[] = useMemo(() => (dashData?.topDebtors || []).slice(0, 5), [dashData]);

  const filteredPayments = useMemo(() => payments.filter(p => {
    const pDate = new Date(p.createdAt).toISOString().split('T')[0];
    return (
      ((p.saleRef || '').toLowerCase().includes(journalFilters.search.toLowerCase()) ||
       (p.customer || '').toLowerCase().includes(journalFilters.search.toLowerCase())) &&
      (journalFilters.method === 'ALL' || p.method === journalFilters.method) &&
      (journalFilters.dateFrom === '' || pDate >= journalFilters.dateFrom) &&
      (journalFilters.dateTo === '' || pDate <= journalFilters.dateTo)
    );
  }), [payments, journalFilters]);

  const displayedPayments = useMemo(() =>
    journalPageSize === -1 ? filteredPayments : filteredPayments.slice(0, journalPageSize),
  [filteredPayments, journalPageSize]);

  const journalTotal = useMemo(() =>
    filteredPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
  [filteredPayments]);

  const exportPayments = useMemo(() => payments.filter(p => {
    const d = new Date(p.createdAt).toISOString().split('T')[0];
    return d >= exportDates.from && d <= exportDates.to;
  }), [payments, exportDates]);

  const exportCSV = useCallback(() => {
    const rows = [
      ['Date', 'Heure', 'Reference', 'Client', 'Methode', 'Montant', 'Statut'],
      ...exportPayments.map(p => [
        new Date(p.createdAt).toLocaleDateString('fr-FR'),
        fmtTime(p.createdAt), p.saleRef, p.customer, p.method, p.amount, p.saleStatus,
      ]),
    ].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tresorerie_${exportDates.from}_${exportDates.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setShowExportModal(false);
  }, [exportPayments, exportDates]);

  const caComptableDetails: any[] = useMemo(() => caComptableV2?.details || [], [caComptableV2]);

  const totalMaxImpaye = useMemo(() => {
    const max = balanceAgee.reduce((m, r) => Math.max(m, parseFloat(r.total_impaye || 0)), 0);
    return max || 1;
  }, [balanceAgee]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">Chargement Finance & Tresorerie...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 ">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg">
              <Landmark size={20} className="text-white" />
            </div>
            Finance & Tresorerie
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Annee scolaire <span className="font-black text-indigo-600">{anneeScolaire}</span>
            {dashData?.tenantName && <> &middot; {dashData.tenantName}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar size={12} className="text-slate-400" />
            <select
              value={civilYear}
              onChange={e => setCivilYear(parseInt(e.target.value))}
              className="text-[10px] font-black text-slate-700 bg-transparent outline-none appearance-none pr-4"
            >
              {civilYearOptions.map(y => <option key={y} value={y}>Civil {y}</option>)}
            </select>
          </div>
          <button
            onClick={() => fetchAll(true)}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ROW 1 — MAIN KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg">
          <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80} className="text-white" /></div>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><TrendingUp size={20} className="text-white" /></div>
            <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{currency}</span>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{fmtAmt(caEngagement)}</p>
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">CA d'engagement &mdash; {anneeScolaire}</p>
            <p className="text-[9px] text-white/60 font-semibold mt-0.5">Engagements actifs annee scolaire</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg">
          <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={80} className="text-white" /></div>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><Wallet size={20} className="text-white" /></div>
            <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{currency}</span>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{fmtAmt(totalEncaisse)}</p>
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">Encaisse</p>
            <p className="text-[9px] text-white/60 font-semibold mt-0.5">{tauxEncaissement}% du total facture</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg">
          <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={80} className="text-white" /></div>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><Clock size={20} className="text-white" /></div>
            <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{currency}</span>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{fmtAmt(totalAEchoir)}</p>
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">Creances a echoir</p>
            <p className="text-[9px] text-white/60 font-semibold mt-0.5">Montants futurs attendus</p>
          </div>
        </div>

        <div className={`${totalImpaye > 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-emerald-500 to-green-600'} rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg`}>
          <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={80} className="text-white" /></div>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><AlertTriangle size={20} className="text-white" /></div>
            <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{currency}</span>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{fmtAmt(totalImpaye)}</p>
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">En recouvrement</p>
            <p className="text-[9px] text-white/60 font-semibold mt-0.5">{nbElevesImpayes} eleve(s) concerne(s)</p>
          </div>
        </div>
      </div>

      {/* ROW 2 — SECONDARY KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 opacity-[0.06]"><CheckCircle2 size={80} /></div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 bg-opacity-10 flex items-center justify-center mb-3">
            <CheckCircle2 size={20} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{tauxEncaissement}%</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Taux d'encaissement</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 opacity-[0.06]"><TrendingUp size={80} /></div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-500 bg-opacity-10 flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmtAmt(caComptableAnnee)}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">CA Comptable {civilYear}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{currency}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 opacity-[0.06]"><Wallet size={80} /></div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-500 bg-opacity-10 flex items-center justify-center mb-3">
            <Wallet size={20} className="text-cyan-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmtAmt(encaisseMois)}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Encaissements du mois</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{currency}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 opacity-[0.06]"><Users size={80} /></div>
          <div className="w-10 h-10 rounded-2xl bg-violet-500 bg-opacity-10 flex items-center justify-center mb-3">
            <Users size={20} className="text-violet-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{dashData?.elevesStats?.total_inscrits || 0}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Nb Inscrits</p>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: SYNTHESE */}
      {activeTab === 'synthese' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Balance Agee Visual */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle size={16} className="text-rose-600" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Balance agee</h3>
              </div>
              {balanceAgee.length === 0 ? (
                <p className="text-center text-[10px] font-bold text-slate-300 py-8 uppercase">Aucun impaye</p>
              ) : (
                <div className="space-y-3">
                  {balanceAgee.map((row: any) => {
                    const tranche = row.tranche || '';
                    const colors = AGING_COLORS[tranche] || AGING_COLORS['1-30'];
                    const val = parseFloat(row.total_impaye || 0);
                    const barW = pct(val, totalMaxImpaye);
                    return (
                      <div key={tranche}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${colors.text}`}>
                            {AGING_LABELS[tranche] || tranche}
                          </span>
                          <span className="text-[10px] font-black text-slate-700">{fmtAmt(val)} {currency}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                          <div className={`h-3 rounded-full transition-all ${colors.bar}`} style={{ width: `${barW}%` }} />
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                          {row.nb_echeances || 0} echeance(s) &middot; {row.nb_eleves || 0} eleve(s)
                        </p>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400">Total impaye</span>
                    <span className="text-sm font-black text-rose-600">{fmtAmt(totalImpaye)} {currency}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Creances a echoir timeline */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Creances a echoir</h3>
              </div>
              {creancesAEchoir.length === 0 ? (
                <p className="text-center text-[10px] font-bold text-slate-300 py-8 uppercase">Aucune creance future</p>
              ) : (
                <div className="space-y-2">
                  {creancesAEchoir.map((row: any, i: number) => {
                    const moisLabel = row.mois ? new Date(row.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : `Mois ${i + 1}`;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Calendar size={14} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-slate-700 uppercase">{moisLabel}</p>
                          <p className="text-[8px] text-slate-400 font-bold">{row.nb_echeances || 0} echeance(s)</p>
                        </div>
                        <p className="text-sm font-black text-amber-700 flex-shrink-0">{fmtAmt(row.total || 0)} {currency}</p>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400">Total a echoir</span>
                    <span className="text-sm font-black text-amber-700">{fmtAmt(totalAEchoir)} {currency}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top 5 debiteurs */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-red-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Top 5 debiteurs</h3>
            </div>
            {topDebtors.length === 0 ? (
              <p className="text-center text-[10px] font-bold text-slate-300 py-8 uppercase">Aucun debiteur</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="px-4 py-3">Nom</th>
                      <th className="px-4 py-3">Niveau</th>
                      <th className="px-4 py-3 text-center">Echeances</th>
                      <th className="px-4 py-3">Plus ancienne</th>
                      <th className="px-4 py-3 text-right">Dette</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topDebtors.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-4 py-3">
                          <p className="text-[11px] font-black text-slate-800 uppercase">{d.nom}</p>
                          {d.whatsapp && <p className="text-[8px] text-slate-400 font-bold">{d.whatsapp}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase">{d.niveau || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-black text-slate-600">{d.nb_echeances || 0}</td>
                        <td className="px-4 py-3 text-[10px] font-bold text-slate-500">{d.plus_ancienne ? fmtDate(d.plus_ancienne) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-black text-rose-600">{fmtAmt(d.dette || 0)}</p>
                          <p className="text-[8px] text-slate-400 font-bold">{currency}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: JOURNAL */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={journalFilters.search}
                  onChange={e => setJournalFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Client ou reference..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                />
              </div>
              <input
                type="date"
                value={journalFilters.dateFrom}
                onChange={e => setJournalFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                type="date"
                value={journalFilters.dateTo}
                onChange={e => setJournalFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <select
                value={journalFilters.method}
                onChange={e => setJournalFilters(f => ({ ...f, method: e.target.value }))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black text-slate-700 outline-none appearance-none"
              >
                <option value="ALL">Tous canaux</option>
                {Object.entries(METHOD_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select
                value={journalPageSize}
                onChange={e => setJournalPageSize(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={-1}>Tout</option>
              </select>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Download size={12} /> Exporter
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {displayedPayments.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Wallet size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase">Aucune transaction</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-5 py-4">Date / Heure</th>
                        <th className="px-4 py-4">Reference</th>
                        <th className="px-4 py-4">Client</th>
                        <th className="px-4 py-4 text-center">Canal</th>
                        <th className="px-4 py-4 text-right">Montant</th>
                        <th className="px-4 py-4 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedPayments.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-5 py-4">
                            <p className="text-[11px] font-black text-slate-700">{fmtDate(p.createdAt)}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{fmtTime(p.createdAt)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-mono text-[11px] font-black text-indigo-600">#{p.saleRef}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[140px]">{p.customer}</p>
                          </td>
                          <td className="px-4 py-4 text-center"><MethodBadge method={p.method} /></td>
                          <td className="px-4 py-4 text-right">
                            <p className="text-sm font-black text-emerald-600">+{fmtAmt(p.amount)}</p>
                            <p className="text-[8px] text-slate-400 font-bold">{currency}</p>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                              p.saleStatus === 'TERMINE' ? 'bg-emerald-50 text-emerald-700' :
                              p.saleStatus === 'ANNULE' ? 'bg-rose-50 text-rose-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {p.saleStatus === 'TERMINE' ? 'Solde' : p.saleStatus === 'ANNULE' ? 'Annule' : 'En cours'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white">
                      <tr>
                        <td colSpan={4} className="px-5 py-4 text-right text-[9px] font-black uppercase text-slate-400">
                          Total sur {filteredPayments.length} paiement(s)
                        </td>
                        <td className="px-4 py-4 text-right text-base font-black">
                          {fmtAmt(journalTotal)} <span className="text-slate-400 text-[10px]">{currency}</span>
                        </td>
                        <td className="px-4 py-4" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {displayedPayments.map((p, i) => (
                    <div key={i} className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-[11px] font-black text-indigo-600">#{p.saleRef}</p>
                          <p className="text-[9px] text-slate-400">{fmtDate(p.createdAt)} &middot; {fmtTime(p.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-emerald-600">+{fmtAmt(p.amount)}</p>
                          <p className="text-[8px] text-slate-400">{currency}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[160px]">{p.customer}</p>
                        <MethodBadge method={p.method} />
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400">Total ({filteredPayments.length})</span>
                    <span className="text-sm font-black">{fmtAmt(journalTotal)} {currency}</span>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>{displayedPayments.length} / {filteredPayments.length} resultat(s)</span>
                  {journalPageSize !== -1 && filteredPayments.length > journalPageSize && (
                    <button onClick={() => setJournalPageSize(-1)} className="text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1">
                      Voir tout <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: BALANCE AGEE */}
      {activeTab === 'balance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Anciennete des impayes</h3>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-rose-600">{fmtAmt(totalImpaye)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{currency} total impaye</p>
              </div>
            </div>

            {balanceAgee.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={40} className="text-emerald-300 mx-auto mb-3" />
                <p className="text-sm font-black text-emerald-600 uppercase">Aucun impaye</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Tous les paiements sont a jour</p>
              </div>
            ) : (
              <div className="space-y-4">
                {balanceAgee.map((row: any) => {
                  const tranche = row.tranche || '';
                  const colors = AGING_COLORS[tranche] || AGING_COLORS['1-30'];
                  const val = parseFloat(row.total_impaye || 0);
                  const barW = totalImpaye > 0 ? pct(val, totalImpaye) : 0;
                  return (
                    <div key={tranche} className={`p-4 rounded-2xl border ${colors.bg} border-opacity-60`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colors.bar}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
                            {AGING_LABELS[tranche] || tranche}
                          </span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{fmtAmt(val)} {currency}</span>
                      </div>
                      <div className="w-full bg-white/60 rounded-full h-4 mb-2">
                        <div className={`h-4 rounded-full transition-all ${colors.bar}`} style={{ width: `${barW}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-bold text-slate-500">
                        <span>{row.nb_echeances || 0} echeance(s)</span>
                        <span>{row.nb_eleves || 0} eleve(s)</span>
                        <span>{barW}% du total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CREANCES A ECHOIR */}
      {activeTab === 'creances' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Echeances futures</h3>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-amber-700">{fmtAmt(totalAEchoir)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{currency} total a echoir</p>
              </div>
            </div>

            {creancesAEchoir.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={40} className="text-emerald-300 mx-auto mb-3" />
                <p className="text-sm font-black text-emerald-600 uppercase">Aucune echeance future</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {creancesAEchoir.map((row: any, i: number) => {
                  const moisLabel = row.mois ? new Date(row.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : `Mois ${i + 1}`;
                  return (
                    <div key={i} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                          <Calendar size={16} className="text-amber-600" />
                        </div>
                        <p className="text-[11px] font-black text-slate-800 uppercase">{moisLabel}</p>
                      </div>
                      <p className="text-2xl font-black text-amber-700">{fmtAmt(row.total || 0)}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{currency} &middot; {row.nb_echeances || 0} echeance(s)</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CA COMPTABLE */}
      {activeTab === 'ca' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">CA Comptable {civilYear}</h3>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-indigo-600">{fmtAmt(caComptableAnnee)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{currency} annee civile</p>
              </div>
            </div>

            {caComptableDetails.length === 0 ? (
              <div className="py-16 text-center">
                <Eye size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400 uppercase">Aucune donnee CA comptable</p>
                <p className="text-[10px] text-slate-300 font-medium mt-1">Les donnees seront disponibles apres configuration Finance V2</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="px-4 py-3">Mois</th>
                      <th className="px-4 py-3 text-right">CA Comptable</th>
                      <th className="px-4 py-3 text-right">Encaisse</th>
                      <th className="px-4 py-3 text-right">Reste</th>
                      <th className="px-4 py-3 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {caComptableDetails.map((row: any, i: number) => {
                      const ca = parseFloat(row.ca_comptable || 0);
                      const enc = parseFloat(row.encaisse || 0);
                      const reste = ca - enc;
                      const taux = pct(enc, ca);
                      const moisLabel = row.mois ? new Date(row.mois + '-01').toLocaleDateString('fr-FR', { month: 'long' }) : `Mois ${i + 1}`;
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3 text-[11px] font-black text-slate-700 uppercase">{moisLabel}</td>
                          <td className="px-4 py-3 text-right text-[11px] font-black text-indigo-600">{fmtAmt(ca)}</td>
                          <td className="px-4 py-3 text-right text-[11px] font-black text-emerald-600">{fmtAmt(enc)}</td>
                          <td className="px-4 py-3 text-right text-[11px] font-black text-amber-600">{fmtAmt(reste)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black ${
                              taux >= 80 ? 'bg-emerald-50 text-emerald-700' :
                              taux >= 50 ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>{taux}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-4 py-4 text-[9px] font-black uppercase">Totaux</td>
                      <td className="px-4 py-4 text-right text-sm font-black">
                        {fmtAmt(caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.ca_comptable || 0), 0))}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black">
                        {fmtAmt(caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.encaisse || 0), 0))}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black">
                        {fmtAmt(
                          caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.ca_comptable || 0), 0) -
                          caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.encaisse || 0), 0)
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-lg">
                          {pct(
                            caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.encaisse || 0), 0),
                            caComptableDetails.reduce((s: number, r: any) => s + parseFloat(r.ca_comptable || 0), 0)
                          )}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm ">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden ">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="text-emerald-400" size={18} />
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Exporter CSV</p>
                  <p className="text-[9px] text-slate-400">{exportPayments.length} paiement(s)</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Periode</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input type="date" value={exportDates.from} onChange={e => setExportDates(d => ({ ...d, from: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input type="date" value={exportDates.to} onChange={e => setExportDates(d => ({ ...d, to: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>
              </div>
              <button
                onClick={exportCSV}
                className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <Download size={14} /> Telecharger CSV ({exportPayments.length} lignes)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
