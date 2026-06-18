
import { ProductMovement, StockItem } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op, fn, col } from 'sequelize';

export class StockMovementController {
  static async list(req, res) {
    try {
      const movements = await ProductMovement.findAll({
        where: { tenantId: req.user.tenantId },
        include: [{ model: StockItem, attributes: ['name', 'sku'] }],
        order: [['createdAt', 'DESC']],
        limit: 500
      });
      return res.status(200).json(movements);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getStats(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = await ProductMovement.findAll({
        where: { 
          tenantId,
          createdAt: { [Op.gt]: thirtyDaysAgo }
        },
        attributes: [
          [fn('date_trunc', 'day', col('created_at')), 'day'],
          [fn('SUM', sequelize.literal("CASE WHEN type = 'IN' THEN qty ELSE 0 END")), 'totalIn'],
          [fn('SUM', sequelize.literal("CASE WHEN type = 'OUT' THEN qty ELSE 0 END")), 'totalOut']
        ],
        group: [fn('date_trunc', 'day', col('created_at'))],
        order: [[fn('date_trunc', 'day', col('created_at')), 'ASC']]
      });

      return res.status(200).json(stats);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createBulkIn(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { items, reason, reference } = req.body;
      const tenantId = req.user.tenantId;
      const results = [];

      for (const item of items) {
        const product = await StockItem.findOne({ where: { id: item.productId, tenantId }, transaction });
        if (!product) throw new Error(`Produit ${item.productId} non trouvé.`);

        const prevLevel = product.currentLevel;
        const newLevel = prevLevel + parseInt(item.quantity);

        const movement = await ProductMovement.create({
          tenantId,
          stockItemId: item.productId,
          type: 'IN',
          qty: item.quantity,
          previousLevel: prevLevel,
          newLevel: newLevel,
          reason: reason || 'Réapprovisionnement',
          referenceId: reference || 'BATCH_IN',
          userRef: req.user.name
        }, { transaction });

        await product.update({ currentLevel: newLevel }, { transaction });
        results.push(movement);
      }

      await transaction.commit();
      return res.status(201).json(results);
    } catch (error) {
      await transaction.rollback();
      return res.status(400).json({ error: error.message });
    }
  }
}

export default StockMovementController;