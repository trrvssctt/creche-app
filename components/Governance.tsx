
import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Key, Plus, X, Search,
  ShieldCheck, UserPlus, Check, ArrowRight,
  RefreshCw, Trash2, Edit3, AlertCircle, Lock,
  Copy, Dices, Eye, EyeOff, GraduationCap, Building2,
  FileText, Briefcase, BookOpen, Baby, Stethoscope,
  Bus, Calculator, Package, TrendingUp, Crown
} from 'lucide-react';
import { User, UserRole } from '../types';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';

const AVAILABLE_ROLES = [
  { id: 'ADMIN',         label: 'Administrateur',         desc: 'Accès total à l\'instance.',                                                          groupe: 'Système',        access: 'total' as const },
  { id: 'ACCOUNTANT',    label: 'Comptable',              desc: 'Gestion financière et facturation.',                                                   groupe: 'Système',        access: 'rw' as const },
  { id: 'STOCK_MANAGER', label: 'Gestionnaire Stock',     desc: 'Contrôle logistique et inventaire.',                                                   groupe: 'Système',        access: 'rw' as const },
  { id: 'SALES',         label: 'Commercial',             desc: 'Gestion des ventes et des clients.',                                                   groupe: 'Système',        access: 'rw' as const },
  { id: 'DIRECTEUR',     label: 'Directeur / Directrice', desc: 'Direction pédagogique et administrative — accès complet.',                              groupe: 'Établissement',  access: 'total' as const },
  { id: 'ASSISTANTE',    label: 'Assistante',             desc: 'Scolarité, facturation, finance, RH, stock, communications, pédagogie.',                groupe: 'Établissement',  access: 'rw' as const },
  { id: 'ENSEIGNANT',    label: 'Enseignant(e)',           desc: 'Pédagogie — notes, bulletins, présences, matières.',                                   groupe: 'Établissement',  access: 'rw' as const },
  { id: 'MAITRESSE',     label: 'Maîtresse',              desc: 'Communications et pédagogie — consultation.',                                          groupe: 'Établissement',  access: 'r' as const },
  { id: 'INFIRMIERE',    label: 'Infirmière / Santé',     desc: 'Dossiers sanitaires des élèves.',                                                      groupe: 'Établissement',  access: 'rw' as const },
  { id: 'CHAUFFEUR',     label: 'Chauffeur',              desc: 'Module transport scolaire.',                                                            groupe: 'Établissement',  access: 'r' as const },
];

const ROLE_GROUPES = ['Système', 'Établissement'];

const ROLE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  ADMIN: ShieldCheck, ACCOUNTANT: Calculator, STOCK_MANAGER: Package, SALES: TrendingUp,
  DIRECTEUR: Crown, ASSISTANTE: Briefcase, ENSEIGNANT: BookOpen,
  MAITRESSE: Baby, INFIRMIERE: Stethoscope, CHAUFFEUR: Bus,
};

const getRoleLabel = (roleId: string) =>
  AVAILABLE_ROLES.find(r => r.id === roleId)?.label ?? roleId;

interface GovernanceProps {
  tenantId: string;
  plan?: any;
}

interface AvailableEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
}

