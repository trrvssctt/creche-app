import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare, Phone, Send, Edit3, Eye, X,
  Search, RefreshCw, Copy, ExternalLink,
  Users, Clock, FileText, Bell, AlertCircle, CheckCircle2,
  Save, Loader2, BookOpen, Calendar, History,
  Zap, ChevronRight, Trash2, Info, GraduationCap,
  Baby, MessageCircle, CheckSquare, SquareDot
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { User, NiveauScolaire } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

type TemplateId =
  | 'RECU_PROVISOIRE'
  | 'RECU_DEFINITIF'
  | 'FACTURE_MENSUELLE'
  | 'RELANCE'
  | 'BULLETIN'
  | 'ADMISSION_CONFIRMEE'
  | 'RETARD_GARDE';

interface Template {
  id: TemplateId;
  label: string;
  description: string;
  color: string;
  icon: string;
  body: string;
  variables: string[];
}

interface HistoriqueEntry {
  id: string;
  timestamp: string;
  templateId: TemplateId;
  templateLabel: string;
  eleveNom: string;
  niveau: string;
  phone: string;
  messagePreview: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche',
  PS: 'Petite Section',
  MS: 'Moyenne Section',
  GS: 'Grande Section',
  CP: 'CP',
  CE1: 'CE1',
  CE2: 'CE2',
  CM1: 'CM1',
  CM2: 'CM2',
};

const NIVEAUX_OPTIONS = Object.entries(NIVEAUX_LABELS).map(([value, label]) => ({ value, label }));

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const NOM_ECOLE = 'Le Toit des Anges';

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'RECU_PROVISOIRE',
    label: 'Reçu provisoire',
    description: 'Paiement partiel reçu — solde restant dû',
    color: 'amber',
    icon: '💰',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant_recu', 'solde_restant', 'date_limite'],
    body: `Bonjour {prenom_parent},

Nous accusons réception de votre paiement partiel pour *{prenom_enfant} {nom_enfant}* ({niveau}).

💰 Montant reçu : *{montant_recu} FCFA*
💳 Solde restant : *{solde_restant} FCFA*
📅 À régler avant le : {date_limite}

Merci de régulariser le solde avant la date limite.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'RECU_DEFINITIF',
    label: 'Reçu définitif',
    description: 'Paiement complet soldé',
    color: 'emerald',
    icon: '✅',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois', 'numero_recu'],
    body: `Bonjour {prenom_parent},

Nous confirmons le règlement *complet* des frais de scolarité de *{prenom_enfant} {nom_enfant}* ({niveau}) pour le mois de *{mois}*.

✅ Montant total payé : *{montant} FCFA*
📋 N° Reçu : {numero_recu}

Merci de votre confiance. Bonne continuation !
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'FACTURE_MENSUELLE',
    label: 'Facture mensuelle',
    description: 'Envoi de la facture (20–23 du mois)',
    color: 'blue',
    icon: '📄',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois', 'date_limite'],
    body: `Bonjour {prenom_parent},

Nous vous adressons la facture de scolarité du mois de *{mois}* pour *{prenom_enfant} {nom_enfant}* ({niveau}).

💰 Montant dû : *{montant} FCFA*
📅 Date limite de paiement : *{date_limite}*

⚠️ Après le {date_limite}, une pénalité de *2 000 FCFA/jour* sera appliquée.

Merci de régulariser avant la date limite.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'RELANCE',
    label: 'Relance impayé',
    description: 'Rappel après dépassement de la date limite',
    color: 'rose',
    icon: '⚠️',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois', 'nb_jours_retard', 'penalite'],
    body: `Bonjour {prenom_parent},

Nous vous rappelons que les frais de scolarité de *{prenom_enfant} {nom_enfant}* ({niveau}) pour le mois de *{mois}* sont toujours en attente.

💰 Montant dû : *{montant} FCFA*
📅 Retard : *{nb_jours_retard} jour(s)*
⚠️ Pénalités : *{penalite} FCFA*

