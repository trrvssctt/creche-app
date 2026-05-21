import { Op } from 'sequelize';
import { PlanningConfig, PlanningException, CreneauHoraire } from '../models/index.js';

export class PlanningController {

  // GET /planning/config?anneeScolaire=...
  static async getConfig(req, res) {
    try {
      const { anneeScolaire } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      const config = await PlanningConfig.findOne({ where, order: [['created_at', 'DESC']] });
      return res.json(config || null);
    } catch (err) {
      return res.status(500).json({ error: 'ConfigError', message: err.message });
    }
  }

  // POST /planning/config
  static async upsertConfig(req, res) {
    try {
      const { anneeScolaire, dateDebut, dateFin, joursRepos } = req.body;
      if (!anneeScolaire || !dateDebut || !dateFin) {
        return res.status(400).json({ error: 'MissingFields', message: 'anneeScolaire, dateDebut, dateFin sont requis.' });
      }
      const [config, created] = await PlanningConfig.findOrCreate({
        where: { tenantId: req.user.tenantId, anneeScolaire },
        defaults: { dateDebut, dateFin, joursRepos: joursRepos || [] },
      });
      if (!created) {
        await config.update({ dateDebut, dateFin, joursRepos: joursRepos !== undefined ? joursRepos : config.joursRepos });
      }
      return res.json(config);
    } catch (err) {
      return res.status(500).json({ error: 'UpsertError', message: err.message });
    }
  }

  // GET /planning/exceptions?classeId=...&dateDebut=...&dateFin=...
  static async listExceptions(req, res) {
    try {
      const { classeId, dateDebut, dateFin } = req.query;

      const creneauxWhere = { tenantId: req.user.tenantId };
      if (classeId) creneauxWhere.classeId = classeId;
      const creneaux = await CreneauHoraire.findAll({ where: creneauxWhere, attributes: ['id'] });
      const creneauIds = creneaux.map(c => c.id);

      if (!creneauIds.length) return res.json([]);

      const where = { tenantId: req.user.tenantId, creneauId: { [Op.in]: creneauIds } };
      if (dateDebut && dateFin) {
        where.dateException = { [Op.between]: [dateDebut, dateFin] };
      }

      const exceptions = await PlanningException.findAll({
        where,
        include: [{
          model: CreneauHoraire,
          as: 'creneau',
          attributes: ['id', 'classeId', 'jour', 'heureDebut', 'heureFin', 'matiere', 'couleur'],
        }],
        order: [['date_exception', 'ASC']],
      });
      return res.json(exceptions);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  // POST /planning/exceptions
  static async createException(req, res) {
    try {
      const { creneauId, dateException, typeException, matiereOverride, heureDebutOverride, heureFinOverride, note } = req.body;
      if (!creneauId || !dateException) {
        return res.status(400).json({ error: 'MissingFields', message: 'creneauId et dateException sont requis.' });
      }
      const creneau = await CreneauHoraire.findOne({ where: { id: creneauId, tenantId: req.user.tenantId } });
      if (!creneau) return res.status(404).json({ error: 'CreneauNotFound' });

      const [ex, created] = await PlanningException.findOrCreate({
        where: { creneauId, dateException, tenantId: req.user.tenantId },
        defaults: { typeException: typeException || 'ANNULE', matiereOverride, heureDebutOverride, heureFinOverride, note },
      });
      if (!created) {
        await ex.update({
          typeException: typeException || ex.typeException,
          matiereOverride: matiereOverride !== undefined ? matiereOverride : ex.matiereOverride,
          heureDebutOverride: heureDebutOverride !== undefined ? heureDebutOverride : ex.heureDebutOverride,
          heureFinOverride: heureFinOverride !== undefined ? heureFinOverride : ex.heureFinOverride,
          note: note !== undefined ? note : ex.note,
        });
      }
      return res.status(201).json(ex);
    } catch (err) {
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  // DELETE /planning/exceptions/:id
  static async deleteException(req, res) {
    try {
      const ex = await PlanningException.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!ex) return res.status(404).json({ error: 'NotFound' });
      await ex.destroy();
      return res.json({ message: 'Exception supprimée.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
