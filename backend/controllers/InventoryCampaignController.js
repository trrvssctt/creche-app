import { StockItem, ProductMovement } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { DataTypes, Model } from 'sequelize';

// Définition des modèles pour l'audit physique
export class InventoryCampaign extends Model {}
InventoryCampaign.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'DRAFT' },
}, { sequelize, modelName: 'inventory_campaign', tableName: 'inventory_campaigns', underscored: true });

export class InventoryCampaignItem extends Model {}
InventoryCampaignItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaignId: { type: DataTypes.UUID, allowNull: false, field: 'campaign_id' },
  stockItemId: { type: DataTypes.UUID, allowNull: false, field: 'stock_item_id' },
  systemQty: { type: DataTypes.INTEGER, allowNull: false, field: 'system_qty' },
  countedQty: { type: DataTypes.INTEGER, defaultValue: 0, field: 'counted_qty' }
}, { sequelize, modelName: 'inventory_campaign_item', tableName: 'inventory_campaign_items', underscored: true });

InventoryCampaign.hasMany(InventoryCampaignItem, { foreignKey: 'campaign_id', as: 'items' });
InventoryCampaignItem.belongsTo(InventoryCampaign, { foreignKey: 'campaign_id' });
InventoryCampaignItem.belongsTo(StockItem, { foreignKey: 'stock_item_id', as: 'stock_item' });

export class InventoryCampaignController {
  static async list(req, res) {
    try {
      const campaigns = await InventoryCampaign.findAll({
        where: { tenantId: req.user.tenantId },
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(campaigns);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { name } = req.body;
      const tenantId = req.user.tenantId;

      const existing = await InventoryCampaign.findOne({ where: { tenantId, status: 'DRAFT' }, transaction });
      if (existing) throw new Error(`Une campagne d'inventaire est déjà active : ${existing.name}`);

      const campaign = await InventoryCampaign.create({
        tenantId,
        name,
        status: 'DRAFT'
      }, { transaction });

      const currentStock = await StockItem.findAll({ where: { tenantId }, transaction });
      
      const campaignItems = currentStock.map(item => ({
        campaignId: campaign.id,
        stockItemId: item.id,
        systemQty: item.currentLevel,
        countedQty: item.currentLevel
      }));

      await InventoryCampaignItem.bulkCreate(campaignItems, { transaction });

      await transaction.commit();
      return res.status(201).json(campaign);
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  static async getDetails(req, res) {
    try {
      const { id } = req.params;
      const campaign = await InventoryCampaign.findOne({
        where: { id, tenantId: req.user.tenantId },
        include: [{ 
          model: InventoryCampaignItem, 
          as: 'items',
          include: [{ model: StockItem, as: 'stock_item', attributes: ['name', 'sku'] }]
        }]
      });
      if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
      return res.status(200).json(campaign);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateItem(req, res) {
    try {
      const { campaignId, itemId } = req.params;
      const { countedQty } = req.body;

      const item = await InventoryCampaignItem.findOne({
        where: { id: itemId, campaignId }
      });

      if (!item) return res.status(404).json({ error: 'Ligne introuvable' });
      
      await item.update({ countedQty });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async validate(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { syncStock } = req.body;
      const tenantId = req.user.tenantId;

      const campaign = await InventoryCampaign.findOne({
        where: { id, tenantId },
        include: [{ model: InventoryCampaignItem, as: 'items' }],
        transaction
      });

      if (!campaign) throw new Error('Campagne introuvable.');
      if (campaign.status === 'VALIDATED') throw new Error('Cette campagne est déjà clôturée.');
      
      if (syncStock) {
        for (const item of campaign.items) {
          if (item.countedQty !== item.systemQty) {
            const product = await StockItem.findByPk(item.stockItemId, { transaction });
            if (product) {
              const previous = product.currentLevel;
              const delta = item.countedQty - previous;
              
              await product.update({ currentLevel: item.countedQty }, { transaction });
              
              // On enregistre le mouvement avec le type ADJUSTMENT pour la traçabilité
              await ProductMovement.create({
                tenantId,
                stockItemId: item.stockItemId,
                type: 'ADJUSTMENT',
                qty: Math.abs(delta), // Valeur absolue de l'ajustement
                previousLevel: previous,
                newLevel: item.countedQty,
                reason: `Régularisation Inventaire : ${campaign.name} (${delta > 0 ? '+' : ''}${delta})`,
                userRef: req.user.name,
                referenceId: campaign.id.slice(0, 8)
              }, { transaction });
            }
          }
        }
      }

      await campaign.update({ status: 'VALIDATED' }, { transaction });
      await transaction.commit();
      return res.status(200).json({ message: 'Campagne clôturée avec succès.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ error: 'ValidationError', message: error.message });
    }
  }

  static async suspend(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const campaign = await InventoryCampaign.findOne({ where: { id, tenantId } });
      if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
      if (campaign.status === 'VALIDATED') return res.status(400).json({ error: 'Cette campagne est déjà clôturée et ne peut être suspendue.' });
      await campaign.update({ status: 'SUSPENDED' });
      return res.status(200).json({ message: 'Campagne suspendue avec succès.', campaign });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async cancel(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const campaign = await InventoryCampaign.findOne({ where: { id, tenantId } });
      if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
      if (campaign.status === 'VALIDATED') return res.status(400).json({ error: 'Une campagne clôturée ne peut pas être annulée.' });
      await campaign.update({ status: 'CANCELLED' });
      return res.status(200).json({ message: 'Campagne annulée avec succès.', campaign });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async resume(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const campaign = await InventoryCampaign.findOne({ where: { id, tenantId } });
      if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
      if (campaign.status !== 'SUSPENDED') return res.status(400).json({ error: 'Seules les campagnes suspendues peuvent être relancées.' });
      await campaign.update({ status: 'DRAFT' });
      return res.status(200).json({ message: 'Campagne relancée avec succès.', campaign });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}