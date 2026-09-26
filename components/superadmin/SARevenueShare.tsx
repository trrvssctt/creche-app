import React, { useState, useEffect, useCallback } from 'react';
import {
  Percent, TrendingUp, Building2, RefreshCw, Loader2, Save, X,
  Calendar, Info, History, Sliders, FileText, ChevronRight, Wallet, Scale
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

interface Props {
  fmt: (n: number) => string;
  fmtDate: (d: any) => string;
}

/** Bornes contractuelles : la redevance est comprise entre 0,50 % et 1,00 % du CA. */
const MIN_PCT = 0.5;
const MAX_PCT = 1.0;
const STEP_PCT = 0.05;

const BASES: { id: string; label: string; help: string }[] = [
  { id: 'CA_COMPTABLE',  label: 'CA comptable',   help: "Produits rattachés à la période de service (échéances de scolarité). Base contractuelle par défaut." },
  { id: 'CA_ENCAISSE',   label: 'CA encaissé',    help: "Encaissements réellement perçus sur la période (trésorerie)." },
  { id: 'CA_ENGAGEMENT', label: "CA d'engagement", help: "Total net engagé sur l'année scolaire (contrats d'inscription)." },
];

const MONTHS_FR = ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const moisLabel = (m: string) => {
  const [y, mo] = (m || '').split('-');
  return mo ? `${MONTHS_FR[parseInt(mo, 10) - 1]} ${y}` : m;
};

const Kpi = ({ title, value, sub, icon: Icon, color }: any) => {
  const map: Record<string, string> = {
    indigo:  'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    amber:   'from-amber-500/10 to-amber-600/5 border-amber-500/20',
    violet:  'from-violet-500/10 to-violet-600/5 border-violet-500/20',
  };
  const icons: Record<string, string> = {
    indigo:  'bg-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber:   'bg-amber-500/20 text-amber-400',
    violet:  'bg-violet-500/20 text-violet-400',
  };
  return (
    <div className={`bg-gradient-to-br ${map[color]} border rounded-2xl p-5 shadow-lg`}>
      <div className={`inline-flex p-2.5 rounded-xl mb-4 ${icons[color]}`}><Icon size={20} /></div>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl font-black text-white break-all">{value}</h3>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
};

const SARevenueShare: React.FC<Props> = ({ fmt, fmtDate }) => {
  const showToast = useToast();

  const [loading, setLoading]   = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [periodType, setPeriodType] = useState<'CIVIL_YEAR' | 'ACADEMIC_YEAR'>('CIVIL_YEAR');
  const [civilYear, setCivilYear]   = useState(CURRENT_YEAR);

  // Panneau de détail / réglage
  const [detail, setDetail]   = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulaire de réglage
  const [ratePct, setRatePct] = useState(MIN_PCT);
  const [basis, setBasis]     = useState('CA_COMPTABLE');
  const [includeOthers, setIncludeOthers] = useState(true);
  const [contractRef, setContractRef]     = useState('');
  const [reason, setReason] = useState('');

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ periodType, civilYear: String(civilYear) }).toString();
      const res: any = await apiClient.get(`/admin/revenue-share/overview?${qs}`);
      setOverview(res);
    } catch (e: any) {
      showToast(e?.message || 'Erreur de chargement de la redevance', 'error');
    } finally { setLoading(false); }
  }, [periodType, civilYear, showToast]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const openDetail = async (tenantId: string) => {
    setDetailLoading(true);
    try {
      const qs = new URLSearchParams({ periodType, civilYear: String(civilYear) }).toString();
      const [d, h]: any = await Promise.all([
        apiClient.get(`/admin/revenue-share/${tenantId}?${qs}`),
        apiClient.get(`/admin/revenue-share/${tenantId}/rate-history`),
      ]);
      setDetail(d);
      setHistory(Array.isArray(h) ? h : []);
      setRatePct(d.settings.commissionRatePct);
      setBasis(d.settings.calculationBasis);
      setIncludeOthers(d.settings.includeOtherRevenues);
      setContractRef(d.settings.contractReference || '');
      setReason('');
    } catch (e: any) {
      showToast(e?.message || 'Erreur de chargement du détail', 'error');
    } finally { setDetailLoading(false); }
  };

  const saveSettings = async () => {
    if (!detail) return;
    if (ratePct < MIN_PCT || ratePct > MAX_PCT) {
      showToast(`Le taux doit rester entre ${MIN_PCT.toFixed(2)} % et ${MAX_PCT.toFixed(2)} %.`, 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/admin/revenue-share/${detail.tenantId}/settings`, {
        commissionRate: ratePct,           // le backend accepte le pourcentage
        calculationBasis: basis,
        includeOtherRevenues: includeOthers,
        contractReference: contractRef || null,
        reason: reason || null,
      });
      showToast(`Taux de redevance fixé à ${ratePct.toFixed(2)} %`, 'success');
      await openDetail(detail.tenantId);
      await fetchOverview();
    } catch (e: any) {
      showToast(e?.message || 'Erreur lors de l\'enregistrement', 'error');
    } finally { setSaving(false); }
  };

  const totals = overview?.totals;
  const rows: any[] = overview?.tenants || [];
  // Aperçu en direct : ce que donnerait le taux en cours de réglage
  const previewAmount = detail ? Math.round(detail.revenue.assiette * (ratePct / 100)) : 0;

  return (
    <div className="space-y-6 p-6">

      {/* ══ EN-TÊTE + FILTRES ══ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-black text-white text-lg">Redevance sur chiffre d'affaires</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Part contractuelle prélevée sur le CA des établissements — réglable de {MIN_PCT.toFixed(2)} % à {MAX_PCT.toFixed(2)} %
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-1">
            {([['CIVIL_YEAR', 'Année civile'], ['ACADEMIC_YEAR', 'Année scolaire']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPeriodType(id as any)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  periodType === id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >{label}</button>
            ))}
          </div>
          <select
            value={civilYear}
            onChange={e => setCivilYear(parseInt(e.target.value, 10))}
            className="bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-[11px] font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700/50 text-zinc-300 text-[11px] font-bold rounded-xl hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualiser
          </button>
        </div>
      </div>

      {/* ══ KPI CONSOLIDÉS ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="CA consolidé" value={`${fmt(totals?.caTotal || 0)} F`}
             sub={`${totals?.nbEtablissements || 0} établissement(s) — ${periodType === 'CIVIL_YEAR' ? civilYear : 'année scolaire'}`}
             icon={TrendingUp} color="indigo" />
        <Kpi title="Redevance due" value={`${fmt(totals?.commissionTotal || 0)} F`}
             sub="Somme des parts contractuelles" icon={Wallet} color="emerald" />
        <Kpi title="Taux moyen appliqué" value={`${((totals?.tauxMoyen || 0) * 100).toFixed(2)} %`}
             sub={`Fourchette ${MIN_PCT.toFixed(2)} % – ${MAX_PCT.toFixed(2)} %`} icon={Percent} color="violet" />
        <Kpi title="Établissements" value={String(totals?.nbEtablissements || 0)}
             sub="Sous contrat de redevance" icon={Building2} color="amber" />
      </div>

      {/* ══ TABLEAU PAR ÉTABLISSEMENT ══ */}
      <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-700/50 flex items-center gap-2">
          <Scale size={15} className="text-indigo-400" />
          <h4 className="text-xs font-black text-white uppercase tracking-wider">Détail par établissement</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-900/50">
              <tr className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                <th className="px-5 py-3">Établissement</th>
                <th className="px-5 py-3">Base retenue</th>
                <th className="px-5 py-3 text-right">Chiffre d'affaires</th>
                <th className="px-5 py-3 text-right">Taux</th>
                <th className="px-5 py-3 text-right">Redevance</th>
                <th className="px-5 py-3 text-right">Régler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/40">
              {loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500 text-xs">
                  <Loader2 size={18} className="animate-spin inline mr-2" /> Calcul du chiffre d'affaires…
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500 text-xs">Aucun établissement.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.tenantId} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-xs font-bold text-white">{r.tenantName}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{r.period?.label}</p>
                  </td>
                  <td className="px-5 py-4">
                    {r.error ? (
                      <span className="text-[10px] text-rose-400">{r.error}</span>
                    ) : (
                      <span className="px-2 py-1 text-[9px] font-black rounded-lg bg-zinc-700/50 text-zinc-300 uppercase">
                        {BASES.find(b => b.id === r.basis)?.label || r.basis}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-xs font-bold text-white">
                    {r.error ? '—' : `${fmt(r.revenue.assiette)} F`}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {r.error ? '—' : (
                      <span className="px-2 py-1 text-[10px] font-black rounded-lg bg-violet-500/15 text-violet-300">
                        {r.commission.ratePct.toFixed(2)} %
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-xs font-black text-emerald-400">
                    {r.error ? '—' : `${fmt(r.commission.amount)} F`}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => openDetail(r.tenantId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/15 text-indigo-300 text-[10px] font-bold rounded-lg hover:bg-indigo-500/25 transition-all"
                    >
                      <Sliders size={12} /> Régler <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ PANNEAU DÉTAIL & RÉGLAGE ══ */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
             onClick={() => { if (!saving) { setDetail(null); setHistory([]); } }}>
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
               onClick={e => e.stopPropagation()}>

            {detailLoading && !detail ? (
              <div className="p-16 text-center text-zinc-400">
                <Loader2 size={24} className="animate-spin inline" />
              </div>
            ) : detail && (
              <>
                {/* En-tête */}
                <div className="px-6 py-5 border-b border-zinc-700/50 flex items-start justify-between gap-4 sticky top-0 bg-zinc-900 z-10">
                  <div>
                    <h3 className="font-black text-white text-base">{detail.tenantName}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Période {detail.period.label} — du {fmtDate(detail.period.dateFrom)} au {fmtDate(detail.period.dateTo)}
                    </p>
                  </div>
                  <button onClick={() => { setDetail(null); setHistory([]); }}
                          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 space-y-6">

                  {/* Lectures du CA */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'CA_COMPTABLE',  label: 'CA comptable',    val: detail.revenue.caComptable },
                      { id: 'CA_ENCAISSE',   label: 'CA encaissé',     val: detail.revenue.caEncaisse },
                      { id: 'CA_ENGAGEMENT', label: "CA d'engagement", val: detail.revenue.caEngagement },
                    ].map(c => (
                      <div key={c.id} className={`rounded-xl p-4 border ${
                        basis === c.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-zinc-800/50 border-zinc-700/50'
                      }`}>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{c.label}</p>
                        <p className="text-lg font-black text-white mt-1">{fmt(c.val)} F</p>
                        {basis === c.id && <p className="text-[9px] text-indigo-400 font-bold mt-1">● BASE RETENUE</p>}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                      { l: 'Recettes diverses', v: `${fmt(detail.revenue.autresRecettes)} F` },
                      { l: 'Bourses accordées', v: `${fmt(detail.revenue.totalBourses)} F` },
                      { l: 'Élèves engagés',    v: String(detail.revenue.nbInscrits) },
                      { l: 'Assiette retenue',  v: `${fmt(detail.revenue.assiette)} F` },
                    ].map(x => (
                      <div key={x.l} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3">
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">{x.l}</p>
                        <p className="text-sm font-black text-white mt-1">{x.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Réglage du taux */}
                  <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5 space-y-5">
                    <div className="flex items-center gap-2">
                      <Percent size={15} className="text-violet-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Taux de redevance</h4>
                    </div>

                    <div>
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <p className="text-3xl font-black text-white">{ratePct.toFixed(2)} <span className="text-lg text-zinc-400">%</span></p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">du chiffre d'affaires</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Redevance calculée</p>
                          <p className="text-2xl font-black text-emerald-400">{fmt(previewAmount)} F</p>
                        </div>
                      </div>

                      <input
                        type="range"
                        min={MIN_PCT} max={MAX_PCT} step={STEP_PCT}
                        value={ratePct}
                        onChange={e => setRatePct(parseFloat(e.target.value))}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-zinc-500 mt-1">
                        <span>{MIN_PCT.toFixed(2)} % — plancher contractuel</span>
                        <span>{MAX_PCT.toFixed(2)} % — plafond contractuel</span>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="number"
                          min={MIN_PCT} max={MAX_PCT} step={STEP_PCT}
                          value={ratePct}
                          onChange={e => setRatePct(parseFloat(e.target.value) || MIN_PCT)}
                          className="w-28 bg-zinc-900 border border-zinc-700 text-white text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500/50"
                        />
                        <span className="text-xs text-zinc-500">%</span>
                        {[0.5, 0.75, 1].map(p => (
                          <button key={p} onClick={() => setRatePct(p)}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                    ratePct === p ? 'bg-violet-500/25 text-violet-300' : 'bg-zinc-700/40 text-zinc-400 hover:text-zinc-200'
                                  }`}>{p.toFixed(2)} %</button>
                        ))}
                      </div>
                    </div>

                    {/* Base de calcul */}
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">Base de calcul du CA</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {BASES.map(b => (
                          <button key={b.id} onClick={() => setBasis(b.id)} title={b.help}
                                  className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                                    basis === b.id
                                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                      : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
                                  }`}>
                            <p className="text-[11px] font-bold">{b.label}</p>
                          </button>
                        ))}
                      </div>
                      <p className="flex items-start gap-1.5 text-[10px] text-zinc-500 mt-2">
                        <Info size={11} className="mt-0.5 flex-shrink-0" />
                        {BASES.find(b => b.id === basis)?.help}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2.5 cursor-pointer">
                        <input type="checkbox" checked={includeOthers}
                               onChange={e => setIncludeOthers(e.target.checked)}
                               className="accent-indigo-500" />
                        <span className="text-[11px] font-bold text-zinc-300">Inclure les recettes diverses</span>
                      </label>
                      <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2">
                        <FileText size={13} className="text-zinc-500 flex-shrink-0" />
                        <input
                          type="text" value={contractRef} placeholder="Référence du contrat"
                          onChange={e => setContractRef(e.target.value)}
                          className="flex-1 bg-transparent text-[11px] font-bold text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    <input
                      type="text" value={reason} placeholder="Motif du changement (consigné dans l'historique)"
                      onChange={e => setReason(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-[11px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600"
                    />

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-[10px] text-zinc-500">
                        Fourchette : {fmt(detail.commission.amountAtMinRate)} F à {MIN_PCT.toFixed(2)} % → {fmt(detail.commission.amountAtMaxRate)} F à {MAX_PCT.toFixed(2)} %
                      </p>
                      <button
                        onClick={saveSettings} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl hover:from-indigo-400 hover:to-violet-400 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 active:scale-95"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                      </button>
                    </div>
                  </div>

                  {/* Ventilation mensuelle */}
                  {detail.monthly?.length > 0 && (
                    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar size={15} className="text-sky-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Ventilation mensuelle</h4>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={detail.monthly.map((m: any) => ({ ...m, label: moisLabel(m.mois) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                          <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
                          <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v: number) => fmt(v)} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 11 }}
                            formatter={(v: any, n: any) => [`${fmt(v)} F`, n === 'ca' ? "Chiffre d'affaires" : 'Redevance']}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v === 'ca' ? "Chiffre d'affaires" : 'Redevance'} />
                          <Bar dataKey="ca" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="commission" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Historique des taux */}
                  <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <History size={15} className="text-amber-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Historique des taux</h4>
                    </div>
                    {history.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">Aucun changement enregistré.</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map(h => (
                          <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/50 border border-zinc-700/40 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-zinc-500 line-through">{(parseFloat(h.previousRate) * 100).toFixed(2)} %</span>
                              <ChevronRight size={11} className="text-zinc-600" />
                              <span className="font-black text-violet-300">{(parseFloat(h.newRate) * 100).toFixed(2)} %</span>
                              {h.newBasis && h.newBasis !== h.previousBasis && (
                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-zinc-700/50 text-zinc-300">{h.newBasis}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {h.changedByName || '—'} · {fmtDate(h.createdAt)}
                              {h.reason && <span className="text-zinc-400"> — {h.reason}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SARevenueShare;
