import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Landmark, Search, RefreshCw, Mail, MessageCircle, AlertCircle,
  CheckCircle2, TrendingDown, Phone, ChevronDown, ChevronUp,
  AlertTriangle, Users, Clock, X, Loader2, Send, FileText,
  Calendar, DollarSign, Eye, CreditCard, Filter, Download,
  ArrowRight, BadgeCheck, XCircle,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Echeance {
  id: string;
  eleveId: string;
  serviceId: string;
  montant: number;
  dateEcheance: string;
  periodeLabel: string;
  statut: 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD' | 'ANNULE';
  paidAt?: string;
  saleId?: string;
  reminderSentAt?: string;
  eleve?: {
    id: string; nom: string; prenom: string; niveau: string;
    parent1?: { nom?: string; prenom?: string; telephone?: string; whatsapp?: string; email?: string };
    whatsappPrincipal?: string; matricule?: string;
  };
  service?: { id: string; name: string; typeOffre: string };
}

interface EleveGroupe {
  eleveId: string;
  nom: string;
  prenom: string;
  niveau: string;
  matricule: string;
  whatsapp: string;
  email: string;
  echeances: Echeance[];
  totalDu: number;
  totalRetard: number;
}

interface FactureData {
  eleve: any;
  mois: string;
  echeances: Echeance[];
  totalDu: number;
  totalPaye: number;
  solde: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NIVEAUX: Record<string, string> = {
  CRECHE:'Crèche', PS:'Petite Section', MS:'Moyenne Section',
  GS:'Grande Section', CP:'CP', CE1:'CE1', CE2:'CE2', CM1:'CM1', CM2:'CM2',
};

const fmtAmount = (n: number) => Number(n || 0).toLocaleString('fr-FR');
const fmtDate   = (d: string) => new Date(d).toLocaleDateString('fr-FR');
const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function statutBadge(statut: Echeance['statut']) {
  const map = {
    EN_ATTENTE: 'bg-amber-50 text-amber-700 border-amber-200',
    EN_RETARD:  'bg-rose-50  text-rose-700  border-rose-200',
    PAYE:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    ANNULE:     'bg-slate-100  text-slate-500  border-slate-200',
  };
  const lbl = { EN_ATTENTE:'En attente', EN_RETARD:'En retard', PAYE:'Payé', ANNULE:'Annulé' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${map[statut]}`}>
      {lbl[statut]}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const Recovery = ({ currency }: { currency: string }) => {
  const showToast = useToast();

  // État
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatut, setFilterStatut] = useState<'TOUS' | 'EN_ATTENTE' | 'EN_RETARD' | 'PAYE'>('TOUS');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [expandedEleves, setExpandedEleves] = useState<Set<string>>(new Set());
  const [selectedEcheances, setSelectedEcheances] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [showReminderModal, setShowReminderModal] = useState<{ eleve: EleveGroupe; canal: 'EMAIL' | 'WHATSAPP' } | null>(null);
  const [showFactureModal, setShowFactureModal]   = useState<FactureData | null>(null);
  const [showPayModal, setShowPayModal]           = useState<Echeance | null>(null);
  const [methodePaiement, setMethodePaiement]     = useState('CASH');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEcheances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/abonnements/echeances', {
        params: { month: selectedMonth, year: selectedYear },
      });
      setEcheances(Array.isArray(data) ? data : []);
    } catch {
      showToast('Erreur de chargement des échéances.', 'error');
      setEcheances([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchEcheances(); }, [fetchEcheances]);

  // ── Grouper par élève ──────────────────────────────────────────────────────
  const elevesGroupes = useMemo((): EleveGroupe[] => {
    const map = new Map<string, EleveGroupe>();
    for (const ech of echeances) {
      if (!ech.eleve) continue;
      const statutOk = filterStatut === 'TOUS' || ech.statut === filterStatut;
      if (!statutOk) continue;

      const q = search.toLowerCase();
      const nomMatch = q
        ? `${ech.eleve.prenom} ${ech.eleve.nom}`.toLowerCase().includes(q)
        : true;
      if (!nomMatch) continue;

      if (!map.has(ech.eleveId)) {
        const e = ech.eleve;
        map.set(ech.eleveId, {
          eleveId: ech.eleveId,
          nom: e.nom, prenom: e.prenom, niveau: e.niveau,
          matricule: e.matricule || '',
          whatsapp: e.whatsappPrincipal || e.parent1?.whatsapp || e.parent1?.telephone || '',
          email: e.parent1?.email || '',
          echeances: [],
          totalDu: 0, totalRetard: 0,
        });
      }
      const g = map.get(ech.eleveId)!;
      g.echeances.push(ech);
      if (ech.statut !== 'PAYE' && ech.statut !== 'ANNULE') {
        g.totalDu += parseFloat(ech.montant as any);
        if (ech.statut === 'EN_RETARD') g.totalRetard += parseFloat(ech.montant as any);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRetard - a.totalRetard || b.totalDu - a.totalDu);
  }, [echeances, filterStatut, search]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total    = echeances.reduce((s, e) => s + (e.statut !== 'ANNULE' ? parseFloat(e.montant as any) : 0), 0);
    const paye     = echeances.filter(e => e.statut === 'PAYE').reduce((s, e) => s + parseFloat(e.montant as any), 0);
    const retard   = echeances.filter(e => e.statut === 'EN_RETARD').reduce((s, e) => s + parseFloat(e.montant as any), 0);
    const attente  = echeances.filter(e => e.statut === 'EN_ATTENTE').reduce((s, e) => s + parseFloat(e.montant as any), 0);
    const txRecouvrement = total > 0 ? Math.round((paye / total) * 100) : 0;
    return { total, paye, retard, attente, txRecouvrement, nbEleves: elevesGroupes.length };
  }, [echeances, elevesGroupes]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePayEcheance = async () => {
    if (!showPayModal) return;
    setActionLoading(showPayModal.id);
    try {
      await apiClient.put(`/abonnements/echeances/${showPayModal.id}/payer`, { methodePaiement });
      showToast('Paiement enregistré — vente créée automatiquement.', 'success');
      setShowPayModal(null);
      fetchEcheances();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du paiement.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (eleveGroupe: EleveGroupe, canal: 'EMAIL' | 'WHATSAPP', echeanceIds?: string[]) => {
    const ids = echeanceIds ?? eleveGroupe.echeances
      .filter(e => e.statut === 'EN_ATTENTE' || e.statut === 'EN_RETARD')
      .map(e => e.id);
    if (!ids.length) return;
    setActionLoading(`relance-${eleveGroupe.eleveId}`);
    try {
      const res = await apiClient.post('/abonnements/echeances/relancer', { echeanceIds: ids, canal });
      showToast(`${res.sent} relance(s) envoyée(s) via ${canal === 'EMAIL' ? 'email' : 'WhatsApp'}.`, 'success');
      setShowReminderModal(null);
      fetchEcheances();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l\'envoi.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReminder = async (canal: 'EMAIL' | 'WHATSAPP') => {
    const ids = Array.from(selectedEcheances);
    if (!ids.length) return;
    setActionLoading('bulk');
    try {
      const res = await apiClient.post('/abonnements/echeances/relancer', { echeanceIds: ids, canal });
      showToast(`${res.sent} relance(s) envoyée(s).`, 'success');
      setSelectedEcheances(new Set());
    } catch (err: any) {
      showToast(err.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const loadFacture = async (eleveId: string) => {
    setActionLoading(`facture-${eleveId}`);
    try {
      const data = await apiClient.get(`/abonnements/echeances/facture/${eleveId}`, {
        params: { month: selectedMonth, year: selectedYear },
      });
      setShowFactureModal(data);
    } catch (err: any) {
      showToast(err.message || 'Erreur chargement facture.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleEleve = (id: string) => {
    setExpandedEleves(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectEcheance = (id: string) => {
    setSelectedEcheances(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20">

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-4">
            <Landmark className="text-indigo-600" size={32} /> Recouvrement Scolaire
          </h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Suivi des redevances & relances parents
          </p>
        </div>

        {/* Sélecteur mois/année */}
        <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-1">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(+e.target.value)}
            className="bg-transparent px-3 py-2 text-[10px] font-black uppercase outline-none"
          >
            {MOIS_NOMS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(+e.target.value)}
            className="bg-transparent px-3 py-2 text-[10px] font-black uppercase outline-none"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchEcheances} className="p-2 hover:text-indigo-600 text-slate-400 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total attendu', value: `${fmtAmount(kpis.total)} ${currency}`, icon: DollarSign, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Reçu', value: `${fmtAmount(kpis.paye)} ${currency}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'En retard', value: `${fmtAmount(kpis.retard)} ${currency}`, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'En attente', value: `${fmtAmount(kpis.attente)} ${currency}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Taux recouvrement', value: `${kpis.txRecouvrement}%`, icon: TrendingDown, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <k.icon className={k.color} size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 leading-none">{k.value}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barre de filtres + actions bulk ── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" placeholder="Rechercher un élève..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-100" />
        </div>

        {(['TOUS', 'EN_ATTENTE', 'EN_RETARD', 'PAYE'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatut(s)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${filterStatut === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>
            {s === 'TOUS' ? 'Tous' : s === 'EN_ATTENTE' ? 'En attente' : s === 'EN_RETARD' ? 'En retard' : 'Payés'}
          </button>
        ))}

        {selectedEcheances.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[9px] font-black text-slate-500">{selectedEcheances.size} sélectionné(s)</span>
            <button onClick={() => handleBulkReminder('WHATSAPP')} disabled={actionLoading === 'bulk'}
              className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
              <MessageCircle size={12} /> WhatsApp
            </button>
            <button onClick={() => handleBulkReminder('EMAIL')} disabled={actionLoading === 'bulk'}
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
              <Mail size={12} /> Email
            </button>
          </div>
        )}
      </div>

      {/* ── Liste des élèves groupés ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4 text-slate-400">
          <RefreshCw size={28} className="animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest">Chargement des redevances…</p>
        </div>
      ) : elevesGroupes.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
          <CheckCircle2 size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucune redevance pour cette période</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elevesGroupes.map(g => {
            const expanded = expandedEleves.has(g.eleveId);
            const hasRetard = g.totalRetard > 0;
            return (
              <div key={g.eleveId}
                className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all ${hasRetard ? 'border-rose-100' : 'border-slate-100'}`}>

                {/* ── Header élève ── */}
                <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50/50 transition-all"
                  onClick={() => toggleEleve(g.eleveId)}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${hasRetard ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
                    {g.prenom.charAt(0)}{g.nom.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm">{g.prenom} {g.nom}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {NIVEAUX[g.niveau] || g.niveau} · {g.matricule} · {g.echeances.length} redevance(s)
                    </p>
                  </div>

                  {/* Montants */}
                  <div className="hidden sm:flex items-center gap-6 mr-4">
                    {g.totalRetard > 0 && (
                      <div className="text-right">
                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Retard</p>
                        <p className="text-sm font-black text-rose-600">{fmtAmount(g.totalRetard)} {currency}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total dû</p>
                      <p className="text-sm font-black text-slate-900">{fmtAmount(g.totalDu)} {currency}</p>
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button title="Relance WhatsApp"
                      onClick={() => setShowReminderModal({ eleve: g, canal: 'WHATSAPP' })}
                      disabled={!g.whatsapp || actionLoading === `relance-${g.eleveId}`}
                      className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-40">
                      <MessageCircle size={14} />
                    </button>
                    <button title="Relance Email"
                      onClick={() => setShowReminderModal({ eleve: g, canal: 'EMAIL' })}
                      disabled={!g.email || actionLoading === `relance-${g.eleveId}`}
                      className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-40">
                      <Mail size={14} />
                    </button>
                    <button title="Voir facture mensuelle"
                      onClick={() => loadFacture(g.eleveId)}
                      disabled={actionLoading === `facture-${g.eleveId}`}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
                      {actionLoading === `facture-${g.eleveId}` ? <Loader2 size={13} className="animate-spin" /> : <FileText size={14} />}
                    </button>
                    <button onClick={() => toggleEleve(g.eleveId)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* ── Détail des échéances ── */}
                {expanded && (
                  <div className="border-t border-slate-50 divide-y divide-slate-50">
                    {g.echeances.map(ech => (
                      <div key={ech.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/30 transition-all">
                        <input type="checkbox"
                          checked={selectedEcheances.has(ech.id)}
                          onChange={() => toggleSelectEcheance(ech.id)}
                          className="w-4 h-4 rounded accent-indigo-600"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-700">{ech.service?.name || '—'} — {ech.periodeLabel}</p>
                          <p className="text-[9px] text-slate-400 font-bold">Échéance : {fmtDate(ech.dateEcheance)}
                            {ech.reminderSentAt && <span className="ml-2 text-indigo-400">· relancé {fmtDate(ech.reminderSentAt)}</span>}
                          </p>
                        </div>
                        <p className="text-sm font-black text-slate-900 w-28 text-right">{fmtAmount(parseFloat(ech.montant as any))} {currency}</p>
                        {statutBadge(ech.statut)}
                        {(ech.statut === 'EN_ATTENTE' || ech.statut === 'EN_RETARD') && (
                          <button onClick={() => setShowPayModal(ech)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-1">
                            <CreditCard size={10} /> Encaisser
                          </button>
                        )}
                        {ech.statut === 'PAYE' && ech.saleId && (
                          <span className="text-[8px] font-black text-emerald-500 flex items-center gap-1">
                            <BadgeCheck size={10} /> Vente #{ech.saleId.slice(-6)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL PAIEMENT ═══════════════════════════════════════════════════ */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl p-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-1">Enregistrer le paiement</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">
              {showPayModal.eleve?.prenom} {showPayModal.eleve?.nom} — {showPayModal.service?.name}
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6 flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-600 uppercase">{showPayModal.periodeLabel}</span>
              <span className="text-2xl font-black text-indigo-900">{fmtAmount(parseFloat(showPayModal.montant as any))} {currency}</span>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mode de paiement</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'CASH', l: 'Espèces' },
                  { v: 'WAVE', l: 'Wave' },
                  { v: 'ORANGE_MONEY', l: 'Orange Money' },
                  { v: 'CHEQUE', l: 'Chèque' },
                  { v: 'TRANSFER', l: 'Virement' },
                  { v: 'MTN_MOMO', l: 'MTN MoMo' },
                ].map(m => (
                  <button key={m.v} onClick={() => setMethodePaiement(m.v)}
                    className={`py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${methodePaiement === m.v ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-200'}`}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 mb-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Une vente sera automatiquement créée dans le module Ventes.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPayModal(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={handlePayEcheance} disabled={!!actionLoading}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-xl transition-all flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL RELANCE ════════════════════════════════════════════════════ */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl p-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                {showReminderModal.canal === 'WHATSAPP'
                  ? <><MessageCircle className="text-emerald-500" size={22} /> Relance WhatsApp</>
                  : <><Mail className="text-indigo-500" size={22} /> Relance Email</>}
              </h3>
              <button onClick={() => setShowReminderModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destinataire</p>
              <p className="font-black text-slate-900">{showReminderModal.eleve.prenom} {showReminderModal.eleve.nom}</p>
              <p className="text-xs text-slate-500">
                {showReminderModal.canal === 'WHATSAPP'
                  ? showReminderModal.eleve.whatsapp || '— numéro manquant'
                  : showReminderModal.eleve.email || '— email manquant'}
              </p>
            </div>

            {/* Aperçu des échéances à relancer */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-5">
              {showReminderModal.eleve.echeances
                .filter(e => e.statut === 'EN_ATTENTE' || e.statut === 'EN_RETARD')
                .map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-black text-slate-700">{e.service?.name} — {e.periodeLabel}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{fmtDate(e.dateEcheance)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{fmtAmount(parseFloat(e.montant as any))} {currency}</span>
                      {statutBadge(e.statut)}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowReminderModal(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button
                onClick={() => handleSendReminder(showReminderModal.eleve, showReminderModal.canal)}
                disabled={!!actionLoading}
                className={`flex-1 py-4 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl transition-all flex items-center justify-center gap-2 ${showReminderModal.canal === 'WHATSAPP' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Envoyer la relance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL FACTURE MENSUELLE ═══════════════════════════════════════════ */}
      {showFactureModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

            {/* En-tête facture */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-8 flex justify-between items-start">
              <div>
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Le Toit des Anges — Relevé Mensuel</p>
                <h3 className="text-2xl font-black uppercase tracking-tighter">
                  {showFactureModal.eleve.prenom} {showFactureModal.eleve.nom}
                </h3>
                <p className="text-indigo-200 text-xs font-bold mt-1">
                  {NIVEAUX[showFactureModal.eleve.niveau] || showFactureModal.eleve.niveau} · {showFactureModal.mois}
                </p>
              </div>
              <button onClick={() => setShowFactureModal(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={18} /></button>
            </div>

            <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto">

              {/* Détail des redevances */}
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Redevances du mois</p>
                <div className="space-y-2">
                  {showFactureModal.echeances.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3">
                      <div>
                        <p className="text-xs font-black text-slate-800">{(e as any).service?.name || '—'}</p>
                        <p className="text-[9px] text-slate-400 font-bold">{e.periodeLabel} · échéance {fmtDate(e.dateEcheance)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-900">{fmtAmount(parseFloat(e.montant as any))} {currency}</span>
                        {statutBadge(e.statut)}
                      </div>
                    </div>
                  ))}
                  {showFactureModal.echeances.length === 0 && (
                    <p className="text-center text-slate-400 text-xs font-bold py-4">Aucune redevance ce mois</p>
                  )}
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Total attendu</span>
                  <span>{fmtAmount(showFactureModal.totalDu)} {currency}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-400">Total reçu</span>
                  <span className="text-emerald-400">{fmtAmount(showFactureModal.totalPaye)} {currency}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="font-black uppercase tracking-widest text-[10px]">Solde restant</span>
                  <span className={`text-xl font-black ${showFactureModal.solde > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmtAmount(showFactureModal.solde)} {currency}
                  </span>
                </div>
              </div>

              {/* Contact parent */}
              {(showFactureModal.eleve.parent1?.telephone || showFactureModal.eleve.whatsappPrincipal) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
                  <Phone size={16} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Contact parent</p>
                    <p className="text-sm font-black text-indigo-900">
                      {showFactureModal.eleve.parent1?.prenom} {showFactureModal.eleve.parent1?.nom} —{' '}
                      {showFactureModal.eleve.whatsappPrincipal || showFactureModal.eleve.parent1?.telephone}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 pb-8 flex gap-3">
              <button
                onClick={() => {
                  const eleve = elevesGroupes.find(g => g.eleveId === showFactureModal.eleve.id);
                  if (eleve) handleSendReminder(eleve, 'WHATSAPP');
                }}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all">
                <MessageCircle size={14} /> Envoyer WhatsApp
              </button>
              <button
                onClick={() => {
                  const eleve = elevesGroupes.find(g => g.eleveId === showFactureModal.eleve.id);
                  if (eleve) handleSendReminder(eleve, 'EMAIL');
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
                <Mail size={14} /> Envoyer Email
              </button>
              <button onClick={() => setShowFactureModal(null)}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Recovery;
