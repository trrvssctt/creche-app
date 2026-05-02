
import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Globe, Image as ImageIcon,
  ShieldCheck, Save, Check, FileText, ShieldAlert,
  Lock, Palette, LayoutDashboard, CreditCard, Sparkles,
  CheckCircle2, Building2, Stamp, RefreshCw, Upload,
  Loader2, Pipette, GraduationCap, Calendar, MessageSquare
} from 'lucide-react';
import { AppSettings } from '../types';
import { apiClient } from '../services/api';
import { uploadFile } from '../services/uploadService';
import { authBridge } from '../services/authBridge';

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
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'branding' | 'scolaire' | 'fiscal' | 'profile'>('general');
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
        {activeSubTab !== 'scolaire' && (
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
            { id: 'general',   label: 'Établissement',  icon: Building2 },
            { id: 'branding',  label: 'Design',         icon: Palette },
            { id: 'scolaire',  label: 'Scolarité',      icon: GraduationCap },
            { id: 'fiscal',    label: 'Reçus & Finances', icon: FileText },
            { id: 'profile',   label: 'Sécurité',       icon: Lock },
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
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Libellé de l'année</label>
                  <input
                    type="text"
                    value={schoolConfig.anneeLibelle}
                    onChange={e => setSchoolConfig(p => ({...p, anneeLibelle: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none"
                    placeholder="Ex: 2025-2026"
                  />
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
                  {Object.keys(NIVEAUX_LABELS).map(niveau => (
                    <div key={niveau} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest w-36 shrink-0">{NIVEAUX_LABELS[niveau]}</span>
                      <input
                        type="number" min={0}
                        value={schoolConfig.fraisInscription[niveau] ?? 85000}
                        onChange={e => updateFraisInscription(niveau, parseInt(e.target.value) || 0)}
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
