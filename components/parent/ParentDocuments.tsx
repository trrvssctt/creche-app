import React, { useRef, useState } from 'react';
import {
  FileText, Upload, Download, Loader2, CheckCircle2, File, FilePlus,
  GraduationCap, ClipboardList, Receipt, FolderOpen, ShieldCheck, Archive,
  Trash2, AlertCircle, X,
} from 'lucide-react';
import {
  downloadAdminDocAsPdf, downloadAdminDocsZip, type DocAdminType,
} from '../../services/adminDocsPdf';
import { generateRecu } from '../../services/pdfGenerator';
import type { Ecole, EcheanceForPdf } from '../../services/pdfGenerator';
import { piecesForNiveau } from '../../services/piecesJustificatives';
import { apiClient, BASE_URL } from '../../services/api';
import { authBridge } from '../../services/authBridge';

interface EleveDoc { id: string; eleveId: string; typeDoc: string; nom: string; fileUrl: string; mimeType?: string; fileSize?: number; createdAt: string; }
interface Enfant   { id: string; nom: string; prenom: string; niveau: string; anneeScolaire?: string; classe?: { nom: string; niveau: string }; [key: string]: any; }
interface Echeance { id: string; mois?: string; montant: number | string; statut: string; dateEcheance?: string; datePaiement?: string; eleve?: { nom: string; prenom: string }; service?: { name: string }; periodeLabel?: string; }

interface Props {
  documents: EleveDoc[];
  enfants: Enfant[];
  echeances: Echeance[];
  ecole: Ecole | null;
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  ACTE_NAISSANCE: 'Acte de naissance',
  CERTIFICAT_MED: 'Certificat médical',
  PHOTO:          'Photo',
  VACCIN:         'Carnet de vaccination',
  JUGEMENT:       'Jugement',
  AUTRE:          'Autre document',
  EXTRAIT_NAISSANCE:    'Extrait de naissance',
  CARNET_VACCINATION:   'Carnet de vaccination',
  PHOTOS_IDENTITE:      "Photos d'identité",
  CNI_PARENT:           'Pièce d\'identité parent',
  CERTIFICAT_MEDICAL:   'Certificat médical',
  ORDONNANCE:           'Ordonnance',
  LIVRET_SCOLAIRE:      'Livret scolaire',
  CERTIFICAT_RADIATION: 'Certificat de radiation',
  CERTIFICAT_SCOLARITE: 'Certificat de scolarité',
};

const TYPE_COLORS: Record<string, string> = {
  ACTE_NAISSANCE: 'bg-blue-50 text-blue-700 border-blue-200',
  CERTIFICAT_MED: 'bg-rose-50 text-rose-700 border-rose-200',
  PHOTO:          'bg-purple-50 text-purple-700 border-purple-200',
  VACCIN:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  JUGEMENT:       'bg-amber-50 text-amber-700 border-amber-200',
  AUTRE:          'bg-gray-50 text-gray-700 border-gray-200',
  EXTRAIT_NAISSANCE:    'bg-blue-50 text-blue-700 border-blue-200',
  CARNET_VACCINATION:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  PHOTOS_IDENTITE:      'bg-purple-50 text-purple-700 border-purple-200',
  CNI_PARENT:           'bg-indigo-50 text-indigo-700 border-indigo-200',
  CERTIFICAT_MEDICAL:   'bg-rose-50 text-rose-700 border-rose-200',
  ORDONNANCE:           'bg-rose-50 text-rose-700 border-rose-200',
  LIVRET_SCOLAIRE:      'bg-amber-50 text-amber-700 border-amber-200',
  CERTIFICAT_RADIATION: 'bg-orange-50 text-orange-700 border-orange-200',
  CERTIFICAT_SCOLARITE: 'bg-teal-50 text-teal-700 border-teal-200',
};

const DOCS_INSCRIPTION: { type: DocAdminType; label: string; icon: React.FC<any>; color: string; desc: string }[] = [
  {
    type: 'fiche_inscription',
    label: "Fiche d'inscription",
    icon: FileText,
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    desc: 'Dossier complet avec identité, tuteurs et options souscrites',
  },
  {
    type: 'certificat_scolarite',
    label: 'Certificat de scolarité',
    icon: GraduationCap,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    desc: "Atteste l'inscription officielle dans l'établissement",
  },
  {
    type: 'fiche_sanitaire',
    label: 'Fiche sanitaire',
    icon: ShieldCheck,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    desc: 'Vaccinations, allergies, médecin, autorisations parentales',
  },
  {
    type: 'autorisation_sortie',
    label: 'Autorisation de sortie',
    icon: ClipboardList,
    color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    desc: "Formulaire d'autorisation pour activités extrascolaires",
  },
];

