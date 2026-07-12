import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, Wallet, AlertTriangle,
  CalendarDays, TrendingUp, Baby,
  BookOpen, Bus, Utensils, UserPlus, Bell,
  ChevronRight, RefreshCw, MessageSquare, FileText,
  Receipt, Clock, Award, Home,
  Building2, Target, CheckCircle2,
  ArrowRight, Sparkles, Heart, MapPin,
  Globe, PieChart, BadgeCheck, Percent,
  TrendingDown, BarChart2, Shield,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart as RechartsPie, Pie, Legend,
} from 'recharts';
import { apiClient } from '../services/api';
import { User } from '../types';

// ─── Utilitaires ───────────────────────────────────────────────────────────

const fmt  = (n: number) => Number(n || 0).toLocaleString('fr-FR');
const pct  = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const NIVEAU_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Pet. Section', MS: 'Moy. Section',
  GS: 'Gde Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};
const NIVEAU_COLORS: Record<string, string> = {
  CRECHE: '#f43f5e', PS: '#8b5cf6', MS: '#6366f1',
  GS: '#3b82f6', CP: '#0ea5e9', CE1: '#10b981', CE2: '#f59e0b', CM1: '#f97316', CM2: '#ef4444',
};
const EVENT_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  FERIE:    { icon: Heart,         color: 'text-rose-600',   bg: 'bg-rose-100' },
  VACANCES: { icon: Home,          color: 'text-amber-600',  bg: 'bg-amber-100' },
  RENTREE:  { icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  EXAMEN:   { icon: BookOpen,      color: 'text-violet-600', bg: 'bg-violet-100' },
  REUNION:  { icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-100' },
  FETE:     { icon: Sparkles,      color: 'text-pink-600',   bg: 'bg-pink-100' },
  SORTIE:   { icon: MapPin,        color: 'text-teal-600',   bg: 'bg-teal-100' },
};

const daysUntil = (d: string) => {
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((dt.getTime() - today.getTime()) / 86400000);
};
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

interface Props { user: User; currency: string; onNavigate?: (tab: string, meta?: any) => void; }

// ─── Composants UI ─────────────────────────────────────────────────────────

const GradientKpi = ({ icon: Icon, label, value, sub, gradient, textColor = 'text-white', onClick, badge }: any) => (
  <div
    onClick={onClick}
    className={`${gradient} rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative group shadow-lg ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
  >
    <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={80} className="text-white" />
    </div>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      {badge && (
        <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
    <div>
      <p className={`text-3xl font-black tracking-tight text-white`}>{value}</p>
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

// ─── Dashboard ─────────────────────────────────────────────────────────────

// Charge les événements depuis localStorage (stockés par Evenements.tsx)
function loadLocalEvents() {
  try {
    const raw = localStorage.getItem('evenements_ecole');
    if (!raw) return [];
    const events: any[] = JSON.parse(raw);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return events
      .filter(ev => {
        if (ev.statut === 'ANNULE') return false;
        const d = new Date(ev.dateDebut); d.setHours(0, 0, 0, 0);
        return d >= now && d <= in30;
      })
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
      .slice(0, 6)
      // normalise les champs pour correspondre au template
      .map(ev => ({ ...ev, type: ev.typeEvenement, titre: ev.titre, date_debut: ev.dateDebut, date_fin: ev.dateFin }));
  } catch { return []; }
}

const SchoolAdminDashboard: React.FC<Props> = ({ user, currency, onNavigate }) => {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingEvents]      = useState(() => loadLocalEvents());

  const load = async () => {
    try {
      // Pas de paramètre annee — le backend utilise toujours l'année active du tenant
      const res = await apiClient.get('/admin/school-dashboard');
      setData(res.data || res);
    } catch (e) {
      console.error('SchoolDashboard error:', e);
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const refresh = () => { setRefreshing(true); load(); };

  const annee = data?.annee || '—';
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';
  const todayStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Stats dérivées ────────────────────────────────────────────────────────
  const es  = data?.elevesStats   || {};
  const fs  = data?.financeStats  || {};
  const ss  = data?.staffStats    || {};
  const ecs = data?.echeancesStats || {};

  const totalInscrits   = parseInt(es.total_inscrits || 0);
  const enAttente       = parseInt(es.en_attente || 0);
  const totalCapacite   = (data?.classes || []).reduce((s: number, c: any) => s + parseInt(c.capacite_max || 30), 0);
  const tauxRemplissage = pct(totalInscrits, totalCapacite);

  const caMois          = parseFloat(fs.ca_mois || 0);
  const encaisseMois    = parseFloat(fs.encaisse_mois || 0);
  const nbImpayes       = parseInt(fs.nb_impayes || 0);
  const montantImpayes  = parseFloat(fs.montant_impayes || 0);

  const totalFacture    = parseFloat(ecs.total_facture || 0);
  const totalEncaisse   = parseFloat(ecs.total_encaisse || 0);
  const tauxRecouvrement = pct(totalEncaisse, totalFacture);
  const nbEnRetard      = parseInt(ecs.nb_en_retard || 0);
  const montantRestant  = parseFloat(ecs.montant_restant || 0);

  const candidaturesPortail = data?.candidaturesPortail || [];
  const nbCandidatures = candidaturesPortail.length;

  // ── Chart effectifs ───────────────────────────────────────────────────────
  const chartData = useMemo(() => (data?.classes || []).map((c: any) => ({
    name: NIVEAU_LABELS[c.niveau] || c.niveau,
    inscrits: parseInt(c.nb_inscrits || 0),
    capacite: parseInt(c.capacite_max || 30),
    color: NIVEAU_COLORS[c.niveau] || '#6366f1',
  })), [data]);

  // ── Pie recouvrement ──────────────────────────────────────────────────────
  const recoveryPie = useMemo(() => [
    { name: 'Encaissé',   value: totalEncaisse,  fill: '#10b981' },
    { name: 'Restant',    value: Math.max(0, montantRestant), fill: '#f43f5e' },
  ], [totalEncaisse, montantRestant]);

  // ── Prochaine alerte ──────────────────────────────────────────────────────
  const nextAlert = useMemo(() => {
    if (!upcomingEvents?.length) return null;
    return upcomingEvents.find((e: any) => daysUntil(e.date_debut) <= 7) || null;
  }, [data]);

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{todayStr}</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              {(user.name || user.email || '').split(' ')[0]}
            </span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            <span className="text-indigo-600 font-black">Le Toit des Anges</span>
            {' · '}Année scolaire <span className="font-black">{annee}</span>
            {' · '}{totalInscrits} élèves inscrits
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
          {nbCandidatures > 0 && (
            <button
              onClick={() => onNavigate?.('admission')}
              className="flex items-center gap-1.5 text-[10px] font-black text-white bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              <Globe size={12} /> {nbCandidatures} dossier{nbCandidatures > 1 ? 's' : ''} portail à traiter
            </button>
          )}
          <button
            onClick={() => onNavigate?.('admission')}
            className="flex items-center gap-1.5 text-[10px] font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
          >
            <UserPlus size={12} /> Nouvelle admission
          </button>
        </div>
      </div>

      {/* ── Alerte événement proche ──────────────────────────────────────────── */}
      {nextAlert && (() => {
        const cfg = EVENT_ICONS[nextAlert.type] || EVENT_ICONS.FERIE;
        const EIcon = cfg.icon;
        const j = daysUntil(nextAlert.date_debut);
        return (
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${cfg.bg} border-current/10`}>
            <div className={`w-9 h-9 rounded-2xl ${cfg.bg} flex items-center justify-center flex-shrink-0 border border-current/10`}>
              <EIcon size={18} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-black uppercase tracking-wide ${cfg.color}`}>
                {j === 0 ? "Aujourd'hui" : j === 1 ? 'Demain' : `Dans ${j} jours`}{' · '}{nextAlert.titre}
              </p>
              {nextAlert.description && <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{nextAlert.description}</p>}
            </div>
            <p className="text-[10px] font-bold text-slate-400 flex-shrink-0">{formatDate(nextAlert.date_debut)}</p>
          </div>
        );
      })()}

      {/* ── KPIs gradient — ligne 1 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientKpi
          icon={GraduationCap}
          label="Élèves inscrits"
          value={totalInscrits}
          sub={`${tauxRemplissage}% capacité · ${totalCapacite} places`}
          gradient="bg-gradient-to-br from-indigo-600 to-violet-700"
          onClick={() => onNavigate?.('eleves')}
        />
        <GradientKpi
          icon={Wallet}
          label={`CA — ${now.toLocaleDateString('fr-FR', { month: 'long' })}`}
          value={`${fmt(caMois)}`}
          sub={`${fmt(encaisseMois)} FCFA encaissé · ${pct(encaisseMois, caMois)}% recouvré`}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          onClick={() => onNavigate?.('sales')}
          badge={currency}
        />
        <GradientKpi
          icon={Percent}
          label="Taux recouvrement"
          value={`${tauxRecouvrement}%`}
          sub={`${fmt(totalEncaisse)} encaissé sur ${fmt(totalFacture)} FCFA`}
          gradient={tauxRecouvrement >= 80
            ? 'bg-gradient-to-br from-teal-500 to-cyan-600'
            : tauxRecouvrement >= 50
              ? 'bg-gradient-to-br from-amber-500 to-orange-500'
              : 'bg-gradient-to-br from-rose-500 to-red-600'}
          onClick={() => onNavigate?.('facturation')}
        />
        <GradientKpi
          icon={nbImpayes > 0 ? AlertTriangle : BadgeCheck}
          label="Impayés du mois"
          value={nbImpayes > 0 ? `${nbImpayes} fact.` : 'À jour'}
          sub={nbImpayes > 0
            ? `${fmt(montantImpayes)} FCFA en attente`
            : 'Tous les paiements sont à jour'}
          gradient={nbImpayes > 0
            ? 'bg-gradient-to-br from-rose-500 to-pink-600'
            : 'bg-gradient-to-br from-slate-400 to-slate-500'}
          onClick={() => onNavigate?.('facturation')}
        />
      </div>

      {/* ── KPIs secondaires — ligne 2 ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label="Personnel actif"
          value={parseInt(ss.total_staff || 0)}
          sub={`${ss.enseignants || 0} enseignants`}
          color="bg-blue-500"
          onClick={() => onNavigate?.('rh')}
        />
        <KpiCard
          icon={Clock}
          label="Dossiers en attente"
          value={enAttente}
          sub="À inscrire"
          color={enAttente > 0 ? 'bg-amber-500' : 'bg-slate-400'}
          trend={enAttente > 0 ? 'up' : undefined}
          onClick={() => onNavigate?.('admission')}
        />
        <KpiCard
          icon={Globe}
          label="Portail parent"
          value={nbCandidatures > 0 ? nbCandidatures : 'Aucun'}
          sub={nbCandidatures > 0 ? 'dossier(s) soumis en ligne' : 'Aucune candidature en ligne'}
          color={nbCandidatures > 0 ? 'bg-violet-500' : 'bg-slate-400'}
          trend={nbCandidatures > 0 ? 'up' : undefined}
          onClick={() => onNavigate?.('admission')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Échéances en retard"
          value={nbEnRetard > 0 ? nbEnRetard : 'Aucun'}
          sub={nbEnRetard > 0 ? `${fmt(montantRestant)} FCFA restant` : 'Pas de retard'}
          color={nbEnRetard > 0 ? 'bg-rose-500' : 'bg-slate-400'}
          trend={nbEnRetard > 0 ? 'down' : undefined}
          onClick={() => onNavigate?.('facturation')}
        />
      </div>

      {/* ── Effectifs + Calendrier ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Chart effectifs */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionTitle icon={Building2} label={`Effectifs par classe — ${annee}`} color="text-indigo-600" />
            <button onClick={() => onNavigate?.('eleves')} className="text-[9px] font-black text-indigo-500 flex items-center gap-1 hover:underline">
              Voir les élèves <ChevronRight size={10} />
            </button>
          </div>
          <div className="h-40 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={20} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
                  formatter={(v: any, name: string) => [`${v}`, name === 'inscrits' ? 'Inscrits' : 'Capacité']}
                />
                <Bar dataKey="capacite" name="Capacité" fill="#f1f5f9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="inscrits" name="Inscrits" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b-2 border-slate-50">
                  {['Classe', 'Enseignant(e)', 'Élèves', 'Taux', <Bus key="bus" size={10} className="inline" />, <Utensils key="can" size={10} className="inline" />].map((h, i) => (
                    <th key={i} className={`${i >= 2 ? 'text-right' : 'text-left'} font-black text-slate-300 uppercase tracking-widest pb-3 pr-3`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.classes || []).map((c: any) => {
                  const ins = parseInt(c.nb_inscrits || 0);
                  const cap = parseInt(c.capacite_max || 30);
                  const t   = pct(ins, cap);
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-3">
                        <span className="font-black text-slate-800">{c.nom}</span>
                        <span className="ml-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: (NIVEAU_COLORS[c.niveau] || '#6366f1') + '20', color: NIVEAU_COLORS[c.niveau] || '#6366f1' }}>
                          {NIVEAU_LABELS[c.niveau] || c.niveau}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 font-semibold">{c.enseignant || '—'}</td>
                      <td className="py-2.5 pr-3 text-right font-black text-slate-800">
                        {ins}<span className="text-slate-300 font-normal">/{cap}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-black ${
                          t >= 80 ? 'bg-emerald-100 text-emerald-700' : t >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'}`}>
                          {t}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-sky-600">{c.nb_bus || 0}</td>
                      <td className="py-2.5 text-right font-bold text-orange-500">{c.nb_cantine || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calendrier scolaire */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={CalendarDays} label="Calendrier" color="text-violet-600" />
          </div>
          <div className="space-y-1.5">
            {(upcomingEvents || []).length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-bold text-slate-400">Aucun événement dans les 30 jours</p>
              </div>
            ) : (upcomingEvents || []).map((ev: any, i: number) => {
              const cfg = EVENT_ICONS[ev.type] || EVENT_ICONS.FERIE;
              const EIcon = cfg.icon;
              const j = daysUntil(ev.date_debut);
              return (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <EIcon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{ev.titre}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">
                      {formatDate(ev.date_debut)}{ev.date_fin && ev.date_fin !== ev.date_debut ? ` → ${formatDate(ev.date_fin)}` : ''}
                    </p>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                    j <= 3 ? 'bg-rose-100 text-rose-600' : j <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {j === 0 ? "Auj." : `J-${j}`}
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={() => onNavigate?.('evenements')}
            className="mt-4 w-full text-[9px] font-black text-violet-600 flex items-center justify-center gap-1 py-2.5 border border-violet-100 rounded-2xl hover:bg-violet-50 transition-colors">
            Tout le calendrier <ChevronRight size={10} />
          </button>
        </div>
      </div>

      {/* ── Candidatures portail parent ─────────────────────────────────────── */}
      {candidaturesPortail.length > 0 && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-violet-600 rounded-2xl flex items-center justify-center">
                <Globe size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-violet-800">Candidatures portail parent</h3>
                <p className="text-[10px] text-violet-500 font-semibold">{nbCandidatures} dossier{nbCandidatures > 1 ? 's' : ''} soumis en ligne — à instruire</p>
              </div>
            </div>
            <button onClick={() => onNavigate?.('admission')}
              className="text-[9px] font-black text-violet-700 bg-white px-3 py-1.5 rounded-xl border border-violet-200 hover:bg-violet-50 flex items-center gap-1 transition-colors">
              Traiter <ArrowRight size={10} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {candidaturesPortail.slice(0, 6).map((c: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-violet-50">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-black text-[10px] flex-shrink-0">
                  {(NIVEAU_LABELS[c.niveau] || c.niveau || '?').substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 truncate">{c.nom_complet}</p>
                  <p className="text-[9px] text-violet-500 font-semibold">
                    {NIVEAU_LABELS[c.niveau] || c.niveau} · {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className="text-[8px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex-shrink-0">Portail</span>
              </div>
            ))}
          </div>
          {candidaturesPortail.length > 6 && (
            <p className="text-[9px] font-black text-violet-500 text-center mt-3">
              +{candidaturesPortail.length - 6} autre{candidaturesPortail.length - 6 > 1 ? 's' : ''} dossier{candidaturesPortail.length - 6 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Admissions récentes + Débiteurs ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Admissions récentes */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={UserPlus} label="Dernières admissions" color="text-emerald-600" />
            <button onClick={() => onNavigate?.('admission')} className="text-[9px] font-black text-emerald-600 flex items-center gap-1 hover:underline">
              Voir tout <ArrowRight size={9} />
            </button>
          </div>
          <div className="space-y-1.5">
            {(data?.recentAdmissions || []).length === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold text-center py-6">Aucune admission récente</p>
            ) : (data?.recentAdmissions || []).map((el: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={{ background: (NIVEAU_COLORS[el.niveau] || '#6366f1') + '20', color: NIVEAU_COLORS[el.niveau] || '#6366f1' }}>
                  {(el.niveau || 'N').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 truncate">{el.nom_complet}</p>
                  <p className="text-[9px] text-slate-400 font-semibold">{el.matricule} · {el.classe || NIVEAU_LABELS[el.niveau] || el.niveau}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                    el.statut === 'INSCRIT' ? 'bg-emerald-100 text-emerald-700' :
                    el.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'}`}>
                    {el.statut === 'INSCRIT' ? 'Inscrit' : el.statut === 'EN_ATTENTE' ? 'En attente' : el.statut}
                  </span>
                  {el.date_admission && (
                    <p className="text-[8px] text-slate-300 font-semibold mt-0.5">{formatDate(el.date_admission)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top débiteurs + pie recouvrement */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={AlertTriangle} label="Impayés en cours" color="text-rose-600" />
            <button onClick={() => onNavigate?.('facturation')} className="text-[9px] font-black text-rose-600 flex items-center gap-1 hover:underline">
              Gérer <ArrowRight size={9} />
            </button>
          </div>

          {(data?.topDebtors || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-[11px] font-black text-emerald-700">Aucun impayé en cours</p>
              <p className="text-[9px] text-slate-400 font-semibold">Tous les paiements sont à jour !</p>
            </div>
          ) : (
            <>
              {/* Mini pie recouvrement */}
              {totalFacture > 0 && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-20 h-20 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie data={recoveryPie} cx="50%" cy="50%" innerRadius={22} outerRadius={35} dataKey="value" paddingAngle={2}>
                          {recoveryPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-black text-slate-900">{tauxRecouvrement}%</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recouvré</p>
                    <div className="flex gap-3 mt-1.5">
                      <span className="text-[8px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {fmt(totalEncaisse)}
                      </span>
                      <span className="text-[8px] font-bold text-rose-500 flex items-center gap-0.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> {fmt(montantRestant)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(data?.topDebtors || []).map((d: any, i: number) => {
                  const maxDette = Math.max(...(data?.topDebtors || []).map((x: any) => parseFloat(x.dette || 0)));
                  const bar = pct(parseFloat(d.dette), maxDette);
                  return (
                    <div key={i} className="p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-black text-slate-800 truncate flex-1 pr-2">{d.nom}</p>
                        <span className="text-[10px] font-black text-rose-600 flex-shrink-0">{fmt(parseFloat(d.dette || 0))} {currency}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full" style={{ width: `${bar}%` }} />
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
            </>
          )}
        </div>
      </div>

      {/* ── Mini stats + Actions rapides ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Mini stats services */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { icon: Bus,      label: 'Transport bus',  value: parseInt(es.avec_bus || 0),     color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
            { icon: Utensils, label: 'Cantine',         value: parseInt(es.avec_cantine || 0), color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
            { icon: Heart,    label: 'Cas sociaux',     value: parseInt(es.cas_sociaux || 0),  color: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-100' },
            { icon: Baby,     label: 'Crèche',          value: (data?.classes || []).find((c: any) => c.niveau === 'CRECHE')?.nb_inscrits || 0,
              color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3 border ${border}`}>
              <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <SectionTitle icon={Target} label="Actions rapides" />
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: UserPlus,      label: 'Nouvelle\nadmission',    tab: 'admission',     color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100' },
              { icon: Receipt,       label: 'Facturation\nscolaire',  tab: 'facturation',   color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100' },
              { icon: MessageSquare, label: 'Envoyer\nWhatsApp',      tab: 'whatsapp',      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100' },
              { icon: FileText,      label: 'Bulletins',              tab: 'bulletins',     color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100' },
              { icon: CalendarDays,  label: 'Emploi\ndu temps',       tab: 'emploidutemps', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100' },
              { icon: Users,         label: 'Gestion\nRH',            tab: 'rh',            color: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100' },
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

    </div>
  );
};

export default SchoolAdminDashboard;