Merci de régulariser d'urgence ou de nous contacter au plus vite.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'BULLETIN',
    label: 'Bulletin disponible',
    description: 'Notification publication bulletin trimestriel',
    color: 'indigo',
    icon: '📊',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'trimestre', 'annee_scolaire'],
    body: `Bonjour {prenom_parent},

Le bulletin scolaire de *{prenom_enfant} {nom_enfant}* ({niveau}) pour le *{trimestre}* de l'année *{annee_scolaire}* est désormais disponible.

📊 Connectez-vous à l'application ou contactez l'école pour le consulter.

— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'ADMISSION_CONFIRMEE',
    label: 'Admission confirmée',
    description: 'Dossier d\'admission accepté',
    color: 'teal',
    icon: '🎉',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'annee_scolaire'],
    body: `Bonjour {prenom_parent},

Nous avons le plaisir de vous informer que la demande d'admission de *{prenom_enfant} {nom_enfant}* en *{niveau}* pour l'année scolaire *{annee_scolaire}* a été *acceptée* ✅

📋 Merci de vous présenter à l'école pour finaliser le dossier et régler les frais d'inscription.

Bienvenue dans la famille ${NOM_ECOLE} ! 🏫
— La Direction`,
  },
  {
    id: 'RETARD_GARDE',
    label: 'Retard de garde',
    description: 'Pénalité de retard de récupération enfant',
    color: 'orange',
    icon: '⏰',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'heure_arrivee', 'nb_heures_retard', 'penalite'],
    body: `Bonjour {prenom_parent},

Nous vous informons que *{prenom_enfant} {nom_enfant}* a été récupéré(e) à *{heure_arrivee}*, soit *{nb_heures_retard} heure(s)* après l'heure de fermeture.

⏰ Retard : {nb_heures_retard} h
💰 Pénalité appliquée : *{penalite} FCFA* (2 500 FCFA/heure)

