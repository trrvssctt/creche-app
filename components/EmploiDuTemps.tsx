import React, { useState, useMemo } from 'react';
import {
  CalendarDays, BookOpen, Edit3, Save, X, Plus, Trash2,
  ChevronLeft, ChevronRight, MessageCircle, Send, Copy, Check, Printer,
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { useToast } from './ToastProvider';
import { User } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type NiveauScolaire = 'CRECHE' | 'PS' | 'MS' | 'GS' | 'CP' | 'CE1' | 'CE2' | 'CM1' | 'CM2';

interface Creneau {
  id: string;
  jour: number;        // 0=Lun … 4=Ven
  heureDebut: string;  // "08:00"
  heureFin: string;    // "09:00"
  matiere: string;
  enseignant: string;
  couleur: string;
}

interface CahierEntry {
  id: string;
  date: string;       // ISO YYYY-MM-DD
  niveau: NiveauScolaire;
  matiere: string;
  contenu: string;
  devoirs: string;
  auteur: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: string }[] = [
  { value: 'CRECHE', label: 'Crèche',         cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',  cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section', cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',  cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',              cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',             cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',             cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',             cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',             cycle: 'Élémentaire' },
];

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const CRENEAUX_HORAIRES = [
  '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:15', '10:30',
  '11:00', '11:15', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

const MATIERES_PAR_NIVEAU: Record<NiveauScolaire, string[]> = {
  CRECHE: ['Éveil sensoriel', 'Motricité', 'Langage', 'Sieste', 'Activités libres', 'Repas', 'Accueil'],
  PS:    ['Langage', 'Motricité fine', 'Motricité globale', 'Arts plastiques', 'Musique', 'Éveil', 'Sieste', 'Récréation'],
  MS:    ['Langage', 'Graphisme', 'Mathématiques', 'Arts plastiques', 'Musique', 'Éveil scientifique', 'Sieste', 'Récréation'],
  GS:    ['Langage', 'Lecture préparatoire', 'Mathématiques', 'Arts plastiques', 'Musique', 'Éveil', 'Récréation'],
  CP:    ['Français', 'Mathématiques', 'Lecture', 'Écriture', 'Sciences', 'Sport', 'Morale / Civisme', 'Récréation'],
  CE1:   ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géographie', 'Anglais', 'Sport', 'Arts', 'Récréation'],
  CE2:   ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géographie', 'Anglais', 'Sport', 'Arts', 'Récréation'],
  CM1:   ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géographie', 'Anglais', 'Sport', 'Informatique', 'Récréation'],
  CM2:   ['Français', 'Mathématiques', 'Sciences', 'Histoire-Géographie', 'Anglais', 'Sport', 'Informatique', 'Récréation'],
};

const COULEURS_MATIERES = [
  { label: 'Bleu',   value: 'blue',    bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300' },
  { label: 'Vert',   value: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { label: 'Violet', value: 'violet',  bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-300' },
  { label: 'Orange', value: 'amber',   bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300' },
  { label: 'Rose',   value: 'pink',    bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-300' },
  { label: 'Teal',   value: 'teal',    bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300' },
  { label: 'Gris',   value: 'slate',   bg: 'bg-slate-100',   text: 'text-slate-800',   border: 'border-slate-300' },
];

// ─── Storage (v2 : clé par semaine) ──────────────────────────────────────────

const LS_EDT_KEY    = 'edt_creneaux_v2';
const LS_CAHIER_KEY = 'cahier_entries';

function edtStorageKey(niveau: string, week: string): string {
  return `${niveau}__${week}`;
}

function loadEdt(): Record<string, Creneau[]> {
  try {
    const raw = localStorage.getItem(LS_EDT_KEY);
    if (raw) return JSON.parse(raw);
    // Migration depuis v1 (sans semaine) → semaine courante
    const legacyRaw = localStorage.getItem('edt_creneaux');
    if (legacyRaw) {
      const legacy: Record<string, Creneau[]> = JSON.parse(legacyRaw);
      const week = startOfWeek(isoToday());
      const migrated: Record<string, Creneau[]> = {};
      Object.entries(legacy).forEach(([niveau, creneaux]) => {
        if (Array.isArray(creneaux) && creneaux.length > 0)
          migrated[edtStorageKey(niveau, week)] = creneaux;
      });
      localStorage.setItem(LS_EDT_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch { return {}; }
}

function saveEdt(data: Record<string, Creneau[]>) {
  try { localStorage.setItem(LS_EDT_KEY, JSON.stringify(data)); } catch {}
}

function loadCahier(): CahierEntry[] {
  try {
    const raw = localStorage.getItem(LS_CAHIER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCahier(data: CahierEntry[]) {
  try { localStorage.setItem(LS_CAHIER_KEY, JSON.stringify(data)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function isoToday(): string { return new Date().toISOString().split('T')[0]; }

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatLongWeek(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function startOfWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getCouleur(v: string) {
  return COULEURS_MATIERES.find(c => c.value === v) ?? COULEURS_MATIERES[0];
}

function getNiveauInfo(v: NiveauScolaire) {
  return NIVEAUX.find(n => n.value === v) ?? NIVEAUX[0];
}

function generateEdtText(niveau: NiveauScolaire, week: string, creneaux: Creneau[]): string {
  const niveauLabel = getNiveauInfo(niveau).label;
  const weekEnd = addDays(week, 4);
  const byDay: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  creneaux.forEach(c => {
    byDay[c.jour] = [...(byDay[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  });
  const body = JOURS.map((jour, i) => {
    const list = byDay[i] || [];
    if (!list.length) return null;
    const lines = list.map(c =>
      `  • ${c.heureDebut}–${c.heureFin} : ${c.matiere}${c.enseignant ? ` (${c.enseignant})` : ''}`
    ).join('\n');
    return `*${jour}*\n${lines}`;
  }).filter(Boolean).join('\n\n');

  return (
    `🏫 *LE TOIT DES ANGES*\n` +
    `📚 Emploi du Temps — ${niveauLabel}\n` +
    `📅 Semaine du ${formatShortDate(week)} au ${formatShortDate(weekEnd)}\n\n` +
    (body || '— Aucun créneau cette semaine —') +
    `\n\n_Le Toit des Anges — +221 33 820 00 00_`
  );
}

function buildPrintHtml(
  niveau: NiveauScolaire,
  week: string,
  creneaux: Creneau[],
): string {
  const niveauLabel = getNiveauInfo(niveau).label;
  const weekEnd = addDays(week, 4);
  const byDay: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  creneaux.forEach(c => {
    byDay[c.jour] = [...(byDay[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  });

  const cols = JOURS.map((j, i) =>
    `<th>${j}<br><small>${formatShortDate(addDays(week, i))}</small></th>`
  ).join('');

  const cells = [0, 1, 2, 3, 4].map(i => {
    const list = byDay[i] || [];
    if (!list.length) return '<td style="color:#ccc;text-align:center">—</td>';
    const items = list.map(c =>
      `<div class="cr"><strong>${c.matiere}</strong>` +
      `<span>${c.heureDebut}–${c.heureFin}${c.enseignant ? ' · ' + c.enseignant : ''}</span></div>`
    ).join('');
    return `<td>${items}</td>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>EDT ${niveauLabel}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:10pt;margin:15mm}
    h1{font-size:14pt;text-align:center;margin-bottom:4px}
    .sub{text-align:center;font-size:11pt;color:#555;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:#e2e8f0;padding:8px;font-size:9pt;text-align:center;border:1px solid #cbd5e1}
    th small{font-weight:normal;color:#64748b}
    td{padding:5px 6px;border:1px solid #e2e8f0;vertical-align:top;min-height:20px}
    .cr{margin-bottom:5px;padding:3px 5px;background:#f0fdf4;border-left:3px solid #16a34a}
    .cr strong{display:block;font-size:9pt}
    .cr span{color:#64748b;font-size:8pt}
    .footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:14px}
    @media print{body{margin:10mm}}
  </style></head><body>
  <h1>🏫 Le Toit des Anges</h1>
  <div class="sub">Emploi du Temps — ${niveauLabel}</div>
  <div class="sub">Semaine du ${formatShortDate(week)} au ${formatShortDate(weekEnd)}</div>
  <table>
    <tr>${cols}</tr>
    <tr>${cells}</tr>
  </table>
  <div class="footer">Le Toit des Anges — +221 33 820 00 00 — Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
  </body></html>`;
}

const emptyForm = (niveau: NiveauScolaire): Omit<Creneau, 'id'> => ({
  jour: 0,
  heureDebut: '08:00',
  heureFin: '09:00',
  matiere: MATIERES_PAR_NIVEAU[niveau][0] ?? '',
  enseignant: '',
  couleur: 'blue',
});

// ─── Composant principal ──────────────────────────────────────────────────────

const EmploiDuTemps: React.FC<{ user: User }> = ({ user }) => {
  const showToast = useToast();
  const canModify = authBridge.canPerform(user, 'EDIT', 'emploi-temps');

  const [activeTab, setActiveTab] = useState<'edt' | 'cahier'>('edt');

  // -- EDT
  const [edtData, setEdtData] = useState<Record<string, Creneau[]>>(loadEdt);
  const [edtNiveau, setEdtNiveau] = useState<NiveauScolaire>('PS');
  const [edtWeek, setEdtWeek]   = useState(startOfWeek(isoToday()));
  const [editingCreneau, setEditingCreneau] = useState<Creneau | null>(null);
  const [form, setForm] = useState<Omit<Creneau, 'id'>>(emptyForm('PS'));
  const [showForm, setShowForm] = useState(false);

  // -- WhatsApp modal
  const [showWAModal, setShowWAModal] = useState(false);
  const [waPhone, setWaPhone]         = useState('');
  const [waText, setWaText]           = useState('');
  const [copied, setCopied]           = useState(false);

  // -- Cahier de texte
  const [cahierData, setCahierData]   = useState<CahierEntry[]>(loadCahier);
  const [cahierNiveau, setCahierNiveau] = useState<NiveauScolaire>('PS');
  const [cahierWeek, setCahierWeek]   = useState(startOfWeek(isoToday()));
  const [editingEntry, setEditingEntry] = useState<CahierEntry | null>(null);
  const [entryForm, setEntryForm]     = useState<Omit<CahierEntry, 'id'>>({
    date: isoToday(),
    niveau: 'PS',
    matiere: '',
    contenu: '',
    devoirs: '',
    auteur: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Enseignant(e)',
  });
  const [showEntryForm, setShowEntryForm] = useState(false);

  // ── EDT computed ────────────────────────────────────────────────────────────

  const currentEdtKey  = useMemo(() => edtStorageKey(edtNiveau, edtWeek), [edtNiveau, edtWeek]);
  const prevEdtKey     = useMemo(() => edtStorageKey(edtNiveau, addDays(edtWeek, -7)), [edtNiveau, edtWeek]);
  const creneauxNiveau = useMemo(() => edtData[currentEdtKey] || [], [edtData, currentEdtKey]);
  const hasPrevData    = useMemo(() => (edtData[prevEdtKey] || []).length > 0, [edtData, prevEdtKey]);

  const creneauxParJour = useMemo(() => {
    const map: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    creneauxNiveau.forEach(c => {
      map[c.jour] = [...(map[c.jour] || []), c].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    });
    return map;
  }, [creneauxNiveau]);

  const edtWeekDays  = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(edtWeek, i)), [edtWeek]);
  const todayWeek    = startOfWeek(isoToday());
  const isCurrentWeek = edtWeek === todayWeek;
  const isPastWeek    = edtWeek < todayWeek;

  // ── EDT handlers ────────────────────────────────────────────────────────────

  const handleOpenForm = (creneau?: Creneau) => {
    if (creneau) {
      setEditingCreneau(creneau);
      setForm({ jour: creneau.jour, heureDebut: creneau.heureDebut, heureFin: creneau.heureFin, matiere: creneau.matiere, enseignant: creneau.enseignant, couleur: creneau.couleur });
    } else {
      setEditingCreneau(null);
      setForm(emptyForm(edtNiveau));
    }
    setShowForm(true);
  };

  const handleSaveCreneau = () => {
    if (!form.matiere || !form.heureDebut || !form.heureFin) {
      showToast('Remplissez tous les champs obligatoires.', 'error');
      return;
    }
    const current = edtData[currentEdtKey] || [];
    const updated  = editingCreneau
      ? current.map(c => c.id === editingCreneau.id ? { ...form, id: editingCreneau.id } : c)
      : [...current, { ...form, id: genId() }];
    const newData = { ...edtData, [currentEdtKey]: updated };
    setEdtData(newData);
    saveEdt(newData);
    setShowForm(false);
    showToast(editingCreneau ? 'Créneau mis à jour.' : 'Créneau ajouté.', 'success');
  };

  const handleDeleteCreneau = (id: string) => {
    const updated = (edtData[currentEdtKey] || []).filter(c => c.id !== id);
    const newData = { ...edtData, [currentEdtKey]: updated };
    setEdtData(newData);
    saveEdt(newData);
    showToast('Créneau supprimé.', 'info');
  };

  const handleCopyFromPrevWeek = () => {
    const prevCreneaux = edtData[prevEdtKey] || [];
    if (!prevCreneaux.length) { showToast('Aucun créneau la semaine précédente.', 'info'); return; }
    const newCreneaux = prevCreneaux.map(c => ({ ...c, id: genId() }));
    const newData = { ...edtData, [currentEdtKey]: newCreneaux };
    setEdtData(newData);
    saveEdt(newData);
    showToast(`${newCreneaux.length} créneaux copiés depuis la semaine précédente.`, 'success');
  };

  const handleOpenWAModal = () => {
    setWaText(generateEdtText(edtNiveau, edtWeek, creneauxNiveau));
    setWaPhone('');
    setCopied(false);
    setShowWAModal(true);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Sélectionnez le texte manuellement pour le copier.', 'error');
    }
  };

  const handleOpenWhatsApp = () => {
    const phone = waPhone.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    const html = buildPrintHtml(edtNiveau, edtWeek, creneauxNiveau);
    const win  = window.open('', '_blank', 'noopener');
    if (!win) { showToast('Autorisez les popups pour imprimer.', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── Cahier helpers ─────────────────────────────────────────────────────────

  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(cahierWeek, i)), [cahierWeek]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, CahierEntry[]> = {};
    weekDays.forEach(d => { map[d] = []; });
    cahierData
      .filter(e => e.niveau === cahierNiveau && weekDays.includes(e.date))
      .forEach(e => { map[e.date] = [...(map[e.date] || []), e]; });
    return map;
  }, [cahierData, cahierNiveau, weekDays]);

  const handleOpenEntryForm = (date: string, entry?: CahierEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setEntryForm({ date: entry.date, niveau: entry.niveau, matiere: entry.matiere, contenu: entry.contenu, devoirs: entry.devoirs, auteur: entry.auteur });
    } else {
      setEditingEntry(null);
      setEntryForm({ date, niveau: cahierNiveau, matiere: MATIERES_PAR_NIVEAU[cahierNiveau][0] ?? '', contenu: '', devoirs: '', auteur: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Enseignant(e)' });
    }
    setShowEntryForm(true);
  };

  const handleSaveEntry = () => {
    if (!entryForm.matiere || !entryForm.contenu) { showToast('Remplissez la matière et le contenu.', 'error'); return; }
    const updated = editingEntry
      ? cahierData.map(e => e.id === editingEntry.id ? { ...entryForm, id: editingEntry.id } : e)
      : [...cahierData, { ...entryForm, id: genId() }];
    setCahierData(updated);
    saveCahier(updated);
    setShowEntryForm(false);
    showToast(editingEntry ? 'Entrée mise à jour.' : 'Entrée ajoutée au cahier.', 'success');
  };

  const handleDeleteEntry = (id: string) => {
    const updated = cahierData.filter(e => e.id !== id);
    setCahierData(updated);
    saveCahier(updated);
    showToast('Entrée supprimée.', 'info');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const niveauInfo = getNiveauInfo(edtNiveau);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Modal WhatsApp ──────────────────────────────────────────────────── */}
      {showWAModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowWAModal(false); }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-green-100 rounded-lg">
                  <MessageCircle size={18} className="text-green-600" />
                </span>
                <h3 className="font-bold text-slate-800">Envoyer l'emploi du temps</h3>
              </div>
              <button onClick={() => setShowWAModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Aperçu du message :</p>
              <textarea
                readOnly
                value={waText}
                rows={11}
                className="w-full text-xs font-mono bg-green-50 border border-green-200 rounded-xl p-3 resize-none text-slate-700"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Numéro du destinataire <span className="font-normal text-slate-400">(optionnel)</span>
              </label>
              <input
                value={waPhone}
                onChange={e => setWaPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Laissez vide pour choisir le contact directement dans WhatsApp
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyToClipboard}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all
                  ${copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copié !' : 'Copier le texte'}
              </button>
              <button
                onClick={handleOpenWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              >
                <Send size={14} /> Ouvrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <span className="p-2 bg-teal-600 rounded-xl text-white"><CalendarDays size={22} /></span>
          Emploi du Temps &amp; Cahier de Texte
        </h1>
        <p className="text-slate-500 text-sm mt-1">Planification des cours et journal pédagogique</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {([
          ['edt',    'Emploi du Temps', CalendarDays],
          ['cahier', 'Cahier de Texte', BookOpen],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all
              ${activeTab === id ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── ONGLET EMPLOI DU TEMPS ───────────────────────────────────────────── */}
      {activeTab === 'edt' && (
        <div className="space-y-5">

          {/* Sélecteur de niveau */}
          <div className="flex flex-wrap gap-2">
            {NIVEAUX.map(n => (
              <button
                key={n.value}
                onClick={() => { setEdtNiveau(n.value); setShowForm(false); setForm(emptyForm(n.value)); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all
                  ${edtNiveau === n.value
                    ? 'bg-teal-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {n.label}
              </button>
            ))}
          </div>

          {/* Navigation semaine + boutons d'action */}
          <div className="flex flex-wrap items-center justify-between gap-3">

            {/* Navigation semaine */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEdtWeek(addDays(edtWeek, -7)); setShowForm(false); }}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                title="Semaine précédente"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>

              <div className="text-center min-w-[210px]">
                <p className={`text-sm font-bold leading-tight ${isPastWeek ? 'text-slate-500' : 'text-slate-800'}`}>
                  {isPastWeek && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mr-1.5">
                      Archive
                    </span>
                  )}
                  Sem. du {formatLongWeek(edtWeek)}
                </p>
                {isCurrentWeek && (
                  <p className="text-[10px] text-teal-600 font-semibold mt-0.5">Semaine en cours</p>
                )}
              </div>

              <button
                onClick={() => { setEdtWeek(addDays(edtWeek, 7)); setShowForm(false); }}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                title="Semaine suivante"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>

              {!isCurrentWeek && (
                <button
                  onClick={() => { setEdtWeek(todayWeek); setShowForm(false); }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
                >
                  Aujourd'hui
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {creneauxNiveau.length > 0 && (
                <>
                  <button
                    onClick={handleOpenWAModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                    title="Envoyer aux parents / tuteurs"
                  >
                    <MessageCircle size={14} /> Envoyer
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                    title="Imprimer l'emploi du temps"
                  >
                    <Printer size={14} /> Imprimer
                  </button>
                </>
              )}
              {canModify && (
                <button
                  onClick={() => handleOpenForm()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                >
                  <Plus size={15} /> Ajouter un créneau
                </button>
              )}
            </div>
          </div>

          {/* Bannière "Copier depuis semaine précédente" */}
          {creneauxNiveau.length === 0 && hasPrevData && canModify && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-800">Cette semaine n'a pas encore de créneaux</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {(edtData[prevEdtKey] || []).length} créneaux disponibles la semaine précédente
                </p>
              </div>
              <button
                onClick={handleCopyFromPrevWeek}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shrink-0"
              >
                Copier depuis la semaine précédente
              </button>
            </div>
          )}

          {/* Formulaire créneau */}
          {showForm && canModify && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-800">
                  {editingCreneau ? 'Modifier le créneau' : 'Nouveau créneau'} — {niveauInfo.label}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    Sem. {formatShortDate(edtWeek)}–{formatShortDate(addDays(edtWeek, 4))}
                  </span>
                </p>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Jour *</label>
                  <select
                    value={form.jour}
                    onChange={e => setForm(f => ({ ...f, jour: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {JOURS.map((j, i) => (
                      <option key={j} value={i}>{j} — {formatShortDate(edtWeekDays[i])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Heure début *</label>
                  <select
                    value={form.heureDebut}
                    onChange={e => setForm(f => ({ ...f, heureDebut: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {CRENEAUX_HORAIRES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Heure fin *</label>
                  <select
                    value={form.heureFin}
                    onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {CRENEAUX_HORAIRES.filter(h => h > form.heureDebut).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Matière *</label>
                  <select
                    value={form.matiere}
                    onChange={e => setForm(f => ({ ...f, matiere: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {MATIERES_PAR_NIVEAU[edtNiveau].map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="__other__">Autre...</option>
                  </select>
                  {form.matiere === '__other__' && (
                    <input
                      placeholder="Nom de la matière"
                      onChange={e => setForm(f => ({ ...f, matiere: e.target.value }))}
                      className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Enseignant(e)</label>
                  <input
                    value={form.enseignant}
                    onChange={e => setForm(f => ({ ...f, enseignant: e.target.value }))}
                    placeholder="Nom de l'enseignant(e)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Couleur</label>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {COULEURS_MATIERES.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setForm(f => ({ ...f, couleur: c.value }))}
                        className={`w-6 h-6 rounded-full ${c.bg} border-2 transition-all ${form.couleur === c.value ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">
                  Annuler
                </button>
                <button
                  onClick={handleSaveCreneau}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                >
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* Grille EDT */}
          {creneauxNiveau.length === 0 && !showForm ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <CalendarDays size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                Aucun créneau pour {niveauInfo.label} — semaine du {formatShortDate(edtWeek)}
              </p>
              {canModify && (
                <p className="text-xs text-slate-400 mt-1">Cliquez sur "Ajouter un créneau" pour commencer</p>
              )}
            </div>
          ) : creneauxNiveau.length > 0 && (
            <div className={`bg-white rounded-2xl border overflow-hidden ${isPastWeek ? 'border-amber-200' : 'border-slate-200'}`}>
              {/* En-têtes avec dates */}
              <div className={`grid grid-cols-6 border-b ${isPastWeek ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
                <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Horaire</div>
                {JOURS.map((j, i) => (
                  <div key={j} className={`p-3 text-center border-l ${isPastWeek ? 'border-amber-100' : 'border-slate-200'}`}>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{j}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatShortDate(edtWeekDays[i])}</p>
                  </div>
                ))}
              </div>

              {/* Lignes horaires */}
              <div className="divide-y divide-slate-100">
                {CRENEAUX_HORAIRES.slice(0, -1).map(heure => {
                  const hasContent = (Object.values(creneauxParJour) as Creneau[][]).some(list =>
                    list.some(c => c.heureDebut <= heure && c.heureFin > heure)
                  );
                  if (!hasContent && CRENEAUX_HORAIRES.indexOf(heure) % 2 !== 0) return null;
                  return (
                    <div key={heure} className="grid grid-cols-6 min-h-[40px]">
                      <div className="px-3 py-2 text-xs text-slate-400 font-mono flex items-start pt-2">{heure}</div>
                      {[0, 1, 2, 3, 4].map(jour => {
                        const creneau = creneauxParJour[jour]?.find(c => c.heureDebut === heure);
                        if (!creneau) return <div key={jour} className="border-l border-slate-100 min-h-[40px]" />;
                        const col = getCouleur(creneau.couleur);
                        return (
                          <div key={jour} className={`border-l border-slate-100 p-2 ${col.bg} border-l-2 ${col.border}`}>
                            <p className={`text-xs font-bold ${col.text} leading-tight`}>{creneau.matiere}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{creneau.heureDebut}–{creneau.heureFin}</p>
                            {creneau.enseignant && (
                              <p className="text-[10px] text-slate-400 truncate">{creneau.enseignant}</p>
                            )}
                            {canModify && (
                              <div className="flex gap-1 mt-1">
                                <button onClick={() => handleOpenForm(creneau)} className="p-0.5 rounded hover:bg-white/60" title="Modifier">
                                  <Edit3 size={10} className="text-slate-500" />
                                </button>
                                <button onClick={() => handleDeleteCreneau(creneau.id)} className="p-0.5 rounded hover:bg-white/60" title="Supprimer">
                                  <Trash2 size={10} className="text-rose-400" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }).filter(Boolean)}
              </div>

              {/* Pied de grille — indicateur archive */}
              {isPastWeek && (
                <div className="p-3 bg-amber-50 border-t border-amber-100 text-center">
                  <p className="text-xs text-amber-600 font-medium">
                    📁 Semaine archivée — vous consultez un emploi du temps passé
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET CAHIER DE TEXTE ─────────────────────────────────────────── */}
      {activeTab === 'cahier' && (
        <div className="space-y-5">
          {/* Contrôles navigation semaine + niveau */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {NIVEAUX.map(n => (
                <button
                  key={n.value}
                  onClick={() => setCahierNiveau(n.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all
                    ${cahierNiveau === n.value ? 'bg-teal-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCahierWeek(addDays(cahierWeek, -7)); setShowEntryForm(false); }}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <div className="text-sm font-semibold text-slate-700 min-w-[180px] text-center">
                Semaine du {new Date(cahierWeek + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <button
                onClick={() => { setCahierWeek(addDays(cahierWeek, 7)); setShowEntryForm(false); }}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
              <button
                onClick={() => { setCahierWeek(startOfWeek(isoToday())); setShowEntryForm(false); }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                Aujourd'hui
              </button>
            </div>
          </div>

          {/* Formulaire entrée cahier */}
          {showEntryForm && canModify && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-800">
                  {editingEntry ? "Modifier l'entrée" : 'Nouvelle entrée'} — {formatDate(entryForm.date)}
                </p>
                <button onClick={() => setShowEntryForm(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Matière *</label>
                  <select
                    value={entryForm.matiere}
                    onChange={e => setEntryForm(f => ({ ...f, matiere: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {MATIERES_PAR_NIVEAU[cahierNiveau].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Auteur</label>
                  <input
                    value={entryForm.auteur}
                    onChange={e => setEntryForm(f => ({ ...f, auteur: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Contenu du cours *</label>
                  <textarea
                    rows={4}
                    value={entryForm.contenu}
                    onChange={e => setEntryForm(f => ({ ...f, contenu: e.target.value }))}
                    placeholder="Décrivez les notions abordées, les activités réalisées..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Devoirs / Leçons à apprendre</label>
                  <textarea
                    rows={2}
                    value={entryForm.devoirs}
                    onChange={e => setEntryForm(f => ({ ...f, devoirs: e.target.value }))}
                    placeholder="Indiquez les devoirs ou leçons pour la prochaine fois..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowEntryForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">Annuler</button>
                <button
                  onClick={handleSaveEntry}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                >
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* Vue semaine du cahier */}
          <div className="grid md:grid-cols-5 gap-3">
            {weekDays.map(date => {
              const entries = entriesByDay[date] || [];
              const isToday = date === isoToday();
              return (
                <div
                  key={date}
                  className={`bg-white rounded-2xl border overflow-hidden
                    ${isToday ? 'border-teal-400 ring-1 ring-teal-400' : 'border-slate-200'}`}
                >
                  <div className={`p-3 border-b text-center ${isToday ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-teal-700' : 'text-slate-600'}`}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-black ${isToday ? 'text-teal-800' : 'text-slate-800'}`}>
                      {new Date(date + 'T00:00:00').getDate()}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                    </p>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {entries.length === 0 && (
                      <p className="text-xs text-slate-300 text-center pt-4">—</p>
                    )}
                    {entries.map(entry => (
                      <div key={entry.id} className="bg-teal-50 border border-teal-100 rounded-xl p-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-bold text-teal-800 leading-tight">{entry.matiere}</p>
                          {canModify && (
                            <div className="flex gap-0.5 shrink-0">
                              <button onClick={() => handleOpenEntryForm(date, entry)} className="p-0.5 hover:bg-teal-100 rounded">
                                <Edit3 size={10} className="text-teal-600" />
                              </button>
                              <button onClick={() => handleDeleteEntry(entry.id)} className="p-0.5 hover:bg-rose-100 rounded">
                                <Trash2 size={10} className="text-rose-400" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1 line-clamp-3">{entry.contenu}</p>
                        {entry.devoirs && (
                          <p className="text-[10px] text-amber-700 mt-1">📝 {entry.devoirs}</p>
                        )}
                        <p className="text-[9px] text-slate-400 mt-1">{entry.auteur}</p>
                      </div>
                    ))}
                    {canModify && (
                      <button
                        onClick={() => handleOpenEntryForm(date)}
                        className="w-full text-center text-[10px] text-slate-300 hover:text-teal-500 py-1.5 border border-dashed border-slate-200 hover:border-teal-300 rounded-xl transition-colors"
                      >
                        + Ajouter
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Résumé de la semaine */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-2xl font-black text-slate-800">
                {weekDays.reduce((n, d) => n + (entriesByDay[d]?.length ?? 0), 0)}
              </p>
              <p className="text-xs text-slate-500">entrées cette semaine</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-700">
                {weekDays.reduce((n, d) => n + (entriesByDay[d]?.filter(e => e.devoirs).length ?? 0), 0)}
              </p>
              <p className="text-xs text-slate-500">avec devoirs</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-slate-400">
                {getNiveauInfo(cahierNiveau).label} · {getNiveauInfo(cahierNiveau).cycle}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploiDuTemps;
