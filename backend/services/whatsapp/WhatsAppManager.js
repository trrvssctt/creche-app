/**
 * Registre des sessions WhatsApp : une session (un Chromium) par établissement.
 * Au démarrage, restaure les sessions des établissements qui ont déjà lié un compte.
 */

import fs from 'fs';
import { WhatsAppSession, DATA_PATH } from './WhatsAppSession.js';
import * as store from './store.js';

const sessions = new Map();

export const WhatsAppManager = {
  get(tenantId) {
    if (!tenantId) return null;
    let s = sessions.get(tenantId);
    if (!s) {
      s = new WhatsAppSession(tenantId);
      sessions.set(tenantId, s);
    }
    return s;
  },

  /** Session à utiliser quand l'appelant ne connaît pas l'établissement. */
  resolve(tenantId) {
    if (tenantId) return this.get(tenantId);
    const fallback = (process.env.WA_DEFAULT_TENANT_ID || '').trim();
    if (fallback) return this.get(fallback);
    return sessions.size === 1 ? [...sessions.values()][0] : null;
  },

  async restoreAll() {
    if ((process.env.WA_ENABLED || 'true').toLowerCase() === 'false') {
      console.log('[WHATSAPP] Désactivé (WA_ENABLED=false)');
      return;
    }
    fs.mkdirSync(DATA_PATH, { recursive: true, mode: 0o700 });
    try { await store.failStaleQueued(); } catch (e) { console.warn('[WHATSAPP] failStaleQueued :', e.message); }
    let tenantIds = [];
    try { tenantIds = await store.listAccountTenantIds(); } catch (e) { console.warn('[WHATSAPP] listAccountTenantIds :', e.message); }
    const toRestore = tenantIds.filter(id => this.get(id).hasProfile());
    console.log(`[WHATSAPP] Restauration de ${toRestore.length} session(s)`);
    // Démarrage séquentiel : plusieurs Chromium en parallèle saturent un petit VPS
    for (const id of toRestore) {
      await this.get(id).start().catch(e => console.warn(`[WHATSAPP:${id}] restauration :`, e.message));
    }
  },

  async shutdownAll() {
    await Promise.allSettled([...sessions.values()].map(s => s.stop()));
  },
};
