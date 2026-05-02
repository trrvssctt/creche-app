
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, Sparkles, Package, Users, Receipt,
  BarChart3, CheckCircle2, Map, Loader2, Check, LayoutDashboard,
  ArrowRight, Zap, Star, Globe
} from 'lucide-react';
import { apiClient } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TourStep {
  id: string;
  tab?: string;
  targetId?: string;
  icon: React.FC<any>;
  iconColor: string;
  title: string;
  description: string;
  tip?: string;
  demoAction?: {
    label: string;
    successLabel: string;
    fn: () => Promise<void>;
  };
}

interface Props {
  user: any;
  planId: string;
  currentTab: string;
  onNavigate: (tab: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  onDemoCreated?: (type: 'inventory' | 'customers') => void;
}

// ─── Tour Component ───────────────────────────────────────────────────────────
const DashboardTour: React.FC<Props> = ({ user, planId, currentTab, onNavigate, onComplete, onSkip, onDemoCreated }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState<Record<string, boolean>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);

  const firstName = ((user?.name || '').split(' ').find((w: string) => !/admin/i.test(w)) || 'vous');
  const resolvedPlan = String(planId || 'BASIC').toUpperCase();
  const isEnterprise = resolvedPlan.includes('ENTERPRISE');
  const isPro = resolvedPlan.includes('PRO') || isEnterprise;
  const planName = isEnterprise ? 'Enterprise Cloud' : isPro ? 'Business Pro' : resolvedPlan.includes('FREE') ? 'Essai Gratuit' : 'Starter AI';

