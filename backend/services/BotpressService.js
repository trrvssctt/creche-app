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

function getWebhookUrl() {
  return (process.env.N8N_WHATSAPP_WEBHOOK || process.env.BOTPRESS_WEBHOOK_URL || '').trim();
}
const N8N_TIMEOUT = parseInt(process.env.N8N_WHATSAPP_TIMEOUT || '30000', 10);
const DEFAULT_CC = process.env.WHATSAPP_DEFAULT_CC || '221';

// ── Utilitaires ─────────────────────────────────────────────────────────────

export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('7')) d = DEFAULT_CC + d;
  if (d.startsWith('221221')) d = d.slice(3);
  if (d.length === 8 && /^[0-9]{8}$/.test(d)) d = DEFAULT_CC + d;
  if (d.length < 10 || d.length > 15) return null;
  return '+' + d;
}

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

  /**
   * Envoie un message texte WhatsApp.
   */
  static async sendWhatsApp(phone, message, opts = {}) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return { success: false, error: `Numéro invalide: ${phone}` };
    }

    const inSession = await isInSession(normalized);

    const payload = {
      action: 'send_whatsapp',
      to: normalized,
      message,
      inSession,
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
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return { success: false, error: `Numéro invalide: ${phone}` };
    }

    const inSession = await isInSession(normalized);

    if (!inSession && !document.url) {
      return {
        success: false,
        error: 'Hors fenêtre 24h : une URL publique du document est requise (pas de base64)',
      };
    }

    const payload = {
      action: 'send_whatsapp_document',
      to: normalized,
      message,
      inSession,
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
  static async recordInbound(phone) {
    const normalized = normalizePhone(phone);
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
