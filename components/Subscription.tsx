
import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Check, ShieldCheck, Zap, Download, Calendar,
  Receipt, Info, Lock, ArrowUpRight, Loader2, X, AlertTriangle,
  History, TrendingUp, ShieldAlert, Sparkles, Star, ChevronRight,
  FileText, CheckCircle2, Clock, RefreshCw, Smartphone, QrCode,
  Camera, CheckCircle, ArrowRight, BadgeCheck, ToggleLeft, ToggleRight,
  FileDown, Printer, Percent
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../constants';
import { User, UserRole, SubscriptionPlan } from '../types';
import { apiClient } from '../services/api';
import DocumentPreview from './DocumentPreview';
import { useToast } from './ToastProvider';
import waveQr from '../assets/qr_code_marchant_wave.png';
import waveLogo from '../assets/wave_logo.png';

// ─── Grille tarifaire avec remises ─────────────────────────────────────────
type BillingPeriod = '1M' | '3M' | '1Y';

interface PeriodOption {
  id: BillingPeriod;
  label: string;
  months: number;
  discountPct: number; // % de réduction vs mensuel
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: '1M', label: '1 Mois',  months: 1,  discountPct: 0  },
  { id: '3M', label: '3 Mois',  months: 3,  discountPct: 15 },
  { id: '1Y', label: '1 An',    months: 12, discountPct: 30 },
];

function getPeriodPrice(plan: SubscriptionPlan, period: BillingPeriod): number {
  if (period === '3M' && plan.priceThreeMonths != null) return plan.priceThreeMonths;
  if (period === '1Y' && plan.priceYearly != null) return plan.priceYearly;
  // fallback: calcul avec remise si prix DB absent
  const base = plan.priceMonthly ?? plan.price ?? 0;
  const opt = PERIOD_OPTIONS.find(p => p.id === period)!;
  return Math.round(base * opt.months * (1 - opt.discountPct / 100));
}

function getSavings(plan: SubscriptionPlan, period: BillingPeriod): number {
  const base = plan.priceMonthly ?? plan.price ?? 0;
  const opt = PERIOD_OPTIONS.find(p => p.id === period)!;
  return Math.round(base * opt.months) - getPeriodPrice(plan, period);
}

interface SubscriptionProps {
  user: User;
  currency: string;
  onUpgrade?: (plan: SubscriptionPlan) => void;
  onLogout?: () => void;
}

