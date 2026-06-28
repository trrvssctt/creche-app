
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings as SettingsIcon, Globe, Image as ImageIcon,
  ShieldCheck, Save, Check, FileText, ShieldAlert,
  Lock, Palette, LayoutDashboard, CreditCard, Sparkles,
  CheckCircle2, Building2, Stamp, RefreshCw, Upload,
  Loader2, Pipette, GraduationCap, Calendar, MessageSquare,
  CalendarDays, PlayCircle, XCircle, AlertTriangle, ChevronRight,
  Flag, Archive, Plus, Trash2, Edit3, Layers, X
} from 'lucide-react';
import { AppSettings } from '../types';
import { apiClient } from '../services/api';
import { uploadFile } from '../services/uploadService';
import { authBridge } from '../services/authBridge';
import { useAnnee } from '../contexts/AnneeContext';
import { useNiveaux, NIVEAUX_PALETTES, TEMPLATES, NiveauDef } from '../contexts/NiveauxContext';

const SCHOOL_CONFIG_KEY = 'tda_school_config';

interface SchoolConfig {
  anneeLibelle: string;
  anneeDebut: string;
  anneeFin: string;
  nbMois: number;
  trimestre1: string;
  trimestre2: string;
  trimestre3: string;
  jourLimitePaiement: number;
  penaliteRetardPaiement: number;
  penaliteRetardGarde: number;
  fraisInscription: Record<string, number>;
}

const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  anneeLibelle: '2025-2026',
  anneeDebut: '2025-10-01',
  anneeFin: '2026-07-31',
  nbMois: 10,
  trimestre1: 'Décembre 2025',
  trimestre2: 'Mars 2026',
  trimestre3: 'Juin 2026',
  jourLimitePaiement: 5,
  penaliteRetardPaiement: 2000,
  penaliteRetardGarde: 2500,
  fraisInscription: {
    CRECHE: 85000, PS: 85000, MS: 85000, GS: 85000,
    CP: 85000, CE1: 85000, CE2: 85000, CM1: 85000, CM2: 85000,
  },
};

const NIVEAUX_LABELS: Record<string, string> = {
  CRECHE: 'Crèche',
  PS: 'Petite Section (PS)',
  MS: 'Moyenne Section (MS)',
  GS: 'Grande Section (GS)',
  CP: 'CP',
  CE1: 'CE1',
  CE2: 'CE2',
  CM1: 'CM1',
  CM2: 'CM2',
};

