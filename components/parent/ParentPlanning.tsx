import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, Clock, GraduationCap } from 'lucide-react';

interface Creneau {
  id: string; classeId: string; jour: number;
  heureDebut: string; heureFin: string;
  matiere?: string; couleur?: string;
  enseignant?: { nom: string; prenom: string };
  classe?: { nom: string; niveau: string };
}

interface Props { creneaux: Creneau[]; }

// ─── Constantes identiques à EmploiDuTemps.tsx ───────────────────────────────

const GRID_START = 7 * 60 + 30;   // 07:30 en minutes
const GRID_END   = 18 * 60;       // 18:00 en minutes
const SLOT_MINS  = 30;
const SLOT_H     = 56;            // px par tranche de 30 min
const GRID_H     = ((GRID_END - GRID_START) / SLOT_MINS) * SLOT_H; // 1176px

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const TIME_RULER = Array.from(
  { length: (GRID_END - GRID_START) / SLOT_MINS + 1 },
  (_, i) => {
    const m = GRID_START + i * SLOT_MINS;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
);

// ─── Même palette que la directrice ──────────────────────────────────────────

const COULEURS: Record<string, { block: string; dot: string }> = {
  blue:    { block: 'bg-blue-50 border-l-4 border-l-blue-500',      dot: 'bg-blue-500' },
  emerald: { block: 'bg-emerald-50 border-l-4 border-l-emerald-500', dot: 'bg-emerald-500' },
  violet:  { block: 'bg-violet-50 border-l-4 border-l-violet-500',   dot: 'bg-violet-500' },
  amber:   { block: 'bg-amber-50 border-l-4 border-l-amber-400',     dot: 'bg-amber-400' },
  rose:    { block: 'bg-rose-50 border-l-4 border-l-rose-500',       dot: 'bg-rose-500' },
  teal:    { block: 'bg-teal-50 border-l-4 border-l-teal-500',       dot: 'bg-teal-500' },
  indigo:  { block: 'bg-indigo-50 border-l-4 border-l-indigo-500',   dot: 'bg-indigo-500' },
  orange:  { block: 'bg-orange-50 border-l-4 border-l-orange-500',   dot: 'bg-orange-500' },
  slate:   { block: 'bg-slate-50 border-l-4 border-l-slate-400',     dot: 'bg-slate-400' },
};

const COULEUR_KEYS = Object.keys(COULEURS);

const MATIERE_TO_COULEUR: Record<string, string> = {
  'Français': 'blue', 'Lecture': 'blue', 'Lecture préparatoire': 'blue',
  'Mathématiques': 'emerald',
  'Anglais': 'rose',
  'Sciences': 'teal',
  'Histoire-Géo': 'amber',
  'Sport': 'orange',
  'Arts': 'violet', 'Arts plastiques': 'violet',
  'Musique': 'rose',
  'Langage': 'indigo',
  'Graphisme': 'violet',
  'Informatique': 'teal',
  'Morale': 'emerald',
  'Éveil': 'amber',
  'Motricité': 'emerald', 'Motricité fine': 'emerald',
  'Sieste': 'slate',
  'Récréation': 'orange',
  'Accueil': 'blue',
  'Activités libres': 'violet',
};

function getCouleur(c: Creneau, fallbackIndex: number): string {
  if (c.couleur && COULEURS[c.couleur]) return c.couleur;
  if (c.matiere && MATIERE_TO_COULEUR[c.matiere]) return MATIERE_TO_COULEUR[c.matiere];
  return COULEUR_KEYS[fallbackIndex % COULEUR_KEYS.length];
}

// ─── Helpers position (tY / tH) identiques à EmploiDuTemps.tsx ──────────────

function tY(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h * 60 + m - GRID_START) / SLOT_MINS) * SLOT_H;
}

function tH(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(SLOT_H, ((eh * 60 + em - sh * 60 - sm) / SLOT_MINS) * SLOT_H);
}

