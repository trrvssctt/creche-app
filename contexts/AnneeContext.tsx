import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAnneesDisponibles(): string[] {
  const y = new Date().getFullYear();
  const list: string[] = [];
  for (let i = y - 3; i <= y + 2; i++) {
    list.push(`${i}-${i + 1}`);
  }
  return list;
}

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

const LS_KEY = 'tda_annee_active';
const LS_REF_KEY = 'tda_annee_active_ref';
const LS_CLOTUREES_KEY = 'tda_annees_cloturees';

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
   * Met à jour la référence d'année active (appelé après demarrerNouvelleAnnee en Settings).
   * Persiste en localStorage + met à jour le state React.
   */
  refreshAnneeRef: (newRef: string) => void;
  /** Liste des années officiellement clôturées (chargée depuis la DB via Settings). */
  anneesCloturees: string[];
  /** Met à jour la liste des années clôturées et la persiste en localStorage. */
  setCloturees: (list: string[]) => void;
  /** Vrai si l'année sélectionnée a été officiellement clôturée. */
  isAnneeCloturee: boolean;
}

const AnneeContext = createContext<AnneeCtx | null>(null);

export const AnneeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const anneesDisponibles = useMemo(() => buildAnneesDisponibles(), []);

  // anneeActiveToday: ref admin en DB → date du jour (en sautant les clôturées)
  const [anneeActiveToday, setAnneeActiveToday] = useState<string>(computeAnneeActiveToday);

  const [annee, setAnneeState] = useState<string>(() => {
    const activeToday = computeAnneeActiveToday();
    const saved = detectDefaultAnnee(activeToday);
    // Si l'année sauvegardée est déjà clôturée, repartir sur l'année active
    try {
      const cloturees: string[] = JSON.parse(localStorage.getItem(LS_CLOTUREES_KEY) || '[]');
      if (cloturees.includes(saved)) return activeToday;
    } catch { /* ignore */ }
    return anneesDisponibles.includes(saved) ? saved : activeToday;
  });

  const [anneesCloturees, setAnneesCloturées] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(LS_CLOTUREES_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

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
