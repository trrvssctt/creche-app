/**
 * Une session WhatsApp = un établissement = un Chromium headless (whatsapp-web.js).
 *
 * Le navigateur ouvre web.whatsapp.com en arrière-plan ; les messages sont envoyés en
 * appelant les fonctions internes de WhatsApp Web (comme le bouton « Envoyer »).
 * Voir RAPPORT_EMULATION_WHATSAPP.md pour le principe et les protections reprises ici.
 *
 * Machine à états :
 *   DISCONNECTED → INITIALIZING → QR_READY → AUTHENTICATING → READY
 *   + RECONNECTING (backoff), LOGGED_OUT (rescan requis), RESTRICTED (TOS/PROXY block)
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import wwebjs from 'whatsapp-web.js';
import { resolveWebVersionOptions } from './webVersion.js';
import { SESSION_MARKER, killOrphanChromium, removeSingletonLocks } from './chromiumHygiene.js';
import { breakerFailures, breakerPauseMs, dailyCapFor, randomDelayMs } from './pacing.js';
import * as store from './store.js';

const { Client, LocalAuth, MessageMedia } = wwebjs;

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_PATH = path.resolve(process.env.WA_DATA_PATH || path.join(BACKEND_DIR, 'wa-data'));

export const Status = {
  DISCONNECTED: 'DISCONNECTED',
  INITIALIZING: 'INITIALIZING',
  QR_READY: 'QR_READY',
  AUTHENTICATING: 'AUTHENTICATING',
  READY: 'READY',
  RECONNECTING: 'RECONNECTING',
  LOGGED_OUT: 'LOGGED_OUT',
  RESTRICTED: 'RESTRICTED',
};

// États où les messages restent en file en attendant le retour de la connexion
const TRANSIENT = new Set([Status.INITIALIZING, Status.AUTHENTICATING, Status.RECONNECTING]);
const RESTRICTION_STATES = new Set(['TOS_BLOCK', 'SMB_TOS_BLOCK', 'PROXYBLOCK']);

// Délai max d'un appel au navigateur. Un VPS modeste met plus de temps à charger WhatsApp Web.
const PROTOCOL_TIMEOUT_MS = parseInt(process.env.WA_PROTOCOL_TIMEOUT_MS || '', 10) || 300_000;
const WATCHDOG_INTERVAL_MS = 60_000;
const WATCHDOG_TIMEOUT_MS = 10_000;
const NAVIGATION_GRACE_MS = 60_000;
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60 * 60 * 1000;
const STABLE_RESET_MS = 5 * 60 * 1000;
const QUEUE_TTL_MS = 30 * 60 * 1000;
const ONBOARDING_WATCH_MS = 10 * 60 * 1000;

// Les builds WhatsApp Web 2.3000.x récents ont renommé `_serialized` en `$1` : lire les deux.
export const readWid = w => {
  if (!w) return null;
  if (typeof w === 'string') return w;
  return w._serialized ?? w.$1 ?? (w.user && w.server ? `${w.user}@${w.server}` : null);
};

/**
 * Correctifs de compatibilité whatsapp-web.js 1.34.7 ↔ WhatsApp Web 2.3000.x récent,
 * exécutés dans la page (evaluateOnNewDocument + à chaque « ready »).
 *
 * 1. MsgKey stocke son identifiant sérialisé dans `$1` au lieu de `_serialized`.
 *    La librairie relit le message envoyé via `newMsgKey._serialized` → undefined.
 *    → on redonne un accesseur `_serialized` au prototype.
 *
 * 2. processMediaData renvoie le modèle MediaData, que sendMessage recopie par
 *    `...mediaOptions` dans le message. Ses champs internes (`__x_id`, `mirror`…) font
 *    échouer la création du Msg : « Data passed to getter must include an id property ».
 *    → on renvoie un objet de données simple (toJSON + champs posés après l'upload).
 *
 * Vérifié en continu : WhatsApp Web se recharge et la librairie réinjecte window.WWebJS.
 */
