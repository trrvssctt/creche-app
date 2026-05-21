import { Classe, Eleve, Employee } from '../models/index.js';
import { Op } from 'sequelize';

export class ClasseController {
  static async list(req, res) {
    try {
      const { anneeScolaire, niveau } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      if (niveau)        where.niveau = niveau;

      // Enseignant/Maîtresse : uniquement les classes dont ils sont responsables
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      const isTeacher = userRoles.some(r => r === 'ENSEIGNANT' || r === 'MAITRESSE');
      if (isTeacher) {
        if (!req.user.employeeId) {
          return res.status(403).json({ error: 'NoEmployee', message: 'Aucun employé lié à ce compte enseignant.' });
        }
        where.enseignantId = req.user.employeeId;
      }

      const classes = await Classe.findAll({
        where,
        include: [
          { model: Eleve, as: 'eleves', attributes: ['id'] },
          { model: Employee, as: 'enseignant', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['niveau', 'ASC'], ['nom', 'ASC']],
      });

      // Formater pour envoyer le nombre d'élèves
      const result = classes.map(c => {
        const json = c.toJSON();
        json.nbEleves = c.eleves ? c.eleves.length : 0;
        delete json.eleves;
        return json;
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const classe = await Classe.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: [
          { model: Eleve, as: 'eleves', attributes: ['id', 'nom', 'prenom', 'matricule', 'statut'] },
          { model: Employee, as: 'enseignant' }
        ],
      });
      if (!classe) return res.status(404).json({ error: 'NotFound', message: 'Classe introuvable.' });
      return res.json(classe);
    } catch (err) {
      return res.status(500).json({ error: 'GetError', message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const { nom, niveau, enseignantId, enseignantsMatiere, capaciteMax, description } = req.body;
      const classe = await Classe.create({
        nom,
        niveau,
        enseignantId: enseignantId || null,
        enseignantsMatiere: Array.isArray(enseignantsMatiere) ? enseignantsMatiere : [],
        capaciteMax: capaciteMax || 30,
        description: description || null,
        anneeScolaire: req.body.anneeScolaire,
        tenantId: req.user.tenantId,
      });
      return res.status(201).json(classe);
    } catch (err) {
      console.error('[ClasseController.create]', err);
      return res.status(500).json({ error: 'CreateError', message: err.message || String(err) });
    }
  }

  static async update(req, res) {
    try {
      const classe = await Classe.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });
      if (!classe) return res.status(404).json({ error: 'NotFound', message: 'Classe introuvable.' });

      const { nom, niveau, enseignantId, enseignantsMatiere, capaciteMax, description, anneeScolaire } = req.body;
      await classe.update({
        ...(nom !== undefined && { nom }),
        ...(niveau !== undefined && { niveau }),
        ...(capaciteMax !== undefined && { capaciteMax }),
        ...(description !== undefined && { description }),
        ...(anneeScolaire !== undefined && { anneeScolaire }),
        enseignantId: enseignantId || null,
        ...(enseignantsMatiere !== undefined && {
          enseignantsMatiere: Array.isArray(enseignantsMatiere) ? enseignantsMatiere : []
        }),
      });
      return res.json(classe);
    } catch (err) {
      console.error('[ClasseController.update]', err);
      return res.status(500).json({ error: 'UpdateError', message: err.message || String(err) });
    }
  }

  static async delete(req, res) {
    try {
      const classe = await Classe.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });
      if (!classe) return res.status(404).json({ error: 'NotFound', message: 'Classe introuvable.' });
      
      // Vérifier s'il y a des élèves
      const count = await Eleve.count({ where: { classeId: classe.id } });
      if (count > 0) {
        return res.status(400).json({ error: 'NotEmpty', message: 'Impossible de supprimer une classe contenant des élèves.' });
      }

      await classe.destroy();
      return res.json({ message: 'Classe supprimée.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
