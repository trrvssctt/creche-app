/**
 * Hygiène du profil Chromium avant chaque lancement.
 *
 * - Après un kill -9, Chromium laisse des verrous Singleton* qui bloquent le relancement.
 * - Un Chromium orphelin sur le même profil corrompt les identifiants : on le tue.
 *   Chaque Chromium est lancé avec le marqueur --gestock-wa-session=<id> pour le retrouver.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

export const SESSION_MARKER = '--gestock-wa-session=';

const SINGLETON_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

export function removeSingletonLocks(profileDir) {
  for (const name of SINGLETON_FILES) {
    const p = path.join(profileDir, name);
    try {
      // lstat : SingletonLock est un lien symbolique souvent cassé
      fs.lstatSync(p);
      fs.rmSync(p, { force: true });
    } catch { /* absent */ }
  }
}

function listPids(pattern) {
  return new Promise(resolve => {
    execFile('pgrep', ['-f', pattern], (err, stdout) => {
      if (err) return resolve([]);
      resolve(stdout.split('\n').map(s => parseInt(s, 10)).filter(n => n && n !== process.pid));
    });
  });
}

export async function killOrphanChromium(sessionId) {
  if (process.platform === 'win32') return 0;
  const pids = await listPids(`${SESSION_MARKER}${sessionId}(\\s|$)`);
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* déjà mort */ }
  }
  if (pids.length) console.warn(`[WHATSAPP:${sessionId}] ${pids.length} Chromium orphelin(s) tué(s)`);
  return pids.length;
}
