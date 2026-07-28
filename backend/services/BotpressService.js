/**
 * WhatsApp Outbound Service (ex-BotpressService)
 * Point d'entrée unique pour tous les envois WhatsApp sortants.
 * POSTe vers le workflow n8n "WhatsApp Outbound" qui gère le routage,
 * le rate-limiting et la synchronisation du contexte Botpress.
 */

import axios from 'axios';
import { sequelize } from '../config/database.js';

const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK || process.env.BOTPRESS_WEBHOOK_URL;
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
  if (!N8N_WEBHOOK) {
    throw new Error('N8N_WHATSAPP_WEBHOOK non défini');
  }
  const { data } = await axios.post(N8N_WEBHOOK, payload, {
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
   * Envoi en lot — un seul appel à n8n qui séquence les envois.
   */
  static async sendBulk(recipients, options = {}) {
    const prepared = [];
    const skipped = [];

    for (const r of recipients) {
      const phone = normalizePhone(r.phone);
      if (!phone) {
        skipped.push({ eleveId: r.eleveId, phone: r.phone, status: 'FAILED', error: 'Numéro invalide' });
        continue;
      }
      const inSession = await isInSession(phone);
      prepared.push({
        to: phone,
        message: r.message,
        inSession,
        variables: r.variables || [],
        category: r.category || options.category || 'generique',
        reference: r.reference || null,
        eleveId: r.eleveId,
      });
    }

    if (prepared.length === 0) {
      return { sent: 0, failed: skipped.length, details: skipped };
    }

    const payload = {
      action: 'send_whatsapp',
      recipients: prepared,
      template: options.template || null,
      timestamp: new Date().toISOString(),
    };

    try {
      const data = await callN8n(payload);
      const details = [];
      let sent = 0;
      let failed = 0;

      for (const result of (data.results || [])) {
        if (result.success) {
          sent++;
          details.push({ eleveId: result.eleveId, phone: result.to, status: 'DELIVERED', messageId: result.messageId });
        } else {
          failed++;
          details.push({ eleveId: result.eleveId, phone: result.to, status: 'FAILED', error: result.error });
        }
      }

      return { sent, failed: failed + skipped.length, details: [...details, ...skipped] };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[WHATSAPP] ❌ Erreur envoi bulk:', errorMsg);
      return {
        sent: 0,
        failed: prepared.length + skipped.length,
        details: prepared.map(r => ({ eleveId: r.eleveId, phone: r.to, status: 'FAILED', error: errorMsg })).concat(skipped),
      };
    }
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
