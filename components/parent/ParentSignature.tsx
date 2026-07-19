import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool, Check, RotateCcw, FileText, CheckCircle2, Clock,
  Loader2, AlertCircle, Download,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { downloadAdminDocAsPdf, type DocAdminType } from '../../services/adminDocsPdf';

interface Props {
  onRefresh?: () => void;
}

interface DocASigner {
  eleveId: string;
  eleveNom: string;
  eleveNiveau: string;
  typeDoc: string;
  signe: boolean;
  dateSigne: string | null;
}

const DOC_LABELS: Record<string, string> = {
  fiche_inscription: "Fiche d'inscription",
  convention_scolarite: 'Convention de scolarité',
  autorisation_sortie: 'Autorisation de sortie',
  fiche_sanitaire: 'Fiche sanitaire',
  autorisation_soins: 'Autorisation de soins',
  reglement_interieur: 'Règlement intérieur',
};

const DOC_COLORS: Record<string, string> = {
  fiche_inscription: 'border-blue-200 bg-blue-50',
  convention_scolarite: 'border-indigo-200 bg-indigo-50',
  autorisation_sortie: 'border-amber-200 bg-amber-50',
  fiche_sanitaire: 'border-emerald-200 bg-emerald-50',
  autorisation_soins: 'border-rose-200 bg-rose-50',
  reglement_interieur: 'border-slate-200 bg-slate-50',
};

const ParentSignature: React.FC<Props> = ({ onRefresh }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocASigner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sigData, docsData] = await Promise.all([
        apiClient.get('/parent/signature'),
        apiClient.get('/parent/documents-a-signer'),
      ]);
      setSignatureUrl(sigData?.signatureUrl || null);
      setDocs(docsData || []);
    } catch (err) {
      console.error('Fetch signature data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Canvas setup — configure context every time signatureUrl changes (pad visibility toggles)
  useEffect(() => {
    const t = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e293b';
    }, 50);
    return () => clearTimeout(t);
  }, [signatureUrl]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const result = await apiClient.post('/parent/signature', { signatureDataUrl: dataUrl });
      setSignatureUrl(result?.signatureUrl || dataUrl);
      clearCanvas();
    } catch (err) {
      console.error('Save signature:', err);
      alert('Erreur lors de la sauvegarde de la signature.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignDoc = async (doc: DocASigner) => {
    if (!signatureUrl) {
      alert('Veuillez d\'abord enregistrer votre signature.');
      return;
    }
    const key = `${doc.eleveId}:${doc.typeDoc}`;
    setSigning(key);
    try {
      await apiClient.post('/parent/signer-document', { eleveId: doc.eleveId, typeDoc: doc.typeDoc });
      setDocs(prev => prev.map(d =>
        d.eleveId === doc.eleveId && d.typeDoc === doc.typeDoc
          ? { ...d, signe: true, dateSigne: new Date().toISOString() }
          : d
      ));
      onRefresh?.();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erreur lors de la signature.');
    } finally {
      setSigning(null);
    }
  };

  const handleViewDoc = async (doc: DocASigner) => {
    try {
      const eleve = await apiClient.get(`/parent/enfants/${doc.eleveId}`);
      if (eleve) {
        await downloadAdminDocAsPdf(doc.typeDoc as DocAdminType, eleve);
      }
    } catch {
      alert('Erreur lors de la génération du document.');
    }
  };

  const totalDocs = docs.length;
  const signesCount = docs.filter(d => d.signe).length;
  const enAttenteCount = totalDocs - signesCount;

  // Group by eleve
  const grouped = docs.reduce<Record<string, DocASigner[]>>((acc, d) => {
    if (!acc[d.eleveNom]) acc[d.eleveNom] = [];
    acc[d.eleveNom].push(d);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PenTool size={20} className="text-indigo-600" />
            Signature & Documents
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Signez vos documents d'inscription directement en ligne
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={13} /> {signesCount} signé(s)
          </div>
          {enAttenteCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold flex items-center gap-1.5">
              <Clock size={13} /> {enAttenteCount} en attente
            </div>
          )}
        </div>
      </div>

      {/* Signature pad */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <PenTool size={14} className="text-indigo-500" />
            {signatureUrl ? 'Votre signature' : 'Enregistrer votre signature'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {signatureUrl
              ? 'Votre signature est enregistrée. Vous pouvez la modifier à tout moment.'
              : 'Dessinez votre signature dans le cadre ci-dessous. Elle sera apposée sur tous les documents que vous signerez.'}
          </p>
        </div>
        <div className="p-5">
          {signatureUrl && !hasDrawn ? (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-center">
                <img src={signatureUrl} alt="Signature" className="max-h-24 object-contain" />
              </div>
              <button
                onClick={() => setSignatureUrl(null)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
              >
                <RotateCcw size={13} /> Modifier ma signature
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white relative">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-slate-300 text-sm font-medium">Dessinez votre signature ici</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearCanvas}
                  disabled={!hasDrawn}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <RotateCcw size={13} /> Effacer
                </button>
                <button
                  onClick={handleSaveSignature}
                  disabled={!hasDrawn || saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Enregistrer ma signature
                </button>
                {signatureUrl && (
                  <button
                    onClick={() => { clearCanvas(); setSignatureUrl(signatureUrl); }}
                    className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents à signer */}
      {!signatureUrl && enAttenteCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Signature requise</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Veuillez d'abord enregistrer votre signature ci-dessus avant de pouvoir signer les documents.
            </p>
          </div>
        </div>
      )}

      {(Object.entries(grouped) as [string, DocASigner[]][]).map(([eleveNom, elevesDocs]) => (
        <div key={eleveNom} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">{eleveNom}</h3>
              <p className="text-xs text-slate-400">{elevesDocs[0]?.eleveNiveau}</p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {elevesDocs.filter(d => d.signe).length}/{elevesDocs.length} signé(s)
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {elevesDocs.map(doc => {
              const key = `${doc.eleveId}:${doc.typeDoc}`;
              const colorClass = DOC_COLORS[doc.typeDoc] || 'border-slate-200 bg-slate-50';
              return (
                <div key={key} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colorClass}`}>
                      <FileText size={16} className="text-current opacity-70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{DOC_LABELS[doc.typeDoc] || doc.typeDoc}</p>
                      {doc.signe && doc.dateSigne && (
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          Signé le {new Date(doc.dateSigne).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDoc(doc)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      title="Voir le document"
                    >
                      <Download size={14} />
                    </button>
                    {doc.signe ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={12} /> Signé
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSignDoc(doc)}
                        disabled={!signatureUrl || signing === key}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {signing === key ? <Loader2 size={12} className="animate-spin" /> : <PenTool size={12} />}
                        Signer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {totalDocs === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-600 font-medium">Aucun document en attente</p>
          <p className="text-xs text-slate-400 mt-1">Tous les documents seront listés ici après l'inscription de votre enfant.</p>
        </div>
      )}
    </div>
  );
};

export default ParentSignature;
