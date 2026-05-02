
// Charger .env depuis le dossier de server.js (pas depuis process.cwd())
// Évite les problèmes quand PM2/systemd démarre depuis un autre répertoire
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __serverDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__serverDir, '.env') });

import express from 'express';
import path from 'path';
import cors from 'cors';
import cron from 'node-cron';
import { connectDB } from './config/database.js';
import { ContactMessage } from './models/ContactMessage.js';
import { Attendance, PayrollSettings } from './models/index.js';
import { Op } from 'sequelize';
import apiRoutes from './routes/api.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { BackupService } from './services/BackupService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Faire confiance au premier proxy (Nginx, Cloudflare…) pour récupérer la vraie IP du client
// via l'en-tête X-Forwarded-For — indispensable pour que les rate limiters fonctionnent.
app.set('trust proxy', 1);

// Configuration Middlewares de base
// Mise à jour CORS pour supporter les requêtes cross-origin du frontend
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const allowedOrigins = FRONTEND_URL.split(',').map(s => s.trim().replace(/\/$/, ''));
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server) which have no origin
    if (!origin) return callback(null, true);
    // In dev, be permissive to avoid repeated CORS friction
    if ((process.env.NODE_ENV || 'development') !== 'production') return callback(null, true);

    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes('*') || allowedOrigins.includes(normalized)) return callback(null, true);

    // Log rejected origin for debugging
    // eslint-disable-next-line no-console
    console.error('[CORS] Rejected origin:', origin, 'allowed:', allowedOrigins);
    return callback(new Error('CORS policy: origin not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-session-token']
}));

// Use raw body for payment webhooks (Stripe requires raw body to verify signature)
// Ce middleware doit être AVANT express.json() pour les routes de webhook
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Routes API v1
app.use('/api', apiRoutes);

// Serve uploaded files (fallback local storage)
app.use('/uploads', express.static(path.join(process.cwd(), 'backend', 'uploads')));

// If a frontend `dist` folder exists (single-repo deployment), serve it as static files
// Try common locations and pick the first existing one so deployments are robust.
const candidateDists = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), '..', 'dist'),
  path.join(process.cwd(), '..', 'frontend', 'dist')
];
let frontendDist = null;
for (const cand of candidateDists) {
  try {
    const stat = require('fs').statSync(cand);
    if (stat && stat.isDirectory()) {
      frontendDist = cand;
      break;
    }
  } catch (err) {
    // ignore missing paths
  }
}
if (frontendDist) {
  console.log('Serving frontend from', frontendDist);
  // Use express.static to let Express set correct MIME types
  app.use(express.static(frontendDist));
  // SPA fallback: for any non-API GET request, return index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    const indexPath = path.join(frontendDist, 'index.html');
    // Prevent CDN/browser from caching the HTML entrypoint so clients always
    // fetch the latest asset manifest (avoids mismatched hashed bundles).
    res.type('html');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  });
} else {
  console.log('No frontend `dist` directory found in candidates:', candidateDists);
}

// Health Check
app.get('/health', (req, res) => res.send('GeStockPro Kernel Online'));

// Gestionnaire d'erreurs (doit être en dernier)
app.use(errorHandler);

app.listen(PORT, async () => {
  await connectDB();

  // ── Sauvegarde automatique quotidienne à 02:00 ──────────────────────────
  // Rétention : 7 jours (purge automatique dans BackupService.runSystemBackup)
  // Sauvegarde système complète (toutes les tables) — tous les jours à 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] ▶ Sauvegarde système quotidienne démarrée…');
    try {
      await BackupService.runSystemBackup('AUTOMATIC');
      console.log('[CRON] ✅ Sauvegarde système terminée.');
    } catch (err) {
      console.error('[CRON] ❌ Échec sauvegarde système :', err.message);
    }
  }, { timezone: 'Africa/Dakar' });
  console.log('✅ Cron sauvegarde planifié : tous les jours à 02:00 (Africa/Dakar)');

  // Traitement des suppressions de compte planifiées — tous les jours à 03:00
  // Backup tenant (90j) → suppression données opérationnelles
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] ▶ Traitement suppressions de compte planifiées…');
    try {
      await BackupService.processPendingDeletions();
      console.log('[CRON] ✅ Traitement suppressions terminé.');
    } catch (err) {
      console.error('[CRON] ❌ Échec traitement suppressions :', err.message);
    }
  }, { timezone: 'Africa/Dakar' });
  console.log('✅ Cron suppressions planifié : tous les jours à 03:00 (Africa/Dakar)');

  // ── Auto-dépointage toutes les minutes ─────────────────────────────────────
  // Pour chaque tenant ayant deductionEnabled=true, si l'heure courante >= workEndTime,
  // on dépointage automatiquement tous les employés encore pointés (sauf les ABSENT).
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const allSettings = await PayrollSettings.findAll({ where: { deductionEnabled: true } });
      for (const settings of allSettings) {
        const [eh, em] = (settings.workEndTime || '17:00').split(':').map(Number);
        const endMinutes = eh * 60 + em;
        if (currentMinutes < endMinutes) continue;

        const records = await Attendance.findAll({
          where: {
            tenantId: settings.tenantId,
            date: today,
            clockIn: { [Op.ne]: null },
            clockOut: null,
            status: { [Op.ne]: 'ABSENT' }
          }
        });

        if (records.length === 0) continue;

        const clockOutTime = new Date(`${today}T${settings.workEndTime}`).toISOString();
        for (const r of records) {
          await r.update({
            clockOut: clockOutTime,
            overtimeMinutes: 0,
            meta: { ...(r.meta || {}), autoClockout: true, workEndTime: settings.workEndTime }
          });
        }
        console.log(`[CRON] Auto-dépointage: ${records.length} employé(s) pour tenant ${settings.tenantId} à ${settings.workEndTime}`);
      }
    } catch (err) {
      console.error('[CRON] Erreur auto-dépointage:', err.message);
    }
  }, { timezone: 'Africa/Dakar' });
  console.log('✅ Cron auto-dépointage planifié : toutes les minutes (Africa/Dakar)');

  // Seeding de données de test pour les messages de contact retiré (anti-spam)

  console.log(`🚀 GeStockPro API running on port ${PORT} (FRONTEND_URL=${FRONTEND_URL})`);
});
