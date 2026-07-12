import React, { useRef, useState } from 'react';
import {
  FileText, Upload, Download, Loader2, CheckCircle2, File, FilePlus,
  GraduationCap, ClipboardList, Receipt, FolderOpen, ShieldCheck, Archive,
} from 'lucide-react';
import {
  downloadAdminDocAsPdf, downloadAdminDocsZip, type DocAdminType,
} from '../../services/adminDocsPdf';
import { generateRecu } from '../../services/pdfGenerator';
import type { Ecole, EcheanceForPdf } from '../../services/pdfGenerator';
import { apiClient } from '../../services/api';

interface EleveDoc { id: string; eleveId: string; typeDoc: string; nom: string; fileUrl: string; createdAt: string; }
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
  // Pièces jointes lors des demandes d'admission
  EXTRAIT_NAISSANCE:  'Extrait de naissance',
  CARNET_VACCINATION: 'Carnet de vaccination',
  PHOTOS_IDENTITE:    "Photos d'identité",
  CNI_PARENT:         'Pièce d\'identité parent',
  CERTIFICAT_MEDICAL: 'Certificat médical',
  ORDONNANCE:         'Ordonnance',
  LIVRET_SCOLAIRE:    'Livret scolaire',
};

const TYPE_COLORS: Record<string, string> = {
  ACTE_NAISSANCE: 'bg-blue-50 text-blue-700 border-blue-200',
  CERTIFICAT_MED: 'bg-rose-50 text-rose-700 border-rose-200',
  PHOTO:          'bg-purple-50 text-purple-700 border-purple-200',
  VACCIN:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  JUGEMENT:       'bg-amber-50 text-amber-700 border-amber-200',
  AUTRE:          'bg-gray-50 text-gray-700 border-gray-200',
  EXTRAIT_NAISSANCE:  'bg-blue-50 text-blue-700 border-blue-200',
  CARNET_VACCINATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PHOTOS_IDENTITE:    'bg-purple-50 text-purple-700 border-purple-200',
  CNI_PARENT:         'bg-indigo-50 text-indigo-700 border-indigo-200',
  CERTIFICAT_MEDICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  ORDONNANCE:         'bg-rose-50 text-rose-700 border-rose-200',
  LIVRET_SCOLAIRE:    'bg-amber-50 text-amber-700 border-amber-200',
};

// Documents générés lors de l'inscription — mêmes gabarits que la direction
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
  const [eleveId, setEleveId]       = useState(enfants[0]?.id || '');
  const [typeDoc, setTypeDoc]       = useState('AUTRE');
  const [uploading, setUploading]   = useState(false);
  const [uploaded, setUploaded]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});

  const setPdf = (key: string, v: boolean) =>
    setPdfLoading(prev => ({ ...prev, [key]: v }));

  // Récupère le dossier complet de l'enfant (champs santé, parents, etc.)
  const withFullEleve = async (enfant: Enfant): Promise<any> => {
    try {
      const full = await apiClient.get(`/parent/enfants/${enfant.id}`);
      return full || enfant;
    } catch {
      return enfant;
    }
  };

  // Ouvre le document dans un nouvel onglet + invite à imprimer / enregistrer en PDF
  const handleDoc = async (enfant: Enfant, type: DocAdminType) => {
    const key = `${enfant.id}-${type}`;
    setPdf(key, true);
    try {
      const full = await withFullEleve(enfant);
      await downloadAdminDocAsPdf(type, full);
    } catch (e) {
      console.error('PDF doc:', e);
      alert('Erreur lors de la génération du document.');
    } finally { setPdf(key, false); }
  };

  // Télécharge tous les documents du dossier en un seul fichier ZIP
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
    if (!file || !eleveId) return;
    setUploading(true); setUploaded(false);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('eleveId', eleveId);
      form.append('typeDoc', typeDoc);
      form.append('nom', file.name);
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
      const sess  = localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken') || '';
      const base  = (window as any).__API_BASE__ || '/api';
      await fetch(`${base}/parent/dossiers/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-session-token': sess },
        body: form,
      });
      setUploaded(true); onRefresh?.();
    } catch { alert("Erreur lors de l'upload."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
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

                {/* Ligne enfant + bouton ZIP */}
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

                {/* Grille des 4 documents */}
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

      {/* ══ Section 3 : Ajouter un document ══════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
            <FilePlus className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-black text-gray-800 text-sm">Ajouter un document</p>
            <p className="text-gray-500 text-xs">PDF, JPG, PNG ou DOC — 10 Mo max</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {enfants.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Enfant</label>
              <select value={eleveId} onChange={e => setEleveId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-sm outline-none focus:border-blue-400">
                {enfants.map(en => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Type de document</label>
            <select value={typeDoc} onChange={e => setTypeDoc(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-sm outline-none focus:border-blue-400">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <input ref={fileRef} type="file" onChange={handleUpload} className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading || !eleveId}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-sm hover:shadow-md disabled:opacity-60">
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Upload en cours…</>
              : <><Upload className="w-4 h-4" />Choisir un fichier</>}
          </button>
          {uploaded && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Document envoyé !
            </span>
          )}
        </div>
      </div>

      {/* ══ Section 4 : Documents enregistrés ════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="font-black text-gray-800 text-sm">Documents du dossier</p>
            <p className="text-gray-400 text-xs">
              {documents.length} document{documents.length !== 1 ? 's' : ''} enregistré{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">Aucun document dans le dossier.</p>
            <p className="text-gray-400 text-xs mt-1">Utilisez la zone ci-dessus pour en ajouter.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {documents.map(d => {
              const colorCls = TYPE_COLORS[d.typeDoc] || TYPE_COLORS.AUTRE;
              return (
                <div key={d.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                    <File className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{d.nom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {TYPE_LABELS[d.typeDoc] || d.typeDoc}
                      {' · '}
                      {new Date(d.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3.5 py-2 rounded-xl transition flex-shrink-0">
                    <Download className="w-3.5 h-3.5" /> Ouvrir
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default ParentDocuments;
