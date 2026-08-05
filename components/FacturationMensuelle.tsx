import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Download, RefreshCw, Search, CheckSquare, Square,
  Loader2, Users, BookOpen, ChevronDown, ChevronRight, AlertCircle,
  Archive, X, Heart, BadgePercent, CalendarDays, Info, CircleCheck, Zap,
  Wallet, Clock, CheckCircle2, TrendingUp,
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

interface EcheanceItem {
  id: string;
  eleveId: string;
  montant: number;
  statut: string;
  dateEcheance: string;
  periodeLabel?: string;
  amountPaid?: number;
  amountRemaining?: number;
  service?: { id: string; name: string; typeOffre?: string };
  eleve?: {
    id: string; nom: string; prenom: string; matricule?: string;
    niveau: string; parent1?: any; whatsappPrincipal?: string; anneeScolaire?: string;
  };
}

interface EleveGroupe {
  eleveId: string;
  nom: string; prenom: string; matricule?: string;
  niveau: string; classeId?: string; parent1?: any; whatsapp?: string;
  regimeFinancier?: string; remisePct?: number;
  echeances: EcheanceItem[];
  totalDu: number;
  totalPaye: number;
  solde: number;
}

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const STATUT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  PAYE:       { label: 'Payé',       bg: 'bg-emerald-50', text: 'text-emerald-700' },
  SOLDEE:     { label: 'Soldé',      bg: 'bg-emerald-50', text: 'text-emerald-700' },
  EN_ATTENTE: { label: 'En attente', bg: 'bg-amber-50',   text: 'text-amber-700' },
  EN_RETARD:  { label: 'En retard',  bg: 'bg-rose-50',    text: 'text-rose-700' },
  ANNULE:     { label: 'Annulé',     bg: 'bg-slate-50',   text: 'text-slate-500' },
};

const CANCELLED = new Set(['ANNULE', 'ANNULEE']);
const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');

