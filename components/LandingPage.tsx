// Options de durée d'abonnement
const PERIOD_OPTIONS = [
  { id: '1M', label: '1 Mois', months: 1, discountPct: 0 },
  { id: '3M', label: '3 Mois', months: 3, discountPct: 15 },
  { id: '1Y', label: '1 An', months: 12, discountPct: 30 },
];

function getPeriodPrice(baseMonthlyPrice: number, periodId: string) {
  const opt = PERIOD_OPTIONS.find(p => p.id === periodId);
  if (!opt) return baseMonthlyPrice;
  const fullPrice = baseMonthlyPrice * opt.months;
  return Math.round(fullPrice * (1 - opt.discountPct / 100));
}

import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Zap,
  ShieldCheck,
  BarChart3,
  Users,
  Package,
  CreditCard,
  Layers,
  Lock,
  RefreshCw,
  Globe,
  Cpu,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Star,
  Plus,
  Minus,
  ShieldAlert,
  FileText,
  Send,
  Loader2
} from 'lucide-react';

import logo from '../assets/logo_gestockpro.png';
import logo_removebg from '../assets/logo_gestockpro-removebg-preview.png';
import MentionsLegales from './legal/MentionsLegales';
import PolitiqueConfidentialite from './legal/PolitiqueConfidentialite';
import CGU from './legal/CGU';
import PolitiqueCookies from './legal/PolitiqueCookies';

interface LandingPageProps {
  onLogin: (opts?: { openRegister?: boolean; planId?: string; regStep?: number }) => void;
}

const buildTimeBackend = (import.meta as any).env?.VITE_BACKEND_URL;
let rawBackend: string;

if (buildTimeBackend) {
  // Variable d'environnement explicite définie
  rawBackend = buildTimeBackend;
} else {
  try {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    // En développement avec Vite (localhost:5173-5179), pointer vers le backend sur port 3000
    if (origin && /localhost:517[3-9]/.test(origin)) {
      //rawBackend = 'http://localhost:3000';
      rawBackend = 'https://gestock.realtechprint.com';
    } else if (origin && !/localhost|127\.0\.0\.1/.test(origin)) {
      // Production: API co-localisée sous la même origine
      rawBackend = origin;
    } else {
      // Fallback pour développement
      //rawBackend = 'http://localhost:3000';
      rawBackend = 'https://gestock.realtechprint.com';
    }
  } catch (e) {
    //rawBackend = 'http://localhost:3000';
    rawBackend = 'https://gestock.realtechprint.com';
  }
}

