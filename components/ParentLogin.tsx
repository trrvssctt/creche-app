import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { Eye, EyeOff, Loader2, Baby, School, UserPlus, Search } from 'lucide-react';

interface ParentLoginProps {
  onLoginSuccess: (user: User) => void;
}

const ParentLogin: React.FC<ParentLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Branding mis en cache lors de la dernière connexion
  const [ecoleBranding] = useState<{ name?: string; logoUrl?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('ecole_branding');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez saisir votre email et mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post('/auth/login', { email, password });

      const user: User = data.user;
      const rolesArr = Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles : [user.role];
      const isParent = rolesArr.some((r: any) => r === 'PARENT' || r === 'TUTEUR');

      if (!isParent) {
        setError('Ce portail est réservé aux parents. Utilisez l\'espace école pour vous connecter.');
        setLoading(false);
        return;
      }

      authBridge.saveSession(user, data.token, data.sessionToken);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err?.message || 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      {/* Décorations de fond */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Carte principale */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl shadow-amber-100/50 border border-amber-100 overflow-hidden">
          {/* Header */}
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

          {/* Formulaire */}
          <div className="px-4 sm:px-8 py-6 sm:py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Adresse email
                </label>
                <input
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={e => setEmail(e.target.value.trim())}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion en cours…</>
                  : 'Se connecter'
                }
              </button>
            </form>

            {/* Boutons préinscription + suivi */}
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
              <p className="text-center text-xs text-gray-500 mb-3">Nouveau à l'école ?</p>
              <a
                href="/inscription"
                onClick={e => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/inscription');
                  window.location.reload();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-50 active:bg-amber-100 transition"
              >
                <Baby className="w-4 h-4" />
                Déposer un dossier d'inscription
              </a>
              <a
                href="/suivi-inscription"
                onClick={e => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/suivi-inscription');
                  window.location.reload();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition"
              >
                <Search className="w-4 h-4" />
                Suivre mon dossier d'inscription
              </a>
            </div>

            {/* Lien espace école */}
            <div className="mt-4 text-center">
              <a
                href="/login"
                onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/'); window.location.reload(); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition"
              >
                <School className="w-3.5 h-3.5" />
                Accès Espace École (personnel)
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Pour récupérer votre mot de passe, contactez l'administration de l'école.
        </p>
      </div>
    </div>
  );
};

export default ParentLogin;
