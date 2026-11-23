// Passerelle entre les grilles officielles (bulletinTemplates.data.ts, générées depuis
// les modèles Word de l'école) et les structures utilisées par les écrans Bulletins.
import { BULLETIN_GRILLES, TemplateDomaine } from './bulletinTemplates.data';

// ── Échelles d'acquisition ───────────────────────────────────────────────────
// Valeurs stockées communes à tous les niveaux ; seuls le code imprimé et le libellé
// changent. Un même code a toujours le même sens : NA = non acquis, NE = non évalué.
export type CompScaleValue = 'NON_ACQUIS' | 'EN_COURS' | 'ACQUIS' | 'MAITRISE' | 'NON_EVALUE';

export interface ScaleOption {
  value: CompScaleValue;
  label: string;
  code: string; // acronyme imprimé sur le bulletin
}

// Crèche, maternelle (PS/MS/GS) et cycle 3 (CM1/CM2) : A / EC / NA / NE
export const SCALE_ACQUISITION: ScaleOption[] = [
  { value: 'ACQUIS',     label: 'Acquis',                 code: 'A'  },
  { value: 'EN_COURS',   label: "En cours d'acquisition", code: 'EC' },
  { value: 'NON_ACQUIS', label: 'Non acquis',             code: 'NA' },
  { value: 'NON_EVALUE', label: 'Non évalué',             code: 'NE' },
];

// Cycle 2 (CP/CE1/CE2) : EA / A / M / NE
// (le modèle de l'école notait « NA = non abordé / non évalué » : remplacé par NE à la
// demande de l'école, pour que NA garde partout le sens « non acquis »)
export const SCALE_CYCLE2: ScaleOption[] = [
  { value: 'EN_COURS',   label: "En cours d'acquisition", code: 'EA' },
  { value: 'ACQUIS',     label: 'Acquis',                 code: 'A'  },
  { value: 'MAITRISE',   label: 'Maîtrisé',               code: 'M'  },
  { value: 'NON_EVALUE', label: 'Non abordé / non évalué', code: 'NE' },
];

const CYCLE2 = ['CP', 'CE1', 'CE2'];

export function scaleForNiveau(niveau: string): ScaleOption[] {
  return CYCLE2.includes(niveau) ? SCALE_CYCLE2 : SCALE_ACQUISITION;
}

/** Une compétence compte comme réussie (barre de progression). */
export const isReussi = (v: string) => v === 'ACQUIS' || v === 'MAITRISE';

// ── Grilles ──────────────────────────────────────────────────────────────────

interface DomaineOut { nom: string; section?: string; competences: { libelle: string; niveau: '' }[]; }

function toDomaines(list: TemplateDomaine[]): DomaineOut[] {
  return list.map(d => ({
    nom: d.nom,
    ...(d.section ? { section: d.section } : {}),
    competences: d.competences.map(libelle => ({ libelle, niveau: '' as const })),
  }));
}

/** Grille officielle d'un niveau (PS → CM2), vierge. null pour la crèche / TPS. */
export function grilleNiveau(niveau: string): DomaineOut[] | null {
  const t = BULLETIN_GRILLES[niveau];
  return t ? toDomaines(t) : null;
}

/**
 * Un bulletin enregistré suit-il la grille actuelle du niveau ?
 * Faux pour les bulletins saisis avec les anciens modèles (libellés différents).
 */
export function suitGrilleActuelle(niveau: string, domaines?: { competences: { libelle: string }[] }[] | null): boolean {
  const t = BULLETIN_GRILLES[niveau];
  if (!t || !domaines?.length) return !t;
  const attendus = new Set(t.flatMap(d => d.competences));
  const presents = domaines.flatMap(d => d.competences.map(c => c.libelle));
  return presents.length === attendus.size && presents.every(l => attendus.has(l));
}
