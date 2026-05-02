import { Announcement } from '../models/Announcement.js';
import { Op } from 'sequelize';

export class AnnouncementController {
  /**
   * Liste les annonces actives (visibles par tous les utilisateurs connectés)
   * Filtre optionnel par plan
   */
  static async list(req, res) {
    try {
      const { planId } = req.query;
      const where = {
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      };

      if (planId) {
        where[Op.and] = [
          {
            [Op.or]: [
              { targetPlan: null },
              { targetPlan: planId }
            ]
          }
        ];
      }

      const announcements = await Announcement.findAll({
        where,
        order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
        limit: 50
      });

      return res.status(200).json(announcements);
    } catch (error) {
      return res.status(500).json({ error: 'FetchError', message: error.message });
    }
  }

  /**
   * Liste toutes les annonces (SuperAdmin, sans filtre actif/inactif)
   */
  static async listAll(req, res) {
    try {
      const announcements = await Announcement.findAll({
        order: [['isPinned', 'DESC'], ['createdAt', 'DESC']]
      });
      return res.status(200).json(announcements);
    } catch (error) {
      return res.status(500).json({ error: 'FetchError', message: error.message });
    }
  }

  /**
   * Crée une annonce (SuperAdmin uniquement)
   */
  static async create(req, res) {
    try {
      const { title, body, type, targetPlan, isPinned, expiresAt } = req.body;

      if (!title || !body) {
        return res.status(400).json({ error: 'MissingFields', message: 'title et body sont requis.' });
      }

      const announcement = await Announcement.create({
        title,
        body,
        type: type || 'INFO',
        targetPlan: targetPlan || null,
        isPinned: isPinned || false,
        expiresAt: expiresAt || null,
        isActive: true,
        createdBy: req.user?.name || 'SuperAdmin'
      });

      return res.status(201).json(announcement);
    } catch (error) {
      return res.status(500).json({ error: 'CreateError', message: error.message });
    }
  }

  /**
   * Modifie une annonce (SuperAdmin uniquement)
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { title, body, type, targetPlan, isPinned, expiresAt, isActive } = req.body;

      const announcement = await Announcement.findByPk(id);
      if (!announcement) return res.status(404).json({ error: 'NotFound' });

      await announcement.update({
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(type !== undefined && { type }),
        ...(targetPlan !== undefined && { targetPlan }),
        ...(isPinned !== undefined && { isPinned }),
        ...(expiresAt !== undefined && { expiresAt }),
        ...(isActive !== undefined && { isActive })
      });

      return res.status(200).json(announcement);
    } catch (error) {
      return res.status(500).json({ error: 'UpdateError', message: error.message });
    }
  }

  /**
   * Supprime une annonce (SuperAdmin uniquement)
   */
  static async remove(req, res) {
    try {
      const { id } = req.params;
      const announcement = await Announcement.findByPk(id);
      if (!announcement) return res.status(404).json({ error: 'NotFound' });
      await announcement.destroy();
      return res.status(200).json({ message: 'Annonce supprimée.' });
    } catch (error) {
      return res.status(500).json({ error: 'DeleteError', message: error.message });
    }
  }
}
