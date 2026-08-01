import { Matiere } from '../models/Matiere.js';
import { Classe, Employee } from '../models/index.js';

export class MatiereController {

  static async list(req, res) {
    try {
      const where = { tenantId: req.user.tenantId };
      if (req.query.classeId) where.classeId = req.query.classeId;

      const matieres = await Matiere.findAll({
        where,
        include: [
          { model: Classe, as: 'classe', attributes: ['id', 'nom', 'niveau'] },
          { model: Employee, as: 'enseignant', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['nom', 'ASC']],
      });
      return res.json(matieres);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const { classeId, nom, enseignantId, couleur, coefficient } = req.body;
      if (!classeId || !nom?.trim()) {
        return res.status(400).json({ error: 'BadRequest', message: 'classeId et nom sont requis.' });
      }

      const classe = await Classe.findOne({ where: { id: classeId, tenantId: req.user.tenantId } });
      if (!classe) return res.status(404).json({ error: 'ClasseNotFound' });

      const matiere = await Matiere.create({
        tenantId: req.user.tenantId,
        classeId,
        nom: nom.trim(),
        enseignantId: enseignantId || null,
        couleur: couleur || 'blue',
        coefficient: coefficient || 1,
      });

      return res.status(201).json(matiere);
    } catch (err) {
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  static async update(req, res) {
    try {
      const matiere = await Matiere.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!matiere) return res.status(404).json({ error: 'NotFound' });

      const { nom, enseignantId, couleur, coefficient } = req.body;
      await matiere.update({
        ...(nom !== undefined && { nom: nom.trim() }),
        ...(enseignantId !== undefined && { enseignantId: enseignantId || null }),
        ...(couleur !== undefined && { couleur }),
        ...(coefficient !== undefined && { coefficient }),
      });

      return res.json(matiere);
    } catch (err) {
      return res.status(500).json({ error: 'UpdateError', message: err.message });
    }
  }

  static async remove(req, res) {
    try {
      const matiere = await Matiere.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!matiere) return res.status(404).json({ error: 'NotFound' });

      await matiere.destroy();
      return res.json({ message: 'Matière supprimée.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
