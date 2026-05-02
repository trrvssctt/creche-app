
import { StockItem, ProductMovement } from '../models/index.js';
import { Op } from 'sequelize';
import axios from 'axios';

export class AIService {
  /**
   * Analyse la vélocité d'un produit (ventes moyennes par jour)
   */
  static async calculateVelocity(tenantId, productId, days = 30) {
    // ProductMovement does not have tenantId column; filter by stockItemId (productId)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const movements = await ProductMovement.findAll({
      where: {
        stockItemId: productId,
        type: 'OUT',
        createdAt: { [Op.gt]: since }
      }
    });

    const totalOut = movements.reduce((sum, m) => sum + m.qty, 0);
    return totalOut / days;
  }

  /**
   * Prédit la date de rupture de stock (ETA)
   */
  static async predictStockOut(tenantId, productId) {
    const product = await StockItem.findOne({ where: { id: productId, tenantId } });
    if (!product) return null;
    const velocity = await this.calculateVelocity(tenantId, productId);

    if (velocity <= 0) return null; // Pas de mouvement sortant

    const daysRemaining = Math.floor(product.currentLevel / velocity);
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + daysRemaining);

    return {
      daysRemaining,
      etaDate,
      velocity
    };
  }

  /**
   * Synchronisation avec le webhook n8n pour analyse LLM avancée
   */
  static async triggerN8NAnalysis(tenantId, data) {
    const N8N_WEBHOOK = process.env.N8N_AI_ORCHESTRATOR_URL;
    if (!N8N_WEBHOOK) return;

    try {
      await axios.post(N8N_WEBHOOK, {
        tenantId,
        timestamp: new Date(),
        payload: data
      });
    } catch (error) {
      console.error('[IA-KERNEL] n8n Bridge Error:', error.message);
    }
  }

  /**
   * Génère des prévisions pour tous les produits d'un tenant sur une période (ex: next_90_days)
   * Retourne un tableau { sku, forecastedLevel }
   */
  static async generateForecasts(tenantId, period) {
    // parse period like 'next_90_days' => days=90, default 30
    let days = 30;
    if (typeof period === 'string') {
      const m = period.match(/next_(\d+)_days/);
      if (m) days = parseInt(m[1], 10);
    } else if (typeof period === 'number') {
      days = period;
    }

    const items = await StockItem.findAll({ where: { tenantId } });
    const predictions = [];
    for (const item of items) {
      const velocity = await this.calculateVelocity(tenantId, item.id, Math.max(30, days));
      // forecastedLevel = currentLevel - velocity * days
      const forecastedLevel = Math.max(0, Math.round(item.currentLevel - velocity * days));
      predictions.push({ sku: item.sku, forecastedLevel });
    }
    return predictions;
  }
}
