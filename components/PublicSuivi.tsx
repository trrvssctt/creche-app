import React, { useEffect, useState } from 'react';
import {
  Search, CheckCircle2, Clock, Star, UserCheck, XCircle,
  AlertTriangle, School, ArrowLeft, Baby, RefreshCw,
  Edit3, Save, Loader2, ArrowRight, ChevronLeft,
  GraduationCap, Stethoscope, Phone, Shield, Camera, X, Users,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { compressImageToDataUrl } from '../services/photoUtils';
import { piecesForNiveau, missingRequiredPieces, PieceJointe } from '../services/piecesJustificatives';
import PiecesJointes from './PiecesJointes';

// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'EN_ATTENTE' | 'ADMIS' | 'INSCRIT' | 'ACTIF' | 'REJETE' | 'RADIE';

interface DossierResult {
  reference: string;
  prenom: string;
  nomInitiale: string;
  niveau: string;
  statut: Statut;
  photoUrl?: string | null;
  dateDepot: string;
  motifRejet?: string | null;
  codeActif?: boolean;
  dossierComplet?: any;
}

interface Ecole { name?: string; logoUrl?: string }

// ─── Config statuts ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<Statut, {
  label: string; desc: string; next: string | null;
  bg: string; text: string; border: string; icon: React.FC<any>;
}> = {
  EN_ATTENTE: {
    label: 'Dossier reçu — en attente d\'examen',
    desc:  "Votre dossier a bien été reçu par l'école. L'équipe pédagogique l'examinera prochainement et vous contactera.",
    next:  "Prochaine étape : l'école vous contacte pour un entretien ou communique sa décision.",
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock,
  },
  ADMIS: {
    label: 'Candidature admise !',
    desc:  "Félicitations ! Votre enfant a été admis(e). L'école va vous contacter pour finaliser l'inscription.",
    next:  "Prochaine étape : rendez-vous à l'école pour signer le contrat d'inscription et régler les frais.",
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Star,
  },
  INSCRIT: {
    label: 'Inscription confirmée',
    desc:  "L'inscription de votre enfant est officiellement enregistrée. Tout est en ordre pour la rentrée.",
    next:  "Votre code de suivi a été désactivé. Connectez-vous à l'espace parent pour suivre la scolarité.",
    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: UserCheck,
  },
  ACTIF: {
    label: 'Élève actif(ve)',
    desc:  "Votre enfant est actuellement scolarisé(e) dans l'établissement.",
    next:  "Votre code de suivi a été désactivé. Connectez-vous à l'espace parent pour suivre la scolarité.",
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2,
  },
  REJETE: {
    label: 'Candidature non retenue',
    desc:  "Votre candidature n'a pas pu être retenue. Vous pouvez corriger votre dossier et le resoumettre ci-dessous.",
    next:  null,
    bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: XCircle,
  },
  RADIE: {
    label: 'Dossier radié',
    desc:  "Le dossier de votre enfant a été clôturé. Contactez l'école pour plus d'informations.",
    next:  null,
    bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: AlertTriangle,
  },
};

const TIMELINE: Statut[] = ['EN_ATTENTE', 'ADMIS', 'INSCRIT', 'ACTIF'];

// ─── Constantes (identiques à PublicAdmission) ──────────────────────────────

const NIVEAUX_MATERNELLE = ['CRECHE', 'PS', 'MS', 'GS'];

const NIVEAUX = [
  { value: 'CRECHE', label: 'Crèche (3–12 mois)',  cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',       cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section',      cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',       cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',                   cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',                  cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',                  cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',                  cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',                  cycle: 'Élémentaire' },
];