function installWidCompat() {
  if (window.__gestockWaCompat) return;
  window.__gestockWaCompat = true;

  const UPLOAD_FIELDS = [
    'clientUrl', 'deprecatedMms3Url', 'directPath', 'mediaKey', 'mediaKeyTimestamp',
    'filehash', 'encFilehash', 'uploadhash', 'size', 'streamingSidecar',
    'firstFrameSidecar', 'mediaHandle',
  ];
  const read = (model, key) => {
    try { if (model[key] !== undefined) return model[key]; } catch { /* getter */ }
    try { return typeof model.get === 'function' ? model.get(key) : undefined; } catch { return undefined; }
  };

  const patchMsgKey = () => {
    try {
      const MsgKey = window.require && window.require('WAWebMsgKey');
      if (!MsgKey) return;
      if (!('_serialized' in MsgKey.prototype)) {
        Object.defineProperty(MsgKey.prototype, '_serialized', {
          get() { return this.$1; },
          configurable: true,
        });
      }
    } catch { /* module pas encore chargé */ }
  };

  const patchMedia = () => {
    const W = window.WWebJS;
    if (!W || typeof W.processMediaData !== 'function' || W.processMediaData.__gestockPatched) return;
    const original = W.processMediaData;
    const patched = async (...args) => {
      const md = await original(...args);
      if (!md || typeof md.toJSON !== 'function') return md;
      const plain = { ...md.toJSON() };
      for (const key of UPLOAD_FIELDS) {
        const v = read(md, key);
        if (v !== undefined) plain[key] = v;
      }
      return plain;
    };
    patched.__gestockPatched = true;
    W.processMediaData = patched;
  };

  const tick = () => { patchMsgKey(); patchMedia(); };
  tick();
  setInterval(tick, 1000);
}

