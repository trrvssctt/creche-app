import React, { useCallback, useEffect, useState } from 'react';
import { User } from '../types';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import MesEnfants       from './parent/MesEnfants';
import ParentFactures   from './parent/ParentFactures';
import ParentBulletins  from './parent/ParentBulletins';
import ParentPlanning   from './parent/ParentPlanning';
import ParentDocuments  from './parent/ParentDocuments';
import ParentActualites from './parent/ParentActualites';
import ParentAdmission  from './parent/ParentAdmission';
import ParentSignature  from './parent/ParentSignature';
import ParentProfil     from './parent/ParentProfil';
import {
  Baby, CreditCard, BookOpen, Calendar, Folder, Bell, UserPlus, PenTool,
  LogOut, Menu, X, AlertTriangle, Settings,
} from 'lucide-react';

interface Props { user: User; onLogout: () => void; }

type Section = 'enfants' | 'factures' | 'bulletins' | 'planning' | 'documents' | 'signature' | 'actualites' | 'admission' | 'profil';

const NAV: { id: Section; label: string; icon: React.FC<any>; color: string }[] = [
  { id: 'enfants',    label: 'Mes enfants',       icon: Baby,       color: 'text-rose-500' },
  { id: 'factures',   label: 'Factures',           icon: CreditCard, color: 'text-amber-500' },
  { id: 'bulletins',  label: 'Bulletins',          icon: BookOpen,   color: 'text-indigo-500' },
  { id: 'planning',   label: 'Emploi du temps',    icon: Calendar,   color: 'text-emerald-500' },
  { id: 'documents',  label: 'Documents',          icon: Folder,     color: 'text-blue-500' },
  { id: 'signature',  label: 'Signature',          icon: PenTool,    color: 'text-indigo-500' },
  { id: 'actualites', label: 'Actualités',         icon: Bell,       color: 'text-purple-500' },
  { id: 'admission',  label: 'Inscrire un enfant', icon: UserPlus,   color: 'text-orange-500' },
  { id: 'profil',     label: 'Mon profil',         icon: Settings,   color: 'text-slate-500' },
];

