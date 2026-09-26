/**
 * Épinglage de la version de WhatsApp Web.
 *
 * WhatsApp modifie son code web en continu et certaines versions cassent l'injection
 * de whatsapp-web.js. On fige donc une version « rodée » issue du registre communautaire
 * wppconnect-team/wa-version : non-beta, non expirée, publiée depuis au moins 12 h.
 *
 * WA_WEB_VERSION :
 *   - absent / "auto" : sélection automatique dans le registre (par défaut)
 *   - "off"           : pas d'épinglage, WhatsApp Web courant
 *   - "2.3000.xxx"    : version imposée
 * WA_WEB_VERSION_REMOTE : gabarit d'URL du HTML archivé ({version} est remplacé),
 *   à pointer vers une copie hébergée par vos soins si besoin.
 *
 * ⚠️ Le HTML archivé est exécuté dans l'origine web.whatsapp.com sans contrôle d'intégrité.
 */

import axios from 'axios';

const REGISTRY_URL = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json';
const DEFAULT_REMOTE = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';
const SETTLE_MS = 12 * 60 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cached = null; // { version, at }

export function pickSettledWebVersion(registry, now = Date.now()) {
  const candidates = (registry?.versions || [])
    .filter(v => v && v.version && !v.beta)
    .filter(v => !v.expire || new Date(v.expire).getTime() > now)
    .filter(v => v.released && now - new Date(v.released).getTime() >= SETTLE_MS)
    .sort((a, b) => new Date(b.released) - new Date(a.released));
  return candidates[0]?.version || null;
}

/**
 * Renvoie les options whatsapp-web.js { webVersion, webVersionCache } à fusionner
 * dans la config du Client.
 */
export async function resolveWebVersionOptions() {
  const setting = (process.env.WA_WEB_VERSION || 'auto').trim();
  const remotePath = (process.env.WA_WEB_VERSION_REMOTE || DEFAULT_REMOTE).trim();

  if (setting.toLowerCase() === 'off') {
    return { webVersionCache: { type: 'none' } };
  }

  let version = setting.toLowerCase() === 'auto' ? null : setting;

  if (!version) {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      version = cached.version;
    } else {
      try {
        const { data } = await axios.get(REGISTRY_URL, { timeout: 15000 });
        version = pickSettledWebVersion(data);
        if (version) cached = { version, at: Date.now() };
      } catch (err) {
        console.warn('[WHATSAPP] Registre wa-version injoignable :', err.message);
      }
      // En cas d'échec on réutilise la dernière version connue, même périmée
      if (!version && cached) version = cached.version;
    }
  }

  if (!version) {
    console.warn('[WHATSAPP] Aucune version épinglée — WhatsApp Web courant utilisé.');
    return { webVersionCache: { type: 'none' } };
  }

  console.log(`[WHATSAPP] Version WhatsApp Web épinglée : ${version} (HTML chargé depuis ${remotePath.replace('{version}', version)})`);
  return {
    webVersion: version,
    webVersionCache: { type: 'remote', remotePath, strict: false },
  };
}
