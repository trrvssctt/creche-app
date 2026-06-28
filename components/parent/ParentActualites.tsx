import React, { useState, useMemo } from 'react';
import { Bell, Pin, Info, AlertTriangle, Zap, Tag, GraduationCap,
  MapPin, Users, PartyPopper, BookOpen, Home, Megaphone, Calendar,
  ChevronLeft, ChevronRight, X, List, Clock } from 'lucide-react';

interface Annonce {
  id: string; title: string; body: string;
  type?: string; isPinned?: boolean; createdAt: string;
  dateDebut?: string; dateFin?: string;
}

interface Props { annonces: Annonce[]; }

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
               'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const TYPE_CFG: Record<string, { label: string; icon: React.FC<any>; cls: string; bg: string; bar?: string; dot: string }> = {
  INFO:        { label: 'Info',               icon: Info,          cls: 'bg-blue-100 text-blue-700 border-blue-200',       bg: 'border-blue-100',    dot: 'bg-blue-400' },
  WARNING:     { label: 'Important',          icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 border-amber-200',    bg: 'border-amber-100',   dot: 'bg-amber-400' },
  UPDATE:      { label: 'Mise à jour',        icon: Zap,           cls: 'bg-purple-100 text-purple-700 border-purple-200', bg: 'border-purple-100',  dot: 'bg-purple-400' },
  PROMO:       { label: 'Promo',              icon: Tag,           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bg: 'border-emerald-100', dot: 'bg-emerald-400' },
  MAINTENANCE: { label: 'Infos école',        icon: Bell,          cls: 'bg-gray-100 text-gray-700 border-gray-200',       bg: 'border-gray-100',    dot: 'bg-gray-400' },
  URGENT:      { label: 'Urgent',             icon: AlertTriangle, cls: 'bg-red-100 text-red-700 border-red-200',          bg: 'border-red-100',     dot: 'bg-red-500' },
  EVENEMENT:   { label: 'Événement',          icon: Calendar,      cls: 'bg-purple-100 text-purple-700 border-purple-200', bg: 'border-purple-100',  bar: 'from-purple-400 to-violet-400', dot: 'bg-purple-400' },
  FERMETURE:   { label: 'Fermeture',          icon: Home,          cls: 'bg-rose-100 text-rose-600 border-rose-200',       bg: 'border-rose-100',    bar: 'from-rose-400 to-pink-400',     dot: 'bg-rose-400' },
  INSCRIPTION: { label: 'Inscription',        icon: GraduationCap, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bg: 'border-emerald-200', bar: 'from-emerald-400 to-teal-400', dot: 'bg-emerald-400' },
  SORTIE:      { label: 'Sortie scolaire',    icon: MapPin,        cls: 'bg-teal-100 text-teal-700 border-teal-200',       bg: 'border-teal-100',    bar: 'from-teal-400 to-cyan-400',     dot: 'bg-teal-400' },
  REUNION:     { label: 'Réunion',            icon: Users,         cls: 'bg-blue-100 text-blue-700 border-blue-200',       bg: 'border-blue-100',    bar: 'from-blue-400 to-indigo-400',   dot: 'bg-blue-500' },
  FETE:        { label: 'Fête / Spectacle',   icon: PartyPopper,   cls: 'bg-violet-100 text-violet-700 border-violet-200', bg: 'border-violet-100',  bar: 'from-violet-400 to-purple-400', dot: 'bg-violet-400' },
  EXAMEN:      { label: 'Évaluation',         icon: BookOpen,      cls: 'bg-amber-100 text-amber-700 border-amber-200',    bg: 'border-amber-100',   bar: 'from-amber-400 to-yellow-400',  dot: 'bg-amber-400' },
};

function getCfg(type?: string) { return TYPE_CFG[type || ''] || TYPE_CFG.INFO; }