function nowY(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < GRID_START || mins > GRID_END) return -1;
  return ((mins - GRID_START) / SLOT_MINS) * SLOT_H;
}

function todayJour(): number {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? -1 : d - 1; // 0=Lun … 4=Ven, -1=WE
}

// ─── Composant ────────────────────────────────────────────────────────────────

const ParentPlanning: React.FC<Props> = ({ creneaux }) => {
  const [currentY, setCurrentY] = useState(nowY());
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentY(nowY()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!creneaux.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6">
        <CalendarDays className="w-12 h-12 text-indigo-200" />
      </div>
      <h3 className="text-xl font-bold text-slate-700 mb-2">Emploi du temps non disponible</h3>
      <p className="text-slate-400 text-sm max-w-xs">
        L'emploi du temps sera affiché dès qu'une classe est assignée à votre enfant.
      </p>
    </div>
  );

  const todayIdx = todayJour();
  const classe   = creneaux.find(c => c.classe)?.classe;

  // Grouper par jour (0=Lun … 4=Ven)
  const byJour: Record<number, Creneau[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  creneaux.forEach(c => {
    byJour[c.jour] = [...(byJour[c.jour] || []), c].sort((a, b) =>
      a.heureDebut.localeCompare(b.heureDebut)
    );
  });

  // Totaux pour les stats
  const totalMin = creneaux.reduce((s, c) => {
    const [sh, sm] = c.heureDebut.split(':').map(Number);
    const [eh, em] = c.heureFin.split(':').map(Number);
    return s + (eh * 60 + em - sh * 60 - sm);
  }, 0);
  const heuresLabel = `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? String(totalMin % 60).padStart(2, '0') : ''}`;

  // Légende — matières uniques
  const matiereList: string[] = Array.from(new Set(creneaux.map(c => c.matiere || 'Cours')));

  return (
    <div className="h-full flex flex-col gap-3">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <CalendarDays className="text-indigo-600" size={28} />
            Emploi du Temps
          </h2>
          {classe && (
            <div className="flex items-center gap-2 mt-1">
              <GraduationCap size={14} className="text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {classe.nom} · {classe.niveau}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white border border-slate-100 rounded-2xl px-4 py-2.5 text-center shadow-sm">
            <p className="text-xl font-black text-indigo-600">{creneaux.length}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">cours/sem</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl px-4 py-2.5 text-center shadow-sm">
            <p className="text-xl font-black text-amber-500">{heuresLabel}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">par sem.</p>
          </div>
        </div>
      </div>

      {/* ── Légende matières ── */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {matiereList.map((m, i) => {
          const key = MATIERE_TO_COULEUR[m] || COULEUR_KEYS[i % COULEUR_KEYS.length];
          const col = COULEURS[key];
          return (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-slate-100 shadow-sm"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
              {m}
            </span>
          );
        })}
      </div>

      {/* ── Grille (identique à la directrice) ── */}
      <div className="flex-1 min-h-0 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div ref={gridRef} className="overflow-x-auto overflow-y-auto h-full">
          <div className="flex min-w-[640px]">

            {/* Colonne heures */}
            <div className="w-16 shrink-0 relative" style={{ height: GRID_H + SLOT_H }}>
              <div className="h-[4.5rem] border-b border-slate-100" />
              <div className="relative" style={{ height: GRID_H }}>
                {TIME_RULER.map((t, i) => (
                  <div
                    key={t}
                    className="absolute right-2 flex items-center"
                    style={{ top: i * SLOT_H - 8, height: SLOT_H }}
                  >
                    <span
                      className={`text-[9px] font-black tracking-wide ${
                        t.endsWith(':00') ? 'text-slate-500' : 'text-slate-300'
                      }`}
                    >
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colonnes jours */}
            {JOURS.map((jour, idx) => {
              const isToday = idx === todayIdx;
              const dayCreneaux = byJour[idx] || [];

              return (
                <div key={jour} className="flex-1 min-w-[110px] border-l border-slate-100">

                  {/* En-tête jour */}
                  <div
                    className={`h-[4.5rem] flex flex-col items-center justify-center gap-0.5 border-b border-slate-100 ${
                      isToday ? 'bg-indigo-600' : 'bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        isToday ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {jour}
                    </span>
                    {dayCreneaux.length > 0 && (
                      <span
                        className={`text-[8px] font-bold ${
                          isToday ? 'text-white/70' : 'text-slate-400'
                        }`}
                      >
                        {dayCreneaux.length} cours
                      </span>
                    )}
                  </div>

                  {/* Corps de la colonne */}
                  <div className="relative" style={{ height: GRID_H }}>

                    {/* Lignes de grille horizontales */}
                    {TIME_RULER.map((t, i) => (
                      <div
                        key={t}
                        className={`absolute left-0 right-0 border-t ${
                          t.endsWith(':00') ? 'border-slate-200' : 'border-slate-100'
                        }`}
                        style={{ top: i * SLOT_H }}
                      />
                    ))}

                    {/* Fond léger pour aujourd'hui */}
                    {isToday && (
                      <div className="absolute inset-0 bg-indigo-50/30 pointer-events-none" />
                    )}

                    {/* Indicateur heure courante */}
                    {isToday && currentY >= 0 && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: currentY }}
                      >
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0" />
                          <div className="flex-1 h-px bg-rose-500" />
                        </div>
                      </div>
                    )}

                    {/* Blocs cours */}
                    {dayCreneaux.map((c, ci) => {
                      const couleurKey = getCouleur(c, ci);
                      const col = COULEURS[couleurKey] || COULEURS.blue;
                      const height = tH(c.heureDebut, c.heureFin);
                      const showTeacher = height >= SLOT_H * 1.5;

                      return (
                        <div
                          key={c.id}
                          className={`absolute left-1 right-1 rounded-xl shadow-sm overflow-hidden ${col.block}`}
                          style={{ top: tY(c.heureDebut) + 2, height: height - 4 }}
                        >
                          <div className="p-2 h-full flex flex-col justify-between">
                            <div>
                              <p className="text-[10px] font-black leading-tight truncate text-slate-800">
                                {c.matiere || 'Cours'}
                              </p>
                              {showTeacher && c.enseignant && (
                                <p className="text-[9px] font-bold text-slate-500 truncate mt-0.5">
                                  {c.enseignant.prenom} {c.enseignant.nom}
                                </p>
                              )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-400">
                              {c.heureDebut}–{c.heureFin}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Colonne vide */}
                    {dayCreneaux.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p
                          className="text-[8px] font-bold text-slate-200 uppercase tracking-widest"
                          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                        >
                          Libre
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Cards récap par jour ── */}
      <div className="grid grid-cols-5 gap-2 shrink-0">
        {JOURS.map((jour, idx) => {
          const cours = byJour[idx] || [];
          const isToday = idx === todayIdx;
          return (
            <div
              key={jour}
              className={`bg-white rounded-2xl border p-3 shadow-sm ${
                isToday ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isToday ? 'text-indigo-500' : 'text-slate-400'
                }`}
              >
                {jour.substring(0, 3)}
              </p>
              <p
                className={`text-xl font-black mt-0.5 ${
                  isToday ? 'text-indigo-700' : cours.length ? 'text-slate-800' : 'text-slate-300'
                }`}
              >
                {cours.length}
              </p>
              <p
                className={`text-[10px] font-medium ${
                  cours.length ? 'text-slate-400' : 'text-slate-300'
                }`}
              >
                {cours.length > 0 ? 'cours' : 'libre'}
              </p>
              {cours.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                  <Clock size={9} className="text-slate-300 shrink-0" />
                  <span className="text-[9px] text-slate-400 font-medium">
                    {cours[0].heureDebut}–{cours[cours.length - 1].heureFin}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParentPlanning;
