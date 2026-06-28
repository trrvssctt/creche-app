
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CalendarDays, BookOpen, Edit3, Save, X, Plus, Trash2,
  MessageCircle, Send, Copy, Check, Printer, Clock,
  GraduationCap, RefreshCw, Zap, School, ChevronDown,
  User as UserIcon, Settings, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Calendar, AlertCircle, Ban, Star, Umbrella, Archive, Lock, Search,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { useAnnee } from '../contexts/AnneeContext';
import { useToast } from './ToastProvider';
import { User, UserRole } from '../types';
const MOIS   = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const GRID_START = 7 * 60 + 30;   // 07:30 en minutes
const GRID_END   = 18 * 60;       // 18:00 en minutes
const SLOT_MINS  = 30;
const SLOT_H     = 56;            // px par tranche de 30 min
const GRID_H     = ((GRID_END - GRID_START) / SLOT_MINS) * SLOT_H; // 1176px
const JOURS      = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const TIME_RULER = Array.from(
  { length: (GRID_END - GRID_START) / SLOT_MINS + 1 },
  (_, i) => {
    const m = GRID_START + i * SLOT_MINS;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
);

const COULEURS: Record<string, { pill: string; block: string; bar: string }> = {
  blue:    { pill: 'bg-blue-100 text-blue-700 border-blue-200',    block: 'bg-blue-50 border-l-4 border-l-blue-500',    bar: 'bg-blue-500'    },
  emerald: { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', block: 'bg-emerald-50 border-l-4 border-l-emerald-500', bar: 'bg-emerald-500' },
  violet:  { pill: 'bg-violet-100 text-violet-700 border-violet-200',  block: 'bg-violet-50 border-l-4 border-l-violet-500',  bar: 'bg-violet-500'  },
  amber:   { pill: 'bg-amber-100 text-amber-700 border-amber-200',    block: 'bg-amber-50 border-l-4 border-l-amber-400',    bar: 'bg-amber-400'   },
  rose:    { pill: 'bg-rose-100 text-rose-700 border-rose-200',      block: 'bg-rose-50 border-l-4 border-l-rose-500',      bar: 'bg-rose-500'    },
  teal:    { pill: 'bg-teal-100 text-teal-700 border-teal-200',      block: 'bg-teal-50 border-l-4 border-l-teal-500',      bar: 'bg-teal-500'    },
  indigo:  { pill: 'bg-indigo-100 text-indigo-700 border-indigo-200',  block: 'bg-indigo-50 border-l-4 border-l-indigo-500',  bar: 'bg-indigo-500'  },
  orange:  { pill: 'bg-orange-100 text-orange-700 border-orange-200',  block: 'bg-orange-50 border-l-4 border-l-orange-500',  bar: 'bg-orange-500'  },
  slate:   { pill: 'bg-slate-100 text-slate-600 border-slate-200',    block: 'bg-slate-50 border-l-4 border-l-slate-400',    bar: 'bg-slate-400'   },
};

const MATIERES: Record<string, string[]> = {
  CRECHE: ['Éveil', 'Motricité', 'Langage', 'Sieste', 'Activités libres', 'Musique', 'Accueil'],
  PS:  ['Langage', 'Motricité fine', 'Arts plastiques', 'Musique', 'Sieste', 'Récréation'],
  MS:  ['Langage', 'Graphisme', 'Mathématiques', 'Arts plastiques', 'Musique', 'Sieste', 'Récréation'],
  GS:  ['Langage', 'Lecture préparatoire', 'Mathématiques', 'Arts plastiques', 'Musique', 'Récréation'],
  CP:  ['Français', 'Mathématiques', 'Lecture', 'Sciences', 'Sport', 'Morale', 'Récréation'],
  CE1: ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géo', 'Anglais', 'Sport', 'Arts', 'Récréation'],
  CE2: ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géo', 'Anglais', 'Sport', 'Arts', 'Récréation'],
  CM1: ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géo', 'Anglais', 'Sport', 'Informatique', 'Récréation'],
  CM2: ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géo', 'Anglais', 'Sport', 'Informatique', 'Récréation'],
};

const HORAIRES = [
  '07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00',
  '16:30','17:00','17:30','18:00',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'grille' | 'calendrier' | 'mon-planning' | 'cahier';

interface ClasseInfo { id: string; nom: string; niveau: string; }
interface EmpInfo    { id: string; firstName: string; lastName: string; }

interface Creneau {
  id: string;
  classeId: string;
  enseignantId?: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  matiere: string;
  couleur: string;
  anneeScolaire: string;
  dateDebutEffet?: string | null;
  dateSpecifique?: string | null;
  enseignant?: EmpInfo;
  classe?: ClasseInfo;
}

interface JourRepos { date: string; type: 'CONGE' | 'FERIE'; }

interface PlanningConfig {
  id: string;
  anneeScolaire: string;
  dateDebut: string;
  dateFin: string;
  joursRepos: (JourRepos | string)[];
}

interface PlanningException {
  id: string;
  creneauId: string;
  dateException: string;
  typeException: 'ANNULE' | 'MODIFIE';
  matiereOverride?: string;
  heureDebutOverride?: string;
  heureFinOverride?: string;
  note?: string;
}

interface CahierEntry {
  id: string;
  date: string;
  classeId: string;
  matiere: string;
  objectif: string;
  contenu: string;
  devoirs: string;
  observations?: string;
  auteur: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tY(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h * 60 + m - GRID_START) / SLOT_MINS) * SLOT_H;
}

function tH(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(SLOT_H, ((eh * 60 + em - sh * 60 - sm) / SLOT_MINS) * SLOT_H);
}

function nowY(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < GRID_START || mins > GRID_END) return -1;
  return ((mins - GRID_START) / SLOT_MINS) * SLOT_H;
}

function todayJour(): number {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? -1 : d - 1;
}

function empNom(e?: EmpInfo | null): string {
  if (!e) return '';
  return `${e.firstName || ''} ${e.lastName || ''}`.trim();
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function isoToday() { return new Date().toISOString().split('T')[0]; }

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortFr(date: Date): string {
  return `${date.getDate()} ${MOIS[date.getMonth()]}`;
}

const LS_CAHIER = 'cahier_v4';
function loadCahier(): CahierEntry[] {
  try {
    // Migration v3 → v4 (ajout objectif/observations)
    const v4 = localStorage.getItem('cahier_v4');
    if (v4) return JSON.parse(v4);
    const v3 = localStorage.getItem('cahier_v3');
    if (v3) {
      const migrated: CahierEntry[] = (JSON.parse(v3) as any[]).map(e => ({ ...e, objectif: e.objectif || '', observations: e.observations || '' }));
      try { localStorage.setItem('cahier_v4', JSON.stringify(migrated)); } catch {}
      return migrated;
    }
    return [];
  } catch { return []; }
}
function saveCahier(d: CahierEntry[]) {
  try { localStorage.setItem(LS_CAHIER, JSON.stringify(d)); } catch {}
}

function normalizeJoursRepos(raw?: (JourRepos | string)[]): JourRepos[] {
  return (raw || []).map(j => typeof j === 'string' ? { date: j, type: 'CONGE' as const } : j);
}
function findRepos(joursRepos: (JourRepos | string)[] | undefined, dateStr: string): JourRepos | null {
  const normalized = normalizeJoursRepos(joursRepos);
  return normalized.find(j => j.date === dateStr) ?? null;
}

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'PS', MS: 'MS', GS: 'GS',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const MATIERE_COLORS: Record<string, string> = {
  'Français':          'bg-blue-100 text-blue-700 border-blue-200',
  'Lecture':           'bg-sky-100 text-sky-700 border-sky-200',
  'Lecture préparatoire': 'bg-sky-100 text-sky-700 border-sky-200',
  'Mathématiques':     'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Anglais':           'bg-rose-100 text-rose-700 border-rose-200',
  'Sciences':          'bg-teal-100 text-teal-700 border-teal-200',
  'Histoire-Géo':      'bg-amber-100 text-amber-700 border-amber-200',
  'Sport':             'bg-orange-100 text-orange-700 border-orange-200',
  'Arts':              'bg-purple-100 text-purple-700 border-purple-200',
  'Arts plastiques':   'bg-purple-100 text-purple-700 border-purple-200',
  'Musique':           'bg-pink-100 text-pink-700 border-pink-200',
  'Langage':           'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Graphisme':         'bg-violet-100 text-violet-700 border-violet-200',
  'Informatique':      'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Morale':            'bg-lime-100 text-lime-700 border-lime-200',
  'Éveil':             'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Motricité':         'bg-green-100 text-green-700 border-green-200',
  'Motricité fine':    'bg-green-100 text-green-700 border-green-200',
};
function getMatiereColor(m: string) {
  return MATIERE_COLORS[m] || 'bg-slate-100 text-slate-600 border-slate-200';
}

// ─── Sélecteur de classe ──────────────────────────────────────────────────────

const GROUPE_NIVEAUX = [
  {
    label: 'Crèche',
    niveaux: ['CRECHE'],
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    active: 'bg-rose-500 text-white border-rose-500 shadow-rose-100',
    dot: 'bg-rose-400',
  },
  {
    label: 'Maternelle',
    niveaux: ['PS', 'MS', 'GS'],
    pill: 'bg-violet-100 text-violet-700 border-violet-200',
    active: 'bg-violet-500 text-white border-violet-500 shadow-violet-100',
    dot: 'bg-violet-400',
  },
  {
    label: 'Élémentaire',
    niveaux: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
    pill: 'bg-sky-100 text-sky-700 border-sky-200',
    active: 'bg-sky-500 text-white border-sky-500 shadow-sky-100',
    dot: 'bg-sky-400',
  },
];

interface ClasseInfo2 { id: string; nom: string; niveau: string; }

const ClassePickerPanel: React.FC<{
  classes: ClasseInfo2[];
  selected: string;
  onSelect: (id: string) => void;
}> = ({ classes, selected, onSelect }) => {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? classes.filter(c =>
        c.nom.toLowerCase().includes(query.toLowerCase()) ||
        c.niveau.toLowerCase().includes(query.toLowerCase())
      )
    : classes;

  // Grouper par catégorie de niveau
  const grouped = GROUPE_NIVEAUX.map(g => ({
    ...g,
    items: filtered.filter(c => g.niveaux.includes(c.niveau)),
  })).filter(g => g.items.length > 0);

  // Classes dont le niveau n'appartient à aucun groupe (sécurité)
  const knownNiveaux = GROUPE_NIVEAUX.flatMap(g => g.niveaux);
  const orphans = filtered.filter(c => !knownNiveaux.includes(c.niveau));

  const selectedClasse = classes.find(c => c.id === selected);
  const groupe = selectedClasse
    ? GROUPE_NIVEAUX.find(g => g.niveaux.includes(selectedClasse.niveau))
    : null;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
            <School size={14} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe sélectionnée</p>
            {selectedClasse ? (
              <div className="flex items-center gap-2">
                {groupe && <span className={`w-2 h-2 rounded-full ${groupe.dot}`} />}
                <p className="text-sm font-black text-slate-900">{selectedClasse.nom}</p>
                <span className="text-[9px] font-black text-slate-400 uppercase">{selectedClasse.niveau}</span>
              </div>
            ) : (
              <p className="text-sm font-black text-slate-300">Aucune sélection</p>
            )}
          </div>
        </div>
        <span className="text-[9px] font-bold text-slate-300 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
          {classes.length} classe{classes.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtre — visible dès 5 classes */}
      {classes.length >= 5 && (
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filtrer les classes…"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-700 placeholder-slate-300 outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50 transition-all"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-all">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Groupes */}
      <div className="px-6 pb-5 pt-3 space-y-4">
        {filtered.length === 0 && (
          <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest py-4">
            Aucune classe trouvée
          </p>
        )}

        {grouped.map(g => (
          <div key={g.label}>
            {/* Label groupe */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${g.dot}`} />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{g.label}</span>
              <span className="text-[8px] font-bold text-slate-300">· {g.items.length}</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {g.items.map(c => {
                const isActive = c.id === selected;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[10px] font-black border transition-all shadow-sm
                      ${isActive
                        ? g.active + ' shadow-lg'
                        : g.pill + ' hover:shadow-md hover:scale-[1.02]'
                      }`}
                  >
                    {isActive && <Check size={10} strokeWidth={3} />}
                    <span>{c.nom}</span>
                    <span className={`text-[8px] font-bold opacity-70`}>{c.niveau}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Classes orphelines (niveau inconnu) */}
        {orphans.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Autres</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="flex flex-wrap gap-2">
              {orphans.map(c => (
                <button key={c.id} onClick={() => onSelect(c.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[10px] font-black border transition-all
                    ${c.id === selected
                      ? 'bg-slate-700 text-white border-slate-700 shadow-lg'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}>
                  {c.id === selected && <Check size={10} strokeWidth={3} />}
                  {c.nom}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

const EmploiDuTemps: React.FC<{ user: User }> = ({ user }) => {
  const toast = useToast();
  const { annee: ANNEE, anneeActiveToday, isReadOnly, isAnneeCloturee } = useAnnee();
  const canEdit = authBridge.canPerform(user, 'EDIT', 'emploi-temps') && !isReadOnly;
  const userRoles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
  const isDirecteur = userRoles.some(r => r === UserRole.ADMIN || r === UserRole.DIRECTEUR);
  const isTeacher = !isDirecteur && userRoles.some(r => r === UserRole.ENSEIGNANT || r === UserRole.MAITRESSE);
  // Les enseignants sont toujours verrouillés sur l'année courante
  const anneeEffective = isTeacher ? anneeActiveToday : ANNEE;

  const [tab, setTab] = useState<Tab>(isTeacher ? 'mon-planning' : 'grille');

  // Données
  const [classes, setClasses]   = useState<ClasseInfo[]>([]);
  const [employees, setEmployees] = useState<EmpInfo[]>([]);
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [myCreneaux, setMyCreneaux] = useState<Creneau[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingCreneaux, setLoadingCreneaux] = useState(false);

  // Planning récurrent
  const [planningConfig, setPlanningConfig] = useState<PlanningConfig | null>(null);
  const [exceptions, setExceptions] = useState<PlanningException[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [loadingExceptions, setLoadingExceptions] = useState(false);

  // Modal config période scolaire
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<{ dateDebut: string; dateFin: string; joursRepos: JourRepos[]; newJourRepos: string; newTypeRepos: 'CONGE' | 'FERIE' }>({ dateDebut: '', dateFin: '', joursRepos: [], newJourRepos: '', newTypeRepos: 'CONGE' });
  const [savingConfig, setSavingConfig] = useState(false);

  // Modal confirmation suppression créneau
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Duplication semaine
  const [copyingWeek, setCopyingWeek] = useState(false);

  // Modal exception
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionTarget, setExceptionTarget] = useState<{ creneau: Creneau; date: string; existing?: PlanningException } | null>(null);
  const [exceptionForm, setExceptionForm] = useState<{ typeException: 'ANNULE' | 'MODIFIE'; matiereOverride: string; heureDebutOverride: string; heureFinOverride: string; note: string }>({
    typeException: 'ANNULE', matiereOverride: '', heureDebutOverride: '', heureFinOverride: '', note: '',
  });
  const [savingException, setSavingException] = useState(false);

  // Sélection classe (grille/calendrier)
  const [selectedClasseId, setSelectedClasseId] = useState('');

  // Filtre classe — Mon Planning
  const [myFilterClasseId, setMyFilterClasseId] = useState('');

  // Cahier
  const [cahier, setCahier]   = useState<CahierEntry[]>(loadCahier);
  const [cahierClasseId, setCahierClasseId] = useState('');
  const [cahierDate, setCahierDate] = useState(isoToday());

  // Modal creneau
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Creneau | null>(null);
  const [form, setForm] = useState<Omit<Creneau, 'id' | 'anneeScolaire' | 'enseignant' | 'classe'>>({
    classeId: '', enseignantId: '', jour: 0,
    heureDebut: '08:00', heureFin: '09:00', matiere: '', couleur: 'blue',
  });

  // Modal cahier
  const [showCahierModal, setShowCahierModal] = useState(false);
  const [editingCahier, setEditingCahier] = useState<CahierEntry | null>(null);
  const [cahierForm, setCahierForm] = useState<Omit<CahierEntry, 'id'>>({
    date: isoToday(), classeId: '', matiere: '', objectif: '', contenu: '', devoirs: '',
    observations: '', auteur: user.name || '',
  });
  const [confirmDeleteCahier, setConfirmDeleteCahier] = useState<string | null>(null);

  // WhatsApp
  const [showWA, setShowWA] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waTxt, setWaTxt]   = useState('');
  const [copied, setCopied] = useState(false);

  // Indicateur heure courante
  const [currentY, setCurrentY] = useState(nowY());
  useEffect(() => {
    const t = setInterval(() => setCurrentY(nowY()), 60000);
    return () => clearInterval(t);
  }, []);

  // Navigation semaine — tab "Mon Planning" (prof)
  const [myWeekOffset, setMyWeekOffset] = useState(0);
  const myWeekDates = useMemo(() => {
    const lundi = getMondayOfWeek(new Date());
    lundi.setDate(lundi.getDate() + myWeekOffset * 7);
    return Array.from({ length: 5 }, (_, i) => addDays(lundi, i));
  }, [myWeekOffset]);

  const todayIdx = todayJour();
  const empMap = useMemo(() => {
    const m = new Map<string, EmpInfo>();
    employees.forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cls, emps, cfg] = await Promise.all([
          apiClient.get('/classes', { params: { anneeScolaire: anneeEffective } }).catch(() => []),
          // Les enseignants n'ont pas accès à la liste globale des employés — échec silencieux
          apiClient.get('/hr/employees').catch(() => []),
          apiClient.get('/planning/config', { params: { anneeScolaire: anneeEffective } }).catch(() => null),
        ]);
        const clsArr = Array.isArray(cls) ? cls : (cls?.rows ?? []);
        const empArr = Array.isArray(emps) ? emps : (emps?.rows ?? []);
        setClasses(clsArr);
        setEmployees(empArr);
        if (cfg) setPlanningConfig(cfg);
        if (clsArr.length > 0) setSelectedClasseId(clsArr[0].id);
        if (clsArr.length > 0) setCahierClasseId(clsArr[0].id);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [anneeEffective]);

  // ── Charger exceptions pour la semaine affichée ─────────────────────────────
  useEffect(() => {
    if ((tab !== 'calendrier' && tab !== 'grille') || !selectedClasseId) return;
    const dateDebut = toISO(weekStart);
    const dateFin   = toISO(addDays(weekStart, 4));
    setLoadingExceptions(true);
    apiClient.get('/planning/exceptions', { params: { classeId: selectedClasseId, dateDebut, dateFin } })
      .then(data => setExceptions(Array.isArray(data) ? data : []))
      .catch(() => setExceptions([]))
      .finally(() => setLoadingExceptions(false));
  }, [tab, weekStart, selectedClasseId]);

  // ── Charger creneaux par semaine (date-spécifiques + récurrents) ────────────
  useEffect(() => {
    if (!selectedClasseId) return;
    const load = async () => {
      setLoadingCreneaux(true);
      try {
        const data = await apiClient.get('/schedule', {
          params: {
            classeId: selectedClasseId,
            anneeScolaire: anneeEffective,
            dateDebut: toISO(weekStart),
            dateFin: toISO(addDays(weekStart, 4)),
          }
        }).catch(() => []);
        setCreneaux(Array.isArray(data) ? data : []);
      } finally {
        setLoadingCreneaux(false);
      }
    };
    load();
  }, [selectedClasseId, anneeEffective, weekStart]);

  // ── Charger mon planning (prof) ────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'mon-planning') return;
    apiClient.get('/schedule/my', { params: { anneeScolaire: anneeEffective } })
      .then(d => setMyCreneaux(Array.isArray(d) ? d : []))
      .catch(() => setMyCreneaux([]));
  }, [tab, anneeEffective]);

  // ── Creneaux par jour (le backend filtre déjà par semaine) ────────────────
  const creneauxParJour = useMemo(() => {
    const map: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    creneaux.forEach(c => {
      map[c.jour] = [...(map[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    });
    return map;
  }, [creneaux]);

  const myCreneauxParJour = useMemo(() => {
    const map: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    myCreneaux.forEach(c => {
      map[c.jour] = [...(map[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    });
    return map;
  }, [myCreneaux]);

  // Classes uniques que le prof enseigne (pour le filtre "Mon Planning")
  const myClasses = useMemo<ClasseInfo2[]>(() => {
    const seen = new Set<string>();
    const result: ClasseInfo2[] = [];
    myCreneaux.forEach(c => {
      if (c.classe && !seen.has(c.classeId)) {
        seen.add(c.classeId);
        result.push({ id: c.classeId, nom: c.classe.nom, niveau: c.classe.niveau });
      }
    });
    return result;
  }, [myCreneaux]);

  // Planning filtré par classe sélectionnée (Mon Planning)
  const myCreneauxParJourFiltered = useMemo(() => {
    const map: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    myCreneaux
      .filter(c => !myFilterClasseId || c.classeId === myFilterClasseId)
      .forEach(c => {
        map[c.jour] = [...(map[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
      });
    return map;
  }, [myCreneaux, myFilterClasseId]);

  // ── Stats prof ─────────────────────────────────────────────────────────────
  const myStats = useMemo(() => {
    const total = myCreneaux.length;
    const today = myCreneauxParJour[todayIdx] || [];
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const prochain = today.find(c => {
      const [h, m] = c.heureDebut.split(':').map(Number);
      return h * 60 + m > nowMins;
    });
    const enCours = today.find(c => {
      const [sh, sm] = c.heureDebut.split(':').map(Number);
      const [eh, em] = c.heureFin.split(':').map(Number);
      return sh * 60 + sm <= nowMins && nowMins < eh * 60 + em;
    });
    return { total, today: today.length, prochain, enCours };
  }, [myCreneaux, myCreneauxParJour, todayIdx]);

  // ── CRUD creneaux ──────────────────────────────────────────────────────────
  const openModal = (c?: Creneau) => {
    const sel = classes.find(cl => cl.id === selectedClasseId);
    if (c) {
      setEditing(c);
      setForm({ classeId: c.classeId, enseignantId: c.enseignantId || '', jour: c.jour, heureDebut: c.heureDebut, heureFin: c.heureFin, matiere: c.matiere, couleur: c.couleur });
    } else {
      setEditing(null);
      const mats = sel ? (MATIERES[sel.niveau] || []) : [];
      setForm({ classeId: selectedClasseId, enseignantId: '', jour: 0, heureDebut: '08:00', heureFin: '09:00', matiere: mats[0] || '', couleur: 'blue' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.matiere || !form.heureDebut || !form.heureFin) { toast('Matière, heure début et heure fin sont requis.', 'error'); return; }
    if (form.heureFin <= form.heureDebut) { toast("L'heure de fin doit être postérieure à l'heure de début.", 'error'); return; }
    try {
      const payload = { ...form, anneeScolaire: anneeEffective, enseignantId: form.enseignantId || null };
      if (editing) {
        await apiClient.put(`/schedule/${editing.id}`, payload);
        setCreneaux(cr => cr.map(c => c.id === editing.id ? { ...c, ...payload } : c));
        toast('Créneau mis à jour.', 'success');
      } else {
        // Nouvelle création : créneau lié à la date exacte du jour sélectionné
        const created = await apiClient.post('/schedule', {
          ...payload,
          dateSpecifique: toISO(weekDates[form.jour]),
        });
        setCreneaux(cr => [...cr, created]);
        toast('Créneau ajouté.', 'success');
      }
      setShowModal(false);
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await apiClient.delete(`/schedule/${confirmDeleteId}`);
      setCreneaux(cr => cr.filter(c => c.id !== confirmDeleteId));
      toast('Créneau supprimé.', 'info');
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
    finally { setConfirmDeleteId(null); }
  };

  // ── Cahier ─────────────────────────────────────────────────────────────────
  const openCahier = (entry?: CahierEntry) => {
    const cl = classes.find(c => c.id === cahierClasseId);
    if (entry) {
      setEditingCahier(entry);
      setCahierForm({
        date: entry.date, classeId: entry.classeId, matiere: entry.matiere,
        objectif: entry.objectif || '', contenu: entry.contenu, devoirs: entry.devoirs,
        observations: entry.observations || '', auteur: entry.auteur,
      });
    } else {
      setEditingCahier(null);
      setCahierForm({
        date: isoToday(), classeId: cahierClasseId,
        matiere: (cl ? (MATIERES[cl.niveau] || []) : [])[0] || '',
        objectif: '', contenu: '', devoirs: '', observations: '', auteur: user.name || '',
      });
    }
    setShowCahierModal(true);
  };

  const saveCahierEntry = () => {
    if (!cahierForm.matiere) { toast('Sélectionnez une matière.', 'error'); return; }
    if (!cahierForm.contenu.trim()) { toast('Le contenu du cours est requis.', 'error'); return; }
    const entry: CahierEntry = { ...cahierForm, id: editingCahier?.id || genId() };
    const updated = editingCahier
      ? cahier.map(e => e.id === editingCahier.id ? entry : e)
      : [...cahier, entry];
    setCahier(updated);
    saveCahier(updated);
    setShowCahierModal(false);
    toast(editingCahier ? 'Entrée mise à jour.' : 'Entrée ajoutée au cahier.', 'success');
  };

  const deleteCahierEntry = (id: string) => {
    const updated = cahier.filter(e => e.id !== id);
    setCahier(updated);
    saveCahier(updated);
    setConfirmDeleteCahier(null);
    toast('Entrée supprimée.', 'info');
  };

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const openWA = () => {
    const cl = classes.find(c => c.id === selectedClasseId);
    const byDay: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    creneaux.forEach(c => { byDay[c.jour] = [...(byDay[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)); });
    const body = JOURS.map((j, i) => {
      const list = byDay[i] || [];
      if (!list.length) return null;
      const lines = list.map(c => `  • ${c.heureDebut}–${c.heureFin} : ${c.matiere}${c.enseignant ? ` (${empNom(c.enseignant)})` : ''}`).join('\n');
      return `*${j}*\n${lines}`;
    }).filter(Boolean).join('\n\n');
    setWaTxt(`🏫 *LE TOIT DES ANGES*\n📚 Emploi du Temps — ${cl?.nom || ''}\n\n${body || '— Aucun créneau —'}\n\n_Année ${anneeEffective}_`);
    setWaPhone(''); setCopied(false); setShowWA(true);
  };

  const handlePrint = () => {
    const cl = classes.find(c => c.id === selectedClasseId);
    const byDay: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    creneaux.forEach(c => { byDay[c.jour] = [...(byDay[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)); });
    const cols = JOURS.map(j => `<th>${j}</th>`).join('');
    const cells = [0,1,2,3,4].map(i => {
      const list = byDay[i] || [];
      if (!list.length) return '<td style="color:#ccc;text-align:center">—</td>';
      return `<td>${list.map(c => `<div class="cr"><strong>${c.matiere}</strong><span>${c.heureDebut}–${c.heureFin}${c.enseignant ? ' · ' + empNom(c.enseignant) : ''}</span></div>`).join('')}</td>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EDT ${cl?.nom}</title><style>body{font-family:Arial,sans-serif;font-size:10pt;margin:15mm}h1{font-size:14pt;text-align:center}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#e2e8f0;padding:8px;text-align:center;border:1px solid #cbd5e1}td{padding:5px 6px;border:1px solid #e2e8f0;vertical-align:top}.cr{margin-bottom:5px;padding:3px 5px;background:#f0fdf4;border-left:3px solid #16a34a}.cr strong{display:block;font-size:9pt}.cr span{color:#64748b;font-size:8pt}</style></head><body><h1>🏫 Le Toit des Anges</h1><p style="text-align:center">Emploi du Temps — ${cl?.nom} — ${anneeEffective}</p><table><tr>${cols}</tr><tr>${cells}</tr></table></body></html>`;
    const w = window.open('', '_blank', 'noopener');
    if (!w) { toast('Autorisez les popups.', 'error'); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // ── Jours de la semaine affichée ───────────────────────────────────────────
  const weekDates = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
  [weekStart]);

  // ── Config période scolaire ────────────────────────────────────────────────
  const openConfigModal = () => {
    setConfigForm({
      dateDebut: planningConfig?.dateDebut || '',
      dateFin:   planningConfig?.dateFin   || '',
      joursRepos: normalizeJoursRepos(planningConfig?.joursRepos),
      newJourRepos: '',
      newTypeRepos: 'CONGE',
    });
    setShowConfigModal(true);
  };

  const saveConfig = async () => {
    if (!configForm.dateDebut || !configForm.dateFin) { toast('Date début et date fin sont requises.', 'error'); return; }
    setSavingConfig(true);
    try {
      const cfg = await apiClient.post('/planning/config', {
        anneeScolaire: anneeEffective,
        dateDebut: configForm.dateDebut,
        dateFin:   configForm.dateFin,
        joursRepos: configForm.joursRepos,
      });
      setPlanningConfig(cfg);
      setShowConfigModal(false);
      toast('Période scolaire enregistrée.', 'success');
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
    finally { setSavingConfig(false); }
  };

  // ── Exceptions ─────────────────────────────────────────────────────────────
  const openExceptionModal = (creneau: Creneau, date: string, existing?: PlanningException) => {
    if (!existing && findRepos(planningConfig?.joursRepos, date)?.type === 'FERIE') {
      toast('Impossible de planifier un cours un jour férié.', 'error');
      return;
    }
    setExceptionTarget({ creneau, date, existing });
    setExceptionForm({
      typeException:      existing?.typeException      || 'ANNULE',
      matiereOverride:    existing?.matiereOverride    || '',
      heureDebutOverride: existing?.heureDebutOverride || creneau.heureDebut,
      heureFinOverride:   existing?.heureFinOverride   || creneau.heureFin,
      note:               existing?.note               || '',
    });
    setShowExceptionModal(true);
  };

  const saveException = async () => {
    if (!exceptionTarget) return;
    if (exceptionForm.typeException === 'MODIFIE' && exceptionForm.heureDebutOverride && exceptionForm.heureFinOverride &&
        exceptionForm.heureFinOverride <= exceptionForm.heureDebutOverride) {
      toast("L'heure de fin doit être postérieure à l'heure de début.", 'error');
      return;
    }
    setSavingException(true);
    try {
      const payload = {
        creneauId:          exceptionTarget.creneau.id,
        dateException:      exceptionTarget.date,
        typeException:      exceptionForm.typeException,
        matiereOverride:    exceptionForm.typeException === 'MODIFIE' ? exceptionForm.matiereOverride || null : null,
        heureDebutOverride: exceptionForm.typeException === 'MODIFIE' ? exceptionForm.heureDebutOverride || null : null,
        heureFinOverride:   exceptionForm.typeException === 'MODIFIE' ? exceptionForm.heureFinOverride || null : null,
        note:               exceptionForm.note || null,
      };
      const created = await apiClient.post('/planning/exceptions', payload);
      setExceptions(prev => {
        const filtered = prev.filter(e => !(e.creneauId === exceptionTarget.creneau.id && e.dateException === exceptionTarget.date));
        return [...filtered, created];
      });
      setShowExceptionModal(false);
      toast('Exception enregistrée.', 'success');
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
    finally { setSavingException(false); }
  };

  const copyWeekToNext = async () => {
    if (!selectedClasseId) return;
    if (exceptions.length === 0) {
      toast('Le planning de la semaine suivante est déjà identique (aucune modification à dupliquer).', 'info');
      return;
    }
    setCopyingWeek(true);
    let copied = 0;
    let skipped = 0;
    try {
      for (const ex of exceptions) {
        const nextDate = toISO(addDays(new Date(ex.dateException + 'T00:00:00'), 7));
        if (findRepos(planningConfig?.joursRepos, nextDate)?.type === 'FERIE') { skipped++; continue; }
        try {
          await apiClient.post('/planning/exceptions', {
            creneauId:          ex.creneauId,
            dateException:      nextDate,
            typeException:      ex.typeException,
            matiereOverride:    ex.matiereOverride    || null,
            heureDebutOverride: ex.heureDebutOverride || null,
            heureFinOverride:   ex.heureFinOverride   || null,
            note:               ex.note               || null,
          });
          copied++;
        } catch { skipped++; }
      }
      toast(
        copied > 0
          ? `${copied} modification${copied > 1 ? 's' : ''} dupliquée${copied > 1 ? 's' : ''} vers la semaine suivante.${skipped > 0 ? ` (${skipped} ignorée${skipped > 1 ? 's' : ''} — jour férié)` : ''}`
          : 'Aucune modification dupliquée (tous les jours cibles sont fériés).',
        copied > 0 ? 'success' : 'info',
      );
      if (copied > 0) setWeekStart(w => addDays(w, 7));
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
    finally { setCopyingWeek(false); }
  };

  const deleteException = async (id: string) => {
    try {
      await apiClient.delete(`/planning/exceptions/${id}`);
      setExceptions(prev => prev.filter(e => e.id !== id));
      setShowExceptionModal(false);
      toast('Exception supprimée.', 'info');
    } catch (err: any) { toast(err.message || 'Erreur', 'error'); }
  };

  // ── Classe sélectionnée ────────────────────────────────────────────────────
  const selectedClasse = classes.find(c => c.id === selectedClasseId);
  const matieres = selectedClasse ? (MATIERES[selectedClasse.niveau] || []) : [];

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center gap-4 text-slate-400">
        <RefreshCw size={32} className="animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-20 space-y-6">

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-4">
            <CalendarDays className="text-indigo-600" size={32} />
            Emploi du Temps
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Planification des cours · {anneeEffective}</p>
            {isDirecteur && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                <GraduationCap size={10} /> Gestion complète
              </span>
            )}
            {isTeacher && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                Mode consultation
              </span>
            )}
            {isAnneeCloturee && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[9px] font-black uppercase tracking-widest">
                <Archive size={10}/> Année clôturée — lecture seule
              </span>
            )}
            {!isAnneeCloturee && isReadOnly && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-black uppercase tracking-widest">
                <Lock size={10}/> Année passée — lecture seule
              </span>
            )}
          </div>
        </div>

        {/* Stats rapides prof */}
        {isTeacher && tab === 'mon-planning' && (
          <div className="flex items-center gap-3 flex-wrap">
            {myStats.enCours && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl">
                <Zap size={14} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">En cours : {myStats.enCours.matiere}</span>
              </div>
            )}
            {myStats.prochain && !myStats.enCours && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl">
                <Clock size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Prochain : {myStats.prochain.heureDebut} · {myStats.prochain.matiere}</span>
              </div>
            )}
            <div className="px-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {myStats.total} cours / semaine
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-2xl shadow-sm w-fit flex-wrap">
        {([
          ['grille',       'Grille type',    School],
          ['calendrier',   'Calendrier',     Calendar],
          ['mon-planning', 'Mon Planning',   CalendarDays],
          ['cahier',       'Cahier de Texte',BookOpen],
        ] as [Tab, string, any][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB — GRILLE PAR CLASSE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'grille' && (
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* Bannière période scolaire */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Calendar size={14} className="text-indigo-600" />
              </div>
              {planningConfig ? (
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Période scolaire</p>
                  <p className="text-[9px] font-bold text-indigo-600">
                    {formatDateFr(planningConfig.dateDebut)} → {formatDateFr(planningConfig.dateFin)}
                    {planningConfig.joursRepos.length > 0 && (() => {
                      const norm = normalizeJoursRepos(planningConfig.joursRepos);
                      const nC = norm.filter(j => j.type === 'CONGE').length;
                      const nF = norm.filter(j => j.type === 'FERIE').length;
                      return (
                        <span className="ml-2 flex items-center gap-2 flex-wrap">
                          {nC > 0 && <span className="flex items-center gap-1 text-amber-500"><Umbrella size={10} /> {nC} congé{nC > 1 ? 's' : ''}</span>}
                          {nF > 0 && <span className="flex items-center gap-1 text-rose-500"><Star size={10} /> {nF} férié{nF > 1 ? 's' : ''}</span>}
                        </span>
                      );
                    })()}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle size={14} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Période scolaire non configurée</p>
                </div>
              )}
            </div>
            {canEdit && (
              <button onClick={openConfigModal} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                <Settings size={12} /> Configurer
              </button>
            )}
          </div>

          {/* Sélecteur classe */}
          <ClassePickerPanel
            classes={classes}
            selected={selectedClasseId}
            onSelect={setSelectedClasseId}
          />

          {/* Contrôles : navigation semaine + actions */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            {/* Navigation semaine + Actions */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Navigation semaine / mois */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50">
                <button onClick={() => setWeekStart(w => getMondayOfWeek(addMonths(w, -1)))}
                  className="p-1.5 text-slate-400 rounded-lg hover:bg-white hover:shadow-sm transition-all" title="Mois précédent">
                  <ChevronsLeft size={14} />
                </button>
                <button onClick={() => setWeekStart(w => addDays(w, -7))}
                  className="p-1.5 text-slate-500 rounded-lg hover:bg-white hover:shadow-sm transition-all" title="Semaine précédente">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
                  className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-lg hover:bg-white hover:shadow-sm transition-all">
                  Auj.
                </button>
                <button onClick={() => setWeekStart(w => addDays(w, 7))}
                  className="p-1.5 text-slate-500 rounded-lg hover:bg-white hover:shadow-sm transition-all" title="Semaine suivante">
                  <ChevronRight size={14} />
                </button>
                <button onClick={() => setWeekStart(w => getMondayOfWeek(addMonths(w, 1)))}
                  className="p-1.5 text-slate-400 rounded-lg hover:bg-white hover:shadow-sm transition-all" title="Mois suivant">
                  <ChevronsRight size={14} />
                </button>
              </div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                {formatShortFr(weekStart)} – {formatShortFr(addDays(weekStart, 4))} {weekStart.getFullYear()}
              </span>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              {canEdit && (
                <button onClick={() => openModal()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                  <Plus size={12} /> Ajouter créneau
                </button>
              )}
              <button onClick={openWA} className="p-2.5 bg-green-50 text-green-600 border border-green-200 rounded-xl hover:bg-green-100 transition-all" title="Envoyer WhatsApp">
                <MessageCircle size={16} />
              </button>
              <button onClick={handlePrint} className="p-2.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all" title="Imprimer">
                <Printer size={16} />
              </button>
            </div>
          </div>

          {/* Grille visuelle */}
          {selectedClasse && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                  {selectedClasse.nom.split(' ').pop() || 'A'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedClasse.nom}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{NIVEAUX_LABELS[selectedClasse.niveau] || selectedClasse.niveau} · {creneaux.length} créneaux</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {loadingCreneaux && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-xl text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                    <RefreshCw size={9} /> Récurrent · même grille chaque semaine
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '75vh' }}>
                <div className="flex min-w-[700px]">

                  {/* Colonne heures */}
                  <div className="w-16 shrink-0 relative" style={{ height: GRID_H + SLOT_H }}>
                    <div className="h-[4.5rem] border-b border-slate-100" /> {/* en-tête vide */}
                    <div className="relative" style={{ height: GRID_H }}>
                      {TIME_RULER.map((t, i) => (
                        <div
                          key={t}
                          className="absolute right-2 flex items-center"
                          style={{ top: i * SLOT_H - 8, height: SLOT_H }}
                        >
                          <span className={`text-[9px] font-black ${t.endsWith(':00') ? 'text-slate-500' : 'text-slate-300'} tracking-wide`}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Colonnes jours */}
                  {JOURS.map((jour, idx) => {
                    const isToday = idx === todayIdx;
                    const colDateStr = toISO(weekDates[idx]);
                    const reposInfo = findRepos(planningConfig?.joursRepos, colDateStr);
                    const isConge = reposInfo?.type === 'CONGE';
                    const isFerie = reposInfo?.type === 'FERIE';
                    const isReposDay = !!reposInfo;

                    return (
                      <div key={jour} className="flex-1 min-w-[120px] border-l border-slate-100">
                        {/* En-tête jour */}
                        <div className={`h-[4.5rem] flex flex-col items-center justify-center gap-0.5 border-b border-slate-100 ${
                          isToday ? 'bg-indigo-600' : isFerie ? 'bg-rose-100' : isConge ? 'bg-amber-50' : 'bg-slate-50'
                        }`}>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            isToday ? 'text-white' : isFerie ? 'text-rose-600' : isConge ? 'text-amber-600' : 'text-slate-500'
                          }`}>{jour}</span>
                          <span className={`text-[9px] font-bold ${isToday ? 'text-white/80' : 'text-slate-400'}`}>
                            {formatShortFr(weekDates[idx])}
                          </span>
                          {isConge && !isToday && (
                            <span className="flex items-center gap-0.5 text-[7px] font-black text-amber-500 uppercase tracking-widest mt-0.5">
                              <Umbrella size={7} /> Congé
                            </span>
                          )}
                          {isFerie && !isToday && (
                            <span className="flex items-center gap-0.5 text-[7px] font-black text-rose-500 uppercase tracking-widest mt-0.5">
                              <Star size={7} /> Jour férié
                            </span>
                          )}
                        </div>

                        {/* Corps du jour */}
                        <div className="relative" style={{ height: GRID_H }}>
                          {/* Lignes horizontales */}
                          {TIME_RULER.map((t, i) => (
                            <div
                              key={t}
                              className={`absolute left-0 right-0 border-t ${t.endsWith(':00') ? 'border-slate-200' : 'border-slate-100'}`}
                              style={{ top: i * SLOT_H }}
                            />
                          ))}

                          {/* Fond repos/férié */}
                          {isReposDay && !isToday && (
                            <div className={`absolute inset-0 pointer-events-none z-10 flex items-center justify-center
                              ${isFerie ? 'bg-rose-50/70' : 'bg-amber-50/70'}`}
                              style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 12px, ${isFerie ? 'rgba(255,228,230,0.5)' : 'rgba(254,243,199,0.5)'} 12px, ${isFerie ? 'rgba(255,228,230,0.5)' : 'rgba(254,243,199,0.5)'} 24px)` }}>
                              <div className={`flex flex-col items-center gap-1 opacity-40 select-none`}
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                {isFerie
                                  ? <><Star size={12} className="text-rose-400" /><span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Jour Férié</span></>
                                  : <><Umbrella size={12} className="text-amber-400" /><span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Congé</span></>
                                }
                              </div>
                            </div>
                          )}

                          {/* Fond aujourd'hui */}
                          {isToday && <div className="absolute inset-0 bg-indigo-50/30 pointer-events-none" />}

                          {/* Indicateur heure courante */}
                          {isToday && currentY >= 0 && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentY }}>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0" />
                                <div className="flex-1 h-px bg-rose-500" />
                              </div>
                            </div>
                          )}

                          {/* Créneaux */}
                          {(creneauxParJour[idx] || []).map(c => {
                            const ex = exceptions.find(e => e.creneauId === c.id && e.dateException === colDateStr);
                            const isCancelled = ex?.typeException === 'ANNULE';
                            const isModified  = ex?.typeException === 'MODIFIE';
                            const displayMatiere = isModified && ex?.matiereOverride    ? ex.matiereOverride    : c.matiere;
                            const displayDebut   = isModified && ex?.heureDebutOverride ? ex.heureDebutOverride : c.heureDebut;
                            const displayFin     = isModified && ex?.heureFinOverride   ? ex.heureFinOverride   : c.heureFin;
                            const blockDebut = isCancelled ? c.heureDebut : displayDebut;
                            const blockFin   = isCancelled ? c.heureFin   : displayFin;
                            const col = COULEURS[c.couleur] || COULEURS.blue;
                            return (
                              <div
                                key={c.id}
                                className={`absolute left-1 right-1 rounded-xl shadow-sm overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]
                                  ${isCancelled ? 'opacity-40 bg-slate-100 border border-slate-200' : col.block}
                                  ${isModified ? 'ring-2 ring-orange-400' : ''}`}
                                style={{ top: tY(blockDebut) + 2, height: tH(blockDebut, blockFin) - 4 }}
                                onClick={() => canEdit && openModal(c)}
                              >
                                {isCancelled && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Ban size={12} className="text-slate-400" />
                                  </div>
                                )}
                                {isModified && (
                                  <div className="absolute top-1 left-1 pointer-events-none">
                                    <Edit3 size={8} className="text-orange-500" />
                                  </div>
                                )}
                                <div className="p-2 h-full flex flex-col justify-between">
                                  <div>
                                    <p className={`text-[10px] font-black leading-tight truncate ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{displayMatiere}</p>
                                    {c.enseignant && !isCancelled && (
                                      <p className="text-[9px] font-bold text-slate-500 truncate mt-0.5">{empNom(c.enseignant)}</p>
                                    )}
                                  </div>
                                  <p className="text-[8px] font-bold text-slate-400">{displayDebut}–{displayFin}</p>
                                </div>
                                {canEdit && !isCancelled && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                                    className="absolute top-1 right-1 p-0.5 bg-white/80 rounded-lg text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {classes.length === 0 && (
            <div className="py-20 flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
              <School size={32} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Aucune classe créée. Commencez par créer des classes.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB — CALENDRIER (planning récurrent)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'calendrier' && (
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* Sélecteur classe */}
          <ClassePickerPanel
            classes={classes}
            selected={selectedClasseId}
            onSelect={setSelectedClasseId}
          />

          {/* Navigation semaine */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(w => getMondayOfWeek(addMonths(w, -1)))}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-100 transition-all" title="Mois précédent">
                <ChevronsLeft size={16} />
              </button>
              <button onClick={() => setWeekStart(w => addDays(w, -7))}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 transition-all" title="Semaine précédente">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                Aujourd'hui
              </button>
              <button onClick={() => setWeekStart(w => addDays(w, 7))}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 transition-all" title="Semaine suivante">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setWeekStart(w => getMondayOfWeek(addMonths(w, 1)))}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-100 transition-all" title="Mois suivant">
                <ChevronsRight size={16} />
              </button>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">
                {formatShortFr(weekStart)} – {formatShortFr(addDays(weekStart, 4))} {weekStart.getFullYear()}
              </span>
              {loadingExceptions && <RefreshCw size={14} className="animate-spin text-indigo-400 ml-1" />}

              {canEdit && (
                <button
                  onClick={copyWeekToNext}
                  disabled={copyingWeek}
                  title="Dupliquer les modifications de cette semaine vers la semaine suivante"
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1"
                >
                  {copyingWeek ? <RefreshCw size={12} className="animate-spin" /> : <Copy size={12} />}
                  Dupliquer →
                </button>
              )}
            </div>
          </div>

          {/* Avertissement si pas de config */}
          {!planningConfig && (
            <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-5 flex items-center gap-4">
              <AlertCircle size={20} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-black text-amber-800">Période scolaire non configurée</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Allez dans l'onglet <strong>Grille type</strong> → <strong>Configurer</strong> pour définir les dates de l'année scolaire.
                </p>
              </div>
            </div>
          )}

          {/* Grille semaine */}
          {selectedClasse && (
            <div className="grid grid-cols-5 gap-3">
              {weekDates.map((date, idx) => {
                const dateStr = toISO(date);
                const isToday = dateStr === isoToday();
                const isInPeriod = planningConfig
                  ? dateStr >= planningConfig.dateDebut && dateStr <= planningConfig.dateFin
                  : false;
                const reposInfo = findRepos(planningConfig?.joursRepos, dateStr);
                const isRepos = !!reposInfo;
                const isConge = reposInfo?.type === 'CONGE';
                const isFerie = reposInfo?.type === 'FERIE';
                const dayCreneaux = creneauxParJour[idx] || [];
                const dayExceptions = exceptions.filter(e => e.dateException === dateStr);

                return (
                  <div key={dateStr}
                    className={`rounded-[2rem] border overflow-hidden flex flex-col transition-all ${
                      isToday    ? 'border-indigo-300 shadow-lg shadow-indigo-50'
                      : isFerie  ? 'border-rose-200 shadow-sm shadow-rose-50'
                      : isConge  ? 'border-amber-200 shadow-sm shadow-amber-50'
                      : 'border-slate-100'
                    } ${!isInPeriod ? 'opacity-50' : ''}`}>

                    {/* En-tête du jour */}
                    <div className={`p-4 ${
                      isToday   ? 'bg-indigo-600'
                      : isFerie ? 'bg-rose-50'
                      : isConge ? 'bg-amber-50'
                      : 'bg-slate-50'
                    }`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        isToday   ? 'text-white'
                        : isFerie ? 'text-rose-600'
                        : isConge ? 'text-amber-600'
                        : 'text-slate-500'
                      }`}>
                        {JOURS[idx]}
                      </p>
                      <p className={`text-base font-black mt-0.5 ${isToday ? 'text-white' : 'text-slate-800'}`}>
                        {formatShortFr(date)}
                      </p>
                      {isConge && !isToday && (
                        <p className="flex items-center gap-1 text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">
                          <Umbrella size={9} /> Congé
                        </p>
                      )}
                      {isFerie && !isToday && (
                        <p className="flex items-center gap-1 text-[8px] font-black text-rose-600 uppercase tracking-widest mt-1">
                          <Star size={9} /> Jour Férié
                        </p>
                      )}
                      {!isInPeriod && planningConfig && (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Hors période</p>
                      )}
                      {!isInPeriod && !planningConfig && (
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Non configuré</p>
                      )}
                    </div>

                    {/* Corps : créneaux du jour */}
                    <div className="p-3 space-y-2 flex-1">
                      {(!isInPeriod || isRepos) ? (
                        <div className={`flex flex-col items-center justify-center py-6 gap-2 ${isFerie ? 'text-rose-300' : isConge ? 'text-amber-300' : 'text-slate-200'}`}>
                          {isFerie && <Star size={18} />}
                          {isConge && <Umbrella size={18} />}
                          <p className="text-[8px] font-black uppercase tracking-widest">
                            {isFerie ? 'Jour Férié' : isConge ? 'En Congé' : '—'}
                          </p>
                        </div>
                      ) : dayCreneaux.length === 0 ? (
                        <p className="text-center text-[8px] font-bold text-slate-300 uppercase tracking-widest py-4">Pas de cours</p>
                      ) : dayCreneaux.map(c => {
                        const exception = dayExceptions.find(e => e.creneauId === c.id);
                        const isCancelled = exception?.typeException === 'ANNULE';
                        const isModified  = exception?.typeException === 'MODIFIE';
                        const displayMatiere = isModified && exception?.matiereOverride ? exception.matiereOverride : c.matiere;
                        const displayDebut   = isModified && exception?.heureDebutOverride ? exception.heureDebutOverride : c.heureDebut;
                        const displayFin     = isModified && exception?.heureFinOverride   ? exception.heureFinOverride   : c.heureFin;
                        const col = COULEURS[c.couleur] || COULEURS.blue;

                        const isLocked = isFerie && !exception;
                        return (
                          <div key={c.id}
                            onClick={() => canEdit && !isLocked && openExceptionModal(c, dateStr, exception)}
                            title={isLocked ? 'Jour férié — cours non dispensé' : undefined}
                            className={`rounded-xl p-2.5 border transition-all select-none
                              ${isLocked ? 'opacity-40 cursor-not-allowed bg-rose-50/60 border-rose-100' : 'cursor-pointer hover:shadow-md'}
                              ${isCancelled ? 'opacity-40 bg-slate-50 border-slate-200' : !isLocked ? col.block : ''}
                              ${isModified  ? 'ring-2 ring-orange-400' : ''}
                            `}
                          >
                            {isLocked && (
                              <div className="flex items-center gap-1 mb-1">
                                <Star size={9} className="text-rose-400" />
                                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Férié</span>
                              </div>
                            )}
                            {isCancelled && (
                              <div className="flex items-center gap-1 mb-1">
                                <Ban size={9} className="text-rose-500" />
                                <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Annulé</span>
                              </div>
                            )}
                            {isModified && (
                              <div className="flex items-center gap-1 mb-1">
                                <Edit3 size={9} className="text-orange-500" />
                                <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Modifié</span>
                              </div>
                            )}
                            <p className={`text-[9px] font-black truncate ${isCancelled || isLocked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {displayMatiere}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                              {displayDebut}–{displayFin}
                            </p>
                            {exception?.note && (
                              <p className="text-[8px] text-slate-400 mt-1 italic truncate">{exception.note}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {classes.length === 0 && (
            <div className="py-20 flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
              <School size={32} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Aucune classe créée.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB — MON PLANNING
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'mon-planning' && (
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* Badge récurrent + navigation semaine */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Planning hebdomadaire récurrent · même grille chaque semaine
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMyWeekOffset(w => w - 1)}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 transition-all">
                <ChevronLeft size={15} />
              </button>
              <div className="text-center px-2">
                <p className="text-[11px] font-black text-slate-700">
                  {formatShortFr(myWeekDates[0])} – {formatShortFr(myWeekDates[4])} {myWeekDates[0].getFullYear()}
                </p>
                {myWeekOffset === 0 ? (
                  <p className="text-[9px] font-bold text-indigo-500">Semaine courante</p>
                ) : (
                  <button onClick={() => setMyWeekOffset(0)}
                    className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 transition-all">
                    Revenir à aujourd'hui
                  </button>
                )}
              </div>
              <button onClick={() => setMyWeekOffset(w => w + 1)}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 transition-all">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Sélecteur classe (prof peut enseigner plusieurs classes) */}
          {myClasses.length > 0 && (
            <div>
              <ClassePickerPanel
                classes={myClasses}
                selected={myFilterClasseId}
                onSelect={id => setMyFilterClasseId(prev => prev === id ? '' : id)}
              />
              {myFilterClasseId && (
                <button
                  onClick={() => setMyFilterClasseId('')}
                  className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all px-1"
                >
                  <X size={10} /> Voir toutes les classes
                </button>
              )}
            </div>
          )}

          {/* Grille personnelle */}
          {myCreneaux.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
              <CalendarDays size={32} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Aucun cours planifié pour le moment</p>
              <p className="text-[9px] text-slate-300 font-bold">Contactez l'administration pour la mise en place de votre planning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {JOURS.map((jour, idx) => {
                const colDate  = myWeekDates[idx];
                const todayStr = toISO(new Date());
                const colStr   = toISO(colDate);
                const isToday  = colStr === todayStr;
                const isPast   = colStr < todayStr && !isToday;
                const list = myCreneauxParJourFiltered[idx] || [];
                const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

                return (
                  <div key={jour} className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all ${
                    isToday ? 'border-indigo-200 shadow-indigo-50' : isPast ? 'border-slate-100 opacity-70' : 'border-slate-100'
                  }`}>
                    {/* En-tête jour avec vraie date */}
                    <div className={`p-4 ${isToday ? 'bg-indigo-600' : 'bg-slate-50'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-widest block ${isToday ? 'text-white/80' : 'text-slate-400'}`}>
                            {jour}
                          </span>
                          <span className={`text-2xl font-black leading-tight block ${isToday ? 'text-white' : isPast ? 'text-slate-300' : 'text-slate-800'}`}>
                            {colDate.getDate()}
                          </span>
                          <span className={`text-[9px] font-bold ${isToday ? 'text-white/70' : 'text-slate-400'}`}>
                            {colDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {isToday && (
                          <span className="text-[8px] font-black bg-white/20 text-white px-2 py-1 rounded-full mt-0.5">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cours du jour */}
                    <div className="p-3 space-y-2">
                      {list.length === 0 ? (
                        <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest py-4">Pas de cours</p>
                      ) : list.map(c => {
                        const col = COULEURS[c.couleur] || COULEURS.blue;
                        const [sh, sm] = c.heureDebut.split(':').map(Number);
                        const [eh, em] = c.heureFin.split(':').map(Number);
                        const isActive = isToday && sh * 60 + sm <= nowMins && nowMins < eh * 60 + em;
                        const isCoursPast = isToday && eh * 60 + em <= nowMins;
                        return (
                          <div
                            key={c.id}
                            className={`rounded-2xl p-3 border transition-all ${
                              isActive    ? 'ring-2 ring-indigo-400 shadow-lg ' + col.block
                              : isCoursPast ? 'opacity-50 ' + col.block
                              : col.block
                            }`}
                          >
                            {isActive && (
                              <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">En cours</span>
                              </div>
                            )}
                            <p className="text-xs font-black text-slate-900 truncate">{c.matiere}</p>
                            {c.classe && (
                              <p className="text-[9px] font-bold text-indigo-600 truncate">{c.classe.nom}</p>
                            )}
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{c.heureDebut} – {c.heureFin}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer stats */}
                    <div className="px-4 pb-3">
                      <div className={`text-[9px] font-black uppercase tracking-widest ${
                        isToday ? 'text-indigo-500' : list.length ? 'text-slate-300' : 'text-slate-200'
                      }`}>
                        {list.length} cours
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB — CAHIER DE TEXTE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'cahier' && (
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* Sélecteur classe */}
          <ClassePickerPanel
            classes={isTeacher ? myClasses : classes}
            selected={cahierClasseId}
            onSelect={id => { setCahierClasseId(id); setConfirmDeleteCahier(null); }}
          />

          {/* Barre d'actions */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
            <div>
              {cahierClasseId ? (
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Cahier de texte · {(isTeacher ? myClasses : classes).find(c => c.id === cahierClasseId)?.nom}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                  Sélectionnez une classe pour afficher son cahier
                </p>
              )}
            </div>
            <button
              onClick={() => openCahier()}
              disabled={!cahierClasseId}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={13} /> Nouvelle entrée
            </button>
          </div>

          {/* Liste des entrées */}
          {(() => {
            const filtered = cahier
              .filter(e => e.classeId === cahierClasseId)
              .sort((a, b) => b.date.localeCompare(a.date));

            if (filtered.length === 0) {
              return (
                <div className="py-20 flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                    <BookOpen size={26} className="text-indigo-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Cahier vide</p>
                    <p className="text-[10px] text-slate-300 mt-1 font-medium">Commencez par ajouter une première entrée de cours</p>
                  </div>
                  <button onClick={() => openCahier()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 mt-1">
                    <Plus size={12} /> Ajouter une entrée
                  </button>
                </div>
              );
            }

            // Grouper par date
            const grouped: Record<string, CahierEntry[]> = {};
            filtered.forEach(e => { (grouped[e.date] = grouped[e.date] || []).push(e); });

            return (
              <div className="space-y-6">
                {Object.entries(grouped)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, entries]) => {
                    const dtObj = new Date(date + 'T00:00:00');
                    const jourNom = dtObj.toLocaleDateString('fr-FR', { weekday: 'long' });
                    const jourNum = dtObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    const isToday = date === isoToday();
                    return (
                      <div key={date}>
                        {/* En-tête de date */}
                        <div className="flex items-center gap-3 mb-3 px-1">
                          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl shrink-0 ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest">{jourNom.slice(0, 3)}</span>
                            <span className="text-base font-black leading-none">{dtObj.getDate()}</span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-700 capitalize">{jourNom} {dtObj.getDate()}</p>
                            <p className="text-[9px] font-bold text-slate-400">{jourNum}</p>
                          </div>
                          {isToday && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Aujourd'hui</span>}
                        </div>

                        {/* Entrées de ce jour */}
                        <div className="space-y-3 pl-15">
                          {entries.map(entry => {
                            const matColor = getMatiereColor(entry.matiere);
                            const isConfirming = confirmDeleteCahier === entry.id;
                            return (
                              <div key={entry.id} className={`bg-white rounded-[2rem] border shadow-sm transition-all ${isConfirming ? 'border-rose-200 ring-2 ring-rose-100' : 'border-slate-100 hover:border-indigo-100'}`}>
                                <div className="p-6">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      {/* Matière + badge */}
                                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border ${matColor}`}>{entry.matiere}</span>
                                      </div>

                                      {/* Objectif */}
                                      {entry.objectif && (
                                        <div className="mb-3">
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Objectif pédagogique</p>
                                          <p className="text-xs text-slate-600 font-medium italic">{entry.objectif}</p>
                                        </div>
                                      )}

                                      {/* Contenu */}
                                      <div className="mb-3">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Déroulé du cours</p>
                                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{entry.contenu}</p>
                                      </div>

                                      {/* Devoirs */}
                                      {entry.devoirs && (
                                        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Devoirs / Exercices</p>
                                          </div>
                                          <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{entry.devoirs}</p>
                                        </div>
                                      )}

                                      {/* Observations */}
                                      {entry.observations && (
                                        <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Observations</p>
                                          </div>
                                          <p className="text-xs text-slate-600 leading-relaxed">{entry.observations}</p>
                                        </div>
                                      )}

                                      <p className="text-[9px] font-bold text-slate-300 mt-4">{entry.auteur}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                      {!isConfirming ? (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => openCahier(entry)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                            title="Modifier"
                                          ><Edit3 size={14} /></button>
                                          <button
                                            onClick={() => setConfirmDeleteCahier(entry.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            title="Supprimer"
                                          ><Trash2 size={14} /></button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-end gap-2 animate-in fade-in duration-150">
                                          <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Supprimer ?</p>
                                          <div className="flex gap-1.5">
                                            <button
                                              onClick={() => setConfirmDeleteCahier(null)}
                                              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                            >Non</button>
                                            <button
                                              onClick={() => deleteCahierEntry(entry.id)}
                                              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                                            >Oui, supprimer</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ MODAL CRÉNEAU ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{editing ? 'Modifier le créneau' : 'Nouveau créneau'}</h3>
                {selectedClasse && <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{selectedClasse.nom}</p>}
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">

              {/* Matière */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Matière</label>
                <select value={form.matiere} onChange={e => setForm(f => ({ ...f, matiere: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10">
                  <option value="">— Sélectionner —</option>
                  {matieres.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Enseignant */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Enseignant</label>
                <select value={form.enseignantId || ''} onChange={e => setForm(f => ({ ...f, enseignantId: e.target.value || '' }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10">
                  <option value="">— Aucun —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{empNom(e)}</option>)}
                </select>
              </div>

              {/* Jour */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Jour</label>
                <div className="flex gap-2">
                  {JOURS.map((j, i) => {
                    const wd = weekDates[i];
                    return (
                      <button key={j} type="button" onClick={() => setForm(f => ({ ...f, jour: i }))}
                        className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-0.5 ${form.jour === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}>
                        <span>{j.slice(0, 3)}</span>
                        <span className={`text-[8px] font-bold ${form.jour === i ? 'text-white/70' : 'text-slate-300'}`}>
                          {wd.getDate()}/{wd.getMonth() + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[8px] font-bold text-slate-400 px-2 flex items-center gap-1">
                  <RefreshCw size={8} /> Ce créneau sera récurrent — il apparaîtra toutes les semaines à ce jour et ces horaires.
                </p>
              </div>

              {/* Horaires */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Début</label>
                    <select value={form.heureDebut} onChange={e => {
                      const newDebut = e.target.value;
                      setForm(f => ({
                        ...f,
                        heureDebut: newDebut,
                        heureFin: f.heureFin <= newDebut
                          ? (HORAIRES[HORAIRES.indexOf(newDebut) + 1] || newDebut)
                          : f.heureFin,
                      }));
                    }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10">
                      {HORAIRES.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Fin</label>
                    <select value={form.heureFin} onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))}
                      className={`w-full bg-slate-50 border rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 ${form.heureFin <= form.heureDebut ? 'border-rose-300 focus:ring-rose-500/10' : 'border-slate-100 focus:ring-indigo-500/10'}`}>
                      {HORAIRES.filter(h => h > form.heureDebut).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                {form.heureFin <= form.heureDebut && (
                  <p className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 px-1">
                    <AlertCircle size={11} /> L'heure de fin doit être postérieure à l'heure de début
                  </p>
                )}
              </div>

              {/* Couleur */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(COULEURS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({ ...f, couleur: k }))}
                      className={`w-8 h-8 rounded-full ${v.bar} transition-all ${form.couleur === k ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Annuler
                </button>
                <button type="button" onClick={handleSave}
                  className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200">
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CAHIER ══════════════════════════════════════════════════════ */}
      {showCahierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCahierModal(false); }}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

            {/* En-tête */}
            <div className="p-8 border-b border-slate-50 flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                  {editingCahier ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
                </h3>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                  {classes.find(c => c.id === cahierForm.classeId)?.nom || 'Cahier de texte'}
                </p>
              </div>
              <button onClick={() => setShowCahierModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all mt-1"><X size={18} /></button>
            </div>

            {/* Corps scrollable */}
            <div className="overflow-y-auto p-8 space-y-6 flex-1">

              {/* ─ Section Cours ──────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <BookOpen size={12} className="text-indigo-500" />
                  </div>
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Cours</p>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="space-y-4">
                  {/* Date + Matière */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Date du cours</label>
                      <input type="date" value={cahierForm.date}
                        onChange={e => setCahierForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Matière <span className="text-rose-400">*</span></label>
                      <select value={cahierForm.matiere}
                        onChange={e => setCahierForm(f => ({ ...f, matiere: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200">
                        <option value="">— Sélectionner —</option>
                        {(classes.find(c => c.id === cahierForm.classeId)
                          ? MATIERES[classes.find(c => c.id === cahierForm.classeId)!.niveau] || []
                          : []
                        ).map((m: string) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Objectif */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Objectif pédagogique</label>
                    <input type="text" value={cahierForm.objectif}
                      onChange={e => setCahierForm(f => ({ ...f, objectif: e.target.value }))}
                      placeholder="Ex : L'élève sera capable de lire un texte de 3 paragraphes…"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 placeholder-slate-300" />
                  </div>

                  {/* Contenu */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Déroulé du cours <span className="text-rose-400">*</span></label>
                    <textarea value={cahierForm.contenu}
                      onChange={e => setCahierForm(f => ({ ...f, contenu: e.target.value }))}
                      rows={4}
                      placeholder="Décrivez les activités, les points abordés, les exercices réalisés en classe…"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 resize-none placeholder-slate-300 leading-relaxed" />
                  </div>
                </div>
              </div>

              {/* ─ Section Devoirs & Observations ─────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Edit3 size={12} className="text-amber-500" />
                  </div>
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Devoirs & Observations</p>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="space-y-4">
                  {/* Devoirs */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Devoirs / Exercices à faire</label>
                    <textarea value={cahierForm.devoirs}
                      onChange={e => setCahierForm(f => ({ ...f, devoirs: e.target.value }))}
                      rows={2}
                      placeholder="Exercices à faire à la maison pour le prochain cours…"
                      className="w-full bg-amber-50/60 border border-amber-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 resize-none placeholder-amber-300 leading-relaxed" />
                  </div>

                  {/* Observations */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Observations</label>
                      <span className="text-[8px] text-slate-300 font-bold">(optionnel)</span>
                    </div>
                    <textarea value={cahierForm.observations || ''}
                      onChange={e => setCahierForm(f => ({ ...f, observations: e.target.value }))}
                      rows={2}
                      placeholder="Remarques particulières sur le déroulement du cours, difficultés observées…"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-slate-500/10 focus:border-slate-200 resize-none placeholder-slate-300 leading-relaxed" />
                  </div>
                </div>
              </div>
            </div>

            {/* Pied de page */}
            <div className="p-8 pt-0 shrink-0">
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCahierModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Annuler
                </button>
                <button type="button" onClick={saveCahierEntry}
                  className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200">
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIG PÉRIODE SCOLAIRE ═════════════════════════════════════ */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowConfigModal(false); }}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                  <Settings size={18} className="text-indigo-500" /> Période scolaire
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Année {anneeEffective}</p>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-5">

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Date de début</label>
                  <input type="date" value={configForm.dateDebut}
                    onChange={e => setConfigForm(f => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Date de fin</label>
                  <input type="date" value={configForm.dateFin}
                    onChange={e => setConfigForm(f => ({ ...f, dateFin: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Jours de congé / jours fériés</label>

                {/* Sélecteur type */}
                <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                  <button type="button"
                    onClick={() => setConfigForm(f => ({ ...f, newTypeRepos: 'CONGE' }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${configForm.newTypeRepos === 'CONGE' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' : 'text-slate-400 hover:text-amber-500'}`}>
                    <Umbrella size={10} /> Congé scolaire
                  </button>
                  <button type="button"
                    onClick={() => setConfigForm(f => ({ ...f, newTypeRepos: 'FERIE' }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${configForm.newTypeRepos === 'FERIE' ? 'bg-rose-500 text-white shadow-md shadow-rose-100' : 'text-slate-400 hover:text-rose-500'}`}>
                    <Star size={10} /> Jour Férié
                  </button>
                </div>

                <div className="flex gap-2">
                  <input type="date" value={configForm.newJourRepos}
                    onChange={e => setConfigForm(f => ({ ...f, newJourRepos: e.target.value }))}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  <button
                    onClick={() => {
                      if (!configForm.newJourRepos || configForm.joursRepos.some(j => j.date === configForm.newJourRepos)) return;
                      setConfigForm(f => ({
                        ...f,
                        joursRepos: [...f.joursRepos, { date: f.newJourRepos, type: f.newTypeRepos }].sort((a, b) => a.date.localeCompare(b.date)),
                        newJourRepos: '',
                      }));
                    }}
                    className={`px-5 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${configForm.newTypeRepos === 'FERIE' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                    <Plus size={14} />
                  </button>
                </div>

                {configForm.joursRepos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {configForm.joursRepos.map(jr => (
                      <span key={jr.date} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black border ${jr.type === 'FERIE' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                        {jr.type === 'FERIE' ? <Star size={9} /> : <Umbrella size={9} />}
                        {formatDateFr(jr.date)}
                        <button onClick={() => setConfigForm(f => ({ ...f, joursRepos: f.joursRepos.filter(x => x.date !== jr.date) }))}
                          className={`${jr.type === 'FERIE' ? 'text-rose-400 hover:text-rose-600' : 'text-amber-400 hover:text-amber-600'} transition-colors`}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {configForm.joursRepos.length === 0 && (
                  <p className="text-[9px] text-slate-300 font-bold px-2">Aucun jour ajouté</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Annuler
                </button>
                <button onClick={saveConfig} disabled={savingConfig}
                  className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 disabled:opacity-60">
                  {savingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EXCEPTION ═══════════════════════════════════════════════════ */}
      {showExceptionModal && exceptionTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowExceptionModal(false); }}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Exception</h3>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                  {exceptionTarget.creneau.matiere} · {formatDateFr(exceptionTarget.date)}
                </p>
              </div>
              <button onClick={() => setShowExceptionModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-5">

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Type d'exception</label>
                <div className="flex gap-3">
                  {([['ANNULE', 'Annuler ce cours', 'rose'], ['MODIFIE', 'Modifier ce cours', 'orange']] as const).map(([val, label, color]) => (
                    <button key={val} type="button"
                      onClick={() => setExceptionForm(f => ({ ...f, typeException: val }))}
                      className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all
                        ${exceptionForm.typeException === val
                          ? val === 'ANNULE' ? 'bg-rose-600 text-white border-rose-600' : 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                      {val === 'ANNULE' ? <><Ban size={12} className="inline mr-1" />{label}</> : <><Edit3 size={12} className="inline mr-1" />{label}</>}
                    </button>
                  ))}
                </div>
              </div>

              {exceptionForm.typeException === 'MODIFIE' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Nouvelle matière (optionnel)</label>
                    <input value={exceptionForm.matiereOverride}
                      onChange={e => setExceptionForm(f => ({ ...f, matiereOverride: e.target.value }))}
                      placeholder={exceptionTarget.creneau.matiere}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Heure début</label>
                        <select value={exceptionForm.heureDebutOverride}
                          onChange={e => {
                            const newDebut = e.target.value;
                            setExceptionForm(f => ({
                              ...f,
                              heureDebutOverride: newDebut,
                              heureFinOverride: f.heureFinOverride <= newDebut
                                ? (HORAIRES[HORAIRES.indexOf(newDebut) + 1] || newDebut)
                                : f.heureFinOverride,
                            }));
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10">
                          {HORAIRES.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Heure fin</label>
                        <select value={exceptionForm.heureFinOverride}
                          onChange={e => setExceptionForm(f => ({ ...f, heureFinOverride: e.target.value }))}
                          className={`w-full bg-slate-50 border rounded-2xl px-4 py-3.5 text-sm font-black outline-none focus:ring-4 ${exceptionForm.heureFinOverride <= exceptionForm.heureDebutOverride ? 'border-rose-300 focus:ring-rose-500/10' : 'border-slate-100 focus:ring-indigo-500/10'}`}>
                          {HORAIRES.filter(h => h > exceptionForm.heureDebutOverride).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                    {exceptionForm.heureFinOverride <= exceptionForm.heureDebutOverride && (
                      <p className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 px-1">
                        <AlertCircle size={11} /> L'heure de fin doit être postérieure à l'heure de début
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Note / Motif (optionnel)</label>
                <input value={exceptionForm.note}
                  onChange={e => setExceptionForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Ex: Fête nationale, prof absent..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
              </div>

              <div className="flex gap-3 pt-2">
                {exceptionTarget.existing && (
                  <button onClick={() => deleteException(exceptionTarget.existing!.id)}
                    className="px-5 py-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2">
                    <Trash2 size={12} /> Retirer
                  </button>
                )}
                <button onClick={() => setShowExceptionModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Annuler
                </button>
                <button onClick={saveException} disabled={savingException}
                  className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {savingException ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMER SUPPRESSION ═══════════════════════════════════════ */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[600] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Zone danger */}
            <div className="bg-gradient-to-b from-rose-50 to-white px-8 pt-10 pb-6 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-rose-100 rounded-[1.5rem] flex items-center justify-center shadow-inner shadow-rose-200">
                <Trash2 size={28} className="text-rose-500" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter">Supprimer ce créneau ?</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cette action est définitive et irréversible.</p>
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 pb-8 pt-2 flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={doDelete}
                className="flex-1 px-5 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-200"
              >
                <Trash2 size={13} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL WHATSAPP ══════════════════════════════════════════════════════ */}
      {showWA && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowWA(false); }}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><MessageCircle size={18} /></div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Envoyer via WhatsApp</h3>
              </div>
              <button onClick={() => setShowWA(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Aperçu du message</label>
                <textarea readOnly value={waTxt} rows={10}
                  className="w-full text-xs font-mono bg-green-50 border border-green-200 rounded-2xl p-4 resize-none text-slate-700" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Numéro (optionnel)</label>
                <input value={waPhone} onChange={e => setWaPhone(e.target.value)} placeholder="+221 77 000 00 00"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => { try { await navigator.clipboard.writeText(waTxt); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {} }}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié !' : 'Copier'}
                </button>
                <button
                  onClick={() => { const ph = waPhone.replace(/\D/g,''); window.open(ph ? `https://wa.me/${ph}?text=${encodeURIComponent(waTxt)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waTxt)}`, '_blank', 'noopener,noreferrer'); }}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all">
                  <Send size={14} /> Ouvrir WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploiDuTemps;
