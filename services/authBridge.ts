import { User, UserRole } from '../types';

const AUTH_STORAGE_KEY = 'gsp_session_vault';
const SESSION_TOKEN_KEY = 'gsp_session_token';

// Résolution dynamique de l'URL backend — même logique que api.ts, sans import circulaire
const getBackendUrl = (): string => {
  const buildTime = (import.meta as any).env?.VITE_BACKEND_URL;
  if (buildTime) return buildTime.replace(/\/+$/, '');
  try {
    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    if (origin && /localhost:517[3-9]/.test(origin)) return 'http://localhost:3000';
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) return origin;
  } catch { /* noop */ }
  return 'http://localhost:3000';
};

// Tous les modules disponibles dans l'application
const ALL_MODULES = [
  'dashboard',
  'categories', 'subcategories',
  'inventory', 'movements', 'inventorycampaigns',
  'services',
  'eleves', 'classes', 'customers', 'admission', 'bulletins', 'whatsapp', 'certificats', 'emploidutemps', 'evenements',
  'suppliers', 'deliveries',
  'sales', 'recovery', 'payments',
  'rh',
  'rh.employees', 'rh.departments', 'rh.employee.profile',
  'rh.contracts', 'rh.org', 'rh.docs', 'rh.leaves',
  'rh.recruitment', 'rh.training', 'rh.performance',
  'rh.payroll', 'rh.payroll.settings', 'rh.payroll.generation',
  'rh.payroll.slips', 'rh.payroll.bonuses', 'rh.payroll.advances', 'rh.payroll.declarations',
  'rh.attendance', 'rh.overtime', 'rh.time-settings',
  'my-leaves', 'employee-pointage',
  'governance', 'security', 'audit',
  'info', 'support', 'settings',
  'ai_analysis',
];

// Accès par rôle — les rôles admin/directeur ont tout
const ROLE_MODULES: Record<string, string[]> = {
  [UserRole.ADMIN]: ALL_MODULES,
  [UserRole.DIRECTEUR]: ALL_MODULES,

  [UserRole.HR_MANAGER]: [
    'dashboard',
    'rh',
    'rh.employees', 'rh.departments', 'rh.employee.profile',
    'rh.contracts', 'rh.org', 'rh.docs', 'rh.leaves',
    'rh.recruitment', 'rh.training', 'rh.performance',
    'rh.payroll', 'rh.payroll.settings', 'rh.payroll.generation',
    'rh.payroll.slips', 'rh.payroll.bonuses', 'rh.payroll.advances', 'rh.payroll.declarations',
    'rh.attendance', 'rh.overtime', 'rh.time-settings',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.ENSEIGNANT]: [
    'dashboard',
    'bulletins', 'emploidutemps', 'evenements',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.MAITRESSE]: [
    'dashboard',
    'bulletins', 'emploidutemps', 'evenements',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.COMPTABLE]: [
    'dashboard',
    'eleves', 'classes', 'customers', 'admission',
    'whatsapp', 'certificats',
    'sales', 'recovery', 'payments',
    'rh',
    'rh.payroll.settings', 'rh.payroll.generation',
    'rh.payroll.slips', 'rh.payroll.bonuses', 'rh.payroll.advances', 'rh.payroll.declarations',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.ASSISTANTE]: [
    'dashboard',
    'eleves', 'classes', 'customers', 'admission',
    'whatsapp', 'certificats', 'emploidutemps', 'evenements',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.EMPLOYEE]: [
    'dashboard',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.INFIRMIERE]: [
    'dashboard',
    'eleves',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],

  [UserRole.CHAUFFEUR]: [
    'dashboard',
    'my-leaves', 'employee-pointage',
    'info', 'support',
  ],
};

