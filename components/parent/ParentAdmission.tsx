import React, { useCallback, useEffect, useState } from 'react';
import {
  Baby, GraduationCap, Stethoscope, Phone, CheckCircle2,
  ChevronLeft, ArrowRight, Loader2, AlertCircle, Save,
  Shield, Camera, X, Plus, Clock, UserCheck, Ban,
  RefreshCw, FileText,
} from 'lucide-react';
import { apiClient } from '../../services/api';

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

const STATUTS: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  EN_ATTENTE: { label: 'En attente',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  ADMIS:      { label: 'Admis',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
  INSCRIT:    { label: 'Inscrit',     color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: UserCheck },
  ACTIF:      { label: 'Actif',       color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: UserCheck },
  REJETE:     { label: 'Refusé',      color: 'bg-rose-100 text-rose-700 border-rose-200',      icon: Ban },
  RADIE:      { label: 'Radié',       color: 'bg-gray-100 text-gray-500 border-gray-200',      icon: Ban },
};

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section',
  GS: 'Grande Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

// ─── Formulaire vide ──────────────────────────────────────────────────────────

const EMPTY = {
  nomEnfant: '', prenomEnfant: '', dateNaissance: '', lieuNaissance: '',
  sexe: '' as '' | 'M' | 'F', dateDepot: new Date().toISOString().split('T')[0],
  niveau: 'PS', regimeFinancier: 'NORMAL', remisePct: 0,
  cantine: false, transportBus: false, besoinSpecifique: '',
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

const STEPS = [
  { n: 1, label: 'Identité',   icon: Baby },
  { n: 2, label: 'Scolarité',  icon: GraduationCap },
  { n: 3, label: 'Santé',      icon: Stethoscope },
  { n: 4, label: 'Parents',    icon: Phone },
  { n: 5, label: 'Validation', icon: CheckCircle2 },
];

const inp = 'w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10';

interface Props { onSuccess?: () => void; }

// ─── Composant principal ──────────────────────────────────────────────────────

const ParentAdmission: React.FC<Props> = ({ onSuccess }) => {
  const [dossiers, setDossiers]   = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [rejeteId, setRejeteId]   = useState<string | null>(null);
  const [form, setForm]           = useState<FormType>(EMPTY);
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const set = (patch: Partial<FormType>) => setForm(f => ({ ...f, ...patch }));
  const niveauLabel = (v: string) => NIVEAUX.find(n => n.value === v)?.label ?? v;

  const parseMotifRejet = (notes: string | null): { date: string; motif: string } | null => {
    if (!notes) return null;
    const m = notes.match(/\[REJET ([^\]]+)\] ([\s\S]+?)(?=\n\[|$)/);
    return m ? { date: m[1], motif: m[2].trim() } : null;
  };

  // ── Chargement de la liste ──
  const fetchDossiers = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await apiClient.get('/parent/mes-admissions');
      setDossiers(Array.isArray(data) ? data : []);
    } catch { setDossiers([]); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { fetchDossiers(); }, [fetchDossiers]);

  // ── Ouverture modal + pré-remplissage parent ──
  const openModal = () => {
    setForm(EMPTY); setRejeteId(null); setStep(1); setError(null); setShowModal(true);
    apiClient.get('/parent/me').then((data: any) => {
      const p1 = data.parent1 || {};
      set({
        parent1Prenom:      data.prenom     || p1.prenom     || '',
        parent1Nom:         data.nom        || p1.nom        || '',
        parent1Email:       data.email      || p1.email      || '',
        parent1Tel:         p1.telephone    || '',
        parent1Whatsapp:    p1.whatsapp     || '',
        parent1Adresse:     p1.adresse      || '',
        parent1TelDomicile: p1.telDomicile  || '',
        parent1TelTravail:  p1.telTravail   || '',
        parent1Lien:        (p1.lien as any) || 'MERE',
      });
    }).catch(() => {});
  };

  const closeModal = () => { setShowModal(false); setRejeteId(null); setError(null); };

  // ── Ouvrir le modal pré-rempli depuis un dossier rejeté ──
  const openModalFromRejected = (dossier: any) => {
    setForm({
      ...EMPTY,
      nomEnfant:    dossier.nom    || '',
      prenomEnfant: dossier.prenom || '',
      dateNaissance: dossier.dateNaissance || '',
      sexe:         dossier.sexe   || '',
      niveau:       dossier.niveau || 'PS',
      cantine:      !!dossier.cantine,
      transportBus: !!dossier.transportBus,
    });
    setRejeteId(dossier.id);
    setStep(1); setError(null); setShowModal(true);
    // Pré-remplir les infos parent
    apiClient.get('/parent/me').then((data: any) => {
      const p1 = data.parent1 || {};
      set({
        parent1Prenom:      data.prenom     || p1.prenom     || '',
        parent1Nom:         data.nom        || p1.nom        || '',
        parent1Email:       data.email      || p1.email      || '',
        parent1Tel:         p1.telephone    || '',
        parent1Whatsapp:    p1.whatsapp     || '',
        parent1Adresse:     p1.adresse      || '',
        parent1TelDomicile: p1.telDomicile  || '',
        parent1TelTravail:  p1.telTravail   || '',
        parent1Lien:        (p1.lien as any) || 'MERE',
      });
    }).catch(() => {});
  };

  // ── Navigation ──
  const handleNext = () => {
    setError(null);
    if (step === 1 && (!form.prenomEnfant || !form.nomEnfant)) {
      setError("Prénom et nom de l'enfant sont obligatoires."); return;
    }
    if (step === 4 && !form.parent1Tel) {
      setError('Le téléphone du parent est obligatoire.'); return;
    }
    setStep(s => s + 1);
  };

  // ── Soumission ──
  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const payload = {
        nom: form.nomEnfant, prenom: form.prenomEnfant,
        dateNaissance: form.dateNaissance, lieuNaissance: form.lieuNaissance,
        sexe: form.sexe, niveau: form.niveau,
        regimeFinancier: form.regimeFinancier, remisePct: form.remisePct,
        cantine: form.cantine, transportBus: form.transportBus,
        besoinSpecifique: form.besoinSpecifique,
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
          mouillerLit: form.mouillerLit,
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
        notes: form.notes,
      };
      if (rejeteId) {
        await apiClient.put(`/parent/admission/${rejeteId}`, payload);
      } else {
        await apiClient.post('/parent/admission', payload);
      }
      closeModal();
      fetchDossiers();
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la soumission. Veuillez réessayer.');
    } finally { setLoading(false); }
  };

  // ── Render liste ──────────────────────────────────────────────────────────────

  const StatutBadge = ({ statut }: { statut: string }) => {
    const s = STATUTS[statut] || STATUTS.EN_ATTENTE;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${s.color}`}>
        <Icon className="w-3 h-3" /> {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Inscriptions</h2>
          <p className="text-gray-500 mt-1 text-sm">Suivez vos demandes et soumettez un nouveau dossier.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDossiers} disabled={loadingList}
            className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-2.5 rounded-2xl text-sm transition shadow-lg shadow-indigo-200 hover:shadow-indigo-300">
            <Plus className="w-4 h-4" /> Nouveau dossier
          </button>
        </div>
      </div>

      {/* ── Liste des dossiers ── */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

        {/* Compteurs */}
        <div className="grid grid-cols-3 border-b border-gray-50">
          {[
            { label: 'Total',      count: dossiers.length,                                           color: 'text-gray-700' },
            { label: 'En attente', count: dossiers.filter(d => d.statut === 'EN_ATTENTE').length,    color: 'text-amber-600' },
            { label: 'Admis',      count: dossiers.filter(d => ['ADMIS','INSCRIT','ACTIF'].includes(d.statut)).length, color: 'text-emerald-600' },
          ].map(({ label, count, color }) => (
            <div key={label} className="py-4 text-center border-r border-gray-50 last:border-0">
              <p className={`text-2xl font-black ${color}`}>{count}</p>
              <p className="text-xs text-gray-400 font-bold mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Contenu */}
        {loadingList ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="text-gray-400 font-medium text-sm">Chargement…</span>
          </div>
        ) : dossiers.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-gray-500 text-sm">Aucun dossier soumis</p>
            <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
              Cliquez sur « Nouveau dossier » pour soumettre une demande d'inscription à l'école.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dossiers.map((d) => {
              const rejet = parseMotifRejet(d.notes);
              const estRejete = d.statut === 'REJETE';
              return (
                <div key={d.id} className={`flex flex-col gap-0 ${estRejete ? 'border-l-4 border-rose-400' : ''}`}>
                  {/* Ligne principale */}
                  <div className="px-6 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 ${
                      estRejete
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700'
                    }`}>
                      {(d.prenom?.[0] || '').toUpperCase()}{(d.nom?.[0] || '').toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{d.prenom} {d.nom}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {NIVEAUX_LABELS[d.niveau] || d.niveau}
                        {d.cantine && ' · Cantine'}
                        {d.transportBus && ' · Bus'}
                        {' · '}
                        Soumis le {new Date(d.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    {/* Statut */}
                    <StatutBadge statut={d.statut} />
                  </div>

                  {/* Bloc motif de rejet */}
                  {estRejete && rejet && (
                    <div className="mx-6 mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                          <Ban className="w-3 h-3" /> Motif du refus — {rejet.date}
                        </p>
                        <p className="text-sm text-rose-800 font-medium leading-relaxed">{rejet.motif}</p>
                      </div>
                      <button
                        onClick={() => openModalFromRejected(d)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-200">
                        <RefreshCw className="w-3.5 h-3.5" /> Corriger et resoumettre
                      </button>
                    </div>
                  )}

                  {/* Rejeté sans motif lisible */}
                  {estRejete && !rejet && (
                    <div className="mx-6 mb-4 flex items-center gap-3">
                      <button
                        onClick={() => openModalFromRejected(d)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2.5 rounded-xl text-xs transition">
                        <RefreshCw className="w-3.5 h-3.5" /> Resoumettre le dossier
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL — Formulaire d'inscription (5 étapes)
      ══════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* ── Header modal : titre + steps ── */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 pt-5 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-black text-base tracking-tight">
                  {rejeteId ? 'Corriger le dossier d\'inscription' : 'Nouveau dossier d\'inscription'}
                </p>
                <button onClick={closeModal}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition">
                  <X size={16} />
                </button>
              </div>

              {/* Steps */}
              <div className="flex items-center gap-0">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done   = step > s.n;
                  const active = step === s.n;
                  return (
                    <React.Fragment key={s.n}>
                      <div className={`flex flex-col items-center gap-1 px-2 pb-3 border-b-2 transition-all flex-1 ${active ? 'border-indigo-400' : done ? 'border-emerald-400' : 'border-transparent'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${active ? 'bg-indigo-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                          {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-500'}`}>{s.label}</span>
                      </div>
                      {i < 4 && <div className={`w-3 h-0.5 mb-4 shrink-0 transition-all ${step > s.n ? 'bg-emerald-400' : 'bg-white/10'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* ── Corps scrollable ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-black flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* ── Étape 1 : Identité ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Baby size={13} className="text-indigo-500" /> Identité de l'enfant
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.prenomEnfant} onChange={e => set({ prenomEnfant: e.target.value })} className={inp} placeholder="Prénom" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.nomEnfant} onChange={e => set({ nomEnfant: e.target.value })} className={inp} placeholder="Nom de famille" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Date de naissance</label>
                      <input type="date" value={form.dateNaissance} onChange={e => set({ dateNaissance: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lieu de naissance</label>
                      <input type="text" value={form.lieuNaissance} onChange={e => set({ lieuNaissance: e.target.value })} className={inp} placeholder="Dakar" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Sexe</label>
                      <div className="flex gap-2">
                        {[{ v: 'M', l: 'Garçon' }, { v: 'F', l: 'Fille' }].map(s => (
                          <button key={s.v} type="button" onClick={() => set({ sexe: s.v as 'M' | 'F' })}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${form.sexe === s.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 2 : Scolarité ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap size={13} className="text-indigo-500" /> Scolarité &amp; options
                  </p>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Niveau demandé <span className="text-rose-500">*</span></label>
                    <select value={form.niveau} onChange={e => set({ niveau: e.target.value })} className={inp + ' appearance-none'}>
                      {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1">
                      <input type="checkbox" checked={form.cantine} onChange={e => set({ cantine: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Cantine</span>
                    </label>
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1">
                      <input type="checkbox" checked={form.transportBus} onChange={e => set({ transportBus: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Bus scolaire</span>
                    </label>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Besoins spécifiques</label>
                    <input type="text" value={form.besoinSpecifique} onChange={e => set({ besoinSpecifique: e.target.value })} className={inp}
                      placeholder="Allergie, retard de développement, handisport…" />
                  </div>
                </div>
              )}

              {/* ── Étape 3 : Santé ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Stethoscope size={13} className="text-rose-500" /> Fiche sanitaire de liaison
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vaccins obligatoires</p>
                    {[
                      { key: 'vaccDiphterie',  dateKey: 'vaccDiphterieDate',  label: 'Diphtérie / Tétanos / Polio' },
                      { key: 'vaccPolio',      dateKey: 'vaccPolioDate',      label: 'Poliomyélite' },
                      { key: 'vaccCoqueluche', dateKey: 'vaccCoquelucheDate', label: 'Coqueluche' },
                      { key: 'vaccBCG',        dateKey: 'vaccBCGDate',        label: 'BCG' },
                    ].map(v => (
                      <div key={v.key} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer w-52 shrink-0">
                          <input type="checkbox" checked={(form as any)[v.key]} onChange={e => set({ [v.key]: e.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-xs font-bold text-slate-700">{v.label}</span>
                        </label>
                        {(form as any)[v.key] && (
                          <input type="date" value={(form as any)[v.dateKey]} onChange={e => set({ [v.dateKey]: e.target.value } as any)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        )}
                      </div>
                    ))}
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Vaccins recommandés</p>
                    {[
                      { key: 'vaccHepB', dateKey: 'vaccHepBDate', label: 'Hépatite B' },
                      { key: 'vaccROR',  dateKey: 'vaccRORDate',  label: 'ROR (Rubéole / Oreillons / Rougeole)' },
                    ].map(v => (
                      <div key={v.key} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer w-52 shrink-0">
                          <input type="checkbox" checked={(form as any)[v.key]} onChange={e => set({ [v.key]: e.target.checked } as any)} className="w-4 h-4 accent-emerald-600" />
                          <span className="text-xs font-bold text-slate-700">{v.label}</span>
                        </label>
                        {(form as any)[v.key] && (
                          <input type="date" value={(form as any)[v.dateKey]} onChange={e => set({ [v.dateKey]: e.target.value } as any)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                        )}
                      </div>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input type="checkbox" checked={form.certifContrIndication} onChange={e => set({ certifContrIndication: e.target.checked })} className="w-4 h-4 accent-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700">Certificat médical de contre-indication joint</span>
                    </label>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Traitement médical</p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.traitementMedical} onChange={e => set({ traitementMedical: e.target.checked })} className="w-4 h-4 accent-rose-600" />
                      <span className="text-xs font-bold text-slate-700">L'enfant suit un traitement médical en cours</span>
                    </label>
                    {form.traitementMedical && (
                      <textarea value={form.traitementDetail} onChange={e => set({ traitementDetail: e.target.value })}
                        className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-500/10 min-h-[60px]"
                        placeholder="Préciser le traitement, joindre ordonnance récente…" />
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Maladies antérieures</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'maladieRubeole', label: 'Rubéole' }, { key: 'maladieVaricelle', label: 'Varicelle' },
                        { key: 'maladieAngine', label: 'Angine' }, { key: 'maladieRhumatisme', label: 'Rhumatisme art.' },
                        { key: 'maladieScarlatine', label: 'Scarlatine' }, { key: 'maladieCoqueluche', label: 'Coqueluche' },
                        { key: 'maladieOtite', label: 'Otite' }, { key: 'maladieRougeole', label: 'Rougeole' },
                        { key: 'maladieOreillons', label: 'Oreillons' },
                      ].map(m => (
                        <label key={m.key} className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all">
                          <input type="checkbox" checked={(form as any)[m.key]} onChange={e => set({ [m.key]: e.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-[11px] font-bold text-slate-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Allergies</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'allergieAsthme', label: 'Asthme' },
                        { key: 'allergieMedicament', label: 'Médicamenteuses' },
                        { key: 'allergieAlimentaire', label: 'Alimentaires' },
                      ].map(a => (
                        <label key={a.key} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 transition-all ${(form as any)[a.key] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'}`}>
                          <input type="checkbox" checked={(form as any)[a.key]} onChange={e => set({ [a.key]: e.target.checked } as any)} className="w-4 h-4 accent-white" />
                          <span className="text-[10px] font-black uppercase">{a.label}</span>
                        </label>
                      ))}
                    </div>
                    <input type="text" value={form.allergieAutres} onChange={e => set({ allergieAutres: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                      placeholder="Autres allergies (cause)…" />
                    <textarea value={form.allergieConduite} onChange={e => set({ allergieConduite: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 min-h-[50px]"
                      placeholder="Conduite à tenir en cas de crise…" />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Équipements portés</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'equipeLunettes', label: 'Lunettes' }, { key: 'equipeLentilles', label: 'Lentilles' },
                        { key: 'equipeProtheseAuditive', label: 'Prothèse auditive' }, { key: 'equipeProtheseDentaire', label: 'Prothèse dentaire' },
                      ].map(e => (
                        <label key={e.key} className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all">
                          <input type="checkbox" checked={(form as any)[e.key]} onChange={ev => set({ [e.key]: ev.target.checked } as any)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-[11px] font-bold text-slate-700">{e.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-2 block">L'enfant mouille-t-il son lit la nuit ?</label>
                    <div className="flex gap-2">
                      {[{ v: 'OUI', l: 'Oui' }, { v: 'NON', l: 'Non' }, { v: 'OCCASIONNELLEMENT', l: 'Occasionnellement' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => set({ mouillerLit: opt.v as any })}
                          className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${form.mouillerLit === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Médecin traitant</label>
                      <input type="text" value={form.medecinNom} onChange={e => set({ medecinNom: e.target.value })} className={inp} placeholder="Nom" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone médecin</label>
                      <input type="tel" value={form.medecinTel} onChange={e => set({ medecinTel: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" />
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Camera size={13} /> Autorisations parentales
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.autorisationSoins} onChange={e => set({ autorisationSoins: e.target.checked })} className="w-4 h-4 accent-indigo-600 mt-0.5 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">J'autorise le responsable de l'établissement à prendre toutes mesures nécessaires (traitement médical, hospitalisation) en cas d'urgence.</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.autorisationPhoto} onChange={e => set({ autorisationPhoto: e.target.checked })} className="w-4 h-4 accent-indigo-600 mt-0.5 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">J'autorise la prise de photographies / vidéos de mon enfant dans le cadre des activités de l'établissement.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── Étape 4 : Parents ── */}
              {step === 4 && (
                <div className="space-y-5">
                  {/* Parent principal */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Phone size={13} className="text-indigo-500" /> Parent / Tuteur légal principal
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom</label>
                        <input type="text" value={form.parent1Prenom} onChange={e => set({ parent1Prenom: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom</label>
                        <input type="text" value={form.parent1Nom} onChange={e => set({ parent1Nom: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien</label>
                        <select value={form.parent1Lien} onChange={e => set({ parent1Lien: e.target.value as any })} className={inp + ' appearance-none'}>
                          <option value="MERE">Mère</option><option value="PERE">Père</option><option value="TUTEUR">Tuteur légal</option>
                        </select></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone <span className="text-rose-500">*</span></label>
                        <input type="tel" value={form.parent1Tel} onChange={e => set({ parent1Tel: e.target.value, parent1Whatsapp: e.target.value })} className={inp} placeholder="+221 77 xxx xxxx" /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">WhatsApp</label>
                        <input type="tel" value={form.parent1Whatsapp} onChange={e => set({ parent1Whatsapp: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Email</label>
                        <input type="email" value={form.parent1Email} onChange={e => set({ parent1Email: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. domicile</label>
                        <input type="tel" value={form.parent1TelDomicile} onChange={e => set({ parent1TelDomicile: e.target.value })} className={inp} placeholder="+221 33 xxx xxxx" /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. travail</label>
                        <input type="tel" value={form.parent1TelTravail} onChange={e => set({ parent1TelTravail: e.target.value })} className={inp} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Adresse</label>
                        <input type="text" value={form.parent1Adresse} onChange={e => set({ parent1Adresse: e.target.value })} className={inp} placeholder="Rue, quartier, ville…" /></div>
                    </div>
                  </div>

                  {/* Parent 2 */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Phone size={13} className="text-indigo-400" /> Second parent (facultatif)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom</label>
                        <input type="text" value={form.parent2Prenom} onChange={e => set({ parent2Prenom: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom</label>
                        <input type="text" value={form.parent2Nom} onChange={e => set({ parent2Nom: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien</label>
                        <select value={form.parent2Lien} onChange={e => set({ parent2Lien: e.target.value as any })} className={inp + ' appearance-none'}>
                          <option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur légal</option>
                        </select></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Tél. portable</label>
                        <input type="tel" value={form.parent2Tel} onChange={e => set({ parent2Tel: e.target.value })} className={inp} /></div>
                    </div>
                  </div>

                  {/* Contact urgence */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Shield size={13} className="text-rose-500" /> Contact d'urgence (autre que parents)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom complet</label>
                        <input type="text" value={form.urgenceNom} onChange={e => set({ urgenceNom: e.target.value })} className={inp} /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone</label>
                        <input type="tel" value={form.urgenceTel} onChange={e => set({ urgenceTel: e.target.value })} className={inp} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <input type="text" value={form.urgenceLien} onChange={e => set({ urgenceLien: e.target.value })} className={inp} placeholder="Ex: Grand-mère, Oncle…" /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 5 : Récapitulatif ── */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-500" /> Récapitulatif &amp; validation
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Enfant</span>
                      <span className="font-black text-slate-900">{form.prenomEnfant} {form.nomEnfant}</span>
                    </div>
                    {form.dateNaissance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Naissance</span>
                        <span className="font-bold text-slate-700">{new Date(form.dateNaissance).toLocaleDateString('fr-FR')}{form.lieuNaissance ? ` — ${form.lieuNaissance}` : ''}</span>
                      </div>
                    )}
                    {form.sexe && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Sexe</span>
                        <span className="font-bold text-slate-700">{form.sexe === 'M' ? 'Garçon' : 'Fille'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Niveau</span>
                      <span className="font-bold text-indigo-700">{niveauLabel(form.niveau)}</span>
                    </div>
                    <div className="flex gap-2">
                      {form.cantine && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black border border-emerald-200">Cantine</span>}
                      {form.transportBus && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-xl text-[9px] font-black border border-amber-200">Bus</span>}
                    </div>
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
                  </div>

                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1"><Stethoscope size={11} /> Santé</p>
                    <div className="flex gap-1 flex-wrap">
                      {[{ k: 'vaccDiphterie', l: 'Diph.' }, { k: 'vaccPolio', l: 'Polio' }, { k: 'vaccCoqueluche', l: 'Coq.' },
                        { k: 'vaccBCG', l: 'BCG' }, { k: 'vaccHepB', l: 'HepB' }, { k: 'vaccROR', l: 'ROR' }].map(v => (
                        <span key={v.k} className={`px-1.5 py-0.5 rounded text-[8px] font-black ${(form as any)[v.k] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>{v.l}</span>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-1">
                      <p className={`text-[9px] font-black ${form.autorisationSoins ? 'text-emerald-700' : 'text-rose-600'}`}>{form.autorisationSoins ? '✓' : '✗'} Autorisation soins</p>
                      <p className={`text-[9px] font-black ${form.autorisationPhoto ? 'text-emerald-700' : 'text-rose-600'}`}>{form.autorisationPhoto ? '✓' : '✗'} Autorisation photo</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Message pour l'école (facultatif)</label>
                    <textarea value={form.notes} onChange={e => set({ notes: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[70px]"
                      placeholder="Remarques, questions, informations complémentaires…" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Pied du modal : navigation ── */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
              {step > 1 ? (
                <button type="button" onClick={() => { setStep(s => s - 1); setError(null); }}
                  className="px-5 py-3 border-2 border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2">
                  <ChevronLeft size={15} /> Retour
                </button>
              ) : (
                <button type="button" onClick={closeModal}
                  className="px-5 py-3 border-2 border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                  Annuler
                </button>
              )}
              {step < 5 ? (
                <button type="button" onClick={handleNext}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg">
                  Suivant <ArrowRight size={15} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit}
                  disabled={loading || !form.prenomEnfant || !form.nomEnfant}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                  {loading
                    ? <><Loader2 className="animate-spin" size={15} /> Envoi…</>
                    : <><Save size={14} /> Soumettre le dossier</>}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ParentAdmission;