interface SettingsProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onLogout?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const { anneeActiveToday, setAnnee, refreshAnneeRef, anneesCloturees, setCloturees, anneeScolaireConfig, setAnneeScolaireConfig, getStatutAnnee } = useAnnee();
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'branding' | 'scolaire' | 'fiscal' | 'profile' | 'campagnes' | 'structure'>('general');
  const { niveaux, addNiveau, updateNiveau, deleteNiveau, loadTemplate, resetToDefault } = useNiveaux();
  const [editingNiveau, setEditingNiveau] = useState<Partial<NiveauDef> | null>(null);
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState<string | null>(null);
  const [localTenant, setLocalTenant] = useState<any>(null);
  const [buttonColor, setButtonColor] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(() => {
    try {
      const saved = localStorage.getItem(SCHOOL_CONFIG_KEY);
      return saved ? { ...DEFAULT_SCHOOL_CONFIG, ...JSON.parse(saved) } : DEFAULT_SCHOOL_CONFIG;
    } catch {
      return DEFAULT_SCHOOL_CONFIG;
    }
  });
  const [schoolConfigSaved, setSchoolConfigSaved] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Campagnes d'années scolaires
  const [anneeDB, setAnneeDB] = useState<string | null>(null);
  const [showCloturerModal, setShowCloturerModal] = useState(false);
  const [showNouvelleModal, setShowNouvelleModal] = useState(false);
  const [nouvelleAnneeInput, setNouvelleAnneeInput] = useState('');
  const [campagneLoading, setCampagneLoading] = useState(false);
  const [campagneSuccess, setCampagneSuccess] = useState<string | null>(null);
  const [campagneError, setCampagneError] = useState<string | null>(null);
  // Nouveaux états — cycle de vie
  const [showCreerModal, setShowCreerModal] = useState(false);
  const [nouvelleAnneeCreer, setNouvelleAnneeCreer] = useState('');
  const [showOuvrirModal, setShowOuvrirModal] = useState<string | null>(null);
  const [showDemarrerModal, setShowDemarrerModal] = useState<string | null>(null);
  const [showCloturerAnneeModal, setShowCloturerAnneeModal] = useState<string | null>(null);
  const [showReactiverModal, setShowReactiverModal] = useState<string | null>(null);

  // ── Reconduction d'année ────────────────────────────────────────────────────
  const [showReconductionModal, setShowReconductionModal] = useState(false);
  const [reconductionFetching, setReconductionFetching] = useState(false);
  const [reconductionLoading, setReconductionLoading] = useState(false);
  const [reconductionStep, setReconductionStep] = useState<'select' | 'done'>('select');
  const [reconductionError, setReconductionError] = useState<string | null>(null);
  const [reconductionClasses, setReconductionClasses] = useState<any[]>([]);
  const [reconductionServices, setReconductionServices] = useState<any[]>([]);
  const [classeSel, setClasseSel] = useState<Record<string, boolean>>({});
  const [serviceSel, setServiceSel] = useState<Record<string, boolean>>({});
  const [classeEdits, setClasseEdits] = useState<Record<string, { nom: string; capaciteMax: number }>>({});
  const [serviceEdits, setServiceEdits] = useState<Record<string, { name: string; price: number; fraisInscription: number }>>({});
  const [reconductionResult, setReconductionResult] = useState<{ classes: number; services: number } | null>(null);

  const generateStrongPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let pwd = '';
    const arr = new Uint32Array(16);
    window.crypto.getRandomValues(arr);
    arr.forEach(v => { pwd += chars[v % chars.length]; });
    setPwNew(pwd);
    setPwConfirm(pwd);
    setPwShowNew(true);
  };

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: 'bg-slate-200', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Faible', color: 'bg-red-500', width: '20%' };
    if (score === 2) return { label: 'Moyen', color: 'bg-orange-400', width: '40%' };
    if (score === 3) return { label: 'Correct', color: 'bg-yellow-400', width: '60%' };
    if (score === 4) return { label: 'Fort', color: 'bg-green-400', width: '80%' };
    return { label: 'Très fort', color: 'bg-green-600', width: '100%' };
  };

  const handleChangePassword = async () => {
    setPwError(null);
    if (!pwCurrent || !pwNew || !pwConfirm) { setPwError('Tous les champs sont requis.'); return; }
    if (pwNew !== pwConfirm) { setPwError('Les mots de passe ne correspondent pas.'); return; }
    if (pwNew.length < 8) { setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
    setPwSaving(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword: pwCurrent, newPassword: pwNew });
      setPwSuccess(true);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err?.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setPwSaving(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await apiClient.get('/settings');
        const defaultFont = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
        setLocalTenant({
          ...data,
          fontFamily: data.fontFamily || defaultFont,
          baseFontSize: data.baseFontSize || 14,
          theme: data.theme || data.is_dark || 'light',
          buttonColor: data.buttonColor || data.button_color || ''
        });
        setButtonColor(data.buttonColor || data.button_color || '');
        if (data.anneeActive) {
          setAnneeDB(data.anneeActive);
          refreshAnneeRef(data.anneeActive);
        }
        if (Array.isArray(data.anneesCloturees)) {
          setCloturees(data.anneesCloturees);
        }
        if (data.anneeScolaireConfig && typeof data.anneeScolaireConfig === 'object') {
          setAnneeScolaireConfig(data.anneeScolaireConfig);
        }
      } catch (e) {
        console.error('Fetch Settings Error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(field);
    try {
      const folder = field === 'logoUrl' ? 'logos' : field === 'cachetUrl' ? 'cachets' : 'uploads';
      const result = await uploadFile(file, folder);
      setLocalTenant({ ...localTenant, [field]: result.url });
    } catch (err) {
      console.error('Upload Error:', err);
      alert("Échec de l'envoi de l'image.");
    } finally {
      setIsUploading(null);
    }
  };

  const normalizeHex = (raw?: string) => {
    if (!raw) return '';
    let s = raw.trim();
    if (!s) return '';
    if (!s.startsWith('#')) s = '#' + s;
    if (s.length === 4) {
      const r = s[1]; const g = s[2]; const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return s.substring(0, 7).toLowerCase();
  };

  const withAlphaHex = (hex?: string, alpha = '30') => {
    const base = normalizeHex(hex);
    if (!base) return '';
    return `${base}${alpha}`;
  };

  useEffect(() => {
    if (localTenant?.primaryColor) {
      document.documentElement.style.setProperty('--primary-kernel', normalizeHex(localTenant.primaryColor));
    }
  }, [localTenant?.primaryColor]);

  useEffect(() => {
    const btn = localTenant?.buttonColor || localTenant?.button_color || buttonColor || localTenant?.primaryColor || '#4f46e5';
    if (btn) document.documentElement.style.setProperty('--button-kernel', normalizeHex(btn));
  }, [localTenant?.buttonColor, localTenant?.button_color, localTenant?.primaryColor, buttonColor]);

  useEffect(() => {
    if (localTenant?.fontFamily) {
      document.documentElement.style.setProperty('--kernel-font-family', localTenant.fontFamily);
      document.documentElement.style.fontFamily = localTenant.fontFamily;
    }
    if (localTenant?.baseFontSize) {
      const size = typeof localTenant.baseFontSize === 'number' ? localTenant.baseFontSize : parseInt(localTenant.baseFontSize) || 14;
      document.documentElement.style.setProperty('--base-font-size', `${size}px`);
      document.documentElement.style.fontSize = `${size}px`;
    }
  }, [localTenant?.fontFamily, localTenant?.baseFontSize]);

  useEffect(() => {
    if (!localTenant) return;
    const themeVal = localTenant.theme ?? localTenant.is_dark ?? 'light';
    const isDark = themeVal === 'dark' || themeVal === true;
    document.documentElement.classList.toggle('dark', Boolean(isDark));
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--kernel-theme', isDark ? 'dark' : 'light');
    try { window.dispatchEvent(new CustomEvent('tenant-theme-updated')); } catch (e) {}
  }, [localTenant?.theme]);

  const handleSave = async () => {
    if (!localTenant) return;
    setIsSaving(true);
    try {
      const toSave = {
        ...localTenant,
        primaryColor: normalizeHex(localTenant.primaryColor),
        buttonColor: normalizeHex(buttonColor || localTenant.buttonColor || localTenant.button_color),
        fontFamily: localTenant.fontFamily,
        baseFontSize: Number(localTenant.baseFontSize) || 14,
        theme: localTenant.theme || 'light'
      };
      const response = await apiClient.put('/settings', toSave);
      const updatedTenant = response.tenant;
      setLocalTenant(updatedTenant);
      setButtonColor(updatedTenant.buttonColor || updatedTenant.button_color || '');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSave({
        ...settings,
        companyName: updatedTenant.name,
        platformLogo: updatedTenant.logoUrl,
        invoiceLogo: updatedTenant.logoUrl,
        currency: updatedTenant.currency,
        ...updatedTenant
      });
      if (updatedTenant.primaryColor) {
        document.documentElement.style.setProperty('--primary-kernel', normalizeHex(updatedTenant.primaryColor));
        window.dispatchEvent(new CustomEvent('tenant-theme-updated'));
      }
      if (updatedTenant.buttonColor || updatedTenant.button_color) {
        document.documentElement.style.setProperty('--button-kernel', normalizeHex(updatedTenant.buttonColor || updatedTenant.button_color));
        window.dispatchEvent(new CustomEvent('tenant-theme-updated'));
      }
      if (updatedTenant.fontFamily) {
        document.documentElement.style.setProperty('--kernel-font-family', updatedTenant.fontFamily);
        document.documentElement.style.fontFamily = updatedTenant.fontFamily;
      }
      if (updatedTenant.baseFontSize) {
        const size = Number(updatedTenant.baseFontSize) || 14;
        document.documentElement.style.setProperty('--base-font-size', `${size}px`);
        document.documentElement.style.fontSize = `${size}px`;
      }
      if (typeof updatedTenant.theme !== 'undefined') {
        const isDark = updatedTenant.theme === 'dark' || updatedTenant.theme === true;
        document.documentElement.classList.toggle('dark', Boolean(isDark));
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    } catch (e: any) {
      console.error('Save Settings Error:', e);
      alert(`Erreur: ${e.message || 'Échec de sauvegarde'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchoolConfig = () => {
    localStorage.setItem(SCHOOL_CONFIG_KEY, JSON.stringify(schoolConfig));
    setSchoolConfigSaved(true);
    setTimeout(() => setSchoolConfigSaved(false), 3000);
  };

  const updateFraisInscription = (niveau: string, value: number) => {
    setSchoolConfig(prev => ({
      ...prev,
      fraisInscription: { ...prev.fraisInscription, [niveau]: value }
    }));
  };

  const anneeRefDisplayed = anneeDB || anneeActiveToday;

  // Synchronise le libellé de l'année scolaire dans schoolConfig dès que l'année active change
  useEffect(() => {
    if (anneeRefDisplayed && schoolConfig.anneeLibelle !== anneeRefDisplayed) {
      setSchoolConfig(prev => ({ ...prev, anneeLibelle: anneeRefDisplayed }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeRefDisplayed]);

  const suggestNextAnnee = (current: string): string => {
    const m = /^(\d{4})-(\d{4})$/.exec(current);
    if (!m) return '';
    return `${Number(m[2])}-${Number(m[2]) + 1}`;
  };

  // Retourne les années connues, triées du plus récent au plus ancien
  const anneesConnues = Object.keys(anneeScolaireConfig).sort((a, b) =>
    parseInt(b.slice(0, 4)) - parseInt(a.slice(0, 4))
  );

  const handleCreerAnnee = async () => {
    const annee = nouvelleAnneeCreer.trim();
    if (!/^\d{4}-\d{4}$/.test(annee)) { setCampagneError('Format requis: YYYY-YYYY'); return; }
    setCampagneLoading(true); setCampagneError(null);
    try {
      const result = await apiClient.post('/settings/annees', { anneeLibelle: annee });
      const newConfig = { ...anneeScolaireConfig, [annee]: result.config };
      setAnneeScolaireConfig(newConfig);
      setCampagneSuccess(`Année ${annee} créée en mode PREPARATION.`);
      setShowCreerModal(false); setNouvelleAnneeCreer('');
      setTimeout(() => setCampagneSuccess(null), 5000);
    } catch (e: any) { setCampagneError(e?.message || 'Erreur lors de la création.'); }
    finally { setCampagneLoading(false); }
  };

  const handleOuvrirInscriptions = async (annee: string) => {
    setCampagneLoading(true); setCampagneError(null);
    try {
      const result = await apiClient.put(`/settings/annees/${annee}/ouvrir-inscriptions`, {});
      const newConfig = { ...anneeScolaireConfig, [annee]: result.config };
      setAnneeScolaireConfig(newConfig);
      setCampagneSuccess(`Inscriptions ouvertes pour ${annee}.`);
      setShowOuvrirModal(null);
      setTimeout(() => setCampagneSuccess(null), 5000);
    } catch (e: any) { setCampagneError(e?.message || 'Erreur lors de l\'ouverture des inscriptions.'); }
    finally { setCampagneLoading(false); }
  };

  const handleDemarrerAnnee = async (annee: string) => {
    setCampagneLoading(true); setCampagneError(null);
    try {
      const result = await apiClient.put(`/settings/annees/${annee}/demarrer`, {});
      const newConfig = { ...anneeScolaireConfig, [annee]: result.config };
      setAnneeScolaireConfig(newConfig);
      setAnneeDB(annee); refreshAnneeRef(annee); setAnnee(annee);
      setCampagneSuccess(`Année scolaire ${annee} démarrée. L'application bascule sur cette année.`);
      setShowDemarrerModal(null);
      setTimeout(() => setCampagneSuccess(null), 5000);
    } catch (e: any) { setCampagneError(e?.message || 'Erreur lors du démarrage.'); }
    finally { setCampagneLoading(false); }
  };

  const handleCloturerAnneeNew = async (annee: string) => {
    setCampagneLoading(true); setCampagneError(null);
    try {
      const result = await apiClient.put(`/settings/annees/${annee}/cloturer`, {});
      const newConfig = { ...anneeScolaireConfig, [annee]: result.config };
      setAnneeScolaireConfig(newConfig);
      setCloturees([...anneesCloturees, annee]);
      setCampagneSuccess(`Année scolaire ${annee} clôturée.`);
      setShowCloturerAnneeModal(null);
      setTimeout(() => setCampagneSuccess(null), 5000);
    } catch (e: any) { setCampagneError(e?.message || 'Erreur lors de la clôture.'); }
    finally { setCampagneLoading(false); }
  };

  const handleReactiverAnnee = async (annee: string) => {
    setCampagneLoading(true); setCampagneError(null);
    try {
      const result = await apiClient.put(`/settings/annees/${annee}/reactiver`, {});
      const newConfig = { ...anneeScolaireConfig, [annee]: result.config };
      setAnneeScolaireConfig(newConfig);
      setCloturees((result.anneesCloturees as string[]) || anneesCloturees.filter(a => a !== annee));
      refreshAnneeRef(annee);
      setAnnee(annee);
      setAnneeDB(annee);
      setCampagneSuccess(`Année scolaire ${annee} réactivée et définie comme année active.`);
      setShowReactiverModal(null);
      setTimeout(() => setCampagneSuccess(null), 6000);
    } catch (e: any) { setCampagneError(e?.message || 'Erreur lors de la réactivation.'); }
    finally { setCampagneLoading(false); }
  };

  // Compat handlers (gardés pour les anciens modals si besoin)
  const handleCloturerAnnee = async () => handleCloturerAnneeNew(anneeRefDisplayed);
  const handleDemarrerNouvelleAnnee = async () => {
    const annee = nouvelleAnneeInput.trim();
    if (!/^\d{4}-\d{4}$/.test(annee)) { setCampagneError('Format invalide. Exemple: 2026-2027'); return; }
    await handleDemarrerAnnee(annee);
    setShowNouvelleModal(false); setNouvelleAnneeInput('');
  };

  const getPreviousAnnee = (annee: string): string => {
    const m = /^(\d{4})-(\d{4})$/.exec(annee);
    if (!m) return '';
    return `${Number(m[1]) - 1}-${Number(m[2]) - 1}`;
  };

  const openReconductionModal = async () => {
    const prevAnnee = getPreviousAnnee(anneeRefDisplayed);
    setReconductionStep('select');
    setReconductionError(null);
    setReconductionResult(null);
    setReconductionFetching(true);
    setShowReconductionModal(true);
    try {
      const [classesData, servicesData] = await Promise.all([
        apiClient.get('/classes', { params: { anneeScolaire: prevAnnee } }).catch(() => []),
        apiClient.get('/services', { params: { anneeScolaire: prevAnnee } }).catch(() => []),
      ]);
      const classes = Array.isArray(classesData) ? classesData : (classesData?.rows ?? []);
      const services = Array.isArray(servicesData) ? servicesData : (servicesData?.rows ?? []);
      setReconductionClasses(classes);
      setReconductionServices(services);
      setClasseSel(Object.fromEntries(classes.map((c: any) => [c.id, true])));
      setServiceSel(Object.fromEntries(services.map((s: any) => [s.id, true])));
      setClasseEdits(Object.fromEntries(classes.map((c: any) => [c.id, { nom: c.nom, capaciteMax: c.capaciteMax || 30 }])));
      setServiceEdits(Object.fromEntries(services.map((s: any) => [s.id, { name: s.name, price: s.price || 0, fraisInscription: s.fraisInscription || 0 }])));
    } catch {
      setReconductionError('Erreur lors du chargement des données.');
    } finally {
      setReconductionFetching(false);
    }
  };

  const handleConfirmReconduction = async () => {
    setReconductionLoading(true);
    setReconductionError(null);
    let classesOk = 0;
    let servicesOk = 0;
    try {
      for (const c of reconductionClasses.filter(c => classeSel[c.id])) {
        const ed = classeEdits[c.id] || { nom: c.nom, capaciteMax: c.capaciteMax || 30 };
        await apiClient.post('/classes', {
          nom: ed.nom || c.nom,
          niveau: c.niveau,
          capaciteMax: ed.capaciteMax || 30,
          description: c.description || null,
          anneeScolaire: anneeRefDisplayed,
        });
        classesOk++;
      }
      for (const s of reconductionServices.filter(s => serviceSel[s.id])) {
        const ed = serviceEdits[s.id] || { name: s.name, price: s.price || 0, fraisInscription: s.fraisInscription || 0 };
        await apiClient.post('/services', {
          name: ed.name || s.name,
          description: s.description || '',
          price: ed.price,
          isActive: true,
          imageUrl: s.imageUrl || '',
          typeOffre: s.typeOffre || 'MENSUALITE',
          niveauxCibles: s.niveauxCibles || [],
          dureeMois: s.dureeMois ?? 10,
          inclutCantine: s.inclutCantine ?? false,
          fraisInscription: ed.fraisInscription,
          estRecurrent: s.estRecurrent ?? true,
          periodicite: s.periodicite || 'MENSUEL',
          anneeScolaire: anneeRefDisplayed,
        });
        servicesOk++;
      }
      setReconductionResult({ classes: classesOk, services: servicesOk });
      setReconductionStep('done');
    } catch (err: any) {
      setReconductionError(err?.message || 'Erreur lors de la reconduction.');
    } finally {
      setReconductionLoading(false);
    }
  };

  if (loading) return (
    <div className="p-40 text-center flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="uppercase font-black text-slate-400 text-xs tracking-[0.3em]">Chargement de la configuration...</p>
    </div>
  );

  if (!localTenant) return (
    <div className="p-20 text-center space-y-6">
      <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
        <ShieldAlert size={40} />
      </div>
      <p className="uppercase font-black text-slate-400 text-xs tracking-widest">Échec de chargement des paramètres</p>
      <button onClick={() => window.location.reload()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Réessayer</button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-4">
            <SettingsIcon className="text-indigo-600" size={32} />
            Configuration Établissement
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Le Toit des Anges — Paramètres généraux, scolarité et sécurité</p>
        </div>
        {activeSubTab !== 'scolaire' && activeSubTab !== 'campagnes' && activeSubTab !== 'structure' && (
          <div className="flex justify-end flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 ${success ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200'}`}
            >
              {isSaving ? <RefreshCw className="animate-spin" size={18} /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
              {success ? 'ENREGISTRÉ' : 'ENREGISTRER'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex flex-wrap gap-2 p-1.5 bg-white border border-slate-100 rounded-[2rem] w-fit shadow-sm min-w-0">
          {[
            { id: 'general',   label: 'Établissement',    icon: Building2 },
            { id: 'branding',  label: 'Design',           icon: Palette },
            { id: 'structure', label: 'Structure',        icon: Layers },
            { id: 'scolaire',  label: 'Scolarité',        icon: GraduationCap },
            { id: 'campagnes', label: 'Années scolaires', icon: CalendarDays },
            { id: 'fiscal',    label: 'Reçus & Finances', icon: FileText },
            { id: 'profile',   label: 'Sécurité',         icon: Lock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-3 ${activeSubTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Établissement ── */}
      {activeSubTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-8 bg-white p-5 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 mb-4"><Globe size={16}/> Identité de l'Établissement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Nom de l'Établissement</label>
                <input type="text" value={localTenant.name || ''} onChange={e => setLocalTenant({...localTenant, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Ex: Le Toit des Anges" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2"><MessageSquare size={12}/> Numéro WhatsApp Business</label>
                <input type="text" value={localTenant.whatsappNumber || ''} onChange={e => setLocalTenant({...localTenant, whatsappNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Ex: 221771234567" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Email de l'Établissement</label>
                <input type="email" value={localTenant.email || ''} onChange={e => setLocalTenant({...localTenant, email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Téléphone</label>
                <input type="text" value={localTenant.phone || ''} onChange={e => setLocalTenant({...localTenant, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Adresse de l'Établissement</label>
                <textarea value={localTenant.address || ''} onChange={e => setLocalTenant({...localTenant, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px]" placeholder="Ex: 469 Cité Cheikh Omar TALL, Ouakam, Dakar" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-4 bg-indigo-900 rounded-[3rem] p-5 md:p-10 text-white relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Building2 size={120}/></div>
            <h4 className="text-lg md:text-xl font-black uppercase mb-4">Informations Officielles</h4>
            <p className="text-xs text-indigo-200 leading-relaxed font-medium uppercase tracking-widest">Ces informations apparaissent sur tous les documents générés : reçus, certificats de scolarité, bulletins et factures de mensualité.</p>
          </div>
        </div>
      )}

      {/* ── TAB: Design & Branding ── */}
      {activeSubTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-6 bg-white p-5 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2"><Palette size={16}/> Personnalisation des Couleurs</h3>
              <Pipette size={18} className="text-slate-300" />
            </div>
            <div className="space-y-8">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Couleur Primaire de l'Interface</label>
                <div className="flex flex-wrap gap-4 mb-8">
                  {['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0f172a'].map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        const v = normalizeHex(color);
                        setLocalTenant({...localTenant, primaryColor: v});
                        document.documentElement.style.setProperty('--primary-kernel', v);
                        window.dispatchEvent(new CustomEvent('tenant-theme-updated'));
                      }}
                      className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl transition-all relative flex items-center justify-center ${localTenant.primaryColor === color ? 'ring-4 ring-indigo-100 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    >
                      {localTenant.primaryColor === color && <Check size={24} className="text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Ou choisir une couleur précise (Hex)</p>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={normalizeHex(localTenant.primaryColor) || '#4f46e5'}
                      onChange={e => {
                        const v = normalizeHex(e.target.value);
                        setLocalTenant({...localTenant, primaryColor: v});
                        document.documentElement.style.setProperty('--primary-kernel', v);
                        window.dispatchEvent(new CustomEvent('tenant-theme-updated'));
                      }}
                      className="w-16 h-16 rounded-xl border-none p-0 bg-transparent cursor-pointer overflow-hidden shadow-lg"
                    />
                    <div className="flex-1 relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">#</span>
                      <input
                        type="text"
                        value={(normalizeHex(localTenant.primaryColor) || '#4f46e5').replace('#', '')}
                        onChange={e => setLocalTenant({...localTenant, primaryColor: normalizeHex('#' + e.target.value)})}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-8 pr-4 py-4 text-sm font-mono font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="FFFFFF"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-slate-100">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Couleur des Boutons</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={normalizeHex(buttonColor || localTenant.buttonColor || localTenant.button_color) || '#4f46e5'}
                    onChange={e => { const v = normalizeHex(e.target.value); setButtonColor(v); setLocalTenant({ ...localTenant, buttonColor: v }); document.documentElement.style.setProperty('--button-kernel', v); window.dispatchEvent(new CustomEvent('tenant-theme-updated')); }}
                    className="w-12 h-12 rounded-xl border-none p-0 bg-transparent cursor-pointer"
                  />
                  <div className="flex gap-3">
                    {['#4f46e5', '#0f172a', '#06b6d4', '#ef4444'].map(c => (
                      <button key={c} onClick={() => { const v = normalizeHex(c); setButtonColor(v); setLocalTenant({ ...localTenant, buttonColor: v }); document.documentElement.style.setProperty('--button-kernel', v); window.dispatchEvent(new CustomEvent('tenant-theme-updated')); }} className={`w-10 h-10 rounded-xl ${(buttonColor === c || localTenant.buttonColor === c || localTenant.button_color === c) ? 'ring-2 ring-indigo-200 scale-105' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3">Si non renseigné, reprend la couleur primaire.</p>
              </div>

              <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><Sparkles size={80}/></div>
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Aperçu en temps réel</h4>
                <div className="space-y-4">
                  <div className="h-4 w-3/4 rounded-full" style={{ backgroundColor: withAlphaHex(localTenant.primaryColor, '30') }}></div>
                  <div className="flex items-center gap-3">
                    <button className="px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg" style={{ backgroundColor: normalizeHex(localTenant.primaryColor) }}>Couleur Primaire</button>
                    <button className="px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg" style={{ backgroundColor: normalizeHex(buttonColor || localTenant.buttonColor || localTenant.button_color || localTenant.primaryColor) }}>Boutons</button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2"><LayoutDashboard size={16}/> Police & Taille</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Choisir une police</label>
                    <div className="flex gap-3 flex-wrap">
                      {[
                        { key: 'inter',      label: 'Inter',      family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" },
                        { key: 'poppins',    label: 'Poppins',    family: "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" },
                        { key: 'roboto',     label: 'Roboto',     family: "'Roboto', system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial" },
                        { key: 'montserrat', label: 'Montserrat', family: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" },
                        { key: 'lora',       label: 'Lora',       family: "'Lora', Georgia, 'Times New Roman', serif" },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setLocalTenant({ ...localTenant, fontFamily: f.family })}
                          className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border ${localTenant.fontFamily === f.family ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                          style={{ fontFamily: f.family }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Taille de base</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min={12} max={20} value={localTenant.baseFontSize || 14} onChange={e => setLocalTenant({ ...localTenant, baseFontSize: parseInt(e.target.value) })} className="flex-1 h-2 bg-slate-100 rounded-lg" />
                      <input type="number" min={12} max={24} value={localTenant.baseFontSize || 14} onChange={e => setLocalTenant({ ...localTenant, baseFontSize: parseInt(e.target.value || '14') })} className="w-20 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 text-sm font-black outline-none" />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <p className="text-base font-medium" style={{ fontFamily: localTenant.fontFamily, fontSize: `${localTenant.baseFontSize || 14}px`, lineHeight: 1.6 }}>Exemple — Le vif renard brun saute par-dessus le chien paresseux.</p>
                    <div className="mt-3 text-[12px] text-slate-500">Police: <span className="font-bold text-slate-700">{localTenant.fontFamily?.split(',')[0]}</span> · Taille: <span className="font-bold">{localTenant.baseFontSize || 14}px</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logos */}
          <div className="lg:col-span-6 bg-white p-5 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 mb-4"><ImageIcon size={16}/> Assets Visuels</h3>
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Logo de l'Établissement</label>
                <div className="relative group">
                  <input type="file" id="logo_up_settings" hidden onChange={e => handleFileUpload(e, 'logoUrl')} accept="image/*" />
                  <label htmlFor="logo_up_settings" className={`block w-full p-8 border-4 border-dashed rounded-[2.5rem] text-center cursor-pointer transition-all relative overflow-hidden group ${localTenant.logoUrl ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-100 hover:border-indigo-400 hover:bg-slate-50'}`}>
                    {isUploading === 'logoUrl' ? (
                      <div className="py-10"><Loader2 className="animate-spin mx-auto text-indigo-600" size={32} /></div>
                    ) : localTenant.logoUrl ? (
                      <img src={localTenant.logoUrl} className="h-24 mx-auto object-contain transition-transform group-hover:scale-105" alt="Logo" />
                    ) : (
                      <div className="py-6">
                        <Upload className="mx-auto text-slate-300 group-hover:text-indigo-600 transition-colors" size={40} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Importer le logo</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors pointer-events-none"></div>
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Cachet Officiel de l'Établissement</label>
                <div className="relative group">
                  <input type="file" id="cachet_up_settings" hidden onChange={e => handleFileUpload(e, 'cachetUrl')} accept="image/*" />
                  <label htmlFor="cachet_up_settings" className={`block w-full p-8 border-4 border-dashed rounded-[2.5rem] text-center cursor-pointer transition-all relative overflow-hidden group ${localTenant.cachetUrl ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-100 hover:border-indigo-400 hover:bg-slate-50'}`}>
                    {isUploading === 'cachetUrl' ? (
                      <div className="py-10"><Loader2 className="animate-spin mx-auto text-indigo-600" size={32} /></div>
                    ) : localTenant.cachetUrl ? (
                      <img src={localTenant.cachetUrl} className="h-24 mx-auto object-contain mix-blend-multiply transition-transform group-hover:scale-105" alt="Cachet" />
                    ) : (
                      <div className="py-6">
                        <Stamp className="mx-auto text-slate-300 group-hover:text-indigo-600 transition-colors" size={40} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Importer le cachet officiel</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-start gap-4">
              <ShieldCheck size={20} className="text-indigo-600 shrink-0" />
              <p className="text-[10px] font-bold text-indigo-800 uppercase leading-relaxed">
                Le logo et le cachet sont utilisés sur les certificats de scolarité, bulletins, reçus et factures.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Structure Pédagogique ── */}
      {activeSubTab === 'structure' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">

          {/* Hero */}
          <div className="flex items-center gap-4 p-6 bg-indigo-900 rounded-[2.5rem] text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-10"><Layers size={100}/></div>
            <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
              <Layers size={28} className="text-white"/>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Structure Pédagogique</h3>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1">
                Définissez les niveaux de votre établissement — crèche, collège, lycée, université…
              </p>
            </div>
          </div>

          {/* Modèles rapides */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                <Layers size={16}/> Modèles d'Établissement
              </h4>
              <button
                onClick={() => setShowTemplateConfirm('__reset__')}
                className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors"
              >
                Réinitialiser
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-bold">
              Choisissez un modèle pour préremplir la structure, puis personnalisez-la à votre guise.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => setShowTemplateConfirm(key)}
                  className="flex flex-col items-center gap-2 p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                >
                  <span className="text-2xl">{tmpl.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 group-hover:text-indigo-700 text-center leading-tight">{tmpl.label}</span>
                  <span className="text-[8px] font-bold text-slate-400">{tmpl.niveaux.length} niveau{tmpl.niveaux.length > 1 ? 'x' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Liste des niveaux */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Niveaux configurés ({niveaux.length})</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Ces niveaux apparaissent dans le module Classes</p>
              </div>
              <button
                onClick={() => {
                  setEditingNiveau({
                    value: '',
                    label: '',
                    cycle: '',
                    accentBg: NIVEAUX_PALETTES[0].bg,
                    accentText: NIVEAUX_PALETTES[0].text,
                    accentBorder: NIVEAUX_PALETTES[0].border,
                  });
                  setShowNiveauModal(true);
                }}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
              >
                <Plus size={14}/> Ajouter un niveau
              </button>
            </div>

            {niveaux.length === 0 ? (
              <div className="p-16 text-center">
                <Layers size={32} className="mx-auto text-slate-200 mb-3"/>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun niveau configuré</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Choisissez un modèle ou ajoutez un niveau manuellement</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {/* Groupé par cycle */}
                {Array.from(new Set(niveaux.map(n => n.cycle))).map(cycle => (
                  <div key={cycle}>
                    <div className="px-8 py-3 bg-slate-50">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">{cycle}</p>
                    </div>
                    {niveaux.filter(n => n.cycle === cycle).map(n => (
                      <div key={n.value} className="flex items-center gap-4 px-8 py-4 hover:bg-slate-50/50 transition-all group">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${n.accentBg} ${n.accentText} border ${n.accentBorder} shrink-0`}>
                          {n.value.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-900 text-sm">{n.label}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${n.accentBg} ${n.accentText} ${n.accentBorder}`}>
                              {n.value}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Cycle : {n.cycle}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => { setEditingNiveau({ ...n }); setShowNiveauModal(true); }}
                            className="p-2.5 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit3 size={14}/>
                          </button>
                          <button
                            onClick={() => deleteNiveau(n.value)}
                            className="p-2.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5"/>
            <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
              Modifier la structure n'affecte pas les classes et élèves déjà enregistrés. Les classes physiques existantes
              gardent leur niveau — seule l'affichage dans le module Classes change.
            </p>
          </div>
        </div>
      )}

      {/* ── MODAL: Niveau ── */}
      {showNiveauModal && editingNiveau && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowNiveauModal(false); setEditingNiveau(null); }}/>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">
                  {niveaux.find(n => n.value === editingNiveau.value) ? 'Modifier le niveau' : 'Nouveau niveau'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Structure pédagogique de l'établissement
                </p>
              </div>
              <button onClick={() => { setShowNiveauModal(false); setEditingNiveau(null); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                <X size={18}/>
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Code (identifiant)</label>
                  <input
                    type="text"
                    value={editingNiveau.value || ''}
                    onChange={e => setEditingNiveau(p => ({ ...p, value: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                    disabled={!!niveaux.find(n => n.value === editingNiveau.value)}
                    placeholder="Ex: L1, TERM, PS"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Libellé affiché</label>
                  <input
                    type="text"
                    value={editingNiveau.label || ''}
                    onChange={e => setEditingNiveau(p => ({ ...p, label: e.target.value }))}
                    placeholder="Ex: Licence 1"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Cycle / Groupe</label>
                <input
                  type="text"
                  value={editingNiveau.cycle || ''}
                  onChange={e => setEditingNiveau(p => ({ ...p, cycle: e.target.value }))}
                  placeholder="Ex: Licence, Lycée, Maternelle…"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                  list="cycles-datalist"
                />
                <datalist id="cycles-datalist">
                  {Array.from(new Set(niveaux.map(n => n.cycle))).map(c => <option key={c} value={c}/>)}
                </datalist>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX_PALETTES.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setEditingNiveau(prev => ({ ...prev, accentBg: p.bg, accentText: p.text, accentBorder: p.border }))}
                      className={`w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 ${editingNiveau.accentBg === p.bg ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: p.preview }}
                    />
                  ))}
                </div>
                {editingNiveau.label && (
                  <div className={`mt-2 inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${editingNiveau.accentBg} ${editingNiveau.accentText} ${editingNiveau.accentBorder}`}>
                    {editingNiveau.label || 'Aperçu'}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowNiveauModal(false); setEditingNiveau(null); }}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (!editingNiveau.value || !editingNiveau.label || !editingNiveau.cycle) return;
                    const existing = niveaux.find(n => n.value === editingNiveau.value);
                    if (existing) {
                      updateNiveau(editingNiveau.value, editingNiveau as NiveauDef);
                    } else {
                      addNiveau(editingNiveau as NiveauDef);
                    }
                    setShowNiveauModal(false);
                    setEditingNiveau(null);
                  }}
                  disabled={!editingNiveau.value || !editingNiveau.label || !editingNiveau.cycle}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Save size={14}/> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Confirmer chargement template ── */}
      {showTemplateConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateConfirm(null)}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-5">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-amber-600"/>
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900 uppercase">Remplacer la structure ?</p>
              <p className="text-[10px] text-slate-500 font-bold mt-2 leading-relaxed">
                {showTemplateConfirm === '__reset__'
                  ? 'Réinitialiser vers les niveaux Crèche & École primaire par défaut ?'
                  : `Charger le modèle "${TEMPLATES[showTemplateConfirm]?.label}" ? Les niveaux actuels seront remplacés.`
                }
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTemplateConfirm(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (showTemplateConfirm === '__reset__') {
                    resetToDefault();
                  } else {
                    loadTemplate(showTemplateConfirm);
                  }
                  setShowTemplateConfirm(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── TAB: Scolarité (NOUVEAU) ── */}
      {activeSubTab === 'scolaire' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 p-6 bg-indigo-900 rounded-[2.5rem] text-white relative overflow-hidden flex-1">
              <div className="absolute right-0 top-0 p-8 opacity-10"><GraduationCap size={100}/></div>
              <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
                <GraduationCap size={28} className="text-white"/>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Configuration Scolaire</h3>
                <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1">Année scolaire, trimestres, pénalités et frais d'inscription par niveau</p>
              </div>
            </div>
            <button
              onClick={handleSaveSchoolConfig}
              className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 shrink-0 ${schoolConfigSaved ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200'}`}
            >
              {schoolConfigSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
              {schoolConfigSaved ? 'ENREGISTRÉ' : 'ENREGISTRER'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Année scolaire + Trimestres */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                <Calendar size={16}/> Année Scolaire & Trimestres
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Année scolaire active</label>
                  <div className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 flex items-center justify-between">
                    <span className="text-xl font-black text-indigo-900 tracking-tighter">{anneeRefDisplayed}</span>
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Définie dans Années scolaires</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Date de début</label>
                  <input
                    type="date"
                    value={schoolConfig.anneeDebut}
                    onChange={e => setSchoolConfig(p => ({...p, anneeDebut: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Date de fin</label>
                  <input
                    type="date"
                    value={schoolConfig.anneeFin}
                    onChange={e => setSchoolConfig(p => ({...p, anneeFin: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Nombre de mois</label>
                  <input
                    type="number" min={1} max={12}
                    value={schoolConfig.nbMois}
                    onChange={e => setSchoolConfig(p => ({...p, nbMois: parseInt(e.target.value) || 10}))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Jour limite paiement mensualité</label>
                  <input
                    type="number" min={1} max={31}
                    value={schoolConfig.jourLimitePaiement}
                    onChange={e => setSchoolConfig(p => ({...p, jourLimitePaiement: parseInt(e.target.value) || 5}))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Trimestres — dates de remise des bulletins</p>
                {([
                  { key: 'trimestre1', label: '1er Trimestre', placeholder: 'Ex: Décembre 2025' },
                  { key: 'trimestre2', label: '2ème Trimestre', placeholder: 'Ex: Mars 2026' },
                  { key: 'trimestre3', label: '3ème Trimestre', placeholder: 'Ex: Juin 2026' },
                ] as const).map(t => (
                  <div key={t.key} className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest w-28 shrink-0">{t.label}</span>
                    <input
                      type="text"
                      value={schoolConfig[t.key]}
                      onChange={e => setSchoolConfig(p => ({...p, [t.key]: e.target.value}))}
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                      placeholder={t.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pénalités + Frais d'inscription */}
            <div className="space-y-6">

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                  <MessageSquare size={16}/> Pénalités
                </h4>

                <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl space-y-3">
                  <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest">Retard de paiement de mensualité</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0}
                      value={schoolConfig.penaliteRetardPaiement}
                      onChange={e => setSchoolConfig(p => ({...p, penaliteRetardPaiement: parseInt(e.target.value) || 0}))}
                      className="flex-1 bg-white border border-orange-100 rounded-2xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-orange-500/10 outline-none text-right"
                    />
                    <span className="text-[10px] font-black text-orange-600 uppercase shrink-0">FCFA / jour</span>
                  </div>
                  <p className="text-[10px] text-orange-600 font-bold">Après le {schoolConfig.jourLimitePaiement} du mois suivant</p>
                </div>

                <div className="p-5 bg-red-50 border border-red-100 rounded-2xl space-y-3">
                  <p className="text-[9px] font-black text-red-700 uppercase tracking-widest">Retard de garde (après l'heure de descente)</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0}
                      value={schoolConfig.penaliteRetardGarde}
                      onChange={e => setSchoolConfig(p => ({...p, penaliteRetardGarde: parseInt(e.target.value) || 0}))}
                      className="flex-1 bg-white border border-red-100 rounded-2xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-red-500/10 outline-none text-right"
                    />
                    <span className="text-[10px] font-black text-red-600 uppercase shrink-0">FCFA / heure</span>
                  </div>
                  <p className="text-[10px] text-red-600 font-bold">Saisie manuelle déclenchable depuis la facturation</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                  <GraduationCap size={16}/> Frais d'Inscription par Niveau (FCFA)
                </h4>
                <div className="space-y-2">
                  {niveaux.map(n => (
                    <div key={n.value} className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest w-36 shrink-0 px-2 py-1 rounded-lg border ${n.accentBg} ${n.accentText} ${n.accentBorder}`}>{n.label}</span>
                      <input
                        type="number" min={0}
                        value={schoolConfig.fraisInscription[n.value] ?? 85000}
                        onChange={e => updateFraisInscription(n.value, parseInt(e.target.value) || 0)}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none text-right"
                      />
                      <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">FCFA</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Années Scolaires ── */}
      {activeSubTab === 'campagnes' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">

          {/* Hero */}
          <div className="flex items-center gap-4 p-6 bg-indigo-900 rounded-[2.5rem] text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-10"><CalendarDays size={100}/></div>
            <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
              <CalendarDays size={28} className="text-white"/>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Gestion des Campagnes</h3>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1">
                Clôturer l'année en cours · Démarrer une nouvelle année scolaire
              </p>
            </div>
          </div>

          {/* Feedback */}
          {campagneSuccess && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0"/>
              <p className="text-sm font-bold text-emerald-700">{campagneSuccess}</p>
            </div>
          )}
          {campagneError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <XCircle size={18} className="text-red-500 shrink-0"/>
              <p className="text-sm font-bold text-red-600">{campagneError}</p>
              <button onClick={() => setCampagneError(null)} className="ml-auto text-red-400 hover:text-red-600"><XCircle size={14}/></button>
            </div>
          )}

          {/* Bouton créer */}
          <div className="flex justify-end">
            <button
              onClick={() => { setCampagneError(null); setNouvelleAnneeCreer(suggestNextAnnee(anneeRefDisplayed)); setShowCreerModal(true); }}
              className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg"
            >
              <Plus size={15}/> Créer une nouvelle année scolaire
            </button>
          </div>

          {/* Liste des années (timeline) */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-50">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Années scolaires</h4>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Cycle de vie : PRÉPARATION → INSCRIPTIONS OUVERTES → EN COURS → CLÔTURÉE</p>
            </div>

            {anneesConnues.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <CalendarDays size={32} className="mx-auto text-slate-200"/>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucune année configurée</p>
                <p className="text-[10px] text-slate-400 font-bold">Cliquez sur "Créer une nouvelle année scolaire" pour commencer</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {anneesConnues.map(annee => {
                  const cfg = anneeScolaireConfig[annee];
                  const statut = cfg?.statut || 'EN_COURS';
                  const isActive = annee === anneeRefDisplayed;

                  const statutMeta: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
                    PREPARATION:          { label: 'Préparation',          bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-400' },
                    INSCRIPTIONS_OUVERTES:{ label: 'Inscriptions ouvertes',bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500' },
                    EN_COURS:             { label: 'En cours',             bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-500' },
                    CLOTUREE:             { label: 'Clôturée',             bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',  dot: 'bg-slate-400' },
                  };
                  const meta = statutMeta[statut] || statutMeta['EN_COURS'];

                  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : null;

                  return (
                    <div key={annee} className={`flex items-center gap-4 px-8 py-5 transition-all ${isActive ? 'bg-indigo-50/30' : 'hover:bg-slate-50/60'}`}>
                      {/* Indicateur actif */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={`w-3 h-3 rounded-full ${meta.dot}`}/>
                        {isActive && <div className="w-0.5 h-4 bg-indigo-200 rounded-full"/>}
                      </div>

                      {/* Infos année */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xl font-black tracking-tighter ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{annee}</span>
                          {isActive && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-black uppercase tracking-widest">Active</span>}
                          <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border ${meta.bg} ${meta.text} ${meta.border}`}>{meta.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          {fmtDate(cfg?.dateCreation) && <span className="text-[9px] text-slate-400 font-bold">Créée le {fmtDate(cfg?.dateCreation)}</span>}
                          {fmtDate(cfg?.dateOuvertureInscriptions) && <span className="text-[9px] text-blue-400 font-bold">Inscriptions le {fmtDate(cfg?.dateOuvertureInscriptions)}</span>}
                          {fmtDate(cfg?.dateDemarrage) && <span className="text-[9px] text-emerald-500 font-bold">Démarrage le {fmtDate(cfg?.dateDemarrage)}</span>}
                          {fmtDate(cfg?.dateCloture) && <span className="text-[9px] text-slate-400 font-bold">Clôturée le {fmtDate(cfg?.dateCloture)}</span>}
                        </div>
                      </div>

                      {/* Actions selon statut */}
                      <div className="flex items-center gap-2 shrink-0">
                        {statut === 'PREPARATION' && (
                          <>
                            <button
                              onClick={() => { setCampagneError(null); setShowOuvrirModal(annee); }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5"
                            >
                              <PlayCircle size={12}/> Ouvrir inscriptions
                            </button>
                            <button
                              onClick={() => { const prev = getPreviousAnnee(annee); setReconductionStep('select'); setReconductionError(null); setReconductionResult(null); setReconductionFetching(true); setShowReconductionModal(true); apiClient.get('/classes', { params: { anneeScolaire: prev } }).catch(() => []).then(d => { const cls = Array.isArray(d) ? d : (d?.rows ?? []); setReconductionClasses(cls); setClasseSel(Object.fromEntries(cls.map((c: any) => [c.id, true]))); setClasseEdits(Object.fromEntries(cls.map((c: any) => [c.id, { nom: c.nom, capaciteMax: c.capaciteMax || 30 }]))); }).catch(() => {}).finally(() => { apiClient.get('/services', { params: { anneeScolaire: prev } }).catch(() => []).then(d => { const svs = Array.isArray(d) ? d : (d?.rows ?? []); setReconductionServices(svs); setServiceSel(Object.fromEntries(svs.map((s: any) => [s.id, true]))); setServiceEdits(Object.fromEntries(svs.map((s: any) => [s.id, { name: s.name, price: s.price || 0, fraisInscription: s.fraisInscription || 0 }]))); }).finally(() => setReconductionFetching(false)); }); }}
                              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-1.5"
                              title="Reconduire depuis l'année précédente"
                            >
                              <RefreshCw size={12}/> Reconduire
                            </button>
                          </>
                        )}
                        {statut === 'INSCRIPTIONS_OUVERTES' && (
                          <>
                            <button
                              onClick={() => { setCampagneError(null); setShowDemarrerModal(annee); }}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                            >
                              <PlayCircle size={12}/> Démarrer l'année
                            </button>
                            <button
                              onClick={() => { const prev = getPreviousAnnee(annee); setReconductionStep('select'); setReconductionError(null); setReconductionResult(null); setReconductionFetching(true); setShowReconductionModal(true); apiClient.get('/classes', { params: { anneeScolaire: prev } }).catch(() => []).then(d => { const cls = Array.isArray(d) ? d : (d?.rows ?? []); setReconductionClasses(cls); setClasseSel(Object.fromEntries(cls.map((c: any) => [c.id, true]))); setClasseEdits(Object.fromEntries(cls.map((c: any) => [c.id, { nom: c.nom, capaciteMax: c.capaciteMax || 30 }]))); }).catch(() => {}).finally(() => { apiClient.get('/services', { params: { anneeScolaire: prev } }).catch(() => []).then(d => { const svs = Array.isArray(d) ? d : (d?.rows ?? []); setReconductionServices(svs); setServiceSel(Object.fromEntries(svs.map((s: any) => [s.id, true]))); setServiceEdits(Object.fromEntries(svs.map((s: any) => [s.id, { name: s.name, price: s.price || 0, fraisInscription: s.fraisInscription || 0 }]))); }).finally(() => setReconductionFetching(false)); }); }}
                              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-1.5"
                              title="Reconduire depuis l'année précédente"
                            >
                              <RefreshCw size={12}/> Reconduire
                            </button>
                          </>
                        )}
                        {statut === 'EN_COURS' && (
                          <button
                            onClick={() => { setCampagneError(null); setShowCloturerAnneeModal(annee); }}
                            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-1.5"
                          >
                            <Archive size={12}/> Clôturer
                          </button>
                        )}
                        {statut === 'CLOTUREE' && (
                          <button
                            onClick={() => setShowReactiverModal(annee)}
                            className="px-3 py-2 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all"
                          >
                            <Archive size={11}/> Réactiver
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info cycle de vie */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-start gap-4">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Guide du cycle de vie</p>
              <ul className="text-[10px] text-slate-500 font-bold space-y-1 list-disc list-inside leading-relaxed">
                <li><span className="text-amber-600">Préparation</span> : créez les classes et offres sans basculer l'application</li>
                <li><span className="text-blue-600">Inscriptions ouvertes</span> : le module Admission accepte les dossiers pour cette année</li>
                <li><span className="text-emerald-600">En cours</span> : toute l'application bascule sur cette année (annee_active)</li>
                <li><span className="text-slate-500">Clôturée</span> : données consultables en lecture seule, audit enregistré</li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* ── MODAL: Créer une nouvelle année ── */}
      {showCreerModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreerModal(false); setCampagneError(null); }}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0"><Plus size={28} className="text-indigo-600"/></div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">Nouvelle année scolaire</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Créée en mode Préparation</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Libellé de l'année</label>
              <input type="text" value={nouvelleAnneeCreer} onChange={e => { setNouvelleAnneeCreer(e.target.value); setCampagneError(null); }} placeholder="Ex: 2026-2027" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xl font-black text-center tracking-widest focus:ring-4 focus:ring-indigo-500/20 outline-none"/>
              {nouvelleAnneeCreer && !/^\d{4}-\d{4}$/.test(nouvelleAnneeCreer) && <p className="text-[10px] text-red-500 font-bold px-2">Format requis: YYYY-YYYY</p>}
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5"/>
              <p className="text-[10px] font-bold text-amber-800 leading-relaxed">L'année sera créée en mode <strong>Préparation</strong>. Vous pourrez ensuite créer les classes, puis ouvrir les inscriptions quand vous êtes prêt.</p>
            </div>
            {campagneError && <p className="text-xs text-red-500 font-bold px-1">{campagneError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowCreerModal(false); setCampagneError(null); }} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
              <button onClick={handleCreerAnnee} disabled={campagneLoading || !/^\d{4}-\d{4}$/.test(nouvelleAnneeCreer)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {campagneLoading ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Ouvrir inscriptions ── */}
      {showOuvrirModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOuvrirModal(null)}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0"><PlayCircle size={28} className="text-blue-600"/></div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">Ouvrir les inscriptions</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{showOuvrirModal}</p>
              </div>
            </div>
            <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl space-y-2">
              {['Le module Admission accepte les nouveaux dossiers pour cette année', 'L\'année reste en Préparation — l\'application ne bascule pas encore', 'Vous pouvez continuer à créer des classes et configurer les tarifs'].map((t, i) => (
                <div key={i} className="flex items-start gap-2"><ChevronRight size={12} className="text-blue-500 shrink-0 mt-0.5"/><p className="text-[10px] font-bold text-blue-800">{t}</p></div>
              ))}
            </div>
            {campagneError && <p className="text-xs text-red-500 font-bold">{campagneError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowOuvrirModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
              <button onClick={() => handleOuvrirInscriptions(showOuvrirModal!)} disabled={campagneLoading} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {campagneLoading ? <Loader2 size={14} className="animate-spin"/> : <PlayCircle size={14}/>} Confirmer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Démarrer l'année ── */}
      {showDemarrerModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDemarrerModal(null)}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0"><PlayCircle size={28} className="text-emerald-600"/></div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">Démarrer l'année</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{showDemarrerModal} — Toute l'application bascule</p>
              </div>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              {[`L'année active passe à ${showDemarrerModal}`, 'Tous les utilisateurs voient la nouvelle année', 'Les années passées restent en lecture seule', 'Classes et services doivent être configurés avant de démarrer'].map((t, i) => (
                <div key={i} className="flex items-start gap-2"><ChevronRight size={12} className="text-emerald-500 shrink-0 mt-0.5"/><p className="text-[10px] font-bold text-slate-600">{t}</p></div>
              ))}
            </div>
            {campagneError && <p className="text-xs text-red-500 font-bold">{campagneError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowDemarrerModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
              <button onClick={() => handleDemarrerAnnee(showDemarrerModal!)} disabled={campagneLoading} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {campagneLoading ? <Loader2 size={14} className="animate-spin"/> : <PlayCircle size={14}/>} Démarrer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Clôturer une année ── */}
      {showCloturerAnneeModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCloturerAnneeModal(null)}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0"><Archive size={28} className="text-amber-600"/></div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">Clôturer l'année</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Action irréversible</p>
              </div>
            </div>
            <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5"/>
              <p className="text-xs font-bold text-amber-800">Vous allez clôturer officiellement l'année scolaire <strong>{showCloturerAnneeModal}</strong>. Cette action sera enregistrée dans le journal d'audit. Les données resteront consultables en lecture seule.</p>
            </div>
            {campagneError && <p className="text-xs text-red-500 font-bold">{campagneError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowCloturerAnneeModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
              <button onClick={() => handleCloturerAnneeNew(showCloturerAnneeModal!)} disabled={campagneLoading} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {campagneLoading ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14}/>} Confirmer la clôture
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Réactiver une année clôturée ── */}
      {showReactiverModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReactiverModal(null)}/>
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0"><Archive size={28} className="text-emerald-600"/></div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900">Réactiver l'année</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Correction d'une clôture accidentelle</p>
              </div>
            </div>
            <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={16} className="text-emerald-600 shrink-0 mt-0.5"/>
              <p className="text-xs font-bold text-emerald-800">
                Vous allez réactiver l'année scolaire <strong>{showReactiverModal}</strong> et la définir comme année active.
                Elle passera du statut <em>Clôturée</em> à <em>En cours</em>.
              </p>
            </div>
            {campagneError && <p className="text-xs text-red-500 font-bold">{campagneError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowReactiverModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Annuler</button>
              <button onClick={() => handleReactiverAnnee(showReactiverModal!)} disabled={campagneLoading} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {campagneLoading ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14}/>} Confirmer la réactivation
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Reconduction d'année ── */}
      {showReconductionModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !reconductionLoading && setShowReconductionModal(false)}/>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="p-8 pb-5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                  <RefreshCw size={26} className="text-indigo-600"/>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900">Reconduire la Configuration</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {getPreviousAnnee(anneeRefDisplayed)} &rarr; {anneeRefDisplayed}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="px-8 flex-1 overflow-y-auto space-y-6 pb-2">

              {reconductionStep === 'done' ? (
                /* ── Résultat ── */
                <div className="flex flex-col items-center py-10 gap-6">
                  <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center">
                    <CheckCircle2 size={40} className="text-emerald-600"/>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xl font-black text-slate-900 uppercase tracking-tighter">Reconduction terminée !</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{anneeRefDisplayed}</p>
                  </div>
                  <div className="w-full space-y-3">
                    {!!reconductionResult?.classes && (
                      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                        <GraduationCap size={18} className="text-indigo-600 shrink-0"/>
                        <p className="text-sm font-black text-indigo-700">
                          {reconductionResult.classes} classe{reconductionResult.classes > 1 ? 's' : ''} créée{reconductionResult.classes > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                    {!!reconductionResult?.services && (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <CreditCard size={18} className="text-emerald-600 shrink-0"/>
                        <p className="text-sm font-black text-emerald-700">
                          {reconductionResult.services} offre{reconductionResult.services > 1 ? 's' : ''} de scolarité créée{reconductionResult.services > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl w-full space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prochaines étapes</p>
                    {['Allez dans Classes pour affecter les enseignants', 'Utilisez la Réinscription pour rattacher les élèves'].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight size={12} className="text-emerald-500 shrink-0 mt-0.5"/>
                        <p className="text-[10px] font-bold text-slate-600">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : reconductionFetching ? (
                /* ── Chargement ── */
                <div className="flex flex-col items-center py-16 gap-4">
                  <Loader2 size={36} className="animate-spin text-indigo-600"/>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Chargement des données {getPreviousAnnee(anneeRefDisplayed)}...
                  </p>
                </div>
              ) : reconductionClasses.length === 0 && reconductionServices.length === 0 ? (
                /* ── Vide ── */
                <div className="flex flex-col items-center py-16 gap-4">
                  <AlertTriangle size={36} className="text-amber-400"/>
                  <p className="text-sm font-black text-slate-700">Aucune donnée pour {getPreviousAnnee(anneeRefDisplayed)}</p>
                  <p className="text-[10px] text-slate-400 font-bold text-center max-w-xs leading-relaxed">
                    Il n'y a pas encore de classes ni d'offres enregistrées pour l'année précédente.
                    Créez-les manuellement dans les modules Classes et Offres de Scolarité.
                  </p>
                </div>
              ) : (
                <>
                  {reconductionError && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                      <XCircle size={16} className="text-red-500 shrink-0"/>
                      <p className="text-xs font-bold text-red-600">{reconductionError}</p>
                    </div>
                  )}

                  {/* ── Classes ── */}
                  {reconductionClasses.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                          <GraduationCap size={14}/> Classes ({reconductionClasses.length})
                        </p>
                        <button
                          onClick={() => {
                            const allSel = reconductionClasses.every(c => classeSel[c.id]);
                            setClasseSel(Object.fromEntries(reconductionClasses.map(c => [c.id, !allSel])));
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-700 transition-colors"
                        >
                          {reconductionClasses.every(c => classeSel[c.id]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {reconductionClasses.map(c => {
                          const sel = !!classeSel[c.id];
                          const ed = classeEdits[c.id] || { nom: c.nom, capaciteMax: c.capaciteMax || 30 };
                          return (
                            <div key={c.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${sel ? 'border-indigo-100 bg-indigo-50/40' : 'border-slate-100 bg-slate-50 opacity-40'}`}>
                              <button
                                onClick={() => setClasseSel(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}
                              >
                                {sel && <Check size={10} className="text-white stroke-[3]"/>}
                              </button>
                              <input
                                value={ed.nom}
                                onChange={e => setClasseEdits(prev => ({ ...prev, [c.id]: { ...ed, nom: e.target.value } }))}
                                disabled={!sel}
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 py-1 bg-slate-100 rounded-lg shrink-0">{c.niveau}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] text-slate-400 font-bold">Cap.</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={ed.capaciteMax}
                                  onChange={e => setClasseEdits(prev => ({ ...prev, [c.id]: { ...ed, capaciteMax: Number(e.target.value) } }))}
                                  disabled={!sel}
                                  className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-black text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Services / Offres ── */}
                  {reconductionServices.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                          <CreditCard size={14}/> Offres de Scolarité ({reconductionServices.length})
                        </p>
                        <button
                          onClick={() => {
                            const allSel = reconductionServices.every(s => serviceSel[s.id]);
                            setServiceSel(Object.fromEntries(reconductionServices.map(s => [s.id, !allSel])));
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-700 transition-colors"
                        >
                          {reconductionServices.every(s => serviceSel[s.id]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {reconductionServices.map(s => {
                          const sel = !!serviceSel[s.id];
                          const ed = serviceEdits[s.id] || { name: s.name, price: s.price || 0, fraisInscription: s.fraisInscription || 0 };
                          return (
                            <div key={s.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${sel ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50 opacity-40'}`}>
                              <button
                                onClick={() => setServiceSel(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${sel ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'}`}
                              >
                                {sel && <Check size={10} className="text-white stroke-[3]"/>}
                              </button>
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={ed.name}
                                    onChange={e => setServiceEdits(prev => ({ ...prev, [s.id]: { ...ed, name: e.target.value } }))}
                                    disabled={!sel}
                                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 py-1 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
                                    {s.typeOffre || 'MENSUALITE'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">Prix</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={ed.price}
                                      onChange={e => setServiceEdits(prev => ({ ...prev, [s.id]: { ...ed, price: Number(e.target.value) } }))}
                                      disabled={!sel}
                                      className="w-28 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-black text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-[9px] text-slate-400 font-bold">FCFA</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">Frais inscr.</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={ed.fraisInscription}
                                      onChange={e => setServiceEdits(prev => ({ ...prev, [s.id]: { ...ed, fraisInscription: Number(e.target.value) } }))}
                                      disabled={!sel}
                                      className="w-28 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-black text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-[9px] text-slate-400 font-bold">FCFA</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 pt-5 border-t border-slate-100 shrink-0">
              {reconductionStep === 'done' ? (
                <button
                  onClick={() => setShowReconductionModal(false)}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                >
                  Fermer
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReconductionModal(false)}
                    disabled={reconductionLoading}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  {!reconductionFetching && (reconductionClasses.length > 0 || reconductionServices.length > 0) && (
                    <button
                      onClick={handleConfirmReconduction}
                      disabled={reconductionLoading || (!Object.values(classeSel).some(Boolean) && !Object.values(serviceSel).some(Boolean))}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {reconductionLoading
                        ? <><Loader2 size={14} className="animate-spin"/> Reconduction en cours...</>
                        : <><RefreshCw size={14}/> Confirmer la reconduction</>
                      }
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── TAB: Reçus & Finances ── */}
      {activeSubTab === 'fiscal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-8 bg-white p-5 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 mb-4"><CreditCard size={16}/> Paramètres Financiers & Reçus</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Devise</label>
                <select value={localTenant.currency || 'F CFA'} onChange={e => setLocalTenant({...localTenant, currency: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10">
                  <option>F CFA</option>
                  <option>€</option>
                  <option>$</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Taux de Taxe (%)</label>
                <input type="number" value={localTenant.taxRate || 0} onChange={e => setLocalTenant({...localTenant, taxRate: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="0 si exonéré" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Préfixe Reçu / Facture</label>
                <input type="text" value={localTenant.invoicePrefix || ''} onChange={e => setLocalTenant({...localTenant, invoicePrefix: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-mono font-black outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Ex: LTA" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Pied de Reçu / Facture</label>
                <textarea value={localTenant.invoiceFooter || ''} onChange={e => setLocalTenant({...localTenant, invoiceFooter: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px]" placeholder="Ex: Merci de votre confiance — Le Toit des Anges, 469 Cité Cheikh Omar TALL, Ouakam, Dakar" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-5 md:p-10 text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5"><FileText size={120}/></div>
            <h4 className="text-lg md:text-xl font-black uppercase mb-4 tracking-tighter">Gestion Financière</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold uppercase tracking-widest">Ces paramètres s'appliquent à tous les reçus, factures de mensualité et documents financiers générés pour les familles.</p>
          </div>
        </div>
      )}

      {/* ── TAB: Sécurité ── */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4 p-6 bg-indigo-900 rounded-[2.5rem] text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-10"><ShieldCheck size={100}/></div>
            <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
              <Lock size={28} className="text-white"/>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Sécurité Administrateur</h3>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1">Gérez vos accès et mots de passe</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Changement de mot de passe */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Lock size={18} className="text-indigo-600"/>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase">Changer le mot de passe</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mise à jour sécurisée de vos identifiants</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Mot de passe actuel</label>
                  <input type={pwShowCurrent ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 pr-12 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50" />
                  <button type="button" onClick={() => setPwShowCurrent(v => !v)} className="absolute right-4 bottom-3.5 text-slate-400 hover:text-slate-700"><Lock size={15}/></button>
                </div>
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nouveau mot de passe</label>
                  <input type={pwShowNew ? 'text' : 'password'} value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 pr-12 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50" />
                  <button type="button" onClick={() => setPwShowNew(v => !v)} className="absolute right-4 bottom-3.5 text-slate-400 hover:text-slate-700"><Lock size={15}/></button>
                </div>
                {pwNew && (() => {
                  const s = getPasswordStrength(pwNew);
                  return (
                    <div className="space-y-1.5 px-1">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${s.color}`} style={{ width: s.width }}/>
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                    </div>
                  );
                })()}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Confirmer le nouveau mot de passe</label>
                  <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50" />
                </div>
              </div>
              {pwError && <p className="text-xs text-red-500 font-bold px-1">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-600 font-bold px-1 flex items-center gap-2"><CheckCircle2 size={14}/> Mot de passe mis à jour avec succès.</p>}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={generateStrongPassword} className="flex-1 min-w-[140px] px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center justify-center gap-2">
                  <Sparkles size={13}/> Générer
                </button>
                <button type="button" onClick={handleChangePassword} disabled={pwSaving} className="flex-1 min-w-[140px] px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {pwSaving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                  Enregistrer
                </button>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="space-y-4">
              <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                    <ShieldCheck size={22} className="text-indigo-600"/>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">Double Authentification</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Sécurise l'accès par code mobile</p>
                  </div>
                </div>
                <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shrink-0">GÉRER</button>
              </div>
              <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                    <FileText size={22} className="text-slate-500"/>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">Registre de connexion</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Historique des accès à l'application</p>
                  </div>
                </div>
                <button className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shrink-0">VOIR</button>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-start gap-4">
                <ShieldCheck size={20} className="text-indigo-500 shrink-0 mt-0.5"/>
                <p className="text-[10px] font-bold text-indigo-700 uppercase leading-relaxed">
                  Activez la double authentification pour sécuriser l'accès à l'administration de l'établissement.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
