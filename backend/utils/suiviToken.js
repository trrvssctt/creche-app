import crypto from 'crypto';

// Jeton opaque pour les liens de suivi de dossier (/suivi-inscription?t=...).
// Chiffre l'UUID de l'élève en AES-256-GCM : le lien ne révèle ni la référence
// PRE-AAAA-XXXXXX ni l'id, et toute altération est rejetée (tag d'authentification).
const SECRET = process.env.SUIVI_TOKEN_SECRET || process.env.JWT_SECRET || 'GESTOCK_KERNEL_SECURE_2024_@PRIV';
const KEY = crypto.createHash('sha256').update(`suivi-inscription:${SECRET}`).digest();

export function encodeSuiviToken(eleveId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const idBytes = Buffer.from(String(eleveId).replace(/-/g, ''), 'hex');
  const enc = Buffer.concat([cipher.update(idBytes), cipher.final()]);
  return Buffer.concat([iv, enc, cipher.getAuthTag()]).toString('base64url');
}

// Renvoie l'UUID de l'élève, ou null si le jeton est invalide/altéré.
export function decodeSuiviToken(token) {
  try {
    const buf = Buffer.from(String(token || ''), 'base64url');
    if (buf.length !== 12 + 16 + 16) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(28));
    const hex = Buffer.concat([decipher.update(buf.subarray(12, 28)), decipher.final()]).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}
