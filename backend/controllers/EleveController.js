import { Eleve } from '../models/index.js';
import { Op } from 'sequelize';

const PREFIX_MAP = {
  CRECHE: 'CR', PS: 'PS', MS: 'MS', GS: 'GS',
  CP: 'CP', CE1: 'C1', CE2: 'C2', CM1: 'M1', CM2: 'M2',
};

function genMatricule(niveau) {
  const year = new Date().getFullYear();
  const rand = String(Date.now()).slice(-4);
  return `${PREFIX_MAP[niveau] || 'EL'}-${year}-${rand}`;
}

export class EleveController {
  static async list(req, res) {
    try {
      const { niveau, statut, anneeScolaire, search } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (niveau)        where.niveau = niveau;
      if (statut)        where.statut = statut;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      if (search) {
        where[Op.or] = [
          { nom:       { [Op.iLike]: `%${search}%` } },
          { prenom:    { [Op.iLike]: `%${search}%` } },
          { matricule: { [Op.iLike]: `%${search}%` } },
        ];
      }
      const eleves = await Eleve.findAll({
        where,
        order: [['nom', 'ASC'], ['prenom', 'ASC']],
      });
      return res.json(eleves);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      return res.json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'GetError', message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { ...req.body, tenantId: req.user.tenantId };
      if (!payload.matricule) {
        payload.matricule = genMatricule(payload.niveau || 'PS');
      }
      const eleve = await Eleve.create(payload);
      return res.status(201).json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  static async update(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      await eleve.update(req.body);
      return res.json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'UpdateError', message: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      await eleve.destroy();
      return res.json({ message: 'Élève supprimé.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
