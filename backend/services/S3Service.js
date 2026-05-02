import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sequelize } from '../config/database.js';

export const getS3Config = () => {
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint        = process.env.S3_ENDPOINT  || 'https://s3-us-east-1.mamutecloud.com';
  const region          = process.env.S3_REGION    || 'us-east-1';
  const bucket          = process.env.S3_BUCKET    || 'bucket-gestockpro';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `Variables S3 manquantes en production. ` +
      `AWS_ACCESS_KEY_ID=${accessKeyId ? '✓' : '✗'} ` +
      `AWS_SECRET_ACCESS_KEY=${secretAccessKey ? '✓' : '✗'}`
    );
  }

  return { accessKeyId, secretAccessKey, endpoint, region, bucket };
};

// Lazy singleton — instancié à la première utilisation, pas au démarrage du module
let _s3Client = null;
export const s3Client = new Proxy({}, {
  get(_, prop) {
    if (!_s3Client) {
      const { accessKeyId, secretAccessKey, endpoint, region } = getS3Config();
      _s3Client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
    }
    return _s3Client[prop];
  }
});

/**
 * Upload un fichier vers MamuteCloud S3.
 * Chemin : bucket-gestockpro/{tenantId}/{folder}/{unique_filename}
 *
 * @param {Buffer} fileBuffer   - Contenu du fichier
 * @param {string} originalName - Nom original du fichier
 * @param {string} mimeType     - MIME type
 * @param {string} tenantId     - ID du tenant
 * @param {string} folder       - Sous-dossier (logos, images, documents, employees, leaves...)
 * @returns {{ url: string, key: string, sizeBytes: number }}
 */
export const uploadToS3 = async (fileBuffer, originalName, mimeType, tenantId, folder = 'uploads') => {
  const { bucket } = getS3Config();
  const safeName  = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key       = `${tenantId}/${folder}/${Date.now()}_${safeName}`;

  const command = new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimeType
  });

  await s3Client.send(command);

  // Mettre à jour le stockage utilisé par le tenant
  await incrementStorageUsed(tenantId, fileBuffer.length);

  // On retourne seulement la clé — l'URL proxy est construite par le contrôleur
  return { key, sizeBytes: fileBuffer.length };
};

/**
 * Génère une URL signée temporaire (1 heure) pour un objet privé.
 */
export const getSignedObjectUrl = async (key, expiresIn = 3600) => {
  const { bucket } = getS3Config();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Supprime un objet S3 et décrémente le stockage du tenant.
 */
export const deleteFromS3 = async (key, tenantId) => {
  try {
    const { bucket } = getS3Config();
    // Récupérer la taille avant suppression
    let sizeBytes = 0;
    try {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      sizeBytes = head.ContentLength || 0;
    } catch (_) {}

    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

    if (tenantId && sizeBytes > 0) {
      await decrementStorageUsed(tenantId, sizeBytes);
    }
  } catch (err) {
    console.error('[S3Service] deleteFromS3 error:', err.message);
  }
};

// ─── Storage tracking ────────────────────────────────────────────────────────

const incrementStorageUsed = async (tenantId, bytes) => {
  try {
    await sequelize.query(
      `UPDATE tenants SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + :bytes WHERE id = :tenantId`,
      { replacements: { bytes, tenantId }, type: 'UPDATE' }
    );
  } catch (err) {
    console.warn('[S3Service] Impossible de mettre à jour storage_used_bytes:', err.message);
  }
};

const decrementStorageUsed = async (tenantId, bytes) => {
  try {
    await sequelize.query(
      `UPDATE tenants SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - :bytes) WHERE id = :tenantId`,
      { replacements: { bytes, tenantId }, type: 'UPDATE' }
    );
  } catch (err) {
    console.warn('[S3Service] Impossible de décrémenter storage_used_bytes:', err.message);
  }
};

// ─── Limites par plan ────────────────────────────────────────────────────────

const STORAGE_LIMITS = {
  FREE_TRIAL: 500  * 1024 * 1024,       // 500 Mo
  BASIC:      2    * 1024 * 1024 * 1024, // 2 Go
  PRO:        10   * 1024 * 1024 * 1024, // 10 Go
  ENTERPRISE: 50   * 1024 * 1024 * 1024  // 50 Go
};

export const getStorageInfo = async (tenantId, planId = 'BASIC') => {
  try {
    const [rows] = await sequelize.query(
      `SELECT storage_used_bytes FROM tenants WHERE id = :tenantId`,
      { replacements: { tenantId }, type: 'SELECT' }
    );
    const used  = parseInt((rows?.[0] || rows)?.storage_used_bytes || 0, 10);
    const limit = STORAGE_LIMITS[planId?.toUpperCase()] || STORAGE_LIMITS.BASIC;
    return {
      usedBytes:      used,
      limitBytes:     limit,
      remainingBytes: Math.max(0, limit - used),
      usedMB:         +(used / 1024 / 1024).toFixed(2),
      limitMB:        +(limit / 1024 / 1024).toFixed(2),
      usedPercent:    limit > 0 ? +((used / limit) * 100).toFixed(1) : 0
    };
  } catch (err) {
    console.warn('[S3Service] getStorageInfo error:', err.message);
    return { usedBytes: 0, limitBytes: 0, remainingBytes: 0, usedMB: 0, limitMB: 0, usedPercent: 0 };
  }
};
