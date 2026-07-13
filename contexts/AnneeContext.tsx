import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { StatutAnnee, AnneeScolaireConfig } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Année scolaire en cours selon la date du jour (septembre = début d'année). */
export function getAnneeActiveToday(): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function detectDefaultAnnee(ref: string): string {
  try {
    const saved = localStorage.getItem('tda_annee_active');
    if (saved) return saved;
    const cfg = localStorage.getItem('tda_school_config');
    if (cfg) { const p = JSON.parse(cfg); if (p?.anneeLibelle) return p.anneeLibelle; }
  } catch { /* ignore */ }
  return ref;
}

/** Retourne vrai si `annee` est strictement antérieure à `reference`. */
export function isAnneePasse(annee: string, reference: string): boolean {
  return parseInt(annee.slice(0, 4)) < parseInt(reference.slice(0, 4));
}

const LS_KEY             = 'tda_annee_active';
const LS_REF_KEY         = 'tda_annee_active_ref';
const LS_CLOTUREES_KEY   = 'tda_annees_cloturees';
const LS_CONFIG_KEY      = 'tda_annee_scolaire_config';

/**
 * Calcule l'année active "effective" :
 * 1. Préfère la référence admin sauvegardée (LS_REF_KEY)
 * 2. Sinon calcule par date, mais avance d'un an si cette année est déjà clôturée
 */
function computeAnneeActiveToday(): string {
  try {
    const ref = localStorage.getItem(LS_REF_KEY);
    if (ref) return ref;
  } catch { /* ignore */ }

  const computed = getAnneeActiveToday();
  try {
    const cloturees: string[] = JSON.parse(localStorage.getItem(LS_CLOTUREES_KEY) || '[]');
    if (cloturees.includes(computed)) {
      const y1 = parseInt(computed.slice(0, 4), 10);
      return `${y1 + 1}-${y1 + 2}`;
    }
  } catch { /* ignore */ }

  return computed;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AnneeCtx {
  /** Année scolaire actuellement sélectionnée dans l'app. */
  annee: string;
  /** Changer l'année active (persiste dans localStorage). */
  setAnnee: (a: string) => void;
  /** Liste des années disponibles dans les sélecteurs. */
  anneesDisponibles: string[];
  /** Année suivant `annee` (pour la réinscription). */
  anneeNext: string;
  /** Année de référence = anneeActive persistée en DB par l'admin (fallback: date du jour). */
  anneeActiveToday: string;
  /**
   * Vrai si l'année sélectionnée est passée (antérieure à anneeActiveToday).
   * En mode lecture seule toute opération d'écriture doit être bloquée.
   */
  isReadOnly: boolean;
  /**
   * Met à jour la référence d'année active (appelé après demarrerAnnee en Settings).
   * Persiste en localStorage + met à jour le state React.
   */
  refreshAnneeRef: (newRef: string) => void;
  /** Liste des années officiellement clôturées (chargée depuis la DB via Settings). */
  anneesCloturees: string[];
  /** Met à jour la liste des années clôturées et la persiste en localStorage. */
  setCloturees: (list: string[]) => void;
  /** Vrai si l'année sélectionnée a été officiellement clôturée. */
  isAnneeCloturee: boolean;

  // ── Nouveaux champs — cycle de vie ──
  /** Config complète de toutes les années scolaires (chargée depuis la DB). */
  anneeScolaireConfig: Record<string, AnneeScolaireConfig>;
  /** Met à jour le config et persiste en localStorage. */
  setAnneeScolaireConfig: (config: Record<string, AnneeScolaireConfig>) => void;
  /** Retourne le statut d'une année, ou null si inconnue. */
  getStatutAnnee: (annee: string) => StatutAnnee | null;
  /**
   * Vrai si les inscriptions sont ouvertes pour l'année courante sélectionnée.
   * (statut = INSCRIPTIONS_OUVERTES ou EN_COURS)
   */
  isInscriptionsOuvertes: boolean;
  /** Liste des années dont les inscriptions sont actuellement ouvertes. */
  inscriptionsOuvertesAnnees: string[];
}

const AnneeContext = createContext<AnneeCtx | null>(null);

export const AnneeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // anneeActiveToday: ref admin en DB → date du jour (en sautant les clôturées)
  const [anneeActiveToday, setAnneeActiveToday] = useState<string>(computeAnneeActiveToday);

  const [annee, setAnneeState] = useState<string>(() => {
    const activeToday = computeAnneeActiveToday();
    const saved = detectDefaultAnnee(activeToday);
    try {
      const cloturees: string[] = JSON.parse(localStorage.getItem(LS_CLOTUREES_KEY) || '[]');
      if (cloturees.includes(saved)) return activeToday;
    } catch { /* ignore */ }
    return saved;
  });

  const [anneesCloturees, setAnneesCloturées] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(LS_CLOTUREES_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [anneeScolaireConfig, setAnneeScolaireConfigState] = useState<Record<string, AnneeScolaireConfig>>(() => {
    try {
      const s = localStorage.getItem(LS_CONFIG_KEY);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });

  // Seules les années gérées dans « Gestion des campagnes » apparaissent dans
  // les sélecteurs : années du cycle de vie (anneeScolaireConfig), années
  // clôturées (legacy), l'année active et l'année sélectionnée (sécurité).
  const anneesDisponibles = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(anneeScolaireConfig),
      ...anneesCloturees,
      anneeActiveToday,
      annee,
    ]);
    return [...set]
      .filter(a => /^\d{4}-\d{4}$/.test(a))
      .sort((a, b) => parseInt(a.slice(0, 4)) - parseInt(b.slice(0, 4)));
  }, [anneeScolaireConfig, anneesCloturees, anneeActiveToday, annee]);

  const setCloturees = useCallback((list: string[]) => {
    setAnneesCloturées(list);
    try { localStorage.setItem(LS_CLOTUREES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }, []);

  const setAnnee = useCallback((a: string) => {
    setAnneeState(a);
    try { localStorage.setItem(LS_KEY, a); } catch { /* ignore */ }
  }, []);

  const refreshAnneeRef = useCallback((newRef: string) => {
    setAnneeActiveToday(newRef);
    try { localStorage.setItem(LS_REF_KEY, newRef); } catch { /* ignore */ }
  }, []);

  const setAnneeScolaireConfig = useCallback((config: Record<string, AnneeScolaireConfig>) => {
    setAnneeScolaireConfigState(config);
    try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config)); } catch { /* ignore */ }
  }, []);

  const getStatutAnnee = useCallback((a: string): StatutAnnee | null => {
    return anneeScolaireConfig[a]?.statut ?? null;
  }, [anneeScolaireConfig]);

  const anneeNext = useMemo(() => {
    const idx = anneesDisponibles.indexOf(annee);
    return idx >= 0 && idx < anneesDisponibles.length - 1
      ? anneesDisponibles[idx + 1]
      : `${Number(annee.slice(0, 4)) + 1}-${Number(annee.slice(5)) + 1}`;
  }, [annee, anneesDisponibles]);

  const isReadOnly = useMemo(
    () => isAnneePasse(annee, anneeActiveToday),
    [annee, anneeActiveToday]
  );

  const isAnneeCloturee = useMemo(
    () => anneesCloturees.includes(annee),
    [anneesCloturees, annee]
  );

  const isInscriptionsOuvertes = useMemo(() => {
    const statut = anneeScolaireConfig[annee]?.statut;
    // Si aucun config connu, on suppose ouvert pour ne pas bloquer les données existantes
    if (!statut) return !isReadOnly;
    return statut === 'INSCRIPTIONS_OUVERTES' || statut === 'EN_COURS';
  }, [annee, anneeScolaireConfig, isReadOnly]);

  const inscriptionsOuvertesAnnees = useMemo(
    () => (Object.entries(anneeScolaireConfig) as [string, AnneeScolaireConfig][])
      .filter(([, cfg]) => cfg.statut === 'INSCRIPTIONS_OUVERTES' || cfg.statut === 'EN_COURS')
      .map(([a]) => a),
    [anneeScolaireConfig]
  );

  return (
    <AnneeContext.Provider value={{
      annee, setAnnee,
      anneesDisponibles,
      anneeNext,
      anneeActiveToday,
      isReadOnly,
      refreshAnneeRef,
      anneesCloturees,
      setCloturees,
      isAnneeCloturee,
      anneeScolaireConfig,
      setAnneeScolaireConfig,
      getStatutAnnee,
      isInscriptionsOuvertes,
      inscriptionsOuvertesAnnees,
    }}>
      {children}
    </AnneeContext.Provider>
  );
};

export function useAnnee(): AnneeCtx {
  const ctx = useContext(AnneeContext);
  if (!ctx) throw new Error('useAnnee doit être utilisé à l\'intérieur de <AnneeProvider>');
  return ctx;
}