function fmtLong(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Calendrier ───────────────────────────────────────────────────────────────

function CalendrierParent({ annonces, onDaySelect }: {
  annonces: Annonce[];
  onDaySelect: (events: Annonce[]) => void;
}) {
  const now = new Date();
  const [annee, setAnnee] = useState(() => now.getFullYear());
  const [mois,  setMois]  = useState(() => now.getMonth());

  const prevMois = () => { if (mois === 0) { setAnnee(y => y - 1); setMois(11); } else setMois(m => m - 1); };
  const nextMois = () => { if (mois === 11) { setAnnee(y => y + 1); setMois(0);  } else setMois(m => m + 1); };

  const firstDay   = new Date(annee, mois, 1).getDay();
  const offset     = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(annee, mois + 1, 0).getDate();
  const isCurrentMonth = now.getFullYear() === annee && now.getMonth() === mois;

  // Événements avec date positionnés dans ce mois
  const evByDay = useMemo(() => {
    const map: Record<number, Annonce[]> = {};
    annonces.forEach(a => {
      if (!a.dateDebut) return;
      const debut = new Date(a.dateDebut + 'T00:00:00');
      const fin   = a.dateFin ? new Date(a.dateFin + 'T00:00:00') : debut;
      for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === annee && d.getMonth() === mois) {
          const day = d.getDate();
          map[day] = [...(map[day] || []), a];
        }
      }
    });
    return map;
  }, [annonces, annee, mois]);

  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Navigation mois */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
        <button onClick={prevMois} className="w-9 h-9 flex items-center justify-center rounded-2xl hover:bg-purple-100 text-purple-600 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-base font-black text-gray-800">{MOIS[mois]} {annee}</h3>
        <button onClick={nextMois} className="w-9 h-9 flex items-center justify-center rounded-2xl hover:bg-purple-100 text-purple-600 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {['L','M','M','J','V','S','D'].map((j, i) => (
          <div key={i} className="py-2 text-center text-[10px] font-black text-gray-400 uppercase">{j}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="divide-y divide-gray-50">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 divide-x divide-gray-50">
            {row.map((day, di) => {
              if (!day) return <div key={di} className="min-h-[44px] sm:min-h-[60px] bg-gray-50/50" />;
              const dayEvents = evByDay[day] || [];
              const isToday = isCurrentMonth && now.getDate() === day;
              return (
                <button
                  key={di}
                  onClick={() => dayEvents.length > 0 && onDaySelect(dayEvents)}
                  className={`min-h-[44px] sm:min-h-[60px] p-0.5 sm:p-1.5 text-left transition-colors
                    ${dayEvents.length > 0 ? 'hover:bg-purple-50 cursor-pointer' : 'cursor-default'}
                    ${isToday ? 'bg-purple-50' : ''}`}
                >
                  <span className={`inline-flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-black mb-0.5 sm:mb-1
                    ${isToday ? 'bg-purple-600 text-white' : 'text-gray-600'}`}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map(a => {
                      const cfg = getCfg(a.type);
                      return <span key={a.id} className={`w-2 h-2 rounded-full ${cfg.dot}`} />;
                    })}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] text-gray-400 font-bold leading-2">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(TYPE_CFG).filter(([, v]) => v.bar).slice(0, 5).map(([key, v]) => (
          <span key={key} className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500">
            <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Carte événement ──────────────────────────────────────────────────────────

const AnnonceCard: React.FC<{ a: Annonce }> = ({ a }) => {
  const cfg = getCfg(a.type);
  const Icon = cfg.icon;
  const hasBar = a.isPinned ? 'from-amber-400 to-orange-400' : cfg.bar;
  return (
    <div className={`bg-white rounded-3xl border ${a.isPinned ? 'border-amber-300 shadow-lg shadow-amber-50' : cfg.bg} overflow-hidden`}>
      {hasBar && <div className={`h-1.5 bg-gradient-to-r ${hasBar}`} />}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {a.isPinned && (
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <Pin className="w-3 h-3" /> Épinglé
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full border ${cfg.cls}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
          </div>
          <time className="text-sm text-gray-400 font-medium flex-shrink-0">
            {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-3">{a.title}</h3>
        {a.dateDebut && (
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-3">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{fmtLong(a.dateDebut)}{a.dateFin && a.dateFin !== a.dateDebut ? ` → ${fmtLong(a.dateFin)}` : ''}</span>
          </div>
        )}
        {a.body && <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{a.body}</p>}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const ParentActualites: React.FC<Props> = ({ annonces }) => {
  const [view, setView] = useState<'liste' | 'calendrier'>('liste');
  const [selectedDay, setSelectedDay] = useState<Annonce[] | null>(null);

  if (!annonces.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-purple-50 flex items-center justify-center mb-6">
        <Bell className="w-12 h-12 text-purple-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">Pas d'actualités</h3>
      <p className="text-gray-400">Les informations de l'école apparaîtront ici.</p>
    </div>
  );

  const pinned  = annonces.filter(a => a.isPinned);
  const regular = annonces.filter(a => !a.isPinned);
  // Événements avec date (pour le calendrier)
  const avecDate = annonces.filter(a => a.dateDebut);

  return (
    <div className="space-y-6 pb-6">
      {/* En-tête + toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Actualités de l'école</h2>
          <p className="text-gray-500 mt-1">{annonces.length} message{annonces.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 shrink-0">
          <button
            onClick={() => setView('liste')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all
              ${view === 'liste' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="w-3.5 h-3.5" /> Liste
          </button>
          <button
            onClick={() => setView('calendrier')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all
              ${view === 'calendrier' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Calendar className="w-3.5 h-3.5" /> Calendrier
          </button>
        </div>
      </div>

      {/* Vue liste */}
      {view === 'liste' && (
        <>
          {pinned.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                <Pin className="w-4 h-4" /> Épinglés
              </p>
              {pinned.map(a => <AnnonceCard key={a.id} a={a} />)}
            </div>
          )}
          {regular.length > 0 && (
            <div className="space-y-4">
              {pinned.length > 0 && <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Toutes les actualités</p>}
              {regular.map(a => <AnnonceCard key={a.id} a={a} />)}
            </div>
          )}
        </>
      )}

      {/* Vue calendrier */}
      {view === 'calendrier' && (
        <div className="space-y-4">
          <CalendrierParent annonces={avecDate} onDaySelect={setSelectedDay} />

          {/* Événements du mois courant triés par date */}
          {avecDate.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tous les événements</p>
              {[...avecDate].sort((a, b) => (a.dateDebut || '').localeCompare(b.dateDebut || '')).map(a => (
                <AnnonceCard key={a.id} a={a} />
              ))}
            </div>
          )}

          {avecDate.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-10 h-10 text-purple-200 mb-3" />
              <p className="text-gray-400 font-bold">Aucun événement à afficher dans le calendrier.</p>
              <p className="text-gray-300 text-sm mt-1">Les sorties, réunions et fêtes apparaîtront ici.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal détail — événements du jour */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header date */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div>
                <p className="text-[11px] font-black text-purple-500 uppercase tracking-widest mb-1">
                  {selectedDay.length} événement{selectedDay.length > 1 ? 's' : ''}
                </p>
                <h3 className="text-xl font-black text-gray-900 capitalize leading-tight">
                  {selectedDay[0].dateDebut ? fmtLong(selectedDay[0].dateDebut) : 'Événements'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Séparateur */}
            <div className="h-px bg-gray-100 mx-6 shrink-0" />

            {/* Événements */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
              {selectedDay.map(a => {
                const cfg  = getCfg(a.type);
                const Icon = cfg.icon;
                // Parser les lignes du body pour extraire heure et lieu
                const lines     = a.body ? a.body.split('\n').filter(Boolean) : [];
                const timeLine  = lines.find(l => l.startsWith('⏰'));
                const locLine   = lines.find(l => l.startsWith('📍'));
                const descLines = lines.filter(l => !l.startsWith('⏰') && !l.startsWith('📍'));
                const timeText  = timeLine?.replace(/^⏰\s*/, '');
                const locText   = locLine?.replace(/^📍\s*/, '');

                return (
                  <div key={a.id} className="rounded-3xl overflow-hidden shadow-md border border-gray-100">

                    {/* Hero gradient */}
                    <div className={`bg-gradient-to-br ${cfg.bar || 'from-gray-400 to-gray-600'} px-5 py-6`}>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                          <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <span className="inline-block text-[10px] font-black text-white/70 uppercase tracking-widest mb-2 bg-white/15 px-2.5 py-0.5 rounded-full">
                            {cfg.label}
                          </span>
                          <h4 className="text-2xl font-black text-white leading-tight">{a.title}</h4>
                        </div>
                      </div>
                    </div>

                    {/* Infos */}
                    <div className="bg-white px-5 py-4 space-y-3">
                      {/* Date */}
                      {a.dateDebut && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-purple-500" />
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            <span className="capitalize">{fmtLong(a.dateDebut)}</span>
                            {a.dateFin && a.dateFin !== a.dateDebut && (
                              <span className="text-gray-400 font-medium block text-xs mt-0.5">
                                jusqu'au {fmtLong(a.dateFin)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Heure */}
                      {timeText && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-amber-500" />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{timeText}</span>
                        </div>
                      )}

                      {/* Lieu */}
                      {locText && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-teal-500" />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{locText}</span>
                        </div>
                      )}

                      {/* Description */}
                      {descLines.length > 0 && (
                        <div className="pt-1 border-t border-gray-50 mt-2">
                          {descLines.map((line, i) => (
                            <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fermer */}
            <div className="px-5 pb-5 pt-3 shrink-0 bg-white border-t border-gray-100">
              <button
                onClick={() => setSelectedDay(null)}
                className="w-full py-4 rounded-2xl bg-gray-900 hover:bg-gray-700 text-white font-black text-sm transition-all shadow-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentActualites;
