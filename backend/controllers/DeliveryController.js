import { Delivery, DeliveryItem, Supplier, StockItem, ProductMovement, AuditLog } from '../models/index.js';
import crypto from 'crypto';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

/**
 * Génère une référence unique de livraison : LIV-YYYYMMDD-XXXX
 */
async function generateDeliveryReference(tenantId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LIV-${dateStr}`;
  const count = await Delivery.count({
    where: { tenantId, reference: { [Op.like]: `${prefix}%` } }
  });
  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${seq}`;
}

export class DeliveryController {
  /**
   * Liste des livraisons avec filtres optionnels (fournisseur, statut, date)
   */
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { supplierId, status, from, to } = req.query;

      const where = { tenantId };
      if (supplierId) where.supplierId = supplierId;
      if (status) where.status = status;
      if (from || to) {
        where.deliveryDate = {};
        if (from) where.deliveryDate[Op.gte] = from;
        if (to) where.deliveryDate[Op.lte] = to;
      }

      const deliveries = await Delivery.findAll({
        where,
        include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'companyName', 'phone'] }],
        order: [['deliveryDate', 'DESC']]
      });

      return res.status(200).json(deliveries);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  /**
   * Détails d'une livraison avec ses lignes et les produits associés
   */
  static async getDetails(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const delivery = await Delivery.findOne({
        where: { id, tenantId },
        include: [
          { model: Supplier, as: 'supplier' },
          {
            model: DeliveryItem, as: 'items',
            include: [{ model: StockItem, as: 'stock_item', attributes: ['id', 'sku', 'name', 'currentLevel', 'purchasePrice', 'unitPrice'] }]
          }
        ]
      });

      if (!delivery) return res.status(404).json({ error: 'NotFound', message: 'Livraison introuvable.' });

      return res.status(200).json(delivery);
    } catch (error) {
      return res.status(500).json({ error: 'DetailError', message: error.message });
    }
  }

  /**
   * Création d'une livraison avec ses lignes.
   * - Génère automatiquement la référence
   * - Calcule le total HT
   * - Si statut RECEIVED : met à jour le stock et le prix d'achat (PUMP) de chaque produit
   */
  static async create(req, res) {
    const t = await sequelize.transaction();
    try {
      const tenantId = req.user.tenantId;
      const { supplierId, deliveryDate, notes, purchaseOrderRef, status = 'PENDING', items = [] } = req.body;

      // Vérifier que le fournisseur existe
      const supplier = await Supplier.findOne({ where: { id: supplierId, tenantId } });
      if (!supplier) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound', message: 'Fournisseur introuvable.' });
      }

      const reference = await generateDeliveryReference(tenantId);

      // Calculer le total HT
      const totalHt = items.reduce((sum, item) => sum + (item.quantityReceived * item.purchasePrice), 0);

      const delivery = await Delivery.create({
        tenantId, supplierId, reference, deliveryDate,
        notes, purchaseOrderRef, status,
        totalHt
      }, { transaction: t });

      // Créer les lignes
      for (const item of items) {
        const lineTotal = parseFloat(item.quantityReceived) * parseFloat(item.purchasePrice);
        await DeliveryItem.create({
          deliveryId: delivery.id,
          stockItemId: item.stockItemId,
          quantityReceived: item.quantityReceived,
          purchasePrice: item.purchasePrice,
          totalHt: lineTotal
        }, { transaction: t });

        // Si livraison reçue : mettre à jour le stock et le prix d'achat moyen pondéré
        if (status === 'RECEIVED') {
          await DeliveryController._applyStockIn(
            item.stockItemId, item.quantityReceived, item.purchasePrice,
            delivery.id, reference, req.user.name, tenantId, t
          );
        }
      }

      await t.commit();

      await AuditLog.create({
        tenantId,
        userId: req.user.id,
        action: 'DELIVERY_CREATED',
        resource: delivery.id,
        severity: 'LOW',
        sha256Signature: crypto.createHash('sha256').update(`${tenantId}:${req.user.id}:${delivery.id}:${Date.now()}`).digest('hex')
      });

      return res.status(201).json({ ...delivery.toJSON(), reference });
    } catch (error) {
      await t.rollback();
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  /**
   * Valider une livraison PENDING → RECEIVED
   * Met à jour le stock pour chaque ligne
   */
  static async validate(req, res) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const delivery = await Delivery.findOne({
        where: { id, tenantId },
        include: [{ model: DeliveryItem, as: 'items' }]
      });

      if (!delivery) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound', message: 'Livraison introuvable.' });
      }

      if (delivery.status !== 'PENDING' && delivery.status !== 'PARTIAL') {
        await t.rollback();
        return res.status(400).json({ error: 'StatusError', message: 'Seules les livraisons en attente peuvent être validées.' });
      }

      for (const item of delivery.items) {
        await DeliveryController._applyStockIn(
          item.stockItemId, item.quantityReceived, item.purchasePrice,
          delivery.id, delivery.reference, req.user.name, tenantId, t
        );
      }

      await delivery.update({ status: 'RECEIVED' }, { transaction: t });
      await t.commit();

      return res.status(200).json({ message: 'Livraison validée et stock mis à jour.', delivery });
    } catch (error) {
      await t.rollback();
      return res.status(500).json({ error: 'ValidateError', message: error.message });
    }
  }

  /**
   * Annuler une livraison (statut CANCELLED) — ne modifie pas le stock si déjà reçue
   */
  static async cancel(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const delivery = await Delivery.findOne({ where: { id, tenantId } });
      if (!delivery) return res.status(404).json({ error: 'NotFound', message: 'Livraison introuvable.' });

      if (delivery.status === 'RECEIVED') {
        return res.status(403).json({ error: 'CancelLocked', message: 'Impossible d\'annuler une livraison déjà reçue.' });
      }

      await delivery.update({ status: 'CANCELLED' });
      return res.status(200).json({ message: 'Livraison annulée avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'CancelError', message: error.message });
    }
  }

  /**
   * Retourne toutes les livraisons liées à un produit spécifique
   * Permet de savoir quel fournisseur a livré un produit
   */
  static async getByProduct(req, res) {
    try {
      const { stockItemId } = req.params;
      const tenantId = req.user.tenantId;

      const deliveryItems = await DeliveryItem.findAll({
        where: { stockItemId },
        include: [
          {
            model: Delivery,
            as: 'delivery', // Note: alias inverse non défini, utilisation directe
            where: { tenantId, status: { [Op.ne]: 'CANCELLED' } },
            include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'companyName', 'phone', 'email'] }]
          }
        ],
        order: [[{ model: Delivery, as: 'delivery' }, 'deliveryDate', 'DESC']]
      });

      return res.status(200).json(deliveryItems);
    } catch (error) {
      return res.status(500).json({ error: 'ProductHistoryError', message: error.message });
    }
  }

  /**
   * Applique un mouvement de stock entrant et met à jour le PUMP du produit
   * @private
   */
  static async _applyStockIn(stockItemId, qty, purchasePrice, deliveryId, reference, userRef, tenantId, t) {
    const stockItem = await StockItem.findOne({ where: { id: stockItemId, tenantId } });
    if (!stockItem) throw new Error(`Produit ${stockItemId} introuvable.`);

    const previousLevel = parseInt(stockItem.currentLevel) || 0;
    const newLevel = previousLevel + parseInt(qty);

    // Calcul du Prix Unitaire Moyen Pondéré (PUMP)
    const oldStock = previousLevel;
    const oldPrice = parseFloat(stockItem.purchasePrice) || 0;
    const newQty = parseInt(qty);
    const newPrice = parseFloat(purchasePrice);
    const pump = oldStock > 0
      ? ((oldStock * oldPrice) + (newQty * newPrice)) / (oldStock + newQty)
      : newPrice;

    await stockItem.update({
      currentLevel: newLevel,
      quantity: newLevel,
      purchasePrice: Math.round(pump * 100) / 100
    }, { transaction: t });

    await ProductMovement.create({
      tenantId,
      stockItemId,
      type: 'IN',
      qty: parseInt(qty),
      previousLevel,
      newLevel,
      reason: `Livraison fournisseur — Réf: ${reference}`,
      referenceId: deliveryId,
      userRef: userRef,
      movementDate: new Date()
    }, { transaction: t });
  }
}
