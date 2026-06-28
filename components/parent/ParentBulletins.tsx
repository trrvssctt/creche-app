import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, TrendingUp, Award } from 'lucide-react';

interface SousMatiere {
  nom: string; note: number | string | ''; coefficient: number;
}

interface Matiere {
  nom: string; coefficient: number; appreciation?: string;
  // Structure admin (avec sous-matières détaillées)
  sousMatieres?: SousMatiere[];
  // Structure ancienne à plat (rétrocompat)
  note?: number | string;
}

interface Bulletin {
  id: string; eleveId: string; trimestre: string; anneeScolaire: string;
  moyenneGenerale?: number | string; rang?: number; appreciation?: string;
  appreciationGenerale?: string;
  eleve?: { nom: string; prenom: string; niveau: string };
  matieres?: Matiere[];
}

interface Props { bulletins: Bulletin[]; }

const TRIMESTRE_LABEL: Record<string, string> = {
  T1: '1er Trimestre', T2: '2ème Trimestre', T3: '3ème Trimestre',
};

// Calcule la note effective d'une matière (moyenne pondérée des sous-matières, ou note directe)
function getMoyenneMatiere(m: Matiere): number | null {
  // Structure plate (note directe)
  if (m.note !== undefined && m.note !== '' && m.note !== null) {
    const n = Number(m.note);
    return isNaN(n) ? null : n;
  }
  // Structure avec sous-matières
  if (m.sousMatieres && m.sousMatieres.length > 0) {
    const saisies = m.sousMatieres.filter(s => s.note !== '' && s.note !== null && s.note !== undefined);
    if (!saisies.length) return null;
    const totalPts   = saisies.reduce((acc, s) => acc + (Number(s.note) * s.coefficient), 0);
    const totalCoeff = saisies.reduce((acc, s) => acc + s.coefficient, 0);
    if (totalCoeff === 0) return null;
    return Math.round((totalPts / totalCoeff) * 100) / 100;
  }
  return null;
}

const getMoyColor = (n?: number | string) => {
  const v = Number(n);
  if (isNaN(v)) return { txt: 'text-gray-500', bg: 'bg-gray-100', bar: 'bg-gray-300' };
  if (v >= 16)  return { txt: 'text-emerald-600', bg: 'bg-emerald-50',  bar: 'bg-emerald-400' };
  if (v >= 12)  return { txt: 'text-blue-600',    bg: 'bg-blue-50',     bar: 'bg-blue-400' };
  if (v >= 10)  return { txt: 'text-amber-600',   bg: 'bg-amber-50',    bar: 'bg-amber-400' };
  return           { txt: 'text-red-600',     bg: 'bg-red-50',      bar: 'bg-red-400' };
};

const getMention = (n?: number | string) => {
  const v = Number(n);
  if (isNaN(v)) return null;
  if (v >= 16) return 'Très bien';
  if (v >= 14) return 'Bien';
  if (v >= 12) return 'Assez bien';
  if (v >= 10) return 'Passable';
  return 'Insuffisant';
};

