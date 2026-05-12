
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import Layout from './components/Layout';
import ToastProvider from './components/ToastProvider';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import InventoryCampaign from './components/InventoryCampaign';
import StockMovements from './components/StockMovements';
import CategoryManager from './components/CategoryManager';
import SubcategoryManager from './components/SubcategoryManager';
import Eleves from './components/Eleves';
import Classes from './components/Classes';
import Admission from './components/Admission';
import Bulletins from './components/Bulletins';
import WhatsApp from './components/WhatsApp';
import Certificats from './components/Certificats';
import EmploiDuTemps from './components/EmploiDuTemps';
import Evenements from './components/Evenements';
import Customers from './components/Customers';
import Suppliers from './components/Suppliers';
import Deliveries from './components/Deliveries';
import Sales from './components/Sales';
import Recovery from './components/Recovery';
import FacturationMensuelle from './components/FacturationMensuelle';
import Payments from './components/Payments';
import Services from './components/Services';
import SecurityPanel from './components/SecurityPanel';
import AuditLogs from './components/AuditLogs';
import Settings from './components/Settings';
import ChatInterface from './components/ChatInterface';
import Governance from './components/Governance';
import HRDashboard from './components/rh/HRDashboard';
import EmployeeList from './components/rh/EmployeeList';
import EmployeeProfile from './components/rh/EmployeeProfile';
import ContractList from './components/rh/ContractList';
import PayrollManagement from './components/rh/PayrollManagement';
import LeaveManagement from './components/rh/LeaveManagement';
import DocumentCenter from './components/rh/DocumentCenter';
import OrgChart from './components/rh/OrgChart';
import DepartmentManager from './components/rh/DepartmentManager';
import ModulePlaceholder from './components/rh/ModulePlaceholder';
import Attendance from './components/rh/Attendance';
import TimeDeductionSettings from './components/rh/TimeDeductionSettings';
import EmployeePointage from './components/rh/EmployeePointage';
import OvertimeRequests from './components/rh/OvertimeRequests';
import Login from './components/Login';
import AIAnalysis from './components/AIAnalysis';
import Support from './components/Support';
import Info from './components/Info';
import { MOCK_USERS } from './constants';
import { UserRole, AppSettings, User } from './types';
import { authBridge } from './services/authBridge';
import { apiClient } from './services/api';
import { ShieldAlert, RefreshCw, Lock, Loader2 } from 'lucide-react';

