import axios from 'axios';

const BOTPRESS_WEBHOOK_URL = process.env.BOTPRESS_WEBHOOK_URL;
const BOTPRESS_BOT_ID = process.env.BOTPRESS_BOT_ID;
const BOTPRESS_TOKEN = process.env.BOTPRESS_TOKEN;

export class BotpressService {
  /**
   * Envoie un message WhatsApp via Botpress Cloud.
   * Botpress utilise le canal WhatsApp connecté pour délivrer le message.
   *
   * @param {string} phone - Numéro WhatsApp du destinataire (format international, ex: +221771001001)
   * @param {string} message - Corps du message à envoyer
   * @returns {{ success: boolean, messageId?: string, error?: string }}
   */
  static async sendWhatsApp(phone, message) {
    if (!BOTPRESS_WEBHOOK_URL) {
      console.warn('[BOTPRESS] BOTPRESS_WEBHOOK_URL non configuré — message non envoyé');
      return { success: false, error: 'BOTPRESS_WEBHOOK_URL non configuré' };
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return { success: false, error: `Numéro invalide: ${phone}` };
    }

    try {
      const response = await axios.post(BOTPRESS_WEBHOOK_URL, {
        type: 'outgoing_message',
        botId: BOTPRESS_BOT_ID,
        channel: 'whatsapp',
        phone: normalizedPhone,
        message,
        timestamp: new Date().toISOString(),
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(BOTPRESS_TOKEN ? { 'Authorization': `Bearer ${BOTPRESS_TOKEN}` } : {}),
        },
        timeout: 10000,
      });

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.id || null,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error(`[BOTPRESS] Erreur envoi WhatsApp à ${normalizedPhone}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Envoi en masse avec gestion du rate-limiting.
   * Envoie séquentiellement avec un délai entre chaque message.
   *
   * @param {{ phone: string, message: string, eleveId?: string }[]} recipients
   * @param {{ delayMs?: number, onProgress?: (sent: number, total: number) => void }} options
   * @returns {{ sent: number, failed: number, details: Array }}
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

      // Rate limiting — attendre entre chaque envoi (sauf le dernier)
      if (i < recipients.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { sent, failed, details };
  }

  /**
   * Normalise un numéro de téléphone sénégalais vers le format international.
   * @param {string} raw
   * @returns {string|null}
   */
  static normalizePhone(raw) {
    if (!raw) return null;
    let digits = raw.replace(/[^0-9+]/g, '');

    // Déjà au format +221...
    if (digits.startsWith('+221') && digits.length >= 13) return digits;
    // Format 221... sans +
    if (digits.startsWith('221') && digits.length >= 12) return `+${digits}`;
    // Format local 7X... (9 chiffres)
    if (/^[7][0-9]{8}$/.test(digits)) return `+221${digits}`;
    // Format 0X... (10 chiffres, préfixe local)
    if (digits.startsWith('0') && digits.length === 10) return `+221${digits.slice(1)}`;
    // Format international autre pays (commence par +)
    if (digits.startsWith('+') && digits.length >= 10) return digits;

    return null;
  }
}
