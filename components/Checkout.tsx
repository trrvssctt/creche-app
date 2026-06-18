/**
 * Checkout.tsx — Page de paiement d'activation / abonnement initial
 * Affichée après l'onboarding lors de l'inscription.
 *
 * Fonctionnalités :
 *  - Durées 1M / 3M (-15%) / 1Y (-30%) avec affichage des économies
 *  - Mobile Money : Wave (QR + référence), Orange Money (téléphone), MTN (téléphone)
 *  - Carte Bancaire : Stripe Checkout Session (redirection sécurisée)
 */

import React, { useState, useMemo } from 'react';
import {
  /* CreditCard, */ Smartphone, Check, ArrowLeft,
  Loader2, ShieldCheck, Zap, QrCode,
  CheckCircle2, /* ArrowRight, Phone, */ Star
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../constants';
import { SubscriptionPlan } from '../types';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';

/* ─── Assets ──────────────────────────────────────────────────── */
import waveQr from '../assets/qr_code_marchant_wave.png';
/* ─── Constantes ──────────────────────────────────────────────── */
const PERIOD_OPTIONS = [
  { id: '1M', label: '1 Mois',  months: 1,  discountPct: 0  },
  { id: '3M', label: '3 Mois',  months: 3,  discountPct: 15 },
  { id: '1Y', label: '1 An',    months: 12, discountPct: 30 },
];

const OPERATORS = [
  { id: 'WAVE',   label: 'Wave',         color: 'bg-cyan-500',   ring: 'ring-cyan-400',   text: 'text-cyan-700',   bg: 'bg-cyan-50'   },
  { id: 'ORANGE', label: 'Orange Money', color: 'bg-orange-500', ring: 'ring-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  { id: 'MTN',    label: 'MTN MoMo',     color: 'bg-yellow-400', ring: 'ring-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
];

function getPeriodPrice(plan: SubscriptionPlan, periodId: string): number {
  if (periodId === '3M' && plan.priceThreeMonths != null) return plan.priceThreeMonths;
  if (periodId === '1Y' && plan.priceYearly != null) return plan.priceYearly;
  // fallback: calcul avec remise si prix DB absent
  const base = plan.priceMonthly ?? plan.price ?? 0;
  const opt = PERIOD_OPTIONS.find(p => p.id === periodId);
  if (!opt) return base;
  return Math.round(base * opt.months * (1 - opt.discountPct / 100));
}

function getSavings(plan: SubscriptionPlan, periodId: string): number {
  const base = plan.priceMonthly ?? plan.price ?? 0;
  const total = getPeriodPrice(plan, periodId);
  const opt = PERIOD_OPTIONS.find(p => p.id === periodId);
  if (!opt || opt.discountPct === 0) return 0;
  return Math.round(base * opt.months) - total;
}

/* ─── Props ───────────────────────────────────────────────────── */
interface CheckoutProps {
  planId: string;
  user: any;
  planObj?: SubscriptionPlan;
  isUpgrade?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

/* ════════════════════════════════════════════════════════════════ */
const Checkout: React.FC<CheckoutProps> = ({ planId, user, planObj, isUpgrade = false, onSuccess, onCancel }) => {
  const showToast = useToast();

  /* Plan */
  const plan = useMemo(() => planObj || SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0], [planObj, planId]);

  /* États */
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1M');
  const [method, setMethod] = useState<'MOBILE' | 'CARD' | null>(null);
  const [operator, setOperator] = useState<'WAVE' | 'ORANGE' | 'MTN'>('WAVE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [txReference, setTxReference] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'WAITING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [isProcessing, setIsProcessing] = useState(false);
  // const [isStripeLoading, setIsStripeLoading] = useState(false); // Stripe — temporairement masqué

  /* Prix */
  const totalPrice = useMemo(() => getPeriodPrice(plan, selectedPeriod), [plan, selectedPeriod]);
  const savings = useMemo(() => getSavings(plan, selectedPeriod), [plan, selectedPeriod]);
  const periodOpt = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)!;
  const operatorCfg = OPERATORS.find(o => o.id === operator)!;

  /* ─── Paiement Mobile Money ──────────────────────────────────── */
  const canSubmitMobile =
    operator === 'WAVE' ? txReference.trim().length >= 3 : phoneNumber.trim().length >= 8;

  const handleMobilePayment = async () => {
    setIsProcessing(true);
    setStatus('WAITING');
    try {
      const ref = operator === 'WAVE' ? txReference : `MOB-${Date.now()}`;
      if (isUpgrade) {
        // Upgrade : crée une demande PENDING → validation par SuperAdmin
        await apiClient.post('/subscription/upgrade', {
          planId: plan.id,
          period: selectedPeriod,
          amount: totalPrice,
          paymentMethod: operator,
          transactionId: ref,
          reference: ref,
          phone: operator !== 'WAVE' ? phoneNumber : undefined,
        });
      } else {
        // Activation initiale (post-inscription)
        await apiClient.post('/payments/callback', {
          provider: operator,
          tenantId: user.tenantId,
          amount: totalPrice,
          status: 'PENDING',
          transactionId: ref,
          planId: plan.id,
          period: selectedPeriod,
          months: periodOpt.months,
          discountPct: periodOpt.discountPct,
          phone: operator !== 'WAVE' ? phoneNumber : undefined,
        });
      }
      setStatus('SUCCESS');
      setTimeout(onSuccess, isUpgrade ? 3500 : 2800);
    } catch (e: any) {
      setStatus('ERROR');
      showToast('Erreur lors de la validation du paiement. Réessayez.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  /* ─── Paiement Stripe — temporairement masqué ───────────────────
  const handleStripeCheckout = async () => {
    setIsStripeLoading(true);
    try {
      const res: any = await apiClient.post('/billing/stripe/checkout', {
        planId: plan.id,
        period: selectedPeriod,
        amount: totalPrice,
        cardHolder: user?.name || '',
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error('URL Stripe manquante.');
      }
    } catch (e: any) {
      showToast(e?.message || 'Stripe indisponible. Utilisez Mobile Money.', 'error');
      setIsStripeLoading(false);
    }
  };
  ──────────────────────────────────────────────────────────────── */

  /* ─── Rendu état final ───────────────────────────────────────── */
  if (status === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-90 duration-700">
          <div className="w-28 h-28 bg-emerald-500 text-white rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl animate-bounce">
            <Check size={64} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-emerald-700 uppercase tracking-tighter">
              {isUpgrade ? 'Demande Envoyée !' : 'Paiement Enregistré !'}
            </h1>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              {isUpgrade
                ? `Votre demande d'upgrade vers le plan ${plan.name} a été transmise. L'accès aux nouvelles fonctionnalités sera disponible dès validation par l'administrateur.`
                : 'Votre demande a été transmise. Votre espace sera activé dès validation par notre équipe.'}
            </p>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '80%' }} />
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  if (status === 'WAITING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-6">
        <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 border-[6px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <Loader2 size={56} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-indigo-700 uppercase tracking-tight">Vérification en cours</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
              Validation du paiement {operator}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Rendu principal ────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Blobs décoratifs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-5 gap-0 rounded-[2.5rem] shadow-2xl bg-white/80 backdrop-blur-xl border border-white/60 overflow-hidden relative z-10">

        {/* ── Panneau gauche : Récap plan + Durée ── */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 flex flex-col gap-8 relative overflow-hidden">
          {/* Décoration */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />

          {/* Retour */}
          <button onClick={onCancel} className="flex items-center gap-2 text-indigo-200 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors self-start">
            <ArrowLeft size={14} /> Retour
          </button>

          {/* Plan info */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-indigo-300" />
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Activation Instance</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-1">{plan?.name}</h2>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-black text-white">{totalPrice.toLocaleString('fr-FR')}</span>
              <span className="text-indigo-300 font-bold text-sm">F CFA</span>
            </div>
            <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1">
              / {periodOpt.label.toLowerCase()}
            </p>
            {savings > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-3 py-1.5 rounded-xl">
                <Star size={11} />
                <span className="text-[10px] font-black uppercase">Économie : {savings.toLocaleString('fr-FR')} F CFA</span>
              </div>
            )}
          </div>

          {/* Sélecteur de durée */}
          <div className="relative z-10">
            <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-3">Durée d'abonnement</p>
            <div className="flex flex-col gap-2">
              {PERIOD_OPTIONS.map(opt => {
                const price = getPeriodPrice(plan, opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPeriod(opt.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left ${
                      selectedPeriod === opt.id
                        ? 'bg-white text-indigo-700 border-white shadow-lg'
                        : 'bg-white/10 text-indigo-100 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedPeriod === opt.id ? 'border-indigo-600 bg-indigo-600' : 'border-indigo-300'
                      }`}>
                        {selectedPeriod === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div>
                        <p className="text-xs font-black">{opt.label}</p>
                        <p className={`text-[9px] font-bold ${selectedPeriod === opt.id ? 'text-indigo-500' : 'text-indigo-300'}`}>
                          {price.toLocaleString('fr-FR')} F CFA
                        </p>
                      </div>
                    </div>
                    {opt.discountPct > 0 && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                        selectedPeriod === opt.id ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        -{opt.discountPct}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-2 mt-auto">
            {(plan?.features && plan.features.length > 0
              ? plan.features.slice(0, 4)
              : ['Accès illimité aux modules', `${plan?.maxUsers || 1} utilisateur(s)`, 'Support inclus']
            ).map((f: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] text-indigo-200 font-bold">{f}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
              <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
              <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest">Paiement 100% sécurisé</span>
            </div>
          </div>
        </div>

        {/* ── Panneau droit : Méthode de paiement ── */}
        <div className="lg:col-span-3 p-8 flex flex-col gap-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Paiement Sécurisé</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Choisissez votre méthode de paiement
            </p>
          </div>

          {/* Sélecteur méthode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod('MOBILE')}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
                method === 'MOBILE'
                  ? 'border-cyan-500 bg-cyan-50 shadow-inner'
                  : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50'
              }`}
            >
              <Smartphone size={28} className={method === 'MOBILE' ? 'text-cyan-600' : 'text-slate-400'} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${method === 'MOBILE' ? 'text-cyan-700' : 'text-slate-500'}`}>
                Mobile Money
              </span>
              <div className="flex gap-1">
                <span className="text-[8px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded font-bold">Wave</span>
                <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">Orange</span>
                <span className="text-[8px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded font-bold">MTN</span>
              </div>
            </button>
            {/* Bouton Carte Bancaire (Stripe) — temporairement masqué
            <button
              onClick={() => setMethod('CARD')}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
                method === 'CARD'
                  ? 'border-indigo-500 bg-indigo-50 shadow-inner'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <CreditCard size={28} className={method === 'CARD' ? 'text-indigo-600' : 'text-slate-400'} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${method === 'CARD' ? 'text-indigo-700' : 'text-slate-500'}`}>
                Carte Bancaire
              </span>
              <span className="text-[8px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded font-bold">Via Stripe</span>
            </button>
            */}
          </div>

          {/* ── Mobile Money ── */}
          {method === 'MOBILE' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Opérateur tabs */}
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Opérateur</p>
                <div className="flex gap-2">
                  {OPERATORS.map(op => (
                    <button
                      key={op.id}
                      onClick={() => { setOperator(op.id as any); setPhoneNumber(''); setTxReference(''); }}
                      className={`flex-1 py-2.5 px-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        operator === op.id
                          ? `${op.bg} border-current ${op.text} shadow-inner`
                          : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {op.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Wave : QR + référence ── */}
              {operator === 'WAVE' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className={`rounded-3xl p-6 ${operatorCfg.bg} border border-cyan-100 text-center`}>
                    <p className="text-[9px] font-black text-cyan-600 uppercase tracking-widest mb-4">
                      Scannez avec l'app Wave
                    </p>
                    <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mb-4">
                      <img src={waveQr} alt="Wave QR" className="w-40 h-40 object-contain rounded-xl" />
                    </div>
                    <div className="bg-white/70 rounded-2xl p-3 text-left space-y-1">
                      <p className="text-[9px] font-black text-cyan-800">
                        Montant : <span className="font-black">{totalPrice.toLocaleString('fr-FR')} F CFA</span>
                      </p>
                      <p className="text-[9px] text-cyan-700 font-bold">Entrez la référence ci-dessous après paiement</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Référence de transaction *
                    </label>
                    <input
                      type="text"
                      value={txReference}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxReference(e.target.value)}
                      placeholder="Ex: TXN-A1B2C3D4"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-400 uppercase tracking-wider"
                    />
                  </div>
                </div>
              )}

              {/* ── Orange / MTN : numéro de téléphone ── 
              /*{(operator === 'ORANGE' || operator === 'MTN') && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className={`rounded-3xl p-5 ${operatorCfg.bg} border ${operator === 'ORANGE' ? 'border-orange-100' : 'border-yellow-100'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 ${operatorCfg.color} rounded-2xl flex items-center justify-center`}>
                        <Phone size={18} className="text-white" />
                      </div>
                      <div>
                        <p className={`text-xs font-black ${operatorCfg.text}`}>{operatorCfg.label}</p>
                        <p className="text-[9px] text-slate-500 font-bold">Paiement via votre numéro mobile</p>
                      </div>
                    </div>
                    <div className={`rounded-2xl bg-white/70 p-3 text-xs font-bold ${operatorCfg.text}`}>
                      Montant : <span className="font-black">{totalPrice.toLocaleString('fr-FR')} F CFA</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Numéro de téléphone *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                      placeholder="Ex: 77 123 45 67"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400"
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
                      Une demande de paiement sera envoyée à ce numéro.
                    </p>
                  </div>
                </div>
              )}
                */}

              {/* Bouton validation Mobile */}
              <button
                onClick={handleMobilePayment}
                disabled={!canSubmitMobile || isProcessing}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-40 transition-all text-white ${
                  operator === 'ORANGE' ? 'bg-orange-500 hover:bg-orange-600'
                  : operator === 'MTN' ? 'bg-yellow-500 hover:bg-yellow-600'
                  : 'bg-cyan-600 hover:bg-cyan-700'
                }`}
              >
                {isProcessing
                  ? <><Loader2 size={18} className="animate-spin" /> Validation...</>
                  : <><CheckCircle2 size={18} /> Valider le paiement {totalPrice.toLocaleString('fr-FR')} F CFA</>
                }
              </button>
            </div>
          )}

          {/* ── Stripe Card — temporairement masqué ──
          {method === 'CARD' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-indigo-50 rounded-3xl p-5 border border-indigo-100 space-y-3">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-indigo-600" />
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Paiement Stripe Sécurisé</p>
                </div>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Vous serez redirigé vers la page de paiement Stripe pour saisir vos coordonnées bancaires.
                  Vos données ne transitent jamais par nos serveurs.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Visa', 'Mastercard', 'Amex', '3D Secure'].map(b => (
                    <span key={b} className="text-[9px] bg-white border border-indigo-200 text-indigo-600 font-black px-2 py-1 rounded-lg uppercase">
                      {b}
                    </span>
                  ))}
                </div>
                {/* Résumé montant *\/}
                <div className="bg-white rounded-2xl p-4 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Montant total</p>
                    <p className="text-xl font-black text-indigo-700">{totalPrice.toLocaleString('fr-FR')} F CFA</p>
                    <p className="text-[9px] text-slate-400 font-bold">{plan?.name} — {periodOpt.label}</p>
                  </div>
                  {savings > 0 && (
                    <div className="text-right">
                      <p className="text-[9px] font-black text-emerald-600 uppercase">Économie</p>
                      <p className="text-sm font-black text-emerald-600">-{savings.toLocaleString('fr-FR')} F</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleStripeCheckout}
                disabled={isStripeLoading}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
              >
                {isStripeLoading
                  ? <><Loader2 size={18} className="animate-spin" /> Connexion Stripe...</>
                  : <><CreditCard size={18} /> Payer {totalPrice.toLocaleString('fr-FR')} F CFA par carte <ArrowRight size={16} /></>
                }
              </button>
              <p className="text-center text-[9px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-500" />
                Connexion chiffrée TLS · Certifié PCI-DSS
              </p>
            </div>
          )}
          ──*/}

          {/* ── Placeholder si aucune méthode ── */}
          {!method && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center gap-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <QrCode size={48} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px]">
                Sélectionnez une méthode de paiement pour continuer
              </p>
            </div>
          )}

          {/* Footer sécurité */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100">
            <ShieldCheck size={14} className="text-emerald-500" />
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Paiement chiffré · Sans engagement · Annulable à tout moment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
