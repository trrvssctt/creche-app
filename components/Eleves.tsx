import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Edit3, Trash2, X, RefreshCw, Eye,
  Save, AlertCircle, Phone, Baby, BookOpen,
  ShieldCheck, Filter, CheckCircle2,
  UserCheck, UserX, Clock, GraduationCap, Heart,
  ArrowRight, ChevronLeft, FileText, FolderOpen,
  ClipboardCheck, UserPlus, ClipboardList, Banknote,
  Repeat, Calendar, AlertTriangle,
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { openInvoicePrintWindow, type StudentInvoiceData } from '../services/invoicePdf';
import { User, Eleve, NiveauScolaire, RegimeFinancier, StatutAdmission } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: string }[] = [
  { value: 'CRECHE', label: 'Crèche (3–12 mois)', cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',      cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section',     cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',      cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',                  cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',                 cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',                 cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',                 cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',                 cycle: 'Élémentaire' },
];

const REGIMES: { value: RegimeFinancier; label: string; color: string }[] = [
  { value: 'NORMAL',               label: 'Normal',               color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'CAS_SOCIAL_PARTIEL',   label: 'Cas social (partiel)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'CAS_SOCIAL_TOTAL',     label: 'Cas social (total)',   color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const STATUTS: { value: StatutAdmission; label: string; color: string }[] = [
  { value: 'EN_ATTENTE', label: 'Candidature', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'ADMIS',      label: 'Admis',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'INSCRIT',    label: 'Inscrit',     color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'ACTIF',      label: 'Actif',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'RADIE',      label: 'Radié',       color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'SUSPENDU',   label: 'Suspendu',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const ANNEE_COURANTE = '2026-2027';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genMatricule(niveau: NiveauScolaire): string {
  const prefix: Record<NiveauScolaire, string> = {
    CRECHE: 'CR', PS: 'PS', MS: 'MS', GS: 'GS',
    CP: 'CP', CE1: 'C1', CE2: 'C2', CM1: 'M1', CM2: 'M2',
  };
  return `${prefix[niveau]}-${ANNEE_COURANTE.slice(0, 4)}-${String(Date.now()).slice(-4)}`;
}

function niveauLabel(n: NiveauScolaire) {
  return NIVEAUX.find(x => x.value === n)?.label ?? n;
}

function statutBadge(s: StatutAdmission) {
  const found = STATUTS.find(x => x.value === s);
  return found
    ? <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${found.color}`}>{found.label}</span>
    : null;
}

function regimeBadge(r: RegimeFinancier) {
  const found = REGIMES.find(x => x.value === r);
  return found
    ? <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${found.color}`}>{found.label}</span>
    : null;
}

// ─── Formulaire vide ─────────────────────────────────────────────────────────

const emptyForm = (): Partial<Eleve> => ({
  matricule: '',
  nom: '',
  prenom: '',
  dateNaissance: '',
  lieuNaissance: '',
  niveau: 'PS',
  classeId: undefined,
  regimeFinancier: 'NORMAL',
  remisePct: 0,
  cantine: false,
  transportBus: false,
  besoinSpecifique: '',
  statut: 'INSCRIT',
  dateAdmission: new Date().toISOString().slice(0, 10),
  whatsappPrincipal: '',
  anneeScolaire: ANNEE_COURANTE,
  parent1: { nom: '', prenom: '', telephone: '', whatsapp: '', email: '', lien: 'MERE' },
  parent2: undefined,
  contactUrgence: undefined,
});

// ─── Document HTML helpers ────────────────────────────────────────────────────

const SCHOOL_HEADER = (annee: string) => `
  <div class="header">
    <h1>Le Toit des Anges</h1>
    <p>469 Cité Cheikh Omar TALL, Ouakam, Dakar</p>
    <p>Année scolaire ${annee}</p>
  </div>`;

const SHARED_STYLES = `
  @page{size:A4;margin:20mm}
  body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;margin:0}
  .header{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:14px;margin-bottom:22px}
  .header h1{font-size:17pt;margin:0 0 4px;color:#4f46e5;font-weight:900;text-transform:uppercase;letter-spacing:2px}
  .header p{margin:2px 0;font-size:9pt;color:#64748b}
  .titre{font-size:14pt;font-weight:bold;text-align:center;margin:0 0 14px;text-transform:uppercase;letter-spacing:3px;color:#0f172a}
  .matricule{text-align:center;background:#eef2ff;padding:10px;border-radius:10px;font-family:monospace;font-size:14pt;font-weight:bold;color:#4f46e5;margin-bottom:6px;border:2px solid #c7d2fe}
  .dossier{text-align:center;font-size:8pt;color:#64748b;margin-bottom:22px;font-family:monospace}
  .section{margin-bottom:18px}
  .section h2{font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field label{font-size:8pt;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:2px}
  .field span{font-weight:bold;font-size:11pt}
  .sigs{margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:50px}
  .sig{border-top:1px solid #cbd5e1;padding-top:8px;font-size:9pt;color:#64748b;height:70px}`;

function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=820,height=1100');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title><style>${SHARED_STYLES}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function buildDossierNom(eleve: Partial<Eleve>): string {
  return `${eleve.matricule}-${(eleve.nom || '').toUpperCase()}-${(eleve.prenom || '').toUpperCase()}-${eleve.niveau}`;
}

function imprimerFicheInscription(eleve: Partial<Eleve>) {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim();
  const parent = eleve.parent1;
  const niveauLib = NIVEAUX.find(n => n.value === eleve.niveau)?.label || eleve.niveau || '—';
  const regimeLib = REGIMES.find(r => r.value === eleve.regimeFinancier)?.label || '—';
  const options = [eleve.cantine ? 'Cantine' : '', eleve.transportBus ? 'Bus scolaire' : ''].filter(Boolean).join(', ') || '—';
  const dossier = buildDossierNom(eleve);
  openPrintWindow(`Fiche Inscription — ${nomComplet}`, `
    ${SCHOOL_HEADER(ANNEE_COURANTE)}
    <div class="titre">Fiche d'Inscription</div>
    <div class="matricule">${eleve.matricule || '—'}</div>
    <div class="dossier">Dossier : ${dossier}</div>
    <div class="section">
      <h2>Identité de l'élève</h2>
      <div class="grid">
        <div class="field"><label>Nom & Prénom</label><span>${nomComplet}</span></div>
        <div class="field"><label>Date de naissance</label><span>${eleve.dateNaissance ? new Date(eleve.dateNaissance).toLocaleDateString('fr-FR') : '—'}</span></div>
        <div class="field"><label>Lieu de naissance</label><span>${eleve.lieuNaissance || '—'}</span></div>
        <div class="field"><label>Classe / Niveau</label><span>${niveauLib}</span></div>
        <div class="field"><label>Régime financier</label><span>${regimeLib}</span></div>
        <div class="field"><label>Options</label><span>${options}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Parent / Tuteur légal</h2>
      <div class="grid">
        <div class="field"><label>Nom & Prénom</label><span>${parent ? `${parent.prenom} ${parent.nom}`.trim() : '—'}</span></div>
        <div class="field"><label>Qualité</label><span>${parent?.lien === 'MERE' ? 'Mère' : parent?.lien === 'PERE' ? 'Père' : 'Tuteur légal'}</span></div>
        <div class="field"><label>Téléphone / WhatsApp</label><span>${parent?.whatsapp || parent?.telephone || '—'}</span></div>
        <div class="field"><label>Email</label><span>${parent?.email || '—'}</span></div>
      </div>
    </div>
    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>`);
}

function imprimerCertificatScolarite(eleve: Partial<Eleve>) {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim();
  const niveauLib = NIVEAUX.find(n => n.value === eleve.niveau)?.label || eleve.niveau || '—';
  const ref = `CERT-SCOL-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;
  openPrintWindow(`Certificat de Scolarité — ${nomComplet}`, `
    ${SCHOOL_HEADER(ANNEE_COURANTE)}
    <div class="titre">Certificat de Scolarité</div>
    <div class="matricule">${ref}</div>
    <div class="dossier">Matricule élève : ${eleve.matricule || '—'}</div>
    <div style="margin:30px 0;font-size:12pt;line-height:2;text-align:justify">
      <p>La Directrice de l'établissement <strong>Le Toit des Anges</strong> certifie que l'élève&nbsp;:</p>
      <p style="text-align:center;font-size:15pt;font-weight:900;text-transform:uppercase;margin:20px 0">${nomComplet}</p>
      <p>né(e) le <strong>${eleve.dateNaissance ? new Date(eleve.dateNaissance).toLocaleDateString('fr-FR') : '—'}</strong>
         à <strong>${eleve.lieuNaissance || '—'}</strong>,
         est régulièrement inscrit(e) dans notre établissement pour l'année scolaire
         <strong>${ANNEE_COURANTE}</strong>, en classe de <strong>${niveauLib}</strong>.</p>
      <p>Ce certificat est délivré pour servir et valoir ce que de droit.</p>
    </div>
    <div style="margin-top:20px;font-size:9pt;color:#64748b">Dakar, le ${new Date().toLocaleDateString('fr-FR')}</div>
    <div class="sigs" style="margin-top:30px">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>`);
}

function imprimerFicheSanitaire(eleve: Partial<Eleve>) {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim();
  const parent = eleve.parent1;
  const urgence = eleve.contactUrgence;
  openPrintWindow(`Fiche Sanitaire — ${nomComplet}`, `
    ${SCHOOL_HEADER(ANNEE_COURANTE)}
    <div class="titre">Fiche Sanitaire</div>
    <div class="matricule">${eleve.matricule || '—'}</div>
    <div class="dossier">Dossier : ${buildDossierNom(eleve)}</div>
    <div class="section">
      <h2>Identité</h2>
      <div class="grid">
        <div class="field"><label>Nom & Prénom</label><span>${nomComplet}</span></div>
        <div class="field"><label>Date de naissance</label><span>${eleve.dateNaissance ? new Date(eleve.dateNaissance).toLocaleDateString('fr-FR') : '—'}</span></div>
        <div class="field"><label>Besoins spécifiques / Allergies</label><span>${eleve.besoinSpecifique || 'Aucun signalé'}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Contact parent / tuteur légal</h2>
      <div class="grid">
        <div class="field"><label>Nom & Prénom</label><span>${parent ? `${parent.prenom} ${parent.nom}`.trim() : '—'}</span></div>
        <div class="field"><label>Téléphone</label><span>${parent?.telephone || parent?.whatsapp || '—'}</span></div>
        <div class="field"><label>WhatsApp</label><span>${parent?.whatsapp || '—'}</span></div>
        <div class="field"><label>Email</label><span>${parent?.email || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Contact d'urgence</h2>
      <div class="grid">
        <div class="field"><label>Nom & Prénom</label><span>${urgence ? `${urgence.prenom || ''} ${urgence.nom}`.trim() : '—'}</span></div>
        <div class="field"><label>Téléphone</label><span>${urgence?.telephone || '—'}</span></div>
        <div class="field"><label>Lien avec l'enfant</label><span>${urgence?.lien || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Informations médicales (à compléter par le parent)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:10pt">
        ${['Groupe sanguin','Allergies alimentaires','Allergies médicamenteuses','Traitements en cours','Médecin traitant','Téléphone médecin'].map(l =>
          `<tr><td style="border:1px solid #e2e8f0;padding:8px 10px;width:40%;color:#64748b;font-weight:bold">${l}</td><td style="border:1px solid #e2e8f0;padding:8px 10px"></td></tr>`
        ).join('')}
      </table>
    </div>
    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>`);
}

function imprimerAutorisationSortie(eleve: Partial<Eleve>) {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim();
  const parent = eleve.parent1;
  const niveauLib = NIVEAUX.find(n => n.value === eleve.niveau)?.label || eleve.niveau || '—';
  openPrintWindow(`Autorisation de Sortie — ${nomComplet}`, `
    ${SCHOOL_HEADER(ANNEE_COURANTE)}
    <div class="titre">Autorisation de Sortie Scolaire</div>
    <div class="dossier">Année scolaire ${ANNEE_COURANTE} — Classe : ${niveauLib}</div>
    <div style="margin:24px 0;font-size:12pt;line-height:2;text-align:justify">
      <p>Je soussigné(e) <strong>${parent ? `${parent.prenom} ${parent.nom}`.trim() : '___________________'}</strong>,
         parent/tuteur légal de l'élève <strong>${nomComplet}</strong> (matricule : ${eleve.matricule || '—'}),
         inscrit(e) en classe de <strong>${niveauLib}</strong>,</p>
      <p>autorise mon enfant à participer aux sorties scolaires et activités extrascolaires organisées par l'établissement
         <strong>Le Toit des Anges</strong> durant l'année scolaire <strong>${ANNEE_COURANTE}</strong>.</p>
      <p>Je reconnais avoir été informé(e) des conditions d'encadrement et des mesures de sécurité mises en place.</p>
    </div>
    <div style="margin-top:16px">
      <table style="width:100%;border-collapse:collapse;font-size:10pt">
        <tr>
          <td style="border:1px solid #e2e8f0;padding:8px 10px;width:50%;color:#64748b;font-weight:bold">En cas d'urgence, appeler</td>
          <td style="border:1px solid #e2e8f0;padding:8px 10px">${parent?.telephone || parent?.whatsapp || '—'}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e2e8f0;padding:8px 10px;color:#64748b;font-weight:bold">Autorisation de soins d'urgence</td>
          <td style="border:1px solid #e2e8f0;padding:8px 10px">☐ Oui &nbsp;&nbsp; ☐ Non</td>
        </tr>
      </table>
    </div>
    <div class="sigs" style="margin-top:36px">
      <div class="sig">Fait à Dakar, le ________________<br>Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>`);
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface ElevesProps {
  user: User;
  currency: string;
  refreshKey?: number;
}

// ─── Bouton facture d'inscription ─────────────────────────────────────────
const NIVEAUX_LABELS_MAP: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const METHODES_PAIEMENT = [
  { value: 'CASH',         label: 'Espèces' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'WAVE',         label: 'Wave' },
  { value: 'MTN_MOMO',     label: 'MTN MoMo' },
  { value: 'TRANSFER',     label: 'Virement' },
  { value: 'CHEQUE',       label: 'Chèque' },
];

const RECURRING_TYPES = ['MENSUALITE', 'BUS', 'CANTINE'];

const InscriptionFactureButton: React.FC<{
  inscritEleve: Partial<Eleve> | null;
  servicesApplicables: any[];
  currency: string;
}> = ({ inscritEleve, servicesApplicables, currency }) => {
  const showToast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [methodePaiement, setMethodePaiement] = React.useState('CASH');

  // Séparer frais d'inscription des services récurrents
  const feeServices = servicesApplicables.filter(s => {
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    return !RECURRING_TYPES.includes(type);
  });
  const recurringServices = servicesApplicables.filter(s => {
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    return RECURRING_TYPES.includes(type);
  });

  const totalFees = feeServices.reduce((sum, s) => sum + Number(s.price), 0);

  const handleGenerate = async () => {
    if (!inscritEleve?.id || feeServices.length === 0) return;
    setLoading(true);
    try {
      const res: any = await apiClient.post(
        `/eleves/${inscritEleve.id}/facture-inscription`,
        { services: servicesApplicables, methodePaiement }
      );

      const invoiceData: StudentInvoiceData = {
        type: 'RECU',
        eleve: {
          nom: inscritEleve.nom || '',
          prenom: inscritEleve.prenom || '',
          matricule: inscritEleve.matricule,
          niveau: NIVEAUX_LABELS_MAP[inscritEleve.niveau as string] || inscritEleve.niveau,
        },
        parent1: inscritEleve.parent1,
        period: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        currency,
        reference: res?.sale?.reference,
        methodePaiement,
        echeances: feeServices.map(s => ({
          service: { name: s.name },
          periodeLabel: 'Ponctuel',
          montant: Number(s.price),
          statut: 'PAYE',
          dateEcheance: new Date().toISOString().slice(0, 10),
          description: s.name,
        })),
        totalDu: totalFees,
        totalPaye: totalFees,
        solde: 0,
      };

      openInvoicePrintWindow(invoiceData);
      showToast('Reçu généré — enregistrez-le en PDF depuis le dialogue d\'impression.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la génération du reçu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!inscritEleve?.id || feeServices.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {recurringServices.length > 0 && (
        <p className="text-[9px] text-slate-400 text-center">
          Les mensualités/bus/cantine seront gérés via le Recouvrement
        </p>
      )}
      <div className="flex gap-2">
        <select
          value={methodePaiement}
          onChange={e => setMethodePaiement(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
        >
          {METHODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
        >
          {loading
            ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Traitement…</>
            : <><FileText size={12} /> Encaisser & Reçu</>}
        </button>
      </div>
      <p className="text-[9px] text-emerald-700 font-bold text-center">
        Frais d'inscription : {totalFees.toLocaleString('fr-FR')} {currency}
      </p>
    </div>
  );
};

const Eleves: React.FC<ElevesProps> = ({ user, currency, refreshKey }) => {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [showModal, setShowModal] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Eleve | null>(null);
  const [formData, setFormData] = useState<Partial<Eleve>>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    niveau: 'ALL' as NiveauScolaire | 'ALL',
    statut: 'ALL' as StatutAdmission | 'ALL',
    regime: 'ALL' as RegimeFinancier | 'ALL',
  });

  // ── Création multi-étapes ──────────────────────────────────────────────────
  const [createStep, setCreateStep] = useState<'SELECTION' | 'FORM' | 'DOCS'>('SELECTION');
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(false);
  const [admissionSearch, setAdmissionSearch] = useState('');
  const [inscritEleve, setInscritEleve] = useState<Partial<Eleve> | null>(null);
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [servicesApplicables, setServicesApplicables] = useState<any[]>([]);

  // ── Abonnements & Échéances ────────────────────────────────────────────────
  const [abonnements, setAbonnements] = useState<any[]>([]);
  const [abonnementsLoading, setAbonnementsLoading] = useState(false);
  const [allServicesRecurrents, setAllServicesRecurrents] = useState<any[]>([]);
  const [showAddAbonnement, setShowAddAbonnement] = useState(false);
  const [newAboForm, setNewAboForm] = useState({ serviceId: '', dateDebut: new Date().toISOString().slice(0, 10) });
  const [aboActionLoading, setAboActionLoading] = useState(false);
  const [expandedAbos, setExpandedAbos] = useState<Set<string>>(new Set());

  const showToast = useToast();
  const canModify = authBridge.canPerform(user, 'EDIT', 'eleves');
  const canDelete  = authBridge.canPerform(user, 'DELETE', 'eleves');

  // ── Fetch élèves ───────────────────────────────────────────────────────────

  const fetchEleves = async () => {
    setLoading(true);
    setError(null);
    try {
      const [elevesData, classesData] = await Promise.all([
        apiClient.get('/eleves'),
        apiClient.get('/classes')
      ]);
      setEleves(Array.isArray(elevesData) ? elevesData : (elevesData?.rows ?? elevesData?.eleves ?? []));
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch {
      setEleves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEleves(); }, [refreshKey]);

  // ── Fetch dossiers d'admission (EN_ATTENTE + ADMIS — pas encore inscrits) ────

  const resolveStatut = (d: any): StatutAdmission => {
    if (d.statut) return d.statut as StatutAdmission;
    const api = (d.status || '').toLowerCase();
    const MAP: Record<string, StatutAdmission> = {
      admis: 'ADMIS', en_attente: 'EN_ATTENTE', actif: 'ACTIF',
      inscrit: 'INSCRIT', radie: 'RADIE', suspendu: 'SUSPENDU',
    };
    return MAP[api] ?? 'EN_ATTENTE';
  };

  const fetchAdmissions = async () => {
    setAdmissionsLoading(true);
    try {
      const data = await apiClient.get('/customers');
      const list = Array.isArray(data) ? data : (data?.rows ?? data?.customers ?? []);
      // Garder EN_ATTENTE et ADMIS — exclure déjà inscrits / radiés / actifs
      setAdmissions(list.filter((d: any) => {
        const s = resolveStatut(d);
        return s === 'EN_ATTENTE' || s === 'ADMIS';
      }));
    } catch {
      setAdmissions([]);
    } finally {
      setAdmissionsLoading(false);
    }
  };

  // ── Préremplissage depuis un dossier d'admission ───────────────────────────

  const selectDossierForInscription = (d: any) => {
    const fullName = (d.companyName || d.name || '').trim();
    const parts = fullName.split(' ');
    const prenom = parts[0] || '';
    const nom = parts.slice(1).join(' ') || '';

    const parentFull = (d.mainContact || '').trim();
    const pParts = parentFull.split(' ');
    const p1Prenom = pParts[0] || '';
    const p1Nom = pParts.slice(1).join(' ') || '';

    const emailIsGenerated = (d.email || '').includes('@letoidesanges.sn');

    setSelectedDossierId(d.id || null);
    setFormData({
      nom,
      prenom,
      dateNaissance: d.dateNaissance || '',
      lieuNaissance: d.billingAddress || '',
      niveau: (d.niveau as NiveauScolaire) || 'PS',
      regimeFinancier: (d.regimeFinancier as RegimeFinancier) || 'NORMAL',
      remisePct: d.remisePct || 0,
      cantine: !!d.cantine,
      transportBus: !!(d.transportBus || d.transport_bus),
      besoinSpecifique: d.besoinSpecifique || '',
      statut: 'INSCRIT',
      dateAdmission: new Date().toISOString().slice(0, 10),
      anneeScolaire: ANNEE_COURANTE,
      whatsappPrincipal: d.phone || '',
      parent1: {
        nom: p1Nom || p1Prenom,
        prenom: p1Nom ? p1Prenom : '',
        telephone: d.phone || '',
        whatsapp: d.phone || '',
        email: emailIsGenerated ? '' : (d.email || ''),
        lien: 'MERE',
      },
    });
    setCreateStep('FORM');
  };

  // ── Charger les offres de scolarité applicables pour un niveau ─────────────

  const loadServicesApplicables = async (niveau: NiveauScolaire, cantine: boolean, bus: boolean) => {
    try {
      const data = await apiClient.get('/services');
      const list: any[] = Array.isArray(data) ? data : [];
      const filtered = list.filter(s => {
        // Exclure les services inactifs
        if (s.isActive === false || s.is_active === false) return false;

        const niveaux: string[] = s.niveauxCibles || s.niveaux_cibles || [];
        const type = (s.typeOffre || s.type_offre || '').toUpperCase();

        // Un service sans niveaux cibles ne s'applique qu'aux frais ponctuels (inscription, frais admin)
        // Les mensualités/cantine/bus doivent explicitement cibler un niveau
        if (niveaux.length === 0) {
          // Inclure seulement si ce n'est pas une mensualité ou un service de transport/restauration
          return type !== 'MENSUALITE' && type !== 'BUS' && type !== 'CANTINE';
        }

        if (!niveaux.includes(niveau)) return false;

        if (type === 'BUS')     return bus;
        if (type === 'CANTINE') return cantine;
        return true;
      });
      setServicesApplicables(filtered);
    } catch {
      setServicesApplicables([]);
    }
  };

  const fetchAbonnements = async (eleveId: string) => {
    setAbonnementsLoading(true);
    try {
      const data = await apiClient.get(`/abonnements/eleve/${eleveId}`);
      setAbonnements(Array.isArray(data) ? data : []);
    } catch {
      setAbonnements([]);
    } finally {
      setAbonnementsLoading(false);
    }
  };

  const loadServicesRecurrents = async () => {
    try {
      const data = await apiClient.get('/services');
      const list: any[] = Array.isArray(data) ? data : [];
      setAllServicesRecurrents(list.filter(s => s.isActive && (s.estRecurrent || s.est_recurrent)));
    } catch {
      setAllServicesRecurrents([]);
    }
  };

  const handleAddAbonnement = async () => {
    if (!selectedEleve?.id || !newAboForm.serviceId) return;
    setAboActionLoading(true);
    try {
      await apiClient.post('/abonnements', {
        eleveId: selectedEleve.id,
        serviceId: newAboForm.serviceId,
        dateDebut: newAboForm.dateDebut,
      });
      setShowAddAbonnement(false);
      setNewAboForm({ serviceId: '', dateDebut: new Date().toISOString().slice(0, 10) });
      fetchAbonnements(selectedEleve.id);
      showToast('Abonnement créé. Les échéances ont été générées.', 'success');
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de la création de l'abonnement.", 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  const handleDesactiverAbonnement = async (aboId: string) => {
    if (!selectedEleve?.id) return;
    setAboActionLoading(true);
    try {
      await apiClient.put(`/abonnements/${aboId}/desactiver`, {});
      fetchAbonnements(selectedEleve.id);
      showToast('Abonnement désactivé.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur.', 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  const handlePayEcheance = async (echeanceId: string) => {
    if (!selectedEleve?.id) return;
    setAboActionLoading(true);
    try {
      await apiClient.put(`/abonnements/echeances/${echeanceId}/payer`, { methodePaiement: 'CASH' });
      fetchAbonnements(selectedEleve.id);
      showToast('Échéance marquée comme payée.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur.', 'error');
    } finally {
      setAboActionLoading(false);
    }
  };

  // ── Filtrage ───────────────────────────────────────────────────────────────

  const filtered = eleves.filter(e => {
    const q = filters.search.toLowerCase();
    if (q && !`${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q)) return false;
    if (filters.niveau !== 'ALL' && e.niveau !== filters.niveau) return false;
    if (filters.statut !== 'ALL' && e.statut !== filters.statut) return false;
    if (filters.regime !== 'ALL' && e.regimeFinancier !== filters.regime) return false;
    return true;
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const activeEleves = eleves.filter(e => e.statut === 'INSCRIT' || e.statut === 'ACTIF');

  const kpis = {
    total:    activeEleves.length,
    cantine:  activeEleves.filter(e => e.cantine).length,
    cassocial: activeEleves.filter(e => e.regimeFinancier !== 'NORMAL').length,
    besoins:  activeEleves.filter(e => e.besoinSpecifique).length,
  };

  // Répartition par niveau (élèves actifs uniquement)
  const niveauxStats = NIVEAUX.map(n => ({
    ...n,
    count: activeEleves.filter(e => e.niveau === n.value).length,
  })).filter(n => n.count > 0);

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const p1Phone = formData.parent1?.whatsapp?.trim() || formData.parent1?.telephone?.trim();
    if (!formData.nom?.trim())           { setError('Le nom de l\'élève est obligatoire.'); return; }
    if (!formData.prenom?.trim())        { setError('Le prénom de l\'élève est obligatoire.'); return; }
    if (!formData.niveau)                { setError('Le niveau scolaire est obligatoire.'); return; }
    if (!formData.dateNaissance)         { setError('La date de naissance est obligatoire.'); return; }
    if (showModal === 'CREATE' && !p1Phone) { setError('Le numéro WhatsApp ou téléphone du parent est obligatoire.'); return; }
    setActionLoading(true);
    setError(null);
    try {
      const payload: Partial<Eleve> = {
        ...formData,
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        matricule: formData.matricule || genMatricule(formData.niveau as NiveauScolaire),
        anneeScolaire: ANNEE_COURANTE,
        whatsappPrincipal: formData.parent1?.whatsapp?.trim() || formData.whatsappPrincipal || '',
        // Toujours INSCRIT à la création — non modifiable depuis ce formulaire
        ...(showModal === 'CREATE' && {
          statut: 'INSCRIT',
          dateAdmission: formData.dateAdmission || new Date().toISOString().slice(0, 10),
        }),
      };
      if (showModal === 'EDIT' && selectedEleve?.id) {
        await apiClient.put(`/eleves/${selectedEleve.id}`, payload);
        showToast('Fiche élève mise à jour.', 'success');
        setShowModal(null);
        setSelectedEleve(null);
        fetchEleves();
      } else {
        const created: any = await apiClient.post('/eleves', payload);
        if (created?.id) setInscritEleve({ ...payload, id: created.id });
        // Mettre à jour le dossier d'admission → INSCRIT si provient d'un dossier
        if (selectedDossierId) {
          const dossierIdToMark = selectedDossierId;
          try {
            await apiClient.put(`/customers/${dossierIdToMark}`, {
              statut: 'INSCRIT',
              status: 'inscrit',
              isActive: true,
            });
          } catch (e) {
            console.warn('[Eleves] Mise à jour statut dossier échouée :', e);
          }
          // Retirer le dossier de la liste locale dans tous les cas
          setAdmissions(prev => prev.filter(d => d.id !== dossierIdToMark));
        }
        showToast('Élève inscrit avec succès.', 'success');
        if (!created?.id) setInscritEleve(payload);
        loadServicesApplicables(
          payload.niveau as NiveauScolaire,
          !!payload.cantine,
          !!payload.transportBus
        );
        setCreateStep('DOCS');
        fetchEleves();
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (eleve: Eleve) => {
    setActionLoading(true);
    try {
      await apiClient.delete(`/eleves/${eleve.id}`);
      showToast('Élève supprimé.', 'success');
      setShowDeleteConfirm(null);
      fetchEleves();
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la suppression.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setError(null);
    setCreateStep('SELECTION');
    setAdmissionSearch('');
    setInscritEleve(null);
    fetchAdmissions();
    setShowModal('CREATE');
  };

  const openEdit = (e: Eleve) => {
    setSelectedEleve(e);
    setFormData({ ...e });
    setError(null);
    setShowModal('EDIT');
  };

  const openView = (e: Eleve) => {
    setSelectedEleve(e);
    setShowModal('VIEW');
    setAbonnements([]);
    setShowAddAbonnement(false);
    setExpandedAbos(new Set());
    fetchAbonnements(e.id);
    loadServicesRecurrents();
  };

  const closeCreateModal = () => {
    setShowModal(null);
    setCreateStep('SELECTION');
    setSelectedDossierId(null);
    setServicesApplicables([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* En-tête + bouton créer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <GraduationCap className="text-indigo-600" size={32} /> Gestion des Élèves
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Année scolaire {ANNEE_COURANTE}
          </p>
        </div>
        {canModify && (
          <button
            onClick={openCreate}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
          >
            <Plus size={18} /> Inscrire un Élève
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Élèves inscrits',    value: kpis.total,     icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50',  sub: `${eleves.filter(e => e.statut === 'RADIE' || e.statut === 'SUSPENDU').length} inactifs` },
          { label: 'Cantine',            value: kpis.cantine,   icon: Baby,      color: 'text-sky-600',     bg: 'bg-sky-50',      sub: kpis.total > 0 ? `${Math.round(kpis.cantine / kpis.total * 100)}%` : '—' },
          { label: 'Cas sociaux',        value: kpis.cassocial, icon: Heart,     color: 'text-rose-600',    bg: 'bg-rose-50',     sub: kpis.total > 0 ? `${Math.round(kpis.cassocial / kpis.total * 100)}%` : '—' },
          { label: 'Besoins spécifiques',value: kpis.besoins,   icon: Clock,     color: 'text-violet-600',  bg: 'bg-violet-50',   sub: kpis.besoins === 0 ? 'Aucun' : 'suivi requis' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <kpi.icon className={kpi.color} size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{kpi.value}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Répartition par niveau */}
      {niveauxStats.length > 0 && (
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition par niveau</p>
          <div className="flex flex-wrap gap-3">
            {niveauxStats.map(n => {
              const pct = kpis.total > 0 ? Math.round(n.count / kpis.total * 100) : 0;
              return (
                <div key={n.value} className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{n.label}</span>
                  <span className="text-sm font-black text-slate-900">{n.count}</span>
                  <span className="text-[9px] text-slate-400">({pct}%)</span>
                </div>
              );
            })}
          </div>
          {/* Barre de progression par niveau */}
          <div className="mt-4 flex rounded-full overflow-hidden h-2 gap-0.5">
            {niveauxStats.map((n, i) => {
              const pct = kpis.total > 0 ? (n.count / kpis.total * 100) : 0;
              const colors = ['bg-indigo-400','bg-sky-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-violet-400','bg-teal-400','bg-orange-400','bg-pink-400'];
              return <div key={n.value} style={{ width: `${pct}%` }} className={`${colors[i % colors.length]} h-full`} title={`${n.label}: ${n.count}`} />;
            })}
          </div>
        </div>
      )}

      {/* Barre de recherche & filtres */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Nom, prénom ou matricule..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['CARD', 'LIST'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === m ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {m === 'CARD' ? 'Cartes' : 'Liste'}
            </button>
          ))}
          <button onClick={() => setShowFilters(v => !v)}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <Filter size={14} /> Filtres
          </button>
          <button onClick={fetchEleves} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtres avancés */}
      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Niveau</label>
            <select value={filters.niveau} onChange={e => setFilters({ ...filters, niveau: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les niveaux</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Statut</label>
            <select value={filters.statut} onChange={e => setFilters({ ...filters, statut: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Régime</label>
            <select value={filters.regime} onChange={e => setFilters({ ...filters, regime: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les régimes</option>
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button onClick={() => setFilters({ search: '', niveau: 'ALL', statut: 'ALL', regime: 'ALL' })}
              className="w-full py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      )}

      {error && !showModal && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Contenu principal */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des élèves...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center flex flex-col items-center gap-4">
          <GraduationCap size={40} className="text-slate-300" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {eleves.length === 0 ? 'Aucun élève inscrit' : 'Aucun résultat pour ces filtres'}
          </p>
          {canModify && eleves.length === 0 && (
            <button onClick={openCreate}
              className="mt-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
              Inscrire le premier élève
            </button>
          )}
        </div>
      ) : viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(eleve => (
            <div key={eleve.id}
              className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.2rem] flex items-center justify-center font-black text-lg shadow-inner">
                  {eleve.prenom[0]}{eleve.nom[0]}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openView(eleve)} title="Voir la fiche"
                    className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all">
                    <Eye size={16} />
                  </button>
                  {canModify && (
                    <button onClick={() => openEdit(eleve)} title="Modifier"
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-xl transition-all">
                      <Edit3 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setShowDeleteConfirm(eleve)} title="Supprimer"
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 text-base tracking-tight">{eleve.prenom} {eleve.nom}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{eleve.matricule}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                    {niveauLabel(eleve.niveau)}
                  </span>
                  {regimeBadge(eleve.regimeFinancier)}
                  {statutBadge(eleve.statut)}
                </div>
                {eleve.besoinSpecifique && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">
                    <Baby size={12} /> Besoins spécifiques
                  </div>
                )}
                <div className="space-y-1 text-[10px] text-slate-500 font-bold">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="shrink-0" />
                    <span>{eleve.parent1.prenom} {eleve.parent1.nom} — {eleve.parent1.whatsapp || eleve.parent1.telephone}</span>
                  </div>
                  {eleve.cantine && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={12} /> Cantine
                    </div>
                  )}
                  {eleve.transportBus && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <CheckCircle2 size={12} /> Transport bus
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Élève', 'Matricule', 'Niveau', 'Statut', 'Régime', 'Parent / WhatsApp', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(eleve => (
                <tr key={eleve.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4 font-black text-slate-900">{eleve.prenom} {eleve.nom}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-500 font-mono">{eleve.matricule}</td>
                  <td className="px-6 py-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase border border-indigo-100">{niveauLabel(eleve.niveau)}</span></td>
                  <td className="px-6 py-4">{statutBadge(eleve.statut)}</td>
                  <td className="px-6 py-4">{regimeBadge(eleve.regimeFinancier)}</td>
                  <td className="px-6 py-4 text-[10px] text-slate-500 font-bold">{eleve.parent1.prenom} — {eleve.parent1.whatsapp || eleve.parent1.telephone}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openView(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Eye size={14} /></button>
                      {canModify && <button onClick={() => openEdit(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-all"><Edit3 size={14} /></button>}
                      {canDelete && <button onClick={() => setShowDeleteConfirm(eleve)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL CRÉER / MODIFIER ══════════════════════════════════════════════ */}
      {(showModal === 'CREATE' || showModal === 'EDIT') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">

            {/* ── En-tête modal ── */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-[3rem]">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                {showModal === 'CREATE' && createStep === 'SELECTION' && (
                  <><ClipboardCheck size={20} className="text-indigo-600" /> Dossiers en attente d'inscription</>
                )}
                {showModal === 'CREATE' && createStep === 'FORM' && (
                  <><UserPlus size={20} className="text-indigo-600" /> Inscrire un Élève</>
                )}
                {showModal === 'CREATE' && createStep === 'DOCS' && (
                  <><FolderOpen size={20} className="text-emerald-600" /> Dossier constitué</>
                )}
                {showModal === 'EDIT' && 'Modifier la Fiche'}
              </h3>
              <button onClick={closeCreateModal}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* ══ ÉTAPE 1 : SÉLECTION DU DOSSIER ══ */}
            {showModal === 'CREATE' && createStep === 'SELECTION' && (
              <div className="p-8 space-y-5">
                <p className="text-slate-500 text-sm font-bold leading-relaxed">
                  Sélectionnez un dossier d'admission pour préremplir automatiquement les champs d'inscription.
                </p>

                {/* Barre de recherche */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom d'enfant ou de parent..."
                    value={admissionSearch}
                    onChange={e => setAdmissionSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Liste des dossiers */}
                {admissionsLoading ? (
                  <div className="py-12 text-center flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des dossiers...</p>
                  </div>
                ) : (() => {
                  const q = admissionSearch.toLowerCase();
                  const filteredAdm = admissions.filter(d => {
                    const name = (d.companyName || d.name || '').toLowerCase();
                    const parent = (d.mainContact || '').toLowerCase();
                    return !q || name.includes(q) || parent.includes(q);
                  });
                  return filteredAdm.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl">
                      <ClipboardList size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {admissions.length === 0
                          ? 'Aucune candidature en attente — créez-en une dans le module Admissions'
                          : 'Aucun résultat pour cette recherche'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredAdm.map(d => {
                        const nomEnfant = d.companyName || d.name || '—';
                        const statut: StatutAdmission = resolveStatut(d);
                        const niveau = d.niveau as NiveauScolaire | undefined;
                        const contact = d.mainContact || '—';
                        return (
                          <div
                            key={d.id}
                            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group"
                            onClick={() => selectDossierForInscription(d)}
                          >
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                              {nomEnfant.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-900 text-sm uppercase truncate">{nomEnfant}</p>
                              <p className="text-[10px] text-slate-500 font-bold truncate">
                                {contact}{niveau ? ` — ${niveauLabel(niveau)}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {statutBadge(statut)}
                              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Bouton saisie manuelle */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setFormData(emptyForm()); setCreateStep('FORM'); }}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus size={16} /> Inscrire sans dossier préexistant
                  </button>
                </div>
              </div>
            )}

            {/* ══ ÉTAPE 2 : FORMULAIRE ══ */}
            {(showModal === 'EDIT' || (showModal === 'CREATE' && createStep === 'FORM')) && (
              <>
                <div className="p-8 space-y-8">
                  {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  {showModal === 'CREATE' && (
                    <button
                      onClick={() => setCreateStep('SELECTION')}
                      className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-xs font-black uppercase tracking-widest transition-all"
                    >
                      <ChevronLeft size={14} /> Choisir un autre dossier
                    </button>
                  )}

                  {/* Informations élève */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <GraduationCap size={14} /> Informations de l'élève
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { label: 'Nom *',               key: 'nom',           type: 'text' },
                        { label: 'Prénom *',            key: 'prenom',        type: 'text' },
                        { label: 'Date de naissance *', key: 'dateNaissance', type: 'date' },
                        { label: 'Lieu de naissance',   key: 'lieuNaissance', type: 'text' },
                      ] as const).map(field => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{field.label}</label>
                          <input
                            type={field.type}
                            value={(formData as any)[field.key] || ''}
                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      ))}

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Niveau *</label>
                        <select value={formData.niveau || 'PS'} onChange={e => setFormData({ ...formData, niveau: e.target.value as NiveauScolaire, classeId: undefined })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Classe physique
                          {classes.filter(c => c.niveau === formData.niveau).length === 0 && (
                            <span className="ml-2 text-amber-500 normal-case">— aucune classe créée pour ce niveau</span>
                          )}
                        </label>
                        <select
                          value={formData.classeId || ''}
                          onChange={e => setFormData({ ...formData, classeId: e.target.value || undefined })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                        >
                          <option value="">— Non affecté —</option>
                          {classes.filter(c => c.niveau === formData.niveau).map(c => {
                            const nb = c.nbEleves ?? 0;
                            const max = c.capaciteMax ?? 30;
                            const restants = max - nb;
                            const isFull = restants <= 0;
                            const isCurrentClass = showModal === 'EDIT' && selectedEleve?.classeId === c.id;
                            const spotsLabel = isFull ? 'Complet' : `${restants} place${restants > 1 ? 's' : ''} libre${restants > 1 ? 's' : ''}`;
                            return (
                              <option key={c.id} value={c.id} disabled={isFull && !isCurrentClass}>
                                {c.nom} ({spotsLabel})
                              </option>
                            );
                          })}
                        </select>
                        {formData.classeId && (() => {
                          const c = classes.find(cl => cl.id === formData.classeId);
                          if (!c) return null;
                          const nb = c.nbEleves ?? 0; const max = c.capaciteMax ?? 30;
                          const pct = Math.round((nb / max) * 100);
                          const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-black text-slate-400">{nb}/{max}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Date d'inscription</label>
                        <input type="date" value={formData.dateAdmission || ''} onChange={e => setFormData({ ...formData, dateAdmission: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                    </div>
                  </section>

                  {/* Régime & Options */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShieldCheck size={14} /> Régime & Options
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Régime financier</label>
                        <select value={formData.regimeFinancier || 'NORMAL'} onChange={e => setFormData({ ...formData, regimeFinancier: e.target.value as RegimeFinancier })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>

                      {formData.regimeFinancier !== 'NORMAL' && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Remise (%)</label>
                          <input type="number" min="0" max="100" value={formData.remisePct || 0}
                            onChange={e => setFormData({ ...formData, remisePct: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                      )}

                      {showModal === 'EDIT' ? (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Statut</label>
                          <select value={formData.statut || 'INSCRIT'} onChange={e => setFormData({ ...formData, statut: e.target.value as StatutAdmission })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Statut</label>
                          <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span className="text-sm font-black text-emerald-700">Inscrit</span>
                            <span className="ml-auto text-[9px] text-emerald-500 font-bold">Défini automatiquement</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 sm:col-span-2">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!formData.cantine} onChange={e => setFormData({ ...formData, cantine: e.target.checked })}
                              className="w-5 h-5 rounded accent-indigo-600" />
                            <span className="text-sm font-black text-slate-700">Cantine</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!formData.transportBus} onChange={e => setFormData({ ...formData, transportBus: e.target.checked })}
                              className="w-5 h-5 rounded accent-indigo-600" />
                            <span className="text-sm font-black text-slate-700">Transport bus</span>
                          </label>
                        </div>
                      </div>

                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Besoins spécifiques (retard, handicap…)</label>
                        <input type="text" value={formData.besoinSpecifique || ''}
                          onChange={e => setFormData({ ...formData, besoinSpecifique: e.target.value })}
                          placeholder="Décrivez si nécessaire..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                      </div>
                    </div>
                  </section>

                  {/* Parent 1 */}
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Users size={14} /> Parent / Tuteur légal (principal)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { label: 'Nom',       key: 'nom' },
                        { label: 'Prénom',    key: 'prenom' },
                        { label: 'Téléphone', key: 'telephone' },
                        { label: 'WhatsApp',  key: 'whatsapp' },
                        { label: 'Email',     key: 'email' },
                      ] as const).map(field => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{field.label}</label>
                          <input type="text" value={(formData.parent1 as any)?.[field.key] || ''}
                            onChange={e => setFormData({ ...formData, parent1: { ...(formData.parent1 as any), [field.key]: e.target.value } })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Lien</label>
                        <select value={formData.parent1?.lien || 'MERE'}
                          onChange={e => setFormData({ ...formData, parent1: { ...(formData.parent1 as any), lien: e.target.value } })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          <option value="MERE">Mère</option>
                          <option value="PERE">Père</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Footer formulaire */}
                <div className="p-8 border-t border-slate-100 flex justify-end gap-4 sticky bottom-0 bg-white rounded-b-[3rem]">
                  <button onClick={closeCreateModal}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Annuler
                  </button>
                  <button onClick={handleSave} disabled={actionLoading}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 disabled:opacity-60">
                    {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {showModal === 'CREATE' ? 'Inscrire' : 'Enregistrer'}
                  </button>
                </div>
              </>
            )}

            {/* ══ ÉTAPE 3 : DOCUMENTS ══ */}
            {showModal === 'CREATE' && createStep === 'DOCS' && inscritEleve && (() => {
              const classeNom = inscritEleve.classeId
                ? classes.find(c => c.id === inscritEleve.classeId)?.nom
                : null;
              return (
              <div className="p-8 space-y-6">

                {/* Confirmation */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-emerald-800 text-sm">Inscription enregistrée avec succès !</p>
                    <p className="text-emerald-700 text-xs font-black">
                      {inscritEleve.prenom} {inscritEleve.nom}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        {NIVEAUX.find(n => n.value === inscritEleve.niveau)?.label || inscritEleve.niveau}
                      </span>
                      {classeNom && (
                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          {classeNom}
                        </span>
                      )}
                      {inscritEleve.matricule && (
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
                          {inscritEleve.matricule}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nom du dossier */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FolderOpen size={12} /> Nom du dossier élève
                  </p>
                  <p className="font-black text-indigo-900 text-sm font-mono break-all">
                    {buildDossierNom(inscritEleve)}
                  </p>
                  <p className="text-indigo-500 text-[10px] font-bold mt-2">
                    Créez un dossier physique ou numérique avec ce nom pour regrouper tous les documents de l'élève.
                  </p>
                </div>

                {/* Offres de scolarité applicables */}
                {servicesApplicables.length > 0 && (() => {
                  const premierVersement = servicesApplicables.reduce((sum, s) => {
                    // Premier versement = frais ponctuels + 1ère mensualité (pas × dureeMois)
                    return sum + Number(s.price);
                  }, 0);
                  return (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                      <Banknote size={13} /> Tarifs applicables
                    </p>
                    <div className="space-y-2">
                      {servicesApplicables.map(s => {
                        const type = (s.typeOffre || s.type_offre || '').toUpperCase();
                        const isMensuel = type === 'MENSUALITE' || type === 'CANTINE' || type === 'BUS';
                        return (
                          <div key={s.id} className="flex justify-between items-center">
                            <div>
                              <span className="font-black text-amber-900 text-sm">{s.name}</span>
                              <span className="ml-2 text-[9px] font-bold text-amber-500 uppercase">
                                {isMensuel ? '/mois' : 'Ponctuel'}
                              </span>
                            </div>
                            <span className="font-black text-amber-800 text-sm">
                              {Number(s.price).toLocaleString('fr-FR')} {currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-amber-200 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Premier versement</span>
                        <span className="font-black text-amber-900 text-sm">
                          {premierVersement.toLocaleString('fr-FR')} {currency}
                        </span>
                      </div>
                      <p className="text-[9px] text-amber-500 font-bold">
                        Frais ponctuels + 1ère mensualité — les versements suivants sont gérés dans le Recouvrement.
                      </p>
                    </div>
                    <InscriptionFactureButton
                      inscritEleve={inscritEleve}
                      servicesApplicables={servicesApplicables}
                      currency={currency}
                    />
                  </div>
                  );
                })()}

                {/* Boutons de génération */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={13} /> Documents administratifs à générer
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        label: 'Fiche d\'inscription',
                        desc: 'Document de référence de l\'inscription',
                        action: () => imprimerFicheInscription(inscritEleve),
                      },
                      {
                        label: 'Certificat de scolarité',
                        desc: 'Atteste l\'inscription pour l\'année en cours',
                        action: () => imprimerCertificatScolarite(inscritEleve),
                      },
                      {
                        label: 'Fiche sanitaire',
                        desc: 'Informations médicales et contacts urgence',
                        action: () => imprimerFicheSanitaire(inscritEleve),
                      },
                      {
                        label: 'Autorisation de sortie',
                        desc: 'Autorisation annuelle pour les sorties scolaires',
                        action: () => imprimerAutorisationSortie(inscritEleve),
                      },
                    ].map(doc => (
                      <button key={doc.label} onClick={doc.action}
                        className="p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-2xl text-left transition-all group">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 rounded-xl flex items-center justify-center shrink-0 transition-all">
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{doc.label}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{doc.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 font-bold text-center">
                    Chaque document s'ouvre dans un nouvel onglet — utilisez "Imprimer → Enregistrer en PDF" pour sauvegarder.
                  </p>
                </div>

                <button
                  onClick={closeCreateModal}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all"
                >
                  Terminer
                </button>
              </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── Modal Vue détail ───────────────────────────────────────────────── */}
      {showModal === 'VIEW' && selectedEleve && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-[3rem] z-10">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Fiche Élève</h3>
              <div className="flex gap-2">
                {canModify && (
                  <button onClick={() => { openEdit(selectedEleve); }}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Edit3 size={14} /> Modifier
                  </button>
                )}
                <button onClick={() => setShowModal(null)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner">
                  {selectedEleve.prenom[0]}{selectedEleve.nom[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedEleve.prenom} {selectedEleve.nom}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{selectedEleve.matricule}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase border border-indigo-100">{niveauLabel(selectedEleve.niveau)}</span>
                    {statutBadge(selectedEleve.statut)}
                    {regimeBadge(selectedEleve.regimeFinancier)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoRow label="Date de naissance" value={selectedEleve.dateNaissance} />
                <InfoRow label="Lieu de naissance" value={selectedEleve.lieuNaissance} />
                <InfoRow label="Date d'admission" value={selectedEleve.dateAdmission} />
                <InfoRow label="Année scolaire" value={selectedEleve.anneeScolaire} />
                <InfoRow label="Cantine" value={selectedEleve.cantine ? 'Oui' : 'Non'} />
                <InfoRow label="Transport bus" value={selectedEleve.transportBus ? 'Oui' : 'Non'} />
                {selectedEleve.remisePct > 0 && <InfoRow label="Remise cas social" value={`${selectedEleve.remisePct}%`} />}
                {selectedEleve.besoinSpecifique && <InfoRow label="Besoins spécifiques" value={selectedEleve.besoinSpecifique} className="col-span-2" />}
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Parent principal</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Nom" value={`${selectedEleve.parent1.prenom} ${selectedEleve.parent1.nom}`} />
                  <InfoRow label="Lien" value={selectedEleve.parent1.lien} />
                  <InfoRow label="Téléphone" value={selectedEleve.parent1.telephone} />
                  <InfoRow label="WhatsApp" value={selectedEleve.parent1.whatsapp} />
                  {selectedEleve.parent1.email && <InfoRow label="Email" value={selectedEleve.parent1.email} />}
                </div>
              </div>

              {/* ── Abonnements & Échéances ── */}
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Repeat size={12} /> Abonnements & Échéances
                  </p>
                  {canModify && (
                    <button
                      onClick={() => { setShowAddAbonnement(v => !v); }}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-1.5"
                    >
                      <Plus size={11} /> Abonner
                    </button>
                  )}
                </div>

                {/* Formulaire ajout abonnement */}
                {showAddAbonnement && (
                  <div className="mb-4 p-4 bg-violet-50 border-2 border-violet-200 rounded-2xl space-y-3 animate-in slide-in-from-top-3 duration-200">
                    <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Nouvel Abonnement</p>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Service récurrent</label>
                      <select
                        value={newAboForm.serviceId}
                        onChange={e => setNewAboForm(f => ({ ...f, serviceId: e.target.value }))}
                        className="w-full bg-white border border-violet-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                      >
                        <option value="">— Choisir un service récurrent —</option>
                        {allServicesRecurrents.map(s => {
                          const per = s.periodicite || 'MENSUEL';
                          const perLabel: Record<string, string> = { HEBDOMADAIRE: 'hebdo', MENSUEL: 'mois', TRIMESTRIEL: 'trim.', SEMESTRIEL: 'sem.', ANNUEL: 'an' };
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} — {Number(s.price).toLocaleString()} {currency}/{perLabel[per] ?? per}
                            </option>
                          );
                        })}
                      </select>
                      {allServicesRecurrents.length === 0 && (
                        <p className="text-[9px] text-violet-500 font-bold">Aucun service récurrent actif. Activez la récurrence dans le module Offres de Scolarité.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date de début</label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={newAboForm.dateDebut}
                          onChange={e => setNewAboForm(f => ({ ...f, dateDebut: e.target.value }))}
                          className="w-full bg-white border border-violet-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddAbonnement(false)}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-slate-50 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAbonnement}
                        disabled={!newAboForm.serviceId || aboActionLoading}
                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {aboActionLoading ? <RefreshCw className="animate-spin" size={13} /> : <><Save size={13} /> Abonner</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des abonnements */}
                {abonnementsLoading ? (
                  <div className="py-6 flex justify-center"><RefreshCw className="animate-spin text-violet-400" size={22} /></div>
                ) : abonnements.length === 0 ? (
                  <div className="py-5 text-center border border-dashed border-slate-200 rounded-2xl">
                    <Repeat size={22} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun abonnement actif</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {abonnements.map((abo: any) => {
                      const echeances: any[] = abo.echeances || [];
                      const enAttente = echeances.filter(e => e.statut === 'EN_ATTENTE').sort(
                        (a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
                      );
                      const enRetard = echeances.filter(e => e.statut === 'EN_RETARD');
                      const payees = echeances.filter(e => e.statut === 'PAYE');
                      const isExpanded = expandedAbos.has(abo.id);
                      const perLabel: Record<string, string> = {
                        HEBDOMADAIRE: 'Hebdomadaire', MENSUEL: 'Mensuel',
                        TRIMESTRIEL: 'Trimestriel', SEMESTRIEL: 'Semestriel', ANNUEL: 'Annuel'
                      };
                      const per = abo.service?.periodicite || abo.periodicite || 'MENSUEL';
                      return (
                        <div key={abo.id} className={`rounded-2xl border overflow-hidden transition-all ${abo.isActive ? 'border-violet-200 bg-violet-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                          {/* En-tête abonnement */}
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                <Repeat size={16} />
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm">{abo.service?.name ?? 'Service'}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-violet-100 text-violet-700 border border-violet-200">
                                    <Repeat size={7} /> {perLabel[per] ?? per}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${abo.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {abo.isActive ? 'Actif' : 'Inactif'}
                                  </span>
                                  {enRetard.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-rose-100 text-rose-700">
                                      <AlertTriangle size={7} /> {enRetard.length} en retard
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold mt-1">
                                  Début : {new Date(abo.dateDebut).toLocaleDateString('fr-FR')}
                                  {abo.dateFin && ` · Fin : ${new Date(abo.dateFin).toLocaleDateString('fr-FR')}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <p className="font-black text-violet-800 text-sm">
                                {Number(abo.service?.price ?? 0).toLocaleString()} {currency}
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setExpandedAbos(prev => {
                                    const next = new Set(prev);
                                    next.has(abo.id) ? next.delete(abo.id) : next.add(abo.id);
                                    return next;
                                  })}
                                  className="px-2.5 py-1.5 bg-white border border-violet-200 text-violet-600 rounded-lg text-[8px] font-black uppercase hover:bg-violet-100 transition-all"
                                >
                                  {isExpanded ? 'Masquer' : `${echeances.length} échéance(s)`}
                                </button>
                                {abo.isActive && canModify && (
                                  <button
                                    onClick={() => handleDesactiverAbonnement(abo.id)}
                                    disabled={aboActionLoading}
                                    className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-500 rounded-lg text-[8px] font-black uppercase hover:bg-rose-50 transition-all disabled:opacity-50"
                                  >
                                    Désactiver
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Échéances expandées */}
                          {isExpanded && echeances.length > 0 && (
                            <div className="border-t border-violet-100 bg-white px-4 py-3 space-y-1.5">
                              {[...enRetard, ...enAttente, ...payees].map((ech: any) => (
                                <div key={ech.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-slate-50 transition-all group">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${ech.statut === 'PAYE' ? 'bg-emerald-500' : ech.statut === 'EN_RETARD' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                    <div>
                                      <p className="text-xs font-black text-slate-800">{ech.periodeLabel || new Date(ech.dateEcheance).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                                      <p className="text-[8px] text-slate-400 font-bold">Échéance le {new Date(ech.dateEcheance).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-black ${ech.statut === 'PAYE' ? 'text-emerald-600' : ech.statut === 'EN_RETARD' ? 'text-rose-600' : 'text-amber-600'}`}>
                                      {Number(ech.montant).toLocaleString()} {currency}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${ech.statut === 'PAYE' ? 'bg-emerald-50 text-emerald-700' : ech.statut === 'EN_RETARD' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {ech.statut === 'PAYE' ? 'Payé' : ech.statut === 'EN_RETARD' ? 'En retard' : 'À payer'}
                                    </span>
                                    {(ech.statut === 'EN_ATTENTE' || ech.statut === 'EN_RETARD') && canModify && (
                                      <button
                                        onClick={() => handlePayEcheance(ech.id)}
                                        disabled={aboActionLoading}
                                        className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[7px] font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-50"
                                      >
                                        Marquer payé
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isExpanded && echeances.length === 0 && (
                            <div className="border-t border-violet-100 bg-white px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase">
                              Aucune échéance générée pour cet abonnement.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Régénérer les documents depuis la fiche */}
              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText size={12} /> Documents
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Fiche inscription',     action: () => imprimerFicheInscription(selectedEleve) },
                    { label: 'Certificat scolarité',  action: () => imprimerCertificatScolarite(selectedEleve) },
                    { label: 'Fiche sanitaire',       action: () => imprimerFicheSanitaire(selectedEleve) },
                    { label: 'Autorisation sortie',   action: () => imprimerAutorisationSortie(selectedEleve) },
                  ].map(d => (
                    <button key={d.label} onClick={d.action}
                      className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                      <FileText size={12} /> {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation suppression ───────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Supprimer l'élève ?</h3>
              <p className="text-slate-500 text-sm font-bold">
                <span className="text-slate-900">{showDeleteConfirm.prenom} {showDeleteConfirm.nom}</span> sera supprimé définitivement.
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={actionLoading}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helper composant ligne info ─────────────────────────────────────────────

function InfoRow({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
    </div>
  );
}

export default Eleves;