Ce montant sera ajouté à votre prochaine facture.
— ${NOM_ECOLE} 🏫`,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const LS_TEMPLATES_KEY = 'wa_templates';
const LS_HISTORIQUE_KEY = 'wa_historique';

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const saved: Partial<Record<TemplateId, string>> = JSON.parse(raw);
    return DEFAULT_TEMPLATES.map(t => ({
      ...t,
      body: saved[t.id] ?? t.body,
    }));
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveTemplateBody(id: TemplateId, body: string) {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    saved[id] = body;
    localStorage.setItem(LS_TEMPLATES_KEY, JSON.stringify(saved));
  } catch {}
}

function resetTemplateBody(id: TemplateId) {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    delete saved[id];
    localStorage.setItem(LS_TEMPLATES_KEY, JSON.stringify(saved));
  } catch {}
}

function loadHistorique(): HistoriqueEntry[] {
  try {
    const raw = localStorage.getItem(LS_HISTORIQUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistorique(entries: HistoriqueEntry[]) {
  try {
    localStorage.setItem(LS_HISTORIQUE_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch {}
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function buildWaLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('0') ? '221' + clean.slice(1) : clean.startsWith('221') ? clean : '221' + clean;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const COLOR_MAP: Record<string, { badge: string; dot: string; bg: string; border: string }> = {
  amber:   { badge: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  emerald: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-400', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  blue:    { badge: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-400',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  rose:    { badge: 'bg-rose-100 text-rose-800',     dot: 'bg-rose-400',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  teal:    { badge: 'bg-teal-100 text-teal-800',     dot: 'bg-teal-400',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  orange:  { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-400',  bg: 'bg-orange-50',  border: 'border-orange-200' },
};

// ─── Sample vars for preview ──────────────────────────────────────────────────

const SAMPLE_VARS: Record<string, string> = {
  prenom_parent: 'Mme Diallo',
  prenom_enfant: 'Amina',
  nom_enfant: 'Diallo',
  niveau: 'PS',
  montant: '90 000',
  montant_recu: '45 000',
  solde_restant: '45 000',
  mois: 'Mai 2026',
  date_limite: '05/06/2026',
  nb_jours_retard: '3',
  penalite: '6 000',
  trimestre: 'Trimestre 2',
  annee_scolaire: '2025-2026',
  numero_recu: 'RC-2026-0042',
  heure_arrivee: '18h30',
  nb_heures_retard: '1.5',
};

// ─── Composant principal ──────────────────────────────────────────────────────

const WhatsApp: React.FC<{ user: User }> = ({ user }) => {
  const showToast = useToast();
  const canSend = authBridge.canPerform(user, 'EDIT', 'whatsapp');

  const [activeTab, setActiveTab] = useState<'templates' | 'envoyer' | 'historique' | 'groupe'>('templates');
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [historique, setHistorique] = useState<HistoriqueEntry[]>(loadHistorique);

  // --- état onglet Templates
  const [editingId, setEditingId] = useState<TemplateId | null>(null);
  const [editBody, setEditBody] = useState('');
  const [previewId, setPreviewId] = useState<TemplateId | null>(null);

  // --- état onglet Envoyer
  const [eleves, setEleves] = useState<any[]>([]);
  const [loadingEleves, setLoadingEleves] = useState(false);
  const [searchEleve, setSearchEleve] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null);
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // --- état onglet Envoi groupé
  const [groupeTemplateId, setGroupeTemplateId] = useState<TemplateId>('FACTURE_MENSUELLE');
  const [groupeNiveau, setGroupeNiveau] = useState('ALL');
  const [groupeVars, setGroupeVars] = useState<Record<string, string>>({
    mois: MOIS_LABELS[new Date().getMonth()],
    date_limite: `05/${String(new Date().getMonth() + 2).padStart(2, '0')}/${new Date().getFullYear()}`,
    montant: '',
    trimestre: 'Trimestre 1',
    annee_scolaire: '2025-2026',
  });
  const [groupeResult, setGroupeResult] = useState<{ nom: string; phone: string; link: string }[]>([]);
  const [groupeGenerated, setGroupeGenerated] = useState(false);

  // ── Charger élèves ───────────────────────────────────────────────────────

  const fetchEleves = useCallback(async () => {
    setLoadingEleves(true);
    try {
      const data = await apiClient.get('/customers');
      setEleves(data || []);
    } catch {
      showToast('Impossible de charger les élèves.', 'error');
    } finally {
      setLoadingEleves(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'envoyer' || activeTab === 'groupe') fetchEleves();
  }, [activeTab, fetchEleves]);

  // ── Template sélectionné ─────────────────────────────────────────────────

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const groupeTemplate = useMemo(
    () => templates.find(t => t.id === groupeTemplateId) ?? null,
    [templates, groupeTemplateId]
  );

  // ── Vars auto depuis l'élève sélectionné ─────────────────────────────────

  const eleveVars = useMemo<Record<string, string>>(() => {
    if (!selectedEleve) return {};
    const nom = selectedEleve.companyName || selectedEleve.name || '';
    const parts = nom.trim().split(' ');
    const prenom = parts[0] ?? '';
    const nomFam = parts.slice(1).join(' ') || nom;
    const niveau = selectedEleve.niveau || selectedEleve.niveauScolaire || '';
    const parent1Prenom = selectedEleve.parent1Prenom || selectedEleve.mainContact?.split(' ')?.[0] || '';
    const parent1Nom = selectedEleve.parent1Nom || selectedEleve.mainContact?.split(' ')?.slice(1).join(' ') || '';
    return {
      prenom_enfant: prenom,
      nom_enfant: nomFam,
      niveau: NIVEAUX_LABELS[niveau] ?? niveau,
      prenom_parent: parent1Prenom ? `${parent1Prenom} ${parent1Nom}`.trim() : 'Parent',
    };
  }, [selectedEleve]);

  const mergedVars = useMemo(() => ({ ...eleveVars, ...customVars }), [eleveVars, customVars]);

  const renderedMessage = useMemo(() => {
    if (!selectedTemplate) return '';
    return renderTemplate(selectedTemplate.body, mergedVars);
  }, [selectedTemplate, mergedVars]);

  const elevePhone = useMemo(() => {
    if (!selectedEleve) return '';
    return selectedEleve.parent1Whatsapp || selectedEleve.parent1Tel ||
      selectedEleve.phone || selectedEleve.contact || '';
  }, [selectedEleve]);

  // ── Filtres élèves ────────────────────────────────────────────────────────

  const filteredEleves = useMemo(() => {
    const q = searchEleve.toLowerCase();
    return eleves.filter(e => {
      const nom = (e.companyName || e.name || '').toLowerCase();
      return nom.includes(q);
    });
  }, [eleves, searchEleve]);

  // ── Handlers Templates ────────────────────────────────────────────────────

  const handleStartEdit = (t: Template) => {
    setEditingId(t.id);
    setEditBody(t.body);
    setPreviewId(null);
  };

  const handleSaveTemplate = () => {
    if (!editingId) return;
    saveTemplateBody(editingId, editBody);
    setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, body: editBody } : t));
    setEditingId(null);
    showToast('Modèle sauvegardé.', 'success');
  };

  const handleResetTemplate = (id: TemplateId) => {
    const def = DEFAULT_TEMPLATES.find(t => t.id === id);
    if (!def) return;
    resetTemplateBody(id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, body: def.body } : t));
    if (editingId === id) { setEditBody(def.body); }
    showToast('Modèle réinitialisé.', 'info');
  };

  // ── Handler Envoyer ────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!selectedEleve || !selectedTemplate || !elevePhone) return;
    setSending(true);
    const link = buildWaLink(elevePhone, renderedMessage);
    window.open(link, '_blank', 'noopener,noreferrer');

    const entry: HistoriqueEntry = {
      id: genId(),
      timestamp: new Date().toISOString(),
      templateId: selectedTemplate.id,
      templateLabel: selectedTemplate.label,
      eleveNom: (selectedEleve.companyName || selectedEleve.name || 'Élève'),
      niveau: selectedEleve.niveau || selectedEleve.niveauScolaire || '',
      phone: elevePhone,
      messagePreview: renderedMessage.slice(0, 120),
    };
    const newHisto = [entry, ...historique];
    setHistorique(newHisto);
    saveHistorique(newHisto);

    setSending(false);
    showToast(`Message ouvert dans WhatsApp pour ${entry.eleveNom}.`, 'success');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(renderedMessage).then(() => showToast('Message copié.', 'success'));
  };

  // ── Handler Envoi groupé ──────────────────────────────────────────────────

  const handleGenerateGroupe = () => {
    const tmpl = groupeTemplate;
    if (!tmpl) return;

    const cibles = eleves.filter(e => {
      const statut = e.statut || e.status || 'ACTIF';
      const actif = statut === 'ACTIF' || e.isActive || e.is_active;
      if (!actif) return false;
      if (groupeNiveau !== 'ALL') {
        const niv = e.niveau || e.niveauScolaire || '';
        if (niv !== groupeNiveau) return false;
      }
      return true;
    });

    const results = cibles.map(e => {
      const nom = e.companyName || e.name || '';
      const parts = nom.trim().split(' ');
      const prenom = parts[0] ?? '';
      const nomFam = parts.slice(1).join(' ') || nom;
      const niveau = e.niveau || e.niveauScolaire || '';
      const parent1Prenom = e.parent1Prenom || e.mainContact?.split(' ')?.[0] || '';
      const parent1Nom = e.parent1Nom || e.mainContact?.split(' ')?.slice(1).join(' ') || '';

      const vars: Record<string, string> = {
        prenom_enfant: prenom,
        nom_enfant: nomFam,
        niveau: NIVEAUX_LABELS[niveau] ?? niveau,
        prenom_parent: parent1Prenom ? `${parent1Prenom} ${parent1Nom}`.trim() : 'Parent',
        ...groupeVars,
      };
      const message = renderTemplate(tmpl.body, vars);
      const phone = e.parent1Whatsapp || e.parent1Tel || e.phone || e.contact || '';
      return { nom, phone, link: phone ? buildWaLink(phone, message) : '' };
    });

    setGroupeResult(results);
    setGroupeGenerated(true);
    showToast(`${results.length} lien(s) WhatsApp générés.`, 'success');
  };

  const handleSendGroupe = (entry: { nom: string; phone: string; link: string }) => {
    if (!entry.link) { showToast('Aucun numéro WhatsApp pour cet élève.', 'error'); return; }
    window.open(entry.link, '_blank', 'noopener,noreferrer');
  };

  const handleClearHistorique = () => {
    setHistorique([]);
    saveHistorique([]);
    showToast('Historique effacé.', 'info');
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const today = new Date().toDateString();
    const ceJour = historique.filter(h => new Date(h.timestamp).toDateString() === today).length;
    const total = historique.length;
    const avecPhone = eleves.filter(e => !!(e.parent1Whatsapp || e.parent1Tel || e.phone)).length;
    return { total, ceJour, avecPhone, templates: templates.length };
  }, [historique, eleves, templates]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const TAB_ITEMS = [
    { id: 'templates', label: 'Modèles', icon: FileText },
    { id: 'envoyer',   label: 'Envoyer', icon: Send },
    { id: 'groupe',    label: 'Envoi groupé', icon: Users },
    { id: 'historique',label: 'Historique', icon: History },
  ] as const;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-green-500 rounded-xl text-white">
              <MessageSquare size={22} />
            </span>
            Communication WhatsApp
          </h1>
          <p className="text-slate-500 text-sm mt-1">Modèles, envoi individuel &amp; groupé aux parents</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Modèles configurés', value: kpis.templates, color: 'bg-indigo-50 text-indigo-700', icon: FileText },
          { label: 'Messages envoyés', value: kpis.total, color: 'bg-slate-50 text-slate-700', icon: History },
          { label: "Envoyés aujourd'hui", value: kpis.ceJour, color: 'bg-green-50 text-green-700', icon: Send },
          { label: 'Parents avec WhatsApp', value: kpis.avecPhone, color: 'bg-blue-50 text-blue-700', icon: Phone },
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
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full">
        {TAB_ITEMS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all
              ${activeTab === t.id ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── ONGLET MODÈLES ──────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {editingId ? (
            /* Mode édition */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">
                  Modifier : {templates.find(t => t.id === editingId)?.label}
                </h2>
                <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
              <div className="p-4 grid md:grid-cols-2 gap-6">
                {/* Éditeur */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Corps du message</label>
                    <button
                      onClick={() => handleResetTemplate(editingId!)}
                      className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Réinitialiser
                    </button>
                  </div>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={14}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm font-mono text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {/* Variables disponibles */}
                  <div>
                    <p className="text-xs text-slate-400 mb-1 font-medium">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.find(t => t.id === editingId)?.variables.map(v => (
                        <button
                          key={v}
                          onClick={() => setEditBody(prev => prev + `{${v}}`)}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-green-100 hover:text-green-700 transition-colors"
                        >
                          {'{' + v + '}'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Prévisualisation */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Aperçu (données exemple)</p>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                    <div className="bg-white rounded-xl p-3 shadow-sm text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {renderTemplate(editBody, SAMPLE_VARS)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 flex justify-end gap-2">
                <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
                  Annuler
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                >
                  <Save size={15} /> Sauvegarder
                </button>
              </div>
            </div>
          ) : (
            /* Liste des modèles */
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map(t => {
                const c = COLOR_MAP[t.color] ?? COLOR_MAP.blue;
                const isPreview = previewId === t.id;
                return (
                  <div key={t.id} className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${c.border}`}>
                    <div className={`p-4 ${c.bg}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{t.icon}</span>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{t.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                          {t.id.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-white space-y-3">
                      {isPreview && (
                        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-100">
                          {renderTemplate(t.body, SAMPLE_VARS)}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewId(isPreview ? null : t.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <Eye size={13} /> {isPreview ? 'Masquer' : 'Aperçu'}
                        </button>
                        <button
                          onClick={() => handleStartEdit(t)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <Edit3 size={13} /> Modifier
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET ENVOYER ──────────────────────────────────────────────────── */}
      {activeTab === 'envoyer' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Colonne gauche : sélection élève + template */}
          <div className="lg:col-span-1 space-y-4">
            {/* Sélection élève */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <GraduationCap size={15} className="text-indigo-500" /> Sélectionner un élève
                </p>
              </div>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchEleve}
                    onChange={e => setSearchEleve(e.target.value)}
                    placeholder="Rechercher un élève..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loadingEleves ? (
                  <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
                ) : filteredEleves.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm p-6">Aucun élève trouvé</p>
                ) : (
                  filteredEleves.map(e => {
                    const nom = e.companyName || e.name || '';
                    const niveau = e.niveau || e.niveauScolaire || '';
                    const isSelected = selectedEleve?.id === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => { setSelectedEleve(e); setCustomVars({}); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors
                          ${isSelected ? 'bg-green-50 border-l-2 border-green-500' : ''}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{nom}</p>
                          <p className="text-xs text-slate-400">{NIVEAUX_LABELS[niveau] ?? niveau}</p>
                        </div>
                        {isSelected && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sélection modèle */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <FileText size={15} className="text-indigo-500" /> Choisir un modèle
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {templates.map(t => {
                  const c = COLOR_MAP[t.color] ?? COLOR_MAP.blue;
                  const isSelected = selectedTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setCustomVars({}); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors
                        ${isSelected ? 'bg-green-50 border-l-2 border-green-500' : ''}`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{t.label}</p>
                        <p className="text-xs text-slate-400 truncate">{t.description}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Colonne droite : variables + prévisualisation + envoi */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedEleve || !selectedTemplate ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <MessageSquare size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Sélectionnez un élève et un modèle</p>
                <p className="text-xs text-slate-400 mt-1">Le message sera pré-rempli automatiquement</p>
              </div>
            ) : (
              <>
                {/* Variables complémentaires */}
                {selectedTemplate.variables.filter(v => !eleveVars[v]).length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Compléter les variables</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTemplate.variables
                        .filter(v => !eleveVars[v])
                        .map(v => (
                          <div key={v}>
                            <label className="text-xs text-slate-500 font-medium mb-1 block">{'{' + v + '}'}</label>
                            <input
                              type="text"
                              value={customVars[v] ?? ''}
                              onChange={e => setCustomVars(prev => ({ ...prev, [v]: e.target.value }))}
                              placeholder={SAMPLE_VARS[v] ?? v}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Aperçu du message */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                        <Phone size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {selectedEleve.companyName || selectedEleve.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {elevePhone || <span className="text-rose-400 font-medium">Aucun numéro WhatsApp</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{selectedTemplate.icon} {selectedTemplate.label}</span>
                  </div>
                  <div className="p-4 bg-[#ece5dd]">
                    <div className="max-w-sm ml-auto bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{renderedMessage}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Copy size={15} /> Copier
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!elevePhone || sending}
                    title={!elevePhone ? 'Aucun numéro WhatsApp enregistré pour cet élève' : ''}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                    Ouvrir dans WhatsApp
                  </button>
                </div>
                {!elevePhone && (
                  <p className="text-xs text-rose-500 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Aucun numéro WhatsApp enregistré pour cet élève. Mettez à jour la fiche élève.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET ENVOI GROUPÉ ──────────────────────────────────────────────── */}
      {activeTab === 'groupe' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Paramètres */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              <p className="font-bold text-slate-800 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" /> Paramètres d'envoi groupé
              </p>

              {/* Modèle */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Modèle</label>
                <div className="space-y-2">
                  {templates
                    .filter(t => ['FACTURE_MENSUELLE', 'RELANCE', 'BULLETIN', 'RECU_PROVISOIRE'].includes(t.id))
                    .map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setGroupeTemplateId(t.id); setGroupeGenerated(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                          ${groupeTemplateId === t.id ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className="text-xl">{t.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                          <p className="text-xs text-slate-400">{t.description}</p>
                        </div>
                        {groupeTemplateId === t.id && <CheckCircle2 size={15} className="text-green-500 ml-auto shrink-0" />}
                      </button>
                    ))}
                </div>
              </div>

              {/* Filtre niveau */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Filtrer par niveau</label>
                <select
                  value={groupeNiveau}
                  onChange={e => { setGroupeNiveau(e.target.value); setGroupeGenerated(false); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">Tous les niveaux</option>
                  {NIVEAUX_OPTIONS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>

              {/* Variables communes */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Variables communes</label>
                <div className="space-y-2">
                  {groupeTemplate?.variables
                    .filter(v => !['prenom_enfant', 'nom_enfant', 'prenom_parent', 'niveau'].includes(v))
                    .map(v => (
                      <div key={v} className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 font-mono w-28 shrink-0">{'{' + v + '}'}</label>
                        <input
                          type="text"
                          value={groupeVars[v] ?? ''}
                          onChange={e => { setGroupeVars(prev => ({ ...prev, [v]: e.target.value })); setGroupeGenerated(false); }}
                          placeholder={SAMPLE_VARS[v] ?? ''}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    ))}
                </div>
              </div>

              <button
                onClick={handleGenerateGroupe}
                disabled={loadingEleves}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {loadingEleves ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Générer les liens
              </button>
            </div>

            {/* Résultats */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <p className="font-bold text-slate-800 text-sm">
                  {groupeGenerated ? `${groupeResult.length} élève(s) ciblé(s)` : 'Résultats'}
                </p>
                {groupeGenerated && (
                  <span className="text-xs text-slate-400">
                    {groupeResult.filter(r => r.phone).length} avec numéro
                  </span>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {!groupeGenerated ? (
                  <div className="p-10 text-center">
                    <Users size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-400">Configurez les paramètres puis cliquez sur Générer</p>
                  </div>
                ) : groupeResult.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm text-slate-400">Aucun élève actif correspondant.</p>
                  </div>
                ) : (
                  groupeResult.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.nom}</p>
                        <p className="text-xs text-slate-400">{r.phone || <span className="text-rose-400">Sans numéro</span>}</p>
                      </div>
                      <button
                        onClick={() => handleSendGroupe(r)}
                        disabled={!r.phone}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send size={12} /> Envoyer
                      </button>
                    </div>
                  ))
                )}
              </div>
              {groupeGenerated && groupeResult.length > 0 && (
                <div className="p-3 border-t border-slate-100 bg-amber-50">
                  <p className="text-xs text-amber-700 flex items-start gap-1.5">
                    <Info size={12} className="shrink-0 mt-0.5" />
                    Chaque clic "Envoyer" ouvre WhatsApp dans un nouvel onglet avec le message pré-rempli. Envoyez-les un à un.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ONGLET HISTORIQUE ────────────────────────────────────────────────── */}
      {activeTab === 'historique' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-slate-800 flex items-center gap-2">
              <History size={16} /> Historique des messages ({historique.length})
            </p>
            {historique.length > 0 && (
              <button
                onClick={handleClearHistorique}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 font-medium"
              >
                <Trash2 size={13} /> Tout effacer
              </button>
            )}
          </div>

          {historique.length === 0 ? (
            <div className="p-16 text-center">
              <History size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Aucun message envoyé pour l'instant</p>
              <p className="text-xs text-slate-400 mt-1">L'historique s'affiche ici après chaque envoi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historique.map(h => {
                const tmpl = templates.find(t => t.id === h.templateId);
                const c = tmpl ? COLOR_MAP[tmpl.color] : COLOR_MAP.blue;
                return (
                  <div key={h.id} className="px-5 py-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{tmpl?.icon ?? '💬'}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800">{h.eleveNom}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c?.badge}`}>
                              {h.templateLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {NIVEAUX_LABELS[h.niveau] ?? h.niveau} · {h.phone}
                          </p>
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 italic">
                            "{h.messagePreview}…"
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">{formatDateTime(h.timestamp)}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 text-emerald-600">
                          <CheckCircle2 size={12} />
                          <span className="text-xs font-medium">Ouvert</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsApp;
