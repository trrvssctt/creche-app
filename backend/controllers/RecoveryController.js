
import { Customer, AuditLog } from '../models/index.js';
import { NotificationService } from '../services/NotificationService.js';
import { Op } from 'sequelize';
import crypto from 'crypto';

export class RecoveryController {
  /**
   * Liste tous les clients ayant une dette (balance positive)
   */
  static async listDebtors(req, res) {
    try {
      const debtors = await Customer.findAll({
        where: { 
          tenantId: req.user.tenantId,
          outstandingBalance: { [Op.gt]: 0 }
        },
        order: [['outstandingBalance', 'DESC']]
      });
      return res.status(200).json(debtors);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Envoi d'un mail de relance formel via le Kernel
   */
  static async sendEmailReminder(req, res) {
    try {
      const { customerId, template } = req.body;
      const customer = await Customer.findOne({ 
        where: { id: customerId, tenantId: req.user.tenantId } 
      });

      if (!customer || !customer.email) {
        return res.status(400).json({ error: 'Client introuvable ou email manquant.' });
      }

      await NotificationService.send('EMAIL', customer.email, {
        subject: `Relance Paiement : ${customer.companyName}`,
        message: template || `Cher client, nous vous rappelons que vous avez un encours de ${customer.outstandingBalance} F CFA à régulariser.`
      });

      // Audit de la relance
      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        action: 'RECOVERY_EMAIL_SENT',
        resource: `Customer: ${customer.companyName}`,
        severity: 'LOW',
        sha256Signature: crypto.createHash('sha256').update(`${customer.id}:email:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({ message: 'Email de relance envoyé.' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
