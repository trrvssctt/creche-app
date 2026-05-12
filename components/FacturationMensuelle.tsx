import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Download, RefreshCw, Search, CheckSquare, Square,
  Loader2, Users, BookOpen, ChevronDown, ChevronRight, AlertCircle,
  Archive, X,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import YearMonthPicker from './YearMonthPicker';
import {
  StudentInvoiceData,
  generateInvoicePdfBlob,
  downloadBlob,
  downloadZipInvoices,
} from '../services/invoicePdf';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Classe { id: string; nom: string; niveau: string; nbEleves: number; capaciteMax: number; }
interface EleveItem { id: string; nom: string; prenom: string; matricule?: string; niveau: string; classeId?: string; parent1?: any; }

const ANNEE_COURANTE = `${new Date().getFullYear() - (new Date().getMonth() < 9 ? 1 : 0)}-${new Date().getFullYear() - (new Date().getMonth() < 9 ? 1 : 0) + 1}`;
const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section', GS: 'Grande Section',
  CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

// ─── Composant principal ───────────────────────────────────────────────────

const FacturationMensuelle = ({
  currency = 'F CFA',
  tenantSettings,
}: {
  currency?: string;
  tenantSettings?: any;
}) => {
  const showToast = useToast();

  // ── Data ─────────────────────────────────────────────────────────────────
  const [classes, setClasses]   = useState<Classe[]>([]);
  const [eleves, setEleves]     = useState<EleveItem[]>([]);
  const [settings, setSettings] = useState<any>(tenantSettings || null);
  const [loading, setLoading]   = useState(true);

  // ── Filters & selection ──────────────────────────────────────────────────
  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState<number | null>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth() + 1);
  const [search,        setSearch]        = useState('');
  const [filterClasse,  setFilterClasse]  = useState<string>('ALL');
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [expandedNiv,   setExpandedNiv]   = useState<Set<string>>(new Set(['PS', 'MS', 'GS', 'CP']));

  // ── Generation state ─────────────────────────────────────────────────────
  const [generating,  setGenerating]  = useState(false);
  const [progress,    setProgress]    = useState<{ done: number; total: number } | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, elv, stt] = await Promise.all([
        apiClient.get('/classes', { params: { anneeScolaire: ANNEE_COURANTE } }),
        apiClient.get('/eleves',  { params: { anneeScolaire: ANNEE_COURANTE, statut: 'INSCRIT' } }),
        settings ? Promise.resolve(settings) : apiClient.get('/settings').catch(() => ({})),
      ]);
      setClasses(Array.isArray(cls) ? cls : []);
      setEleves(Array.isArray(elv) ? elv : []);
      if (!settings) setSettings(stt || {});
    } catch {
      showToast('Erreur chargement des données.', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const classeById = useMemo(() => {
    const m: Record<string, Classe> = {};
    classes.forEach(c => { m[c.id] = c; });
    return m;
  }, [classes]);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return eleves.filter(e => {
      if (filterClasse !== 'ALL' && e.classeId !== filterClasse) return false;
      if (q && !`${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [eleves, filterClasse, search]);

  // Group by classe / niveau
  const groups = useMemo(() => {
    const map: Record<string, { classe: Classe | null; eleves: EleveItem[] }> = {};
    filteredEleves.forEach(e => {
      const key = e.classeId || `__niveau__${e.niveau}`;
      if (!map[key]) {
        map[key] = { classe: e.classeId ? classeById[e.classeId] || null : null, eleves: [] };
      }
      map[key].eleves.push(e);
    });
    return Object.entries(map).sort(([, a], [, b]) => {
      const na = a.classe?.nom || a.eleves[0]?.niveau || '';
      const nb = b.classe?.nom || b.eleves[0]?.niveau || '';
      return na.localeCompare(nb);
    });
  }, [filteredEleves, classeById]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleGroup = (ids: string[]) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      const allIn = ids.every(id => s.has(id));
      if (allIn) ids.forEach(id => s.delete(id)); else ids.forEach(id => s.add(id));
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredEleves.length && filteredEleves.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEleves.map(e => e.id)));
    }
  };

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (!selectedMonth || !selectedYear) return 'Toute période';
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    const l = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return l.charAt(0).toUpperCase() + l.slice(1);
  }, [selectedYear, selectedMonth]);

  // ── PDF generation ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    if (!selectedMonth || !selectedYear) {
      showToast('Veuillez sélectionner un mois.', 'error');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    const ids = Array.from(selectedIds);
    setProgress({ done: 0, total: ids.length });

    try {
      const items: { filename: string; data: StudentInvoiceData }[] = [];

      for (let i = 0; i < ids.length; i++) {
        const eleveId = ids[i];
        const eleve = eleves.find(e => e.id === eleveId);
        if (!eleve) continue;

        let factureData: any = { eleve, echeances: [], totalDu: 0, totalPaye: 0, solde: 0 };
        try {
          factureData = await apiClient.get(
            `/abonnements/echeances/facture/${eleveId}`,
            { params: { month: selectedMonth, year: selectedYear } }
          );
        } catch {
          // No abonnements for this student — generate empty invoice
        }

        const classeNom = eleve.classeId ? classeById[eleve.classeId]?.nom : undefined;

        const invoiceData: StudentInvoiceData = {
          eleve: {
            nom: eleve.nom,
            prenom: eleve.prenom,
            matricule: eleve.matricule,
            niveau: NIVEAUX_LABELS[eleve.niveau] || eleve.niveau,
            classeNom,
          },
          parent1: factureData.eleve?.parent1 || eleve.parent1,
          tenant: {
            name: settings?.name || settings?.companyName,
            address: settings?.address,
            phone: settings?.phone,
            email: settings?.email,
          },
          period: periodLabel,
          currency,
          echeances: factureData.echeances || [],
          totalDu:   factureData.totalDu   ?? 0,
          totalPaye: factureData.totalPaye ?? 0,
          solde:     factureData.solde     ?? 0,
        };

        const filename = `facture_${eleve.prenom}_${eleve.nom}_${periodLabel.replace(/\s+/g, '_')}.pdf`;
        items.push({ filename, data: invoiceData });
        setProgress({ done: i + 1, total: ids.length });
      }

      if (items.length === 1) {
        const blob = await generateInvoicePdfBlob(items[0].data);
        downloadBlob(blob, items[0].filename);
        showToast('Facture téléchargée.', 'success');
      } else {
        const zipName = `factures_${periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.zip`;
        await downloadZipInvoices(items, zipName);
        showToast(`${items.length} factures téléchargées dans le ZIP.`, 'success');
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  const allSelected = filteredEleves.length > 0 && selectedIds.size === filteredEleves.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" /> Facturation Mensuelle
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            Sélectionnez des élèves ou une classe entière pour générer les factures PDF
          </p>
        </div>
        <button onClick={fetchAll} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
          <RefreshCw size={15} className="text-slate-500" />
        </button>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <YearMonthPicker
            dataYears={[new Date().getFullYear(), new Date().getFullYear() - 1]}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
        </div>

        {/* Classe filter */}
        <select
          value={filterClasse}
          onChange={e => { setFilterClasse(e.target.value); setSelectedIds(new Set()); }}
          className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="ALL">Toutes les classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.nom} ({c.nbEleves} élèves)</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un élève…"
            className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-rose-700 text-xs font-bold">
          <AlertCircle size={14} /> {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* ── Selection toolbar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-2.5 flex items-center gap-3">
        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-indigo-600 transition-all">
          {allSelected
            ? <CheckSquare size={15} className="text-indigo-600" />
            : someSelected
            ? <CheckSquare size={15} className="text-indigo-400" />
            : <Square size={15} />}
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>

        {selectedIds.size > 0 && (
          <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
            {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {progress && (
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
              <Loader2 size={13} className="animate-spin" />
              Génération {progress.done}/{progress.total}…
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={selectedIds.size === 0 || generating || !selectedMonth}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
          >
            {generating ? (
              <><Loader2 size={13} className="animate-spin" /> Génération…</>
            ) : selectedIds.size > 1 ? (
              <><Archive size={13} /> Télécharger ZIP ({selectedIds.size})</>
            ) : (
              <><Download size={13} /> Télécharger PDF</>
            )}
          </button>
        </div>
      </div>

      {/* ── Student list ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Users size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Aucun élève trouvé</p>
          </div>
        ) : groups.map(([key, group]) => {
          const label = group.classe?.nom || `Niveau ${NIVEAUX_LABELS[group.eleves[0]?.niveau] || group.eleves[0]?.niveau || '?'}`;
          const groupIds = group.eleves.map(e => e.id);
          const allGroupSelected = groupIds.every(id => selectedIds.has(id));
          const someGroupSelected = groupIds.some(id => selectedIds.has(id)) && !allGroupSelected;
          const isExpanded = expandedNiv.has(key);

          return (
            <div key={key} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 transition-all"
                onClick={() => setExpandedNiv(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; })}
              >
                <button
                  onClick={e => { e.stopPropagation(); toggleGroup(groupIds); }}
                  className="shrink-0 text-slate-400 hover:text-indigo-600 transition-all"
                >
                  {allGroupSelected
                    ? <CheckSquare size={15} className="text-indigo-600" />
                    : someGroupSelected
                    ? <CheckSquare size={15} className="text-indigo-400" />
                    : <Square size={15} />}
                </button>
                <BookOpen size={14} className="text-indigo-400 shrink-0" />
                <span className="font-black text-sm text-slate-800">{label}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">
                  {group.eleves.length} élève{group.eleves.length > 1 ? 's' : ''}
                </span>
                {someGroupSelected && (
                  <span className="ml-1 bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {groupIds.filter(id => selectedIds.has(id)).length} sél.
                  </span>
                )}
                <div className="ml-auto text-slate-400">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {/* Student rows */}
              {isExpanded && (
                <div className="divide-y divide-slate-50 border-t border-slate-100">
                  {group.eleves.map(e => {
                    const checked = selectedIds.has(e.id);
                    return (
                      <div
                        key={e.id}
                        onClick={() => toggleOne(e.id)}
                        className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-all ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="shrink-0">
                          {checked
                            ? <CheckSquare size={14} className="text-indigo-600" />
                            : <Square size={14} className="text-slate-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-sm text-slate-800">
                            {e.prenom} {e.nom}
                          </span>
                          {e.matricule && (
                            <span className="ml-2 text-[9px] font-bold text-slate-400">{e.matricule}</span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">
                          {NIVEAUX_LABELS[e.niveau] || e.niveau}
                        </span>
                        {e.parent1?.whatsapp && (
                          <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {e.parent1.whatsapp}
                          </span>
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

      {/* ── Bottom FAB ────────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && !generating && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleGenerate}
            disabled={!selectedMonth}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all"
          >
            {selectedIds.size > 1
              ? <><Archive size={15} /> Générer {selectedIds.size} factures (ZIP)</>
              : <><Download size={15} /> Générer la facture PDF</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default FacturationMensuelle;