// ─── Error Boundary ──────────────────────────────────────────────────��────────

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[App Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-center">
          <div className="max-w-xl w-full bg-white rounded-[4rem] p-16 shadow-2xl">
            <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-lg border border-rose-100 animate-pulse">
              <ShieldAlert size={48} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-4">Erreur Critique</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em] leading-relaxed mb-10">
              Une erreur inattendue s'est produite. Veuillez recharger la page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <RefreshCw size={18} /> Recharger
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navigationMetadata, setNavigationMetadata] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pointageReminder, setPointageReminder] = useState(false);
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [customersRefreshKey, setCustomersRefreshKey] = useState(0);

  const [appSettings, setAppSettings] = useState<AppSettings>({
    language: 'Français',
    currency: 'F CFA',
    platformLogo: '',
    invoiceLogo: '',
    companyName: 'Le Toit des Anges',
  });

  // Synchronise les paramètres de l'établissement depuis le backend
  const syncSettings = async (_user: User) => {
    try {
      const settings = await apiClient.get('/settings');
      if (settings) {
        setAppSettings({
          language: settings.language === 'en' ? 'English' : 'Français',
          currency: settings.currency || 'F CFA',
          platformLogo: settings.logoUrl || '',
          invoiceLogo: settings.logoUrl || '',
          companyName: settings.name || 'Le Toit des Anges',
          ...settings,
        });
        try {
          if (settings.primaryColor) {
            document.documentElement.style.setProperty('--primary-kernel', settings.primaryColor);
          }
          if (settings.buttonColor || settings.button_color) {
            document.documentElement.style.setProperty('--button-kernel', settings.buttonColor || settings.button_color);
          }
          if (settings.fontFamily) {
            document.documentElement.style.setProperty('--kernel-font-family', settings.fontFamily);
            document.documentElement.style.fontFamily = settings.fontFamily;
          }
          if (settings.baseFontSize) {
            document.documentElement.style.setProperty('--base-font-size', `${settings.baseFontSize}px`);
            document.documentElement.style.fontSize = `${settings.baseFontSize}px`;
          }
          const isDark = settings.theme === 'dark' || settings.is_dark === true;
          document.documentElement.classList.toggle('dark', Boolean(isDark));
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } catch {
          // no-op
        }
      }
    } catch {
      // Paramètres backend non disponibles — on garde les défauts
    }
  };

  // Restauration de session au démarrage
  useEffect(() => {
    const init = async () => {
      const session = authBridge.getSession();
      if (session) {
        const freshUser = await authBridge.fetchMe(session.token);
        if (freshUser && freshUser.isActive) {
          await syncSettings(freshUser);
          setCurrentUser(freshUser);
          setIsLoggedIn(true);
        } else {
          authBridge.clearSession();
        }
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  // Rappel pointage employé
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    const role = currentUser.role || (currentUser as any).roles?.[0];
    if (role !== UserRole.EMPLOYEE) return;
    const check = async () => {
      try {
        const res = await apiClient.get('/hr/attendance/my/today');
        setPointageReminder(!!(res?.settings?.deductionEnabled && !res?.attendance?.clockIn));
      } catch { /* silencieux */ }
    };
    check();
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    const primaryColor = (appSettings as any).primaryColor || '#4f46e5';
    document.documentElement.style.setProperty('--primary-kernel', primaryColor);
  }, [appSettings]);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    await syncSettings(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    authBridge.clearSession();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
    setNavigationMetadata(null);
  };

  const handleContextualNavigate = (tab: string, meta?: any) => {
    if (currentUser && authBridge.canAccess(currentUser, tab)) {
      setNavigationMetadata(meta);
      setActiveTab(tab);
    }
  };

  // ── Écran de chargement initial ──────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-white text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
          Chargement...
        </p>
      </div>
    );
  }

  // ── Écran de connexion ───────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={() => {}}
      />
    );
  }

  // ── Rendu du contenu selon l'onglet actif ────────────────────────────────
  const renderContent = () => {
    if (!currentUser) return null;

    if (!authBridge.canAccess(currentUser, activeTab.startsWith('rh') ? 'rh' : activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mb-8 border border-rose-100 shadow-inner">
            <Lock size={48} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Accès Refusé</h2>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em] max-w-sm">
            Vous n'avez pas les droits pour accéder au module <span className="text-rose-500 font-black">{activeTab}</span>.
          </p>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="mt-10 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
          >
            Retour au tableau de bord
          </button>
        </div>
      );
    }

    // Sous-modules RH
    if (activeTab.startsWith('rh')) {
      switch (activeTab) {
        case 'rh':                   return <HRDashboard onNavigate={handleContextualNavigate} />;
        case 'rh.employees':         return <EmployeeList onNavigate={handleContextualNavigate} />;
        case 'rh.departments':       return <DepartmentManager onNavigate={handleContextualNavigate} />;
        case 'rh.employee.profile':  return <EmployeeProfile employeeId={navigationMetadata?.employeeId || ''} onNavigate={handleContextualNavigate} />;
        case 'rh.contracts':         return <ContractList onNavigate={handleContextualNavigate} />;
        case 'rh.org':               return <OrgChart onNavigate={handleContextualNavigate} />;
        case 'rh.docs':              return <DocumentCenter onNavigate={handleContextualNavigate} />;
        case 'rh.leaves':            return <LeaveManagement onNavigate={handleContextualNavigate} />;
        case 'rh.recruitment':       return <ModulePlaceholder onNavigate={handleContextualNavigate} moduleName="Recrutement" description="Gestion des offres d'emploi, candidatures et onboarding." />;
        case 'rh.training':          return <ModulePlaceholder onNavigate={handleContextualNavigate} moduleName="Formation" description="Planification des formations, suivi des compétences." />;
        case 'rh.performance':       return <ModulePlaceholder onNavigate={handleContextualNavigate} moduleName="Performance" description="Évaluations, objectifs et plans de développement." />;
        case 'rh.payroll':
        case 'rh.payroll.generation':return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="generation" />;
        case 'rh.payroll.settings':  return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="settings" />;
        case 'rh.payroll.slips':     return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="slips" />;
        case 'rh.payroll.bonuses':   return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="advances" />;
        case 'rh.payroll.advances':  return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="advances" />;
        case 'rh.payroll.declarations': return <PayrollManagement onNavigate={handleContextualNavigate} initialTab="declarations" />;
        case 'rh.attendance':        return <Attendance onNavigate={handleContextualNavigate} />;
        case 'rh.overtime':          return <OvertimeRequests onNavigate={handleContextualNavigate} />;
        case 'rh.time-settings':     return <TimeDeductionSettings onNavigate={handleContextualNavigate} />;
        default:                     return <HRDashboard onNavigate={handleContextualNavigate} />;
      }
    }

    switch (activeTab) {
      case 'dashboard':          return <Dashboard user={currentUser} currency={appSettings.currency} onNavigate={handleContextualNavigate} />;
      case 'ai_analysis':        return <AIAnalysis user={currentUser} />;
      case 'categories':         return <CategoryManager />;
      case 'subcategories':      return <SubcategoryManager />;
      case 'inventory':          return <Inventory currency={appSettings.currency} userRole={currentUser.role} refreshKey={inventoryRefreshKey} />;
      case 'audit_inventory':
      case 'inventorycampaigns': return <InventoryCampaign settings={appSettings} />;
      case 'movements':          return <StockMovements currency={appSettings.currency} tenantSettings={appSettings} />;
      case 'eleves':             return <Eleves user={currentUser} currency={appSettings.currency} refreshKey={customersRefreshKey} />;
      case 'classes':            return <Classes user={currentUser} currency={appSettings.currency} />;
      case 'admission':          return <Admission user={currentUser} currency={appSettings.currency} />;
      case 'bulletins':          return <Bulletins user={currentUser} />;
      case 'whatsapp':           return <WhatsApp user={currentUser} />;
      case 'certificats':        return <Certificats user={currentUser} />;
      case 'emploidutemps':      return <EmploiDuTemps user={currentUser} />;
      case 'evenements':         return <Evenements user={currentUser} />;
      case 'customers':          return <Customers user={currentUser} currency={appSettings.currency} refreshKey={customersRefreshKey} />;
      case 'suppliers':          return <Suppliers user={currentUser} currency={appSettings.currency} />;
      case 'deliveries':         return <Deliveries user={currentUser} currency={appSettings.currency} />;
      case 'sales':              return <Sales currency={appSettings.currency} user={currentUser} tenantSettings={appSettings} />;
      case 'services':           return <Services currency={appSettings.currency} />;
      case 'recovery':           return <Recovery currency={appSettings.currency} />;
      case 'facturation':        return <FacturationMensuelle currency={appSettings.currency} tenantSettings={appSettings} />;
      case 'payments':           return <Payments currency={appSettings.currency} tenantSettings={appSettings} />;
      case 'my-leaves':          return <LeaveManagement onNavigate={handleContextualNavigate} user={currentUser} />;
      case 'employee-pointage':  return <EmployeePointage onNavigate={handleContextualNavigate} />;
      case 'governance':         return <Governance tenantId={currentUser.tenantId} />;
      case 'info':               return <Info user={currentUser} />;
      case 'support':            return <Support user={currentUser} />;
      case 'security':           return <SecurityPanel />;
      case 'audit':              return <AuditLogs tenantSettings={appSettings} />;
      case 'settings':           return <Settings settings={appSettings} onSave={setAppSettings} onLogout={handleLogout} />;
      default:                   return <Dashboard user={currentUser} currency={appSettings.currency} onNavigate={handleContextualNavigate} />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="min-h-screen bg-slate-50">
          {/* Bannière rappel pointage */}
          {pointageReminder && activeTab !== 'employee-pointage' && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-4 px-6 py-4 bg-slate-900 text-white rounded-[2rem] shadow-2xl border border-indigo-500/30 max-w-sm w-full mx-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest">Pensez à pointer !</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Vous n'avez pas encore pointé aujourd'hui</p>
              </div>
              <button
                onClick={() => { setActiveTab('employee-pointage'); setPointageReminder(false); }}
                className="px-3 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all"
              >
                Pointer
              </button>
              <button
                onClick={() => setPointageReminder(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
          )}

          <Layout
            user={currentUser!}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setNavigationMetadata(null);
              setActiveTab(tab);
            }}
            onLogout={handleLogout}
            logoUrl={appSettings.platformLogo}
            companyName={appSettings.companyName}
          >
            {renderContent()}
          </Layout>

          <ChatInterface user={currentUser!} />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
