import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Search, Printer, Eye, X, CheckCircle2,
  GraduationCap, History, AlertCircle, Loader2,
  ClipboardList, ShieldCheck, UserX, Calendar,
  Download, RefreshCw, Baby
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
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
const ANNEE_SCOLAIRE = '2025-2026';

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
  const base = e.companyName || e.name || '';
  return base.trim();
}
function buildPrenom(e: any): string { return (e.companyName || e.name || '').trim().split(' ')[0] ?? ''; }
function buildNomFamille(e: any): string {
  const parts = (e.companyName || e.name || '').trim().split(' ');
  return parts.slice(1).join(' ') || parts[0] || '';
}
function buildParent(e: any): string {
  const p = e.parent1Prenom || '';
  const n = e.parent1Nom || e.mainContact || '';
  return p ? `${p} ${n}`.trim() : n;
}
function buildLienParent(e: any): string {
  const l = e.parent1Lien || 'TUTEUR';
  return l === 'MERE' ? 'la mère' : l === 'PERE' ? 'le père' : 'le tuteur légal';
}

// ─── Composant document imprimable ────────────────────────────────────────────

function CertificatScolarite({ eleve, reference }: { eleve: any; reference: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || eleve.niveauScolaire || ''] || '';
  const parent = buildParent(eleve);
  const lien = buildLienParent(eleve);
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-6">
      <div className="text-center space-y-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest">République du Sénégal</p>
        <p className="text-xs text-slate-500">Ministère de l'Éducation Nationale</p>
        <div className="w-16 h-px bg-slate-300 mx-auto my-2" />
        <h2 className="text-lg font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
        <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Certificat de Scolarité</h3>
        <p className="text-xs text-slate-500">Année scolaire {ANNEE_SCOLAIRE}</p>
      </div>
      <div className="space-y-3">
        <p>
          La Direction de l'établissement <strong>{NOM_ECOLE}</strong> certifie que :
        </p>
        <div className="ml-6 space-y-1.5">
          <p><span className="font-semibold">Nom et Prénom :</span> <span className="uppercase font-bold">{buildNomFamille(eleve)}</span> {buildPrenom(eleve)}</p>
          {eleve.dateNaissance && <p><span className="font-semibold">Date de naissance :</span> {eleve.dateNaissance}</p>}
          {eleve.lieuNaissance && <p><span className="font-semibold">Lieu de naissance :</span> {eleve.lieuNaissance}</p>}
          {(eleve.matricule || eleve.ine) && <p><span className="font-semibold">Matricule :</span> {eleve.matricule || eleve.ine}</p>}
          {niveau && <p><span className="font-semibold">Classe :</span> {niveau}</p>}
          {parent && <p><span className="font-semibold">Tuteur légal :</span> {parent} ({lien})</p>}
        </div>
        <p>
          est régulièrement inscrit(e) dans notre établissement pour l'année scolaire <strong>{ANNEE_SCOLAIRE}</strong>.
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

function CertificatRadiation({ eleve, reference, motif }: { eleve: any; reference: string; motif: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || eleve.niveauScolaire || ''] || '';
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-6">
      <div className="text-center space-y-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest">République du Sénégal</p>
        <p className="text-xs text-slate-500">Ministère de l'Éducation Nationale</p>
        <div className="w-16 h-px bg-slate-300 mx-auto my-2" />
        <h2 className="text-lg font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
        <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Certificat de Radiation</h3>
        <p className="text-xs text-slate-500">Année scolaire {ANNEE_SCOLAIRE}</p>
      </div>
      <div className="space-y-3">
        <p>La Direction de l'établissement <strong>{NOM_ECOLE}</strong> certifie que :</p>
        <div className="ml-6 space-y-1.5">
          <p><span className="font-semibold">Nom et Prénom :</span> <span className="uppercase font-bold">{buildNomFamille(eleve)}</span> {buildPrenom(eleve)}</p>
          {eleve.dateNaissance && <p><span className="font-semibold">Date de naissance :</span> {eleve.dateNaissance}</p>}
          {(eleve.matricule || eleve.ine) && <p><span className="font-semibold">Matricule :</span> {eleve.matricule || eleve.ine}</p>}
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
  const niveau = NIVEAUX_LABELS[eleve.niveau || eleve.niveauScolaire || ''] || '';
  const parent = buildParent(eleve);
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
        <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
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

function FicheSanitaire({ eleve, reference }: { eleve: any; reference: string }) {
  const niveau = NIVEAUX_LABELS[eleve.niveau || eleve.niveauScolaire || ''] || '';
  const parent = buildParent(eleve);
  const urgenceNom = eleve.urgenceNom || '___________________';
  const urgenceTel = eleve.urgenceTel || '___________________';
  return (
    <div className="font-serif text-slate-800 text-[13px] leading-relaxed space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-black uppercase tracking-wide">{NOM_ECOLE}</h2>
        <p className="text-xs text-slate-500">{ADRESSE_ECOLE} · {TEL_ECOLE}</p>
      </div>
      <div className="border-t-2 border-b-2 border-slate-800 py-3 text-center">
        <h3 className="text-base font-black uppercase tracking-widest">Fiche Sanitaire de Liaison</h3>
        <p className="text-xs text-slate-500">Année scolaire {ANNEE_SCOLAIRE}</p>
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
            <p><span className="font-semibold">Téléphone :</span> {eleve.parent1Tel || '___________________'}</p>
            <p><span className="font-semibold">WhatsApp :</span> {eleve.parent1Whatsapp || '—'}</p>
            <p><span className="font-semibold">Email :</span> {eleve.parent1Email || '—'}</p>
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
  const printRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    (async () => {
      setLoadingEleves(true);
      try {
        const data = await apiClient.get('/customers');
        setEleves(data || []);
      } catch { showToast('Impossible de charger les élèves.', 'error'); }
      finally { setLoadingEleves(false); }
    })();
  }, []);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return eleves.filter(e => (e.companyName || e.name || '').toLowerCase().includes(q));
  }, [eleves, search]);

  const handleSelectDoc = (id: DocType) => {
    setSelectedDoc(id);
    setReference(genRef(id === 'SCOLARITE' ? 'CS' : id === 'RADIATION' ? 'CR' : id === 'SORTIE' ? 'AS' : 'FS'));
    setMotif('');
    setDestination('');
    setDateActivite('');
  };

  const handlePrint = () => {
    if (!selectedEleve || !selectedDoc) return;
    const docInfo = DOCS.find(d => d.id === selectedDoc)!;
    window.print();
    const entry: EmissionEntry = {
      id: genId(),
      timestamp: new Date().toISOString(),
      docType: selectedDoc,
      docLabel: docInfo.label,
      eleveNom: buildNomComplet(selectedEleve),
      eleveMatricule: selectedEleve.matricule || selectedEleve.ine || '—',
      niveau: selectedEleve.niveau || selectedEleve.niveauScolaire || '',
      reference,
    };
    const newEmissions = [entry, ...emissions];
    setEmissions(newEmissions);
    saveEmissions(newEmissions);
    showToast(`${docInfo.label} imprimé pour ${entry.eleveNom}.`, 'success');
  };

  const kpis = useMemo(() => ({
    total: emissions.length,
    scolarite: emissions.filter(e => e.docType === 'SCOLARITE').length,
    radiation: emissions.filter(e => e.docType === 'RADIATION').length,
    ceJour: emissions.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString()).length,
  }), [emissions]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Styles impression */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #cert-print, #cert-print * { visibility: visible !important; }
          #cert-print { position: fixed; inset: 0; padding: 40px; background: white; }
        }
      `}</style>

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
                  const nom = e.companyName || e.name || '';
                  const niveau = e.niveau || e.niveauScolaire || '';
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
                      <p className="text-xs text-slate-400">{buildNomComplet(selectedEleve)} · {NIVEAUX_LABELS[selectedEleve.niveau || selectedEleve.niveauScolaire || ''] || ''}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Réf : {reference}</span>
                  </div>
                  {/* Zone imprimable */}
                  <div id="cert-print" ref={printRef} className="p-8">
                    {selectedDoc === 'SCOLARITE' && <CertificatScolarite eleve={selectedEleve} reference={reference} />}
                    {selectedDoc === 'RADIATION' && <CertificatRadiation eleve={selectedEleve} reference={reference} motif={motif} />}
                    {selectedDoc === 'SORTIE'    && <AutorisationSortie eleve={selectedEleve} reference={reference} destination={destination} dateActivite={dateActivite ? new Date(dateActivite).toLocaleDateString('fr-FR') : ''} />}
                    {selectedDoc === 'SANITAIRE' && <FicheSanitaire eleve={selectedEleve} reference={reference} />}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setSelectedDoc(null); setSelectedEleve(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw size={15} /> Réinitialiser
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!canGenerate}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={15} /> Imprimer / Exporter en PDF
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-slate-800 flex items-center gap-2">
              <History size={16} /> Historique des émissions ({emissions.length})
            </p>
            {emissions.length > 0 && (
              <button
                onClick={() => { setEmissions([]); saveEmissions([]); }}
                className="text-xs text-rose-500 hover:text-rose-700 font-medium"
              >Effacer</button>
            )}
          </div>
          {emissions.length === 0 ? (
            <div className="p-16 text-center">
              <History size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Aucun document émis</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {emissions.map(em => {
                const doc = DOCS.find(d => d.id === em.docType);
                const c = doc ? COLOR_MAP[doc.color] : COLOR_MAP.blue;
                const Icon = doc?.icon ?? FileText;
                return (
                  <div key={em.id} className="px-5 py-4 hover:bg-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-xl ${c.bg}`}><Icon size={15} className={c.text} /></span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{em.eleveNom}</p>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                            {em.docLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{NIVEAUX_LABELS[em.niveau] ?? em.niveau} · Réf : {em.reference}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDateTime(em.timestamp)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Certificats;
