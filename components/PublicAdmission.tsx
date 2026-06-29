import React, { useEffect, useState } from 'react';
import {
  Baby, User, Phone, Mail, ChevronRight, ChevronLeft,
  CheckCircle2, Loader2, AlertCircle, Utensils, Bus,
  GraduationCap, ArrowLeft, School,
} from 'lucide-react';
import { apiClient } from '../services/api';

const NIVEAUX = [
  { v: 'TOUTE_PETITE', l: 'Toute Petite Section (TPS)' },
  { v: 'PS',  l: 'Petite Section (PS)' },
  { v: 'MS',  l: 'Moyenne Section (MS)' },
  { v: 'GS',  l: 'Grande Section (GS)' },
  { v: 'CP',  l: 'Cours Préparatoire (CP)' },
  { v: 'CE1', l: 'CE1' },
  { v: 'CE2', l: 'CE2' },
];

const LIENS_PARENT = ['Père', 'Mère', 'Tuteur', 'Tutrice', 'Grand-parent', 'Autre'];

interface Ecole { name?: string; logoUrl?: string }

interface Form {
  // Enfant
  prenom: string; nom: string; dateNaissance: string;
  lieuNaissance: string; sexe: 'M' | 'F' | '';
  niveau: string; cantine: boolean; transportBus: boolean;
  besoinSpecifique: string;
  // Parent 1
  p1Prenom: string; p1Nom: string; p1Lien: string;
  p1Tel: string; p1Email: string;
  // Parent 2 (optionnel)
  p2Prenom: string; p2Nom: string; p2Tel: string;
}

const EMPTY: Form = {
  prenom: '', nom: '', dateNaissance: '', lieuNaissance: '',
  sexe: '', niveau: 'PS', cantine: false, transportBus: false, besoinSpecifique: '',
  p1Prenom: '', p1Nom: '', p1Lien: 'Père', p1Tel: '', p1Email: '',
  p2Prenom: '', p2Nom: '', p2Tel: '',
};

const inp = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm';
const lbl = 'block text-xs font-bold text-gray-600 mb-1.5';

interface Props { onBack?: () => void }

