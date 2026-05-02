import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck, BarChart3, Globe, CreditCard, AlertTriangle,
  Mail, Send, LifeBuoy, Terminal, RefreshCw, Loader2,
  CheckCircle2, Ban, Check, X, Layers,
  Menu, Bell, Zap, DollarSign, ChevronDown
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';

import SADashboard from './superadmin/SADashboard';
import SAAccounts from './superadmin/SAAccounts';
import SAPayments from './superadmin/SAPayments';
import SAPlans from './superadmin/SAPlans';
import SAAlerts from './superadmin/SAAlerts';
import SAMessages from './superadmin/SAMessages';
import SACommunication from './superadmin/SACommunication';
import SASupport from './superadmin/SASupport';
import SALogs from './superadmin/SALogs';

type Tab = 'DASHBOARD' | 'COMPTES' | 'PAIEMENTS' | 'PLANS' | 'ALERTES' | 'MESSAGES' | 'COMMUNICATION' | 'SUPPORT' | 'LOGS';

const NAV_ITEMS: { id: Tab; label: string; icon: any; description: string }[] = [
  { id: 'DASHBOARD',     label: 'Dashboard',     icon: BarChart3,     description: 'Vue globale SaaS' },
  { id: 'COMPTES',       label: 'Comptes',        icon: Globe,         description: 'Gestion des tenants' },
  { id: 'PAIEMENTS',     label: 'Paiements',      icon: CreditCard,    description: 'Registre & validations' },
  { id: 'PLANS',         label: 'Offres',         icon: Layers,        description: 'Catalogue des plans' },
  { id: 'ALERTES',       label: 'Alertes',        icon: AlertTriangle, description: 'Comptes en retard' },
  { id: 'MESSAGES',      label: 'Messages',       icon: Mail,          description: 'Messages de contact' },
  { id: 'COMMUNICATION', label: 'Communication',  icon: Send,          description: 'Annonces & diffusions' },
  { id: 'SUPPORT',       label: 'Support',        icon: LifeBuoy,      description: 'Tickets clients' },
  { id: 'LOGS',          label: 'Audit Logs',     icon: Terminal,      description: 'Journal d\'activité' },
];

const SuperAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Shared modals
  const [showBillingDetail, setShowBillingDetail] = useState<any>(null);
  const [emailModal, setEmailModal] = useState<{ tenantId: string; tenantName: string; subject?: string; body?: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    title: string; msg: string; icon: any;
    type: 'danger' | 'success' | 'warning'; action: () => Promise<void>;
  } | null>(null);

  /* ─── VALIDATE SUBSCRIPTION MODAL ─── */
  const PERIOD_OPTS = [
    { key: '1M', label: '1 mois',   months: 1  },
    { key: '2M', label: '2 mois',   months: 2  },
    { key: '3M', label: '3 mois',   months: 3  },
    { key: '6M', label: '6 mois',   months: 6  },
    { key: '1Y', label: '12 mois',  months: 12 },
  ];
  const METHODS = ['WAVE','ORANGE_MONEY','MTN_MOMO','CASH','TRANSFER','CHEQUE','STRIPE'];

  const [validateModal, setValidateModal] = useState<{
    tenantId: string; tenantName: string; planId: string;
  } | null>(null);
  const [valPeriod,  setValPeriod]  = useState('1M');
  const [valPlanId,  setValPlanId]  = useState('');
  const [valAmount,  setValAmount]  = useState(0);
  const [valMethod,  setValMethod]  = useState('WAVE');
  const [valCustomAmt, setValCustomAmt] = useState(false);

  const calcAmount = (period: string, planId: string) => {
    const plan   = plans.find((p: any) => p.id === planId);
    const months = PERIOD_OPTS.find(o => o.key === period)?.months || 1;
    return Math.round((plan?.priceMonthly || 0) * months);
  };

  const previewNextBilling = (period: string) => {
    const months = PERIOD_OPTS.find(o => o.key === period)?.months || 1;
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const showToast = useToast();

  /* ─── LIVE PAYMENTS ─── */
  const [livePayments, setLivePayments] = useState<any[]>([]);
  const [liveUnread, setLiveUnread]     = useState(0);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const lastCheckedRef = useRef<string>(new Date().toISOString());

  const METHOD_FR: Record<string, string> = {
    CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave',
    MTN_MOMO: 'MTN MoMo', STRIPE: 'Stripe', TRANSFER: 'Virement', CHEQUE: 'Chèque',
  };

  const relTime = useCallback((iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "à l'instant";
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
    return new Date(iso).toLocaleDateString('fr-FR');
  }, []);

  // Polling every 30 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res: any = await apiClient.get(
          `/admin/payments/recent?since=${encodeURIComponent(lastCheckedRef.current)}`
        );
        if (res?.payments?.length > 0) {
          setLivePayments(prev => [...res.payments, ...prev].slice(0, 30));
          setLiveUnread(n => n + res.payments.length);
        }
        if (res?.checkedAt) lastCheckedRef.current = res.checkedAt;
      } catch (_) {}
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  /* ─── DERIVED ─── */
  const pendingValidations: any[] = Array.isArray(data?.pendingValidations) ? data.pendingValidations : [];
  const overdueTenantsRaw = tenants.filter(t => t.paymentStatus === 'PENDING' || t.paymentStatus === 'REJECTED');
  const upcomingAlerts: any[] = Array.isArray(data?.subscriptionAlerts) ? data.subscriptionAlerts : [];
  const totalAlerts = pendingValidations.length + overdueTenantsRaw.length;

  /* ─── DATA FETCHING ─── */
  const fetchData = async (year?: number, month?: number, day?: number, week?: number, semester?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year)     params.append('year',     year.toString());
      if (month)    params.append('month',    month.toString());
      if (day)      params.append('day',      day.toString());
      if (week)     params.append('week',     week.toString());
      if (semester) params.append('semester', semester.toString());
      const qs = params.toString();
      const [statsRes, tenantsRes, plansRes] = await Promise.all([
        apiClient.get(`/admin/dashboard${qs ? '?' + qs : ''}`),
        apiClient.get('/admin/tenants'),
        apiClient.get('/admin/plans')
      ]);
      setData(statsRes);
      setTenants(tenantsRes || []);
      setPlans(plansRes || []);
    } catch (err: any) {
      showToast(`Erreur de chargement: ${err?.message || err}`, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  /* ─── HELPERS ─── */
  const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  /* ─── ACTIONS ─── */
  const openBillingDetail = async (tenantId: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient.get(`/admin/tenants/${tenantId}/billing`);
      setShowBillingDetail(res);
    } catch { showToast("Erreur lecture registre billing.", 'error'); }
    finally { setActionLoading(false); }
  };

  const handleEmail = (tenantId: string, tenantName: string, subject = '', body = '') => {
    setEmailModal({ tenantId, tenantName });
    setEmailSubject(subject);
    setEmailBody(body);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModal) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post('/admin/email/send', {
        tenantId: emailModal.tenantId, tenantName: emailModal.tenantName,
        subject: emailSubject, body: emailBody
      });
      showToast(res?.message || 'Email envoyé', 'success');
      setEmailModal(null); setEmailSubject(''); setEmailBody('');
    } catch (e: any) { showToast(e?.message || 'Erreur envoi email', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleToggleLock = (tenantId: string, tenantName: string, currentStatus: boolean) => {
    setConfirmAction({
      title: currentStatus ? 'VERROUILLER LE COMPTE' : 'DÉVERROUILLER LE COMPTE',
      msg: currentStatus
        ? `Verrouiller "${tenantName}" ? L'accès sera immédiatement coupé.`
        : `Réactiver l'accès de "${tenantName}" ?`,
      icon: currentStatus ? Ban : CheckCircle2,
      type: currentStatus ? 'danger' : 'success',
      action: async () => {
        setActionLoading(true);
        try {
          await apiClient.post(`/admin/tenants/${tenantId}/toggle-lock`, {});
          showToast(`Compte ${currentStatus ? 'verrouillé' : 'déverrouillé'}`, 'success');
          fetchData(); setConfirmAction(null);
        } catch (e: any) {
          showToast(`Erreur: ${e?.message || e}`, 'error'); setConfirmAction(null);
        } finally { setActionLoading(false); }
      }
    });
  };

  const handleValidateSubscription = (validation: any) => {
    const tenantId   = validation.tenantId || validation.id || validation.tenant?.id || '';
    const tenantName = validation.tenantName || validation.tenant?.name || 'Inconnu';
    const planId     = validation.planId || plans[0]?.id || '';
    const period     = validation.period || '1M';
    const amt        = calcAmount(period, planId);
    setValPeriod(period);
    setValPlanId(planId);
    setValAmount(validation.amount && validation.amount > 0 ? validation.amount : amt);
    setValMethod('WAVE');
    setValCustomAmt(false);
    setValidateModal({ tenantId, tenantName, planId });
  };

  const handleConfirmValidation = async () => {
    if (!validateModal) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/tenants/${validateModal.tenantId}/subscription/validate`, {
        amount:    valAmount,
        method:    valMethod,
        period:    valPeriod,
        reference: `VALID-${Date.now()}`,
      });
      showToast('Paiement validé avec succès', 'success');
      fetchData();
      setValidateModal(null);
    } catch (e: any) {
      showToast(`Échec: ${e?.message || 'Erreur'}`, 'error');
    } finally { setActionLoading(false); }
  };

  const handleRejectUpgrade = (request: any) => {
    setConfirmAction({
      title: 'Rejeter la demande',
      msg: `Rejeter la demande de "${request.tenantName || request.tenant?.name}" ?`,
      icon: Ban, type: 'danger',
      action: async () => {
        setActionLoading(true);
        try {
          const tenantId = request.tenantId || request.tenant?.id || request.id;
          await apiClient.post(`/admin/tenants/${tenantId}/subscription/reject`, {});
          showToast('Demande rejetée', 'success');
          fetchData(); setConfirmAction(null);
        } catch (e: any) {
          showToast(`Erreur: ${e?.message || e}`, 'error'); setConfirmAction(null);
        } finally { setActionLoading(false); }
      }
    });
  };

  /* ─── RENDER CONTENT ─── */
  const renderContent = () => {
    const commonProps = { fmt, fmtDate };
    switch (activeTab) {
      case 'DASHBOARD':
        return <SADashboard data={data} tenants={tenants} plans={plans}
          pendingValidations={pendingValidations} overdueTenantsRaw={overdueTenantsRaw}
          onValidate={handleValidateSubscription} onOpenBilling={openBillingDetail}
          onFetchWithPeriod={fetchData} loading={loading} {...commonProps} />;
      case 'COMPTES':
        return <SAAccounts tenants={tenants} plans={plans} loading={loading}
          onOpenBilling={openBillingDetail} onEmail={handleEmail}
          onToggleLock={handleToggleLock} onValidate={handleValidateSubscription} {...commonProps} />;
      case 'PAIEMENTS':
        return <SAPayments tenants={tenants} plans={plans} pendingValidations={pendingValidations}
          loading={loading} onValidate={handleValidateSubscription} onReject={handleRejectUpgrade}
          onOpenBilling={openBillingDetail} {...commonProps} />;
      case 'PLANS':
        return <SAPlans plans={plans} tenants={tenants} onRefresh={fetchData} fmt={fmt} />;
      case 'ALERTES':
        return <SAAlerts tenants={tenants} pendingValidations={pendingValidations}
          upcomingAlerts={upcomingAlerts} overdueTenantsRaw={overdueTenantsRaw}
          onValidate={handleValidateSubscription} onOpenBilling={openBillingDetail}
          onEmail={handleEmail} {...commonProps} />;
      case 'MESSAGES':
        return <SAMessages />;
      case 'COMMUNICATION':
        return <SACommunication />;
      case 'SUPPORT':
        return <SASupport />;
      case 'LOGS':
        return <SALogs tenants={tenants} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ══ MOBILE BACKDROP ══ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══ DESKTOP SIDEBAR SPACER (keeps flex layout) ══ */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'lg:w-60' : 'lg:w-16'}`} />

      {/* ══ SIDEBAR ══ */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex flex-col
        bg-zinc-900 border-r border-zinc-800/50 transition-all duration-300
        ${sidebarOpen
          ? 'w-72 translate-x-0 lg:w-60'
          : 'w-72 -translate-x-full lg:w-16 lg:translate-x-0'}
      `}>
        {/* Logo area */}
        <div className="p-4 border-b border-zinc-800/50 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:hidden'}`}>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] whitespace-nowrap">Kernel</p>
            <p className="text-xs font-black text-white leading-none whitespace-nowrap">Super Admin</p>
          </div>
          {/* Close button mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badge = item.id === 'ALERTES' ? totalAlerts : item.id === 'PAIEMENTS' ? pendingValidations.length : 0;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(prev => { if (window.innerWidth < 1024) return false; return prev; }); }}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                <span className={`text-xs font-bold truncate transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden lg:hidden'}`}>{item.label}</span>
                {badge > 0 && (
                  <span className={`${sidebarOpen ? 'ml-auto' : 'absolute top-1 right-1'} flex items-center justify-center min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-black rounded-full px-1 animate-pulse`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer — desktop collapse only */}
        <div className="p-3 border-t border-zinc-800/50 hidden lg:block">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
            title={sidebarOpen ? 'Réduire' : 'Agrandir'}
          >
            <Menu size={16} />
            {sidebarOpen && <span className="text-xs font-bold">Réduire</span>}
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-zinc-900/80 backdrop-blur border-b border-zinc-800/50 px-3 sm:px-6 py-3 flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden flex-shrink-0 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-black text-white text-sm truncate">{NAV_ITEMS.find(n => n.id === activeTab)?.label}</h1>
            <p className="text-[10px] text-zinc-500 hidden sm:block">{NAV_ITEMS.find(n => n.id === activeTab)?.description}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Alert badge */}
            {totalAlerts > 0 && (
              <button
                onClick={() => setActiveTab('ALERTES')}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all animate-pulse"
              >
                <Bell size={13} />
                <span className="hidden sm:inline">{totalAlerts} alerte(s)</span>
                <span className="sm:hidden">{totalAlerts}</span>
              </button>
            )}

            {/* Live payments button */}
            <div className="relative">
              <button
                onClick={() => { setShowLivePanel(v => !v); setLiveUnread(0); }}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
                  livePayments.length > 0
                    ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${livePayments.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="hidden sm:inline">Paiements live</span>
                {liveUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-bounce">
                    {liveUnread > 9 ? '9+' : liveUnread}
                  </span>
                )}
                <ChevronDown size={11} className={`transition-transform hidden sm:block ${showLivePanel ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown panel */}
              {showLivePanel && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-none bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-black text-white">Paiements en temps réel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Polling 30 s</span>
                      <button onClick={() => setShowLivePanel(false)}
                        className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {livePayments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <DollarSign size={28} className="text-zinc-700" />
                        <p className="text-xs text-zinc-500">Aucun paiement depuis l'ouverture</p>
                        <p className="text-[10px] text-zinc-600">Actualisation automatique toutes les 30 s</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/60">
                        {livePayments.map((p: any) => (
                          <div key={p.id} className="px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                                  p.type === 'abonnement' ? 'bg-violet-500/20' : 'bg-emerald-500/20'
                                }`}>
                                  <Zap size={11} className={p.type === 'abonnement' ? 'text-violet-400' : 'text-emerald-400'} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">
                                    {p.tenant || '—'}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 truncate">
                                    {p.type === 'abonnement' ? 'Abonnement SaaS' : (p.customer || 'Vente client')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-black text-emerald-400">
                                  {Number(p.amount).toLocaleString('fr-FR')} F
                                </p>
                                <p className="text-[10px] text-zinc-500">{METHOD_FR[p.method] || p.method}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                                p.status === 'COMPLETED' || p.status === 'PAID'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : p.status === 'PENDING'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-zinc-700 text-zinc-400'
                              }`}>{p.status}</span>
                              <span className="text-[10px] text-zinc-600">{relTime(p.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {livePayments.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">{livePayments.length} paiement(s) détecté(s)</span>
                      <button onClick={() => { setLivePayments([]); setLiveUnread(0); }}
                        className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors font-bold">
                        Effacer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white text-xs font-bold transition-all"
              title="Actualiser"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{loading ? 'Chargement...' : 'Actualiser'}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Chargement du kernel...</p>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>

      {/* ══ MODAL: BILLING DETAIL ══ */}
      {showBillingDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-xl sm:h-full bg-zinc-900 sm:border-l border-t sm:border-t-0 border-zinc-700/50 overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300 rounded-t-3xl sm:rounded-none max-h-[92vh] sm:max-h-full">
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur px-6 py-4 border-b border-zinc-700/50 flex items-center justify-between z-10">
              <div>
                <h3 className="font-black text-white">Détails billing</h3>
                <p className="text-xs text-zinc-400">{showBillingDetail?.tenant?.name}</p>
              </div>
              <button onClick={() => setShowBillingDetail(null)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Tenant info */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Informations compte</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Nom</span>
                    <span className="font-bold text-white">{showBillingDetail?.tenant?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Domaine</span>
                    <span className="font-mono text-zinc-300 text-xs">{showBillingDetail?.tenant?.domain || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Plan actuel</span>
                    <span className="font-bold text-indigo-400">{showBillingDetail?.subscription?.planId || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Statut abonnement</span>
                    <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                      showBillingDetail?.subscription?.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' :
                      'bg-amber-500/15 text-amber-400'
                    }`}>{showBillingDetail?.subscription?.status || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Prochain prélèvement</span>
                    <span className="text-zinc-300">{fmtDate(showBillingDetail?.subscription?.nextBillingDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Utilisateurs</span>
                    <span className="text-zinc-300">{showBillingDetail?.userCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Payment history */}
              {Array.isArray(showBillingDetail?.payments) && showBillingDetail.payments.length > 0 && (
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Historique paiements</p>
                  <div className="space-y-2">
                    {showBillingDetail.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-zinc-700/30 last:border-0">
                        <div>
                          <p className="text-xs text-zinc-300">{fmtDate(p.paymentDate || p.createdAt)}</p>
                          <p className="text-[10px] text-zinc-500">{p.method} • {p.reference || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-400">{fmt(p.amount)} F</p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            p.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' :
                            p.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-rose-500/15 text-rose-400'
                          }`}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { handleEmail(showBillingDetail?.tenant?.id, showBillingDetail?.tenant?.name); setShowBillingDetail(null); }}
                  className="flex-1 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Mail size={14} /> Envoyer email
                </button>
                <button
                  onClick={() => { handleValidateSubscription({ tenantId: showBillingDetail?.tenant?.id, tenantName: showBillingDetail?.tenant?.name, planId: showBillingDetail?.subscription?.planId }); setShowBillingDetail(null); }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Check size={14} /> Valider paiement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: EMAIL ══ */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full sm:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-white">Envoyer un email</h3>
                <p className="text-xs text-indigo-400 mt-0.5">→ {emailModal.tenantName}</p>
              </div>
              <button onClick={() => setEmailModal(null)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Sujet</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  required
                  placeholder="Objet de l'email..."
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Message</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  required rows={6}
                  placeholder="Contenu de l'email..."
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEmailModal(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={actionLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: VALIDATE SUBSCRIPTION ══ */}
      {validateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Valider le paiement</h3>
                  <p className="text-[10px] text-emerald-400 mt-0.5">{validateModal.tenantName}</p>
                </div>
              </div>
              <button onClick={() => setValidateModal(null)}
                className="p-1.5 text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Plan */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Plan</label>
                <select
                  value={valPlanId}
                  onChange={e => {
                    setValPlanId(e.target.value);
                    if (!valCustomAmt) setValAmount(calcAmount(valPeriod, e.target.value));
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700/50 text-sm text-white px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — {fmt(p.priceMonthly)} F/mois</option>
                  ))}
                </select>
              </div>

              {/* Période */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Période payée</label>
                <div className="flex gap-2 flex-wrap">
                  {PERIOD_OPTS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setValPeriod(opt.key);
                        if (!valCustomAmt) setValAmount(calcAmount(opt.key, valPlanId));
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        valPeriod === opt.key
                          ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-zinc-800 border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next billing preview */}
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Prochain prélèvement</p>
                  <p className="text-sm font-black text-emerald-300 capitalize">{previewNextBilling(valPeriod)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Montant</p>
                  <p className="text-lg font-black text-white">{fmt(valAmount)} F</p>
                </div>
              </div>

              {/* Montant manuel */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Montant encaissé</label>
                  <button
                    onClick={() => setValCustomAmt(v => !v)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {valCustomAmt ? 'Auto' : 'Modifier'}
                  </button>
                </div>
                <input
                  type="number"
                  value={valAmount}
                  onChange={e => setValAmount(Number(e.target.value))}
                  disabled={!valCustomAmt}
                  className="w-full bg-zinc-800 border border-zinc-700/50 text-sm text-white px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                />
              </div>

              {/* Méthode */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Méthode de paiement</label>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map(m => (
                    <button key={m} onClick={() => setValMethod(m)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                        valMethod === m
                          ? 'bg-indigo-500 border-indigo-400 text-white'
                          : 'bg-zinc-800 border-zinc-700/50 text-zinc-400 hover:text-white'
                      }`}>
                      {METHOD_FR[m] || m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setValidateModal(null)} disabled={actionLoading}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleConfirmValidation} disabled={actionLoading}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Confirmer la validation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CONFIRM ACTION ══ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className={`bg-zinc-900 border rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full sm:max-w-sm text-center shadow-2xl ${
            confirmAction.type === 'danger' ? 'border-rose-500/30' :
            confirmAction.type === 'success' ? 'border-emerald-500/30' :
            'border-amber-500/30'
          }`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              confirmAction.type === 'danger' ? 'bg-rose-500/10' :
              confirmAction.type === 'success' ? 'bg-emerald-500/10' :
              'bg-amber-500/10'
            }`}>
              {React.createElement(confirmAction.icon, {
                size: 28,
                className: confirmAction.type === 'danger' ? 'text-rose-400' :
                  confirmAction.type === 'success' ? 'text-emerald-400' : 'text-amber-400'
              })}
            </div>
            <h3 className="font-black text-white text-sm uppercase tracking-wider mb-3">{confirmAction.title}</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">{confirmAction.msg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmAction.action}
                disabled={actionLoading}
                className={`flex-1 py-3 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  confirmAction.type === 'danger' ? 'bg-rose-500 hover:bg-rose-400' :
                  confirmAction.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-400' :
                  'bg-amber-500 hover:bg-amber-400'
                }`}
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
