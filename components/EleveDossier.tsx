import React, { useState, useEffect, useRef } from 'react';
import {
  X, FolderOpen, Folder, FileText, Upload, Trash2, Download,
  ChevronRight, Home, Calendar, ShieldCheck, GraduationCap,
  RefreshCw, AlertCircle, Plus, Eye, Image, File,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EleveInfo {
  id: string;
  nom: string;
  prenom: string;
  matricule?: string;
}

interface EleveDocumentRecord {
  id: string;
  categorie: 'ADMINISTRATIF' | 'ACADEMIQUE';
  anneeScolaire?: string;
  typeDoc: string;
  nom: string;
  fileUrl: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
}

interface AnneeRow {
  anneeScolaire: string;
  total: string;
}

type View =
  | { level: 'ROOT' }
  | { level: 'ADMIN' }
  | { level: 'ANNEES' }
  | { level: 'ANNEE_DOCS'; annee: string };

interface Props {
  eleve: EleveInfo;
  onClose: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_ADMIN = [
  { value: 'FICHE_SANITAIRE',       label: 'Fiche sanitaire' },
  { value: 'ACTE_NAISSANCE',        label: 'Acte de naissance' },
  { value: 'EXTRAIT_NAISSANCE',     label: 'Extrait de naissance' },
  { value: 'CARNET_VACCINATION',    label: 'Carnet de vaccination' },
  { value: 'PHOTO_IDENTITE',        label: "Photo d'identité" },
  { value: 'PHOTOS_IDENTITE',       label: "Photos d'identité" },
  { value: 'CNI_PARENT',            label: 'Pièce d\'identité parent' },
  { value: 'CONTRAT_SCOLARISATION', label: 'Contrat de scolarisation' },
  { value: 'REGLEMENT_INTERIEUR',   label: 'Règlement intérieur' },
  { value: 'AUTORISATION_SORTIE',   label: 'Autorisation de sortie' },
  { value: 'CERTIFICAT_MEDICAL',    label: 'Certificat médical' },
  { value: 'ORDONNANCE',            label: 'Ordonnance' },
  { value: 'LIVRET_SCOLAIRE',       label: 'Livret scolaire' },
  { value: 'AUTRE',                 label: 'Autre' },
];

const TYPES_ACADEMIQUE = [
  { value: 'BULLETIN',              label: 'Bulletin de notes' },
  { value: 'CONTRAT_INSCRIPTION',   label: "Contrat d'inscription" },
  { value: 'ATTESTATION',           label: 'Attestation de scolarité' },
  { value: 'AUTORISATION_PHOTO',    label: 'Autorisation photo' },
  { value: 'RAPPORT',               label: 'Rapport pédagogique' },
  { value: 'AUTRE',                 label: 'Autre' },
];

function typeLabel(typeDoc: string, categorie: 'ADMINISTRATIF' | 'ACADEMIQUE'): string {
  const list = categorie === 'ADMINISTRATIF' ? TYPES_ADMIN : TYPES_ACADEMIQUE;
  return list.find(t => t.value === typeDoc)?.label ?? typeDoc;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function FileIcon({ mimeType, size = 18 }: { mimeType?: string; size?: number }) {
  if (!mimeType) return <File size={size} className="text-slate-400" />;
  if (mimeType.startsWith('image/')) return <Image size={size} className="text-violet-500" />;
  if (mimeType === 'application/pdf') return <FileText size={size} className="text-rose-500" />;
  return <File size={size} className="text-indigo-400" />;
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  categorie: 'ADMINISTRATIF' | 'ACADEMIQUE';
  annee?: string;
  onClose: () => void;
  onDone: () => void;
  eleveId: string;
}

const UploadModal: React.FC<UploadModalProps> = ({ categorie, annee, onClose, onDone, eleveId }) => {
  const showToast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [nom, setNom] = useState('');
  const [typeDoc, setTypeDoc] = useState(categorie === 'ADMINISTRATIF' ? 'FICHE_SANITAIRE' : 'BULLETIN');
  const [anneeScolaire, setAnneeScolaire] = useState(annee || '');
  const [uploading, setUploading] = useState(false);

  const types = categorie === 'ADMINISTRATIF' ? TYPES_ADMIN : TYPES_ACADEMIQUE;

  const handleFile = (f: File) => {
    setFile(f);
    if (!nom) setNom(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async () => {
    if (!file) return showToast('Veuillez sélectionner un fichier.', 'error');
    if (!nom.trim()) return showToast('Veuillez saisir un nom.', 'error');
    if (categorie === 'ACADEMIQUE' && !anneeScolaire.trim())
      return showToast("L'année scolaire est requise.", 'error');

    setUploading(true);
    try {
      // 1. Upload S3
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `eleves/${eleveId}/dossier`);
      const up = await apiClient.request('/upload', { method: 'POST', body: fd });

      // 2. Save metadata
      await apiClient.post(`/eleves/${eleveId}/dossier`, {
        categorie,
        anneeScolaire: categorie === 'ACADEMIQUE' ? anneeScolaire.trim() : undefined,
        typeDoc,
        nom: nom.trim(),
        fileUrl: up.url,
        s3Key: up.publicId || up.key || null,
        mimeType: up.mimeType,
        fileSize: up.sizeBytes,
      });

      showToast('Document ajouté avec succès.', 'success');
      onDone();
    } catch (err: any) {
      showToast(err?.message ?? "Erreur lors de l'upload.", 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Upload size={14} className="text-indigo-500" />
            Ajouter un document
          </p>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-indigo-50/30"
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-indigo-700">
              <FileIcon mimeType={file.type} size={20} />
              <span>{file.name}</span>
              <span className="text-xs text-slate-400 font-normal">({formatSize(file.size)})</span>
            </div>
          ) : (
            <div>
              <Upload size={24} className="mx-auto text-indigo-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Cliquer ou glisser-déposer</p>
              <p className="text-[10px] text-slate-400 mt-1">PDF, image, Word, Excel — 50 Mo max</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {/* Nom */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nom du document *</label>
          <input
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Ex. Fiche sanitaire 2025"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type *</label>
          <select
            value={typeDoc}
            onChange={e => setTypeDoc(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-semibold outline-none focus:ring-2 focus:ring-indigo-400 appearance-none"
          >
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Année (académique seulement) */}
        {categorie === 'ACADEMIQUE' && !annee && (
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Année scolaire *</label>
            <input
              value={anneeScolaire}
              onChange={e => setAnneeScolaire(e.target.value)}
              placeholder="Ex. 2025-2026"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
        {categorie === 'ACADEMIQUE' && annee && (
          <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5">
            Année : <span className="font-black">{annee}</span>
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading || !file}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
        >
          {uploading ? <><RefreshCw size={12} className="animate-spin" /> Upload en cours…</> : <><Upload size={12} /> Enregistrer</>}
        </button>
      </div>
    </div>
  );
};

// ─── Composant principal EleveDossier ─────────────────────────────────────────

export const EleveDossier: React.FC<Props> = ({ eleve, onClose }) => {
  const showToast = useToast();
  const [view, setView] = useState<View>({ level: 'ROOT' });
  const [docs, setDocs] = useState<EleveDocumentRecord[]>([]);
  const [annees, setAnnees] = useState<AnneeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EleveDocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAdmin = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/eleves/${eleve.id}/dossier/admin`);
      setDocs(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchAnnees = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/eleves/${eleve.id}/dossier/academique`);
      setAnnees(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchAnneeDoc = async (annee: string) => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/eleves/${eleve.id}/dossier/academique/${encodeURIComponent(annee)}`);
      setDocs(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (view.level === 'ADMIN')      fetchAdmin();
    if (view.level === 'ANNEES')     fetchAnnees();
    if (view.level === 'ANNEE_DOCS') fetchAnneeDoc((view as any).annee);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/eleves/${eleve.id}/dossier/${deleteConfirm.id}`);
      showToast('Document supprimé.', 'success');
      setDeleteConfirm(null);
      // Refresh
      if (view.level === 'ADMIN')      fetchAdmin();
      if (view.level === 'ANNEE_DOCS') fetchAnneeDoc((view as any).annee);
    } catch (err: any) {
      showToast(err?.message ?? 'Erreur lors de la suppression.', 'error');
    } finally { setDeleting(false); }
  };

  // ── Breadcrumb ──
  const breadcrumbs: { label: string; onClick: () => void }[] = [
    { label: `${eleve.prenom} ${eleve.nom.toUpperCase()}`, onClick: () => setView({ level: 'ROOT' }) },
  ];
  if (view.level === 'ADMIN') breadcrumbs.push({ label: 'Documents administratifs', onClick: () => {} });
  if (view.level === 'ANNEES') breadcrumbs.push({ label: 'Documents académiques', onClick: () => {} });
  if (view.level === 'ANNEE_DOCS') {
    breadcrumbs.push({ label: 'Documents académiques', onClick: () => setView({ level: 'ANNEES' }) });
    breadcrumbs.push({ label: (view as any).annee, onClick: () => {} });
  }

  const canUpload = view.level === 'ADMIN' || view.level === 'ANNEE_DOCS';
  const uploadCategorie: 'ADMINISTRATIF' | 'ACADEMIQUE' = view.level === 'ADMIN' ? 'ADMINISTRATIF' : 'ACADEMIQUE';
  const uploadAnnee = view.level === 'ANNEE_DOCS' ? (view as any).annee : undefined;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <FolderOpen size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-800">Dossier de l'élève</p>
            <p className="text-[10px] text-slate-400 font-bold">
              {eleve.prenom} {eleve.nom.toUpperCase()}
              {eleve.matricule && <> · <span className="font-black text-indigo-500">{eleve.matricule}</span></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Plus size={12} /> Ajouter
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex items-center gap-1 text-[10px] font-bold text-slate-500">
        <Home size={11} className="shrink-0" />
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={i}>
            <ChevronRight size={10} className="text-slate-300 shrink-0" />
            <button
              onClick={b.onClick}
              className={i === breadcrumbs.length - 1
                ? 'text-indigo-600 font-black cursor-default'
                : 'hover:text-indigo-500 transition-colors'}
            >
              {b.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ROOT — 2 dossiers principaux */}
        {view.level === 'ROOT' && (
          <div className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button
              onClick={() => setView({ level: 'ADMIN' })}
              className="group bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 text-left transition-all shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-200 rounded-xl flex items-center justify-center mb-4 transition-colors">
                <ShieldCheck size={22} className="text-indigo-600" />
              </div>
              <p className="text-sm font-black text-slate-800 mb-1">Documents administratifs</p>
              <p className="text-[10px] text-slate-400 font-semibold leading-snug">
                Fiche sanitaire, acte de naissance, contrats, autorisations…
              </p>
            </button>

            <button
              onClick={() => setView({ level: 'ANNEES' })}
              className="group bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 text-left transition-all shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center mb-4 transition-colors">
                <GraduationCap size={22} className="text-emerald-600" />
              </div>
              <p className="text-sm font-black text-slate-800 mb-1">Documents académiques</p>
              <p className="text-[10px] text-slate-400 font-semibold leading-snug">
                Bulletins, contrats d'inscription, attestations par année scolaire…
              </p>
            </button>
          </div>
        )}

        {/* ADMIN ou ANNEE_DOCS — liste de documents */}
        {(view.level === 'ADMIN' || view.level === 'ANNEE_DOCS') && (
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-xs font-bold">Chargement…</span>
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <FolderOpen size={40} className="text-slate-200" />
                <p className="text-xs font-black uppercase tracking-widest">Aucun document</p>
                <p className="text-[10px] font-semibold">Cliquez sur "Ajouter" pour déposer un fichier.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className="group bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <div className="shrink-0">
                      <FileIcon mimeType={doc.mimeType} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{doc.nom}</p>
                      <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                          {typeLabel(doc.typeDoc, doc.categorie)}
                        </span>
                        {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                        <span>{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Voir"
                      >
                        <Eye size={14} className="text-indigo-500" />
                      </a>
                      <a
                        href={doc.fileUrl}
                        download={doc.nom}
                        className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Télécharger"
                      >
                        <Download size={14} className="text-emerald-500" />
                      </a>
                      <button
                        onClick={() => setDeleteConfirm(doc)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} className="text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANNEES — liste des dossiers par année */}
        {view.level === 'ANNEES' && (
          <div className="max-w-xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-xs font-bold">Chargement…</span>
              </div>
            ) : annees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <FolderOpen size={40} className="text-slate-200" />
                <p className="text-xs font-black uppercase tracking-widest">Aucune année disponible</p>
                <p className="text-[10px] font-semibold text-center">
                  Les documents académiques apparaîtront ici classés par année scolaire.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {annees.map(row => (
                  <button
                    key={row.anneeScolaire}
                    onClick={() => setView({ level: 'ANNEE_DOCS', annee: row.anneeScolaire })}
                    className="group bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                      <Calendar size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{row.anneeScolaire}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        {row.total} document{Number(row.total) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Bouton ajouter dans un nouvelle année */}
            <div className="mt-4">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={12} /> Ajouter un document académique
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          categorie={uploadCategorie}
          annee={uploadAnnee}
          eleveId={eleve.id}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false);
            if (view.level === 'ADMIN')      fetchAdmin();
            if (view.level === 'ANNEES')     fetchAnnees();
            if (view.level === 'ANNEE_DOCS') fetchAnneeDoc((view as any).annee);
          }}
        />
      )}

      {/* Confirm delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertCircle size={18} className="text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Supprimer ce document ?</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">"{deleteConfirm.nom}"</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-semibold">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {deleting ? <><RefreshCw size={11} className="animate-spin" /> Suppression…</> : <><Trash2 size={11} /> Supprimer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EleveDossier;
