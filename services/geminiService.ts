/**
 * geminiService.ts — Agent IA Orchestrator
 * Bridge entre le frontend React et le workflow n8n (via proxy backend).
 *
 * Responsabilités :
 * - Envoyer les messages au webhook n8n via /api/ai/bridge
 * - Normaliser les réponses (format, rawResults, metadata, chart_config)
 * - Passer toutes les métadonnées au ChatInterface pour les visualisations
 */
import { apiClient } from "./api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DocumentEntry {
  html: string;
  title: string;
  filename: string;
}

export interface AIChatResponse {
  formattedResponse: string;
  format: string;
  resultCount: number;
  rawResults?: any[];
  downloadUrl?: string;
  documentHtml?: string;
  // Génération en masse : plusieurs documents d'un coup
  isMultiDoc?: boolean;
  documentArray?: DocumentEntry[];
  documentCount?: number;
  createZip?: boolean;
  // Données structurées pour le composant React DocumentPreview
  // Permet de réafficher le document après rechargement de page
  documentData?: {
    type: 'FACTURE' | 'RECU' | 'BON_SORTIE' | 'SUBSCRIPTION_INVOICE';
    sale: Record<string, any>;
    tenant: Record<string, any>;
    currency: string;
  };
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  mode?: 'BRIDGE' | 'TEST' | 'NATIVE';
  metadata?: {
    format?: string;
    title?: string;
    description?: string;
    chart_config?: Record<string, any>;
    kpi_config?: Record<string, any>;
    table_config?: Record<string, any>;
    stats?: Record<string, any>;
    columns?: string[];
    planId?: string;
    document_type?: string;
    documentHtml?: string;
    documentData?: Record<string, any>; // persistance rechargement
    ref?: string;
    generated_at?: string;
    [key: string]: any;
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Nettoie le texte des artefacts markdown techniques avant affichage.
 * Conserve **gras** et les emojis — supprime uniquement les symboles parasites.
 */
export const cleanProfessionalText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\[object Object\]/g, '')   // jamais d'objets stringifiés
    .replace(/^\s*```[\w]*\s*/gm, '')    // supprime les fences de code isolées
    .replace(/\s*```\s*$/gm, '')
    .trim();
};

/**
 * Parseur de fallback pour extraire des données temporelles depuis du texte brut.
 * Utilisé uniquement si le workflow n8n renvoie du texte non structuré (cas rare).
 */
export const extractDataFromText = (text: string): any[] => {
  const results: any[] = [];
  const regex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.Z\d]*)\s*[-–]\s*([\d.]+)\s*[-–]\s*([\d.]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const d = new Date(match[1]);
    results.push({
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      fullDate: d.toLocaleDateString('fr-FR'),
      Volume: parseFloat(match[2]),
      Montant: parseFloat(match[3]),
    });
  }
  return results;
};

// ─────────────────────────────────────────────
// API principale
// ─────────────────────────────────────────────

export const getAIResponse = async (message: string, tenantId: string, planId?: string): Promise<AIChatResponse> => {
  // planId passé explicitement depuis ChatInterface (user.planId résolu dans App.tsx)
  // Fallback sur la lecture window pour la rétro-compatibilité
  const _windowUser: any = (window as any)?.currentUser ?? {};
  const resolvedPlanId = planId
    ?? _windowUser.planId
    ?? _windowUser.tenant?.plan
    ?? _windowUser.tenant?.subscription_plan
    ?? _windowUser.tenant?.planId
    ?? 'BASIC';

  // Envoi via proxy backend (évite les problèmes CORS avec le webhook ngrok)
  const rawData = await apiClient.post('/ai/bridge', {
    // Forme 1 : attendue par le webhook n8n
    message,
    id: tenantId,
    planId: resolvedPlanId,
    // Forme 2 : compatibilité avec certains workflows n8n (chatInput/sessionId)
    chatInput: message,
    sessionId: tenantId,
  });

  return processResponse(rawData);
};

// ─────────────────────────────────────────────
// Normalisation de la réponse
// ─────────────────────────────────────────────

