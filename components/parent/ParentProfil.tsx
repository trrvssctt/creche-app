import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api';
import { User, Lock, Eye, EyeOff, Check, AlertTriangle, Loader2 } from 'lucide-react';

const ParentProfil: React.FC = () => {
  const [profil, setProfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Changement de mot de passe
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    apiClient.get('/parent/me').then(setProfil).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwResult(null);
    if (pwForm.newPassword.length < 6) {
      setPwResult({ ok: false, msg: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwResult({ ok: false, msg: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setPwLoading(true);
    try {
      await apiClient.put('/parent/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwResult({ ok: true, msg: 'Mot de passe modifié avec succès !' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwResult({ ok: false, msg: err?.message || 'Erreur lors du changement de mot de passe.' });
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Infos profil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Mon Profil</h2>
              <p className="text-amber-100 text-sm">{profil?.email || ''}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profil?.prenom && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Prénom</p>
                <p className="text-sm font-semibold text-gray-800">{profil.prenom}</p>
              </div>
            )}
            {profil?.nom && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nom</p>
                <p className="text-sm font-semibold text-gray-800">{profil.nom}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email</p>
              <p className="text-sm font-semibold text-gray-800">{profil?.email}</p>
            </div>
            {profil?.parent1?.telephone && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Téléphone</p>
                <p className="text-sm font-semibold text-gray-800">{profil.parent1.telephone}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changement mot de passe */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900">Changer mon mot de passe</h3>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          {pwResult && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              pwResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {pwResult.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {pwResult.msg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm"
                required
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm"
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-sm"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-2.5 px-8 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Modification…</> : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ParentProfil;
