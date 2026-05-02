import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark, Search, RefreshCw, Mail, MessageCircle,
  AlertCircle, DollarSign, Send, X, Loader2,
  CheckCircle2, Info, TrendingDown, Phone,
  ChevronDown, ChevronUp, AlertTriangle, Zap,
  Users, ArrowUpDown
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import YearMonthPicker from './YearMonthPicker';

// ─── Utilitaires ────────────────────────────────────────────────────────────
const fmtAmount = (n: number) => Number(n || 0).toLocaleString('fr-FR');

const riskLevel = (amount: number, max: number) => {
  const pct = max > 0 ? amount / max : 0;
  if (pct >= 0.7) return { label: 'Critique', color: 'text-rose-600', bg: 'bg-rose-100', bar: 'bg-rose-500', border: 'border-rose-200' };
  if (pct >= 0.35) return { label: 'Élevé', color: 'text-amber-600', bg: 'bg-amber-100', bar: 'bg-amber-500', border: 'border-amber-200' };
  return { label: 'Modéré', color: 'text-sky-600', bg: 'bg-sky-100', bar: 'bg-sky-500', border: 'border-sky-200' };
};

// ─── Composant principal ─────────────────────────────────────────────────────
const Recovery = ({ currency }: { currency: string }) => {
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'amount' | 'name'>('amount');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [showEmailModal, setShowEmailModal] = useState<any | null>(null);
  const [emailContent, setEmailContent] = useState({ subject: '', body: '' });
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [selectedDebtors, setSelectedDebtors] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number | 'ALL'>(25);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const showToast = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/sales');
      setRawSales(data);
    } catch {
      showToast('Erreur lors du chargement des créances.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Années disponibles ───────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years: number[] = rawSales
      .map((s: any) => new Date(s.createdAt || s.created_at).getFullYear())
      .filter((y: number) => !isNaN(y));
    return Array.from(new Set(years)).sort((a: number, b: number) => b - a);
  }, [rawSales]);

  // ── Débiteurs filtrés par année/mois ─────────────────────────────────────
  const debtors = useMemo(() => {
    let sales = rawSales;
    if (selectedYear !== null) {
      const ms = selectedMonth !== null ? selectedMonth : 0;
      const me = selectedMonth !== null ? selectedMonth : 11;
      const from = new Date(selectedYear, ms, 1);
      const to = new Date(selectedYear, me + 1, 0, 23, 59, 59);
      sales = rawSales.filter(s => {
        const d = new Date(s.createdAt || s.created_at);
        return d >= from && d <= to;
      });
    }
    const debtMap: Record<string, any> = {};
    sales.forEach((sale: any) => {
      if (sale.status === 'EN_COURS' || sale.status === 'TERMINE') {
        const ttc = parseFloat(sale.totalTtc || sale.total_ttc || 0);
        const paid = parseFloat(sale.amountPaid || sale.amount_paid || 0);
        const due = Math.max(0, ttc - paid);
        const customer = sale.customer;
        const customerId = sale.customerId || sale.customer_id;
        if (due > 0 && customer && customerId) {
          if (!debtMap[customerId]) {
            debtMap[customerId] = {
              id: customerId,
              companyName: customer.companyName || customer.name || '—',
              email: customer.email || '',
              phone: customer.phone || '',
              outstandingBalance: 0,
              salesCount: 0
            };
          }
          debtMap[customerId].outstandingBalance += due;
          debtMap[customerId].salesCount += 1;
        }
      }
    });
    return Object.values(debtMap);
  }, [rawSales, selectedYear, selectedMonth]);

  useEffect(() => { fetchDebtors(); }, []);

  const CHEQUE_PENDING_STATUSES = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];

  // ── Chèques en attente par client ────────────────────────────────────────
  const pendingChequesByCustomer = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    rawSales.forEach((sale: any) => {
      if (sale.status === 'ANNULE') return;
      const customer = sale.customer;
      const customerId = sale.customerId || sale.customer_id;
      if (!customer || !customerId) return;
      (sale.payments || []).forEach((p: any) => {
        if (p.method === 'CHEQUE' && CHEQUE_PENDING_STATUSES.includes(p.status)) {
          if (!map[customerId]) {
            map[customerId] = {
              name: customer.companyName || customer.name || '—',
              amount: 0,
              count: 0
            };
          }
          map[customerId].amount += parseFloat(p.amount || 0);
          map[customerId].count += 1;
        }
      });
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount);
  }, [rawSales]);

  const totalPendingCheques = useMemo(() =>
    pendingChequesByCustomer.reduce((s, c) => s + c.amount, 0),
    [pendingChequesByCustomer]
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = debtors.reduce((s, d) => s + (d.outstandingBalance || 0), 0);
    const withEmail = debtors.filter(d => d.email).length;
    const max = debtors.reduce((m, d) => Math.max(m, d.outstandingBalance), 0);
    return { total, count: debtors.length, average: debtors.length > 0 ? total / debtors.length : 0, withEmail, max };
  }, [debtors]);

  // ── Filtrage + tri ───────────────────────────────────────────────────────
  const processed = useMemo(() => {
    let list = debtors.filter(d =>
      (d.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.phone || '').includes(search)
    );
    list.sort((a, b) => {
      if (sortKey === 'amount') return sortDir === 'desc' ? b.outstandingBalance - a.outstandingBalance : a.outstandingBalance - b.outstandingBalance;
      return sortDir === 'desc'
        ? (b.companyName || '').localeCompare(a.companyName || '')
        : (a.companyName || '').localeCompare(b.companyName || '');
    });
    return list;
  }, [debtors, search, sortKey, sortDir]);

  const displayed = useMemo(() =>
    perPage === 'ALL' ? processed : processed.slice(0, perPage as number),
    [processed, perPage]
  );

  const toggleSort = (key: 'amount' | 'name') => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Sélection ────────────────────────────────────────────────────────────
  const withEmail = debtors.filter(d => d.email);
  const allEmailSelected = withEmail.length > 0 && withEmail.every(d => selectedDebtors.includes(d.id));
  const toggleSelectAll = () => setSelectedDebtors(allEmailSelected ? [] : withEmail.map(d => d.id));
  const toggleSelect = (id: string) =>
    setSelectedDebtors(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleWhatsApp = (d: any) => {
    if (!d.phone) { showToast('Numéro de téléphone manquant.', 'error'); return; }
    const msg = `Bonjour ${d.companyName}, nous vous contactons concernant votre solde de ${fmtAmount(d.outstandingBalance)} ${currency}. Merci de régulariser votre situation dans les meilleurs délais.`;
    window.open(`https://wa.me/${d.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openEmail = (d: any) => {
    setEmailContent({
      subject: `Relance de paiement — ${d.companyName}`,
      body: `Bonjour ${d.companyName},\n\nSauf erreur de notre part, votre compte présente un solde débiteur de ${fmtAmount(d.outstandingBalance)} ${currency}.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les plus brefs délais.\n\nCordialement,\nL'équipe administrative.`
    });
    setShowEmailModal(d);
  };

  const sendViaGmail = () => {
    if (!showEmailModal) return;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(showEmailModal.email)}&su=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
    window.open(url, '_blank');
    setShowEmailModal(null);
  };

  const sendBulkViaGmail = () => {
    const targets = debtors.filter(d => selectedDebtors.includes(d.id) && d.email);
    if (!targets.length) { showToast('Aucun destinataire sélectionné.', 'error'); return; }
    targets.forEach(t => {
      const body = `Bonjour ${t.companyName},\n\nSauf erreur de notre part, votre compte présente un solde débiteur de ${fmtAmount(t.outstandingBalance)} ${currency}.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les plus brefs délais.\n\nCordialement,\nL'équipe administrative.`;
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.email)}&su=${encodeURIComponent(`Relance de paiement — ${t.companyName}`)}&body=${encodeURIComponent(body)}`, '_blank');
    });
    setShowRemindersModal(false);
    setSelectedDebtors([]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">

      {/* ── BARRE DE SÉLECTION FLOTTANTE ── */}
      {selectedDebtors.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{selectedDebtors.length} sélectionné(s)</span>
          <div className="w-px h-4 bg-white/20"/>
          <button onClick={sendBulkViaGmail} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase transition-all">
            <Send size={12}/> Envoyer rappels
          </button>
          <button onClick={() => setSelectedDebtors([])} className="p-1.5 hover:bg-white/10 rounded-xl transition-all">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Total créances */}
        <div className="sm:col-span-1 bg-gradient-to-br from-rose-600 to-rose-700 p-5 md:p-7 rounded-3xl text-white shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform"><Landmark size={80}/></div>
          <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest mb-1">Encours Global</p>
          <h3 className="text-2xl md:text-3xl font-black leading-tight">{fmtAmount(stats.total)}</h3>
          <p className="text-[10px] font-bold text-rose-200 mt-1">{currency}</p>
          <div className="mt-4 flex items-center gap-2">
            <AlertTriangle size={12} className="text-rose-200"/>
            <span className="text-[9px] font-black text-rose-200 uppercase">{stats.count} client(s) débiteur(s)</span>
          </div>
        </div>

        {/* Moyenne / client */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingDown size={80}/></div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dette Moyenne / Client</p>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{fmtAmount(Math.round(stats.average))}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{currency}</p>
          <div className="mt-4 flex items-center gap-2">
            <Users size={12} className="text-slate-400"/>
            <span className="text-[9px] font-black text-slate-400 uppercase">{stats.withEmail} avec email</span>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Actions Rapides</p>
            <p className="text-xs font-bold text-slate-500">Relancer tous vos débiteurs</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowRemindersModal(true)}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <Send size={12}/> Envoyer Rappels Email
            </button>
            <button
              onClick={fetchDebtors}
              className="w-full py-2.5 px-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2 border border-slate-200"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/> Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* ── CHÈQUES EN ATTENTE PAR CLIENT ── */}
      {pendingChequesByCustomer.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-2xl flex items-center justify-center shadow">
                <AlertTriangle size={16} className="text-white"/>
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Chèques en Attente d'Encaissement</p>
                <p className="text-[9px] text-amber-600 font-bold">{pendingChequesByCustomer.length} client(s) — non encore encaissé(s)</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-amber-700">{fmtAmount(totalPendingCheques)}</p>
              <p className="text-[9px] text-amber-500 font-bold uppercase">{currency} en transit</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingChequesByCustomer.map(c => (
              <div key={c.id} className="bg-white border border-amber-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase">{c.name}</p>
                  <p className="text-[9px] text-amber-600 font-bold mt-0.5">{c.count} chèque(s) en circuit</p>
                </div>
                <p className="text-sm font-black text-amber-700">{fmtAmount(c.amount)} <span className="text-[9px] font-bold">{currency}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FILTRE ANNÉE/MOIS ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <YearMonthPicker
          dataYears={availableYears}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />
      </div>

      {/* ── TABLEAU PRINCIPAL ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
            <input
              type="text"
              placeholder="Rechercher par nom, email ou téléphone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => toggleSort('amount')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${sortKey === 'amount' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-200'}`}
            >
              <DollarSign size={11}/> Montant
              {sortKey === 'amount' && (sortDir === 'desc' ? <ChevronDown size={10}/> : <ChevronUp size={10}/>)}
            </button>
            <button
              onClick={() => toggleSort('name')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${sortKey === 'name' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-200'}`}
            >
              <ArrowUpDown size={11}/> Nom
              {sortKey === 'name' && (sortDir === 'desc' ? <ChevronDown size={10}/> : <ChevronUp size={10}/>)}
            </button>
            <select
              value={perPage}
              onChange={e => setPerPage(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black outline-none text-slate-600"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={'ALL'}>Tous</option>
            </select>
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="py-28 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-rose-500" size={36}/>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analyse des créances en cours…</p>
          </div>
        ) : processed.length === 0 ? (
          <div className="py-28 flex flex-col items-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500"/>
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 uppercase">Aucune créance détectée</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {search ? 'Aucun résultat pour cette recherche.' : 'Tous les comptes clients sont à jour.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* TABLE — desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                    <th className="px-5 py-4 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-indigo-600 rounded"
                        checked={allEmailSelected}
                        onChange={toggleSelectAll}
                        title="Sélectionner tous avec email"
                      />
                    </th>
                    <th className="px-4 py-4">Débiteur</th>
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Risque</th>
                    <th className="px-4 py-4 text-right">Encours</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayed.map((d: any) => {
                    const risk = riskLevel(d.outstandingBalance, stats.max);
                    const pct = stats.max > 0 ? (d.outstandingBalance / stats.max) * 100 : 0;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-5 py-4">
                          {d.email && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-indigo-600 rounded"
                              checked={selectedDebtors.includes(d.id)}
                              onChange={() => toggleSelect(d.id)}
                            />
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-sm flex-shrink-0 uppercase">
                              {(d.companyName || '?').charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase leading-tight">{d.companyName}</p>
                              <p className="text-[9px] text-slate-400 font-semibold">{d.salesCount} vente(s) concernée(s)</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            {d.email && <p className="text-[10px] font-semibold text-slate-600 flex items-center gap-1"><Mail size={10} className="text-slate-400"/>{d.email}</p>}
                            {d.phone && <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1"><Phone size={10} className="text-slate-400"/>{d.phone}</p>}
                            {!d.email && !d.phone && <p className="text-[9px] text-slate-300 italic">Aucun contact</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1.5">
                            <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-lg ${risk.bg} ${risk.color}`}>
                              <Zap size={8}/> {risk.label}
                            </span>
                            <div className="w-24 bg-slate-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${risk.bar}`} style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div>
                            <p className="text-base font-black text-rose-600">{fmtAmount(d.outstandingBalance)}</p>
                            <p className="text-[9px] font-bold text-slate-400">{currency}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleWhatsApp(d)}
                              title="WhatsApp"
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm"
                            >
                              <MessageCircle size={15}/>
                            </button>
                            {d.email && (
                              <button
                                onClick={() => openEmail(d)}
                                title="Email"
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                              >
                                <Mail size={15}/>
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

            {/* CARDS — mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {displayed.map((d: any) => {
                const risk = riskLevel(d.outstandingBalance, stats.max);
                const pct = stats.max > 0 ? (d.outstandingBalance / stats.max) * 100 : 0;
                return (
                  <div key={d.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {d.email && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-indigo-600 rounded mt-0.5"
                            checked={selectedDebtors.includes(d.id)}
                            onChange={() => toggleSelect(d.id)}
                          />
                        )}
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-sm uppercase flex-shrink-0">
                          {(d.companyName || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase leading-tight">{d.companyName}</p>
                          <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-lg mt-0.5 ${risk.bg} ${risk.color}`}>
                            <Zap size={8}/> {risk.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-black text-rose-600">{fmtAmount(d.outstandingBalance)}</p>
                        <p className="text-[9px] text-slate-400">{currency}</p>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${risk.bar}`} style={{ width: `${pct}%` }}/>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-medium space-y-0.5">
                        {d.email && <p className="flex items-center gap-1"><Mail size={9}/> {d.email}</p>}
                        {d.phone && <p className="flex items-center gap-1"><Phone size={9}/> {d.phone}</p>}
                        {!d.email && !d.phone && <p className="italic">Aucun contact</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleWhatsApp(d)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          <MessageCircle size={15}/>
                        </button>
                        {d.email && (
                          <button
                            onClick={() => openEmail(d)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            <Mail size={15}/>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <span>{displayed.length} / {processed.length} résultat(s)</span>
              {perPage !== 'ALL' && processed.length > (perPage as number) && (
                <button onClick={() => setPerPage('ALL')} className="text-indigo-500 hover:text-indigo-700 transition-all">
                  Voir tout →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── NOTE D'INFO ── */}
      <div className="p-4 md:p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-start gap-4">
        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
          <Info size={16}/>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase text-indigo-900 mb-1">Calcul des créances</h4>
          <p className="text-[10px] text-indigo-700 font-medium leading-relaxed">
            Les encours sont calculés dynamiquement en comparant le montant TTC des ventes avec les acomptes encaissés. Les ventes annulées sont exclues. Le niveau de risque est relatif au créancier ayant la dette la plus élevée.
          </p>
        </div>
      </div>

      {/* ── MODAL EMAIL INDIVIDUEL ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-xl sm:mx-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[95dvh] flex flex-col">

            <div className="px-5 py-4 bg-indigo-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Mail size={18}/>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">Relance par Email</p>
                  <p className="text-[9px] text-indigo-200">{showEmailModal.companyName}</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={18}/>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm uppercase">
                  {showEmailModal.companyName.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-800">{showEmailModal.companyName}</p>
                  <p className="text-[9px] text-slate-400">{showEmailModal.email}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm font-black text-rose-600">{fmtAmount(showEmailModal.outstandingBalance)}</p>
                  <p className="text-[9px] text-slate-400">{currency}</p>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Objet</label>
                <input
                  value={emailContent.subject}
                  onChange={e => setEmailContent(p => ({ ...p, subject: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Message</label>
                <textarea
                  rows={7}
                  value={emailContent.body}
                  onChange={e => setEmailContent(p => ({ ...p, body: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowEmailModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={sendViaGmail} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md">
                <Send size={13}/> Ouvrir Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RAPPELS GROUPÉS ── */}
      {showRemindersModal && (
        <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-2xl sm:mx-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[95dvh] flex flex-col">

            <div className="px-5 py-4 bg-indigo-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Send size={18}/>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">Rappels Groupés</p>
                  <p className="text-[9px] text-indigo-200">{withEmail.length} client(s) avec email disponible</p>
                </div>
              </div>
              <button onClick={() => { setShowRemindersModal(false); setSelectedDebtors([]); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={18}/>
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-shrink-0 bg-slate-50/50">
              <input
                id="sel-all"
                type="checkbox"
                className="w-4 h-4 accent-indigo-600 rounded"
                checked={allEmailSelected}
                onChange={toggleSelectAll}
              />
              <label htmlFor="sel-all" className="text-[10px] font-black text-slate-600 uppercase cursor-pointer">
                {allEmailSelected ? 'Tout désélectionner' : `Tout sélectionner (${withEmail.length})`}
              </label>
              {selectedDebtors.length > 0 && (
                <span className="ml-auto text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                  {selectedDebtors.length} sélectionné(s)
                </span>
              )}
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {withEmail.length === 0 ? (
                <div className="py-16 text-center">
                  <AlertCircle size={24} className="text-slate-300 mx-auto mb-2"/>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Aucun débiteur avec email</p>
                </div>
              ) : withEmail.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-all">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-indigo-600 rounded flex-shrink-0"
                    checked={selectedDebtors.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                  />
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-xs uppercase flex-shrink-0">
                    {(d.companyName || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-800 truncate">{d.companyName}</p>
                    <p className="text-[9px] text-slate-400 truncate">{d.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-black text-rose-600">{fmtAmount(d.outstandingBalance)}</p>
                    <p className="text-[8px] text-slate-400">{currency}</p>
                  </div>
                  <button
                    onClick={() => { openEmail(d); setShowRemindersModal(false); }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-500 transition-all flex-shrink-0"
                    title="Prévisualiser"
                  >
                    <Mail size={13}/>
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button onClick={() => { setShowRemindersModal(false); setSelectedDebtors([]); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button
                onClick={sendBulkViaGmail}
                disabled={selectedDebtors.length === 0}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Send size={13}/> Envoyer ({selectedDebtors.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recovery;