const ParentBulletins: React.FC<Props> = ({ bulletins }) => {
  const [expanded, setExpanded] = useState<string | null>(bulletins[0]?.id || null);

  if (!bulletins.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6">
        <BookOpen className="w-12 h-12 text-indigo-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">Aucun bulletin</h3>
      <p className="text-gray-400">Les bulletins seront disponibles après chaque trimestre.</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="text-2xl font-black text-gray-800">Bulletins scolaires</h2>
        <p className="text-gray-500 mt-1">{bulletins.length} bulletin{bulletins.length > 1 ? 's' : ''} disponible{bulletins.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-4">
        {bulletins.map(b => {
          const isOpen = expanded === b.id;
          const col = getMoyColor(b.moyenneGenerale);
          const mention = getMention(b.moyenneGenerale);
          const appText = b.appreciationGenerale || b.appreciation;

          return (
            <div key={b.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* En-tête cliquable */}
              <button onClick={() => setExpanded(isOpen ? null : b.id)}
                className="w-full text-left p-4 sm:p-6 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-3 sm:gap-5">
                  {/* Cercle moyenne */}
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${col.bg} flex flex-col items-center justify-center flex-shrink-0 border border-current/10`}>
                    {b.moyenneGenerale !== undefined ? (
                      <>
                        <span className={`text-xl sm:text-2xl font-black ${col.txt}`}>{Number(b.moyenneGenerale).toFixed(1)}</span>
                        <span className={`text-xs font-bold ${col.txt} opacity-60`}>/20</span>
                      </>
                    ) : (
                      <BookOpen className={`w-7 h-7 ${col.txt} opacity-40`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-gray-900">
                          {TRIMESTRE_LABEL[b.trimestre] || b.trimestre} — {b.anneeScolaire}
                        </p>
                        {b.eleve && (
                          <p className="text-sm text-gray-500 mt-0.5">{b.eleve.prenom} {b.eleve.nom} · {b.eleve.niveau}</p>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />}
                    </div>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {mention && (
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${col.bg} ${col.txt}`}>{mention}</span>
                      )}
                      {b.rang && (
                        <span className="text-sm font-bold px-3 py-1 rounded-full bg-purple-50 text-purple-700 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" /> {b.rang}<sup>e</sup> de la classe
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Détails */}
              {isOpen && (
                <div className="border-t border-gray-100 px-3 sm:px-6 pb-5 sm:pb-6 pt-4 sm:pt-5 space-y-5">
                  {/* Barre de progression */}
                  {b.moyenneGenerale !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm font-semibold text-gray-500 mb-2">
                        <span>Moyenne générale</span>
                        <span className={col.txt}>{Number(b.moyenneGenerale).toFixed(2)} / 20</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${col.bar} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min(100, (Number(b.moyenneGenerale) / 20) * 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Appréciation */}
                  {appText && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Appréciation du conseil de classe</p>
                      <p className="text-gray-800 italic text-base leading-relaxed">"{appText}"</p>
                    </div>
                  )}

                  {/* Matières */}
                  {b.matieres && b.matieres.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Notes par matière</p>
                      <div className="space-y-3">
                        {b.matieres.map((m, i) => {
                          const moy = getMoyenneMatiere(m);
                          const mc  = getMoyColor(moy ?? undefined);
                          const pct = moy !== null ? Math.min(100, (moy / 20) * 100) : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center gap-2 sm:gap-4">
                                <span className="text-xs sm:text-sm font-semibold text-gray-700 w-24 sm:w-36 flex-shrink-0 leading-tight">{m.nom}</span>
                                <div className="flex-1 h-2 sm:h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${mc.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={`text-sm font-black ${mc.txt} w-10 sm:w-14 text-right flex-shrink-0`}>
                                  {moy !== null ? moy.toFixed(1) : '—'}
                                </span>
                                <span className="text-[10px] text-gray-400 w-12 sm:w-14 flex-shrink-0 hidden xs:block">c.{m.coefficient}</span>
                              </div>
                              {/* Sous-matières (détail) */}
                              {m.sousMatieres && m.sousMatieres.length > 1 && (
                                <div className="ml-24 sm:ml-36 mt-1 space-y-0.5">
                                  {m.sousMatieres.filter(s => s.note !== '' && s.note !== null && s.note !== undefined).map((s, si) => (
                                    <div key={si} className="flex items-center gap-2 text-xs text-gray-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                      <span className="flex-1 truncate">{s.nom}</span>
                                      <span className="font-bold text-gray-500">{Number(s.note).toFixed(1)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {m.appreciation && (
                                <p className="ml-24 sm:ml-36 mt-0.5 text-xs italic text-indigo-500">{m.appreciation}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParentBulletins;
