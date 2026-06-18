import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, BookOpen, Calendar, Clock,
  XCircle, AlertCircle, ChevronRight, RefreshCw,
  ClipboardList, FileText, Award, Save, School,
  CalendarDays, Check, ShieldCheck, Bus,
  Stethoscope, UserCog, MapPin, Wallet,
  Bell, Coffee, LogIn, LogOut, Home,
  Heart, BookMarked, Trophy, ArrowRight,
  CheckCircle2, Baby, Sparkles, Target
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';
import { User, UserRole, NiveauScolaire } from '../types';

// ─── Constantes ────────────────────────────────────────────────────────────

type Section = 'accueil' | 'ma-classe' | 'presences' | 'mon-planning';
type StatutPresence = 'PRESENT' | 'ABSENT' | 'RETARD';

const STATUT_CFG: Record<StatutPresence, { label: string; bg: string; text: string; border: string }> = {
  PRESENT: { label: 'Présent',  bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  ABSENT:  { label: 'Absent',   bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200'    },
  RETARD:  { label: 'Retard',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'   },
};

const JOUR_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const MATIERE_COLORS: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  pink:   'bg-pink-50 text-pink-700 border-pink-200',
  teal:   'bg-teal-50 text-teal-700 border-teal-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  rose:   'bg-rose-50 text-rose-700 border-rose-200',
  slate:  'bg-slate-100 text-slate-700 border-slate-200',
};

const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');

interface ClasseLocal {
  id: string; nom: string; niveau: NiveauScolaire;
  enseignantId?: string;
  enseignantsMatiere?: Array<{ enseignantId: string; matiere: string }>;
  capaciteMax: number; anneeScolaire: string; nbEleves?: number;
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

const roleLabel = (role: string): { label: string; color: string; Icon: any } => {
  switch (role) {
    case 'ENSEIGNANT': case 'MAITRESSE': return { label: 'Enseignant(e)', color: 'indigo', Icon: GraduationCap };
    case 'INFIRMIERE':  return { label: 'Infirmière',       color: 'rose',   Icon: Stethoscope };
    case 'CHAUFFEUR':   return { label: 'Chauffeur',         color: 'amber',  Icon: Bus };
    case 'ASSISTANTE':  return { label: 'Assistante',        color: 'violet', Icon: UserCog };
    case 'COMPTABLE':   return { label: 'Comptable',         color: 'teal',   Icon: Wallet };
    default:            return { label: 'Employé(e)',        color: 'slate',  Icon: Users };
  }
};

const isTeacher = (role: string) =>
  ['ENSEIGNANT', 'MAITRESSE', 'DIRECTEUR', 'ADMIN'].includes(role);

// ─── Props ──────────────────────────────────────────────────────────────────

interface TeacherPortalProps {
  user: User; currency: string;
  onNavigate: (tab: string) => void;
  initialSection?: Section;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

const TeacherPortal: React.FC<TeacherPortalProps> = ({
  user, currency, onNavigate, initialSection = 'accueil'
}) => {
  const addToast = useToast();
  const { annee } = useAnnee();
  const [section, setSection] = useState<Section>(initialSection);
  const [classes, setClasses] = useState<ClasseLocal[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [pointage, setPointage] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Présences
  const [selectedClassId, setSelectedClassId] = useState('');
  const [presenceDate, setPresenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [presences, setPresences] = useState<Record<string, StatutPresence>>({});
  const [loadingPresences, setLoadingPresences] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const empId = String(user.employeeId || '');
  const role = user.role;
  const rl = roleLabel(role);
  const isDirecteur = role === 'ADMIN' || role === 'DIRECTEUR';

  // ── Chargement ─────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const reqs: Promise<any>[] = [
        apiClient.get('/hr/attendance/my/today').catch(() => null),
        apiClient.get('/hr/leaves/my').catch(() => []),
      ];
      if (isTeacher(role)) {
        reqs.push(
          apiClient.get('/classes', { params: { anneeScolaire: annee } }).catch(() => []),
          apiClient.get('/eleves', { params: { anneeScolaire: annee } }).catch(() => []),
          apiClient.get('/schedule', { params: { anneeScolaire: annee } }).catch(() => []),
        );
      }
      const results = await Promise.all(reqs);
      setPointage(results[0]);
      setLeaves(Array.isArray(results[1]) ? results[1] : []);
      if (isTeacher(role)) {
        setClasses(Array.isArray(results[2]) ? results[2] : (results[2]?.rows ?? []));
        setEleves(Array.isArray(results[3]) ? results[3] : (results[3]?.rows ?? []));
        setCreneaux(Array.isArray(results[4]) ? results[4] : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [annee]); // eslint-disable-line

  // ── Mes classes ───────────────────────────────────────────────────────
  const myClasses = useMemo(() => {
    // Directrice : toutes les classes
    if (isDirecteur) return classes;
    if (!empId) return classes;
    // Prof : uniquement les classes dont elle est prof PRINCIPALE
    return classes.filter(c => String(c.enseignantId) === empId);
  }, [classes, empId, isDirecteur]);

  const getRoleInClass = (c: ClasseLocal) => {
    if (isDirecteur) return '';
    if (String(c.enseignantId) === empId) return 'Prof. Principal';
    const em = (c.enseignantsMatiere || []).find(e => String(e.enseignantId) === empId);
    return em ? em.matiere : 'Intervenant';
  };

  // ── Emploi du temps du jour ───────────────────────────────────────────
  const todayCreneaux = useMemo(() => {
    const jsDay = new Date().getDay(); // 0=dim, 1=lun...
    const appDay = jsDay === 0 ? -1 : jsDay - 1; // 0=lun, 4=ven, -1=week-end
    if (appDay < 0) return [];
    const myClassIds = new Set(myClasses.map(c => c.id));
    return creneaux
      .filter((cr: any) => cr.jour === appDay && (myClassIds.has(cr.classeId) || String(cr.enseignantId) === empId))
      .sort((a: any, b: any) => a.heureDebut.localeCompare(b.heureDebut));
  }, [creneaux, myClasses, empId]);

  // ── Planning de la semaine ────────────────────────────────────────────
  const weekPlanning = useMemo(() => {
    const myClassIds = new Set(myClasses.map(c => c.id));
    const grouped: Record<number, any[]> = {};
    for (let d = 0; d < 5; d++) grouped[d] = [];
    creneaux
      .filter((cr: any) => myClassIds.has(cr.classeId) || String(cr.enseignantId) === empId)
      .forEach((cr: any) => { if (cr.jour >= 0 && cr.jour <= 4) grouped[cr.jour].push(cr); });
    for (let d = 0; d < 5; d++) grouped[d].sort((a: any, b: any) => a.heureDebut.localeCompare(b.heureDebut));
    return grouped;
  }, [creneaux, myClasses, empId]);

  // ── Présences ─────────────────────────────────────────────────────────
  const elevesClasse = useMemo(() =>
    eleves.filter(e => String(e.classeId) === selectedClassId && ['INSCRIT', 'ACTIF'].includes(e.statut)),
    [eleves, selectedClassId]
  );

  useEffect(() => {
    if (!selectedClassId || !presenceDate) return;
    const load = async () => {
      setLoadingPresences(true);
      const data = await apiClient.get('/teacher/presences', { params: { classeId: selectedClassId, date: presenceDate } }).catch(() => []);
      const map: Record<string, StatutPresence> = {};
      if (Array.isArray(data)) data.forEach((p: any) => { map[p.eleveId] = p.statut; });
      setPresences(map);
      setLoadingPresences(false);
    };
    load();
  }, [selectedClassId, presenceDate]);

  useEffect(() => {
    if (elevesClasse.length === 0) return;
    setPresences(prev => {
      const u = { ...prev };
      elevesClasse.forEach(e => { if (!u[e.id]) u[e.id] = 'PRESENT'; });
      return u;
    });
  }, [elevesClasse]);

  const handleSavePresences = async () => {
    if (!selectedClassId || elevesClasse.length === 0) return;
    setIsSaving(true);
    try {
      await apiClient.post('/teacher/presences', {
        classeId: selectedClassId, date: presenceDate,
        presences: Object.entries(presences).map(([eleveId, statut]) => ({ eleveId, statut }))
      });
      addToast('Présences enregistrées ✓', 'success');
    } catch (err: any) { addToast(err.message || 'Erreur', 'error'); }
    finally { setIsSaving(false); }
  };

  // ── Infos globales ────────────────────────────────────────────────────
  const myElevesCount = useMemo(() =>
    eleves.filter(e => myClasses.some(c => String(c.id) === String(e.classeId))).length,
    [eleves, myClasses]
  );
  const congesEnCours = leaves.filter((l: any) => l.status === 'APPROVED' &&
    new Date(l.startDate) <= new Date() && new Date(l.endDate) >= new Date()).length;
  const congesEnAttente = leaves.filter((l: any) => l.status === 'PENDING').length;

  const nowDate = new Date();
  const dateStr = nowDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const greeting = nowDate.getHours() < 12 ? 'Bonjour' : nowDate.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';
  const firstName = (user.name || '').split(' ')[0];
  const isWeekend = nowDate.getDay() === 0 || nowDate.getDay() === 6;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement…</p>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // VUE EMPLOYÉ NON-ENSEIGNANT (vigile, infirmière, chauffeur, secrétaire)
  // ═══════════════════════════════════════════════════════════════════════
  if (!isTeacher(role)) {
    const RoleIcon = rl.Icon;
    return (
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest capitalize">{dateStr}</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              {greeting}, <span className="text-indigo-600">{firstName}</span>
            </h2>
            <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-${rl.color}-50 text-${rl.color}-700 text-[10px] font-black border border-${rl.color}-100`}>
              <RoleIcon size={12} /> {rl.label}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${pointage?.attendance?.clockIn ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
              <Clock size={14} />
              {pointage?.attendance?.clockIn
                ? `Pointé à ${String(pointage.attendance.clockIn).slice(0, 5)}`
                : 'Non pointé aujourd\'hui'}
            </div>
            <button
              onClick={() => onNavigate('employee-pointage')}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
            >
              Pointer
            </button>
          </div>
        </div>

        {/* KPIs rapides */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-${rl.color}-50 flex items-center justify-center`}>
              <RoleIcon size={18} className={`text-${rl.color}-600`} />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-800">{rl.label}</p>
              <p className="text-[9px] text-slate-400 font-semibold">Poste actuel</p>
            </div>
          </div>
          <div className={`bg-white rounded-2xl border ${congesEnCours > 0 ? 'border-amber-200' : 'border-slate-100'} shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow`} onClick={() => onNavigate('my-leaves')}>
            <div className={`w-10 h-10 rounded-xl ${congesEnCours > 0 ? 'bg-amber-50' : 'bg-slate-50'} flex items-center justify-center`}>
              <CalendarDays size={18} className={congesEnCours > 0 ? 'text-amber-600' : 'text-slate-400'} />
            </div>
            <div>
              <p className={`text-xl font-black ${congesEnCours > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {congesEnCours > 0 ? 'En congé' : 'Présent'}
              </p>
              <p className="text-[9px] text-slate-400 font-semibold">{congesEnAttente > 0 ? `${congesEnAttente} demande(s) en attente` : 'Aucune demande en cours'}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow col-span-2 md:col-span-1" onClick={() => onNavigate('employee-profile')}>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <FileText size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-800">Mon profil</p>
              <p className="text-[9px] text-slate-400 font-semibold">Contrat & Documents</p>
            </div>
          </div>
        </div>

        {/* Accès rapides selon rôle */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Target size={12} /> Mes accès rapides
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { icon: Clock,         label: 'Mon\nPointage',   tab: 'employee-pointage', color: 'bg-indigo-50 text-indigo-700' },
              { icon: CalendarDays,  label: 'Mes\nCongés',     tab: 'my-leaves',         color: 'bg-violet-50 text-violet-700' },
              { icon: FileText,      label: 'Fiches\nde paie', tab: 'my-payslips',        color: 'bg-teal-50 text-teal-700' },
              { icon: Bell,          label: 'Annonces\nécole', tab: 'evenements',        color: 'bg-amber-50 text-amber-700' },
              ...(role === 'INFIRMIERE' ? [
                { icon: Stethoscope, label: 'Fiches\nsanitaires', tab: 'eleves',  color: 'bg-rose-50 text-rose-700' },
              ] : []),
              ...(role === 'CHAUFFEUR' ? [
                { icon: Bus,         label: 'Liste\ntransport', tab: 'eleves',   color: 'bg-sky-50 text-sky-700' },
              ] : []),
              ...(role === 'ASSISTANTE' ? [
                { icon: Users,       label: 'Liste\nélèves',   tab: 'eleves',    color: 'bg-green-50 text-green-700' },
                { icon: Award,       label: 'Certificats',     tab: 'certificats', color: 'bg-orange-50 text-orange-700' },
              ] : []),
            ].map(({ icon: Icon, label, tab, color }) => (
              <button key={tab + label} onClick={() => onNavigate(tab)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors text-center ${color} hover:opacity-80`}>
                <Icon size={20} />
                <span className="text-[9px] font-black uppercase tracking-wide leading-tight whitespace-pre-line">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message rôle spécifique */}
        {role === 'CHAUFFEUR' && (
          <div className="bg-sky-50 rounded-2xl border border-sky-100 p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-sky-700 mb-3 flex items-center gap-2">
              <Bus size={12} /> Élèves avec transport ce jour
            </h3>
            <p className="text-[11px] text-sky-600 font-semibold">
              {eleves.filter(e => e.transportBus && ['INSCRIT','ACTIF'].includes(e.statut)).length} élèves inscrits au transport scolaire.
            </p>
            <button onClick={() => onNavigate('eleves')} className="mt-3 text-[9px] font-black text-sky-700 flex items-center gap-1">
              Voir la liste complète <ArrowRight size={10} />
            </button>
          </div>
        )}

        {role === 'INFIRMIERE' && (
          <div className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-700 mb-3 flex items-center gap-2">
              <Heart size={12} /> Élèves à besoins spécifiques
            </h3>
            <p className="text-[11px] text-rose-600 font-semibold">
              {eleves.filter(e => e.besoinSpecifique && ['INSCRIT','ACTIF'].includes(e.statut)).length} élèves avec fiches sanitaires particulières.
            </p>
            <button onClick={() => onNavigate('eleves')} className="mt-3 text-[9px] font-black text-rose-700 flex items-center gap-1">
              Consulter les fiches <ArrowRight size={10} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VUE ENSEIGNANT / MAITRESSE
  // ═══════════════════════════════════════════════════════════════════════

  const nbAbsents = Object.values(presences).filter(s => s === 'ABSENT').length;
  const nbRetards = Object.values(presences).filter(s => s === 'RETARD').length;

  const tabs: [Section, string, any][] = [
    ['accueil',      'Accueil',                                   Home],
    ['ma-classe',    isDirecteur ? 'Classes' : 'Mes Classes',     GraduationCap],
    ['presences',    'Présences',                                  ClipboardList],
    ['mon-planning', 'Planning',                                   CalendarDays],
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest capitalize">{dateStr}</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            {greeting}, <span className="text-indigo-600">{firstName}</span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            <span className="text-indigo-600 font-black">{myClasses.length}</span> classe{myClasses.length !== 1 ? 's' : ''} {isDirecteur ? 'au total' : `assignée${myClasses.length !== 1 ? 's' : ''}`} · <span className="text-indigo-600 font-black">{myElevesCount}</span> élèves · {annee}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${pointage?.attendance?.clockIn ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
            <Clock size={14} />
            {pointage?.attendance?.clockIn ? `Pointé ${String(pointage.attendance.clockIn).slice(0, 5)}` : 'Non pointé'}
          </div>
          <button onClick={() => onNavigate('employee-pointage')}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
            Pointer
          </button>
        </div>
      </div>

      {/* ── Planning du jour (en haut si des cours aujourd'hui) ─────────── */}
      {todayCreneaux.length > 0 && (
        <div className="bg-indigo-600 rounded-2xl p-5 text-white">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
            <Clock size={12} /> Aujourd'hui — {JOUR_LABELS[new Date().getDay() - 1]}
          </h3>
          <div className="flex flex-wrap gap-2">
            {todayCreneaux.map((cr: any, i: number) => {
              const classe = classes.find(c => c.id === cr.classeId);
              return (
                <div key={i} className="bg-white/15 rounded-xl px-3 py-2 min-w-[120px]">
                  <p className="text-[9px] font-black opacity-70">{cr.heureDebut}–{cr.heureFin}</p>
                  <p className="text-[11px] font-black mt-0.5">{cr.matiere}</p>
                  <p className="text-[9px] opacity-70 font-semibold">{classe?.nom || '—'}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isWeekend && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex items-center gap-3">
          <Sparkles size={20} className="text-emerald-500" />
          <div>
            <p className="text-[11px] font-black text-emerald-700">Bon week-end !</p>
            <p className="text-[9px] text-emerald-500 font-semibold">Prochain cours lundi matin.</p>
          </div>
        </div>
      )}

      {/* ── Stats rapides ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Mes Classes',  value: myClasses.length,  Icon: School,      color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Mes Élèves',   value: myElevesCount,     Icon: Users,       color: 'bg-violet-50 text-violet-600' },
          { label: 'Absents auj.', value: nbAbsents,         Icon: XCircle,     color: 'bg-rose-50 text-rose-600' },
          { label: 'Retards auj.', value: nbRetards,         Icon: AlertCircle, color: 'bg-amber-50 text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center flex-shrink-0`}>
              <k.Icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Onglets ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-2xl shadow-sm w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSection(key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5
              ${section === key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* ═══════ ACCUEIL ══════════════════════════════════════════════════ */}
      {section === 'accueil' && (
        <div className="space-y-5">
          {/* Raccourcis */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Mes Classes',     desc: 'Voir vos élèves',           Icon: GraduationCap, color: 'bg-indigo-50 text-indigo-700', action: () => setSection('ma-classe') },
              { label: 'Présences',       desc: isDirecteur ? 'Consulter les présences' : 'Saisir absences & retards', Icon: ClipboardList, color: 'bg-violet-50 text-violet-700', action: () => setSection('presences') },
              { label: 'Mon Planning',    desc: 'Emploi du temps',           Icon: CalendarDays,  color: 'bg-sky-50 text-sky-700',      action: () => setSection('mon-planning') },
              { label: 'Bulletins',       desc: 'Saisie des notes',          Icon: BookOpen,      color: 'bg-emerald-50 text-emerald-700', action: () => onNavigate('bulletins') },
              { label: 'Événements',      desc: 'Agenda école',              Icon: Calendar,      color: 'bg-amber-50 text-amber-700',  action: () => onNavigate('evenements') },
              { label: 'Mes Congés',      desc: 'Demandes de congés',        Icon: FileText,      color: 'bg-rose-50 text-rose-700',    action: () => onNavigate('my-leaves') },
              { label: 'Mon Pointage',    desc: 'Enregistrer mes heures',    Icon: Clock,         color: 'bg-slate-100 text-slate-700', action: () => onNavigate('employee-pointage') },
              { label: 'Certificats',     desc: 'Documents officiels',       Icon: Award,         color: 'bg-teal-50 text-teal-700',    action: () => onNavigate('certificats') },
            ].map(t => (
              <button key={t.label} onClick={t.action}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className={`w-9 h-9 rounded-xl ${t.color} flex items-center justify-center mb-3`}>
                  <t.Icon size={18} />
                </div>
                <p className="text-[11px] font-black text-slate-900">{t.label}</p>
                <p className="text-[9px] font-semibold text-slate-400 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Classes aperçu */}
          {myClasses.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isDirecteur ? 'Toutes les Classes — Aperçu' : 'Mes Classes — Aperçu'}</p>
                <button onClick={() => setSection('ma-classe')} className="text-[9px] font-black text-indigo-500 flex items-center gap-1">
                  Voir tout <ChevronRight size={10} />
                </button>
              </div>
              {myClasses.map(c => {
                const nb = eleves.filter(e => String(e.classeId) === String(c.id)).length;
                return (
                  <div key={c.id} className="px-5 py-3.5 flex items-center gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm">
                      {c.niveau?.substring(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{c.nom}</p>
                      <p className="text-[9px] font-semibold text-indigo-500">{getRoleInClass(c)}</p>
                    </div>
                    <p className="text-lg font-black text-slate-900">{nb}</p>
                    <p className="text-[9px] font-black text-slate-400">élèves</p>
                    <button onClick={() => { setSelectedClassId(c.id); setSection('presences'); }}
                      className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ MA CLASSE ════════════════════════════════════════════════ */}
      {section === 'ma-classe' && (
        <div className="space-y-4">
          {myClasses.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400 bg-white rounded-2xl border border-dashed">
              <GraduationCap size={28} />
              <p className="text-[10px] font-bold uppercase tracking-widest">{isDirecteur ? 'Aucune classe dans le système' : 'Aucune classe assignée'}</p>
            </div>
          ) : myClasses.map(c => {
            const elevesC = eleves.filter(e => String(e.classeId) === String(c.id) && ['INSCRIT', 'ACTIF'].includes(e.statut));
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black">
                      {c.niveau?.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{c.nom}</p>
                      <p className="text-[9px] font-semibold text-indigo-500">{getRoleInClass(c) ? `${getRoleInClass(c)} · ` : ''}{elevesC.length} élève{elevesC.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedClassId(c.id); setSection('presences'); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                    <ClipboardList size={11} /> Présences
                  </button>
                </div>
                {elevesC.length === 0 ? (
                  <p className="py-8 text-center text-[10px] font-bold text-slate-400">Aucun élève inscrit</p>
                ) : (
                  <div>
                    {elevesC.map((e, i) => (
                      <div key={e.id} className="px-5 py-3 flex items-center gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <span className="text-[9px] font-black text-slate-300 w-5 text-right">{i + 1}</span>
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center text-white font-black text-xs">
                          {(e.prenom || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-slate-900 truncate">{e.prenom} {e.nom}</p>
                          <p className="text-[9px] font-semibold text-slate-400 font-mono">{e.matricule}</p>
                        </div>
                        {e.besoinSpecifique && (
                          <div title={e.besoinSpecifique} className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                            <Heart size={10} className="text-rose-500" />
                          </div>
                        )}
                        {e.transportBus && (
                          <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center">
                            <Bus size={10} className="text-sky-500" />
                          </div>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${e.regime_financier === 'CAS_SOCIAL' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {e.regime_financier === 'CAS_SOCIAL' ? 'Social' : 'Normal'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ PRÉSENCES ════════════════════════════════════════════════ */}
      {section === 'presences' && (
        <div className="space-y-4">

          {/* Badge directrice */}
          {isDirecteur && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl w-fit">
              <ShieldCheck size={13} className="text-indigo-600" />
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Vue Directrice — Toutes les classes</span>
            </div>
          )}

          {/* Bannière mode historique */}
          {presenceDate !== new Date().toISOString().split('T')[0] && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
              <CalendarDays size={15} className="text-amber-600 flex-shrink-0" />
              <p className="text-[11px] font-semibold text-amber-700">
                Mode historique — {new Date(presenceDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  {isDirecteur ? 'Classe à consulter' : 'Classe'}
                </label>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">— Sélectionner une classe —</option>
                  {myClasses.map(c => <option key={c.id} value={c.id}>{c.nom}{getRoleInClass(c) ? ` · ${getRoleInClass(c)}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  {isDirecteur ? 'Date à consulter' : 'Date du pointage'}
                </label>
                <input type="date" value={presenceDate} onChange={e => setPresenceDate(e.target.value)}
                  max={isDirecteur ? undefined : new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
          </div>

          {selectedClassId && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {isDirecteur ? 'Consultation' : 'Pointage'} — {myClasses.find(c => c.id === selectedClassId)?.nom}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[9px] font-bold text-emerald-600">{Object.values(presences).filter(s => s === 'PRESENT').length} présents</span>
                    <span className="text-[9px] font-bold text-rose-500">{nbAbsents} absents</span>
                    <span className="text-[9px] font-bold text-amber-500">{nbRetards} retards</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { const all: Record<string, StatutPresence> = {}; elevesClasse.forEach(e => { all[e.id] = 'PRESENT'; }); setPresences(all); }}
                    className="px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-100 transition-colors">
                    Tous présents
                  </button>
                  <button onClick={handleSavePresences} disabled={isSaving || elevesClasse.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                    {isSaving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                    Enregistrer
                  </button>
                </div>
              </div>

              {loadingPresences ? (
                <div className="py-10 flex justify-center"><RefreshCw size={20} className="animate-spin text-slate-300" /></div>
              ) : elevesClasse.length === 0 ? (
                <p className="py-10 text-center text-[10px] font-bold text-slate-400">Aucun élève inscrit dans cette classe</p>
              ) : (
                <div>
                  {elevesClasse.map((eleve, i) => {
                    const statut: StatutPresence = presences[eleve.id] || 'PRESENT';
                    return (
                      <div key={eleve.id} className="px-5 py-3.5 flex items-center gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30">
                        <span className="text-[9px] font-black text-slate-300 w-5 text-right">{i + 1}</span>
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center text-white font-black text-xs">
                          {(eleve.prenom || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-slate-900">{eleve.prenom} {eleve.nom}</p>
                          <p className="text-[9px] font-semibold text-slate-400">{eleve.matricule}</p>
                        </div>
                        <div className="flex gap-1">
                          {(['PRESENT', 'ABSENT', 'RETARD'] as StatutPresence[]).map(s => {
                            const cfg = STATUT_CFG[s]; const isActive = statut === s;
                            return (
                              <button key={s} onClick={() => setPresences(p => ({ ...p, [eleve.id]: s }))}
                                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border transition-all ${isActive ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'}`}>
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!selectedClassId && (
            <div className="py-14 flex flex-col items-center gap-3 text-slate-400 bg-white rounded-2xl border border-dashed">
              <ClipboardList size={24} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Sélectionnez une classe</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════ MON PLANNING (semaine) ═══════════════════════════════════ */}
      {section === 'mon-planning' && (
        <div className="space-y-4">
          {Object.keys(weekPlanning).every(d => weekPlanning[parseInt(d)].length === 0) ? (
            <div className="py-14 flex flex-col items-center gap-3 text-slate-400 bg-white rounded-2xl border border-dashed">
              <CalendarDays size={24} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Aucun créneau planifié cette semaine</p>
              <button onClick={() => onNavigate('emploi-du-temps')} className="text-[9px] font-black text-indigo-500 flex items-center gap-1">
                Configurer l'emploi du temps <ArrowRight size={10} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map(day => {
                const todayAppDay = new Date().getDay() === 0 ? -1 : new Date().getDay() - 1;
                const isToday = day === todayAppDay;
                return (
                  <div key={day} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isToday ? 'border-indigo-200' : 'border-slate-100'}`}>
                    <div className={`px-3 py-2.5 ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest">{JOUR_LABELS[day]}</p>
                      {isToday && <p className="text-[8px] font-bold opacity-70">Aujourd'hui</p>}
                    </div>
                    <div className="divide-y divide-slate-50">
                      {weekPlanning[day].length === 0 ? (
                        <p className="py-4 text-center text-[9px] text-slate-300 font-bold">—</p>
                      ) : weekPlanning[day].map((cr: any, i: number) => {
                        const classe = classes.find(c => c.id === cr.classeId);
                        const style = MATIERE_COLORS[cr.couleur] || MATIERE_COLORS.slate;
                        return (
                          <div key={i} className="p-2.5">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${style}`}>
                              {cr.matiere}
                            </span>
                            <p className="text-[9px] font-black text-slate-800 mt-1 truncate">{cr.heureDebut}–{cr.heureFin}</p>
                            <p className="text-[8px] text-slate-400 font-semibold">{classe?.nom || '—'}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => onNavigate('emploi-du-temps')}
            className="w-full text-[9px] font-black text-indigo-600 flex items-center justify-center gap-1 py-3 border border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-colors bg-white">
            Gérer les emplois du temps <ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TeacherPortal;
