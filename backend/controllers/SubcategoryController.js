import { Subcategory, Category, StockItem } from '../models/index.js';

export class SubcategoryController {
  static async list(req, res) {
    try {
      const subcats = await Subcategory.findAll({ 
        where: { 
          tenantId: req.user.tenantId,
          status: 'actif' 
        }, 
        order: [['name','ASC']] 
      });
      return res.status(200).json(subcats);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { name, description, categoryId } = req.body;
      
      const cat = await Category.findOne({ where: { id: categoryId, tenantId: tenantId, status: 'actif' } });
      if (!cat) return res.status(400).json({ error: 'CreateError', message: 'Catégorie parent introuvable.' });

      const existing = await Subcategory.findOne({ 
        where: { tenantId: tenantId, categoryId: categoryId, name, status: 'actif' } 
      });
      if (existing) return res.status(400).json({ error: 'CreateError', message: 'Cette sous-catégorie existe déjà dans ce segment.' });

      const sc = await Subcategory.create({ tenantId, categoryId, name, description, status: 'actif' });
      return res.status(201).json(sc);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // Vérification des dépendances produits avant modification
      const productCount = await StockItem.count({ where: { subcategoryId: id, tenantId: tenantId } });
      if (productCount > 0) {
        return res.status(403).json({ 
          error: 'UpdateLocked', 
          message: 'Modification impossible : des produits sont rattachés à cette sous-catégorie.' 
        });
      }

      const sc = await Subcategory.findOne({ where: { id, tenantId: tenantId, status: 'actif' } });
      if (!sc) return res.status(404).json({ error: 'NotFound', message: 'Sous-catégorie introuvable.' });
      
      await sc.update(req.body);
      return res.status(200).json(sc);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification stricte des produits liés
      const productCount = await StockItem.count({ where: { subcategoryId: id, tenantId: tenantId } });
      if (productCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: 'Suppression impossible : cette sous-catégorie contient encore des articles en stock.' 
        });
      }

      const sc = await Subcategory.findOne({ where: { id, tenantId: tenantId, status: 'actif' } });
      if (!sc) return res.status(404).json({ error: 'NotFound', message: 'Sous-catégorie introuvable ou déjà supprimée.' });
      
      // 2. Suppression logique : Changement de statut
      await sc.update({ 
        status: 'supprimer',
        deletedAt: new Date()
      });

      return res.status(200).json({ message: 'La sous-catégorie a été marquée comme supprimée avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}

export default SubcategoryController;