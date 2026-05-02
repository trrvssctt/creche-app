/**
 * floodProtection.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Protection contre les attaques en rafale (flood / brute-force simultané).
 *
 * Stratégies combinées :
 *  1. Compteur de requêtes SIMULTANÉES par IP  → bloque le flood concurrent
 *  2. Déduplication par empreinte de requête   → bloque les doublons envoyés
 *     en même temps (même IP + même contenu)
 *  3. Slowdown progressif (express-slow-down)  → ralentit les tentatives répétées
 * ─────────────────────────────────────────────────────────────────────────────
 */
import slowDown from 'express-slow-down';

// ── 1. Compteur de requêtes concurrentes par IP ───────────────────────────────
const activeRequests = new Map(); // IP → nombre de requêtes en cours

/**
 * Bloque une IP si elle a trop de requêtes simultanées.
 * @param {number} maxConcurrent - max requêtes simultanées autorisées par IP
 */
export function concurrentLimiter(maxConcurrent = 2) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const current = activeRequests.get(ip) || 0;

    if (current >= maxConcurrent) {
      console.warn(`[FLOOD] IP ${ip} — ${current} requêtes simultanées bloquées`);
      return res.status(429).json({
        error: 'TooManyConcurrentRequests',
        message: 'Trop de requêtes simultanées. Veuillez patienter quelques secondes.'
      });
    }

    activeRequests.set(ip, current + 1);

    // Décrémenter quand la réponse est envoyée
    const cleanup = () => {
      const n = activeRequests.get(ip) || 1;
      if (n <= 1) activeRequests.delete(ip);
      else activeRequests.set(ip, n - 1);
    };
    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
}

// ── 2. Déduplication par empreinte de requête ─────────────────────────────────
// Empêche d'envoyer deux fois la même requête dans la même fenêtre de temps.
const recentFingerprints = new Map(); // fingerprint → timestamp

/**
 * Génère une empreinte simple : IP + champs clés du body.
 */
function makeFingerprint(req, fields = []) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const parts = [ip];
  for (const f of fields) {
    const val = (req.body?.[f] || '').toString().trim().toLowerCase();
    parts.push(val);
  }
  return parts.join('|');
}

/**
 * Bloque les requêtes identiques envoyées trop rapprochées (flood de doublons).
 * @param {number} windowMs      - fenêtre de déduplication en ms (défaut : 10s)
 * @param {string[]} bodyFields  - champs du body à inclure dans l'empreinte
 */
export function deduplicateRequests(windowMs = 10_000, bodyFields = []) {
  // Nettoyage périodique des empreintes expirées (toutes les 30s)
  setInterval(() => {
    const now = Date.now();
    for (const [fp, ts] of recentFingerprints) {
      if (now - ts > windowMs) recentFingerprints.delete(fp);
    }
  }, 30_000);

  return (req, res, next) => {
    const fp = makeFingerprint(req, bodyFields);
    const lastSeen = recentFingerprints.get(fp);
    const now = Date.now();

    if (lastSeen && now - lastSeen < windowMs) {
      const waitSec = Math.ceil((windowMs - (now - lastSeen)) / 1000);
      console.warn(`[DEDUP] Requête dupliquée bloquée — empreinte: ${fp.split('|')[0]}`);
      return res.status(429).json({
        error: 'DuplicateRequest',
        message: `Requête identique déjà reçue. Veuillez patienter ${waitSec} seconde(s).`
      });
    }

    recentFingerprints.set(fp, now);
    next();
  };
}

// ── 3. Slowdown progressif — contact ─────────────────────────────────────────
// Après le 1er message, chaque tentative supplémentaire ajoute 2s de délai.
export const contactSlowDown = slowDown({
  windowMs: 60 * 60 * 1000, // fenêtre 1h
  delayAfter: 1,             // libre jusqu'au 1er message
  delayMs: (used) => used * 2000, // +2s par requête au-delà du seuil
  maxDelayMs: 30_000,        // max 30s de délai
});

// ── 4. Slowdown progressif — login ───────────────────────────────────────────
// Après 2 tentatives, chaque tentative supplémentaire ajoute 1s de délai.
export const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // fenêtre 15 min
  delayAfter: 2,             // libre jusqu'à 2 tentatives
  delayMs: (used) => used * 1000, // +1s par tentative au-delà
  maxDelayMs: 20_000,        // max 20s de délai
});

// ── 5. Slowdown progressif — register ────────────────────────────────────────
// Après 1 tentative, chaque tentative supplémentaire ajoute 3s de délai.
export const registerSlowDown = slowDown({
  windowMs: 60 * 60 * 1000, // fenêtre 1h
  delayAfter: 1,
  delayMs: (used) => used * 3000, // +3s par tentative au-delà
  maxDelayMs: 30_000,
});