// ─── Composant principal ──────────────────────────────────────────────────────

const ParentDocuments: React.FC<Props> = ({ documents, enfants, echeances, ecole, onRefresh }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);
  const [uploadEleveId, setUploadEleveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EleveDoc | null>(null);
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});

  const setPdf = (key: string, v: boolean) =>
    setPdfLoading(prev => ({ ...prev, [key]: v }));

  const withFullEleve = async (enfant: Enfant): Promise<any> => {
    try {
      const full = await apiClient.get(`/parent/enfants/${enfant.id}`);
      return full || enfant;
    } catch {
      return enfant;
    }
  };

  const handleDoc = async (enfant: Enfant, type: DocAdminType) => {
    const key = `${enfant.id}-${type}`;
    setPdf(key, true);
    try {
      const full = await withFullEleve(enfant);
      const signes: string[] = full._documentsSignes || [];
      const isSigned = signes.some((s: any) => s.eleveId === enfant.id && s.typeDoc === type);
      if (!isSigned) {
        delete full._parentSignatureUrl;
      }
      await downloadAdminDocAsPdf(type, full);
    } catch (e) {
      console.error('PDF doc:', e);
      alert('Erreur lors de la génération du document.');
    } finally { setPdf(key, false); }
  };

  const handleZip = async (enfant: Enfant) => {
    const key = `${enfant.id}-zip`;
    setPdf(key, true);
    try {
      const full = await withFullEleve(enfant);
      await downloadAdminDocsZip(full);
    } catch (e) {
      console.error('ZIP:', e);
      alert('Erreur lors de la préparation du dossier ZIP.');
    } finally { setPdf(key, false); }
  };

  const handleRecu = async (ech: Echeance) => {
    const key = `recu-${ech.id}`;
    setPdf(key, true);
    try {
      await generateRecu(ech as EcheanceForPdf, ecole || { name: 'Le Toit des Anges' });
    } catch (e) {
      console.error('PDF reçu:', e);
      alert('Erreur lors de la génération du reçu.');
    } finally { setPdf(key, false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingCode || !uploadEleveId) return;
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('eleveId', uploadEleveId);
      form.append('typeDoc', uploadingCode);
      form.append('nom', file.name);
      const session = authBridge.getSession();
      const sessionToken = authBridge.getSessionToken();
      await fetch(`${BASE_URL}/api/parent/dossiers/upload`, {
        method: 'POST',
        headers: {
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
          ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
        },
        body: form,
      });
      onRefresh?.();
    } catch { alert("Erreur lors de l'upload."); }
    finally {
      setUploadingCode(null);
      setUploadEleveId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (doc: EleveDoc) => {
    setDeleting(doc.id);
    try {
      await apiClient.delete(`/parent/dossiers/${doc.id}`);
      onRefresh?.();
    } catch { alert('Erreur lors de la suppression.'); }
    finally { setDeleting(null); setConfirmDelete(null); }
  };

  const triggerUpload = (eleveId: string, code: string) => {
    setUploadEleveId(eleveId);
    setUploadingCode(code);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const payees = echeances.filter(e => e.statut === 'PAYE');

  // ── Render ──

  return (
    <div className="space-y-6 pb-6">

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Documents &amp; Téléchargements</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Tous les documents officiels de vos enfants, au format officiel de l'école.
          </p>
        </div>
        {ecole?.logoUrl && (
          <img src={ecole.logoUrl} alt="Logo école"
            className="h-12 w-auto object-contain rounded-xl border border-gray-100 shadow-sm" />
        )}
      </div>

      {/* ══ Section 1 : Documents d'inscription ══════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-indigo-100 overflow-hidden shadow-sm">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-indigo-50 bg-indigo-50/50">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-black text-indigo-900 text-sm">Documents d'inscription</p>
            <p className="text-indigo-500 text-xs">
              Mêmes documents officiels que ceux établis par la direction, avec logo et en-tête de l'école
            </p>
          </div>
        </div>

        {enfants.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Aucun enfant associé à ce compte.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {enfants.map((enfant) => (
              <div key={enfant.id} className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center font-black text-indigo-700 text-base flex-shrink-0">
                    {(enfant.prenom?.[0] || '').toUpperCase()}{(enfant.nom?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900">{enfant.prenom} {enfant.nom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {enfant.classe?.nom || enfant.niveau}
                      {enfant.anneeScolaire ? ` · ${enfant.anneeScolaire}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleZip(enfant)}
                    disabled={!!pdfLoading[`${enfant.id}-zip`]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border bg-slate-900 text-white border-slate-900 hover:bg-slate-700 transition disabled:opacity-50 flex-shrink-0 shadow-sm"
                  >
                    {pdfLoading[`${enfant.id}-zip`]
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Préparation…</>
                      : <><Archive className="w-3.5 h-3.5" />Tout télécharger (ZIP)</>}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {DOCS_INSCRIPTION.map(({ type, label, icon: Icon, color, desc }) => {
                    const loading = !!pdfLoading[`${enfant.id}-${type}`];
                    return (
                      <button
                        key={type}
                        onClick={() => handleDoc(enfant, type)}
                        disabled={loading}
                        className={`group flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition hover:shadow-md disabled:opacity-50 ${color}`}
                      >
                        <div className="flex items-center gap-2">
                          {loading
                            ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            : <Icon className="w-4 h-4 flex-shrink-0" />}
                          <span className="text-[10px] font-black uppercase tracking-wider leading-tight">
                            {loading ? 'Génération…' : label}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-70 leading-snug">{desc}</p>
                        {!loading && (
                          <div className="flex items-center gap-1 text-[9px] font-bold opacity-60 mt-auto">
                            <Download className="w-2.5 h-2.5" /> Télécharger PDF
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Section 2 : Relevés de paiement ══════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-emerald-50 bg-emerald-50/50">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-black text-emerald-900 text-sm">Relevés de paiement</p>
            <p className="text-emerald-600 text-xs">
              {payees.length} reçu{payees.length !== 1 ? 's' : ''} disponible{payees.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {payees.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Aucun paiement enregistré. Les reçus apparaîtront ici après validation par l'école.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payees.map((ech) => {
              const nomService = ech.service?.name || ech.periodeLabel || ech.mois || '—';
              const loading    = !!pdfLoading[`recu-${ech.id}`];
              return (
                <div key={ech.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{nomService}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ech.eleve ? `${ech.eleve.prenom} ${ech.eleve.nom}  ·  ` : ''}
                      {Number(ech.montant).toLocaleString('fr-FR')} FCFA
                      {ech.datePaiement
                        ? `  ·  payé le ${new Date(ech.datePaiement).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRecu(ech)}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition disabled:opacity-50 flex-shrink-0"
                  >
                    {loading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    {loading ? 'PDF…' : 'Reçu PDF'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Section 3 : Dossier justificatif par enfant ══════════════════════════ */}
      {enfants.map(enfant => {
        const required = piecesForNiveau(enfant.niveau);
        const eleveDocuments = documents.filter(d => d.eleveId === enfant.id);
        const docsByCode: Record<string, EleveDoc[]> = {};
        eleveDocuments.forEach(d => {
          const code = d.typeDoc || 'AUTRE';
          if (!docsByCode[code]) docsByCode[code] = [];
          docsByCode[code].push(d);
        });
        const totalRequired = required.filter(p => p.obligatoire).length;
        const totalProvided = required.filter(p => p.obligatoire && docsByCode[p.code]?.length).length;
        const isComplete = totalProvided >= totalRequired;
        const knownCodes = new Set(required.map(p => p.code));
        const extras = eleveDocuments.filter(d => !knownCodes.has(d.typeDoc || ''));

        return (
          <div key={enfant.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

            {/* Header enfant */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center font-black text-blue-700 text-base flex-shrink-0">
                {(enfant.prenom?.[0] || '').toUpperCase()}{(enfant.nom?.[0] || '').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 text-sm">Dossier justificatif — {enfant.prenom} {enfant.nom}</p>
                <p className="text-gray-400 text-xs mt-0.5">{enfant.classe?.nom || enfant.niveau}{enfant.anneeScolaire ? ` · ${enfant.anneeScolaire}` : ''}</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {totalProvided}/{totalRequired}
              </div>
            </div>

            {/* Barre de progression */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${totalRequired > 0 ? (totalProvided / totalRequired) * 100 : 0}%` }} />
                </div>
                <span className={`text-[10px] font-black ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isComplete ? 'Dossier complet' : `${totalRequired - totalProvided} manquant(s)`}
                </span>
              </div>
            </div>

            {/* Liste des pièces requises */}
            <div className="px-5 py-3 space-y-2">
              {required.map(p => {
                const docs = docsByCode[p.code] || [];
                const hasDoc = docs.length > 0;
                const colorCls = TYPE_COLORS[p.code] || TYPE_COLORS.AUTRE;
                return (
                  <div key={p.code} className={`rounded-2xl border overflow-hidden transition ${
                    hasDoc ? 'bg-emerald-50/50 border-emerald-200' : p.obligatoire ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {hasDoc
                        ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        : p.obligatoire
                          ? <AlertCircle size={18} className="text-rose-400 shrink-0" />
                          : <File size={18} className="text-gray-300 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 leading-tight">
                          {p.label}
                          {p.obligatoire
                            ? <span className="text-rose-500 ml-1">*</span>
                            : <span className="text-gray-400 text-xs font-medium ml-1">(optionnel)</span>}
                        </p>
                        {hasDoc && (
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                            {docs.length} fichier{docs.length > 1 ? 's' : ''} fourni{docs.length > 1 ? 's' : ''}
                          </p>
                        )}
                        {!hasDoc && p.obligatoire && (
                          <p className="text-[10px] text-rose-500 font-bold mt-0.5">Manquant — veuillez le soumettre</p>
                        )}
                      </div>

                      {/* Upload button */}
                      <button
                        onClick={() => triggerUpload(enfant.id, p.code)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                          hasDoc
                            ? 'text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200'
                            : 'text-white bg-blue-500 hover:bg-blue-600 shadow-sm'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {hasDoc ? 'Ajouter' : 'Soumettre'}
                      </button>
                    </div>

                    {/* Documents fournis pour cette pièce */}
                    {hasDoc && (
                      <div className="border-t border-emerald-100 bg-white/60 px-4 py-2 space-y-1.5">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-3 py-1.5">
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colorCls}`}>
                              <File className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 truncate">{doc.nom}</p>
                              <p className="text-[9px] text-gray-400">
                                {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {doc.fileSize ? ` · ${(Number(doc.fileSize) / 1024).toFixed(0)} Ko` : ''}
                              </p>
                            </div>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition shrink-0">
                              <Download className="w-3 h-3" /> Ouvrir
                            </a>
                            <button
                              onClick={() => setConfirmDelete(doc)}
                              disabled={deleting === doc.id}
                              className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition shrink-0 disabled:opacity-50"
                            >
                              {deleting === doc.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                              Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Documents supplémentaires hors liste requise */}
              {extras.length > 0 && (
                <>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Documents supplémentaires</p>
                  </div>
                  {extras.map(doc => {
                    const colorCls = TYPE_COLORS[doc.typeDoc] || TYPE_COLORS.AUTRE;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 bg-white">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colorCls}`}>
                          <File className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-700 truncate">{doc.nom}</p>
                          <p className="text-[9px] text-gray-400">
                            {TYPE_LABELS[doc.typeDoc] || doc.typeDoc}
                            {' · '}
                            {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition shrink-0">
                          <Download className="w-3 h-3" /> Ouvrir
                        </a>
                        <button
                          onClick={() => setConfirmDelete(doc)}
                          disabled={deleting === doc.id}
                          className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition shrink-0 disabled:opacity-50"
                        >
                          {deleting === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Supprimer
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Upload pour document supplémentaire (type libre) */}
              <div className="pt-2">
                <button
                  onClick={() => triggerUpload(enfant.id, 'AUTRE')}
                  className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 px-4 py-2.5 rounded-xl transition w-full justify-center"
                >
                  <FilePlus className="w-4 h-4" /> Ajouter un autre document
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Input fichier caché (partagé) */}
      <input ref={fileRef} type="file" onChange={handleUpload} className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setConfirmDelete(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="font-black text-gray-900">Supprimer ce document ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-bold text-gray-700 truncate">{confirmDelete.nom}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{TYPE_LABELS[confirmDelete.typeDoc] || confirmDelete.typeDoc}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting === confirmDelete.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentDocuments;
