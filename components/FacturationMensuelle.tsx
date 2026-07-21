import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Download, RefreshCw, Search, CheckSquare, Square,
  Loader2, Users, BookOpen, ChevronDown, ChevronRight, AlertCircle,
  Archive, X, Heart, BadgePercent, CalendarDays, Info, CircleCheck, Zap,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { useAnnee } from '../contexts/AnneeContext';
import {
  StudentInvoiceData,
  generateInvoicePdfBlob,
  buildZipBlob,
  downloadBlob,
} from '../services/invoicePdf';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Classe { id: string; nom: string; niveau: string; nbEleves: number; capaciteMax: number; }
interface EleveItem {
  id: string; nom: string; prenom: string; matricule?: string;
  niveau: string; classeId?: string; statut?: string; parent1?: any;
  regimeFinancier?: string; remisePct?: number;
}

const STATUTS_FACTURABLE = new Set(['INSCRIT', 'ACTIF']);

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

// ─── Helpers régime financier ───────────────────────────────────────────────
// isExonere : l'élève ne paie rien (CAS_SOCIAL_TOTAL)
// isRemise  : l'élève bénéficie d'une réduction (CAS_SOCIAL_PARTIEL ou valeur legacy)
const isExonere   = (r?: string) => r === 'CAS_SOCIAL_TOTAL';
const isRemise    = (r?: string) => !!r && r !== 'NORMAL' && !isExonere(r);
const isCasSocial = (r?: string) => isExonere(r) || isRemise(r);

// ─── Badge régime financier ─────────────────────────────────────────────────

function RegimeBadge({ regime, remise }: { regime?: string; remise?: number }) {
  if (isExonere(regime)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
        <Heart size={8} fill="currentColor" /> Exonéré
      </span>
    );
  }
  if (isRemise(regime)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
        <BadgePercent size={9} /> {remise && remise > 0 ? `-${remise}%` : 'Remise'}
      </span>
    );
  }
  return null;
}

