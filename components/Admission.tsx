import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, Search, Filter, RefreshCw, Plus, Eye, CheckCircle2,
  X, AlertCircle, Loader2, ArrowRight, UserCheck, UserX,
  Clock, GraduationCap, Baby, Phone, Mail, Save,
  Info, ChevronLeft, Edit3, MapPin, Heart, Shield,
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { User, Eleve, NiveauScolaire, RegimeFinancier, StatutAdmission } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: string }[] = [
  { value: 'CRECHE', label: 'Crèche (3–12 mois)', cycle: 'Crèche' },
  { value: 'PS',     label: 'Petite Section',      cycle: 'Maternelle' },
  { value: 'MS',     label: 'Moyenne Section',      cycle: 'Maternelle' },
  { value: 'GS',     label: 'Grande Section',       cycle: 'Maternelle' },
  { value: 'CP',     label: 'CP',                   cycle: 'Élémentaire' },
  { value: 'CE1',    label: 'CE1',                  cycle: 'Élémentaire' },
  { value: 'CE2',    label: 'CE2',                  cycle: 'Élémentaire' },
  { value: 'CM1',    label: 'CM1',                  cycle: 'Élémentaire' },
  { value: 'CM2',    label: 'CM2',                  cycle: 'Élémentaire' },
];

