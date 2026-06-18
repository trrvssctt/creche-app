
import React, { useState, useEffect } from 'react';
import {
  Lock, Mail, ArrowRight, ShieldCheck, AlertCircle,
  Eye, EyeOff, Zap, Check, ChevronLeft, RefreshCw,
  Building2, CreditCard, Sparkles, User as UserIcon,
  Star, WifiOff, X, MapPin, Phone, Briefcase, Info,
  Terminal, Shield, Smartphone, Copy, Dices
} from 'lucide-react';
import { User, UserRole } from '../types';
import logo from '../assets/logo_gestockpro.png';
import waveQr from '../assets/qr_code_marchant_wave.png';
import { authBridge } from '../services/authBridge';
import { apiClient, ApiError } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^[+\d][\d\s\-().]{6,19}$/;

const BLOCKED_EMAILS_SET = new Set([
  'jm.koffi@agrobusiness.ci',
  'moussa.diop@example.com',
  'awa.ndiaye@fashion.sn',
]);

const BLOCKED_DOMAINS_SET = new Set([
  'example.com', 'example.org', 'example.net',
  'test.com', 'test.org', 'test.net',
  'localhost.com',
  'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'trashmail.com',
  'maildrop.cc', 'discard.email', 'sharklasers.com',
  'spam4.me', 'fakeinbox.com', 'mailnull.com',
  'getairmail.com', 'dispostable.com', 'nospammail.net',
]);

const isBlockedEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  if (BLOCKED_EMAILS_SET.has(normalized)) return true;
  const domain = normalized.split('@')[1];
  return domain ? BLOCKED_DOMAINS_SET.has(domain) : false;
};

const strengthTextColor = (score: number): string => {
  if (score >= 6) return 'text-emerald-600';
  if (score >= 5) return 'text-green-600';
  if (score >= 4) return 'text-yellow-600';
  if (score >= 2) return 'text-orange-600';
  return 'text-red-600';
};

