import { Bulletin, Eleve, Classe } from '../models/index.js';
import { Op } from 'sequelize';
import { isTeacher, getTeacherClassIds } from '../utils/teacherGuard.js';

export class BulletinController {
  static async list(req, res) {
    try {
      const { eleveId, trimestre, anneeScolaire, niveau } = req.query;
      const tenantId = req.user.tenantId;
      const where = { tenantId };
      if (eleveId)       where.eleveId = eleveId;
      if (trimestre)     where.trimestre = trimestre;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      if (niveau)        where.niveau = niveau;

      // Enseignant/Maîtresse : limiter aux bulletins des élèves de leurs classes (prof principal + intervenant)
      if (isTeacher(req)) {
        if (!req.user.employeeId) {
          return res.status(403).json({ error: 'NoEmployee', message: 'Aucun employé lié à ce compte enseignant.' });
        }
        const classeIds = await getTeacherClassIds(tenantId, req.user.employeeId);
        if (classeIds.length === 0) return res.json([]);

        const elevesInClasses = await Eleve.findAll({
          where: { tenantId, classeId: { [Op.in]: classeIds } },
          attributes: ['id'],
        });
        const eleveIds = elevesInClasses.map(e => e.id);
        if (eleveIds.length === 0) return res.json([]);

        where.eleveId = eleveId
          ? (eleveIds.includes(eleveId) ? eleveId : null)
          : { [Op.in]: eleveIds };

        if (where.eleveId === null) return res.json([]);
      }

      const bulletins = await Bulletin.findAll({
        where,
        include: [{ model: Eleve, as: 'eleve', attributes: ['nom', 'prenom', 'matricule'] }],
        order: [['created_at', 'DESC']],
      });
      return res.json(bulletins);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const bulletin = await Bulletin.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: [{ model: Eleve, as: 'eleve' }],
      });
      if (!bulletin) return res.status(404).json({ error: 'NotFound', message: 'Bulletin introuvable.' });

      // Enseignant : vérifier que l'élève du bulletin est dans une de ses classes
      if (isTeacher(req)) {
        if (!req.user.employeeId) {
          return res.status(403).json({ error: 'Forbidden', message: 'Aucun employé lié à ce compte enseignant.' });
        }
        const classeIds = await getTeacherClassIds(req.user.tenantId, req.user.employeeId);
        const eleveClasseId = bulletin.eleve?.classeId;
        if (!eleveClasseId || !classeIds.includes(String(eleveClasseId))) {
          return res.status(403).json({ error: 'Forbidden', message: 'Accès refusé à ce bulletin.' });
        }
      }

      return res.json(bulletin);
    } catch (err) {
      return res.status(500).json({ error: 'GetError', message: err.message });
    }
  }

  static async upsert(req, res) {
    try {
      const { eleveId, trimestre, anneeScolaire } = req.body;
      if (!eleveId || !trimestre || !anneeScolaire) {
        return res.status(400).json({ error: 'BadRequest', message: 'Champs obligatoires manquants.' });
      }

      // Nettoyage pour ne garder que les champs du modèle Bulletin
      const fields = [
        'eleveId', 'trimestre', 'anneeScolaire', 'niveau',
        'domaines', 'matieres', 'moyenneGenerale', 'appreciationGenerale',
        'publie', 'datePublication'
      ];
      const data = { tenantId: req.user.tenantId };
      fields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

      const [bulletin, created] = await Bulletin.findOrCreate({
        where: { eleveId, trimestre, anneeScolaire, tenantId: req.user.tenantId },
        defaults: data
      });

      if (!created) {
        await bulletin.update(data);
      }

      // Recharger avec l'élève pour le frontend
      const full = await Bulletin.findByPk(bulletin.id, {
        include: [{ model: Eleve, as: 'eleve', attributes: ['nom', 'prenom', 'matricule'] }]
      });

      return res.json(full);
    } catch (err) {
      return res.status(500).json({ error: 'UpsertError', message: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const bulletin = await Bulletin.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!bulletin) return res.status(404).json({ error: 'NotFound', message: 'Bulletin introuvable.' });
      await bulletin.destroy();
      return res.json({ message: 'Bulletin supprimé.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