const isTransportError = msg => /Target closed|Protocol error|Session closed|detached Frame|Execution context was destroyed/i.test(msg || '');
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} : délai dépassé`)), ms)),
]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Le PID du verrou appartient-il encore à un processus Node vivant ? (évite un faux positif
// si le PID a été réattribué à un autre programme après un redémarrage du serveur)
function isLiveNodeProcess(pid) {
  try { process.kill(pid, 0); } catch (e) { if (e.code !== 'EPERM') return false; }
  try { return /node/i.test(fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')); } catch { return true; }
}

export class WhatsAppSession extends EventEmitter {
  constructor(tenantId) {
    super();
    this.tenantId = tenantId;
    this.sessionId = `t-${tenantId}`;
    this.profileDir = path.join(DATA_PATH, `session-${this.sessionId}`);

    this.status = Status.DISCONNECTED;
    this.qr = null;            // data-URL du QR courant
    this.pairingCode = null;
    this.info = null;          // { phone, pushname }
    this.lastError = null;
    this.restriction = null;

    this.client = null;
    this.generation = 0;       // ignore les événements d'un client précédent
    this.initInFlight = false;
    this.wantRunning = false;

    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.nextReconnectAt = null;
    this.readySince = 0;
    this.lastNavigationAt = 0;
    this.watchdogTimer = null;
    this.watchdogFailures = 0;
    this.onboardingTimer = null;

    this.queue = [];
    this.processing = false;
    this.lastSentAt = 0;
    this.consecutiveFailures = 0;
    this.pausedUntil = 0;
    this.idCache = new Map();
  }

  hasProfile() {
    return fs.existsSync(this.profileDir);
  }

  snapshot() {
    return {
      status: this.status,
      qr: this.status === Status.QR_READY ? this.qr : null,
      pairingCode: this.status === Status.QR_READY ? this.pairingCode : null,
      phone: this.info?.phone || null,
      pushname: this.info?.pushname || null,
      lastError: this.lastError,
      restriction: this.restriction,
      nextReconnectAt: this.nextReconnectAt,
      queueLength: this.queue.length,
      pausedUntil: this.pausedUntil > Date.now() ? new Date(this.pausedUntil).toISOString() : null,
    };
  }

  _log(...args) { console.log(`[WHATSAPP:${this.tenantId}]`, ...args); }
  _warn(...args) { console.warn(`[WHATSAPP:${this.tenantId}]`, ...args); }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this._log(`état → ${status}`);
    this.emit('status', this.snapshot());
    if (status === Status.READY) this._processQueue();
    if (!TRANSIENT.has(status) && status !== Status.READY) this._failQueue(this.notConnectedMessage());
  }

  notConnectedMessage() {
    if (this.status === Status.RESTRICTED) return `Compte WhatsApp restreint (${this.restriction})`;
    if (this.status === Status.LOGGED_OUT) return 'WhatsApp délié — rescanner le QR code dans Communication WhatsApp';
    return "WhatsApp n'est pas connecté — scanner le QR code dans Communication WhatsApp";
  }

  // ── Cycle de vie ──────────────────────────────────────────────────────────

  async start() {
    this.wantRunning = true;
    // Un seul Chromium par profil : deux navigateurs sur le même profil corrompent la session
    if (this.initInFlight) return this.snapshot();
    if (this.client && ![Status.DISCONNECTED, Status.LOGGED_OUT, Status.RESTRICTED].includes(this.status)) {
      return this.snapshot();
    }
    this._clearReconnect();
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.restriction = null;
    await this._init();
    return this.snapshot();
  }

  async _init() {
    const gen = ++this.generation;
    this.qr = null;
    this.pairingCode = null;
    this._setStatus(Status.INITIALIZING);
    const token = {};
    this.initToken = token;
    this.initInFlight = true;

    const t0 = Date.now();
    try {
      this._acquireProcessLock();
      const versionOpts = await resolveWebVersionOptions();
      if (gen !== this.generation) return; // arrêté ou relancé entre-temps
      await killOrphanChromium(this.sessionId);
      if (gen !== this.generation) return;
      removeSingletonLocks(this.profileDir);

      const client = new Client({
        authStrategy: new LocalAuth({ clientId: this.sessionId, dataPath: DATA_PATH }),
        puppeteer: {
          headless: true,
          executablePath: process.env.WA_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu',
            ...(process.env.WA_PROXY ? [`--proxy-server=${process.env.WA_PROXY}`] : []),
            `${SESSION_MARKER}${this.sessionId}`,
          ],
          handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
          protocolTimeout: PROTOCOL_TIMEOUT_MS,
        },
        ...versionOpts,
        evalOnNewDoc: installWidCompat,
        authTimeoutMs: parseInt(process.env.WA_AUTH_TIMEOUT_MS || '', 10) || 180_000,
        deviceName: process.env.WA_DEVICE_NAME || 'GeStock Pro',
        browserName: 'Chrome',
      });
      this.client = client;
      this._bindClientEvents(client, gen);

      await client.initialize();
      if (gen !== this.generation) return;
      this._log(`navigateur prêt en ${Math.round((Date.now() - t0) / 1000)} s`);
      this._bindDeathDetection(client, gen);
      this._guardReinjection(client, gen);
    } catch (err) {
      if (gen !== this.generation) return;
      const msg = err?.message || String(err);
      this._warn('échec initialisation :', msg);
      this.lastError = msg;
      await this._teardown();
      this._scheduleReconnect(`initialisation : ${msg}`);
    } finally {
      if (this.initToken === token) this.initInFlight = false;
    }
  }

  _bindClientEvents(client, gen) {
    const live = () => gen === this.generation;

    client.on('qr', async qr => {
      if (!live()) return;
      try { this.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); } catch { this.qr = null; }
      // Un QR affiché = pas de session restaurable : ne pas boucler en reconnexion
      this.reconnectAttempts = 0;
      this._setStatus(Status.QR_READY);
      this.emit('status', this.snapshot());
    });

    client.on('code', code => {
      if (!live()) return;
      this.pairingCode = code;
      this.emit('status', this.snapshot());
    });

    client.on('authenticated', () => {
      if (!live()) return;
      this.qr = null;
      this.pairingCode = null;
      this._setStatus(Status.AUTHENTICATING);
    });

    client.on('auth_failure', msg => {
      if (!live()) return;
      this.lastError = `Échec d'authentification : ${msg}`;
      this._onLoggedOut();
    });

    client.on('ready', async () => {
      if (!live()) return;
      const me = client.info || {};
      this.info = { phone: me.wid?.user || readWid(me.wid)?.split('@')[0] || null, pushname: me.pushname || null };
      try { await client.pupPage?.evaluate(installWidCompat); } catch { /* déjà installé via evalOnNewDoc */ }
      this.readySince = Date.now();
      this.lastError = null;
      this.watchdogFailures = 0;
      try { await store.upsertAccount(this.tenantId, this.info); } catch (e) { this._warn('upsertAccount :', e.message); }
      this._startWatchdog();
      this._startOnboardingWatcher();
      this._setStatus(Status.READY);
    });

    client.on('change_state', state => {
      if (!live()) return;
      if (RESTRICTION_STATES.has(state)) {
        this.restriction = state;
        this.lastError = `WhatsApp a restreint ce compte ou cette IP (${state})`;
        this._teardown().then(() => this._setStatus(Status.RESTRICTED));
      }
    });

    client.on('disconnected', reason => {
      if (!live()) return;
      this._warn('déconnecté :', reason);
      if (reason === 'LOGOUT' || reason === 'UNPAIRED' || reason === 'UNPAIRED_IDLE') {
        this._onLoggedOut();
      } else {
        this._onDead(`déconnexion (${reason})`);
      }
    });

    client.on('message_ack', (msg, ack) => {
      if (!live()) return;
      const id = readWid(msg?.id);
      if (id) store.updateAck(id, ack).catch(() => {});
    });
  }

  /**
   * whatsapp-web.js réinjecte son code à chaque rechargement de page (framenavigated) sans
   * intercepter les erreurs : un délai dépassé devient un rejet non géré qui arrête tout le
   * processus Node (et fait « sauter » le QR code). On intercepte ici les réinjections.
   */
  _guardReinjection(client, gen) {
    const original = client.inject.bind(client);
    client.inject = async (...args) => {
      try {
        return await original(...args);
      } catch (err) {
        if (gen !== this.generation) return;
        const msg = err?.message || String(err);
        this._warn('réinjection après rechargement de WhatsApp Web échouée :', msg);
        // Une page figée ne se rétablira pas seule : on relance proprement la session
        this._onDead(`réinjection : ${msg}`);
      }
    };
  }

  /**
   * Un seul processus par session : deux backends (ex. deux apps PM2) sur le même dossier
   * wa-data tueraient mutuellement leurs Chromium et corrompraient la session.
   */
  _acquireProcessLock() {
    const lockFile = path.join(DATA_PATH, `${this.sessionId}.lock`);
    fs.mkdirSync(DATA_PATH, { recursive: true, mode: 0o700 });
    let pid = null;
    try { pid = parseInt(fs.readFileSync(lockFile, 'utf8'), 10); } catch { /* pas de verrou */ }
    if (pid && pid !== process.pid && isLiveNodeProcess(pid)) {
      throw new Error(`Session WhatsApp déjà utilisée par un autre processus (PID ${pid}). Un seul backend doit tourner sur ce dossier : vérifier « pm2 ls ».`);
    }
    fs.writeFileSync(lockFile, String(process.pid), { mode: 0o600 });
  }

  _bindDeathDetection(client, gen) {
    const dead = why => { if (gen === this.generation) this._onDead(why); };
    client.pupBrowser?.on('disconnected', () => dead('navigateur fermé'));
    client.pupPage?.on('error', () => dead('page plantée'));
    client.pupPage?.on('close', () => dead('page fermée'));
    client.pupPage?.on('framenavigated', frame => {
      if (frame === client.pupPage.mainFrame()) this.lastNavigationAt = Date.now();
    });
  }

  async _onDead(why) {
    if (!this.client && this.status === Status.RECONNECTING) return;
    this._warn('session morte :', why);
    this.lastError = why;
    await this._teardown();
    if (this.wantRunning) this._scheduleReconnect(why);
    else this._setStatus(Status.DISCONNECTED);
  }

  async _onLoggedOut() {
    await this._teardown();
    // Profil inutilisable : on le supprime pour repartir sur un QR propre
    try { fs.rmSync(this.profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { await store.deleteAccount(this.tenantId); } catch { /* ignore */ }
    this.info = null;
    this._setStatus(Status.LOGGED_OUT);
  }

  _scheduleReconnect(reason) {
    this._clearReconnect();
    // Backoff exponentiel + jitter ; remis à zéro après 5 min de stabilité
    if (this.readySince && Date.now() - this.readySince > STABLE_RESET_MS) this.reconnectAttempts = 0;
    this.readySince = 0;
    const base = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    const delay = Math.round(base / 2 + Math.random() * base / 2);
    this.reconnectAttempts++;
    this.nextReconnectAt = new Date(Date.now() + delay).toISOString();
    this._log(`reconnexion dans ${Math.round(delay / 1000)} s (tentative ${this.reconnectAttempts}) — ${reason}`);
    this._setStatus(Status.RECONNECTING);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.nextReconnectAt = null;
      if (this.wantRunning) this._init();
    }, delay);
  }

  _clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.nextReconnectAt = null;
  }

  async _teardown() {
    this.generation++;
    this._stopWatchdog();
    this._stopOnboardingWatcher();
    const client = this.client;
    this.client = null;
    if (!client) return;
    const proc = client.pupBrowser?.process?.();
    try { await withTimeout(client.destroy(), 15_000, 'destroy'); } catch (e) { this._warn('destroy :', e.message); }
    // Navigateur figé : on force
    try { if (proc && proc.exitCode === null) proc.kill('SIGKILL'); } catch { /* ignore */ }
    await killOrphanChromium(this.sessionId);
  }

  /** Arrête le navigateur en gardant la session (pas de rescan au prochain démarrage). */
  async stop() {
    this.wantRunning = false;
    this._clearReconnect();
    await this._teardown();
    this._setStatus(Status.DISCONNECTED);
  }

  /** Délie l'appareil du téléphone et supprime le profil. */
  async logout() {
    this.wantRunning = false;
    this._clearReconnect();
    const client = this.client;
    if (client && this.status === Status.READY) {
      try { await withTimeout(client.logout(), 20_000, 'logout'); } catch (e) { this._warn('logout :', e.message); }
    }
    await this._onLoggedOut();
    this._setStatus(Status.DISCONNECTED);
  }

  /** Code d'appairage à 8 caractères (« Lier avec un numéro de téléphone »). */
  async requestPairingCode(phoneDigits) {
    if (this.status !== Status.QR_READY || !this.client) {
      throw new Error('La session doit afficher un QR code avant de demander un code d\'appairage');
    }
    // La page non appairée se recharge ~toutes les 20 s : plusieurs tentatives courtes
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        const code = await withTimeout(this.client.requestPairingCode(phoneDigits, true), 15_000, 'code d\'appairage');
        this.pairingCode = code;
        this.emit('status', this.snapshot());
        return code;
      } catch (e) {
        lastErr = e;
        await sleep(1500);
        if (!this.client) break;
      }
    }
    throw lastErr || new Error('Impossible d\'obtenir un code d\'appairage');
  }

  // ── Groupes ───────────────────────────────────────────────────────────────

  /**
   * Groupes WhatsApp du compte lié (lus directement dans la collection Chat de la page).
   * canSend = false pour un groupe « annonces » dont on n'est pas administrateur.
   */
  async listGroups() {
    if (this.status !== Status.READY || !this.client) throw new Error(this.notConnectedMessage());
    const groups = await withTimeout(this.client.pupPage.evaluate(() => {
      const ser = w => (w ? (w._serialized ?? w.$1 ?? String(w)) : null);
      const me = window.require('WAWebUserPrefsMeUser');
      const mePn = me.getMaybeMePnUser?.();
      const meLid = me.getMaybeMeLidUser?.();
      // Les participants peuvent être en numéro (PN) ou en identifiant anonyme (LID)
      const isMe = w => {
        try {
          return !!w && ((mePn && w.user === mePn.user && w.server === mePn.server)
            || (meLid && w.user === meLid.user && w.server === meLid.server)
            || (me.isMePrimary ? me.isMePrimary(w) : false));
        } catch { return false; }
      };
      return window.require('WAWebCollections').Chat.getModelsArray()
        .filter(c => c.id?.server === 'g.us' && !c.isReadOnly)
        .map(c => {
          const meta = c.groupMetadata;
          const participants = meta?.participants?.getModelsArray?.() || [];
          const mine = participants.find(p => isMe(p.id));
          const announce = !!meta?.announce;
          return {
            id: ser(c.id),
            name: c.formattedTitle || c.name || meta?.subject || ser(c.id),
            participants: participants.length || null,
            announce,
            canSend: !announce || !!(mine && (mine.isAdmin || mine.isSuperAdmin)),
            lastActivity: c.t ? c.t * 1000 : null,
          };
        });
    }), 20_000, 'liste des groupes');
    return groups.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
  }

  // ── Watchdog ──────────────────────────────────────────────────────────────

  _startWatchdog() {
    this._stopWatchdog();
    this.watchdogTimer = setInterval(() => this._probe(), WATCHDOG_INTERVAL_MS);
    this.watchdogTimer.unref?.();
  }

  _stopWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  async _probe() {
    const client = this.client;
    if (!client || this.status !== Status.READY) return;
    // Rechargement normal de WhatsApp Web (mise à jour du service worker…) : délai de grâce
    if (Date.now() - this.lastNavigationAt < NAVIGATION_GRACE_MS) return;
    let ok = false;
    try {
      const state = await withTimeout(client.getState(), WATCHDOG_TIMEOUT_MS, 'getState');
      if (RESTRICTION_STATES.has(state)) {
        client.emit('change_state', state);
        return;
      }
      ok = state === 'CONNECTED';
    } catch { ok = false; }
    if (ok) { this.watchdogFailures = 0; return; }
    this.watchdogFailures++;
    this._warn(`watchdog : échec ${this.watchdogFailures}/2`);
    if (this.watchdogFailures >= 2) this._onDead('page figée (watchdog)');
  }

  // Fenêtre « Quoi de neuf ? » non fermée → appareil délié quelques minutes plus tard
  _startOnboardingWatcher() {
    this._stopOnboardingWatcher();
    const until = Date.now() + ONBOARDING_WATCH_MS;
    this.onboardingTimer = setInterval(async () => {
      if (Date.now() > until || !this.client?.pupPage) return this._stopOnboardingWatcher();
      try {
        await this.client.pupPage.evaluate(() => {
          const labels = /^(continue|continuer|ok|got it|compris|j'ai compris)$/i;
          document.querySelectorAll('[role="dialog"] button, [data-animate-modal-popup] button').forEach(b => {
            if (labels.test((b.innerText || '').trim())) b.click();
          });
        });
      } catch { /* page en rechargement */ }
    }, 5000);
    this.onboardingTimer.unref?.();
  }

  _stopOnboardingWatcher() {
    if (this.onboardingTimer) clearInterval(this.onboardingTimer);
    this.onboardingTimer = null;
  }

  // ── File d'envoi ──────────────────────────────────────────────────────────

  canAcceptJobs() {
    return this.status === Status.READY || TRANSIENT.has(this.status);
  }

  /**
   * Met un message en file. Résout avec { success, messageId, waMessageId } ou { success:false, error }.
   * job = { dbId, phoneDigits, kind: 'text'|'document', body, media?: {base64, mimeType, filename}, caption }
   */
  enqueue(job) {
    return new Promise(resolve => {
      if (!this.canAcceptJobs()) {
        const error = this.notConnectedMessage();
        store.markFailed(job.dbId, error).catch(() => {});
        return resolve({ success: false, messageId: job.dbId, error });
      }
      this.queue.push({ ...job, enqueuedAt: Date.now(), resolve });
      this._processQueue();
    });
  }

  _failQueue(error) {
    const jobs = this.queue.splice(0);
    for (const job of jobs) this._finish(job, { success: false, error });
  }

  _finish(job, result) {
    const done = { messageId: job.dbId, ...result };
    const p = result.success
      ? store.markSent(job.dbId, { chatId: result.chatId, waMessageId: result.waMessageId, ack: result.ack })
      : store.markFailed(job.dbId, result.error);
    p.catch(e => this._warn('journal message :', e.message));
    job.resolve(done);
  }

  async _processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length && this.status === Status.READY) {
        // Expiration des messages restés trop longtemps en file
        const now = Date.now();
        for (const job of this.queue.filter(j => now - j.enqueuedAt > QUEUE_TTL_MS)) {
          this.queue.splice(this.queue.indexOf(job), 1);
          this._finish(job, { success: false, error: 'Expiré en file d\'attente (WhatsApp indisponible trop longtemps)' });
        }
        if (!this.queue.length) break;

        // Disjoncteur
        if (this.pausedUntil > Date.now()) {
          await sleep(Math.min(this.pausedUntil - Date.now(), 30_000));
          continue;
        }

        // Plafond journalier progressif
        const account = await store.getAccount(this.tenantId).catch(() => null);
        const cap = dailyCapFor(account?.linked_at);
        if (cap !== null) {
          const sentToday = await store.countSentToday(this.tenantId).catch(() => 0);
          if (sentToday >= cap) {
            this._failQueue(`Plafond journalier atteint (${cap} messages/jour) — protection anti-bannissement`);
            break;
          }
        }

        // Délai aléatoire entre deux messages (le premier part immédiatement)
        const wait = this.lastSentAt ? this.lastSentAt + randomDelayMs() - Date.now() : 0;
        if (wait > 0) await sleep(wait);
        if (this.status !== Status.READY) break;

        const job = this.queue.shift();
        if (!job) break;
        const result = await this._sendNow(job);
        this.lastSentAt = Date.now();
        if (result.requeued) break;

        if (result.success) {
          this.consecutiveFailures = 0;
        } else if (result.whatsappSide) {
          this.consecutiveFailures++;
          if (this.consecutiveFailures >= breakerFailures()) {
            this.pausedUntil = Date.now() + breakerPauseMs();
            this.consecutiveFailures = 0;
            this._warn(`disjoncteur : ${breakerFailures()} échecs consécutifs, pause jusqu'à ${new Date(this.pausedUntil).toLocaleTimeString('fr-FR')}`);
          }
        }
        this._finish(job, result);
      }
    } catch (e) {
      this._warn('file d\'envoi :', e.message);
    } finally {
      this.processing = false;
      // Relancer si des messages sont arrivés entre-temps ou après une pause
      if (this.queue.length && this.status === Status.READY) setTimeout(() => this._processQueue(), 1000);
    }
  }

  async _resolveChatId(phoneDigits, { fresh = false } = {}) {
    const key = `${phoneDigits}@c.us`;
    if (!fresh && this.idCache.has(key)) return this.idCache.get(key);
    const wid = await this.client.getNumberId(phoneDigits);
    const id = readWid(wid);
    if (!id) return null; // numéro sans WhatsApp
    this.idCache.set(key, id);
    return id;
  }

  async _sendNow(job) {
    const client = this.client;
    if (!client) return { success: false, error: this.notConnectedMessage() };

    let content;
    const opts = { sendSeen: false };
    if (job.kind === 'document') {
      content = new MessageMedia(job.media.mimeType || 'application/pdf', job.media.base64, job.media.filename || 'document.pdf');
      opts.sendMediaAsDocument = true;
      opts.caption = job.body || job.caption || undefined;
    } else {
      content = job.body;
    }

    const attempt = async chatId => {
      try { (await client.getChatById(chatId))?.sendStateTyping?.(); } catch { /* facultatif */ }
      await sleep(600 + Math.floor(Math.random() * 1200));
      const msg = await client.sendMessage(chatId, content, opts);
      if (!msg) throw new Error('Aucun message renvoyé : envoi incertain');
      return msg;
    };

    let chatId;
    try {
      // Groupe : identifiant déjà connu (xxx@g.us), pas de résolution de numéro
      chatId = job.chatId || await this._resolveChatId(job.phoneDigits);
      if (!chatId) return { success: false, error: `Le numéro +${job.phoneDigits} n'a pas de compte WhatsApp` };
      const msg = await attempt(chatId);
      return { success: true, chatId, waMessageId: readWid(msg.id), ack: msg.ack };
    } catch (err) {
      const message = err?.message || String(err);
      if (isTransportError(message)) {
        // Mort du transport : on remet le message en tête de file (2 fois max) et on reconnecte
        this._onDead(`transport : ${message}`);
        job.transportRetries = (job.transportRetries || 0) + 1;
        if (job.transportRetries <= 2) {
          this.queue.unshift(job);
          return { requeued: true };
        }
        return { success: false, error: `Connexion WhatsApp perdue pendant l'envoi : ${message}` };
      }
      if (message.includes('No LID for user') && !job.chatId) {
        try {
          const fresh = await this._resolveChatId(job.phoneDigits, { fresh: true });
          if (fresh && fresh !== chatId) {
            const msg = await attempt(fresh);
            return { success: true, chatId: fresh, waMessageId: readWid(msg.id), ack: msg.ack };
          }
        } catch (e2) {
          return { success: false, whatsappSide: true, error: e2?.message || String(e2) };
        }
      }
      return { success: false, whatsappSide: true, error: message };
    }
  }
}
