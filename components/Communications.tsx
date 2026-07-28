import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Send, Users, MessageSquare, FileText, History, Eye, Search,
  AlertCircle, CheckCircle2, Clock, Loader2, X, Edit3, Zap,
  Phone, RefreshCw, Info
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';

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

// ─── Constantes ──────────────────────────────────────────────────────────────

const NIVEAUX = [
  { value: 'CRECHE', label: 'Crèche' },
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

const TYPES_MESSAGE = [
  { value: 'FACTURE', label: 'Facture mensuelle', category: 'FINANCIER', icon: '📄', color: 'blue' },
  { value: 'RECU', label: 'Reçu de paiement', category: 'FINANCIER', icon: '✅', color: 'emerald' },
  { value: 'RELANCE', label: 'Relance impayé', category: 'FINANCIER', icon: '⚠️', color: 'rose' },
  { value: 'BULLETIN', label: 'Bulletin disponible', category: 'PEDAGOGIQUE', icon: '📊', color: 'indigo' },
  { value: 'ANNONCE', label: 'Annonce générale', category: 'GENERAL', icon: '📢', color: 'teal' },
  { value: 'EVENEMENT', label: 'Événement', category: 'GENERAL', icon: '🎉', color: 'orange' },
  { value: 'LIBRE', label: 'Message libre', category: 'GENERAL', icon: '💬', color: 'slate' },
];

const NOM_ECOLE = 'Le Toit des Anges';

const DEFAULT_TEMPLATES = [
  {
    id: 'FACTURE_MENSUELLE', label: 'Facture mensuelle', category: 'FINANCIER',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois', 'date_limite'],
    body: `Bonjour {prenom_parent},

Nous vous adressons la facture de scolarité du mois de *{mois}* pour *{prenom_enfant} {nom_enfant}* ({niveau}).

💰 Montant dû : *{montant} FCFA*
📅 Date limite de paiement : *{date_limite}*

Merci de régulariser avant la date limite.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'RECU_DEFINITIF', label: 'Reçu de paiement', category: 'FINANCIER',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois'],
    body: `Bonjour {prenom_parent},

Nous confirmons le règlement *complet* des frais de scolarité de *{prenom_enfant} {nom_enfant}* ({niveau}) pour le mois de *{mois}*.

✅ Montant payé : *{montant} FCFA*

Merci de votre confiance !
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'RELANCE', label: 'Relance impayé', category: 'FINANCIER',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'montant', 'mois', 'nb_jours_retard'],
    body: `Bonjour {prenom_parent},

Les frais de scolarité de *{prenom_enfant} {nom_enfant}* ({niveau}) pour *{mois}* sont toujours en attente.

💰 Montant dû : *{montant} FCFA*
📅 Retard : *{nb_jours_retard} jour(s)*

Merci de régulariser d'urgence ou de nous contacter.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'BULLETIN', label: 'Bulletin disponible', category: 'PEDAGOGIQUE',
    variables: ['prenom_parent', 'prenom_enfant', 'nom_enfant', 'niveau', 'trimestre'],
    body: `Bonjour {prenom_parent},

Le bulletin de *{prenom_enfant} {nom_enfant}* ({niveau}) pour le *{trimestre}* est disponible.

📊 Connectez-vous au portail parent pour le consulter.
— ${NOM_ECOLE} 🏫`,
  },
  {
    id: 'ANNONCE', label: 'Annonce générale', category: 'GENERAL',
    variables: ['prenom_parent'],
    body: `Bonjour {prenom_parent},

{message}

— ${NOM_ECOLE} 🏫`,
  },
];

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Envoyé' },
  PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partiel' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Échoué' },
  SENDING: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'En cours' },
  PENDING: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'En attente' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function getElevePhone(e: EleveComm): string {
  return e.whatsappPrincipal || e.parent1?.whatsapp || e.parent1?.tel || e.parent1?.telephone || '';
}

function getParentDisplay(e: EleveComm): string {
  if (!e.parent1) return '—';
  const p = e.parent1;
  return [p.prenom, p.nom].filter(Boolean).join(' ') || '—';
}


// ─── Composant principal ─────────────────────────────────────────────────────

export default function Communications() {
  const showToast = useToast();
  const { annee: anneeScolaire } = useAnnee();

  const [activeTab, setActiveTab] = useState<'composer' | 'historique' | 'templates'>('composer');
  const [eleves, setEleves] = useState<EleveComm[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Composer
  const [messageType, setMessageType] = useState('LIBRE');
  const [targetType, setTargetType] = useState<'ALL' | 'NIVEAU' | 'CLASSE' | 'INDIVIDUEL'>('ALL');
  const [targetNiveau, setTargetNiveau] = useState('');
  const [targetClasseId, setTargetClasseId] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<EleveComm | null>(null);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [customVars, setCustomVars] = useState<Record<string, string>>({
    mois: MOIS_LABELS[new Date().getMonth()],
    montant: '',
    date_limite: '',
    trimestre: '',
  });
  const [searchEleve, setSearchEleve] = useState('');

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

  // ── Recherche élèves (par nom enfant OU nom parent) ───────────────────────

  const filteredEleves = useMemo(() => {
    const q = searchEleve.toLowerCase().trim();
    if (!q) return [];
    return eleves.filter(e => {
      if (!['ACTIF', 'INSCRIT'].includes(e.statut)) return false;
      if (!getElevePhone(e)) return false;
      const nomEnfant = `${e.prenom} ${e.nom}`.toLowerCase();
      const nomParent1 = `${e.parent1?.prenom || ''} ${e.parent1?.nom || ''}`.toLowerCase();
      const nomParent2 = `${e.parent2?.prenom || ''} ${e.parent2?.nom || ''}`.toLowerCase();
      const phone = getElevePhone(e);
      return nomEnfant.includes(q) || nomParent1.includes(q) || nomParent2.includes(q) || phone.includes(q);
    }).slice(0, 15);
  }, [eleves, searchEleve]);

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

  // ── Category/financier ────────────────────────────────────────────────────

  const category = useMemo(() => TYPES_MESSAGE.find(t => t.value === messageType)?.category || 'GENERAL', [messageType]);
  const isFinancier = category === 'FINANCIER' || category === 'PEDAGOGIQUE';

  // ── Appliquer un template ─────────────────────────────────────────────────

  const handleSelectTemplate = (tmpl: typeof DEFAULT_TEMPLATES[0]) => {
    setBody(tmpl.body);
    const typeMatch = TYPES_MESSAGE.find(t => t.category === tmpl.category);
    if (typeMatch) setMessageType(typeMatch.value);
  };

  // ── Sélection d'un élève ──────────────────────────────────────────────────

  const handleSelectEleve = (e: EleveComm) => {
    setSelectedEleve(e);
    setSearchEleve(`${e.prenom} ${e.nom}`);
    setTargetType('INDIVIDUEL');
  };

  // ── Message rendu (preview) ───────────────────────────────────────────────

  const renderedMessage = useMemo(() => {
    if (!body || !selectedEleve) return body;
    const parentPrenom = selectedEleve.parent1?.prenom || '';
    const parentNom = selectedEleve.parent1?.nom || '';
    const vars: Record<string, string> = {
      ...customVars,
      prenom_enfant: selectedEleve.prenom,
      nom_enfant: selectedEleve.nom,
      niveau: NIVEAUX_LABELS[selectedEleve.niveau] || selectedEleve.niveau,
      classe: classeMap[selectedEleve.classeId] || selectedEleve.niveau,
      prenom_parent: parentPrenom ? `${parentPrenom} ${parentNom}`.trim() : 'Parent',
    };
    return renderTemplate(body, vars);
  }, [body, selectedEleve, customVars, classeMap]);

  // ── Preview (dry-run API) ─────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!body.trim()) { showToast('Le message ne peut pas être vide.', 'error'); return; }
    try {
      setLoading(true);
      const res = await apiClient.post('/communications/preview', {
        type: messageType, category, body,
        targetType,
        targetNiveau: targetType === 'NIVEAU' ? targetNiveau : undefined,
        targetClasseId: targetType === 'CLASSE' ? targetClasseId : undefined,
        targetEleveId: targetType === 'INDIVIDUEL' ? selectedEleve?.id : undefined,
      });
      setPreview(res.data || res);
      setShowPreview(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || err.data?.message || 'Erreur prévisualisation.', 'error');
    } finally { setLoading(false); }
  };

  // ── Envoi WhatsApp ────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!body.trim()) { showToast('Le message ne peut pas être vide.', 'error'); return; }
    try {
      setSending(true);
      const res = await apiClient.post('/communications/send', {
        type: messageType, category, subject, body,
        targetType,
        targetNiveau: targetType === 'NIVEAU' ? targetNiveau : undefined,
        targetClasseId: targetType === 'CLASSE' ? targetClasseId : undefined,
        targetEleveId: targetType === 'INDIVIDUEL' ? selectedEleve?.id : undefined,
        variables: customVars,
      });
      setSendResult(res.data || res);
      showToast(`${(res.data || res).sent} message(s) envoyé(s).`, 'success');
      setShowPreview(false);
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || err.data?.message || 'Erreur envoi.', 'error');
    } finally { setSending(false); }
  };


  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetComposer = () => {
    setBody(''); setSubject(''); setMessageType('LIBRE'); setTargetType('ALL');
    setTargetNiveau(''); setTargetClasseId(''); setSelectedEleve(null);
    setSearchEleve(''); setPreview(null); setShowPreview(false); setSendResult(null);
    setCustomVars({ mois: MOIS_LABELS[new Date().getMonth()], montant: '', date_limite: '', trimestre: '' });
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const actifs = eleves.filter(e => e.statut === 'ACTIF').length;
    const avecPhone = eleves.filter(e => !!getElevePhone(e)).length;
    return { total: eleves.length, actifs, avecPhone };
  }, [eleves]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'composer' as const, label: 'Envoyer', icon: Send },
    { id: 'historique' as const, label: 'Historique', icon: History },
    { id: 'templates' as const, label: 'Modèles', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête + KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-green-500 rounded-xl text-white"><MessageSquare size={22} /></span>
            Communications WhatsApp
          </h1>
          <p className="text-slate-500 text-sm mt-1">Envoi de messages aux parents via WhatsApp</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-blue-50 text-blue-700 flex items-center gap-3">
          <Users size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.actifs}</div><div className="text-xs opacity-70">Élèves actifs</div></div>
        </div>
        <div className="rounded-2xl p-4 bg-green-50 text-green-700 flex items-center gap-3">
          <Phone size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.avecPhone}</div><div className="text-xs opacity-70">Avec WhatsApp</div></div>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50 text-amber-700 flex items-center gap-3">
          <AlertCircle size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.total - kpis.avecPhone}</div><div className="text-xs opacity-70">Sans numéro</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={16} />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB COMPOSER ═══ */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col gauche : formulaire */}
          <div className="lg:col-span-2 space-y-5">

            {/* Type de message */}
            <Card title="Type de message" icon={<Zap size={16} className="text-amber-500" />}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TYPES_MESSAGE.map(t => (
                  <button key={t.value} onClick={() => setMessageType(t.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      messageType === t.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    <span className="mr-1">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
              {isFinancier && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-xs mt-3">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>Seuls les parents d'élèves <strong>ACTIFS</strong> recevront ce message.</span>
                </div>
              )}
            </Card>

            {/* Destinataires */}
            <Card title="Destinataires" icon={<Users size={16} className="text-blue-500" />}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'ALL', label: 'Tous les parents' },
                  { value: 'NIVEAU', label: 'Par niveau' },
                  { value: 'CLASSE', label: 'Par classe' },
                  { value: 'INDIVIDUEL', label: 'Un parent' },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => { setTargetType(opt.value as any); setSelectedEleve(null); setPreview(null); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      targetType === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {targetType === 'NIVEAU' && (
                <select value={targetNiveau} onChange={e => setTargetNiveau(e.target.value)}
                  className="w-full mt-3 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Sélectionner un niveau --</option>
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              )}

              {targetType === 'CLASSE' && (
                <div className="mt-3 space-y-2">
                  <select value={targetNiveau} onChange={e => { setTargetNiveau(e.target.value); setTargetClasseId(''); }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Filtrer par niveau (optionnel)</option>
                    {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                  <select value={targetClasseId} onChange={e => setTargetClasseId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Sélectionner une classe --</option>
                    {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
                  </select>
                </div>
              )}

              {targetType === 'INDIVIDUEL' && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="Rechercher par nom d'élève ou de parent..."
                      value={searchEleve} onChange={e => { setSearchEleve(e.target.value); setSelectedEleve(null); }}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  {searchEleve && !selectedEleve && filteredEleves.length > 0 && (
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                      {filteredEleves.map(e => (
                        <button key={e.id} onClick={() => handleSelectEleve(e)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-sm text-slate-800">{e.prenom} {e.nom}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                {NIVEAUX_LABELS[e.niveau] || e.niveau}
                              </span>
                              {classeMap[e.classeId] && (
                                <span className="ml-1 text-[10px] text-slate-400">{classeMap[e.classeId]}</span>
                              )}
                            </div>
                            {getElevePhone(e) ? (
                              <Phone size={12} className="text-green-500" />
                            ) : (
                              <span className="text-[10px] text-red-400">Pas de n°</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Parent : {getParentDisplay(e)}
                            {getElevePhone(e) && <span className="ml-2 text-slate-400">{getElevePhone(e)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchEleve && !selectedEleve && filteredEleves.length === 0 && (
                    <p className="text-xs text-slate-400 italic px-2">Aucun résultat pour "{searchEleve}"</p>
                  )}
                  {/* Élève sélectionné */}
                  {selectedEleve && (
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
                  )}
                </div>
              )}
            </Card>

            {/* Corps du message */}
            <Card title="Message" icon={<Edit3 size={16} className="text-green-500" />}>
              <textarea rows={8} placeholder="Rédigez votre message... Variables : {prenom_enfant}, {nom_enfant}, {niveau}, {classe}, {prenom_parent}, {montant}, {mois}, {date_limite}"
                value={body} onChange={e => setBody(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />

              {/* Variables personnalisées */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <input placeholder="Mois" value={customVars.mois} onChange={e => setCustomVars(v => ({ ...v, mois: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <input placeholder="Montant (FCFA)" value={customVars.montant} onChange={e => setCustomVars(v => ({ ...v, montant: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <input placeholder="Date limite" value={customVars.date_limite} onChange={e => setCustomVars(v => ({ ...v, date_limite: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <input placeholder="Trimestre" value={customVars.trimestre} onChange={e => setCustomVars(v => ({ ...v, trimestre: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
              </div>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handlePreview} disabled={loading || !body.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                Prévisualiser
              </button>
              <button onClick={handleSend} disabled={sending || !body.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Envoyer
              </button>
              <button onClick={resetComposer}
                className="flex items-center gap-2 px-4 py-2.5 text-slate-500 text-sm hover:text-slate-700">
                <RefreshCw size={14} />Réinitialiser
              </button>
            </div>
          </div>

          {/* Col droite : templates + preview + résultat */}
          <div className="space-y-5">
            {/* Templates rapides */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-medium text-slate-700 text-sm">Modèles rapides</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {DEFAULT_TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                    className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-green-300 hover:bg-green-50/50 transition-all text-xs">
                    <div className="font-medium text-slate-700">{tmpl.label}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      tmpl.category === 'FINANCIER' ? 'bg-amber-100 text-amber-700' :
                      tmpl.category === 'PEDAGOGIQUE' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{tmpl.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview message rendu (individuel) */}
            {targetType === 'INDIVIDUEL' && selectedEleve && body && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <h4 className="font-medium text-slate-700 text-sm">Aperçu du message</h4>
                <div className="bg-green-50 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {renderedMessage}
                </div>
              </div>
            )}

            {/* Preview API (tous/groupe) */}
            {showPreview && preview && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-700 text-sm">Aperçu envoi</h4>
                  <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-700">{preview.recipientCount}</div>
                    <div className="text-[10px] text-green-600">Destinataires</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-amber-700">{preview.skippedCount}</div>
                    <div className="text-[10px] text-amber-600">Exclus</div>
                  </div>
                </div>
                {preview.recipients.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    <p className="text-[10px] text-slate-500 font-medium">Destinataires :</p>
                    {preview.recipients.slice(0, 10).map((r, i) => (
                      <div key={i} className="text-[10px] text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={10} />{r.nom} — {r.niveau} — {r.phone}
                      </div>
                    ))}
                    {preview.recipients.length > 10 && (
                      <p className="text-[10px] text-slate-400">+ {preview.recipients.length - 10} autres...</p>
                    )}
                  </div>
                )}
                {preview.skipped.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    <p className="text-[10px] text-slate-500 font-medium">Exclus :</p>
                    {preview.skipped.map((s, i) => (
                      <div key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                        <AlertCircle size={10} />{s.nom} — {s.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Résultat d'envoi */}
            {sendResult && (
              <div className="bg-white rounded-2xl border border-green-200 p-4 space-y-3">
                <h4 className="font-medium text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} />Envoi terminé
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-700">{sendResult.sent}</div>
                    <div className="text-[10px] text-green-600">Envoyés</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold text-red-700">{sendResult.failed}</div>
                    <div className="text-[10px] text-red-600">Échoués</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-lg font-bold text-slate-700">{sendResult.skipped}</div>
                    <div className="text-[10px] text-slate-600">Ignorés</div>
                  </div>
                </div>
                <button onClick={resetComposer}
                  className="w-full text-center text-xs text-green-600 hover:text-green-800 font-medium mt-2">
                  Nouveau message
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB HISTORIQUE ═══ */}
      {activeTab === 'historique' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Historique des envois</h3>
            <button onClick={loadLogs} className="text-slate-400 hover:text-slate-600"><RefreshCw size={16} /></button>
          </div>
          {loading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucun envoi pour l'instant.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map(log => {
                const st = STATUS_COLORS[log.status] || STATUS_COLORS.PENDING;
                return (
                  <div key={log.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
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
                        <span className="text-[10px] text-slate-400">{log.targetType === 'ALL' ? 'Tous' : log.targetType === 'NIVEAU' ? log.targetNiveau : log.targetType}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{log.body?.slice(0, 80)}...</p>
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
          )}
          {logsTotal > 20 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-center gap-2">
              <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">Précédent</button>
              <span className="text-xs text-slate-500">Page {logsPage}</span>
              <button disabled={logsPage * 20 >= logsTotal} onClick={() => setLogsPage(p => p + 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">Suivant</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB TEMPLATES ═══ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Modèles de messages</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEFAULT_TEMPLATES.map(tmpl => (
              <div key={tmpl.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-slate-700">{tmpl.label}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    tmpl.category === 'FINANCIER' ? 'bg-amber-100 text-amber-700' :
                    tmpl.category === 'PEDAGOGIQUE' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{tmpl.category}</span>
                </div>
                <pre className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-4 bg-slate-50 rounded-lg p-2">{tmpl.body}</pre>
                <div className="flex flex-wrap gap-1">
                  {tmpl.variables.map(v => (
                    <span key={v} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{`{${v}}`}</span>
                  ))}
                </div>
                <button onClick={() => { handleSelectTemplate(tmpl); setActiveTab('composer'); }}
                  className="text-xs text-green-600 hover:text-green-800 font-medium">
                  Utiliser ce modèle →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card helper ─────────────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  );
}