const ParentPortal: React.FC<Props> = ({ user, onLogout }) => {
  const [section, setSection]   = useState<Section>('enfants');
  const [sideOpen, setSideOpen] = useState(false);
  const [enfants,   setEnfants]   = useState<any[]>([]);
  const [echeances, setEcheances] = useState<any[]>([]);
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [creneaux,  setCreneaux]  = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [annonces,  setAnnonces]  = useState<any[]>([]);
  const [ecole,     setEcole]     = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [enf, ech, bul, cre, doc, ann, eco] = await Promise.allSettled([
        apiClient.get('/parent/enfants'),
        apiClient.get('/parent/echeances'),
        apiClient.get('/parent/bulletins'),
        apiClient.get('/parent/planning'),
        apiClient.get('/parent/dossiers'),
        apiClient.get('/parent/actualites'),
        apiClient.get('/parent/ecole'),
      ]);
      if (enf.status === 'fulfilled') setEnfants(enf.value?.enfants || enf.value || []);
      if (ech.status === 'fulfilled') setEcheances(ech.value?.echeances || ech.value || []);
      if (bul.status === 'fulfilled') setBulletins(bul.value?.bulletins || bul.value || []);
      if (cre.status === 'fulfilled') setCreneaux(cre.value?.creneaux || cre.value || []);
      if (doc.status === 'fulfilled') setDocuments(doc.value?.documents || doc.value || []);
      if (ann.status === 'fulfilled') setAnnonces(ann.value?.annonces || ann.value || []);
      if (eco.status === 'fulfilled') {
        const ecoleData = eco.value || null;
        setEcole(ecoleData);
        if (ecoleData) {
          try { localStorage.setItem('ecole_branding', JSON.stringify(ecoleData)); } catch {}
        }
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleLogout = () => { authBridge.clearSession(); onLogout(); };
  const confirmLogout = () => setShowLogoutConfirm(true);

  const impayeesCount = echeances.filter((e: any) => e.statut === 'EN_ATTENTE' || e.statut === 'EN_RETARD').length;
  const nomComplet = [user.prenom, user.nom].filter(Boolean).join(' ') || (user as any).name || user.email;
  const initiales = nomComplet.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const goTo = (id: Section) => { setSection(id); setSideOpen(false); };
  const currentNav = NAV.find(n => n.id === section);

  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <div className="w-14 h-14 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-lg text-gray-400 font-medium">Chargement de vos données…</p>
      </div>
    );
    switch (section) {
      case 'enfants':    return <MesEnfants enfants={enfants} />;
      case 'factures':   return <ParentFactures echeances={echeances} enfants={enfants} ecole={ecole} onRefresh={fetchAll} />;
      case 'bulletins':  return <ParentBulletins bulletins={bulletins} />;
      case 'planning':   return <ParentPlanning creneaux={creneaux} />;
      case 'documents':  return <ParentDocuments documents={documents} enfants={enfants} echeances={echeances} ecole={ecole} onRefresh={fetchAll} />;
      case 'signature':  return <ParentSignature onRefresh={fetchAll} />;
      case 'actualites': return <ParentActualites annonces={annonces} />;
      case 'admission':  return <ParentAdmission onSuccess={fetchAll} />;
      case 'profil':     return <ParentProfil />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-rose-50/40 flex">

      {/* Overlay mobile */}
      {sideOpen && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSideOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300
        ${sideOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:shadow-none lg:border-r lg:border-amber-100
      `}>

        {/* En-tête sidebar */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-6 pb-7">
          {/* Logo école */}
          <div className="flex justify-center mb-5">
            {ecole?.logoUrl ? (
              <div className="w-20 h-20 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center">
                <img src={ecole.logoUrl} alt={ecole.name || 'Logo école'}
                  className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <span className="text-3xl font-black text-white/80">🏫</span>
              </div>
            )}
          </div>
          {ecole?.name && (
            <p className="text-center text-xs font-black text-white/90 uppercase tracking-widest mb-4 truncate">{ecole.name}</p>
          )}

          {/* Profil parent */}
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur rounded-2xl px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-white">{initiales}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-amber-100 uppercase tracking-widest">Espace Parents</p>
              <p className="font-bold text-white text-sm leading-tight truncate">{nomComplet}</p>
            </div>
          </div>

          {impayeesCount > 0 && (
            <div className="mt-3 bg-red-500/80 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
              <p className="text-sm font-bold text-white">{impayeesCount} facture{impayeesCount > 1 ? 's' : ''} en attente</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          {NAV.map(({ id, label, icon: Icon, color }) => {
            const active = section === id;
            const badge  = id === 'factures' && impayeesCount > 0 ? impayeesCount : 0;
            return (
              <button key={id} onClick={() => goTo(id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-semibold text-base transition-all ${
                  active
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-200'
                    : 'text-gray-600 hover:bg-amber-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : color}`} />
                <span className="flex-1 text-left">{label}</span>
                {badge > 0 && (
                  <span className={`text-xs font-black rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${active ? 'bg-white text-orange-500' : 'bg-red-500 text-white'}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pied sidebar */}
        <div className="px-4 py-5 border-t border-gray-100">
          <button onClick={confirmLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition font-medium text-sm">
            <LogOut className="w-5 h-5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-amber-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => setSideOpen(true)} className="p-2 rounded-xl text-gray-500 hover:bg-amber-50">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            {ecole?.logoUrl ? (
              <img src={ecole.logoUrl} alt={ecole.name || 'Logo'}
                className="h-8 w-8 rounded-lg object-contain bg-white border border-amber-100 p-0.5" />
            ) : (
              currentNav && <currentNav.icon className={`w-5 h-5 ${currentNav.color}`} />
            )}
            <p className="font-bold text-gray-800 text-sm">{ecole?.name || currentNav?.label}</p>
          </div>
          <div className="w-10" />
        </header>

        {/* Contenu — pleine hauteur, scroll interne par section */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 lg:p-6">
          <div className={`flex-1 min-h-0 ${
            section === 'planning' ? 'flex flex-col' : 'overflow-y-auto'
          }`}>
            {renderContent()}
          </div>
        </main>
      </div>

      {/* ── Modal confirmation déconnexion ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <LogOut className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-black text-gray-900 text-lg">Se déconnecter ?</p>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                Vous allez quitter l'espace parents. Vous devrez vous reconnecter pour accéder à vos informations.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest transition shadow-lg shadow-red-100">
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentPortal;
