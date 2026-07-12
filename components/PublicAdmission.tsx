import React, { useEffect, useState } from 'react';
import {
  Baby, GraduationCap, Stethoscope, Phone, CheckCircle2,
  ChevronLeft, ArrowRight, Loader2, AlertCircle, Save,
  Shield, Camera, School, UserCheck, X,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { compressImageToDataUrl } from '../services/photoUtils';
import { piecesForNiveau, PieceJointe } from '../services/piecesJustificatives';
import PiecesJointes from './PiecesJointes';

// Niveaux maternelle : la garderie n'est proposée que pour eux
const NIVEAUX_MATERNELLE = ['CRECHE', 'PS', 'MS', 'GS'];

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const STEPS = [
  { n: 1, label: "Identité de l'enfant",      sub: 'État civil et informations de base',       icon: Baby },
  { n: 2, label: 'Scolarité & options',        sub: 'Niveau souhaité, cantine, transport',      icon: GraduationCap },
  { n: 3, label: 'Fiche sanitaire',            sub: 'Vaccins, allergies, autorisations',         icon: Stethoscope },
  { n: 4, label: 'Coordonnées parents',        sub: 'Parent principal, second parent, urgence', icon: Phone },
  { n: 5, label: 'Récapitulatif',              sub: 'Relisez et soumettez votre dossier',       icon: CheckCircle2 },
];

// ─── Formulaire vide ──────────────────────────────────────────────────────────

const EMPTY = {
  nomEnfant: '', prenomEnfant: '', dateNaissance: '', lieuNaissance: '',
  sexe: '' as '' | 'M' | 'F',
  photoUrl: '',
  niveau: 'PS', cantine: false, transportBus: false, garderie: false, besoinSpecifique: '',
  vaccDiphterie: false, vaccDiphterieDate: '',
  vaccPolio: false,     vaccPolioDate: '',
  vaccCoqueluche: false,vaccCoquelucheDate: '',
  vaccBCG: false,       vaccBCGDate: '',
  vaccHepB: false,      vaccHepBDate: '',
  vaccROR: false,       vaccRORDate: '',
  certifContrIndication: false,
  traitementMedical: false, traitementDetail: '',
  maladieRubeole: false, maladieVaricelle: false, maladieAngine: false,
  maladieRhumatisme: false, maladieScarlatine: false, maladieCoqueluche: false,
  maladieOtite: false, maladieRougeole: false, maladieOreillons: false,
  allergieAsthme: false, allergieMedicament: false, allergieAlimentaire: false,
  allergieAutres: '', allergieConduite: '',
  difficulteSante: '',
  equipeLunettes: false, equipeLentilles: false,
  equipeProtheseAuditive: false, equipeProtheseDentaire: false,
  equipePrecisions: '',
  mouillerLit: '' as '' | 'OUI' | 'NON' | 'OCCASIONNELLEMENT',
  medecinNom: '', medecinTel: '',
  autorisationSoins: false, autorisationPhoto: false,
  parent1Nom: '', parent1Prenom: '', parent1Tel: '', parent1Whatsapp: '',
  parent1Email: '', parent1Lien: 'MERE' as 'PERE' | 'MERE' | 'TUTEUR',
  parent1TelDomicile: '', parent1TelTravail: '', parent1Adresse: '',
  parent1Profession: '', parent1Entreprise: '',
  parent2Nom: '', parent2Prenom: '', parent2Lien: 'PERE' as 'PERE' | 'MERE' | 'TUTEUR',
  parent2Tel: '', parent2TelDomicile: '', parent2TelTravail: '',
  parent2Profession: '', parent2Entreprise: '',
  urgenceNom: '', urgenceTel: '', urgenceLien: '',
  recupNom: '', recupTel: '', recupLien: '',
  notes: '',
};

type FormType = typeof EMPTY;

// Inputs : py-4 pour cibles tactiles ≥ 44px sur mobile
const inp = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-base font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition';
const lbl = 'text-xs font-black text-slate-500 uppercase tracking-wider px-1 mb-2 block';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ecole { name?: string; logoUrl?: string }
interface Props  { onBack?: () => void }

// ─── Composant ────────────────────────────────────────────────────────────────

const PublicAdmission: React.FC<Props> = ({ onBack }) => {
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<FormType>(EMPTY);
  const [pieces, setPieces]   = useState<Record<string, PieceJointe>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<{ reference: string; message: string } | null>(null);

  // Cache localStorage → logo affiché immédiatement sans attendre l'API
  const [ecole, setEcole] = useState<Ecole>(() => {
    try { const r = localStorage.getItem('ecole_branding'); return r ? JSON.parse(r) : {}; }
    catch { return {}; }
  });

  const set = (patch: Partial<FormType>) => setForm(f => ({ ...f, ...patch }));
  const niveauLabel = (v: string) => NIVEAUX.find(n => n.value === v)?.label ?? v;
  const isMaternelle = NIVEAUX_MATERNELLE.includes(form.niveau);

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

  useEffect(() => {
    apiClient.get('/public/ecole').then((d: any) => {
      if (!d) return;
      setEcole(d);
      localStorage.setItem('ecole_branding', JSON.stringify(d));
    }).catch(() => {});
  }, []);

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!form.prenomEnfant.trim() || !form.nomEnfant.trim())) {
      setError("Prénom et nom de l'enfant sont obligatoires."); return;
    }
    if (step === 4 && !form.parent1Tel.trim()) {
      setError('Le téléphone du parent est obligatoire.'); return;
    }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const payload = {
        nom: form.nomEnfant.trim(), prenom: form.prenomEnfant.trim(),
        dateNaissance: form.dateNaissance || null, lieuNaissance: form.lieuNaissance || null,
        sexe: form.sexe || null, niveau: form.niveau,
        photoUrl: form.photoUrl || null,
        cantine: form.cantine, transportBus: form.transportBus,
        garderie: isMaternelle && form.garderie,
        besoinSpecifique: form.besoinSpecifique || null,
        ficheSanitaire: {
          vaccDiphterie: form.vaccDiphterie, vaccDiphterieDate: form.vaccDiphterieDate,
          vaccPolio: form.vaccPolio, vaccPolioDate: form.vaccPolioDate,
          vaccCoqueluche: form.vaccCoqueluche, vaccCoquelucheDate: form.vaccCoquelucheDate,
          vaccBCG: form.vaccBCG, vaccBCGDate: form.vaccBCGDate,
          vaccHepB: form.vaccHepB, vaccHepBDate: form.vaccHepBDate,
          vaccROR: form.vaccROR, vaccRORDate: form.vaccRORDate,
          certifContrIndication: form.certifContrIndication,
          traitementMedical: form.traitementMedical, traitementDetail: form.traitementDetail,
          maladieRubeole: form.maladieRubeole, maladieVaricelle: form.maladieVaricelle,
          maladieAngine: form.maladieAngine, maladieRhumatisme: form.maladieRhumatisme,
          maladieScarlatine: form.maladieScarlatine, maladieCoqueluche: form.maladieCoqueluche,
          maladieOtite: form.maladieOtite, maladieRougeole: form.maladieRougeole,
          maladieOreillons: form.maladieOreillons,
          allergieAsthme: form.allergieAsthme, allergieMedicament: form.allergieMedicament,
          allergieAlimentaire: form.allergieAlimentaire,
          allergieAutres: form.allergieAutres, allergieConduite: form.allergieConduite,
          difficulteSante: form.difficulteSante,
          equipeLunettes: form.equipeLunettes, equipeLentilles: form.equipeLentilles,
          equipeProtheseAuditive: form.equipeProtheseAuditive,
          equipeProtheseDentaire: form.equipeProtheseDentaire,
          equipePrecisions: form.equipePrecisions,
          mouillerLit: form.mouillerLit || null,
          medecinNom: form.medecinNom, medecinTel: form.medecinTel,
          autorisationSoins: form.autorisationSoins, autorisationPhoto: form.autorisationPhoto,
        },
        parent1: {
          nom: form.parent1Nom, prenom: form.parent1Prenom,
          telephone: form.parent1Tel, whatsapp: form.parent1Whatsapp,
          email: form.parent1Email, lien: form.parent1Lien,
          telDomicile: form.parent1TelDomicile, telTravail: form.parent1TelTravail,
          adresse: form.parent1Adresse,
          profession: form.parent1Profession, entreprise: form.parent1Entreprise,
        },
        parent2: (form.parent2Nom || form.parent2Tel) ? {
          nom: form.parent2Nom, prenom: form.parent2Prenom,
          telephone: form.parent2Tel, lien: form.parent2Lien,
          telDomicile: form.parent2TelDomicile, telTravail: form.parent2TelTravail,
          profession: form.parent2Profession, entreprise: form.parent2Entreprise,
        } : null,
        contactUrgence: form.urgenceNom ? {
          nom: form.urgenceNom, telephone: form.urgenceTel, lien: form.urgenceLien,
        } : null,
        personneAutorisee: form.recupNom ? {
          nom: form.recupNom, telephone: form.recupTel, lien: form.recupLien,
        } : null,
        piecesJointes: Object.values(pieces),
        notes: form.notes || null,
      };
      const res: any = await apiClient.post('/public/admission', payload);
      setResult({ reference: res.reference, message: res.message });
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la soumission. Veuillez réessayer.');
    } finally { setLoading(false); }
  };

  // ── Écran succès ─────────────────────────────────────────────────────────────

  if (result) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-10 text-center">
        {ecole.logoUrl && (
          <img src={ecole.logoUrl} alt="Logo"
            className="h-16 w-16 rounded-2xl object-contain mx-auto mb-4 border border-slate-100 shadow-sm p-1" />
        )}
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">Dossier transmis !</h2>
        <p className="text-slate-400 text-sm mb-5">{ecole.name || "L'école"} a bien reçu votre demande.</p>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-5">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Numéro de dossier</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-widest">{result.reference}</p>
          <p className="text-xs text-slate-400 mt-2">Conservez ce numéro — il vous sera demandé lors de votre visite</p>
        </div>
        <p className="text-slate-500 text-sm leading-relaxed mb-4">{result.message}</p>

        {/* Originaux à présenter lors de la visite */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 mb-6 text-left">
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">
            Originaux à présenter à l'école
          </p>
          <p className="text-[11px] text-slate-500 mb-2">Vos pièces jointes ont été versées au dossier. Apportez les originaux lors de votre visite :</p>
          <ul className="space-y-1">
            {piecesForNiveau(form.niveau).map((p, i) => (
              <li key={i} className="text-xs text-slate-700 font-bold flex items-start gap-2">
                <span className={pieces[p.code] ? 'text-emerald-500 mt-0.5' : 'text-amber-500 mt-0.5'}>
                  {pieces[p.code] ? '✓' : '•'}
                </span>
                <span>{p.label}{p.obligatoire ? '' : ' (si applicable)'}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Bouton suivi — lien direct avec la référence pré-remplie */}
        <a href={`/suivi-inscription?ref=${result.reference}`}
          onClick={e => {
            e.preventDefault();
            window.history.pushState({}, '', `/suivi-inscription?ref=${result.reference}`);
            window.location.reload();
          }}
          className="w-full py-4 rounded-2xl bg-emerald-500 active:bg-emerald-600 text-white font-black uppercase tracking-widest transition mb-3 text-sm flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Suivre l'avancement de mon dossier
        </a>
        <button onClick={() => { setResult(null); setForm(EMPTY); setPieces({}); setStep(1); }}
          className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold active:bg-slate-100 transition mb-2 text-sm">
          Soumettre un autre dossier
        </button>
        {onBack && (
          <button onClick={onBack}
            className="w-full py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-bold active:bg-slate-50 transition text-sm">
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );

  const currentStep = STEPS[step - 1];
  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  // ── Page principale ──────────────────────────────────────────────────────────
  // Structure : flex-col h-dvh (dynamic viewport height) — empêche le scroll global
  // sur mobile, seul le contenu du milieu scroll.

  return (
    <div className="flex flex-col lg:flex-row bg-slate-100" style={{ height: '100dvh' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR — cachée sur mobile, visible sur desktop (lg+)
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex lg:w-80 xl:w-96 flex-col bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 h-full overflow-y-auto p-8 border-r border-white/5">

        {/* Logo + nom */}
        <div className="flex flex-col items-center text-center mb-8">
          {ecole.logoUrl ? (
            <div className="w-28 h-28 rounded-3xl bg-white shadow-2xl shadow-black/30 flex items-center justify-center mb-4 p-2">
              <img src={ecole.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
              <School className="w-14 h-14 text-white/30" />
            </div>
          )}
          <h1 className="text-white font-black text-xl leading-tight mb-1">{ecole.name || 'École'}</h1>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Formulaire de préinscription</p>
        </div>

        {/* Étapes verticales */}
        <nav className="space-y-1.5 flex-1">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = step > s.n; const active = step === s.n;
            return (
              <div key={s.n} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${active ? 'bg-indigo-500/20 border border-indigo-400/30' : done ? 'opacity-60' : 'opacity-25'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'}`}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black leading-tight ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-400'}`}>{s.label}</p>
                  {active && <p className="text-indigo-300 text-xs mt-0.5">{s.sub}</p>}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Progression */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-2">
            <span>Progression</span>
            <span className="text-indigo-300">{pct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {onBack && (
            <button onClick={onBack} className="mt-5 w-full text-xs text-slate-500 hover:text-slate-300 font-bold transition text-center">
              ← Retour à la connexion
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN — toute la hauteur, structure fixe : header / scroll / footer
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 h-full">

        {/* ── Header mobile (sticky, hors du scroll) ─────────────────────── */}
        <div className="lg:hidden flex-shrink-0 bg-gradient-to-r from-slate-900 to-indigo-900">

          {/* Ligne logo + école */}
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
              <p className="text-white font-black text-base leading-tight truncate">{ecole.name || 'Préinscription'}</p>
              <p className="text-indigo-300 text-xs font-bold mt-0.5">{currentStep.label}</p>
            </div>
            {onBack && (
              <button onClick={onBack} className="text-slate-400 text-xs font-bold hover:text-white transition px-2 flex-shrink-0">
                Annuler
              </button>
            )}
          </div>

          {/* Barre de progression + pastilles */}
          <div className="px-4 pb-3">
            {/* Pastilles d'étapes */}
            <div className="flex items-center gap-1.5 mb-2">
              {STEPS.map((s) => (
                <div key={s.n} className={`transition-all rounded-full ${
                  step === s.n ? 'flex-1 h-2 bg-indigo-400' :
                  step > s.n  ? 'flex-1 h-2 bg-emerald-400' :
                                'flex-1 h-1.5 bg-white/15'
                }`} />
              ))}
            </div>
            <p className="text-slate-400 text-[10px] font-bold">
              Étape {step} sur {STEPS.length} — {currentStep.sub}
            </p>
          </div>
        </div>

        {/* ── Titre desktop (hors du scroll) ─────────────────────────────── */}
        <div className="hidden lg:flex flex-shrink-0 bg-white border-b border-slate-200 px-8 xl:px-10 py-5 items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <currentStep.icon className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{currentStep.label}</h2>
            <p className="text-slate-400 text-sm">{currentStep.sub}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-indigo-600">{step}</p>
            <p className="text-xs text-slate-400 font-bold">sur {STEPS.length}</p>
          </div>
        </div>

        {/* ── Zone scrollable ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold flex items-center gap-3">
                <AlertCircle size={18} className="flex-shrink-0" /> {error}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ÉTAPE 1 — Identité
            ════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">

                  {/* Photo de l'enfant */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {form.photoUrl ? (
                        <>
                          <img src={form.photoUrl} alt="Photo de l'enfant"
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
                        Une photo d'identité récente. Elle apparaîtra sur le dossier et la fiche de l'élève.
                      </p>
                      {form.photoUrl && (
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
                      <input type="text" value={form.prenomEnfant}
                        onChange={e => set({ prenomEnfant: e.target.value })} className={inp}
                        placeholder="Prénom de l'enfant" autoComplete="given-name" />
                    </div>
                    <div>
                      <label className={lbl}>Nom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.nomEnfant}
                        onChange={e => set({ nomEnfant: e.target.value })} className={inp}
                        placeholder="Nom de famille" autoComplete="family-name" />
                    </div>
                    <div>
                      <label className={lbl}>Date de naissance</label>
                      <input type="date" value={form.dateNaissance}
                        onChange={e => set({ dateNaissance: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Lieu de naissance</label>
                      <input type="text" value={form.lieuNaissance}
                        onChange={e => set({ lieuNaissance: e.target.value })} className={inp} placeholder="Dakar" />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Sexe</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ v: 'M', l: '👦  Garçon' }, { v: 'F', l: '👧  Fille' }].map(s => (
                        <button key={s.v} type="button" onClick={() => set({ sexe: s.v as 'M' | 'F' })}
                          className={`py-4 rounded-2xl text-base font-black border-2 transition-all active:scale-95 ${form.sexe === s.v ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ÉTAPE 2 — Scolarité
            ════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <div>
                    <label className={lbl}>Niveau demandé <span className="text-rose-500">*</span></label>
                    <select value={form.niveau} onChange={e => set({ niveau: e.target.value })}
                      className={inp + ' appearance-none'}>
                      {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Services souhaités</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'cantine',     label: 'Cantine scolaire',  desc: 'Repas du midi inclus' },
                        { key: 'transportBus',label: 'Bus scolaire',       desc: 'Transport aller-retour' },
                        // Garderie : réservée à la maternelle (crèche, PS, MS, GS)
                        ...(isMaternelle ? [{ key: 'garderie', label: 'Garderie', desc: 'Accueil en dehors des heures de classe' }] : []),
                      ].map(({ key, label, desc }) => {
                        const active = (form as any)[key] as boolean;
                        return (
                          <button key={key} type="button"
                            onClick={() => set({ [key]: !active } as any)}
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
                    <input type="text" value={form.besoinSpecifique}
                      onChange={e => set({ besoinSpecifique: e.target.value })} className={inp}
                      placeholder="Allergie, retard de développement, handisport…" />
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ÉTAPE 3 — Santé
            ════════════════════════════════════════════════════════════ */}
            {step === 3 && (
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
                        <input type="checkbox" checked={(form as any)[v.key]}
                          onChange={e => set({ [v.key]: e.target.checked } as any)}
                          className="w-5 h-5 accent-indigo-600 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-700 leading-tight">{v.label}</span>
                      </label>
                      {/* Date indentée dans un wrapper pl-8 pour éviter l'overflow sur mobile */}
                      {(form as any)[v.key] && (
                        <div className="pl-8">
                          <input type="date" value={(form as any)[v.dateKey]}
                            onChange={e => set({ [v.dateKey]: e.target.value } as any)}
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
                        <input type="checkbox" checked={(form as any)[v.key]}
                          onChange={e => set({ [v.key]: e.target.checked } as any)}
                          className="w-5 h-5 accent-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-700 leading-tight">{v.label}</span>
                      </label>
                      {(form as any)[v.key] && (
                        <div className="pl-8">
                          <input type="date" value={(form as any)[v.dateKey]}
                            onChange={e => set({ [v.dateKey]: e.target.value } as any)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      )}
                    </div>
                  ))}

                  <label className="flex items-center gap-3 cursor-pointer min-h-[44px] pt-1">
                    <input type="checkbox" checked={form.certifContrIndication}
                      onChange={e => set({ certifContrIndication: e.target.checked })}
                      className="w-5 h-5 accent-amber-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-amber-700 leading-tight">Certificat médical de contre-indication joint</span>
                  </label>
                </div>

                {/* Traitement médical */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Traitement médical</p>
                  <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                    <input type="checkbox" checked={form.traitementMedical}
                      onChange={e => set({ traitementMedical: e.target.checked })}
                      className="w-5 h-5 accent-rose-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-slate-700">L'enfant suit un traitement médical en cours</span>
                  </label>
                  {form.traitementMedical && (
                    <textarea value={form.traitementDetail} onChange={e => set({ traitementDetail: e.target.value })}
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
                        <input type="checkbox" checked={(form as any)[m.key]}
                          onChange={e => set({ [m.key]: e.target.checked } as any)}
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
                        className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-2xl border-2 transition-all min-h-[52px] ${(form as any)[a.key] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                        <input type="checkbox" checked={(form as any)[a.key]}
                          onChange={e => set({ [a.key]: e.target.checked } as any)}
                          className="w-5 h-5 accent-white flex-shrink-0" />
                        <span className="text-sm font-black">{a.label}</span>
                      </label>
                    ))}
                  </div>
                  <input type="text" value={form.allergieAutres} onChange={e => set({ allergieAutres: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20"
                    placeholder="Autres allergies (cause)…" />
                  <textarea value={form.allergieConduite} onChange={e => set({ allergieConduite: e.target.value })}
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
                    ].map(e => (
                      <label key={e.key}
                        className="flex items-center gap-2.5 cursor-pointer px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                        <input type="checkbox" checked={(form as any)[e.key]}
                          onChange={ev => set({ [e.key]: ev.target.checked } as any)}
                          className="w-5 h-5 accent-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-700 leading-tight">{e.label}</span>
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
                        <button key={opt.v} type="button" onClick={() => set({ mouillerLit: opt.v as any })}
                          className={`py-3 rounded-2xl text-xs font-black border-2 transition-all active:scale-95 ${form.mouillerLit === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Médecin traitant</label>
                      <input type="text" value={form.medecinNom} onChange={e => set({ medecinNom: e.target.value })} className={inp} placeholder="Nom du médecin" />
                    </div>
                    <div>
                      <label className={lbl}>Téléphone médecin</label>
                      <input type="tel" value={form.medecinTel} onChange={e => set({ medecinTel: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" />
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
                      <input type="checkbox" checked={(form as any)[key]}
                        onChange={e => set({ [key]: e.target.checked } as any)}
                        className="w-5 h-5 accent-indigo-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-bold text-slate-700 leading-relaxed">{text}</span>
                    </label>
                  ))}
                </div>

              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ÉTAPE 4 — Parents
            ════════════════════════════════════════════════════════════ */}
            {step === 4 && (
              <div className="space-y-4">

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Phone size={13} className="text-indigo-600" /> Parent / tuteur légal principal
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Prénom</label>
                      <input type="text" value={form.parent1Prenom} onChange={e => set({ parent1Prenom: e.target.value })} className={inp} autoComplete="given-name" /></div>
                    <div><label className={lbl}>Nom</label>
                      <input type="text" value={form.parent1Nom} onChange={e => set({ parent1Nom: e.target.value })} className={inp} autoComplete="family-name" /></div>
                    <div><label className={lbl}>Lien avec l'enfant</label>
                      <select value={form.parent1Lien} onChange={e => set({ parent1Lien: e.target.value as any })} className={inp + ' appearance-none'}>
                        <option value="MERE">Mère</option><option value="PERE">Père</option><option value="TUTEUR">Tuteur légal</option>
                      </select></div>
                    <div><label className={lbl}>Téléphone <span className="text-rose-500">*</span></label>
                      <input type="tel" value={form.parent1Tel}
                        onChange={e => set({ parent1Tel: e.target.value, parent1Whatsapp: e.target.value })}
                        className={inp} placeholder="+221 77 xxx xxxx" autoComplete="tel" /></div>
                    <div><label className={lbl}>WhatsApp</label>
                      <input type="tel" value={form.parent1Whatsapp} onChange={e => set({ parent1Whatsapp: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Email</label>
                      <input type="email" value={form.parent1Email} onChange={e => set({ parent1Email: e.target.value })} className={inp} autoComplete="email" /></div>
                    <div><label className={lbl}>Tél. domicile</label>
                      <input type="tel" value={form.parent1TelDomicile} onChange={e => set({ parent1TelDomicile: e.target.value })} className={inp} placeholder="+221 33 xxx xxxx" /></div>
                    <div><label className={lbl}>Tél. travail</label>
                      <input type="tel" value={form.parent1TelTravail} onChange={e => set({ parent1TelTravail: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Profession</label>
                      <input type="text" value={form.parent1Profession} onChange={e => set({ parent1Profession: e.target.value })} className={inp} placeholder="Enseignante, commerçant…" /></div>
                    <div><label className={lbl}>Nom de l'entreprise</label>
                      <input type="text" value={form.parent1Entreprise} onChange={e => set({ parent1Entreprise: e.target.value })} className={inp} placeholder="Employeur / société" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Adresse</label>
                      <input type="text" value={form.parent1Adresse} onChange={e => set({ parent1Adresse: e.target.value })} className={inp} placeholder="Rue, quartier, ville…" autoComplete="street-address" /></div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-slate-500 text-xs uppercase tracking-widest">Second parent (facultatif)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Prénom</label>
                      <input type="text" value={form.parent2Prenom} onChange={e => set({ parent2Prenom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Nom</label>
                      <input type="text" value={form.parent2Nom} onChange={e => set({ parent2Nom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Lien</label>
                      <select value={form.parent2Lien} onChange={e => set({ parent2Lien: e.target.value as any })} className={inp + ' appearance-none'}>
                        <option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur légal</option>
                      </select></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={form.parent2Tel} onChange={e => set({ parent2Tel: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Profession</label>
                      <input type="text" value={form.parent2Profession} onChange={e => set({ parent2Profession: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Nom de l'entreprise</label>
                      <input type="text" value={form.parent2Entreprise} onChange={e => set({ parent2Entreprise: e.target.value })} className={inp} /></div>
                  </div>
                </div>

                {/* Personne autorisée à venir chercher l'enfant */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-emerald-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={13} /> Personne autorisée à venir chercher l'enfant
                  </p>
                  <p className="text-xs text-slate-400 -mt-2">En dehors des parents, qui peut récupérer l'enfant à la sortie ?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Nom complet</label>
                      <input type="text" value={form.recupNom} onChange={e => set({ recupNom: e.target.value })} className={inp} placeholder="Prénom et nom" /></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={form.recupTel} onChange={e => set({ recupTel: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Lien avec l'enfant</label>
                      <input type="text" value={form.recupLien} onChange={e => set({ recupLien: e.target.value })} className={inp} placeholder="Grand-frère, nounou, chauffeur…" /></div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <p className="font-black text-rose-600 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Shield size={13} /> Contact d'urgence
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Nom complet</label>
                      <input type="text" value={form.urgenceNom} onChange={e => set({ urgenceNom: e.target.value })} className={inp} /></div>
                    <div><label className={lbl}>Téléphone</label>
                      <input type="tel" value={form.urgenceTel} onChange={e => set({ urgenceTel: e.target.value })} className={inp} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Lien avec l'enfant</label>
                      <input type="text" value={form.urgenceLien} onChange={e => set({ urgenceLien: e.target.value })} className={inp} placeholder="Grand-mère, Oncle, Tante…" /></div>
                  </div>
                </div>

              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ÉTAPE 5 — Récapitulatif
            ════════════════════════════════════════════════════════════ */}
            {step === 5 && (
              <div className="space-y-4">

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    {form.photoUrl && (
                      <img src={form.photoUrl} alt="Photo"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-100 flex-shrink-0" />
                    )}
                    <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Enfant</p>
                  </div>
                  {[
                    { label: 'Nom complet', value: `${form.prenomEnfant} ${form.nomEnfant}` },
                    form.dateNaissance ? { label: 'Naissance', value: `${new Date(form.dateNaissance).toLocaleDateString('fr-FR')}${form.lieuNaissance ? ` — ${form.lieuNaissance}` : ''}` } : null,
                    form.sexe ? { label: 'Sexe', value: form.sexe === 'M' ? 'Garçon' : 'Fille' } : null,
                    { label: 'Niveau', value: niveauLabel(form.niveau) },
                  ].filter(Boolean).map((row, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 font-bold flex-shrink-0">{row!.label}</span>
                      <span className="font-black text-slate-800 text-right">{row!.value}</span>
                    </div>
                  ))}
                  {(form.cantine || form.transportBus || (isMaternelle && form.garderie)) && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {form.cantine && <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black border border-emerald-200">Cantine</span>}
                      {form.transportBus && <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-black border border-amber-200">Bus scolaire</span>}
                      {isMaternelle && form.garderie && <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black border border-indigo-200">Garderie</span>}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-3">
                  <p className="font-black text-slate-700 text-xs uppercase tracking-widest">Parent</p>
                  {[
                    { label: 'Identité', value: `${form.parent1Prenom} ${form.parent1Nom} (${form.parent1Lien === 'MERE' ? 'Mère' : form.parent1Lien === 'PERE' ? 'Père' : 'Tuteur'})` },
                    form.parent1Tel ? { label: 'Téléphone', value: form.parent1Tel } : null,
                    form.parent1Email ? { label: 'Email', value: form.parent1Email } : null,
                  ].filter(Boolean).map((row, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 font-bold flex-shrink-0">{row!.label}</span>
                      <span className="font-black text-slate-800 text-right">{row!.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-4 space-y-2">
                  <p className="font-black text-rose-600 text-xs uppercase tracking-widest flex items-center gap-2"><Stethoscope size={12} /> Santé</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[{ k: 'vaccDiphterie', l: 'Diph.' }, { k: 'vaccPolio', l: 'Polio' }, { k: 'vaccCoqueluche', l: 'Coq.' },
                      { k: 'vaccBCG', l: 'BCG' }, { k: 'vaccHepB', l: 'HepB' }, { k: 'vaccROR', l: 'ROR' }].map(v => (
                      <span key={v.k} className={`px-2.5 py-1 rounded-lg text-xs font-black ${(form as any)[v.k] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>{v.l}</span>
                    ))}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <span className={`text-xs font-black ${form.autorisationSoins ? 'text-emerald-700' : 'text-rose-600'}`}>{form.autorisationSoins ? '✓' : '✗'} Soins urgents</span>
                    <span className={`text-xs font-black ${form.autorisationPhoto ? 'text-emerald-700' : 'text-rose-600'}`}>{form.autorisationPhoto ? '✓' : '✗'} Photos</span>
                  </div>
                </div>

                {/* Pièces justificatives — à joindre directement au dossier */}
                <PiecesJointes niveau={form.niveau} value={pieces} onChange={setPieces}
                  title="Pièces justificatives — joignez vos documents" />

                <div>
                  <label className={lbl}>Message pour l'école (facultatif)</label>
                  <textarea value={form.notes} onChange={e => set({ notes: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px]"
                    placeholder="Remarques, questions, informations complémentaires…" />
                </div>

              </div>
            )}

            {/* Espace sous le dernier élément pour ne pas être caché par la barre de navigation */}
            <div className="h-2" />

          </div>
        </div>

        {/* ── Barre de navigation sticky en bas ──────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3 safe-bottom">
          {/* Retour / Annuler */}
          {step > 1 ? (
            <button type="button" onClick={() => { setStep(s => s - 1); setError(null); window.scrollTo({ top: 0 }); }}
              className="flex items-center gap-2 px-5 sm:px-6 py-3.5 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm active:bg-slate-100 transition-all">
              <ChevronLeft size={18} /> <span className="hidden xs:inline">Retour</span>
            </button>
          ) : onBack ? (
            <button type="button" onClick={onBack}
              className="px-5 sm:px-6 py-3.5 border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-sm active:bg-slate-100 transition-all">
              Annuler
            </button>
          ) : <div />}

          {/* Suivant / Soumettre */}
          {step < 5 ? (
            <button type="button" onClick={handleNext}
              className="flex items-center gap-2 px-7 sm:px-8 py-3.5 bg-indigo-600 active:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-200">
              Suivant <ArrowRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              disabled={loading || !form.prenomEnfant || !form.nomEnfant}
              className="flex items-center gap-2 px-6 sm:px-8 py-3.5 bg-amber-500 active:bg-amber-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-200 disabled:opacity-50">
              {loading
                ? <><Loader2 className="animate-spin" size={16} /> Envoi…</>
                : <><Save size={16} /> Soumettre le dossier</>}
            </button>
          )}
        </div>

      </main>
    </div>
  );
};

export default PublicAdmission;
