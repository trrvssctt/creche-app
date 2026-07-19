// Passerelle entre les grilles officielles (bulletinTemplates.data.ts, extraites
// des .docx du Drive) et les structures utilisées par le composant Bulletins.
import { MATERNELLE_DOMAINES, ELEM_COMPETENCES, ELEM_NOTES, TemplateDomaine } from './bulletinTemplates.data';

// ── Échelles d'acquisition par cycle ─────────────────────────────────────────
// Valeurs stockées : réutilisées entre cycles, mais libellé/code diffèrent.
export type CompScaleValue = 'NON_ACQUIS' | 'EN_COURS' | 'ACQUIS' | 'MAITRISE';

export interface ScaleOption {
  value: CompScaleValue;
  label: string;
  code: string; // acronyme imprimé (A/B/C ou EA/A/M)
}

// Maternelle & crèche : Acquis (A) / En cours (B) / Non acquis (C)
export const SCALE_MATERNELLE: ScaleOption[] = [
  { value: 'ACQUIS',     label: 'Acquis',                 code: 'A' },
  { value: 'EN_COURS',   label: "En cours d'acquisition", code: 'B' },
  { value: 'NON_ACQUIS', label: 'Non acquis',             code: 'C' },
];

// Élémentaire (compétences) : En cours (EA) / Acquis (A) / Maîtrisé (M)
export const SCALE_ELEMENTAIRE: ScaleOption[] = [
  { value: 'EN_COURS',  label: "En cours d'acquisition", code: 'EA' },
  { value: 'ACQUIS',    label: 'Acquis',                 code: 'A'  },
  { value: 'MAITRISE',  label: 'Maîtrisé',               code: 'M'  },
];

export function scaleForCycle(cycle: 'MATERNELLE' | 'ELEMENTAIRE' | 'CRECHE'): ScaleOption[] {
  return cycle === 'ELEMENTAIRE' ? SCALE_ELEMENTAIRE : SCALE_MATERNELLE;
}

// ── Convertisseurs vers les formes du composant ──────────────────────────────

interface DomaineOut { nom: string; competences: { libelle: string; niveau: '' }[]; }
interface SousMatiereOut { nom: string; coefficient: number; note: '' }
interface MatiereOut { nom: string; coefficient: number; sousMatieres: SousMatiereOut[]; appreciation: string; }

function toDomaines(list: TemplateDomaine[]): DomaineOut[] {
  return list.map(d => ({
    nom: d.nom,
    competences: d.competences.map(libelle => ({ libelle, niveau: '' as const })),
  }));
}

/** Domaines de compétences maternelle (PS/MS/GS) — bulletin unique, échelle A/B/C. */
export function maternelleDomaines(niveau: string): DomaineOut[] | null {
  const t = MATERNELLE_DOMAINES[niveau];
  return t ? toDomaines(t) : null;
}

/** Domaines de compétences élémentaire (CP/CE1/CE2) — 2e bulletin, échelle EA/A/M. */
export function elementaireCompetences(niveau: string): DomaineOut[] | null {
  const t = ELEM_COMPETENCES[niveau] || (niveau === 'CM1' || niveau === 'CM2' ? ELEM_COMPETENCES['CE2'] : null);
  return t ? toDomaines(t) : null;
}

// Coefficients par matière (le bulletin de notes reste sur le barème /20 pondéré).
const COEFFS: Record<string, number> = {
  'Français': 3, 'Mathématiques': 3,
  'Éducation à la Science et à la vie sociale': 1,
  'Anglais': 1, 'Intélligence Artificielle / Informatique': 1,
  'Éducation artistique/ Musicale': 0.5, 'Éducation physique (EPS)': 0.5,
  'Enseignement Moral et civique': 0.5, 'Vie scolaire': 0.5,
};

/** Grille de notes élémentaire (CP/CE1/CE2) — matières/sous-matières, barème /20. */
export function notesMatieres(niveau: string): MatiereOut[] | null {
  const t = ELEM_NOTES[niveau] || (niveau === 'CM1' || niveau === 'CM2' ? ELEM_NOTES['CE2'] : null);
  if (!t) return null;
  return t.map(d => ({
    nom: d.nom,
    coefficient: COEFFS[d.nom] ?? 1,
    appreciation: '',
    sousMatieres: d.competences.map(nom => ({ nom, coefficient: 1, note: '' as const })),
  }));
}
