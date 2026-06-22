import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, TrendingUp, Award } from 'lucide-react';

interface Bulletin {
  id: string; eleveId: string; trimestre: string; anneeScolaire: string;
  moyenneGenerale?: number | string; rang?: number; appreciation?: string;
  appreciationGenerale?: string;
  eleve?: { nom: string; prenom: string; niveau: string };
  matieres?: Array<{ nom: string; note: number; coefficient: number; appreciation?: string }>;
}

interface Props { bulletins: Bulletin[]; }

const TRIMESTRE_LABEL: Record<string, string> = {
  T1: '1er Trimestre', T2: '2ème Trimestre', T3: '3ème Trimestre',
};

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
                className="w-full text-left p-6 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-5">
                  {/* Cercle moyenne */}
                  <div className={`w-20 h-20 rounded-2xl ${col.bg} flex flex-col items-center justify-center flex-shrink-0 border border-current/10`}>
                    {b.moyenneGenerale !== undefined ? (
                      <>
                        <span className={`text-2xl font-black ${col.txt}`}>{Number(b.moyenneGenerale).toFixed(1)}</span>
                        <span className={`text-xs font-bold ${col.txt} opacity-60`}>/20</span>
                      </>
                    ) : (
                      <BookOpen className={`w-8 h-8 ${col.txt} opacity-40`} />
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
                <div className="border-t border-gray-100 px-6 pb-6 pt-5 space-y-5">
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
                      <div className="space-y-2">
                        {b.matieres.map((m, i) => {
                          const mc = getMoyColor(m.note);
                          const pct = Math.min(100, (m.note / 20) * 100);
                          return (
                            <div key={i} className="flex items-center gap-4">
                              <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0 truncate">{m.nom}</span>
                              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${mc.bar} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-sm font-black ${mc.txt} w-12 text-right flex-shrink-0`}>
                                {Number(m.note).toFixed(1)}
                              </span>
                              <span className="text-xs text-gray-400 w-14 flex-shrink-0">coeff {m.coefficient}</span>
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
