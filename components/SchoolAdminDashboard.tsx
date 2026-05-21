import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, Wallet, AlertTriangle,
  CalendarDays, TrendingUp, TrendingDown, Baby,
  BookOpen, Bus, Utensils, UserPlus, Bell,
  ChevronRight, RefreshCw, MessageSquare, FileText,
  Receipt, Clock, ShieldCheck, Award, Home,
  Building2, Target, CheckCircle2, XCircle,
  ArrowRight, Sparkles, Heart, MapPin
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiClient } from '../services/api';
import { useAnnee } from '../contexts/AnneeContext';
import { User } from '../types';

// ─── Utilitaires ───────────────────────────────────────────────────────────

const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const NIVEAU_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Pet. Section', MS: 'Moy. Section',
  GS: 'Gde Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2'
};

const NIVEAU_COLORS: Record<string, string> = {
  CRECHE: '#f43f5e', PS: '#8b5cf6', MS: '#6366f1',
  GS: '#3b82f6', CP: '#0ea5e9', CE1: '#10b981', CE2: '#f59e0b', CM1: '#f97316', CM2: '#ef4444'
};

const EVENT_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  FERIE:    { icon: Heart,       color: 'text-rose-600',   bg: 'bg-rose-100' },
  VACANCES: { icon: Home,        color: 'text-amber-600',  bg: 'bg-amber-100' },
  RENTREE:  { icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  EXAMEN:   { icon: BookOpen,    color: 'text-violet-600', bg: 'bg-violet-100' },
  REUNION:  { icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-100' },
  FETE:     { icon: Sparkles,    color: 'text-pink-600',   bg: 'bg-pink-100' },
  SORTIE:   { icon: MapPin,      color: 'text-teal-600',   bg: 'bg-teal-100' },
};

const daysUntil = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// ─── Composants UI ─────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, sub, color, trend, onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between overflow-hidden relative group ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
  >
    <div className={`absolute -right-2 -top-2 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`}>
      <Icon size={72} />
    </div>
    <div className="flex items-start justify-between">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
    <div className="mt-3">
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && (
        <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={9} className="text-emerald-500" />}
          {trend === 'down' && <TrendingDown size={9} className="text-rose-500" />}
          {sub}
        </p>
      )}
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, label, color = 'text-indigo-600' }: any) => (
  <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-4 ${color}`}>
    <Icon size={14} /> {label}
  </h3>
);

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  user: User;
  currency: string;
  onNavigate?: (tab: string, meta?: any) => void;
}

// ─── Composant principal ───────────────────────────────────────────────────

const SchoolAdminDashboard: React.FC<Props> = ({ user, currency, onNavigate }) => {
  const { annee } = useAnnee();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiClient.get('/admin/school-dashboard', { params: { annee } });
      setData(res.data || res);
    } catch (e) {
      console.error('SchoolDashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [annee]); // eslint-disable-line

  const refresh = () => { setRefreshing(true); load(); };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';
  const todayStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Prochaine alerte (dans 7 jours) ──────────────────────────────────────
  const nextAlert = useMemo(() => {
    if (!data?.upcomingEvents?.length) return null;
    const near = data.upcomingEvents.find((e: any) => daysUntil(e.date_debut) <= 7);
    return near || null;
  }, [data]);

  // ── Chart effectifs par classe ────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data?.classes) return [];
    return data.classes.map((c: any) => ({
      name: NIVEAU_LABELS[c.niveau] || c.niveau,
      inscrits: parseInt(c.nb_inscrits || 0),
      capacite: parseInt(c.capacite_max || 30),
      color: NIVEAU_COLORS[c.niveau] || '#6366f1',
    }));
  }, [data]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const es = data?.elevesStats || {};
  const fs = data?.financeStats || {};
  const ss = data?.staffStats || {};

  const totalInscrits   = parseInt(es.total_inscrits   || 0);
  const totalCapacite   = (data?.classes || []).reduce((s: number, c: any) => s + parseInt(c.capacite_max || 30), 0);
  const caMois          = parseFloat(fs.ca_mois         || 0);
  const encaisseMois    = parseFloat(fs.encaisse_mois   || 0);
  const nbImpayes       = parseInt(fs.nb_impayes        || 0);
  const montantImpayes  = parseFloat(fs.montant_impayes || 0);
  const tauxRemplissage = pct(totalInscrits, totalCapacite);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">Chargement du tableau de bord…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{todayStr}</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            {greeting}, <span className="text-indigo-600">{user.name.split(' ')[0]}</span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Année scolaire <span className="text-indigo-600 font-black">{annee}</span>
            {' · '}Le Toit des Anges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={() => onNavigate?.('admissions')}
            className="flex items-center gap-1.5 text-[10px] font-black text-white bg-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <UserPlus size={12} /> Nouvelle admission
          </button>
        </div>
      </div>

      {/* ── Alerte prochaine ────────────────────────────────────────────────── */}
      {nextAlert && (() => {
        const cfg = EVENT_ICONS[nextAlert.type] || EVENT_ICONS.FERIE;
        const EIcon = cfg.icon;
        const jours = daysUntil(nextAlert.date_debut);
        return (
          <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${cfg.bg} border-opacity-50`}>
            <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
              <EIcon size={16} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-black uppercase tracking-wide ${cfg.color}`}>
                {jours === 0 ? "Aujourd'hui" : jours === 1 ? 'Demain' : `Dans ${jours} jours`}
                {' · '}{nextAlert.titre}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold">{nextAlert.description}</p>
            </div>
            <p className="text-[10px] font-bold text-slate-400 flex-shrink-0">{formatDate(nextAlert.date_debut)}</p>
          </div>
        );
      })()}

      {/* ── KPIs principaux ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={GraduationCap}
          label="Élèves inscrits"
          value={totalInscrits}
          sub={`${tauxRemplissage}% de remplissage · cap. ${totalCapacite}`}
          color="bg-indigo-600"
          onClick={() => onNavigate?.('eleves')}
        />
        <KpiCard
          icon={Users}
          label="Personnel actif"
          value={parseInt(ss.total_staff || 0)}
          sub={`${ss.enseignants || 0} enseignants · ${ss.vigiles || 0} agents sécurité`}
          color="bg-emerald-600"
          onClick={() => onNavigate?.('rh')}
        />
        <KpiCard
          icon={Wallet}
          label={`CA mois de ${now.toLocaleDateString('fr-FR', { month: 'long' })}`}
          value={`${fmt(caMois)} ${currency}`}
          sub={`${fmt(encaisseMois)} encaissé · ${pct(encaisseMois, caMois)}% recouvré`}
          color="bg-teal-600"
          trend={caMois > 0 ? 'up' : undefined}
          onClick={() => onNavigate?.('sales')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Impayés du mois"
          value={nbImpayes > 0 ? `${nbImpayes} factures` : 'Aucun'}
          sub={nbImpayes > 0 ? `${fmt(montantImpayes)} ${currency} en attente` : 'Tous les paiements sont à jour'}
          color={nbImpayes > 0 ? 'bg-rose-600' : 'bg-slate-400'}
          trend={nbImpayes > 0 ? 'down' : undefined}
          onClick={() => onNavigate?.('facturation')}
        />
      </div>

      {/* ── Ligne 2 : Effectifs & Événements ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Classes + chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionTitle icon={Building2} label="Effectifs par classe — 2025-2026" />

          {/* Mini bar chart */}
          <div className="mb-5 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(v: any, name: string) => [`${v}`, name === 'inscrits' ? 'Inscrits' : 'Capacité']}
                />
                <Bar dataKey="inscrits" name="Inscrits" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="capacite" name="Capacité" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau classes */}
          <div className="overflow-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Classe</th>
                  <th className="text-left font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Enseignant(e)</th>
                  <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Élèves</th>
                  <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Taux</th>
                  <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-2">
                    <Bus size={10} className="inline" />
                  </th>
                  <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2">
                    <Utensils size={10} className="inline" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.classes || []).map((c: any) => {
                  const ins = parseInt(c.nb_inscrits || 0);
                  const cap = parseInt(c.capacite_max || 30);
                  const t = pct(ins, cap);
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2 pr-3 font-black text-slate-800">{c.nom}</td>
                      <td className="py-2 pr-3 text-slate-600 font-semibold">{c.enseignant || '—'}</td>
                      <td className="py-2 pr-3 text-right font-black text-slate-800">
                        {ins}<span className="text-slate-300 font-normal">/{cap}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-black ${
                          t >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          t >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-600'}`}
                        >{t}%</span>
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-slate-500">{c.nb_bus || 0}</td>
                      <td className="py-2 text-right font-bold text-slate-500">{c.nb_cantine || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Événements à venir */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionTitle icon={CalendarDays} label="Calendrier scolaire" color="text-violet-600" />
          <div className="space-y-2">
            {(data?.upcomingEvents || []).length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-bold text-slate-400">Aucun événement dans les 30 prochains jours</p>
              </div>
            ) : (data?.upcomingEvents || []).map((ev: any, i: number) => {
              const cfg = EVENT_ICONS[ev.type] || EVENT_ICONS.FERIE;
              const EIcon = cfg.icon;
              const j = daysUntil(ev.date_debut);
              return (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`w-7 h-7 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <EIcon size={13} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{ev.titre}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">
                      {formatDate(ev.date_debut)}{ev.date_fin && ev.date_fin !== ev.date_debut ? ` → ${formatDate(ev.date_fin)}` : ''}
                    </p>
                  </div>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    j <= 3 ? 'bg-rose-100 text-rose-600' :
                    j <= 7 ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'}`}>
                    {j === 0 ? "Auj." : `J-${j}`}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onNavigate?.('evenements')}
            className="mt-3 w-full text-[9px] font-black text-violet-600 flex items-center justify-center gap-1 py-2 border border-violet-100 rounded-xl hover:bg-violet-50 transition-colors"
          >
            Tout le calendrier <ChevronRight size={10} />
          </button>
        </div>
      </div>

      {/* ── Ligne 3 : Admissions récentes & Débiteurs ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Dernières admissions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={UserPlus} label="Dernières admissions" color="text-emerald-600" />
            <button
              onClick={() => onNavigate?.('admissions')}
              className="text-[9px] font-black text-emerald-600 flex items-center gap-1 hover:underline"
            >
              Voir tout <ArrowRight size={9} />
            </button>
          </div>
          <div className="space-y-2">
            {(data?.recentAdmissions || []).length === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold text-center py-6">Aucune admission récente</p>
            ) : (data?.recentAdmissions || []).map((el: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[11px] font-black text-emerald-700 flex-shrink-0">
                  {el.niveau?.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 truncate">{el.nom_complet}</p>
                  <p className="text-[9px] text-slate-400 font-semibold">{el.matricule} · {el.classe || el.niveau}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                    el.regime_financier === 'CAS_SOCIAL' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {el.regime_financier === 'CAS_SOCIAL' ? 'Cas social' : 'Normal'}
                  </span>
                  <p className="text-[8px] text-slate-300 font-semibold mt-0.5">
                    {el.date_admission ? formatDate(el.date_admission) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top débiteurs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={AlertTriangle} label="Impayés en cours" color="text-rose-600" />
            <button
              onClick={() => onNavigate?.('facturation')}
              className="text-[9px] font-black text-rose-600 flex items-center gap-1 hover:underline"
            >
              Gérer <ArrowRight size={9} />
            </button>
          </div>
          {(data?.topDebtors || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 size={32} className="text-emerald-300 mb-2" />
              <p className="text-[11px] font-black text-emerald-600">Aucun impayé en cours</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Tous les paiements sont à jour</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.topDebtors || []).map((d: any, i: number) => {
                const maxDette = Math.max(...(data?.topDebtors || []).map((x: any) => parseFloat(x.dette || 0)));
                const bar = pct(parseFloat(d.dette), maxDette);
                return (
                  <div key={i} className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-black text-slate-800 truncate flex-1 pr-2">{d.nom}</p>
                      <span className="text-[10px] font-black text-rose-600 flex-shrink-0">{fmt(parseFloat(d.dette || 0))} {currency}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${bar}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-50">
                <p className="text-[10px] font-black text-rose-600 text-right">
                  Total : {fmt((data?.topDebtors || []).reduce((s: number, d: any) => s + parseFloat(d.dette || 0), 0))} {currency}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions rapides ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <SectionTitle icon={Target} label="Actions rapides" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { icon: UserPlus,     label: 'Nouvelle\nadmission',   tab: 'admissions',    color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
            { icon: Receipt,      label: 'Facturation\nscolaire', tab: 'facturation',   color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
            { icon: MessageSquare,label: 'Envoyer\nWhatsApp',     tab: 'whatsapp',      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
            { icon: FileText,     label: 'Bulletins\ntrimestriels',tab: 'bulletins',    color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
            { icon: CalendarDays, label: 'Emploi\ndu temps',      tab: 'emploi-du-temps', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { icon: Users,        label: 'Gestion\nRH',           tab: 'rh',            color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
          ].map(({ icon: Icon, label, tab, color }) => (
            <button
              key={tab}
              onClick={() => onNavigate?.(tab)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors text-center ${color}`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-wide leading-tight whitespace-pre-line">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats complémentaires ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Bus,      label: 'Transport bus',  value: parseInt(es.avec_bus || 0),     color: 'text-sky-600',    bg: 'bg-sky-50' },
          { icon: Utensils, label: 'Cantine',         value: parseInt(es.avec_cantine || 0), color: 'text-orange-600', bg: 'bg-orange-50' },
          { icon: Heart,    label: 'Cas sociaux',     value: parseInt(es.cas_sociaux || 0),  color: 'text-pink-600',   bg: 'bg-pink-50' },
          { icon: Baby,     label: 'Crèche',          value: (data?.classes || []).find((c: any) => c.niveau === 'CRECHE')?.nb_inscrits || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
            <Icon size={20} className={color} />
            <div>
              <p className="text-xl font-black text-slate-900">{value}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default SchoolAdminDashboard;
