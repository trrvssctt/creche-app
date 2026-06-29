import React, { useEffect, useState } from 'react';
import {
  Search, CheckCircle2, Clock, Star, UserCheck, XCircle,
  AlertTriangle, School, ArrowLeft, Baby, RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'EN_ATTENTE' | 'ADMIS' | 'INSCRIT' | 'ACTIF' | 'REJETE' | 'RADIE';

interface DossierResult {
  reference: string;
  prenom: string;
  nomInitiale: string;
  niveau: string;
  statut: Statut;
  dateDepot: string;
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
    next:  "Prochaine étape : attendez les informations de rentrée transmises par l'école.",
    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: UserCheck,
  },
  ACTIF: {
    label: 'Élève actif(ve)',
    desc:  "Votre enfant est actuellement scolarisé(e) dans l'établissement.",
    next:  null,
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2,
  },
  REJETE: {
    label: 'Candidature non retenue',
    desc:  "Nous sommes navrés, la candidature de votre enfant n'a pas pu être retenue cette année. L'école vous contactera pour vous expliquer les raisons.",
    next:  "Vous pouvez contacter l'école pour plus d'informations ou redéposer un dossier l'année prochaine.",
    bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: XCircle,
  },
  RADIE: {
    label: 'Dossier radié',
    desc:  "Le dossier de votre enfant a été clôturé. Contactez l'école pour plus d'informations.",
    next:  null,
    bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: AlertTriangle,
  },
};

// Ordre de la timeline positive (hors REJETE/RADIE)
const TIMELINE: Statut[] = ['EN_ATTENTE', 'ADMIS', 'INSCRIT', 'ACTIF'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRef(raw: string): string {
  // Retire tout ce qui n'est pas alphanumérique+tiret et met en majuscule
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function niveauLabel(n: string) {
  const map: Record<string, string> = {
    CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section',
    GS: 'Grande Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
  };
  return map[n] ?? n;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const PublicSuivi: React.FC = () => {
  const [ref, setRef]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<DossierResult | null>(null);

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

    // Pré-remplir depuis l'URL ?ref=PRE-2026-XXXXXX
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) setRef(formatRef(refParam));
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = ref.trim();
    if (!cleaned) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const data: any = await apiClient.get(`/public/admission/${encodeURIComponent(cleaned)}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Dossier introuvable. Vérifiez votre numéro de référence.');
    } finally {
      setLoading(false);
    }
  };

  // Pré-remplir + lancer si ref dans URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      const cleaned = formatRef(refParam);
      setRef(cleaned);
      // Petite attente pour laisser le composant monter
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

  const cfg = result ? STATUT_CONFIG[result.statut] ?? STATUT_CONFIG.EN_ATTENTE : null;
  const isNegative = result && (result.statut === 'REJETE' || result.statut === 'RADIE');

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">

      {/* ── Entête ─────────────────────────────────────────────────────────── */}
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

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
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

          {/* ── Résultat ──────────────────────────────────────────────────── */}
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
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Baby className="w-6 h-6 text-indigo-500" />
                    </div>
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

                {/* Timeline (uniquement si parcours positif) */}
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
              </div>

              {/* Nouvelle recherche */}
              <button
                onClick={() => { setResult(null); setRef(''); setError(null); }}
                className="w-full py-3.5 rounded-2xl border-2 border-white/20 text-white/70 font-bold text-sm active:bg-white/10 transition flex items-center justify-center gap-2">
                <Search size={15} /> Rechercher un autre dossier
              </button>
            </div>
          )}

          {/* Liens rapides (si pas de résultat) */}
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
