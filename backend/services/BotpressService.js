import axios from 'axios';

const BOTPRESS_WEBHOOK_URL = process.env.BOTPRESS_WEBHOOK_URL;
const BOTPRESS_BOT_ID = process.env.BOTPRESS_BOT_ID;
const BOTPRESS_TOKEN = process.env.BOTPRESS_TOKEN;

const BOTPRESS_API = 'https://api.botpress.cloud/v1';

export class BotpressService {
  /**
   * Envoie un message WhatsApp proactif via l'API Botpress Cloud.
   * Utilise createMessage sur une conversation existante ou en crée une nouvelle.
   *
   * @param {string} phone - Numéro WhatsApp du destinataire
   * @param {string} message - Corps du message
   * @returns {{ success: boolean, messageId?: string, error?: string }}
   */
  static async sendWhatsApp(phone, message) {
    if (!BOTPRESS_TOKEN) {
      console.warn('[BOTPRESS] BOTPRESS_TOKEN non configuré — message non envoyé');
      return { success: false, error: 'BOTPRESS_TOKEN non configuré' };
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return { success: false, error: `Numéro invalide: ${phone}` };
    }

    try {
      // Méthode 1 : Webhook avec payload structuré pour message sortant
      // Le webhook Botpress peut être configuré pour recevoir des messages sortants
      // si un "Outgoing Webhook" est configuré dans les intégrations
      const response = await axios.post(BOTPRESS_WEBHOOK_URL, {
        type: 'text',
        text: message,
        userId: normalizedPhone,
        conversationId: `wa-${normalizedPhone}`,
        tags: {
          'whatsapp:phoneNumber': normalizedPhone,
        },
        payload: {
          type: 'text',
          text: message,
        },
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BOTPRESS_TOKEN}`,
          'x-bot-id': BOTPRESS_BOT_ID,
        },
        timeout: 15000,
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          messageId: response.data?.messageId || response.data?.id || 'sent',
        };
      }

      return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(response.data)}` };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      const statusCode = err.response?.status;
      console.error(`[BOTPRESS] Erreur envoi WhatsApp à ${normalizedPhone} (${statusCode}):`, errorMsg);

      // Si le webhook classique ne fonctionne pas, tenter l'API directe
      if (statusCode === 400 || statusCode === 404 || statusCode === 422) {
        return this.sendViaConversationAPI(normalizedPhone, message);
      }

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Fallback : Envoie via l'API Conversations de Botpress Cloud.
   * Crée ou retrouve une conversation avec le user WhatsApp et envoie un message.
   */
  static async sendViaConversationAPI(phone, message) {
    try {
      // Étape 1 : Créer ou récupérer l'utilisateur
      const userRes = await axios.post(`${BOTPRESS_API}/chat/users`, {
        tags: {
          'whatsapp:userId': phone,
          'whatsapp:phoneNumber': phone,
        },
      }, {
        headers: {
          'Authorization': `Bearer ${BOTPRESS_TOKEN}`,
          'x-bot-id': BOTPRESS_BOT_ID,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const userId = userRes.data?.user?.id;
      if (!userId) {
        return { success: false, error: 'Impossible de créer/trouver le user Botpress' };
      }

      // Étape 2 : Créer une conversation
      const convRes = await axios.post(`${BOTPRESS_API}/chat/conversations`, {
        channel: 'whatsapp',
        tags: {
          'whatsapp:phoneNumber': phone,
        },
      }, {
        headers: {
          'Authorization': `Bearer ${BOTPRESS_TOKEN}`,
          'x-bot-id': BOTPRESS_BOT_ID,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const conversationId = convRes.data?.conversation?.id;
      if (!conversationId) {
        return { success: false, error: 'Impossible de créer la conversation Botpress' };
      }

      // Étape 3 : Envoyer le message
      const msgRes = await axios.post(`${BOTPRESS_API}/chat/messages`, {
        conversationId,
        userId,
        type: 'text',
        payload: { text: message },
        tags: {
          'whatsapp:phoneNumber': phone,
        },
      }, {
        headers: {
          'Authorization': `Bearer ${BOTPRESS_TOKEN}`,
          'x-bot-id': BOTPRESS_BOT_ID,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        success: true,
        messageId: msgRes.data?.message?.id || 'sent-via-api',
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[BOTPRESS] Erreur API Conversation:`, errorMsg);
      return { success: false, error: `API Conversation: ${errorMsg}` };
    }
  }

  /**
   * Envoi en masse avec rate-limiting.
   */
  static async sendBulk(recipients, options = {}) {
    const { delayMs = 1000, onProgress } = options;
    const details = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const { phone, message, eleveId } = recipients[i];
      const result = await this.sendWhatsApp(phone, message);

      if (result.success) {
        sent++;
        details.push({ eleveId, phone, status: 'DELIVERED', messageId: result.messageId });
      } else {
        failed++;
        details.push({ eleveId, phone, status: 'FAILED', error: result.error });
      }

      if (onProgress) onProgress(sent + failed, recipients.length);

      if (i < recipients.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { sent, failed, details };
  }

  /**
   * Normalise un numéro de téléphone sénégalais vers le format international.
   */
  static normalizePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/[^0-9+]/g, '');

    // Déjà au format +221...
    if (digits.startsWith('+221') && digits.length >= 13) return digits;
    // Format 221... sans +
    if (digits.startsWith('221') && digits.length >= 12) return `+${digits}`;
    // Format local 7X... (9 chiffres)
    if (/^[7][0-9]{8}$/.test(digits)) return `+221${digits}`;
    // Format local 7X... avec plus de chiffres (ex: 78263672882 → 11 chiffres)
    if (/^7[0-9]+$/.test(digits) && digits.length > 9) return `+221${digits.slice(0, 9)}`;
    // Format 0X... (10 chiffres, préfixe local)
    if (digits.startsWith('0') && digits.length === 10) return `+221${digits.slice(1)}`;
    // Format international autre pays (commence par +)
    if (digits.startsWith('+') && digits.length >= 10) return digits;
    // Numéro court 8 chiffres (ancien format sénégalais)
    if (/^[0-9]{8}$/.test(digits)) return `+221${digits}`;

    return null;
  }
}
