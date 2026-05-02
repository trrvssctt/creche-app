import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Search, RefreshCw,
  CreditCard, Smartphone, DollarSign, Calendar,
  Download, CheckCircle2,
  SlidersHorizontal,
  X, Landmark, ArrowDownCircle,
  BadgeCheck, FileText, FileSpreadsheet,
  Loader2, MapPin, Phone, Mail, Info,
  TrendingUp, Banknote, Zap
} from 'lucide-react';
import { apiClient } from '../services/api';
import YearMonthPicker from './YearMonthPicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAmt = (n: number | string) => Number(n || 0).toLocaleString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const METHOD_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  CASH:         { label: 'Espèces',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Banknote },
  WAVE:         { label: 'Wave',         color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200', icon: Zap },
  MOBILE_MONEY: { label: 'Mobile Money', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',icon: Smartphone },
  CHEQUE:       { label: 'Chèque',       color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',  icon: FileText },
  ORANGE_MONEY: { label: 'Orange Money', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', icon: Smartphone },
  MTN_MOMO:     { label: 'MTN MoMo',     color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Smartphone },
  TRANSFER:     { label: 'Virement',     color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',    icon: Landmark },
  STRIPE:       { label: 'Stripe',       color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200', icon: CreditCard },
};

const MethodBadge = ({ method }: { method: string }) => {
  const m = METHOD_META[method] || { label: method, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: DollarSign };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${m.bg} ${m.color} ${m.border}`}>
      <Icon size={8}/> {m.label}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = status === 'TERMINE'
    ? { label: 'Soldé', color: 'text-emerald-700', bg: 'bg-emerald-50' }
    : status === 'ANNULE'
    ? { label: 'Annulé', color: 'text-rose-700', bg: 'bg-rose-50' }
    : { label: 'En cours', color: 'text-amber-700', bg: 'bg-amber-50' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
};

// ─── Rapport de trésorerie (print / export image) ─────────────────────────────
interface TreasuryHeaderProps { settings: any; dateFrom: string; dateTo: string; pageNumber: number; totalPages: number; currency: string; }
const TreasuryHeader: React.FC<TreasuryHeaderProps> = ({ settings, dateFrom, dateTo, pageNumber, totalPages, currency }) => (
  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
    <div>
      {settings?.logoUrl
        ? <img src={settings.logoUrl} className="h-12 w-auto object-contain mb-2 max-w-[160px]" alt="Logo"/>
        : <div className="text-xl font-black text-indigo-600 mb-1 uppercase tracking-tighter">{settings?.name || 'VOTRE SOCIÉTÉ'}</div>}
      <div className="space-y-0.5 text-[8px] uppercase font-bold text-slate-400">
        {settings?.address && <p className="flex items-center gap-1"><MapPin size={7} className="text-indigo-400"/>{settings.address}</p>}
        {settings?.phone   && <p className="flex items-center gap-1"><Phone  size={7} className="text-indigo-400"/>{settings.phone}</p>}
        {settings?.email   && <p className="flex items-center gap-1"><Mail   size={7} className="text-indigo-400"/>{settings.email}</p>}
      </div>
    </div>
    <div className="text-right">
      <h1 className="text-xl font-black text-slate-900 tracking-tighter mb-1">RAPPORT DE TRÉSORERIE</h1>
      <p className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block uppercase">Période : {dateFrom} → {dateTo}</p>
      {totalPages > 1 && <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase">Page {pageNumber} / {totalPages}</p>}
    </div>
  </div>
);

interface TreasuryFooterProps { isLastPage: boolean; tenantName: string; dateFrom: string; dateTo: string; totalAmount: number; currency: string; fingerprint: string; }
const TreasuryFooter: React.FC<TreasuryFooterProps> = ({ isLastPage, tenantName, dateFrom, dateTo, totalAmount, currency, fingerprint }) => (
  <div className="pt-4 border-t border-slate-100 mt-auto">
    {isLastPage ? (
      <div className="flex justify-between items-end">
        <div className="text-[6px] font-bold uppercase space-y-0.5 text-slate-300 italic">
          <p>GeStocPro Cloud Kernel v3.2 • {tenantName}</p>
          <p>Rapport trésorerie — {dateFrom} au {dateTo}</p>
          <p className="mt-1">Empreinte : {fingerprint}</p>
        </div>
        <div className="w-20 h-10 border border-slate-300 rounded-lg flex items-center justify-center text-[5px] font-black uppercase text-slate-300 italic">Signature</div>
      </div>
    ) : (
      <p className="text-[7px] text-slate-300 font-bold uppercase italic">GeStocPro Cloud • {tenantName} — Suite →</p>
    )}
  </div>
);

const TreasuryTable: React.FC<{ rows: any[]; currency: string; showTotal?: boolean; totalAmount?: number }> = ({ rows, currency, showTotal, totalAmount }) => (
  <table className="w-full text-left border-collapse text-[8px]">
    <thead>
      <tr className="bg-slate-900 text-white font-black uppercase">
        <th className="p-2.5">Date</th>
        <th className="p-2.5">Référence</th>
        <th className="p-2.5">Client</th>
        <th className="p-2.5 text-center">Canal</th>
        <th className="p-2.5 text-right">Montant ({currency})</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.length === 0 ? (
        <tr><td colSpan={5} className="py-12 text-center font-black text-slate-300 uppercase">Aucune donnée</td></tr>
      ) : rows.map((p, i) => (
        <tr key={i} className="font-bold hover:bg-slate-50/50">
          <td className="p-2.5 text-slate-500">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
          <td className="p-2.5 text-indigo-600 font-mono">#{p.saleRef}</td>
          <td className="p-2.5 text-slate-900 uppercase truncate max-w-[100px]">{p.customer}</td>
          <td className="p-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${p.method === 'CASH' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>{p.method}</span></td>
          <td className="p-2.5 text-right font-black text-emerald-600">{fmtAmt(p.amount)}</td>
        </tr>
      ))}
    </tbody>
    {showTotal && (
      <tfoot className="bg-slate-50 border-t-2 border-slate-200">
        <tr className="font-black text-[8px]">
          <td colSpan={4} className="p-2.5 text-right uppercase text-slate-400">Total Encaissé</td>
          <td className="p-2.5 text-right text-indigo-600">{fmtAmt(totalAmount || 0)} {currency}</td>
        </tr>
      </tfoot>
    )}
  </table>
);

const ROWS_P1 = 16;
const ROWS_PN = 24;
const TreasuryReport: React.FC<{ payments: any[]; settings: any; dateFrom: string; dateTo: string; currency: string }> = ({ payments, settings, dateFrom, dateTo, currency }) => {
  const totalAmount   = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalCash     = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalDigital  = totalAmount - totalCash;
  const fingerprint   = useMemo(() => `${payments.length.toString(16)}-${Date.now().toString(36).toUpperCase().slice(-6)}`, []); // eslint-disable-line

  const pages: any[][] = [payments.slice(0, ROWS_P1)];
  const rest = payments.slice(ROWS_P1);
  for (let i = 0; i < rest.length; i += ROWS_PN) pages.push(rest.slice(i, i + ROWS_PN));

  return (
    <>
      <style>{`@media print{@page{size:A4;margin:0}body{margin:0}.treasury-page{box-shadow:none!important;border:none!important}}`}</style>
      {pages.map((rows, idx) => {
        const page = idx + 1;
        const isLast = page === pages.length;
        return (
          <div key={page} className="treasury-page bg-white w-full mx-auto text-slate-800 flex flex-col shadow-xl border border-slate-200 mb-6"
            style={{ padding: '24px 32px', pageBreakAfter: isLast ? 'auto' : 'always', minHeight: '297mm' }}>
            <TreasuryHeader settings={settings} dateFrom={dateFrom} dateTo={dateTo} pageNumber={page} totalPages={pages.length} currency={currency}/>
            {idx === 0 && (
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Total Encaissé</p>
                  <p className="text-base font-black text-slate-900">{fmtAmt(totalAmount)} {currency}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Espèces</p>
                  <p className="text-base font-black text-amber-600">{fmtAmt(totalCash)} {currency}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Digital</p>
                  <p className="text-base font-black text-indigo-600">{fmtAmt(totalDigital)} {currency}</p>
                </div>
              </div>
            )}
            {idx > 0 && <p className="mt-3 mb-1 text-[7px] font-black text-slate-400 uppercase">Suite — {dateFrom} au {dateTo}</p>}
            <div className="mt-4 flex-1">
              <TreasuryTable rows={rows} currency={currency} showTotal={isLast} totalAmount={totalAmount}/>
            </div>
            <TreasuryFooter isLastPage={isLast} tenantName={settings?.name || 'GeStocPro'} dateFrom={dateFrom} dateTo={dateTo} totalAmount={totalAmount} currency={currency} fingerprint={fingerprint}/>
          </div>
        );
      })}
    </>
  );
};

// ─── Composant principal ───────────────────────────────────────────────────────
const Payments = ({ currency, tenantSettings }: { currency: string; tenantSettings?: any }) => {
  const [payments, setPayments]           = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showFilters, setShowFilters]     = useState(false);
  const [pageSize, setPageSize]           = useState<number>(30);
  const [showExportModal, setShowExportModal] = useState(false);
  const [settings, setSettings]           = useState<any>(tenantSettings || null);
  const [exportFormat, setExportFormat]   = useState<'IMAGE' | 'EXCEL'>('IMAGE');
  const [imageFormat, setImageFormat]     = useState<'PNG' | 'JPG'>('PNG');

  const [filters, setFilters] = useState({
    search: '', dateFrom: '', dateTo: '',
    method: 'ALL', status: 'ALL',
    minAmount: '', maxAmount: ''
  });

  // Year/Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    payments.forEach(p => { if (p.createdAt) years.add(new Date(p.createdAt).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [payments]);

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

  const [exportDates, setExportDates] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const activeFilterCount = [
    filters.search, filters.dateFrom, filters.dateTo,
    filters.method !== 'ALL' ? filters.method : '',
    filters.status !== 'ALL' ? filters.status : '',
    filters.minAmount, filters.maxAmount
  ].filter(Boolean).length;

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/sales');
      const all = (data as any[]).flatMap((sale: any) =>
        (sale.payments || []).map((p: any) => ({
          ...p,
          saleRef: sale.reference,
          saleId: sale.id,
          customer: sale.customer?.companyName || sale.customer?.name || 'Vente Directe',
          operator: sale.operator || 'Admin',
          saleStatus: sale.status,
        }))
      ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(all);
      if (!tenantSettings) {
        const s = await apiClient.get('/settings');
        setSettings(s);
      }
    } catch {
      console.error('Finance fetch error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  // ── Filtres & stats ──────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => payments.filter(p => {
    const pDate = new Date(p.createdAt).toISOString().split('T')[0];
    const amt = parseFloat(p.amount);
    return (
      ((p.saleRef || '').toLowerCase().includes(filters.search.toLowerCase()) ||
       (p.customer || '').toLowerCase().includes(filters.search.toLowerCase())) &&
      (filters.method === 'ALL' || p.method === filters.method) &&
      (filters.status === 'ALL' || p.saleStatus === filters.status) &&
      (filters.minAmount === '' || amt >= parseFloat(filters.minAmount)) &&
      (filters.maxAmount === '' || amt <= parseFloat(filters.maxAmount)) &&
      (filters.dateFrom === '' || pDate >= filters.dateFrom) &&
      (filters.dateTo   === '' || pDate <= filters.dateTo)
    );
  }), [payments, filters]);

  const displayed = useMemo(() =>
    pageSize === -1 ? filteredPayments : filteredPayments.slice(0, pageSize),
    [filteredPayments, pageSize]
  );

  const CHEQUE_PENDING_STATUSES = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];

  const stats = useMemo(() => {
    // Exclure les chèques non encore encaissés du calcul de trésorerie
    const encaished = filteredPayments.filter(p => !(p.method === 'CHEQUE' && CHEQUE_PENDING_STATUSES.includes(p.status)));
    const total   = encaished.reduce((s, p) => s + parseFloat(p.amount), 0);
    const cash    = encaished.filter(p => p.method === 'CASH').reduce((s, p) => s + parseFloat(p.amount), 0);
    const digital = total - cash;
    const avg     = encaished.length > 0 ? total / encaished.length : 0;
    // Chèques en transit (tous, pas uniquement les filtrés)
    const pendingCheques = payments.filter(p => p.method === 'CHEQUE' && CHEQUE_PENDING_STATUSES.includes(p.status));
    const totalPendingCheques = pendingCheques.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    return { total, cash, digital, avg, count: encaished.length, totalPendingCheques, pendingCheques };
  }, [filteredPayments, payments]);

  const exportPreviewData = useMemo(() => payments.filter(p => {
    const pDate = new Date(p.createdAt).toISOString().split('T')[0];
    return pDate >= exportDates.from && pDate <= exportDates.to;
  }), [payments, exportDates]);

  const resetFilters = () => setFilters({ search: '', dateFrom: '', dateTo: '', method: 'ALL', status: 'ALL', minAmount: '', maxAmount: '' });

  // ── Export ───────────────────────────────────────────────────────────────
  const loadHtml2Canvas = async () => {
    if ((window as any).html2canvas) return (window as any).html2canvas;
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = () => res(); s.onerror = () => rej(new Error('Chargement html2canvas échoué'));
      document.head.appendChild(s);
    });
    return (window as any).html2canvas;
  };

  const exportAsImage = async () => {
    const h2c = await loadHtml2Canvas();
    const node = document.getElementById('export-preview');
    if (!node) return alert('Aperçu introuvable');
    const canvas = await h2c(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const mime = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg';
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) return alert("Impossible de générer l'image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tresorerie_${exportDates.from}_${exportDates.to}.${imageFormat.toLowerCase()}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }, mime, 0.93);
  };

  const exportAsExcel = () => {
    const csv = [
      ['Date', 'Heure', 'Reference', 'Client', 'Methode', 'Montant', 'Statut'],
      ...exportPreviewData.map(p => [
        new Date(p.createdAt).toLocaleDateString('fr-FR'),
        fmtTime(p.createdAt), p.saleRef, p.customer, p.method, p.amount, p.saleStatus
      ])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tresorerie_${exportDates.from}_${exportDates.to}.xls`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleExport = () => { if (exportFormat === 'IMAGE') exportAsImage(); else exportAsExcel(); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Volume total */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-slate-900 p-5 md:p-6 rounded-3xl text-white relative overflow-hidden group shadow-xl border border-slate-800">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={80}/></div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Encaissé</p>
          <h3 className="text-xl md:text-2xl font-black leading-tight">{fmtAmt(stats.total)}</h3>
          <p className="text-[9px] text-slate-500 font-bold">{currency}</p>
          <div className="mt-3 flex items-center gap-1.5 text-indigo-400">
            <BadgeCheck size={12}/>
            <span className="text-[9px] font-black uppercase">{stats.count} versement(s)</span>
          </div>
        </div>

        {/* Espèces */}
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform"><Banknote size={70}/></div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Espèces (Cash)</p>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{fmtAmt(stats.cash)}</h3>
          <p className="text-[9px] text-slate-400 font-bold">{currency}</p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 bg-amber-500 rounded-full transition-all" style={{ width: `${stats.total > 0 ? (stats.cash / stats.total) * 100 : 0}%` }}/>
          </div>
          <p className="text-[8px] text-amber-600 font-black mt-1">{stats.total > 0 ? Math.round((stats.cash / stats.total) * 100) : 0}% du total</p>
        </div>

        {/* Digital */}
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform"><Smartphone size={70}/></div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Flux Digitaux</p>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{fmtAmt(stats.digital)}</h3>
          <p className="text-[9px] text-slate-400 font-bold">{currency}</p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 bg-indigo-500 rounded-full transition-all" style={{ width: `${stats.total > 0 ? (stats.digital / stats.total) * 100 : 0}%` }}/>
          </div>
          <p className="text-[8px] text-indigo-600 font-black mt-1">{stats.total > 0 ? Math.round((stats.digital / stats.total) * 100) : 0}% du total</p>
        </div>

        {/* Moyenne */}
        <div className="bg-emerald-50 p-5 md:p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={70} className="text-emerald-700"/></div>
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Règlement Moyen</p>
          <h3 className="text-xl md:text-2xl font-black text-emerald-700 leading-tight">{fmtAmt(Math.round(stats.avg))}</h3>
          <p className="text-[9px] text-emerald-600 font-bold">{currency}</p>
          <div className="mt-3 flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 size={12}/>
            <span className="text-[9px] font-black uppercase">Registre intègre SHA-256</span>
          </div>
        </div>
      </div>

      {/* ── CHÈQUES EN CIRCUIT ── */}
      {stats.pendingCheques.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-2xl flex items-center justify-center shadow"><FileText size={16} className="text-white"/></div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Chèques en Circuit</p>
                <p className="text-[9px] text-amber-600 font-bold">{stats.pendingCheques.length} chèque(s) — non encore encaissé(s)</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-amber-700">{fmtAmt(stats.totalPendingCheques)}</p>
              <p className="text-[9px] text-amber-500 font-bold uppercase">{currency} en attente</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="bg-amber-100 text-amber-700 font-black uppercase">
                  <th className="px-3 py-2 rounded-l-xl">Date</th>
                  <th className="px-3 py-2">Réf. Vente</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">N° Chèque</th>
                  <th className="px-3 py-2">Banque</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right rounded-r-xl">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {stats.pendingCheques.map((p: any) => (
                  <tr key={p.id} className="font-bold hover:bg-amber-50/60">
                    <td className="px-3 py-2 text-slate-500">{fmtDate(p.createdAt)}</td>
                    <td className="px-3 py-2 text-indigo-600 font-mono">#{p.saleRef}</td>
                    <td className="px-3 py-2 text-slate-800 uppercase truncate max-w-[100px]">{p.customer}</td>
                    <td className="px-3 py-2 text-slate-600">{p.chequeNumber || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.bankName || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                        p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        p.status === 'REGISTERED' ? 'bg-blue-100 text-blue-700' :
                        p.status === 'DEPOSITED' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-amber-700">{fmtAmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-amber-100">
                <tr className="font-black text-[9px]">
                  <td colSpan={6} className="px-3 py-2 text-right text-amber-600 uppercase">Total en attente</td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmtAmt(stats.totalPendingCheques)} {currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <Landmark className="text-indigo-600" size={24}/> Trésorerie Transactionnelle
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95">
            <Download size={14}/> Exporter
          </button>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-widest border transition-all relative ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            <SlidersHorizontal size={14}/> Filtres
            {activeFilterCount > 0 && !showFilters && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[7px] font-black flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))}
            className="bg-white border border-slate-200 rounded-2xl px-3 py-2.5 text-[10px] font-black text-slate-700 outline-none">
            <option value={10}>10</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>Tout</option>
          </select>
          <button onClick={fetchPayments}
            className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      {/* ── PANEL FILTRES ── */}
      {showFilters && (
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm animate-in slide-in-from-top-3 duration-200 space-y-4">
          <YearMonthPicker
            dataYears={availableYears}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Client / Référence</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type="text" value={filters.search} onChange={e => setFilters(f => ({...f, search: e.target.value}))}
                  placeholder="Nom ou réf. vente…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"/>
              </div>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Canal</label>
              <select value={filters.method} onChange={e => setFilters(f => ({...f, method: e.target.value}))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all appearance-none">
                <option value="ALL">Tous</option>
                <option value="CASH">Espèces</option>
                <option value="WAVE">Wave</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="CHEQUE">Chèque</option>
                <option value="TRANSFER">Virement</option>
                <option value="STRIPE">Stripe</option>
              </select>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Statut vente</label>
              <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all appearance-none">
                <option value="ALL">Tous</option>
                <option value="TERMINE">Soldé</option>
                <option value="EN_COURS">En cours</option>
                <option value="ANNULE">Annulé</option>
              </select>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Montant (min / max)</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={filters.minAmount} onChange={e => setFilters(f => ({...f, minAmount: e.target.value}))}
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
                <input type="number" placeholder="Max" value={filters.maxAmount} onChange={e => setFilters(f => ({...f, maxAmount: e.target.value}))}
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
              </div>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Du</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
              </div>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Au</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button onClick={resetFilters}
                className="w-full py-2.5 px-4 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LISTE DES PAIEMENTS ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-28 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={36}/>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chargement de la trésorerie…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Wallet size={24} className="text-slate-300"/>
            </div>
            <p className="text-sm font-black text-slate-400 uppercase">Aucune transaction</p>
            <p className="text-[10px] text-slate-300 font-medium">
              {activeFilterCount > 0 ? 'Modifiez vos filtres pour afficher des résultats.' : 'Aucun paiement enregistré.'}
            </p>
          </div>
        ) : (
          <>
            {/* TABLE — md et plus */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                    <th className="px-5 py-4">Date / Heure</th>
                    <th className="px-4 py-4">Référence</th>
                    <th className="px-4 py-4">Client</th>
                    <th className="px-4 py-4 text-center">Canal</th>
                    <th className="px-4 py-4 text-right">Montant</th>
                    <th className="px-4 py-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayed.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ArrowDownCircle size={14}/>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-700">{fmtDate(p.createdAt)}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{fmtTime(p.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-[11px] font-black text-indigo-600">#{p.saleRef}</p>
                        <p className="text-[8px] text-slate-300 font-bold truncate max-w-[90px]">{p.reference || 'Auto'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[140px]">{p.customer}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{p.operator}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <MethodBadge method={p.method}/>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-black text-emerald-600">+{fmtAmt(p.amount)}</p>
                        <p className="text-[8px] text-slate-400 font-bold">{currency}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={p.saleStatus}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td colSpan={4} className="px-5 py-4 text-right text-[9px] font-black uppercase text-slate-400">
                      Total sur {filteredPayments.length} paiement(s)
                    </td>
                    <td className="px-4 py-4 text-right text-base font-black">
                      {fmtAmt(stats.total)} <span className="text-slate-400 text-[10px]">{currency}</span>
                    </td>
                    <td className="px-4 py-4"/>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* CARDS — mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {displayed.map((p, i) => (
                <div key={i} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <ArrowDownCircle size={16}/>
                      </div>
                      <div>
                        <p className="font-mono text-[11px] font-black text-indigo-600">#{p.saleRef}</p>
                        <p className="text-[9px] text-slate-400">{fmtDate(p.createdAt)} · {fmtTime(p.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-black text-emerald-600">+{fmtAmt(p.amount)}</p>
                      <p className="text-[8px] text-slate-400">{currency}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[160px]">{p.customer}</p>
                    <div className="flex items-center gap-2">
                      <MethodBadge method={p.method}/>
                      <StatusBadge status={p.saleStatus}/>
                    </div>
                  </div>
                </div>
              ))}
              {/* Total mobile */}
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-slate-400">Total ({filteredPayments.length})</span>
                <span className="text-sm font-black">{fmtAmt(stats.total)} {currency}</span>
              </div>
            </div>

            {/* Footer pagination */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <span>{displayed.length} / {filteredPayments.length} résultat(s)</span>
              {pageSize !== -1 && filteredPayments.length > pageSize && (
                <button onClick={() => setPageSize(-1)} className="text-indigo-500 hover:text-indigo-700 transition-all">
                  Voir tout →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── BLOC SYNTHÈSE ── */}
      {!loading && displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Règlement Moyen</p>
            <p className="text-lg font-black text-slate-800">{fmtAmt(Math.round(stats.avg))} {currency}</p>
          </div>
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ratio Digital</p>
            <p className="text-lg font-black text-indigo-600">{stats.total > 0 ? Math.round((stats.digital / stats.total) * 100) : 0}%</p>
          </div>
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Transactions filtrées</p>
            <p className="text-lg font-black text-slate-800">{stats.count}</p>
          </div>
        </div>
      )}

      {/* ── MODAL EXPORT ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-5xl sm:mx-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[96dvh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Download className="text-emerald-400" size={18}/>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Exportation Trésorerie</p>
                  <p className="text-[9px] text-slate-400">{exportPreviewData.length} paiement(s) dans la période</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">

              {/* Panneau gauche — config */}
              <div className="lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col bg-slate-50/40 overflow-y-auto max-h-64 lg:max-h-none">
                <div className="p-5 space-y-5 flex-1">

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Période</label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                        <input type="date" value={exportDates.from} onChange={e => setExportDates(d => ({...d, from: e.target.value}))}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-400 transition-all"/>
                      </div>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                        <input type="date" value={exportDates.to} onChange={e => setExportDates(d => ({...d, to: e.target.value}))}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-400 transition-all"/>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Format</label>
                    <div className="space-y-2">
                      {[
                        { id: 'IMAGE' as const, label: 'Image (PNG / JPG)', icon: FileText },
                        { id: 'EXCEL' as const, label: 'Excel (XLS)',       icon: FileSpreadsheet }
                      ].map(fmt => (
                        <button key={fmt.id} onClick={() => setExportFormat(fmt.id)}
                          className={`w-full p-3 rounded-2xl border-2 flex items-center justify-between transition-all text-left ${exportFormat === fmt.id ? 'border-indigo-600 bg-white shadow-md' : 'border-white bg-white/60 hover:border-slate-200'}`}>
                          <div className="flex items-center gap-2">
                            <fmt.icon size={14} className={exportFormat === fmt.id ? 'text-indigo-600' : 'text-slate-400'}/>
                            <span className={`text-[9px] font-black uppercase ${exportFormat === fmt.id ? 'text-indigo-600' : 'text-slate-500'}`}>{fmt.label}</span>
                          </div>
                          {exportFormat === fmt.id && <CheckCircle2 size={14} className="text-indigo-600"/>}
                        </button>
                      ))}
                      {exportFormat === 'IMAGE' && (
                        <div className="flex gap-2 mt-1">
                          {(['PNG', 'JPG'] as const).map(f => (
                            <button key={f} onClick={() => setImageFormat(f)}
                              className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all ${imageFormat === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[8px] text-indigo-700 font-bold leading-relaxed">
                      <Info size={8} className="inline mr-1"/> Logo et mentions légales de «{settings?.name || 'GeStocPro'}» inclus automatiquement.
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex-shrink-0">
                  <button onClick={handleExport}
                    className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
                    {exportFormat === 'IMAGE' ? <Download size={14}/> : <FileSpreadsheet size={14}/>} Générer le fichier
                  </button>
                </div>
              </div>

              {/* Panneau droit — aperçu */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aperçu ({exportPreviewData.length} lignes)</p>
                  <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase">Temps réel</span>
                </div>
                <div id="export-preview" className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-100/30">
                  <div className="overflow-x-auto">
                    <TreasuryReport payments={exportPreviewData} settings={settings} dateFrom={exportDates.from} dateTo={exportDates.to} currency={currency}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION IMPRESSION ── */}
      <div className="hidden print:block bg-white text-slate-800 p-0 font-sans">
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
          <div>
            {settings?.logoUrl && <img src={settings.logoUrl} className="h-20 w-auto mb-3" alt="Logo"/>}
            <div className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{settings?.name}</div>
            <p className="text-xs font-bold text-slate-400">{settings?.address}</p>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-3 uppercase">Rapport de Trésorerie</h1>
            <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl inline-block">Période : {exportDates.from} → {exportDates.to}</p>
          </div>
        </div>
        <div className="mt-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-black uppercase">
                <th className="p-4">Date</th><th className="p-4">Référence</th><th className="p-4">Client</th><th className="p-4 text-center">Canal</th><th className="p-4 text-right">Montant ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exportPreviewData.map((p, i) => (
                <tr key={i} className="text-sm font-bold">
                  <td className="p-4">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-4 text-indigo-600 font-mono">#{p.saleRef}</td>
                  <td className="p-4 uppercase">{p.customer}</td>
                  <td className="p-4 text-center">{p.method}</td>
                  <td className="p-4 text-right font-black">{fmtAmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black">
              <tr>
                <td colSpan={4} className="p-5 text-right uppercase text-slate-400">Total Période</td>
                <td className="p-5 text-right text-2xl">{fmtAmt(exportPreviewData.reduce((s, p) => s + parseFloat(p.amount), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-16 pt-10 border-t border-slate-100 flex justify-between items-end">
          <div className="text-[9px] font-bold text-slate-300 uppercase italic">
            GeStocPro Cloud Kernel v3.2 • Généré le {new Date().toLocaleString('fr-FR')}
          </div>
          <div className="text-center">
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8 underline underline-offset-8">VISA DIRECTION</p>
            <div className="h-20 w-40 border-2 border-dashed border-slate-200 rounded-2xl"/>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
