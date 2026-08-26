/**
 * WhatsApp Outbound Service
 *
 * Route TOUS les envois via n8n (qui gère templates + texte + documents via Meta Cloud API).
 * Option WA_DIRECT_API=true pour appeler Meta directement (en prod sur AlwaysData).
 */

import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

import axios from 'axios';
import { sequelize } from '../config/database.js';
import { normaliserNumero, normalizePhone } from '../utils/phone.js';

export { normaliserNumero, normalizePhone };

// ── Config ─────────────────────────────────────────────────────────────────

const WA_TOKEN     = (process.env.Wa_token_permanent || process.env.WA_TOKEN || '').trim();
const PHONE_ID     = (process.env.WA_PHONE_ID || '1172273209313492').trim();
const API_VERSION  = 'v21.0';
const META_BASE    = `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}`;
const USE_DIRECT   = process.env.WA_DIRECT_API === 'true';

function getWebhookUrl() {
  return (process.env.N8N_WHATSAPP_WEBHOOK || process.env.BOTPRESS_WEBHOOK_URL || '').trim();
}
const N8N_TIMEOUT = parseInt(process.env.N8N_WHATSAPP_TIMEOUT || '30000', 10);

// ── Helpers ────────────────────────────────────────────────────────────────

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

async function callMetaDirect(payload) {
  if (!WA_TOKEN) throw new Error('Wa_token_permanent non défini');
  const { data } = await axios.post(`${META_BASE}/messages`, payload, {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return data;
}

async function callN8n(payload) {
  const url = getWebhookUrl();
  if (!url) throw new Error('N8N_WHATSAPP_WEBHOOK non défini');
  const { data } = await axios.post(url, payload, {
    timeout: N8N_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

function n8nSuccess(data) {
  return !!(data.success || (data.sent && data.sent > 0));
}

function n8nMsgId(data) {
  return data.results?.[0]?.messageId || data.messageId || `n8n-${Date.now()}`;
}

function n8nError(data) {
  return data.results?.[0]?.error || data.error || JSON.stringify(data);
}

// ── API publique ────────────────────────────────────────────────────────────

export class BotpressService {

  static normalizePhone = normalizePhone;
  static normaliserNumero = normaliserNumero;

  static async sendWhatsApp(phone, message, opts = {}) {
    const paysDefaut = opts.indicatifPays || '221';
    const result = normaliserNumero(String(phone || ''), paysDefaut);
    if (!result.ok) {
      return { success: false, error: `Numéro invalide (${phone}): ${result.erreur}` };
    }
    const normalized = result.e164;
    const hasTemplate = !!opts.template;
    const vars = opts.variables || [];

    // ── Template ──
    if (hasTemplate) {
      console.log(`[WHATSAPP] Envoi template "${opts.template}" vers ${normalized} (${vars.length} vars)...`);

      // Direct Meta (prod AlwaysData uniquement)
      if (USE_DIRECT && WA_TOKEN) {
        try {
          const phoneRaw = normalized.replace(/^\+/, '');
          const data = await callMetaDirect({
            messaging_product: 'whatsapp',
            to: phoneRaw,
            type: 'template',
            template: {
              name: opts.template,
              language: { code: 'fr' },
              components: vars.length > 0
                ? [{ type: 'body', parameters: vars.map(v => ({ type: 'text', text: String(v) })) }]
                : [],
            },
          });
          const msgId = data.messages?.[0]?.id || `meta-${Date.now()}`;
          console.log(`[WHATSAPP] ✅ Template envoyé à ${normalized} via Meta (wamid: ${msgId})`);
          return { success: true, messageId: msgId };
        } catch (err) {
          const detail = err.response?.data?.error?.message || err.message;
          console.error(`[WHATSAPP] ❌ Meta direct échoué:`, detail);
          if (err.response) return { success: false, error: detail };
          console.warn(`[WHATSAPP] ⚠️ Réseau Meta injoignable, fallback n8n...`);
        }
      }

      // n8n (par défaut)
      try {
        const data = await callN8n({
          action: 'send_whatsapp',
          to: normalized,
          message,
          inSession: false,
          category: opts.category || 'generique',
          reference: opts.reference || null,
          template: { name: opts.template, language: 'fr' },
          variables: vars,
          timestamp: new Date().toISOString(),
        });

        console.log(`[WHATSAPP] n8n réponse:`, JSON.stringify(data).slice(0, 300));

        if (n8nSuccess(data)) {
          console.log(`[WHATSAPP] ✅ Template envoyé à ${normalized} via n8n (id: ${n8nMsgId(data)})`);
          return { success: true, messageId: n8nMsgId(data) };
        }
        console.error(`[WHATSAPP] ❌ n8n template "${opts.template}":`, n8nError(data));
        return { success: false, error: n8nError(data) };
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        console.error(`[WHATSAPP] ❌ n8n erreur envoi template vers ${normalized}:`, errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    // ── Texte libre ──
    const inSession = await isInSession(normalized);
    if (!inSession) {
      console.warn(`[WHATSAPP] ⚠️ ${normalized} hors session 24h, pas de template → message non envoyé`);
      return { success: false, error: 'Hors session 24h — un template est requis' };
    }

    console.log(`[WHATSAPP] Envoi texte vers ${normalized} (inSession=true)...`);
    try {
      const data = await callN8n({
        action: 'send_whatsapp',
        to: normalized,
        message,
        inSession: true,
        category: opts.category || 'generique',
        reference: opts.reference || null,
        template: null,
        variables: [],
        timestamp: new Date().toISOString(),
      });

      if (n8nSuccess(data)) {
        console.log(`[WHATSAPP] ✅ Texte envoyé à ${normalized} via n8n`);
        return { success: true, messageId: n8nMsgId(data) };
      }
      return { success: false, error: n8nError(data) };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[WHATSAPP] ❌ Erreur envoi texte à ${normalized}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  static async sendDocument(phone, message, document, opts = {}) {
    const paysDefaut = opts.indicatifPays || '221';
    const result = normaliserNumero(String(phone || ''), paysDefaut);
    if (!result.ok) {
      return { success: false, error: `Numéro invalide (${phone}): ${result.erreur}` };
    }
    const normalized = result.e164;

    const hasTemplate = !!opts.template;
    const action = hasTemplate ? 'send_whatsapp' : 'send_whatsapp_document';

    console.log(`[WHATSAPP] Envoi ${hasTemplate ? 'template doc' : 'document'} "${document.filename}" vers ${normalized}...`);

    try {
      const data = await callN8n({
        action,
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
        template: hasTemplate ? { name: opts.template, language: 'fr' } : null,
        variables: opts.variables || [],
        timestamp: new Date().toISOString(),
      });

      if (n8nSuccess(data)) {
        console.log(`[WHATSAPP] ✅ Document envoyé à ${normalized}`);
        return { success: true, messageId: n8nMsgId(data) };
      }
      return { success: false, error: n8nError(data) };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[WHATSAPP] ❌ Erreur envoi document à ${normalized}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

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
