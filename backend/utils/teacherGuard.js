import { Classe } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Retourne true si le user est ENSEIGNANT ou MAITRESSE.
 */
export function isTeacher(req) {
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
  return roles.some(r => r === 'ENSEIGNANT' || r === 'MAITRESSE');
}

/**
 * Retourne les IDs de classes où l'enseignant enseigne
 * (prof principal OU intervenant dans enseignantsMatiere).
 * Renvoie [] si l'employeeId est absent.
 */
export async function getTeacherClassIds(tenantId, employeeId) {
  if (!employeeId) return [];
  const classes = await Classe.findAll({
    where: {
      tenantId,
      [Op.or]: [
        { enseignantId: employeeId },
        { enseignantsMatiere: { [Op.contains]: [{ enseignantId: employeeId }] } },
      ],
    },
    attributes: ['id'],
  });
  return classes.map(c => c.id);
}

/**
 * Middleware Express : bloque l'accès si l'enseignant n'a aucune classe.
 * À utiliser sur des routes où le classeId n'est pas encore connu.
 */
export async function requireTeacherClassAccess(req, res, next) {
  if (!isTeacher(req)) return next();
  if (!req.user.employeeId) {
    return res.status(403).json({ error: 'Forbidden', message: 'Aucun employé lié à ce compte enseignant.' });
  }
  const ids = await getTeacherClassIds(req.user.tenantId, req.user.employeeId);
  req.teacherClassIds = ids;
  next();
}
