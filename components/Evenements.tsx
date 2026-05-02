import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays, Bell, Plus, Edit3, Trash2, Send, Eye, X,
  Search, ChevronLeft, ChevronRight, MapPin, Users,
  Clock, CheckCircle2, AlertCircle, Loader2, MessageSquare,
  Save, Info, Tag, FileText, GraduationCap, ExternalLink,
  Megaphone, PartyPopper, BookOpen, AlertTriangle, Home
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { User, NiveauScolaire, EvenementEcole } from '../types';

// ─── Types locaux ─────────────────────────────────────────────────────────────

type TypeEvenement =
  | 'SORTIE'
  | 'REUNION'
  | 'FETE'
  | 'EXAMEN'
  | 'FERMETURE'
  | 'INFO';

type StatutEvenement = 'BROUILLON' | 'PUBLIE' | 'ANNULE';

interface Evenement {
  id: string;
  titre: string;
  typeEvenement: TypeEvenement;
  statut: StatutEvenement;
  description: string;
  dateDebut: string;
  dateFin?: string;
  heureDebut?: string;
  heureFin?: string;
  lieu?: string;
  niveauxCibles: ('TOUS' | NiveauScolaire)[];
  diffuse: boolean;
  dateCreation: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const LS_EVENTS_KEY = 'evenements_ecole';

const NIVEAUX_SCOLAIRES: NiveauScolaire[] = ['CRECHE', 'PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const NIVEAUX_LABELS: Record<string, string> = {
  TOUS: 'Tous les niveaux',
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const TYPES_EVENEMENT: {
  id: TypeEvenement; label: string; icon: any; color: string; emoji: string;
}[] = [
  { id: 'SORTIE',     label: 'Sortie scolaire',         icon: MapPin,       color: 'teal',   emoji: '🚌' },
  { id: 'REUNION',    label: 'Réunion parents-profs',   icon: Users,        color: 'blue',   emoji: '👥' },
  { id: 'FETE',       label: 'Fête / Spectacle',        icon: PartyPopper,  color: 'violet', emoji: '🎉' },
  { id: 'EXAMEN',     label: 'Évaluation / Composition',icon: BookOpen,     color: 'amber',  emoji: '📝' },
  { id: 'FERMETURE',  label: 'Fermeture exceptionnelle',icon: Home,         color: 'rose',   emoji: '🔒' },
  { id: 'INFO',       label: 'Information générale',    icon: Megaphone,    color: 'slate',  emoji: '📢' },
];

const STATUTS: { id: StatutEvenement; label: string; color: string }[] = [
  { id: 'BROUILLON', label: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
  { id: 'PUBLIE',    label: 'Publié',    color: 'bg-emerald-100 text-emerald-700' },
  { id: 'ANNULE',    label: 'Annulé',   color: 'bg-rose-100 text-rose-600' },
];

const COLOR_MAP: Record<string, { badge: string; bg: string; border: string; text: string; btn: string }> = {
  teal:   { badge: 'bg-teal-100 text-teal-700',     bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   btn: 'bg-teal-600 hover:bg-teal-700' },
  blue:   { badge: 'bg-blue-100 text-blue-700',     bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700' },
  violet: { badge: 'bg-violet-100 text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', btn: 'bg-violet-600 hover:bg-violet-700' },
  amber:  { badge: 'bg-amber-100 text-amber-700',   bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  btn: 'bg-amber-600 hover:bg-amber-700' },
  rose:   { badge: 'bg-rose-100 text-rose-600',     bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-600',   btn: 'bg-rose-600 hover:bg-rose-700' },
  slate:  { badge: 'bg-slate-100 text-slate-600',   bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  btn: 'bg-slate-700 hover:bg-slate-800' },
};

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function loadEvents(): Evenement[] {
  try { return JSON.parse(localStorage.getItem(LS_EVENTS_KEY) || '[]'); } catch { return []; }
}
function saveEvents(data: Evenement[]) {
  try { localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(data)); } catch {}
}

function getTypeInfo(id: TypeEvenement) {
  return TYPES_EVENEMENT.find(t => t.id === id) ?? TYPES_EVENEMENT[5];
}

function formatDateFr(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isoToday(): string { return new Date().toISOString().split('T')[0]; }

function buildWaLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('0') ? '221' + clean.slice(1) : clean.startsWith('221') ? clean : '221' + clean;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

function buildWaMessage(ev: Evenement): string {
  const type = getTypeInfo(ev.typeEvenement);
  const niveaux = ev.niveauxCibles.includes('TOUS')
    ? 'tous les niveaux'
    : ev.niveauxCibles.map(n => NIVEAUX_LABELS[n] ?? n).join(', ');

  let msg = `Bonjour,\n\n${type.emoji} *${type.label.toUpperCase()}*\n\n`;
  msg += `📌 *${ev.titre}*\n`;
  msg += `📅 Date : ${formatDateFr(ev.dateDebut)}`;
  if (ev.dateFin && ev.dateFin !== ev.dateDebut) msg += ` → ${formatDateFr(ev.dateFin)}`;
  if (ev.heureDebut) msg += `\n⏰ Heure : ${ev.heureDebut}${ev.heureFin ? ` – ${ev.heureFin}` : ''}`;
  if (ev.lieu) msg += `\n📍 Lieu : ${ev.lieu}`;
  msg += `\n👥 Concerne : ${niveaux}`;
  if (ev.description) msg += `\n\n${ev.description}`;
  msg += '\n\n— Le Toit des Anges 🏫';
  return msg;
}

// ─── Formulaire vide ─────────────────────────────────────────────────────────

const emptyForm = (): Omit<Evenement, 'id' | 'dateCreation'> => ({
  titre: '',
  typeEvenement: 'INFO',
  statut: 'BROUILLON',
  description: '',
  dateDebut: isoToday(),
  dateFin: '',
  heureDebut: '',
  heureFin: '',
  lieu: '',
  niveauxCibles: ['TOUS'],
  diffuse: false,
});

// ─── Composant calendrier mensuel ────────────────────────────────────────────

function CalendrierMensuel({
  events,
  annee,
  mois,
  onDayClick,
}: {
  events: Evenement[];
  annee: number;
  mois: number;
  onDayClick: (day: number) => void;
}) {
  const firstDay = new Date(annee, mois, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // lundi=0
  const daysInMonth = new Date(annee, mois + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === annee && today.getMonth() === mois;

  const eventsByDay = useMemo(() => {
    const map: Record<number, Evenement[]> = {};
    events.forEach(ev => {
      const d = new Date(ev.dateDebut + 'T00:00:00');
      if (d.getFullYear() === annee && d.getMonth() === mois) {
        const day = d.getDate();
        map[day] = [...(map[day] || []), ev];
      }
    });
    return map;
  }, [events, annee, mois]);

  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
          <div key={i} className="p-2 text-center text-xs font-bold text-slate-400 uppercase">{j}</div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 divide-x divide-slate-100">
            {row.map((day, di) => {
              if (!day) return <div key={di} className="min-h-[72px] bg-slate-50/50" />;
              const dayEvents = eventsByDay[day] || [];
              const isToday = isCurrentMonth && today.getDate() === day;
              return (
                <button
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={`min-h-[72px] p-1.5 text-left hover:bg-slate-50 transition-colors relative
                    ${isToday ? 'bg-indigo-50' : ''}`}
                >
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold mb-1
                    ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => {
                      const t = getTypeInfo(ev.typeEvenement);
                      const c = COLOR_MAP[t.color];
                      return (
                        <div key={ev.id} className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate ${c.badge}`}>
                          {t.emoji} {ev.titre}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <p className="text-[9px] text-slate-400 pl-1">+{dayEvents.length - 2}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const Evenements: React.FC<{ user: User }> = ({ user }) => {
  const showToast = useToast();
  const canModify = authBridge.canPerform(user, 'EDIT', 'evenements');

  // --- état général
  const [activeTab, setActiveTab] = useState<'liste' | 'calendrier'>('liste');
  const [events, setEvents] = useState<Evenement[]>(loadEvents);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loadingEleves, setLoadingEleves] = useState(false);

  // --- filtres liste
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [filterNiveau, setFilterNiveau] = useState('ALL');

  // --- modal création/édition
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [selected, setSelected] = useState<Evenement | null>(null);
  const [form, setForm] = useState<Omit<Evenement, 'id' | 'dateCreation'>>(emptyForm());

  // --- modal diffusion WhatsApp
  const [diffusionEvent, setDiffusionEvent] = useState<Evenement | null>(null);
  const [diffusionLinks, setDiffusionLinks] = useState<{ nom: string; phone: string; link: string }[]>([]);

  // --- calendrier
  const [calAnnee, setCalAnnee] = useState(new Date().getFullYear());
  const [calMois, setCalMois] = useState(new Date().getMonth());

  // ── Charger élèves ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoadingEleves(true);
      try { setEleves(await apiClient.get('/customers') || []); }
      catch { /* silencieux */ }
      finally { setLoadingEleves(false); }
    })();
  }, []);

  // ── Filtres ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return events
      .filter(ev => {
        const matchSearch = ev.titre.toLowerCase().includes(search.toLowerCase()) ||
          ev.description.toLowerCase().includes(search.toLowerCase());
        const matchType   = filterType   === 'ALL' || ev.typeEvenement === filterType;
        const matchStatut = filterStatut === 'ALL' || ev.statut === filterStatut;
        const matchNiveau = filterNiveau === 'ALL' ||
          ev.niveauxCibles.includes('TOUS') ||
          ev.niveauxCibles.includes(filterNiveau as NiveauScolaire);
        return matchSearch && matchType && matchStatut && matchNiveau;
      })
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  }, [events, search, filterType, filterStatut, filterNiveau]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = isoToday();
    return {
      total: events.length,
      avenir: events.filter(e => e.dateDebut >= now && e.statut !== 'ANNULE').length,
      publie: events.filter(e => e.statut === 'PUBLIE').length,
      diffuse: events.filter(e => e.diffuse).length,
    };
  }, [events]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setSelected(null);
    setForm(emptyForm());
    setModalMode('CREATE');
  };

  const handleOpenEdit = (ev: Evenement) => {
    setSelected(ev);
    setForm({ titre: ev.titre, typeEvenement: ev.typeEvenement, statut: ev.statut, description: ev.description,
      dateDebut: ev.dateDebut, dateFin: ev.dateFin, heureDebut: ev.heureDebut, heureFin: ev.heureFin,
      lieu: ev.lieu, niveauxCibles: ev.niveauxCibles, diffuse: ev.diffuse });
    setModalMode('EDIT');
  };

  const handleSave = () => {
    if (!form.titre || !form.dateDebut) { showToast('Titre et date de début sont obligatoires.', 'error'); return; }
    let updated: Evenement[];
    if (modalMode === 'CREATE') {
      updated = [{ ...form, id: genId(), dateCreation: new Date().toISOString() }, ...events];
      showToast('Événement créé.', 'success');
    } else {
      updated = events.map(e => e.id === selected!.id ? { ...e, ...form } : e);
      showToast('Événement mis à jour.', 'success');
    }
    setEvents(updated);
    saveEvents(updated);
    setModalMode(null);
  };

  const handleDelete = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    saveEvents(updated);
    setModalMode(null);
    showToast('Événement supprimé.', 'info');
  };

  const handlePublish = (ev: Evenement) => {
    const updated = events.map(e => e.id === ev.id ? { ...e, statut: 'PUBLIE' as StatutEvenement } : e);
    setEvents(updated);
    saveEvents(updated);
    showToast(`"${ev.titre}" publié.`, 'success');
  };

  const handleCancel = (ev: Evenement) => {
    const updated = events.map(e => e.id === ev.id ? { ...e, statut: 'ANNULE' as StatutEvenement } : e);
    setEvents(updated);
    saveEvents(updated);
    showToast(`"${ev.titre}" annulé.`, 'info');
  };

  // ── Diffusion WhatsApp ─────────────────────────────────────────────────────

  const handleOpenDiffusion = (ev: Evenement) => {
    const message = buildWaMessage(ev);
    const cibles = eleves.filter(e => {
      const statut = e.statut || e.status || 'ACTIF';
      if (!(statut === 'ACTIF' || e.isActive || e.is_active)) return false;
      if (ev.niveauxCibles.includes('TOUS')) return true;
      const niveau = e.niveau || e.niveauScolaire || '';
      return ev.niveauxCibles.includes(niveau);
    });
    const links = cibles.map(e => {
      const nom = e.companyName || e.name || '';
      const phone = e.parent1Whatsapp || e.parent1Tel || e.phone || e.contact || '';
      return { nom, phone, link: phone ? buildWaLink(phone, message) : '' };
    });
    setDiffusionLinks(links);
    setDiffusionEvent(ev);
  };

  const handleConfirmDiffusion = () => {
    if (!diffusionEvent) return;
    const updated = events.map(e => e.id === diffusionEvent.id ? { ...e, diffuse: true } : e);
    setEvents(updated);
    saveEvents(updated);
    setDiffusionEvent(null);
    showToast('Événement marqué comme diffusé.', 'success');
  };

  // ── Toggle niveau cible ────────────────────────────────────────────────────

  const toggleNiveau = (n: 'TOUS' | NiveauScolaire) => {
    setForm(f => {
      if (n === 'TOUS') return { ...f, niveauxCibles: ['TOUS'] };
      const without = f.niveauxCibles.filter(x => x !== 'TOUS' && x !== n);
      const withN = f.niveauxCibles.includes(n) ? without : [...without, n];
      return { ...f, niveauxCibles: withN.length === 0 ? ['TOUS'] : withN };
    });
  };

  // ── Calendrier ─────────────────────────────────────────────────────────────

  const prevMois = () => { if (calMois === 0) { setCalAnnee(y => y - 1); setCalMois(11); } else setCalMois(m => m - 1); };
  const nextMois = () => { if (calMois === 11) { setCalAnnee(y => y + 1); setCalMois(0); } else setCalMois(m => m + 1); };

  const eventsOfMonth = useMemo(() =>
    events.filter(ev => {
      const d = new Date(ev.dateDebut + 'T00:00:00');
      return d.getFullYear() === calAnnee && d.getMonth() === calMois && ev.statut !== 'ANNULE';
    }),
    [events, calAnnee, calMois]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-violet-600 rounded-xl text-white"><Bell size={22} /></span>
            Événements &amp; Communication
          </h1>
          <p className="text-slate-500 text-sm mt-1">Agenda scolaire et diffusion d'informations aux parents</p>
        </div>
        {canModify && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
          >
            <Plus size={16} /> Nouvel événement
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total événements', value: kpis.total,   color: 'bg-slate-50 text-slate-700',     icon: CalendarDays },
          { label: 'À venir',          value: kpis.avenir,  color: 'bg-violet-50 text-violet-700',   icon: Clock },
          { label: 'Publiés',          value: kpis.publie,  color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
          { label: 'Diffusés WhatsApp',value: kpis.diffuse, color: 'bg-green-50 text-green-700',     icon: MessageSquare },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl p-4 ${k.color} flex items-center gap-4`}>
            <k.icon size={22} className="shrink-0 opacity-70" />
            <div>
              <p className="text-2xl font-black">{k.value}</p>
              <p className="text-xs font-medium opacity-80">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {([
          ['liste',      'Liste',      Bell],
          ['calendrier', 'Calendrier', CalendarDays],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all
              ${activeTab === id ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── ONGLET LISTE ──────────────────────────────────────────────────────── */}
      {activeTab === 'liste' && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un événement..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">Tous les types</option>
              {TYPES_EVENEMENT.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={filterNiveau}
              onChange={e => setFilterNiveau(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">Tous les niveaux</option>
              {NIVEAUX_SCOLAIRES.map(n => <option key={n} value={n}>{NIVEAUX_LABELS[n]}</option>)}
            </select>
          </div>

          {/* Liste */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <Bell size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Aucun événement trouvé</p>
              {canModify && <p className="text-xs text-slate-400 mt-1">Cliquez sur "Nouvel événement" pour commencer</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(ev => {
                const type = getTypeInfo(ev.typeEvenement);
                const c = COLOR_MAP[type.color];
                const statut = STATUTS.find(s => s.id === ev.statut)!;
                const isPast = ev.dateDebut < isoToday();
                return (
                  <div
                    key={ev.id}
                    className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${c.border}`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Icône */}
                      <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-2xl shrink-0`}>
                        {type.emoji}
                      </div>
                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 text-sm">{ev.titre}</h3>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                            {type.label}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statut.color}`}>
                            {statut.label}
                          </span>
                          {ev.diffuse && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              📤 Diffusé
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={11} />
                            {formatDateShort(ev.dateDebut)}
                            {ev.dateFin && ev.dateFin !== ev.dateDebut && ` → ${formatDateShort(ev.dateFin)}`}
                          </span>
                          {ev.heureDebut && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />{ev.heureDebut}{ev.heureFin ? ` – ${ev.heureFin}` : ''}
                            </span>
                          )}
                          {ev.lieu && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />{ev.lieu}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {ev.niveauxCibles.includes('TOUS') ? 'Tous' : ev.niveauxCibles.map(n => NIVEAUX_LABELS[n] ?? n).join(', ')}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{ev.description}</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {ev.statut === 'BROUILLON' && canModify && (
                          <button
                            onClick={() => handlePublish(ev)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={12} /> Publier
                          </button>
                        )}
                        {ev.statut === 'PUBLIE' && !ev.diffuse && canModify && (
                          <button
                            onClick={() => handleOpenDiffusion(ev)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                          >
                            <MessageSquare size={12} /> Diffuser WhatsApp
                          </button>
                        )}
                        {canModify && (
                          <button
                            onClick={() => handleOpenEdit(ev)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                            title="Modifier"
                          >
                            <Edit3 size={14} className="text-slate-500" />
                          </button>
                        )}
                        {ev.statut !== 'ANNULE' && canModify && (
                          <button
                            onClick={() => handleCancel(ev)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                            title="Annuler l'événement"
                          >
                            <X size={14} className="text-slate-500" />
                          </button>
                        )}
                        {canModify && (
                          <button
                            onClick={() => handleDelete(ev.id)}
                            className="p-1.5 rounded-lg border border-rose-100 hover:bg-rose-50"
                            title="Supprimer"
                          >
                            <Trash2 size={14} className="text-rose-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET CALENDRIER ──────────────────────────────────────────────── */}
      {activeTab === 'calendrier' && (
        <div className="space-y-4">
          {/* Nav mois */}
          <div className="flex items-center justify-between">
            <button onClick={prevMois} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <h2 className="text-lg font-bold text-slate-800">{MOIS[calMois]} {calAnnee}</h2>
            <button onClick={nextMois} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>

          <CalendrierMensuel
            events={eventsOfMonth}
            annee={calAnnee}
            mois={calMois}
            onDayClick={day => {
              const iso = `${calAnnee}-${String(calMois + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              if (canModify) { setForm({ ...emptyForm(), dateDebut: iso }); setModalMode('CREATE'); }
            }}
          />

          {/* Événements du mois en dessous */}
          {eventsOfMonth.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-bold text-slate-800 text-sm">{eventsOfMonth.length} événement(s) ce mois</p>
              </div>
              <div className="divide-y divide-slate-100">
                {eventsOfMonth.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)).map(ev => {
                  const type = getTypeInfo(ev.typeEvenement);
                  const c = COLOR_MAP[type.color];
                  return (
                    <div key={ev.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                      <span className="text-xl">{type.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">{ev.titre}</p>
                        <p className="text-xs text-slate-400">{formatDateShort(ev.dateDebut)}{ev.heureDebut ? ` · ${ev.heureDebut}` : ''}{ev.lieu ? ` · ${ev.lieu}` : ''}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                        {type.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL CRÉATION / ÉDITION ───────────────────────────────────────── */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="font-bold text-slate-800 text-lg">
                {modalMode === 'CREATE' ? 'Nouvel événement' : 'Modifier l\'événement'}
              </h2>
              <button onClick={() => setModalMode(null)} className="p-2 rounded-xl hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type d'événement */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Type d'événement</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES_EVENEMENT.map(t => {
                    const c = COLOR_MAP[t.color];
                    const isSelected = form.typeEvenement === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setForm(f => ({ ...f, typeEvenement: t.id }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-sm
                          ${isSelected ? `${c.bg} ${c.border} border-2 font-semibold ${c.text}` : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                      >
                        <span>{t.emoji}</span><span className="text-xs">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Titre */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Titre *</label>
                <input
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Titre de l'événement..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Dates et heures */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Date de début *</label>
                  <input type="date" value={form.dateDebut}
                    onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Date de fin</label>
                  <input type="date" value={form.dateFin ?? ''}
                    onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Heure début</label>
                  <input type="time" value={form.heureDebut ?? ''}
                    onChange={e => setForm(f => ({ ...f, heureDebut: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Heure fin</label>
                  <input type="time" value={form.heureFin ?? ''}
                    onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>

              {/* Lieu */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Lieu (optionnel)</label>
                <input
                  value={form.lieu ?? ''}
                  onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                  placeholder="Ex : Salle polyvalente, Musée IFAN, École..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Description / Message aux parents</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Informations complémentaires pour les parents..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Niveaux cibles */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Niveaux concernés</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleNiveau('TOUS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                      ${form.niveauxCibles.includes('TOUS') ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                  >
                    Tous
                  </button>
                  {NIVEAUX_SCOLAIRES.map(n => (
                    <button
                      key={n}
                      onClick={() => toggleNiveau(n)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                        ${form.niveauxCibles.includes(n) && !form.niveauxCibles.includes('TOUS')
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                    >
                      {NIVEAUX_LABELS[n]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Statut */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Statut</label>
                <div className="flex gap-2">
                  {STATUTS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setForm(f => ({ ...f, statut: s.id }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                        ${form.statut === s.id ? s.color + ' border-current' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-100 rounded-b-3xl flex items-center justify-between gap-3">
              {modalMode === 'EDIT' && (
                <button
                  onClick={() => handleDelete(selected!.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-rose-500 border border-rose-200 hover:bg-rose-50"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setModalMode(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">Annuler</button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                >
                  <Save size={14} /> {modalMode === 'CREATE' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DIFFUSION WHATSAPP ───────────────────────────────────────── */}
      {diffusionEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">Diffusion WhatsApp</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {diffusionLinks.length} parent(s) · {diffusionLinks.filter(l => l.phone).length} avec numéro
                </p>
              </div>
              <button onClick={() => setDiffusionEvent(null)} className="p-2 rounded-xl hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Aperçu du message */}
            <div className="px-6 py-3 bg-[#ece5dd]">
              <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {buildWaMessage(diffusionEvent)}
              </div>
            </div>

            {/* Liste parents */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {diffusionLinks.length === 0 ? (
                <p className="text-center text-slate-400 text-sm p-8">Aucun élève actif correspondant aux niveaux ciblés.</p>
              ) : diffusionLinks.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.nom}</p>
                    <p className="text-xs text-slate-400">{l.phone || <span className="text-rose-400">Sans numéro</span>}</p>
                  </div>
                  <a
                    href={l.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => !l.link && e.preventDefault()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                      ${l.link ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                  >
                    <ExternalLink size={11} /> Envoyer
                  </a>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5" />
                Cliquez sur "Envoyer" pour chaque parent. WhatsApp s'ouvre avec le message pré-rempli.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDiffusionEvent(null)} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">Fermer</button>
                <button
                  onClick={handleConfirmDiffusion}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                >
                  <CheckCircle2 size={14} /> Marquer comme diffusé
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evenements;
