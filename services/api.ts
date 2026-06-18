
import { authBridge } from './authBridge';

// Configuration de l'URL du backend
// En développement: forcer localhost:3000
// En production: utiliser la variable d'environnement ou l'origin courant
const buildTimeBackend = (import.meta as any).env?.VITE_BACKEND_URL;
let rawBackend: string;

if (buildTimeBackend) {
  // Variable d'environnement explicite définie
  rawBackend = buildTimeBackend;
} else {
  try {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    // En développement avec Vite (localhost:5173-5179), pointer vers le backend sur port 3000
    if (origin && /localhost:517[3-9]/.test(origin)) {
      rawBackend = 'http://localhost:3000';
      //rawBackend = 'https://gestock.realtechprint.com';
    } else if (origin && !/localhost|127\.0\.0\.1/.test(origin)) {
      // Production: API co-localisée sous la même origine
      rawBackend = origin;
    } else {
      // Fallback pour développement
      rawBackend = 'http://localhost:3000';
      //rawBackend = 'https://gestock.realtechprint.com';
    }
  } catch (e) {
    rawBackend = 'http://localhost:3000';
    //rawBackend = 'https://gestock.realtechprint.com';
  }
}

const BACKEND_URL = rawBackend.endsWith('/api') ? rawBackend : `${rawBackend.replace(/\/+$/, '')}/api`;
export const BASE_URL = rawBackend.replace(/\/+$/, '');



export interface ApiError {
  error: string;
  message: string;
  status: number;
}

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const session = authBridge.getSession();
    const sessionToken = authBridge.getSessionToken();

    // Ne pas définir Content-Type si headers est un objet vide (pour FormData)
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
      ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, { ...options, headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Construction d'une erreur riche basée sur la réponse du Kernel
        const errorContext: ApiError = {
          error: data.error || 'UnknownError',
          message: data.message || 'Une erreur inattendue est survenue sur le serveur.',
          status: response.status
        };

        // Gestion spécifique des sessions expirées
        if (response.status === 401 || response.status === 403) {
          if (data.message?.toLowerCase().includes('expirée') || data.shouldLogout) {
            authBridge.clearSession();
            window.location.reload();
          }
        }

        throw errorContext;
      }

      return data;
    } catch (err: any) {
      if (err.status) throw err; // C'est déjà une ApiError

      // Erreur réseau (Backend injoignable)
      throw {
        error: 'NetworkError',
        message: 'Impossible de joindre le Kernel AlwaysData. Vérifiez votre connexion internet.',
        status: 0
      } as ApiError;
    }
  },

  /** Comme request() mais renvoie un Blob — pour les téléchargements binaires (PDF, ZIP…) */
  async requestBlob(endpoint: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
    const session = authBridge.getSession();
    const sessionToken = authBridge.getSessionToken();
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
      ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
      ...options.headers,
    };
    const response = await fetch(`${BACKEND_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw { error: data.error || 'DownloadError', message: data.message || 'Échec du téléchargement.', status: response.status };
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    return { blob, filename: match?.[1] ?? 'download' };
  },

  get: (e: string, opts?: { params?: Record<string, any> }) => {
    if (opts?.params) {
      const qs = new URLSearchParams(
        Object.entries(opts.params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString();
      return apiClient.request(qs ? `${e}?${qs}` : e, { method: 'GET' });
    }
    return apiClient.request(e, { method: 'GET' });
  },
  post: (e: string, b?: any) => apiClient.request(e, { method: 'POST', body: b !== undefined ? JSON.stringify(b) : undefined }),
  put: (e: string, b: any) => apiClient.request(e, { method: 'PUT', body: JSON.stringify(b) }),
  patch: (e: string, b?: any) => apiClient.request(e, { method: 'PATCH', body: b ? JSON.stringify(b) : undefined }),
  delete: (e: string) => apiClient.request(e, { method: 'DELETE' }),
};

// Compatibility helper: returns the raw fetch Response so existing components can call `res.json()`
export async function fetchWithToken(endpoint: string, options: RequestInit = {}) {
  const session = authBridge.getSession();
  const sessionToken = authBridge.getSessionToken();
  const headers: any = {
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
    ...options.headers,
  };

  return fetch(`${BACKEND_URL}${endpoint}`, { ...options, headers });
}

// ============== LEAVE (CONGÉS) API ==============
export const leaveApi = {
  getAll: (params?: {
    employeeId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortDir?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiClient.get(`/hr/leaves${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get(`/hr/leaves/${id}`),

  create: (data: {
    employeeId: string;
    type: 'PAID' | 'SICK' | 'MATERNITY' | 'UNPAID' | 'ANNUAL';
    startDate: string;
    endDate: string;
    reason?: string;
    document?: File;
  } | FormData) => {
    // Si c'est déjà un FormData, l'utiliser directement
    if (data instanceof FormData) {
      return apiClient.request('/hr/leaves', {
        method: 'POST',
        body: data,
        headers: {} // Laisser le navigateur gérer Content-Type pour FormData
      });
    }

    // Si un document est fourni dans l'objet, utiliser FormData
    if (data.document) {
      const formData = new FormData();
      formData.append('employeeId', data.employeeId);
      formData.append('type', data.type);
      formData.append('startDate', data.startDate);
      formData.append('endDate', data.endDate);
      if (data.reason) formData.append('reason', data.reason);
      formData.append('document', data.document);

      return apiClient.request('/hr/leaves', {
        method: 'POST',
        body: formData,
        headers: {} // Laisser le navigateur gérer Content-Type pour FormData
      });
    } else {
      // Sinon, utiliser JSON classique
      return apiClient.post('/hr/leaves', {
        employeeId: data.employeeId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason
      });
    }
  },

  update: (id: string, data: FormData | Partial<{
    employeeId: string;
    type: 'PAID' | 'SICK' | 'MATERNITY' | 'UNPAID' | 'ANNUAL';
    startDate: string;
    endDate: string;
    reason?: string;
  }>) => {
    // Si data est FormData, utiliser la requête avec FormData
    if (data instanceof FormData) {
      return apiClient.request(`/hr/leaves/${id}`, {
        method: 'PUT',
        body: data,
        headers: {} // Laisser le navigateur gérer Content-Type pour FormData
      });
    } else {
      // Sinon, utiliser JSON classique
      return apiClient.put(`/hr/leaves/${id}`, data);
    }
  },

  approve: (id: string, rejectionReason?: string) =>
    apiClient.post(`/hr/leaves/${id}/approve`, { rejectionReason }),

  delete: (id: string) => apiClient.delete(`/hr/leaves/${id}`),
};

// ============== EMPLOYEE API (for Leave form) ==============
export const employeeApi = {
  getAll: () => apiClient.get('/hr/employees'),
  getById: (id: string) => apiClient.get(`/hr/employees/${id}`),
  get: (id: string) => apiClient.get(`/hr/employees/${id}`),
};

// Export apiClient as api for convenience
export const api = apiClient;
