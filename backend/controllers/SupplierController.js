import { Supplier, Delivery, AuditLog } from '../models/index.js';
import crypto from 'crypto';
import { Op } from 'sequelize';

export class SupplierController {
  /**
   * Liste de tous les fournisseurs actifs du tenant
   */
  static async list(req, res) {
    try {
      // Retourne actif + inactif (pas les supprimés) pour que le frontend puisse gérer le toggle
      const suppliers = await Supplier.findAll({
        where: {
          tenantId: req.user.tenantId,
          status: { [Op.in]: ['actif', 'inactif'] }
        },
        order: [['companyName', 'ASC']]
      });
      return res.status(200).json(suppliers);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  /**
   * Vue détaillée d'un fournisseur : informations + historique des livraisons
   */
  static async getDetails(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const supplier = await Supplier.findOne({ where: { id, tenantId } });
      if (!supplier) return res.status(404).json({ error: 'NotFound', message: 'Fournisseur introuvable.' });

      const deliveries = await Delivery.findAll({
        where: { supplierId: id, tenantId },
        limit: 10,
        order: [['deliveryDate', 'DESC']]
      });

      const totalOrdered = await Delivery.sum('totalHt', {
        where: { supplierId: id, tenantId, status: { [Op.ne]: 'CANCELLED' } }
      }) || 0;

      const deliveryCount = await Delivery.count({
        where: { supplierId: id, tenantId, status: { [Op.ne]: 'CANCELLED' } }
      });

      return res.status(200).json({
        supplier,
        stats: {
          totalOrdered: parseFloat(totalOrdered),
          deliveryCount
        },
        recentDeliveries: deliveries
      });
    } catch (error) {
      return res.status(500).json({ error: 'DetailError', message: error.message });
    }
  }

  /**
   * Création d'un fournisseur
   */
  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { email, phone, companyName } = req.body;

      // Cherche TOUT fournisseur correspondant, statut inclus (supprimé ou non)
      const orConditions = [
        ...(email    ? [{ email }]       : []),
        ...(phone    ? [{ phone }]       : []),
        ...(companyName ? [{ companyName }] : []),
      ];

      const existing = orConditions.length
        ? await Supplier.findOne({ where: { tenantId, [Op.or]: orConditions } })
        : null;

      if (existing) {
        if (existing.status === 'supprimer') {
          // Fournisseur supprimé : on autorise la recréation → on continue
        } else if (existing.status === 'inactif') {
          return res.status(400).json({
            error: 'CreateError',
            message: 'Un fournisseur avec le même email, téléphone ou nom existe déjà mais est désactivé — réactivez-le plutôt que d\'en créer un nouveau.'
          });
        } else {
          return res.status(400).json({
            error: 'CreateError',
            message: 'Un fournisseur actif existe déjà avec le même email, téléphone ou nom de société.'
          });
        }
      }

      const supplier = await Supplier.create({ ...req.body, tenantId });

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'SUPPLIER_CREATED',
        resource: supplier.id,
        severity: 'LOW',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:${req.user.id}:${supplier.id}:${Date.now()}`).digest('hex')
      });

      return res.status(201).json(supplier);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  /**
   * Mise à jour d'un fournisseur
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const supplier = await Supplier.findOne({
        where: { id, tenantId, status: { [Op.in]: ['actif', 'inactif'] } }
      });
      if (!supplier) return res.status(404).json({ error: 'NotFound', message: 'Fournisseur introuvable.' });

      await supplier.update(req.body);
      return res.status(200).json(supplier);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  /**
   * Activation / Désactivation d'un fournisseur (toggle)
   */
  static async toggle(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const supplier = await Supplier.findOne({
        where: { id, tenantId, status: { [Op.in]: ['actif', 'inactif'] } }
      });
      if (!supplier) return res.status(404).json({ error: 'NotFound', message: 'Fournisseur introuvable.' });

      const newStatus = supplier.status === 'actif' ? 'inactif' : 'actif';
      const newIsActive = newStatus === 'actif';
      await supplier.update({ status: newStatus, isActive: newIsActive });

      return res.status(200).json(supplier);
    } catch (error) {
      return res.status(400).json({ error: 'ToggleError', message: error.message });
    }
  }

  /**
   * Suppression logique d'un fournisseur
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const deliveryCount = await Delivery.count({ where: { supplierId: id, tenantId } });
      if (deliveryCount > 0) {
        return res.status(403).json({
          error: 'DeleteLocked',
          message: 'Suppression impossible : ce fournisseur possède un historique de livraisons.'
        });
      }

      const supplier = await Supplier.findOne({ where: { id, tenantId, status: 'actif' } });
      if (!supplier) return res.status(404).json({ error: 'NotFound', message: 'Fournisseur introuvable ou déjà supprimé.' });

      await supplier.update({ status: 'supprimer', deletedAt: new Date(), isActive: false });

      return res.status(200).json({ message: 'Le fournisseur a été supprimé avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}
