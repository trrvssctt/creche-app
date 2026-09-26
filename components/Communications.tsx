import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Send, Users, MessageSquare, History, Eye, Search,
  AlertCircle, CheckCircle2, Clock, Loader2, X,
  Phone, RefreshCw, Smartphone, FileText, CheckCheck, UsersRound, Megaphone,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { whatsappService, WaMessage, WaGroup, WA_MESSAGE_STATUS_LABELS } from '../services/whatsappService';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';
import { User } from '../types';
import WhatsAppConnexion, { useWhatsAppStatus, WhatsAppStatusBadge } from './WhatsAppConnexion';

// ─── Types ─────────────────────────────────────────────────────────────────

interface EleveComm {
  id: string;
  nom: string;
  prenom: string;
  niveau: string;
  classeId: string;
  classeNom?: string;
  statut: string;
  parent1: { nom?: string; prenom?: string; tel?: string; whatsapp?: string; telephone?: string } | null;
  parent2: { nom?: string; prenom?: string; tel?: string; whatsapp?: string } | null;
  whatsappPrincipal: string | null;
}

interface Classe {
  id: string;
  nom: string;
  niveau: string;
}

interface PreviewResult {
  recipientCount: number;
  skippedCount: number;
  recipients: { eleveId: string; nom: string; niveau: string; classe: string; phone: string }[];
  skipped: { eleveId: string; nom: string; reason: string }[];
}

interface SendResult {
  success: boolean;
  logId: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

interface LogEntry {
  id: string;
  type: string;
  category: string;
  subject: string;
  body: string;
  targetType: string;
  targetNiveau: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
}

interface EditableVar {
  key: string;
  label: string;
  placeholder: string;
}

interface Template {
  id: string;
  type: string;
  label: string;
  icon: string;
  category: string;
  body: string;
  editableVars: EditableVar[];
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUTS_ELIGIBLE = ['INSCRIT', 'ADMIS', 'ACTIF'];

const NIVEAUX = [
  { value: 'CRECHE1', label: 'Crèche (3–12 mois)' },
  { value: 'CRECHE2', label: 'Crèche (12–18 mois)' },
  { value: 'TPS', label: 'Toute Petite Section' },
  { value: 'PS', label: 'Petite Section' },
  { value: 'MS', label: 'Moyenne Section' },
  { value: 'GS', label: 'Grande Section' },
  { value: 'CP', label: 'CP' },
  { value: 'CE1', label: 'CE1' },
  { value: 'CE2', label: 'CE2' },
  { value: 'CM1', label: 'CM1' },
  { value: 'CM2', label: 'CM2' },
];

const NIVEAUX_LABELS: Record<string, string> = Object.fromEntries(NIVEAUX.map(n => [n.value, n.label]));

const NOM_ECOLE = 'Le Toit des Anges';

const TEMPLATES: Template[] = [
  {
    id: 'BULLETIN', type: 'BULLETIN',
    label: 'Bulletin disponible', icon: '📊',
    category: 'PEDAGOGIQUE',
    body: `Bonjour {prenom_parent},\n\nLe bulletin de {prenom_enfant} {nom_enfant} ({niveau}) pour le {trimestre} est disponible.\n\nConnectez-vous au portail parent pour le consulter.\n— ${NOM_ECOLE}`,
    editableVars: [
      { key: 'trimestre', label: 'Trimestre', placeholder: '1er trimestre 2026-2027' },
    ],
  },
  {
    id: 'ANNONCE', type: 'ANNONCE',
    label: 'Annonce générale', icon: '📢',
    category: 'GENERAL',
    body: `Bonjour {prenom_parent},\n\n{contenu}\n\n— ${NOM_ECOLE}`,
    editableVars: [
      { key: 'contenu', label: 'Contenu de l\'annonce', placeholder: 'La rentrée scolaire est fixée au 6 octobre 2026...' },
    ],
  },
  {
    id: 'EVENEMENT', type: 'EVENEMENT',
    label: 'Événement', icon: '🎉',
    category: 'GENERAL',
    body: `Bonjour {prenom_parent},\n\n{contenu}\n\n— ${NOM_ECOLE}`,
    editableVars: [
      { key: 'contenu', label: 'Détails de l\'événement', placeholder: 'Journée portes ouvertes le samedi 15 novembre...' },
    ],
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Envoyé' },
  PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partiel' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Échoué' },
  SENDING: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'En cours' },
  PENDING: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'En attente' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function getElevePhone(e: EleveComm): string {
  return e.whatsappPrincipal || e.parent1?.whatsapp || e.parent1?.tel || e.parent1?.telephone || '';
}

function getParentDisplay(e: EleveComm): string {
  if (!e.parent1) return '—';
  return [e.parent1.prenom, e.parent1.nom].filter(Boolean).join(' ') || '—';
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function Communications({ user }: { user?: User }) {
  const showToast = useToast();
  const { annee: anneeScolaire } = useAnnee();

  // Liaison du numéro (QR, déliaison) : direction uniquement, comme côté API
  const currentUser = user || authBridge.getSession()?.user;
  const canManageWa = ['ADMIN', 'DIRECTEUR', 'SUPER_ADMIN'].some(
    r => currentUser?.roles?.includes(r as any) || currentUser?.role === r,
  );
  const wa = useWhatsAppStatus();
  const waReady = wa.status?.status === 'READY';

  const [activeTab, setActiveTab] = useState<'composer' | 'historique' | 'connexion'>('composer');
  const [historyView, setHistoryView] = useState<'campagnes' | 'messages'>('campagnes');
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waMessagesTotal, setWaMessagesTotal] = useState(0);
  const [eleves, setEleves] = useState<EleveComm[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Composer
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetType, setTargetType] = useState<'ALL' | 'NIVEAU' | 'CLASSE' | 'INDIVIDUEL' | 'GROUPE'>('ALL');

  // Groupes WhatsApp du compte lié
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState('');
  const [targetNiveau, setTargetNiveau] = useState('');
  const [targetClasseId, setTargetClasseId] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<EleveComm | null>(null);
  const [searchEleve, setSearchEleve] = useState('');
  const [varsValues, setVarsValues] = useState<Record<string, string>>({});

  // Preview / Send
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  // ── Chargement ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadEleves();
    loadClasses();
  }, [anneeScolaire]);

