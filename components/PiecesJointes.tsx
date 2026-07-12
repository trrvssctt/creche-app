import React, { useState } from 'react';
import { Paperclip, CheckCircle2, X, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { piecesForNiveau, PieceJointe } from '../services/piecesJustificatives';
import { fileToDataUrl } from '../services/photoUtils';

// Checklist des pièces justificatives avec upload par pièce.
// Utilisée dans les 3 formulaires d'admission (public, parent, admin).
// `value` est indexé par code de pièce (EXTRAIT_NAISSANCE, …).

interface Props {
  niveau: string | undefined;
  value: Record<string, PieceJointe>;
  onChange: (v: Record<string, PieceJointe>) => void;
  title?: string;
}

const PiecesJointes: React.FC<Props> = ({ niveau, value, onChange, title }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (code: string, label: string, file: File | undefined) => {
    if (!file) return;
    setBusy(code); setError(null);
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file);
      onChange({
        ...value,
        [code]: {
          typeDoc: code,
          nom: `${label} — ${file.name}`.slice(0, 255),
          dataUrl,
          mimeType,
          fileSize: Math.round(dataUrl.length * 0.75),
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Fichier illisible.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (code: string) => {
    const next = { ...value };
    delete next[code];
    onChange(next);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-2">
        <Paperclip size={13} /> {title || 'Pièces justificatives'}
      </p>
      <p className="text-xs text-slate-500 mb-3">
        Joignez chaque document en photo (JPG, PNG) ou en PDF — 3 Mo maximum par fichier.
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
        </div>
      )}

      <ul className="space-y-2">
        {piecesForNiveau(niveau).map(p => {
          const joint = value[p.code];
          return (
            <li key={p.code}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                joint ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              {joint
                ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                : <FileText size={16} className="text-slate-300 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-700 leading-tight">
                  {p.label}
                  {p.obligatoire
                    ? <span className="text-rose-500"> *</span>
                    : <span className="text-slate-400 font-medium"> (si applicable)</span>}
                </p>
                {joint && (
                  <p className="text-[10px] text-emerald-600 font-bold truncate">
                    Joint — {(joint.fileSize / 1024).toFixed(0)} Ko
                  </p>
                )}
              </div>
              {joint ? (
                <button type="button" onClick={() => remove(p.code)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition flex-shrink-0"
                  title="Retirer ce fichier">
                  <X size={14} />
                </button>
              ) : (
                <label className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition flex items-center gap-1.5 flex-shrink-0 ${
                  busy === p.code
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-indigo-600 text-white active:bg-indigo-700 hover:bg-indigo-700'}`}>
                  {busy === p.code
                    ? <><Loader2 size={12} className="animate-spin" /> Lecture…</>
                    : <><Paperclip size={12} /> Joindre</>}
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    disabled={busy !== null}
                    onChange={e => { handleFile(p.code, p.label, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[9px] text-amber-600 font-bold mt-2">
        * Obligatoire — les pièces jointes seront versées au dossier numérique de l'élève.
      </p>
    </div>
  );
};

export default PiecesJointes;
