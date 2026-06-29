import React, { useEffect, useState } from 'react';
import {
  Baby, GraduationCap, Stethoscope, Phone, CheckCircle2,
  ChevronLeft, ArrowRight, Loader2, AlertCircle, Save,
  Shield, Camera, School,
} from 'lucide-react';
import { apiClient } from '../services/api';

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
  { n: 1, label: 'Identité de l\'enfant',        sub: 'État civil et informations de base',        icon: Baby },
  { n: 2, label: 'Scolarité & options',           sub: 'Niveau souhaité, cantine, transport',       icon: GraduationCap },
  { n: 3, label: 'Fiche sanitaire',              sub: 'Vaccins, allergies, autorisations',          icon: Stethoscope },
  { n: 4, label: 'Coordonnées des parents',       sub: 'Parent principal, second parent, urgence',  icon: Phone },
  { n: 5, label: 'Récapitulatif & validation',   sub: 'Relisez et soumettez votre dossier',        icon: CheckCircle2 },
];

// ─── Formulaire vide ──────────────────────────────────────────────────────────

const EMPTY = {
  nomEnfant: '', prenomEnfant: '', dateNaissance: '', lieuNaissance: '',
  sexe: '' as '' | 'M' | 'F',
  niveau: 'PS', cantine: false, transportBus: false, besoinSpecifique: '',
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
  parent2Nom: '', parent2Prenom: '', parent2Lien: 'PERE' as 'PERE' | 'MERE' | 'TUTEUR',
  parent2Tel: '', parent2TelDomicile: '', parent2TelTravail: '',
  urgenceNom: '', urgenceTel: '', urgenceLien: '',
  notes: '',
};

type FormType = typeof EMPTY;

// Identique à ParentAdmission
const inp = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition';
const lbl = 'text-[10px] font-black text-slate-500 uppercase tracking-wider px-1 mb-1.5 block';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ecole { name?: string; logoUrl?: string }
interface Props  { onBack?: () => void }

// ─── Composant ────────────────────────────────────────────────────────────────

