import React, { useState } from 'react';
import { User } from '../types';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { Eye, EyeOff, Loader2, Baby, School, UserPlus, Search, ArrowLeft, Mail, Lock, Check } from 'lucide-react';

interface ParentLoginProps {
  onLoginSuccess: (user: User) => void;
}

type View = 'login' | 'forgot' | 'reset';

const ParentLogin: React.FC<ParentLoginProps> = ({ onLoginSuccess }) => {
  // Vue active
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') ? 'reset' : 'login';
  });

  // Login
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Reset password (via token)
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [ecoleBranding] = useState<{ name?: string; logoUrl?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('ecole_branding');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Veuillez saisir votre email et mot de passe.'); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post('/auth/login', { email, password });
      const user: User = data.user;
      const rolesArr = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role];
      const isParent = rolesArr.some((r: any) => r === 'PARENT' || r === 'TUTEUR');
      if (!isParent) { setError('Ce portail est réservé aux parents.'); setLoading(false); return; }
      authBridge.saveSession(user, data.token, data.sessionToken);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err?.message || 'Email ou mot de passe incorrect.');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { setForgotError('Veuillez saisir votre email.'); return; }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await apiClient.post('/parent-forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err?.message || 'Erreur lors de l\'envoi.');
    } finally { setForgotLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) { setResetError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (newPwd !== confirmPwd) { setResetError('Les mots de passe ne correspondent pas.'); return; }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) { setResetError('Token manquant. Utilisez le lien reçu par email.'); return; }
    setResetLoading(true);
    setResetError(null);
    try {
      await apiClient.post('/parent-reset-password', { token, newPassword: newPwd });
      setResetDone(true);
    } catch (err: any) {
      setResetError(err?.message || 'Lien invalide ou expiré.');
    } finally { setResetLoading(false); }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm";

  const renderContent = () => {
    // ── Forgot password ──
    if (view === 'forgot') {
      if (forgotSent) return (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Email envoyé !</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            Si un compte parent existe avec l'adresse <strong>{forgotEmail}</strong>,
            vous recevrez un lien de réinitialisation dans quelques instants.
          </p>
          <p className="text-xs text-gray-400 mb-5">Pensez à vérifier vos spams.</p>
          <button onClick={() => { setView('login'); setForgotSent(false); setForgotEmail(''); }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 hover:text-amber-700">
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>
        </div>
      );

      return (
        <form onSubmit={handleForgot} className="space-y-5">
          <div className="text-center mb-2">
            <Lock className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900">Mot de passe oublié</h3>
            <p className="text-xs text-gray-500 mt-1">Saisissez votre adresse email pour recevoir un lien de réinitialisation.</p>
          </div>

          {forgotError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{forgotError}</div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Adresse email</label>
            <input type="text" inputMode="email" value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value.trim())}
              placeholder="votre@email.com" className={inputCls} autoComplete="email" disabled={forgotLoading} />
          </div>

          <button type="submit" disabled={forgotLoading || !forgotEmail}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-3 rounded-xl transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
            {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : 'Envoyer le lien de réinitialisation'}
          </button>

          <button type="button" onClick={() => { setView('login'); setForgotError(null); }}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 py-2">
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>
        </form>
      );
    }

    // ── Reset password (via token) ──
    if (view === 'reset') {
      if (resetDone) return (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Mot de passe modifié !</h3>
          <p className="text-sm text-gray-500 mb-5">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          <button onClick={() => { setView('login'); window.history.replaceState({}, '', '/parents'); }}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold py-3 rounded-xl transition-all shadow-md">
            Se connecter
          </button>
        </div>
      );

      return (
        <form onSubmit={handleReset} className="space-y-5">
          <div className="text-center mb-2">
            <Lock className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900">Nouveau mot de passe</h3>
            <p className="text-xs text-gray-500 mt-1">Choisissez un nouveau mot de passe pour votre compte.</p>
          </div>

          {resetError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{resetError}</div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Nouveau mot de passe</label>
            <div className="relative">
              <input type={showNewPwd ? 'text' : 'password'} value={newPwd}
                onChange={e => setNewPwd(e.target.value)} placeholder="Min. 6 caractères"
                className={`${inputCls} pr-12`} minLength={6} required disabled={resetLoading} />
              <button type="button" onClick={() => setShowNewPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Confirmer le mot de passe</label>
            <input type="password" value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)} placeholder="Retapez le mot de passe"
              className={inputCls} minLength={6} required disabled={resetLoading} />
          </div>

          <button type="submit" disabled={resetLoading || !newPwd || !confirmPwd}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-3 rounded-xl transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
            {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Modification…</> : 'Modifier le mot de passe'}
          </button>
        </form>
      );
    }

    // ── Login (default) ──
    return (
      <>
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Adresse email</label>
            <input type="text" inputMode="email" value={email}
              onChange={e => setEmail(e.target.value.trim())}
              placeholder="votre@email.com" className={inputCls} autoComplete="email" disabled={loading} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">Mot de passe</label>
              <button type="button" onClick={() => { setView('forgot'); setError(null); }}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline">
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className={`${inputCls} pr-12`} autoComplete="current-password" disabled={loading} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion en cours…</> : 'Se connecter'}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
          <p className="text-center text-xs text-gray-500 mb-3">Nouveau à l'école ?</p>
          <a href="/inscription" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/inscription'); window.location.reload(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-50 active:bg-amber-100 transition">
            <Baby className="w-4 h-4" /> Déposer un dossier d'inscription
          </a>
          <a href="/suivi-inscription" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/suivi-inscription'); window.location.reload(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition">
            <Search className="w-4 h-4" /> Suivre mon dossier d'inscription
          </a>
        </div>

        <div className="mt-4 text-center">
          <a href="/login" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/'); window.location.reload(); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition">
            <School className="w-3.5 h-3.5" /> Accès Espace École (personnel)
          </a>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl shadow-amber-100/50 border border-amber-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 sm:px-8 py-8 sm:py-10 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
              {ecoleBranding?.logoUrl ? (
                <div className="w-24 h-24 rounded-2xl bg-white shadow-xl overflow-hidden flex items-center justify-center">
                  <img src={ecoleBranding.logoUrl} alt={ecoleBranding.name || 'Logo école'}
                    className="w-full h-full object-contain p-1.5" />
                </div>
              ) : (
                <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                  <Baby className="w-12 h-12 text-white" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">
              {ecoleBranding?.name || 'Espace Parents'}
            </h1>
            <p className="text-amber-100 text-sm mt-1">Portail de suivi de vos enfants</p>
          </div>

          <div className="px-4 sm:px-8 py-6 sm:py-8">
            {renderContent()}
          </div>
        </div>

        {view === 'login' && (
          <p className="text-center text-xs text-gray-400 mt-6">
            En cas de problème de connexion, contactez l'administration de l'école.
          </p>
        )}
      </div>
    </div>
  );
};

export default ParentLogin;
