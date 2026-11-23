/**
 * Diagnostic réseau WhatsApp Web (à lancer sur le serveur, depuis backend/) :
 *
 *   node scripts/wa-diagnostic.mjs
 *
 * N'utilise PAS la session de l'établissement : profil Chromium temporaire, supprimé à la fin.
 * Vérifie DNS (IPv4/IPv6), HTTPS, horloge, puis ouvre WhatsApp Web et suit le WebSocket
 * vers les serveurs WhatsApp (celui qui manque quand on voit « sendIq called before startComms »).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import dns from 'dns/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const puppeteer = require(require.resolve('puppeteer', { paths: [require.resolve('whatsapp-web.js')] }));

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`délai ${ms} ms dépassé`)), ms))]);

// ── 1. DNS ──────────────────────────────────────────────────────────────────
log('── DNS');
for (const host of ['web.whatsapp.com', 'g.whatsapp.net', 'static.whatsapp.net', 'mmg.whatsapp.net']) {
  const v4 = await dns.resolve4(host).catch(e => [`erreur ${e.code}`]);
  const v6 = await dns.resolve6(host).catch(e => [`erreur ${e.code}`]);
  log(`${host.padEnd(22)} IPv4: ${v4.join(', ')}   IPv6: ${v6.join(', ')}`);
}

// ── 2. HTTPS + horloge ──────────────────────────────────────────────────────
log('── HTTPS et horloge');
try {
  const t0 = Date.now();
  const res = await withTimeout(fetch('https://web.whatsapp.com/', { redirect: 'manual' }), 15000);
  const serverDate = new Date(res.headers.get('date'));
  const drift = Math.round((Date.now() - serverDate.getTime()) / 1000);
  log(`HTTPS web.whatsapp.com : HTTP ${res.status} en ${Date.now() - t0} ms`);
  log(`Décalage d'horloge avec WhatsApp : ${drift} s ${Math.abs(drift) > 30 ? '⚠️ TROP GRAND — synchroniser l\'heure (timedatectl set-ntp true)' : '(ok)'}`);
} catch (e) {
  log(`❌ HTTPS web.whatsapp.com impossible : ${e.cause?.code || e.message}`);
}

// ── 3. WhatsApp Web dans Chromium ───────────────────────────────────────────
log('── Chromium → WhatsApp Web (90 s max)');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-diag-'));
const browser = await puppeteer.launch({
  headless: true,
  userDataDir: profile,
  executablePath: process.env.WA_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run',
    '--disable-blink-features=AutomationControlled',
    ...(process.env.WA_PROXY ? [`--proxy-server=${process.env.WA_PROXY}`] : [])],
});
const summary = { wsCreated: 0, wsOpen: 0, wsClosed: 0, wsErrors: [], failed: [] };
try {
  const page = (await browser.pages())[0];
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36');
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  const wsUrls = new Map();
  cdp.on('Network.webSocketCreated', e => { summary.wsCreated++; wsUrls.set(e.requestId, e.url); log(`WS créé : ${e.url}`); });
  cdp.on('Network.webSocketHandshakeResponseReceived', e => {
    if (e.response.status === 101) summary.wsOpen++;
    log(`WS poignée de main : HTTP ${e.response.status} (${wsUrls.get(e.requestId)})`);
  });
  cdp.on('Network.webSocketFrameError', e => { summary.wsErrors.push(e.errorMessage); log(`WS erreur : ${e.errorMessage}`); });
  cdp.on('Network.webSocketClosed', e => { summary.wsClosed++; log(`WS fermé : ${wsUrls.get(e.requestId)}`); });
  cdp.on('Network.loadingFailed', e => {
    if (e.type === 'WebSocket' || /whatsapp/.test(e.errorText) || e.type === 'Document') {
      summary.failed.push(`${e.type}: ${e.errorText}`);
      log(`Échec réseau (${e.type}) : ${e.errorText}`);
    }
  });
  page.on('console', m => { const t = m.text(); if (/comms|socket|websocket|startComms|net::/i.test(t)) log(`console : ${t.slice(0, 200)}`); });

  await page.goto('https://web.whatsapp.com/', { waitUntil: 'load', timeout: 60000 });
  log('Page chargée, attente de la connexion…');

  let state = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => {
      try {
        const Socket = window.require?.('WAWebSocketModel')?.Socket;
        const Conn = window.require?.('WAWebConnModel')?.Conn;
        return { socket: Socket?.state ?? null, stream: Socket?.stream ?? null, hasRef: !!Conn?.ref, version: window.Debug?.VERSION ?? null };
      } catch (e) { return { error: String(e).slice(0, 120) }; }
    }).catch(e => ({ error: e.message }));
    if (state?.hasRef) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  log('État final :', JSON.stringify(state));

  console.log('\n══ CONCLUSION ══');
  if (state?.hasRef) {
    console.log('✅ WhatsApp Web se connecte et reçoit une référence de QR : le réseau du serveur est bon.');
    console.log('   Si le QR ne s\'affiche toujours pas dans l\'app : vérifier « pm2 ls » (une seule instance) et les logs WHATSAPP.');
  } else if (summary.wsCreated === 0) {
    console.log('❌ Aucun WebSocket ouvert : la page n\'a pas pu démarrer la connexion (chargement bloqué, JS en erreur, ou proxy).');
  } else if (summary.wsOpen === 0) {
    console.log('❌ WebSocket créé mais jamais accepté (pas de HTTP 101) : trafic WebSocket bloqué, IPv6 cassée ou IP refusée par WhatsApp.');
    console.log('   Essayer : forcer l\'IPv4 (voir docs/whatsapp.md), puis un proxy sortant (WA_PROXY) si l\'IP est bloquée.');
  } else {
    console.log('❌ WebSocket ouvert puis refermé sans référence de QR : WhatsApp refuse la session (IP de datacenter restreinte ou horloge décalée).');
  }
  console.log('Résumé :', JSON.stringify(summary));
} catch (e) {
  log('❌ Erreur :', e.message);
} finally {
  await browser.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exit(0);
