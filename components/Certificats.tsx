import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logoUrl from '../assets/Image/logo_entreprise.png';
import {
  FileText, Search, Printer, CheckCircle2,
  GraduationCap, History, AlertCircle, Loader2,
  ClipboardList, ShieldCheck, UserX, Calendar,
  RefreshCw, Filter, X, SortDesc, Eye, Maximize2
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { downloadSingleAdminDoc, getDocHtml, type DocAdminType } from '../services/adminDocsPdf';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';
import { User, NiveauScolaire } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'SCOLARITE' | 'RADIATION' | 'SORTIE' | 'SANITAIRE';

interface EmissionEntry {
  id: string;
  timestamp: string;
  docType: DocType;
  docLabel: string;
  eleveNom: string;
  eleveMatricule: string;
  niveau: string;
  reference: string;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const NOM_ECOLE = 'Le Toit des Anges';
const ADRESSE_ECOLE = '469 Cité Cheikh Omar TALL, Ouakam, Dakar';
const TEL_ECOLE = '+221 77 XXX XX XX';
const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche',
  PS: 'Petite Section (PS)',
  MS: 'Moyenne Section (MS)',
  GS: 'Grande Section (GS)',
  CP: 'Cours Préparatoire (CP)',
  CE1: 'Cours Élémentaire 1 (CE1)',
  CE2: 'Cours Élémentaire 2 (CE2)',
  CM1: 'Cours Moyen 1 (CM1)',
  CM2: 'Cours Moyen 2 (CM2)',
};

const NIVEAUX_OPTIONS = Object.entries(NIVEAUX_LABELS).map(([v, l]) => ({ value: v, label: l }));

const DOCS: { id: DocType; label: string; description: string; icon: any; color: string }[] = [
  { id: 'SCOLARITE',  label: 'Certificat de scolarité',          description: 'Atteste l\'inscription de l\'élève pour l\'année en cours',      icon: GraduationCap, color: 'blue' },
  { id: 'RADIATION',  label: 'Certificat de radiation',           description: 'Atteste la désinscription définitive de l\'élève',               icon: UserX,         color: 'rose' },
  { id: 'SORTIE',     label: 'Autorisation de sortie scolaire',   description: 'Formulaire d\'autorisation pour sortie ou activité extérieure',  icon: ClipboardList, color: 'amber' },
  { id: 'SANITAIRE',  label: 'Fiche sanitaire de liaison',        description: 'Informations médicales et contacts d\'urgence de l\'élève',      icon: ShieldCheck,   color: 'emerald' },
];

const LS_EMISSIONS_KEY = 'cert_emissions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { badge: string; bg: string; border: string; text: string }> = {
  blue:    { badge: 'bg-blue-100 text-blue-700',     bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700' },
  rose:    { badge: 'bg-rose-100 text-rose-700',     bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700' },
  amber:   { badge: 'bg-amber-100 text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

function loadEmissions(): EmissionEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_EMISSIONS_KEY) || '[]'); } catch { return []; }
}
function saveEmissions(e: EmissionEntry[]) {
  try { localStorage.setItem(LS_EMISSIONS_KEY, JSON.stringify(e.slice(0, 300))); } catch {}
}
function genRef(prefix: string) { return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`; }
function today() { return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Gabarits de documents ────────────────────────────────────────────────────

function buildNomComplet(e: any): string {
  return `${e.prenom ?? ''} ${e.nom ?? ''}`.trim();
}
function buildPrenom(e: any): string { return (e.prenom ?? '').trim(); }
function buildNomFamille(e: any): string { return (e.nom ?? '').trim(); }
function buildParent(e: any): string {
  const p1 = e.parent1;
  if (p1) {
    const prenom = p1.prenom || '';
    const nom = p1.nom || '';
    return `${prenom} ${nom}`.trim();
  }
  return '';
}
function buildLienParent(e: any): string {
  const l = e.parent1?.lien || 'TUTEUR';
  return l === 'MERE' ? 'la mère' : l === 'PERE' ? 'le père' : 'le tuteur légal';
}

// ─── Composant document imprimable ────────────────────────────────────────────

function CertificatScolarite({ eleve, reference, anneeScolaire }: { eleve: any; reference: string; anneeScolaire: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || ''] || '';
  const parent = buildParent(eleve);
  const lien = buildLienParent(eleve);
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">République du Sénégal</p>
          <p className="text-xs text-slate-500">Ministère de l'Éducation Nationale</p>
          <h2 className="text-base font-black uppercase tracking-wide mt-1">{NOM_ECOLE}</h2>
          <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
        </div>
        <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Certificat de Scolarité</h3>
        <p className="text-xs text-slate-500">Année scolaire {anneeScolaire}</p>
      </div>
      <div className="space-y-3">
        <p>
          La Direction de l'établissement <strong>{NOM_ECOLE}</strong> certifie que :
        </p>
        <div className="ml-6 space-y-1.5">
          <p><span className="font-semibold">Nom et Prénom :</span> <span className="uppercase font-bold">{buildNomFamille(eleve)}</span> {buildPrenom(eleve)}</p>
          {eleve.dateNaissance && <p><span className="font-semibold">Date de naissance :</span> {eleve.dateNaissance}</p>}
          {eleve.lieuNaissance && <p><span className="font-semibold">Lieu de naissance :</span> {eleve.lieuNaissance}</p>}
          {eleve.matricule && <p><span className="font-semibold">Matricule :</span> {eleve.matricule}</p>}
          {niveau && <p><span className="font-semibold">Classe :</span> {niveau}</p>}
          {parent && <p><span className="font-semibold">Tuteur légal :</span> {parent} ({lien})</p>}
        </div>
        <p>
          est régulièrement inscrit(e) dans notre établissement pour l'année scolaire <strong>{anneeScolaire}</strong>.
        </p>
        <p>
          Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.
        </p>
      </div>
      <div className="flex justify-between items-end pt-6">
        <p className="text-xs text-slate-400">Réf. : {reference}</p>
        <div className="text-right space-y-8">
          <p className="text-sm">Fait à Dakar, le {today()}</p>
          <p className="text-sm font-semibold">La Directrice</p>
          <div className="w-28 border-b border-slate-400" />
        </div>
      </div>
    </div>
  );
}

function CertificatRadiation({ eleve, reference, motif, anneeScolaire }: { eleve: any; reference: string; motif: string; anneeScolaire: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || ''] || '';
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">République du Sénégal</p>
          <p className="text-xs text-slate-500">Ministère de l'Éducation Nationale</p>
          <h2 className="text-base font-black uppercase tracking-wide mt-1">{NOM_ECOLE}</h2>
          <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
        </div>
        <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Certificat de Radiation</h3>
        <p className="text-xs text-slate-500">Année scolaire {anneeScolaire}</p>
      </div>
      <div className="space-y-3">
        <p>La Direction de l'établissement <strong>{NOM_ECOLE}</strong> certifie que :</p>
        <div className="ml-6 space-y-1.5">
          <p><span className="font-semibold">Nom et Prénom :</span> <span className="uppercase font-bold">{buildNomFamille(eleve)}</span> {buildPrenom(eleve)}</p>
          {eleve.dateNaissance && <p><span className="font-semibold">Date de naissance :</span> {eleve.dateNaissance}</p>}
          {eleve.matricule && <p><span className="font-semibold">Matricule :</span> {eleve.matricule}</p>}
          {niveau && <p><span className="font-semibold">Dernière classe fréquentée :</span> {niveau}</p>}
        </div>
        <p>
          a été radié(e) des effectifs de notre établissement à la date du <strong>{today()}</strong>.
        </p>
        {motif && (
          <p><span className="font-semibold">Motif de la radiation :</span> {motif}</p>
        )}
        <p>
          Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.
        </p>
      </div>
      <div className="flex justify-between items-end pt-6">
        <p className="text-xs text-slate-400">Réf. : {reference}</p>
        <div className="text-right space-y-8">
          <p className="text-sm">Fait à Dakar, le {today()}</p>
          <p className="text-sm font-semibold">La Directrice</p>
          <div className="w-28 border-b border-slate-400" />
        </div>
      </div>
    </div>
  );
}

function AutorisationSortie({ eleve, reference, destination, dateActivite }: { eleve: any; reference: string; destination: string; dateActivite: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || ''] || '';
  const parent = buildParent(eleve);
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
          <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
        </div>
        <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Autorisation de Sortie Scolaire</h3>
      </div>
      <div className="space-y-3">
        <p>Je soussigné(e), <strong>{parent || '___________________'}</strong>, parent/tuteur légal de l'élève :</p>
        <div className="ml-6 space-y-1.5">
          <p><span className="font-semibold">Nom et Prénom :</span> <span className="uppercase font-bold">{buildNomFamille(eleve)}</span> {buildPrenom(eleve)}</p>
          {niveau && <p><span className="font-semibold">Classe :</span> {niveau}</p>}
        </div>
        <p>
          autorise mon enfant à participer à la sortie scolaire organisée par l'établissement{destination ? ` à destination de : <strong>${destination}</strong>` : ''}, prévue le <strong>{dateActivite || '_______________'}</strong>.
        </p>
        <p>Je m'engage à ce que mon enfant respecte les consignes de sécurité et de discipline pendant toute la durée de l'activité.</p>
      </div>
      <div className="grid grid-cols-2 gap-8 pt-6">
        <div className="space-y-8">
          <p className="text-sm">Date : {today()}</p>
          <p className="text-sm font-semibold">Signature du parent / tuteur</p>
          <div className="w-full border-b border-slate-400" />
        </div>
        <div className="space-y-8 text-right">
          <p className="text-sm">La Directrice</p>
          <div className="w-full border-b border-slate-400" />
        </div>
      </div>
      <p className="text-xs text-slate-400 text-right">Réf. : {reference}</p>
    </div>
  );
}

function FicheSanitaire({ eleve, reference, anneeScolaire }: { eleve: any; reference: string; anneeScolaire: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || ''] || '';
  const parent = buildParent(eleve);
  const urgenceNom = eleve.contactUrgence?.nom || '___________________';
  const urgenceTel = eleve.contactUrgence?.telephone || '___________________';
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
          <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
        </div>
        <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Fiche Sanitaire de Liaison</h3>
        <p className="text-xs text-slate-500">Année scolaire {anneeScolaire}</p>
      </div>
      <div className="space-y-4">
        <section>
          <h4 className="font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Identité de l'enfant</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <p><span className="font-semibold">Nom :</span> <span className="uppercase">{buildNomFamille(eleve)}</span></p>
            <p><span className="font-semibold">Prénom :</span> {buildPrenom(eleve)}</p>
            {eleve.dateNaissance && <p><span className="font-semibold">Date de naissance :</span> {eleve.dateNaissance}</p>}
            {eleve.lieuNaissance && <p><span className="font-semibold">Lieu :</span> {eleve.lieuNaissance}</p>}
            {niveau && <p><span className="font-semibold">Classe :</span> {niveau}</p>}
            {eleve.besoinSpecifique && <p className="col-span-2"><span className="font-semibold">Besoins spécifiques :</span> {eleve.besoinSpecifique}</p>}
          </div>
        </section>
        <section>
          <h4 className="font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Parent / tuteur légal</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <p><span className="font-semibold">Nom :</span> {parent || '___________________'}</p>
            <p><span className="font-semibold">Téléphone :</span> {eleve.parent1?.telephone || '___________________'}</p>
            <p><span className="font-semibold">WhatsApp :</span> {eleve.parent1?.whatsapp || eleve.whatsappPrincipal || '—'}</p>
            <p><span className="font-semibold">Email :</span> {eleve.parent1?.email || '—'}</p>
          </div>
        </section>
        <section>
          <h4 className="font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Contact d'urgence</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <p><span className="font-semibold">Nom :</span> {urgenceNom}</p>
            <p><span className="font-semibold">Téléphone :</span> {urgenceTel}</p>
          </div>
        </section>
        <section>
          <h4 className="font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Informations médicales</h4>
          <div className="space-y-2">
            <p>Allergies connues : <span className="border-b border-dotted border-slate-400 inline-block w-48">&nbsp;</span></p>
            <p>Médicaments pris régulièrement : <span className="border-b border-dotted border-slate-400 inline-block w-36">&nbsp;</span></p>
            <p>Médecin traitant / Tel : <span className="border-b border-dotted border-slate-400 inline-block w-44">&nbsp;</span></p>
          </div>
        </section>
        <section>
          <h4 className="font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Autorisation photographique</h4>
          <div className="flex gap-8 mt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <span className="w-4 h-4 border border-slate-400 inline-block" /> <span>Autorise</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <span className="w-4 h-4 border border-slate-400 inline-block" /> <span>N'autorise pas</span>
            </label>
          </div>
        </section>
      </div>
      <div className="flex justify-between items-end pt-4">
        <p className="text-xs text-slate-400">Réf. : {reference}</p>
        <div className="text-right space-y-6">
          <p className="text-sm">Fait à Dakar, le {today()}</p>
          <p className="text-sm font-semibold">Signature du parent / tuteur</p>
          <div className="w-32 border-b border-slate-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const Certificats: React.FC<{ user: User }> = ({ user }) => {
  const showToast = useToast();
  const { annee: anneeScolaire } = useAnnee();
  const canGenerate = authBridge.canPerform(user, 'EDIT', 'customers');

  const [eleves, setEleves] = useState<any[]>([]);
  const [loadingEleves, setLoadingEleves] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocType | null>(null);
  const [emissions, setEmissions] = useState<EmissionEntry[]>(loadEmissions);
  const [activeTab, setActiveTab] = useState<'generer' | 'historique'>('generer');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [destination, setDestination] = useState('');
  const [dateActivite, setDateActivite] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Filtres historique ──────────────────────────────────────────────────────
  const [histSearch, setHistSearch] = useState('');
  const [histDocType, setHistDocType] = useState<DocType | 'ALL'>('ALL');
  const [histPeriode, setHistPeriode] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [histSort, setHistSort] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    (async () => {
      setLoadingEleves(true);
      try {
        const data = await apiClient.get('/eleves', { params: { anneeScolaire } });
        setEleves(Array.isArray(data) ? data : (data?.rows ?? data?.eleves ?? []));
      } catch { showToast('Impossible de charger les élèves.', 'error'); }
      finally { setLoadingEleves(false); }
    })();
  }, [anneeScolaire]);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return eleves.filter(e => (`${e.prenom ?? ''} ${e.nom ?? ''}`).toLowerCase().includes(q));
  }, [eleves, search]);

  const handleSelectDoc = (id: DocType) => {
    setSelectedDoc(id);
    setReference(genRef(id === 'SCOLARITE' ? 'CS' : id === 'RADIATION' ? 'CR' : id === 'SORTIE' ? 'AS' : 'FS'));
    setMotif('');
    setDestination('');
    setDateActivite('');
  };

  const DOC_TYPE_MAP: Record<DocType, DocAdminType> = {
    SCOLARITE: 'certificat_scolarite',
    RADIATION: 'certificat_radiation',
    SORTIE:    'autorisation_sortie',
    SANITAIRE: 'fiche_sanitaire',
  };

  const buildEleveData = useCallback(() => {
    if (!selectedEleve || !selectedDoc) return null;
    return {
      ...selectedEleve,
      ...(selectedDoc === 'RADIATION' && motif        ? { motifRadiation:    motif }                                                : {}),
      ...(selectedDoc === 'SORTIE'    && destination  ? { destinationSortie: destination }                                          : {}),
      ...(selectedDoc === 'SORTIE'    && dateActivite ? { dateActiviteSortie: new Date(dateActivite).toLocaleDateString('fr-FR') }  : {}),
    };
  }, [selectedEleve, selectedDoc, motif, destination, dateActivite]);

  const handlePrint = useCallback(async () => {
    if (!selectedEleve || !selectedDoc || pdfLoading) return;
    const docInfo = DOCS.find(d => d.id === selectedDoc)!;
    setPdfLoading(true);
    try {
      const eleveData = buildEleveData()!;
      await downloadSingleAdminDoc(DOC_TYPE_MAP[selectedDoc], eleveData);
      const entry: EmissionEntry = {
        id: genId(),
        timestamp: new Date().toISOString(),
        docType: selectedDoc,
        docLabel: docInfo.label,
        eleveNom: buildNomComplet(selectedEleve),
        eleveMatricule: selectedEleve.matricule || '—',
        niveau: selectedEleve.niveau || '',
        reference,
      };
      const newEmissions = [entry, ...emissions];
      setEmissions(newEmissions);
      saveEmissions(newEmissions);
      showToast(`${docInfo.label} ouvert pour ${entry.eleveNom}.`, 'success');
    } catch {
      showToast('Erreur lors de la génération du document.', 'error');
    } finally {
      setPdfLoading(false);
    }
  }, [selectedEleve, selectedDoc, pdfLoading, buildEleveData, emissions, reference]);

  const handlePreview = useCallback(async () => {
    if (!selectedEleve || !selectedDoc || previewLoading) return;
    setPreviewLoading(true);
    try {
      const eleveData = buildEleveData()!;
      const html = await getDocHtml(DOC_TYPE_MAP[selectedDoc], eleveData);
      setPreviewHtml(html);
    } catch {
      showToast('Impossible de générer la prévisualisation.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedEleve, selectedDoc, previewLoading, buildEleveData]);

  const filteredEmissions = useMemo(() => {
    const q = histSearch.toLowerCase().trim();
    const now = new Date();
    const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return emissions
      .filter(em => {
        if (histDocType !== 'ALL' && em.docType !== histDocType) return false;
        if (q && !em.eleveNom.toLowerCase().includes(q) && !em.reference.toLowerCase().includes(q)) return false;
        if (histPeriode !== 'all') {
          const d = new Date(em.timestamp);
          if (histPeriode === 'today'  && d < startOfDay)   return false;
          if (histPeriode === 'week'   && d < startOfWeek)  return false;
          if (histPeriode === 'month'  && d < startOfMonth) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return histSort === 'desc' ? -diff : diff;
      });
  }, [emissions, histSearch, histDocType, histPeriode, histSort]);

  const kpis = useMemo(() => ({
    total: emissions.length,
    scolarite: emissions.filter(e => e.docType === 'SCOLARITE').length,
    radiation: emissions.filter(e => e.docType === 'RADIATION').length,
    ceJour: emissions.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString()).length,
  }), [emissions]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <span className="p-2 bg-indigo-600 rounded-xl text-white"><FileText size={22} /></span>
          Certificats &amp; Documents
        </h1>
        <p className="text-slate-500 text-sm mt-1">Génération et impression des documents officiels</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total émis',          value: kpis.total,      color: 'bg-slate-50 text-slate-700',   icon: FileText },
          { label: "Aujourd'hui",         value: kpis.ceJour,     color: 'bg-indigo-50 text-indigo-700', icon: Calendar },
          { label: 'Certificats scol.',   value: kpis.scolarite,  color: 'bg-blue-50 text-blue-700',     icon: GraduationCap },
          { label: 'Certificats radiat.', value: kpis.radiation,  color: 'bg-rose-50 text-rose-700',     icon: UserX },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl p-4 ${k.color} flex items-center gap-4`}>
            <k.icon size={22} className="shrink-0 opacity-70" />
            <div>
              <p className="text-2xl font-black">{k.value}</p>
              <p className="text-xs font-medium opacity-80">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {([['generer', 'Générer un document', FileText], ['historique', 'Historique', History]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all
              ${activeTab === id ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── ONGLET GÉNÉRER ─────────────────────────────────────────────────── */}
      {activeTab === 'generer' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Colonne sélection */}
          <div className="space-y-4">
            {/* Élève */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <GraduationCap size={15} className="text-indigo-500" /> Sélectionner un élève
                </p>
              </div>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {loadingEleves ? (
                  <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
                ) : filteredEleves.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm p-6">Aucun élève</p>
                ) : filteredEleves.map(e => {
                  const nom = `${e.prenom ?? ''} ${e.nom ?? ''}`.trim();
                  const niveau = e.niveau || '';
                  const isSelected = selectedEleve?.id === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEleve(e)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50
                        ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{nom}</p>
                        <p className="text-xs text-slate-400">{NIVEAUX_LABELS[niveau] ?? niveau}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type de document */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <FileText size={15} className="text-indigo-500" /> Type de document
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {DOCS.map(doc => {
                  const c = COLOR_MAP[doc.color];
                  const isSelected = selectedDoc === doc.id;
                  const Icon = doc.icon;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50
                        ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                    >
                      <span className={`p-1.5 rounded-lg ${c.bg}`}>
                        <Icon size={14} className={c.text} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{doc.label}</p>
                        <p className="text-xs text-slate-400 truncate">{doc.description}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Colonne aperçu */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedEleve || !selectedDoc ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <FileText size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Sélectionnez un élève et un type de document</p>
                <p className="text-xs text-slate-400 mt-1">Le document sera pré-rempli avec les données de l'élève</p>
              </div>
            ) : (
              <>
                {/* Champs complémentaires selon le type */}
                {selectedDoc === 'RADIATION' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Informations complémentaires</p>
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Motif de radiation</label>
                      <input
                        value={motif}
                        onChange={e => setMotif(e.target.value)}
                        placeholder="Ex : Déménagement, fin de scolarité..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
                {selectedDoc === 'SORTIE' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Informations de la sortie</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 font-medium block mb-1">Destination</label>
                        <input
                          value={destination}
                          onChange={e => setDestination(e.target.value)}
                          placeholder="Ex : Musée IFAN, Lac Rose..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-medium block mb-1">Date de la sortie</label>
                        <input
                          type="date"
                          value={dateActivite}
                          onChange={e => setDateActivite(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aperçu du document */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{DOCS.find(d => d.id === selectedDoc)?.label}</p>
                      <p className="text-xs text-slate-400">{buildNomComplet(selectedEleve)} · {NIVEAUX_LABELS[selectedEleve.niveau || ''] || ''}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Réf : {reference}</span>
                  </div>
                  {/* Zone imprimable */}
                  <div className="p-8">
                    {selectedDoc === 'SCOLARITE' && <CertificatScolarite eleve={selectedEleve} reference={reference} anneeScolaire={anneeScolaire} />}
                    {selectedDoc === 'RADIATION' && <CertificatRadiation eleve={selectedEleve} reference={reference} motif={motif} anneeScolaire={anneeScolaire} />}
                    {selectedDoc === 'SORTIE'    && <AutorisationSortie eleve={selectedEleve} reference={reference} destination={destination} dateActivite={dateActivite ? new Date(dateActivite).toLocaleDateString('fr-FR') : ''} />}
                    {selectedDoc === 'SANITAIRE' && <FicheSanitaire eleve={selectedEleve} reference={reference} anneeScolaire={anneeScolaire} />}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedDoc(null); setSelectedEleve(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw size={15} /> Réinitialiser
                  </button>
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {previewLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Chargement…</>
                      : <><Eye size={15} /> Prévisualiser</>
                    }
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!canGenerate || pdfLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pdfLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Génération…</>
                      : <><Printer size={15} /> Exporter en PDF</>
                    }
                  </button>
                </div>
                {!canGenerate && (
                  <p className="text-xs text-rose-500 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Vous n'avez pas les droits pour émettre des documents.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET HISTORIQUE ───────────────────────────────────────────────── */}
      {activeTab === 'historique' && (
        <div className="space-y-4">
          {/* Barre de recherche + filtres */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            {/* Ligne 1 : recherche + tri + effacer */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  placeholder="Rechercher par nom d'élève ou référence…"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {histSearch && (
                  <button onClick={() => setHistSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setHistSort(s => s === 'desc' ? 'asc' : 'desc')}
                title={histSort === 'desc' ? 'Plus récent en premier' : 'Plus ancien en premier'}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 shrink-0"
              >
                <SortDesc size={15} className={histSort === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                <span className="hidden sm:inline text-xs font-medium">{histSort === 'desc' ? 'Plus récent' : 'Plus ancien'}</span>
              </button>
              {emissions.length > 0 && (
                <button
                  onClick={() => { setEmissions([]); saveEmissions([]); }}
                  className="px-3 py-2.5 rounded-xl border border-rose-200 text-xs text-rose-500 hover:bg-rose-50 font-medium shrink-0"
                >Effacer tout</button>
              )}
            </div>

            {/* Ligne 2 : filtre type de document */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center mr-1 flex items-center gap-1">
                <Filter size={11} /> Type
              </span>
              {([['ALL', 'Tous', FileText, 'bg-slate-100 text-slate-600 border-slate-200'], ...DOCS.map(d => [d.id, d.label, d.icon, `${COLOR_MAP[d.color].bg} ${COLOR_MAP[d.color].text} ${COLOR_MAP[d.color].border}`])] as any[]).map(([id, label, Icon, colorCls]) => (
                <button
                  key={id}
                  onClick={() => setHistDocType(id as DocType | 'ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all
                    ${histDocType === id ? (id === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : `${colorCls} ring-2 ring-offset-1 ring-current`) : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  <Icon size={11} />{id === 'ALL' ? label : DOCS.find(d => d.id === id)?.label}
                </button>
              ))}
            </div>

            {/* Ligne 3 : filtre période */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center mr-1 flex items-center gap-1">
                <Calendar size={11} /> Période
              </span>
              {([
                ['today', "Aujourd'hui"],
                ['week',  'Cette semaine'],
                ['month', 'Ce mois'],
                ['all',   'Tout'],
              ] as [typeof histPeriode, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setHistPeriode(val)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all
                    ${histPeriode === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Résultats */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <History size={15} className="text-slate-400" />
                {filteredEmissions.length} résultat{filteredEmissions.length !== 1 ? 's' : ''}
                {filteredEmissions.length !== emissions.length && (
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    filtré sur {emissions.length}
                  </span>
                )}
              </p>
              {(histSearch || histDocType !== 'ALL' || histPeriode !== 'all') && (
                <button
                  onClick={() => { setHistSearch(''); setHistDocType('ALL'); setHistPeriode('all'); }}
                  className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-1"
                >
                  <X size={11} /> Réinitialiser les filtres
                </button>
              )}
            </div>

            {filteredEmissions.length === 0 ? (
              <div className="p-16 text-center">
                <History size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">
                  {emissions.length === 0 ? 'Aucun document émis' : 'Aucun résultat pour ces filtres'}
                </p>
                {emissions.length > 0 && (
                  <button
                    onClick={() => { setHistSearch(''); setHistDocType('ALL'); setHistPeriode('all'); }}
                    className="mt-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium"
                  >Effacer les filtres</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEmissions.map(em => {
                  const doc = DOCS.find(d => d.id === em.docType);
                  const c = doc ? COLOR_MAP[doc.color] : COLOR_MAP.blue;
                  const Icon = doc?.icon ?? FileText;
                  return (
                    <div key={em.id} className="px-5 py-4 hover:bg-slate-50 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-xl ${c.bg} shrink-0`}><Icon size={15} className={c.text} /></span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800">{em.eleveNom}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${c.badge} ${c.border}`}>
                              {em.docLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {NIVEAUX_LABELS[em.niveau] ?? em.niveau}
                            {em.reference && <> · <span className="font-mono">{em.reference}</span></>}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 shrink-0 text-right">{formatDateTime(em.timestamp)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Modale de prévisualisation ──────────────────────────────────────── */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
          {/* Barre supérieure */}
          <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Eye size={16} /></span>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  Prévisualisation — {selectedDoc ? DOCS.find(d => d.id === selectedDoc)?.label : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedEleve ? buildNomComplet(selectedEleve) : ''} · {selectedEleve ? (NIVEAUX_LABELS[selectedEleve.niveau] ?? selectedEleve.niveau) : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={!canGenerate || pdfLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {pdfLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Génération…</>
                  : <><Printer size={14} /> Imprimer / PDF</>
                }
              </button>
              <button
                onClick={() => setPreviewHtml(null)}
                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Corps : iframe du document */}
          <div className="flex-1 overflow-hidden bg-slate-300 flex items-start justify-center py-6 px-4">
            <div className="w-full max-w-[860px] h-full rounded-xl overflow-hidden shadow-2xl border border-slate-200">
              <iframe
                srcDoc={previewHtml}
                title="Prévisualisation document"
                className="w-full h-full bg-white"
                style={{ minHeight: '600px' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Certificats;
