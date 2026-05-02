import { AIService } from '../services/AIService.js';
import { StockItem, PromptTemplate, Payment, Sale, Customer } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse une ligne de l'historique stockée dans la colonne `message`.
 *
 * Le workflow n8n v2 persiste un JSON complet :
 *   { formattedResponse, format, rawResults, metadata, resultCount, documentData }
 *
 * Les anciennes lignes (avant la migration) peuvent être du texte brut.
 * Cette fonction gère les deux cas et retourne TOUJOURS un objet normalisé.
 */
const parseHistoryMessage = (raw) => {
  // Cas 1 : déjà un objet (Postgres JSONB ou driver qui auto-parse)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return sanitizeParsed(raw);
  }

  const str = typeof raw === 'string' ? raw : JSON.stringify(raw || '');

  // Cas 2 : JSON stringifié par le workflow n8n v2
  const trimmed = str.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'formattedResponse' in parsed) {
        return sanitizeParsed(parsed);
      }
      if (Array.isArray(parsed)) {
        return { formattedResponse: JSON.stringify(parsed), format: 'general', rawResults: null, metadata: null };
      }
      return sanitizeParsed(parsed);
    } catch {
      // Pas du JSON valide → texte brut
    }
  }

  // Cas 3 : texte brut (anciens messages avant migration)
  return { formattedResponse: str, format: 'general', rawResults: null, metadata: null, resultCount: 0 };
};

/**
 * Nettoie un objet parsé de l'historique :
 * - Si formattedResponse contient du CSS/HTML brut (bug historique pré-fix),
 *   le remplace par un texte propre basé sur le titre du document.
 * - Extrait documentData depuis metadata si absent au niveau racine.
 */
const sanitizeParsed = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const fr = String(obj.formattedResponse || '');
  const looksLikeCssOrHtml = fr.startsWith(':root')
    || fr.startsWith('<!DOCTYPE')
    || fr.startsWith('<html')
    || fr.includes('font-family:')
    || fr.includes('border-collapse:')
    || fr.includes('.items-table');

  if (looksLikeCssOrHtml) {
    // Remplace le contenu CSS/HTML par un titre lisible
    const title = obj.metadata?.title || obj.documentTitle || 'Document';
    obj = {
      ...obj,
      formattedResponse: `📄 **${title}** généré avec succès.`,
    };
  }

  // S'assure que documentData est disponible au niveau racine
  if (!obj.documentData && obj.metadata?.documentData) {
    obj = { ...obj, documentData: obj.metadata.documentData };
  }

  return obj;
};

/**
 * Normalise le sender depuis les différentes valeurs possibles en DB.
 */
const normalizeSender = (raw) => {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'user' || s === 'human') return 'user';
  return 'ai'; // assistant / ai / bot → 'ai' pour le frontend
};

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

export class AIController {

