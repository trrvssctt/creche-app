import { SupportTicket, Tenant } from '../models/index.js';
import { Op, literal } from 'sequelize';

export class SupportController {
  /** POST /api/support — Soumettre un ticket (client connecté) */
  static async createTicket(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { subject, message, category = 'OTHER', priority = 'NORMAL' } = req.body;

      if (!subject || !message) {
        return res.status(400).json({ error: 'MissingFields', message: 'Sujet et message requis.' });
      }

      const ticket = await SupportTicket.create({
        tenantId,
        userId: req.user.id,
        userName: req.user.name || req.user.email,
        userEmail: req.user.email,
        subject,
        message,
        category,
        priority,
        status: 'OPEN'
      });

      return res.status(201).json({ ticket });
    } catch (error) {
      return res.status(500).json({ error: 'CreateTicketError', message: error.message });
    }
  }

  /** GET /api/support — Lister les tickets du tenant */
  static async getMyTickets(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const tickets = await SupportTicket.findAll({
        where: { tenantId },
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json({ tickets });
    } catch (error) {
      return res.status(500).json({ error: 'FetchError', message: error.message });
    }
  }

  /** GET /api/support/:id — Détail d'un ticket */
  static async getTicket(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const ticket = await SupportTicket.findOne({ where: { id, tenantId } });
      if (!ticket) return res.status(404).json({ error: 'NotFound' });
      return res.status(200).json({ ticket });
    } catch (error) {
      return res.status(500).json({ error: 'FetchError', message: error.message });
    }
  }

  // ── SUPER ADMIN ──────────────────────────────────────────────

  /** GET /api/admin/support — Lister tous les tickets (SuperAdmin) */
  static async listAllTickets(req, res) {
    try {
      const { status, priority, page = 1, limit = 50 } = req.query;
      const where = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;

      const tickets = await SupportTicket.findAll({
        where,
        order: [
          // URGENT first, then by date
          [literal(`CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END`), 'ASC'],
          ['createdAt', 'DESC']
        ],
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit)
      });

      const total = await SupportTicket.count({ where });

      // Attach tenant name
      const tenantIds = [...new Set(tickets.map(t => t.tenantId))];
      const tenants = await Tenant.findAll({ where: { id: { [Op.in]: tenantIds } }, attributes: ['id', 'name'] });
      const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

      const enriched = tickets.map(t => ({
        ...t.toJSON(),
        tenantName: tenantMap[t.tenantId] || t.tenantId
      }));

      return res.status(200).json({ tickets: enriched, total });
    } catch (error) {
      return res.status(500).json({ error: 'FetchError', message: error.message });
    }
  }

  /** PATCH /api/admin/support/:id — Répondre / changer statut (SuperAdmin) */
  static async updateTicket(req, res) {
    try {
      const { id } = req.params;
      const { status, adminReply, priority } = req.body;

      const ticket = await SupportTicket.findByPk(id);
      if (!ticket) return res.status(404).json({ error: 'NotFound' });

      const updates = {};
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (adminReply !== undefined) updates.adminReply = adminReply;
      if (adminReply || status === 'RESOLVED') updates.adminId = req.user?.name || 'SuperAdmin';
      if (status === 'RESOLVED') updates.resolvedAt = new Date();

      await ticket.update(updates);
      return res.status(200).json({ ticket });
    } catch (error) {
      return res.status(500).json({ error: 'UpdateError', message: error.message });
    }
  }

  /** GET /api/admin/support/stats — Statistiques tickets (SuperAdmin) */
  static async getStats(req, res) {
    try {
      const total = await SupportTicket.count();
      const open = await SupportTicket.count({ where: { status: 'OPEN' } });
      const inProgress = await SupportTicket.count({ where: { status: 'IN_PROGRESS' } });
      const resolved = await SupportTicket.count({ where: { status: 'RESOLVED' } });
      const urgent = await SupportTicket.count({ where: { priority: 'URGENT', status: { [Op.notIn]: ['RESOLVED', 'CLOSED'] } } });
      return res.status(200).json({ total, open, inProgress, resolved, urgent });
    } catch (error) {
      return res.status(500).json({ error: 'StatsError', message: error.message });
    }
  }
}