const Governance: React.FC<GovernanceProps> = ({ tenantId, plan }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetUserToToggle, setTargetUserToToggle] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  
  const [userData, setUserData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    roles: [] as string[],
    employeeId: '' // Nouvelle propriété pour lier à un employé
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/auth/users');
      setUsers(data);
    } catch { setError("Erreur sync Kernel"); }
    finally { setLoading(false); }
  };

  const fetchAvailableEmployees = async () => {
    try {
      // L'endpoint ne retourne que les employés avec un contrat actif
      const employees = await apiClient.get('/auth/available-employees');
      setAvailableEmployees(employees);
    } catch (err) {
      console.error('Erreur lors du chargement des employés:', err);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

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
    
    setUserData({...userData, password});
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
      await navigator.clipboard.writeText(userData.password);
      // Optionnel: ajouter une notification de succès
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const planId = String(plan?.id || plan?.name || plan?.plan || '').toUpperCase() || 'BASIC';
  const isUserCreationAllowed = authBridge.isCreationAllowed({ planId } as any, 'users', users.length);
  const isUserLimitReached = !isUserCreationAllowed;

  const toggleRole = (roleId: string) => {
    setUserData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId) 
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  const handleOpenEdit = (user: User) => {
    const roles = (user as any).roles || [user.role];
    const isActive = (user as any).isActive ?? (user as any).is_active ?? true;
    if (roles.includes('ADMIN')) {
      setError('Modification interdite pour les administrateurs.');
      return;
    }
    if (!isActive) {
      setError('Impossible de modifier un utilisateur inactif.');
      return;
    }

    setEditingUser(user);
    setUserData({
      name: user.name,
      email: user.email,
      password: '', // On ne pré-remplit pas le password pour la sécurité
      roles: roles,
      employeeId: (user as any).employeeId || ''
    });
    setShowUserModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData.roles.length === 0) {
      setError("Veuillez sélectionner au moins un rôle.");
      return;
    }

    setActionLoading(true);
    try {
      if (!editingUser && isUserLimitReached) {
        setError(planId === 'PRO' ? 'Limite du plan PRO atteinte : maximum 10 utilisateurs.' : 'Limite du plan Basic atteinte : maximum 3 utilisateurs.');
        setActionLoading(false);
        return;
      }

      const payload = { ...userData };
      if (!payload.employeeId) delete (payload as any).employeeId;

      if (editingUser) {
        // Mise à jour : le password est optionnel
        if (!payload.password) delete (payload as any).password;
        await apiClient.put(`/auth/users/${editingUser.id}`, payload);
      } else {
        await apiClient.post('/auth/users', payload);
      }
      await fetchUsers();
      closeModal();
    } catch (err: any) { 
      setError(err.message || "Échec de l'opération.");
    } finally { 
      setActionLoading(false); 
    }
  };

  const closeModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserData({ name: '', email: '', password: '', roles: [], employeeId: '' });
    setAvailableEmployees([]);
    setError(null);
    setPasswordStrength({ score: 0, label: '', color: '' });
    setShowPassword(false);
  };

  // Open confirmation modal before toggling active status
  const toggleActive = (user: User) => {
    const roles = (user as any).roles || [user.role];
    if (roles.includes('ADMIN')) {
      setError("Impossible de désactiver un administrateur.");
      return;
    }
    setTargetUserToToggle(user);
    setShowConfirmModal(true);
  };

  const confirmToggle = async () => {
    if (!targetUserToToggle) return;
    setActionLoading(true);
    try {
      const u = targetUserToToggle as any;
      const current = u.isActive ?? u.is_active ?? true;
      const newStatus = !current;
      await apiClient.put(`/auth/users/${u.id}`, { isActive: newStatus });
      await fetchUsers();
      setShowConfirmModal(false);
      setTargetUserToToggle(null);
    } catch (err: any) {
      setError(err?.message || "Échec de l'opération.");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelConfirm = () => {
    setShowConfirmModal(false);
    setTargetUserToToggle(null);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <Shield className="text-indigo-600" size={32} /> Gouvernance & IAM
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Gestion Multi-Rôles des Opérateurs</p>
        </div>
        {isUserLimitReached ? (
           <div className="flex items-center gap-3 px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
             <Lock size={16} /> {planId === 'PRO' ? 'Limite du plan PRO atteinte : maximum 10 utilisateurs.' : 'Limite du plan Basic atteinte : maximum 3 opérateurs.'}
           </div>
        ) : (
          <button
            onClick={() => {
              closeModal();
              setShowUserModal(true);
              fetchAvailableEmployees();
            }}
            className="bg-slate-900 text-white px-4 md:px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest"
          >
            <UserPlus size={18} /> NOUVEL OPÉRATEUR
          </button>
        )}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-x-auto flex flex-col">
        <div className="px-4 md:px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Registre des accès</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="bg-white border-none rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" 
            />
          </div>
        </div>
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-50/30 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
              <th className="px-4 md:px-10 py-4">Opérateur</th>
              <th className="px-4 md:px-10 py-4">Périmètre de Rôles</th>
              <th className="px-4 md:px-10 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.map(u => {
              const roles = (u as any).roles || [u.role];
              const isActive = (u as any).isActive ?? (u as any).is_active ?? true;
              const employeeProfile = (u as any).employeeProfile;
              
              return (
                <tr key={u.id} className={`hover:bg-slate-50/50 transition-all group ${!isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 md:px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs">{u.name.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{u.name}</p>
                          {!isActive && (
                            <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-600 text-[9px] font-black uppercase">INACTIF</span>
                          )}
                          {employeeProfile && (
                            <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase">
                              EMPLOYÉ RH
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                        {employeeProfile && (
                          <p className="text-[9px] text-slate-300 font-bold">
                            {employeeProfile.department} • {employeeProfile.position}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-10 py-6">
                    <div className="flex flex-wrap gap-2">
                      {roles.map((r: string) => {
                        const roleDef = AVAILABLE_ROLES.find(x => x.id === r);
                        const isAdmin = r === 'ADMIN';
                        const isEtab = roleDef?.groupe === 'Établissement';
                        return (
                          <span key={r} className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border ${
                            isAdmin  ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            isEtab   ? 'bg-violet-50 text-violet-600 border-violet-100' :
                                       'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {roleDef?.label ?? r}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 md:px-10 py-6 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      disabled={roles.includes('ADMIN') || !isActive}
                      title={roles.includes('ADMIN') ? 'Modification interdite pour les administrateurs' : !isActive ? 'Impossible de modifier un utilisateur inactif' : 'Modifier'}
                      className={`p-2 transition-colors ${(roles.includes('ADMIN') || !isActive) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-indigo-600'}`}
                    >
                      <Edit3 size={18}/>
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={actionLoading || roles.includes('ADMIN')}
                      title={roles.includes('ADMIN') ? "Impossible de désactiver un administrateur" : isActive ? 'Désactiver' : 'Réactiver'}
                      className={`p-2 transition-colors ${roles.includes('ADMIN') ? 'text-slate-200 cursor-not-allowed' : isActive ? 'text-rose-500 hover:text-rose-600' : 'text-emerald-600 hover:text-emerald-700'}`}
                    >
                      {isActive ? <Lock size={18}/> : <Check size={18}/>} 
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl mx-4 md:mx-auto rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 max-h-[92dvh] flex flex-col">
             <div className={`px-6 md:px-10 py-6 md:py-8 text-white flex justify-between items-center ${editingUser ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900'}`}>
                <div>
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    {editingUser ? <Edit3 size={22}/> : <UserPlus size={22}/>}
                    {editingUser ? 'Révision Opérateur' : 'Provisionnement Multi-Rôles'}
                  </h3>
                  <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mt-1">
                    {editingUser ? 'Modifier les accès et permissions' : 'Créer un opérateur avec ses périmètres d\'accès'}
                  </p>
                </div>
                <button onClick={closeModal} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={22}/></button>
             </div>

             <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                {error && (
                  <div className="mx-6 md:mx-10 mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
                    <AlertCircle size={16}/> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 min-h-0">
                   {/* ── Colonne gauche : Identité & Sécurité ── */}
                   <div className="lg:col-span-2 p-6 md:p-8 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          <Key size={15} className="text-slate-500"/>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Identité & Sécurité</p>
                          <p className="text-[8px] text-slate-400 font-bold">Informations de connexion</p>
                        </div>
                      </div>

                      {!editingUser && (
                        <div className="space-y-2">
                          <select
                            value={userData.employeeId}
                            onChange={e => {
                              const sel = availableEmployees.find(emp => emp.id === e.target.value);
                              if (sel) {
                                setUserData({
                                  ...userData,
                                  employeeId: e.target.value,
                                  name: `${sel.firstName} ${sel.lastName}`,
                                  email: sel.email
                                });
                              } else {
                                setUserData({ ...userData, employeeId: '', name: '', email: '' });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                          >
                            <option value="">-- Accès sans lien RH --</option>
                            {availableEmployees.length === 0 ? (
                              <option disabled>Aucun employé avec contrat actif</option>
                            ) : (
                              availableEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.firstName} {emp.lastName}
                                  {emp.position ? ` — ${emp.position}` : ''}
                                  {emp.department ? ` (${emp.department})` : ''}
                                </option>
                              ))
                            )}
                          </select>
                          <p className="text-[8px] text-slate-400 font-bold px-2 flex items-center gap-1">
                            <FileText size={10} className="shrink-0" />
                            Seuls les employés avec un contrat actif sont listés
                          </p>
                        </div>
                      )}

                      <input
                        type="text"
                        required
                        value={userData.name}
                        onChange={e => setUserData({...userData, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        placeholder="Nom Complet"
                        readOnly={!editingUser && !!userData.employeeId}
                      />
                      <input
                        type="email"
                        autoComplete="off"
                        required
                        value={userData.email}
                        onChange={e => setUserData({...userData, email: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        placeholder="Email Professionnel"
                        readOnly={!editingUser && !!userData.employeeId}
                      />

                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required={!editingUser}
                            value={userData.password}
                            onChange={e => {
                              setUserData({...userData, password: e.target.value});
                              if (e.target.value) {
                                evaluatePasswordStrength(e.target.value);
                              } else {
                                setPasswordStrength({ score: 0, label: '', color: '' });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 pr-28 py-3.5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            placeholder={editingUser ? "Laisser vide si inchangé" : "Clé d'Accès Initiale"}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button type="button" onClick={copyPasswordToClipboard} className="text-slate-400 hover:text-emerald-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100" title="Copier">
                              <Copy size={14} />
                            </button>
                            <button type="button" onClick={generateStrongPassword} className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100" title="Générer">
                              <Dices size={14} />
                            </button>
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
                              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>

                        {userData.password && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Force</span>
                              <span className={`text-[8px] font-black uppercase tracking-widest ${
                                passwordStrength.score >= 6 ? 'text-emerald-600' :
                                passwordStrength.score >= 5 ? 'text-green-600' :
                                passwordStrength.score >= 4 ? 'text-yellow-600' :
                                passwordStrength.score >= 2 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                                style={{ width: `${(passwordStrength.score / 7) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                   </div>

                   {/* ── Colonne droite : Sélection des Rôles ── */}
                   <div className="lg:col-span-3 p-6 md:p-8 space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Shield size={15} className="text-indigo-500"/>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Périmètre d'accès</p>
                            <p className="text-[8px] text-slate-400 font-bold">Sélectionnez un ou plusieurs rôles</p>
                          </div>
                        </div>
                        {userData.roles.length > 0 && (
                          <span className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black tabular-nums">
                            {userData.roles.length} rôle{userData.roles.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="space-y-5">
                        {ROLE_GROUPES.map(groupe => {
                          const groupRoles = AVAILABLE_ROLES.filter(r => r.groupe === groupe);
                          const selectedCount = groupRoles.filter(r => userData.roles.includes(r.id)).length;
                          return (
                            <div key={groupe}>
                              <div className="flex items-center justify-between mb-2.5">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  {groupe === 'Établissement' ? <GraduationCap size={11}/> : <Building2 size={11}/>}
                                  {groupe}
                                </p>
                                {selectedCount > 0 && (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center">
                                    {selectedCount}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {groupRoles.map(role => {
                                  const selected = userData.roles.includes(role.id);
                                  const RoleIcon = ROLE_ICONS[role.id] || Shield;
                                  return (
                                    <button
                                      key={role.id}
                                      type="button"
                                      onClick={() => toggleRole(role.id)}
                                      className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 flex items-start gap-3 group ${
                                        selected
                                          ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-white shadow-sm shadow-indigo-100/50'
                                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 hover:shadow-sm'
                                      }`}
                                    >
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                                        selected
                                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                          : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                      }`}>
                                        <RoleIcon size={14}/>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className={`text-[10px] font-black uppercase leading-tight ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                            {role.label}
                                          </p>
                                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black leading-none shrink-0 ${
                                            role.access === 'total' ? 'bg-indigo-100 text-indigo-600' :
                                            role.access === 'rw'    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                                      'bg-amber-50 text-amber-600 border border-amber-100'
                                          }`}>
                                            {role.access === 'total' ? 'TOTAL' : role.access === 'rw' ? 'R/W' : 'R'}
                                          </span>
                                        </div>
                                        <p className="text-[8px] text-slate-400 font-medium leading-snug mt-0.5">{role.desc}</p>
                                      </div>
                                      <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                                        selected
                                          ? 'bg-indigo-600 border-indigo-600 scale-110'
                                          : 'border-slate-200 group-hover:border-slate-300'
                                      }`}>
                                        {selected && <Check size={10} className="text-white"/>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </div>

                <div className="px-6 md:px-10 py-5 border-t border-slate-100 bg-slate-50/30">
                  <button type="submit" disabled={actionLoading} className={`w-full py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${editingUser ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-slate-900'}`}>
                    {actionLoading ? <RefreshCw className="animate-spin" /> : <>{editingUser ? 'METTRE À JOUR' : 'ACTIVER L\'OPÉRATEUR'} <ArrowRight size={18}/></>}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showConfirmModal && targetUserToToggle && (
        <div className="fixed inset-0 z-[710] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg mx-4 md:mx-auto rounded-2xl shadow-xl p-6">
            <h4 className="text-lg font-black mb-4">Confirmer l'opération</h4>
            <p className="text-sm text-slate-600 mb-6">Êtes-vous sûr de vouloir {((targetUserToToggle as any).is_active ?? (targetUserToToggle as any).isActive ?? true) ? 'désactiver' : 'réactiver'} l'utilisateur <strong className="uppercase">{targetUserToToggle.name}</strong> ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={cancelConfirm} className="px-4 py-2 rounded-xl border font-black text-[10px] uppercase">Annuler</button>
              <button onClick={confirmToggle} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-[10px] uppercase">{actionLoading ? '...' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Governance;
