import { Presence, Eleve, Classe, Employee } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PresenceController {

  // GET /teacher/presences?classeId=...&date=...
  static async list(req, res) {
    try {
      const { classeId, date, eleveId } = req.query;
      if (!classeId || !date) {
        return res.status(400).json({ error: 'MissingParams', message: 'classeId et date sont requis.' });
      }

      const where = { tenantId: req.user.tenantId, classeId, date };
      if (eleveId) where.eleveId = eleveId;

      const presences = await Presence.findAll({
        where,
        include: [
          { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom', 'matricule'] }
        ],
        order: [['created_at', 'ASC']],
      });

      return res.json(presences);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  // POST /teacher/presences
  // Body: { classeId, date, presences: [{ eleveId, statut, motif? }] }
  static async save(req, res) {
    const t = await sequelize.transaction();
    try {
      const { classeId, date, presences } = req.body;

      if (!classeId || !date || !Array.isArray(presences) || presences.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'MissingParams', message: 'classeId, date et presences[] sont requis.' });
      }

      // Vérifier que la classe appartient au tenant
      const classe = await Classe.findOne({
        where: { id: classeId, tenantId: req.user.tenantId }
      });
      if (!classe) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound', message: 'Classe introuvable.' });
      }

      // employeeId de l'enseignant connecté (si dispo)
      const enseignantId = req.user.employeeId || null;

      // Upsert pour chaque élève
      const results = [];
      for (const p of presences) {
        const { eleveId, statut, motif } = p;
        if (!eleveId || !statut) continue;

        const [record] = await Presence.upsert(
          {
            tenantId: req.user.tenantId,
            classeId,
            eleveId,
            enseignantId,
            date,
            statut,
            motif: motif || null,
          },
          {
            conflictFields: ['tenant_id', 'classe_id', 'eleve_id', 'date'],
            transaction: t,
          }
        );
        results.push(record);
      }

      await t.commit();
      return res.json({ saved: results.length, date, classeId });
    } catch (err) {
      await t.rollback();
      console.error('[PresenceController.save]', err);
      return res.status(500).json({ error: 'SaveError', message: err.message });
    }
  }

  // GET /teacher/presences/stats?classeId=...&from=...&to=...
  static async stats(req, res) {
    try {
      const { classeId, from, to } = req.query;
      if (!classeId) {
        return res.status(400).json({ error: 'MissingParams', message: 'classeId est requis.' });
      }

      const where = { tenantId: req.user.tenantId, classeId };
      if (from && to) where.date = { [Op.between]: [from, to] };
      else if (from)  where.date = { [Op.gte]: from };
      else if (to)    where.date = { [Op.lte]: to };

      const presences = await Presence.findAll({ where });

      // Agrégation par élève
      const byEleve = {};
      for (const p of presences) {
        if (!byEleve[p.eleveId]) byEleve[p.eleveId] = { PRESENT: 0, ABSENT: 0, RETARD: 0 };
        byEleve[p.eleveId][p.statut] = (byEleve[p.eleveId][p.statut] || 0) + 1;
      }

      // Agrégation par jour
      const byDate = {};
      for (const p of presences) {
        if (!byDate[p.date]) byDate[p.date] = { PRESENT: 0, ABSENT: 0, RETARD: 0 };
        byDate[p.date][p.statut] = (byDate[p.date][p.statut] || 0) + 1;
      }

      return res.json({ byEleve, byDate, total: presences.length });
    } catch (err) {
      return res.status(500).json({ error: 'StatsError', message: err.message });
    }
  }
}
