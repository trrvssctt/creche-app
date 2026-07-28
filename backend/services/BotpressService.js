import axios from 'axios';

// Webhook n8n pour l'envoi de messages WhatsApp sortants
const N8N_WHATSAPP_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK || process.env.BOTPRESS_WEBHOOK_URL;
const WHATSAPP_SENDER = process.env.WHATSAPP_SENDER_PHONE || '';

export class BotpressService {
  /**
   * Envoie un message WhatsApp via n8n.
   * n8n reçoit le payload et déclenche l'envoi via l'API WhatsApp Business / Botpress.
   *
   * @param {string} phone - Numéro WhatsApp du destinataire
   * @param {string} message - Corps du message
   * @returns {{ success: boolean, messageId?: string, error?: string }}
   */
  static async sendWhatsApp(phone, message) {
    if (!N8N_WHATSAPP_WEBHOOK) {
      console.warn('[WHATSAPP] N8N_WHATSAPP_WEBHOOK non configuré — message non envoyé');
      return { success: false, error: 'Webhook WhatsApp non configuré (N8N_WHATSAPP_WEBHOOK)' };
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return { success: false, error: `Numéro invalide: ${phone}` };
    }

    try {
      const payload = {
        action: 'send_whatsapp',
        to: normalizedPhone,
        message,
        sender: WHATSAPP_SENDER,
        timestamp: new Date().toISOString(),
      };

      console.log(`[WHATSAPP] Envoi vers ${normalizedPhone} via n8n...`);

      const response = await axios.post(N8N_WHATSAPP_WEBHOOK, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      // n8n retourne généralement un objet avec success ou un status 200
      const data = response.data;
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        console.log(`[WHATSAPP] ✅ Message envoyé à ${normalizedPhone}`);
        return {
          success: true,
          messageId: data?.messageId || data?.id || `n8n-${Date.now()}`,
        };
      }

      return { success: false, error: `n8n a retourné: ${JSON.stringify(data)}` };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      const statusCode = err.response?.status;
      console.error(`[WHATSAPP] ❌ Erreur envoi à ${normalizedPhone} (HTTP ${statusCode}):`, errorMsg);
      return { success: false, error: errorMsg };
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
    // Format local 7X... avec plus de chiffres (ex: 78263672882 → tronquer à 9)
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
