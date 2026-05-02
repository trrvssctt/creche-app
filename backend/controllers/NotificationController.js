
import { Notification, NotificationRead, User } from '../models/index.js';
import { Op } from 'sequelize';

export class NotificationController {

  /**
   * GET /hr/notifications
   * Employé : ses notifications (ciblées + broadcast non expirées)
   * Admin/HR : toutes les notifications du tenant
   */
  static async getAll(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      const isAdmin = roles.includes('ADMIN') || roles.includes('HR_MANAGER') || roles.includes('SUPER_ADMIN');

      let where = {
        tenantId,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      };

      // Admins voient toutes les notifications du tenant
      // Employés voient celles qui leur sont adressées ou en broadcast
      if (!isAdmin) {
        where = {
          ...where,
          [Op.and]: [
            {
              [Op.or]: [
                { targetUserId: null },
                { targetUserId: userId }
              ]
            }
          ]
        };
      }

      const notifications = await Notification.findAll({
        where,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'email'],
            required: false
          },
          ...(isAdmin ? [{
            model: User,
            as: 'targetUser',
            attributes: ['id', 'name', 'email'],
            required: false
          }] : [])
        ],
        order: [['created_at', 'DESC']]
      });

      // Pour chaque notification, indiquer si l'utilisateur courant l'a lue
      const readRecords = await NotificationRead.findAll({
        where: { userId, notificationId: notifications.map(n => n.id) }
      });
      const readSet = new Set(readRecords.map(r => r.notificationId));

      const result = notifications.map(n => ({
        ...n.toJSON(),
        isRead: readSet.has(n.id)
      }));

      return res.json(result);
    } catch (err) {
      console.error('NotificationController.getAll:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * POST /hr/notifications
   * Admin/HR_MANAGER : créer une notification (broadcast ou ciblée)
   * Body: { title, body, type, targetUserId?, actionLink?, expiresAt? }
   */
  static async create(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const createdBy = req.user.id;
      const { title, body, type = 'INFO', targetUserId, actionLink, expiresAt } = req.body;

      if (!title || !body) {
        return res.status(400).json({ error: 'Titre et contenu requis' });
      }

      const notification = await Notification.create({
        tenantId,
        targetUserId: targetUserId || null,
        title,
        body,
        type,
        actionLink: actionLink || null,
        expiresAt: expiresAt || null,
        createdBy
      });

      // Recharger avec le sender
      const full = await Notification.findByPk(notification.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'name', 'email'], required: false },
          { model: User, as: 'targetUser', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      return res.status(201).json({ ...full.toJSON(), isRead: false });
    } catch (err) {
      console.error('NotificationController.create:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * POST /hr/notifications/:id/read
   * Marquer une notification comme lue pour l'utilisateur courant
   */
  static async markRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await NotificationRead.findOrCreate({
        where: { notificationId: id, userId }
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('NotificationController.markRead:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * POST /hr/notifications/read-all
   * Marquer toutes les notifications visibles comme lues
   */
  static async markAllRead(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      const isAdmin = roles.includes('ADMIN') || roles.includes('HR_MANAGER') || roles.includes('SUPER_ADMIN');

      let where = { tenantId };
      if (!isAdmin) {
        where[Op.or] = [{ targetUserId: null }, { targetUserId: userId }];
      }

      const notifications = await Notification.findAll({ where, attributes: ['id'] });
      const ids = notifications.map(n => n.id);

      // Créer les enregistrements de lecture manquants
      const existing = await NotificationRead.findAll({
        where: { userId, notificationId: ids },
        attributes: ['notificationId']
      });
      const alreadyRead = new Set(existing.map(r => r.notificationId));
      const toCreate = ids.filter(id => !alreadyRead.has(id)).map(notificationId => ({ notificationId, userId }));

      if (toCreate.length > 0) {
        await NotificationRead.bulkCreate(toCreate, { ignoreDuplicates: true });
      }

      return res.json({ success: true, count: toCreate.length });
    } catch (err) {
      console.error('NotificationController.markAllRead:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * DELETE /hr/notifications/:id
   * Admin/HR_MANAGER : supprimer une notification
   */
  static async delete(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;

      const notif = await Notification.findOne({ where: { id, tenantId } });
      if (!notif) return res.status(404).json({ error: 'Notification introuvable' });

      await NotificationRead.destroy({ where: { notificationId: id } });
      await notif.destroy();

      return res.json({ success: true });
    } catch (err) {
      console.error('NotificationController.delete:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * GET /hr/notifications/users
   * Admin/HR_MANAGER : liste des utilisateurs du tenant (pour ciblage)
   */
  static async getUsers(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const users = await User.findAll({
        where: { tenantId, isActive: true },
        attributes: ['id', 'name', 'email', 'roles', 'role'],
        order: [['name', 'ASC']]
      });
      return res.json(users);
    } catch (err) {
      console.error('NotificationController.getUsers:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * GET /hr/notifications/unread-count
   * Nombre de notifications non lues pour l'utilisateur courant
   */
  static async unreadCount(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;

      const notifications = await Notification.findAll({
        where: {
          tenantId,
          [Op.or]: [{ targetUserId: null }, { targetUserId: userId }],
          [Op.and]: [
            { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] }
          ]
        },
        attributes: ['id']
      });

      const ids = notifications.map(n => n.id);
      const readCount = await NotificationRead.count({
        where: { userId, notificationId: ids }
      });

      return res.json({ count: ids.length - readCount });
    } catch (err) {
      console.error('NotificationController.unreadCount:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }
}