const Subscription: React.FC<SubscriptionProps> = ({ user, currency, onUpgrade, onLogout }) => {
  const showToast = useToast();
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upgradeConfirmed, setUpgradeConfirmed] = useState<{ planId: string; planName: string } | null>(null);
  
  // Durée de facturation sélectionnée
  const [selectedDuration, setSelectedDuration] = useState<BillingPeriod>('1M');

  // États de transaction
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'MOBILE' | null>(null);
  const [operator, setOperator] = useState<'WAVE' | 'ORANGE' | null>('WAVE');
  const [txReference, setTxReference] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPayCurrentModal, setShowPayCurrentModal] = useState(false);

  // État pour l'aperçu de facture d'abonnement
  const [showDocGenerator, setShowDocGenerator] = useState<{ sale: any, mode: 'SUBSCRIPTION_INVOICE' } | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);

  const isAdmin = user.roles?.includes(UserRole.ADMIN) || user.role === UserRole.ADMIN;

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [subInfo, plans] = await Promise.all([
        apiClient.get('/billing/my-subscription'),
        apiClient.get('/billing/plans')
      ]);
      setSubscriptionData(subInfo);
      setAvailablePlans(plans);

      // Détecter si l'admin vient de valider notre paiement en attente
      const pendingFlag = sessionStorage.getItem('gsp_upgrade_pending');
      if (pendingFlag && subInfo?.subscription?.status === 'ACTIVE') {
        try {
          const pending = JSON.parse(pendingFlag);
          setUpgradeConfirmed(pending);
          sessionStorage.removeItem('gsp_upgrade_pending');
        } catch (_) {}
      }
    } catch (e) {
      console.error("Erreur sync abonnement", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Polling 30 s tant que l'abonnement est PENDING (attend validation admin)
  useEffect(() => {
    const status = subscriptionData?.subscription?.status;
    if (status !== 'PENDING') return;
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [subscriptionData?.subscription?.status]);

  const currentSubscription = subscriptionData?.subscription;
  const paymentHistory = subscriptionData?.payments || [];

  const displayedPayments = useMemo(() => {
    if (!paymentHistory) return [];
    if (pageSize === -1) return paymentHistory;
    return paymentHistory.slice(0, pageSize);
  }, [paymentHistory, pageSize]);

  // Vrai si un paiement d'abonnement est déjà en attente de validation
  const hasPendingSubPayment = useMemo(() =>
    paymentHistory.some((p: any) => p.status === 'PENDING'),
  [paymentHistory]);

  const currentPlan = useMemo(() => {
    return availablePlans.find(p => p.id === currentSubscription?.planId) || availablePlans[0] || SUBSCRIPTION_PLANS[0];
  }, [currentSubscription, availablePlans]);

  const filteredPlans = useMemo(() => {
    // Show all other plans to the user (exclude FREE_TRIAL and the current plan)
    return (availablePlans || []).filter(p => p.id !== 'FREE_TRIAL' && p.id !== currentPlan?.id);
  }, [availablePlans, currentPlan]);

  const handleUpgradeClick = (plan: SubscriptionPlan) => {
    if (!isAdmin) return;
    if (onUpgrade) {
      // Déléguer à App.tsx → Checkout.tsx dédié
      onUpgrade(plan);
      return;
    }
    // Fallback : modal interne
    setSelectedPlan(plan);
    setPaymentMethod(null);
    setOperator(null);
    setTxReference('');
    setPhoneNumber('');
    setShowPaymentModal(true);
  };

  

  const plansSection = useMemo(() => {
    if (!filteredPlans || filteredPlans.length === 0) {
      return (
        <div className="bg-white rounded-[3rem] p-6 md:p-12 border border-slate-100 shadow-sm text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <Sparkles size={64} className="text-amber-400 animate-bounce" />
            <h3 className="text-2xl font-black text-slate-900 mt-6">Votre entreprise est au sommet 🎉</h3>
            <p className="text-sm text-slate-500 mt-2">Aucune offre supérieure disponible — merci pour votre soutien.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Sélecteur de durée */}
        <div className="flex flex-wrap items-center gap-3 justify-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée :</span>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedDuration(opt.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${
                selectedDuration === opt.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
              }`}
            >
              {opt.label}
              {opt.discountPct > 0 && (
                <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full ${selectedDuration === opt.id ? 'bg-white text-indigo-600' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Percent size={8}/> -{opt.discountPct}%
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPlans.map((plan: SubscriptionPlan) => {
            const periodPrice = getPeriodPrice(plan, selectedDuration);
            const savings = getSavings(plan, selectedDuration);
            const periodOpt = PERIOD_OPTIONS.find(p => p.id === selectedDuration)!;
            return (
              <div key={plan.id} className="bg-white rounded-[3rem] border-2 border-slate-100 p-5 md:p-10 hover:border-indigo-600 transition-all group relative overflow-hidden flex flex-col shadow-sm hover:shadow-2xl">
                {plan.isPopular && (
                  <div className="absolute top-6 right-6 bg-indigo-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">RECOMMANDÉ</div>
                )}
                {savings > 0 && (
                  <div className="absolute top-6 left-6 bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                    -{periodOpt.discountPct}%
                  </div>
                )}
                <div className="mb-8 mt-2">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 tracking-tighter">{periodPrice.toLocaleString()}</span>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">{currency}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {selectedDuration !== '1M' && (
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest line-through">
                        {(plan.price * periodOpt.months).toLocaleString()} {currency}
                      </p>
                    )}
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                      {selectedDuration === '1M' ? '/ mois' : selectedDuration === '3M' ? '/ 3 mois' : '/ an'}
                      {savings > 0 && <span className="text-emerald-600 ml-2">— Économisez {savings.toLocaleString()} {currency}</span>}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 flex-1 mb-10">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100"><Check size={12}/></div>
                    {plan.maxUsers} Utilisateur(s)
                  </div>
                  {plan.hasAiChatbot && (
                    <div className="flex items-center gap-3 text-xs font-bold text-indigo-600">
                      <div className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100"><Zap size={12}/></div>
                      IA Orchestrator Pro
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <div className="w-5 h-5 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-100"><Check size={12}/></div>
                    Clients & Factures illimités
                  </div>
                </div>
                <button
                  onClick={() => handleUpgradeClick(plan)}
                  disabled={!isAdmin}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                >
                  SOUSCRIRE — {periodPrice.toLocaleString()} {currency}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [filteredPlans, currency, handleUpgradeClick, isAdmin, selectedDuration]);


  const handleStripeCheckout = async () => {
    if (!selectedPlan) return;
    setIsStripeLoading(true);
    try {
      const periodPrice = getPeriodPrice(selectedPlan, selectedDuration);
      const resp = await apiClient.post('/billing/stripe/checkout', {
        planId: selectedPlan.id,
        period: selectedDuration,
        amount: periodPrice,
        cardHolder,
      });
      if (resp.url) {
        // Stocker le flag avant la redirection Stripe
        sessionStorage.setItem('gsp_upgrade_pending', JSON.stringify({
          planId: selectedPlan.id,
          planName: selectedPlan.name
        }));
        window.location.href = resp.url;
      } else {
        showToast('Impossible de créer la session Stripe.', 'error');
      }
    } catch (err: any) {
      showToast('Erreur Stripe : ' + (err.message || 'Veuillez réessayer.'), 'error');
    } finally {
      setIsStripeLoading(false);
    }
  };

  const processPayment = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);
    try {
      const periodPrice = getPeriodPrice(selectedPlan, selectedDuration);
      const transactionId = operator === 'WAVE' ? txReference : `TX-${Date.now()}`;
      const payload = {
        planId: selectedPlan.id,
        period: selectedDuration,
        paymentMethod: operator || paymentMethod,
        transactionId,
        amount: periodPrice,          // montant total avec remise
        phone: phoneNumber || undefined,
        status: 'PENDING',
        notifyAdmin: true,
        reference: transactionId
      };

      await apiClient.post('/billing/upgrade', payload);

      // Stocker le flag pour détecter la validation admin
      sessionStorage.setItem('gsp_upgrade_pending', JSON.stringify({
        planId: selectedPlan.id,
        planName: selectedPlan.name
      }));

      // Optimistically apply the new plan locally while waiting for admin validation
      setSubscriptionData((prev: any) => {
        const now = new Date();
        const fakePayment = {
          id: `local-${Date.now()}`,
          reference: transactionId || `LOCAL-${Date.now()}`,
          amount: periodPrice,        // montant réel payé
          method: operator || paymentMethod || 'WAVE',
          paymentDate: now.toISOString(),
          status: 'PENDING',
          type: 'SUBSCRIPTION' // Type souscription/upgrade
        };
        const updatedSub = {
          ...(prev?.subscription || {}),
          planId: selectedPlan.id,
          status: 'PENDING',
          planDetails: selectedPlan
        };
        return {
          ...prev,
          subscription: updatedSub,
          payments: [fakePayment, ...(prev?.payments || [])]
        };
      });

      setSuccess(true);
      setTimeout(() => {
        setShowPaymentModal(false);
        setSuccess(false);
        fetchData();
      }, 3000);
    } catch (err: any) {
      showToast("Erreur : " + (err.message || "Erreur Kernel"), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayCurrentClick = () => {
    if (hasPendingSubPayment) {
      showToast('Un paiement est déjà en attente de validation. Veuillez patienter.', 'error');
      return;
    }
    setPaymentMethod(null);
    setOperator(null);
    setTxReference('');
    setShowPayCurrentModal(true);
  };

  const processPayNow = async () => {
    if (!currentSubscription || !currentPlan) return;
    setIsProcessing(true);
    try {
      const transactionId = operator === 'WAVE' ? txReference : `TX-${Date.now()}`;
      const payload = {
        subscriptionId: currentSubscription.id,
        amount: currentPlan.price,
        period: 'MONTH',
        transactionId,
        paymentMethod: operator || paymentMethod,
        notifyAdmin: true,
        reference: transactionId
      };

      await apiClient.post('/billing/pay', payload);
      showToast('Paiement enregistré. Merci.', 'success');
      fetchData();
      setShowPayCurrentModal(false);
    } catch (err: any) {
      showToast('Erreur : ' + (err.message || 'Erreur Kernel'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadInvoice = async (paymentId: string) => {
    try {
      const invoiceData = await apiClient.get(`/billing/invoice/${paymentId}`);

      const tenant = invoiceData.tenant || {};
      const plan   = invoiceData.plan   || {};

      // On mock un objet "sale" compatible avec DocumentPreview
      const subSale = {
        id: paymentId,
        reference: invoiceData.invoiceId || `F-SUB-${paymentId.slice(0,8).toUpperCase()}`,
        createdAt: invoiceData.date || new Date().toISOString(),
        totalTtc: invoiceData.amount || 0,
        amountPaid: invoiceData.amount || 0,
        isValidated: tenant?.paymentStatus === 'UP_TO_DATE' || !!invoiceData.paymentValidated,
        customer: {
          companyName: tenant?.name || 'Mon Entreprise',
          billingAddress: tenant?.address || '',
          phone: tenant?.phone || '',
          email: tenant?.email || ''
        },
        items: [
          {
            name: `Abonnement GeStockPro Cloud - Plan ${plan?.name || 'Standard'}`,
            quantity: 1,
            unitPrice: invoiceData.amount || 0,
            totalTtc: invoiceData.amount || 0,
            taxRate: 18
          }
        ]
      };

      setShowDocGenerator({ sale: subSale, mode: 'SUBSCRIPTION_INVOICE' });
    } catch (e) {
      showToast("Erreur lors de la récupération de la facture d'abonnement.", 'error');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Accès au Kernel Billing...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      
      {/* SECTION 1: ABONNEMENT ACTUEL */}
      <div className="bg-slate-900 rounded-[3.5rem] p-6 md:p-12 text-white relative overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-5">
          <Zap size={300} className="text-indigo-500" />
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
              <ShieldCheck size={18} className="text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Contrat Instance Actif</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">
              Plan <span className="text-indigo-400">{currentPlan?.name || 'INITIAL'}</span>
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Statut Contrat</p>
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${currentSubscription?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                     <p className="text-sm font-black uppercase tracking-tight">{currentSubscription?.status || 'TRIAL'}</p>
                  </div>
               </div>
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prochaine Échéance</p>
                  <p className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                     <Calendar size={14} className="text-indigo-400" />
                     {currentSubscription?.nextBillingDate ? new Date(currentSubscription.nextBillingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                  </p>
                <div className="mt-3">
                  {hasPendingSubPayment ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                      <Clock size={12} className="animate-pulse" />
                      Paiement en attente de validation
                    </div>
                  ) : (
                    <button onClick={handlePayCurrentClick} className="px-4 py-2 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">
                      PAYER CE MOIS — {currentPlan?.price?.toLocaleString()} {currency}
                    </button>
                  )}
                </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: HISTORIQUE DES PAIEMENTS */}
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <History className="text-indigo-600" /> Historique des règlements
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentHistory.length} Transactions</span>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                Afficher
                <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))} className="ml-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-black outline-none">
                  <option value={5}>5</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Tous</option>
                </select>
              </label>
            </div>
         </div>

         <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
               <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                     <th className="px-10 py-6">Date de transaction</th>
                     <th className="px-10 py-6">Référence</th>
                     <th className="px-10 py-6">Type</th>
                     <th className="px-10 py-6">Méthode</th>
                     <th className="px-10 py-6 text-right">Montant</th>
                     <th className="px-10 py-6 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {paymentHistory.length === 0 ? (
                    <tr><td colSpan={6} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Aucun paiement d'abonnement tracé</td></tr>
                  ) : displayedPayments.map((p: any) => {
                      // Détecter le type de paiement
                      const paymentType = p.type || (p.period === 'MONTH' || p.subscriptionId ? 'MONTHLY' : 'SUBSCRIPTION');
                      const isMonthly = paymentType === 'MONTHLY';
                      
                      return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-10 py-6">
                           <p className="text-sm font-black text-slate-900">{new Date(p.paymentDate || p.createdAt).toLocaleDateString('fr-FR')}</p>
                           <p className="text-[10px] text-slate-400 font-bold">{new Date(p.paymentDate || p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-10 py-6">
                           <p className="font-mono text-xs font-black text-indigo-600 uppercase tracking-tighter">#{p.reference || p.id.slice(0,12)}</p>
                        </td>
                            <td className="px-10 py-6">
                               <div className="flex items-center gap-2">
                                 {isMonthly ? (
                                   <div className="flex items-center gap-2">
                                     <Calendar size={14} className="text-emerald-500" />
                                     <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[8px] font-black uppercase tracking-widest">Mensuel</span>
                                   </div>
                                 ) : (
                                   <div className="flex items-center gap-2">
                                     <TrendingUp size={14} className="text-indigo-500" />
                                     <span className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-black uppercase tracking-widest">Souscription</span>
                                   </div>
                                 )}
                               </div>
                            </td>
                            <td className="px-10 py-6">
                               <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-600">{p.method}</span>
                            </td>
                        <td className="px-10 py-6 text-right font-black text-slate-900">
                           {Number(p.amount).toLocaleString()} {currency}
                        </td>
                        <td className="px-10 py-6 text-right">
                          {p.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-200">
                              <Clock size={12} className="animate-pulse" /> En attente de validation
                            </span>
                          ) : p.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-200">
                              <AlertTriangle size={12} /> Rejeté
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDownloadInvoice(p.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm group"
                            >
                              <FileDown size={14} className="group-hover:animate-bounce" /> Reçu de paiement
                            </button>
                          )}
                        </td>
                     </tr>
                      );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* APERÇU FACTURE ABONNEMENT */}
      {showDocGenerator && (
        <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="w-full max-w-5xl mx-4 md:mx-auto h-[90vh] bg-white rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-500">
              <div className="px-4 md:px-10 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0 print:hidden">
                 <div className="flex items-center gap-4"><FileText size={24} className="text-indigo-400"/><h3 className="text-lg font-black uppercase tracking-tight">Facture SaaS GeStocPro</h3></div>
                 <div className="flex gap-4">
                   <div className="flex items-center justify-end gap-3 mb-2">
                     <button onClick={async () => {
                       try {
                         // Ensure html2canvas is available (load from CDN if necessary)
                         if (!(window as any).html2canvas) {
                           await new Promise<void>((resolve, reject) => {
                             const s = document.createElement('script');
                             s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                             s.async = true;
                             s.onload = () => resolve();
                             s.onerror = () => reject(new Error('Chargement html2canvas échoué'));
                             document.head.appendChild(s);
                           });
                         }

                         const html2canvas = (window as any).html2canvas;
                         if (!html2canvas) throw new Error('html2canvas non disponible');

                         const node = document.getElementById('document-render');
                         if (!node) throw new Error('Aperçu introuvable');

                         // Render at higher scale for better quality
                         const canvas = await html2canvas(node as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                         // Prefer PNG
                         const mime = 'image/png';
                           canvas.toBlob((blob: Blob | null) => {
                           if (!blob) {
                             showToast('Impossible de générer l\'image', 'error');
                             return;
                           }
                           const url = window.URL.createObjectURL(blob);
                           const a = document.createElement('a');
                           a.href = url;
                           const filename = `${(showDocGenerator?.sale?.reference || showDocGenerator?.sale?.id)}.png`;
                           a.download = filename;
                           document.body.appendChild(a);
                           a.click();
                           a.remove();
                           window.URL.revokeObjectURL(url);
                         }, mime, 0.95);
                         } catch (err: any) {
                         console.error('Capture/download error', err);
                         showToast(err?.message || 'Erreur lors de la génération de l\'image', 'error');
                       }
                     }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"><Download size={14}/> Télécharger</button>
                   </div>
                   <button onClick={() => setShowDocGenerator(null)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-100/50 p-5 md:p-10 print:p-0 print:bg-white">
                 <DocumentPreview 
                    type={showDocGenerator.mode} 
                    sale={showDocGenerator.sale} 
                    tenant={null} // Non utilisé pour SUBSCRIPTION_INVOICE car émetteur GeStocPro
                    currency={currency} 
                 />
              </div>
           </div>
        </div>
      )}

      {/* SECTION 3: PLANS D'UPGRADE */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <TrendingUp className="text-emerald-500" /> Upgrades du Kernel
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Boostez les capacités de votre écosystème</p>
        </div>

        {plansSection}
      </div>

      {/* ══ BANNER UPGRADE CONFIRMÉ ══ */}
      {upgradeConfirmed && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white max-w-lg w-full rounded-[4rem] p-10 md:p-16 shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">

            {/* Icône succès */}
            <div className="relative mx-auto w-28 h-28">
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <BadgeCheck size={56} />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <Check size={16} className="text-white" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">
                Upgrade Confirmé !
              </h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed">
                Votre passage au plan{' '}
                <span className="text-indigo-600 font-black">{upgradeConfirmed.planName}</span>{' '}
                a été validé par l'administrateur.
              </p>
            </div>

            {/* Nouvelles fonctionnalités */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 text-left space-y-3">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">
                Nouvelles fonctionnalités débloquées
              </p>
              {[
                'Accès aux utilisateurs supplémentaires',
                `Toutes les fonctionnalités du plan ${upgradeConfirmed.planName}`,
                'Reconnexion requise pour activer les accès',
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-700 font-bold">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => { if (onLogout) onLogout(); }}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <ArrowRight size={18} />
                Se déconnecter & accéder à mes nouvelles fonctionnalités
              </button>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                Reconnectez-vous pour activer votre nouveau plan
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAIEMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            {success ? (
              <div className="p-10 md:p-20 text-center space-y-8 animate-in zoom-in-90">
                <div className="w-24 h-24 bg-amber-400 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
                  <Clock size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight">Paiement soumis</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">En attente de validation administrateur</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 text-left space-y-3">
                  <div className="flex items-center gap-3 text-sm font-bold text-amber-700">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    Votre reçu sera disponible après validation
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-7">
                    Une alerte s'affichera dès que votre upgrade est confirmé.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 md:px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><RefreshCw size={24}/></div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Règlement Upgrade</h3>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Sécurisation du flux</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPaymentModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 custom-scrollbar">
                  {/* Résumé du montant */}
                  {(() => {
                    const periodPrice = selectedPlan ? getPeriodPrice(selectedPlan, selectedDuration) : 0;
                    const savings = selectedPlan ? getSavings(selectedPlan, selectedDuration) : 0;
                    const periodOpt = PERIOD_OPTIONS.find(p => p.id === selectedDuration)!;
                    return (
                      <div className="p-4 md:p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">{selectedPlan?.name} — {periodOpt.label}</p>
                          {savings > 0 && <p className="text-[9px] text-emerald-600 font-black uppercase">Économie : {savings.toLocaleString()} {currency}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xl md:text-3xl font-black text-indigo-600">{periodPrice.toLocaleString()}</span>
                          <span className="text-sm font-black text-indigo-400 ml-2">{currency}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Choix de la méthode de paiement */}
                  {!paymentMethod && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choisir le mode de paiement</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={() => { setPaymentMethod('MOBILE'); setOperator('WAVE'); }}
                          className="p-5 rounded-[2rem] border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
                          <div className="flex items-center gap-3 mb-2">
                            <img src={waveLogo} alt="Wave" className="w-8 h-8 object-contain" />
                            <p className="font-black text-sm uppercase">Mobile Money</p>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Wave, Orange Money, MTN MoMo</p>
                        </button>
                        {/* Bouton Carte Bancaire (Stripe) — temporairement masqué
                        <button onClick={() => { setPaymentMethod('CARD'); setOperator(null); }}
                          className="p-5 rounded-[2rem] border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
                          <div className="flex items-center gap-3 mb-2">
                            <CreditCard size={28} className="text-slate-700" />
                            <p className="font-black text-sm uppercase">Carte Bancaire</p>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Visa, Mastercard via Stripe</p>
                        </button>
                        */}
                      </div>
                    </div>
                  )}

                  {/* Mobile Money (Wave) */}
                  {paymentMethod === 'MOBILE' && (
                    <div className="space-y-6">
                      <div className="flex gap-3">
                        {(['WAVE', 'ORANGE', 'MTN'] as const).map(op => (
                          <button key={op}
                            onClick={() => setOperator(op === 'MTN' ? 'ORANGE' : op as 'WAVE' | 'ORANGE')}
                            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${operator === op || (op === 'MTN' && operator === 'ORANGE') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {op}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div className="flex flex-col items-center gap-3">
                          <img src={waveQr} alt="Wave QR" className="w-40 h-40 object-contain rounded-xl shadow-md border" />
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">Scannez ce QR avec l'app Wave</p>
                        </div>
                        <div className="space-y-4">
                          {operator !== 'WAVE' && (
                            <input type="tel" placeholder="Numéro de téléphone" value={phoneNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                          )}
                          <input type="text" placeholder="Référence de transaction" value={txReference} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxReference(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                          <button onClick={processPayment} disabled={isProcessing || !txReference}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                            {isProcessing ? <Loader2 className="animate-spin" /> : <>VALIDER <ArrowRight size={18}/></>}
                          </button>
                          <button onClick={() => setPaymentMethod(null)} className="w-full py-2 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:text-slate-600">
                            ← Changer de méthode
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stripe — Carte Bancaire — temporairement masqué */}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* MODAL PAYER ABONNEMENT COURANT */}
      {showPayCurrentModal && (
        <div className="fixed inset-0 z-[850] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            <div className="px-4 md:px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><RefreshCw size={24}/></div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Payer l'abonnement</h3>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Vous payez le mois suivant</p>
                </div>
              </div>
              <button onClick={() => setShowPayCurrentModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col items-center gap-4">
                  <img src={waveQr} alt="Wave QR" className="w-48 h-48 object-contain rounded-xl shadow-md border" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">Scannez le QR avec l'application Wave puis renseignez la référence de transaction ci-dessous.</p>
                </div>
                <div className="space-y-4">
                  <div className="p-4 md:p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] flex justify-between items-center">
                    <div>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Période</p>
                      <p className="text-sm font-black uppercase tracking-widest">{currentSubscription?.nextBillingDate ? new Date(currentSubscription.nextBillingDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Montant à payer</p>
                      <p className="text-xl md:text-3xl font-black text-indigo-600">{currentPlan?.price?.toLocaleString()} {currency}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Référence de transaction</label>
                    <input type="text" placeholder="Référence (ex: Wave TX)" value={txReference} onChange={e => setTxReference(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setShowPayCurrentModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">ANNULER</button>
                    <button onClick={processPayNow} disabled={isProcessing || !txReference} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">{isProcessing ? 'PROCESSING...' : `PAYER ${currentPlan?.price?.toLocaleString()} ${currency}`}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