export const authBridge = {
  saveSession: (user: User, token: string, sessionToken?: string) => {
    let roles: UserRole[] = [];
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      roles = user.roles;
    } else if (user.role) {
      roles = [user.role];
    } else {
      roles = [UserRole.ASSISTANTE];
    }

    const sessionUser = { ...user, roles };
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: sessionUser, token, sessionToken, timestamp: Date.now() })
    );

    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    }

    // Appliquer les préférences visuelles de l'établissement
    try {
      const tenant = (sessionUser as any).tenant || (sessionUser as any).tenantData || null;
      if (tenant) {
        if (tenant.primaryColor) {
          document.documentElement.style.setProperty('--primary-kernel', tenant.primaryColor);
        }
        if (tenant.buttonColor || tenant.button_color) {
          document.documentElement.style.setProperty('--button-kernel', tenant.buttonColor || tenant.button_color);
        }
        if (tenant.fontFamily) {
          document.documentElement.style.setProperty('--kernel-font-family', tenant.fontFamily);
          document.documentElement.style.fontFamily = tenant.fontFamily;
        }
        if (tenant.baseFontSize) {
          document.documentElement.style.setProperty('--base-font-size', `${tenant.baseFontSize}px`);
          document.documentElement.style.fontSize = `${tenant.baseFontSize}px`;
        }
        const themeVal = tenant.theme ?? tenant.is_dark ?? 'light';
        const isDark = themeVal === 'dark' || themeVal === true;
        document.documentElement.classList.toggle('dark', Boolean(isDark));
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    } catch (e) {
      // no-op
    }
  },

  getSession: (): { user: User; token: string; sessionToken?: string } | null => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > 86400000) {
        authBridge.clearSession();
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  fetchMe: async (token: string): Promise<User | null> => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return null;
      const user = await response.json();
      return {
        ...user,
        roles: Array.isArray(user.roles) ? user.roles : [user.role]
      };
    } catch {
      return null;
    }
  },

  clearSession: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  },

  getSessionToken: (): string | null => {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  },

  validateCurrentSession: async (): Promise<boolean> => {
    const sessionToken = authBridge.getSessionToken();
    if (!sessionToken) return false;
    try {
      const response = await fetch(`${getBackendUrl()}/api/auth/validate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken
        },
        body: JSON.stringify({ sessionToken })
      });
      if (response.ok) {
        const data = await response.json();
        return data.valid === true;
      }
      return true; // tolérant aux erreurs réseau
    } catch {
      return true;
    }
  },

  logout: async (): Promise<boolean> => {
    const sessionToken = authBridge.getSessionToken();
    try {
      if (sessionToken) {
        await fetch(`${getBackendUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken
          },
          body: JSON.stringify({ sessionToken })
        });
      }
      authBridge.clearSession();
      return true;
    } catch {
      authBridge.clearSession();
      return false;
    }
  },

  startSessionMonitoring: (onSessionExpired: () => void, intervalMs = 300000) => {
    const intervalId = setInterval(async () => {
      const isValid = await authBridge.validateCurrentSession();
      if (!isValid) {
        clearInterval(intervalId);
        authBridge.clearSession();
        onSessionExpired();
      }
    }, intervalMs);
    return intervalId;
  },

  /**
   * Contrôle d'accès par rôle — sans restriction de plan
   */
  canAccess: (user: User, moduleId: string): boolean => {
    const roles = Array.isArray(user.roles) ? user.roles : [user.role];

    // Vérifier si le compte est suspendu
    const tenantStatus = (user as any)?.tenant?.paymentStatus;
    const BLOCKED_STATUSES = ['EXPIRED', 'OVERDUE', 'BLOCKED', 'SUSPENDED'];
    if (tenantStatus && BLOCKED_STATUSES.includes(tenantStatus)) {
      return ['dashboard', 'settings', 'support', 'info'].includes(moduleId);
    }

    // ADMIN / DIRECTEUR : accès total
    if (roles.some(r => r === UserRole.ADMIN || r === UserRole.DIRECTEUR)) return true;

    // Sous-modules RH : si le rôle a accès à 'rh', il a accès aux sous-modules
    const baseModule = moduleId.startsWith('rh.') ? 'rh' : moduleId;

    return roles.some(r => {
      const allowed = ROLE_MODULES[r as string] || [];
      return allowed.includes(moduleId) || (moduleId.startsWith('rh.') && allowed.includes('rh'));
    });
  },

  /**
   * Vérifie si une action CRUD est autorisée
   */
  canPerform: (user: User, action: 'CREATE' | 'EDIT' | 'DELETE' | 'VIEW', resource: string): boolean => {
    // Consolidation robuste des rôles : roles[] en priorité, sinon role simple
    const rolesArr = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : []);

    // ADMIN / DIRECTEUR : accès total sans restriction
    if (rolesArr.some(r => r === UserRole.ADMIN || r === UserRole.DIRECTEUR)) return true;

    // ASSISTANTE : lecture seule
    if (rolesArr.includes(UserRole.ASSISTANTE)) return action === 'VIEW';

    // HR_MANAGER : CRUD sur les ressources RH
    if (rolesArr.includes(UserRole.HR_MANAGER)) {
      const rhResources = ['employees', 'contracts', 'payroll', 'payslips', 'advances', 'declarations', 'documents', 'organigram', 'time', 'performance', 'leaves'];
      if (rhResources.includes(resource)) return true;
      return action === 'VIEW';
    }

    // COMPTABLE : CRUD finances, lecture reste
    if (rolesArr.includes(UserRole.COMPTABLE)) {
      const finResources = ['payments', 'recovery', 'sales', 'customers', 'eleves', 'services', 'payroll', 'payslips', 'advances', 'declarations'];
      if (finResources.includes(resource)) return true;
      return action === 'VIEW';
    }

    // ENSEIGNANT / MAITRESSE : écriture sur leurs propres ressources pédagogiques
    // L'emploi du temps est géré exclusivement par le DIRECTEUR — les profs ne peuvent que consulter
    if (rolesArr.some(r => r === UserRole.ENSEIGNANT || r === UserRole.MAITRESSE)) {
      const pedagResources = ['bulletins', 'competences', 'cahier-texte'];
      if (pedagResources.includes(resource)) return true;
      return action === 'VIEW';
    }

    return action === 'VIEW';
  },

  // Conservé pour compatibilité — toujours illimité (pas de plan)
  getPlanLimits: (_user: User) => null,
  isCreationAllowed: (_user: User, _resource: string, _currentCount: number) => true,
  getTrialDaysRemaining: (_user: User): number | null => null,

  hasPermission: (role: UserRole, resource: string, action: 'read' | 'write' | 'delete'): boolean => {
    if (role === UserRole.ADMIN || role === UserRole.DIRECTEUR) return true;
    if (action === 'read') return true;
    if (role === UserRole.COMPTABLE) {
      const finResources = ['payments', 'sales', 'customers', 'bulletins', 'payroll', 'payslips'];
      return finResources.includes(resource);
    }
    if (role === UserRole.HR_MANAGER) {
      const rhResources = ['employees', 'contracts', 'payroll', 'payslips', 'documents', 'leaves'];
      return rhResources.includes(resource);
    }
    if (role === UserRole.ENSEIGNANT || role === UserRole.MAITRESSE) {
      // emploi-temps retiré : les profs consultent uniquement, le DIRECTEUR gère
      const pedagResources = ['bulletins', 'eleves', 'competences'];
      return pedagResources.includes(resource);
    }
    return false;
  },
};
