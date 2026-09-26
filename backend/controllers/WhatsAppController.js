import { WhatsAppManager } from '../services/whatsapp/WhatsAppManager.js';
import { WhatsAppService, normaliserNumero } from '../services/WhatsAppService.js';
import * as store from '../services/whatsapp/store.js';
import { dailyCapFor } from '../services/whatsapp/pacing.js';

const MAX_BULK = 500;

async function statusPayload(tenantId) {
  const session = WhatsAppManager.get(tenantId);
  const [account, sentToday] = await Promise.all([
    store.getAccount(tenantId).catch(() => null),
    store.countSentToday(tenantId).catch(() => 0),
  ]);
  return {
    ...session.snapshot(),
    linkedAt: account?.linked_at || null,
    sentToday,
    dailyCap: dailyCapFor(account?.linked_at),
  };
}

export class WhatsAppController {

  // GET /whatsapp/status
  static async status(req, res) {
    try {
      return res.json(await statusPayload(req.user.tenantId));
    } catch (err) {
      return res.status(500).json({ error: 'StatusError', message: err.message });
    }
  }

  // POST /whatsapp/connect — démarre le navigateur (QR code si pas encore lié)
  static async connect(req, res) {
    try {
      const session = WhatsAppManager.get(req.user.tenantId);
      // Pas d'await : l'initialisation de Chromium prend 10 à 60 s, le front interroge /status
      session.start().catch(e => console.warn('[WHATSAPP] connect :', e.message));
      return res.json(await statusPayload(req.user.tenantId));
    } catch (err) {
      return res.status(500).json({ error: 'ConnectError', message: err.message });
    }
  }

  // POST /whatsapp/pairing-code { phone } — alternative au QR (admin sur le même téléphone)
  static async pairingCode(req, res) {
    try {
      const result = normaliserNumero(String(req.body?.phone || ''), req.body?.indicatifPays || '221');
      if (!result.ok) return res.status(400).json({ error: 'BadRequest', message: result.erreur });
      const session = WhatsAppManager.get(req.user.tenantId);
      const code = await session.requestPairingCode(result.e164.replace(/^\+/, ''));
      return res.json({ code });
    } catch (err) {
      return res.status(409).json({ error: 'PairingError', message: err.message });
    }
  }

  // POST /whatsapp/disconnect — ferme le navigateur, garde la liaison
  static async disconnect(req, res) {
    try {
      await WhatsAppManager.get(req.user.tenantId).stop();
      return res.json(await statusPayload(req.user.tenantId));
    } catch (err) {
      return res.status(500).json({ error: 'DisconnectError', message: err.message });
    }
  }

  // POST /whatsapp/logout — délie l'appareil (rescan obligatoire ensuite)
  static async logout(req, res) {
    try {
      await WhatsAppManager.get(req.user.tenantId).logout();
      return res.json(await statusPayload(req.user.tenantId));
    } catch (err) {
      return res.status(500).json({ error: 'LogoutError', message: err.message });
    }
  }

  // POST /whatsapp/send { phone, message, recipientName?, category?, indicatifPays? }
  // Attend l'envoi réel (jusqu'à ~25 s) puis rend la main ; au-delà le message continue en arrière-plan.
  static async send(req, res) {
    try {
      const { phone, message, recipientName, category, reference, indicatifPays } = req.body || {};
      if (!phone || !message?.trim()) {
        return res.status(400).json({ error: 'BadRequest', message: 'phone et message sont obligatoires.' });
      }
      const waError = WhatsAppService.connectionError(req.user.tenantId);
      if (waError) return res.status(409).json({ error: 'WhatsAppNotConnected', message: waError });
      const pending = WhatsAppService.sendWhatsApp(phone, message, {
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
        recipientName, category: category || 'manuel', reference, indicatifPays,
      });
      const result = await Promise.race([pending, new Promise(r => setTimeout(() => r(null), 25_000))]);
      if (!result) return res.status(202).json({ success: true, queued: true });
      if (!result.success) return res.status(422).json({ success: false, messageId: result.messageId, message: result.error });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'SendError', message: err.message });
    }
  }

  // POST /whatsapp/send-bulk { messages: [{ phone, message, recipientName? }], category? }
  // Met tout en file et répond immédiatement ; suivi via GET /whatsapp/messages?ids=...
  static async sendBulk(req, res) {
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const valid = messages.filter(m => m?.phone && m?.message?.trim());
      if (!valid.length) return res.status(400).json({ error: 'BadRequest', message: 'Aucun message valide.' });
      if (valid.length > MAX_BULK) return res.status(400).json({ error: 'BadRequest', message: `Maximum ${MAX_BULK} messages par envoi.` });
      const waError = WhatsAppService.connectionError(req.user.tenantId);
      if (waError) return res.status(409).json({ error: 'WhatsAppNotConnected', message: waError });

      const result = await WhatsAppService.sendBulk(valid, {
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
        category: req.body?.category || 'groupe',
        wait: false,
      });
      return res.status(202).json(result);
    } catch (err) {
      return res.status(500).json({ error: 'SendError', message: err.message });
    }
  }

  // GET /whatsapp/groups — groupes du compte WhatsApp lié
  static async groups(req, res) {
    try {
      const groups = await WhatsAppService.listGroups(req.user.tenantId);
      return res.json({ groups });
    } catch (err) {
      return res.status(409).json({ error: 'GroupsError', message: err.message });
    }
  }

  // GET /whatsapp/messages?limit=&offset=&status=&ids=a,b
  static async messages(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean).slice(0, MAX_BULK) : undefined;
      const { rows, total } = await store.listMessages(req.user.tenantId, {
        limit: ids ? ids.length : limit, offset, status: req.query.status || undefined, ids,
      });
      return res.json({ messages: rows, total });
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }
}