const PublicAdmission: React.FC<Props> = ({ onBack }) => {
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<Form>(EMPTY);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ reference: string; message: string } | null>(null);
  const [ecole, setEcole]     = useState<Ecole>({});

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    apiClient.get('/public/ecole')
      .then((d: any) => setEcole(d || {}))
      .catch(() => {});
  }, []);

  // ── Validation par étape ──
  const validateStep = (): string => {
    if (step === 1) {
      if (!form.prenom.trim()) return 'Le prénom de l\'enfant est requis.';
      if (!form.nom.trim())    return 'Le nom de l\'enfant est requis.';
      if (!form.sexe)          return 'Veuillez indiquer le sexe.';
    }
    if (step === 2) {
      if (!form.p1Prenom.trim()) return 'Le prénom du parent/tuteur est requis.';
      if (!form.p1Nom.trim())    return 'Le nom du parent/tuteur est requis.';
      if (!form.p1Tel.trim() && !form.p1Email.trim())
        return 'Un téléphone ou un email est requis pour vous contacter.';
    }
    return '';
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => { setError(''); setStep(s => s - 1); };

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const payload = {
        prenom: form.prenom.trim(),
        nom:    form.nom.trim(),
        dateNaissance:    form.dateNaissance   || null,
        lieuNaissance:    form.lieuNaissance   || null,
        sexe:             form.sexe            || null,
        niveau:           form.niveau,
        cantine:          form.cantine,
        transportBus:     form.transportBus,
        besoinSpecifique: form.besoinSpecifique || null,
        parent1: {
          prenom:    form.p1Prenom.trim() || null,
          nom:       form.p1Nom.trim()    || null,
          lien:      form.p1Lien          || null,
          telephone: form.p1Tel.trim()    || null,
          email:     form.p1Email.trim()  || null,
        },
        parent2: (form.p2Prenom || form.p2Nom || form.p2Tel)
          ? { prenom: form.p2Prenom || null, nom: form.p2Nom || null, telephone: form.p2Tel || null }
          : null,
      };
      const res: any = await apiClient.post('/public/admission', payload);
      setResult({ reference: res.reference, message: res.message });
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // ── Succès ──
  if (result) return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl shadow-amber-100/50 border border-amber-100 w-full max-w-md p-8 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Dossier transmis !</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-5">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Votre référence</p>
          <p className="text-2xl font-black text-amber-700 tracking-widest">{result.reference}</p>
          <p className="text-xs text-gray-400 mt-1">Conservez ce numéro</p>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed mb-8">{result.message}</p>
        <button
          onClick={() => { setResult(null); setForm(EMPTY); setStep(1); }}
          className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm uppercase tracking-widest transition"
        >
          Soumettre un autre dossier
        </button>
        {onBack && (
          <button onClick={onBack}
            className="mt-3 w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition">
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col">

      {/* En-tête */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-amber-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        {onBack && (
          <button onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-amber-50 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {ecole.logoUrl ? (
          <img src={ecole.logoUrl} alt="Logo" className="h-9 w-9 rounded-xl object-contain bg-white border border-amber-100 p-0.5 flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <School className="w-5 h-5 text-amber-600" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-black text-gray-900 text-sm truncate">{ecole.name || 'Formulaire d\'inscription'}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Demande de préinscription</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-6">
        <div className="w-full max-w-lg">

          {/* Indicateur étapes */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { n: 1, label: 'L\'enfant',  icon: Baby },
              { n: 2, label: 'Le parent',  icon: User },
              { n: 3, label: 'Options',    icon: GraduationCap },
            ].map(({ n, label, icon: Icon }, i) => (
              <React.Fragment key={n}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    step === n ? 'bg-amber-400 text-white shadow-lg shadow-amber-200'
                    : step > n ? 'bg-emerald-400 text-white'
                    : 'bg-white text-gray-300 border border-gray-200'
                  }`}>
                    {step > n ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${step === n ? 'text-amber-600' : step > n ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {label}
                  </span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 mb-4 rounded-full ${step > n ? 'bg-emerald-300' : 'bg-gray-100'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Carte formulaire */}
          <div className="bg-white rounded-3xl shadow-xl shadow-amber-100/30 border border-amber-100 overflow-hidden">
            <div className={`px-6 py-4 border-b border-gray-50 ${
              step === 1 ? 'bg-amber-50' : step === 2 ? 'bg-indigo-50' : 'bg-emerald-50'
            }`}>
              <p className="font-black text-gray-800">
                {step === 1 && '👶 Informations sur l\'enfant'}
                {step === 2 && '👤 Coordonnées du parent / tuteur'}
                {step === 3 && '⚙️ Options & finalisation'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 1 && 'État civil et niveau scolaire souhaité'}
                {step === 2 && 'Nous vous contacterons à ces coordonnées'}
                {step === 3 && 'Services optionnels et envoi du dossier'}
              </p>
            </div>

            <div className="p-5 space-y-4">

              {/* ── ÉTAPE 1 : Enfant ── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Prénom <span className="text-red-400">*</span></label>
                      <input className={inp} placeholder="Prénom de l'enfant"
                        value={form.prenom} onChange={e => set({ prenom: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Nom <span className="text-red-400">*</span></label>
                      <input className={inp} placeholder="Nom de famille"
                        value={form.nom} onChange={e => set({ nom: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Sexe <span className="text-red-400">*</span></label>
                    <div className="flex gap-3">
                      {[{ v: 'M', l: '👦 Garçon' }, { v: 'F', l: '👧 Fille' }].map(s => (
                        <button key={s.v} type="button" onClick={() => set({ sexe: s.v as 'M' | 'F' })}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold border transition ${
                            form.sexe === s.v ? 'bg-amber-400 text-white border-amber-400 shadow-md' : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Date de naissance</label>
                      <input type="date" className={inp}
                        value={form.dateNaissance} onChange={e => set({ dateNaissance: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Lieu de naissance</label>
                      <input className={inp} placeholder="Dakar"
                        value={form.lieuNaissance} onChange={e => set({ lieuNaissance: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Niveau souhaité <span className="text-red-400">*</span></label>
                    <select className={inp} value={form.niveau} onChange={e => set({ niveau: e.target.value })}>
                      {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── ÉTAPE 2 : Parent ── */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Prénom <span className="text-red-400">*</span></label>
                      <input className={inp} placeholder="Votre prénom"
                        value={form.p1Prenom} onChange={e => set({ p1Prenom: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>Nom <span className="text-red-400">*</span></label>
                      <input className={inp} placeholder="Votre nom"
                        value={form.p1Nom} onChange={e => set({ p1Nom: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Lien avec l'enfant</label>
                    <div className="flex flex-wrap gap-2">
                      {LIENS_PARENT.map(l => (
                        <button key={l} type="button" onClick={() => set({ p1Lien: l })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            form.p1Lien === l ? 'bg-amber-400 text-white border-amber-400' : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Téléphone <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input type="tel" className={inp + ' pl-9'} placeholder="77 000 00 00"
                        value={form.p1Tel} onChange={e => set({ p1Tel: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Email <span className="text-gray-300 font-normal">(optionnel)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input type="email" className={inp + ' pl-9'} placeholder="votre@email.com"
                        value={form.p1Email} onChange={e => set({ p1Email: e.target.value })} />
                    </div>
                  </div>

                  {/* Parent 2 optionnel */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">2ème parent / tuteur (optionnel)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className={inp} placeholder="Prénom"
                        value={form.p2Prenom} onChange={e => set({ p2Prenom: e.target.value })} />
                      <input className={inp} placeholder="Nom"
                        value={form.p2Nom} onChange={e => set({ p2Nom: e.target.value })} />
                      <input type="tel" className={inp + ' sm:col-span-2'} placeholder="Téléphone"
                        value={form.p2Tel} onChange={e => set({ p2Tel: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {/* ── ÉTAPE 3 : Options & récap ── */}
              {step === 3 && (
                <>
                  {/* Services */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Services souhaités</p>
                    {[
                      { key: 'cantine',     label: 'Cantine scolaire',   icon: Utensils, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
                      { key: 'transportBus',label: 'Transport scolaire',  icon: Bus,      color: 'text-blue-500   bg-blue-50   border-blue-200' },
                    ].map(({ key, label, icon: Icon, color }) => {
                      const active = form[key as keyof Form] as boolean;
                      return (
                        <button key={key} type="button"
                          onClick={() => set({ [key]: !active } as any)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                            active ? color + ' border-current/20 shadow-sm' : 'bg-white border-gray-100 text-gray-500'
                          }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-white/60' : 'bg-gray-100'}`}>
                            <Icon className={`w-5 h-5 ${active ? '' : 'text-gray-400'}`} />
                          </div>
                          <span className="font-bold text-sm">{label}</span>
                          <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'bg-current border-current' : 'border-gray-300'}`}>
                            {active && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Besoins spécifiques */}
                  <div>
                    <label className={lbl}>Besoins spécifiques ou informations complémentaires</label>
                    <textarea className={inp + ' resize-none'} rows={3}
                      placeholder="Allergie, handicap, situation particulière…"
                      value={form.besoinSpecifique}
                      onChange={e => set({ besoinSpecifique: e.target.value })} />
                  </div>

                  {/* Récapitulatif */}
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-1.5 text-sm">
                    <p className="font-black text-gray-700 text-xs uppercase tracking-widest mb-2">Récapitulatif</p>
                    <div className="flex justify-between"><span className="text-gray-500">Enfant</span><span className="font-bold text-gray-800">{form.prenom} {form.nom}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Niveau</span><span className="font-bold text-gray-800">{NIVEAUX.find(n => n.v === form.niveau)?.l || form.niveau}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Parent</span><span className="font-bold text-gray-800">{form.p1Prenom} {form.p1Nom}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Contact</span><span className="font-bold text-gray-800">{form.p1Tel || form.p1Email}</span></div>
                  </div>
                </>
              )}

              {/* Erreur */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="px-5 pb-5 flex gap-3">
              {step > 1 && (
                <button onClick={prev}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
              )}
              {step < 3 ? (
                <button onClick={next}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm uppercase tracking-widest transition shadow-lg shadow-amber-200">
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={submit} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-black text-sm uppercase tracking-widest transition shadow-lg shadow-amber-200 disabled:opacity-60">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Soumettre le dossier</>}
                </button>
              )}
            </div>
          </div>

          {/* Lien retour connexion */}
          {onBack && (
            <p className="text-center text-xs text-gray-400 mt-5">
              Déjà un compte ?{' '}
              <button onClick={onBack} className="text-amber-600 font-bold hover:underline">
                Se connecter
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicAdmission;
