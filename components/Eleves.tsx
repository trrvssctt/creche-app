import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Edit3, Trash2, X, RefreshCw, Eye,
  Save, AlertCircle, Phone, Baby, BookOpen,
  ShieldCheck, Filter, CheckCircle2,
  UserCheck, UserX, Clock, GraduationCap, Heart,
  ArrowRight, ChevronLeft, FileText, FolderOpen,
  ClipboardCheck, UserPlus, ClipboardList, Banknote,
  Repeat, Calendar, AlertTriangle, Lock, Globe, Building2,
  Loader2, Copy, Camera,
} from 'lucide-react';
import { compressImageToDataUrl } from '../services/photoUtils';
import { piecesForNiveau } from '../services/piecesJustificatives';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { openInvoicePrintWindow, type StudentInvoiceData } from '../services/invoicePdf';
import { downloadSingleAdminDoc, downloadAdminDocsZip } from '../services/adminDocsPdf';
import { User, Eleve, NiveauScolaire, RegimeFinancier, StatutAdmission } from '../types';
import { useAnnee } from '../contexts/AnneeContext';
import { EleveDossier } from './EleveDossier';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: string }[] = [
  { value: 'CRECHE', label: 'Crèche (3–12 mois)', cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',      cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section',     cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',      cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',                  cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',                 cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',                 cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',                 cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',                 cycle: 'Élémentaire' },
];

