import { v2 as cloudinary } from 'cloudinary';
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

// Configuration lazy : lue au premier appel, pas au chargement du module,
// pour s'assurer que dotenv a déjà rempli process.env.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  });
  configured = true;
}

const PLAN_LIMITS = {
  FREE_TRIAL:  500  * 1024 * 1024,
  BASIC:         2  * 1024 * 1024 * 1024,
  PRO:          10  * 1024 * 1024 * 1024,
  ENTERPRISE:   50  * 1024 * 1024 * 1024,
};

/**
 * Upload un Buffer vers Cloudinary.
 * Retourne { url, publicId, sizeBytes }
 */
export async function uploadToCloudinary(fileBuffer, originalName, mimeType, tenantId, folder = 'uploads') {
  ensureConfigured();
  const safeName     = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseName     = safeName.replace(/\.[^/.]+$/, '');
  const publicId     = `${tenantId}/${folder}/${Date.now()}_${baseName}`;
  const resourceType = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/')
      ? 'video'
      : 'raw';

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: resourceType, overwrite: false },
      async (error, result) => {
        if (error) return reject(error);
        const sizeBytes = result.bytes || fileBuffer.length;
        await incrementStorageUsed(tenantId, sizeBytes);
        resolve({ url: result.secure_url, publicId: result.public_id, sizeBytes });
      }
    ).end(fileBuffer);
  });
}

/**
 * Supprime un fichier Cloudinary à partir de son URL CDN stockée en BD.
 * Décrémente storage_used_bytes si la taille est récupérable.
 */
export async function deleteFromCloudinary(cloudinaryUrl, tenantId) {
  if (!cloudinaryUrl) return;
  ensureConfigured();
  try {
    const publicId     = publicIdFromUrl(cloudinaryUrl);
    if (!publicId) return;
    const resourceType = resourceTypeFromUrl(cloudinaryUrl);

    let sizeBytes = 0;
    try {
      const info = await cloudinary.api.resource(publicId, { resource_type: resourceType });
      sizeBytes = info.bytes || 0;
    } catch { /* fichier déjà absent, on supprime quand même */ }

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    if (sizeBytes > 0) await decrementStorageUsed(tenantId, sizeBytes);
  } catch (err) {
    console.error('[CloudinaryService] deleteFromCloudinary error:', err.message);
  }
}

/**
 * Retourne l'utilisation et les limites de stockage du tenant.
 * Interface identique à S3Service.getStorageInfo().
 */
export async function getStorageInfo(tenantId, planId = 'BASIC') {
  try {
    const rows = await sequelize.query(
      'SELECT storage_used_bytes FROM tenants WHERE id = :tenantId',
      { replacements: { tenantId }, type: QueryTypes.SELECT }
    );
    const usedBytes  = Number(rows[0]?.storage_used_bytes || 0);
    const limitBytes = PLAN_LIMITS[planId] || PLAN_LIMITS.BASIC;
    return {
      usedBytes,
      limitBytes,
      remainingBytes: Math.max(0, limitBytes - usedBytes),
      usedMB:         +(usedBytes  / 1024 / 1024).toFixed(1),
      limitMB:        +(limitBytes / 1024 / 1024).toFixed(0),
      usedPercent:    +((usedBytes / limitBytes) * 100).toFixed(1),
    };
  } catch {
    const limitBytes = PLAN_LIMITS[planId] || PLAN_LIMITS.BASIC;
    return {
      usedBytes: 0, limitBytes,
      remainingBytes: limitBytes,
      usedMB: 0, limitMB: +(limitBytes / 1024 / 1024).toFixed(0), usedPercent: 0,
    };
  }
}

// ── Helpers privés ───────────────────────────────────────────────────────────

/**
 * Extrait le public_id d'une URL Cloudinary.
 * https://res.cloudinary.com/{cloud}/image/upload/v123/{publicId}.ext
 * → {publicId}
 */
function publicIdFromUrl(url) {
  const match = url?.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
  return match ? match[1] : null;
}

/**
 * Déduit le resource_type depuis l'URL CDN Cloudinary.
 */
function resourceTypeFromUrl(url = '') {
  if (/\/image\//.test(url)) return 'image';
  if (/\/video\//.test(url)) return 'video';
  return 'raw';
}

async function incrementStorageUsed(tenantId, bytes) {
  try {
    await sequelize.query(
      'UPDATE tenants SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + :bytes WHERE id = :tenantId',
      { replacements: { tenantId, bytes }, type: QueryTypes.UPDATE }
    );
  } catch (err) {
    console.warn('[CloudinaryService] incrementStorageUsed:', err.message);
  }
}

async function decrementStorageUsed(tenantId, bytes) {
  try {
    await sequelize.query(
      'UPDATE tenants SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - :bytes) WHERE id = :tenantId',
      { replacements: { tenantId, bytes }, type: QueryTypes.UPDATE }
    );
  } catch (err) {
    console.warn('[CloudinaryService] decrementStorageUsed:', err.message);
  }
}
