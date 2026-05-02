
import React, { useState, useEffect } from 'react';
import {
  CreditCard, Palette, FileText, Check,
  ChevronRight, Sparkles, ShieldCheck, CheckCircle2,
  Upload, Loader2, AlertCircle, RefreshCw, Zap, X, Users,
  Package, BarChart3, Receipt, Truck, Headphones, Brain, Star,
  ArrowRight, Globe
} from 'lucide-react';
import { apiClient } from '../services/api';
import { uploadFile } from '../services/uploadService';
import { authBridge } from '../services/authBridge';
import logo from '../assets/logo_gestockpro.png';

interface Props {
  onComplete: (data: any) => void;
  onExit?: () => void;
  companyName: string;
  user: any;
  planId?: string;
}

// ─── Plan configuration ─────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, {
  color: string; badgeClass: string; badgeBg: string; badgeBorder: string; badgeText: string;
  name: string; tagline: string; icon: React.FC<any>; level: number;
  modules: { icon: React.FC<any>; label: string; desc: string }[];
  highlights: string[];
}> = {
  FREE_TRIAL: {
    color: '#7c3aed',
    badgeClass: 'bg-violet-100 border-violet-200 text-violet-700',
    badgeBg: 'bg-violet-50', badgeBorder: 'border-violet-100', badgeText: 'text-violet-600',
    name: 'Essai Gratuit', tagline: '14 jours pour explorer tout GeStockPro sans engagement',
    icon: Sparkles, level: 0,
    modules: [
      { icon: Package, label: 'Gestion de Stock', desc: 'Suivi des stocks en temps réel' },
      { icon: Receipt, label: 'Ventes & Facturation', desc: 'Factures, devis et paiements' },
      { icon: Users, label: 'Clients & Fournisseurs', desc: 'CRM intégré' },
      { icon: Brain, label: 'IA Chatbot', desc: 'Assistant intelligent' },
    ],
    highlights: ['14 jours complets', '1 utilisateur inclus', '5 produits / 5 ventes', 'Toutes les fonctionnalités de base'],
  },
  BASIC: {
    color: '#2563eb',
    badgeClass: 'bg-blue-100 border-blue-200 text-blue-700',
    badgeBg: 'bg-blue-50', badgeBorder: 'border-blue-100', badgeText: 'text-blue-600',
    name: 'Starter AI', tagline: 'L\'essentiel pour piloter votre activité au quotidien',
    icon: Zap, level: 1,
    modules: [
      { icon: Package, label: 'Gestion de Stock', desc: 'Inventaire, alertes de seuil' },
      { icon: Receipt, label: 'Ventes & Facturation', desc: '100 factures / mois' },
      { icon: Users, label: 'Clients & Fournisseurs', desc: 'Gestion des tiers' },
      { icon: Truck, label: 'Livraisons', desc: 'Suivi des livraisons' },
    ],
    highlights: ['1 utilisateur', '100 factures/mois', 'Support email inclus', 'Mise à jour en continu'],
  },
  PRO: {
    color: '#4f46e5',
    badgeClass: 'bg-indigo-100 border-indigo-200 text-indigo-700',
    badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-100', badgeText: 'text-indigo-600',
    name: 'Business Pro', tagline: 'Accélérez votre croissance avec l\'IA et les analyses avancées',
    icon: Star, level: 2,
    modules: [
      { icon: Package, label: 'Gestion de Stock', desc: 'Illimité + Prévisions IA' },
      { icon: Receipt, label: 'Ventes & Facturation', desc: 'Transactions illimitées' },
      { icon: BarChart3, label: 'Recouvrement & Finance', desc: 'Suivi des impayés' },
      { icon: Brain, label: 'IA Chatbot', desc: 'Assistant analytique avancé' },
    ],
    highlights: ['5 utilisateurs', 'Transactions illimitées', 'IA Chatbot & Prévisions', 'Recouvrement inclus'],
  },
  ENTERPRISE: {
    color: '#b45309',
    badgeClass: 'bg-amber-100 border-amber-200 text-amber-700',
    badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-100', badgeText: 'text-amber-600',
    name: 'Enterprise Cloud', tagline: 'La suite complète pour les grandes structures multi-entités',
    icon: Globe, level: 3,
    modules: [
      { icon: Users, label: 'Module RH Complet', desc: 'Paie, congés, contrats, pointage' },
      { icon: Package, label: 'Stock & Opérations', desc: 'Multi-entités, illimité' },
      { icon: Brain, label: 'IA & Analytics', desc: 'Rapports avancés, prévisions' },
      { icon: ShieldCheck, label: 'Gouvernance & Audit', desc: 'Logs, sécurité, conformité' },
      { icon: Headphones, label: 'Support Premium 24/7', desc: 'Gestionnaire dédié' },
    ],
    highlights: ['100 utilisateurs', 'Module RH intégré', 'Support Premium 24/7', 'Infrastructure dédiée'],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
const OnboardingWizard: React.FC<Props> = ({ onComplete, onExit, companyName, user, planId }) => {
  const rawPlanId = String(planId || user?.planId || user?.subscription?.planId || 'BASIC').toUpperCase();
  const resolvedPlanId = Object.keys(PLAN_CONFIG).find(k => rawPlanId.includes(k)) || 'BASIC';
  const isEnterprise = resolvedPlanId === 'ENTERPRISE';
  const plan = PLAN_CONFIG[resolvedPlanId];
  const storageKey = `onboarding_${user?.id || user?.tenantId || 'anon'}`;

  const defaultFormData = {
    name: companyName,
    currency: 'F CFA',
    taxRate: 18,
    invoicePrefix: 'INV-',
    legalMentions: 'Paiement à réception. Escompte pour paiement anticipé : néant.',
    primaryColor: plan.color,
    buttonColor: '#63452c',
    logoUrl: '',
    factureUrl: '',
    cachetUrl: ''
  };

  // Restore from localStorage — start at step 1 now (not 2)
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { step: parsed.step || 1, formData: { ...defaultFormData, ...parsed.formData } };
      }
    } catch {}
    return { step: 1, formData: defaultFormData };
  };

  const initial = getInitialState();
  const [step, setStep] = useState(initial.step);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(initial.formData);

  // Sauvegarder la session dès le montage du wizard pour que les uploads fonctionnent
  useEffect(() => {
    const token = user?.token;
    if (token) {
      authBridge.saveSession(user, token);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Mark wizard as started in localStorage (so we know progress vs not started)
  useEffect(() => {
    try {
      const existing = localStorage.getItem(storageKey);
      if (!existing) {
        localStorage.setItem(storageKey + '_started', JSON.stringify({ startedAt: new Date().toISOString(), planId: resolvedPlanId }));
      }
    } catch {}
  }, []);

  // Persist progress on every change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ step, formData, planId: resolvedPlanId, updatedAt: new Date().toISOString() })); // eslint-disable-line
    } catch {}
  }, [step, formData]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-kernel', formData.primaryColor);
    document.documentElement.style.setProperty('--button-kernel', formData.buttonColor || '#63452c');
  }, [formData.primaryColor, formData.buttonColor]);

  const handleExit = () => {
    onExit?.();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'factureUrl' | 'cachetUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(field);
    setError(null);
    // S'assurer que la session est bien enregistrée avant l'upload
    const token = user?.token;
    if (token) authBridge.saveSession(user, token);
    try {
      const folder = field === 'logoUrl' ? 'logos' : field === 'cachetUrl' ? 'cachets' : 'documents';
      const result = await uploadFile(file, folder);
      setFormData(prev => ({ ...prev, [field]: result.url }));
    } catch (err: any) {
      setError(err.message || "Échec de l'envoi du visuel.");
    } finally {
      setIsUploading(null);
    }
  };

  const handleSubmit = async () => {
    setIsFinalizing(true);
    setError(null);
    try {
      const token = user?.token;
      if (!token) throw new Error("Le jeton d'accès n'a pas été détecté. Veuillez rafraîchir la page.");
      authBridge.saveSession(user, token);

      const payload = {
        name: formData.name,
        currency: formData.currency,
        taxRate: Number(formData.taxRate),
        invoicePrefix: formData.invoicePrefix,
        invoiceFooter: formData.legalMentions,
        primaryColor: formData.primaryColor,
        buttonColor: formData.buttonColor,
        logoUrl: formData.logoUrl,
        onboardingCompleted: true
      };

      await apiClient.request('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Clean up localStorage — wizard fully completed
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey + '_started');
      onComplete({ ...formData, onboardingCompleted: true, goToHR: isEnterprise });
    } catch (err: any) {
      setError(err.message || "Erreur critique de synchronisation Kernel.");
      setIsFinalizing(false);
    }
  };

  const steps = [
    { id: 1, label: 'Bienvenue',  icon: Sparkles,   desc: 'Votre plan & modules' },
    { id: 2, label: 'Fiscalité',  icon: CreditCard,  desc: 'Taxes & Devises' },
    { id: 3, label: 'Branding',   icon: Palette,     desc: 'Design & Logo' },
    { id: 4, label: 'Légal',      icon: FileText,    desc: 'Conformité' },
    ...(isEnterprise ? [{ id: 5, label: 'Ressources Humaines', icon: Users, desc: 'Module RH' }] : []),
  ];

  const PRESET_COLORS = ['#0f172a', plan.color, '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#63452c'];

  // Extract first name from user.name
  const firstName = (user?.name || companyName || 'vous').split(' ')[0].replace(/admin/i, '').trim() || 'vous';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-3 sm:p-6 overflow-hidden font-sans">
      <style>{`
        :root { --primary-kernel: ${formData.primaryColor}; --button-kernel: ${formData.buttonColor || '#63452c'}; }
        .bg-kernel { background-color: var(--primary-kernel); }
        .text-kernel { color: var(--primary-kernel); }
        .border-kernel { border-color: var(--primary-kernel); }
      `}</style>

      {/* Glowing background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-10" style={{ backgroundColor: plan.color }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[100px] pointer-events-none opacity-8" style={{ backgroundColor: plan.color }} />

      <div className="max-w-5xl w-full flex flex-col lg:grid lg:grid-cols-12 gap-0 bg-white rounded-[2rem] shadow-[0_40px_120px_rgba(0,0,0,0.5)] overflow-hidden max-h-[92dvh] animate-in zoom-in-95 duration-700">

        {/* ── Mobile progress bar ── */}
        <div className="flex lg:hidden items-center justify-between px-5 pt-4 pb-3 bg-slate-900 text-white shrink-0">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Configuration</p>
            <p className="text-xs font-black uppercase tracking-tight">{steps.find(s => s.id === step)?.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {steps.map(s => (
                <div key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${
                  step === s.id ? 'w-6 bg-indigo-400' : step > s.id ? 'w-3 bg-emerald-400' : 'w-3 bg-slate-600'
                }`} />
              ))}
            </div>
            {onExit && (
              <button onClick={handleExit} className="text-slate-400 hover:text-white p-1" title="Continuer plus tard">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:col-span-4 bg-slate-900 p-10 xl:p-12 text-white flex-col justify-between relative overflow-hidden">
          {/* Decorative glow with plan color */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: plan.color }} />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl opacity-10" style={{ backgroundColor: plan.color }} />
          <div className="absolute inset-0 opacity-[0.03]">
            <Zap size={320} className="absolute -right-16 -top-16 text-white" />
          </div>

          <div className="relative z-10 space-y-8">
            {/* Logo + exit */}
            <div className="flex items-center justify-between">
              <img src={logo} alt="GeStockPro" className="h-9 opacity-90" />
              {onExit && (
                <button onClick={handleExit} title="Continuer plus tard"
                  className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">
                  <X size={12} /> Quitter
                </button>
              )}
            </div>

            {/* Plan badge */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 border"
                style={{ backgroundColor: plan.color + '22', borderColor: plan.color + '44' }}>
                <plan.icon size={12} style={{ color: plan.color }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: plan.color }}>
                  {plan.name}
                </span>
              </div>
              <h2 className="text-xl xl:text-2xl font-black tracking-tight leading-tight">
                Configuration<br />
                <span style={{ color: plan.color }}>de votre instance</span>
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-3 leading-relaxed">
                Initialisation des assets<br />de <span className="text-slate-300">{companyName}</span>
              </p>
            </div>

            {/* Step indicators */}
            <div className="space-y-4">
              {steps.map((s) => {
                const isDone = step > s.id;
                const isActive = step === s.id;
                return (
                  <div key={s.id} className={`flex items-center gap-4 transition-all duration-500 ${
                    isActive ? 'opacity-100 translate-x-2' : isDone ? 'opacity-60' : 'opacity-25'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      isActive ? 'shadow-lg scale-110' : isDone ? 'bg-emerald-600/20 border border-emerald-500/40' : 'border border-slate-700'
                    }`} style={isActive ? { backgroundColor: plan.color, boxShadow: `0 4px 20px ${plan.color}44` } : {}}>
                      {isDone
                        ? <Check size={18} className="text-emerald-400" />
                        : <s.icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                      }
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest`}
                        style={isActive ? { color: plan.color } : { color: 'white' }}>
                        {s.label}
                      </p>
                      <p className="text-[9px] font-bold text-slate-600 uppercase">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom badge */}
          <div className="relative z-10">
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.color + '22' }}>
                <Sparkles size={14} style={{ color: plan.color }} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">GeStockPro Kernel</p>
                <p className="text-[8px] text-slate-500 uppercase">Infrastructure SaaS isolée</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="lg:col-span-8 p-5 sm:p-8 lg:p-14 flex flex-col justify-between flex-1 overflow-y-auto">
          <div className="flex-1">

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-in shake">
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider">{error}</p>
              </div>
            )}

            {/* ── STEP 1 — Bienvenue & Plan ── */}
            {step === 1 && (
              <div className="space-y-7 animate-in slide-in-from-right-4 duration-500">
                {/* Header */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                    Étape 1 / {steps.length} · Bienvenue
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    Bonjour, <span style={{ color: plan.color }}>{firstName} !</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Votre instance <span className="text-slate-600">{companyName}</span> est prête à être configurée
                  </p>
                </div>

                {/* Plan card */}
                <div className={`p-5 rounded-2xl border-2 ${plan.badgeBorder}`} style={{ backgroundColor: plan.color + '08', borderColor: plan.color + '33' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + '22' }}>
                        <plan.icon size={22} style={{ color: plan.color }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Votre abonnement</p>
                        <p className="text-lg font-black text-slate-900 tracking-tight">{plan.name}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest shrink-0"
                      style={{ backgroundColor: plan.color + '15', borderColor: plan.color + '40', color: plan.color }}>
                      Actif
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-3 leading-relaxed">{plan.tagline}</p>

                  {/* Highlights */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {plan.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + '22' }}>
                          <Check size={9} style={{ color: plan.color }} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modules unlocked */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Modules débloqués sur votre plan
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plan.modules.map((mod) => (
                      <div key={mod.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + '15' }}>
                          <mod.icon size={16} style={{ color: plan.color }} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{mod.label}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{mod.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Setup steps preview */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="shrink-0 flex items-center gap-1.5">
                    {steps.slice(1).map((s, i) => (
                      <React.Fragment key={s.id}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 bg-white">
                          <s.icon size={12} className="text-slate-500" />
                        </div>
                        {i < steps.length - 2 && <ArrowRight size={10} className="text-slate-300" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      {steps.length - 1} étape{steps.length - 1 > 1 ? 's' : ''} de configuration
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">Environ 2 minutes · Modifiable à tout moment</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2 — Fiscalité ── */}
            {step === 2 && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                    Étape 2 / {steps.length}
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Pilotage Financier</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Définit vos calculs de marge et de taxes par défaut
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Devise Système</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:border-indigo-200 cursor-pointer"
                      style={{ '--tw-ring-color': plan.color + '20' } as any}
                    >
                      <option value="F CFA">Franc CFA (F CFA)</option>
                      <option value="€">Euro (€)</option>
                      <option value="$">US Dollar ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Taux TVA Standard (%)</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input
                        type="number"
                        value={formData.taxRate}
                        onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:border-indigo-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ backgroundColor: plan.color + '08', borderColor: plan.color + '22' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: plan.color + '22' }}>
                    <CreditCard size={14} style={{ color: plan.color }} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: plan.color }}>Calcul automatique</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed font-bold">
                      Ces paramètres seront appliqués à toutes vos factures et devis. Modifiables à tout moment dans les paramètres.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3 — Branding ── */}
            {step === 3 && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                    Étape 3 / {steps.length}
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Identité Visuelle</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Personnalisez votre instance avec vos couleurs et votre logo
                  </p>
                </div>

                {/* Logo upload */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Logo de l'application</label>
                  <input type="file" id="logo_up" hidden onChange={e => handleFileUpload(e, 'logoUrl')} accept="image/*" />
                  <label
                    htmlFor="logo_up"
                    className={`flex items-center gap-5 p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                      formData.logoUrl ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    style={!formData.logoUrl ? { '--hover-border-color': plan.color } as any : {}}
                  >
                    {isUploading === 'logoUrl' ? (
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Loader2 className="animate-spin" size={20} style={{ color: plan.color }} />
                      </div>
                    ) : formData.logoUrl ? (
                      <img src={formData.logoUrl} className="h-14 w-14 rounded-xl object-contain bg-slate-50 shrink-0" alt="logo" />
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Upload size={20} className="text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-slate-700">
                        {formData.logoUrl ? 'Logo importé' : 'Importer votre logo'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">PNG, JPG, SVG · Max 5 MB</p>
                    </div>
                    {formData.logoUrl && <div className="ml-auto"><Check size={18} className="text-emerald-500" /></div>}
                  </label>
                </div>

                {/* Color theme */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Thème de couleur</label>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setFormData({ ...formData, primaryColor: c })}
                          className={`w-9 h-9 rounded-xl shadow-sm transition-all ${formData.primaryColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="w-10 h-10 rounded-xl cursor-pointer border-none p-0 shrink-0"
                        />
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase">Couleur principale</p>
                          <p className="text-[9px] font-mono text-slate-400">{formData.primaryColor}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.buttonColor}
                          onChange={e => setFormData({ ...formData, buttonColor: e.target.value })}
                          className="w-10 h-10 rounded-xl cursor-pointer border-none p-0 shrink-0"
                        />
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase">Couleur bouton</p>
                          <p className="text-[9px] font-mono text-slate-400">{formData.buttonColor}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4 — Légal ── */}
            {step === 4 && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                    Étape 4 / {steps.length}
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Conformité & Légal</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Paramétrez le pied de vos documents commerciaux
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Préfixe de numérotation</label>
                    <input
                      type="text"
                      value={formData.invoicePrefix}
                      onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-mono font-black outline-none focus:ring-4 focus:border-indigo-200"
                      placeholder="INV-"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Mentions légales obligatoires</label>
                    <textarea
                      value={formData.legalMentions}
                      onChange={e => setFormData({ ...formData, legalMentions: e.target.value })}
                      rows={5}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:border-indigo-200 resize-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-emerald-800 font-bold uppercase leading-relaxed">
                    En validant, vous déployez une infrastructure isolée conforme aux protocoles GSP-3.2. Toutes vos données restent cloisonnées.
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 5 — RH (Enterprise uniquement) ── */}
            {step === 5 && isEnterprise && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                    Étape 5 / 5
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Module Ressources Humaines</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Votre plan Enterprise Cloud inclut la gestion RH complète
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { icon: Users,    title: 'Employés & Contrats', desc: 'Gérez vos fiches employés, contrats CDI/CDD, renouvellements et historiques.' },
                    { icon: CreditCard, title: 'Paie & Bulletins', desc: 'Calculez les salaires, générez les bulletins de paie et gérez les avances.' },
                    { icon: FileText, title: 'Congés & Absences', desc: 'Suivez les demandes de congés, pointages et absences en temps réel.' },
                    { icon: Sparkles, title: 'Recrutement & Évaluation', desc: 'Publiez des offres, gérez les candidatures et évaluez les performances.' },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + '15' }}>
                        <item.icon size={18} style={{ color: plan.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{item.title}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ backgroundColor: plan.color + '08', borderColor: plan.color + '22' }}>
                  <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: plan.color }} />
                  <p className="text-[9px] font-bold uppercase leading-relaxed" style={{ color: plan.color }}>
                    Après le démarrage, vous serez redirigé vers le module RH pour configurer vos départements, employés et paramètres de paie.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Navigation buttons ── */}
          <div className="mt-8 flex items-center gap-3 pt-6 border-t border-slate-100 shrink-0">
            {step > 1 && (
              <button
                onClick={() => setStep(prev => prev - 1)}
                disabled={isFinalizing}
                className="px-6 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-40"
              >
                RETOUR
              </button>
            )}
            <button
              onClick={step === steps.length ? handleSubmit : () => setStep(prev => prev + 1)}
              disabled={!!isUploading || isFinalizing}
              className="flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
              style={{ backgroundColor: isFinalizing ? '#64748b' : plan.color }}
            >
              {isFinalizing ? (
                <><RefreshCw className="animate-spin" size={16} /> SYNCHRONISATION...</>
              ) : step === 1 ? (
                <>COMMENCER LA CONFIGURATION <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
              ) : step === steps.length && isEnterprise ? (
                <>CONFIGURER LES RH <Users size={16} /></>
              ) : step === steps.length ? (
                <>DÉMARRER L'INSTANCE <CheckCircle2 size={16} /></>
              ) : (
                <>CONTINUER <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
