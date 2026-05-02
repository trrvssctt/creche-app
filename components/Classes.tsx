
import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, Clock, TrendingUp, ArrowLeft,
  RefreshCw, ChevronRight, Baby, Phone, BookOpen,
  UserCheck, UserX, Search,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { User, Eleve, NiveauScolaire, StatutAdmission } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX_DEF: {
  value: NiveauScolaire;
  label: string;
  cycle: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
}[] = [
  { value: 'CRECHE', label: 'Crèche',         cycle: 'Crèche',       accentBg: 'bg-pink-50',    accentText: 'text-pink-700',    accentBorder: 'border-pink-200' },
  { value: 'PS',     label: 'Petite Section',  cycle: 'Maternelle',   accentBg: 'bg-violet-50',  accentText: 'text-violet-700',  accentBorder: 'border-violet-200' },
  { value: 'MS',     label: 'Moyenne Section', cycle: 'Maternelle',   accentBg: 'bg-indigo-50',  accentText: 'text-indigo-700',  accentBorder: 'border-indigo-200' },
  { value: 'GS',     label: 'Grande Section',  cycle: 'Maternelle',   accentBg: 'bg-blue-50',    accentText: 'text-blue-700',    accentBorder: 'border-blue-200' },
  { value: 'CP',     label: 'CP',              cycle: 'Élémentaire',  accentBg: 'bg-cyan-50',    accentText: 'text-cyan-700',    accentBorder: 'border-cyan-200' },
  { value: 'CE1',    label: 'CE1',             cycle: 'Élémentaire',  accentBg: 'bg-teal-50',    accentText: 'text-teal-700',    accentBorder: 'border-teal-200' },
  { value: 'CE2',    label: 'CE2',             cycle: 'Élémentaire',  accentBg: 'bg-emerald-50', accentText: 'text-emerald-700', accentBorder: 'border-emerald-200' },
  { value: 'CM1',    label: 'CM1',             cycle: 'Élémentaire',  accentBg: 'bg-amber-50',   accentText: 'text-amber-700',   accentBorder: 'border-amber-200' },
  { value: 'CM2',    label: 'CM2',             cycle: 'Élémentaire',  accentBg: 'bg-orange-50',  accentText: 'text-orange-700',  accentBorder: 'border-orange-200' },
];

const CYCLES = ['Crèche', 'Maternelle', 'Élémentaire'] as const;

