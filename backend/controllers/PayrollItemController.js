import { PayrollItem } from '../models/index.js';
import { Op } from 'sequelize';

export class PayrollItemController {
  
  /**
   * Récupérer toutes les rubriques de paie d'un tenant
   */
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { type, category, isActive } = req.query;

      const where = { tenantId };

      // Filtres optionnels
      if (type) where.type = type;
      if (category) where.category = category;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const payrollItems = await PayrollItem.findAll({
        where,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']]
      });

      return res.status(200).json(payrollItems);
    } catch (error) {
      console.error('PayrollItemController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Récupérer une rubrique spécifique
   */
  static async get(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const payrollItem = await PayrollItem.findOne({
        where: { id, tenantId }
      });

      if (!payrollItem) {
        return res.status(404).json({ error: 'Rubrique de paie non trouvée' });
      }

      return res.status(200).json(payrollItem);
    } catch (error) {
      console.error('PayrollItemController.get error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Créer une nouvelle rubrique de paie
   */
  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const {
        name,
        code,
        type,
        category,
        calculationType,
        defaultValue,
        percentage,
        formula,
        description,
        sortOrder
      } = req.body;

      // Validation des champs obligatoires
      if (!name || !code || !type || !category) {
        return res.status(400).json({ 
          error: 'Les champs nom, code, type et catégorie sont obligatoires' 
        });
      }

      // Vérifier que le code est unique pour ce tenant
      const existingItem = await PayrollItem.findOne({
        where: { 
          tenantId,
          [Op.or]: [
            { code },
            { name }
          ]
        }
      });

      if (existingItem) {
        return res.status(400).json({ 
          error: existingItem.code === code 
            ? 'Ce code existe déjà' 
            : 'Ce nom existe déjà' 
        });
      }

      const payrollItem = await PayrollItem.create({
        tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        category,
        calculationType: calculationType || 'FIXED',
        defaultValue: defaultValue || 0,
        percentage: percentage || 0,
        formula: formula || null,
        description: description || null,
        sortOrder: sortOrder || 0
      });

      return res.status(201).json(payrollItem);
    } catch (error) {
      console.error('PayrollItemController.create error:', error);
      
      // Gestion des erreurs de contraintes uniques
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          error: 'Ce code ou nom existe déjà pour votre organisation' 
        });
      }
      
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mettre à jour une rubrique de paie
   */
  static async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const payrollItem = await PayrollItem.findOne({
        where: { id, tenantId }
      });

      if (!payrollItem) {
        return res.status(404).json({ error: 'Rubrique de paie non trouvée' });
      }

      // Gestion spéciale pour les éléments système
      if (payrollItem.isSystemItem) {
        // Pour les éléments système, permettre seulement la modification du statut actif
        const { isActive } = req.body;
        
        if (isActive !== undefined) {
          await payrollItem.update({ isActive });
          return res.status(200).json(payrollItem);
        } else {
          return res.status(403).json({ 
            error: 'Les éléments système ne peuvent être modifiés que pour leur statut actif/inactif' 
          });
        }
      }

      const {
        name,
        code,
        type,
        category,
        calculationType,
        defaultValue,
        percentage,
        formula,
        description,
        sortOrder,
        isActive
      } = req.body;

      // Si le code ou nom change, vérifier l'unicité
      if ((code && code !== payrollItem.code) || (name && name !== payrollItem.name)) {
        const existingItem = await PayrollItem.findOne({
          where: { 
            tenantId,
            id: { [Op.ne]: id },
            [Op.or]: [
              ...(code ? [{ code: code.trim().toUpperCase() }] : []),
              ...(name ? [{ name: name.trim() }] : [])
            ]
          }
        });

        if (existingItem) {
          return res.status(400).json({ 
            error: 'Ce code ou nom existe déjà' 
          });
        }
      }

      // Mise à jour
      await payrollItem.update({
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(type && { type }),
        ...(category && { category }),
        ...(calculationType && { calculationType }),
        ...(defaultValue !== undefined && { defaultValue }),
        ...(percentage !== undefined && { percentage }),
        ...(formula !== undefined && { formula }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      });

      return res.status(200).json(payrollItem);
    } catch (error) {
      console.error('PayrollItemController.update error:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          error: 'Ce code ou nom existe déjà pour votre organisation' 
        });
      }
      
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Supprimer une rubrique de paie
   */
  static async delete(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const payrollItem = await PayrollItem.findOne({
        where: { id, tenantId }
      });

      if (!payrollItem) {
        return res.status(404).json({ error: 'Rubrique de paie non trouvée' });
      }

      // Empêcher la suppression des éléments système
      if (payrollItem.isSystemItem) {
        return res.status(403).json({ 
          error: 'Les éléments système ne peuvent pas être supprimés' 
        });
      }

      await payrollItem.destroy();

      return res.status(200).json({ message: 'Rubrique supprimée avec succès' });
    } catch (error) {
      console.error('PayrollItemController.delete error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Désactiver/Activer une rubrique de paie
   */
  static async toggleStatus(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const payrollItem = await PayrollItem.findOne({
        where: { id, tenantId }
      });

      if (!payrollItem) {
        return res.status(404).json({ error: 'Rubrique de paie non trouvée' });
      }

      await payrollItem.update({
        isActive: !payrollItem.isActive
      });

      return res.status(200).json(payrollItem);
    } catch (error) {
      console.error('PayrollItemController.toggleStatus error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Initialiser les rubriques par défaut pour un tenant
   */
  static async initializeDefaultItems(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const defaultItems = [
        {
          name: 'Salaire de Base',
          code: 'BASE_SALARY',
          type: 'EARNING',
          category: 'BASE_SALARY',
          calculationType: 'FIXED',
          isSystemItem: true,
          sortOrder: 1
        },
        {
          name: 'Prime de Transport',
          code: 'TRANSPORT_ALLOWANCE',
          type: 'EARNING',
          category: 'ALLOWANCE',
          calculationType: 'FIXED',
          defaultValue: 25000,
          sortOrder: 2
        },
        {
          name: 'Indemnité de Logement',
          code: 'HOUSING_ALLOWANCE',
          type: 'EARNING',
          category: 'ALLOWANCE',
          calculationType: 'PERCENTAGE',
          percentage: 10,
          sortOrder: 3
        },
        {
          name: 'Prime Exceptionnelle',
          code: 'EXCEPTIONAL_BONUS',
          type: 'EARNING',
          category: 'BONUS',
          calculationType: 'FIXED',
          sortOrder: 4
        },
        {
          name: 'Cotisation IPRES (Salarié)',
          code: 'IPRES_EMPLOYEE',
          type: 'DEDUCTION',
          category: 'SOCIAL_CHARGE',
          calculationType: 'PERCENTAGE',
          percentage: 5.6,
          isSystemItem: true,
          sortOrder: 10
        },
        {
          name: 'Cotisation CSS (Salarié)',
          code: 'CSS_EMPLOYEE',
          type: 'DEDUCTION',
          category: 'SOCIAL_CHARGE',
          calculationType: 'PERCENTAGE',
          percentage: 3.5,
          isSystemItem: true,
          sortOrder: 11
        },
        {
          name: 'Impôt sur le Revenu',
          code: 'INCOME_TAX',
          type: 'DEDUCTION',
          category: 'TAX',
          calculationType: 'FORMULA',
          formula: 'calculateIncomeTax(grossSalary)',
          isSystemItem: true,
          sortOrder: 12
        },
        {
          name: 'Avance sur Salaire',
          code: 'SALARY_ADVANCE',
          type: 'DEDUCTION',
          category: 'ADVANCE',
          calculationType: 'FIXED',
          sortOrder: 13
        }
      ];

      // Créer seulement ceux qui n'existent pas déjà
      const createdItems = [];
      for (const itemData of defaultItems) {
        const existing = await PayrollItem.findOne({
          where: { 
            tenantId,
            code: itemData.code
          }
        });

        if (!existing) {
          const item = await PayrollItem.create({
            tenantId,
            ...itemData
          });
          createdItems.push(item);
        }
      }

      return res.status(200).json({
        message: `${createdItems.length} rubriques par défaut créées`,
        items: createdItems
      });
    } catch (error) {
      console.error('PayrollItemController.initializeDefaultItems error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export default PayrollItemController;