const isExonere   = (r?: string) => r === 'CAS_SOCIAL_TOTAL';
const isRemise    = (r?: string) => !!r && r !== 'NORMAL' && !isExonere(r);

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

  const s1 = [8, 9, 10, 11, 12].map(m => ({ month: m, year: y1 }));
  const s2 = [1, 2, 3, 4, 5, 6, 7].map(m => ({ month: m, year: y2 }));

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
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{y1}</span>
        <div className="flex gap-1">
          {s1.map(({ month, year }) => btn(month, year))}
        </div>
      </div>
      <div className="h-8 w-px bg-slate-200 shrink-0"/>
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

  const [classes,    setClasses]    = useState<Classe[]>([]);
  const [echeances,  setEcheances]  = useState<EcheanceItem[]>([]);
  const [settings,   setSettings]   = useState<any>(tenantSettings || null);
  const [loading,    setLoading]    = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number | null>(() => {
    const [y1s] = anneeScolaire?.split('-') ?? [];
    const y1 = parseInt(y1s, 10) || now.getFullYear();
    const y2 = y1 + 1;
    const nm = now.getMonth() + 1;
    const ny = now.getFullYear();
    if (nm >= 8 && ny === y1) return y1;
    if (nm <= 7 && ny === y2) return y2;
    return null;
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    const [y1s] = anneeScolaire?.split('-') ?? [];
    const y1 = parseInt(y1s, 10) || now.getFullYear();
    const y2 = y1 + 1;
    const nm = now.getMonth() + 1;
    const ny = now.getFullYear();
    if ((nm >= 8 && ny === y1) || (nm <= 7 && ny === y2)) return nm;
    return null;
  });

  const [search,       setSearch]       = useState('');
  const [filterClasse, setFilterClasse] = useState<string>('ALL');
  const [filterStatut, setFilterStatut] = useState<string>('ALL');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [generating,    setGenerating]    = useState(false);
  const [progress,      setProgress]      = useState<{ done: number; total: number; phase: 'data' | 'pdf' | 'email' } | null>(null);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [readyDownload, setReadyDownload] = useState<{ blob: Blob; filename: string } | null>(null);
  const [syncingAbos,   setSyncingAbos]   = useState(false);

  // ── Fetch initial (classes + settings) ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [cls, stt] = await Promise.all([
          apiClient.get('/classes'),
          settings ? Promise.resolve(settings) : apiClient.get('/settings').catch(() => ({})),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        if (!settings) setSettings(stt || {});
      } catch { /* ignore */ }
      setLoadingInit(false);
    })();
  }, []); // eslint-disable-line

  // ── Fetch échéances quand le mois change ───────────────────────────────────
  const fetchEcheances = useCallback(async () => {
    if (!selectedMonth || !selectedYear) { setEcheances([]); return; }
    setLoading(true);
    try {
      const data = await apiClient.get('/abonnements/echeances', {
        params: { month: selectedMonth, year: selectedYear, anneeScolaire },
      });
      setEcheances(Array.isArray(data) ? data : []);
    } catch {
      showToast('Erreur chargement des échéances.', 'error');
      setEcheances([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, anneeScolaire]); // eslint-disable-line

  useEffect(() => { fetchEcheances(); }, [fetchEcheances]);

  // ── Sync abonnements ───────────────────────────────────────────────────────
  const handleSyncAbonnements = useCallback(async () => {
    setSyncingAbos(true);
    try {
      const result: any = await apiClient.post(
        `/eleves/sync-abonnements${anneeScolaire ? `?anneeScolaire=${anneeScolaire}` : ''}`,
        {},
      );
      showToast(result?.message || 'Abonnements synchronisés.', 'success');
      await fetchEcheances();
    } catch {
      showToast('Erreur lors de la synchronisation.', 'error');
    } finally {
      setSyncingAbos(false);
    }
  }, [anneeScolaire, fetchEcheances]); // eslint-disable-line

  // ── Sync échéances du mois ─────────────────────────────────────────────────
  const handleSyncMensuel = useCallback(async () => {
    if (!selectedMonth) return;
    setSyncingAbos(true);
    try {
      await apiClient.post('/abonnements/sync-mensuel', {
        month: selectedMonth,
        anneeScolaire,
      });
      showToast('Échéances du mois synchronisées.', 'success');
      await fetchEcheances();
    } catch {
      showToast('Erreur synchronisation mensuelle.', 'error');
    } finally {
      setSyncingAbos(false);
    }
  }, [selectedMonth, anneeScolaire, fetchEcheances]); // eslint-disable-line

  // ── Grouper par élève ──────────────────────────────────────────────────────
  const classeById = useMemo(() => {
    const m: Record<string, Classe> = {};
    classes.forEach(c => { m[c.id] = c; });
    return m;
  }, [classes]);

  const elevesGroupes = useMemo((): EleveGroupe[] => {
    const map = new Map<string, EleveGroupe>();
    for (const ech of echeances) {
      if (!ech.eleve || CANCELLED.has(ech.statut)) continue;
      const key = ech.eleveId;
      if (!map.has(key)) {
        const e = ech.eleve;
        map.set(key, {
          eleveId: key,
          nom: e.nom, prenom: e.prenom, matricule: e.matricule,
          niveau: e.niveau, classeId: undefined,
          parent1: e.parent1, whatsapp: e.whatsappPrincipal,
          regimeFinancier: undefined, remisePct: undefined,
          echeances: [],
          totalDu: 0, totalPaye: 0, solde: 0,
        });
      }
      const g = map.get(key)!;
      g.echeances.push(ech);
      const montant = parseFloat(ech.montant as any) || 0;
      const paid = parseFloat(ech.amountPaid as any) || (ech.statut === 'PAYE' || ech.statut === 'SOLDEE' ? montant : 0);
      g.totalDu += montant;
      g.totalPaye += paid;
    }
    for (const g of map.values()) {
      g.solde = g.totalDu - g.totalPaye;
    }
    return Array.from(map.values());
  }, [echeances]);

  useEffect(() => {
    const niveaux = new Set(elevesGroupes.map(g => g.niveau || 'AUTRE'));
    setExpandedKeys(niveaux);
  }, [elevesGroupes]);

  // ── Filtrage ───────────────────────────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return elevesGroupes.filter(g => {
      if (q && !`${g.nom} ${g.prenom} ${g.matricule || ''}`.toLowerCase().includes(q)) return false;
      if (filterStatut === 'IMPAYE' && g.solde <= 0) return false;
      if (filterStatut === 'PAYE' && g.solde > 0) return false;
      return true;
    });
  }, [elevesGroupes, search, filterStatut]);

  // Grouper par classe (niveau)
  const groups = useMemo(() => {
    const map: Record<string, { niveau: string; eleves: EleveGroupe[] }> = {};
    filteredEleves.forEach(g => {
      const key = g.niveau || 'AUTRE';
      if (!map[key]) map[key] = { niveau: key, eleves: [] };
      map[key].eleves.push(g);
    });
    const order = ['CRECHE', 'PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
    return Object.entries(map).sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [filteredEleves]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalDu    = elevesGroupes.reduce((s, g) => s + g.totalDu, 0);
    const totalPaye  = elevesGroupes.reduce((s, g) => s + g.totalPaye, 0);
    const solde      = totalDu - totalPaye;
    const taux       = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
    const nbEleves   = elevesGroupes.length;
    const nbSoldes   = elevesGroupes.filter(g => g.solde <= 0).length;
    const nbImpayes  = elevesGroupes.filter(g => g.solde > 0).length;
    return { totalDu, totalPaye, solde, taux, nbEleves, nbSoldes, nbImpayes };
  }, [elevesGroupes]);

  // ── Sélection ─────────────────────────────────────────────────────────────
  const toggleOne   = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleGroup = (ids: string[]) => setSelectedIds(prev => { const s = new Set(prev); ids.every(id => s.has(id)) ? ids.forEach(id => s.delete(id)) : ids.forEach(id => s.add(id)); return s; });
  const toggleAll   = () => selectedIds.size === filteredEleves.length && filteredEleves.length > 0
    ? setSelectedIds(new Set())
    : setSelectedIds(new Set(filteredEleves.map(e => e.eleveId)));

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
  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    if (!selectedMonth || !selectedYear) { showToast('Veuillez sélectionner un mois.', 'error'); return; }

    setGenerating(true);
    setErrorMsg(null);
    setReadyDownload(null);
    const ids = Array.from(selectedIds);

    try {
      setProgress({ done: 0, total: ids.length, phase: 'data' });
      const items: { filename: string; data: StudentInvoiceData }[] = [];

      for (let i = 0; i < ids.length; i++) {
        const groupe = elevesGroupes.find(g => g.eleveId === ids[i]);
        if (!groupe) continue;

        let factureData: any = null;
        try {
          factureData = await apiClient.get(`/abonnements/echeances/facture/${ids[i]}`, { params: { month: selectedMonth, year: selectedYear } });
        } catch { /* ignore */ }

        const eleveData = factureData?.eleve || groupe;
        items.push({
          filename: `facture_${groupe.prenom}_${groupe.nom}_${periodLabel.replace(/\s+/g, '_')}.pdf`,
          data: {
            eleve: {
              nom: groupe.nom, prenom: groupe.prenom, matricule: groupe.matricule,
              niveau: NIVEAUX_LABELS[groupe.niveau] || groupe.niveau,
              classeNom: undefined,
              regimeFinancier: groupe.regimeFinancier, remisePct: groupe.remisePct,
            },
            parent1: eleveData.parent1 || groupe.parent1,
            tenant: {
              name: settings?.name || settings?.companyName,
              address: settings?.address, phone: settings?.phone,
              email: settings?.email, logoUrl: settings?.logoUrl,
            },
            period: periodLabel, currency,
            echeances: factureData?.echeances || groupe.echeances.map(e => ({
              service: e.service, periodeLabel: e.periodeLabel,
              montant: e.montant, statut: e.statut, dateEcheance: e.dateEcheance,
            })),
            totalDu: factureData?.totalDu ?? groupe.totalDu,
            totalPaye: factureData?.totalPaye ?? groupe.totalPaye,
            solde: factureData?.solde ?? groupe.solde,
          },
        });
        setProgress({ done: i + 1, total: ids.length, phase: 'data' });
      }

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

      setProgress({ done: 0, total: ids.length, phase: 'email' });
      try {
        const emailResult = await apiClient.post('/abonnements/echeances/envoyer-facture-email', {
          eleveIds: ids, month: selectedMonth, year: selectedYear,
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
      } catch {
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
  if (loadingInit) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 size={28} className="animate-spin text-indigo-400" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chargement…</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg">
              <FileText size={20} className="text-white" />
            </div>
            Facturation Mensuelle
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Année scolaire <span className="font-black text-indigo-600">{anneeScolaire}</span>
            {selectedMonth && selectedYear && <> &middot; <span className="font-black text-slate-700">{periodLabel}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncMensuel}
            disabled={syncingAbos || !selectedMonth || isReadOnly}
            title="Générer les échéances manquantes pour le mois sélectionné"
            className="flex items-center gap-1.5 text-[10px] font-black text-teal-600 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 disabled:opacity-40 transition-all shadow-sm"
          >
            {syncingAbos ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12}/>}
            Sync mois
          </button>
          <button
            onClick={handleSyncAbonnements}
            disabled={syncingAbos || isReadOnly}
            title="Créer les abonnements manquants pour tous les élèves"
            className="flex items-center gap-1.5 text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-100 disabled:opacity-40 transition-all shadow-sm"
          >
            <Zap size={12}/> Sync abos
          </button>
          <button
            onClick={fetchEcheances}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 text-amber-700 text-xs font-bold">
          <Archive size={16}/> Année {anneeScolaire} — consultation uniquement
        </div>
      )}

      {/* ══ SÉLECTEUR DE MOIS ════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-indigo-500"/>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Sélectionnez le mois à facturer
          </p>
        </div>
        <AcademicMonthPicker
          anneeScolaire={anneeScolaire}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onSelect={(y, m) => {
            setSelectedYear(y);
            setSelectedMonth(m);
            setSelectedIds(new Set());
          }}
        />
      </div>

      {/* ══ KPIs FINANCE ═════════════════════════════════════════════════════ */}
      {selectedMonth && !loading && elevesGroupes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2">
              <TrendingUp size={18} className="text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{fmt(kpis.totalDu)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total facturé</p>
            <p className="text-[9px] text-slate-400 font-semibold">{currency} &middot; {kpis.nbEleves} élève(s)</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
              <Wallet size={18} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600">{fmt(kpis.totalPaye)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Encaissé</p>
            <p className="text-[9px] text-slate-400 font-semibold">{kpis.taux}% &middot; {kpis.nbSoldes} soldé(s)</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
              <Clock size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700">{fmt(kpis.solde)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Reste à encaisser</p>
            <p className="text-[9px] text-slate-400 font-semibold">{currency} &middot; {kpis.nbImpayes} en attente</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${kpis.taux >= 80 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <CheckCircle2 size={18} className={kpis.taux >= 80 ? 'text-emerald-600' : 'text-rose-600'} />
            </div>
            <p className={`text-2xl font-black ${kpis.taux >= 80 ? 'text-emerald-600' : kpis.taux >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{kpis.taux}%</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Taux encaissement</p>
            <p className="text-[9px] text-slate-400 font-semibold">{periodLabel}</p>
          </div>
        </div>
      )}

      {/* ══ FILTRES + ACTIONS ════════════════════════════════════════════════ */}
      {selectedMonth && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, prénom, matricule…"
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"/>
            </div>
            <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setSelectedIds(new Set()); }}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 min-w-[160px]">
              <option value="ALL">Tous les statuts</option>
              <option value="IMPAYE">Impayés seulement</option>
              <option value="PAYE">Soldés seulement</option>
            </select>

            <div className="flex items-center gap-2 ml-auto">
              <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-indigo-600 transition-all shrink-0">
                {allSelected ? <CheckSquare size={16} className="text-indigo-600"/> : someSelected ? <CheckSquare size={16} className="text-indigo-400"/> : <Square size={16}/>}
                {allSelected ? 'Désélect.' : 'Tout'}
              </button>
              {selectedIds.size > 0 && (
                <span className="bg-indigo-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full">
                  {selectedIds.size}
                </span>
              )}
              <button
                onClick={handleGenerate}
                disabled={selectedIds.size === 0 || generating || !selectedMonth || isReadOnly || !!readyDownload}
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm
                  ${selectedIds.size > 0 && !isReadOnly
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                {generating
                  ? <><Loader2 size={13} className="animate-spin"/> Génération…</>
                  : selectedIds.size > 1
                  ? <><Archive size={13}/> ZIP ({selectedIds.size})</>
                  : <><Download size={13}/> PDF</>}
              </button>
            </div>
          </div>
          {progress && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-600">
              <Loader2 size={13} className="animate-spin"/>
              {progress.phase === 'data' ? `Données ${progress.done}/${progress.total}…`
                : progress.phase === 'pdf' ? `PDFs ${progress.done}/${progress.total}…`
                : `Emails ${progress.done}/${progress.total}…`}
            </div>
          )}
        </div>
      )}

      {/* ══ ERREUR ═══════════════════════════════════════════════════════════ */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 flex items-center gap-3 text-rose-700 text-xs font-bold">
          <AlertCircle size={15}/> {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* ══ MODAL TÉLÉCHARGEMENT ═════════════════════════════════════════════ */}
      {readyDownload && (
        <div
          className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setReadyDownload(null)}
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center">
              <CircleCheck size={40} className="text-emerald-500"/>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-900">
                {readyDownload.filename.endsWith('.zip') ? 'ZIP prêt !' : 'PDF prêt !'}
              </p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                {readyDownload.filename.endsWith('.zip')
                  ? `${selectedIds.size} factures compressées`
                  : 'Votre facture a été générée'}
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
              <Download size={18}/> Télécharger
            </button>
            <button onClick={() => setReadyDownload(null)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ══ ÉTAT : pas de mois sélectionné ═══════════════════════════════════ */}
      {!selectedMonth && (
        <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center space-y-3">
          <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto">
            <CalendarDays size={28} className="text-indigo-300"/>
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sélectionnez un mois</p>
          <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">
            Choisissez un mois ci-dessus pour voir les élèves ayant des échéances à facturer.
          </p>
        </div>
      )}

      {/* ══ CHARGEMENT ═══════════════════════════════════════════════════════ */}
      {selectedMonth && loading && (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chargement des échéances…</p>
        </div>
      )}

      {/* ══ AUCUNE ÉCHÉANCE ══════════════════════════════════════════════════ */}
      {selectedMonth && !loading && elevesGroupes.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
            <Users size={28} className="text-slate-200"/>
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucune échéance ce mois</p>
          <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">
            Aucun élève n'a d'échéance pour {periodLabel}. Cliquez sur <strong>Sync mois</strong> pour générer les échéances depuis les abonnements actifs.
          </p>
        </div>
      )}

      {/* ══ LISTE ÉLÈVES PAR NIVEAU ══════════════════════════════════════════ */}
      {selectedMonth && !loading && filteredEleves.length > 0 && (
        <div className="space-y-3">
          {groups.map(([niv, group]) => {
            const groupIds = group.eleves.map(g => g.eleveId);
            const allGroupSel  = groupIds.every(id => selectedIds.has(id));
            const someGroupSel = groupIds.some(id => selectedIds.has(id)) && !allGroupSel;
            const isExpanded   = expandedKeys.has(niv);
            const groupTotal   = group.eleves.reduce((s, g) => s + g.totalDu, 0);
            const groupPaye    = group.eleves.reduce((s, g) => s + g.totalPaye, 0);
            const groupSolde   = groupTotal - groupPaye;

            return (
              <div key={niv} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* En-tête groupe */}
                <div
                  className={`flex items-center gap-3 px-5 py-4 cursor-pointer select-none transition-all ${allGroupSel ? 'bg-indigo-50' : 'hover:bg-slate-50/80'}`}
                  onClick={() => setExpandedKeys(prev => { const s = new Set(prev); s.has(niv) ? s.delete(niv) : s.add(niv); return s; })}
                >
                  <button onClick={e => { e.stopPropagation(); toggleGroup(groupIds); }} className="shrink-0 text-slate-400 hover:text-indigo-600 transition-all">
                    {allGroupSel ? <CheckSquare size={16} className="text-indigo-600"/> : someGroupSel ? <CheckSquare size={16} className="text-indigo-400"/> : <Square size={16}/>}
                  </button>
                  <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={15} className="text-indigo-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900">{NIVEAUX_LABELS[niv] || niv}</span>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{group.eleves.length} élève(s)</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[9px] font-bold">
                      <span className="text-slate-500">Dû: {fmt(groupTotal)} {currency}</span>
                      <span className="text-emerald-600">Payé: {fmt(groupPaye)}</span>
                      {groupSolde > 0 && <span className="text-amber-600">Reste: {fmt(groupSolde)}</span>}
                    </div>
                  </div>
                  <div className="text-slate-300 shrink-0">
                    {isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                  </div>
                </div>

                {/* Lignes élèves */}
                {isExpanded && (
                  <div className="border-t border-slate-50">
                    {group.eleves.map(g => {
                      const checked = selectedIds.has(g.eleveId);
                      const isPaid  = g.solde <= 0;
                      return (
                        <div key={g.eleveId} className="border-b border-slate-50 last:border-0">
                          <div
                            onClick={() => toggleOne(g.eleveId)}
                            className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all
                              ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50/60'}`}
                          >
                            <div className="shrink-0">
                              {checked ? <CheckSquare size={14} className="text-indigo-600"/> : <Square size={14} className="text-slate-200"/>}
                            </div>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              {(g.prenom?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-slate-800">{g.prenom} {g.nom}</span>
                                <RegimeBadge regime={g.regimeFinancier} remise={g.remisePct}/>
                                {isPaid && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 size={8}/> Soldé
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {g.matricule && <span className="text-[9px] font-bold text-slate-400">{g.matricule}</span>}
                                <span className="text-[9px] font-bold text-slate-400">{g.echeances.length} échéance(s)</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-black ${isPaid ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(g.totalDu)} <span className="text-[8px] text-slate-400">{currency}</span></p>
                              {g.totalPaye > 0 && !isPaid && (
                                <p className="text-[9px] font-bold text-emerald-500">-{fmt(g.totalPaye)} payé</p>
                              )}
                              {g.solde > 0 && (
                                <p className="text-[9px] font-black text-amber-600">{fmt(g.solde)} restant</p>
                              )}
                            </div>
                          </div>

                          {/* Détail des échéances */}
                          {checked && (
                            <div className="px-5 pb-3 ml-12 space-y-1">
                              {g.echeances.map((ech, i) => {
                                const st = STATUT_STYLES[ech.statut] || STATUT_STYLES.EN_ATTENTE;
                                return (
                                  <div key={ech.id || i} className="flex items-center gap-3 py-1.5 px-3 bg-slate-50/50 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-600 flex-1 min-w-0 truncate">
                                      {ech.service?.name || ech.periodeLabel || 'Service'}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-700 shrink-0">{fmt(parseFloat(ech.montant as any))}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black ${st.bg} ${st.text} shrink-0`}>
                                      {st.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ FAB FLOTTANT ═════════════════════════════════════════════════════ */}
      {selectedIds.size > 0 && !isReadOnly && !readyDownload && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
          {generating && progress && (
            <div className="bg-slate-800 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 pointer-events-auto">
              <Loader2 size={12} className="animate-spin"/>
              {progress.phase === 'data' ? `Données ${progress.done}/${progress.total}…`
                : progress.phase === 'pdf' ? `PDFs ${progress.done}/${progress.total}…`
                : `Emails ${progress.done}/${progress.total}…`}
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
