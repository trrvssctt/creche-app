import Department from '../models/Department.js';
import { Employee } from '../models/Employee.js';

export class DepartmentController {

  /**
   * 📋 Liste des départements pour le tenant
   */
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      
      // Récupérer les départements avec le compte d'employés
      const departments = await Department.findAll({
        where: { 
          tenantId: tenantId 
        },
        order: [['name', 'ASC']],
        raw: false
      });

      // Enrichir avec le nombre d'employés par département
      const departmentsWithEmployeeCount = await Promise.all(
        departments.map(async (dept) => {
          const employeeCount = await Employee.count({
            where: {
              tenantId: tenantId,
              departmentId: dept.id // Use departmentId instead of department name
            }
          });

          return {
            ...dept.toJSON(),
            employeeCount
          };
        })
      );

      return res.status(200).json(departmentsWithEmployeeCount);
    } catch (error) {
      console.error('List Departments Error:', error);
      return res.status(400).json({ 
        error: 'ListError', 
        message: 'Erreur lors du chargement des départements.' 
      });
    }
  }

  /**
   * 🔍 Récupérer un département par ID
   */
  static async show(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const department = await Department.findOne({
        where: { 
          id, 
          tenantId: tenantId 
        }
      });

      if (!department) {
        return res.status(404).json({ 
          error: 'NotFound', 
          message: 'Département introuvable.' 
        });
      }

      // Enrichir avec les informations du manager et le nombre d'employés
      const employeeCount = await Employee.count({
        where: {
          tenantId: tenantId,
          departmentId: id
        }
      });

      let manager = null;
      if (department.managerId) {
        manager = await Employee.findOne({
          where: { 
            id: department.managerId, 
            tenantId: tenantId 
          },
          attributes: ['id', 'firstName', 'lastName', 'email']
        });
      }

      return res.status(200).json({
        ...department.toJSON(),
        employeeCount,
        manager
      });
    } catch (error) {
      console.error('Show Department Error:', error);
      return res.status(400).json({ 
        error: 'ShowError', 
        message: 'Erreur lors de la récupération du département.' 
      });
    }
  }

  /**
   * ✅ Créer un nouveau département
   */
  static async create(req, res) {
    try {
      const { name, description, managerId } = req.body;
      const tenantId = req.user.tenantId;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'ValidationError', 
          message: 'Le nom du département est obligatoire.' 
        });
      }

      // Vérifier l'unicité du nom dans le tenant
      const existing = await Department.findOne({
        where: { 
          tenantId: tenantId, 
          name: name.trim() 
        }
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'DuplicateError', 
          message: 'Un département avec ce nom existe déjà.' 
        });
      }

      // Vérifier que le manager existe s'il est spécifié
      if (managerId) {
        const manager = await Employee.findOne({
          where: { 
            id: managerId, 
            tenantId: tenantId 
          }
        });

        if (!manager) {
          return res.status(400).json({ 
            error: 'ValidationError', 
            message: 'Le manager spécifié n\'existe pas.' 
          });
        }
      }

      const department = await Department.create({
        tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        managerId: managerId || null
      });

      return res.status(201).json(department);
    } catch (error) {
      console.error('Create Department Error:', error);
      
      // Gestion spécifique des erreurs de contrainte d'unicité
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'DuplicateError', 
          message: 'Un département avec ce nom existe déjà.' 
        });
      }

      return res.status(400).json({ 
        error: 'CreateError', 
        message: 'Erreur lors de la création du département.' 
      });
    }
  }

  /**
   * 📝 Modifier un département
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, managerId } = req.body;
      const tenantId = req.user.tenantId;

      const department = await Department.findOne({
        where: { 
          id, 
          tenantId: tenantId 
        }
      });

      if (!department) {
        return res.status(404).json({ 
          error: 'NotFound', 
          message: 'Département introuvable.' 
        });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'ValidationError', 
          message: 'Le nom du département est obligatoire.' 
        });
      }

      // Vérifier l'unicité du nom (sauf pour le département actuel)
      if (name.trim() !== department.name) {
        const existing = await Department.findOne({
          where: { 
            tenantId: tenantId, 
            name: name.trim(),
            id: { [Department.sequelize.Op.ne]: id }
          }
        });

        if (existing) {
          return res.status(409).json({ 
            error: 'DuplicateError', 
            message: 'Un département avec ce nom existe déjà.' 
          });
        }
      }

      // Vérifier que le manager existe s'il est spécifié
      if (managerId) {
        const manager = await Employee.findOne({
          where: { 
            id: managerId, 
            tenantId: tenantId 
          }
        });

        if (!manager) {
          return res.status(400).json({ 
            error: 'ValidationError', 
            message: 'Le manager spécifié n\'existe pas.' 
          });
        }
      }

      // Mettre à jour le département
      await department.update({
        name: name.trim(),
        description: description?.trim() || null,
        managerId: managerId || null
      });

      return res.status(200).json(department);
    } catch (error) {
      console.error('Update Department Error:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'DuplicateError', 
          message: 'Un département avec ce nom existe déjà.' 
        });
      }

      return res.status(400).json({ 
        error: 'UpdateError', 
        message: 'Erreur lors de la modification du département.' 
      });
    }
  }

  /**
   * 🗑️ Supprimer un département
   */
  static async remove(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      const department = await Department.findOne({
        where: { 
          id, 
          tenantId: tenantId 
        }
      });

      if (!department) {
        return res.status(404).json({ 
          error: 'NotFound', 
          message: 'Département introuvable.' 
        });
      }

      // Vérification des contraintes : empêcher la suppression s'il y a des employés associés
      const employeeCount = await Employee.count({
        where: {
          tenantId: tenantId,
          departmentId: id
        }
      });

      if (employeeCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: `Suppression impossible : ${employeeCount} employé(s) sont encore rattachés à ce département.` 
        });
      }

      // Supprimer le département
      await department.destroy();

      return res.status(200).json({ 
        message: 'Département supprimé avec succès.' 
      });
    } catch (error) {
      console.error('Delete Department Error:', error);
      return res.status(400).json({ 
        error: 'DeleteError', 
        message: 'Erreur lors de la suppression du département.' 
      });
    }
  }

  /**
   * Legacy method for compatibility
   */
  static async get(req, res) {
    return await DepartmentController.show(req, res);
  }

  /**
   * 👥 Récupérer les employés potentiels pour être managers
   */
  static async getAvailableManagers(req, res) {
    try {
      const tenantId = req.user.tenantId;
      
      const employees = await Employee.findAll({
        where: { 
          tenantId: tenantId 
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'position'],
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

      return res.status(200).json(employees);
    } catch (error) {
      console.error('Get Available Managers Error:', error);
      return res.status(400).json({ 
        error: 'ListError', 
        message: 'Erreur lors du chargement des employés.' 
      });
    }
  }
}