import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCw, Search,
  History, TrendingUp, Filter, Calendar, X, Check,
  Loader2,CheckCircle2, ArrowRight, Package, User as UserIcon, SlidersHorizontal,
  Download, FileText, Printer, MapPin, Phone, Mail,
  FileSpreadsheet,
  Info, ChevronDown
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { apiClient } from '../services/api';
import { StockItem } from '../types';
import YearMonthPicker from './YearMonthPicker';


// ─── Composant document paginé (défini HORS du composant principal) ────────

interface MovReportHeaderProps {
  tenantSettings: any;
  dateFrom: string;
  dateTo: string;
  pageNumber: number;
  totalPages: number;
}
const MovReportHeader: React.FC<MovReportHeaderProps> = ({ tenantSettings, dateFrom, dateTo, pageNumber, totalPages }) => (
  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
    <div>
      {tenantSettings?.logoUrl ? (
        <img src={tenantSettings.logoUrl} className="h-14 w-auto object-contain mb-2 max-w-[180px]" alt="Logo" />
      ) : (
        <div className="text-2xl font-black text-indigo-600 mb-1 uppercase tracking-tighter">
          {tenantSettings?.name || 'VOTRE SOCIÉTÉ'}
        </div>
      )}
      <div className="space-y-0.5 text-[9px] font-bold text-slate-400 uppercase">
        {tenantSettings?.address && <div className="flex items-center gap-1"><MapPin size={8} className="text-indigo-400"/>{tenantSettings.address}</div>}
        {tenantSettings?.email  && <div className="flex items-center gap-1"><Mail   size={8} className="text-indigo-400"/>{tenantSettings.email}</div>}
        {tenantSettings?.phone  && <div className="flex items-center gap-1"><Phone  size={8} className="text-indigo-400"/>{tenantSettings.phone}</div>}
      </div>
    </div>
    <div className="text-right">
      <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">RAPPORT DE MOUVEMENTS</h1>
      <p className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block uppercase">
        Période : {dateFrom} au {dateTo}
      </p>
      {totalPages > 1 && (
        <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
          Page {pageNumber} / {totalPages}
        </p>
      )}
    </div>
  </div>
);

interface MovReportFooterProps {
  isLastPage: boolean;
  tenantName: string;
  dateFrom: string;
  dateTo: string;
  fingerprint: string;
}
const MovReportFooter: React.FC<MovReportFooterProps> = ({ isLastPage, tenantName, dateFrom, dateTo, fingerprint }) => (
  <div className="pt-5 border-t border-slate-100 mt-auto">
    {isLastPage ? (
      <div className="flex justify-between items-end">
        <div className="text-[8px] font-bold uppercase space-y-1 text-slate-300 italic">
          <p>Généré par GeStocPro Cloud • {tenantName}</p>
          <p>Rapport mouvements — {dateFrom} au {dateTo}</p>
          <p className="mt-2">Empreinte : {fingerprint}</p>
        </div>
        <div className="w-28 h-12 border border-slate-300 rounded-lg flex items-center justify-center text-[9px] font-black uppercase text-slate-300 italic">
          Signature
        </div>
      </div>
    ) : (
      <div className="flex justify-between items-center">
        <p className="text-[8px] text-slate-300 font-bold uppercase italic">
          GeStocPro Cloud • {tenantName} — Rapport mouvements — Suite →
        </p>
        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">
          {dateFrom} / {dateTo}
        </p>
      </div>
    )}
  </div>
);

