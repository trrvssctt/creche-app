
import React, { useState } from 'react';
import {
  ShieldCheck, Lock, ArrowRight, RefreshCw,
  ShieldAlert, Eye, EyeOff, Fingerprint, Terminal, Zap
} from 'lucide-react';
import { User, UserRole } from '../types';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';

interface Props {
  onLoginSuccess: (user: User) => void;
}

const SuperAdminLogin: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.post('/auth/superadmin/login', {
        email: email.trim().toLowerCase(),
        password: password.trim()
      });

      const user = {
        ...data.user,
        role: UserRole.SUPER_ADMIN,
        roles: [UserRole.SUPER_ADMIN],
        tenantId: 'SYSTEM'
      };

      authBridge.saveSession(user, data.token);
      onLoginSuccess(user);
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message || err?.response?.data?.error;
      setError(serverMessage || err.message || "Accès au Kernel refusé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-3xl" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="relative inline-flex mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-rose-500/20 to-indigo-600/20 border border-rose-500/20 rounded-[2rem] flex items-center justify-center shadow-2xl">
              <Fingerprint size={44} className="text-rose-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
              <ShieldCheck size={12} className="text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-rose-500 tracking-[0.5em] uppercase">Zone restreinte</p>
            <h1 className="text-4xl font-black text-white tracking-tight">Kernel Master</h1>
            <p className="text-sm text-zinc-500 mt-2">Espace d'administration SuperAdmin</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-3xl p-8 shadow-2xl">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 text-rose-400 text-xs font-bold animate-in fade-in duration-300">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Identifiant</label>
              <div className="relative group">
                <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-400 transition-colors" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value.toLowerCase())}
                  className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-rose-500/50 rounded-xl pl-12 pr-4 py-4 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-zinc-600"
                  placeholder="admin@kernel.sys"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Clé d'accès</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-400 transition-colors" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-rose-500/50 rounded-xl pl-12 pr-12 py-4 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-zinc-600"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.25em] shadow-lg shadow-rose-500/20 hover:from-rose-400 hover:to-rose-500 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Authentification...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Accéder au Kernel
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[9px] font-black text-zinc-700 uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Système opérationnel
          </div>
          <p className="text-[9px] text-zinc-700 uppercase tracking-widest">
            Chaque tentative d'accès est enregistrée avec signature IP.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
