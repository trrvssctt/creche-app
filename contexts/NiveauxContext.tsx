import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'tda_niveaux_config';

export interface NiveauDef {
  value: string;
  label: string;
  cycle: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
}

export const NIVEAUX_PALETTES: { bg: string; text: string; border: string; preview: string }[] = [
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    preview: '#fdf2f8' },
  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  preview: '#f5f3ff' },
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  preview: '#eef2ff' },
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    preview: '#eff6ff' },
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    preview: '#ecfeff' },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    preview: '#f0fdfa' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', preview: '#ecfdf5' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   preview: '#fffbeb' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  preview: '#fff7ed' },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    preview: '#fff1f2' },
];

export const NIVEAUX_DEFAUT: NiveauDef[] = [
  { value: 'CRECHE', label: 'Crèche',          cycle: 'Crèche',      accentBg: 'bg-pink-50',    accentText: 'text-pink-700',    accentBorder: 'border-pink-200' },
  { value: 'PS',     label: 'Petite Section',  cycle: 'Maternelle',  accentBg: 'bg-violet-50',  accentText: 'text-violet-700',  accentBorder: 'border-violet-200' },
  { value: 'MS',     label: 'Moyenne Section', cycle: 'Maternelle',  accentBg: 'bg-indigo-50',  accentText: 'text-indigo-700',  accentBorder: 'border-indigo-200' },
  { value: 'GS',     label: 'Grande Section',  cycle: 'Maternelle',  accentBg: 'bg-blue-50',    accentText: 'text-blue-700',    accentBorder: 'border-blue-200' },
  { value: 'CP',     label: 'CP',              cycle: 'Élémentaire', accentBg: 'bg-cyan-50',    accentText: 'text-cyan-700',    accentBorder: 'border-cyan-200' },
  { value: 'CE1',    label: 'CE1',             cycle: 'Élémentaire', accentBg: 'bg-teal-50',    accentText: 'text-teal-700',    accentBorder: 'border-teal-200' },
  { value: 'CE2',    label: 'CE2',             cycle: 'Élémentaire', accentBg: 'bg-emerald-50', accentText: 'text-emerald-700', accentBorder: 'border-emerald-200' },
  { value: 'CM1',    label: 'CM1',             cycle: 'Élémentaire', accentBg: 'bg-amber-50',   accentText: 'text-amber-700',   accentBorder: 'border-amber-200' },
  { value: 'CM2',    label: 'CM2',             cycle: 'Élémentaire', accentBg: 'bg-orange-50',  accentText: 'text-orange-700',  accentBorder: 'border-orange-200' },
];