interface MovTableProps { rows: any[] }
const MovTable: React.FC<MovTableProps> = ({ rows }) => (
  <table className="w-full text-left border-collapse">
    <thead>
      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase">
        <th className="p-3">DATE</th>
        <th className="p-3">ARTICLE</th>
        <th className="p-3">SKU</th>
        <th className="p-3 text-center">TYPE</th>
        <th className="p-3 text-right">QTÉ</th>
        <th className="p-3">OPÉRATEUR</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.length === 0 ? (
        <tr>
          <td colSpan={6} className="py-12 text-center text-[10px] font-black text-slate-300 uppercase">
            Aucune donnée pour cette période
          </td>
        </tr>
      ) : rows.map((m: any, i: number) => {
        const p = m.stock_item || m.stockItem || m.StockItem || {};
        const isIn = ['IN', 'ENTREE', 'ENTRY', 'ACHAT'].includes((m.type || '').toUpperCase());
        return (
          <tr key={i} className="text-xs font-bold">
            <td className="p-3 text-slate-500">{new Date(m.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
            <td className="p-3 text-slate-900 uppercase truncate max-w-[150px]">{p.name}</td>
            <td className="p-3 font-mono text-[9px] text-slate-400">{p.sku}</td>
            <td className="p-3 text-center">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {m.type}
              </span>
            </td>
            <td className={`p-3 text-right font-black ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isIn ? '+' : '-'}{Math.abs(m.qty).toLocaleString()}
            </td>
            <td className="p-3 text-slate-500">{m.userRef || '—'}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const ROWS_FIRST_PAGE = 12;
const ROWS_PER_PAGE   = 20;

interface StockMovementReportProps {
  movements: any[];
  tenantSettings: any;
  dateFrom: string;
  dateTo: string;
}
const StockMovementReport: React.FC<StockMovementReportProps> = ({ movements, tenantSettings, dateFrom, dateTo }) => {
  const totalEntrees = movements.filter(m => ['IN','ENTREE','ENTRY','ACHAT'].includes((m.type||'').toUpperCase())).reduce((s,m) => s + Math.abs(Number(m.qty)||0), 0);
  const totalSorties = movements.filter(m => !['IN','ENTREE','ENTRY','ACHAT'].includes((m.type||'').toUpperCase())).reduce((s,m) => s + Math.abs(Number(m.qty)||0), 0);
  const fingerprint  = useMemo(() => `${movements.length.toString(16)}-${Date.now().toString(36).toUpperCase().slice(-6)}`, []); // eslint-disable-line

  const pages: any[][] = [];
  pages.push(movements.slice(0, ROWS_FIRST_PAGE));
  const rest = movements.slice(ROWS_FIRST_PAGE);
  for (let i = 0; i < rest.length; i += ROWS_PER_PAGE) pages.push(rest.slice(i, i + ROWS_PER_PAGE));
  const totalPages = pages.length;

  return (
    <>
      <style>{`@media print { @page{size:A4;margin:0} body{margin:0} .mov-page{box-shadow:none!important;border:none!important} }`}</style>
      {pages.map((pageRows, idx) => {
        const pageNumber  = idx + 1;
        const isLastPage  = pageNumber === totalPages;
        const isFirstPage = pageNumber === 1;
        return (
          <div
            key={pageNumber}
            className="mov-page bg-white w-full mx-auto text-slate-800 font-sans flex flex-col shadow-xl border border-slate-200 mb-6"
            style={{ padding: '32px 40px', pageBreakAfter: isLastPage ? 'auto' : 'always', breakAfter: isLastPage ? 'auto' : 'page', minHeight: '297mm' }}
          >
            {/* ══ EN-TÊTE — toutes les pages ══ */}
            <MovReportHeader tenantSettings={tenantSettings} dateFrom={dateFrom} dateTo={dateTo} pageNumber={pageNumber} totalPages={totalPages} />

            {/* ══ KPIs — page 1 uniquement ══ */}
            {isFirstPage && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Mouvements</p>
                  <p className="text-xl font-black text-slate-900">{movements.length.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Entrées (qté)</p>
                  <p className="text-xl font-black text-emerald-600">+{totalEntrees.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Sorties (qté)</p>
                  <p className="text-xl font-black text-rose-600">-{totalSorties.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* ══ LABEL CONTINUATION — pages 2+ ══ */}
            {!isFirstPage && (
              <p className="mt-3 mb-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Suite des mouvements — {dateFrom} au {dateTo}
              </p>
            )}

            {/* ══ TABLEAU ══ */}
            <div className="mt-5 flex-1">
              <MovTable rows={pageRows} />
            </div>

            {/* ══ PIED DE PAGE — toutes les pages ══ */}
            <MovReportFooter isLastPage={isLastPage} tenantName={tenantSettings?.name || 'GeStocPro'} dateFrom={dateFrom} dateTo={dateTo} fingerprint={fingerprint} />
          </div>
        );
      })}
    </>
  );
};

// ─── Composant principal ───────────────────────────────────────────────────

const StockMovements = ({ currency, tenantSettings }: { currency: string, tenantSettings?: any }) => {
  const [movements, setMovements] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [perPage, setPerPage] = useState<string>('25');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'IMAGE' | 'EXCEL'>('IMAGE');
  const [imageFormat, setImageFormat] = useState<'PNG' | 'JPG'>('PNG');
  const [exportDates, setExportDates] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    type: 'ALL',
    operator: '',
    reason: 'ALL'
  });

  // Year/Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    movements.forEach((m: any) => { if (m.createdAt) years.add(new Date(m.createdAt).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [movements]);

  useEffect(() => {
    if (selectedYear === null) {
      setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
      return;
    }
    const ms = selectedMonth !== null ? selectedMonth : 0;
    const me = selectedMonth !== null ? selectedMonth : 11;
    setFilters(f => ({
      ...f,
      dateFrom: new Date(selectedYear, ms, 1).toISOString().split('T')[0],
      dateTo:   new Date(selectedYear, me + 1, 0).toISOString().split('T')[0]
    }));
  }, [selectedYear, selectedMonth]);

  const totals = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    (movements || []).forEach(m => {
      const q = Number(m.qty) || 0;
      if (m.type === 'IN') inCount += q;
      else if (m.type === 'OUT') outCount += q;
    });
    return { inCount, outCount };
  }, [movements]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [movs, stats] = await Promise.all([
        apiClient.get('/stock/movements'),
        apiClient.get('/stock/movements/stats')
      ]);
      setMovements(movs || []);
      setChartData((stats || []).map((s: any) => ({
        day: new Date(s.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        Entrées: parseInt(s.totalIn || 0), Sorties: parseInt(s.totalOut || 0)
      })));
    } catch (err) {
      console.error("Kernel Sync Error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const p = m.stock_item || m.stockItem || m.StockItem;
      const mDate = new Date(m.createdAt).toISOString().split('T')[0];
      
      const matchesSearch = (p?.name || '').toLowerCase().includes(filters.search.toLowerCase()) || 
                           (p?.sku || '').toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesType = filters.type === 'ALL' || m.type === filters.type;
      const matchesFrom = filters.dateFrom === '' || mDate >= filters.dateFrom;
      const matchesTo = filters.dateTo === '' || mDate <= filters.dateTo;
      const matchesOperator = filters.operator === '' || (m.userRef || '').toLowerCase().includes(filters.operator.toLowerCase());
      
      const matchesReason = filters.reason === 'ALL' ||
                           (filters.reason === 'MANUAL' && (m.reason || '').includes('MANUEL')) ||
                           (filters.reason === 'SALE' && (m.reason || '').toLowerCase().includes('vente')) ||
                           (filters.reason === 'ADJUST' && m.type === 'ADJUSTMENT') ||
                           (filters.reason === 'DELIVERY' && (m.reason || '').toLowerCase().includes('livraison'));

      return matchesSearch && matchesType && matchesFrom && matchesTo && matchesOperator && matchesReason;
    });
  }, [movements, filters]);

  const displayedMovements = useMemo(() => {
    if (!filteredMovements) return [];
    if (perPage === 'ALL') return filteredMovements;
    const n = parseInt(String(perPage)) || 25;
    return filteredMovements.slice(0, n);
  }, [filteredMovements, perPage]);

  const exportPreviewData = useMemo(() => {
    return movements.filter((m: any) => {
      const d = new Date(m.createdAt).toISOString().split('T')[0];
      return d >= exportDates.from && d <= exportDates.to;
    });
  }, [movements, exportDates]);

  const loadHtml2Canvas = async () => {
    if ((window as any).html2canvas) return (window as any).html2canvas;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Chargement html2canvas échoué'));
      document.head.appendChild(s);
    });
    return (window as any).html2canvas;
  };

  const exportAsImage = async () => {
    try {
      const html2canvas = await loadHtml2Canvas();
      const node = document.getElementById('export-preview-stock');
      if (!node) throw new Error('Aperçu introuvable pour export image');
      const canvas: HTMLCanvasElement = await html2canvas(node as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const mime = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg';
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return alert('Impossible de générer l\'image');
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_stock_${exportDates.from}_${exportDates.to}.${imageFormat === 'PNG' ? 'png' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }, mime, imageFormat === 'JPG' ? 0.92 : 0.95);
    } catch (err: any) {
      console.error('Export image failed', err);
      alert(err?.message || 'Erreur export image');
    }
  };

  const exportAsExcel = () => {
    const headers = ['Date','Heure','Article','SKU','Type','Quantité','Opérateur'];
    const rows = exportPreviewData.map((m: any) => {
      const p = m.stock_item || m.stockItem || m.StockItem || {};
      return [
        new Date(m.createdAt).toLocaleDateString(),
        new Date(m.createdAt).toLocaleTimeString(),
        p.name || 'N/A',
        p.sku || 'N/A',
        m.type,
        m.qty,
        m.userRef || ''
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_stock_${exportDates.from}_${exportDates.to}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    if (exportFormat === 'IMAGE') await exportAsImage(); else exportAsExcel();
    setShowExportModal(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
            <div className="bg-emerald-900 p-4 md:p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><ArrowUpCircle size={80}/></div>
              <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">Logistique Entrées</p>
              <h3 className="text-2xl md:text-4xl font-black">{totals.inCount.toLocaleString()}</h3>
              <p className="text-sm font-black opacity-80">Réception</p>
            </div>
            <div className="bg-rose-900 p-4 md:p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><ArrowDownCircle size={80}/></div>
              <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">Audit des Sorties</p>
              <h3 className="text-2xl md:text-4xl font-black">{totals.outCount.toLocaleString()}</h3>
              <p className="text-sm font-black opacity-80">Expédition</p>
            </div>
        </div>

        <div className="lg:col-span-8 bg-white p-4 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="h-60 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                      <defs>
                         <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                         <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Area type="monotone" dataKey="Entrées" stroke="#10b981" fill="url(#colorIn)" strokeWidth={3} />
                      <Area type="monotone" dataKey="Sorties" stroke="#f43f5e" fill="url(#colorOut)" strokeWidth={3} />
                   </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase tracking-widest">Calcul de vélocité...</div>
              )}
           </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap print:hidden bg-white p-4 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <History className="text-indigo-600" size={32} /> Registre des Flux
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">Traçabilité logistique intégrale</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
            Afficher
            <select value={perPage} onChange={e => setPerPage(e.target.value)} className="ml-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-black outline-none">
              <option value="5">5</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="ALL">Tous</option>
            </select>
          </label>

          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-4 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
          >
            <Filter size={20} /> FILTRES {filteredMovements.length !== movements.length && <span className="bg-white text-indigo-600 w-4 h-4 rounded-full flex items-center justify-center text-[8px]">!</span>}
          </button>
          <button onClick={fetchData} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowExportModal(true)} className="px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl hover:bg-emerald-700">
            <Download size={16} /> EXPORTER
          </button>
        </div>
      </div>

      {/* ZONE FILTRES AVANCÉS */}
      {showFilters && (
        <div className="bg-white p-4 md:p-8 rounded-[3rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-6">
          <YearMonthPicker
            dataYears={availableYears}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Article / SKU</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Rechercher produit..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Type de Flux</label>
              <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="ALL">Tous les flux</option>
                <option value="IN">ENTRÉES (+)</option>
                <option value="OUT">SORTIES (-)</option>
                <option value="ADJUSTMENT">AJUSTEMENTS</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Motif / Source</label>
              <select value={filters.reason} onChange={e => setFilters({...filters, reason: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="ALL">Tous les motifs</option>
                <option value="MANUAL">MANUEL</option>
                <option value="SALE">VENTES</option>
                <option value="ADJUST">INVENTAIRE</option>
                <option value="DELIVERY">LIVRAISONS FOURNISSEUR</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Opérateur</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Nom opérateur..." value={filters.operator} onChange={e => setFilters({...filters, operator: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Du)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Au)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFilters({search:'', dateFrom:'', dateTo:'', type:'ALL', operator:'', reason:'ALL'})} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">RÉINITIALISER LES FILTRES</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
             <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                   <th className="px-3 md:px-6 py-3 md:py-4">Horodatage</th>
                   <th className="px-3 md:px-6 py-3 md:py-4">Article / Référence</th>
                   <th className="px-3 md:px-6 py-3 md:py-4">Source / Motif</th>
                   <th className="px-3 md:px-6 py-3 md:py-4 text-center">Action</th>
                   <th className="px-3 md:px-6 py-3 md:py-4 text-right">Mouvement</th>
                   <th className="px-3 md:px-6 py-3 md:py-4 text-right">Opérateur</th>
                   <th className="px-3 md:px-6 py-3 md:py-4 text-right">Stock Final</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {loading ? (
                   <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" /></td></tr>
                ) : filteredMovements.length === 0 ? (
                   <tr><td colSpan={7} className="py-20 text-center text-slate-300 uppercase font-black text-[10px]">Aucun flux trouvé dans les critères</td></tr>
                 ) : displayedMovements.map((m: any) => {
                   const p = m.stock_item || m.stockItem || m.StockItem;
                   return (
                   <tr key={m.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-3 md:px-6 py-3 md:py-4">
                         <p className="text-xs font-black text-slate-800">{new Date(m.createdAt).toLocaleDateString()}</p>
                         <p className="text-[9px] text-slate-400 font-bold">{new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                         <p className="text-sm font-black text-slate-900 uppercase truncate max-w-[120px] md:max-w-[180px]">{p?.name || 'Article Inconnu'}</p>
                         <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-tighter">SKU: {p?.sku || 'N/A'}</p>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                         <p className="text-[10px] font-black text-slate-600 uppercase">{m.reason || 'MANUEL'}</p>
                         <p className="text-[8px] text-indigo-400 font-bold mt-1 uppercase tracking-widest">Ref: {m.referenceId || 'GSP-AUTO'}</p>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                         <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase border ${m.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : m.type === 'ADJUSTMENT' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {m.type === 'IN' ? 'ENTRÉE' : m.type === 'ADJUSTMENT' ? 'AJUSTEMENT' : 'SORTIE'}
                         </span>
                      </td>
                      <td className={`px-3 md:px-6 py-3 md:py-4 text-right font-black text-base ${m.type === 'IN' ? 'text-emerald-600' : m.type === 'ADJUSTMENT' ? 'text-amber-600' : 'text-rose-600'}`}>
                         {m.type === 'IN' ? '+' : ''}{m.qty}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                         <p className="text-[10px] font-black text-slate-600 uppercase">{m.userRef || 'Kernel'}</p>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right font-black text-slate-400">
                         {m.newLevel}
                      </td>
                   </tr>
                )})}
             </tbody>
          </table>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
          <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-500">
             <div className="px-6 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Download className="text-emerald-500" size={24}/>
                  <h3 className="text-lg font-black uppercase tracking-tight">Exportation Stratégique des Mouvements</h3>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all"><X size={20}/></button>
             </div>
             
             <div className="flex-1 overflow-hidden grid grid-cols-12 min-h-0">
                <div className="col-span-12 lg:col-span-4 border-r border-slate-100 flex flex-col bg-slate-50/50 min-h-0">
                  <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Période du Rapport</label>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="date" 
                            value={exportDates.from} 
                            onChange={e => setExportDates({...exportDates, from: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" 
                          />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="date" 
                            value={exportDates.to} 
                            onChange={e => setExportDates({...exportDates, to: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Format de Sortie</label>
                      <div className="grid grid-cols-1 gap-3">
                         {[
                           { id: 'IMAGE', label: 'Image (PNG / JPG)', icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50' },
                           { id: 'EXCEL', label: 'Feuille Excel (XLS)', icon: FileSpreadsheet, color: 'text-blue-500', bg: 'bg-blue-50' }
                         ].map(fmt => {
                           const Icon = fmt.icon as any;
                           const keyId = fmt.id === 'IMAGE' ? 'IMAGE' : 'EXCEL';
                           return (
                             <div key={fmt.id} className="relative">
                               <button
                                 onClick={() => setExportFormat(keyId as any)}
                                 className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between group w-full ${exportFormat === keyId ? 'border-indigo-600 bg-white shadow-lg shadow-indigo-50' : 'border-white bg-white/50 hover:border-slate-200'}`}
                               >
                                 <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 ${fmt.bg} ${fmt.color} rounded-xl flex items-center justify-center shadow-inner`}>
                                     <Icon size={16} />
                                   </div>
                                   <span className={`text-[9px] font-black uppercase ${exportFormat === keyId ? 'text-indigo-600' : 'text-slate-500'}`}>{fmt.label}</span>
                                 </div>
                                 {exportFormat === keyId && <CheckCircle2 className="text-indigo-600" size={16} />}
                               </button>
                               {fmt.id === 'IMAGE' && exportFormat === 'IMAGE' && (
                                 <div className="mt-2 flex items-center gap-2">
                                   <select value={imageFormat} onChange={e => setImageFormat(e.target.value as any)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-black">
                                     <option value="PNG">PNG</option>
                                     <option value="JPG">JPG</option>
                                   </select>
                                 </div>
                               )}
                             </div>
                           );
                         })}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                       <p className="text-[8px] text-indigo-700 font-bold uppercase leading-relaxed">
                         <Info className="inline-block mr-1 mb-0.5" size={8} /> 
                         L'export inclut automatiquement le logo et les mentions légales de votre instance "{tenantSettings?.name || 'GeStocPro'}".
                       </p>
                    </div>
                  </div>

                  <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3 shrink-0">
                    <button 
                      onClick={handleExport}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      {exportFormat === 'PDF' ? <Printer size={16}/> : <Download size={16}/>} GÉNÉRER LE FICHIER
                    </button>
                  </div>
                </div>

                {/* ══ ZONE PREVIEW — remplacée par StockMovementReport paginé ══ */}
                <div className="col-span-12 lg:col-span-8 flex flex-col bg-white overflow-hidden relative">
                  <div className="p-8 bg-slate-50/50 border-b flex justify-between items-center shrink-0">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aperçu en temps réel ({exportPreviewData.length} lignes)</h4>
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Visualisation Dynamique</span>
                  </div>
                  <div id="export-preview-stock" className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar bg-slate-100/30">
                    <StockMovementReport
                      movements={exportPreviewData}
                      tenantSettings={tenantSettings}
                      dateFrom={exportDates.from}
                      dateTo={exportDates.to}
                    />
                  </div>
                </div>

             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockMovements;