import { apiClient } from './api';

// Envoi WhatsApp en arrière-plan : le backend pilote un WhatsApp Web headless lié au
// numéro de l'établissement. Plus aucun lien wa.me ni ouverture de navigateur.

export type WaStatus =
  | 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATING'
  | 'READY' | 'RECONNECTING' | 'LOGGED_OUT' | 'RESTRICTED';

export interface WaSessionStatus {
  status: WaStatus;
  qr: string | null;
  pairingCode: string | null;
  phone: string | null;
  pushname: string | null;
  lastError: string | null;
  restriction: string | null;
  nextReconnectAt: string | null;
  queueLength: number;
  pausedUntil: string | null;
  linkedAt: string | null;
  sentToday: number;
  dailyCap: number | null;
}

export interface WaMessage {
  id: string;
  phone: string;
  kind: 'text' | 'document';
  body: string;
  filename: string | null;
  category: string | null;
  reference: string | null;
  recipient_name: string | null;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  ack: number | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface WaGroup {
  id: string;
  name: string;
  participants: number | null;
  announce: boolean;
  canSend: boolean;
  lastActivity: number | null;
}

export interface WaBulkItem { phone: string; message: string; recipientName?: string }

export const WA_STATUS_LABELS: Record<WaStatus, string> = {
  DISCONNECTED: 'Non connecté',
  INITIALIZING: 'Démarrage…',
  QR_READY: 'En attente du scan',
  AUTHENTICATING: 'Synchronisation…',
  READY: 'Connecté',
  RECONNECTING: 'Reconnexion…',
  LOGGED_OUT: 'Délié — rescan requis',
  RESTRICTED: 'Compte restreint',
};

export const WA_MESSAGE_STATUS_LABELS: Record<WaMessage['status'], string> = {
  QUEUED: 'En file',
  SENT: 'Envoyé',
  DELIVERED: 'Distribué',
  READ: 'Lu',
  FAILED: 'Échec',
};

export const whatsappService = {
  getStatus: (): Promise<WaSessionStatus> => apiClient.get('/whatsapp/status'),
  connect: (): Promise<WaSessionStatus> => apiClient.post('/whatsapp/connect', {}),
  requestPairingCode: (phone: string): Promise<{ code: string }> => apiClient.post('/whatsapp/pairing-code', { phone }),
  disconnect: (): Promise<WaSessionStatus> => apiClient.post('/whatsapp/disconnect', {}),
  logout: (): Promise<WaSessionStatus> => apiClient.post('/whatsapp/logout', {}),

  /** Envoi individuel ; le serveur attend l'envoi réel (~25 s max) avant de répondre. */
  send: (phone: string, message: string, extra: { recipientName?: string; category?: string } = {}):
    Promise<{ success: boolean; queued?: boolean; messageId?: string }> =>
    apiClient.post('/whatsapp/send', { phone, message, ...extra }),

  /** Envoi groupé : tout est mis en file, réponse immédiate avec l'id de chaque message. */
  sendBulk: (messages: WaBulkItem[], category?: string):
    Promise<{ sent: number; failed: number; details: { phone: string; messageId: string; status: string; error?: string }[] }> =>
    apiClient.post('/whatsapp/send-bulk', { messages, category }),

  /** Groupes WhatsApp du compte lié. */
  listGroups: (): Promise<{ groups: WaGroup[] }> => apiClient.get('/whatsapp/groups'),

  listMessages: (params: { limit?: number; offset?: number; status?: string; ids?: string[] } = {}):
    Promise<{ messages: WaMessage[]; total: number }> => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    if (params.status) q.set('status', params.status);
    if (params.ids?.length) q.set('ids', params.ids.join(','));
    return apiClient.get(`/whatsapp/messages?${q.toString()}`);
  },
};