  useEffect(() => {
    if (activeTab === 'historique') loadLogs();
  }, [activeTab, logsPage]);

  // Premier affichage : si WhatsApp n'est pas lié, ouvrir directement l'onglet Connexion
  const [waChecked, setWaChecked] = useState(false);
  useEffect(() => {
    if (waChecked || !wa.status) return;
    setWaChecked(true);
    if (wa.status.status !== 'READY') setActiveTab('connexion');
  }, [wa.status, waChecked]);

  const loadWaMessages = useCallback(async () => {
    try {
      const data = await whatsappService.listMessages({ limit: 100 });
      setWaMessages(data.messages || []);
      setWaMessagesTotal(data.total || 0);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'historique') loadWaMessages();
  }, [activeTab, loadWaMessages]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const data = await whatsappService.listGroups();
      setGroups(data.groups || []);
      setGroupsLoaded(true);
    } catch (e: any) {
      setGroupsError(e?.message || 'Impossible de récupérer les groupes WhatsApp.');
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetType === 'GROUPE' && waReady && !groupsLoaded && !groupsLoading) loadGroups();
  }, [targetType, waReady, groupsLoaded, groupsLoading, loadGroups]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.toLowerCase().trim();
    return q ? groups.filter(g => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, groupSearch]);

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPreview(null);
    setShowPreview(false);
  };

  // Rafraîchir tant qu'un envoi est en cours (campagne SENDING ou message en file)
  useEffect(() => {
    if (activeTab !== 'historique') return;
    const busy = historyView === 'campagnes'
      ? logs.some(l => l.status === 'SENDING')
      : waMessages.some(m => m.status === 'QUEUED');
    if (!busy) return;
    const t = setInterval(() => (historyView === 'campagnes' ? loadLogs() : loadWaMessages()), 5000);
    return () => clearInterval(t);
  }, [activeTab, historyView, logs, waMessages, loadWaMessages]);

  const loadEleves = async () => {
    try {
      const res = await apiClient.get('/eleves', { params: { anneeScolaire } });
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setEleves(data);
    } catch { /* silently fail */ }
  };

  const loadClasses = async () => {
    try {
      const res = await apiClient.get('/classes');
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setClasses(data);
    } catch { /* silently fail */ }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/communications', { params: { page: logsPage, limit: 20 } });
      const data = res.data || res;
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  // ── Élèves éligibles (INSCRIT / ADMIS / ACTIF uniquement) ────────────────

  const eligibleEleves = useMemo(() =>
    eleves.filter(e => STATUTS_ELIGIBLE.includes(e.statut)),
  [eleves]);

  // ── Recherche élèves ─────────────────────────────────────────────────────

  const filteredEleves = useMemo(() => {
    const q = searchEleve.toLowerCase().trim();
    if (!q) return [];
    return eligibleEleves.filter(e => {
      if (!getElevePhone(e)) return false;
      const nomEnfant = `${e.prenom} ${e.nom}`.toLowerCase();
      const nomParent1 = `${e.parent1?.prenom || ''} ${e.parent1?.nom || ''}`.toLowerCase();
      const nomParent2 = `${e.parent2?.prenom || ''} ${e.parent2?.nom || ''}`.toLowerCase();
      const phone = getElevePhone(e);
      return nomEnfant.includes(q) || nomParent1.includes(q) || nomParent2.includes(q) || phone.includes(q);
    }).slice(0, 15);
  }, [eligibleEleves, searchEleve]);

  // ── Classe lookup ─────────────────────────────────────────────────────────

  const classeMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach(c => { map[c.id] = c.nom; });
    return map;
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (!targetNiveau) return classes;
    return classes.filter(c => c.niveau === targetNiveau);
  }, [classes, targetNiveau]);

  // ── Template sélection ───────────────────────────────────────────────────

  const handleSelectTemplate = (tmpl: Template) => {
    setSelectedTemplate(tmpl);
    const defaultVars: Record<string, string> = {};
    tmpl.editableVars.forEach(v => { defaultVars[v.key] = varsValues[v.key] || ''; });
    setVarsValues(defaultVars);
    setPreview(null);
    setShowPreview(false);
    setSendResult(null);
  };

  const handleSelectEleve = (e: EleveComm) => {
    setSelectedEleve(e);
    setSearchEleve(`${e.prenom} ${e.nom}`);
    setTargetType('INDIVIDUEL');
  };

  // ── Body rendu ───────────────────────────────────────────────────────────

  const renderedBody = useMemo(() => {
    if (!selectedTemplate) return '';
    const exampleEleve = selectedEleve || eligibleEleves[0];
    const parentPrenom = exampleEleve?.parent1?.prenom || '';
    const parentNom = exampleEleve?.parent1?.nom || '';
    const vars: Record<string, string> = {
      ...varsValues,
      prenom_enfant: exampleEleve?.prenom || 'Prénom',
      nom_enfant: exampleEleve?.nom || 'Nom',
      niveau: NIVEAUX_LABELS[exampleEleve?.niveau || ''] || exampleEleve?.niveau || 'Niveau',
      classe: (exampleEleve ? classeMap[exampleEleve.classeId] : '') || exampleEleve?.niveau || 'Classe',
      prenom_parent: targetType === 'GROUPE' ? 'à tous' : (parentPrenom ? `${parentPrenom} ${parentNom}`.trim() : 'Parent'),
    };
    return renderBody(selectedTemplate.body, vars);
  }, [selectedTemplate, selectedEleve, eligibleEleves, varsValues, classeMap, targetType]);

  // Un message de groupe n'est pas personnalisé : les modèles qui citent un enfant ne conviennent pas
  const templateNeedsChild = !!selectedTemplate && /\{(prenom_enfant|nom_enfant|niveau|classe)\}/.test(selectedTemplate.body);

  const bodyComplete = useMemo(() => {
    if (!selectedTemplate) return false;
    return selectedTemplate.editableVars.every(v => (varsValues[v.key] || '').trim().length > 0);
  }, [selectedTemplate, varsValues]);

  // ── Resolve final body (with vars injected) ──────────────────────────────

  const finalBody = useMemo(() => {
    if (!selectedTemplate) return '';
    return renderBody(selectedTemplate.body, varsValues);
  }, [selectedTemplate, varsValues]);

  // ── Preview (dry-run API) ─────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!selectedTemplate || !bodyComplete) {
      showToast('Veuillez sélectionner un template et remplir tous les champs.', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.post('/communications/preview', {
        type: selectedTemplate.type,
        category: selectedTemplate.category,
        body: finalBody,
        targetType,
        targetNiveau: targetType === 'NIVEAU' ? targetNiveau : undefined,
        targetClasseId: targetType === 'CLASSE' ? targetClasseId : undefined,
        targetEleveId: targetType === 'INDIVIDUEL' ? selectedEleve?.id : undefined,
        targetGroupIds: targetType === 'GROUPE' ? Array.from(selectedGroupIds) : undefined,
      });
      setPreview(res.data || res);
      setShowPreview(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || err.data?.message || 'Erreur prévisualisation.', 'error');
    } finally { setLoading(false); }
  };

  // ── Envoi WhatsApp ────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedTemplate || !bodyComplete) {
      showToast('Veuillez sélectionner un template et remplir tous les champs.', 'error');
      return;
    }
    try {
      setSending(true);
      const res = await apiClient.post('/communications/send', {
        type: selectedTemplate.type,
        category: selectedTemplate.category,
        subject: selectedTemplate.label,
        body: finalBody,
        targetType,
        targetNiveau: targetType === 'NIVEAU' ? targetNiveau : undefined,
        targetClasseId: targetType === 'CLASSE' ? targetClasseId : undefined,
        targetEleveId: targetType === 'INDIVIDUEL' ? selectedEleve?.id : undefined,
        targetGroupIds: targetType === 'GROUPE' ? Array.from(selectedGroupIds) : undefined,
        variables: varsValues,
      });
      const data = res.data || res;
      setSendResult(data);
      wa.refresh();
      if (data.queued && data.sent > 0) {
        showToast(`${data.sent} message(s) en cours d'envoi en arrière-plan — suivi dans l'historique.`, 'success');
      } else if (data.sent > 0) {
        showToast(`${data.sent} message(s) envoyé(s) avec succès.`, 'success');
      } else if (data.failed > 0) {
        const errDetail = data.details?.find((d: any) => d.error)?.error || 'Échec envoi WhatsApp';
        showToast(`Échec : ${errDetail}`, 'error');
      }
      setShowPreview(false);
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || err.data?.message || 'Erreur envoi.', 'error');
    } finally { setSending(false); }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetComposer = () => {
    setSelectedTemplate(null);
    setTargetType('ALL');
    setTargetNiveau('');
    setTargetClasseId('');
    setSelectedEleve(null);
    setSearchEleve('');
    setSelectedGroupIds(new Set());
    setGroupSearch('');
    setVarsValues({});
    setPreview(null);
    setShowPreview(false);
    setSendResult(null);
  };

  // ── KPIs (uniquement élèves éligibles) ────────────────────────────────────

  const kpis = useMemo(() => {
    const total = eligibleEleves.length;
    const avecPhone = eligibleEleves.filter(e => !!getElevePhone(e)).length;
    return { total, avecPhone, sansPhone: total - avecPhone };
  }, [eligibleEleves]);

  // ── Estimation locale des destinataires (avant vérification serveur) ─────

  const estimatedRecipients = useMemo(() => {
    const withPhone = eligibleEleves.filter(e => !!getElevePhone(e));
    switch (targetType) {
      case 'ALL': return withPhone.length;
      case 'NIVEAU': return targetNiveau ? withPhone.filter(e => e.niveau === targetNiveau).length : 0;
      case 'CLASSE': return targetClasseId ? withPhone.filter(e => e.classeId === targetClasseId).length : 0;
      case 'INDIVIDUEL': return selectedEleve ? 1 : 0;
      case 'GROUPE': return selectedGroupIds.size;
    }
  }, [eligibleEleves, targetType, targetNiveau, targetClasseId, selectedEleve, selectedGroupIds]);

  // ── Validation d'envoi ────────────────────────────────────────────────────

  const canSend = useMemo(() => {
    if (!selectedTemplate || !bodyComplete) return false;
    if (targetType === 'NIVEAU' && !targetNiveau) return false;
    if (targetType === 'CLASSE' && !targetClasseId) return false;
    if (targetType === 'INDIVIDUEL' && !selectedEleve) return false;
    if (targetType === 'GROUPE' && (selectedGroupIds.size === 0 || templateNeedsChild)) return false;
    return true;
  }, [selectedTemplate, bodyComplete, targetType, targetNiveau, targetClasseId, selectedEleve, selectedGroupIds, templateNeedsChild]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'composer' as const, label: 'Envoyer', icon: Send },
    { id: 'historique' as const, label: 'Historique', icon: History },
    { id: 'connexion' as const, label: 'Connexion WhatsApp', icon: Smartphone },
  ];

  const TARGETS = [
    { value: 'ALL', label: 'Tous' },
    { value: 'NIVEAU', label: 'Niveau' },
    { value: 'CLASSE', label: 'Classe' },
    { value: 'INDIVIDUEL', label: 'Un parent' },
    { value: 'GROUPE', label: 'Groupe' },
  ] as const;

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all';
  const dotCls = waReady ? 'bg-emerald-500' : wa.status ? 'bg-amber-500 animate-pulse' : 'bg-slate-300';

  return (
    <div className="space-y-4">
      {/* En-tête : titre + indicateurs sur une seule ligne */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-green-500 rounded-xl text-white"><MessageSquare size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Communications WhatsApp</h1>
            <p className="text-slate-500 text-xs">Messages aux parents, envoyés en arrière-plan depuis le numéro de l'établissement</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon={<Users size={13} />} value={kpis.total} label="inscrits" cls="bg-blue-50 text-blue-700" />
          <Chip icon={<Phone size={13} />} value={kpis.avecPhone} label="avec WhatsApp" cls="bg-green-50 text-green-700" />
          <Chip icon={<AlertCircle size={13} />} value={kpis.sansPhone} label="sans numéro" cls="bg-amber-50 text-amber-700" />
          <button onClick={() => setActiveTab('connexion')}>
            <WhatsAppStatusBadge status={wa.status} />
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="inline-flex gap-1 bg-slate-100 rounded-xl p-1 max-w-full overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={15} />{tab.label}
            {tab.id === 'connexion' && <span className={`w-2 h-2 rounded-full ${dotCls}`} />}
          </button>
        ))}
      </div>

      {wa.status && !waReady && activeTab !== 'connexion' && (
        <button onClick={() => setActiveTab('connexion')}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-left hover:bg-amber-100">
          <AlertCircle size={16} className="shrink-0" />
          WhatsApp n'est pas connecté : les messages ne partiront pas. Cliquez ici pour lier le téléphone de l'établissement.
        </button>
      )}

      {/* ═══ TAB CONNEXION ═══ */}
      {activeTab === 'connexion' && <WhatsAppConnexion canManage={canManageWa} wa={wa} />}

      {/* ═══ TAB ENVOYER ═══ */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          {/* Col gauche : message + destinataires dans une seule carte */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* 1. Message */}
            <section className="p-5 space-y-3">
              <StepTitle n={1} title="Message" />
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                      selectedTemplate?.id === tmpl.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    <span className="text-xl">{tmpl.icon}</span>
                    <span className="font-semibold text-xs sm:text-sm text-slate-800 leading-tight">{tmpl.label}</span>
                  </button>
                ))}
              </div>

              {selectedTemplate?.editableVars.map(v => (
                <div key={v.key}>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{v.label}</label>
                  {v.key === 'contenu' ? (
                    <textarea rows={4} value={varsValues[v.key] || ''} placeholder={v.placeholder}
                      onChange={e => setVarsValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                      className={`${inputCls} mt-1 resize-y`} />
                  ) : (
                    <input type="text" value={varsValues[v.key] || ''} placeholder={v.placeholder}
                      onChange={e => setVarsValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                      className={`${inputCls} mt-1`} />
                  )}
                </div>
              ))}
              {!selectedTemplate && (
                <p className="text-xs text-slate-400">Choisissez un type de message pour commencer.</p>
              )}
            </section>

            {/* 2. Destinataires */}
            <section className="p-5 space-y-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <StepTitle n={2} title="Destinataires" />
                <span className="text-xs text-slate-500">
                  {targetType === 'GROUPE'
                    ? <><b className="text-slate-800">{estimatedRecipients}</b> groupe(s) sélectionné(s)</>
                    : <>≈ <b className="text-slate-800">{estimatedRecipients}</b> parent(s) avec WhatsApp</>}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-slate-100 rounded-lg p-1">
                {TARGETS.map(opt => (
                  <button key={opt.value}
                    onClick={() => { setTargetType(opt.value); setSelectedEleve(null); setPreview(null); setShowPreview(false); }}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      targetType === opt.value ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {targetType === 'NIVEAU' && (
                <select value={targetNiveau} onChange={e => setTargetNiveau(e.target.value)} className={inputCls}>
                  <option value="">-- Sélectionner un niveau --</option>
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              )}

              {targetType === 'CLASSE' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <select value={targetNiveau} onChange={e => { setTargetNiveau(e.target.value); setTargetClasseId(''); }} className={inputCls}>
                    <option value="">Tous les niveaux</option>
                    {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                  <select value={targetClasseId} onChange={e => setTargetClasseId(e.target.value)} className={inputCls}>
                    <option value="">-- Sélectionner une classe --</option>
                    {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
                  </select>
                </div>
              )}

              {targetType === 'INDIVIDUEL' && (
                <div className="space-y-2">
                  {selectedEleve ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-blue-800">
                          {selectedEleve.prenom} {selectedEleve.nom}
                          <span className="ml-2 text-xs font-normal text-blue-600">
                            {NIVEAUX_LABELS[selectedEleve.niveau] || selectedEleve.niveau}
                            {classeMap[selectedEleve.classeId] && ` • ${classeMap[selectedEleve.classeId]}`}
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 mt-0.5">
                          Parent : {getParentDisplay(selectedEleve)} — {getElevePhone(selectedEleve) || 'Pas de numéro'}
                        </div>
                      </div>
                      <button onClick={() => { setSelectedEleve(null); setSearchEleve(''); }}
                        className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input type="text" placeholder="Rechercher un élève, un parent ou un numéro…"
                        value={searchEleve} onChange={e => setSearchEleve(e.target.value)}
                        className={`${inputCls} pl-9`} />
                    </div>
                  )}
                  {searchEleve && !selectedEleve && filteredEleves.length > 0 && (
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                      {filteredEleves.map(e => (
                        <button key={e.id} onClick={() => handleSelectEleve(e)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm">
                              <span className="font-medium text-slate-800">{e.prenom} {e.nom}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                {NIVEAUX_LABELS[e.niveau] || e.niveau}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">Parent : {getParentDisplay(e)}</div>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{getElevePhone(e)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchEleve && !selectedEleve && filteredEleves.length === 0 && (
                    <p className="text-xs text-slate-400 italic px-2">Aucun résultat pour "{searchEleve}"</p>
                  )}
                </div>
              )}

              {targetType === 'GROUPE' && (
                <div className="space-y-2">
                  {!waReady ? (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Connectez WhatsApp pour afficher les groupes du compte.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                          <input type="text" placeholder="Rechercher un groupe…" value={groupSearch}
                            onChange={e => setGroupSearch(e.target.value)} className={`${inputCls} pl-9`} />
                        </div>
                        <button onClick={loadGroups} disabled={groupsLoading} title="Actualiser la liste"
                          className="px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                          <RefreshCw size={14} className={groupsLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      {groupsError && <p className="text-xs text-red-600">{groupsError}</p>}

                      <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                        {groupsLoading && groups.length === 0 ? (
                          <div className="p-6 text-center"><Loader2 size={18} className="animate-spin mx-auto text-slate-400" /></div>
                        ) : filteredGroups.length === 0 ? (
                          <p className="p-4 text-center text-xs text-slate-400">
                            {groups.length === 0 ? 'Aucun groupe trouvé sur ce compte WhatsApp.' : `Aucun groupe pour "${groupSearch}"`}
                          </p>
                        ) : filteredGroups.map(g => {
                          const checked = selectedGroupIds.has(g.id);
                          return (
                            <label key={g.id}
                              className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                                g.canSend ? 'cursor-pointer hover:bg-green-50' : 'opacity-50 cursor-not-allowed'} ${checked ? 'bg-green-50' : ''}`}>
                              <input type="checkbox" checked={checked} disabled={!g.canSend}
                                onChange={() => toggleGroup(g.id)} className="accent-green-600" />
                              <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                                <UsersRound size={15} />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{g.name}</p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  {g.participants ? `${g.participants} membres` : 'Membres inconnus'}
                                  {g.announce && <span className="inline-flex items-center gap-0.5"><Megaphone size={10} /> annonces</span>}
                                  {!g.canSend && <span className="text-amber-600">· réservé aux admins</span>}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {selectedGroupIds.size > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{selectedGroupIds.size} groupe(s) sélectionné(s)</span>
                          <button onClick={() => setSelectedGroupIds(new Set())} className="text-slate-400 hover:text-slate-600">Tout décocher</button>
                        </div>
                      )}
                      {templateNeedsChild && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <AlertCircle size={12} className="shrink-0" />
                          Ce modèle cite un enfant : choisissez « Annonce générale » ou « Événement » pour un groupe.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Actions */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button onClick={resetComposer}
                className="flex items-center gap-1.5 px-3 py-2 text-slate-500 text-sm hover:text-slate-700">
                <RefreshCw size={14} />Réinitialiser
              </button>
              <div className="flex-1" />
              <button onClick={handlePreview} disabled={loading || !canSend}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-all disabled:opacity-50">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                Vérifier les destinataires
              </button>
              <button onClick={handleSend} disabled={sending || !canSend || !waReady}
                title={!waReady ? 'WhatsApp non connecté' : ''}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-50">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Envoyer{estimatedRecipients ? ` à ${estimatedRecipients}${targetType === 'GROUPE' ? ' groupe(s)' : ''}` : ''}
              </button>
            </div>
          </div>

          {/* Col droite : aperçu type WhatsApp, toujours visible */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-4">
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-[#075e54] text-white px-4 py-2.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  {NOM_ECOLE.charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{wa.status?.pushname || NOM_ECOLE}</p>
                  <p className="text-[11px] text-white/70">{wa.status?.phone ? `+${wa.status.phone}` : 'Aperçu du message'}</p>
                </div>
              </div>
              <div className="bg-[#ece5dd] p-4 min-h-[220px] flex flex-col justify-end">
                {selectedTemplate ? (
                  <div className="ml-auto max-w-[92%] bg-[#dcf8c6] rounded-xl rounded-tr-sm px-3 py-2 shadow-sm">
                    <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">{renderedBody}</p>
                    <p className="text-[10px] text-slate-500 text-right mt-1 flex items-center justify-end gap-1">
                      {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      <CheckCheck size={12} className="text-sky-500" />
                    </p>
                  </div>
                ) : (
                  <div className="m-auto text-center text-slate-500 text-xs">
                    <FileText size={28} className="mx-auto mb-2 opacity-40" />
                    L'aperçu du message apparaîtra ici
                  </div>
                )}
              </div>
              {selectedTemplate && !bodyComplete && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-[11px] text-amber-700">
                  <AlertCircle size={12} className="shrink-0" /> Complétez les champs du message.
                </div>
              )}
              {selectedTemplate && (
                <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
                  {targetType === 'GROUPE'
                    ? 'Message identique pour chaque groupe sélectionné.'
                    : <>Exemple avec {selectedEleve ? 'le parent choisi' : 'le premier parent'} — chaque parent reçoit son message personnalisé.</>}
                </p>
              )}
            </div>

            {showPreview && preview && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-700 text-sm">Destinataires vérifiés</h4>
                  <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat value={preview.recipientCount} label="Destinataires" cls="bg-green-50 text-green-700" />
                  <MiniStat value={preview.skippedCount} label="Exclus" cls="bg-amber-50 text-amber-700" />
                </div>
                {preview.recipients.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {preview.recipients.slice(0, 10).map((r, i) => (
                      <div key={i} className="text-[11px] text-green-700 flex items-center gap-1">
                        <CheckCircle2 size={11} />{r.nom} — {r.phone}
                      </div>
                    ))}
                    {preview.recipients.length > 10 && (
                      <p className="text-[11px] text-slate-400">+ {preview.recipients.length - 10} autres…</p>
                    )}
                  </div>
                )}
                {preview.skipped.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {preview.skipped.map((sk, i) => (
                      <div key={i} className="text-[11px] text-amber-700 flex items-center gap-1">
                        <AlertCircle size={11} />{sk.nom} — {sk.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sendResult && (
              <div className="bg-white rounded-2xl border border-green-200 p-4 space-y-3">
                <h4 className="font-medium text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} />Envoi lancé en arrière-plan
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat value={sendResult.sent} label="En file d'envoi" cls="bg-green-50 text-green-700" />
                  <MiniStat value={sendResult.skipped} label="Ignorés" cls="bg-slate-50 text-slate-700" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setActiveTab('historique'); setHistoryView('messages'); }}
                    className="flex-1 text-xs text-slate-600 hover:text-slate-800 font-medium py-1.5 rounded-lg border border-slate-200">
                    Suivre l'envoi
                  </button>
                  <button onClick={resetComposer}
                    className="flex-1 text-xs text-green-700 hover:text-green-900 font-medium py-1.5 rounded-lg border border-green-200">
                    Nouveau message
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB HISTORIQUE ═══ */}
      {activeTab === 'historique' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex gap-1 bg-slate-100 rounded-lg p-1">
              {([
                { id: 'campagnes', label: `Campagnes (${logsTotal})` },
                { id: 'messages', label: `Tous les messages (${waMessagesTotal})` },
              ] as const).map(v => (
                <button key={v.id} onClick={() => setHistoryView(v.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    historyView === v.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => (historyView === 'campagnes' ? loadLogs() : loadWaMessages())}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>

          {historyView === 'campagnes' && (loading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucun envoi groupé pour l'instant.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map(log => {
                const st = STATUS_COLORS[log.status] || STATUS_COLORS.PENDING;
                return (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className="shrink-0">
                      {log.status === 'SENT' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
                       log.status === 'FAILED' ? <AlertCircle size={18} className="text-red-500" /> :
                       log.status === 'SENDING' ? <Loader2 size={18} className="animate-spin text-blue-500" /> :
                       <Clock size={18} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-700 truncate">{log.subject || log.type}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className="text-[10px] text-slate-400">{log.targetType === 'ALL' ? 'Tous' : log.targetType === 'NIVEAU' ? log.targetNiveau : log.targetType === 'GROUPE' ? 'Groupe(s)' : log.targetType}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{log.body}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-600">{log.deliveredCount}/{log.recipientCount}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {historyView === 'campagnes' && logsTotal > 20 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-center gap-2">
              <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">Précédent</button>
              <span className="text-xs text-slate-500">Page {logsPage}</span>
              <button disabled={logsPage * 20 >= logsTotal} onClick={() => setLogsPage(p => p + 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">Suivant</button>
            </div>
          )}

          {historyView === 'messages' && (waMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucun message WhatsApp pour l'instant.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {waMessages.map(m => {
                const cls = m.status === 'FAILED' ? 'bg-red-50 text-red-700'
                  : m.status === 'QUEUED' ? 'bg-amber-50 text-amber-700'
                  : m.status === 'READ' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700';
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <span className="text-lg shrink-0">{m.kind === 'document' ? '📄' : '💬'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-700">{m.recipient_name || m.phone}</span>
                        <span className="text-[10px] text-slate-400">{m.phone}</span>
                        {m.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{m.category.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{m.filename ? `${m.filename} — ` : ''}{m.body}</p>
                      {m.error && <p className="text-[11px] text-red-500 mt-0.5 truncate">{m.error}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>
                        {m.status === 'QUEUED' && <Loader2 size={10} className="animate-spin" />}
                        {WA_MESSAGE_STATUS_LABELS[m.status]}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        {new Date(m.sent_at || m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers d'affichage ─────────────────────────────────────────────────────

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center">{n}</span>
      {title}
    </h3>
  );
}

function Chip({ icon, value, label, cls }: { icon: React.ReactNode; value: number; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${cls}`}>
      {icon}<b>{value}</b>{label}
    </span>
  );
}

function MiniStat({ value, label, cls }: { value: number; label: string; cls: string }) {
  return (
    <div className={`p-2 rounded-lg text-center ${cls}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-80">{label}</div>
    </div>
  );
}
