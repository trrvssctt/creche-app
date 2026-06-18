import { Category, Subcategory } from '../models/index.js';

export class CategoryController {
  static async list(req, res) {
    try {
      const categories = await Category.findAll({ 
        where: { 
          tenant_id: req.user.tenantId,
          status: 'actif' 
        }, 
        order: [['name','ASC']] 
      });
      return res.status(200).json(categories);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { name, description } = req.body;
      
      const existing = await Category.findOne({ 
        where: { tenant_id: tenantId, name, status: 'actif' } 
      });
      
      if (existing) return res.status(400).json({ error: 'CreateError', message: 'Cette catégorie existe déjà.' });
      
      const cat = await Category.create({ tenantId, name, description, status: 'actif' });
      return res.status(201).json(cat);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // Vérification des dépendances avant modification
      const subCount = await Subcategory.count({ where: { category_id: id, tenant_id: tenantId } });
      if (subCount > 0) {
        return res.status(403).json({ 
          error: 'UpdateLocked', 
          message: 'Modification impossible : cette catégorie est liée à des sous-catégories actives.' 
        });
      }

      const cat = await Category.findOne({ where: { id, tenant_id: tenantId, status: 'actif' } });
      if (!cat) return res.status(404).json({ error: 'NotFound', message: 'Catégorie introuvable.' });
      
      await cat.update(req.body);
      return res.status(200).json(cat);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification stricte des dépendances
      const subCount = await Subcategory.count({ where: { category_id: id, tenant_id: tenantId } });
      if (subCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: 'Suppression impossible : des sous-catégories sont encore rattachées à ce segment.' 
        });
      }

      const cat = await Category.findOne({ where: { id, tenant_id: tenantId, status: 'actif' } });
      if (!cat) return res.status(404).json({ error: 'NotFound', message: 'Catégorie introuvable ou déjà supprimée.' });
      
      // 2. Suppression logique : Changement de statut
      await cat.update({ 
        status: 'supprimer',
        deletedAt: new Date()
      });

      return res.status(200).json({ message: 'La catégorie a été marquée comme supprimée avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}

export default CategoryController;