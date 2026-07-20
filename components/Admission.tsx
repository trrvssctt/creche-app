import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, Search, Filter, RefreshCw, Plus, Eye, CheckCircle2,
  X, AlertCircle, Loader2, ArrowRight, UserCheck, UserX,
  Clock, GraduationCap, Baby, Phone, Mail, Save,
  Info, ChevronLeft, Edit3, MapPin, Heart, Shield, Stethoscope, Camera, Ban, UserPlus, Copy,
  Globe, Building2, Users, Lock,
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';
import { User, Eleve, NiveauScolaire, RegimeFinancier, StatutAdmission } from '../types';
import { compressImageToDataUrl } from '../services/photoUtils';
import { missingRequiredPieces, PieceJointe } from '../services/piecesJustificatives';
import PiecesJointes from './PiecesJointes';

// Niveaux maternelle : la garderie n'est proposée que pour eux
const NIVEAUX_MATERNELLE = ['CRECHE', 'PS', 'MS', 'GS'];

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: string }[] = [
  { value: 'CRECHE', label: 'Crèche (3–12 mois)', cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',      cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section',      cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',       cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',                   cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',                  cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',                  cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',                  cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',                  cycle: 'Élémentaire' },
];

const STATUTS_ADMISSION: { value: StatutAdmission; label: string; color: string; icon: any }[] = [
  { value: 'EN_ATTENTE', label: 'Candidature', color: 'bg-amber-50 text-amber-700 border-amber-200',         icon: Clock },
  { value: 'ADMIS',      label: 'Admis',       color: 'bg-blue-50 text-blue-700 border-blue-200',            icon: CheckCircle2 },
  { value: 'INSCRIT',    label: 'Inscrit',     color: 'bg-violet-50 text-violet-700 border-violet-200',      icon: UserCheck },
  { value: 'ACTIF',      label: 'Actif',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200',   icon: UserCheck },
  { value: 'REJETE',     label: 'Refusé',      color: 'bg-rose-50 text-rose-700 border-rose-200',            icon: Ban },
  { value: 'SUSPENDU',   label: 'Suspendu',    color: 'bg-slate-100 text-slate-600 border-slate-200',        icon: UserX },
  { value: 'RADIE',      label: 'Radié',       color: 'bg-slate-100 text-slate-500 border-slate-200',        icon: UserX },
];

const REGIMES: { value: RegimeFinancier; label: string }[] = [
  { value: 'NORMAL',             label: 'Normal' },
  { value: 'CAS_SOCIAL_PARTIEL', label: 'Cas social (partiel)' },
  { value: 'CAS_SOCIAL_TOTAL',   label: 'Cas social (total)' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Résout le statut d'un dossier quelle que soit la source (statut custom, status API, isActive)
function getStatut(d: any): StatutAdmission {
  const s = d.statut || '';
  if (STATUTS_ADMISSION.some(x => x.value === s)) return s as StatutAdmission;
  // Fallback sur le champ status de l'API Customer
  const apiStatus = (d.status || '').toLowerCase();
  if (apiStatus === 'actif')      return 'ACTIF';
  if (apiStatus === 'inscrit')    return 'INSCRIT';
  if (apiStatus === 'admis')      return 'ADMIS';
  if (apiStatus === 'radie')      return 'RADIE';
  if (apiStatus === 'suspendu')   return 'SUSPENDU';
  if (apiStatus === 'en_attente') return 'EN_ATTENTE';
  // Dernier recours : isActive seulement si aucun autre indice
  return 'EN_ATTENTE';
}

// Convertit un enregistrement Eleve (API /eleves) en format d'affichage Admission
function normalizeEleve(e: any): any {
  const p1 = e.parent1 || {};
  const p2 = e.parent2 || {};
  const urgence = e.contactUrgence || {};
  const fs = e.ficheSanitaire || {};
  // CAS_SOCIAL (legacy seed) → CAS_SOCIAL_PARTIEL
  const regime = e.regimeFinancier === 'CAS_SOCIAL' ? 'CAS_SOCIAL_PARTIEL' : (e.regimeFinancier || 'NORMAL');
  return {
    ...e,
    ...fs,
    companyName:    `${e.prenom || ''} ${e.nom || ''}`.trim(),
    mainContact:    `${p1.prenom || ''} ${p1.nom || ''}`.trim(),
    phone:          p1.telephone || p1.tel || '',
    email:          p1.email || '',
    billingAddress: e.lieuNaissance || '',
    regimeFinancier: regime as RegimeFinancier,
    dateDepot:      e.dateAdmission || '',
    // Flat parent1
    parent1Nom:     p1.nom || '',
    parent1Prenom:  p1.prenom || '',
    parent1Tel:     p1.telephone || p1.tel || '',
    parent1Whatsapp: p1.whatsapp || p1.telephone || p1.tel || '',
    parent1Email:   p1.email || '',
    parent1Lien:    p1.lien || 'MERE',
    parent1TelDomicile: p1.telDomicile || '',
    parent1TelTravail:  p1.telTravail || '',
    parent1Adresse:     p1.adresse || '',
    parent1Profession:  p1.profession || '',
    parent1Entreprise:  p1.entreprise || '',
    parent1PaysResidence: p1.paysResidence || '',
    parentsMemeResidence: e.parentsMemeResidence ?? null,
    situationMatrimoniale: e.situationMatrimoniale || '',
    // Flat parent2
    parent2Nom:     p2.nom || '',
    parent2Prenom:  p2.prenom || '',
    parent2Lien:    p2.lien || 'PERE',
    parent2Tel:     p2.telephone || p2.tel || '',
    parent2TelDomicile: p2.telDomicile || '',
    parent2TelTravail:  p2.telTravail || '',
    parent2Profession:  p2.profession || '',
    parent2Entreprise:  p2.entreprise || '',
    parent2PaysResidence: p2.paysResidence || '',
    // Contact urgence
    urgenceNom:  urgence.nom || '',
    urgenceTel:  urgence.telephone || urgence.tel || '',
    urgenceLien: urgence.lien || '',
    // Personne autorisée à récupérer l'enfant
    recupNom:  (e.personneAutorisee || {}).nom || '',
    recupTel:  (e.personneAutorisee || {}).telephone || '',
    recupLien: (e.personneAutorisee || {}).lien || '',
  };
}

function StatutBadge({ statut }: { statut: StatutAdmission }) {
  const s = STATUTS_ADMISSION.find(x => x.value === statut);
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.color}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function niveauLabel(n: NiveauScolaire) {
  return NIVEAUX.find(x => x.value === n)?.label ?? n;
}

function regimeLabel(r: RegimeFinancier) {
  return REGIMES.find(x => x.value === r)?.label ?? r;
}

const emptyDossier = () => ({
  nomEnfant: '',
  prenomEnfant: '',
  dateNaissance: '',
  lieuNaissance: '',
  niveau: 'PS' as NiveauScolaire,
  classeId: '' as string,
  regimeFinancier: 'NORMAL' as RegimeFinancier,
  remisePct: 0,
  cantine: false,
  transportBus: false,
  garderie: false,
  photoUrl: '',
  besoinSpecifique: '',
  parent1Nom: '',
  parent1Prenom: '',
  parent1Tel: '',
  parent1Whatsapp: '',
  parent1Email: '',
  parent1Lien: 'MERE' as 'PERE' | 'MERE' | 'TUTEUR',
  parent1TelDomicile: '',
  parent1TelTravail: '',
  parent1Adresse: '',
  parent1Profession: '',
  parent1Entreprise: '',
  parent1PaysResidence: '',
  parentsMemeResidence: null as boolean | null,
  situationMatrimoniale: '' as string,
  // Parent 2 (conjoint)
  parent2Nom: '',
  parent2Prenom: '',
  parent2Lien: 'PERE' as 'PERE' | 'MERE' | 'TUTEUR',
  parent2Tel: '',
  parent2TelDomicile: '',
  parent2TelTravail: '',
  parent2Profession: '',
  parent2Entreprise: '',
  parent2PaysResidence: '',
  urgenceNom: '',
  urgenceTel: '',
  urgenceLien: '',
  // Personne autorisée à venir chercher l'enfant
  recupNom: '',
  recupTel: '',
  recupLien: '',
  statut: 'EN_ATTENTE' as StatutAdmission,
  dateDepot: new Date().toISOString().split('T')[0],
  notes: '',
  // ── Fiche sanitaire ────────────────────────────────────────────────────────
  sexe: '' as '' | 'M' | 'F',
  // Vaccins obligatoires
  vaccDiphterie: false,      vaccDiphterieDate: '',
  vaccTetanos: false,        vaccTetanosDate: '',
  vaccPolio: false,          vaccPolioDate: '',
  vaccCoqueluche: false,     vaccCoquelucheDate: '',
  vaccBCG: false,            vaccBCGDate: '',
  // Vaccins recommandés
  vaccHepB: false,           vaccHepBDate: '',
  vaccROR: false,            vaccRORDate: '',
  certifContrIndication: false,
  // Traitement médical en cours
  traitementMedical: false,
  traitementDetail: '',
  // Maladies antérieures
  maladieRubeole: false,
  maladieVaricelle: false,
  maladieAngine: false,
  maladieRhumatisme: false,
  maladieScarlatine: false,
  maladieCoqueluche: false,
  maladieOtite: false,
  maladieRougeole: false,
  maladieOreillons: false,
  // Allergies
  allergieAsthme: false,
  allergieMedicament: false,
  allergieAlimentaire: false,
  allergieAutres: '',
  allergieConduite: '',
  // Difficultés de santé (hospitalisations, accidents, opérations, crises...)
  difficulteSante: '',
  // Équipements portés
  equipeLunettes: false,
  equipeLentilles: false,
  equipeProtheseAuditive: false,
  equipeProtheseDentaire: false,
  equipePrecisions: '',
  // Énurésie nocturne
  mouillerLit: '' as '' | 'OUI' | 'NON' | 'OCCASIONNELLEMENT',
  // Médecin traitant
  medecinNom: '',
  medecinTel: '',
  // Autorisations
  autorisationPhoto: true,
  autorisationSoins: true,
});

type DossierForm = ReturnType<typeof emptyDossier>;

// ─── Sous-composant ligne info ────────────────────────────────────────────────

function DetailRow({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const Admission = ({ currency, user }: { currency: string; user: User }) => {
  const { annee: ANNEE_COURANTE, isInscriptionsOuvertes, getStatutAnnee } = useAnnee();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [filterNiveau, setFilterNiveau] = useState('ALL');
  const [filterSource, setFilterSource] = useState<'ALL' | 'ADMIN' | 'PARENT'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<DossierForm>(emptyDossier());
  const [pieces, setPieces] = useState<Record<string, PieceJointe>>({});
  const [showConfirmStatut, setShowConfirmStatut] = useState<{ dossier: any; newStatut: StatutAdmission } | null>(null);
  const [showAnnulInscription, setShowAnnulInscription] = useState<{ dossier: any; motif: string } | null>(null);
  const [showRejetModal, setShowRejetModal] = useState<{ dossier: any; motif: string } | null>(null);
  const [showParentAccountModal, setShowParentAccountModal] = useState(false);
  const [parentAccountForm, setParentAccountForm] = useState({ email: '', nom: '', prenom: '', motDePasseTemporaire: '' });
  const [parentAccountLoading, setParentAccountLoading] = useState(false);
  const [parentAccountResult, setParentAccountResult] = useState<{ created: boolean; tempPassword?: string } | null>(null);
  const [parentsByEleveId, setParentsByEleveId] = useState<Record<string, { id: string; email: string; name: string; isActive: boolean }[]>>({});
  const [resetPwLoading, setResetPwLoading] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [modeInscription, setModeInscription] = useState(false);

  const showToast = useToast();
  const { isReadOnly } = useAnnee();
  const currentUser = authBridge.getSession()?.user;
  const statutAnnee = getStatutAnnee(ANNEE_COURANTE);
  // Inscriptions accessibles si le statut de l'année est INSCRIPTIONS_OUVERTES ou EN_COURS (ou non encore configuré = legacy)
  const canModify = (currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'eleves') : false) && !isReadOnly && isInscriptionsOuvertes;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dossiersData, classesData, parentData] = await Promise.all([
        apiClient.get('/eleves', { params: { anneeScolaire: ANNEE_COURANTE } }),
        apiClient.get('/classes').catch(() => []),
        apiClient.get('/admin/parent-accounts').catch(() => ({ byEleveId: {} })),
      ]);
      const raw = Array.isArray(dossiersData) ? dossiersData : (dossiersData?.rows ?? dossiersData?.eleves ?? []);
      const unique = [...new Map(raw.map((e: any) => [e.id, e])).values()];
      setDossiers(unique.map(normalizeEleve));
      setClasses(Array.isArray(classesData) ? classesData : []);
      setParentsByEleveId(parentData?.byEleveId || {});
    } catch { setError('Impossible de charger les dossiers.'); }
    finally { setLoading(false); }
  }, [ANNEE_COURANTE]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Source : portail parent vs admin ──────────────────────────────────────

  const isFromParent = (d: any) => typeof d.notes === 'string' && d.notes.includes('[parent_user:');

  // ── Filtrage avec statut correctement résolu ───────────────────────────────

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      const nom = (d.companyName || d.name || '').toLowerCase();
      const matchSearch = nom.includes(search.toLowerCase()) ||
        (d.mainContact || '').toLowerCase().includes(search.toLowerCase());
      const statut = getStatut(d);
      const matchStatut = filterStatut === 'ALL' || statut === filterStatut;
      const niveauVal = d.niveau || '';
      const matchNiveau = filterNiveau === 'ALL' || niveauVal === filterNiveau;
      const fromParent = isFromParent(d);
      const matchSource = filterSource === 'ALL' || (filterSource === 'PARENT' ? fromParent : !fromParent);
      return matchSearch && matchStatut && matchNiveau && matchSource;
    });
  }, [dossiers, search, filterStatut, filterNiveau, filterSource]);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    total:      dossiers.length,
    enAttente:  dossiers.filter(d => getStatut(d) === 'EN_ATTENTE').length,
    admis:      dossiers.filter(d => getStatut(d) === 'ADMIS').length,
    inscrits:   dossiers.filter(d => getStatut(d) === 'INSCRIT').length,
    actifs:     dossiers.filter(d => getStatut(d) === 'ACTIF').length,
    rejetes:    dossiers.filter(d => getStatut(d) === 'REJETE').length,
    garcons:    dossiers.filter(d => d.sexe === 'M').length,
    filles:     dossiers.filter(d => d.sexe === 'F').length,
    portail:    dossiers.filter(d => isFromParent(d)).length,
    ceJour:     dossiers.filter(d => {
      const created = d.createdAt || d.created_at || '';
      return created && new Date(created).toDateString() === new Date().toDateString();
    }).length,
  }), [dossiers]);

  // ── Construire le payload API depuis le formulaire ─────────────────────────

  // Convertit une chaîne vide en null pour les colonnes DATE PostgreSQL
  const nd = (v: string) => v || null;

  const buildPayload = (f: DossierForm) => ({
    nom:            f.nomEnfant.trim(),
    prenom:         f.prenomEnfant.trim(),
    dateNaissance:  nd(f.dateNaissance),
    lieuNaissance:  f.lieuNaissance,
    niveau:         f.niveau,
    classeId:       f.classeId || undefined,
    statut:         f.statut,
    regimeFinancier: f.regimeFinancier,
    remisePct:      f.remisePct,
    cantine:        f.cantine,
    transportBus:   f.transportBus,
    garderie:       NIVEAUX_MATERNELLE.includes(f.niveau) && f.garderie,
    photoUrl:       f.photoUrl || null,
    besoinSpecifique: f.besoinSpecifique,
    dateAdmission:  nd(f.dateDepot),
    anneeScolaire:  ANNEE_COURANTE,
    notes:          f.notes,
    sexe:           f.sexe || null,
    parentsMemeResidence: f.parentsMemeResidence,
    situationMatrimoniale: f.situationMatrimoniale || null,
    whatsappPrincipal: f.parent1Whatsapp || f.parent1Tel || null,
    parent1: {
      nom:       f.parent1Nom,
      prenom:    f.parent1Prenom,
      telephone: f.parent1Tel,
      whatsapp:  f.parent1Whatsapp || f.parent1Tel,
      email:     f.parent1Email || undefined,
      lien:      f.parent1Lien,
      telDomicile: f.parent1TelDomicile,
      telTravail:  f.parent1TelTravail,
      adresse:     f.parent1Adresse,
      profession:  f.parent1Profession,
      entreprise:  f.parent1Entreprise,
      paysResidence: f.parent1PaysResidence,
    },
    ...(f.parent2Nom || f.parent2Prenom ? {
      parent2: {
        nom:        f.parent2Nom,
        prenom:     f.parent2Prenom,
        lien:       f.parent2Lien,
        telephone:  f.parent2Tel,
        telDomicile: f.parent2TelDomicile,
        telTravail:  f.parent2TelTravail,
        profession:  f.parent2Profession,
        entreprise:  f.parent2Entreprise,
        paysResidence: f.parent2PaysResidence,
      },
    } : {}),
    contactUrgence: f.urgenceNom ? {
      nom:       f.urgenceNom,
      prenom:    '',
      telephone: f.urgenceTel,
      lien:      f.urgenceLien || undefined,
    } : undefined,
    personneAutorisee: f.recupNom ? {
      nom:       f.recupNom,
      telephone: f.recupTel,
      lien:      f.recupLien || undefined,
    } : null,
    ficheSanitaire: {
      vaccDiphterie: f.vaccDiphterie,           vaccDiphterieDate: nd(f.vaccDiphterieDate),
      vaccTetanos:   f.vaccTetanos,             vaccTetanosDate:   nd(f.vaccTetanosDate),
      vaccPolio:     f.vaccPolio,               vaccPolioDate:     nd(f.vaccPolioDate),
      vaccCoqueluche: f.vaccCoqueluche,         vaccCoquelucheDate: nd(f.vaccCoquelucheDate),
      vaccBCG:       f.vaccBCG,                 vaccBCGDate:       nd(f.vaccBCGDate),
      vaccHepB:      f.vaccHepB,                vaccHepBDate:      nd(f.vaccHepBDate),
      vaccROR:       f.vaccROR,                 vaccRORDate:       nd(f.vaccRORDate),
      certifContrIndication: f.certifContrIndication,
      traitementMedical: f.traitementMedical,   traitementDetail: f.traitementDetail,
      maladieRubeole: f.maladieRubeole,         maladieVaricelle: f.maladieVaricelle,
      maladieAngine: f.maladieAngine,           maladieRhumatisme: f.maladieRhumatisme,
      maladieScarlatine: f.maladieScarlatine,   maladieCoqueluche: f.maladieCoqueluche,
      maladieOtite: f.maladieOtite,             maladieRougeole: f.maladieRougeole,
      maladieOreillons: f.maladieOreillons,
      allergieAsthme: f.allergieAsthme,         allergieMedicament: f.allergieMedicament,
      allergieAlimentaire: f.allergieAlimentaire, allergieAutres: f.allergieAutres,
      allergieConduite: f.allergieConduite,     difficulteSante: f.difficulteSante,
      equipeLunettes: f.equipeLunettes,         equipeLentilles: f.equipeLentilles,
      equipeProtheseAuditive: f.equipeProtheseAuditive, equipeProtheseDentaire: f.equipeProtheseDentaire,
      equipePrecisions: f.equipePrecisions,     mouillerLit: f.mouillerLit || null,
      medecinNom: f.medecinNom,                 medecinTel: f.medecinTel,
      autorisationPhoto: f.autorisationPhoto,   autorisationSoins: f.autorisationSoins,
    },
  });

  // ── Pièces jointes → dossier numérique de l'élève ─────────────────────────
  // Les fichiers joints au formulaire sont versés dans eleve_documents
  // (catégorie ADMINISTRATIF) via la route existante du dossier.
  const uploadPieces = async (eleveId: string) => {
    const list: PieceJointe[] = Object.values(pieces);
    for (const p of list) {
      try {
        await apiClient.post(`/eleves/${eleveId}/dossier`, {
          categorie: 'ADMINISTRATIF',
          typeDoc: p.typeDoc,
          nom: p.nom,
          fileUrl: p.dataUrl,
          mimeType: p.mimeType,
          fileSize: p.fileSize,
        });
      } catch (e) {
        console.warn('[Admission] Pièce jointe non enregistrée :', p.nom, e);
      }
    }
    if (list.length) setPieces({});
  };

  // ── Créer un dossier ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canModify) return;
    if (!form.prenomEnfant.trim() || !form.nomEnfant.trim()) {
      setError('Prénom et nom de l\'enfant sont obligatoires.');
      return;
    }
    {
      const manquantes = missingRequiredPieces(form.niveau, pieces);
      if (manquantes.length) {
        setError(`Pièces obligatoires manquantes : ${manquantes.join(' · ')}`);
        return;
      }
    }
    setActionLoading(true);
    setError(null);
    try {
      const created: any = await apiClient.post('/eleves', buildPayload(form));
      if (created?.id) await uploadPieces(created.id);
      showToast('Dossier d\'admission créé.', 'success');
      setModalMode(null);
      setWizardStep(1);
      fetchData();
    } catch (err: any) { setError(err.message || 'Erreur lors de la création.'); }
    finally { setActionLoading(false); }
  };

  // ── Inscription directe (crée le dossier Customer + l'Eleve en une passe) ──

  const handleCreateEleve = async () => {
    if (!canModify) return;
    if (!form.prenomEnfant.trim() || !form.nomEnfant.trim()) {
      setError('Prénom et nom de l\'enfant sont obligatoires.');
      return;
    }
    if (!form.parent1Tel) {
      setError('Le téléphone du parent est obligatoire.');
      return;
    }
    {
      const manquantes = missingRequiredPieces(form.niveau, pieces);
      if (manquantes.length) {
        setError(`Pièces obligatoires manquantes : ${manquantes.join(' · ')}`);
        return;
      }
    }
    setActionLoading(true);
    setError(null);
    try {
      const statutEleve: StatutAdmission = ['INSCRIT', 'ACTIF'].includes(form.statut) ? form.statut : 'INSCRIT';
      const created: any = await apiClient.post('/eleves', buildPayload({ ...form, statut: statutEleve }));
      if (created?.id) await uploadPieces(created.id);
      showToast('Élève inscrit et dossier créé avec succès.', 'success');
      setModalMode(null);
      setWizardStep(1);
      setModeInscription(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Modifier un dossier ────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!canModify || !selected) return;
    if (!form.prenomEnfant || !form.nomEnfant) {
      setError('Prénom et nom de l\'enfant sont obligatoires.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.put(`/eleves/${selected.id}`, buildPayload(form));
      await uploadPieces(selected.id);
      showToast('Dossier mis à jour.', 'success');
      setModalMode(null);
      setSelected(null);
      setWizardStep(1);
      fetchData();
    } catch (err: any) { setError(err.message || 'Erreur lors de la modification.'); }
    finally { setActionLoading(false); }
  };

  // ── Changer le statut ──────────────────────────────────────────────────────

  const handleUpdateStatut = async () => {
    if (!showConfirmStatut || !canModify) return;
    setActionLoading(true);
    try {
      const newStatut = showConfirmStatut.newStatut;
      await apiClient.put(`/eleves/${showConfirmStatut.dossier.id}`, {
        statut: newStatut,
      });
      showToast(`Statut mis à jour : ${newStatut}`, 'success');
      setShowConfirmStatut(null);
      setSelected(null);
      setModalMode(null);
      fetchData();
    } catch (err: any) { showToast(err.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  // ── Rejeter une candidature (EN_ATTENTE/ADMIS → REJETE) avec motif ─────────

  const handleRejet = async () => {
    if (!showRejetModal || !canModify) return;
    const { dossier, motif } = showRejetModal;
    if (!motif.trim()) return;
    setActionLoading(true);
    try {
      const date = new Date().toLocaleDateString('fr-FR');
      const notesUpdated = [dossier.notes, `[REJET ${date}] ${motif.trim()}`]
        .filter(Boolean).join('\n');
      await apiClient.put(`/eleves/${dossier.id}`, {
        statut: 'REJETE',
        notes: notesUpdated,
      });
      showToast('Candidature refusée. Le parent verra le motif dans son espace.', 'success');
      setShowRejetModal(null);
      setSelected(null);
      setModalMode(null);
      fetchData();
    } catch (err: any) { showToast(err.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  // ── Annuler une inscription (INSCRIT/ACTIF → RADIE) ──────────────────────

  const handleAnnulInscription = async () => {
    if (!showAnnulInscription || !canModify) return;
    const { dossier, motif } = showAnnulInscription;
    if (!motif.trim()) return;
    setActionLoading(true);
    try {
      const notesUpdated = [dossier.notes, `[ANNULATION ${new Date().toLocaleDateString('fr-FR')}] ${motif.trim()}`]
        .filter(Boolean).join('\n');
      await apiClient.put(`/eleves/${dossier.id}`, {
        statut: 'RADIE',
        notes: notesUpdated,
      });
      showToast('Inscription annulée.', 'success');
      setShowAnnulInscription(null);
      setSelected(null);
      setModalMode(null);
      fetchData();
    } catch (err: any) { showToast(err.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  // ── Ouvrir les modals ──────────────────────────────────────────────────────

  const openView = (d: any) => { setSelected(d); setModalMode('VIEW'); };

  const openCreate = () => {
    setForm(emptyDossier());
    setPieces({});
    setError(null);
    setWizardStep(1);
    setModeInscription(false);
    setModalMode('CREATE');
  };

  const openEdit = (d: any) => {
    setPieces({});
    // d is already normalized by normalizeEleve — parent1Nom, parent1Tel, etc. are flat
    setForm({
      nomEnfant:       d.nom || '',
      prenomEnfant:    d.prenom || '',
      dateNaissance:   d.dateNaissance || '',
      lieuNaissance:   d.lieuNaissance || d.billingAddress || '',
      niveau:          (d.niveau as NiveauScolaire) || 'PS',
      classeId:        d.classeId || '',
      regimeFinancier: (d.regimeFinancier as RegimeFinancier) || 'NORMAL',
      remisePct:       d.remisePct || 0,
      cantine:         !!d.cantine,
      transportBus:    !!d.transportBus,
      garderie:        !!d.garderie,
      photoUrl:        d.photoUrl || '',
      besoinSpecifique: d.besoinSpecifique || '',
      parent1Nom:      d.parent1Nom || '',
      parent1Prenom:   d.parent1Prenom || '',
      parent1Tel:      d.parent1Tel || '',
      parent1Whatsapp: d.parent1Whatsapp || '',
      parent1Email:    d.parent1Email || '',
      parent1Lien:     (d.parent1Lien || 'MERE') as 'PERE' | 'MERE' | 'TUTEUR',
      urgenceNom:      d.urgenceNom || '',
      urgenceTel:      d.urgenceTel || '',
      urgenceLien:     d.urgenceLien || '',
      recupNom:        d.recupNom || '',
      recupTel:        d.recupTel || '',
      recupLien:       d.recupLien || '',
      parent1TelDomicile: d.parent1TelDomicile || '',
      parent1TelTravail:  d.parent1TelTravail || '',
      parent1Adresse:     d.parent1Adresse || '',
      parent1Profession:  d.parent1Profession || '',
      parent1Entreprise:  d.parent1Entreprise || '',
      parent1PaysResidence: d.parent1PaysResidence || '',
      parent2Nom:      d.parent2Nom || '',
      parent2Prenom:   d.parent2Prenom || '',
      parent2Lien:     (d.parent2Lien || 'PERE') as 'PERE' | 'MERE' | 'TUTEUR',
      parent2Tel:      d.parent2Tel || '',
      parent2TelDomicile: d.parent2TelDomicile || '',
      parent2TelTravail:  d.parent2TelTravail || '',
      parent2Profession:  d.parent2Profession || '',
      parent2Entreprise:  d.parent2Entreprise || '',
      parent2PaysResidence: d.parent2PaysResidence || '',
      statut:          getStatut(d),
      dateDepot:       d.dateAdmission || d.dateDepot || (d.createdAt || d.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes:           d.notes || '',
      // Fiche sanitaire
      sexe: (d.sexe || '') as '' | 'M' | 'F',
      vaccDiphterie: !!d.vaccDiphterie, vaccDiphterieDate: d.vaccDiphterieDate || '',
      vaccTetanos:   !!d.vaccTetanos,   vaccTetanosDate:   d.vaccTetanosDate || '',
      vaccPolio:     !!d.vaccPolio,     vaccPolioDate:     d.vaccPolioDate || '',
      vaccCoqueluche:!!d.vaccCoqueluche,vaccCoquelucheDate:d.vaccCoquelucheDate || '',
      vaccBCG:       !!d.vaccBCG,       vaccBCGDate:       d.vaccBCGDate || '',
      vaccHepB:      !!d.vaccHepB,      vaccHepBDate:      d.vaccHepBDate || '',
      vaccROR:       !!d.vaccROR,       vaccRORDate:       d.vaccRORDate || '',
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
      mouillerLit: (d.mouillerLit || '') as '' | 'OUI' | 'NON' | 'OCCASIONNELLEMENT',
      medecinNom: d.medecinNom || '',
      medecinTel: d.medecinTel || '',
      autorisationPhoto: d.autorisationPhoto !== false,
      autorisationSoins: d.autorisationSoins !== false,
    });
    setSelected(d);
    setError(null);
    setWizardStep(1);
    setModalMode('EDIT');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <ClipboardList className="text-indigo-600" size={32} /> Admissions & Dossiers
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Gestion des dossiers candidats — Année {ANNEE_COURANTE}
          </p>
        </div>
        {canModify && (
          <button onClick={openCreate}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
            <Plus size={18} /> NOUVEAU DOSSIER
          </button>
        )}
      </div>

      {/* ── Bannière inscriptions fermées ── */}
      {!isReadOnly && statutAnnee && !['INSCRIPTIONS_OUVERTES', 'EN_COURS'].includes(statutAnnee) && (
        <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-[2rem]">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <Info size={20} className="text-amber-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-900 uppercase tracking-wide">
              Inscriptions non ouvertes pour {ANNEE_COURANTE}
            </p>
            <p className="text-[11px] text-amber-700 font-bold mt-1">
              {statutAnnee === 'PREPARATION'
                ? `L'année ${ANNEE_COURANTE} est en cours de préparation. Allez dans Paramètres > Années scolaires pour ouvrir les inscriptions.`
                : `L'année ${ANNEE_COURANTE} est clôturée. Les dossiers sont consultables en lecture seule.`
              }
            </p>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Total dossiers',   value: kpis.total,     color: 'bg-slate-900 text-white',          icon: ClipboardList },
          { label: 'Candidatures',     value: kpis.enAttente, color: 'bg-amber-50 text-amber-700',       icon: Clock },
          { label: 'Admis',            value: kpis.admis,     color: 'bg-blue-50 text-blue-700',         icon: CheckCircle2 },
          { label: 'Inscrits',         value: kpis.inscrits,  color: 'bg-violet-50 text-violet-700',     icon: UserCheck },
          { label: 'Actifs',           value: kpis.actifs,    color: 'bg-emerald-50 text-emerald-700',   icon: UserCheck },
          { label: 'Refusés',          value: kpis.rejetes,   color: 'bg-rose-50 text-rose-700',         icon: Ban },
          { label: 'Portail parents',  value: kpis.portail,   color: 'bg-purple-50 text-purple-700',     icon: Globe },
          { label: 'Garçons',          value: kpis.garcons,   color: 'bg-sky-50 text-sky-700',           icon: UserCheck, prefix: '♂' },
          { label: 'Filles',           value: kpis.filles,    color: 'bg-pink-50 text-pink-600',         icon: UserCheck, prefix: '♀' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`${k.color} p-5 rounded-3xl shadow-sm flex flex-col gap-2`}>
              {(k as any).prefix
                ? <span className="text-2xl font-black opacity-70">{(k as any).prefix}</span>
                : <Icon size={20} className="opacity-60" />}
              <p className="text-3xl font-black">{k.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Barre de recherche ── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher un enfant ou un parent..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showFilters ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          <Filter size={16} /> Filtres
        </button>
        <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Onglets de statut ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatut('ALL')}
          className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
            filterStatut === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          }`}>
          Tous <span className="ml-1 opacity-60">({dossiers.length})</span>
        </button>
        {STATUTS_ADMISSION.map(s => {
          const count = dossiers.filter(d => getStatut(d) === s.value).length;
          const active = filterStatut === s.value;
          return (
            <button key={s.value}
              onClick={() => setFilterStatut(active ? 'ALL' : s.value)}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                active ? `${s.color} border-current` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}>
              {s.label} <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}

        {/* Séparateur */}
        <span className="w-px h-5 bg-slate-200 self-center" />

        {/* Filtres par source */}
        {([
          { value: 'ALL',    label: 'Toutes sources',    icon: ClipboardList },
          { value: 'ADMIN',  label: 'Saisie admin',      icon: Building2 },
          { value: 'PARENT', label: 'Portail parents',   icon: Globe },
        ] as const).map(s => {
          const Icon = s.icon;
          const active = filterSource === s.value;
          const count = s.value === 'ALL' ? dossiers.length
            : s.value === 'PARENT' ? dossiers.filter(d => isFromParent(d)).length
            : dossiers.filter(d => !isFromParent(d)).length;
          return (
            <button key={s.value} onClick={() => setFilterSource(s.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                active
                  ? s.value === 'PARENT'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : s.value === 'ADMIN'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}>
              <Icon size={11} /> {s.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Niveau scolaire</label>
            <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les niveaux</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterStatut('ALL'); setFilterNiveau('ALL'); setSearch(''); }}
              className="w-full py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">
              RÉINITIALISER
            </button>
          </div>
        </div>
      )}

      {error && !modalMode && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Table des dossiers ── */}
      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
              <th className="px-6 py-4">Enfant</th>
              <th className="px-6 py-4">Niveau</th>
              <th className="px-6 py-4">Parent / Contact</th>
              <th className="px-6 py-4 text-center">Source</th>
              <th className="px-6 py-4 text-center">Statut</th>
              <th className="px-6 py-4 text-center">Options</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="h-16"><td colSpan={6} className="px-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-20 text-center">
                <ClipboardList size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucun dossier trouvé</p>
              </td></tr>
            ) : filtered.map(d => {
              const nomEnfant = d.companyName || d.name || '—';
              const contact = d.mainContact || '—';
              const niveau = d.niveau as NiveauScolaire | undefined;
              const statut = getStatut(d);
              const avecCantine = !!d.cantine;
              const avecBus = !!(d.transportBus || d.transport_bus);
              const peutEditer = statut !== 'INSCRIT' && statut !== 'ACTIF' && statut !== 'RADIE';
              const fromParent = isFromParent(d);
              return (
                <tr key={d.id} className={`group hover:bg-slate-50/60 transition-all ${fromParent ? 'border-l-2 border-l-purple-400' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {d.photoUrl ? (
                        <img src={d.photoUrl} alt={nomEnfant}
                          className="w-9 h-9 rounded-xl object-cover border border-indigo-100 shrink-0" />
                      ) : (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          fromParent ? 'bg-purple-100 text-purple-700' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {nomEnfant.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900 text-sm uppercase">{nomEnfant}</p>
                          {d.sexe === 'M' && <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[8px] font-black border border-sky-100 shrink-0">♂ G</span>}
                          {d.sexe === 'F' && <span className="px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full text-[8px] font-black border border-pink-100 shrink-0">♀ F</span>}
                          {fromParent ? (
                            <span title="Dossier soumis via le portail parent"
                              className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[8px] font-black border border-purple-200 shrink-0 flex items-center gap-1">
                              <Globe size={8}/> Portail parent
                            </span>
                          ) : (
                            <span title="Dossier créé par l'administration"
                              className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black border border-slate-200 shrink-0 flex items-center gap-1">
                              <Building2 size={8}/> Admin
                            </span>
                          )}
                          {parentsByEleveId[d.id]?.length > 0 && (
                            <span title={`Compte parent : ${parentsByEleveId[d.id].map((p: any) => p.email).join(', ')}`}
                              className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[8px] font-black border border-amber-200 shrink-0 flex items-center gap-1">
                              <UserPlus size={8}/> Accès parent
                            </span>
                          )}
                        </div>
                        {d.dateNaissance && (
                          <p className="text-[9px] text-slate-400 font-bold">
                            Né(e) le {new Date(d.dateNaissance).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {niveau
                      ? <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase">{niveauLabel(niveau)}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700 text-xs">{contact}</p>
                    {d.phone && <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><Phone size={9}/> {d.phone}</p>}
                  </td>
                  <td className="px-6 py-4 text-center"><StatutBadge statut={statut} /></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {avecCantine && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[8px] font-black border border-emerald-200">Cantine</span>}
                      {avecBus && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[8px] font-black border border-amber-200">Bus</span>}
                      {!!d.garderie && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[8px] font-black border border-indigo-200">Garderie</span>}
                      {!avecCantine && !avecBus && !d.garderie && <span className="text-slate-300 text-[9px]">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(d)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Voir le dossier">
                        <Eye size={16} />
                      </button>
                      {canModify && peutEditer && (
                        <button onClick={() => openEdit(d)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier le dossier">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ MODAL CRÉER / MODIFIER — WIZARD 4 ÉTAPES ══════════════════════════ */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-500">

            {/* En-tête */}
            <div className="px-8 pt-8 pb-0 bg-slate-900 text-white shrink-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                  <ClipboardList size={20}/>
                  {modalMode === 'CREATE' ? (modeInscription ? 'Inscription directe' : 'Nouveau Dossier d\'Admission') : 'Modifier le Dossier'}
                </h3>
                <button onClick={() => { setModalMode(null); setWizardStep(1); setModeInscription(false); }}
                  className="p-2 hover:bg-white/10 rounded-2xl transition-all"><X size={20} /></button>
              </div>
              {/* Toggle mode — uniquement en création */}
              {modalMode === 'CREATE' && (
                <div className="flex items-center gap-1 mb-4 p-1 bg-white/10 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => { setModeInscription(false); setForm(f => ({ ...f, statut: 'EN_ATTENTE' as StatutAdmission })); }}
                    className={`flex-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!modeInscription ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}
                  >
                    Dossier candidature
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModeInscription(true); setForm(f => ({ ...f, statut: 'INSCRIT' as StatutAdmission })); }}
                    className={`flex-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${modeInscription ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                  >
                    ⚡ Inscription directe
                  </button>
                </div>
              )}

              {/* Indicateur d'étapes */}
              <div className="flex items-center gap-0 pb-0">
                {[
                  { n: 1, label: 'Identité',   icon: Baby },
                  { n: 2, label: 'Scolarité',  icon: GraduationCap },
                  { n: 3, label: 'Santé',      icon: Stethoscope },
                  { n: 4, label: 'Parents',    icon: Phone },
                  { n: 5, label: 'Validation', icon: CheckCircle2 },
                ].map((s, i) => {
                  const Icon = s.icon;
                  const done = wizardStep > s.n;
                  const active = wizardStep === s.n;
                  return (
                    <React.Fragment key={s.n}>
                      <div className={`flex flex-col items-center gap-1 px-2 pb-3 border-b-2 transition-all flex-1 ${active ? 'border-indigo-400' : done ? 'border-emerald-400' : 'border-transparent'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${active ? 'bg-indigo-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                          {done ? <CheckCircle2 size={14}/> : <Icon size={14}/>}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-500'}`}>{s.label}</span>
                      </div>
                      {i < 4 && <div className={`w-3 h-0.5 mb-4 shrink-0 transition-all ${wizardStep > s.n ? 'bg-emerald-400' : 'bg-white/10'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Contenu de l'étape */}
            <div className="flex-1 overflow-y-auto p-8">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                  <AlertCircle size={14}/> {error}
                </div>
              )}

              {/* ── Étape 1 : Identité ── */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Baby size={13} className="text-indigo-500"/> Identité de l'enfant
                  </p>

                  {/* Photo de l'enfant */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {form.photoUrl ? (
                        <>
                          <img src={form.photoUrl} alt="Photo de l'enfant"
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm" />
                          <button type="button" onClick={() => setForm({ ...form, photoUrl: '' })}
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
                              try { setForm({ ...form, photoUrl: await compressImageToDataUrl(file) }); }
                              catch { showToast('Impossible de lire cette image.', 'error'); }
                            }} />
                        </label>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Photo de l'enfant</p>
                      <p className="text-xs text-slate-400 mt-1">Photo d'identité récente — visible sur le dossier et la fiche de l'élève.</p>
                      {form.photoUrl && (
                        <label className="inline-block mt-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest cursor-pointer hover:text-indigo-800">
                          Changer
                          <input type="file" accept="image/*" className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try { setForm({ ...form, photoUrl: await compressImageToDataUrl(file) }); }
                              catch { showToast('Impossible de lire cette image.', 'error'); }
                            }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.prenomEnfant} onChange={e => setForm({...form, prenomEnfant: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.nomEnfant} onChange={e => setForm({...form, nomEnfant: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom de famille" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Date de naissance</label>
                      <input type="date" value={form.dateNaissance} onChange={e => setForm({...form, dateNaissance: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lieu de naissance</label>
                      <input type="text" value={form.lieuNaissance} onChange={e => setForm({...form, lieuNaissance: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Dakar" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Sexe</label>
                      <div className="flex gap-2">
                        {[{ v: 'M', l: 'Garçon' }, { v: 'F', l: 'Fille' }].map(s => (
                          <button key={s.v} type="button" onClick={() => setForm({...form, sexe: s.v as 'M' | 'F'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${form.sexe === s.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Date de dépôt du dossier</label>
                      <input type="date" value={form.dateDepot} onChange={e => setForm({...form, dateDepot: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Statut</label>
                      {modeInscription ? (
                        <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value as StatutAdmission})}
                          className="w-full bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none text-indigo-700">
                          <option value="INSCRIT">Inscrit</option>
                          <option value="ACTIF">Actif</option>
                        </select>
                      ) : (
                        <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value as StatutAdmission})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                          {STATUTS_ADMISSION.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 2 : Scolarité & Options ── */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap size={13} className="text-indigo-500"/> Scolarité &amp; options
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Niveau demandé <span className="text-rose-500">*</span></label>
                      <select value={form.niveau} onChange={e => setForm({...form, niveau: e.target.value as NiveauScolaire, classeId: ''})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                        {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                      </select>
                    </div>
                    {modeInscription && (
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Classe assignée</label>
                        <select
                          value={form.classeId || ''}
                          onChange={e => setForm({...form, classeId: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none"
                        >
                          <option value="">Non affectée pour l'instant</option>
                          {classes.filter(c => c.niveau === form.niveau).map(c => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                          {classes.filter(c => c.niveau === form.niveau).length === 0 && (
                            <option disabled>Aucune classe pour ce niveau</option>
                          )}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Régime financier</label>
                      <select value={form.regimeFinancier} onChange={e => {
                        const regime = e.target.value as RegimeFinancier;
                        setForm({ ...form, regimeFinancier: regime, remisePct: regime === 'CAS_SOCIAL_TOTAL' ? 100 : regime === 'NORMAL' ? 0 : form.remisePct });
                      }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                        {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    {form.regimeFinancier === 'CAS_SOCIAL_TOTAL' && (
                      <div className="col-span-2 flex items-center gap-3 px-5 py-3 bg-violet-50 border border-violet-200 rounded-2xl">
                        <Heart size={16} className="text-violet-600 shrink-0" />
                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest flex-1">Exonération totale — 100 % de remise appliquée automatiquement</span>
                        <span className="px-3 py-1 bg-violet-600 text-white rounded-xl text-xs font-black">100 %</span>
                      </div>
                    )}
                    {form.regimeFinancier === 'CAS_SOCIAL_PARTIEL' && (
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Remise cas social (%)</label>
                        <input type="number" min={1} max={99} value={form.remisePct}
                          onChange={e => setForm({...form, remisePct: Number(e.target.value)})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1 flex-wrap">
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1 min-w-[45%]">
                      <input type="checkbox" checked={form.cantine} onChange={e => setForm({...form, cantine: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Cantine</span>
                    </label>
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1 min-w-[45%]">
                      <input type="checkbox" checked={form.transportBus} onChange={e => setForm({...form, transportBus: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Bus scolaire</span>
                    </label>
                    {/* Garderie : maternelle uniquement (crèche, PS, MS, GS) */}
                    {NIVEAUX_MATERNELLE.includes(form.niveau) && (
                      <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1 min-w-[45%]">
                        <input type="checkbox" checked={form.garderie} onChange={e => setForm({...form, garderie: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Garderie</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Besoins spécifiques</label>
                    <input type="text" value={form.besoinSpecifique} onChange={e => setForm({...form, besoinSpecifique: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                      placeholder="Allergie, retard de développement, handisport…" />
                  </div>
                </div>
              )}

              {/* ── Étape 3 : Fiche Sanitaire ── */}
              {wizardStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Stethoscope size={13} className="text-rose-500"/> Fiche sanitaire de liaison
                  </p>

                  {/* Vaccinations */}
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Vaccinations — Vaccins obligatoires</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: 'vaccDiphterie', dateKey: 'vaccDiphterieDate', label: 'Diphtérie / Tétanos / Polio' },
                        { key: 'vaccPolio',     dateKey: 'vaccPolioDate',     label: 'Poliomyélite' },
                        { key: 'vaccCoqueluche',dateKey: 'vaccCoquelucheDate',label: 'Coqueluche (ou DT Polio / Tétracoq)' },
                        { key: 'vaccBCG',       dateKey: 'vaccBCGDate',       label: 'BCG' },
                      ].map(v => (
                        <div key={v.key} className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer w-56 shrink-0">
                            <input type="checkbox" checked={(form as any)[v.key]} onChange={e => setForm({...form, [v.key]: e.target.checked} as any)} className="w-4 h-4 accent-indigo-600" />
                            <span className="text-xs font-bold text-slate-700">{v.label}</span>
                          </label>
                          {(form as any)[v.key] && (
                            <input type="date" value={(form as any)[v.dateKey]} onChange={e => setForm({...form, [v.dateKey]: e.target.value} as any)}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Date du rappel" />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-3 mb-2">Vaccins recommandés</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: 'vaccHepB', dateKey: 'vaccHepBDate', label: 'Hépatite B' },
                        { key: 'vaccROR',  dateKey: 'vaccRORDate',  label: 'Rubéole / Oreillons / Rougeole (ROR)' },
                      ].map(v => (
                        <div key={v.key} className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer w-56 shrink-0">
                            <input type="checkbox" checked={(form as any)[v.key]} onChange={e => setForm({...form, [v.key]: e.target.checked} as any)} className="w-4 h-4 accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">{v.label}</span>
                          </label>
                          {(form as any)[v.key] && (
                            <input type="date" value={(form as any)[v.dateKey]} onChange={e => setForm({...form, [v.dateKey]: e.target.value} as any)}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                          )}
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={form.certifContrIndication} onChange={e => setForm({...form, certifContrIndication: e.target.checked})} className="w-4 h-4 accent-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700">Certificat médical de contre-indication joint (si vaccin manquant)</span>
                    </label>
                  </div>

                  {/* Traitement médical */}
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Traitement médical en cours</p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.traitementMedical} onChange={e => setForm({...form, traitementMedical: e.target.checked})} className="w-4 h-4 accent-rose-600" />
                      <span className="text-xs font-bold text-slate-700">L'enfant suit un traitement médical</span>
                    </label>
                    {form.traitementMedical && (
                      <textarea value={form.traitementDetail} onChange={e => setForm({...form, traitementDetail: e.target.value})}
                        className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-500/10 min-h-[60px]"
                        placeholder="Préciser le traitement (joindre ordonnance récente + médicaments dans emballage d'origine au nom de l'enfant)…" />
                    )}
                  </div>

                  {/* Maladies antérieures */}
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Maladies antérieures</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'maladieRubeole',    label: 'Rubéole' },
                        { key: 'maladieVaricelle',  label: 'Varicelle' },
                        { key: 'maladieAngine',     label: 'Angine' },
                        { key: 'maladieRhumatisme', label: 'Rhumatisme articulaire aigu' },
                        { key: 'maladieScarlatine', label: 'Scarlatine' },
                        { key: 'maladieCoqueluche', label: 'Coqueluche' },
                        { key: 'maladieOtite',      label: 'Otite' },
                        { key: 'maladieRougeole',   label: 'Rougeole' },
                        { key: 'maladieOreillons',  label: 'Oreillons' },
                      ].map(m => (
                        <label key={m.key} className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all">
                          <input type="checkbox" checked={(form as any)[m.key]} onChange={e => setForm({...form, [m.key]: e.target.checked} as any)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-[11px] font-bold text-slate-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Allergies */}
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Allergies</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: 'allergieAsthme',      label: 'Asthme' },
                        { key: 'allergieMedicament',  label: 'Médicamenteuses' },
                        { key: 'allergieAlimentaire', label: 'Alimentaires' },
                      ].map(a => (
                        <label key={a.key} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 transition-all ${(form as any)[a.key] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'}`}>
                          <input type="checkbox" checked={(form as any)[a.key]} onChange={e => setForm({...form, [a.key]: e.target.checked} as any)} className="w-4 h-4 accent-white" />
                          <span className="text-[10px] font-black uppercase">{a.label}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Autres allergies (préciser la cause)</label>
                      <input type="text" value={form.allergieAutres} onChange={e => setForm({...form, allergieAutres: e.target.value})}
                        className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                        placeholder="Ex : acariens, latex, pollen…" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Conduite à tenir en cas de crise</label>
                      <textarea value={form.allergieConduite} onChange={e => setForm({...form, allergieConduite: e.target.value})}
                        className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 min-h-[60px]"
                        placeholder="Protocole, médicament d'urgence, automédication autorisée…" />
                    </div>
                  </div>

                  {/* Difficultés de santé */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">
                      Difficultés de santé — maladies graves, accidents, crises convulsives, hospitalisations, opérations, rééducation (préciser dates et précautions)
                    </label>
                    <textarea value={form.difficulteSante} onChange={e => setForm({...form, difficulteSante: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[80px]"
                      placeholder="Ex : hospitalisation pour appendicite (01/2024), crises fébriles (précautions : …)…" />
                  </div>

                  {/* Équipements portés */}
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Équipements portés</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'equipeLunettes',         label: 'Lunettes' },
                        { key: 'equipeLentilles',        label: 'Lentilles de contact' },
                        { key: 'equipeProtheseAuditive', label: 'Prothèse auditive' },
                        { key: 'equipeProtheseDentaire', label: 'Prothèse dentaire' },
                      ].map(e => (
                        <label key={e.key} className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all">
                          <input type="checkbox" checked={(form as any)[e.key]} onChange={ev => setForm({...form, [e.key]: ev.target.checked} as any)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-[11px] font-bold text-slate-700">{e.label}</span>
                        </label>
                      ))}
                    </div>
                    {(form.equipeLunettes || form.equipeLentilles || form.equipeProtheseAuditive || form.equipeProtheseDentaire) && (
                      <input type="text" value={form.equipePrecisions} onChange={e => setForm({...form, equipePrecisions: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Précisions (marque, degré correction, type d'aide…)" />
                    )}
                  </div>

                  {/* Énurésie nocturne */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-2 block">L'enfant mouille-t-il son lit la nuit ?</label>
                    <div className="flex gap-2">
                      {[{ v: 'OUI', l: 'Oui' }, { v: 'NON', l: 'Non' }, { v: 'OCCASIONNELLEMENT', l: 'Occasionnellement' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => setForm({...form, mouillerLit: opt.v as any})}
                          className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${form.mouillerLit === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Médecin traitant */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Médecin traitant (facultatif)</label>
                      <input type="text" value={form.medecinNom} onChange={e => setForm({...form, medecinNom: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="Nom du médecin" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone du médecin</label>
                      <input type="tel" value={form.medecinTel} onChange={e => setForm({...form, medecinTel: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="+221 77 xxx xxxx" />
                    </div>
                  </div>

                  {/* Autorisations */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Camera size={13}/> Autorisations parentales
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.autorisationSoins} onChange={e => setForm({...form, autorisationSoins: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">
                        J'autorise le responsable de l'établissement à prendre toutes mesures nécessaires (traitement médical, hospitalisation, intervention chirurgicale) en cas d'urgence et à faire sortir mon enfant de l'hôpital après hospitalisation.
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.autorisationPhoto} onChange={e => setForm({...form, autorisationPhoto: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">
                        J'autorise la prise de photographies / vidéos de mon enfant dans le cadre des activités de l'établissement.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── Étape 4 : Parent / Tuteur ── */}
              {wizardStep === 4 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">

                  {/* Situation familiale */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-4">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <Users size={13} /> Situation familiale
                    </p>
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
                            onClick={() => setForm({ ...form, situationMatrimoniale: form.situationMatrimoniale === opt.v ? '' : opt.v })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${form.situationMatrimoniale === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
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
                            onClick={() => setForm({ ...form, parentsMemeResidence: form.parentsMemeResidence === opt.v ? null : opt.v })}
                            className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${form.parentsMemeResidence === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                          >{opt.l}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Phone size={13} className="text-indigo-500"/> Parent / Tuteur légal principal
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom</label>
                        <input type="text" value={form.parent1Prenom} onChange={e => setForm({...form, parent1Prenom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom</label>
                        <input type="text" value={form.parent1Nom} onChange={e => setForm({...form, parent1Nom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <select value={form.parent1Lien} onChange={e => setForm({...form, parent1Lien: e.target.value as any})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                          <option value="MERE">Mère</option>
                          <option value="PERE">Père</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone <span className="text-rose-500">*</span></label>
                        <input type="tel" value={form.parent1Tel}
                          onChange={e => setForm({...form, parent1Tel: e.target.value, parent1Whatsapp: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">WhatsApp</label>
                        <input type="tel" value={form.parent1Whatsapp} onChange={e => setForm({...form, parent1Whatsapp: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Email</label>
                        <input type="text" inputMode="email" value={form.parent1Email} onChange={e => setForm({...form, parent1Email: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="email@exemple.sn" />
                      </div>
                    </div>
                  </div>

                  {/* Téléphones complémentaires parent 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. domicile</label>
                      <input type="tel" value={form.parent1TelDomicile} onChange={e => setForm({...form, parent1TelDomicile: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 33 xxx xxxx" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. travail</label>
                      <input type="tel" value={form.parent1TelTravail} onChange={e => setForm({...form, parent1TelTravail: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 33 xxx xxxx" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Profession</label>
                      <input type="text" value={form.parent1Profession} onChange={e => setForm({...form, parent1Profession: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Enseignante, commerçant…" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom de l'entreprise</label>
                      <input type="text" value={form.parent1Entreprise} onChange={e => setForm({...form, parent1Entreprise: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Employeur / société" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Pays de résidence</label>
                      <input type="text" value={form.parent1PaysResidence} onChange={e => setForm({...form, parent1PaysResidence: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Sénégal" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Adresse</label>
                      <input type="text" value={form.parent1Adresse} onChange={e => setForm({...form, parent1Adresse: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Rue, quartier, ville…" />
                    </div>
                  </div>

                  {/* Parent 2 */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Phone size={13} className="text-indigo-400"/> Second parent / Conjoint(e)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom</label>
                        <input type="text" value={form.parent2Prenom} onChange={e => setForm({...form, parent2Prenom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom</label>
                        <input type="text" value={form.parent2Nom} onChange={e => setForm({...form, parent2Nom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien</label>
                        <select value={form.parent2Lien} onChange={e => setForm({...form, parent2Lien: e.target.value as any})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                          <option value="PERE">Père</option>
                          <option value="MERE">Mère</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. portable</label>
                        <input type="tel" value={form.parent2Tel} onChange={e => setForm({...form, parent2Tel: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. domicile</label>
                        <input type="tel" value={form.parent2TelDomicile} onChange={e => setForm({...form, parent2TelDomicile: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 33 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. travail</label>
                        <input type="tel" value={form.parent2TelTravail} onChange={e => setForm({...form, parent2TelTravail: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 33 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Profession</label>
                        <input type="text" value={form.parent2Profession} onChange={e => setForm({...form, parent2Profession: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom de l'entreprise</label>
                        <input type="text" value={form.parent2Entreprise} onChange={e => setForm({...form, parent2Entreprise: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Pays de résidence</label>
                        <input type="text" value={form.parent2PaysResidence} onChange={e => setForm({...form, parent2PaysResidence: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Sénégal" />
                      </div>
                    </div>
                  </div>

                  {/* Personne autorisée à venir chercher l'enfant */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <UserCheck size={13} className="text-emerald-600"/> Personne autorisée à venir chercher l'enfant
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom complet</label>
                        <input type="text" value={form.recupNom} onChange={e => setForm({...form, recupNom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom et nom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone</label>
                        <input type="tel" value={form.recupTel} onChange={e => setForm({...form, recupTel: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <input type="text" value={form.recupLien} onChange={e => setForm({...form, recupLien: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Grand-frère, nounou, chauffeur…" />
                      </div>
                    </div>
                  </div>

                  {/* Contact urgence */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Shield size={13} className="text-rose-500"/> Contact d'urgence (autre que parents)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom complet</label>
                        <input type="text" value={form.urgenceNom} onChange={e => setForm({...form, urgenceNom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom complet" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone</label>
                        <input type="tel" value={form.urgenceTel} onChange={e => setForm({...form, urgenceTel: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <input type="text" value={form.urgenceLien} onChange={e => setForm({...form, urgenceLien: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Ex: Grand-mère, Oncle…" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 5 : Validation & Notes ── */}
              {wizardStep === 5 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-500"/> Récapitulatif &amp; notes
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Enfant</span>
                      <span className="font-black text-slate-900">{form.prenomEnfant} {form.nomEnfant}</span>
                    </div>
                    {form.dateNaissance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Date de naissance</span>
                        <span className="font-bold text-slate-700">{new Date(form.dateNaissance).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    {form.lieuNaissance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Lieu de naissance</span>
                        <span className="font-bold text-slate-700">{form.lieuNaissance}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Niveau</span>
                      <span className="font-bold text-indigo-700">{niveauLabel(form.niveau)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Régime</span>
                      <span className="font-bold">{regimeLabel(form.regimeFinancier)}{form.remisePct > 0 ? ` — ${form.remisePct}%` : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      {form.cantine && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black border border-emerald-200">Cantine</span>}
                      {form.transportBus && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-xl text-[9px] font-black border border-amber-200">Bus</span>}
                      {NIVEAUX_MATERNELLE.includes(form.niveau) && form.garderie && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black border border-indigo-200">Garderie</span>}
                    </div>
                    {form.besoinSpecifique && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Besoins spécifiques</span>
                        <span className="font-bold text-blue-700 text-right max-w-[60%]">{form.besoinSpecifique}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-100 pt-3 flex justify-between">
                      <span className="text-slate-400 font-bold">Parent</span>
                      <span className="font-black text-slate-900">
                        {form.parent1Prenom} {form.parent1Nom}
                        {' '}({form.parent1Lien === 'MERE' ? 'Mère' : form.parent1Lien === 'PERE' ? 'Père' : 'Tuteur'})
                      </span>
                    </div>
                    {form.parent1Tel && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Téléphone</span>
                        <span className="font-bold text-slate-700">{form.parent1Tel}</span>
                      </div>
                    )}
                    {form.urgenceNom && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Urgence</span>
                        <span className="font-bold text-slate-700">{form.urgenceNom} — {form.urgenceTel}</span>
                      </div>
                    )}
                    {modeInscription && form.classeId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Classe</span>
                        <span className="font-bold text-indigo-700">{classes.find(c => c.id === form.classeId)?.nom || '—'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Statut</span>
                      <StatutBadge statut={form.statut} />
                    </div>
                  </div>

                  {/* Résumé fiche sanitaire */}
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1"><Stethoscope size={11}/> Santé</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { k: 'vaccDiphterie', l: 'Diph.' }, { k: 'vaccPolio', l: 'Polio' },
                          { k: 'vaccCoqueluche', l: 'Coq.' }, { k: 'vaccBCG', l: 'BCG' },
                          { k: 'vaccHepB', l: 'HepB' }, { k: 'vaccROR', l: 'ROR' },
                        ].map(v => (
                          <span key={v.k} className={`px-1.5 py-0.5 rounded text-[8px] font-black ${(form as any)[v.k] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>{v.l}</span>
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        {form.traitementMedical && <p className="text-[10px] font-black text-amber-700">⚠ Traitement médical</p>}
                        {form.allergieAsthme && <p className="text-[10px] font-black text-rose-700">⚠ Asthme</p>}
                        {form.allergieMedicament && <p className="text-[10px] font-black text-rose-700">⚠ Allergie médicamenteuse</p>}
                        {form.allergieAlimentaire && <p className="text-[10px] font-black text-rose-700">⚠ Allergie alimentaire</p>}
                        {!form.traitementMedical && !form.allergieAsthme && !form.allergieMedicament && !form.allergieAlimentaire && (
                          <p className="text-[10px] font-bold text-slate-400">Aucune allergie ni traitement</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <p className={`text-[9px] font-black ${form.autorisationSoins ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {form.autorisationSoins ? '✓' : '✗'} Autorisation soins
                      </p>
                      <p className={`text-[9px] font-black ${form.autorisationPhoto ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {form.autorisationPhoto ? '✓' : '✗'} Autorisation photo
                      </p>
                    </div>
                  </div>

                  {/* Pièces justificatives — versées au dossier numérique après enregistrement */}
                  <PiecesJointes niveau={form.niveau} value={pieces} onChange={setPieces}
                    title="Pièces justificatives fournies par la famille" />

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Notes internes</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[80px]"
                      placeholder="Remarques, documents reçus, observations particulières…" />
                  </div>
                </div>
              )}
            </div>

            {/* Navigation entre étapes */}
            <div className="px-8 py-6 border-t border-slate-100 flex gap-3 shrink-0">
              {wizardStep > 1 && (
                <button type="button" onClick={() => setWizardStep(s => s - 1)}
                  className="px-6 py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                  <ChevronLeft size={16}/> Retour
                </button>
              )}
              {wizardStep < 5 ? (
                <button type="button" onClick={() => {
                  setError(null);
                  if (wizardStep === 1 && (!form.prenomEnfant || !form.nomEnfant)) {
                    setError('Prénom et nom de l\'enfant sont obligatoires.');
                    return;
                  }
                  if (wizardStep === 4 && !form.parent1Tel) {
                    setError('Le téléphone du parent est obligatoire.');
                    return;
                  }
                  setWizardStep(s => s + 1);
                }}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl">
                  Suivant <ArrowRight size={16}/>
                </button>
              ) : (
                <button type="button"
                  onClick={modalMode === 'EDIT' ? handleUpdate : (modeInscription ? handleCreateEleve : handleCreate)}
                  disabled={actionLoading || !form.prenomEnfant || !form.nomEnfant}
                  className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${modeInscription ? 'bg-indigo-600 hover:bg-slate-900' : 'bg-slate-900 hover:bg-indigo-600'}`}>
                  {actionLoading
                    ? <Loader2 className="animate-spin" size={16}/>
                    : <><Save size={15}/> {modalMode === 'EDIT' ? 'ENREGISTRER LES MODIFICATIONS' : modeInscription ? 'INSCRIRE DIRECTEMENT' : 'CRÉER LE DOSSIER'}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL VUE DÉTAILLÉE DU DOSSIER ════════════════════════════════════ */}
      {modalMode === 'VIEW' && selected && (() => {
        const statut = getStatut(selected);
        const peutEditer = statut !== 'INSCRIT' && statut !== 'ACTIF' && statut !== 'RADIE';
        const peutAnnuler = canModify && (statut === 'INSCRIT' || statut === 'ACTIF');
        const nomEnfant = selected.companyName || selected.name || '—';
        const niveau = selected.niveau as NiveauScolaire | undefined;
        const parentFull = selected.mainContact || '';
        return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">

              {/* En-tête */}
              <div className="px-10 py-8 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-start shrink-0">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Dossier d'Admission</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight truncate">{nomEnfant}</h3>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <StatutBadge statut={statut} />
                    {niveau && (
                      <span className="px-3 py-1 bg-white/10 text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20">
                        {niveauLabel(niveau)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canModify && peutEditer && (
                    <button onClick={() => { setModalMode(null); openEdit(selected); }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
                      <Edit3 size={14}/> Modifier
                    </button>
                  )}
                  {(() => {
                    const roles: string[] = currentUser
                      ? (Array.isArray((currentUser as any).roles) && (currentUser as any).roles.length > 0
                          ? (currentUser as any).roles
                          : [(currentUser as any).role])
                      : [];
                    const isAdmin = roles.some(r => r === 'ADMIN' || r === 'DIRECTEUR' || r === 'SUPER_ADMIN');
                    const estInscrit = statut === 'INSCRIT' || statut === 'ACTIF';
                    const parentEmail = selected.email && !selected.email.includes('@letoidesanges.sn') ? selected.email : (selected.parent1Email || '');
                    if (!isAdmin || !estInscrit) return null;
                    return (
                      <button
                        onClick={() => {
                          setParentAccountForm({
                            email: parentEmail,
                            nom: selected.parent1Nom || '',
                            prenom: selected.parent1Prenom || '',
                            motDePasseTemporaire: Math.random().toString(36).slice(2, 10).toUpperCase(),
                          });
                          setParentAccountResult(null);
                          setShowParentAccountModal(true);
                        }}
                        className="px-4 py-2 bg-amber-400/80 hover:bg-amber-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        <UserPlus size={14}/> Compte parent
                      </button>
                    );
                  })()}
                  {canModify && (statut === 'EN_ATTENTE' || statut === 'ADMIS') && isFromParent(selected) && (
                    <button onClick={() => setShowRejetModal({ dossier: selected, motif: '' })}
                      className="px-4 py-2 bg-rose-500/80 hover:bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
                      <Ban size={14}/> Rejeter
                    </button>
                  )}
                  {peutAnnuler && (
                    <button onClick={() => setShowAnnulInscription({ dossier: selected, motif: '' })}
                      className="px-4 py-2 bg-rose-500/80 hover:bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
                      <Ban size={14}/> Annuler l'inscription
                    </button>
                  )}
                  <button onClick={() => setModalMode(null)}
                    className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all"><X size={22} /></button>
                </div>
              </div>

              {/* Corps du dossier */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">

                {/* ── Identité de l'enfant ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Baby size={12} className="text-indigo-500"/> Identité de l'enfant
                  </h4>
                  {selected.photoUrl && (
                    <div className="mb-3 flex justify-center">
                      <img src={selected.photoUrl} alt={nomEnfant}
                        className="w-24 h-24 rounded-3xl object-cover border-2 border-indigo-100 shadow-md" />
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Nom & Prénom" value={nomEnfant} />
                    <DetailRow label="Sexe" value={selected.sexe === 'M' ? 'Garçon' : selected.sexe === 'F' ? 'Fille' : null} />
                    <DetailRow
                      label="Date de naissance"
                      value={selected.dateNaissance ? new Date(selected.dateNaissance).toLocaleDateString('fr-FR') : null}
                    />
                    <DetailRow label="Lieu de naissance" value={selected.billingAddress || selected.lieuNaissance} />
                    <DetailRow label="Date de dépôt"
                      value={selected.dateDepot ? new Date(selected.dateDepot).toLocaleDateString('fr-FR')
                        : selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('fr-FR') : null} />
                    <DetailRow label="Année scolaire" value={selected.anneeScolaire || ANNEE_COURANTE} />
                  </div>
                </section>

                {/* ── Informations scolaires ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <GraduationCap size={12} className="text-indigo-500"/> Scolarité & options
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Niveau demandé" value={niveau ? niveauLabel(niveau) : null} />
                    <DetailRow label="Régime financier" value={selected.regimeFinancier ? regimeLabel(selected.regimeFinancier as RegimeFinancier) : null} />
                    {selected.remisePct > 0 && <DetailRow label="Remise cas social" value={`${selected.remisePct}%`} />}
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Options</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.cantine && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black border border-emerald-200">Cantine</span>
                        )}
                        {(selected.transportBus || selected.transport_bus) && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-black border border-amber-200">Bus scolaire</span>
                        )}
                        {selected.garderie && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black border border-indigo-200">Garderie</span>
                        )}
                        {!selected.cantine && !selected.transportBus && !selected.transport_bus && !selected.garderie && (
                          <span className="text-slate-400 text-[9px] font-bold">Aucune option</span>
                        )}
                      </div>
                    </div>
                    {selected.besoinSpecifique && (
                      <div className="col-span-2 space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Besoins spécifiques</p>
                        <p className="font-bold text-blue-700 text-sm">{selected.besoinSpecifique}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Fiche Sanitaire ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Stethoscope size={12} className="text-rose-500"/> Fiche sanitaire
                  </h4>
                  <div className="space-y-3">
                    {/* Vaccinations */}
                    <div className="bg-slate-50 rounded-2xl p-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Vaccinations</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'vaccDiphterie', dateKey: 'vaccDiphterieDate', label: 'Diphtérie/Tétanos/Polio' },
                          { key: 'vaccPolio',      dateKey: 'vaccPolioDate',     label: 'Poliomyélite' },
                          { key: 'vaccCoqueluche', dateKey: 'vaccCoquelucheDate',label: 'Coqueluche' },
                          { key: 'vaccBCG',        dateKey: 'vaccBCGDate',       label: 'BCG' },
                          { key: 'vaccHepB',       dateKey: 'vaccHepBDate',      label: 'Hépatite B' },
                          { key: 'vaccROR',        dateKey: 'vaccRORDate',       label: 'ROR' },
                        ].map(v => (
                          <div key={v.key} className="space-y-0.5">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{v.label}</p>
                            {(selected as any)[v.key]
                              ? <p className="text-[11px] font-bold text-emerald-700">✓ {(selected as any)[v.dateKey] ? new Date((selected as any)[v.dateKey]).toLocaleDateString('fr-FR') : 'Vacciné'}</p>
                              : <p className="text-[11px] font-bold text-slate-400">Non renseigné</p>
                            }
                          </div>
                        ))}
                      </div>
                      {selected.certifContrIndication && (
                        <p className="mt-2 text-[10px] font-black text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl">Certificat médical de contre-indication joint</p>
                      )}
                    </div>

                    {/* Traitement médical */}
                    {selected.traitementMedical && (
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                        <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-1">Traitement médical en cours</p>
                        <p className="text-sm font-bold text-slate-800">{selected.traitementDetail || 'Oui (détails non précisés)'}</p>
                      </div>
                    )}

                    {/* Maladies antérieures */}
                    {['maladieRubeole','maladieVaricelle','maladieAngine','maladieRhumatisme','maladieScarlatine','maladieCoqueluche','maladieOtite','maladieRougeole','maladieOreillons'].some(k => (selected as any)[k]) && (
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Maladies antérieures</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { key: 'maladieRubeole', label: 'Rubéole' }, { key: 'maladieVaricelle', label: 'Varicelle' },
                            { key: 'maladieAngine', label: 'Angine' }, { key: 'maladieRhumatisme', label: 'Rhumatisme articulaire aigu' },
                            { key: 'maladieScarlatine', label: 'Scarlatine' }, { key: 'maladieCoqueluche', label: 'Coqueluche' },
                            { key: 'maladieOtite', label: 'Otite' }, { key: 'maladieRougeole', label: 'Rougeole' },
                            { key: 'maladieOreillons', label: 'Oreillons' },
                          ].filter(m => (selected as any)[m.key]).map(m => (
                            <span key={m.key} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black border border-indigo-200">{m.label}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allergies */}
                    {(selected.allergieAsthme || selected.allergieMedicament || selected.allergieAlimentaire || selected.allergieAutres) && (
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 space-y-2">
                        <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Allergies</p>
                        <div className="flex flex-wrap gap-1">
                          {selected.allergieAsthme && <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black">Asthme</span>}
                          {selected.allergieMedicament && <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black">Médicamenteuses</span>}
                          {selected.allergieAlimentaire && <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black">Alimentaires</span>}
                        </div>
                        {selected.allergieAutres && <DetailRow label="Autres allergies" value={selected.allergieAutres} />}
                        {selected.allergieConduite && <DetailRow label="Conduite à tenir" value={selected.allergieConduite} />}
                      </div>
                    )}

                    {/* Difficultés de santé */}
                    {selected.difficulteSante && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Difficultés de santé</p>
                        <p className="text-sm font-bold text-slate-800">{selected.difficulteSante}</p>
                      </div>
                    )}

                    {/* Équipements + Énurésie */}
                    <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 gap-3">
                      {(selected.equipeLunettes || selected.equipeLentilles || selected.equipeProtheseAuditive || selected.equipeProtheseDentaire) && (
                        <div className="col-span-2 space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Équipements portés</p>
                          <div className="flex flex-wrap gap-1">
                            {selected.equipeLunettes && <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">Lunettes</span>}
                            {selected.equipeLentilles && <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">Lentilles</span>}
                            {selected.equipeProtheseAuditive && <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">Prothèse auditive</span>}
                            {selected.equipeProtheseDentaire && <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">Prothèse dentaire</span>}
                          </div>
                          {selected.equipePrecisions && <p className="text-xs text-slate-600 font-bold">{selected.equipePrecisions}</p>}
                        </div>
                      )}
                      {selected.mouillerLit && <DetailRow label="Énurésie nocturne" value={selected.mouillerLit === 'OCCASIONNELLEMENT' ? 'Occasionnellement' : selected.mouillerLit === 'OUI' ? 'Oui' : 'Non'} />}
                      <DetailRow label="Médecin traitant" value={selected.medecinNom || null} />
                      {selected.medecinTel && <DetailRow label="Tél. médecin" value={selected.medecinTel} />}
                    </div>

                    {/* Autorisations */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1">
                      <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"><Camera size={11}/> Autorisations</p>
                      <p className={`text-[11px] font-black ${selected.autorisationSoins !== false ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {selected.autorisationSoins !== false ? '✓' : '✗'} Soins / hospitalisation d'urgence
                      </p>
                      <p className={`text-[11px] font-black ${selected.autorisationPhoto !== false ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {selected.autorisationPhoto !== false ? '✓' : '✗'} Photographies / vidéos
                      </p>
                    </div>
                  </div>
                </section>

                {/* ── Parent / Tuteur ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Phone size={12} className="text-indigo-500"/> Parent / Tuteur légal
                    {parentsByEleveId[selected.id]?.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[8px] font-black flex items-center gap-1">
                        <UserPlus size={8}/> Compte portail : {parentsByEleveId[selected.id].map((p: any) => p.email).join(', ')}
                      </span>
                    )}
                    {parentsByEleveId[selected.id]?.length > 0 && (
                      <button
                        disabled={!!resetPwLoading}
                        onClick={async () => {
                          const parentAccount = parentsByEleveId[selected.id][0];
                          setResetPwLoading(parentAccount.id);
                          try {
                            const res = await apiClient.post(`/admin/parent-accounts/${parentAccount.id}/reset-password`);
                            showToast(`Mot de passe réinitialisé pour ${parentAccount.email}. Nouveau : ${res.newPassword}. Email envoyé.`, 'success');
                          } catch (err: any) {
                            showToast(err?.message || 'Erreur lors du reset.', 'error');
                          } finally {
                            setResetPwLoading(null);
                          }
                        }}
                        className="ml-1 px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[8px] font-black flex items-center gap-1 hover:bg-rose-100 transition disabled:opacity-50"
                        title="Réinitialiser le mot de passe du parent et l'informer par email"
                      >
                        {resetPwLoading === parentsByEleveId[selected.id][0]?.id
                          ? <><Loader2 size={8} className="animate-spin"/> Reset…</>
                          : <><Lock size={8}/> Reset mot de passe</>}
                      </button>
                    )}
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Nom & Prénom" value={parentFull || null} />
                    <DetailRow label="Lien"
                      value={selected.parent1Lien === 'MERE' ? 'Mère' : selected.parent1Lien === 'PERE' ? 'Père' : selected.parent1Lien === 'TUTEUR' ? 'Tuteur légal' : null} />
                    <DetailRow label="Tél. portable" value={selected.phone} />
                    <DetailRow label="Tél. domicile" value={selected.parent1TelDomicile} />
                    <DetailRow label="Tél. travail" value={selected.parent1TelTravail} />
                    <DetailRow label="WhatsApp" value={selected.parent1Whatsapp || selected.phone} />
                    <DetailRow label="Email"
                      value={selected.email && !selected.email.includes('@letoidesanges.sn') ? selected.email : null} />
                    <DetailRow label="Adresse" value={selected.parent1Adresse} />
                    <DetailRow label="Profession" value={selected.parent1Profession} />
                    <DetailRow label="Entreprise" value={selected.parent1Entreprise} />
                    <DetailRow label="Pays de résidence" value={selected.parent1PaysResidence} />
                  </div>
                  {(selected.parent2Nom || selected.parent2Prenom) && (
                    <div className="mt-3 bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <DetailRow label="Nom & Prénom (parent 2)" value={`${selected.parent2Prenom || ''} ${selected.parent2Nom || ''}`.trim() || null} />
                      <DetailRow label="Lien"
                        value={selected.parent2Lien === 'MERE' ? 'Mère' : selected.parent2Lien === 'PERE' ? 'Père' : selected.parent2Lien === 'TUTEUR' ? 'Tuteur légal' : null} />
                      <DetailRow label="Tél. portable" value={selected.parent2Tel} />
                      <DetailRow label="Tél. domicile" value={selected.parent2TelDomicile} />
                      <DetailRow label="Tél. travail" value={selected.parent2TelTravail} />
                      <DetailRow label="Profession" value={selected.parent2Profession} />
                      <DetailRow label="Entreprise" value={selected.parent2Entreprise} />
                      <DetailRow label="Pays de résidence" value={selected.parent2PaysResidence} />
                    </div>
                  )}
                </section>

                {/* ── Personne autorisée à venir chercher l'enfant ── */}
                {(selected.recupNom || selected.recupTel) && (
                  <section>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <UserCheck size={12} className="text-emerald-600"/> Personne autorisée à venir chercher l'enfant
                    </h4>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <DetailRow label="Nom complet" value={selected.recupNom} />
                      <DetailRow label="Téléphone" value={selected.recupTel} />
                      <DetailRow label="Lien" value={selected.recupLien} />
                    </div>
                  </section>
                )}

                {/* ── Contact urgence ── */}
                {(selected.urgenceNom || selected.urgenceTel) && (
                  <section>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Shield size={12} className="text-rose-500"/> Contact d'urgence
                    </h4>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <DetailRow label="Nom complet" value={selected.urgenceNom} />
                      <DetailRow label="Téléphone" value={selected.urgenceTel} />
                      <DetailRow label="Lien" value={selected.urgenceLien} />
                    </div>
                  </section>
                )}

                {/* ── Motif de rejet (visible si REJETE) ── */}
                {statut === 'REJETE' && (() => {
                  const rejetMatch = (selected.notes || '').match(/\[REJET ([^\]]+)\] ([\s\S]+?)(?=\n\[|$)/);
                  if (!rejetMatch) return null;
                  return (
                    <section>
                      <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl">
                        <h4 className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Ban size={13}/> Motif de refus — {rejetMatch[1]}
                        </h4>
                        <p className="text-sm text-rose-800 font-medium leading-relaxed">{rejetMatch[2].trim()}</p>
                      </div>
                    </section>
                  );
                })()}

                {/* ── Notes internes ── */}
                {selected.notes && (() => {
                  const cleanNotes = (selected.notes as string).replace(/\s*\[parent_user:[^\]]*\]/g, '').trim();
                  if (!cleanNotes) return null;
                  return (
                    <section>
                      <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl">
                        <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Info size={13}/> Notes internes
                        </h4>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">{cleanNotes}</p>
                      </div>
                    </section>
                  );
                })()}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL CRÉER COMPTE PARENT ═════════════════════════════════════════ */}
      {showParentAccountModal && selected && (
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
                  Un compte sera créé pour ce parent avec le rôle <strong>PARENT</strong>.
                  L'enfant <strong>{selected.companyName || selected.name}</strong> sera automatiquement lié.
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
                          eleveIds: [selected.id],
                        });
                        setParentAccountResult({ created: true, tempPassword: parentAccountForm.motDePasseTemporaire });
                        showToast('Compte parent créé avec succès.', 'success');
                        // Rafraîchir l'index des comptes parents dans la liste
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
                <p className="text-xs text-slate-500 mb-5">Un email avec les identifiants a été envoyé au parent.</p>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">URL de connexion</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 font-mono">/parents</p>
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
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL ANNULATION INSCRIPTION ══════════════════════════════════════ */}
      {showAnnulInscription && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <Ban size={40}/>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1 text-center">Annuler l'inscription</h3>
            <p className="text-xs text-slate-400 font-medium text-center mb-6">
              <span className="font-black text-slate-700">{showAnnulInscription.dossier.companyName || showAnnulInscription.dossier.name}</span> sera passé au statut <span className="font-black text-rose-600">Radié</span>. Cette action est irréversible.
            </p>
            <div className="mb-6">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">
                Motif de l'annulation <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={showAnnulInscription.motif}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setShowAnnulInscription((s: typeof showAnnulInscription) => s ? { ...s, motif: e.target.value } : s)}
                rows={3}
                placeholder="Ex : Départ de la famille, non-paiement, autre établissement…"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 resize-none"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAnnulInscription}
                disabled={actionLoading || !showAnnulInscription.motif.trim()}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <Ban size={16}/>} Confirmer l'annulation
              </button>
              <button onClick={() => setShowAnnulInscription(null)}
                className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors text-center">
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL REJET CANDIDATURE ════════════════════════════════════════════ */}
      {showRejetModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <Ban size={32}/>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1 text-center">Refuser la candidature</h3>
            <p className="text-xs text-slate-400 font-medium text-center mb-6">
              Dossier de{' '}
              <span className="font-black text-slate-700">{showRejetModal.dossier.companyName || showRejetModal.dossier.name}</span>
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                Motif de refus <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={showRejetModal.motif}
                onChange={e => setShowRejetModal(s => s ? { ...s, motif: e.target.value } : s)}
                rows={4}
                placeholder="Expliquez clairement le motif du refus. Le parent verra ce message et pourra corriger son dossier..."
                className="w-full bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 resize-none leading-relaxed"
                autoFocus
              />
              <p className="text-[9px] text-slate-400 font-medium">
                Ce motif sera visible par le parent dans son espace. Il pourra corriger et resoumettre son dossier.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRejet}
                disabled={actionLoading || !showRejetModal.motif.trim()}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-40">
                {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <Ban size={16}/>}
                Confirmer le refus
              </button>
              <button onClick={() => setShowRejetModal(null)}
                className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM CHANGEMENT STATUT ══════════════════════════════════════════ */}
      {showConfirmStatut && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40}/>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer le changement</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed mb-3">
              Passer le dossier de{' '}
              <span className="font-black text-slate-700">{showConfirmStatut.dossier.companyName || showConfirmStatut.dossier.name}</span>{' '}
              au statut <span className="font-black text-indigo-600">{STATUTS_ADMISSION.find(s => s.value === showConfirmStatut.newStatut)?.label}</span> ?
            </p>
            {showConfirmStatut.newStatut === 'ADMIS' && (
              <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 text-[10px] font-black uppercase">
                L'école notifie l'acceptation de la candidature.
              </div>
            )}
            {showConfirmStatut.newStatut === 'INSCRIT' && (
              <div className="mb-5 p-3 bg-violet-50 border border-violet-100 rounded-2xl text-violet-700 text-[10px] font-black uppercase">
                La famille a fourni les documents et réglé les frais de scolarité. Le dossier ne sera plus modifiable.
              </div>
            )}
            {showConfirmStatut.newStatut === 'ACTIF' && (
              <div className="mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-[10px] font-black uppercase">
                L'élève est actif et en cours de scolarité.
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button onClick={handleUpdateStatut} disabled={actionLoading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl">
                {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} CONFIRMER
              </button>
              <button onClick={() => setShowConfirmStatut(null)}
                className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admission;
