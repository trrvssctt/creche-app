
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Package, FileText, ShieldAlert, LogOut, Truck,
  Users as UsersIcon, Settings as SettingsIcon, Activity,
  ShieldCheck, ShieldHalf, Loader2,
  Layers, GitMerge, Wallet, History, TrendingDown, Sparkles,
  AlertTriangle, Clock, Calendar, Menu, LifeBuoy, Bell, ClipboardList,
  BookOpen, GraduationCap, MessageSquare, Stamp, CalendarDays, Megaphone, School, Receipt,
  ChevronDown, Lock, Eye, RefreshCw, Archive
} from 'lucide-react';
import { User, UserRole } from '../types';
import { authBridge } from '../services/authBridge';
import { useAnnee } from '../contexts/AnneeContext';
import { useCurrentEmployeeAbsenceStatus, getLeaveTypeLabel, getDaysUntilReturn } from '../services/employeeStatusService';

interface LayoutProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  logoUrl?: string;
  companyName?: string;
}

// ── Sélecteur d'année scolaire (avec confirmation + lecture seule) ────────────

const AnneeSelector: React.FC = () => {
  const { annee, setAnnee, anneesDisponibles, isReadOnly, anneeActiveToday, anneesCloturees, isAnneeCloturee } = useAnnee();
  const [open, setOpen] = useState(false);
  const [pendingAnnee, setPendingAnnee] = useState<string | null>(null);

  const isPast = (a: string) => parseInt(a.slice(0, 4)) < parseInt(anneeActiveToday.slice(0, 4));
  const isCurrent = (a: string) => a === anneeActiveToday;

  const handleSelect = (a: string) => {
    if (a === annee) { setOpen(false); return; }
    setPendingAnnee(a);
    setOpen(false);
  };

  const confirmChange = () => {
    if (pendingAnnee) { setAnnee(pendingAnnee); setPendingAnnee(null); }
  };

  return (
    <>
      {/* Bouton déclencheur */}
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all
            ${isAnneeCloturee
              ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
              : isReadOnly
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
        >
          {isAnneeCloturee ? <Archive size={12} /> : isReadOnly ? <Lock size={12} /> : <Calendar size={13} />}
          {annee}
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">
                Changer l'année scolaire
              </p>
              {[...anneesDisponibles].reverse().map(a => {
                const cloturee = anneesCloturees.includes(a);
                return (
                  <button
                    key={a}
                    onClick={() => handleSelect(a)}
                    className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between gap-2
                      ${a === annee
                        ? 'bg-indigo-600 text-white'
                        : cloturee
                          ? 'text-rose-700 hover:bg-rose-50'
                          : isPast(a)
                            ? 'text-amber-700 hover:bg-amber-50'
                            : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
                  >
                    <span>{a}</span>
                    {a === annee
                      ? cloturee
                        ? <span className="flex items-center gap-1 text-[8px]"><Archive size={9}/> Clôturée</span>
                        : <span className="text-[8px] opacity-80">Actif</span>
                      : cloturee
                        ? <span className="flex items-center gap-1 text-[8px]"><Archive size={9}/> Clôturée</span>
                        : isPast(a)
                          ? <Lock size={10} />
                          : isCurrent(a)
                            ? <span className="text-[8px] text-emerald-600">En cours</span>
                            : null}
                  </button>
                );
              })}
              <p className="px-4 py-2 text-[8px] text-slate-400 font-bold border-t border-slate-100">
                Les années passées sont en lecture seule.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Modale de confirmation — rendue dans document.body via portal */}
      {pendingAnnee && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center mx-auto border
              ${isPast(pendingAnnee)
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
              {isPast(pendingAnnee) ? <Lock size={24} /> : <RefreshCw size={24} />}
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Changer d'année scolaire
              </h3>
              <p className="text-sm text-slate-500 font-bold mt-1">
                {annee} → <span className="text-indigo-700">{pendingAnnee}</span>
              </p>
            </div>

            {pendingAnnee && anneesCloturees.includes(pendingAnnee) && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3">
                <Archive size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-700 font-bold">
                  <strong>{pendingAnnee}</strong> est une année officiellement <strong>clôturée</strong>.
                  Consultation autorisée en lecture seule uniquement.
                </p>
              </div>
            )}
            {pendingAnnee && !anneesCloturees.includes(pendingAnnee) && isPast(pendingAnnee) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 font-bold">
                  <strong>{pendingAnnee}</strong> est une année passée.
                  Vous pourrez consulter toutes les données, mais <strong>aucune modification ne sera autorisée</strong>.
                </p>
              </div>
            )}

            {!isPast(pendingAnnee) && (
              <p className="text-[11px] text-slate-500 font-bold text-center">
                Toutes les données de l'application seront rechargées pour l'année <strong>{pendingAnnee}</strong>.
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPendingAnnee(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button onClick={confirmChange}
                className={`flex-1 py-3 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2
                  ${isPast(pendingAnnee)
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {isPast(pendingAnnee) ? <Eye size={13} /> : <RefreshCw size={13} />}
                {isPast(pendingAnnee) ? 'Voir en lecture seule' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ── Layout principal ───────────────────────────────────────────────────────────

const Layout: React.FC<LayoutProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  children,
  logoUrl,
  companyName
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [asideTextColor, setAsideTextColor] = useState<string>('#ffffff');
  const [primaryTextOnPrimary, setPrimaryTextOnPrimary] = useState<string>('#ffffff');
  const [primaryHex, setPrimaryHex] = useState<string>('#4f46e5');
  const [buttonHex, setButtonHex] = useState<string>('#4f46e5');
  const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null);
  const [rhOpen, setRhOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pointageStatus, setPointageStatus] = useState<{
    clockIn: boolean;
    clockOut: boolean;
    overtimeMinutes: number;
    lateMinutes: number;
  } | null>(null);

  // Année scolaire active et état lecture seule
  const {
    isReadOnly: isReadOnlyMode,
    annee: anneeActive,
    isAnneeCloturee: isAnneeClotureeMode,
    setAnnee: setAnneeCtx,
    anneeActiveToday,
  } = useAnnee();

  // Hook pour vérifier le statut d'absence de l'employé connecté
  const { absenceStatus, loading: absenceLoading } = useCurrentEmployeeAbsenceStatus();

  const allMenuItems = [
    { id: 'dashboard',         label: 'Tableau de Bord',      icon: LayoutDashboard },
    { id: 'eleves',            label: 'Élèves',               icon: UsersIcon },
    { id: 'classes',           label: 'Classes',              icon: School },
    { id: 'admission',         label: 'Admissions',           icon: ClipboardList },
    { id: 'presences',         label: 'Présences / Absences', icon: ClipboardList },
    { id: 'bulletins',         label: 'Bulletins',            icon: BookOpen },
    { id: 'whatsapp',          label: 'WhatsApp',             icon: MessageSquare },
    { id: 'certificats',       label: 'Certificats',          icon: Stamp },
    { id: 'emploidutemps',     label: 'Emploi du Temps',      icon: CalendarDays },
    { id: 'evenements',        label: 'Événements',           icon: Megaphone },
    { id: 'facturation',        label: 'Factures Scolarité',   icon: Receipt },
    { id: 'sales',             label: 'Facturation',          icon: FileText },
    { id: 'payments',          label: 'Trésorerie',           icon: Wallet },
    { id: 'recovery',          label: 'Recouvrement',         icon: TrendingDown },
    { id: 'rh',                label: 'Ressources Humaines',  icon: UsersIcon },
    { id: 'employee-pointage', label: 'Mon Pointage',         icon: Clock },
    { id: 'my-leaves',         label: 'Mes Congés',           icon: Activity },
    { id: 'categories',        label: 'Catégories',           icon: Layers },
    { id: 'subcategories',     label: 'Sous-Catégories',      icon: GitMerge },
    { id: 'inventory',         label: 'Stock Fournitures',    icon: Package },
    { id: 'services',          label: 'Offres de Scolarité',  icon: Sparkles },
    { id: 'movements',         label: 'Mouvements Stock',     icon: History },
    { id: 'inventorycampaigns',label: 'Inventaire',           icon: Package },
    { id: 'suppliers',         label: 'Fournisseurs',         icon: Truck },
    { id: 'deliveries',        label: 'Livraisons',           icon: Package },
    { id: 'info',              label: 'Notifications',        icon: Bell },
    { id: 'support',           label: 'Support',              icon: LifeBuoy },
    { id: 'governance',        label: 'Gouvernance',          icon: ShieldHalf },
    { id: 'security',          label: 'Sécurité',             icon: ShieldAlert },
    { id: 'audit',             label: "Journal d'Audit",      icon: Activity },
    { id: 'settings',          label: 'Paramètres',           icon: SettingsIcon },
  ];

  const rhSubItems = [
    { id: 'rh.employees', label: 'Employés' },
    { id: 'rh.contracts', label: 'Contrats' },
    { id: 'rh.org', label: 'Organigramme' },
    { id: 'rh.docs', label: 'Documents' },
    { id: 'rh.leaves', label: 'Congés' },
    { id: 'rh.recruitment', label: 'Recrutement' },
    { id: 'rh.training', label: 'Formation' },
    { id: 'rh.performance', label: 'Performance' },
    { id: 'rh.payroll.settings', label: 'Paramétrage Paie' },
    { id: 'rh.payroll.generation', label: 'Génération Paie' },
    { id: 'rh.payroll.slips', label: 'Fiches de Paie' },
    { id: 'rh.payroll.bonuses', label: 'Primes' },
    { id: 'rh.payroll.advances', label: 'Avances' },
    { id: 'rh.payroll.declarations', label: 'Déclarations' }
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onLogout();
  };


  // Helpers: normalize hex and compute relative luminance for contrast decisions
  const normalizeHex = (raw?: string) => {
    if (!raw) return '';
    let s = raw.trim();
    if (!s) return '';
    if (!s.startsWith('#')) s = '#' + s;
    if (s.length === 4) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return s.substring(0, 7).toLowerCase();
  };

  const hexToRgb = (hex: string) => {
    const h = normalizeHex(hex);
    if (!h) return null;
    const r = parseInt(h.substr(1, 2), 16);
    const g = parseInt(h.substr(3, 2), 16);
    const b = parseInt(h.substr(5, 2), 16);
    return { r, g, b };
  };

  const hexToRgba = (hex: string, alpha = 1) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(0,0,0,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };

  const relativeLuminance = (r: number, g: number, b: number) => {
    const srgb = [r, g, b].map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };

  useEffect(() => {
    const recomputeColors = () => {
      try {
        const style = getComputedStyle(document.documentElement);
        const primaryRaw = style.getPropertyValue('--primary-kernel') || '#4f46e5';
        const buttonRaw = style.getPropertyValue('--button-kernel') || primaryRaw;
        const pHex = normalizeHex(primaryRaw) || '#4f46e5';
        const bHex = normalizeHex(buttonRaw) || pHex;
        setPrimaryHex(pHex);
        setButtonHex(bHex);
        const pRgb = hexToRgb(pHex);
        const bRgb = hexToRgb(bHex);
        const pLum = pRgb ? relativeLuminance(pRgb.r, pRgb.g, pRgb.b) : 0;
        const bLum = bRgb ? relativeLuminance(bRgb.r, bRgb.g, bRgb.b) : 0;
        const primaryIsLight = pLum > 0.5;
        const buttonIsLight = bLum > 0.5;
        setAsideTextColor(buttonIsLight ? '#0f172a' : '#ffffff');
        setPrimaryTextOnPrimary(primaryIsLight ? '#0f172a' : '#ffffff');
      } catch (e) {
        // ignore
      }
    };

    // initial compute
    recomputeColors();

    // listen for explicit theme updates dispatched by Settings
    const handler = () => recomputeColors();
    window.addEventListener('tenant-theme-updated', handler as EventListener);

    return () => {
      window.removeEventListener('tenant-theme-updated', handler as EventListener);
    };
  }, []);

  // Fetch unread notifications count (system announcements + tenant notifications)
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { apiClient } = await import('../services/api');
        const [announcements, countData] = await Promise.all([
          apiClient.get('/announcements').catch(() => null),
          apiClient.get('/hr/notifications/unread-count').catch(() => null),
        ]);
        const readIds: string[] = JSON.parse(localStorage.getItem('gsp_read_announcements') || '[]');
        const systemUnread = Array.isArray(announcements)
          ? announcements.filter((a: any) => !readIds.includes(a.id)).length
          : 0;
        const tenantUnread = (countData as any)?.count ?? 0;
        setUnreadNotifications(systemUnread + tenantUnread);
      } catch { /* silent */ }
    };
    fetchCount();
    // Re-run when Info.tsx marks system announcements as read
    const onStorage = () => { fetchCount(); };
    window.addEventListener('storage', onStorage);
    // Re-run periodically to pick up new tenant notifications (every 60s)
    const interval = setInterval(fetchCount, 60000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  const roles = Array.isArray(user.roles) ? user.roles : [user.role];
  const isAdminOrSuper = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN);
  const isDirecteurRole = roles.includes(UserRole.DIRECTEUR);
  const isEmployee = roles.some((r: UserRole) => r === UserRole.EMPLOYEE);

  // Les rôles non-admin/directeur sont toujours sur l'année scolaire active (source = backend)
  useEffect(() => {
    if (!isAdminOrSuper && !isDirecteurRole) {
      setAnneeCtx(anneeActiveToday);
    }
  }, [user.id, anneeActiveToday, isAdminOrSuper, isDirecteurRole]);

  // Fetch du statut de pointage pour les employés (toutes les 2 minutes)
  useEffect(() => {
    if (!isEmployee) return;
    const fetchPointage = async () => {
      try {
        const { apiClient } = await import('../services/api');
        const res = await apiClient.get('/hr/attendance/my/today');
        const att = res?.attendance;
        setPointageStatus({
          clockIn:         !!att?.clockIn,
          clockOut:        !!att?.clockOut,
          overtimeMinutes: att?.overtimeMinutes || 0,
          lateMinutes:     att?.meta?.lateMinutes || 0,
        });
      } catch { /* silencieux si pas encore d'employé lié */ }
    };
    fetchPointage();
    const id = setInterval(fetchPointage, 120_000);
    return () => clearInterval(id);
  }, [isEmployee]);

  // Même logique que App.tsx : 'PENDING' = nouveau compte → pas bloqué.
  // Seuls les états explicitement "expiré" déclenchent la restriction.
  const tenantStatus   = (user as any)?.tenant?.paymentStatus;
  const subStatus      = (user as any)?.subscription?.status;
  const subNextBilling = (user as any)?.subscription?.nextBillingDate;

  const isTenantLate = !!(
    tenantStatus === 'REJECTED' ||
    subStatus === 'EXPIRED' ||
    (subStatus === 'ACTIVE' && subNextBilling && new Date(subNextBilling) < new Date())
  );

  // Enrichit le user avec planId résolu depuis toutes les sources disponibles
  const enrichedUser = useMemo(() => {
    const u = user as any;
    if (u.planId) return user;
    const resolvedPlanId =
      u?.subscription?.planId ||
      u?.plan?.id ||
      u?.tenant?.plan ||
      u?.tenant?.planId;
    if (resolvedPlanId) return { ...user, planId: String(resolvedPlanId).toUpperCase() };
    return user;
  }, [user]);

  const hoverBgColor = useMemo(() => hexToRgba(buttonHex || primaryHex, 0.12), [buttonHex, primaryHex]);

  return (
    <div className={`flex h-screen bg-slate-50 overflow-hidden transition-colors duration-500`}>
      {/* Mobile backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <aside
        id="tour-sidebar"
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ease-in-out fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ backgroundColor: 'var(--button-kernel)', color: asideTextColor }}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} transition-all duration-300`}>
          {logoUrl ? (
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <img 
                src={logoUrl} 
                className={`${sidebarCollapsed ? 'h-8 w-8' : 'h-10 w-10'} object-contain rounded-xl bg-white p-1 flex-shrink-0 transition-all duration-300`} 
                alt="Logo" 
                title={sidebarCollapsed ? companyName : undefined}
              />
              {!sidebarCollapsed && <span className="text-sm font-black tracking-tighter truncate max-w-[140px] uppercase">{companyName}</span>}
            </div>
          ) : (
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}>
              <div 
                className={`${sidebarCollapsed ? 'text-lg' : 'text-xl'} font-bold tracking-tight  flex-shrink-0 transition-all duration-300`} 
                style={{ color: asideTextColor }}
                title={sidebarCollapsed ? 'GESTOCKPRO' : undefined}
              >
                G{!sidebarCollapsed && 'ESTOCK'}
              </div>
              {!sidebarCollapsed && (
                <span style={{ backgroundColor: 'var(--primary-kernel)', color: primaryTextOnPrimary, padding: '0 6px', marginLeft: 6, borderRadius: 6, fontSize: '1.25rem', fontWeight: 'bold' }}>PRO</span>
              )}
            </div>
          )}
        </div>

        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} py-2 space-y-1 overflow-y-auto custom-scrollbar transition-all duration-300`}>
          {allMenuItems.filter(item => {
            // Accès de base via authBridge
            const hasBaseAccess = authBridge.canAccess(enrichedUser, item.id);

            // Quand l'abonnement est expiré, seul l'admin peut voir dashboard + subscription
            if (isTenantLate && isAdminOrSuper && !['dashboard', 'subscription'].includes(item.id)) {
              return false;
            }

            // RH : accessible aux admins ET au HR_MANAGER
            if (item.id === 'rh') {
              const isHrManager = roles.includes(UserRole.HR_MANAGER);
              return hasBaseAccess && (isAdminOrSuper || isHrManager);
            }

            // Mon Pointage : accessible à tous les employés non-admin
            if (item.id === 'employee-pointage') {
              return roles.some((r: UserRole) =>
                [UserRole.EMPLOYEE, UserRole.STOCK_MANAGER, UserRole.SALES, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
                 UserRole.ENSEIGNANT, UserRole.MAITRESSE, UserRole.COMPTABLE, UserRole.ASSISTANTE,
                 UserRole.INFIRMIERE, UserRole.CHAUFFEUR].includes(r)
              ) && !isAdminOrSuper;
            }

            // Mes Congés : accessible à tous les employés non-admin
            if (item.id === 'my-leaves') {
              return roles.some((r: UserRole) =>
                [UserRole.EMPLOYEE, UserRole.STOCK_MANAGER, UserRole.SALES, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
                 UserRole.ENSEIGNANT, UserRole.MAITRESSE, UserRole.COMPTABLE, UserRole.ASSISTANTE,
                 UserRole.INFIRMIERE, UserRole.CHAUFFEUR].includes(r)
              ) && !isAdminOrSuper;
            }

            return hasBaseAccess;
          }).map((item) => {

            const isActive = activeTab === item.id;
            const isHovered = hoveredMenuId === item.id;
            const hoverBg = isHovered ? hoverBgColor : 'transparent';
            const bgStyle = isActive ? { backgroundColor: 'var(--primary-kernel)' } : { backgroundColor: hoverBg };
            const itemTextColor = isActive ? '#ffffff' : asideTextColor;

            // RH menu: bouton standard qui navigue directement vers HRDashboard

            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                onMouseEnter={() => setHoveredMenuId(item.id)}
                onMouseLeave={() => setHoveredMenuId(null)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'} rounded-xl transition-all duration-200 group relative`}
                style={{ ...bgStyle, color: itemTextColor }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="relative flex-shrink-0">
                  <item.icon
                    size={sidebarCollapsed ? 18 : 20}
                    style={{ color: isActive ? '#ffffff' : hexToRgba(itemTextColor, 0.9) }}
                    className="transition-all duration-200"
                  />
                  {item.id === 'info' && unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                  {/* Point de statut pointage sur l'icône Mon Pointage */}
                  {item.id === 'employee-pointage' && pointageStatus && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${
                      pointageStatus.clockOut ? 'bg-emerald-500'
                      : pointageStatus.clockIn ? 'bg-indigo-400 animate-pulse'
                      : 'bg-rose-500 animate-pulse'
                    }`} />
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className="font-bold text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300 flex-1" style={{ color: isActive ? '#ffffff' : itemTextColor }}>{item.label}</span>
                )}
                {!sidebarCollapsed && item.id === 'info' && unreadNotifications > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">{unreadNotifications}</span>
                )}
                {/* Badge statut pointage (sidebar étendue) */}
                {!sidebarCollapsed && item.id === 'employee-pointage' && pointageStatus && (
                  <span className={`ml-auto px-1.5 py-0.5 text-white text-[8px] font-black rounded-full ${
                    pointageStatus.clockOut ? 'bg-emerald-500'
                    : pointageStatus.clockIn ? 'bg-indigo-500'
                    : 'bg-rose-500'
                  }`}>
                    {pointageStatus.clockOut ? '✓' : pointageStatus.clockIn ? 'En cours' : 'Non pointé'}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={`${sidebarCollapsed ? 'p-2 m-2' : 'p-4 m-4'} bg-slate-800/50 rounded-2xl border border-slate-800/50 transition-all duration-300`}>
          {/* Indicateur d'absence dans le sidebar */}
          {!absenceLoading && absenceStatus && !absenceStatus.isPresent && (
            <div className={`${sidebarCollapsed ? 'mb-2' : 'mb-3'} ${sidebarCollapsed ? 'p-2' : 'p-3'} bg-red-500/20 border border-red-500/30 rounded-xl transition-all duration-300`}>
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}>
                <AlertTriangle 
                  size={sidebarCollapsed ? 16 : 14} 
                  className="text-red-400 animate-pulse" 
                  title={sidebarCollapsed ? "Vous êtes en absence approuvée" : undefined}
                />
                {!sidebarCollapsed && (
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">
                    EN ABSENCE
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={`flex flex-col ${sidebarCollapsed ? 'gap-2 mb-2' : 'gap-3 mb-3'} ${sidebarCollapsed ? 'items-center' : ''} transition-all duration-300`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-1' : 'gap-3'} transition-all duration-300`}>
              <div 
                className={`${sidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center font-black text-white shrink-0 uppercase shadow-lg transition-all duration-300 relative`} 
                style={{ backgroundColor: 'var(--primary-kernel)' }}
                title={sidebarCollapsed ? `${user.name} (${user.email})` : undefined}
              >
                {user.name.charAt(0)}
                {/* Badge d'absence sur l'avatar */}
                {!absenceLoading && absenceStatus && !absenceStatus.isPresent && (
                  <div className={`absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse`}></div>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black truncate">{user.name}</p>
                    {!absenceLoading && absenceStatus && !absenceStatus.isPresent && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="En absence"></div>
                    )}
                  </div>
                  <p className="text-[9px] font-bold uppercase truncate" style={{ color: 'var(--primary-kernel)' }}>{user.email}</p>
                  {!absenceLoading && absenceStatus && !absenceStatus.isPresent && absenceStatus.leave && (
                    <p className="text-[8px] font-bold uppercase text-red-400 truncate">
                      Jusqu'au {new Date(absenceStatus.leave.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)} 
            className={`w-full flex items-center justify-center ${sidebarCollapsed ? 'gap-0 py-2 px-1' : 'gap-2 py-2 px-2'} text-[10px] font-black text-slate-400 hover:text-white rounded-lg transition-all duration-300 border border-slate-700 uppercase tracking-widest`} 
            style={{ backgroundColor: 'transparent' }}
            title={sidebarCollapsed ? "Déconnexion" : undefined}
          >
            <LogOut size={sidebarCollapsed ? 14 : 12} className="transition-all duration-200" /> 
            {!sidebarCollapsed && (
              <span className="transition-all duration-300">DÉCONNEXION</span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            >
              <Menu size={22} />
            </button>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Instance / </span>
            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{activeTab}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Indicateur d'absence dans le header */}
            {!absenceLoading && absenceStatus && !absenceStatus.isPresent && absenceStatus.leave && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200 text-[10px] font-black uppercase tracking-widest animate-pulse">
                <AlertTriangle size={14} className="animate-bounce" />
                <span>EN ABSENCE - Retour le {new Date(absenceStatus.leave.endDate).toLocaleDateString('fr-FR')}</span>
              </div>
            )}

            {/* ── Bannière année clôturée / lecture seule ── */}
            {isAnneeClotureeMode && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-300 text-[10px] font-black uppercase tracking-widest">
                <Archive size={12} /> Année clôturée — {anneeActive}
              </div>
            )}
            {!isAnneeClotureeMode && isReadOnlyMode && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-300 text-[10px] font-black uppercase tracking-widest">
                <Lock size={12} /> Lecture seule — {anneeActive}
              </div>
            )}

            {/* ── Sélecteur d'année scolaire (admin / directeur uniquement) ── */}
            {(isAdminOrSuper || isDirecteurRole) && <AnneeSelector />}

            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={14} /> KERNEL ACTIVE
            </div>
          </div>
        </header>
        <div className="p-4 md:p-8">
          {isTenantLate && isAdminOrSuper && (
            <div className="mb-6 p-5 rounded-2xl border bg-amber-50 border-amber-200 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-amber-700">Accès restreint</h4>
                <p className="text-xs text-amber-700 font-bold mt-1">
                  Votre compte présente une anomalie. Contactez l'administrateur système.
                </p>
              </div>
            </div>
          )}
          
          {/* Alerte d'absence pour l'employé connecté */}
          {!absenceLoading && absenceStatus && !absenceStatus.isPresent && absenceStatus.leave && (
            <div className="mb-6 p-6 rounded-2xl border-2 bg-red-50 border-red-200 animate-pulse shadow-lg">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg">
                    <AlertTriangle size={24} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-tight text-red-700">VOUS ÊTES EN ABSENCE APPROUVÉE</h4>
                    <p className="text-sm text-red-600 font-bold">
                      {getLeaveTypeLabel(absenceStatus.leaveType || 'OTHER')} du {new Date(absenceStatus.leave.startDate).toLocaleDateString('fr-FR')} au {new Date(absenceStatus.leave.endDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full shrink-0">
                  <Clock size={16} className="text-red-600" />
                  <span className="text-xs font-black text-red-700 uppercase">
                    Retour dans {getDaysUntilReturn(absenceStatus.leave.endDate)} jour{getDaysUntilReturn(absenceStatus.leave.endDate) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              <div className="bg-red-100 p-4 rounded-xl border border-red-200 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldAlert size={20} className="text-red-600" />
                  <h5 className="text-sm font-black uppercase text-red-700">AVERTISSEMENT IMPORTANT</h5>
                </div>
                <div className="space-y-2 text-xs text-red-600 font-semibold">
                  <p>• ⚠️ Vous ne devriez pas effectuer de traitements dans l'application pendant votre absence</p>
                  <p>• ⚠️ Toute action effectuée sera tracée et pourra être auditée</p>
                  <p>• ⚠️ En cas d'urgence, contactez votre responsable hiérarchique</p>
                  <p>• ⚠️ L'accès reste ouvert uniquement pour la consultation en cas de besoin</p>
                </div>
              </div>
              
              {absenceStatus.leave.reason && (
                <div className="flex items-center gap-3 text-xs">
                  <Calendar size={14} className="text-red-500" />
                  <span className="text-red-600 font-medium">
                    <strong>Motif :</strong> {absenceStatus.leave.reason}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {children}
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Fermer la session ?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">L'isolation du tenant sera maintenue.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-3">
                {isLoggingOut ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
                {isLoggingOut ? 'RÉVOCATION...' : 'OUI, DÉCONNEXION'}
              </button>
              <button onClick={() => setShowLogoutConfirm(false)} className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
