import { Op } from 'sequelize';
import { Eleve } from '../models/index.js';

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