const EDIT_STEPS = [
  { n: 1, label: "Identité de l'enfant",      sub: 'État civil et informations de base',       icon: Baby },
  { n: 2, label: 'Scolarité & options',        sub: 'Niveau souhaité, cantine, transport',      icon: GraduationCap },
  { n: 3, label: 'Fiche sanitaire',            sub: 'Vaccins, allergies, autorisations',         icon: Stethoscope },
  { n: 4, label: 'Coordonnées parents',        sub: 'Parent principal, second parent, urgence', icon: Phone },
  { n: 5, label: 'Récapitulatif',              sub: 'Relisez et resoumettez votre dossier',     icon: CheckCircle2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRef(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function niveauLabel(n: string) {
  return NIVEAUX.find(x => x.value === n)?.label ?? n;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const PublicSuivi: React.FC = () => {
  const [ref, setRef]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<DossierResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editStep, setEditStep] = useState(1);
  const [pieces, setPieces]     = useState<Record<string, PieceJointe>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(false);

  const [ecole, setEcole] = useState<Ecole>(() => {
    try { const r = localStorage.getItem('ecole_branding'); return r ? JSON.parse(r) : {}; }
    catch { return {}; }
  });

  useEffect(() => {
    apiClient.get('/public/ecole').then((d: any) => {
      if (!d) return;
      setEcole(d);
      localStorage.setItem('ecole_branding', JSON.stringify(d));
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) setRef(formatRef(refParam));
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = ref.trim();
    if (!cleaned) return;
    setLoading(true); setError(null); setResult(null); setEditMode(false); setResubmitSuccess(false);
    try {
      const data: any = await apiClient.get(`/public/admission/${encodeURIComponent(cleaned)}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Dossier introuvable. Vérifiez votre numéro de référence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      const cleaned = formatRef(refParam);
      setRef(cleaned);
      setTimeout(() => {
        apiClient.get(`/public/admission/${encodeURIComponent(cleaned)}`).then((data: any) => {
          setResult(data);
        }).catch((err: any) => {
          setError(err?.message || 'Dossier introuvable.');
        });
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initialiser le formulaire d'édition à partir du dossierComplet ────────

  const startEdit = () => {
    if (!result?.dossierComplet) return;
    const d = result.dossierComplet;
    const fs = d.ficheSanitaire || {};
    const p1 = d.parent1 || {};
    const p2 = d.parent2 || {};
    const cu = d.contactUrgence || {};
    const pa = d.personneAutorisee || {};

    setEditForm({
      // Identité
      prenomEnfant: d.prenom || '', nomEnfant: d.nom || '',
      dateNaissance: d.dateNaissance ? d.dateNaissance.split('T')[0] : '',
      lieuNaissance: d.lieuNaissance || '',
      sexe: d.sexe || '',
      photoUrl: d.photoUrl || '',
      // Scolarité
      niveau: d.niveau || 'PS',
      cantine: d.cantine || false, transportBus: d.transportBus || false,
      garderie: d.garderie || false, besoinSpecifique: d.besoinSpecifique || '',
      // Fiche sanitaire — vaccins
      vaccDiphterie: fs.vaccDiphterie || false, vaccDiphterieDate: fs.vaccDiphterieDate || '',
      vaccPolio: fs.vaccPolio || false, vaccPolioDate: fs.vaccPolioDate || '',
      vaccCoqueluche: fs.vaccCoqueluche || false, vaccCoquelucheDate: fs.vaccCoquelucheDate || '',
      vaccBCG: fs.vaccBCG || false, vaccBCGDate: fs.vaccBCGDate || '',
      vaccHepB: fs.vaccHepB || false, vaccHepBDate: fs.vaccHepBDate || '',
      vaccROR: fs.vaccROR || false, vaccRORDate: fs.vaccRORDate || '',
      certifContrIndication: fs.certifContrIndication || false,
      // Traitement
      traitementMedical: fs.traitementMedical || false, traitementDetail: fs.traitementDetail || '',
      // Maladies
      maladieRubeole: fs.maladieRubeole || false, maladieVaricelle: fs.maladieVaricelle || false,
      maladieAngine: fs.maladieAngine || false, maladieRhumatisme: fs.maladieRhumatisme || false,
      maladieScarlatine: fs.maladieScarlatine || false, maladieCoqueluche: fs.maladieCoqueluche || false,
      maladieOtite: fs.maladieOtite || false, maladieRougeole: fs.maladieRougeole || false,
      maladieOreillons: fs.maladieOreillons || false,
      // Allergies
      allergieAsthme: fs.allergieAsthme || false, allergieMedicament: fs.allergieMedicament || false,
      allergieAlimentaire: fs.allergieAlimentaire || false,
      allergieAutres: fs.allergieAutres || '', allergieConduite: fs.allergieConduite || '',
      difficulteSante: fs.difficulteSante || '',
      // Équipements
      equipeLunettes: fs.equipeLunettes || false, equipeLentilles: fs.equipeLentilles || false,
      equipeProtheseAuditive: fs.equipeProtheseAuditive || false,
      equipeProtheseDentaire: fs.equipeProtheseDentaire || false,
      equipePrecisions: fs.equipePrecisions || '',
      // Divers santé
      mouillerLit: fs.mouillerLit || '',
      medecinNom: fs.medecinNom || '', medecinTel: fs.medecinTel || '',
      autorisationSoins: fs.autorisationSoins || false, autorisationPhoto: fs.autorisationPhoto || false,
      // Parent 1
      parent1Nom: p1.nom || '', parent1Prenom: p1.prenom || '',
      parent1Tel: p1.telephone || '', parent1Whatsapp: p1.whatsapp || p1.telephone || '',
      parent1Email: p1.email || '', parent1Lien: p1.lien || 'MERE',
      parent1TelDomicile: p1.telDomicile || '', parent1TelTravail: p1.telTravail || '',
      parent1Adresse: p1.adresse || '',
      parent1Profession: p1.profession || '', parent1Entreprise: p1.entreprise || '',
      parent1PaysResidence: p1.paysResidence || '',
      // Parent 2
      parent2Nom: p2.nom || '', parent2Prenom: p2.prenom || '',
      parent2Lien: p2.lien || 'PERE', parent2Tel: p2.telephone || '',
      parent2Profession: p2.profession || '', parent2Entreprise: p2.entreprise || '',
      parent2PaysResidence: p2.paysResidence || '',
      // Situation familiale
      situationMatrimoniale: d.situationMatrimoniale || '',
      parentsMemeResidence: d.parentsMemeResidence ?? null,
      // Contact urgence
      urgenceNom: cu.nom || '', urgenceTel: cu.telephone || '', urgenceLien: cu.lien || '',
      // Personne autorisée
      recupNom: pa.nom || '', recupTel: pa.telephone || '', recupLien: pa.lien || '',
      // Notes
      notes: '',
    });
    setPieces({});
    setEditStep(1);
    setEditMode(true);
  };

  const set = (patch: Record<string, any>) => setEditForm((f: any) => ({ ...f, ...patch }));
  const isMaternelle = editForm ? NIVEAUX_MATERNELLE.includes(editForm.niveau) : false;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      set({ photoUrl: dataUrl });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Impossible de lire cette image.');
    }
  };

  const handleEditNext = () => {
    setError(null);
    if (editStep === 1 && (!editForm.prenomEnfant?.trim() || !editForm.nomEnfant?.trim())) {
      setError("Prénom et nom de l'enfant sont obligatoires."); return;
    }
    if (editStep === 4 && !editForm.parent1Tel?.trim()) {
      setError('Le téléphone du parent est obligatoire.'); return;
    }
    setEditStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResubmit = async () => {
    if (!editForm || !result) return;
    const manquantes = missingRequiredPieces(editForm.niveau, pieces);
    // Don't block on missing pieces for resubmission — they may already be on file
    setSubmitting(true); setError(null);
    try {
      const payload = {
        nom: editForm.nomEnfant.trim(), prenom: editForm.prenomEnfant.trim(),
        dateNaissance: editForm.dateNaissance || null,
        lieuNaissance: editForm.lieuNaissance || null,
        sexe: editForm.sexe || null,
        niveau: editForm.niveau,
        photoUrl: editForm.photoUrl || null,
        cantine: editForm.cantine, transportBus: editForm.transportBus,
        garderie: isMaternelle && editForm.garderie,
        besoinSpecifique: editForm.besoinSpecifique || null,
        situationMatrimoniale: editForm.situationMatrimoniale || null,
        parentsMemeResidence: editForm.parentsMemeResidence,
        ficheSanitaire: {
          vaccDiphterie: editForm.vaccDiphterie, vaccDiphterieDate: editForm.vaccDiphterieDate,
          vaccPolio: editForm.vaccPolio, vaccPolioDate: editForm.vaccPolioDate,
          vaccCoqueluche: editForm.vaccCoqueluche, vaccCoquelucheDate: editForm.vaccCoquelucheDate,
          vaccBCG: editForm.vaccBCG, vaccBCGDate: editForm.vaccBCGDate,
          vaccHepB: editForm.vaccHepB, vaccHepBDate: editForm.vaccHepBDate,
          vaccROR: editForm.vaccROR, vaccRORDate: editForm.vaccRORDate,
          certifContrIndication: editForm.certifContrIndication,
          traitementMedical: editForm.traitementMedical, traitementDetail: editForm.traitementDetail,
          maladieRubeole: editForm.maladieRubeole, maladieVaricelle: editForm.maladieVaricelle,
          maladieAngine: editForm.maladieAngine, maladieRhumatisme: editForm.maladieRhumatisme,
          maladieScarlatine: editForm.maladieScarlatine, maladieCoqueluche: editForm.maladieCoqueluche,
          maladieOtite: editForm.maladieOtite, maladieRougeole: editForm.maladieRougeole,
          maladieOreillons: editForm.maladieOreillons,
          allergieAsthme: editForm.allergieAsthme, allergieMedicament: editForm.allergieMedicament,
          allergieAlimentaire: editForm.allergieAlimentaire,
          allergieAutres: editForm.allergieAutres, allergieConduite: editForm.allergieConduite,
          difficulteSante: editForm.difficulteSante,
          equipeLunettes: editForm.equipeLunettes, equipeLentilles: editForm.equipeLentilles,
          equipeProtheseAuditive: editForm.equipeProtheseAuditive,
          equipeProtheseDentaire: editForm.equipeProtheseDentaire,
          equipePrecisions: editForm.equipePrecisions,
          mouillerLit: editForm.mouillerLit || null,
          medecinNom: editForm.medecinNom, medecinTel: editForm.medecinTel,
          autorisationSoins: editForm.autorisationSoins, autorisationPhoto: editForm.autorisationPhoto,
        },
        parent1: {
          nom: editForm.parent1Nom, prenom: editForm.parent1Prenom,
          telephone: editForm.parent1Tel, whatsapp: editForm.parent1Whatsapp,
          email: editForm.parent1Email, lien: editForm.parent1Lien,
          telDomicile: editForm.parent1TelDomicile, telTravail: editForm.parent1TelTravail,
          adresse: editForm.parent1Adresse,
          profession: editForm.parent1Profession, entreprise: editForm.parent1Entreprise,
          paysResidence: editForm.parent1PaysResidence,
        },
        parent2: (editForm.parent2Nom || editForm.parent2Tel) ? {
          nom: editForm.parent2Nom, prenom: editForm.parent2Prenom,
          telephone: editForm.parent2Tel, lien: editForm.parent2Lien,
          profession: editForm.parent2Profession, entreprise: editForm.parent2Entreprise,
          paysResidence: editForm.parent2PaysResidence,
        } : null,
        contactUrgence: editForm.urgenceNom ? {
          nom: editForm.urgenceNom, telephone: editForm.urgenceTel, lien: editForm.urgenceLien,
        } : null,
        personneAutorisee: editForm.recupNom ? {
          nom: editForm.recupNom, telephone: editForm.recupTel, lien: editForm.recupLien,
        } : null,
        piecesJointes: Object.values(pieces),
        notes: editForm.notes || null,
      };
      await apiClient.request(`/public/admission/${encodeURIComponent(result.reference)}`, {
        method: 'PUT', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      setResubmitSuccess(true);
      setEditMode(false);
      const updated: any = await apiClient.get(`/public/admission/${encodeURIComponent(result.reference)}`);
      setResult(updated);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la resoumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const cfg = result ? STATUT_CONFIG[result.statut] ?? STATUT_CONFIG.EN_ATTENTE : null;
  const isNegative = result && (result.statut === 'REJETE' || result.statut === 'RADIE');
  const canResubmit = result?.statut === 'REJETE' && result?.dossierComplet;

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.location.reload();
  };

  const inp = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition';
  const lbl = 'text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block';

  // ── Mode édition : wizard 5 étapes ────────────────────────────────────────

  if (editMode && editForm && result) {
    const currentEditStep = EDIT_STEPS[editStep - 1];
    const pct = Math.round(((editStep - 1) / (EDIT_STEPS.length - 1)) * 100);

    return (
      <div className="flex flex-col bg-slate-100" style={{ height: '100dvh' }}>

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 to-indigo-900">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            {ecole.logoUrl ? (
              <img src={ecole.logoUrl} alt="Logo"
                className="h-11 w-11 rounded-2xl object-contain bg-white p-0.5 flex-shrink-0 shadow-md" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <School className="w-5 h-5 text-white/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-black text-base leading-tight truncate">Correction du dossier</p>
              <p className="text-indigo-300 text-xs font-bold mt-0.5">{currentEditStep.label}</p>
            </div>
            <button onClick={() => setEditMode(false)}
              className="text-slate-400 text-xs font-bold hover:text-white transition px-2 flex-shrink-0">
              Annuler
            </button>
          </div>

          {/* Progress dots + motif */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              {EDIT_STEPS.map((s) => (
                <div key={s.n} className={`transition-all rounded-full ${
                  editStep === s.n ? 'flex-1 h-2 bg-indigo-400' :
                  editStep > s.n  ? 'flex-1 h-2 bg-emerald-400' :
                                    'flex-1 h-1.5 bg-white/15'
                }`} />
              ))}
            </div>
            <p className="text-slate-400 text-[10px] font-bold">
              Étape {editStep} sur {EDIT_STEPS.length} — {currentEditStep.sub}
            </p>
          </div>
        </div>

        {/* Motif du rejet (sticky reminder) */}
        {result.motifRejet && (
          <div className="flex-shrink-0 mx-4 mt-3 bg-rose-50 border border-rose-200 rounded-2xl p-3">
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-0.5">Motif du rejet</p>
            <p className="text-rose-800 text-xs font-bold leading-relaxed">{result.motifRejet}</p>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold flex items-center gap-3">
                <AlertTriangle size={18} className="flex-shrink-0" /> {error}
              </div>
            )}

            {/* ══ ÉTAPE 1 — Identité ══ */}
            {editStep === 1 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  {/* Photo */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {editForm.photoUrl ? (
                        <>
                          <img src={editForm.photoUrl} alt="Photo"
                            className="w-24 h-24 rounded-3xl object-cover border-2 border-indigo-200 shadow-md" />
                          <button type="button" onClick={() => set({ photoUrl: '' })}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <label className="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer active:bg-slate-100 transition">
                          <Camera className="w-7 h-7 text-slate-400 mb-1" />
                          <span className="text-[9px] font-black text-slate-400 uppercase">Photo</span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => handlePhoto(e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-700 text-sm">Photo de l'enfant</p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-1">
                        Une photo d'identité récente.
                      </p>
                      {editForm.photoUrl && (
                        <label className="inline-block mt-2 text-xs font-bold text-indigo-600 cursor-pointer">
                          Changer la photo
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => handlePhoto(e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Prénom <span className="text-rose-500">*</span></label>
                      <input type="text" value={editForm.prenomEnfant}
                        onChange={e => set({ prenomEnfant: e.target.value })} className={inp} placeholder="Prénom" />
                    </div>
                    <div>
                      <label className={lbl}>Nom <span className="text-rose-500">*</span></label>
                      <input type="text" value={editForm.nomEnfant}
                        onChange={e => set({ nomEnfant: e.target.value })} className={inp} placeholder="Nom" />
                    </div>
                    <div>
                      <label className={lbl}>Date de naissance</label>
                      <input type="date" value={editForm.dateNaissance}
                        onChange={e => set({ dateNaissance: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Lieu de naissance</label>
                      <input type="text" value={editForm.lieuNaissance}
                        onChange={e => set({ lieuNaissance: e.target.value })} className={inp} placeholder="Dakar" />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Sexe</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ v: 'M', l: '👦  Garçon' }, { v: 'F', l: '👧  Fille' }].map(s => (
                        <button key={s.v} type="button" onClick={() => set({ sexe: s.v })}
                          className={`py-4 rounded-2xl text-base font-black border-2 transition-all active:scale-95 ${editForm.sexe === s.v ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ÉTAPE 2 — Scolarité ══ */}
            {editStep === 2 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <div>
                    <label className={lbl}>Niveau demandé <span className="text-rose-500">*</span></label>
                    <select value={editForm.niveau} onChange={e => set({ niveau: e.target.value })}
                      className={inp + ' appearance-none'}>
                      {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Services souhaités</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'cantine',      label: 'Cantine scolaire',  desc: 'Repas du midi inclus' },
                        { key: 'transportBus', label: 'Bus scolaire',       desc: 'Transport aller-retour' },
                        ...(isMaternelle ? [{ key: 'garderie', label: 'Garderie', desc: 'Accueil en dehors des heures de classe' }] : []),
                      ].map(({ key, label, desc }) => {
                        const active = editForm[key] as boolean;
                        return (
                          <button key={key} type="button"
                            onClick={() => set({ [key]: !active })}
                            className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${active ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                              {active && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                            </div>
                            <div>
                              <p className={`font-black text-sm ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Besoins spécifiques</label>
                    <input type="text" value={editForm.besoinSpecifique}
                      onChange={e => set({ besoinSpecifique: e.target.value })} className={inp}
                      placeholder="Allergie, retard de développement, handisport…" />
                  </div>
                </div>
              </div>
            )}

            {/* ══ ÉTAPE 3 — Santé ══ */}
            {editStep === 3 && (
              <div className="space-y-4">

                {/* Vaccins */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Vaccins obligatoires</p>
                  {[
                    { key: 'vaccDiphterie',  dateKey: 'vaccDiphterieDate',  label: 'Diphtérie / Tétanos / Polio' },
                    { key: 'vaccPolio',      dateKey: 'vaccPolioDate',      label: 'Poliomyélite' },
                    { key: 'vaccCoqueluche', dateKey: 'vaccCoquelucheDate', label: 'Coqueluche' },
                    { key: 'vaccBCG',        dateKey: 'vaccBCGDate',        label: 'BCG' },
                  ].map(v => (
                    <div key={v.key} className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                        <input type="checkbox" checked={editForm[v.key]}
                          onChange={e => set({ [v.key]: e.target.checked })}
                          className="w-5 h-5 accent-indigo-600 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-700 leading-tight">{v.label}</span>
                      </label>
                      {editForm[v.key] && (
                        <div className="pl-8">
                          <input type="date" value={editForm[v.dateKey]}
                            onChange={e => set({ [v.dateKey]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      )}
                    </div>
                  ))}

                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest pt-2">Vaccins recommandés</p>
                  {[
                    { key: 'vaccHepB', dateKey: 'vaccHepBDate', label: 'Hépatite B' },
                    { key: 'vaccROR',  dateKey: 'vaccRORDate',  label: 'ROR (Rubéole / Oreillons / Rougeole)' },
                  ].map(v => (
                    <div key={v.key} className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                        <input type="checkbox" checked={editForm[v.key]}
                          onChange={e => set({ [v.key]: e.target.checked })}
                          className="w-5 h-5 accent-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-700 leading-tight">{v.label}</span>
                      </label>
                      {editForm[v.key] && (
                        <div className="pl-8">
                          <input type="date" value={editForm[v.dateKey]}
                            onChange={e => set({ [v.dateKey]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      )}
                    </div>
                  ))}

                  <label className="flex items-center gap-3 cursor-pointer min-h-[44px] pt-1">
                    <input type="checkbox" checked={editForm.certifContrIndication}
                      onChange={e => set({ certifContrIndication: e.target.checked })}
                      className="w-5 h-5 accent-amber-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-amber-700 leading-tight">Certificat médical de contre-indication joint</span>
                  </label>
                </div>

                {/* Traitement médical */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Traitement médical</p>
                  <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                    <input type="checkbox" checked={editForm.traitementMedical}
                      onChange={e => set({ traitementMedical: e.target.checked })}
                      className="w-5 h-5 accent-rose-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-slate-700">L'enfant suit un traitement médical en cours</span>
                  </label>
                  {editForm.traitementMedical && (
                    <textarea value={editForm.traitementDetail} onChange={e => set({ traitementDetail: e.target.value })}
                      className="w-full bg-slate-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 min-h-[80px]"
                      placeholder="Préciser le traitement, joindre ordonnance récente…" />
                  )}
                </div>

                {/* Maladies */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Maladies antérieures</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'maladieRubeole', label: 'Rubéole' }, { key: 'maladieVaricelle', label: 'Varicelle' },
                      { key: 'maladieAngine', label: 'Angine' }, { key: 'maladieRhumatisme', label: 'Rhumatisme' },
                      { key: 'maladieScarlatine', label: 'Scarlatine' }, { key: 'maladieCoqueluche', label: 'Coqueluche' },
                      { key: 'maladieOtite', label: 'Otite' }, { key: 'maladieRougeole', label: 'Rougeole' },
                      { key: 'maladieOreillons', label: 'Oreillons' },
                    ].map(m => (
                      <label key={m.key}
                        className="flex items-center gap-2.5 cursor-pointer px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                        <input type="checkbox" checked={editForm[m.key]}
                          onChange={e => set({ [m.key]: e.target.checked })}
                          className="w-5 h-5 accent-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-700 leading-tight">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Allergies */}
                <div className="bg-rose-50 border border-rose-200 rounded-3xl p-4 sm:p-6 space-y-3">
                  <p className="font-black text-rose-700 text-xs uppercase tracking-widest">Allergies</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'allergieAsthme', label: 'Asthme' },
                      { key: 'allergieMedicament', label: 'Médicamenteuses' },
                      { key: 'allergieAlimentaire', label: 'Alimentaires' },
                    ].map(a => (
                      <label key={a.key}
                        className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-2xl border-2 transition-all min-h-[52px] ${editForm[a.key] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                        <input type="checkbox" checked={editForm[a.key]}
                          onChange={e => set({ [a.key]: e.target.checked })}
                          className="w-5 h-5 accent-white flex-shrink-0" />
                        <span className="text-sm font-black">{a.label}</span>
                      </label>
                    ))}
                  </div>
                  <input type="text" value={editForm.allergieAutres} onChange={e => set({ allergieAutres: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20"
                    placeholder="Autres allergies (cause)…" />
                  <textarea value={editForm.allergieConduite} onChange={e => set({ allergieConduite: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20 min-h-[70px]"
                    placeholder="Conduite à tenir en cas de crise…" />
                </div>

                {/* Équipements */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Équipements portés</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'equipeLunettes', label: 'Lunettes' }, { key: 'equipeLentilles', label: 'Lentilles' },
                      { key: 'equipeProtheseAuditive', label: 'Prothèse auditive' }, { key: 'equipeProtheseDentaire', label: 'Prothèse dentaire' },
                    ].map(eq => (
                      <label key={eq.key}
                        className="flex items-center gap-2.5 cursor-pointer px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                        <input type="checkbox" checked={editForm[eq.key]}
                          onChange={ev => set({ [eq.key]: ev.target.checked })}
                          className="w-5 h-5 accent-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-700 leading-tight">{eq.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nuit + médecin + autorisations */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <div>
                    <p className="font-black text-slate-700 text-xs uppercase tracking-widest mb-3">Mouille le lit la nuit ?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: 'OUI', l: 'Oui' }, { v: 'NON', l: 'Non' }, { v: 'OCCASIONNELLEMENT', l: 'Parfois' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => set({ mouillerLit: opt.v })}
                          className={`py-3 rounded-2xl text-xs font-black border-2 transition-all active:scale-95 ${editForm.mouillerLit === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Médecin traitant</label>
                      <input type="text" value={editForm.medecinNom} onChange={e => set({ medecinNom: e.target.value })} className={inp} placeholder="Nom du médecin" />
                    </div>
                    <div>
                      <label className={lbl}>Téléphone médecin</label>
                      <input type="tel" value={editForm.medecinTel} onChange={e => set({ medecinTel: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" />
                    </div>
                  </div>
                </div>

                {/* Autorisations */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-4 sm:p-6 space-y-3">
                  <p className="font-black text-indigo-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Camera size={14} /> Autorisations parentales
                  </p>
                  {[
                    { key: 'autorisationSoins', text: "J'autorise le responsable de l'établissement à prendre toutes mesures médicales nécessaires en cas d'urgence." },
                    { key: 'autorisationPhoto', text: "J'autorise la prise de photographies et vidéos de mon enfant dans le cadre des activités de l'établissement." },
                  ].map(({ key, text }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={editForm[key]}
                        onChange={e => set({ [key]: e.target.checked })}
                        className="w-5 h-5 accent-indigo-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-bold text-slate-700 leading-relaxed">{text}</span>
                    </label>
                  ))}
                </div>

              </div>
            )}

            {/* ══ ÉTAPE 4 — Parents ══ */}
            {editStep === 4 && (
              <div className="space-y-4">

                {/* Situation familiale */}
                <div className="bg-indigo-50/50 rounded-3xl border border-indigo-100 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-indigo-600 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Users size={13} /> Situation familiale
                  </p>
                  <div>
                    <label className={lbl}>Situation matrimoniale</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {([
                        { v: 'MARIE', l: 'Marié(e)' }, { v: 'DIVORCE', l: 'Divorcé(e)' },
                        { v: 'SEPARE', l: 'Séparé(e)' }, { v: 'CELIBATAIRE', l: 'Célibataire' },
                        { v: 'VEUF', l: 'Veuf(ve)' }, { v: 'UNION_LIBRE', l: 'Union libre' },
                      ]).map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => set({ situationMatrimoniale: editForm.situationMatrimoniale === opt.v ? '' : opt.v })}
                          className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${editForm.situationMatrimoniale === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Les parents résident-ils dans le même pays ?</label>
                    <div className="flex gap-3 mt-1">
                      {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }].map(opt => (
                        <button key={String(opt.v)} type="button"
                          onClick={() => set({ parentsMemeResidence: editForm.parentsMemeResidence === opt.v ? null : opt.v })}
                          className={`px-6 py-2.5 rounded-2xl text-sm font-bold border transition-all ${editForm.parentsMemeResidence === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Parent 1 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Phone size={13} className="text-indigo-600" /> Parent / tuteur légal principal
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Prénom</label>
                      <input type="text" value={editForm.parent1Prenom} onChange={e => set({ parent1Prenom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Nom</label>
                      <input type="text" value={editForm.parent1Nom} onChange={e => set({ parent1Nom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Lien avec l'enfant</label>
                      <select value={editForm.parent1Lien} onChange={e => set({ parent1Lien: e.target.value })} className={inp + ' appearance-none'}>
                        <option value="MERE">Mère</option><option value="PERE">Père</option><option value="TUTEUR">Tuteur légal</option>
                      </select></div>
                    <div><label className={lbl}>Téléphone <span className="text-rose-500">*</span></label>
                      <input type="tel" value={editForm.parent1Tel}
                        onChange={e => set({ parent1Tel: e.target.value, parent1Whatsapp: e.target.value })}
                        className={inp} placeholder="+221 77 xxx xxxx" /></div>
                    <div><label className={lbl}>WhatsApp</label>
                      <input type="tel" value={editForm.parent1Whatsapp} onChange={e => set({ parent1Whatsapp: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Email</label>
                      <input type="text" inputMode="email" value={editForm.parent1Email} onChange={e => set({ parent1Email: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Tél. domicile</label>
                      <input type="tel" value={editForm.parent1TelDomicile} onChange={e => set({ parent1TelDomicile: e.target.value })} className={inp} placeholder="+221 33 xxx xxxx" /></div>
                    <div><label className={lbl}>Tél. travail</label>
                      <input type="tel" value={editForm.parent1TelTravail} onChange={e => set({ parent1TelTravail: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Profession</label>
                      <input type="text" value={editForm.parent1Profession} onChange={e => set({ parent1Profession: e.target.value })} className={inp} placeholder="Enseignante, commerçant…" /></div>
                    <div><label className={lbl}>Nom de l'entreprise</label>
                      <input type="text" value={editForm.parent1Entreprise} onChange={e => set({ parent1Entreprise: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Pays de résidence</label>
                      <input type="text" value={editForm.parent1PaysResidence} onChange={e => set({ parent1PaysResidence: e.target.value })} className={inp} placeholder="Sénégal" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Adresse</label>
                      <input type="text" value={editForm.parent1Adresse} onChange={e => set({ parent1Adresse: e.target.value })} className={inp} placeholder="Rue, quartier, ville…" /></div>
                  </div>
                </div>

                {/* Parent 2 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-slate-500 text-xs uppercase tracking-widest">Second parent (facultatif)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Prénom</label>
                      <input type="text" value={editForm.parent2Prenom} onChange={e => set({ parent2Prenom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Nom</label>
                      <input type="text" value={editForm.parent2Nom} onChange={e => set({ parent2Nom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Lien</label>
                      <select value={editForm.parent2Lien} onChange={e => set({ parent2Lien: e.target.value })} className={inp + ' appearance-none'}>
                        <option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur légal</option>
                      </select></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={editForm.parent2Tel} onChange={e => set({ parent2Tel: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Profession</label>
                      <input type="text" value={editForm.parent2Profession} onChange={e => set({ parent2Profession: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Nom de l'entreprise</label>
                      <input type="text" value={editForm.parent2Entreprise} onChange={e => set({ parent2Entreprise: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Pays de résidence</label>
                      <input type="text" value={editForm.parent2PaysResidence} onChange={e => set({ parent2PaysResidence: e.target.value })} className={inp} placeholder="Sénégal" /></div>
                  </div>
                </div>

                {/* Personne autorisée */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-emerald-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={13} /> Personne autorisée à venir chercher l'enfant
                  </p>
                  <p className="text-xs text-slate-400 -mt-2">En dehors des parents, qui peut récupérer l'enfant à la sortie ?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Nom complet</label>
                      <input type="text" value={editForm.recupNom} onChange={e => set({ recupNom: e.target.value })} className={inp} placeholder="Prénom et nom" /></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={editForm.recupTel} onChange={e => set({ recupTel: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Lien avec l'enfant</label>
                      <input type="text" value={editForm.recupLien} onChange={e => set({ recupLien: e.target.value })} className={inp} placeholder="Grand-frère, nounou, chauffeur…" /></div>
                  </div>
                </div>

                {/* Contact urgence */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-rose-600 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Shield size={13} /> Contact d'urgence
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Nom complet</label>
                      <input type="text" value={editForm.urgenceNom} onChange={e => set({ urgenceNom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={editForm.urgenceTel} onChange={e => set({ urgenceTel: e.target.value })} className={inp} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Lien avec l'enfant</label>
                      <input type="text" value={editForm.urgenceLien} onChange={e => set({ urgenceLien: e.target.value })} className={inp} placeholder="Grand-mère, Oncle, Tante…" /></div>
                  </div>
                </div>

              </div>
            )}

            {/* ══ ÉTAPE 5 — Récapitulatif ══ */}
            {editStep === 5 && (
              <div className="space-y-4">

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    {editForm.photoUrl && (
                      <img src={editForm.photoUrl} alt="Photo"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-100 flex-shrink-0" />
                    )}
                    <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Enfant</p>
                  </div>
                  {[
                    { label: 'Nom complet', value: `${editForm.prenomEnfant} ${editForm.nomEnfant}` },
                    editForm.dateNaissance ? { label: 'Naissance', value: `${new Date(editForm.dateNaissance).toLocaleDateString('fr-FR')}${editForm.lieuNaissance ? ` — ${editForm.lieuNaissance}` : ''}` } : null,
                    editForm.sexe ? { label: 'Sexe', value: editForm.sexe === 'M' ? 'Garçon' : 'Fille' } : null,
                    { label: 'Niveau', value: niveauLabel(editForm.niveau) },
                  ].filter(Boolean).map((row: any, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 font-bold flex-shrink-0">{row.label}</span>
                      <span className="font-black text-slate-800 text-right">{row.value}</span>
                    </div>
                  ))}
                  {(editForm.cantine || editForm.transportBus || (isMaternelle && editForm.garderie)) && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {editForm.cantine && <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black border border-emerald-200">Cantine</span>}
                      {editForm.transportBus && <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-black border border-amber-200">Bus scolaire</span>}
                      {isMaternelle && editForm.garderie && <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black border border-indigo-200">Garderie</span>}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Parent</p>
                  {[
                    { label: 'Identité', value: `${editForm.parent1Prenom} ${editForm.parent1Nom} (${editForm.parent1Lien === 'MERE' ? 'Mère' : editForm.parent1Lien === 'PERE' ? 'Père' : 'Tuteur'})` },
                    editForm.parent1Tel ? { label: 'Téléphone', value: editForm.parent1Tel } : null,
                    editForm.parent1Email ? { label: 'Email', value: editForm.parent1Email } : null,
                  ].filter(Boolean).map((row: any, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 font-bold flex-shrink-0">{row.label}</span>
                      <span className="font-black text-slate-800 text-right">{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-4 space-y-2">
                  <p className="font-black text-rose-600 text-xs uppercase tracking-widest flex items-center gap-2"><Stethoscope size={12} /> Santé</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[{ k: 'vaccDiphterie', l: 'Diph.' }, { k: 'vaccPolio', l: 'Polio' }, { k: 'vaccCoqueluche', l: 'Coq.' },
                      { k: 'vaccBCG', l: 'BCG' }, { k: 'vaccHepB', l: 'HepB' }, { k: 'vaccROR', l: 'ROR' }].map(v => (
                      <span key={v.k} className={`px-2.5 py-1 rounded-lg text-xs font-black ${editForm[v.k] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>{v.l}</span>
                    ))}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <span className={`text-xs font-black ${editForm.autorisationSoins ? 'text-emerald-700' : 'text-rose-600'}`}>{editForm.autorisationSoins ? '✓' : '✗'} Soins urgents</span>
                    <span className={`text-xs font-black ${editForm.autorisationPhoto ? 'text-emerald-700' : 'text-rose-600'}`}>{editForm.autorisationPhoto ? '✓' : '✗'} Photos</span>
                  </div>
                </div>

                {/* Pièces justificatives */}
                <PiecesJointes niveau={editForm.niveau} value={pieces} onChange={setPieces}
                  title="Pièces justificatives — joignez ou mettez à jour vos documents" />

                <div>
                  <label className={lbl}>Message pour l'école (facultatif)</label>
                  <textarea value={editForm.notes || ''} onChange={e => set({ notes: e.target.value })}
                    className={`${inp} min-h-[80px]`} placeholder="Expliquez les corrections apportées…" />
                </div>

              </div>
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 safe-bottom">
          {editStep > 1 ? (
            <button type="button" onClick={() => { setEditStep(s => s - 1); setError(null); window.scrollTo({ top: 0 }); }}
              className="flex items-center gap-2 px-5 sm:px-6 py-3.5 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm active:bg-slate-100 transition-all">
              <ChevronLeft size={18} /> <span className="hidden xs:inline">Retour</span>
            </button>
          ) : (
            <button type="button" onClick={() => setEditMode(false)}
              className="px-5 sm:px-6 py-3.5 border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-sm active:bg-slate-100 transition-all">
              Annuler
            </button>
          )}

          {editStep < 5 ? (
            <button type="button" onClick={handleEditNext}
              className="flex items-center gap-2 px-7 sm:px-8 py-3.5 bg-indigo-600 active:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-200">
              Suivant <ArrowRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={handleResubmit}
              disabled={submitting || !editForm.prenomEnfant?.trim() || !editForm.nomEnfant?.trim()}
              className="flex items-center gap-2 px-6 sm:px-8 py-3.5 bg-emerald-500 active:bg-emerald-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-200 disabled:opacity-50">
              {submitting
                ? <><Loader2 className="animate-spin" size={16} /> Envoi…</>
                : <><Save size={16} /> Resoumettre le dossier</>}
            </button>
          )}
        </div>

      </div>
    );
  }

  // ── Vue principale (recherche + résultat) ─────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">

      {/* Entête */}
      <header className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate('/parents')}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        {ecole.logoUrl ? (
          <img src={ecole.logoUrl} alt="Logo"
            className="h-10 w-10 rounded-xl object-contain bg-white p-0.5 flex-shrink-0 shadow-md" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <School className="w-5 h-5 text-white/50" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-black text-sm leading-tight truncate">{ecole.name || 'Préinscription'}</p>
          <p className="text-indigo-300 text-xs">Suivi de dossier</p>
        </div>
      </header>

      {/* Contenu */}
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 pb-8 pt-4">
        <div className="w-full max-w-lg space-y-4">

          {/* Titre */}
          <div className="text-center mb-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">Suivre mon dossier</h1>
            <p className="text-indigo-300 text-sm">Entrez votre numéro de référence reçu après la soumission</p>
          </div>

          {/* Formulaire de recherche */}
          <form onSubmit={handleSearch} className="bg-white rounded-3xl shadow-xl p-5 sm:p-6 space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">
                Numéro de référence
              </label>
              <input
                type="text"
                value={ref}
                onChange={e => {
                  setRef(formatRef(e.target.value));
                  setError(null);
                  setResult(null);
                  setResubmitSuccess(false);
                }}
                placeholder="PRE-2026-C0C91A"
                maxLength={15}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-xl font-black text-slate-900 tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition placeholder:text-slate-300 placeholder:font-normal placeholder:text-base text-center"
              />
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Format : PRE-AAAA-XXXXXX (15 caractères)
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
                <AlertTriangle size={16} className="flex-shrink-0" /> {error}
              </div>
            )}

            <button type="submit"
              disabled={loading || ref.length < 15}
              className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 active:bg-indigo-700 text-white font-black rounded-2xl transition shadow-lg shadow-indigo-900/30 disabled:opacity-40 text-sm uppercase tracking-widest">
              {loading
                ? <><RefreshCw size={16} className="animate-spin" /> Recherche…</>
                : <><Search size={16} /> Consulter mon dossier</>}
            </button>
          </form>

          {/* Succès resoumission */}
          {resubmitSuccess && (
            <div className="bg-emerald-500 rounded-3xl shadow-xl p-5 sm:p-6 text-center space-y-3 animate-fade-in">
              <CheckCircle2 size={40} className="text-white mx-auto" />
              <h3 className="text-white font-black text-lg">Dossier resoumis avec succès !</h3>
              <p className="text-emerald-100 text-sm leading-relaxed">
                Votre dossier a été mis à jour et resoumis à l'école. Vous serez contacté(e) pour la suite.
              </p>
            </div>
          )}

          {/* Résultat */}
          {result && cfg && (
            <div className="space-y-3 animate-fade-in">

              {/* Carte enfant + statut */}
              <div className={`bg-white rounded-3xl shadow-xl overflow-hidden border-2 ${cfg.border}`}>

                {/* Bandeau statut */}
                <div className={`${cfg.bg} ${cfg.border} border-b px-5 sm:px-6 py-4 flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <cfg.icon className={`w-6 h-6 ${cfg.text}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-black text-sm leading-tight ${cfg.text}`}>{cfg.label}</p>
                    <p className="text-slate-400 text-xs mt-0.5 font-mono">{result.reference}</p>
                  </div>
                </div>

                {/* Infos enfant */}
                <div className="px-5 sm:px-6 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {result.photoUrl ? (
                      <img src={result.photoUrl} alt={`${result.prenom} ${result.nomInitiale}`}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Baby className="w-6 h-6 text-indigo-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-black text-slate-900 text-lg leading-tight">
                        {result.prenom} {result.nomInitiale}
                      </p>
                      <p className="text-slate-400 text-sm">{niveauLabel(result.niveau)}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Déposé le</p>
                      <p className="font-black text-slate-700">
                        {new Date(result.dateDepot).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Niveau</p>
                      <p className="font-black text-slate-700">{niveauLabel(result.niveau)}</p>
                    </div>
                  </div>
                </div>

                {/* Motif de rejet */}
                {result.statut === 'REJETE' && result.motifRejet && (
                  <div className="px-5 sm:px-6 pb-4">
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">Motif du rejet</p>
                      <p className="text-rose-800 text-sm font-bold leading-relaxed">{result.motifRejet}</p>
                    </div>
                  </div>
                )}

                {/* Code désactivé */}
                {result.codeActif === false && (
                  <div className="px-5 sm:px-6 pb-4">
                    <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Code de suivi désactivé — dossier validé
                      </p>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {!isNegative && (
                  <div className="px-5 sm:px-6 pb-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Progression du dossier</p>
                    <div className="flex items-center gap-0">
                      {TIMELINE.map((s, i) => {
                        const isActive = s === result.statut;
                        const isDone   = TIMELINE.indexOf(result.statut) > i;
                        const isLast   = i === TIMELINE.length - 1;
                        const stepCfg  = STATUT_CONFIG[s];
                        const StepIcon = stepCfg.icon;
                        return (
                          <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                isActive ? `${cfg.bg} ${cfg.border} shadow-md` :
                                isDone   ? 'bg-emerald-500 border-emerald-500' :
                                           'bg-slate-100 border-slate-200'
                              }`}>
                                {isDone
                                  ? <CheckCircle2 size={14} className="text-white" />
                                  : <StepIcon size={13} className={isActive ? cfg.text : 'text-slate-300'} />}
                              </div>
                              <p className={`text-[9px] font-black text-center leading-tight max-w-[52px] ${
                                isActive ? cfg.text : isDone ? 'text-emerald-600' : 'text-slate-300'
                              }`}>{s === 'EN_ATTENTE' ? 'Reçu' : s === 'ADMIS' ? 'Admis' : s === 'INSCRIT' ? 'Inscrit' : 'Actif'}</p>
                            </div>
                            {!isLast && (
                              <div className={`flex-1 h-0.5 mb-5 mx-1 ${
                                isDone ? 'bg-emerald-400' : 'bg-slate-200'
                              }`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Message et prochaine étape */}
                <div className="px-5 sm:px-6 pb-5 space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-slate-600 text-sm leading-relaxed">{cfg.desc}</p>
                  {cfg.next && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1">Prochaine étape</p>
                      <p className="text-indigo-700 text-sm font-bold leading-relaxed">{cfg.next}</p>
                    </div>
                  )}
                </div>

                {/* Bouton resoumettre */}
                {canResubmit && (
                  <div className="px-5 sm:px-6 pb-5">
                    <button onClick={startEdit}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 active:bg-indigo-700 text-white font-black rounded-2xl transition shadow-lg shadow-indigo-200 text-sm uppercase tracking-widest">
                      <Edit3 size={16} /> Corriger et resoumettre mon dossier
                    </button>
                  </div>
                )}
              </div>

              {/* Nouvelle recherche */}
              <button
                onClick={() => { setResult(null); setRef(''); setError(null); setResubmitSuccess(false); }}
                className="w-full py-3.5 rounded-2xl border-2 border-white/20 text-white/70 font-bold text-sm active:bg-white/10 transition flex items-center justify-center gap-2">
                <Search size={15} /> Rechercher un autre dossier
              </button>
            </div>
          )}

          {/* Liens rapides */}
          {!result && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/inscription')}
                className="bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-2xl p-4 text-center transition">
                <Baby className="w-6 h-6 text-indigo-300 mx-auto mb-2" />
                <p className="text-white font-black text-xs">Déposer un dossier</p>
              </button>
              <button onClick={() => navigate('/parents')}
                className="bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-2xl p-4 text-center transition">
                <School className="w-6 h-6 text-indigo-300 mx-auto mb-2" />
                <p className="text-white font-black text-xs">Espace parents</p>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PublicSuivi;
