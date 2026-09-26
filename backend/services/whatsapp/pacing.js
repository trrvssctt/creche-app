/**
 * Cadence d'envoi anti-bannissement (reprise du « send pacing » d'OpenWA).
 *
 * - délai aléatoire entre deux messages d'une même session ;
 * - plafond journalier progressif selon l'ancienneté de la liaison du compte ;
 * - disjoncteur : après N échecs consécutifs côté WhatsApp, pause.
 *
 * Variables d'environnement :
 *   WA_PACING=off                 désactive plafonds et disjoncteur (délais conservés)
 *   WA_DAILY_CAPS=20,40,80,...    plafond du jour 1, 2, 3… (le dernier s'applique ensuite)
 *   WA_DELAY_MIN_MS / WA_DELAY_MAX_MS   délai entre messages (défaut 3000 / 10000)
 *   WA_BREAKER_FAILURES / WA_BREAKER_PAUSE_MS  (défaut 5 / 900000)
 */

const DEFAULT_CAPS = [20, 40, 80, 160, 320, 640, 1000];

function intEnv(name, def) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v >= 0 ? v : def;
}

export const pacingEnabled = () => (process.env.WA_PACING || 'on').toLowerCase() !== 'off';

export function dailyCaps() {
  const raw = (process.env.WA_DAILY_CAPS || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
  return raw.length ? raw : DEFAULT_CAPS;
}

/** Plafond du jour pour un compte lié depuis `linkedAt`. null = illimité. */
export function dailyCapFor(linkedAt, now = Date.now()) {
  if (!pacingEnabled()) return null;
  const caps = dailyCaps();
  const ageDays = linkedAt ? Math.floor((now - new Date(linkedAt).getTime()) / 86_400_000) : 0;
  return caps[Math.min(Math.max(ageDays, 0), caps.length - 1)];
}

export function randomDelayMs() {
  const min = intEnv('WA_DELAY_MIN_MS', 3000);
  const max = Math.max(min, intEnv('WA_DELAY_MAX_MS', 10000));
  return min + Math.floor(Math.random() * (max - min + 1));
}

export const breakerFailures = () => intEnv('WA_BREAKER_FAILURES', 5);
export const breakerPauseMs = () => intEnv('WA_BREAKER_PAUSE_MS', 15 * 60 * 1000);