const attemptStyleClass = (attempts: number): string => {
  if (attempts === 1) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  if (attempts === 2) return 'bg-orange-50 text-orange-700 border border-orange-200';
  return 'bg-rose-50 text-rose-700 border border-rose-200';
};

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onBackToLanding: () => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'SUPERADMIN' | 'MFA';
  initialPlanId?: string;
  initialRegStep?: number;
  initialPeriod?: string;
  initialWavePending?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBackToLanding, initialMode, initialPlanId, initialRegStep, initialPeriod, initialWavePending }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'SUPERADMIN' | 'MFA'>('LOGIN');
  const [regStep, setRegStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // États Auth
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const REG_DRAFT_KEY = 'reg_draft';

  // Capture le step sauvegardé UNE SEULE FOIS au montage, avant que l'auto-save puisse l'écraser
  const [savedDraftStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(REG_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Number(parsed.step) || 1;
      }
    } catch { }
    return 1;
  });

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const [regData, setRegData] = useState(() => {
    // Restaure le brouillon depuis localStorage si disponible
    try {
      const saved = localStorage.getItem(REG_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          planId: parsed.planId || initialPlanId || '',
          companyName: parsed.companyName || '',
          siret: parsed.siret || '',
          address: parsed.address || '',
          phone: parsed.phone || '',
          paymentMethod: parsed.paymentMethod || 'Wave',
          adminName: parsed.adminName || '',
          adminEmail: parsed.adminEmail || '',
          adminPassword: '', // Jamais sauvegardé pour sécurité
          primaryColor: parsed.primaryColor || '#0f172a',
          buttonColor: parsed.buttonColor || '#63452c',
          period: parsed.period || initialPeriod || '1M',
          paymentReference: '',
        };
      }
    } catch { }
    return {
      planId: initialPlanId || '', companyName: '', siret: '', address: '', phone: '',
      paymentMethod: 'Wave', adminName: '', adminEmail: '', adminPassword: '',
      primaryColor: '#0f172a', buttonColor: '#63452c',
      period: initialPeriod || '1M',
      paymentReference: '',
    };
  });

  const [dynamicPlans, setDynamicPlans] = useState<any[]>([]);

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(REG_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed.companyName || parsed.adminEmail);
      }
    } catch { }
    return false;
  });

  // Sauvegarde le brouillon à chaque changement (sans le mot de passe)
  useEffect(() => {
    if (mode !== 'REGISTER') return;
    try {
      const { adminPassword: _pw, ...safeData } = regData;
      localStorage.setItem(REG_DRAFT_KEY, JSON.stringify({ ...safeData, step: regStep }));
    } catch { }
  }, [regData, regStep, mode]);

  useEffect(() => {
    // Apply initial navigation options (e.g., open register with preselected plan)
    if (initialMode) {
      setMode(initialMode);
      if (initialMode === 'REGISTER' && hasDraft) {
        // Restaurer l'étape sauvegardée
        try {
          const saved = localStorage.getItem(REG_DRAFT_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.step && parsed.step > 1) setRegStep(parsed.step);
          }
        } catch { }
      }
    }
    if (typeof initialRegStep === 'number') {
      setRegStep(initialRegStep);
    }
    if (initialPlanId) {
      setRegData(prev => ({ ...prev, planId: initialPlanId }));
    }
    if (initialPeriod) {
      setRegData(prev => ({ ...prev, period: initialPeriod }));
    }

    const fetchPlans = async () => {
      try {
        const data = await apiClient.get('/plans');
        setDynamicPlans(data);
        if (data.length > 0) {
          const proPlan = data.find((p: any) => p.id === 'PRO' || p.isPopular);
          setRegData(prev => ({ ...prev, planId: prev.planId || proPlan?.id || data[0].id }));
        }
      } catch (err) {
        console.error("Kernel Plans Error", err);
      }
    };
    fetchPlans();
  }, []);

  // Système de protection contre les tentatives de connexion
  const checkLoginAttempts = (email: string) => {
    const attemptsKey = `login_attempts_${email}`;
    const blockedKey = `login_blocked_until_${email}`;

    const attempts = parseInt(localStorage.getItem(attemptsKey) || '0');
    const blocked = parseInt(localStorage.getItem(blockedKey) || '0');

    const now = Date.now();

    if (blocked && now < blocked) {
      setBlockedUntil(blocked);
      setLoginAttempts(attempts);
      return false; // Toujours bloqué
    } else if (blocked && now >= blocked) {
      // Le blocage a expiré, réinitialiser
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(blockedKey);
      setBlockedUntil(null);
      setLoginAttempts(0);
      return true;
    }

    setLoginAttempts(attempts);
    return attempts < 3;
  };

  const recordFailedAttempt = (email: string) => {
    const attemptsKey = `login_attempts_${email}`;
    const blockedKey = `login_blocked_until_${email}`;

    const attempts = parseInt(localStorage.getItem(attemptsKey) || '0') + 1;
    localStorage.setItem(attemptsKey, attempts.toString());
    setLoginAttempts(attempts);

    if (attempts >= 3) {
      const blockUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
      localStorage.setItem(blockedKey, blockUntil.toString());
      setBlockedUntil(blockUntil);
    }
  };

  const resetLoginAttempts = (email: string) => {
    const attemptsKey = `login_attempts_${email}`;
    const blockedKey = `login_blocked_until_${email}`;
    localStorage.removeItem(attemptsKey);
    localStorage.removeItem(blockedKey);
    setLoginAttempts(0);
    setBlockedUntil(null);
  };

  // Timer pour le temps restant de blocage
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (blockedUntil) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setBlockedUntil(null);
          setLoginAttempts(0);
          if (loginEmail) {
            resetLoginAttempts(loginEmail);
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [blockedUntil, loginEmail]);

  // Générateur de mot de passe fort
  const generateStrongPassword = () => {
    const chars = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    let password = '';
    // Au moins un caractère de chaque type
    password += chars.upper[Math.floor(Math.random() * chars.upper.length)];
    password += chars.lower[Math.floor(Math.random() * chars.lower.length)];
    password += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
    password += chars.symbols[Math.floor(Math.random() * chars.symbols.length)];

    // Compléter avec 8 caractères aléatoires
    const allChars = chars.upper + chars.lower + chars.numbers + chars.symbols;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mélanger le mot de passe
    password = password.split('').sort(() => Math.random() - 0.5).join('');

    setRegData({ ...regData, adminPassword: password });
    evaluatePasswordStrength(password);
  };

  // Évaluation de la force du mot de passe
  const evaluatePasswordStrength = (password: string) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lengthGood: password.length >= 12,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
      noRepeating: !/(..).*\1/.test(password)
    };

    if (checks.length) score += 1;
    if (checks.lengthGood) score += 1;
    if (checks.hasUpper) score += 1;
    if (checks.hasLower) score += 1;
    if (checks.hasNumber) score += 1;
    if (checks.hasSymbol) score += 1;
    if (checks.noRepeating) score += 1;

    let label = 'Très Faible';
    let color = 'bg-red-500';

    if (score >= 6) {
      label = 'Très Fort';
      color = 'bg-emerald-500';
    } else if (score >= 5) {
      label = 'Fort';
      color = 'bg-green-500';
    } else if (score >= 4) {
      label = 'Moyen';
      color = 'bg-yellow-500';
    } else if (score >= 2) {
      label = 'Faible';
      color = 'bg-orange-500';
    }

    setPasswordStrength({ score, label, color });
  };

  // Copier le mot de passe dans le presse-papier
  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(regData.adminPassword);
      // Optionnel: ajouter une notification de succès
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier les tentatives de connexion
    if (!checkLoginAttempts(loginEmail)) {
      setApiError({ message: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(timeRemaining / 60)} minutes.` } as any);
      return;
    }

    // Vérification format email
    if (!loginEmail.trim() || !EMAIL_RE.test(loginEmail.trim())) {
      setApiError({ message: 'Veuillez saisir une adresse email valide.' } as any);
      return;
    }

    // Vérification email banni / domaine suspect
    if (isBlockedEmail(loginEmail)) {
      setApiError({ message: 'Accès refusé. Cette adresse email n\'est pas autorisée.' } as any);
      return;
    }

    setLoading(true);
    setApiError(null);
    try {
      const endpoint = mode === 'SUPERADMIN' ? '/auth/superadmin/login' : '/auth/login';
      const data = await apiClient.post(endpoint, { email: loginEmail, password: loginPassword });

      if (data.mfaRequired) {
        setTempUserId(data.tempUserId);
        setMode('MFA');
        return;
      }

      const apiUser = mode === 'SUPERADMIN'
        ? { ...data.user, role: UserRole.SUPER_ADMIN, roles: [UserRole.SUPER_ADMIN], tenantId: 'SYSTEM' }
        : data.user;

      // Bloquer la connexion si le tenant est inactif ou si le paiement n'est pas à jour (sauf SuperAdmin)
      if (mode !== 'SUPERADMIN') {
        const tenant = data.user?.tenant;
        const sub = data.user?.subscription;
        const tenantInactive = tenant && tenant.isActive === false;
        const paymentNotUpToDate = tenant && !(tenant.paymentStatus === 'UP_TO_DATE' || tenant.paymentStatus === 'TRIAL');

        if (tenantInactive) {
          const msg = tenant.paymentStatus === 'PENDING'
            ? 'Votre compte est en attente de validation. Notre équipe vérifie votre paiement Wave et vous contactera dès activation.'
            : 'Instance désactivée. Contactez le support.';
          setApiError({ message: msg } as any);
          setLoading(false);
          return;
        }

        if (paymentNotUpToDate) {
          const roles = Array.isArray(apiUser?.roles) ? apiUser.roles : [apiUser?.role];
          const isAdmin = roles && (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN));
          if (!isAdmin) {
            setApiError({ message: 'Accès suspendu : votre paiement n\'est pas à jour.' } as any);
            setLoading(false);
            return;
          }
          // allow ADMIN to login for remediation; frontend will restrict modules to dashboard only
        }

        // fallback: si backend fournit subscription et elle est non-active
        if (sub && sub.status && sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') {
          const roles = Array.isArray(apiUser?.roles) ? apiUser.roles : [apiUser?.role];
          const isAdmin = roles && (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN));
          if (!isAdmin) {
            setApiError({ message: 'Votre abonnement est en attente de validation. Connexion refusée.' } as any);
            setLoading(false);
            return;
          }
          // L'admin peut se connecter pour régulariser
        }
      }

      const user = {
        ...apiUser,
        planId: apiUser?.planId || apiUser?.subscription?.planId || apiUser?.plan?.id || undefined,
        plan: apiUser?.plan || null,
        subscription: apiUser?.subscription || null,
        isPaid: Boolean(apiUser?.isPaid),
        isSubscriptionPastDue: Boolean(apiUser?.isSubscriptionPastDue),
        lastLogin: apiUser?.lastLogin || apiUser?.last_login || null
      };

      // Connexion réussie - réinitialiser les tentatives
      resetLoginAttempts(loginEmail);

      authBridge.saveSession(user, data.token, data.sessionToken);
      onLoginSuccess(user);
    } catch (err: any) {
      // Enregistrer la tentative échouée
      recordFailedAttempt(loginEmail);
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setApiError(null);
    try {
      const data = await apiClient.post('/auth/mfa/verify', { userId: tempUserId, code: mfaCode });
      const apiUser = data.user;
      if (mode !== 'SUPERADMIN') {
        const tenant = data.user?.tenant;
        const sub = data.user?.subscription;
        const tenantInactive = tenant && tenant.isActive === false;
        const paymentNotUpToDate = tenant && !(tenant.paymentStatus === 'UP_TO_DATE' || tenant.paymentStatus === 'TRIAL');

        if (tenantInactive) {
          const msg = tenant.paymentStatus === 'PENDING'
            ? 'Votre compte est en attente de validation. Notre équipe vérifie votre paiement Wave et vous contactera dès activation.'
            : 'Instance désactivée. Contactez le support.';
          setApiError({ message: msg } as any);
          setLoading(false);
          return;
        }

        if (paymentNotUpToDate) {
          const roles = Array.isArray(apiUser?.roles) ? apiUser.roles : [apiUser?.role];
          const isAdmin = roles && (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN));
          if (!isAdmin) {
            setApiError({ message: 'Accès suspendu : votre paiement n\'est pas à jour.' } as any);
            setLoading(false);
            return;
          }
          // allow ADMIN to proceed when tenant payment is late; modules will be gated
        }

        if (sub && sub.status && sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') {
          const roles = Array.isArray(apiUser?.roles) ? apiUser.roles : [apiUser?.role];
          const isAdmin = roles && (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN));
          if (!isAdmin) {
            setApiError({ message: 'Votre abonnement est en attente de validation. Connexion refusée.' } as any);
            setLoading(false);
            return;
          }
          // L'admin peut se connecter pour régulariser
        }
      }
      const user = {
        ...apiUser,
        planId: apiUser?.planId || apiUser?.subscription?.planId || apiUser?.plan?.id || undefined,
        plan: apiUser?.plan || null,
        subscription: apiUser?.subscription || null,
        isPaid: Boolean(apiUser?.isPaid),
        isSubscriptionPastDue: Boolean(apiUser?.isSubscriptionPastDue),
        lastLogin: apiUser?.lastLogin || apiUser?.last_login || null
      };

      authBridge.saveSession(user, data.token, data.sessionToken);
      onLoginSuccess(user);
    } catch (err: any) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };


  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!regData.companyName.trim()) errs.companyName = 'La raison sociale est obligatoire.';
    if (!regData.phone.trim()) {
      errs.phone = 'Le numéro de téléphone est obligatoire.';
    } else if (!PHONE_RE.test(regData.phone.trim())) {
      errs.phone = 'Format invalide (ex: +225 07 00 00 00 00).';
    }
    if (regData.siret.trim() && regData.siret.trim().length < 5) {
      errs.siret = 'Numéro trop court (min 5 caractères).';
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!regData.adminName.trim()) errs.adminName = 'Le nom complet est obligatoire.';
    if (!regData.adminEmail.trim()) {
      errs.adminEmail = 'L\'adresse email est obligatoire.';
    } else if (!EMAIL_RE.test(regData.adminEmail.trim())) {
      errs.adminEmail = 'Format d\'email invalide (ex: nom@domaine.com).';
    } else if (isBlockedEmail(regData.adminEmail)) {
      errs.adminEmail = 'Cette adresse email n\'est pas autorisée. Utilisez une adresse professionnelle valide.';
    }
    if (!regData.adminPassword) {
      errs.adminPassword = 'Le mot de passe est obligatoire.';
    } else if (regData.adminPassword.length < 8) {
      errs.adminPassword = 'Minimum 8 caractères requis.';
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const fieldErr = (key: string) =>
    stepErrors[key] ? (
      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1 flex items-center gap-1">
        <AlertCircle size={10} /> {stepErrors[key]}
      </p>
    ) : null;

  const inputCls = (key: string) =>
    `w-full bg-slate-50 border rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 transition-all ${stepErrors[key]
      ? 'border-rose-300 focus:ring-rose-500/10'
      : 'border-slate-100 focus:ring-indigo-500/10'
    }`;

  const renderRegistrationStep = () => {
    switch (regStep) {
      case 1:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            {hasDraft && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <Info size={14} className="text-indigo-500 shrink-0" />
                  <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest flex-1">Brouillon restauré — continuez là où vous en étiez</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      try {
                        const saved = localStorage.getItem(REG_DRAFT_KEY);
                        if (saved) {
                          const parsed = JSON.parse(saved);
                          setRegData({
                            planId: parsed.planId || '',
                            companyName: parsed.companyName || '',
                            siret: parsed.siret || '',
                            address: parsed.address || '',
                            phone: parsed.phone || '',
                            paymentMethod: parsed.paymentMethod || 'Wave',
                            adminName: parsed.adminName || '',
                            adminEmail: parsed.adminEmail || '',
                            adminPassword: '',
                            primaryColor: parsed.primaryColor || '#0f172a',
                            buttonColor: parsed.buttonColor || '#63452c',
                            period: parsed.period || '1M',
                            paymentReference: '',
                          });
                        }
                      } catch { }
                      // Utilise la valeur capturée au montage (avant que l'auto-save l'écrase)
                      setRegStep(savedDraftStep);
                    }}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={12} /> REPRENDRE
                  </button>
                  <button
                    onClick={() => { localStorage.removeItem(REG_DRAFT_KEY); setHasDraft(false); setRegData({ planId: '', companyName: '', siret: '', address: '', phone: '', paymentMethod: 'Wave', adminName: '', adminEmail: '', adminPassword: '', primaryColor: '#0f172a', buttonColor: '#63452c', period: '1M', paymentReference: '' }); setRegStep(1); }}
                    className="px-4 py-2 border border-indigo-200 text-indigo-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:text-rose-500 hover:border-rose-200 transition-all"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sélectionnez votre moteur</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Choisissez la puissance de votre instance</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dynamicPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setRegData({ ...regData, planId: plan.id })}
                  className={`p-6 rounded-[2rem] border-2 text-left transition-all relative group ${regData.planId === plan.id ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-slate-100 hover:border-indigo-200'}`}
                >
                  {regData.planId === plan.id && <Check className="absolute top-4 right-4 text-indigo-600" size={18} />}
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">{plan.name}</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">{plan.price.toLocaleString()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">F CFA/m</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setRegStep(2)} className="w-full py-4 md:py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 mt-8 shadow-xl">CONTINUER L'IDENTITÉ <ArrowRight size={18} /></button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Identité de la Structure</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Information légale pour l'isolation du tenant</p>
            </div>
            <div className="space-y-4">
              <div>
                <div className="relative"><Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={regData.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRegData({ ...regData, companyName: e.target.value }); setStepErrors((p: Record<string, string>) => ({ ...p, companyName: '' })); }} className={inputCls('companyName')} placeholder="Raison Sociale *" /></div>
                {fieldErr('companyName')}
              </div>
              <div>
                <div className="relative"><Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={regData.siret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRegData({ ...regData, siret: e.target.value }); setStepErrors((p: Record<string, string>) => ({ ...p, siret: '' })); }} className={inputCls('siret')} placeholder="N° SIRET / Registre Commerce" /></div>
                {fieldErr('siret')}
              </div>
              <div>
                <div className="relative"><Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="tel" value={regData.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRegData({ ...regData, phone: e.target.value }); setStepErrors((p: Record<string, string>) => ({ ...p, phone: '' })); }} className={inputCls('phone')} placeholder="Téléphone Entreprise *" /></div>
                {fieldErr('phone')}
              </div>
              <div className="relative"><MapPin className="absolute left-5 top-4 text-slate-300" size={18} /><textarea value={regData.address} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRegData({ ...regData, address: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px]" placeholder="Adresse du Siège Social" /></div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setRegStep(1)} className="px-4 py-3 md:py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
              <button onClick={() => { if (validateStep2()) setRegStep(3); }} className="flex-1 py-3 md:py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl">CRÉER L'ADMIN <ArrowRight size={18} /></button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Compte Propriétaire</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Accès Maître de l'instance {regData.companyName}</p>
            </div>
            <div className="space-y-4">
              <div>
                <div className="relative"><UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={regData.adminName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRegData({ ...regData, adminName: e.target.value }); setStepErrors((p: Record<string, string>) => ({ ...p, adminName: '' })); }} className={inputCls('adminName')} placeholder="Nom Complet *" /></div>
                {fieldErr('adminName')}
              </div>
              <div>
                <div className="relative"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="email" value={regData.adminEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRegData({ ...regData, adminEmail: e.target.value }); setStepErrors((p: Record<string, string>) => ({ ...p, adminEmail: '' })); }} className={inputCls('adminEmail')} placeholder="Email Administrateur *" /></div>
                {fieldErr('adminEmail')}
              </div>

              {/* Champ mot de passe avec générateur */}
              <div className="space-y-3">
                <div className={`relative ${stepErrors.adminPassword ? 'ring-1 ring-rose-300 rounded-2xl' : ''}`}>
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regData.adminPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setRegData({ ...regData, adminPassword: e.target.value });
                      evaluatePasswordStrength(e.target.value);
                      setStepErrors((p: Record<string, string>) => ({ ...p, adminPassword: '' }));
                    }}
                    className={`w-full bg-slate-50 border rounded-2xl pl-12 pr-32 py-4 text-sm font-bold outline-none focus:ring-4 transition-all ${stepErrors.adminPassword ? 'border-rose-300 focus:ring-rose-500/10' : 'border-slate-100 focus:ring-indigo-500/10'}`}
                    placeholder="Clé d'Accès de Sécurité *"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyPasswordToClipboard}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1"
                      title="Copier le mot de passe"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                      title="Générer un mot de passe fort"
                    >
                      <Dices size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {fieldErr('adminPassword')}
                {/* Barre de force du mot de passe */}
                {regData.adminPassword && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Force du mot de passe</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${strengthTextColor(passwordStrength.score)}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 7) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setRegStep(2)} className="px-4 py-3 md:py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep3()) {
                    if (isFree) {
                      handleFreeRegister();
                    } else {
                      setRegStep(4);
                    }
                  }
                }}
                className="flex-1 py-3 md:py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFree ? (loading ? <RefreshCw className="animate-spin" size={18} /> : <>ACTIVER GRATUITEMENT <Sparkles size={18} /></>) : <>PASSER AU PAIEMENT <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        );
      case 4:
        return PaymentStep();
    }
  };

  const selectedPlan = dynamicPlans.find(p => p.id === regData.planId);
  const isFree = !selectedPlan || Number(selectedPlan.price) === 0 || selectedPlan.id === 'FREE_TRIAL';

  const computeAmount = () => {
    if (!selectedPlan) return 0;
    const PERIOD_MULT: Record<string, number> = { '1M': 1, '3M': 3, '1Y': 12 };
    const mult = PERIOD_MULT[regData.period] || 1;
    const PERIOD_DISCOUNT: Record<string, number> = { '1M': 1, '3M': 0.9, '1Y': 0.8 };
    const discount = PERIOD_DISCOUNT[regData.period] || 1;
    return Math.round(selectedPlan.price * mult * discount);
  };

  const handleFreeRegister = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const payload = {
        companyName: regData.companyName, siret: regData.siret, phone: regData.phone, address: regData.address,
        planId: regData.planId,
        primaryColor: regData.primaryColor, buttonColor: regData.buttonColor,
        admin: { name: regData.adminName, email: regData.adminEmail, password: regData.adminPassword }
      };
      const response = await apiClient.post('/auth/register', payload);
      localStorage.removeItem(REG_DRAFT_KEY);
      setHasDraft(false);
      const planObj = dynamicPlans.find(p => p.id === regData.planId);
      onLoginSuccess({ ...response.user, token: response.token, planId: response.subscription?.planId, selectedPlanDetails: planObj, mustPay: false } as any);
    } catch (err: any) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMobileRegister = async () => {
    if (!regData.paymentReference.trim()) {
      setApiError({ error: 'ValidationError', message: 'Veuillez saisir votre référence de transaction.', status: 400 });
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const amount = computeAmount();
      const payload = {
        companyName: regData.companyName, siret: regData.siret, phone: regData.phone, address: regData.address,
        planId: regData.planId,
        primaryColor: regData.primaryColor, buttonColor: regData.buttonColor,
        period: regData.period,
        admin: { name: regData.adminName, email: regData.adminEmail, password: regData.adminPassword },
        paymentInfo: { method: regData.paymentMethod, reference: regData.paymentReference, amount }
      };
      const response = await apiClient.post('/auth/register', payload);
      localStorage.removeItem(REG_DRAFT_KEY);
      setHasDraft(false);
      const planObj = dynamicPlans.find(p => p.id === regData.planId);
      onLoginSuccess({ ...response.user, token: response.token, planId: response.subscription?.planId, selectedPlanDetails: planObj, mustPay: false } as any);
    } catch (err: any) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // handleStripeRegister — temporairement masqué
  /*
  const handleStripeRegister = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const amount = computeAmount();
      const payload = {
        companyName: regData.companyName, siret: regData.siret, phone: regData.phone, address: regData.address,
        planId: regData.planId, period: regData.period, amount,
        primaryColor: regData.primaryColor, buttonColor: regData.buttonColor,
        admin: { name: regData.adminName, email: regData.adminEmail, password: regData.adminPassword }
      };
      const response = await apiClient.post('/auth/register-stripe-init', payload);
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err: any) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };
  */

  const PaymentStep = () => {
    const amount = computeAmount();
    const PERIOD_LABELS: Record<string, string> = { '1M': '1 mois', '3M': '3 mois', '1Y': '1 an' };

    if (isFree) {
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Activation Gratuite</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Essai gratuit de 14 jours — aucun paiement requis</p>
          </div>
          <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-3">
            <div className="flex items-center gap-3"><Check size={20} className="text-emerald-600" /><p className="text-sm font-bold text-emerald-800">Plan Essai Gratuit — 0 F CFA</p></div>
            <div className="flex items-center gap-3"><Check size={20} className="text-emerald-600" /><p className="text-sm font-bold text-emerald-800">Accès complet pendant 14 jours</p></div>
            <div className="flex items-center gap-3"><Check size={20} className="text-emerald-600" /><p className="text-sm font-bold text-emerald-800">Aucune carte bancaire requise</p></div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <ShieldCheck size={20} className="text-indigo-600 shrink-0" />
            <p className="text-[9px] text-indigo-800 font-bold uppercase leading-relaxed">Votre espace sera déployé et prêt à l'emploi immédiatement après confirmation.</p>
          </div>
          <div className="flex gap-4 mt-8">
            <button type="button" onClick={() => setRegStep(3)} className="px-4 py-3 md:py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
            <button type="button" onClick={handleFreeRegister} disabled={loading} className="flex-1 py-3 md:py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <>ACTIVER GRATUITEMENT <Sparkles size={18} /></>}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Paiement</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Finalisez votre abonnement pour créer votre espace</p>
        </div>

        {/* Récapitulatif */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>Plan</span><span>{selectedPlan?.name}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>Durée</span><span>{PERIOD_LABELS[regData.period] || regData.period}</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2 mt-2">
            <span>Total</span><span>{amount.toLocaleString()} F CFA</span>
          </div>
        </div>

        {/* Durée */}
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Durée de l'abonnement</p>
          <div className="grid grid-cols-3 gap-3">
            {[{ id: '1M', label: '1 Mois', disc: '' }, { id: '3M', label: '3 Mois', disc: '-10%' }, { id: '1Y', label: '1 An', disc: '-20%' }].map(opt => (
              <button key={opt.id} type="button" onClick={() => setRegData({ ...regData, period: opt.id })}
                className={`py-3 px-2 rounded-2xl border-2 text-center transition-all ${regData.period === opt.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="text-[10px] font-black text-slate-800 uppercase">{opt.label}</div>
                {opt.disc && <div className="text-[8px] font-bold text-emerald-600">{opt.disc}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur méthode : Wave ou Stripe */}
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Méthode de paiement</p>
          <div className="grid grid-cols-1 gap-3">
            <button type="button" onClick={() => setRegData({ ...regData, paymentMethod: 'Wave' })}
              className={`py-4 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${regData.paymentMethod === 'Wave' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
              <Smartphone size={16} /> Wave
            </button>
            {/* Bouton Carte Stripe — temporairement masqué
            <button type="button" onClick={() => setRegData({...regData, paymentMethod: 'Stripe'})}
              className={`py-4 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${regData.paymentMethod === 'Stripe' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
              <CreditCard size={16} /> Carte Stripe
            </button>
            */}
          </div>
        </div>

        {/* Wave : QR code + référence */}
        {regData.paymentMethod === 'Wave' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-3 p-5 bg-blue-50 border-2 border-blue-100 rounded-3xl">
              <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Scannez le QR code Wave pour payer {amount.toLocaleString()} F CFA</p>
              <img src={waveQr} alt="QR Code Wave Marchand" className="w-48 h-48 rounded-2xl object-contain border border-blue-200 bg-white p-2" />
              <p className="text-[8px] text-blue-500 font-bold text-center leading-relaxed">
                Ouvrez l'application Wave → Scanner → Pointez vers ce QR code → Confirmez le montant
              </p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Référence de transaction Wave</p>
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="text"
                  value={regData.paymentReference}
                  onChange={e => setRegData({ ...regData, paymentReference: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Collez ici la référence Wave (ex : W-XXXXXXXX)"
                />
              </div>
              <p className="text-[8px] text-slate-400 font-bold mt-2">Après le paiement, Wave vous envoie une référence par SMS — collez-la ici.</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setRegStep(3)} className="px-4 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
              <button type="button" onClick={handleMobileRegister} disabled={loading || !regData.paymentReference.trim()}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-40">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <>VALIDER LE PAIEMENT WAVE <Check size={18} /></>}
              </button>
            </div>
          </div>
        )}

        {/* Stripe : redirection — temporairement masqué
        {regData.paymentMethod === 'Stripe' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-3xl space-y-2">
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-indigo-600 shrink-0" />
                <p className="text-xs font-black text-indigo-800 uppercase tracking-widest">Paiement sécurisé par Stripe</p>
              </div>
              <p className="text-[8px] text-indigo-600 font-bold leading-relaxed pl-8">
                Vous serez redirigé vers la page de paiement Stripe. Votre compte sera créé automatiquement après confirmation du paiement.
              </p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setRegStep(3)} className="px-4 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
              <button type="button" onClick={handleStripeRegister} disabled={loading}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-40">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <>PAYER AVEC STRIPE <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        )}
        */}

        {/* Aucune méthode sélectionnée */}
        {regData.paymentMethod !== 'Wave' && regData.paymentMethod !== 'Stripe' && (
          <div className="flex gap-4">
            <button type="button" onClick={() => setRegStep(3)} className="px-4 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">RETOUR</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-900">
      <button type="button" onClick={onBackToLanding} className="absolute left-4 top-4 sm:left-6 sm:top-6 z-40 text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 hover:text-indigo-300">
        <ChevronLeft size={16} /> Accueil
      </button>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px]"></div>

      <div className={`w-full transition-all duration-700 ${mode === 'REGISTER' ? 'max-w-5xl' : 'max-w-md'}`}>
        <div className="text-center mb-6 md:mb-10">

          <img src={logo} alt="GeStockPro" className="mx-auto mb-4 h-14" />
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
            {mode === 'REGISTER' ? 'Déploiement Instance SaaS' : mode === 'SUPERADMIN' ? 'Console Maître Kernel' : mode === 'MFA' ? 'Vérification de Sécurité' : 'Accès Privé GeStock'}
          </h1>
        </div>

        <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden relative">
          {(initialWavePending || apiError?.error === 'WaveValidationPending') && (
            <div className="absolute top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 z-20 p-5 bg-amber-50 border-2 border-amber-200 rounded-3xl animate-in fade-in duration-500 flex items-start gap-4">
              <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Compte en attente de validation</p>
                <p className="text-xs font-bold text-amber-600 leading-relaxed">
                  {apiError?.message || 'Votre inscription est enregistrée. Notre équipe vérifie votre paiement Wave et activera votre espace sous 24h.'}
                </p>
              </div>
            </div>
          )}
          {apiError && apiError.error !== 'WaveValidationPending' && (
            <div className="absolute top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 z-20 p-5 bg-rose-50 border-2 border-rose-100 rounded-3xl animate-in shake duration-500 flex items-center justify-between">
              <div className="flex items-center gap-4"><AlertCircle size={20} className="text-rose-600" /><p className="text-xs font-bold text-rose-700">{apiError.message}</p></div>
              <button onClick={() => setApiError(null)}><X size={18} className="text-rose-300" /></button>
            </div>
          )}

          {mode === 'LOGIN' || mode === 'SUPERADMIN' ? (
            <form onSubmit={handleLogin} className="p-5 md:p-12 space-y-5 md:space-y-6">
              {/* Affichage du statut de blocage */}
              {blockedUntil && timeRemaining > 0 && (
                <div className="p-5 bg-rose-50 border-2 border-rose-200 rounded-3xl text-rose-700 text-center animate-in shake duration-500">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Lock size={20} className="text-rose-600" />
                    <h4 className="text-sm font-black uppercase tracking-widest">Compte Temporairement Bloqué</h4>
                  </div>
                  <p className="text-xs font-bold mb-3">Trop de tentatives de connexion échouées.</p>
                  <div className="bg-rose-100 rounded-2xl p-4 border border-rose-200">
                    <p className="text-2xl font-black text-rose-800">
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-1">Minutes restantes</p>
                  </div>
                </div>
              )}

              {/* Indicateur de tentatives */}
              {loginAttempts > 0 && !blockedUntil && (
                <div className={`p-3 rounded-2xl text-center text-xs font-bold ${attemptStyleClass(loginAttempts)}`}>
                  ⚠️ {loginAttempts}/3 tentatives utilisées
                  {loginAttempts === 2 && ' - Dernière chance avant blocage'}
                </div>
              )}

              <div className="space-y-5">
                <div className="relative"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value.toLowerCase())} disabled={!!(blockedUntil && timeRemaining > 0)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed" placeholder={mode === 'SUPERADMIN' ? 'MASTER_ID' : 'Email Opérateur'} /></div>
                <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type={showPassword ? 'text' : 'password'} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} disabled={!!(blockedUntil && timeRemaining > 0)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-14 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed" placeholder="ACCESS_KEY" /><button type="button" onClick={() => setShowPassword(!showPassword)} disabled={!!(blockedUntil && timeRemaining > 0)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 disabled:cursor-not-allowed">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                <button type="submit" disabled={loading || (blockedUntil && timeRemaining > 0)} className={`w-full py-5 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'SUPERADMIN' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-900 hover:bg-indigo-600'}`}>{loading ? <RefreshCw className="animate-spin" size={18} /> : blockedUntil && timeRemaining > 0 ? <>ACCÈS BLOQUÉ <Lock size={18} /></> : <>OUVRIR LA SESSION <ArrowRight size={18} /></>}</button>
              </div>
            </form>
          ) : mode === 'MFA' ? (
            <form onSubmit={handleVerifyMFA} className="p-6 md:p-16 space-y-6 md:space-y-8 animate-in zoom-in-95">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><Smartphone size={40} className="animate-bounce" /></div>
                <h3 className="text-lg font-black uppercase text-slate-800">Double Authentification</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed px-4">Un code de sécurité à 6 chiffres a été généré pour sécuriser votre accès.</p>
              </div>
              <div className="space-y-4">
                <input
                  type="text" required maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-5 text-center text-2xl sm:text-3xl font-black tracking-[0.3em] sm:tracking-[0.5em] outline-none focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="000000"
                />
                <button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3">
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : <>VÉRIFIER L'IDENTITÉ <ArrowRight size={18} /></>}
                </button>
              </div>
              <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">Annuler la session</button>
            </form>
          ) : (
            <div className="flex flex-col lg:grid lg:grid-cols-12">
              {/* Barre de progression mobile (inscription) */}
              <div className="flex lg:hidden items-center justify-between px-5 py-3 bg-slate-900 text-white">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {[{ step: 1, label: 'Moteur' }, { step: 2, label: 'Entreprise' }, { step: 3, label: 'Admin' }, { step: 4, label: 'Paiement' }].find(s => s.step === regStep)?.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${regStep === s ? 'w-6 bg-white' : regStep > s ? 'w-3 bg-emerald-400' : 'w-3 bg-slate-600'}`} />
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900 p-6 lg:p-10 text-white hidden lg:flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={200} /></div>
                <div className="space-y-8 relative z-10">
                  {[{ step: 1, label: 'Choix du Plan', icon: Star }, { step: 2, label: 'L\'Entreprise', icon: Building2 }, { step: 3, label: 'Administrateur', icon: UserIcon }, { step: 4, label: 'Paiement', icon: CreditCard }].map(s => (
                    <div key={s.step} className={`flex items-center gap-4 transition-all duration-500 ${regStep === s.step ? 'opacity-100 translate-x-2' : regStep > s.step ? 'opacity-60 grayscale' : 'opacity-40'}`}><div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all ${regStep === s.step ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-500/30' : regStep > s.step ? 'bg-emerald-50 border-emerald-500' : 'border-slate-700'}`}>{regStep > s.step ? <Check size={20} /> : <s.icon size={18} />}</div><div><span className="text-[10px] font-black uppercase tracking-widest block">Étape {s.step}</span><span className="text-xs font-bold text-slate-400">{s.label}</span></div></div>
                  ))}
                </div>
              </div>
              <div className="col-span-12 lg:col-span-8 p-5 sm:p-8 lg:p-12 flex flex-col max-h-[70vh] lg:max-h-[75vh] overflow-y-auto custom-scrollbar">{renderRegistrationStep()}</div>
            </div>
          )}

          <div className="px-5 md:px-10 py-5 md:py-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-center">
            {mode === 'REGISTER' && (
              <button type="button" onClick={() => setMode('LOGIN')} className="text-[11px] font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-3"><ChevronLeft size={18} /> Retour Connexion</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