// ─── Sélecteur de mois académique ──────────────────────────────────────────
// Affiche les 12 mois de l'année scolaire (Sep N → Août N+1) regroupés par année civile.

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function AcademicMonthPicker({
  anneeScolaire,
  selectedYear, selectedMonth,
  onSelect,
}: {
  anneeScolaire: string;
  selectedYear: number | null;
  selectedMonth: number | null;
  onSelect: (year: number, month: number) => void;
}) {
  const [y1, y2] = useMemo(() => {
    const parts = anneeScolaire.split('-').map(Number);
    const a = parts[0] || new Date().getFullYear();
    return [a, a + 1];
  }, [anneeScolaire]);

  // Semestre 1 : Sep–Déc année N, Semestre 2 : Jan–Aoû année N+1
  const s1 = [9, 10, 11, 12].map(m => ({ month: m, year: y1 }));
  const s2 = [1, 2, 3, 4, 5, 6, 7, 8].map(m => ({ month: m, year: y2 }));

  const btn = (month: number, year: number) => {
    const active = selectedMonth === month && selectedYear === year;
    return (
      <button
        key={`${year}-${month}`}
        onClick={() => onSelect(year, month)}
        className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-slate-50 border border-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
        }`}
      >
        {MOIS_COURTS[month - 1]}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Semestre 1 */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{y1}</span>
        <div className="flex gap-1">
          {s1.map(({ month, year }) => btn(month, year))}
        </div>
      </div>
      <div className="h-8 w-px bg-slate-200 shrink-0"/>
      {/* Semestre 2 */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{y2}</span>
        <div className="flex flex-wrap gap-1">
          {s2.map(({ month, year }) => btn(month, year))}
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────

const FacturationMensuelle = ({
  currency = 'F CFA',
  tenantSettings,
}: {
  currency?: string;
  tenantSettings?: any;
}) => {
  const showToast = useToast();
  const { annee: anneeScolaire, isReadOnly } = useAnnee();

  const [classes,  setClasses]  = useState<Classe[]>([]);
  const [eleves,   setEleves]   = useState<EleveItem[]>([]);
  const [settings, setSettings] = useState<any>(tenantSettings || null);
  const [loading,  setLoading]  = useState(true);

  // Initialiser sur le mois courant s'il est dans l'année académique
  const [selectedYear, setSelectedYear] = useState<number | null>(() => {
    const [y1s] = anneeScolaire?.split('-') ?? [];
    const y1 = parseInt(y1s, 10) || new Date().getFullYear();
    const y2 = y1 + 1;
    const nm = new Date().getMonth() + 1;
    const ny = new Date().getFullYear();
    if (nm >= 9 && ny === y1) return y1;
    if (nm <= 8 && ny === y2) return y2;
    return null;
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    const [y1s] = anneeScolaire?.split('-') ?? [];
    const y1 = parseInt(y1s, 10) || new Date().getFullYear();
    const y2 = y1 + 1;
    const nm = new Date().getMonth() + 1;
    const ny = new Date().getFullYear();
    if ((nm >= 9 && ny === y1) || (nm <= 8 && ny === y2)) return nm;
    return null;
  });

  const [search,       setSearch]       = useState('');
  const [filterClasse, setFilterClasse] = useState<string>('ALL');
  const [filterRegime, setFilterRegime] = useState<string>('ALL');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [generating,    setGenerating]    = useState(false);
  // phase 'data' = appels API en cours ; phase 'pdf' = rendu PDF en cours ; phase 'email' = envoi emails
  const [progress,      setProgress]      = useState<{ done: number; total: number; phase: 'data' | 'pdf' | 'email' } | null>(null);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  // Fichier prêt à télécharger (blob + nom). L'utilisateur clique lui-même → contourne le popup-blocker.
  const [readyDownload, setReadyDownload] = useState<{ blob: Blob; filename: string } | null>(null);
  const [syncingAbos,   setSyncingAbos]   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, elv, stt] = await Promise.all([
        // Pas de filtre anneeScolaire sur les classes : on veut les métadonnées (nom, niveau)
        // quel que soit l'année de création, pour toujours trouver la classe d'un élève.
        apiClient.get('/classes'),
        apiClient.get('/eleves',  { params: { anneeScolaire } }),
        settings ? Promise.resolve(settings) : apiClient.get('/settings').catch(() => ({})),
      ]);
      const rawClasses: Classe[] = Array.isArray(cls) ? cls : [];
      setClasses(rawClasses);
      const rawEleves: EleveItem[] = Array.isArray(elv) ? elv : [];
      const eligible = rawEleves.filter(e => STATUTS_FACTURABLE.has(e.statut || '') && !!e.classeId);
      setEleves(eligible);
      setExpandedKeys(new Set(eligible.map(e => e.classeId!)));
      if (!settings) setSettings(stt || {});
    } catch {
      showToast('Erreur chargement des données.', 'error');
    } finally {
      setLoading(false);
    }
  }, [anneeScolaire]); // eslint-disable-line

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Synchronisation en masse des abonnements pour les élèves existants ─────
  const handleSyncAbonnements = useCallback(async () => {
    setSyncingAbos(true);
    try {
      const result: any = await apiClient.post(
        `/eleves/sync-abonnements${anneeScolaire ? `?anneeScolaire=${anneeScolaire}` : ''}`,
        {},
      );
      showToast(
        result?.message || 'Abonnements synchronisés avec succès.',
        'success',
      );
      await fetchAll();
    } catch {
      showToast('Erreur lors de la synchronisation des abonnements.', 'error');
    } finally {
      setSyncingAbos(false);
    }
  }, [anneeScolaire, fetchAll]); // eslint-disable-line

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const classeById = useMemo(() => {
    const m: Record<string, Classe> = {};
    classes.forEach(c => { m[c.id] = c; });
    return m;
  }, [classes]);

  // Compteurs utilisant les helpers cohérents (capturent aussi les valeurs legacy)
  const stats = useMemo(() => ({
    total:     eleves.length,
    exoneres:  eleves.filter(e => isExonere(e.regimeFinancier)).length,
    partiels:  eleves.filter(e => isRemise(e.regimeFinancier)).length,
  }), [eleves]);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return eleves.filter(e => {
      if (filterClasse !== 'ALL' && e.classeId !== filterClasse) return false;
      if (filterRegime === 'CAS_SOCIAL'       && !isCasSocial(e.regimeFinancier)) return false;
      if (filterRegime === 'EXONERE'          && !isExonere(e.regimeFinancier))   return false;
      if (filterRegime === 'REMISE_PARTIELLE' && !isRemise(e.regimeFinancier))    return false;
      if (filterRegime === 'NORMAL'           && isCasSocial(e.regimeFinancier))  return false;
      if (q && !`${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [eleves, filterClasse, filterRegime, search]);

  const groups = useMemo(() => {
    const map: Record<string, { classe: Classe | null; eleves: EleveItem[] }> = {};
    filteredEleves.forEach(e => {
      const key = e.classeId!;
      if (!map[key]) map[key] = { classe: classeById[key] || null, eleves: [] };
      map[key].eleves.push(e);
    });
    return Object.entries(map).sort(([, a], [, b]) =>
      (a.classe?.nom || '').localeCompare(b.classe?.nom || '')
    );
  }, [filteredEleves, classeById]);

  // ── Sélection ─────────────────────────────────────────────────────────────
  const toggleOne   = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleGroup = (ids: string[]) => setSelectedIds(prev => { const s = new Set(prev); ids.every(id => s.has(id)) ? ids.forEach(id => s.delete(id)) : ids.forEach(id => s.add(id)); return s; });
  const toggleAll   = () => selectedIds.size === filteredEleves.length && filteredEleves.length > 0 ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredEleves.map(e => e.id)));

  const allSelected  = filteredEleves.length > 0 && selectedIds.size === filteredEleves.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // ── Libellé période ───────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (!selectedMonth || !selectedYear) return 'Toute période';
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    const l = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return l.charAt(0).toUpperCase() + l.slice(1);
  }, [selectedYear, selectedMonth]);

  // ── Génération PDF ─────────────────────────────────────────────────────────
  // Phase 1 : appels API pour récupérer les échéances (progress.phase = 'data')
  // Phase 2 : rendu HTML→PDF pour chaque élève    (progress.phase = 'pdf')
  // Le blob final est stocké dans readyDownload → l'utilisateur télécharge en cliquant,
  // ce qui contourne les blocages popup des navigateurs (Firefox, Safari, Chrome strict).
  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    if (!selectedMonth || !selectedYear) { showToast('Veuillez sélectionner un mois.', 'error'); return; }

    setGenerating(true);
    setErrorMsg(null);
    setReadyDownload(null);
    const ids = Array.from(selectedIds);

    try {
      // ── Phase 1 : collecte des données ──────────────────────────────────
      setProgress({ done: 0, total: ids.length, phase: 'data' });
      const items: { filename: string; data: StudentInvoiceData }[] = [];

      for (let i = 0; i < ids.length; i++) {
        const eleve = eleves.find(e => e.id === ids[i]);
        if (!eleve) continue;
        let factureData: any = { eleve, echeances: [], totalDu: 0, totalPaye: 0, solde: 0 };
        try {
          factureData = await apiClient.get(`/abonnements/echeances/facture/${ids[i]}`, { params: { month: selectedMonth, year: selectedYear } });
        } catch { /* pas d'abonnement pour cet élève */ }
        items.push({
          filename: `facture_${eleve.prenom}_${eleve.nom}_${periodLabel.replace(/\s+/g, '_')}.pdf`,
          data: {
            eleve: { nom: eleve.nom, prenom: eleve.prenom, matricule: eleve.matricule, niveau: NIVEAUX_LABELS[eleve.niveau] || eleve.niveau, classeNom: classeById[eleve.classeId!]?.nom, regimeFinancier: eleve.regimeFinancier, remisePct: eleve.remisePct },
            parent1: factureData.eleve?.parent1 || eleve.parent1,
            tenant: { name: settings?.name || settings?.companyName, address: settings?.address, phone: settings?.phone, email: settings?.email, logoUrl: settings?.logoUrl },
            period: periodLabel, currency,
            echeances: factureData.echeances || [],
            totalDu: factureData.totalDu ?? 0, totalPaye: factureData.totalPaye ?? 0, solde: factureData.solde ?? 0,
          },
        });
        setProgress({ done: i + 1, total: ids.length, phase: 'data' });
      }

      // ── Phase 2 : rendu PDF ─────────────────────────────────────────────
      setProgress({ done: 0, total: items.length, phase: 'pdf' });

      if (items.length === 1) {
        const blob = await generateInvoicePdfBlob(items[0].data);
        setProgress({ done: 1, total: 1, phase: 'pdf' });
        setReadyDownload({ blob, filename: items[0].filename });
      } else {
        const zipName = `factures_${periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.zip`;
        const blob = await buildZipBlob(items, (done, total) =>
          setProgress({ done, total, phase: 'pdf' })
        );
        setReadyDownload({ blob, filename: zipName });
      }

      // ── Phase 3 : envoi par email aux parents ───────────────────────────
      setProgress({ done: 0, total: ids.length, phase: 'email' });
      try {
        const emailResult = await apiClient.post('/abonnements/echeances/envoyer-facture-email', {
          eleveIds: ids,
          month: selectedMonth,
          year: selectedYear,
        });
        setProgress({ done: ids.length, total: ids.length, phase: 'email' });
        const sent = emailResult?.sent || 0;
        const skippedNoEmail = emailResult?.skippedNoEmail || 0;
        const skippedNoData = emailResult?.skippedNoData || 0;
        if (sent > 0) {
          const extras = [];
          if (skippedNoEmail) extras.push(`${skippedNoEmail} sans email`);
          if (skippedNoData) extras.push(`${skippedNoData} sans échéances`);
          showToast(`Facture envoyée par email à ${sent} parent${sent > 1 ? 's' : ''}${extras.length ? ` (${extras.join(', ')})` : ''}`, 'success');
        } else if (skippedNoEmail || skippedNoData) {
          const reasons = [];
          if (skippedNoEmail) reasons.push(`${skippedNoEmail} sans adresse email`);
          if (skippedNoData) reasons.push(`${skippedNoData} sans échéances pour ce mois`);
          showToast(`Aucun email envoyé : ${reasons.join(', ')}`, 'warning');
        }
      } catch (emailErr: any) {
        console.warn('[FacturationMensuelle] Erreur envoi email:', emailErr.message);
        showToast('Factures générées mais erreur lors de l\'envoi par email', 'warning');
      }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la génération des factures.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 size={28} className="animate-spin text-indigo-400" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chargement des élèves…</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-8 space-y-6">

      {/* ══ HERO HEADER ══════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #818cf8 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a78bfa 0%, transparent 40%)' }}/>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <FileText size={20} className="text-indigo-300"/>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">Facturation Mensuelle</h1>
              <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest">Année scolaire {anneeScolaire}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 text-center min-w-[80px]">
              <p className="text-2xl font-black">{stats.total}</p>
              <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest">Élèves</p>
            </div>
            {stats.exoneres > 0 && (
              <div className="bg-rose-500/20 border border-rose-500/30 rounded-2xl px-5 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-black text-rose-300">{stats.exoneres}</p>
                <p className="text-[9px] text-rose-300 font-black uppercase tracking-widest">Exonérés</p>
              </div>
            )}
            {stats.partiels > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl px-5 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-black text-amber-300">{stats.partiels}</p>
                <p className="text-[9px] text-amber-300 font-black uppercase tracking-widest">Remise partielle</p>
              </div>
            )}
            <button
              onClick={handleSyncAbonnements}
              disabled={syncingAbos || isReadOnly}
              title="Créer les abonnements manquants pour tous les élèves inscrits"
              className="bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 disabled:opacity-40 rounded-2xl px-4 py-3 transition-all self-stretch flex items-center gap-2"
            >
              {syncingAbos
                ? <Loader2 size={14} className="text-teal-300 animate-spin"/>
                : <Zap size={14} className="text-teal-300"/>}
              <span className="text-[9px] font-black text-teal-300 uppercase tracking-widest hidden sm:block">
                {syncingAbos ? 'Synchro…' : 'Sync abonnements'}
              </span>
            </button>
            <button onClick={fetchAll} className="bg-white/10 hover:bg-white/20 rounded-2xl px-3 py-3 transition-all self-stretch flex items-center justify-center">
              <RefreshCw size={16} className="text-indigo-300"/>
            </button>
          </div>
        </div>

        {/* Guide 3 étapes */}
        <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: '1', label: 'Choisir le mois', desc: 'Sélectionnez un mois de l\'année scolaire ci-dessous', done: !!(selectedMonth && selectedYear) },
            { n: '2', label: 'Sélectionner les élèves', desc: 'Cochez un ou plusieurs élèves (ou toute une classe)', done: selectedIds.size > 0 },
            { n: '3', label: 'Générer les factures', desc: 'Téléchargez en PDF individuel ou en ZIP groupé', done: false },
          ].map(step => (
            <div key={step.n} className={`flex items-start gap-3 p-4 rounded-2xl border ${step.done ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${step.done ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-indigo-300'}`}>
                {step.done ? <CircleCheck size={14}/> : step.n}
              </div>
              <div>
                <p className={`text-[11px] font-black uppercase tracking-wide ${step.done ? 'text-emerald-300' : 'text-white'}`}>{step.label}</p>
                <p className="text-[10px] text-indigo-400/80 font-bold leading-snug mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 text-amber-700 text-xs font-bold">
          <Archive size={16}/> Année {anneeScolaire} — consultation uniquement, génération désactivée
        </div>
      )}

      {/* ══ LÉGENDE CAS SOCIAUX ══════════════════════════════════════════════ */}
      {(stats.exoneres > 0 || stats.partiels > 0) && (
        <div className="bg-white rounded-[2rem] border border-slate-100 px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Info size={14} className="text-slate-400"/>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Régimes spéciaux</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stats.exoneres > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl">
                <Heart size={11} className="text-rose-600" fill="currentColor"/>
                <span className="text-[10px] font-black text-rose-700">Exonéré total ({stats.exoneres})</span>
                <span className="text-[9px] text-rose-500 font-bold">— Aucun montant dû</span>
              </div>
            )}
            {stats.partiels > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                <BadgePercent size={11} className="text-amber-600"/>
                <span className="text-[10px] font-black text-amber-700">Remise partielle ({stats.partiels})</span>
                <span className="text-[9px] text-amber-500 font-bold">— Tarif réduit selon %</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ BARRE DE CONTRÔLES ═══════════════════════════════════════════════ */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-5">

        {/* Sélecteur de mois académique */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-indigo-500"/>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Étape 1 — Mois de l'année scolaire {anneeScolaire}
            </p>
            {selectedMonth && selectedYear && (
              <span className="ml-auto px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-xl">
                {periodLabel}
              </span>
            )}
          </div>
          <AcademicMonthPicker
            anneeScolaire={anneeScolaire}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onSelect={(y, m) => {
              setSelectedYear(prev => prev === y && selectedMonth === m ? null : y);
              setSelectedMonth(prev => prev === m && selectedYear === y ? null : m);
            }}
          />
        </div>

        <div className="h-px bg-slate-100"/>

        {/* Filtres + recherche */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, prénom, matricule…"
              className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"/>
          </div>

          <select value={filterClasse} onChange={e => { setFilterClasse(e.target.value); setSelectedIds(new Set()); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 min-w-[140px]">
            <option value="ALL">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          <select value={filterRegime} onChange={e => { setFilterRegime(e.target.value); setSelectedIds(new Set()); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 min-w-[180px]">
            <option value="ALL">Tous les régimes</option>
            <option value="NORMAL">Tarif normal uniquement</option>
            <option value="CAS_SOCIAL">Cas sociaux uniquement</option>
            <option value="EXONERE">Exonérés complets</option>
            <option value="REMISE_PARTIELLE">Remises partielles</option>
          </select>
        </div>
      </div>

      {/* ══ BARRE DE SÉLECTION + ACTION ══════════════════════════════════════ */}
      <div className={`bg-white rounded-[2rem] border shadow-sm px-5 py-3 flex items-center gap-3 transition-all ${selectedIds.size > 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-indigo-600 transition-all shrink-0">
          {allSelected ? <CheckSquare size={16} className="text-indigo-600"/> : someSelected ? <CheckSquare size={16} className="text-indigo-400"/> : <Square size={16}/>}
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>

        {selectedIds.size > 0 ? (
          <span className="bg-indigo-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full">
            {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-bold">
            {filteredEleves.length} élève{filteredEleves.length > 1 ? 's' : ''} affiché{filteredEleves.length > 1 ? 's' : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {progress && (
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
              <Loader2 size={13} className="animate-spin"/>
              {progress.phase === 'data'
                ? `Données ${progress.done}/${progress.total}…`
                : progress.phase === 'pdf'
                ? `PDFs ${progress.done}/${progress.total}…`
                : `Envoi emails ${progress.done}/${progress.total}…`}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={selectedIds.size === 0 || generating || !selectedMonth || isReadOnly || !!readyDownload}
            className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm
              ${selectedIds.size > 0 && selectedMonth && !isReadOnly
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            {generating
              ? <><Loader2 size={13} className="animate-spin"/> Génération…</>
              : selectedIds.size > 1
              ? <><Archive size={13}/> Générer ZIP ({selectedIds.size})</>
              : <><Download size={13}/> Générer PDF</>}
          </button>
        </div>
      </div>

      {/* ══ ERREUR ═══════════════════════════════════════════════════════════ */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 flex items-center gap-3 text-rose-700 text-xs font-bold">
          <AlertCircle size={15}/> {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* ══ MODAL TÉLÉCHARGEMENT — centré, z-index élevé, loin du bouton IA ══ */}
      {readyDownload && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setReadyDownload(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center">
              <CircleCheck size={40} className="text-emerald-500"/>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-900">
                {readyDownload.filename.endsWith('.zip') ? 'ZIP prêt !' : 'PDF prêt !'}
              </p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                {readyDownload.filename.endsWith('.zip')
                  ? `${selectedIds.size} factures compressées dans un fichier ZIP`
                  : 'Votre facture a été générée avec succès'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-2 break-all">{readyDownload.filename}</p>
            </div>
            <button
              onClick={() => {
                downloadBlob(readyDownload.blob, readyDownload.filename);
                showToast('Téléchargement lancé.', 'success');
                setReadyDownload(null);
                setSelectedIds(new Set());
              }}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
            >
              <Download size={18}/>
              {readyDownload.filename.endsWith('.zip') ? 'Télécharger le ZIP' : 'Télécharger le PDF'}
            </button>
            <button
              onClick={() => setReadyDownload(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ══ LISTE ÉLÈVES ═════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 py-20 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
              <Users size={28} className="text-slate-200"/>
            </div>
            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Aucun élève éligible</p>
            <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">
              Seuls les élèves <strong>INSCRITS</strong> ou <strong>ACTIFS</strong>, affectés à une classe, apparaissent ici.
            </p>
          </div>
        ) : groups.map(([key, group]) => {
          const classe = group.classe;
          const groupIds = group.eleves.map(e => e.id);
          const allGroupSel  = groupIds.every(id => selectedIds.has(id));
          const someGroupSel = groupIds.some(id => selectedIds.has(id)) && !allGroupSel;
          const isExpanded   = expandedKeys.has(key);
          const exoCount     = group.eleves.filter(e => isExonere(e.regimeFinancier)).length;
          const remiseCount  = group.eleves.filter(e => isRemise(e.regimeFinancier)).length;

          return (
            <div key={key} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">

              {/* En-tête groupe */}
              <div
                className={`flex items-center gap-3 px-5 py-4 cursor-pointer select-none transition-all ${allGroupSel ? 'bg-indigo-50' : 'hover:bg-slate-50/80'}`}
                onClick={() => setExpandedKeys(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; })}
              >
                <button onClick={e => { e.stopPropagation(); toggleGroup(groupIds); }} className="shrink-0 text-slate-400 hover:text-indigo-600 transition-all">
                  {allGroupSel ? <CheckSquare size={16} className="text-indigo-600"/> : someGroupSel ? <CheckSquare size={16} className="text-indigo-400"/> : <Square size={16}/>}
                </button>

                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen size={15} className="text-indigo-600"/>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-slate-900">
                      {classe?.nom || NIVEAUX_LABELS[group.eleves[0]?.niveau] || group.eleves[0]?.niveau || '—'}
                    </span>
                    {(classe?.niveau || group.eleves[0]?.niveau) && (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-lg">
                        {NIVEAUX_LABELS[classe?.niveau || group.eleves[0]?.niveau] || classe?.niveau || group.eleves[0]?.niveau}
                      </span>
                    )}
                    {exoCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                        <Heart size={8} fill="currentColor"/> {exoCount} exonéré{exoCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {remiseCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                        <BadgePercent size={9}/> {remiseCount} remise{remiseCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                    {group.eleves.length} élève{group.eleves.length > 1 ? 's' : ''}
                    {someGroupSel && (
                      <span className="text-indigo-600"> · {groupIds.filter(id => selectedIds.has(id)).length} sélectionné{groupIds.filter(id => selectedIds.has(id)).length > 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isReadOnly && (
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedIds(prev => { const s = new Set(prev); groupIds.forEach(id => s.add(id)); return s; }); }}
                      className="px-3 py-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all uppercase tracking-widest"
                    >
                      Tout sélect.
                    </button>
                  )}
                  <div className="text-slate-300">
                    {isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                  </div>
                </div>
              </div>

              {/* Lignes élèves */}
              {isExpanded && (
                <div className="border-t border-slate-50">
                  {group.eleves.map(e => {
                    const checked    = selectedIds.has(e.id);
                    const exonere    = isExonere(e.regimeFinancier);
                    const remise     = isRemise(e.regimeFinancier);
                    return (
                      <div
                        key={e.id}
                        onClick={() => toggleOne(e.id)}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all border-b border-slate-50 last:border-0
                          ${checked ? 'bg-indigo-50' : exonere ? 'hover:bg-rose-50/30' : remise ? 'hover:bg-amber-50/30' : 'hover:bg-slate-50/60'}`}
                      >
                        <div className="shrink-0">
                          {checked ? <CheckSquare size={14} className="text-indigo-600"/> : <Square size={14} className="text-slate-200"/>}
                        </div>

                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0
                          ${exonere ? 'bg-rose-100 text-rose-600' : remise ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {(e.prenom?.[0] || '?').toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-800">{e.prenom} {e.nom}</span>
                            <RegimeBadge regime={e.regimeFinancier} remise={e.remisePct}/>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {e.matricule && <span className="text-[9px] font-bold text-slate-400">{e.matricule}</span>}
                            {e.parent1?.whatsapp && <span className="text-[9px] font-bold text-slate-400">{e.parent1.whatsapp}</span>}
                          </div>
                        </div>

                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 hidden sm:block">
                          {NIVEAUX_LABELS[e.niveau] || e.niveau}
                        </span>

                        {exonere ? (
                          <span className="text-[9px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg shrink-0">0 {currency}</span>
                        ) : remise && e.remisePct ? (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg shrink-0">-{e.remisePct}%</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══ FAB FLOTTANT — bas-centre pour ne pas conflicler avec le bouton IA ══ */}
      {selectedIds.size > 0 && !isReadOnly && !readyDownload && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
          {!selectedMonth && !generating && (
            <div className="bg-amber-500 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 pointer-events-auto">
              <AlertCircle size={13}/> Choisissez d'abord un mois
            </div>
          )}
          {generating && progress && (
            <div className="bg-slate-800 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 pointer-events-auto">
              <Loader2 size={12} className="animate-spin"/>
              {progress.phase === 'data'
                ? `Collecte données ${progress.done}/${progress.total}…`
                : progress.phase === 'pdf'
                ? `Génération PDFs ${progress.done}/${progress.total}…`
                : `Envoi emails ${progress.done}/${progress.total}…`}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedMonth}
            className="pointer-events-auto flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-900/40 transition-all"
          >
            {generating
              ? <><Loader2 size={16} className="animate-spin"/> En cours…</>
              : selectedIds.size > 1
              ? <><Archive size={16}/> Générer {selectedIds.size} factures (ZIP)</>
              : <><Download size={16}/> Générer la facture PDF</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default FacturationMensuelle;
