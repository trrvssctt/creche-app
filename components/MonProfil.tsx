import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase, Building2,
  FileText, Lock, Save, Sparkles, CheckCircle2, AlertCircle,
  Loader2, Camera, Shield, Clock, BadgeCheck
} from 'lucide-react';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';

interface MonProfilProps {
  user: any;
}

const MonProfil: React.FC<MonProfilProps> = ({ user }) => {
  const [employee, setEmployee] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [emp, cts] = await Promise.all([
          apiClient.get('/hr/employees/me').catch(() => null),
          apiClient.get('/hr/employees/me/contracts').catch(() => []),
        ]);
        setEmployee(emp);
        setContracts(Array.isArray(cts) ? cts : []);
      } catch {
        setError('Impossible de charger votre profil.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const getPasswordStrength = (pwd: string) => {
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
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: any) {
      setPwError(err?.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setPwSaving(false);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const contractStatusLabel: Record<string, { label: string; style: string }> = {
    ACTIVE:     { label: 'Actif',      style: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    EXPIRED:    { label: 'Expiré',     style: 'bg-slate-100 text-slate-500 border-slate-200' },
    TERMINATED: { label: 'Résilié',    style: 'bg-red-100 text-red-700 border-red-200' },
    SUSPENDED:  { label: 'Suspendu',   style: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  const contractTypeLabel: Record<string, string> = {
    CDI: 'CDI — Contrat à Durée Indéterminée',
    CDD: 'CDD — Contrat à Durée Déterminée',
    STAGE: 'Stage',
    INTERIM: 'Intérim',
  };

  const session = authBridge.getSession();
  const roles = Array.isArray(session?.roles) ? session.roles : [session?.role];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">

      {/* En-tête profil */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500" />
        <div className="px-6 sm:px-8 pb-8 -mt-14">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="w-24 h-24 rounded-[1.5rem] bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {employee?.photoUrl ? (
                <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <User size={36} className="text-indigo-400" />
                </div>
              )}
            </div>
            <div className="flex-1 pt-2">
              <h1 className="text-xl font-black text-slate-900">
                {employee ? `${employee.firstName} ${employee.lastName}` : (user?.name || 'Mon Profil')}
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                {employee?.position || roles.join(', ')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {roles.map((r: string) => (
                  <span key={r} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && !employee && (
        <div className="flex items-center gap-3 p-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold">
          <AlertCircle size={18} className="flex-shrink-0" />
          <p>{error} Votre compte n'est peut-être pas encore lié à une fiche employé. Contactez votre administrateur.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Informations personnelles */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <User size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 uppercase">Informations personnelles</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Données de votre fiche RH</p>
            </div>
          </div>

          {employee ? (
            <div className="space-y-3">
              {[
                { icon: Mail,     label: 'Email',          value: employee.email },
                { icon: Phone,    label: 'Téléphone',      value: employee.phone },
                { icon: Calendar, label: 'Date de naissance', value: formatDate(employee.birthDate || employee.birth_date) },
                { icon: MapPin,   label: 'Adresse',        value: [employee.address, employee.city, employee.country].filter(Boolean).join(', ') || null },
                { icon: Briefcase,label: 'Poste',          value: employee.position },
                { icon: Building2,label: 'Département',    value: employee.departmentInfo?.name || employee.department?.name || employee.departmentName },
                { icon: Calendar, label: "Date d'embauche", value: formatDate(employee.hireDate || employee.hire_date) },
                { icon: BadgeCheck, label: 'Statut',       value: employee.status === 'ACTIVE' ? 'Actif' : employee.status },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <Icon size={15} className="text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-sm text-slate-700 font-medium truncate">{value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { icon: Mail,     label: 'Email',  value: user?.email || session?.email },
                { icon: User,     label: 'Nom',    value: user?.name || session?.name },
                { icon: Shield,   label: 'Rôle(s)', value: roles.join(', ') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <Icon size={15} className="text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-sm text-slate-700 font-medium truncate">{value || '—'}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mt-3 font-medium">
                Votre compte n'est pas encore lié à une fiche employé RH. Contactez l'administrateur pour compléter votre profil.
              </p>
            </div>
          )}
        </div>

        {/* Contrat(s) */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <FileText size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 uppercase">Contrat(s)</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Historique de vos contrats</p>
            </div>
          </div>

          {contracts.length > 0 ? (
            <div className="space-y-4">
              {contracts.map((c: any) => {
                const st = contractStatusLabel[c.status] || contractStatusLabel.ACTIVE;
                return (
                  <div key={c.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-800">
                        {contractTypeLabel[c.type || c.contractType] || c.type || c.contractType || 'Contrat'}
                      </p>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${st.style}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Début</p>
                        <p className="text-slate-700 font-medium">{formatDate(c.startDate || c.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fin</p>
                        <p className="text-slate-700 font-medium">{formatDate(c.endDate || c.end_date)}</p>
                      </div>
                      {(c.baseSalary || c.base_salary) && (
                        <div className="col-span-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Salaire de base</p>
                          <p className="text-slate-700 font-bold">{Number(c.baseSalary || c.base_salary).toLocaleString('fr-FR')} F CFA</p>
                        </div>
                      )}
                      {c.trialEndDate && (
                        <div className="col-span-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fin période d'essai</p>
                          <p className="text-slate-700 font-medium">{formatDate(c.trialEndDate || c.trial_end_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic py-8 text-center">
              {employee ? 'Aucun contrat enregistré' : 'Fiche employé non liée'}
            </p>
          )}
        </div>
      </div>

      {/* Sécurité — Changement de mot de passe */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-7 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center">
            <Shield size={18} className="text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 uppercase">Sécurité</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Modifier votre mot de passe</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Mot de passe actuel</label>
            <input
              type={pwShowCurrent ? 'text' : 'password'}
              value={pwCurrent}
              onChange={e => setPwCurrent(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
            <button type="button" onClick={() => setPwShowCurrent(v => !v)} className="absolute right-3 bottom-3 text-slate-400 hover:text-slate-700">
              <Lock size={14} />
            </button>
          </div>
          <div className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nouveau mot de passe</label>
            <input
              type={pwShowNew ? 'text' : 'password'}
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
            <button type="button" onClick={() => setPwShowNew(v => !v)} className="absolute right-3 bottom-3 text-slate-400 hover:text-slate-700">
              <Lock size={14} />
            </button>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Confirmer</label>
            <input
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>

        {pwNew && (() => {
          const s = getPasswordStrength(pwNew);
          return (
            <div className="space-y-1.5 max-w-xs">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${s.color}`} style={{ width: s.width }} />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
            </div>
          );
        })()}

        {pwError && <p className="text-xs text-red-500 font-bold flex items-center gap-2"><AlertCircle size={13} /> {pwError}</p>}
        {pwSuccess && <p className="text-xs text-green-600 font-bold flex items-center gap-2"><CheckCircle2 size={13} /> Mot de passe mis à jour avec succès.</p>}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={generateStrongPassword} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-2">
            <Sparkles size={13} /> Générer un mot de passe
          </button>
          <button type="button" onClick={handleChangePassword} disabled={pwSaving} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-60">
            {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Info compte */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-wrap items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Mail size={13} className="text-slate-400" />
          <span className="font-bold">{user?.email || session?.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400" />
          <span>Dernière connexion : {user?.lastLogin ? formatDate(user.lastLogin) : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default MonProfil;
