import { CreneauHoraire, Classe, Employee } from '../models/index.js';

export class ScheduleController {

  // GET /schedule?classeId=...&anneeScolaire=...
  static async list(req, res) {
    try {
      const { classeId, anneeScolaire } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (classeId)      where.classeId = classeId;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;

      const creneaux = await CreneauHoraire.findAll({
        where,
        include: [
          { model: Employee, as: 'enseignant', attributes: ['id', 'firstName', 'lastName'] },
          { model: Classe,   as: 'classe',     attributes: ['id', 'nom', 'niveau'] },
        ],
        order: [['jour', 'ASC'], ['heure_debut', 'ASC']],
      });
      return res.json(creneaux);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  // GET /schedule/my?anneeScolaire=...  — planning personnel du prof connecté
  static async mySchedule(req, res) {
    try {
      const { anneeScolaire } = req.query;
      const enseignantId = req.user.employeeId;
      if (!enseignantId) return res.json([]);

      const where = { tenantId: req.user.tenantId, enseignantId };
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;

      const creneaux = await CreneauHoraire.findAll({
        where,
        include: [
          { model: Classe, as: 'classe', attributes: ['id', 'nom', 'niveau'] },
        ],
        order: [['jour', 'ASC'], ['heure_debut', 'ASC']],
      });
      return res.json(creneaux);
    } catch (err) {
      return res.status(500).json({ error: 'MyScheduleError', message: err.message });
    }
  }

  // POST /schedule
  static async create(req, res) {
    try {
      const { classeId, enseignantId, jour, heureDebut, heureFin, matiere, couleur, anneeScolaire } = req.body;
      if (!classeId || jour === undefined || !heureDebut || !heureFin || !matiere) {
        return res.status(400).json({ error: 'MissingFields', message: 'classeId, jour, heureDebut, heureFin, matiere sont requis.' });
      }

      // Vérifier que la classe appartient au tenant
      const classe = await Classe.findOne({ where: { id: classeId, tenantId: req.user.tenantId } });
      if (!classe) return res.status(404).json({ error: 'NotFound', message: 'Classe introuvable.' });

      const creneau = await CreneauHoraire.create({
        tenantId: req.user.tenantId,
        classeId,
        enseignantId: enseignantId || null,
        jour,
        heureDebut,
        heureFin,
        matiere,
        couleur: couleur || 'blue',
        anneeScolaire: anneeScolaire || '2025-2026',
      });
      const full = await CreneauHoraire.findByPk(creneau.id, {
        include: [
          { model: Employee, as: 'enseignant', attributes: ['id', 'firstName', 'lastName'] },
          { model: Classe,   as: 'classe',     attributes: ['id', 'nom', 'niveau'] },
        ],
      });
      return res.status(201).json(full);
    } catch (err) {
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  // PUT /schedule/:id
  static async update(req, res) {
    try {
      const creneau = await CreneauHoraire.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });
      if (!creneau) return res.status(404).json({ error: 'NotFound', message: 'Créneau introuvable.' });

      const { enseignantId, jour, heureDebut, heureFin, matiere, couleur } = req.body;
      await creneau.update({
        ...(enseignantId !== undefined && { enseignantId: enseignantId || null }),
        ...(jour          !== undefined && { jour }),
        ...(heureDebut    !== undefined && { heureDebut }),
        ...(heureFin      !== undefined && { heureFin }),
        ...(matiere       !== undefined && { matiere }),
        ...(couleur       !== undefined && { couleur }),
      });
      return res.json(creneau);
    } catch (err) {
      return res.status(500).json({ error: 'UpdateError', message: err.message });
    }
  }

  // DELETE /schedule/:id
  static async delete(req, res) {
    try {
      const creneau = await CreneauHoraire.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });
      if (!creneau) return res.status(404).json({ error: 'NotFound', message: 'Créneau introuvable.' });
      await creneau.destroy();
      return res.json({ message: 'Créneau supprimé.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
