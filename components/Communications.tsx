import React, { useState, useEffect, useMemo } from 'react';
import {
  Send, Users, MessageSquare, History, Eye, Search,
  AlertCircle, CheckCircle2, Clock, Loader2, X,
  Phone, RefreshCw
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
  waTemplate: string;
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
    category: 'PEDAGOGIQUE', waTemplate: 'notification_ecole',
    body: `Bonjour {prenom_parent},\n\nLe bulletin de {prenom_enfant} {nom_enfant} ({niveau}) pour le {trimestre} est disponible.\n\nConnectez-vous au portail parent pour le consulter.\n— ${NOM_ECOLE}`,
    editableVars: [
      { key: 'trimestre', label: 'Trimestre', placeholder: '1er trimestre 2026-2027' },
    ],
  },
  {
    id: 'ANNONCE', type: 'ANNONCE',
    label: 'Annonce générale', icon: '📢',
    category: 'GENERAL', waTemplate: 'notification_ecole',
    body: `Bonjour {prenom_parent},\n\n{contenu}\n\n— ${NOM_ECOLE}`,
    editableVars: [
      { key: 'contenu', label: 'Contenu de l\'annonce', placeholder: 'La rentrée scolaire est fixée au 6 octobre 2026...' },
    ],
  },
  {
    id: 'EVENEMENT', type: 'EVENEMENT',
    label: 'Événement', icon: '🎉',
    category: 'GENERAL', waTemplate: 'notification_ecole',
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

export default function Communications() {
  const showToast = useToast();
  const { annee: anneeScolaire } = useAnnee();

  const [activeTab, setActiveTab] = useState<'composer' | 'historique'>('composer');
  const [eleves, setEleves] = useState<EleveComm[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Composer
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetType, setTargetType] = useState<'ALL' | 'NIVEAU' | 'CLASSE' | 'INDIVIDUEL'>('ALL');
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
      prenom_parent: parentPrenom ? `${parentPrenom} ${parentNom}`.trim() : 'Parent',
    };
    return renderBody(selectedTemplate.body, vars);
  }, [selectedTemplate, selectedEleve, eligibleEleves, varsValues, classeMap]);

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
        variables: varsValues,
      });
      const data = res.data || res;
      setSendResult(data);
      if (data.sent > 0) {
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

  // ── Validation d'envoi ────────────────────────────────────────────────────

  const canSend = useMemo(() => {
    if (!selectedTemplate || !bodyComplete) return false;
    if (targetType === 'NIVEAU' && !targetNiveau) return false;
    if (targetType === 'CLASSE' && !targetClasseId) return false;
    if (targetType === 'INDIVIDUEL' && !selectedEleve) return false;
    return true;
  }, [selectedTemplate, bodyComplete, targetType, targetNiveau, targetClasseId, selectedEleve]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'composer' as const, label: 'Envoyer', icon: Send },
    { id: 'historique' as const, label: 'Historique', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <span className="p-2 bg-green-500 rounded-xl text-white"><MessageSquare size={22} /></span>
          Communications WhatsApp
        </h1>
        <p className="text-slate-500 text-sm mt-1">Envoi de messages aux parents via WhatsApp</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-blue-50 text-blue-700 flex items-center gap-3">
          <Users size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.total}</div><div className="text-xs opacity-70">Élèves inscrits</div></div>
        </div>
        <div className="rounded-2xl p-4 bg-green-50 text-green-700 flex items-center gap-3">
          <Phone size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.avecPhone}</div><div className="text-xs opacity-70">Avec WhatsApp</div></div>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50 text-amber-700 flex items-center gap-3">
          <AlertCircle size={20} className="opacity-70" />
          <div><div className="text-xl font-bold">{kpis.sansPhone}</div><div className="text-xs opacity-70">Sans numéro</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={16} />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB ENVOYER ═══ */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col gauche */}
          <div className="lg:col-span-2 space-y-5">

            {/* 1. Choix du template */}
            <Card title="Choisir un template" icon={<MessageSquare size={16} className="text-green-500" />}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedTemplate?.id === tmpl.id
                        ? 'border-green-500 bg-green-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    <div className="text-2xl mb-1">{tmpl.icon}</div>
                    <div className="font-semibold text-sm text-slate-800">{tmpl.label}</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <CheckCircle2 size={10} className="text-green-500" />
                      <span className="text-[10px] text-green-700 font-medium">{tmpl.waTemplate}</span>
                      <span className="px-1 py-0.5 rounded bg-green-100 text-green-800 text-[9px] font-bold">VALIDÉ</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Champs variables du template sélectionné */}
              {selectedTemplate && selectedTemplate.editableVars.length > 0 && (
                <div className="mt-4 space-y-3 p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-slate-600">Compléter les informations :</p>
                  {selectedTemplate.editableVars.map(v => (
                    <div key={v.key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{v.label}</label>
                      <input
                        type="text"
                        value={varsValues[v.key] || ''}
                        onChange={e => setVarsValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                        placeholder={v.placeholder}
                        className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 2. Destinataires */}
            <Card title="Destinataires" icon={<Users size={16} className="text-blue-500" />}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: 'ALL', label: 'Tous les parents' },
                  { value: 'NIVEAU', label: 'Par niveau' },
                  { value: 'CLASSE', label: 'Par classe' },
                  { value: 'INDIVIDUEL', label: 'Un parent' },
                ] as const).map(opt => (
                  <button key={opt.value}
                    onClick={() => { setTargetType(opt.value); setSelectedEleve(null); setPreview(null); setShowPreview(false); }}
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
                            <Phone size={12} className="text-green-500" />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Parent : {getParentDisplay(e)} <span className="ml-2 text-slate-400">{getElevePhone(e)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchEleve && !selectedEleve && filteredEleves.length === 0 && (
                    <p className="text-xs text-slate-400 italic px-2">Aucun résultat pour "{searchEleve}"</p>
                  )}
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

            {/* 3. Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handlePreview} disabled={loading || !canSend}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                Prévisualiser
              </button>
              <button onClick={handleSend} disabled={sending || !canSend}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Envoyer via WhatsApp
              </button>
              <button onClick={resetComposer}
                className="flex items-center gap-2 px-4 py-2.5 text-slate-500 text-sm hover:text-slate-700">
                <RefreshCw size={14} />Réinitialiser
              </button>
            </div>
          </div>

          {/* Col droite : preview */}
          <div className="space-y-5">
            {/* Aperçu du message */}
            {selectedTemplate && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                  <Eye size={14} className="text-slate-400" />
                  Aperçu du message
                </h4>
                <div className="bg-green-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-green-700">
                    <span className="text-lg">{selectedTemplate.icon}</span>
                    <span className="font-medium">{selectedTemplate.label}</span>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {renderedBody || <span className="italic text-slate-400">Complétez les champs pour voir l'aperçu...</span>}
                  </div>
                </div>
                {!bodyComplete && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg text-[11px] text-amber-700">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>Veuillez remplir tous les champs du template.</span>
                  </div>
                )}
              </div>
            )}

            {/* Preview API result */}
            {showPreview && preview && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-700 text-sm">Résultat prévisualisation</h4>
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
                        <CheckCircle2 size={10} />{r.nom} — {r.phone}
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
