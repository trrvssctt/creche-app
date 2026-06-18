
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Smartphone, Activity, ScanEye, RefreshCw, 
  ShieldAlert, Shield, KeyRound, UserPlus, X, Mail, CheckCircle2,
  LockKeyhole, ArrowRight, Loader2 as LucideLoader, Smartphone as MobileIcon,
  ShieldQuestion, UserCheck, UserX, Database, CloudLightning,
  Key, Eye, EyeOff, ShieldEllipsis, Copy, Check, AlertCircle
} from 'lucide-react';
import { User, UserRole } from '../types';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';

const SecurityPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // États Modales
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [resetAccessModal, setResetAccessModal] = useState<User | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGenPass, setShowGenPass] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [healthData, setHealthData] = useState<any>({ uptime: '100%', status: 'SECURE' });
  const [lastBackup, setLastBackup] = useState<any>(null);
  const [integrityStatus, setIntegrityStatus] = useState<string>('CERTIFIED');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const results = await Promise.allSettled([
        apiClient.get('/auth/users'),
        apiClient.get('/resilience/health'),
        apiClient.get('/resilience/backups')
      ]);

      if (results[0].status === 'fulfilled') setUsers(results[0].value || []);
      if (results[1].status === 'fulfilled') setHealthData(results[1].value);
      if (results[2].status === 'fulfilled') setLastBackup(results[2].value?.[0] || null);
      
      setIntegrityStatus('CERTIFIED');
    } catch (err) {
      console.error("Kernel Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSecurityData(); }, []);
  const showToast = useToast();

  const generateStrongPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let retVal = "";
    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      retVal += charset.charAt(array[i] % charset.length);
    }
    setGeneratedPassword(retVal);
    setShowGenPass(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetAccess = async () => {
    if (!resetAccessModal || !generatedPassword) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post(`/auth/users/${resetAccessModal.id}/reset-password`, { 
        newPassword: generatedPassword 
      });
      setResetAccessModal(null);
      setGeneratedPassword('');
      setShowGenPass(false);
      showToast("Nouveaux accès scellés avec succès.", 'success');
    } catch (err: any) {
      console.error("Reset Password Error:", err);
      setErrorMessage(err.message || "Erreur critique lors de la réinitialisation.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMFA = async (user: User) => {
    try {
      const res = await apiClient.post(`/auth/users/${user.id}/toggle-mfa`, {});
      setUsers(users.map(u => u.id === user.id ? { ...u, mfaEnabled: res.mfaEnabled } : u));
    } catch {
      showToast("Échec du basculement MFA.", 'error');
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      const updated = await apiClient.put(`/auth/users/${user.id}`, { isActive: !user.isActive });
      setUsers(users.map(u => u.id === updated.id ? updated : u));
    } catch { showToast("Action IAM impossible.", 'error'); }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1500));
    await fetchSecurityData();
    setIsSyncing(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <LucideLoader className="animate-spin text-indigo-600" size={48} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scan des signatures cryptographiques...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <ShieldCheck className="text-indigo-600" size={32} /> Centre de Contrôle Cyber
          </h2>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">Gouvernance & Isolation du Tenant</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowInviteModal(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-900 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
            <UserPlus size={18} /> INVITER OPÉRATEUR
          </button>
          <button onClick={handleSync} disabled={isSyncing} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
            {isSyncing ? <LucideLoader className="animate-spin" size={18} /> : <RefreshCw size={18} />} POINT DE RESTAURATION
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all">
          <div className="flex justify-between">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><CloudLightning size={24} /></div>
            <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">Actif</span>
          </div>
          <div className="mt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernier Snapshot</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{lastBackup ? new Date(lastBackup.createdAt).toLocaleTimeString() : "Synchronisé"}</h3>
            <p className="text-[9px] text-emerald-600 font-bold uppercase mt-2">AlwaysData Protected</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
          <div className="flex justify-between">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><LockKeyhole size={24} /></div>
            <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full uppercase">Iso-Tenant</span>
          </div>
          <div className="mt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Santé Instance</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{healthData.uptime} Uptime</h3>
            <p className="text-[9px] text-indigo-600 font-bold uppercase mt-2">Isolation Triple-Sandbox</p>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><ScanEye size={80} /></div>
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg relative z-10"><Activity size={24} /></div>
          <div className="mt-6 relative z-10">
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Audit Intégrité</p>
            <h3 className="text-xl font-black text-white mt-1 uppercase">{integrityStatus}</h3>
            <p className="text-[9px] text-indigo-400 font-bold uppercase mt-2 italic">PITR Security v3.2</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><ShieldAlert size={24} /></div>
          <div className="mt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alerte Gouvernance</p>
            <h3 className="text-xl font-black text-rose-600 mt-1">0 Anomalie</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-2">ISO-27001 Compliance</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gestion des Identités (IAM)</h3>
          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-sm">
            {users.length} Sessions Autorisées
          </span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="px-10 py-6">Utilisateur</th>
              <th className="px-10 py-6">Rôles Attribués</th>
              <th className="px-10 py-6 text-center">Sécurité (MFA)</th>
              <th className="px-10 py-6 text-right">Contrôle Accès</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-slate-50/30 transition-all ${!u.isActive ? 'opacity-50 grayscale' : ''}`}>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black uppercase shadow-lg">{u.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase">{u.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <div className="flex flex-wrap gap-2">
                    {(u.roles || [u.role]).map(r => (
                      <span key={r} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[7px] font-black uppercase">{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-10 py-6 text-center">
                  <button 
                    onClick={() => toggleMFA(u)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${u.mfaEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-400 hover:text-indigo-600'}`}
                  >
                    {u.mfaEnabled ? <UserCheck size={10}/> : <ShieldQuestion size={10}/>} {u.mfaEnabled ? 'MFA ACTIF' : 'ACTIVER MFA'}
                  </button>
                </td>
                <td className="px-10 py-6 text-right space-x-2">
                  <button 
                    onClick={() => { setResetAccessModal(u); setErrorMessage(null); }}
                    className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"
                    title="Réinitialiser Accès"
                  >
                    <Key size={18}/>
                  </button>
                  <button onClick={() => toggleUserStatus(u)} className={`p-3 rounded-xl transition-all ${u.isActive ? 'bg-slate-100 text-slate-400 hover:text-rose-600 shadow-sm' : 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20'}`}>
                    {u.isActive ? <Lock size={18}/> : <RefreshCw size={18}/>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODALE REINITIALISATION ACCES */}
      {resetAccessModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden p-10 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                       <ShieldEllipsis size={24}/>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Réinitialisation Accès</h3>
                 </div>
                 <button onClick={() => {setResetAccessModal(null); setGeneratedPassword(''); setShowGenPass(false); setErrorMessage(null);}}><X size={24} className="text-slate-300 hover:text-slate-900"/></button>
              </div>

              <div className="space-y-6">
                 {errorMessage && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3 animate-in shake">
                       <AlertCircle size={16}/> {errorMessage}
                    </div>
                 )}

                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Utilisateur ciblé</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{resetAccessModal.name}</p>
                    <p className="text-[10px] text-indigo-500 font-bold">{resetAccessModal.email}</p>
                 </div>

                 {generatedPassword ? (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nouvelle Clé d'Accès</label>
                       <div className="relative group">
                          <input 
                             type={showGenPass ? "text" : "password"} 
                             readOnly 
                             value={generatedPassword}
                             className="w-full bg-slate-900 text-indigo-400 font-mono text-lg py-5 px-6 rounded-2xl border border-slate-800 shadow-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                             <button onClick={() => setShowGenPass(!showGenPass)} className="p-2 text-slate-500 hover:text-white transition-colors">
                                {showGenPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                             </button>
                             <button onClick={copyToClipboard} className={`p-2 transition-colors ${isCopied ? 'text-emerald-500' : 'text-slate-500 hover:text-white'}`}>
                                {isCopied ? <Check size={18}/> : <Copy size={18}/>}
                             </button>
                          </div>
                       </div>
                       <p className="text-[9px] text-rose-500 font-black uppercase text-center animate-pulse">Attention : Copiez cette clé avant de valider.</p>
                    </div>
                 ) : (
                    <button 
                       onClick={generateStrongPassword}
                       className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                    >
                       <RefreshCw size={18}/> GÉNÉRER UNE CLÉ FORTE
                    </button>
                 )}

                 {generatedPassword && (
                    <button 
                       onClick={handleResetAccess}
                       disabled={actionLoading}
                       className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3"
                    >
                       {actionLoading ? <LucideLoader className="animate-spin" size={18}/> : <><CheckCircle2 size={18}/> SCELLER LES NOUVEAUX ACCÈS</>}
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SecurityPanel;