const REGIMES: { value: RegimeFinancier; label: string; color: string }[] = [
  { value: 'NORMAL',               label: 'Normal',               color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'CAS_SOCIAL_PARTIEL',   label: 'Cas social (partiel)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'CAS_SOCIAL_TOTAL',     label: 'Cas social (total)',   color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

// EN_ATTENTE et ADMIS exclus : ces statuts n'apparaissent que dans le modal "Dossiers en attente"
const STATUTS: { value: StatutAdmission; label: string; color: string }[] = [
  { value: 'INSCRIT',    label: 'Inscrit',     color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'ACTIF',      label: 'Actif',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'RADIE',      label: 'Radié',       color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'SUSPENDU',   label: 'Suspendu',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

// ANNEE_COURANTE est fourni par useAnnee() dans le composant

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genMatricule(niveau: NiveauScolaire, annee: string = new Date().getFullYear().toString()): string {
  const prefix: Record<NiveauScolaire, string> = {
    CRECHE: 'CR', PS: 'PS', MS: 'MS', GS: 'GS',
    CP: 'CP', CE1: 'C1', CE2: 'C2', CM1: 'M1', CM2: 'M2',
  };
  return `${prefix[niveau]}-${annee.slice(0, 4)}-${String(Date.now()).slice(-4)}`;
}

function niveauLabel(n: NiveauScolaire) {
  return NIVEAUX.find(x => x.value === n)?.label ?? n;
}

function statutBadge(s: StatutAdmission) {
  const found = STATUTS.find(x => x.value === s);
  return found
    ? <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${found.color}`}>{found.label}</span>
    : null;
}

function regimeBadge(r: RegimeFinancier) {
  const found = REGIMES.find(x => x.value === r);
  return found
    ? <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${found.color}`}>{found.label}</span>
    : null;
}

// ─── Formulaire vide ─────────────────────────────────────────────────────────

const emptyForm = (annee = ''): Partial<Eleve> => ({
  matricule: '',
  nom: '',
  prenom: '',
  dateNaissance: '',
  lieuNaissance: '',
  niveau: 'PS',
  classeId: undefined,
  regimeFinancier: 'NORMAL',
  remisePct: 0,
  cantine: false,
  transportBus: false,
  garderie: false,
  photoUrl: '',
  besoinSpecifique: '',
  statut: 'INSCRIT',
  dateAdmission: new Date().toISOString().slice(0, 10),
  whatsappPrincipal: '',
  anneeScolaire: annee,
  parent1: { nom: '', prenom: '', telephone: '', whatsapp: '', email: '', lien: 'MERE' },
  parent2: undefined,
  contactUrgence: undefined,
  personneAutorisee: undefined,
});

// Niveaux maternelle : la garderie n'est proposée que pour eux
const NIVEAUX_MATERNELLE = ['CRECHE', 'PS', 'MS', 'GS'];

// Dossier soumis via le portail parent (tag [parent_user:] dans notes)
const isFromParent = (d: any) => typeof d.notes === 'string' && d.notes.includes('[parent_user:');

// ─── Document helpers (délégués à adminDocsPdf.ts) ───────────────────────────

// ─── Composant principal ─────────────────────────────────────────────────────

interface ElevesProps {
  user: User;
  currency: string;
  refreshKey?: number;
}

// ─── Bouton facture d'inscription ─────────────────────────────────────────
const NIVEAUX_LABELS_MAP: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const METHODES_PAIEMENT = [
  { value: 'CASH',         label: 'Espèces' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'WAVE',         label: 'Wave' },
  { value: 'MTN_MOMO',     label: 'MTN MoMo' },
  { value: 'TRANSFER',     label: 'Virement' },
  { value: 'CHEQUE',       label: 'Chèque' },
];

const RECURRING_TYPES = ['MENSUALITE', 'BUS', 'CANTINE'];

const InscriptionFactureButton: React.FC<{
  inscritEleve: Partial<Eleve> | null;
  servicesApplicables: any[];
  currency: string;
}> = ({ inscritEleve, servicesApplicables, currency }) => {
  const showToast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [methodePaiement, setMethodePaiement] = React.useState('CASH');

  // Séparer frais d'inscription des services récurrents
  const feeServices = servicesApplicables.filter(s => {
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    return !RECURRING_TYPES.includes(type);
  });
  const recurringServices = servicesApplicables.filter(s => {
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    return RECURRING_TYPES.includes(type);
  });

  // Remise cas social — même logique que le backend (factureInscription)
  const remisePct = inscritEleve?.regimeFinancier === 'CAS_SOCIAL_TOTAL'
    ? 100
    : Number(inscritEleve?.remisePct || 0);
  const applyRemise = (prix: number) => remisePct > 0
    ? Math.round(prix * (1 - remisePct / 100))
    : prix;

  const totalFees = feeServices.reduce((sum, s) => sum + applyRemise(Number(s.price)), 0);

  const handleGenerate = async () => {
    if (!inscritEleve?.id || feeServices.length === 0) return;
    setLoading(true);
    try {
      const res: any = await apiClient.post(
        `/eleves/${inscritEleve.id}/facture-inscription`,
        { services: servicesApplicables, methodePaiement }
      );

      const invoiceData: StudentInvoiceData = {
        type: 'RECU',
        eleve: {
          nom: inscritEleve.nom || '',
          prenom: inscritEleve.prenom || '',
          matricule: inscritEleve.matricule,
          niveau: NIVEAUX_LABELS_MAP[inscritEleve.niveau as string] || inscritEleve.niveau,
        },
        parent1: inscritEleve.parent1,
        period: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        currency,
        reference: res?.sale?.reference,
        methodePaiement,
        echeances: feeServices.map(s => ({
          service: { name: s.name + (remisePct > 0 ? ` (remise ${remisePct}%)` : '') },
          periodeLabel: 'Ponctuel',
          montant: applyRemise(Number(s.price)),
          statut: 'PAYE',
          dateEcheance: new Date().toISOString().slice(0, 10),
          description: s.name,
        })),
        totalDu: totalFees,
        totalPaye: totalFees,
        solde: 0,
      };

      openInvoicePrintWindow(invoiceData);
      showToast('Reçu généré — enregistrez-le en PDF depuis le dialogue d\'impression.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la génération du reçu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!inscritEleve?.id || feeServices.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {recurringServices.length > 0 && (
        <p className="text-[9px] text-slate-400 text-center">
          Les mensualités/bus/cantine seront gérés via le Recouvrement
        </p>
      )}
      <div className="flex gap-2">
        <select
          value={methodePaiement}
          onChange={e => setMethodePaiement(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
        >
          {METHODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
        >
          {loading
            ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Traitement…</>
            : <><FileText size={12} /> Encaisser & Reçu</>}
        </button>
      </div>
      <p className="text-[9px] text-emerald-700 font-bold text-center">
        Frais d'inscription : {totalFees.toLocaleString('fr-FR')} {currency}
        {remisePct > 0 && <span className="text-violet-600"> — remise cas social {remisePct}% appliquée</span>}
      </p>
    </div>
  );
};

const Eleves: React.FC<ElevesProps> = ({ user, currency, refreshKey }) => {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [showModal, setShowModal] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Eleve | null>(null);
  const [formData, setFormData] = useState<Partial<Eleve>>(emptyForm(/* will be set by ANNEE_COURANTE on first use */));
  // Duplication d'une inscription (fratrie) : identité de l'enfant source à ne pas
  // recopier telle quelle — l'enregistrement est bloqué tant qu'elle n'a pas changé.
  const [duplicateSource, setDuplicateSource] = useState<{ nom: string; prenom: string; dateNaissance: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    niveau: 'ALL' as NiveauScolaire | 'ALL',
    statut: 'ALL' as StatutAdmission | 'ALL',
    regime: 'ALL' as RegimeFinancier | 'ALL',
  });

  // ── Création multi-étapes ──────────────────────────────────────────────────
  const [createStep, setCreateStep] = useState<'SELECTION' | 'FORM' | 'DOCS'>('SELECTION');
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(false);
  const [admissionSearch, setAdmissionSearch] = useState('');
  const [inscritEleve, setInscritEleve] = useState<Partial<Eleve> | null>(null);
  // Codes (typeDoc) des pièces justificatives déjà présentes dans le dossier numérique
  const [piecesFournies, setPiecesFournies] = useState<Set<string>>(new Set());

  // À l'ouverture de l'étape « Dossier constitué », charger les pièces déjà
  // versées au dossier numérique (jointes lors de la demande d'admission)
  useEffect(() => {
    if (createStep !== 'DOCS' || !inscritEleve?.id) { setPiecesFournies(new Set()); return; }
    apiClient.get(`/eleves/${inscritEleve.id}/dossier/admin`)
      .then((docs: any) => {
        const list = Array.isArray(docs) ? docs : [];
        setPiecesFournies(new Set(list.map((d: any) => d.typeDoc)));
      })
      .catch(() => setPiecesFournies(new Set()));
  }, [createStep, inscritEleve?.id]);
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [servicesApplicables, setServicesApplicables] = useState<any[]>([]);

  // ── Abonnements & Échéances ────────────────────────────────────────────────
  const [abonnements, setAbonnements] = useState<any[]>([]);
  const [abonnementsLoading, setAbonnementsLoading] = useState(false);
  const [allServicesRecurrents, setAllServicesRecurrents] = useState<any[]>([]);
  const [showAddAbonnement, setShowAddAbonnement] = useState(false);
  const [newAboForm, setNewAboForm] = useState({ serviceId: '', dateDebut: new Date().toISOString().slice(0, 10) });
  const [aboActionLoading, setAboActionLoading] = useState(false);
  const [expandedAbos, setExpandedAbos] = useState<Set<string>>(new Set());
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [viewDocLoading, setViewDocLoading] = useState<string | null>(null);
  const [showDossier, setShowDossier] = useState(false);
  const [reinscModal, setReinscModal] = useState<Eleve | null>(null);
  const [reinscNiveau, setReinscNiveau] = useState<NiveauScolaire>('PS');
  const [reinscClasseId, setReinscClasseId] = useState<string>('');
  const [reinscAnneeTarget, setReinscAnneeTarget] = useState<string>('');
  const [reinscLoading, setReinscLoading] = useState(false);
  const [classesNextYear, setClassesNextYear] = useState<any[]>([]);

  // ── Réinscription groupée ──────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkReinsc, setShowBulkReinsc] = useState(false);
  const [bulkAnnee, setBulkAnnee] = useState('');
  const [bulkProgression, setBulkProgression] = useState<'AUTO' | 'SAME'>('AUTO');
  const [bulkClassesTarget, setBulkClassesTarget] = useState<any[]>([]);
  const [bulkClassesByNiveau, setBulkClassesByNiveau] = useState<Record<string, string>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ id: string; prenom: string; nom: string; ok: boolean; msg?: string }[]>([]);
  // Matricules déjà inscrits dans l'année active (pour filtrer les éligibles à la réinscription)
  const [matriculesAnneeActive, setMatriculesAnneeActive] = useState<Set<string>>(new Set());

  // ── Compte parent ──────────────────────────────────────────────────────────
  const [parentsByEleveId, setParentsByEleveId] = useState<Record<string, any[]>>({});
  const [showParentAccountModal, setShowParentAccountModal] = useState(false);
  const [parentAccountForm, setParentAccountForm] = useState({ email: '', nom: '', prenom: '', motDePasseTemporaire: '' });
  const [parentAccountLoading, setParentAccountLoading] = useState(false);
  const [parentAccountResult, setParentAccountResult] = useState<{ created: boolean; tempPassword?: string } | null>(null);

  const showToast = useToast();
  const { annee: ANNEE_COURANTE, anneeNext, isReadOnly, anneesDisponibles, anneeActiveToday } = useAnnee();
  const canModify = authBridge.canPerform(user, 'EDIT', 'eleves') && !isReadOnly;
  const canDelete  = authBridge.canPerform(user, 'DELETE', 'eleves') && !isReadOnly;
  // La réinscription n'a de sens que depuis une année clôturée vers l'année active
  const canReinscribe = authBridge.canPerform(user, 'EDIT', 'eleves') && isReadOnly;

  // ── Fetch élèves ───────────────────────────────────────────────────────────

  const fetchEleves = async () => {
    setLoading(true);
    setError(null);
    try {
      const [elevesData, classesData, parentData] = await Promise.all([
        apiClient.get('/eleves', { params: { anneeScolaire: ANNEE_COURANTE } }),
        apiClient.get('/classes', { params: { anneeScolaire: ANNEE_COURANTE } }),
        apiClient.get('/admin/parent-accounts').catch(() => ({ byEleveId: {} })),
      ]);
      const rawEleves = (Array.isArray(elevesData) ? elevesData : (elevesData?.rows ?? elevesData?.eleves ?? []))
        // Les candidatures (EN_ATTENTE/ADMIS) n'appartiennent pas à la liste des élèves inscrits
        .filter((e: any) => e.statut !== 'EN_ATTENTE' && e.statut !== 'ADMIS');
      setEleves([...new Map(rawEleves.map((e: any) => [e.id, e])).values()]);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setParentsByEleveId((parentData as any)?.byEleveId || {});
    } catch {
      setEleves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEleves(); }, [refreshKey, ANNEE_COURANTE]);

  // Charge les matricules déjà inscrits dans l'année active pour identifier les éligibles
  useEffect(() => {
    if (!isReadOnly) { setMatriculesAnneeActive(new Set()); return; }
    apiClient.get('/eleves', { params: { anneeScolaire: anneeActiveToday } })
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.rows ?? data?.eleves ?? []);
        setMatriculesAnneeActive(new Set(list.map((e: any) => e.matricule)));
      })
      .catch(() => setMatriculesAnneeActive(new Set()));
  }, [isReadOnly, anneeActiveToday]);

  // ── Réinscription ──────────────────────────────────────────────────────────

  const NIVEAU_PROGRESSION: Record<NiveauScolaire, NiveauScolaire> = {
    CRECHE: 'PS', PS: 'MS', MS: 'GS', GS: 'CP',
    CP: 'CE1', CE1: 'CE2', CE2: 'CM1', CM1: 'CM2', CM2: 'CM2',
  };

  const openReinscModal = async (eleve: Eleve) => {
    const nextNiveau = NIVEAU_PROGRESSION[eleve.niveau] ?? eleve.niveau;
    setReinscModal(eleve);
    setReinscNiveau(nextNiveau as NiveauScolaire);
    setReinscClasseId('');
    try {
      const data = await apiClient.get('/classes');
      setClassesNextYear(Array.isArray(data) ? data : []);
    } catch {
      setClassesNextYear([]);
    }
  };

  const handleReinscription = async () => {
    if (!reinscModal) return;
    setReinscLoading(true);
    try {
      await apiClient.post(`/eleves/${reinscModal.id}/reinscription`, {
        newAnneeScolaire: anneeActiveToday,
        newNiveau: reinscNiveau,
        newClasseId: reinscClasseId || null,
      });
      showToast(`${reinscModal.prenom} ${reinscModal.nom} réinscrit(e) pour ${anneeActiveToday}`, 'success');
      setMatriculesAnneeActive(prev => new Set([...prev, reinscModal.matricule]));
      setReinscModal(null);
      fetchEleves();
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la réinscription';
      showToast(msg, 'error');
    } finally {
      setReinscLoading(false);
    }
  };

  // ── Réinscription groupée ──────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligibles = filtered.filter(e => !matriculesAnneeActive.has(e.matricule));
    if (selectedIds.size === eligibles.length && eligibles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibles.map(e => e.id)));
    }
  };

  const openBulkReinscModal = async () => {
    setBulkProgression('AUTO');
    setBulkClassesByNiveau({});
    setBulkResults([]);
    try {
      const data = await apiClient.get('/classes');
      setBulkClassesTarget(Array.isArray(data) ? data : []);
    } catch {
      setBulkClassesTarget([]);
    }
    setShowBulkReinsc(true);
  };

  const handleBulkReinscription = async () => {
    // Seuls les élèves pas encore inscrits dans l'année active
    const selected = eleves.filter(e => selectedIds.has(e.id) && !matriculesAnneeActive.has(e.matricule));
    setBulkLoading(true);
    setBulkResults([]);
    const settled = await Promise.allSettled(
      selected.map(eleve => {
        const newNiveau = bulkProgression === 'AUTO'
          ? (NIVEAU_PROGRESSION[eleve.niveau] ?? eleve.niveau)
          : eleve.niveau;
        const newClasseId = bulkClassesByNiveau[newNiveau] || null;
        return apiClient.post(`/eleves/${eleve.id}/reinscription`, {
          newAnneeScolaire: anneeActiveToday,
          newNiveau,
          newClasseId,
        }).then(() => ({ id: eleve.id, prenom: eleve.prenom, nom: eleve.nom, ok: true }))
          .catch((err: any) => ({ id: eleve.id, prenom: eleve.prenom, nom: eleve.nom, ok: false, msg: err?.message || 'Erreur' }));
      })
    );
    const res = settled.map(r => r.status === 'fulfilled' ? r.value : { ...(r as any).reason, ok: false });
    setBulkResults(res);
    setBulkLoading(false);
    const successCount = res.filter(r => r.ok).length;
    if (successCount > 0) {
      showToast(`${successCount} élève(s) réinscrit(s) pour ${anneeActiveToday}`, 'success');
      // Mettre à jour le set local pour refléter les nouvelles inscriptions
      const newMatricules = selected.filter((_, i) => res[i]?.ok).map(e => e.matricule);
      setMatriculesAnneeActive(prev => new Set([...prev, ...newMatricules]));
      fetchEleves();
    }
    if (res.every(r => r.ok)) {
      setShowBulkReinsc(false);
      setSelectedIds(new Set());
      setBulkMode(false);
    }
  };

  // ── Fetch dossiers d'admission (EN_ATTENTE + ADMIS — pas encore inscrits) ────

  const resolveStatut = (d: any): StatutAdmission => {
    if (d.statut) return d.statut as StatutAdmission;
    const api = (d.status || '').toLowerCase();
    const MAP: Record<string, StatutAdmission> = {
      admis: 'ADMIS', en_attente: 'EN_ATTENTE', actif: 'ACTIF',
      inscrit: 'INSCRIT', radie: 'RADIE', suspendu: 'SUSPENDU',
    };
    return MAP[api] ?? 'EN_ATTENTE';
  };

  // Aplatit un objet Eleve (JSONB parent1/parent2/ficheSanitaire) en champs plats
  // attendus par selectDossierForInscription (companyName, mainContact, billingAddress, …)
  const normalizeEleveDossier = (e: any) => {
    const p1 = e.parent1 || {};
    const p2 = e.parent2 || {};
    const urgence = e.contactUrgence || {};
    const fs = e.ficheSanitaire || {};
    return {
      ...e,
      ...fs,
      companyName:    `${e.prenom || ''} ${e.nom || ''}`.trim(),
      mainContact:    `${p1.prenom || ''} ${p1.nom || ''}`.trim(),
      phone:          p1.telephone || p1.tel || '',
      email:          p1.email || '',
      billingAddress: e.lieuNaissance || '',
      parent1Nom:     p1.nom || '',
      parent1Prenom:  p1.prenom || '',
      parent1Tel:     p1.telephone || p1.tel || '',
      parent1Whatsapp:p1.whatsapp || p1.telephone || p1.tel || '',
      parent1Email:   p1.email || '',
      parent1Lien:    p1.lien || 'MERE',
      parent1TelDomicile: p1.telDomicile || '',
      parent1TelTravail:  p1.telTravail || '',
      parent1Adresse:     p1.adresse || '',
      parent1Profession:  p1.profession || '',
      parent1Entreprise:  p1.entreprise || '',
      parent2Nom:     p2.nom || '',
      parent2Prenom:  p2.prenom || '',
      parent2Lien:    p2.lien || 'PERE',
      parent2Tel:     p2.telephone || p2.tel || '',
      parent2TelDomicile: p2.telDomicile || '',
      parent2TelTravail:  p2.telTravail || '',
      parent2Profession:  p2.profession || '',
      parent2Entreprise:  p2.entreprise || '',
      urgenceNom:  urgence.nom || '',
      urgenceTel:  urgence.telephone || urgence.tel || '',
      urgenceLien: urgence.lien || '',
    };
  };

  const fetchAdmissions = async () => {
    setAdmissionsLoading(true);
    try {
      // Les dossiers de candidature sont dans la table eleves (statut EN_ATTENTE ou ADMIS)
      const data = await apiClient.get('/eleves', { params: { anneeScolaire: ANNEE_COURANTE } });
      const list = Array.isArray(data) ? data : (data?.rows ?? data?.eleves ?? []);
      // Garder EN_ATTENTE et ADMIS, normaliser les champs JSONB pour le préremplissage
      setAdmissions(
        list
          .filter((d: any) => { const s = resolveStatut(d); return s === 'EN_ATTENTE' || s === 'ADMIS'; })
          .map(normalizeEleveDossier)
      );
    } catch {
      setAdmissions([]);
    } finally {
      setAdmissionsLoading(false);
    }
  };

  // ── Préremplissage depuis un dossier d'admission ───────────────────────────

  const selectDossierForInscription = (d: any) => {
    const fullName = (d.companyName || d.name || '').trim();
    const parts = fullName.split(' ');
    const prenom = parts[0] || '';
    const nom = parts.slice(1).join(' ') || '';

    const parentFull = (d.mainContact || '').trim();
    const pParts = parentFull.split(' ');
    const p1Prenom = pParts[0] || '';
    const p1Nom = pParts.slice(1).join(' ') || '';

    const emailIsGenerated = (d.email || '').includes('@letoidesanges.sn');

    setSelectedDossierId(d.id || null);
    setFormData({
      nom,
      prenom,
      dateNaissance: d.dateNaissance || '',
      lieuNaissance: d.billingAddress || '',
      niveau: (d.niveau as NiveauScolaire) || 'PS',
      regimeFinancier: (d.regimeFinancier as RegimeFinancier) || 'NORMAL',
      remisePct: d.remisePct || 0,
      cantine: !!d.cantine,
      transportBus: !!(d.transportBus || d.transport_bus),
      garderie: !!d.garderie,
      photoUrl: d.photoUrl || '',
      besoinSpecifique: d.besoinSpecifique || '',
      statut: 'INSCRIT',
      dateAdmission: new Date().toISOString().slice(0, 10),
      anneeScolaire: ANNEE_COURANTE,
      whatsappPrincipal: d.parent1Whatsapp || d.phone || '',
      parent1: {
        nom: p1Nom || p1Prenom,
        prenom: p1Nom ? p1Prenom : '',
        telephone: d.phone || '',
        whatsapp: d.parent1Whatsapp || d.phone || '',
        email: emailIsGenerated ? '' : (d.email || ''),
        lien: (d.parent1Lien as any) || 'MERE',
        telDomicile: d.parent1TelDomicile || '',
        telTravail: d.parent1TelTravail || '',
        adresse: d.parent1Adresse || '',
        profession: d.parent1Profession || '',
        entreprise: d.parent1Entreprise || '',
      },
      parent2: (d.parent2Nom || d.parent2Prenom) ? {
        nom: d.parent2Nom || '',
        prenom: d.parent2Prenom || '',
        telephone: d.parent2Tel || '',
        whatsapp: d.parent2Tel || '',
        lien: (d.parent2Lien as any) || 'PERE',
        telDomicile: d.parent2TelDomicile || '',
        telTravail: d.parent2TelTravail || '',
        profession: d.parent2Profession || '',
        entreprise: d.parent2Entreprise || '',
      } : undefined,
      contactUrgence: d.urgenceNom ? {
        nom: d.urgenceNom,
        prenom: '',
        telephone: d.urgenceTel || '',
        lien: d.urgenceLien || '',
      } : undefined,
      personneAutorisee: d.personneAutorisee || undefined,
      // ── Fiche sanitaire ───────────────────────────────────────────────────
      sexe: (d.sexe || '') as any,
      vaccDiphterie:   !!d.vaccDiphterie,   vaccDiphterieDate:   d.vaccDiphterieDate || '',
      vaccTetanos:     !!d.vaccTetanos,     vaccTetanosDate:     d.vaccTetanosDate || '',
      vaccPolio:       !!d.vaccPolio,       vaccPolioDate:       d.vaccPolioDate || '',
      vaccCoqueluche:  !!d.vaccCoqueluche,  vaccCoquelucheDate:  d.vaccCoquelucheDate || '',
      vaccBCG:         !!d.vaccBCG,         vaccBCGDate:         d.vaccBCGDate || '',
      vaccHepB:        !!d.vaccHepB,        vaccHepBDate:        d.vaccHepBDate || '',
      vaccROR:         !!d.vaccROR,         vaccRORDate:         d.vaccRORDate || '',
      certifContrIndication: !!d.certifContrIndication,
      traitementMedical: !!d.traitementMedical,
      traitementDetail:   d.traitementDetail || '',
      maladieRubeole:     !!d.maladieRubeole,
      maladieVaricelle:   !!d.maladieVaricelle,
      maladieAngine:      !!d.maladieAngine,
      maladieRhumatisme:  !!d.maladieRhumatisme,
      maladieScarlatine:  !!d.maladieScarlatine,
      maladieCoqueluche:  !!d.maladieCoqueluche,
      maladieOtite:       !!d.maladieOtite,
      maladieRougeole:    !!d.maladieRougeole,
      maladieOreillons:   !!d.maladieOreillons,
      allergieAsthme:      !!d.allergieAsthme,
      allergieMedicament:  !!d.allergieMedicament,
      allergieAlimentaire: !!d.allergieAlimentaire,
      allergieAutres:      d.allergieAutres || '',
      allergieConduite:    d.allergieConduite || '',
      difficulteSante:     d.difficulteSante || '',
      equipeLunettes:         !!d.equipeLunettes,
      equipeLentilles:        !!d.equipeLentilles,
      equipeProtheseAuditive: !!d.equipeProtheseAuditive,
      equipeProtheseDentaire: !!d.equipeProtheseDentaire,
      equipePrecisions:       d.equipePrecisions || '',
      mouillerLit:  (d.mouillerLit || '') as any,
      medecinNom:   d.medecinNom || '',
      medecinTel:   d.medecinTel || '',
      autorisationPhoto: d.autorisationPhoto !== false,
      autorisationSoins: d.autorisationSoins !== false,
    });
    setCreateStep('FORM');
  };

  // ── Charger les offres de scolarité applicables pour un niveau ─────────────

  const loadServicesApplicables = async (niveau: NiveauScolaire, cantine: boolean, bus: boolean) => {
    try {
      const data = await apiClient.get('/services');
      const list: any[] = Array.isArray(data) ? data : [];
      const filtered = list.filter(s => {
        // Exclure les services inactifs
        if (s.isActive === false || s.is_active === false) return false;

        const niveaux: string[] = s.niveauxCibles || s.niveaux_cibles || [];
        const type = (s.typeOffre || s.type_offre || '').toUpperCase();

        // Un service sans niveaux cibles ne s'applique qu'aux frais ponctuels (inscription, frais admin)
        // Les mensualités/cantine/bus doivent explicitement cibler un niveau
        if (niveaux.length === 0) {
          // Inclure seulement si ce n'est pas une mensualité ou un service de transport/restauration
          return type !== 'MENSUALITE' && type !== 'BUS' && type !== 'CANTINE';
        }

        if (!niveaux.includes(niveau)) return false;

        if (type === 'BUS')     return bus;
        if (type === 'CANTINE') return cantine;
        return true;
      });
      setServicesApplicables(filtered);
    } catch {
      setServicesApplicables([]);
    }
  };

  const fetchAbonnements = async (eleveId: string) => {
    setAbonnementsLoading(true);
    try {
      const data = await apiClient.get(`/abonnements/eleve/${eleveId}`);
      setAbonnements(Array.isArray(data) ? data : []);
    } catch {
      setAbonnements([]);
    } finally {
      setAbonnementsLoading(false);
    }
  };

  const loadServicesRecurrents = async () => {
    try {
      const data = await apiClient.get('/services');
      const list: any[] = Array.isArray(data) ? data : [];
      setAllServicesRecurrents(list.filter(s => s.isActive && (s.estRecurrent || s.est_recurrent)));
    } catch {
      setAllServicesRecurrents([]);
    }
  };

  const handleAddAbonnement = async () => {
    if (!selectedEleve?.id || !newAboForm.serviceId) return;
    setAboActionLoading(true);
    try {
      await apiClient.post('/abonnements', {
        eleveId: selectedEleve.id,
        serviceId: newAboForm.serviceId,
        dateDebut: newAboForm.dateDebut,
      });
      setShowAddAbonnement(false);
      setNewAboForm({ serviceId: '', dateDebut: new Date().toISOString().slice(0, 10) });
      fetchAbonnements(selectedEleve.id);
      showToast('Abonnement créé. Les échéances ont été générées.', 'success');
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de la création de l'abonnement.", 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  const handleDesactiverAbonnement = async (aboId: string) => {
    if (!selectedEleve?.id) return;
    setAboActionLoading(true);
    try {
      await apiClient.put(`/abonnements/${aboId}/desactiver`, {});
      fetchAbonnements(selectedEleve.id);
      showToast('Abonnement désactivé.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur.', 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  const handlePayEcheance = async (echeanceId: string) => {
    if (!selectedEleve?.id) return;
    setAboActionLoading(true);
    try {
      await apiClient.put(`/abonnements/echeances/${echeanceId}/payer`, { methodePaiement: 'CASH' });
      fetchAbonnements(selectedEleve.id);
      showToast('Échéance marquée comme payée.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur.', 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  // ── Filtrage ───────────────────────────────────────────────────────────────

  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const filtered = eleves.filter(e => {
    if (filters.search.trim()) {
      const q = normalize(filters.search);
      const nomPrenom  = normalize(`${e.nom} ${e.prenom}`);
      const prenomNom  = normalize(`${e.prenom} ${e.nom}`);
      const matricule  = normalize(e.matricule || '');
      const parent     = normalize(`${e.parent1?.prenom || ''} ${e.parent1?.nom || ''}`);
      if (!nomPrenom.includes(q) && !prenomNom.includes(q) && !matricule.includes(q) && !parent.includes(q)) return false;
    }
    if (filters.niveau !== 'ALL' && e.niveau !== filters.niveau) return false;
    if (filters.statut !== 'ALL' && e.statut !== filters.statut) return false;
    if (filters.regime !== 'ALL' && e.regimeFinancier !== filters.regime) return false;
    return true;
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const activeEleves = eleves.filter(e => e.statut === 'INSCRIT' || e.statut === 'ACTIF');

  const kpis = {
    total:    activeEleves.length,
    garcons:  activeEleves.filter(e => e.sexe === 'M').length,
    filles:   activeEleves.filter(e => e.sexe === 'F').length,
    cantine:  activeEleves.filter(e => e.cantine).length,
    cassocial: activeEleves.filter(e => e.regimeFinancier !== 'NORMAL').length,
    besoins:  activeEleves.filter(e => e.besoinSpecifique).length,
  };

  // Répartition par niveau (élèves actifs uniquement)
  const niveauxStats = NIVEAUX.map(n => ({
    ...n,
    count: activeEleves.filter(e => e.niveau === n.value).length,
  })).filter(n => n.count > 0);

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const p1Phone = formData.parent1?.whatsapp?.trim() || formData.parent1?.telephone?.trim();
    if (!formData.nom?.trim())           { setError('Le nom de l\'élève est obligatoire.'); return; }
    if (!formData.prenom?.trim())        { setError('Le prénom de l\'élève est obligatoire.'); return; }
    if (!formData.niveau)                { setError('Le niveau scolaire est obligatoire.'); return; }
    if (!formData.dateNaissance)         { setError('La date de naissance est obligatoire.'); return; }
    // Duplication : interdit de recopier à l'identique l'enfant source (fratrie)
    if (duplicateSource) {
      const norm = (s: string) => (s || '').trim().toLowerCase();
      if (norm(formData.prenom) === norm(duplicateSource.prenom)) {
        setError('Duplication : modifiez au moins le prénom de l\'enfant (il ne peut pas être identique à celui du dossier dupliqué).');
        return;
      }
    }
    if (showModal === 'CREATE' && !p1Phone) { setError('Le numéro WhatsApp ou téléphone du parent est obligatoire.'); return; }
    setActionLoading(true);
    setError(null);
    try {
      const payload: Partial<Eleve> = {
        ...formData,
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        matricule: formData.matricule || genMatricule(formData.niveau as NiveauScolaire),
        anneeScolaire: ANNEE_COURANTE,
        whatsappPrincipal: formData.parent1?.whatsapp?.trim() || formData.whatsappPrincipal || '',
        // Toujours INSCRIT à la création — non modifiable depuis ce formulaire
        ...(showModal === 'CREATE' && {
          statut: 'INSCRIT',
          dateAdmission: formData.dateAdmission || new Date().toISOString().slice(0, 10),
        }),
      };
      if (showModal === 'EDIT' && selectedEleve?.id) {
        // ── Modification d'un élève existant ──────────────────────────────────
        await apiClient.put(`/eleves/${selectedEleve.id}`, payload);
        showToast('Fiche élève mise à jour.', 'success');
        setShowModal(null);
        setSelectedEleve(null);
        fetchEleves();
      } else if (selectedDossierId) {
        // ── Inscription depuis un dossier de candidature ───────────────────────
        // On met à jour le dossier existant (évite le doublon qu'un POST créerait)
        const updated: any = await apiClient.put(`/eleves/${selectedDossierId}`, {
          ...payload,
          statut: 'INSCRIT',
          dateAdmission: payload.dateAdmission || new Date().toISOString().slice(0, 10),
          matricule: payload.matricule || genMatricule(payload.niveau as NiveauScolaire),
        });
        setInscritEleve({ ...payload, id: updated?.id || selectedDossierId });
        setAdmissions(prev => prev.filter(d => d.id !== selectedDossierId));
        showToast('Élève inscrit avec succès.', 'success');
        loadServicesApplicables(payload.niveau as NiveauScolaire, !!payload.cantine, !!payload.transportBus);
        setCreateStep('DOCS');
        fetchEleves();
      } else {
        // ── Création directe d'un élève (sans dossier préalable) ──────────────
        const created: any = await apiClient.post('/eleves', payload);
        if (created?.id) setInscritEleve({ ...payload, id: created.id });
        showToast('Élève inscrit avec succès.', 'success');
        if (!created?.id) setInscritEleve(payload);
        loadServicesApplicables(payload.niveau as NiveauScolaire, !!payload.cantine, !!payload.transportBus);
        setCreateStep('DOCS');
        fetchEleves();
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (eleve: Eleve) => {
    setActionLoading(true);
    try {
      await apiClient.delete(`/eleves/${eleve.id}`);
      showToast('Élève supprimé.', 'success');
      setShowDeleteConfirm(null);
      fetchEleves();
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la suppression.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openCreate = () => {
    setFormData(emptyForm(ANNEE_COURANTE));
    setDuplicateSource(null);
    setError(null);
    setCreateStep('SELECTION');
    setAdmissionSearch('');
    setInscritEleve(null);
    fetchAdmissions();
    setShowModal('CREATE');
  };

  const openEdit = (e: Eleve) => {
    setSelectedEleve(e);
    setFormData({ ...e });
    setDuplicateSource(null);
    setError(null);
    setShowModal('EDIT');
  };

  // Duplication pour une fratrie : on repart de l'élève source en conservant la
  // famille (parents, contacts, adresse, régime) et en vidant l'identité de l'enfant.
  const openDuplicate = (e: Eleve) => {
    setSelectedEleve(null);
    setInscritEleve(null);
    setFormData({
      ...emptyForm(ANNEE_COURANTE),
      // Famille conservée
      nom: e.nom,                          // nom de famille (fratrie)
      parent1: e.parent1 ? { ...e.parent1 } : emptyForm().parent1,
      parent2: e.parent2 ? { ...e.parent2 } : undefined,
      contactUrgence: e.contactUrgence ? { ...e.contactUrgence } : undefined,
      personneAutorisee: (e as any).personneAutorisee ? { ...(e as any).personneAutorisee } : undefined,
      whatsappPrincipal: e.whatsappPrincipal || '',
      regimeFinancier: e.regimeFinancier || 'NORMAL',
      remisePct: e.remisePct || 0,
      niveau: e.niveau || 'PS',
      // Identité de l'enfant : à ressaisir (prénom, naissance, sexe, photo…)
      prenom: '', dateNaissance: '', lieuNaissance: '', sexe: '',
      photoUrl: '', matricule: '', classeId: undefined,
      besoinSpecifique: '',
    });
    setDuplicateSource({ nom: e.nom || '', prenom: e.prenom || '', dateNaissance: e.dateNaissance || '' });
    setError(null);
    setCreateStep('FORM');
    setShowModal('CREATE');
  };

  const openView = (e: Eleve) => {
    setSelectedEleve(e);
    setShowModal('VIEW');
    setAbonnements([]);
    setShowAddAbonnement(false);
    setExpandedAbos(new Set());
    fetchAbonnements(e.id);
    loadServicesRecurrents();
  };

  const closeCreateModal = () => {
    setShowModal(null);
    setCreateStep('SELECTION');
    setSelectedDossierId(null);
    setServicesApplicables([]);
    setDuplicateSource(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* En-tête + bouton créer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <GraduationCap className="text-indigo-600" size={32} /> Gestion des Élèves
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Année scolaire {ANNEE_COURANTE}
          </p>
        </div>
        {canModify && (
          <button
            onClick={openCreate}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
          >
            <Plus size={18} /> Inscrire un Élève
          </button>
        )}
      </div>

      {/* Bannière lecture seule */}
      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <Lock size={16} className="shrink-0 text-amber-600" />
          <p className="text-[11px] font-bold">
            <strong>Mode lecture seule — {ANNEE_COURANTE}.</strong> Cette année scolaire est terminée. Vous pouvez consulter les données mais aucune modification n'est autorisée.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Élèves inscrits',    value: kpis.total,     icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50',  sub: `${eleves.filter(e => e.statut === 'RADIE' || e.statut === 'SUSPENDU').length} inactifs` },
          { label: 'Cantine',            value: kpis.cantine,   icon: Baby,      color: 'text-sky-600',     bg: 'bg-sky-50',      sub: kpis.total > 0 ? `${Math.round(kpis.cantine / kpis.total * 100)}%` : '—' },
          { label: 'Cas sociaux',        value: kpis.cassocial, icon: Heart,     color: 'text-rose-600',    bg: 'bg-rose-50',     sub: kpis.total > 0 ? `${Math.round(kpis.cassocial / kpis.total * 100)}%` : '—' },
          { label: 'Besoins spécifiques',value: kpis.besoins,   icon: Clock,     color: 'text-violet-600',  bg: 'bg-violet-50',   sub: kpis.besoins === 0 ? 'Aucun' : 'suivi requis' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <kpi.icon className={kpi.color} size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{kpi.value}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Répartition par niveau + sexe */}
      {niveauxStats.length > 0 && (
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-5">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition par niveau</p>
            <div className="flex flex-wrap gap-3">
              {niveauxStats.map(n => {
                const pct = kpis.total > 0 ? Math.round(n.count / kpis.total * 100) : 0;
                return (
                  <div key={n.value} className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{n.label}</span>
                    <span className="text-sm font-black text-slate-900">{n.count}</span>
                    <span className="text-[9px] text-slate-400">({pct}%)</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex rounded-full overflow-hidden h-2 gap-0.5">
              {niveauxStats.map((n, i) => {
                const pct = kpis.total > 0 ? (n.count / kpis.total * 100) : 0;
                const colors = ['bg-indigo-400','bg-sky-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-violet-400','bg-teal-400','bg-orange-400','bg-pink-400'];
                return <div key={n.value} style={{ width: `${pct}%` }} className={`${colors[i % colors.length]} h-full`} title={`${n.label}: ${n.count}`} />;
              })}
            </div>
          </div>

          {/* Répartition par sexe */}
          <div className="border-t border-slate-50 pt-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition par sexe</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2">
                <span className="text-sky-600 font-black text-sm">♂</span>
                <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest">Garçons</span>
                <span className="text-sm font-black text-slate-900">{kpis.garcons}</span>
                <span className="text-[9px] text-slate-400">({kpis.total > 0 ? Math.round(kpis.garcons / kpis.total * 100) : 0}%)</span>
              </div>
              <div className="flex items-center gap-2 bg-pink-50 border border-pink-100 rounded-xl px-4 py-2">
                <span className="text-pink-500 font-black text-sm">♀</span>
                <span className="text-[9px] font-black text-pink-600 uppercase tracking-widest">Filles</span>
                <span className="text-sm font-black text-slate-900">{kpis.filles}</span>
                <span className="text-[9px] text-slate-400">({kpis.total > 0 ? Math.round(kpis.filles / kpis.total * 100) : 0}%)</span>
              </div>
              {(kpis.total - kpis.garcons - kpis.filles) > 0 && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Non renseigné</span>
                  <span className="text-sm font-black text-slate-900">{kpis.total - kpis.garcons - kpis.filles}</span>
                </div>
              )}
            </div>
            {kpis.total > 0 && (
              <div className="mt-3 flex rounded-full overflow-hidden h-2">
                <div style={{ width: `${kpis.garcons / kpis.total * 100}%` }} className="bg-sky-400 h-full transition-all" title={`Garçons: ${kpis.garcons}`} />
                <div style={{ width: `${kpis.filles / kpis.total * 100}%` }} className="bg-pink-400 h-full transition-all" title={`Filles: ${kpis.filles}`} />
                <div style={{ width: `${(kpis.total - kpis.garcons - kpis.filles) / kpis.total * 100}%` }} className="bg-slate-200 h-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barre de recherche & filtres */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Nom, prénom ou matricule..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['CARD', 'LIST'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === m ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {m === 'CARD' ? 'Cartes' : 'Liste'}
            </button>
          ))}
          <button onClick={() => setShowFilters(v => !v)}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <Filter size={14} /> Filtres
          </button>
          {canReinscribe && (
            <button
              onClick={() => { setBulkMode(v => !v); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${bulkMode ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'}`}
            >
              <Repeat size={14} /> {bulkMode ? 'Quitter sélection' : 'Réinsc. groupée'}
            </button>
          )}
          <button onClick={fetchEleves} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Barre de sélection groupée */}
      {bulkMode && filtered.length > 0 && (() => {
        const eligibles = filtered.filter(e => !matriculesAnneeActive.has(e.matricule));
        const dejaInscrits = filtered.filter(e => matriculesAnneeActive.has(e.matricule)).length;
        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-4 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-200">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.size === eligibles.length && eligibles.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded-lg accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                {selectedIds.size === eligibles.length && eligibles.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
              </span>
            </label>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              {selectedIds.size} / {eligibles.length} éligible{eligibles.length > 1 ? 's' : ''}
            </span>
            {dejaInscrits > 0 && (
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {dejaInscrits} déjà inscrit{dejaInscrits > 1 ? 's' : ''} en {anneeActiveToday}
              </span>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={openBulkReinscModal}
                className="ml-auto px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <Repeat size={14} /> Réinscrire {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} → {anneeActiveToday}
              </button>
            )}
          </div>
        );
      })()}

      {/* Filtres avancés */}
      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Niveau</label>
            <select value={filters.niveau} onChange={e => setFilters({ ...filters, niveau: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les niveaux</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Statut</label>
            <select value={filters.statut} onChange={e => setFilters({ ...filters, statut: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Régime</label>
            <select value={filters.regime} onChange={e => setFilters({ ...filters, regime: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les régimes</option>
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button onClick={() => setFilters({ search: '', niveau: 'ALL', statut: 'ALL', regime: 'ALL' })}
              className="w-full py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      )}

      {error && !showModal && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Contenu principal */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des élèves...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center flex flex-col items-center gap-4">
          <GraduationCap size={40} className="text-slate-300" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {eleves.length === 0 ? 'Aucun élève inscrit' : 'Aucun résultat pour ces filtres'}
          </p>
          {canModify && eleves.length === 0 && (
            <button onClick={openCreate}
              className="mt-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
              Inscrire le premier élève
            </button>
          )}
        </div>
      ) : viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(eleve => {
            const dejaInscrit = matriculesAnneeActive.has(eleve.matricule);
            return (
            <div key={eleve.id}
              onClick={bulkMode && !dejaInscrit ? () => toggleSelect(eleve.id) : undefined}
              className={`bg-white rounded-[2.5rem] border p-8 shadow-sm transition-all group flex flex-col
                ${bulkMode && !dejaInscrit ? 'cursor-pointer hover:border-emerald-300' : ''}
                ${bulkMode && dejaInscrit ? 'opacity-60' : 'hover:shadow-xl'}
                ${bulkMode && selectedIds.has(eleve.id) ? 'border-emerald-400 ring-2 ring-emerald-300 bg-emerald-50/30' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start mb-4">
                {bulkMode ? (
                  <div className="flex items-center gap-3">
                    {dejaInscrit ? (
                      <span className="w-5 h-5 flex items-center justify-center"><CheckCircle2 size={16} className="text-emerald-500" /></span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(eleve.id)}
                        onChange={() => toggleSelect(eleve.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-5 h-5 rounded-lg accent-emerald-600 cursor-pointer"
                      />
                    )}
                    {eleve.photoUrl ? (
                      <img src={eleve.photoUrl} alt={`${eleve.prenom} ${eleve.nom}`}
                        className="w-14 h-14 rounded-[1.2rem] object-cover border border-indigo-100 shadow-inner" />
                    ) : (
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.2rem] flex items-center justify-center font-black text-lg shadow-inner">
                        {eleve.prenom[0]}{eleve.nom[0]}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {eleve.photoUrl ? (
                      <img src={eleve.photoUrl} alt={`${eleve.prenom} ${eleve.nom}`}
                        className="w-14 h-14 rounded-[1.2rem] object-cover border border-indigo-100 shadow-inner" />
                    ) : (
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.2rem] flex items-center justify-center font-black text-lg shadow-inner">
                        {eleve.prenom[0]}{eleve.nom[0]}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button onClick={() => openView(eleve)} title="Voir la fiche"
                        className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all">
                        <Eye size={16} />
                      </button>
                      {canReinscribe && !dejaInscrit && (
                        <button onClick={() => openReinscModal(eleve)} title={`Réinscrire → ${anneeActiveToday}`}
                          className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all">
                          <Repeat size={15} />
                        </button>
                      )}
                      {canModify && (
                        <button onClick={() => openEdit(eleve)} title="Modifier"
                          className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-xl transition-all">
                          <Edit3 size={16} />
                        </button>
                      )}
                      {canModify && (
                        <button onClick={() => openDuplicate(eleve)} title="Dupliquer (fratrie)"
                          className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-violet-50 text-slate-400 hover:text-violet-600 rounded-xl transition-all">
                          <Copy size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setShowDeleteConfirm(eleve)} title="Supprimer"
                          className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 text-base tracking-tight">{eleve.prenom} {eleve.nom}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{eleve.matricule}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                    {niveauLabel(eleve.niveau)}
                  </span>
                  {eleve.sexe === 'M' && <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-sky-100">♂ Garçon</span>}
                  {eleve.sexe === 'F' && <span className="px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-pink-100">♀ Fille</span>}
                  {regimeBadge(eleve.regimeFinancier)}
                  {statutBadge(eleve.statut)}
                  {dejaInscrit && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Inscrit {anneeActiveToday}
                    </span>
                  )}
                  {parentsByEleveId[eleve.id]?.length > 0 && (
                    <span title={parentsByEleveId[eleve.id].map((p: any) => p.email).join(', ')}
                      className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-violet-200 flex items-center gap-1">
                      <UserPlus size={10} /> Portail parent
                    </span>
                  )}
                </div>
                {eleve.besoinSpecifique && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">
                    <Baby size={12} /> Besoins spécifiques
                  </div>
                )}
                <div className="space-y-1 text-[10px] text-slate-500 font-bold">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="shrink-0" />
                    <span>{eleve.parent1.prenom} {eleve.parent1.nom} — {eleve.parent1.whatsapp || eleve.parent1.telephone}</span>
                  </div>
                  {eleve.cantine && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={12} /> Cantine
                    </div>
                  )}
                  {eleve.transportBus && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <CheckCircle2 size={12} /> Transport bus
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {bulkMode && (
                  <th className="px-4 py-5">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.filter(e => !matriculesAnneeActive.has(e.matricule)).length && filtered.filter(e => !matriculesAnneeActive.has(e.matricule)).length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </th>
                )}
                {['Élève', 'Matricule', 'Niveau', 'Sexe', 'Statut', 'Régime', 'Parent / WhatsApp', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(eleve => {
                const dejaInscrit = matriculesAnneeActive.has(eleve.matricule);
                return (
                <tr
                  key={eleve.id}
                  onClick={bulkMode && !dejaInscrit ? () => toggleSelect(eleve.id) : undefined}
                  className={`transition-all
                    ${bulkMode && !dejaInscrit ? 'cursor-pointer' : ''}
                    ${bulkMode && dejaInscrit ? 'opacity-60 bg-slate-50/50' : ''}
                    ${bulkMode && selectedIds.has(eleve.id) ? 'bg-emerald-50' : (!bulkMode || dejaInscrit ? 'hover:bg-slate-50' : '')}`}
                >
                  {bulkMode && (
                    <td className="px-4 py-4">
                      {dejaInscrit ? (
                        <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(eleve.id)}
                          onChange={() => toggleSelect(eleve.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {eleve.photoUrl ? (
                        <img src={eleve.photoUrl} alt={`${eleve.prenom} ${eleve.nom}`}
                          className="w-8 h-8 rounded-lg object-cover border border-indigo-100 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shrink-0">
                          {eleve.prenom[0]}{eleve.nom[0]}
                        </div>
                      )}
                      <span className="font-black text-slate-900">{eleve.prenom} {eleve.nom}</span>
                      {dejaInscrit && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black border border-emerald-200">✓ {anneeActiveToday}</span>}
                      {parentsByEleveId[eleve.id]?.length > 0 && (
                        <span title={parentsByEleveId[eleve.id].map((p: any) => p.email).join(', ')}
                          className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[8px] font-black border border-violet-200 flex items-center gap-0.5">
                          <UserPlus size={8}/> Portail
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-500 font-mono">{eleve.matricule}</td>
                  <td className="px-6 py-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase border border-indigo-100">{niveauLabel(eleve.niveau)}</span></td>
                  <td className="px-6 py-4">
                    {eleve.sexe === 'M' && <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[9px] font-black border border-sky-100">♂ G</span>}
                    {eleve.sexe === 'F' && <span className="px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full text-[9px] font-black border border-pink-100">♀ F</span>}
                    {!eleve.sexe && <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4">{statutBadge(eleve.statut)}</td>
                  <td className="px-6 py-4">{regimeBadge(eleve.regimeFinancier)}</td>
                  <td className="px-6 py-4 text-[10px] text-slate-500 font-bold">{eleve.parent1.prenom} — {eleve.parent1.whatsapp || eleve.parent1.telephone}</td>
                  <td className="px-6 py-4">
                    {!bulkMode && (
                      <div className="flex gap-2">
                        <button onClick={() => openView(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Eye size={14} /></button>
                        {canReinscribe && !dejaInscrit && <button onClick={() => openReinscModal(eleve)} title={`Réinscrire → ${anneeActiveToday}`} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-all"><Repeat size={13} /></button>}
                        {canModify && <button onClick={() => openEdit(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-all"><Edit3 size={14} /></button>}
                        {canModify && <button onClick={() => openDuplicate(eleve)} title="Dupliquer (fratrie)" className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-violet-50 text-slate-400 hover:text-violet-600 rounded-lg transition-all"><Copy size={13} /></button>}
                        {canDelete && <button onClick={() => setShowDeleteConfirm(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"><Trash2 size={14} /></button>}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL CRÉER / MODIFIER ══════════════════════════════════════════════ */}
      {(showModal === 'CREATE' || showModal === 'EDIT') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">

            {/* ── En-tête modal ── */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-[3rem]">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                {showModal === 'CREATE' && createStep === 'SELECTION' && (
                  <><ClipboardCheck size={20} className="text-indigo-600" /> Dossiers en attente d'inscription</>
                )}
                {showModal === 'CREATE' && createStep === 'FORM' && (
                  duplicateSource
                    ? <><Copy size={20} className="text-violet-600" /> Dupliquer une inscription</>
                    : <><UserPlus size={20} className="text-indigo-600" /> Inscrire un Élève</>
                )}
                {showModal === 'CREATE' && createStep === 'DOCS' && (
                  <><FolderOpen size={20} className="text-emerald-600" /> Dossier constitué</>
                )}
                {showModal === 'EDIT' && 'Modifier la Fiche'}
              </h3>
              <button onClick={closeCreateModal}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* ══ ÉTAPE 1 : SÉLECTION DU DOSSIER ══ */}
            {showModal === 'CREATE' && createStep === 'SELECTION' && (
              <div className="p-8 space-y-5">
                <p className="text-slate-500 text-sm font-bold leading-relaxed">
                  Sélectionnez un dossier d'admission pour préremplir automatiquement les champs d'inscription.
                </p>

                {/* Barre de recherche */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom d'enfant ou de parent..."
                    value={admissionSearch}
                    onChange={e => setAdmissionSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Liste des dossiers */}
                {admissionsLoading ? (
                  <div className="py-12 text-center flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des dossiers...</p>
                  </div>
                ) : (() => {
                  const q = admissionSearch.toLowerCase();
                  const filteredAdm = admissions.filter(d => {
                    const name = (d.companyName || d.name || '').toLowerCase();
                    const parent = (d.mainContact || '').toLowerCase();
                    return !q || name.includes(q) || parent.includes(q);
                  });
                  return filteredAdm.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl">
                      <ClipboardList size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {admissions.length === 0
                          ? 'Aucune candidature en attente — créez-en une dans le module Admissions'
                          : 'Aucun résultat pour cette recherche'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredAdm.map(d => {
                        const nomEnfant = d.companyName || d.name || '—';
                        const statut: StatutAdmission = resolveStatut(d);
                        const niveau = d.niveau as NiveauScolaire | undefined;
                        const contact = d.mainContact || '—';
                        const fromParent = isFromParent(d);
                        return (
                          <div
                            key={d.id}
                            className={`flex items-center gap-4 p-4 border rounded-2xl transition-all cursor-pointer group ${
                              fromParent
                                ? 'bg-purple-50/60 hover:bg-purple-100/70 border-purple-200 hover:border-purple-300 border-l-4 border-l-purple-400'
                                : 'bg-slate-50 hover:bg-indigo-50 border-slate-100 hover:border-indigo-200'
                            }`}
                            onClick={() => selectDossierForInscription(d)}
                          >
                            {d.photoUrl ? (
                              <img src={d.photoUrl} alt={nomEnfant}
                                className="w-10 h-10 rounded-xl object-cover border border-indigo-100 shrink-0" />
                            ) : (
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                fromParent ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-600'
                              }`}>
                                {nomEnfant.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-slate-900 text-sm uppercase truncate">{nomEnfant}</p>
                                {fromParent ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[8px] font-black border border-purple-200 shrink-0">
                                    <Globe size={8} /> Portail parent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black border border-slate-200 shrink-0">
                                    <Building2 size={8} /> Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold truncate">
                                {contact}{niveau ? ` — ${niveauLabel(niveau)}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {statutBadge(statut)}
                              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Bouton saisie manuelle */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setFormData(emptyForm(ANNEE_COURANTE)); setCreateStep('FORM'); }}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus size={16} /> Inscrire sans dossier préexistant
                  </button>
                </div>
              </div>
            )}

            {/* ══ ÉTAPE 2 : FORMULAIRE ══ */}
            {(showModal === 'EDIT' || (showModal === 'CREATE' && createStep === 'FORM')) && (
              <>
                <div className="p-8 space-y-8">
                  {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  {showModal === 'CREATE' && !duplicateSource && (
                    <button
                      onClick={() => setCreateStep('SELECTION')}
                      className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-xs font-black uppercase tracking-widest transition-all"
                    >
                      <ChevronLeft size={14} /> Choisir un autre dossier
                    </button>
                  )}

                  {/* Bannière duplication (fratrie) */}
                  {duplicateSource && (
                    <div className="p-4 bg-violet-50 border border-violet-200 rounded-2xl flex items-start gap-3">
                      <Copy size={16} className="text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-black text-violet-800 uppercase tracking-wide">
                          Duplication du dossier de {duplicateSource.prenom} {duplicateSource.nom}
                        </p>
                        <p className="text-[11px] text-violet-600 font-medium mt-0.5">
                          Les informations de la famille (parents, contacts, régime) ont été reprises.
                          Renseignez l'identité du nouvel enfant — le prénom doit être différent.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Informations élève */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <GraduationCap size={14} /> Informations de l'élève
                    </h4>

                    {/* Photo de l'élève */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative flex-shrink-0">
                        {formData.photoUrl ? (
                          <>
                            <img src={formData.photoUrl} alt="Photo de l'élève"
                              className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm" />
                            <button type="button" onClick={() => setFormData({ ...formData, photoUrl: '' })}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition">
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <label className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition">
                            <Camera className="w-6 h-6 text-slate-400 mb-0.5" />
                            <span className="text-[8px] font-black text-slate-400 uppercase">Photo</span>
                            <input type="file" accept="image/*" className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try { setFormData({ ...formData, photoUrl: await compressImageToDataUrl(file) }); }
                                catch { showToast('Impossible de lire cette image.', 'error'); }
                              }} />
                          </label>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Photo de l'élève</p>
                        <p className="text-xs text-slate-400 mt-1">Photo d'identité récente — visible sur la fiche et les listes.</p>
                        {formData.photoUrl && (
                          <label className="inline-block mt-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest cursor-pointer hover:text-indigo-800">
                            Changer
                            <input type="file" accept="image/*" className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try { setFormData({ ...formData, photoUrl: await compressImageToDataUrl(file) }); }
                                catch { showToast('Impossible de lire cette image.', 'error'); }
                              }} />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { label: 'Nom *',               key: 'nom',           type: 'text' },
                        { label: 'Prénom *',            key: 'prenom',        type: 'text' },
                        { label: 'Date de naissance *', key: 'dateNaissance', type: 'date' },
                        { label: 'Lieu de naissance',   key: 'lieuNaissance', type: 'text' },
                      ] as const).map(field => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{field.label}</label>
                          <input
                            type={field.type}
                            value={(formData as any)[field.key] || ''}
                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      ))}

                      {/* Sexe */}
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Sexe</label>
                        <div className="flex gap-3">
                          {([{ v: 'M', label: '♂ Garçon', active: 'bg-sky-600 text-white border-sky-600', inactive: 'bg-slate-50 text-slate-500 border-slate-200 hover:border-sky-400' },
                             { v: 'F', label: '♀ Fille',  active: 'bg-pink-500 text-white border-pink-500', inactive: 'bg-slate-50 text-slate-500 border-slate-200 hover:border-pink-400' }
                          ] as const).map(s => (
                            <button key={s.v} type="button"
                              onClick={() => setFormData({ ...formData, sexe: formData.sexe === s.v ? '' : s.v })}
                              className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${formData.sexe === s.v ? s.active : s.inactive}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Niveau *</label>
                        <select value={formData.niveau || 'PS'} onChange={e => setFormData({ ...formData, niveau: e.target.value as NiveauScolaire, classeId: undefined })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Classe physique
                          {classes.filter(c => c.niveau === formData.niveau).length === 0 && (
                            <span className="ml-2 text-amber-500 normal-case">— aucune classe créée pour ce niveau</span>
                          )}
                        </label>
                        <select
                          value={formData.classeId || ''}
                          onChange={e => setFormData({ ...formData, classeId: e.target.value || undefined })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                        >
                          <option value="">— Non affecté —</option>
                          {classes.filter(c => c.niveau === formData.niveau).map(c => {
                            const nb = c.nbEleves ?? 0;
                            const max = c.capaciteMax ?? 30;
                            const restants = max - nb;
                            const isFull = restants <= 0;
                            const isCurrentClass = showModal === 'EDIT' && selectedEleve?.classeId === c.id;
                            const spotsLabel = isFull ? 'Complet' : `${restants} place${restants > 1 ? 's' : ''} libre${restants > 1 ? 's' : ''}`;
                            return (
                              <option key={c.id} value={c.id} disabled={isFull && !isCurrentClass}>
                                {c.nom} ({spotsLabel})
                              </option>
                            );
                          })}
                        </select>
                        {formData.classeId && (() => {
                          const c = classes.find(cl => cl.id === formData.classeId);
                          if (!c) return null;
                          const nb = c.nbEleves ?? 0; const max = c.capaciteMax ?? 30;
                          const pct = Math.round((nb / max) * 100);
                          const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-black text-slate-400">{nb}/{max}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Date d'inscription</label>
                        <input type="date" value={formData.dateAdmission || ''} onChange={e => setFormData({ ...formData, dateAdmission: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                    </div>
                  </section>

                  {/* Régime & Options */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShieldCheck size={14} /> Régime & Options
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Régime financier</label>
                        <select value={formData.regimeFinancier || 'NORMAL'} onChange={e => setFormData({ ...formData, regimeFinancier: e.target.value as RegimeFinancier })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>

                      {formData.regimeFinancier !== 'NORMAL' && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Remise (%)</label>
                          <input type="number" min="0" max="100" value={formData.remisePct || 0}
                            onChange={e => setFormData({ ...formData, remisePct: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                      )}

                      {showModal === 'EDIT' ? (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Statut</label>
                          <select value={formData.statut || 'INSCRIT'} onChange={e => setFormData({ ...formData, statut: e.target.value as StatutAdmission })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Statut</label>
                          <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span className="text-sm font-black text-emerald-700">Inscrit</span>
                            <span className="ml-auto text-[9px] text-emerald-500 font-bold">Défini automatiquement</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 sm:col-span-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!formData.cantine} onChange={e => setFormData({ ...formData, cantine: e.target.checked })}
                              className="w-5 h-5 rounded accent-indigo-600" />
                            <span className="text-sm font-black text-slate-700">Cantine</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!formData.transportBus} onChange={e => setFormData({ ...formData, transportBus: e.target.checked })}
                              className="w-5 h-5 rounded accent-indigo-600" />
                            <span className="text-sm font-black text-slate-700">Transport bus</span>
                          </label>
                          {/* Garderie : maternelle uniquement (crèche, PS, MS, GS) */}
                          {NIVEAUX_MATERNELLE.includes(formData.niveau || '') && (
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" checked={!!formData.garderie} onChange={e => setFormData({ ...formData, garderie: e.target.checked })}
                                className="w-5 h-5 rounded accent-indigo-600" />
                              <span className="text-sm font-black text-slate-700">Garderie</span>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Besoins spécifiques (retard, handicap…)</label>
                        <input type="text" value={formData.besoinSpecifique || ''}
                          onChange={e => setFormData({ ...formData, besoinSpecifique: e.target.value })}
                          placeholder="Décrivez si nécessaire..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                    </div>
                  </section>

                  {/* Situation familiale */}
                  <section className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-4">
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <Users size={14} /> Situation familiale
                    </h4>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-2 block">Situation matrimoniale</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { v: 'MARIE', l: 'Marié(e)' },
                          { v: 'DIVORCE', l: 'Divorcé(e)' },
                          { v: 'SEPARE', l: 'Séparé(e)' },
                          { v: 'CELIBATAIRE', l: 'Célibataire' },
                          { v: 'VEUF', l: 'Veuf(ve)' },
                          { v: 'UNION_LIBRE', l: 'Union libre' },
                        ] as const).map(opt => (
                          <button key={opt.v} type="button"
                            onClick={() => setFormData({ ...formData, situationMatrimoniale: formData.situationMatrimoniale === opt.v ? '' : opt.v })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${formData.situationMatrimoniale === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                          >{opt.l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-2 block">Les parents résident-ils dans le même pays ?</label>
                      <div className="flex gap-3">
                        {([
                          { v: true, l: 'Oui' },
                          { v: false, l: 'Non' },
                        ] as const).map(opt => (
                          <button key={String(opt.v)} type="button"
                            onClick={() => setFormData({ ...formData, parentsMemeResidence: (formData as any).parentsMemeResidence === opt.v ? null : opt.v })}
                            className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${(formData as any).parentsMemeResidence === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                          >{opt.l}</button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Parent 1 */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Users size={14} /> Parent / Tuteur légal (principal)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { label: 'Nom',       key: 'nom' },
                        { label: 'Prénom',    key: 'prenom' },
                        { label: 'Téléphone', key: 'telephone' },
                        { label: 'WhatsApp',  key: 'whatsapp' },
                        { label: 'Email',     key: 'email' },
                        { label: 'Profession', key: 'profession' },
                        { label: "Nom de l'entreprise", key: 'entreprise' },
                        { label: 'Pays de résidence', key: 'paysResidence' },
                      ] as const).map(field => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{field.label}</label>
                          <input type="text" value={(formData.parent1 as any)?.[field.key] || ''}
                            onChange={e => setFormData({ ...formData, parent1: { ...(formData.parent1 as any), [field.key]: e.target.value } })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Lien</label>
                        <select value={formData.parent1?.lien || 'MERE'}
                          onChange={e => setFormData({ ...formData, parent1: { ...(formData.parent1 as any), lien: e.target.value } })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          <option value="MERE">Mère</option>
                          <option value="PERE">Père</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Parent 2 / Conjoint(e) */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Users size={14} /> Second parent / Conjoint(e) (facultatif)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { label: 'Nom',       key: 'nom' },
                        { label: 'Prénom',    key: 'prenom' },
                        { label: 'Téléphone', key: 'telephone' },
                        { label: 'Email',     key: 'email' },
                        { label: 'Profession', key: 'profession' },
                        { label: "Nom de l'entreprise", key: 'entreprise' },
                        { label: 'Pays de résidence', key: 'paysResidence' },
                      ] as const).map(field => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{field.label}</label>
                          <input type="text" value={(formData.parent2 as any)?.[field.key] || ''}
                            onChange={e => setFormData({ ...formData, parent2: { ...(formData.parent2 as any), [field.key]: e.target.value } })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Lien</label>
                        <select value={formData.parent2?.lien || 'PERE'}
                          onChange={e => setFormData({ ...formData, parent2: { ...(formData.parent2 as any), lien: e.target.value } })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          <option value="PERE">Père</option>
                          <option value="MERE">Mère</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Personne autorisée à venir chercher l'enfant */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <UserCheck size={14} className="text-emerald-600" /> Personne autorisée à venir chercher l'enfant
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nom complet</label>
                        <input type="text" value={formData.personneAutorisee?.nom || ''}
                          onChange={e => setFormData({ ...formData, personneAutorisee: { ...(formData.personneAutorisee as any), nom: e.target.value } })}
                          placeholder="Prénom et nom"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Téléphone</label>
                        <input type="tel" value={formData.personneAutorisee?.telephone || ''}
                          onChange={e => setFormData({ ...formData, personneAutorisee: { ...(formData.personneAutorisee as any), telephone: e.target.value } })}
                          placeholder="+221 77 xxx xxxx"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Lien avec l'enfant</label>
                        <input type="text" value={formData.personneAutorisee?.lien || ''}
                          onChange={e => setFormData({ ...formData, personneAutorisee: { ...(formData.personneAutorisee as any), lien: e.target.value } })}
                          placeholder="Grand-frère, nounou, chauffeur…"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Footer formulaire */}
                <div className="p-8 border-t border-slate-100 flex justify-end gap-4 sticky bottom-0 bg-white rounded-b-[3rem]">
                  <button onClick={closeCreateModal}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Annuler
                  </button>
                  <button onClick={handleSave} disabled={actionLoading}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 disabled:opacity-60">
                    {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {showModal === 'CREATE' ? 'Inscrire' : 'Enregistrer'}
                  </button>
                </div>
              </>
            )}

            {/* ══ ÉTAPE 3 : DOCUMENTS ══ */}
            {showModal === 'CREATE' && createStep === 'DOCS' && inscritEleve && (() => {
              const classeNom = inscritEleve.classeId
                ? classes.find(c => c.id === inscritEleve.classeId)?.nom
                : null;
              return (
              <div className="p-8 space-y-6">

                {/* Confirmation */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-emerald-800 text-sm">Inscription enregistrée avec succès !</p>
                    <p className="text-emerald-700 text-xs font-black">
                      {inscritEleve.prenom} {inscritEleve.nom}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        {NIVEAUX.find(n => n.value === inscritEleve.niveau)?.label || inscritEleve.niveau}
                      </span>
                      {classeNom && (
                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          {classeNom}
                        </span>
                      )}
                      {inscritEleve.matricule && (
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
                          {inscritEleve.matricule}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nom du dossier */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FolderOpen size={12} /> Nom du dossier élève
                  </p>
                  <p className="font-black text-indigo-900 text-sm font-mono break-all">
                    {`${inscritEleve.matricule || ''}-${(inscritEleve.nom || '').toUpperCase()}-${(inscritEleve.prenom || '').toUpperCase()}-${inscritEleve.niveau || ''}`}
                  </p>
                  <p className="text-indigo-500 text-[10px] font-bold mt-2">
                    Créez un dossier physique ou numérique avec ce nom pour regrouper tous les documents de l'élève.
                  </p>
                </div>

                {/* Offres de scolarité applicables */}
                {servicesApplicables.length > 0 && (() => {
                  const premierVersement = servicesApplicables.reduce((sum, s) => {
                    // Premier versement = frais ponctuels + 1ère mensualité (pas × dureeMois)
                    return sum + Number(s.price);
                  }, 0);
                  return (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                      <Banknote size={13} /> Tarifs applicables
                    </p>
                    <div className="space-y-2">
                      {servicesApplicables.map(s => {
                        const type = (s.typeOffre || s.type_offre || '').toUpperCase();
                        const isMensuel = type === 'MENSUALITE' || type === 'CANTINE' || type === 'BUS';
                        return (
                          <div key={s.id} className="flex justify-between items-center">
                            <div>
                              <span className="font-black text-amber-900 text-sm">{s.name}</span>
                              <span className="ml-2 text-[9px] font-bold text-amber-500 uppercase">
                                {isMensuel ? '/mois' : 'Ponctuel'}
                              </span>
                            </div>
                            <span className="font-black text-amber-800 text-sm">
                              {Number(s.price).toLocaleString('fr-FR')} {currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-amber-200 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Premier versement</span>
                        <span className="font-black text-amber-900 text-sm">
                          {premierVersement.toLocaleString('fr-FR')} {currency}
                        </span>
                      </div>
                      <p className="text-[9px] text-amber-500 font-bold">
                        Frais ponctuels + 1ère mensualité — les versements suivants sont gérés dans le Recouvrement.
                      </p>
                    </div>
                    <InscriptionFactureButton
                      inscritEleve={inscritEleve}
                      servicesApplicables={servicesApplicables}
                      currency={currency}
                    />
                  </div>
                  );
                })()}

                {/* Boutons de génération */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={13} /> Documents administratifs — PDF
                  </h4>

                  {/* Bouton ZIP principal */}
                  <button
                    onClick={async () => {
                      setGenLoading('zip');
                      try { await downloadAdminDocsZip(inscritEleve!); }
                      finally { setGenLoading(null); }
                    }}
                    disabled={genLoading !== null}
                    className="w-full mb-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {genLoading === 'zip'
                      ? <><RefreshCw size={14} className="animate-spin" /> Génération en cours…</>
                      : <><FolderOpen size={14} /> Télécharger le dossier complet (.zip)</>}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Documents adaptés au cycle : crèche = fiche identité + règlement intérieur ;
                        maternelle/élémentaire = fiche identité + convention de scolarisation */}
                    {(inscritEleve?.niveau === 'CRECHE' ? [
                      { key: 'fiche_inscription',        type: 'fiche_inscription'        as const, label: "Fiche d'identité",         desc: "Identité de l'enfant et coordonnées des parents" },
                      { key: 'reglement_interieur',      type: 'reglement_interieur'      as const, label: 'Règlement intérieur',       desc: 'Règlement de la crèche + accusé de réception à signer' },
                      { key: 'fiche_sanitaire',          type: 'fiche_sanitaire'          as const, label: 'Fiche sanitaire',           desc: 'Informations médicales et contacts urgence' },
                      { key: 'autorisation_soins',       type: 'autorisation_soins'       as const, label: 'Autorisation de soins',     desc: 'Autorisation de soins et hospitalisation d\'urgence' },
                      { key: 'autorisation_sortie',      type: 'autorisation_sortie'      as const, label: 'Autorisation de sortie',    desc: 'Autorisation annuelle pour les sorties' },
                    ] : [
                      { key: 'fiche_inscription',        type: 'fiche_inscription'        as const, label: "Fiche d'identité",         desc: "Identité de l'élève et coordonnées des parents" },
                      { key: 'convention_scolarisation', type: 'convention_scolarisation' as const, label: 'Convention de scolarisation', desc: 'Contrat entre l\'école et la famille — à signer' },
                      { key: 'certificat_scolarite',     type: 'certificat_scolarite'     as const, label: 'Certificat de scolarité',   desc: "Atteste l'inscription pour l'année en cours" },
                      { key: 'fiche_sanitaire',          type: 'fiche_sanitaire'          as const, label: 'Fiche sanitaire',           desc: 'Informations médicales et contacts urgence' },
                      { key: 'autorisation_sortie',      type: 'autorisation_sortie'      as const, label: 'Autorisation de sortie',    desc: 'Autorisation annuelle pour les sorties scolaires' },
                    ]).map(doc => (
                      <button key={doc.key}
                        onClick={async () => {
                          setGenLoading(doc.key);
                          try { await downloadSingleAdminDoc(doc.type, inscritEleve!); }
                          finally { setGenLoading(null); }
                        }}
                        disabled={genLoading !== null}
                        className="p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 rounded-2xl text-left transition-all group">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 rounded-xl flex items-center justify-center shrink-0 transition-all">
                            {genLoading === doc.key
                              ? <RefreshCw size={14} className="animate-spin" />
                              : <FileText size={16} />}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{doc.label}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{doc.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 font-bold text-center">
                    Cliquez sur un document pour l'ouvrir et l'imprimer (ou enregistrer en PDF).
                  </p>

                  {/* Pièces justificatives — cochées si déjà versées au dossier numérique */}
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ClipboardCheck size={13} /> Pièces justificatives à collecter
                    </p>
                    <ul className="space-y-1.5">
                      {piecesForNiveau(inscritEleve?.niveau).map((p, i) => {
                        const fournie = piecesFournies.has(p.code);
                        return (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            {fournie ? (
                              <span className="mt-0.5 w-4 h-4 rounded bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={11} className="text-white" />
                              </span>
                            ) : (
                              <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 bg-white ${p.obligatoire ? 'border-amber-400' : 'border-slate-300'}`} />
                            )}
                            <span className={`font-bold ${fournie ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {p.label}
                              {fournie
                                ? <span className="text-emerald-500 font-black"> — fournie ✓</span>
                                : p.obligatoire
                                  ? <span className="text-rose-500"> *</span>
                                  : <span className="text-slate-400 font-medium"> (si applicable)</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[9px] text-amber-600 font-bold mt-2">
                      * Obligatoire — les pièces cochées ont été jointes lors de la demande et sont dans le dossier numérique de l'élève.
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeCreateModal}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all"
                >
                  Terminer
                </button>
              </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── Modal Vue détail ───────────────────────────────────────────────── */}
      {showModal === 'VIEW' && selectedEleve && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-[3rem] z-10">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Fiche Élève</h3>
              <div className="flex gap-2">
                {canModify && (
                  <button onClick={() => { openEdit(selectedEleve); }}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Edit3 size={14} /> Modifier
                  </button>
                )}
                {canModify && (
                  parentsByEleveId[selectedEleve.id]?.length > 0 ? (
                    <span title={`Portail actif : ${parentsByEleveId[selectedEleve.id].map((p: any) => p.email).join(', ')}`}
                      className="px-5 py-2 bg-violet-100 text-violet-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-default border border-violet-200">
                      <UserPlus size={14} /> Portail actif
                    </span>
                  ) : (
                    <button onClick={() => {
                      setParentAccountForm({
                        email: selectedEleve.parent1?.email || '',
                        nom: selectedEleve.parent1?.nom || '',
                        prenom: selectedEleve.parent1?.prenom || '',
                        motDePasseTemporaire: Math.random().toString(36).slice(2, 10).toUpperCase(),
                      });
                      setParentAccountResult(null);
                      setShowParentAccountModal(true);
                    }}
                      className="px-5 py-2 bg-amber-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-500 transition-all flex items-center gap-2">
                      <UserPlus size={14} /> Compte parent
                    </button>
                  )
                )}
                <button onClick={() => setShowModal(null)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                {selectedEleve.photoUrl ? (
                  <img src={selectedEleve.photoUrl} alt={`${selectedEleve.prenom} ${selectedEleve.nom}`}
                    className="w-20 h-20 rounded-[1.5rem] object-cover border-2 border-indigo-100 shadow-inner" />
                ) : (
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner">
                    {selectedEleve.prenom[0]}{selectedEleve.nom[0]}
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedEleve.prenom} {selectedEleve.nom}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{selectedEleve.matricule}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase border border-indigo-100">{niveauLabel(selectedEleve.niveau)}</span>
                    {statutBadge(selectedEleve.statut)}
                    {regimeBadge(selectedEleve.regimeFinancier)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoRow label="Date de naissance" value={selectedEleve.dateNaissance} />
                <InfoRow label="Lieu de naissance" value={selectedEleve.lieuNaissance} />
                <InfoRow label="Date d'admission" value={selectedEleve.dateAdmission} />
                <InfoRow label="Année scolaire" value={selectedEleve.anneeScolaire} />
                <InfoRow label="Cantine" value={selectedEleve.cantine ? 'Oui' : 'Non'} />
                <InfoRow label="Transport bus" value={selectedEleve.transportBus ? 'Oui' : 'Non'} />
                {NIVEAUX_MATERNELLE.includes(selectedEleve.niveau) && <InfoRow label="Garderie" value={selectedEleve.garderie ? 'Oui' : 'Non'} />}
                {selectedEleve.personneAutorisee?.nom && (
                  <InfoRow label="Autorisé à récupérer l'enfant"
                    value={`${selectedEleve.personneAutorisee.nom}${selectedEleve.personneAutorisee.lien ? ` (${selectedEleve.personneAutorisee.lien})` : ''}${selectedEleve.personneAutorisee.telephone ? ` — ${selectedEleve.personneAutorisee.telephone}` : ''}`}
                    className="col-span-2" />
                )}
                {selectedEleve.remisePct > 0 && <InfoRow label="Remise cas social" value={`${selectedEleve.remisePct}%`} />}
                {selectedEleve.besoinSpecifique && <InfoRow label="Besoins spécifiques" value={selectedEleve.besoinSpecifique} className="col-span-2" />}
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Parent principal</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Nom" value={`${selectedEleve.parent1.prenom} ${selectedEleve.parent1.nom}`} />
                  <InfoRow label="Lien" value={selectedEleve.parent1.lien} />
                  <InfoRow label="Téléphone" value={selectedEleve.parent1.telephone} />
                  <InfoRow label="WhatsApp" value={selectedEleve.parent1.whatsapp} />
                  {selectedEleve.parent1.email && <InfoRow label="Email" value={selectedEleve.parent1.email} />}
                </div>
              </div>

              {/* ── Abonnements & Échéances ── */}
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Repeat size={12} /> Abonnements & Échéances
                  </p>
                  {canModify && (
                    <button
                      onClick={() => { setShowAddAbonnement(v => !v); }}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-1.5"
                    >
                      <Plus size={11} /> Abonner
                    </button>
                  )}
                </div>

                {/* Formulaire ajout abonnement */}
                {showAddAbonnement && (
                  <div className="mb-4 p-4 bg-violet-50 border-2 border-violet-200 rounded-2xl space-y-3 animate-in slide-in-from-top-3 duration-200">
                    <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Nouvel Abonnement</p>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Service récurrent</label>
                      <select
                        value={newAboForm.serviceId}
                        onChange={e => setNewAboForm(f => ({ ...f, serviceId: e.target.value }))}
                        className="w-full bg-white border border-violet-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                      >
                        <option value="">— Choisir un service récurrent —</option>
                        {allServicesRecurrents.map(s => {
                          const per = s.periodicite || 'MENSUEL';
                          const perLabel: Record<string, string> = { HEBDOMADAIRE: 'hebdo', MENSUEL: 'mois', TRIMESTRIEL: 'trim.', SEMESTRIEL: 'sem.', ANNUEL: 'an' };
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} — {Number(s.price).toLocaleString()} {currency}/{perLabel[per] ?? per}
                            </option>
                          );
                        })}
                      </select>
                      {allServicesRecurrents.length === 0 && (
                        <p className="text-[9px] text-violet-500 font-bold">Aucun service récurrent actif. Activez la récurrence dans le module Offres de Scolarité.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date de début</label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={newAboForm.dateDebut}
                          onChange={e => setNewAboForm(f => ({ ...f, dateDebut: e.target.value }))}
                          className="w-full bg-white border border-violet-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddAbonnement(false)}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-slate-50 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAbonnement}
                        disabled={!newAboForm.serviceId || aboActionLoading}
                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {aboActionLoading ? <RefreshCw className="animate-spin" size={13} /> : <><Save size={13} /> Abonner</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des abonnements */}
                {abonnementsLoading ? (
                  <div className="py-6 flex justify-center"><RefreshCw className="animate-spin text-violet-400" size={22} /></div>
                ) : abonnements.length === 0 ? (
                  <div className="py-5 text-center border border-dashed border-slate-200 rounded-2xl">
                    <Repeat size={22} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun abonnement actif</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {abonnements.map((abo: any) => {
                      const echeances: any[] = abo.echeances || [];
                      const enAttente = echeances.filter(e => e.statut === 'EN_ATTENTE').sort(
                        (a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
                      );
                      const enRetard = echeances.filter(e => e.statut === 'EN_RETARD');
                      const payees = echeances.filter(e => e.statut === 'PAYE');
                      const isExpanded = expandedAbos.has(abo.id);
                      const perLabel: Record<string, string> = {
                        HEBDOMADAIRE: 'Hebdomadaire', MENSUEL: 'Mensuel',
                        TRIMESTRIEL: 'Trimestriel', SEMESTRIEL: 'Semestriel', ANNUEL: 'Annuel'
                      };
                      const per = abo.service?.periodicite || abo.periodicite || 'MENSUEL';
                      return (
                        <div key={abo.id} className={`rounded-2xl border overflow-hidden transition-all ${abo.isActive ? 'border-violet-200 bg-violet-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                          {/* En-tête abonnement */}
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                <Repeat size={16} />
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm">{abo.service?.name ?? 'Service'}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-violet-100 text-violet-700 border border-violet-200">
                                    <Repeat size={7} /> {perLabel[per] ?? per}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${abo.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {abo.isActive ? 'Actif' : 'Inactif'}
                                  </span>
                                  {enRetard.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-rose-100 text-rose-700">
                                      <AlertTriangle size={7} /> {enRetard.length} en retard
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold mt-1">
                                  Début : {new Date(abo.dateDebut).toLocaleDateString('fr-FR')}
                                  {abo.dateFin && ` · Fin : ${new Date(abo.dateFin).toLocaleDateString('fr-FR')}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <p className="font-black text-violet-800 text-sm">
                                {Number(abo.service?.price ?? 0).toLocaleString()} {currency}
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setExpandedAbos(prev => {
                                    const next = new Set(prev);
                                    next.has(abo.id) ? next.delete(abo.id) : next.add(abo.id);
                                    return next;
                                  })}
                                  className="px-2.5 py-1.5 bg-white border border-violet-200 text-violet-600 rounded-lg text-[8px] font-black uppercase hover:bg-violet-100 transition-all"
                                >
                                  {isExpanded ? 'Masquer' : `${echeances.length} échéance(s)`}
                                </button>
                                {abo.isActive && canModify && (
                                  <button
                                    onClick={() => handleDesactiverAbonnement(abo.id)}
                                    disabled={aboActionLoading}
                                    className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-500 rounded-lg text-[8px] font-black uppercase hover:bg-rose-50 transition-all disabled:opacity-50"
                                  >
                                    Désactiver
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Échéances expandées */}
                          {isExpanded && echeances.length > 0 && (
                            <div className="border-t border-violet-100 bg-white px-4 py-3 space-y-1.5">
                              {[...enRetard, ...enAttente, ...payees].map((ech: any) => (
                                <div key={ech.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-slate-50 transition-all group">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${ech.statut === 'PAYE' ? 'bg-emerald-500' : ech.statut === 'EN_RETARD' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                    <div>
                                      <p className="text-xs font-black text-slate-800">{ech.periodeLabel || new Date(ech.dateEcheance).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                                      <p className="text-[8px] text-slate-400 font-bold">Échéance le {new Date(ech.dateEcheance).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-black ${ech.statut === 'PAYE' ? 'text-emerald-600' : ech.statut === 'EN_RETARD' ? 'text-rose-600' : 'text-amber-600'}`}>
                                      {Number(ech.montant).toLocaleString()} {currency}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${ech.statut === 'PAYE' ? 'bg-emerald-50 text-emerald-700' : ech.statut === 'EN_RETARD' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {ech.statut === 'PAYE' ? 'Payé' : ech.statut === 'EN_RETARD' ? 'En retard' : 'À payer'}
                                    </span>
                                    {(ech.statut === 'EN_ATTENTE' || ech.statut === 'EN_RETARD') && canModify && (
                                      <button
                                        onClick={() => handlePayEcheance(ech.id)}
                                        disabled={aboActionLoading}
                                        className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[7px] font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-50"
                                      >
                                        Marquer payé
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isExpanded && echeances.length === 0 && (
                            <div className="border-t border-violet-100 bg-white px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase">
                              Aucune échéance générée pour cet abonnement.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dossier numérique élève */}
              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FolderOpen size={12} /> Dossier numérique
                </p>
                <button
                  onClick={() => setShowDossier(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <FolderOpen size={11} /> Ouvrir le dossier
                </button>
              </div>

              {/* Documents administratifs PDF */}
              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText size={12} /> Documents administratifs
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      setViewDocLoading('zip');
                      try { await downloadAdminDocsZip(selectedEleve!); }
                      finally { setViewDocLoading(null); }
                    }}
                    disabled={viewDocLoading !== null}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white border border-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    {viewDocLoading === 'zip'
                      ? <><RefreshCw size={11} className="animate-spin" /> Génération…</>
                      : <><FolderOpen size={11} /> Dossier complet .zip</>}
                  </button>
                  {(selectedEleve?.niveau === 'CRECHE' ? [
                    { key: 'fiche_inscription',        type: 'fiche_inscription'        as const, label: "Fiche d'identité" },
                    { key: 'reglement_interieur',      type: 'reglement_interieur'      as const, label: 'Règlement intérieur' },
                    { key: 'fiche_sanitaire',          type: 'fiche_sanitaire'          as const, label: 'Fiche sanitaire' },
                    { key: 'autorisation_soins',       type: 'autorisation_soins'       as const, label: 'Autorisation soins' },
                    { key: 'autorisation_sortie',      type: 'autorisation_sortie'      as const, label: 'Autorisation sortie' },
                  ] : [
                    { key: 'fiche_inscription',        type: 'fiche_inscription'        as const, label: "Fiche d'identité" },
                    { key: 'convention_scolarisation', type: 'convention_scolarisation' as const, label: 'Convention de scolarisation' },
                    { key: 'certificat_scolarite',     type: 'certificat_scolarite'     as const, label: 'Certificat scolarité' },
                    { key: 'fiche_sanitaire',          type: 'fiche_sanitaire'          as const, label: 'Fiche sanitaire' },
                    { key: 'autorisation_sortie',      type: 'autorisation_sortie'      as const, label: 'Autorisation sortie' },
                  ]).map(d => (
                    <button key={d.key}
                      onClick={async () => {
                        setViewDocLoading(d.key);
                        try { await downloadSingleAdminDoc(d.type, selectedEleve!); }
                        finally { setViewDocLoading(null); }
                      }}
                      disabled={viewDocLoading !== null}
                      className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 disabled:opacity-60 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                      {viewDocLoading === d.key
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <FileText size={11} />}
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dossier numérique élève ───────────────────────────────────────── */}
      {showDossier && selectedEleve && (
        <EleveDossier
          eleve={selectedEleve}
          onClose={() => setShowDossier(false)}
        />
      )}

      {/* ── Modal Créer Compte Parent ─────────────────────────────────────── */}
      {showParentAccountModal && selectedEleve && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Portail Parents</p>
                <h3 className="text-xl font-black text-slate-900">Créer un compte parent</h3>
              </div>
              <button onClick={() => { setShowParentAccountModal(false); setParentAccountResult(null); }}
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <X size={20}/>
              </button>
            </div>

            {!parentAccountResult ? (
              <>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  Un compte sera créé avec le rôle <strong>PARENT</strong>.
                  L'enfant <strong>{selectedEleve.prenom} {selectedEleve.nom}</strong> sera automatiquement lié.
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Prénom</label>
                      <input type="text" value={parentAccountForm.prenom}
                        onChange={e => setParentAccountForm(f => ({ ...f, prenom: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Prénom du parent" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nom</label>
                      <input type="text" value={parentAccountForm.nom}
                        onChange={e => setParentAccountForm(f => ({ ...f, nom: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Nom de famille" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email <span className="text-rose-500">*</span></label>
                    <input type="email" value={parentAccountForm.email}
                      onChange={e => setParentAccountForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      placeholder="email@exemple.com" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mot de passe temporaire</label>
                    <div className="flex gap-2">
                      <input type="text" value={parentAccountForm.motDePasseTemporaire}
                        onChange={e => setParentAccountForm(f => ({ ...f, motDePasseTemporaire: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 font-mono"
                        placeholder="Généré automatiquement" />
                      <button type="button"
                        onClick={() => setParentAccountForm(f => ({ ...f, motDePasseTemporaire: Math.random().toString(36).slice(2, 10).toUpperCase() }))}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition text-xs font-bold">
                        Regen
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setShowParentAccountModal(false); setParentAccountResult(null); }}
                    className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                    Annuler
                  </button>
                  <button
                    disabled={!parentAccountForm.email || parentAccountLoading}
                    onClick={async () => {
                      setParentAccountLoading(true);
                      try {
                        await apiClient.post('/admin/parent-accounts', {
                          email: parentAccountForm.email,
                          nom: parentAccountForm.nom,
                          prenom: parentAccountForm.prenom,
                          motDePasseTemporaire: parentAccountForm.motDePasseTemporaire,
                          eleveIds: [selectedEleve.id],
                        });
                        setParentAccountResult({ created: true, tempPassword: parentAccountForm.motDePasseTemporaire });
                        showToast('Compte parent créé avec succès.', 'success');
                        apiClient.get('/admin/parent-accounts').then((r: any) => setParentsByEleveId(r?.byEleveId || {})).catch(() => {});
                      } catch (err: any) {
                        showToast(err?.message || 'Erreur lors de la création du compte.', 'error');
                      } finally {
                        setParentAccountLoading(false);
                      }
                    }}
                    className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 disabled:opacity-50">
                    {parentAccountLoading
                      ? <><Loader2 className="animate-spin" size={15}/> Création…</>
                      : <><UserPlus size={15}/> Créer le compte</>}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-emerald-500"/>
                </div>
                <h4 className="font-black text-slate-900 text-lg mb-1">Compte créé !</h4>
                <p className="text-xs text-slate-500 mb-5">Transmettez ces informations au parent.</p>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2 mb-5">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">URL de connexion</span>
                    <p className="text-sm font-bold text-slate-700 font-mono">/parents</p>
                  </div>
                  <div className="border-t border-amber-200 pt-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</span>
                    <p className="text-sm font-bold text-slate-700">{parentAccountForm.email}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mot de passe temporaire</span>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl font-black text-amber-600 font-mono tracking-widest">{parentAccountResult.tempPassword}</p>
                      <button
                        onClick={() => navigator.clipboard?.writeText(parentAccountResult.tempPassword || '')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-amber-100 transition">
                        <Copy size={14}/>
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowParentAccountModal(false); setParentAccountResult(null); }}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmation suppression ───────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Supprimer l'élève ?</h3>
              <p className="text-slate-500 text-sm font-bold">
                <span className="text-slate-900">{showDeleteConfirm.prenom} {showDeleteConfirm.nom}</span> sera supprimé définitivement.
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={actionLoading}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Réinscription ────────────────────────────────────────────── */}
      {reinscModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300 space-y-6">

            {/* En-tête */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-[1.2rem] flex items-center justify-center border border-emerald-100">
                  <Repeat size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Réinscription</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {reinscModal.prenom} {reinscModal.nom}
                  </p>
                </div>
              </div>
              <button onClick={() => setReinscModal(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Récap élève + flèche */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-[0.8rem] flex items-center justify-center font-black text-sm shrink-0">
                  {reinscModal.prenom[0]}{reinscModal.nom[0]}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">{reinscModal.prenom} {reinscModal.nom}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">{reinscModal.matricule}</p>
                  <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">
                    {niveauLabel(reinscModal.niveau)} — {ANNEE_COURANTE}
                  </p>
                </div>
              </div>
              <ArrowRight size={20} className="text-emerald-500 shrink-0" />
              <div className="flex-1 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Réinscrit vers</p>
                <p className="font-black text-emerald-800 text-sm">{anneeActiveToday}</p>
                <p className="text-[9px] font-bold text-emerald-600 mt-1">{niveauLabel(reinscNiveau)}</p>
              </div>
            </div>

            {/* Sélecteur niveau */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Niveau pour {anneeActiveToday}
              </label>
              <select
                value={reinscNiveau}
                onChange={e => { setReinscNiveau(e.target.value as NiveauScolaire); setReinscClasseId(''); }}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-900 focus:border-indigo-400 outline-none transition-all"
              >
                {NIVEAUX.map(n => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </div>

            {/* Sélecteur classe */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Classe pour {anneeActiveToday} <span className="text-slate-300">(optionnel)</span>
              </label>
              {classesNextYear.filter(c => c.niveau === reinscNiveau).length === 0 ? (
                <p className="text-[10px] text-amber-600 font-bold bg-amber-50 rounded-xl p-3 border border-amber-200">
                  Aucune classe {niveauLabel(reinscNiveau)} créée pour {anneeActiveToday}. Créez-en une dans le module Classes, ou laissez vide.
                </p>
              ) : (
                <select
                  value={reinscClasseId}
                  onChange={e => setReinscClasseId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-900 focus:border-indigo-400 outline-none transition-all"
                >
                  <option value="">— Sans classe assignée —</option>
                  {classesNextYear
                    .filter(c => c.niveau === reinscNiveau)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nom} ({c.nbEleves ?? 0}/{c.capaciteMax} élèves)
                      </option>
                    ))}
                </select>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setReinscModal(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={handleReinscription} disabled={reinscLoading}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {reinscLoading
                  ? <><RefreshCw size={14} className="animate-spin" /> Traitement…</>
                  : <><Repeat size={14} /> Confirmer la réinscription</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Réinscription Groupée ───────────────────────────────────────── */}
      {showBulkReinsc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">

            {/* En-tête */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-[3rem]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-[1.2rem] flex items-center justify-center border border-emerald-100">
                  <Repeat size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Réinscription groupée</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {!bulkLoading && bulkResults.length === 0 && (
                <button onClick={() => setShowBulkReinsc(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-8 space-y-6">
              {/* Résultats après traitement */}
              {bulkResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-emerald-700">{bulkResults.filter(r => r.ok).length}</p>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Réussi</p>
                    </div>
                    {bulkResults.some(r => !r.ok) && (
                      <div className="flex-1 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                        <p className="text-2xl font-black text-rose-700">{bulkResults.filter(r => !r.ok).length}</p>
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Erreur</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {bulkResults.map(r => (
                      <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl ${r.ok ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        {r.ok
                          ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          : <AlertCircle size={14} className="text-rose-600 shrink-0" />}
                        <span className={`text-xs font-bold ${r.ok ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {r.prenom} {r.nom}
                        </span>
                        {!r.ok && <span className="text-[10px] text-rose-600 ml-auto">{r.msg}</span>}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowBulkReinsc(false); setSelectedIds(new Set()); setBulkMode(false); setBulkResults([]); }}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  {/* Année cible — fixe, toujours l'année active */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <Repeat size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Réinscription vers l'année active</p>
                      <p className="font-black text-emerald-800">{anneeActiveToday}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Depuis</p>
                      <p className="font-bold text-slate-700 text-sm">{ANNEE_COURANTE}</p>
                    </div>
                  </div>

                  {/* Mode de progression */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Mode de réinscription</label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { value: 'AUTO', label: 'Progression auto', desc: 'Chaque élève monte d\'un niveau' },
                        { value: 'SAME', label: 'Même niveau', desc: 'Tous restent à leur niveau actuel' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setBulkProgression(opt.value)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${bulkProgression === opt.value ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <p className={`text-xs font-black uppercase tracking-widest ${bulkProgression === opt.value ? 'text-emerald-700' : 'text-slate-700'}`}>{opt.label}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Récap élèves par groupe de niveau */}
                  {(() => {
                    const selectedEleves = eleves.filter(e => selectedIds.has(e.id) && !matriculesAnneeActive.has(e.matricule));
                    const grouped: Record<string, { eleves: Eleve[]; targetNiveau: NiveauScolaire }> = {};
                    selectedEleves.forEach(e => {
                      const key = e.niveau;
                      if (!grouped[key]) {
                        grouped[key] = {
                          eleves: [],
                          targetNiveau: bulkProgression === 'AUTO' ? (NIVEAU_PROGRESSION[e.niveau] ?? e.niveau) : e.niveau,
                        };
                      }
                      grouped[key].eleves.push(e);
                    });
                    return (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Aperçu & affectation des classes <span className="text-slate-300">(optionnel)</span>
                        </label>
                        {Object.entries(grouped).map(([niveau, group]) => {
                          const classesDispo = bulkClassesTarget.filter(c => c.niveau === group.targetNiveau);
                          return (
                            <div key={niveau} className="bg-slate-50 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase">{niveauLabel(niveau as NiveauScolaire)}</span>
                                <ArrowRight size={14} className="text-emerald-500" />
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">{niveauLabel(group.targetNiveau)}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{group.eleves.length} élève{group.eleves.length > 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {group.eleves.map(e => (
                                  <span key={e.id} className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700">
                                    {e.prenom} {e.nom}
                                  </span>
                                ))}
                              </div>
                              {classesDispo.length > 0 ? (
                                <select
                                  value={bulkClassesByNiveau[group.targetNiveau] || ''}
                                  onChange={e => setBulkClassesByNiveau(prev => ({ ...prev, [group.targetNiveau]: e.target.value }))}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-400"
                                >
                                  <option value="">— Sans classe assignée —</option>
                                  {classesDispo.map(c => (
                                    <option key={c.id} value={c.id}>{c.nom} ({c.nbEleves ?? 0}/{c.capaciteMax})</option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-[10px] text-amber-600 font-bold bg-amber-50 rounded-xl p-2 border border-amber-200">
                                  Aucune classe {niveauLabel(group.targetNiveau)} pour {anneeActiveToday} — les élèves seront réinscrits sans classe.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowBulkReinsc(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                      Annuler
                    </button>
                    <button onClick={handleBulkReinscription} disabled={bulkLoading}
                      className="flex-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                      {bulkLoading
                        ? <><RefreshCw size={14} className="animate-spin" /> Traitement en cours…</>
                        : <><Repeat size={14} /> Réinscrire {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''}</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helper composant ligne info ─────────────────────────────────────────────

function InfoRow({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
    </div>
  );
}

export default Eleves;