  // ─── Demo data creators ───────────────────────────────────────────────────
  const createDemoProduct = async () => {
    // Résoudre une sous-catégorie existante ou en créer une de démo
    let subcategoryId: string | undefined;
    try {
      const subs = await apiClient.get('/subcategories');
      if (subs && subs.length > 0) {
        subcategoryId = subs[0].id;
      } else {
        // Aucune sous-catégorie : créer une catégorie + sous-catégorie de démo
        let catId: string;
        try {
          const cats = await apiClient.get('/categories');
          catId = cats && cats.length > 0 ? cats[0].id : (await apiClient.post('/categories', { name: 'Général', description: 'Catégorie générale' })).id;
        } catch {
          catId = (await apiClient.post('/categories', { name: 'Général', description: 'Catégorie générale' })).id;
        }
        const newSub = await apiClient.post('/subcategories', { name: 'Divers', categoryId: catId });
        subcategoryId = newSub.id;
      }
    } catch {
      // Si la résolution de sous-catégorie échoue, on tente quand même la création
    }

    await apiClient.request('/stock', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Produit Démo GeStockPro',
        unitPrice: 15000,
        quantity: 50,
        minThreshold: 10,
        ...(subcategoryId ? { subcategoryId } : {}),
      }),
    });
  };

  const createDemoService = async () => {
    await apiClient.request('/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Service Démo GeStockPro',
        description: 'Créé automatiquement par le guide de démarrage',
        price: 25000,
        isActive: true,
      }),
    });
  };

  const createDemoCustomer = async () => {
    await apiClient.request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Client Démo SA',
        mainContact: firstName,
        email: `demo.${Date.now().toString().slice(-4)}@example.com`,
        phone: '+221 77 000 0001',
        paymentTerms: 30,
      }),
    });
  };

  // ─── Steps definition ─────────────────────────────────────────────────────
  const steps: TourStep[] = [
    {
      id: 'welcome',
      icon: Sparkles,
      iconColor: '#6366f1',
      title: `Bienvenue, ${firstName} !`,
      description: `Votre espace GeStockPro est prêt. Ce guide interactif vous présente les modules clés de votre plan ${planName} en quelques minutes.`,
      tip: `Environ 3 minutes · Vous pouvez quitter et reprendre à tout moment`,
    },
    {
      id: 'dashboard-overview',
      tab: 'dashboard',
      targetId: 'tour-kpi-grid',
      icon: LayoutDashboard,
      iconColor: '#6366f1',
      title: 'Votre tableau de bord',
      description: 'Ces 8 cartes affichent vos métriques en temps réel : chiffre d\'affaires, trésorerie, créances, clients, stock... Cliquez sur une carte pour accéder directement au module correspondant.',
      tip: 'Les chiffres se mettent à jour automatiquement à chaque vente ou mouvement de stock',
    },
    {
      id: 'dashboard-chart',
      tab: 'dashboard',
      targetId: 'tour-chart',
      icon: BarChart3,
      iconColor: '#10b981',
      title: 'Visualisez votre croissance',
      description: 'Ce graphique compare votre CA facturé à votre CA encaissé mois par mois. Utilisez le filtre par année pour analyser vos tendances historiques et identifier vos meilleures périodes.',
      tip: 'La courbe verte = encaissé réel. L\'écart avec le CA indigo = vos créances en cours',
    },
    {
      id: 'stock',
      tab: 'inventory',
      icon: Package,
      iconColor: '#f59e0b',
      title: 'Gestion du Catalogue Stock',
      description: 'Créez vos références produits, gérez les niveaux de stock, configurez des seuils d\'alerte et suivez tous les mouvements d\'entrée et de sortie en temps réel.',
      tip: 'Vous pouvez importer votre catalogue existant en masse depuis un fichier CSV',
      demoAction: {
        label: 'Créer un produit démo',
        successLabel: 'Produit créé !',
        fn: createDemoProduct,
      },
    },
    {
      id: 'services',
      tab: 'inventory',
      icon: Receipt,
      iconColor: '#6366f1',
      title: 'Catalogue de Services',
      description: 'En plus des produits physiques, vous pouvez vendre des services (conseil, installation, maintenance...). Ils apparaissent dans le même formulaire de vente.',
      tip: 'Les services ne génèrent pas de mouvement de stock',
      demoAction: {
        label: 'Créer un service démo',
        successLabel: 'Service créé !',
        fn: createDemoService,
      },
    },
    {
      id: 'customers',
      tab: 'customers',
      icon: Users,
      iconColor: '#3b82f6',
      title: 'Votre Portefeuille Clients',
      description: 'Ajoutez vos clients, suivez leurs soldes en temps réel, consultez l\'historique de leurs commandes et gérez les factures en attente de règlement.',
      tip: 'Le score de santé client (vert/rouge) vous alerte sur les clients à risque de non-paiement',
      demoAction: {
        label: 'Créer un client démo',
        successLabel: 'Client créé !',
        fn: createDemoCustomer,
      },
    },
    {
      id: 'sales',
      tab: 'sales',
      icon: Receipt,
      iconColor: '#8b5cf6',
      title: 'Ventes & Facturation',
      description: 'Créez des devis, convertissez-les en factures en un clic, enregistrez les paiements partiels ou complets et suivez les créances clients depuis un seul endroit.',
      tip: 'Les factures générées respectent automatiquement votre préfixe et vos mentions légales configurés',
    },
    ...(isPro ? [{
      id: 'recovery',
      tab: 'recovery',
      icon: BarChart3,
      iconColor: '#ef4444',
      title: 'Recouvrement des Créances',
      description: 'Identifiez les factures impayées, relancez vos clients automatiquement et suivez le taux d\'encaissement de votre portefeuille.',
      tip: 'Disponible sur votre plan ' + planName,
    } as TourStep] : []),
    ...(isEnterprise ? [{
      id: 'rh',
      tab: 'rh',
      icon: Users,
      iconColor: '#b45309',
      title: 'Module Ressources Humaines',
      description: 'Gérez vos employés, contrats, fiche de paie, congés et pointages depuis le module RH complet inclus dans votre plan Enterprise Cloud.',
      tip: 'Configurez vos départements et paramètres de paie pour commencer',
    } as TourStep] : []),
    {
      id: 'done',
      tab: 'dashboard',
      icon: CheckCircle2,
      iconColor: '#10b981',
      title: 'Vous êtes prêt !',
      description: `Votre tableau de bord se met à jour en temps réel. Explorez les autres modules (Fournisseurs, Trésorerie, Gouvernance, Support...) à votre rythme.`,
      tip: 'Retrouvez ce guide à tout moment via le menu Support',
    },
  ];

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const isWelcome = step.id === 'welcome';
  const isDone = step.id === 'done';

  // ─── Spotlight logic ──────────────────────────────────────────────────────
  const updateSpotlight = useCallback(() => {
    if (!step.targetId) {
      setSpotlightRect(null);
      return;
    }
    const el = document.getElementById(step.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    } else {
      setSpotlightRect(null);
    }
  }, [step.targetId]);

  // Navigate and then update spotlight after DOM settles
  useEffect(() => {
    setCardVisible(false);
    setSpotlightRect(null);

    const needsNav = step.tab && step.tab !== currentTab;
    if (needsNav) {
      setIsNavigating(true);
      onNavigate(step.tab!);
    }

    const delay = needsNav ? 700 : 300;
    const timer = setTimeout(() => {
      updateSpotlight();
      setIsNavigating(false);
      setCardVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-compute spotlight on scroll/resize
  useEffect(() => {
    const handler = () => updateSpotlight();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [updateSpotlight]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const goNext = () => {
    if (isLast) {
      markComplete();
      return;
    }
    setStepIndex(i => i + 1);
  };

  const goPrev = () => {
    if (!isFirst) setStepIndex(i => i - 1);
  };

  const markComplete = () => {
    try {
      localStorage.setItem(`tour_done_${user?.id || user?.tenantId || 'anon'}`, '1');
    } catch {}
    onComplete();
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(`tour_done_${user?.id || user?.tenantId || 'anon'}`, 'skipped');
    } catch {}
    onSkip();
  };

  const handleDemoAction = async () => {
    if (!step.demoAction) return;
    setDemoLoading(true);
    try {
      await step.demoAction.fn();
      setDemoSuccess(prev => ({ ...prev, [step.id]: true }));
      if (step.id === 'stock' || step.id === 'services') onDemoCreated?.('inventory');
      if (step.id === 'customers') onDemoCreated?.('customers');
    } catch {
      setDemoSuccess(prev => ({ ...prev, [step.id]: true })); // mark success anyway (data may exist)
    } finally {
      setDemoLoading(false);
    }
  };

  // ─── Card positioning ─────────────────────────────────────────────────────
  const getCardStyle = (): React.CSSProperties => {
    if (isWelcome || isDone || !spotlightRect) {
      return { bottom: 32, right: 32, position: 'fixed' };
    }
    // Position card below or above the spotlight
    const spBottom = spotlightRect.top + spotlightRect.height;
    const viewportH = window.innerHeight;
    const cardH = 280;
    const PADDING = 16;
    if (spBottom + cardH + PADDING < viewportH) {
      return {
        position: 'fixed',
        top: spBottom + PADDING + 8,
        right: 32,
      };
    }
    return {
      position: 'fixed',
      bottom: viewportH - spotlightRect.top + PADDING + 8,
      right: 32,
    };
  };

  const planBadgeColor = isEnterprise ? '#b45309' : isPro ? '#4f46e5' : '#2563eb';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spotlight dimming overlay */}
      {spotlightRect && cardVisible && (
        <div
          className="pointer-events-none transition-all duration-500"
          style={{
            position: 'fixed',
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
            borderRadius: '20px',
            zIndex: 9100,
            border: `2px solid rgba(99, 102, 241, 0.55)`,
            animation: 'tourPulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes tourPulse {
          0%, 100% { border-color: rgba(99,102,241,0.55); box-shadow: 0 0 0 9999px rgba(2,6,23,0.72), 0 0 0 0 rgba(99,102,241,0.3); }
          50% { border-color: rgba(99,102,241,0.9); box-shadow: 0 0 0 9999px rgba(2,6,23,0.72), 0 0 0 6px rgba(99,102,241,0.15); }
        }
        @keyframes tourSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Floating tour card */}
      <div
        className="z-[9200] w-[340px]"
        style={{
          ...getCardStyle(),
          animation: cardVisible ? 'tourSlideIn 0.35s ease-out forwards' : 'none',
          opacity: cardVisible ? 1 : 0,
          pointerEvents: cardVisible ? 'all' : 'none',
        }}
      >
        <div className="bg-white rounded-[1.5rem] shadow-[0_24px_60px_rgba(0,0,0,0.18)] border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: step.iconColor + '18' }}
              >
                <step.icon size={16} style={{ color: step.iconColor }} />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  {isWelcome ? 'Guide de démarrage' : isDone ? 'Terminé !' : `Étape ${stepIndex} / ${steps.length - 2}`}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: planBadgeColor + '18', color: planBadgeColor }}
                  >
                    {planName}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
              {step.title}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
              {step.description}
            </p>

            {step.tip && (
              <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <Zap size={11} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[9px] text-slate-500 font-bold leading-relaxed">{step.tip}</p>
              </div>
            )}

            {/* Demo action button */}
            {step.demoAction && (
              <button
                onClick={handleDemoAction}
                disabled={demoLoading || demoSuccess[step.id]}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border"
                style={
                  demoSuccess[step.id]
                    ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }
                    : { backgroundColor: step.iconColor + '10', borderColor: step.iconColor + '30', color: step.iconColor }
                }
              >
                {demoLoading ? (
                  <><Loader2 size={12} className="animate-spin" /> Création...</>
                ) : demoSuccess[step.id] ? (
                  <><Check size={12} /> {step.demoAction.successLabel}</>
                ) : (
                  <><step.icon size={12} /> {step.demoAction.label}</>
                )}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-1.5">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all duration-400"
                  style={{
                    backgroundColor: i <= stepIndex ? step.iconColor : '#e2e8f0',
                    opacity: i === stepIndex ? 1 : i < stepIndex ? 0.7 : 0.3,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="px-5 pb-5 pt-3 flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={goPrev}
                disabled={isNavigating}
                className="px-4 py-2.5 border border-slate-100 text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              >
                <ChevronLeft size={12} /> Retour
              </button>
            )}
            <button
              onClick={goNext}
              disabled={isNavigating}
              className="flex-1 py-2.5 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              style={{ backgroundColor: step.iconColor }}
            >
              {isNavigating ? (
                <><Loader2 size={12} className="animate-spin" /> Chargement...</>
              ) : isDone ? (
                <><CheckCircle2 size={12} /> Commencer</>
              ) : isWelcome ? (
                <>C'est parti ! <ArrowRight size={12} /></>
              ) : (
                <>Suivant <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>
          </div>
        </div>

        {/* Step counter below card */}
        {!isWelcome && !isDone && (
          <div className="text-center mt-2">
            <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">
              {stepIndex}/{steps.length - 2} · <button onClick={handleSkip} className="underline hover:text-white/80 transition-colors">Passer le guide</button>
            </span>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Static helper ────────────────────────────────────────────────────────────
export const shouldShowTour = (userId: string): boolean => {
  try {
    return !localStorage.getItem(`tour_done_${userId || 'anon'}`);
  } catch {
    return false;
  }
};

export default DashboardTour;