  /**
   * GET /api/ai/history
   * Récupère l'historique complet d'une session avec toutes les métadonnées
   * nécessaires à la reconstruction des graphiques et tableaux.
   */
  static async getHistory(req, res) {
    try {
      // tenantId sert de sessionId — isolation multi-tenant garantie par le middleware
      const sessionId = req.tenantFilter?.tenantId ?? req.user?.tenantId;
      if (!sessionId) {
        return res.status(400).json({ error: 'MissingSession', message: 'Session ID introuvable.' });
      }

      // Tri : id entier auto-incrément = ordre d'insertion garanti.
      // Même si deux messages ont le même created_at (même seconde),
      // le user est toujours inséré avant l'IA grâce à la correction du workflow.
      // CASE WHEN sender IN ('user','human') THEN 0 ELSE 1 END = tiebreaker de sécurité.
      const sql = `
        SELECT id, session_id, message, sender, created_at
        FROM n8n_chat_histories
        WHERE session_id = :sessionId
        ORDER BY id ASC,
                 CASE WHEN sender IN ('user','human') THEN 0 ELSE 1 END ASC
        LIMIT 500
      `;

      let rows;
      try {
        [rows] = await sequelize.query(sql, { replacements: { sessionId } });
      } catch (pgErr) {
        // Table absente → historique vide (premier usage)
        const isMissing = pgErr?.original?.code === '42P01'
          || /does not exist/i.test(String(pgErr?.message));
        if (isMissing) {
          return res.status(200).json([]);
        }
        throw pgErr;
      }

      const payload = (rows || []).map(row => {
        const parsed = parseHistoryMessage(row.message);
        const ts = row.created_at ?? null;

        return {
          id: row.id,
          sender: normalizeSender(row.sender),

          // ── Texte affiché dans la bulle ──────────────────────────
          message: parsed.formattedResponse ?? '',

          // ── Données pour les visualisations (graphiques, tableaux, stats) ──
          rawResults: parsed.rawResults ?? null,

          // ── Données structurées DocumentPreview — rechargement de page ──
          // Stockées dans metadata.documentData par le nœud n8n
          documentData: parsed.documentData ?? parsed.metadata?.documentData ?? null,

          // ── Métadonnées : chart_config, kpi_config, table_config, title… ──
          // Critiques pour reconstruire les graphiques au rechargement
          metadata: parsed.metadata
            ? {
                ...parsed.metadata,
                // Garantit que format est toujours présent dans metadata
                format: parsed.metadata.format ?? parsed.format ?? 'general',
              }
            : null,

          // ── Format explicite (bar_chart, donut_chart, stats, table…) ──
          format: parsed.format ?? 'general',

          // ── Compteur de résultats ──
          resultCount: parsed.resultCount
            ?? (Array.isArray(parsed.rawResults) ? parsed.rawResults.length : 0),

          // ── Timestamps ──
          created_at: ts ? new Date(ts).toISOString() : null,
          createdAt:  ts ? new Date(ts).toISOString() : null,
        };
      });

      return res.status(200).json(payload);

    } catch (error) {
      console.error('[AI HISTORY ERROR]:', error);
      return res.status(500).json({
        error: 'HistoryFetchError',
        message: 'Impossible de récupérer l\'historique des conversations.',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/templates
   */
  static async getTemplates(req, res) {
    try {
      const templates = await PromptTemplate.findAll({
        where: { isActive: true },
        order: [['category', 'ASC'], ['title', 'ASC']],
      });
      return res.status(200).json(templates);
    } catch (error) {
      return res.status(500).json({ error: 'TemplateFetchError', message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/insights
   * KPIs de rupture de stock pour le dashboard
   */
  static async getDashboardInsights(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const lowStocks = await StockItem.findAll({
        where: { tenantId },
        order: [['currentLevel', 'ASC']],
        limit: 5,
      });

      const insights = [];
      for (const item of lowStocks) {
        const prediction = await AIService.predictStockOut(tenantId, item.id);
        if (prediction && prediction.daysRemaining < 7) {
          insights.push({
            productId: item.id,
            productName: item.name,
            sku: item.sku,
            message: `Risque de rupture dans ${prediction.daysRemaining} jours.`,
            severity: prediction.daysRemaining < 3 ? 'CRITICAL' : 'HIGH',
            velocity: prediction.velocity.toFixed(2),
          });
        }
      }

      return res.status(200).json({
        engine: 'GeStockPro-IA',
        timestamp: new Date(),
        insights,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/forecasts
   */
  static async updateForecasts(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { predictions, period } = req.body;
      let preds = predictions;
      if (!preds || !Array.isArray(preds)) {
        if (period) {
          preds = await AIService.generateForecasts(tenantId, period);
        } else {
          return res.status(400).json({ error: 'BadRequest', message: 'predictions[] ou period requis.' });
        }
      }
      for (const pred of preds) {
        if (!pred?.sku) continue;
        await StockItem.update(
          { forecastedLevel: pred.forecastedLevel },
          { where: { sku: pred.sku, tenantId } },
        );
      }
      return res.status(200).json({ status: 'SUCCESS', count: preds.length });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/bridge
   * Proxy vers le webhook n8n — évite les problèmes CORS depuis le navigateur.
   * Transmet le payload complet (message, id, planId) au workflow.
   */
  static async bridgeWebhook(req, res) {
    const { chatInput, sessionId, message, id } = req.body || {};
    // planId : JWT (req.user) est la source autoritaire — ne pas faire confiance au body seul
    const planId = req.user?.planId || req.body?.planId || 'FREE_TRIAL';

    // ── Résolution de l'URL cible ──────────────────────────────────────────
    const orchestratorOverride =
      req.body?.orchestratorUrl ?? req.headers['x-orchestrator-url'] ?? null;

    const envWebhook  = process.env.WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || process.env.N8N_AI_ORCHESTRATOR_URL || null;
    const envProd     = process.env.PROD_WEBHOOK || process.env.N8N_PROD_WEBHOOK || null;
    const prodUrl     = 'https://n8n.realtechprint.com/webhook/booba/gestock-ia';
    const testUrl     = 'https://n8n.realtechprint.com/webhook/booba/gestock-ia';

    const isProd = (process.env.NODE_ENV || 'development') === 'production';

    const primaryTarget = orchestratorOverride
      ?? (isProd
          ? (envProd ?? envWebhook ?? prodUrl)
          : (envWebhook ?? testUrl ?? envProd ?? prodUrl));

    // ── Payload normalisé ──────────────────────────────────────────────────
    const payload = { chatInput, sessionId, message, id, planId };

    // ── Tentative principale ───────────────────────────────────────────────
    const tried = [primaryTarget];
    try {
      const resp = await axios.post(primaryTarget, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 200_000, // 200s pour les requêtes SQL lourdes
      });
      return res.status(200).json(resp.data);

    } catch (primaryErr) {
      console.error('[Bridge] primary webhook failed:', {
        url: primaryTarget,
        status: primaryErr?.response?.status,
        message: primaryErr?.message,
      });

      const remoteStatus = primaryErr?.response?.status ?? 502;
      const remoteData   = primaryErr?.response?.data   ?? primaryErr?.message ?? 'Unknown error';
      const isTimeout    = primaryErr?.code === 'ECONNABORTED';
      const isNetworkErr = !primaryErr?.response;

      // ── 404 : workflow n8n non activé ─────────────────────────────────
      if (remoteStatus === 404) {
        return res.status(404).json({
          error: 'WebhookNotRegistered',
          message: 'Le workflow n8n n\'est pas activé.',
          hint: 'Cliquez sur "Execute workflow" dans l\'éditeur n8n pour activer le webhook.',
          attempted: primaryTarget,
        });
      }

      // ── Fallbacks sur timeout / erreur réseau / 502 ───────────────────
      if (isTimeout || isNetworkErr || remoteStatus === 502) {
        const fallbacks = [prodUrl, testUrl, envWebhook, envProd]
          .filter(Boolean)
          .filter(u => u !== primaryTarget && !tried.includes(u));

        for (const fb of fallbacks) {
          tried.push(fb);
          try {
            const retry = await axios.post(fb, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30_000,
            });
            return res.status(200).json({ fromFallback: true, fallbackUrl: fb, data: retry.data });
          } catch (retryErr) {
          }
        }
      }

      // ── Page HTML ngrok / proxy hors-ligne ────────────────────────────
      const remoteStr = typeof remoteData === 'string' ? remoteData : '';
      if (remoteStr.includes('<!DOCTYPE') || /ngrok/i.test(remoteStr) || remoteStr.includes('not registered')) {
        return res.status(503).json({
          error: 'WebhookUnavailable',
          message: 'Le serveur n8n semble indisponible.',
          hint: 'Vérifiez que n8n est démarré et que le workflow est activé.',
          attempted: tried,
        });
      }

      // ── Erreur générique ──────────────────────────────────────────────
      return res.status(remoteStatus).json({
        error: 'BridgeError',
        message: 'Impossible de contacter le webhook n8n.',
        details: remoteData,
        attempted: tried,
      });
    }
  }

  /**
   * POST /api/ai/export-zip
   * Reçoit un tableau de documents HTML et retourne un fichier ZIP.
   * Body: { documents: Array<{html: string, filename: string}>, zipName?: string }
   * Si > 5 documents, crée un dossier ZIP. Sinon renvoie les HTML dans le ZIP aussi.
   */
  static async exportZip(req, res) {
    let browser;
    try {
      const { documents, zipName = 'documents' } = req.body || {};

      if (!Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'documents[] requis.' });
      }

      const [{ default: JSZip }, puppeteerMod] = await Promise.all([
        import('jszip'),
        import('puppeteer'),
      ]);

      // Un seul browser pour tous les documents — plus efficace
      browser = await puppeteerMod.default.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const zip = new JSZip();
      const folder = documents.length > 5 ? zip.folder(zipName) : zip;

      for (const doc of documents) {
        if (!doc.html || typeof doc.html !== 'string') continue;

        // Convertir HTML → PDF via Puppeteer
        const page = await browser.newPage();
        await page.setContent(doc.html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        });
        await page.close();

        // Remplace l'extension .html par .pdf dans le nom de fichier
        const safeName = (doc.filename || 'document.html')
          .replace(/[^a-z0-9._\-]/gi, '_')
          .replace(/\.html?$/i, '.pdf');

        folder.file(safeName, pdfBuffer);
      }

      const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const safeZipName = zipName.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeZipName}.zip"`);
      res.setHeader('Content-Length', content.length);
      return res.status(200).end(content);

    } catch (error) {
      console.error('[AI ZIP EXPORT ERROR]:', error);
      return res.status(500).json({
        error: 'ZipExportError',
        message: 'Impossible de générer le fichier ZIP.',
        details: error.message,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * GET /api/ai/payments
   * Retourne la liste des virements (TRANSFER) et chèques (CHEQUE) du tenant.
   *
   * Query params :
   *   - status  : 'PENDING' | 'PAID' | 'ALL' (défaut : 'ALL')
   *   - method  : 'TRANSFER' | 'CHEQUE' | 'ALL' (défaut : 'ALL')
   *   - limit   : nombre max de résultats (défaut : 100)
   *   - page    : page (défaut : 1)
   */
  static async getTransfersAndCheques(req, res) {
    try {
      const tenantId = req.user?.tenantId ?? req.tenantFilter?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'MissingTenant', message: 'Tenant introuvable.' });
      }

      const { status = 'ALL', method = 'ALL', limit = 100, page = 1 } = req.query;

      // ── Filtres dynamiques ─────────────────────────────────────────────────
      const methodFilter = ['TRANSFER', 'CHEQUE'].includes(String(method).toUpperCase())
        ? [String(method).toUpperCase()]
        : ['TRANSFER', 'CHEQUE'];

      const where = {
        tenantId,
        method: { [Op.in]: methodFilter },
      };

      if (status !== 'ALL') {
        const s = String(status).toUpperCase();
        if (!['PENDING', 'PAID'].includes(s)) {
          return res.status(400).json({ error: 'BadRequest', message: 'status doit être PENDING, PAID ou ALL.' });
        }
        where.status = s;
      }

      const pageNum  = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
      const offset   = (pageNum - 1) * limitNum;

      // ── Requête ────────────────────────────────────────────────────────────
      const { count, rows } = await Payment.findAndCountAll({
        where,
        include: [
          {
            model: Sale,
            attributes: ['id', 'reference', 'totalTtc', 'status', 'saleDate', 'walkinName', 'walkinPhone'],
            include: [
              {
                model: Customer,
                attributes: ['id', 'companyName', 'email', 'phone'],
                required: false,
              },
            ],
            required: false,
          },
        ],
        order: [['paymentDate', 'DESC']],
        limit:  limitNum,
        offset,
      });

      // ── Résumé par méthode/statut ──────────────────────────────────────────
      const summary = rows.reduce(
        (acc, p) => {
          const m = p.method;   // 'TRANSFER' | 'CHEQUE'
          const s = p.status;   // 'PENDING' | 'PAID'
          if (!acc[m]) acc[m] = { PENDING: { count: 0, total: 0 }, PAID: { count: 0, total: 0 } };
          const bucket = acc[m][s] ?? (acc[m][s] = { count: 0, total: 0 });
          bucket.count  += 1;
          bucket.total  += parseFloat(p.amount) || 0;
          return acc;
        },
        {},
      );

      return res.status(200).json({
        total: count,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
        summary,
        payments: rows,
      });

    } catch (error) {
      console.error('[AI PAYMENTS ERROR]:', error);
      return res.status(500).json({
        error: 'PaymentsFetchError',
        message: 'Impossible de récupérer les virements/chèques.',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/ai/export-pdf
   * Convertit le HTML d'un document en PDF via Puppeteer.
   * Body: { html: string, filename?: string }
   */
  static async exportPdf(req, res) {
    let browser;
    try {
      const { html, filename = 'document' } = req.body || {};

      if (!html || typeof html !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'html requis.' });
      }

      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      const safeName = filename.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 80);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).end(pdfBuffer);

    } catch (error) {
      console.error('[AI PDF EXPORT ERROR]:', error);
      return res.status(500).json({
        error: 'PdfExportError',
        message: 'Impossible de générer le PDF.',
        details: error.message,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}