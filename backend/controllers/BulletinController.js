import { Bulletin, Eleve } from '../models/index.js';
import { Op } from 'sequelize';

export class BulletinController {
  static async list(req, res) {
    try {
      const { eleveId, trimestre, anneeScolaire, niveau } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (eleveId)       where.eleveId = eleveId;
      if (trimestre)     where.trimestre = trimestre;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      if (niveau)        where.niveau = niveau;

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