const PublicAdmission: React.FC<Props> = ({ onBack }) => {
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<FormType>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<{ reference: string; message: string } | null>(null);
  const [ecole, setEcole]     = useState<Ecole>({});

  const set = (patch: Partial<FormType>) => setForm(f => ({ ...f, ...patch }));
  const niveauLabel = (v: string) => NIVEAUX.find(n => n.value === v)?.label ?? v;

  useEffect(() => {
    apiClient.get('/public/ecole')
      .then((d: any) => setEcole(d || {}))
      .catch(() => {});
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
        cantine: form.cantine, transportBus: form.transportBus,
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
        },
        parent2: (form.parent2Nom || form.parent2Tel) ? {
          nom: form.parent2Nom, prenom: form.parent2Prenom,
          telephone: form.parent2Tel, lien: form.parent2Lien,
          telDomicile: form.parent2TelDomicile, telTravail: form.parent2TelTravail,
        } : null,
        contactUrgence: form.urgenceNom ? {
          nom: form.urgenceNom, telephone: form.urgenceTel, lien: form.urgenceLien,
        } : null,
        notes: form.notes || null,
      };
      const res: any = await apiClient.post('/public/admission', payload);
      setResult({ reference: res.reference, message: res.message });
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la soumission. Veuillez réessayer.');
    } finally { setLoading(false); }
  };

  // ── Écran de succès ──────────────────────────────────────────────────────────

  if (result) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 text-center">
        {ecole.logoUrl && (
          <img src={ecole.logoUrl} alt="Logo"
            className="h-16 w-16 rounded-2xl object-contain mx-auto mb-6 border border-slate-100 shadow-sm p-1" />
        )}
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Dossier transmis !</h2>
        <p className="text-slate-400 mb-6">{ecole.name || "L'école"} a bien reçu votre demande.</p>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-8 py-5 mb-6">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Numéro de dossier</p>
          <p className="text-3xl font-black text-indigo-700 tracking-widest">{result.reference}</p>
          <p className="text-xs text-slate-400 mt-2">Conservez ce numéro — il vous sera demandé lors de votre visite</p>
        </div>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">{result.message}</p>
        <button onClick={() => { setResult(null); setForm(EMPTY); setStep(1); }}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest transition mb-3">
          Soumettre un autre dossier
        </button>
        {onBack && (
          <button onClick={onBack}
            className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition">
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );

  const currentStep = STEPS[step - 1];

  // ── Page principale ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 lg:flex">

      {/* ══════════════════════════════════════════════════════════════════════
          PANNEAU GAUCHE — Logo, identité de l'école, progression
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="lg:w-80 xl:w-96 lg:min-h-screen lg:sticky lg:top-0 lg:h-screen flex flex-col p-8 border-r border-white/5">

        {/* Logo + nom école */}
        <div className="flex flex-col items-center text-center mb-10">
          {ecole.logoUrl ? (
            <div className="w-28 h-28 rounded-3xl bg-white shadow-2xl shadow-black/30 flex items-center justify-center mb-5 p-2">
              <img src={ecole.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-5">
              <School className="w-14 h-14 text-white/40" />
            </div>
          )}
          <h1 className="text-white font-black text-xl leading-tight mb-1">
            {ecole.name || 'École'}
          </h1>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
            Formulaire de préinscription
          </p>
        </div>

        {/* Étapes — version verticale sidebar */}
        <nav className="space-y-2 flex-1">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done   = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                  active ? 'bg-indigo-500/20 border border-indigo-400/30' :
                  done   ? 'opacity-70' : 'opacity-30'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' :
                  done   ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'
                }`}>
                  {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black leading-tight ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {s.label}
                  </p>
                  {active && (
                    <p className="text-indigo-300 text-xs mt-0.5">{s.sub}</p>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Barre de progression */}
        <div className="mt-8">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-2">
            <span>Progression</span>
            <span className="text-indigo-300">{Math.round(((step - 1) / (STEPS.length - 1)) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          {onBack && (
            <button onClick={onBack}
              className="mt-6 w-full text-xs text-slate-500 hover:text-slate-300 font-bold transition flex items-center justify-center gap-2">
              ← Retour à la connexion
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          PANNEAU DROIT — Formulaire
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-h-screen bg-slate-50">

        {/* Header mobile uniquement */}
        <div className="lg:hidden bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex items-center gap-4">
          {ecole.logoUrl ? (
            <img src={ecole.logoUrl} alt="Logo"
              className="h-12 w-12 rounded-2xl object-contain bg-white p-1 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <School className="w-6 h-6 text-white/60" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-black text-base truncate">{ecole.name || 'Préinscription'}</p>
            <p className="text-indigo-300 text-xs font-bold">Étape {step} / {STEPS.length} — {currentStep.label}</p>
          </div>
        </div>

        {/* Titre de section (desktop) */}
        <div className="hidden lg:block px-10 pt-10 pb-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center">
              <currentStep.icon className="text-white" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{currentStep.label}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{currentStep.sub}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-black text-indigo-600">{step}</p>
              <p className="text-xs text-slate-400 font-bold">sur {STEPS.length}</p>
            </div>
          </div>
        </div>

        {/* Contenu formulaire scrollable */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 space-y-6">

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold flex items-center gap-3">
              <AlertCircle size={18} className="flex-shrink-0" /> {error}
            </div>
          )}

          {/* ══ ÉTAPE 1 — Identité ═══════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={lbl}>Prénom <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.prenomEnfant}
                    onChange={e => set({ prenomEnfant: e.target.value })} className={inp} placeholder="Prénom de l'enfant" />
                </div>
                <div>
                  <label className={lbl}>Nom <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.nomEnfant}
                    onChange={e => set({ nomEnfant: e.target.value })} className={inp} placeholder="Nom de famille" />
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
                <div className="flex gap-4">
                  {[{ v: 'M', l: '👦  Garçon' }, { v: 'F', l: '👧  Fille' }].map(s => (
                    <button key={s.v} type="button" onClick={() => set({ sexe: s.v as 'M' | 'F' })}
                      className={`flex-1 py-4 rounded-2xl text-sm font-black border-2 transition-all ${form.sexe === s.v ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 2 — Scolarité ══════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className={lbl}>Niveau demandé <span className="text-rose-500">*</span></label>
                <select value={form.niveau} onChange={e => set({ niveau: e.target.value })}
                  className={inp + ' appearance-none text-base py-4'}>
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Services souhaités</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {[
                    { key: 'cantine',     label: 'Cantine scolaire',  desc: 'Repas du midi inclus' },
                    { key: 'transportBus',label: 'Bus scolaire',       desc: 'Transport aller-retour' },
                  ].map(({ key, label, desc }) => {
                    const active = (form as any)[key] as boolean;
                    return (
                      <button key={key} type="button"
                        onClick={() => set({ [key]: !active } as any)}
                        className={`flex-1 flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all ${active ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                          {active && <div className="w-2 h-2 bg-white rounded-full" />}
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
                  placeholder="Allergie alimentaire, retard de développement, handisport…" />
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 3 — Santé ══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Vaccins obligatoires</p>
                {[
                  { key: 'vaccDiphterie',  dateKey: 'vaccDiphterieDate',  label: 'Diphtérie / Tétanos / Polio' },
                  { key: 'vaccPolio',      dateKey: 'vaccPolioDate',      label: 'Poliomyélite' },
                  { key: 'vaccCoqueluche', dateKey: 'vaccCoquelucheDate', label: 'Coqueluche' },
                  { key: 'vaccBCG',        dateKey: 'vaccBCGDate',        label: 'BCG' },
                ].map(v => (
                  <div key={v.key} className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-3 cursor-pointer min-w-[220px]">
                      <input type="checkbox" checked={(form as any)[v.key]}
                        onChange={e => set({ [v.key]: e.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-sm font-bold text-slate-700">{v.label}</span>
                    </label>
                    {(form as any)[v.key] && (
                      <input type="date" value={(form as any)[v.dateKey]}
                        onChange={e => set({ [v.dateKey]: e.target.value } as any)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    )}
                  </div>
                ))}
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest pt-2">Vaccins recommandés</p>
                {[
                  { key: 'vaccHepB', dateKey: 'vaccHepBDate', label: 'Hépatite B' },
                  { key: 'vaccROR',  dateKey: 'vaccRORDate',  label: 'ROR (Rubéole / Oreillons / Rougeole)' },
                ].map(v => (
                  <div key={v.key} className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-3 cursor-pointer min-w-[220px]">
                      <input type="checkbox" checked={(form as any)[v.key]}
                        onChange={e => set({ [v.key]: e.target.checked } as any)} className="w-4 h-4 accent-emerald-600" />
                      <span className="text-sm font-bold text-slate-700">{v.label}</span>
                    </label>
                    {(form as any)[v.key] && (
                      <input type="date" value={(form as any)[v.dateKey]}
                        onChange={e => set({ [v.dateKey]: e.target.value } as any)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    )}
                  </div>
                ))}
                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.certifContrIndication}
                    onChange={e => set({ certifContrIndication: e.target.checked })} className="w-4 h-4 accent-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Certificat médical de contre-indication joint</span>
                </label>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Traitement médical</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.traitementMedical}
                    onChange={e => set({ traitementMedical: e.target.checked })} className="w-4 h-4 accent-rose-600" />
                  <span className="text-sm font-bold text-slate-700">L'enfant suit un traitement médical en cours</span>
                </label>
                {form.traitementMedical && (
                  <textarea value={form.traitementDetail} onChange={e => set({ traitementDetail: e.target.value })}
                    className="w-full bg-slate-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 min-h-[80px]"
                    placeholder="Préciser le traitement, joindre ordonnance récente…" />
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Maladies antérieures</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'maladieRubeole', label: 'Rubéole' }, { key: 'maladieVaricelle', label: 'Varicelle' },
                    { key: 'maladieAngine', label: 'Angine' }, { key: 'maladieRhumatisme', label: 'Rhumatisme art.' },
                    { key: 'maladieScarlatine', label: 'Scarlatine' }, { key: 'maladieCoqueluche', label: 'Coqueluche' },
                    { key: 'maladieOtite', label: 'Otite' }, { key: 'maladieRougeole', label: 'Rougeole' },
                    { key: 'maladieOreillons', label: 'Oreillons' },
                  ].map(m => (
                    <label key={m.key} className="flex items-center gap-2 cursor-pointer px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all">
                      <input type="checkbox" checked={(form as any)[m.key]}
                        onChange={e => set({ [m.key]: e.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-4">
                <p className="font-black text-rose-700 text-sm uppercase tracking-widest">Allergies</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'allergieAsthme', label: 'Asthme' },
                    { key: 'allergieMedicament', label: 'Médicamenteuses' },
                    { key: 'allergieAlimentaire', label: 'Alimentaires' },
                  ].map(a => (
                    <label key={a.key} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${(form as any)[a.key] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300 hover:border-rose-400'}`}>
                      <input type="checkbox" checked={(form as any)[a.key]}
                        onChange={e => set({ [a.key]: e.target.checked } as any)} className="w-4 h-4 accent-white" />
                      <span className="text-sm font-black">{a.label}</span>
                    </label>
                  ))}
                </div>
                <input type="text" value={form.allergieAutres} onChange={e => set({ allergieAutres: e.target.value })}
                  className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder="Autres allergies (cause)…" />
                <textarea value={form.allergieConduite} onChange={e => set({ allergieConduite: e.target.value })}
                  className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20 min-h-[60px]"
                  placeholder="Conduite à tenir en cas de crise…" />
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Équipements portés</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'equipeLunettes', label: 'Lunettes' }, { key: 'equipeLentilles', label: 'Lentilles' },
                    { key: 'equipeProtheseAuditive', label: 'Prothèse auditive' }, { key: 'equipeProtheseDentaire', label: 'Prothèse dentaire' },
                  ].map(e => (
                    <label key={e.key} className="flex items-center gap-2 cursor-pointer px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all">
                      <input type="checkbox" checked={(form as any)[e.key]}
                        onChange={ev => set({ [e.key]: ev.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Nuits — pipi au lit</p>
                <div className="flex gap-3 flex-wrap">
                  {[{ v: 'OUI', l: 'Oui' }, { v: 'NON', l: 'Non' }, { v: 'OCCASIONNELLEMENT', l: 'Occasionnellement' }].map(opt => (
                    <button key={opt.v} type="button" onClick={() => set({ mouillerLit: opt.v as any })}
                      className={`px-5 py-3 rounded-2xl text-sm font-black border-2 transition-all ${form.mouillerLit === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
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

              <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6 space-y-4">
                <p className="font-black text-indigo-700 text-sm uppercase tracking-widest flex items-center gap-2">
                  <Camera size={15} /> Autorisations parentales
                </p>
                <label className="flex items-start gap-4 cursor-pointer">
                  <input type="checkbox" checked={form.autorisationSoins}
                    onChange={e => set({ autorisationSoins: e.target.checked })} className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-bold text-slate-700 leading-relaxed">J'autorise le responsable de l'établissement à prendre toutes mesures nécessaires (traitement médical, hospitalisation) en cas d'urgence.</span>
                </label>
                <label className="flex items-start gap-4 cursor-pointer">
                  <input type="checkbox" checked={form.autorisationPhoto}
                    onChange={e => set({ autorisationPhoto: e.target.checked })} className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-bold text-slate-700 leading-relaxed">J'autorise la prise de photographies / vidéos de mon enfant dans le cadre des activités de l'établissement.</span>
                </label>
              </div>

            </div>
          )}

          {/* ══ ÉTAPE 4 — Parents ════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6">

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
                  <Phone size={15} className="text-indigo-600" /> Parent / tuteur légal principal
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className={lbl}>Prénom</label>
                    <input type="text" value={form.parent1Prenom} onChange={e => set({ parent1Prenom: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Nom</label>
                    <input type="text" value={form.parent1Nom} onChange={e => set({ parent1Nom: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Lien avec l'enfant</label>
                    <select value={form.parent1Lien} onChange={e => set({ parent1Lien: e.target.value as any })} className={inp + ' appearance-none'}>
                      <option value="MERE">Mère</option><option value="PERE">Père</option><option value="TUTEUR">Tuteur légal</option>
                    </select></div>
                  <div><label className={lbl}>Téléphone <span className="text-rose-500">*</span></label>
                    <input type="tel" value={form.parent1Tel}
                      onChange={e => set({ parent1Tel: e.target.value, parent1Whatsapp: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" /></div>
                  <div><label className={lbl}>WhatsApp</label>
                    <input type="tel" value={form.parent1Whatsapp} onChange={e => set({ parent1Whatsapp: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Email</label>
                    <input type="email" value={form.parent1Email} onChange={e => set({ parent1Email: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Tél. domicile</label>
                    <input type="tel" value={form.parent1TelDomicile} onChange={e => set({ parent1TelDomicile: e.target.value })} className={inp} placeholder="+221 33 xxx xxxx" /></div>
                  <div><label className={lbl}>Tél. travail</label>
                    <input type="tel" value={form.parent1TelTravail} onChange={e => set({ parent1TelTravail: e.target.value })} className={inp} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Adresse</label>
                    <input type="text" value={form.parent1Adresse} onChange={e => set({ parent1Adresse: e.target.value })} className={inp} placeholder="Rue, quartier, ville…" /></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                <p className="font-black text-slate-500 text-sm uppercase tracking-widest">Second parent (facultatif)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                <p className="font-black text-rose-600 text-sm uppercase tracking-widest flex items-center gap-2">
                  <Shield size={15} /> Contact d'urgence (autre que parents)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className={lbl}>Nom complet</label>
                    <input type="text" value={form.urgenceNom} onChange={e => set({ urgenceNom: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Téléphone</label>
                    <input type="tel" value={form.urgenceTel} onChange={e => set({ urgenceTel: e.target.value })} className={inp} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Lien avec l'enfant</label>
                    <input type="text" value={form.urgenceLien} onChange={e => set({ urgenceLien: e.target.value })} className={inp} placeholder="Ex: Grand-mère, Oncle, Tante…" /></div>
                </div>
              </div>

            </div>
          )}

          {/* ══ ÉTAPE 5 — Récapitulatif ══════════════════════════════════════ */}
          {step === 5 && (
            <div className="space-y-5">

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Enfant</p>
                {[
                  { label: 'Nom complet', value: `${form.prenomEnfant} ${form.nomEnfant}` },
                  form.dateNaissance ? { label: 'Naissance', value: `${new Date(form.dateNaissance).toLocaleDateString('fr-FR')}${form.lieuNaissance ? ` — ${form.lieuNaissance}` : ''}` } : null,
                  form.sexe ? { label: 'Sexe', value: form.sexe === 'M' ? 'Garçon' : 'Fille' } : null,
                  { label: 'Niveau', value: niveauLabel(form.niveau) },
                ].filter(Boolean).map((row, i) => (
                  <div key={i} className="flex justify-between gap-4 text-sm py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-400 font-bold">{row!.label}</span>
                    <span className="font-black text-slate-800 text-right">{row!.value}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  {form.cantine && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black border border-emerald-200">Cantine</span>}
                  {form.transportBus && <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-xl text-xs font-black border border-amber-200">Bus scolaire</span>}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <p className="font-black text-slate-700 text-sm uppercase tracking-widest">Parent</p>
                {[
                  { label: 'Identité', value: `${form.parent1Prenom} ${form.parent1Nom} (${form.parent1Lien === 'MERE' ? 'Mère' : form.parent1Lien === 'PERE' ? 'Père' : 'Tuteur'})` },
                  form.parent1Tel ? { label: 'Téléphone', value: form.parent1Tel } : null,
                  form.parent1Email ? { label: 'Email', value: form.parent1Email } : null,
                ].filter(Boolean).map((row, i) => (
                  <div key={i} className="flex justify-between gap-4 text-sm py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-400 font-bold">{row!.label}</span>
                    <span className="font-black text-slate-800 text-right">{row!.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 space-y-3">
                <p className="font-black text-rose-600 text-xs uppercase tracking-widest flex items-center gap-2"><Stethoscope size={13} /> Santé</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[{ k: 'vaccDiphterie', l: 'Diph.' }, { k: 'vaccPolio', l: 'Polio' }, { k: 'vaccCoqueluche', l: 'Coq.' },
                    { k: 'vaccBCG', l: 'BCG' }, { k: 'vaccHepB', l: 'HepB' }, { k: 'vaccROR', l: 'ROR' }].map(v => (
                    <span key={v.k} className={`px-2 py-1 rounded-lg text-xs font-black ${(form as any)[v.k] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>{v.l}</span>
                  ))}
                </div>
                <div className="flex gap-4">
                  <span className={`text-xs font-black ${form.autorisationSoins ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {form.autorisationSoins ? '✓' : '✗'} Autorisation soins
                  </span>
                  <span className={`text-xs font-black ${form.autorisationPhoto ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {form.autorisationPhoto ? '✓' : '✗'} Autorisation photo
                  </span>
                </div>
              </div>

              <div>
                <label className={lbl}>Message pour l'école (facultatif)</label>
                <textarea value={form.notes} onChange={e => set({ notes: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px]"
                  placeholder="Remarques, questions, informations complémentaires…" />
              </div>

            </div>
          )}

        </div>

        {/* ── Navigation — boutons de taille naturelle, pas étirés ── */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 lg:px-10 py-5 flex items-center justify-between gap-4">
          {/* Gauche : Retour / Annuler */}
          <div>
            {step > 1 ? (
              <button type="button" onClick={() => { setStep(s => s - 1); setError(null); }}
                className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all">
                <ChevronLeft size={16} /> Retour
              </button>
            ) : onBack ? (
              <button type="button" onClick={onBack}
                className="px-6 py-3 border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all">
                Annuler
              </button>
            ) : <div />}
          </div>

          {/* Droite : Suivant / Soumettre */}
          <div>
            {step < 5 ? (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-200">
                Suivant <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit}
                disabled={loading || !form.prenomEnfant || !form.nomEnfant}
                className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-200 disabled:opacity-50">
                {loading
                  ? <><Loader2 className="animate-spin" size={16} /> Envoi en cours…</>
                  : <><Save size={16} /> Soumettre le dossier</>}
              </button>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default PublicAdmission;