const STATUTS_ADMISSION: { value: StatutAdmission; label: string; color: string; icon: any }[] = [
  { value: 'EN_ATTENTE', label: 'Candidature', color: 'bg-amber-50 text-amber-700 border-amber-200',         icon: Clock },
  { value: 'ADMIS',      label: 'Admis',       color: 'bg-blue-50 text-blue-700 border-blue-200',            icon: CheckCircle2 },
  { value: 'INSCRIT',    label: 'Inscrit',     color: 'bg-violet-50 text-violet-700 border-violet-200',      icon: UserCheck },
  { value: 'ACTIF',      label: 'Actif',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200',   icon: UserCheck },
  { value: 'SUSPENDU',   label: 'Suspendu',    color: 'bg-slate-100 text-slate-600 border-slate-200',        icon: UserX },
  { value: 'RADIE',      label: 'Radié',       color: 'bg-rose-50 text-rose-700 border-rose-200',            icon: UserX },
];

const REGIMES: { value: RegimeFinancier; label: string }[] = [
  { value: 'NORMAL',             label: 'Normal' },
  { value: 'CAS_SOCIAL_PARTIEL', label: 'Cas social (partiel)' },
  { value: 'CAS_SOCIAL_TOTAL',   label: 'Cas social (total)' },
];

const ANNEE_COURANTE = '2026-2027';

// Mapping statut scolaire → statut API Customer
const STATUS_API_MAP: Record<StatutAdmission, string> = {
  EN_ATTENTE: 'en_attente',
  ADMIS:      'admis',
  INSCRIT:    'inscrit',
  ACTIF:      'actif',
  SUSPENDU:   'suspendu',
  RADIE:      'radie',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genRef(): string {
  return `ADM-${Date.now().toString(36).toUpperCase()}`;
}

// Résout le statut d'un dossier quelle que soit la source (statut custom, status API, isActive)
function getStatut(d: any): StatutAdmission {
  const s = d.statut || '';
  if (STATUTS_ADMISSION.some(x => x.value === s)) return s as StatutAdmission;
  // Fallback sur le champ status de l'API Customer
  const apiStatus = (d.status || '').toLowerCase();
  if (apiStatus === 'actif')      return 'ACTIF';
  if (apiStatus === 'inscrit')    return 'INSCRIT';
  if (apiStatus === 'admis')      return 'ADMIS';
  if (apiStatus === 'radie')      return 'RADIE';
  if (apiStatus === 'suspendu')   return 'SUSPENDU';
  if (apiStatus === 'en_attente') return 'EN_ATTENTE';
  // Dernier recours : isActive seulement si aucun autre indice
  return 'EN_ATTENTE';
}

function StatutBadge({ statut }: { statut: StatutAdmission }) {
  const s = STATUTS_ADMISSION.find(x => x.value === statut);
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.color}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function niveauLabel(n: NiveauScolaire) {
  return NIVEAUX.find(x => x.value === n)?.label ?? n;
}

function regimeLabel(r: RegimeFinancier) {
  return REGIMES.find(x => x.value === r)?.label ?? r;
}

const emptyDossier = () => ({
  nomEnfant: '',
  prenomEnfant: '',
  dateNaissance: '',
  lieuNaissance: '',
  niveau: 'PS' as NiveauScolaire,
  regimeFinancier: 'NORMAL' as RegimeFinancier,
  remisePct: 0,
  cantine: false,
  transportBus: false,
  besoinSpecifique: '',
  parent1Nom: '',
  parent1Prenom: '',
  parent1Tel: '',
  parent1Whatsapp: '',
  parent1Email: '',
  parent1Lien: 'MERE' as 'PERE' | 'MERE' | 'TUTEUR',
  urgenceNom: '',
  urgenceTel: '',
  urgenceLien: '',
  statut: 'EN_ATTENTE' as StatutAdmission,
  dateDepot: new Date().toISOString().split('T')[0],
  notes: '',
});

type DossierForm = ReturnType<typeof emptyDossier>;

// ─── Sous-composant ligne info ────────────────────────────────────────────────

function DetailRow({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const Admission = ({ currency, user }: { currency: string; user: User }) => {
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [filterNiveau, setFilterNiveau] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<DossierForm>(emptyDossier());
  const [showConfirmStatut, setShowConfirmStatut] = useState<{ dossier: any; newStatut: StatutAdmission } | null>(null);
  const [wizardStep, setWizardStep] = useState(1);

  const showToast = useToast();
  const currentUser = authBridge.getSession()?.user;
  const canModify = currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'customers') : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get('/customers');
      setDossiers(Array.isArray(data) ? data : (data?.rows ?? data?.customers ?? []));
    } catch { setError('Impossible de charger les dossiers.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // ── Filtrage avec statut correctement résolu ───────────────────────────────

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      const nom = (d.companyName || d.name || '').toLowerCase();
      const matchSearch = nom.includes(search.toLowerCase()) ||
        (d.mainContact || '').toLowerCase().includes(search.toLowerCase());
      const statut = getStatut(d);
      const matchStatut = filterStatut === 'ALL' || statut === filterStatut;
      const niveauVal = d.niveau || '';
      const matchNiveau = filterNiveau === 'ALL' || niveauVal === filterNiveau;
      return matchSearch && matchStatut && matchNiveau;
    });
  }, [dossiers, search, filterStatut, filterNiveau]);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    total:    dossiers.length,
    enAttente: dossiers.filter(d => getStatut(d) === 'EN_ATTENTE').length,
    admis:    dossiers.filter(d => getStatut(d) === 'ADMIS').length,
    inscrits: dossiers.filter(d => getStatut(d) === 'INSCRIT').length,
    actifs:   dossiers.filter(d => getStatut(d) === 'ACTIF').length,
    ceJour:   dossiers.filter(d => {
      const created = d.createdAt || d.created_at || '';
      return created && new Date(created).toDateString() === new Date().toDateString();
    }).length,
  }), [dossiers]);

  // ── Construire le payload API depuis le formulaire ─────────────────────────

  const buildPayload = (f: DossierForm, existingEmail?: string) => ({
    companyName: `${f.prenomEnfant} ${f.nomEnfant}`.trim(),
    name: `${f.prenomEnfant} ${f.nomEnfant}`.trim(),
    mainContact: `${f.parent1Prenom} ${f.parent1Nom}`.trim(),
    email: f.parent1Email || existingEmail || `${genRef().toLowerCase()}@letoidesanges.sn`,
    phone: f.parent1Tel,
    billingAddress: f.lieuNaissance,
    // Champs scolaires
    niveau: f.niveau,
    statut: f.statut,
    // Encodage pour l'API Customer standard
    status: STATUS_API_MAP[f.statut] ?? 'en_attente',
    isActive: f.statut !== 'RADIE',
    regimeFinancier: f.regimeFinancier,
    remisePct: f.remisePct,
    cantine: f.cantine,
    transportBus: f.transportBus,
    dateNaissance: f.dateNaissance,
    besoinSpecifique: f.besoinSpecifique,
    parent1Lien: f.parent1Lien,
    parent1Whatsapp: f.parent1Whatsapp || f.parent1Tel,
    urgenceNom: f.urgenceNom,
    urgenceTel: f.urgenceTel,
    urgenceLien: f.urgenceLien,
    dateDepot: f.dateDepot,
    anneeScolaire: ANNEE_COURANTE,
    notes: f.notes,
  });

  // ── Créer un dossier ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canModify) return;
    if (!form.prenomEnfant || !form.nomEnfant) {
      setError('Prénom et nom de l\'enfant sont obligatoires.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post('/customers', buildPayload(form));
      showToast('Dossier d\'admission créé.', 'success');
      setModalMode(null);
      setWizardStep(1);
      fetchData();
    } catch (err: any) { setError(err.message || 'Erreur lors de la création.'); }
    finally { setActionLoading(false); }
  };

  // ── Modifier un dossier ────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!canModify || !selected) return;
    if (!form.prenomEnfant || !form.nomEnfant) {
      setError('Prénom et nom de l\'enfant sont obligatoires.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.put(`/customers/${selected.id}`, buildPayload(form, selected.email));
      showToast('Dossier mis à jour.', 'success');
      setModalMode(null);
      setSelected(null);
      setWizardStep(1);
      fetchData();
    } catch (err: any) { setError(err.message || 'Erreur lors de la modification.'); }
    finally { setActionLoading(false); }
  };

  // ── Changer le statut ──────────────────────────────────────────────────────

  const handleUpdateStatut = async () => {
    if (!showConfirmStatut || !canModify) return;
    setActionLoading(true);
    try {
      const newStatut = showConfirmStatut.newStatut;
      await apiClient.put(`/customers/${showConfirmStatut.dossier.id}`, {
        statut: newStatut,
        status: STATUS_API_MAP[newStatut] ?? 'en_attente',
        isActive: newStatut !== 'RADIE',
      });
      showToast(`Statut mis à jour : ${newStatut}`, 'success');
      setShowConfirmStatut(null);
      setSelected(null);
      setModalMode(null);
      fetchData();
    } catch (err: any) { showToast(err.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  // ── Ouvrir les modals ──────────────────────────────────────────────────────

  const openView = (d: any) => { setSelected(d); setModalMode('VIEW'); };

  const openCreate = () => {
    setForm(emptyDossier());
    setError(null);
    setWizardStep(1);
    setModalMode('CREATE');
  };

  const openEdit = (d: any) => {
    const fullName = (d.companyName || d.name || '').trim();
    const parts = fullName.split(' ');
    const prenomEnfant = parts[0] || '';
    const nomEnfant = parts.slice(1).join(' ') || '';

    const parentFull = (d.mainContact || '').trim();
    const pParts = parentFull.split(' ');
    const parent1Prenom = pParts[0] || '';
    const parent1Nom = pParts.slice(1).join(' ') || '';

    const emailIsGenerated = (d.email || '').includes('@letoidesanges.sn');

    setForm({
      nomEnfant:       nomEnfant || prenomEnfant,
      prenomEnfant:    nomEnfant ? prenomEnfant : '',
      dateNaissance:   d.dateNaissance || '',
      lieuNaissance:   d.billingAddress || '',
      niveau:          (d.niveau as NiveauScolaire) || 'PS',
      regimeFinancier: (d.regimeFinancier as RegimeFinancier) || 'NORMAL',
      remisePct:       d.remisePct || 0,
      cantine:         !!d.cantine,
      transportBus:    !!(d.transportBus || d.transport_bus),
      besoinSpecifique: d.besoinSpecifique || '',
      parent1Nom,
      parent1Prenom,
      parent1Tel:      d.phone || '',
      parent1Whatsapp: d.parent1Whatsapp || d.phone || '',
      parent1Email:    emailIsGenerated ? '' : (d.email || ''),
      parent1Lien:     (d.parent1Lien || 'MERE') as 'PERE' | 'MERE' | 'TUTEUR',
      urgenceNom:      d.urgenceNom || '',
      urgenceTel:      d.urgenceTel || '',
      urgenceLien:     d.urgenceLien || '',
      statut:          getStatut(d),
      dateDepot:       d.dateDepot || (d.createdAt || d.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes:           d.notes || '',
    });
    setSelected(d);
    setError(null);
    setWizardStep(1);
    setModalMode('EDIT');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <ClipboardList className="text-indigo-600" size={32} /> Admissions & Dossiers
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Gestion des dossiers candidats — Année {ANNEE_COURANTE}
          </p>
        </div>
        {canModify && (
          <button onClick={openCreate}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
            <Plus size={18} /> NOUVEAU DOSSIER
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total dossiers',  value: kpis.total,     color: 'bg-slate-900 text-white',          icon: ClipboardList },
          { label: 'Candidatures',    value: kpis.enAttente, color: 'bg-amber-50 text-amber-700',       icon: Clock },
          { label: 'Admis',           value: kpis.admis,     color: 'bg-blue-50 text-blue-700',         icon: CheckCircle2 },
          { label: 'Inscrits',        value: kpis.inscrits,  color: 'bg-violet-50 text-violet-700',     icon: UserCheck },
          { label: 'Actifs',          value: kpis.actifs,    color: 'bg-emerald-50 text-emerald-700',   icon: UserCheck },
          { label: 'Nouveaux (jour)', value: kpis.ceJour,    color: 'bg-indigo-50 text-indigo-700',     icon: Plus },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`${k.color} p-5 rounded-3xl shadow-sm flex flex-col gap-2`}>
              <Icon size={20} className="opacity-60" />
              <p className="text-3xl font-black">{k.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Barre de recherche ── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher un enfant ou un parent..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showFilters ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          <Filter size={16} /> Filtres
        </button>
        <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Onglets de statut ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatut('ALL')}
          className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
            filterStatut === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          }`}>
          Tous <span className="ml-1 opacity-60">({dossiers.length})</span>
        </button>
        {STATUTS_ADMISSION.map(s => {
          const count = dossiers.filter(d => getStatut(d) === s.value).length;
          const active = filterStatut === s.value;
          return (
            <button key={s.value}
              onClick={() => setFilterStatut(active ? 'ALL' : s.value)}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                active ? `${s.color} border-current` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}>
              {s.label} <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Niveau scolaire</label>
            <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="ALL">Tous les niveaux</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterStatut('ALL'); setFilterNiveau('ALL'); setSearch(''); }}
              className="w-full py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">
              RÉINITIALISER
            </button>
          </div>
        </div>
      )}

      {error && !modalMode && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Table des dossiers ── */}
      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
              <th className="px-6 py-4">Enfant</th>
              <th className="px-6 py-4">Niveau</th>
              <th className="px-6 py-4">Parent / Contact</th>
              <th className="px-6 py-4 text-center">Statut</th>
              <th className="px-6 py-4 text-center">Options</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="h-16"><td colSpan={6} className="px-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center">
                <ClipboardList size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucun dossier trouvé</p>
              </td></tr>
            ) : filtered.map(d => {
              const nomEnfant = d.companyName || d.name || '—';
              const contact = d.mainContact || '—';
              const niveau = d.niveau as NiveauScolaire | undefined;
              const statut = getStatut(d);
              const avecCantine = !!d.cantine;
              const avecBus = !!(d.transportBus || d.transport_bus);
              const peutEditer = statut !== 'INSCRIT' && statut !== 'ACTIF' && statut !== 'RADIE';
              return (
                <tr key={d.id} className="group hover:bg-slate-50/60 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                        {nomEnfant.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm uppercase">{nomEnfant}</p>
                        {d.dateNaissance && (
                          <p className="text-[9px] text-slate-400 font-bold">
                            Né(e) le {new Date(d.dateNaissance).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {niveau
                      ? <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase">{niveauLabel(niveau)}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700 text-xs">{contact}</p>
                    {d.phone && <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><Phone size={9}/> {d.phone}</p>}
                  </td>
                  <td className="px-6 py-4 text-center"><StatutBadge statut={statut} /></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {avecCantine && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[8px] font-black border border-emerald-200">Cantine</span>}
                      {avecBus && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[8px] font-black border border-amber-200">Bus</span>}
                      {!avecCantine && !avecBus && <span className="text-slate-300 text-[9px]">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(d)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Voir le dossier">
                        <Eye size={16} />
                      </button>
                      {canModify && peutEditer && (
                        <button onClick={() => openEdit(d)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier le dossier">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ MODAL CRÉER / MODIFIER — WIZARD 4 ÉTAPES ══════════════════════════ */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-500">

            {/* En-tête */}
            <div className="px-8 pt-8 pb-0 bg-slate-900 text-white shrink-0">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                  <ClipboardList size={20}/>
                  {modalMode === 'CREATE' ? 'Nouveau Dossier d\'Admission' : 'Modifier le Dossier'}
                </h3>
                <button onClick={() => { setModalMode(null); setWizardStep(1); }}
                  className="p-2 hover:bg-white/10 rounded-2xl transition-all"><X size={20} /></button>
              </div>

              {/* Indicateur d'étapes */}
              <div className="flex items-center gap-0 pb-0">
                {[
                  { n: 1, label: 'Identité',   icon: Baby },
                  { n: 2, label: 'Scolarité',  icon: GraduationCap },
                  { n: 3, label: 'Parent',     icon: Phone },
                  { n: 4, label: 'Validation', icon: CheckCircle2 },
                ].map((s, i) => {
                  const Icon = s.icon;
                  const done = wizardStep > s.n;
                  const active = wizardStep === s.n;
                  return (
                    <React.Fragment key={s.n}>
                      <div className={`flex flex-col items-center gap-1 px-3 pb-3 border-b-2 transition-all flex-1 ${active ? 'border-indigo-400' : done ? 'border-emerald-400' : 'border-transparent'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${active ? 'bg-indigo-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                          {done ? <CheckCircle2 size={14}/> : <Icon size={14}/>}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-500'}`}>{s.label}</span>
                      </div>
                      {i < 3 && <div className={`w-4 h-0.5 mb-4 shrink-0 transition-all ${wizardStep > s.n ? 'bg-emerald-400' : 'bg-white/10'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Contenu de l'étape */}
            <div className="flex-1 overflow-y-auto p-8">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                  <AlertCircle size={14}/> {error}
                </div>
              )}

              {/* ── Étape 1 : Identité ── */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Baby size={13} className="text-indigo-500"/> Identité de l'enfant
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.prenomEnfant} onChange={e => setForm({...form, prenomEnfant: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.nomEnfant} onChange={e => setForm({...form, nomEnfant: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom de famille" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Date de naissance</label>
                      <input type="date" value={form.dateNaissance} onChange={e => setForm({...form, dateNaissance: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lieu de naissance</label>
                      <input type="text" value={form.lieuNaissance} onChange={e => setForm({...form, lieuNaissance: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Dakar" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Date de dépôt du dossier</label>
                      <input type="date" value={form.dateDepot} onChange={e => setForm({...form, dateDepot: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Statut initial</label>
                      <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value as StatutAdmission})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                        {STATUTS_ADMISSION.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 2 : Scolarité & Options ── */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap size={13} className="text-indigo-500"/> Scolarité &amp; options
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Niveau demandé <span className="text-rose-500">*</span></label>
                      <select value={form.niveau} onChange={e => setForm({...form, niveau: e.target.value as NiveauScolaire})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                        {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label} — {n.cycle}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Régime financier</label>
                      <select value={form.regimeFinancier} onChange={e => {
                        const regime = e.target.value as RegimeFinancier;
                        setForm({ ...form, regimeFinancier: regime, remisePct: regime === 'CAS_SOCIAL_TOTAL' ? 100 : regime === 'NORMAL' ? 0 : form.remisePct });
                      }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                        {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    {form.regimeFinancier === 'CAS_SOCIAL_TOTAL' && (
                      <div className="col-span-2 flex items-center gap-3 px-5 py-3 bg-violet-50 border border-violet-200 rounded-2xl">
                        <Heart size={16} className="text-violet-600 shrink-0" />
                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest flex-1">Exonération totale — 100 % de remise appliquée automatiquement</span>
                        <span className="px-3 py-1 bg-violet-600 text-white rounded-xl text-xs font-black">100 %</span>
                      </div>
                    )}
                    {form.regimeFinancier === 'CAS_SOCIAL_PARTIEL' && (
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Remise cas social (%)</label>
                        <input type="number" min={1} max={99} value={form.remisePct}
                          onChange={e => setForm({...form, remisePct: Number(e.target.value)})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1">
                      <input type="checkbox" checked={form.cantine} onChange={e => setForm({...form, cantine: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Cantine</span>
                    </label>
                    <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-400 transition-all flex-1">
                      <input type="checkbox" checked={form.transportBus} onChange={e => setForm({...form, transportBus: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Bus scolaire</span>
                    </label>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Besoins spécifiques</label>
                    <input type="text" value={form.besoinSpecifique} onChange={e => setForm({...form, besoinSpecifique: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                      placeholder="Allergie, retard de développement, handisport…" />
                  </div>
                </div>
              )}

              {/* ── Étape 3 : Parent / Tuteur ── */}
              {wizardStep === 3 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Phone size={13} className="text-indigo-500"/> Parent / Tuteur légal principal
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Prénom</label>
                        <input type="text" value={form.parent1Prenom} onChange={e => setForm({...form, parent1Prenom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Prénom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom</label>
                        <input type="text" value={form.parent1Nom} onChange={e => setForm({...form, parent1Nom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <select value={form.parent1Lien} onChange={e => setForm({...form, parent1Lien: e.target.value as any})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none">
                          <option value="MERE">Mère</option>
                          <option value="PERE">Père</option>
                          <option value="TUTEUR">Tuteur légal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone <span className="text-rose-500">*</span></label>
                        <input type="tel" value={form.parent1Tel}
                          onChange={e => setForm({...form, parent1Tel: e.target.value, parent1Whatsapp: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">WhatsApp</label>
                        <input type="tel" value={form.parent1Whatsapp} onChange={e => setForm({...form, parent1Whatsapp: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Email</label>
                        <input type="email" value={form.parent1Email} onChange={e => setForm({...form, parent1Email: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="email@exemple.sn" />
                      </div>
                    </div>
                  </div>

                  {/* Contact urgence */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Shield size={13} className="text-rose-500"/> Contact d'urgence
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Nom complet</label>
                        <input type="text" value={form.urgenceNom} onChange={e => setForm({...form, urgenceNom: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Nom complet" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Téléphone</label>
                        <input type="tel" value={form.urgenceTel} onChange={e => setForm({...form, urgenceTel: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="+221 77 xxx xxxx" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1 block">Lien avec l'enfant</label>
                        <input type="text" value={form.urgenceLien} onChange={e => setForm({...form, urgenceLien: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Ex: Grand-mère, Oncle…" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Étape 4 : Validation & Notes ── */}
              {wizardStep === 4 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-500"/> Récapitulatif &amp; notes
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Enfant</span>
                      <span className="font-black text-slate-900">{form.prenomEnfant} {form.nomEnfant}</span>
                    </div>
                    {form.dateNaissance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Date de naissance</span>
                        <span className="font-bold text-slate-700">{new Date(form.dateNaissance).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    {form.lieuNaissance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Lieu de naissance</span>
                        <span className="font-bold text-slate-700">{form.lieuNaissance}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Niveau</span>
                      <span className="font-bold text-indigo-700">{niveauLabel(form.niveau)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Régime</span>
                      <span className="font-bold">{regimeLabel(form.regimeFinancier)}{form.remisePct > 0 ? ` — ${form.remisePct}%` : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      {form.cantine && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black border border-emerald-200">Cantine</span>}
                      {form.transportBus && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-xl text-[9px] font-black border border-amber-200">Bus</span>}
                    </div>
                    {form.besoinSpecifique && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Besoins spécifiques</span>
                        <span className="font-bold text-blue-700 text-right max-w-[60%]">{form.besoinSpecifique}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-100 pt-3 flex justify-between">
                      <span className="text-slate-400 font-bold">Parent</span>
                      <span className="font-black text-slate-900">
                        {form.parent1Prenom} {form.parent1Nom}
                        {' '}({form.parent1Lien === 'MERE' ? 'Mère' : form.parent1Lien === 'PERE' ? 'Père' : 'Tuteur'})
                      </span>
                    </div>
                    {form.parent1Tel && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Téléphone</span>
                        <span className="font-bold text-slate-700">{form.parent1Tel}</span>
                      </div>
                    )}
                    {form.urgenceNom && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Urgence</span>
                        <span className="font-bold text-slate-700">{form.urgenceNom} — {form.urgenceTel}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Statut</span>
                      <StatutBadge statut={form.statut} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Notes internes</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[80px]"
                      placeholder="Remarques, documents reçus, observations particulières…" />
                  </div>
                </div>
              )}
            </div>

            {/* Navigation entre étapes */}
            <div className="px-8 py-6 border-t border-slate-100 flex gap-3 shrink-0">
              {wizardStep > 1 && (
                <button type="button" onClick={() => setWizardStep(s => s - 1)}
                  className="px-6 py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                  <ChevronLeft size={16}/> Retour
                </button>
              )}
              {wizardStep < 4 ? (
                <button type="button" onClick={() => {
                  setError(null);
                  if (wizardStep === 1 && (!form.prenomEnfant || !form.nomEnfant)) {
                    setError('Prénom et nom de l\'enfant sont obligatoires.');
                    return;
                  }
                  if (wizardStep === 3 && !form.parent1Tel) {
                    setError('Le téléphone du parent est obligatoire.');
                    return;
                  }
                  setWizardStep(s => s + 1);
                }}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl">
                  Suivant <ArrowRight size={16}/>
                </button>
              ) : (
                <button type="button"
                  onClick={modalMode === 'EDIT' ? handleUpdate : handleCreate}
                  disabled={actionLoading || !form.prenomEnfant || !form.nomEnfant}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  {actionLoading
                    ? <Loader2 className="animate-spin" size={16}/>
                    : <><Save size={15}/> {modalMode === 'EDIT' ? 'ENREGISTRER LES MODIFICATIONS' : 'CRÉER LE DOSSIER'}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL VUE DÉTAILLÉE DU DOSSIER ════════════════════════════════════ */}
      {modalMode === 'VIEW' && selected && (() => {
        const statut = getStatut(selected);
        const peutEditer = statut !== 'ACTIF' && statut !== 'RADIE';
        const nomEnfant = selected.companyName || selected.name || '—';
        const niveau = selected.niveau as NiveauScolaire | undefined;
        const parentFull = selected.mainContact || '';
        return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">

              {/* En-tête */}
              <div className="px-10 py-8 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-start shrink-0">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Dossier d'Admission</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight truncate">{nomEnfant}</h3>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <StatutBadge statut={statut} />
                    {niveau && (
                      <span className="px-3 py-1 bg-white/10 text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20">
                        {niveauLabel(niveau)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canModify && peutEditer && (
                    <button onClick={() => { setModalMode(null); openEdit(selected); }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
                      <Edit3 size={14}/> Modifier
                    </button>
                  )}
                  <button onClick={() => setModalMode(null)}
                    className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all"><X size={22} /></button>
                </div>
              </div>

              {/* Corps du dossier */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">

                {/* ── Identité de l'enfant ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Baby size={12} className="text-indigo-500"/> Identité de l'enfant
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Nom & Prénom" value={nomEnfant} />
                    <DetailRow
                      label="Date de naissance"
                      value={selected.dateNaissance ? new Date(selected.dateNaissance).toLocaleDateString('fr-FR') : null}
                    />
                    <DetailRow label="Lieu de naissance" value={selected.billingAddress || selected.lieuNaissance} />
                    <DetailRow label="Date de dépôt"
                      value={selected.dateDepot ? new Date(selected.dateDepot).toLocaleDateString('fr-FR')
                        : selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('fr-FR') : null} />
                    <DetailRow label="Année scolaire" value={selected.anneeScolaire || ANNEE_COURANTE} />
                  </div>
                </section>

                {/* ── Informations scolaires ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <GraduationCap size={12} className="text-indigo-500"/> Scolarité & options
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Niveau demandé" value={niveau ? niveauLabel(niveau) : null} />
                    <DetailRow label="Régime financier" value={selected.regimeFinancier ? regimeLabel(selected.regimeFinancier as RegimeFinancier) : null} />
                    {selected.remisePct > 0 && <DetailRow label="Remise cas social" value={`${selected.remisePct}%`} />}
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Options</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.cantine && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black border border-emerald-200">Cantine</span>
                        )}
                        {(selected.transportBus || selected.transport_bus) && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-black border border-amber-200">Bus scolaire</span>
                        )}
                        {!selected.cantine && !selected.transportBus && !selected.transport_bus && (
                          <span className="text-slate-400 text-[9px] font-bold">Aucune option</span>
                        )}
                      </div>
                    </div>
                    {selected.besoinSpecifique && (
                      <div className="col-span-2 space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Besoins spécifiques</p>
                        <p className="font-bold text-blue-700 text-sm">{selected.besoinSpecifique}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Parent / Tuteur ── */}
                <section>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Phone size={12} className="text-indigo-500"/> Parent / Tuteur légal
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow label="Nom & Prénom" value={parentFull || null} />
                    <DetailRow label="Lien"
                      value={selected.parent1Lien === 'MERE' ? 'Mère' : selected.parent1Lien === 'PERE' ? 'Père' : selected.parent1Lien === 'TUTEUR' ? 'Tuteur légal' : null} />
                    <DetailRow label="Téléphone" value={selected.phone} />
                    <DetailRow label="WhatsApp" value={selected.parent1Whatsapp || selected.phone} />
                    <DetailRow label="Email"
                      value={selected.email && !selected.email.includes('@letoidesanges.sn') ? selected.email : null} />
                  </div>
                </section>

                {/* ── Contact urgence ── */}
                {(selected.urgenceNom || selected.urgenceTel) && (
                  <section>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Shield size={12} className="text-rose-500"/> Contact d'urgence
                    </h4>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <DetailRow label="Nom complet" value={selected.urgenceNom} />
                      <DetailRow label="Téléphone" value={selected.urgenceTel} />
                      <DetailRow label="Lien" value={selected.urgenceLien} />
                    </div>
                  </section>
                )}

                {/* ── Notes internes ── */}
                {selected.notes && (
                  <section>
                    <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl">
                      <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Info size={13}/> Notes internes
                      </h4>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">{selected.notes}</p>
                    </div>
                  </section>
                )}

                {/* ── Changement de statut ── */}
                {canModify && (
                  <section>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Changer le statut</h4>
                    <div className="flex flex-wrap gap-2">
                      {STATUTS_ADMISSION.filter(s => s.value !== statut).map(s => (
                        <button key={s.value}
                          onClick={() => setShowConfirmStatut({ dossier: selected, newStatut: s.value })}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 ${s.color}`}>
                          → {s.label}
                        </button>
                      ))}
                    </div>
                    {(statut === 'INSCRIT' || statut === 'ACTIF') && (
                      <p className="mt-2 text-[10px] text-violet-600 font-bold flex items-center gap-2">
                        <CheckCircle2 size={12}/> Ce dossier est inscrit — les modifications ne sont plus disponibles.
                      </p>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ CONFIRM CHANGEMENT STATUT ══════════════════════════════════════════ */}
      {showConfirmStatut && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40}/>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer le changement</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed mb-3">
              Passer le dossier de{' '}
              <span className="font-black text-slate-700">{showConfirmStatut.dossier.companyName || showConfirmStatut.dossier.name}</span>{' '}
              au statut <span className="font-black text-indigo-600">{STATUTS_ADMISSION.find(s => s.value === showConfirmStatut.newStatut)?.label}</span> ?
            </p>
            {showConfirmStatut.newStatut === 'ADMIS' && (
              <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 text-[10px] font-black uppercase">
                L'école notifie l'acceptation de la candidature.
              </div>
            )}
            {showConfirmStatut.newStatut === 'INSCRIT' && (
              <div className="mb-5 p-3 bg-violet-50 border border-violet-100 rounded-2xl text-violet-700 text-[10px] font-black uppercase">
                La famille a fourni les documents et réglé les frais de scolarité. Le dossier ne sera plus modifiable.
              </div>
            )}
            {showConfirmStatut.newStatut === 'ACTIF' && (
              <div className="mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-[10px] font-black uppercase">
                L'élève est actif et en cours de scolarité.
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button onClick={handleUpdateStatut} disabled={actionLoading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl">
                {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} CONFIRMER
              </button>
              <button onClick={() => setShowConfirmStatut(null)}
                className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admission;
