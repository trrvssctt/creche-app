/**
 * WhatsApp Outbound Service (ex-BotpressService)
 * Point d'entrée unique pour tous les envois WhatsApp sortants.
 * POSTe vers le workflow n8n "WhatsApp Outbound" qui gère le routage,
 * le rate-limiting et la synchronisation du contexte Botpress.
 */

import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

import axios from 'axios';
import { sequelize } from '../config/database.js';
import { normaliserNumero, normalizePhone } from '../utils/phone.js';

export { normaliserNumero, normalizePhone };

function getWebhookUrl() {
  return (process.env.N8N_WHATSAPP_WEBHOOK || process.env.BOTPRESS_WEBHOOK_URL || '').trim();
}
const N8N_TIMEOUT = parseInt(process.env.N8N_WHATSAPP_TIMEOUT || '30000', 10);

async function isInSession(phoneE164) {
  try {
    const [results] = await sequelize.query(
      `SELECT last_inbound FROM whatsapp_sessions
       WHERE phone = :phone AND last_inbound > NOW() - INTERVAL '24 hours'`,
      { replacements: { phone: phoneE164 }, type: sequelize.QueryTypes.SELECT }
    );
    return !!results;
  } catch {
    return false;
  }
}

async function callN8n(payload) {
  const url = getWebhookUrl();
  if (!url) {
    throw new Error('N8N_WHATSAPP_WEBHOOK non défini');
  }
  const { data } = await axios.post(url, payload, {
    timeout: N8N_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

// ── API publique ────────────────────────────────────────────────────────────

export class BotpressService {

  static normalizePhone = normalizePhone;
  static normaliserNumero = normaliserNumero;

  /**
   * Envoie un message texte WhatsApp.
   */
  static async sendWhatsApp(phone, message, opts = {}) {
    const paysDefaut = opts.indicatifPays || '221';
    const result = normaliserNumero(String(phone || ''), paysDefaut);
    if (!result.ok) {
      return { success: false, error: `Numéro invalide (${phone}): ${result.erreur}` };
    }
    const normalized = result.e164;

    const inSession = await isInSession(normalized);
    const hasTemplate = !!opts.template;

    const payload = {
      action: 'send_whatsapp',
      to: normalized,
      message,
      inSession: hasTemplate ? false : (inSession || true),
      category: opts.category || 'generique',
      reference: opts.reference || null,
      template: opts.template || null,
      variables: opts.variables || [],
      timestamp: new Date().toISOString(),
    };

    try {
      console.log(`[WHATSAPP] Envoi texte vers ${normalized} (inSession=${inSession})...`);
      const data = await callN8n(payload);

      if (data.success || (data.sent && data.sent > 0)) {
        console.log(`[WHATSAPP] ✅ Message envoyé à ${normalized}`);
        const result = data.results?.[0] || {};
        return { success: true, messageId: result.messageId || data.messageId || `n8n-${Date.now()}` };
      }

      const errMsg = data.results?.[0]?.error || data.error || JSON.stringify(data);
      return { success: false, error: errMsg };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[WHATSAPP] ❌ Erreur envoi à ${normalized}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Envoie un document (PDF, image) avec un message accompagnant.
   */
  static async sendDocument(phone, message, document, opts = {}) {
    const paysDefaut = opts.indicatifPays || '221';
    const result = normaliserNumero(String(phone || ''), paysDefaut);
    if (!result.ok) {
      return { success: false, error: `Numéro invalide (${phone}): ${result.erreur}` };
    }
    const normalized = result.e164;

    const hasTemplate = !!opts.template;

    const payload = {
      action: 'send_whatsapp_document',
      to: normalized,
      message,
      inSession: hasTemplate ? false : true,
      document: {
        url: document.url || null,
        base64: document.base64 || null,
        filename: document.filename || 'document.pdf',
        mimeType: document.mimeType || 'application/pdf',
        caption: document.caption || message,
      },
      category: opts.category || 'facture',
      reference: opts.reference || null,
      template: opts.template || null,
      variables: opts.variables || [],
      timestamp: new Date().toISOString(),
    };

    try {
      console.log(`[WHATSAPP] Envoi document "${document.filename}" vers ${normalized}...`);
      const data = await callN8n(payload);

      if (data.success || (data.sent && data.sent > 0)) {
        console.log(`[WHATSAPP] ✅ Document envoyé à ${normalized}`);
        return { success: true, messageId: data.results?.[0]?.messageId || `n8n-doc-${Date.now()}` };
      }

      return { success: false, error: data.results?.[0]?.error || data.error || 'Échec envoi document' };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[WHATSAPP] ❌ Erreur envoi document à ${normalized}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Envoi en lot — appelle sendWhatsApp pour chaque destinataire.
   */
  static async sendBulk(recipients, options = {}) {
    const details = [];
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const result = await BotpressService.sendWhatsApp(r.phone, r.message, {
        category: r.category || options.category || 'generique',
        reference: r.reference || null,
        template: options.template || null,
        variables: r.variables || [],
        indicatifPays: r.indicatifPays || options.indicatifPays || '221',
      });

      if (result.success) {
        sent++;
        details.push({ eleveId: r.eleveId, phone: r.phone, status: 'DELIVERED', messageId: result.messageId });
      } else {
        failed++;
        details.push({ eleveId: r.eleveId, phone: r.phone, status: 'FAILED', error: result.error });
      }

      if (options.delayMs && recipients.indexOf(r) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
    }

    return { sent, failed, details };
  }

  /**
   * Enregistre un message entrant (pour tracker la fenêtre 24h).
   */
  static async recordInbound(phone, paysParDefaut = '221') {
    const normalized = normalizePhone(phone, paysParDefaut);
    if (!normalized) return;
    try {
      await sequelize.query(
        `INSERT INTO whatsapp_sessions (phone, last_inbound)
         VALUES (:phone, NOW())
         ON CONFLICT (phone) DO UPDATE SET last_inbound = NOW()`,
        { replacements: { phone: normalized } }
      );
    } catch (err) {
      console.warn('[WHATSAPP] recordInbound erreur:', err.message);
    }
  }
}
