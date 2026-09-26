/**
 * WhatsApp Service — point d'entrée unique pour tous les envois WhatsApp.
 *
 * Les messages partent en arrière-plan depuis le WhatsApp de l'établissement, via un
 * WhatsApp Web piloté dans un Chromium headless (services/whatsapp/). Aucun template :
 * le texte `message` est envoyé tel quel.
 *
 * Chaque envoi est journalisé dans whatsapp_messages (statut + accusés de réception).
 */

import { normaliserNumero, normalizePhone } from '../utils/phone.js';
import { WhatsAppManager } from './whatsapp/WhatsAppManager.js';
import * as store from './whatsapp/store.js';

export { normaliserNumero, normalizePhone };

function normalize(phone, indicatifPays) {
  const result = normaliserNumero(String(phone || ''), indicatifPays || '221');
  if (!result.ok) return { error: `Numéro invalide (${phone}): ${result.erreur}` };
  return { digits: result.e164.replace(/^\+/, '') };
}

async function dispatch({ phone, message, document, opts }) {
  const { digits, error } = normalize(phone, opts.indicatifPays);
  const session = WhatsAppManager.resolve(opts.tenantId);
  const tenantId = session?.tenantId || opts.tenantId;

  if (!tenantId) {
    console.warn('[WHATSAPP] Aucun établissement identifié pour l\'envoi — message ignoré');
    return { success: false, error: 'Établissement inconnu pour l\'envoi WhatsApp' };
  }

  const dbId = await store.insertMessage({
    tenantId,
    phone: digits ? `+${digits}` : String(phone || ''),
    kind: document ? 'document' : 'text',
    body: message,
    filename: document?.filename,
    category: opts.category,
    reference: opts.reference,
    recipientName: opts.recipientName,
    createdBy: opts.createdBy,
    status: error ? store.MessageStatus.FAILED : store.MessageStatus.QUEUED,
    error,
  });
  if (error) return { success: false, messageId: dbId, error };

  const job = {
    dbId,
    phoneDigits: digits,
    kind: document ? 'document' : 'text',
    body: message,
    media: document ? {
      base64: document.base64,
      mimeType: document.mimeType || 'application/pdf',
      filename: document.filename || 'document.pdf',
    } : null,
  };

  const promise = session.enqueue(job).then(r => {
    if (r.success) console.log(`[WHATSAPP] ✅ ${job.kind} envoyé à +${digits}`);
    else console.warn(`[WHATSAPP] ❌ ${job.kind} non envoyé à +${digits} : ${r.error}`);
    return r;
  });

  // wait: false → on rend la main dès la mise en file (envoi en arrière-plan)
  if (opts.wait === false) return { success: true, queued: true, messageId: dbId };
  return promise;
}

export class WhatsAppService {

  static normalizePhone = normalizePhone;
  static normaliserNumero = normaliserNumero;

  /**
   * @param {string} phone
   * @param {string} message
   * @param {object} opts { tenantId, category, reference, indicatifPays, recipientName, createdBy, wait }
   */
  static async sendWhatsApp(phone, message, opts = {}) {
    try {
      return await dispatch({ phone, message, opts });
    } catch (err) {
      console.error('[WHATSAPP] Erreur envoi :', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * @param {object} document { base64, filename, mimeType }  (le message sert de légende)
   */
  static async sendDocument(phone, message, document, opts = {}) {
    if (!document?.base64) return { success: false, error: 'Document sans contenu (base64 requis)' };
    try {
      return await dispatch({ phone, message, document, opts });
    } catch (err) {
      console.error('[WHATSAPP] Erreur envoi document :', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Groupes WhatsApp du compte lié de l'établissement. */
  static async listGroups(tenantId) {
    const session = WhatsAppManager.resolve(tenantId);
    if (!session) throw new Error("WhatsApp n'est pas configuré pour cet établissement");
    return session.listGroups();
  }

  /**
   * Envoi dans un groupe WhatsApp (groupId = « xxx@g.us », issu de listGroups).
   * opts : { tenantId, category, reference, recipientName (nom du groupe), createdBy, wait }
   */
  static async sendToGroup(groupId, message, opts = {}) {
    try {
      if (!/^[\w-]+@g\.us$/.test(String(groupId || ''))) {
        return { success: false, error: `Identifiant de groupe invalide (${groupId})` };
      }
      const session = WhatsAppManager.resolve(opts.tenantId);
      const tenantId = session?.tenantId || opts.tenantId;
      if (!session || !tenantId) return { success: false, error: 'Établissement inconnu pour l\'envoi WhatsApp' };

      const dbId = await store.insertMessage({
        tenantId,
        phone: groupId,
        kind: 'text',
        body: message,
        category: opts.category,
        reference: opts.reference,
        recipientName: opts.recipientName,
        createdBy: opts.createdBy,
      });
      const promise = session.enqueue({ dbId, chatId: groupId, kind: 'text', body: message }).then(r => {
        if (r.success) console.log(`[WHATSAPP] ✅ message envoyé au groupe ${opts.recipientName || groupId}`);
        else console.warn(`[WHATSAPP] ❌ message non envoyé au groupe ${opts.recipientName || groupId} : ${r.error}`);
        return r;
      });
      if (opts.wait === false) return { success: true, queued: true, messageId: dbId };
      return promise;
    } catch (err) {
      console.error('[WHATSAPP] Erreur envoi groupe :', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Message d'erreur si la session ne peut pas envoyer (ni connectée ni en reconnexion), sinon null. */
  static connectionError(tenantId) {
    const session = WhatsAppManager.resolve(tenantId);
    if (!session) return "WhatsApp n'est pas configuré pour cet établissement";
    return session.canAcceptJobs() ? null : session.notConnectedMessage();
  }

  /**
   * Envoi groupé. La cadence (délais aléatoires, plafonds) est gérée par la file de la session.
   * recipients : [{ phone, message, eleveId?, recipientName?, indicatifPays? }]
   */
  static async sendBulk(recipients, options = {}) {
    const results = await Promise.all(recipients.map(r =>
      WhatsAppService.sendWhatsApp(r.phone, r.message, {
        tenantId: options.tenantId,
        category: r.category || options.category || 'generique',
        reference: r.reference || options.reference || null,
        indicatifPays: r.indicatifPays || options.indicatifPays || '221',
        recipientName: r.recipientName || null,
        createdBy: options.createdBy,
        wait: options.wait,
      }).then(res => ({ r, res }))
    ));

    const details = results.map(({ r, res }) => ({
      eleveId: r.eleveId,
      phone: r.phone,
      messageId: res.messageId,
      status: res.queued ? 'QUEUED' : (res.success ? 'SENT' : 'FAILED'),
      ...(res.success ? {} : { error: res.error }),
    }));
    return {
      sent: details.filter(d => d.status !== 'FAILED').length,
      failed: details.filter(d => d.status === 'FAILED').length,
      details,
    };
  }
}