type LegalPage = 'mentions' | 'confidentialite' | 'cgu' | 'cookies' | null;

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [activeLegalPage, setActiveLegalPage] = useState<LegalPage>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  // État du formulaire de contact
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    message: ''
  });
  // Champ honeypot anti-bot (doit rester vide)
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Fonction pour gérer les changements dans le formulaire
  const handleContactInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Fonction pour envoyer le message de contact
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot : si ce champ est rempli, c'est un bot — on abandonne silencieusement
    if (honeypot.trim() !== '') return;

    // Validation basique côté client
    if (!contactForm.fullName.trim() || contactForm.fullName.trim().length < 2) {
      setSubmitStatus('error');
      setSubmitMessage('Le nom complet est requis et doit contenir au moins 2 caractères.');
      return;
    }
    
    // Emails explicitement bannis
    const BLOCKED_EMAILS_CLIENT = new Set([
      'jm.koffi@agrobusiness.ci',
      'moussa.diop@example.com',
      'awa.ndiaye@fashion.sn',
    ]);
    // Domaines de test / jetables connus
    const BLOCKED_DOMAINS_CLIENT = new Set([
      'example.com', 'example.org', 'example.net',
      'test.com', 'test.org', 'test.net',
      'localhost.com',
      'mailinator.com', 'guerrillamail.com', 'tempmail.com',
      'throwaway.email', 'yopmail.com', 'trashmail.com',
      'maildrop.cc', 'discard.email', 'sharklasers.com',
      'spam4.me', 'fakeinbox.com', 'mailnull.com',
      'getairmail.com', 'dispostable.com', 'nospammail.net',
    ]);

    const rawEmail = contactForm.email.trim().toLowerCase();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
      setSubmitStatus('error');
      setSubmitMessage('Veuillez saisir une adresse email valide.');
      return;
    }

    if (BLOCKED_EMAILS_CLIENT.has(rawEmail)) {
      setSubmitStatus('error');
      setSubmitMessage('Cette adresse email n\'est pas autorisée à envoyer des messages.');
      return;
    }

    const emailDomain = rawEmail.split('@')[1];
    if (BLOCKED_DOMAINS_CLIENT.has(emailDomain)) {
      setSubmitStatus('error');
      setSubmitMessage('Veuillez utiliser une adresse email professionnelle valide. Les adresses temporaires ou de test ne sont pas acceptées.');
      return;
    }
    
    if (!contactForm.message.trim() || contactForm.message.trim().length < 10) {
      setSubmitStatus('error');
      setSubmitMessage('Le message doit contenir au moins 10 caractères.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      const response = await fetch(`${rawBackend}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...contactForm, website: honeypot }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage(data.message || 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.');
        // Réinitialiser le formulaire
        setContactForm({
          fullName: '',
          email: '',
          phone: '',
          message: ''
        });
      } else {
        setSubmitStatus('error');
        setSubmitMessage(data.error || 'Une erreur s\'est produite lors de l\'envoi du message.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      setSubmitStatus('error');
      setSubmitMessage('Impossible de se connecter au serveur. Veuillez vérifier votre connexion et réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-clear des messages de statut
  React.useEffect(() => {
    if (submitStatus !== 'idle') {
      const timer = setTimeout(() => {
        setSubmitStatus('idle');
        setSubmitMessage('');
      }, 8000); // Message affiché pendant 8 secondes
      
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  const features = [
    {
      icon: <Layers className="text-indigo-500" />,
      title: "Catégories & Sous-catégories",
      description: "Organisation granulaire de votre catalogue pour une recherche instantanée."
    },
    {
      icon: <Package className="text-indigo-500" />,
      title: "Inventaire & Mouvements",
      description: "Suivi en temps réel des stocks avec alertes automatiques de rupture."
    },
    {
      icon: <Zap className="text-indigo-500" />,
      title: "Gestion des Services",
      description: "Vendez vos prestations aussi facilement que vos produits physiques."
    },
    {
      icon: <Users className="text-indigo-500" />,
      title: "Gestion Clients CRM",
      description: "Centralisez l'historique et les préférences de vos clients fidèles."
    },
    {
      icon: <FileText className="text-indigo-500" />,
      title: "Ventes & Facturation",
      description: "Générez des factures professionnelles et suivez vos devis en un clic."
    },
    {
      icon: <CreditCard className="text-indigo-500" />,
      title: "Paiements & Trésorerie",
      description: "Intégration Stripe et Mobile Money pour une encaissement fluide."
    },
    {
      icon: <ShieldCheck className="text-indigo-500" />,
      title: "Gouvernance & RBAC",
      description: "Contrôlez précisément qui accède à quoi avec des rôles personnalisés."
    },
    {
      icon: <RefreshCw className="text-indigo-500" />,
      title: "Sécurité & Recovery",
      description: "Sauvegardes automatiques et protocoles de résilience de niveau bancaire."
    },
    {
      icon: <BarChart3 className="text-indigo-500" />,
      title: "Dashboard Analytique",
      description: "Visualisez vos performances avec des graphiques intelligents et prédictifs."
    },
    {
      icon: <Cpu className="text-indigo-500" />,
      title: "Inventory Campaigns",
      description: "Audits de stock massifs assistés par IA pour les grandes entreprises."
    }
  ];

  const faqs = [
    {
      question: "GeStockPro est-il adapté à une très petite entreprise ?",
      answer: "Absolument. Notre plan Starter AI est conçu spécifiquement pour les indépendants et TPE qui souhaitent professionnaliser leur gestion sans complexité inutile."
    },
    {
      question: "Mes données sont-elles en sécurité ?",
      answer: "Nous utilisons un chiffrement AES-256 et des sauvegardes redondantes sur plusieurs zones géographiques. Votre sécurité est notre priorité absolue."
    },
    {
      question: "Puis-je changer de plan à tout moment ?",
      answer: "Oui, vous pouvez upgrader ou downgrader votre abonnement directement depuis votre interface de gestion sans interruption de service."
    },
    {
      question: "L'IA est-elle incluse dans tous les plans ?",
      answer: "L'IA est au cœur de GeStockPro. Tous les plans bénéficient de fonctionnalités intelligentes, avec des capacités avancées (prédictions, chatbot) sur les plans PRO et Enterprise."
    }
  ];

  const openLegal = (page: LegalPage) => {
    setActiveLegalPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeLegal = () => {
    setActiveLegalPage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeLegalPage === 'mentions') return <MentionsLegales onBack={closeLegal} />;
  if (activeLegalPage === 'confidentialite') return <PolitiqueConfidentialite onBack={closeLegal} />;
  if (activeLegalPage === 'cgu') return <CGU onBack={closeLegal} />;
  if (activeLegalPage === 'cookies') return <PolitiqueCookies onBack={closeLegal} />;

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900" style={{ 
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      fontSize: '16px',
      lineHeight: '1.5',
      fontWeight: '400'
    }}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200" style={{ fontFamily: 'inherit', fontSize: '14px' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" style={{ fontFamily: 'inherit' }}>
          <div className="flex items-center gap-3">
            <img src={logo_removebg} alt="GeStockPro" className="h-10 w-auto" />
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" style={{ fontSize: '14px', fontWeight: '500' }}>
            <a href="#features" className="hover:text-slate-900 transition-colors" style={{ textDecoration: 'none', fontSize: 'inherit', fontWeight: 'inherit' }}>Fonctionnalités</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors" style={{ textDecoration: 'none', fontSize: 'inherit', fontWeight: 'inherit' }}>Tarifs</a>
            <a href="#about" className="hover:text-slate-900 transition-colors" style={{ textDecoration: 'none', fontSize: 'inherit', fontWeight: 'inherit' }}>À propos</a>
            <a href="#contact" className="hover:text-slate-900 transition-colors" style={{ textDecoration: 'none', fontSize: 'inherit', fontWeight: 'inherit' }}>Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onLogin}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              style={{ fontSize: '14px', fontWeight: '500', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Connexion
            </button>
            <button 
              onClick={onLogin}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              style={{ fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Essayer gratuitement
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 md:pt-40 pb-12 md:pb-20 px-4 md:px-6" style={{ fontFamily: 'inherit' }}>
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6" style={{ fontSize: '10px', fontWeight: '900', fontFamily: 'inherit' }}>
              <Zap size={12} /> AI-Native ERP for Modern Business
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.9] mb-8 uppercase" style={{ fontSize: 'clamp(1.875rem, 8vw, 7rem)', fontWeight: '900', lineHeight: '0.9', fontFamily: 'inherit', margin: '0 0 2rem 0' }}>
              Pilotez votre entreprise avec <span className="text-indigo-600">intelligence.</span>
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed mb-10 max-w-lg" style={{ fontSize: '20px', fontWeight: '500', lineHeight: '1.7', fontFamily: 'inherit', margin: '0 0 2.5rem 0' }}>
              GeStockPro est un ERP léger intelligent conçu pour simplifier la gestion des ventes, stocks, clients et trésorerie des TPE et PME africaines.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => onLogin({ openRegister: true, planId: 'BASIC', regStep: 1 })}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200"
                style={{ fontSize: '14px', fontWeight: '900', fontFamily: 'inherit', border: 'none', cursor: 'pointer' }}
              >
                Essayer gratuitement <ArrowRight size={18} />
              </button>
              <a 
                href="#pricing"
                className="px-8 py-4 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest hover:border-slate-900 transition-all"
                style={{ fontSize: '14px', fontWeight: '900', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Voir les tarifs
              </a>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium border border-white" style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}>M</div>
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium border border-white" style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}>A</div>
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium border border-white" style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}>S</div>
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium border border-white" style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}>+</div>
              </div>
              <p className="text-sm text-slate-500" style={{ fontSize: '14px', fontWeight: '400', fontFamily: 'inherit' }}>
                Utilisé par +500 entreprises
              </p>
            </div>
          </div>
          <div className="relative mt-10 lg:mt-0">
            <div className="bg-slate-100 border border-slate-200 p-3">
              <div className="bg-white h-6 flex items-center gap-2 px-4 border-b border-slate-100">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              </div>
              <div className="w-full h-80 bg-slate-50 flex items-center justify-center">
                <img src={logo} alt="GeStockPro Dashboard" className="h-24 w-auto opacity-60" />
              </div>
            </div>
            {/* Floating Stats */}
            <div className="absolute -bottom-10 -left-4 md:-left-10 bg-white p-4 md:p-6 rounded-3xl shadow-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="text-emerald-600" size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}>Ventes aujourd'hui</p>
                  <p className="text-lg font-black text-slate-900" style={{ fontSize: '18px', fontWeight: '900', fontFamily: 'inherit' }}>+24.5%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-8 md:py-16 bg-slate-50" style={{ fontFamily: 'inherit' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4" style={{ fontWeight: '700', fontFamily: 'inherit', margin: '0 0 1rem 0' }}>Pourquoi changer maintenant ?</h2>
            <p className="text-slate-600" style={{ fontSize: '16px', fontWeight: '400', fontFamily: 'inherit' }}>Les méthodes traditionnelles freinent votre croissance. Identifiez les goulots d'étranglement avant qu'ils ne deviennent critiques.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Perte de temps", desc: "Des heures perdues sur des fichiers Excel complexes et des saisies manuelles répétitives." },
              { title: "Stocks opaques", desc: "Des ruptures imprévues ou des surstocks immobilisant votre précieuse trésorerie." },
              { title: "Facturation lente", desc: "Des délais de paiement rallongés par une facturation manuelle et peu professionnelle." },
              { title: "Erreurs de caisse", desc: "Un manque de visibilité sur les flux réels entraînant des écarts de trésorerie." },
              { title: "Manque de vision", desc: "Prendre des décisions à l'aveugle sans données analytiques fiables en temps réel." },
              { title: "Sécurité fragile", desc: "Risque de perte de données critiques sans système de sauvegarde automatisé." }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 border border-slate-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 flex items-center justify-center mb-4">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-lg font-semibold mb-3" style={{ fontSize: '18px', fontWeight: '600', fontFamily: 'inherit', margin: '0 0 0.75rem 0' }}>{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed" style={{ fontSize: '14px', fontWeight: '400', lineHeight: '1.6', fontFamily: 'inherit' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-12 md:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="absolute -inset-10 bg-indigo-500/5 blur-3xl rounded-full"></div>
              <div className="relative w-full rounded-[4rem] shadow-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-20">
                <img src={logo} alt="GeStockPro Solution" className="h-74 w-auto" />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
                <CheckCircle2 size={12} /> La Solution Ultime
              </div>
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
                L'ERP qui pense <span className="text-indigo-600">pour vous.</span>
              </h2>
              <div className="space-y-8">
                {[
                  { title: "Centralisation Totale", desc: "Toutes vos données commerciales au même endroit, accessibles partout.", icon: <Layers /> },
                  { title: "Automatisation Intelligente", desc: "L'IA s'occupe des tâches répétitives pour vous libérer du temps.", icon: <Zap /> },
                  { title: "Sécurité de Niveau Bancaire", desc: "Vos données sont cryptées et sauvegardées automatiquement.", icon: <Lock /> },
                  { title: "Simplicité Déconcertante", desc: "Une interface intuitive que votre équipe maîtrisera en 15 minutes.", icon: <Globe /> }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="flex-shrink-0 w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-black uppercase tracking-tight mb-2">{item.title}</h4>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-8 md:py-16 bg-slate-900 text-white" style={{ fontFamily: 'inherit' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4" style={{ fontWeight: '700', fontFamily: 'inherit', margin: '0 0 1rem 0' }}>Fonctionnalités</h2>
            <p className="text-slate-400" style={{ fontSize: '16px', fontWeight: '400', fontFamily: 'inherit' }}>Un arsenal complet d'outils conçus pour votre efficacité opérationnelle.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-4 md:p-6 bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="w-10 h-10 bg-slate-700 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold mb-3" style={{ fontSize: '18px', fontWeight: '600', fontFamily: 'inherit', margin: '0 0 0.75rem 0' }}>{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed" style={{ fontSize: '14px', fontWeight: '400', lineHeight: '1.6', fontFamily: 'inherit' }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #020617 0%, #0d0a2e 45%, #020617 100%)' }}>
        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)' }} />
          <div className="absolute top-[40%] left-[50%] w-[800px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)' }} />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}>
              <Zap size={12} className="text-indigo-400" />
              <span className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">Tarification simple & transparente</span>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-5 leading-none uppercase">
              Investissez dans <br />
              <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>votre croissance</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium max-w-xl mx-auto leading-relaxed">
              14 jours d'essai gratuit inclus. Aucune carte bancaire. Passez au niveau supérieur quand vous êtes prêt.
            </p>
          </div>

          {/* Period Toggle */}
          <div className="flex justify-center mb-10">
            <div className="p-1 rounded-2xl flex gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedPeriod(opt.id)}
                  className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                  style={selectedPeriod === opt.id
                    ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }
                    : { color: 'rgba(148,163,184,1)', background: 'transparent' }
                  }
                >
                  {opt.label}
                  {opt.discountPct > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black"
                      style={selectedPeriod === opt.id
                        ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                        : { background: 'rgba(16,185,129,0.15)', color: '#34d399' }
                      }>
                      -{opt.discountPct}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Free Trial Banner */}
          <div className="max-w-3xl mx-auto mb-10 flex items-center justify-between gap-4 px-6 py-4 rounded-2xl flex-wrap" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Star size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-300 font-black text-sm uppercase tracking-wide">Essai gratuit · 14 jours</p>
                <p className="text-emerald-600 text-xs font-semibold">Accès complet à toutes les fonctionnalités · Aucune carte requise</p>
              </div>
            </div>
            <button
              onClick={() => onLogin({ openRegister: true, planId: 'FREE_TRIAL', regStep: 1 })}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0"
              style={{ background: 'rgba(16,185,129,0.9)', color: '#fff' }}
            >
              Démarrer gratuit <ArrowRight size={13} />
            </button>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">

            {/* ── BASIC / Starter AI ── */}
            <div className="rounded-[2rem] p-8 flex flex-col h-full transition-all group hover:translate-y-[-4px]"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(96,165,250,0.2)', backdropFilter: 'blur(12px)' }}>
              {/* Plan icon + name */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)' }}>
                  <Zap size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Starter AI</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Pour les TPE & indépendants</p>
                </div>
              </div>
              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-black text-white tracking-tighter">{getPeriodPrice(7900, selectedPeriod).toLocaleString()}</span>
                  <span className="text-slate-400 font-bold text-sm">FCFA</span>
                </div>
                <p className="text-slate-500 text-xs font-bold">par {PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label.toLowerCase()}</p>
                {selectedPeriod !== '1M' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <span className="text-emerald-400 text-[10px] font-black">
                      Économie {((7900 * (PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.months ?? 1)) - getPeriodPrice(7900, selectedPeriod)).toLocaleString()} FCFA
                    </span>
                  </div>
                )}
              </div>
              <p className="text-slate-400 text-sm font-medium mb-7 leading-relaxed">L'essentiel pour piloter votre activité au quotidien sans complexité.</p>
              {/* Features */}
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  { ok: true,  label: '3 utilisateur' },
                  { ok: true,  label: 'Stock illimité' },
                  { ok: true,  label: 'factures & devis illimités' },
                  { ok: true,  label: 'Gestion clients & fournisseurs' },
                  { ok: true,  label: 'Dashboard analytique' },
                  { ok: true,  label: 'Support email inclus' },
                  { ok: false, label: 'IA Chatbot & prévisions' },
                  { ok: false, label: 'Module RH' },
                ].map((f, i) => (
                  <li key={i} className={`flex items-center gap-3 text-sm font-medium ${f.ok ? 'text-slate-300' : 'text-slate-600'}`}>
                    {f.ok
                      ? <CheckCircle2 size={15} className="text-blue-400 shrink-0" />
                      : <span className="w-4 h-px bg-slate-700 shrink-0 ml-0.5" />
                    }
                    {f.label}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onLogin({ openRegister: true, planId: 'BASIC', regStep: 1, period: selectedPeriod })}
                className="w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-400/10"
                style={{ border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd', background: 'rgba(96,165,250,0.05)' }}
              >
                Choisir Starter AI
              </button>
            </div>

            {/* ── PRO / Business Pro — FEATURED ── */}
            <div className="rounded-[2rem] flex flex-col relative md:-mt-6 md:-mb-6 transition-all hover:translate-y-[-4px]"
              style={{ background: 'linear-gradient(145deg, #4338ca 0%, #5b21b6 60%, #4f46e5 100%)', boxShadow: '0 30px 80px rgba(79,70,229,0.45), 0 0 0 1px rgba(165,180,252,0.15) inset' }}>
              {/* Shine line top */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-[2rem]" style={{ background: 'linear-gradient(90deg, transparent, rgba(199,210,254,0.4), transparent)' }} />
              {/* Popular badge — centré EN HAUT, en dehors du clip */}
              <div className="flex justify-center pt-4 pb-0">
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest z-10"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', color: '#431407', boxShadow: '0 4px 16px rgba(251,191,36,0.5)' }}>
                  <Star size={9} fill="#431407" /> Le Plus Populaire
                </div>
              </div>

              <div className="p-8 pt-10 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <BarChart3 size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Business Pro</p>
                    <p className="text-[9px] font-bold text-indigo-300/60 uppercase tracking-widest">Pour les PME en croissance</p>
                  </div>
                </div>
                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-4xl font-black text-white tracking-tighter">{getPeriodPrice(19900, selectedPeriod).toLocaleString()}</span>
                    <span className="text-indigo-200 font-bold text-sm">FCFA</span>
                  </div>
                  <p className="text-indigo-300/70 text-xs font-bold">par {PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label.toLowerCase()}</p>
                  {selectedPeriod !== '1M' && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <span className="text-emerald-300 text-[10px] font-black">
                        Économie {((19900 * (PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.months ?? 1)) - getPeriodPrice(19900, selectedPeriod)).toLocaleString()} FCFA
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-indigo-200 text-sm font-medium mb-7 leading-relaxed">Accélérez votre croissance avec l'IA intégrée et les analyses avancées.</p>
                {/* Features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    '10 utilisateurs',
                    'Transactions illimitées',
                    'IA Chatbot intégré',
                    'Prévisions de stock IA',
                    'Recouvrement des créances',
                    'Rapports avancés & exports',
                    'Facturation Factur-X légale',
                    'Support prioritaire',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-white/85">
                      <CheckCircle2 size={15} className="text-indigo-200 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onLogin({ openRegister: true, planId: 'PRO', regStep: 1, period: selectedPeriod })}
                  className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-indigo-100"
                  style={{ background: '#fff', color: '#3730a3', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}
                >
                  Choisir Business Pro <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* ── ENTERPRISE ── */}
            <div className="rounded-[2rem] p-8 flex flex-col h-full transition-all group hover:translate-y-[-4px]"
              style={{ background: 'rgba(15,10,30,0.85)', border: '1px solid rgba(251,191,36,0.2)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
                  <Globe size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Enterprise Cloud</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Pour les grandes structures</p>
                </div>
              </div>
              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-black text-white tracking-tighter">{getPeriodPrice(69000, selectedPeriod).toLocaleString()}</span>
                  <span className="text-slate-400 font-bold text-sm">FCFA</span>
                </div>
                <p className="text-slate-500 text-xs font-bold">par {PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label.toLowerCase()}</p>
                {selectedPeriod !== '1M' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <span className="text-emerald-400 text-[10px] font-black">
                      Économie {((69000 * (PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.months ?? 1)) - getPeriodPrice(69000, selectedPeriod)).toLocaleString()} FCFA
                    </span>
                  </div>
                )}
              </div>
              <p className="text-slate-400 text-sm font-medium mb-7 leading-relaxed">La suite complète pour les grandes structures multi-entités avec RH intégré.</p>
              {/* Features */}
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  'utilisateurs illimités',
                  'Module RH complet (paie, congés)',
                  'Inventory Campaigns IA',
                  'Multi-entités & filiales',
                  'Gouvernance & Audit complet',
                  'Infrastructure dédiée',
                  'Gestionnaire de compte dédié',
                  'Support Premium 24/7',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onLogin({ openRegister: true, planId: 'ENTERPRISE', regStep: 1, period: selectedPeriod })}
                className="w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-amber-400/10"
                style={{ border: '1px solid rgba(251,191,36,0.3)', color: '#fcd34d', background: 'rgba(251,191,36,0.05)' }}
              >
                Choisir Enterprise
              </button>
            </div>
          </div>

          {/* Trust footer */}
          <div className="mt-14 text-center">
            <p className="text-slate-600 text-sm font-medium mb-5">Tous les plans incluent SSL, sauvegardes automatiques et mises à jour continues.</p>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {[
                { icon: <ShieldCheck size={15} />, label: 'SSL & Chiffrement AES-256' },
                { icon: <RefreshCw size={15} />, label: 'Sauvegardes automatiques' },
                { icon: <CreditCard size={15} />, label: 'Stripe & Mobile Money' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                  <span className="text-slate-600">{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Why Us Section */}
      <section className="py-12 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter uppercase mb-12">Pourquoi choisir <span className="text-indigo-600">GeStockPro ?</span></h2>
              <div className="grid sm:grid-cols-2 gap-8">
                {[
                  { title: "Sécurité Renforcée", desc: "Protocoles de sécurité militaires pour vos données.", icon: <ShieldCheck /> },
                  { title: "Cloud Scalable", desc: "Une infrastructure qui grandit avec votre succès.", icon: <Globe /> },
                  { title: "AI-Native", desc: "L'intelligence artificielle intégrée nativement.", icon: <Cpu /> },
                  { title: "Performance", desc: "Une rapidité d'exécution inégalée sur le marché.", icon: <Zap /> }
                ].map((item, i) => (
                  <div key={i}>
                    <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
                      {item.icon}
                    </div>
                    <h4 className="text-sm font-black uppercase mb-2">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 rounded-[3rem] p-6 md:p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full"></div>
              <h3 className="text-3xl font-black tracking-tighter uppercase mb-8 leading-tight">Optimisez votre trésorerie dès aujourd'hui.</h3>
              <p className="text-slate-400 font-medium mb-10 leading-relaxed">
                Nos clients constatent en moyenne une réduction de 30% de leurs coûts opérationnels dès les 3 premiers mois d'utilisation.
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider">+15% de marge nette moyenne</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider">-40% de temps administratif</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter uppercase mb-6">Ils nous font confiance</h2>
            <div className="flex justify-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="text-amber-400 fill-amber-400" size={20} />)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Moussa Diop", role: "CEO, TechSolutions Dakar", text: "GeStockPro a radicalement changé notre façon de gérer nos stocks. L'IA nous prévient avant même que nous soyons en rupture." },
              { name: "Awa Ndiaye", role: "Gérante, Mode & Style", text: "La facturation est devenue un plaisir. Mes clients reçoivent des factures professionnelles et je suis payée plus rapidement." },
              { name: "Jean-Marc Koffi", role: "Directeur, AgroBusiness CI", text: "Un outil puissant, intuitif et surtout sécurisé. Le support client est réactif et très professionnel." }
            ].map((t, i) => (
              <div key={i} className="p-4 md:p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all">
                <p className="text-slate-600 italic mb-8 leading-relaxed text-sm">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{t.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 md:py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 blur-[120px] rounded-full"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[0.9] mb-10 uppercase">
                Notre Vision pour <span className="text-indigo-400">l'Afrique.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed mb-12">
                GeStockPro est né pour aider les TPE/PME africaines à entrer dans l'ère numérique avec un outil moderne, sécurisé et intelligent.
              </p>
              <div className="space-y-8">
                {[
                  { title: "Mission", desc: "Démocratiser l'accès aux technologies ERP de pointe pour toutes les entreprises." },
                  { title: "Vision", desc: "Devenir le standard de la gestion commerciale intelligente sur le continent." },
                  { title: "Engagement", desc: "Innovation constante et support de proximité pour nos partenaires." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-1 h-12 bg-indigo-500 rounded-full"></div>
                    <div>
                      <h4 className="text-lg font-black uppercase mb-2">{item.title}</h4>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-slate-800 rounded-[4rem] flex items-center justify-center p-12 border border-slate-700">
                <div className="text-center">
                  <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-600/20">
                    <Globe size={48} />
                  </div>
                  <p className="text-4xl font-black tracking-tighter uppercase mb-4">Basé à Dakar</p>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Rayonnement Continental</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter uppercase text-center mb-10 md:mb-16">Questions Fréquentes</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-black uppercase tracking-tight text-sm">{faq.question}</span>
                  {activeFaq === i ? <Minus size={18} /> : <Plus size={18} />}
                </button>
                {activeFaq === i && (
                  <div className="p-6 pt-0 text-slate-500 text-sm font-medium leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-12 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-20">
            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter uppercase mb-8">Contactez-nous</h2>
              <p className="text-slate-500 font-medium mb-12">Notre équipe d'experts est à votre écoute pour vous accompagner dans votre transformation digitale.</p>
              
              <div className="space-y-8">
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-indigo-600">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Professionnel</p>
                    <p className="text-lg font-black text-slate-900">diankaseydou52@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-emerald-500">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Business</p>
                    <p className="text-lg font-black text-slate-900">+221 78 131 13 71</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-slate-900">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siège Social</p>
                    <p className="text-lg font-black text-slate-900">Dakar, Sénégal</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-2xl border border-slate-100">
              {/* Message de statut */}
              {submitStatus !== 'idle' && (
                <div className={`mb-6 p-4 rounded-2xl border ${
                  submitStatus === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-3">
                    {submitStatus === 'success' ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : (
                      <ShieldAlert size={20} className="text-red-600" />
                    )}
                    <p className="font-medium text-sm" style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}>{submitMessage}</p>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleContactSubmit} className="space-y-6">
                {/* Honeypot anti-bot : caché visuellement, jamais rempli par un humain */}
                <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
                  <label htmlFor="website">Ne pas remplir</label>
                  <input
                    id="website"
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400" style={{ fontSize: '10px', fontWeight: '900', fontFamily: 'inherit' }}>Nom complet *</label>
                    <input
                      type="text"
                      name="fullName"
                      value={contactForm.fullName}
                      onChange={handleContactInputChange}
                      disabled={isSubmitting}
                      required
                      maxLength={100}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ex: Moussa Diop"
                      style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactInputChange}
                      disabled={isSubmitting}
                      required
                      maxLength={254}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ex: m.diop@tech.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={contactForm.phone}
                    onChange={handleContactInputChange}
                    disabled={isSubmitting}
                    maxLength={20}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="+221 ..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message *</label>
                  <textarea
                    name="message"
                    value={contactForm.message}
                    onChange={handleContactInputChange}
                    disabled={isSubmitting}
                    required
                    rows={4}
                    maxLength={5000}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Comment pouvons-nous vous aider ?"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Envoyer le message
                    </>
                  )}
                </button>
                
                <p className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                  * Champs obligatoires
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-indigo-600 rounded-2xl md:rounded-[4rem] px-4 py-8 sm:px-8 sm:py-12 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
              <div className="absolute -top-20 -left-20 w-96 h-96 bg-white blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-slate-900 blur-[100px] rounded-full"></div>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase mb-8 leading-tight">Prêt à transformer <br />votre gestion ?</h2>
              <p className="text-xl text-indigo-100 font-medium mb-12 max-w-2xl mx-auto">Rejoignez des centaines d'entrepreneurs qui ont déjà fait le choix de l'intelligence et de la simplicité.</p>
              <div className="flex flex-wrap justify-center gap-6">
                <button
                  onClick={onLogin}
                  className="px-6 md:px-10 py-3 md:py-5 bg-white text-indigo-600 rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-2xl"
                >
                  Essayer gratuitement
                </button>
                <button
                  onClick={onLogin}
                  className="px-6 md:px-10 py-3 md:py-5 bg-indigo-700 text-white border-2 border-indigo-500 rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest hover:bg-indigo-800 transition-all"
                >
                  Parler à un expert
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-8">
                <div className="flex items-center gap-3">
            <img src={logo_removebg} alt="GeStockPro" className="h-12 w-auto" />
          </div>
              </div>
              <p className="text-slate-500 font-medium max-w-sm leading-relaxed mb-8">
                L'ERP intelligent conçu pour propulser les TPE et PME africaines vers l'excellence opérationnelle.
              </p>
              <div className="flex gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer">
                    <Globe size={18} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest mb-8">Liens Rapides</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Accueil</a></li>
                <li><a href="#features" className="hover:text-indigo-600 transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-indigo-600 transition-colors">Tarifs</a></li>
                <li><a href="#about" className="hover:text-indigo-600 transition-colors">À propos</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest mb-8">Légal</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500">
                <li><button onClick={() => openLegal('confidentialite')} className="hover:text-indigo-600 transition-colors text-left">Confidentialité & RGPD</button></li>
                <li><button onClick={() => openLegal('cgu')} className="hover:text-indigo-600 transition-colors text-left">Conditions d'utilisation</button></li>
                <li><button onClick={() => openLegal('cookies')} className="hover:text-indigo-600 transition-colors text-left">Politique de Cookies</button></li>
                <li><button onClick={() => openLegal('mentions')} className="hover:text-indigo-600 transition-colors text-left">Mentions Légales</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">© 2024 GeStockPro. Tous droits réservés.</p>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Fait avec <Star size={12} className="text-indigo-500 fill-indigo-500" /> à Dakar
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;