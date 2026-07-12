import { Op } from 'sequelize';
import { Eleve, EleveDocument } from '../models/index.js';

// Détecte un dossier existant pour le même enfant (même tenant, même année) :
// même nom + prénom (insensible à la casse) et, si fournie, même date de naissance.
// Les dossiers REJETE/RADIE ne bloquent pas (l'enfant peut être resoumis).
export async function findDuplicateEleve({ tenantId, nom, prenom, dateNaissance, anneeScolaire, excludeId }) {
  if (!nom?.trim() || !prenom?.trim()) return null;

  const where = {
    tenantId,
    nom:    { [Op.iLike]: nom.trim() },
    prenom: { [Op.iLike]: prenom.trim() },
    statut: { [Op.notIn]: ['REJETE', 'RADIE'] },
  };
  if (anneeScolaire) where.anneeScolaire = anneeScolaire;
  if (dateNaissance) where.dateNaissance = dateNaissance;
  if (excludeId)     where.id = { [Op.ne]: excludeId };

  return Eleve.findOne({ where, attributes: ['id', 'nom', 'prenom', 'statut', 'anneeScolaire'] });
}

// ── Pièces justificatives jointes aux demandes d'admission ───────────────────
// Chaque pièce : { typeDoc, nom, dataUrl, mimeType, fileSize }
// Contraintes : max 8 pièces, 3 Mo par fichier (≈4 Mo en base64), images/PDF uniquement.

const PJ_MAX_COUNT = 8;
const PJ_MAX_DATAURL_LEN = 4_200_000; // ~3 Mo binaire en base64
const PJ_ALLOWED_PREFIX = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/;

export function validatePiecesJointes(pieces) {
  if (pieces == null) return { ok: true, list: [] };
  if (!Array.isArray(pieces)) return { ok: false, error: 'piecesJointes doit être une liste.' };
  if (pieces.length > PJ_MAX_COUNT) return { ok: false, error: `Maximum ${PJ_MAX_COUNT} pièces jointes.` };

  const list = [];
  for (const p of pieces) {
    if (!p || typeof p.dataUrl !== 'string' || !p.nom) continue;
    if (!PJ_ALLOWED_PREFIX.test(p.dataUrl)) {
      return { ok: false, error: `Format non autorisé pour « ${p.nom} » — images (JPG/PNG/WebP) ou PDF uniquement.` };
    }
    if (p.dataUrl.length > PJ_MAX_DATAURL_LEN) {
      return { ok: false, error: `Le fichier « ${p.nom} » dépasse 3 Mo. Réduisez sa taille et réessayez.` };
    }
    list.push({
      typeDoc:  String(p.typeDoc || 'AUTRE').slice(0, 50),
      nom:      String(p.nom).slice(0, 255),
      dataUrl:  p.dataUrl,
      mimeType: p.dataUrl.slice(5, p.dataUrl.indexOf(';')),
      fileSize: Math.round(p.dataUrl.length * 0.75),
    });
  }
  return { ok: true, list };
}

// Crée les EleveDocument (catégorie ADMINISTRATIF) pour un élève donné
export async function createPiecesJointes(eleve, pieces, uploadedBy = null) {
  for (const p of pieces) {
    await EleveDocument.create({
      tenantId:      eleve.tenantId,
      eleveId:       eleve.id,
      categorie:     'ADMINISTRATIF',
      anneeScolaire: eleve.anneeScolaire || null,
      typeDoc:       p.typeDoc,
      nom:           p.nom,
      fileUrl:       p.dataUrl,
      mimeType:      p.mimeType,
      fileSize:      p.fileSize,
      uploadedBy,
    });
  }
}

export function duplicateMessage(dup) {
  const statutLabel = {
    EN_ATTENTE: 'en attente d\'examen',
    ADMIS: 'admis',
    INSCRIT: 'déjà inscrit',
    ACTIF: 'déjà inscrit',
    SUSPENDU: 'suspendu',
  }[dup.statut] || dup.statut;
  return `Un dossier existe déjà pour ${dup.prenom} ${dup.nom} (${statutLabel}) pour l'année ${dup.anneeScolaire || 'en cours'}. `
    + 'Si vous pensez qu\'il s\'agit d\'une erreur, contactez l\'école.';
}
