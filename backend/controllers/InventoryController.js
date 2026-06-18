
import { StockItem, ProductMovement, SaleItem } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { NotificationService } from '../services/NotificationService.js';

async function checkActiveInventory(tenantId) {
  try {
    const [active] = await sequelize.query(
      'SELECT name FROM inventory_campaigns WHERE tenant_id = :tenantId AND status = \'DRAFT\' LIMIT 1',
      { replacements: { tenantId }, type: sequelize.QueryTypes.SELECT }
    );
    if (active) throw new Error(`Action bloquée : Un inventaire physique ("${active.name}") est actuellement en cours.`);
  } catch (err) {
    // Ne re-lancer que l'erreur métier (campagne active détectée)
    if (err.message && err.message.startsWith('Action bloquée')) throw err;
    // Toute autre erreur DB (table inexistante, connexion, etc.) : on laisse passer
  }
}

// Génère un SKU court et tente de garantir l'unicité par tenant
async function generateUniqueSKU(tenantId, name = 'PRD') {
  const prefix = (name || 'PRD').toString().replace(/[^A-Za-z0-9]/g, '').slice(0,3).toUpperCase() || 'PRD';
  for (let i = 0; i < 6; i++) {
    const timePart = Date.now().toString(36).toUpperCase().slice(-5);
    const randPart = Math.random().toString(36).substring(2,5).toUpperCase();
    const candidate = `${prefix}-${timePart}${randPart}`;
    const exists = await StockItem.findOne({ where: { tenantId, sku: candidate, status: 'actif' } });
    if (!exists) return candidate;
  }
  // Fallback to UUID-like string if many collisions
  return `SKU-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2,6).toUpperCase()}`;
}

export class InventoryController {
  static async list(req, res) {
    try {
      const items = await StockItem.findAll({ 
        where: { 
          tenantId: req.user.tenantId,
          status: ['actif', 'desactive']
        },
        order: [['name', 'ASC']]
      });
      return res.status(200).json(items || []);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async addMovement(req, res) {
    const transaction = await sequelize.transaction();
    try {
      await checkActiveInventory(req.user.tenantId);
      const { productId, type, qty, reason, referenceId } = req.body;
      const tenantId = req.user.tenantId;

      if (!productId) throw new Error('ID produit manquant.');
      const product = await StockItem.findOne({ where: { id: productId, tenantId, status: 'actif' }, transaction });
      if (!product) throw new Error('Produit introuvable.');

      const previousLevel = product.currentLevel;
      let newLevel = previousLevel;

      if (type === 'IN') {
        newLevel = previousLevel + parseInt(qty);
      } else if (type === 'OUT' || type === 'ADJUSTMENT') {
        if (type === 'OUT' && previousLevel < qty) throw new Error('Stock insuffisant.');
        newLevel = previousLevel - parseInt(qty);
      }

      await product.update({ currentLevel: newLevel }, { transaction });

      const movement = await ProductMovement.create({
        tenantId, stockItemId: productId, type, qty,
        reason: reason || 'Ajustement manuel',
        referenceId: referenceId || 'MANUAL',
        previousLevel, newLevel, userRef: req.user.name
      }, { transaction });

      await transaction.commit();
      return res.status(201).json({ movement, message: 'Mouvement enregistré' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ error: 'MovementError', message: error.message });
    }
  }

  static async createItem(req, res) {
    try {
      await checkActiveInventory(req.user.tenantId);
      const tenantId = req.user.tenantId;
      const { name, quantity, unitPrice, purchasePrice, minThreshold, subcategoryId, location, imageUrl } = req.body;

      // Vérification d'unicité : même nom dans la même sous-catégorie
      const existing = await StockItem.findOne({
        where: { tenantId, subcategoryId, name, status: 'actif' }
      });
      if (existing) {
        return res.status(400).json({ error: 'CreateError', message: `Un produit nommé "${name}" existe déjà dans cette sous-catégorie.` });
      }

      const sku = await generateUniqueSKU(tenantId, name);
      const item = await StockItem.create({
        sku,
        name,
        tenantId,
        subcategoryId,
        purchasePrice: purchasePrice || 0,
        unitPrice: unitPrice || 0,
        currentLevel: quantity || 0,
        quantity: quantity || 0,
        minThreshold: minThreshold || 5,
        location,
        imageUrl,
        status: 'actif'
      });
      return res.status(201).json(item);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  static async updateItem(req, res) {
    try {
      await checkActiveInventory(req.user.tenantId);
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // Vérification des ventes liées avant modification
      const saleCount = await SaleItem.count({ where: { stock_item_id: id } });
      if (saleCount > 0) {
        return res.status(403).json({ 
          error: 'UpdateLocked', 
          message: 'Modification impossible : ce produit est rattaché à une ou plusieurs ventes.' 
        });
      }

      const item = await StockItem.findOne({ where: { id, tenantId } });
      if (!item) return res.status(404).json({ error: 'NotFound', message: 'Produit introuvable.' });
      
      // Prevent SKU changes from client side - always keep SKU immutable via API
      const { sku, ...updates } = req.body;
      await item.update(updates);
      return res.status(200).json(item);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  static async deleteItem(req, res) {
    try {
      await checkActiveInventory(req.user.tenantId);
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification stricte des ventes liées
      const saleCount = await SaleItem.count({ where: { stock_item_id: id } });
      if (saleCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: 'Suppression impossible : ce produit figure dans des transactions de vente.' 
        });
      }

      const item = await StockItem.findOne({ where: { id, tenantId, status: 'actif' } });
      if (!item) return res.status(404).json({ error: 'NotFound', message: 'Produit introuvable ou déjà supprimé.' });
      
      // 2. Suppression logique : Changement de statut
      await item.update({ 
        status: 'supprimer',
        deletedAt: new Date()
      });

      return res.status(200).json({ message: 'Le produit a été marqué comme supprimé avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}