const processResponse = (rawData: any): AIChatResponse => {
  // Le bridge peut renvoyer plusieurs formes :
  // 1. Tableau n8n direct : [{formattedResponse, format, rawResults, metadata, ...}]
  // 2. Objet wrappé : {data: [...], fromFallback: true}
  // 3. Objet direct : {formattedResponse, format, ...}

  let data: any = rawData;

  // Dépaquetage bridge wrapper
  if (data && typeof data === 'object' && !Array.isArray(data) && data.data) {
    data = data.data;
  }
  // Prend le premier élément si tableau
  if (Array.isArray(data)) {
    data = data[0] ?? {};
  }

  if (!data || typeof data !== 'object') {
    return _errorResponse('Le service IA ne répond pas. Vérifiez que le workflow n8n est actif.');
  }

  // ── Erreurs retournées par le bridge backend ───────────────────────────
  // Le bridge peut renvoyer { error: 'WebhookNotRegistered', message: '...' }
  if (data.error && !data.formattedResponse) {
    const errMessages: Record<string, string> = {
      'WebhookNotRegistered': '⚙️ Le workflow IA n\'est pas activé sur n8n. Contactez votre administrateur.',
      'WebhookUnavailable':   '🔌 Le service IA est temporairement indisponible. Réessayez dans quelques instants.',
      'BridgeError':          '🌐 Impossible de contacter le service IA. Vérifiez votre connexion réseau.',
      'PdfExportError':       '📄 La génération PDF a échoué. Réessayez ou contactez le support.',
    };
    const friendly = errMessages[String(data.error)] ?? (data.message ?? 'Une erreur inattendue est survenue. Réessayez.');
    return _errorResponse(friendly);
  }

  // ── Extraction des champs ──────────────────

  const rawText: string = String(data.formattedResponse ?? data.output ?? data.text ?? '');

  // Format : priorité à la valeur du workflow, fallback sur détection auto
  let format: string = String(data.format ?? '').toLowerCase() || 'general';

  // rawResults : données pour les visualisations
  let results: any[] = data.rawResults ?? data.results ?? data.data ?? [];
  if (!Array.isArray(results)) results = [];

  // Métadonnées enrichies (workflow v2 : chart_config, kpi_config, etc.)
  const metadata: AIChatResponse['metadata'] = data.metadata ?? undefined;

  // Document HTML + données structurées React (DocumentPreview)
  const documentHtml: string | undefined =
    data.documentHtml ?? data.metadata?.documentHtml ?? undefined;

  // documentData : données structurées pour le composant DocumentPreview React
  // Priorité : champ direct > metadata.documentData (pour rechargement historique)
  const documentData = data.documentData ?? data.metadata?.documentData ?? undefined;

  // Génération en masse (plusieurs fiches de paie, etc.)
  const isMultiDoc: boolean = !!(data.isMultiDoc ?? data.metadata?.isMultiDoc);
  const documentArray: DocumentEntry[] | undefined = Array.isArray(data.documentArray) ? data.documentArray : undefined;
  const documentCount: number | undefined = data.documentCount ?? documentArray?.length;
  const createZip: boolean = !!(data.createZip ?? data.metadata?.createZip ?? (documentArray && documentArray.length > 5));

  // ── Détection auto format si 'general' et données temporelles ──
  if (format === 'general' && rawText) {
    const extracted = extractDataFromText(rawText);
    if (extracted.length > 0) {
      format = 'chart';
      results = extracted;
    }
  }

  // ── Download URL (format excel) ───────────
  let downloadUrl: string | undefined = data.downloadUrl ?? undefined;
  if (format === 'excel' && !downloadUrl) {
    downloadUrl = `/api/documents/export/${data.sessionId ?? 'current'}`;
  }

  return {
    formattedResponse: cleanProfessionalText(rawText)
      || 'Impossible d\'interpréter la réponse. Veuillez reformuler.',
    format,
    resultCount: results.length,
    rawResults: results,
    downloadUrl,
    documentHtml,
    documentData,
    isMultiDoc,
    documentArray,
    documentCount,
    createZip,
    metadata,
    status: 'SUCCESS',
    mode: 'BRIDGE',
  };
};

// ─────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────

const _errorResponse = (msg: string): AIChatResponse => ({
  formattedResponse: msg,
  format: 'general',
  resultCount: 0,
  status: 'ERROR',
  mode: 'BRIDGE',
});

// ─────────────────────────────────────────────
// Autres exports API
// ─────────────────────────────────────────────

/**
 * Récupère l'historique de conversation.
 * AIController.getHistory retourne maintenant des objets enrichis :
 * { id, sender, message, rawResults, metadata, format, resultCount, created_at }
 * Le ChatInterface les consomme directement sans re-parsing.
 */
export const fetchChatHistory  = async (): Promise<any[]> => apiClient.get('/ai/history');
export const fetchPromptTemplates = async (): Promise<any[]> => apiClient.get('/ai/templates');