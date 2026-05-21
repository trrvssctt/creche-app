import { Customer, AuditLog, Sale } from '../models/index.js';
import crypto from 'crypto';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { CustomerService } from '../services/CustomerService.js';

export class CustomerController {
  /**
   * Liste des clients avec filtres de segmentation
   */
    static async list(req, res) {
    try {
      const { health, anneeScolaire } = req.query;
      const where = {
        tenantId: req.user.tenantId,
        status: { [Op.ne]: 'supprimer' },
      };

      if (health) where.healthStatus = health;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;

      const customers = await Customer.findAll({
        where,
        order: [['companyName', 'ASC']]
      });
      return res.status(200).json(customers);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  /**
   * Vue 360° d'un client (Détails + Stats + Solvabilité)
   */
  static async getDetails(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Rafraîchir l'état de solvabilité basé sur les retards réels
      await CustomerService.refreshHealthStatus(id);

      const customer = await Customer.findOne({ 
        where: { id, tenantId }
      });
      
      if (!customer) return res.status(404).json({ error: 'NotFound', message: 'Client introuvable.' });

      // 2. Récupération des dernières ventes (commandes)
      const sales = await Sale.findAll({ 
        where: { customerId: id, tenantId },
        limit: 10,
        order: [['createdAt', 'DESC']]
      });

      // 3. Calcul des statistiques financières consolidées (hors ventes annulées)
      const totalInvoiced = await Sale.sum('totalTtc', { 
        where: { 
          customerId: id, 
          tenantId, 
          status: { [Op.ne]: 'ANNULE' } 
        } 
      }) || 0;

      const totalPaid = await Sale.sum('amountPaid', { 
        where: { 
          customerId: id, 
          tenantId, 
          status: { [Op.ne]: 'ANNULE' } 
        } 
      }) || 0;

      return res.status(200).json({
        customer,
        stats: {
          totalInvoiced: parseFloat(totalInvoiced),
          totalPaid: parseFloat(totalPaid),
          outstanding: Math.max(0, parseFloat(totalInvoiced) - parseFloat(totalPaid)),
          orderCount: sales.length
        },
        recentSales: sales
      });
    } catch (error) {
      console.error("[CUSTOMER KERNEL] Detail Error:", error);
      return res.status(500).json({ error: 'DetailError', message: error.message });
    }
  }

  /**
   * Création d'un client avec audit
   */
  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const email = req.body.email;
      const phone = req.body.phone;
      const companyName = req.body.companyName;

      // Unicité sur email ou téléphone uniquement (le nom de l'enfant n'est pas unique)
      const orConditions = [
        ...(email && !email.includes('@letoidesanges.sn') ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ];

      if (orConditions.length) {
        const conflict = await Customer.findOne({
          where: {
            tenantId,
            status: { [Op.ne]: 'supprimer' },
            [Op.or]: orConditions,
          },
        });

        if (conflict) {
          const field = email && conflict.email === email ? 'cet email' : 'ce numéro de téléphone';
          return res.status(400).json({ error: 'CreateError', message: `Un dossier existe déjà avec ${field}.` });
        }
      }

      const customer = await Customer.create({
        ...req.body,
        companyName: companyName || req.body.companyName,
        tenantId
      });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'CUSTOMER_CREATED',
        resource: customer.id,
        severity: 'LOW',
        sha256Signature: crypto.createHash('sha256').update(`${req.user.tenantId}:${req.user.id}:${customer.id}:${Date.now()}`).digest('hex')
      });

      return res.status(201).json(customer);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  /**
   * Mise à jour avec protection des données sensibles
   */
   static async update(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const customer = await Customer.findOne({ where: { id, tenantId, status: { [Op.ne]: 'supprimer' } } });
      if (!customer) return res.status(404).json({ error: 'NotFound', message: 'Client introuvable.' });

      // Vérifier que l'email/téléphone ne sont pas déjà utilisés par un AUTRE client actif
      const { email, phone } = req.body;
      const orConditions = [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ];

      if (orConditions.length) {
        const conflict = await Customer.findOne({
          where: {
            tenantId,
            id: { [Op.ne]: id },           // exclure le client en cours de modification
            status: { [Op.ne]: 'supprimer' }, // exclure les clients supprimés
            [Op.or]: orConditions
          }
        });

        if (conflict) {
          const usedEmail = email && conflict.email === email;
          const usedPhone = phone && conflict.phone === phone;
          const field = usedEmail && usedPhone
            ? 'cet email et ce numéro de téléphone sont déjà utilisés'
            : usedEmail
            ? 'cet email est déjà utilisé'
            : 'ce numéro de téléphone est déjà utilisé';
          return res.status(400).json({
            error: 'UpdateError',
            message: `Modification impossible : ${field} par un autre client.`
          });
        }
      }

      await customer.update(req.body);
      return res.status(200).json(customer);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification des ventes liées
      const saleCount = await Sale.count({ where: { customerId: id, tenantId } });
      if (saleCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: 'Suppression impossible : ce client possède un historique de transactions.' 
        });
      }

      const customer = await Customer.findOne({ where: { id, tenantId, status: 'actif' } });
      if (!customer) return res.status(404).json({ error: 'NotFound', message: 'Client introuvable ou déjà supprimé.' });

      // 2. Suppression logique
      await customer.update({ 
        status: 'supprimer',
        deletedAt: new Date(),
        isActive: false
      });

      return res.status(200).json({ message: 'Le client a été marqué comme supprimé avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}