const STATUTS_INSCRITS: StatutAdmission[] = ['INSCRIT', 'ACTIF'];
const STATUTS_CANDIDATURES: StatutAdmission[] = ['EN_ATTENTE', 'ADMIS'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAdmissionStatut(d: any): StatutAdmission {
  const s = d.statut || '';
  if (['EN_ATTENTE', 'ADMIS', 'INSCRIT', 'ACTIF', 'RADIE', 'SUSPENDU'].includes(s)) return s as StatutAdmission;
  const api = (d.status || '').toLowerCase();
  if (api === 'actif')      return 'ACTIF';
  if (api === 'inscrit')    return 'INSCRIT';
  if (api === 'admis')      return 'ADMIS';
  if (api === 'radie')      return 'RADIE';
  if (api === 'suspendu')   return 'SUSPENDU';
  return 'EN_ATTENTE';
}

function computeCA(services: any[], niveau: NiveauScolaire, nbInscrits: number): number {
  let total = 0;
  for (const s of services) {
    const niveaux: string[] = s.niveauxCibles || s.niveaux_cibles || [];
    const matchNiveau = niveaux.length === 0 || niveaux.includes(niveau);
    if (!matchNiveau) continue;
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    const price = Number(s.price || 0);
    const duree = Number(s.dureeMois || s.duree_mois || 1);
    if (type === 'MENSUALITE') {
      total += price * duree * nbInscrits;
    } else if (type === 'INSCRIPTION' || type === 'REINSCRIPTION') {
      total += price * nbInscrits;
    }
  }
  return total;
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface ClassesProps {
  user: User;
  currency: string;
}

const Classes: React.FC<ClassesProps> = ({ user: _user, currency }) => {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNiveau, setSelectedNiveau] = useState<NiveauScolaire | null>(null);
  const [detailSearch, setDetailSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [elevesData, admissionsData, servicesData] = await Promise.all([
        apiClient.get('/eleves').catch(() => []),
        apiClient.get('/customers').catch(() => []),
        apiClient.get('/services').catch(() => []),
      ]);
      setEleves(Array.isArray(elevesData) ? elevesData : (elevesData?.rows ?? elevesData?.eleves ?? []));
      setAdmissions(Array.isArray(admissionsData) ? admissionsData : (admissionsData?.rows ?? admissionsData?.customers ?? []));
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Stats globales ─────────────────────────────────────────────────────────

  const globalStats = useMemo(() => {
    const totalInscrits    = eleves.filter(e => STATUTS_INSCRITS.includes(e.statut)).length;
    const totalActifs      = eleves.filter(e => e.statut === 'ACTIF').length;
    const totalCandidatures = admissions.filter(d => STATUTS_CANDIDATURES.includes(getAdmissionStatut(d))).length;
    const totalCA = NIVEAUX_DEF.reduce((sum, n) => {
      const inscrits = eleves.filter(e => e.niveau === n.value && STATUTS_INSCRITS.includes(e.statut));
      return sum + computeCA(services, n.value, inscrits.length);
    }, 0);
    return { totalInscrits, totalActifs, totalCandidatures, totalCA };
  }, [eleves, admissions, services]);

  // ── Stats par niveau ───────────────────────────────────────────────────────

  const statsParNiveau = useMemo(() => {
    return NIVEAUX_DEF.map(n => {
      const inscrits     = eleves.filter(e => e.niveau === n.value && STATUTS_INSCRITS.includes(e.statut));
      const candidatures = admissions.filter(d => d.niveau === n.value && STATUTS_CANDIDATURES.includes(getAdmissionStatut(d)));
      const ca           = computeCA(services, n.value, inscrits.length);
      return { ...n, inscrits, candidatures, ca };
    });
  }, [eleves, admissions, services]);

  // ── Vue détail ─────────────────────────────────────────────────────────────

  const detailData = useMemo(() => {
    if (!selectedNiveau) return null;
    const def = NIVEAUX_DEF.find(n => n.value === selectedNiveau)!;
    const elevesNiveau = eleves.filter(e => e.niveau === selectedNiveau);
    const filtered = detailSearch
      ? elevesNiveau.filter(e =>
          `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(detailSearch.toLowerCase())
        )
      : elevesNiveau;
    return { def, eleves: filtered };
  }, [selectedNiveau, eleves, detailSearch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des classes...</p>
      </div>
    );
  }

  // ── VUE DÉTAIL ─────────────────────────────────────────────────────────────
  if (selectedNiveau && detailData) {
    const { def, eleves: elevesDetail } = detailData;
    const stats = statsParNiveau.find(s => s.value === selectedNiveau)!;

    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-20">

        {/* En-tête détail */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedNiveau(null); setDetailSearch(''); }}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all text-slate-500"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                <span className={`px-3 py-1 rounded-xl text-sm font-black border ${def.accentBg} ${def.accentText} ${def.accentBorder}`}>
                  {def.label}
                </span>
                Classe {def.label}
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                Cycle {def.cycle} — {elevesDetail.length} élève{elevesDetail.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={fetchAll} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* KPIs détail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Inscrits / Actifs', value: stats.inscrits.length,     icon: UserCheck,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Candidatures',      value: stats.candidatures.length,  icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Total élèves (all statuts)', value: eleves.filter(e => e.niveau === selectedNiveau).length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'CA prévisionnel',   value: stats.ca.toLocaleString('fr-FR') + ' ' + currency, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
                <kpi.icon className={kpi.color} size={20} />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900">{kpi.value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={detailSearch}
            onChange={e => setDetailSearch(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Liste des élèves */}
        {elevesDetail.length === 0 ? (
          <div className="py-16 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center flex flex-col items-center gap-3">
            <GraduationCap size={36} className="text-slate-300" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucun élève pour cette classe</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Élève', 'Matricule', 'Statut', 'Régime', 'Parent / WhatsApp', 'Options'].map(h => (
                    <th key={h} className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {elevesDetail.map(eleve => {
                  const statutColor: Record<string, string> = {
                    INSCRIT:   'bg-violet-50 text-violet-700 border-violet-200',
                    ACTIF:     'bg-emerald-50 text-emerald-700 border-emerald-200',
                    EN_ATTENTE:'bg-amber-50 text-amber-700 border-amber-200',
                    ADMIS:     'bg-blue-50 text-blue-700 border-blue-200',
                    RADIE:     'bg-rose-50 text-rose-700 border-rose-200',
                    SUSPENDU:  'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  const regimeColor: Record<string, string> = {
                    NORMAL:             'bg-emerald-50 text-emerald-700 border-emerald-200',
                    CAS_SOCIAL_PARTIEL: 'bg-amber-50 text-amber-700 border-amber-200',
                    CAS_SOCIAL_TOTAL:   'bg-rose-50 text-rose-700 border-rose-200',
                  };
                  return (
                    <tr key={eleve.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 ${def.accentBg} ${def.accentText} rounded-xl flex items-center justify-center font-black text-sm shrink-0`}>
                            {eleve.prenom?.[0]}{eleve.nom?.[0]}
                          </div>
                          <span className="font-black text-slate-900">{eleve.prenom} {eleve.nom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500 font-mono">{eleve.matricule}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statutColor[eleve.statut] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {eleve.statut === 'EN_ATTENTE' ? 'Candidature' : eleve.statut === 'CAS_SOCIAL_PARTIEL' ? 'Cas social partiel' : eleve.statut}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${regimeColor[eleve.regimeFinancier] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {eleve.regimeFinancier === 'NORMAL' ? 'Normal' : eleve.regimeFinancier === 'CAS_SOCIAL_PARTIEL' ? 'Social partiel' : 'Social total'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-500 font-bold">
                        <div className="flex items-center gap-1">
                          <Phone size={10} />
                          {eleve.parent1?.prenom} — {eleve.parent1?.whatsapp || eleve.parent1?.telephone || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5 text-[9px] font-black">
                          {eleve.cantine && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">Cantine</span>}
                          {eleve.transportBus && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">Bus</span>}
                          {eleve.besoinSpecifique && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100 flex items-center gap-1"><Baby size={9} />Spécifique</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── VUE GRILLE ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <BookOpen className="text-indigo-600" size={32} /> Classes de l'Établissement
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Le Toit des Anges — Crèche · Maternelle · Élémentaire
          </p>
        </div>
        <button onClick={fetchAll} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Inscrits & Actifs',   value: globalStats.totalInscrits,                                icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Candidatures',        value: globalStats.totalCandidatures,                             icon: Clock,     color: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Total élèves',        value: eleves.length,                                             icon: Users,     color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'CA prévisionnel ann.', value: globalStats.totalCA.toLocaleString('fr-FR') + ' ' + currency, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <kpi.icon className={kpi.color} size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{kpi.value}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grille par cycle */}
      {CYCLES.map(cycle => {
        const niveauxDuCycle = statsParNiveau.filter(n => n.cycle === cycle);
        return (
          <div key={cycle}>
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.35em] mb-4 flex items-center gap-3">
              <span className="flex-1 h-px bg-slate-100" />
              {cycle}
              <span className="flex-1 h-px bg-slate-100" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {niveauxDuCycle.map(n => (
                <button
                  key={n.value}
                  onClick={() => { setSelectedNiveau(n.value); setDetailSearch(''); }}
                  className={`bg-white rounded-[2.5rem] border ${n.accentBorder} p-7 shadow-sm hover:shadow-xl transition-all group text-left w-full`}
                >
                  {/* Titre */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`px-4 py-2 ${n.accentBg} ${n.accentText} rounded-2xl font-black text-sm uppercase tracking-widest`}>
                      {n.label}
                    </div>
                    <div className={`w-9 h-9 ${n.accentBg} ${n.accentText} rounded-xl flex items-center justify-center opacity-50 group-hover:opacity-100 transition-all`}>
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <UserCheck size={10} /> Inscrits
                      </p>
                      <p className="text-3xl font-black text-slate-900">{n.inscrits.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> Candidatures
                      </p>
                      <p className="text-3xl font-black text-slate-500">{n.candidatures.length}</p>
                    </div>
                  </div>

                  {/* CA */}
                  {n.ca > 0 && (
                    <div className={`mt-5 pt-4 border-t ${n.accentBorder} flex items-center justify-between`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <TrendingUp size={10} /> CA prévisionnel
                      </span>
                      <span className={`text-sm font-black ${n.accentText}`}>
                        {n.ca.toLocaleString('fr-FR')} {currency}
                      </span>
                    </div>
                  )}

                  {/* Aucun élève */}
                  {n.inscrits.length === 0 && n.candidatures.length === 0 && (
                    <p className="mt-3 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Aucun élève</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Classes;