export const TEMPLATES: Record<string, { label: string; icon: string; niveaux: NiveauDef[] }> = {
  CRECHE_PRIMAIRE: {
    label: 'Crèche & École primaire',
    icon: '🏫',
    niveaux: NIVEAUX_DEFAUT,
  },
  COLLEGE: {
    label: 'Collège',
    icon: '📚',
    niveaux: [
      { value: '6EME',  label: '6ème', cycle: 'Collège', accentBg: 'bg-violet-50', accentText: 'text-violet-700', accentBorder: 'border-violet-200' },
      { value: '5EME',  label: '5ème', cycle: 'Collège', accentBg: 'bg-indigo-50', accentText: 'text-indigo-700', accentBorder: 'border-indigo-200' },
      { value: '4EME',  label: '4ème', cycle: 'Collège', accentBg: 'bg-blue-50',   accentText: 'text-blue-700',   accentBorder: 'border-blue-200' },
      { value: '3EME',  label: '3ème', cycle: 'Collège', accentBg: 'bg-cyan-50',   accentText: 'text-cyan-700',   accentBorder: 'border-cyan-200' },
    ],
  },
  LYCEE: {
    label: 'Lycée',
    icon: '🎓',
    niveaux: [
      { value: 'SECONDE',   label: 'Seconde',   cycle: 'Lycée', accentBg: 'bg-emerald-50', accentText: 'text-emerald-700', accentBorder: 'border-emerald-200' },
      { value: 'PREMIERE',  label: 'Première',  cycle: 'Lycée', accentBg: 'bg-amber-50',   accentText: 'text-amber-700',   accentBorder: 'border-amber-200' },
      { value: 'TERMINALE', label: 'Terminale', cycle: 'Lycée', accentBg: 'bg-orange-50',  accentText: 'text-orange-700',  accentBorder: 'border-orange-200' },
    ],
  },
  UNIVERSITE: {
    label: 'Université',
    icon: '🏛️',
    niveaux: [
      { value: 'L1',  label: 'Licence 1', cycle: 'Licence',  accentBg: 'bg-pink-50',    accentText: 'text-pink-700',    accentBorder: 'border-pink-200' },
      { value: 'L2',  label: 'Licence 2', cycle: 'Licence',  accentBg: 'bg-violet-50',  accentText: 'text-violet-700',  accentBorder: 'border-violet-200' },
      { value: 'L3',  label: 'Licence 3', cycle: 'Licence',  accentBg: 'bg-indigo-50',  accentText: 'text-indigo-700',  accentBorder: 'border-indigo-200' },
      { value: 'M1',  label: 'Master 1',  cycle: 'Master',   accentBg: 'bg-blue-50',    accentText: 'text-blue-700',    accentBorder: 'border-blue-200' },
      { value: 'M2',  label: 'Master 2',  cycle: 'Master',   accentBg: 'bg-cyan-50',    accentText: 'text-cyan-700',    accentBorder: 'border-cyan-200' },
      { value: 'DOC', label: 'Doctorat',  cycle: 'Doctorat', accentBg: 'bg-teal-50',    accentText: 'text-teal-700',    accentBorder: 'border-teal-200' },
    ],
  },
  FORMATION: {
    label: 'Centre de formation',
    icon: '⚙️',
    niveaux: [
      { value: 'MODULE1', label: 'Module 1', cycle: 'Formation', accentBg: 'bg-pink-50',    accentText: 'text-pink-700',    accentBorder: 'border-pink-200' },
      { value: 'MODULE2', label: 'Module 2', cycle: 'Formation', accentBg: 'bg-violet-50',  accentText: 'text-violet-700',  accentBorder: 'border-violet-200' },
      { value: 'MODULE3', label: 'Module 3', cycle: 'Formation', accentBg: 'bg-indigo-50',  accentText: 'text-indigo-700',  accentBorder: 'border-indigo-200' },
    ],
  },
};

interface NiveauxContextType {
  niveaux: NiveauDef[];
  addNiveau: (n: NiveauDef) => void;
  updateNiveau: (value: string, changes: Partial<NiveauDef>) => void;
  deleteNiveau: (value: string) => void;
  loadTemplate: (key: string) => void;
  resetToDefault: () => void;
}

const NiveauxContext = createContext<NiveauxContextType | null>(null);

export function NiveauxProvider({ children }: { children: React.ReactNode }) {
  const [niveaux, setNiveaux] = useState<NiveauDef[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return NIVEAUX_DEFAUT;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(niveaux));
  }, [niveaux]);

  const addNiveau = (n: NiveauDef) => setNiveaux(prev => [...prev, n]);

  const updateNiveau = (value: string, changes: Partial<NiveauDef>) =>
    setNiveaux(prev => prev.map(n => n.value === value ? { ...n, ...changes } : n));

  const deleteNiveau = (value: string) =>
    setNiveaux(prev => prev.filter(n => n.value !== value));

  const loadTemplate = (key: string) => {
    const tmpl = TEMPLATES[key];
    if (tmpl) setNiveaux(tmpl.niveaux);
  };

  const resetToDefault = () => setNiveaux(NIVEAUX_DEFAUT);

  return (
    <NiveauxContext.Provider value={{ niveaux, addNiveau, updateNiveau, deleteNiveau, loadTemplate, resetToDefault }}>
      {children}
    </NiveauxContext.Provider>
  );
}

export function useNiveaux() {
  const ctx = useContext(NiveauxContext);
  if (!ctx) throw new Error('useNiveaux must be used inside NiveauxProvider');
  return ctx;
}
