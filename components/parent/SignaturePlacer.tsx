import React, { useState, useRef, useCallback } from 'react';
import { X, Check, Move, MousePointerClick, Loader2 } from 'lucide-react';

interface Props {
  docImageUrl: string;
  signatureUrl: string;
  docLabel: string;
  onConfirm: (position: { xPercent: number; yPercent: number }) => void;
  onCancel: () => void;
  loading?: boolean;
}

const SignaturePlacer: React.FC<Props> = ({
  docImageUrl, signatureUrl, docLabel, onConfirm, onCancel, loading,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [sigPos, setSigPos] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSigPos({
      xPercent: ((e.clientX - rect.left) / rect.width) * 100,
      yPercent: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [isDragging]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (rect.left + rect.width / 2),
      y: e.clientY - (rect.top + rect.height / 2),
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !imgRef.current) return;
    e.preventDefault();
    const imgRect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - dragOffset.current.x - imgRect.left;
    const y = e.clientY - dragOffset.current.y - imgRect.top;
    setSigPos({
      xPercent: Math.max(5, Math.min(95, (x / imgRect.width) * 100)),
      yPercent: Math.max(2, Math.min(98, (y / imgRect.height) * 100)),
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => setIsDragging(false), []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{docLabel}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MousePointerClick size={12} className="text-indigo-500 shrink-0" />
            {sigPos ? 'Cliquez ailleurs ou déplacez pour repositionner' : 'Cliquez sur le document pour placer votre signature'}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0 ml-3">
          <X size={18} />
        </button>
      </div>

      {/* Document preview */}
      <div className="flex-1 overflow-auto bg-slate-700 p-3 sm:p-6">
        <div className="relative mx-auto" style={{ maxWidth: 794 }}>
          <img
            ref={imgRef}
            src={docImageUrl}
            onClick={handleImageClick}
            className="w-full shadow-2xl cursor-crosshair select-none rounded-sm"
            draggable={false}
            alt="Aperçu du document"
          />

          {sigPos && (
            <div
              className="absolute touch-none"
              style={{
                left: `${sigPos.xPercent}%`,
                top: `${sigPos.yPercent}%`,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="relative">
                <div className="absolute -inset-2 border-2 border-indigo-400 border-dashed rounded-lg" />
                <img
                  src={signatureUrl}
                  className="h-10 sm:h-12 w-auto pointer-events-none select-none"
                  alt="Votre signature"
                  draggable={false}
                />
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1 shadow">
                  <Move size={10} /> Déplacer
                </div>
              </div>
            </div>
          )}

          {!sigPos && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 backdrop-blur-sm text-white px-6 py-4 rounded-2xl text-center">
                <MousePointerClick size={32} className="mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold">Cliquez pour placer votre signature</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          onClick={() => sigPos && onConfirm(sigPos)}
          disabled={!sigPos || loading}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Confirmer et signer
        </button>
      </div>
    </div>
  );
};

export default SignaturePlacer;
