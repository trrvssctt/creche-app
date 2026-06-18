import { Employee, Department, Contract, Leave } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { PayrollCalculationService } from '../services/PayrollCalculationService.js';

export class EmployeeController {
  /**
   * List employees with filtering, pagination and facets
   * Query params supported: q, department, status, position, managerId, hireFrom, hireTo, page, perPage, sortBy, sortDir
   */
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const {
        q,
        department,
        status,
        position,
        managerId,
        hireFrom,
        hireTo,
        page = 1,
        perPage = 25,
        sortBy = 'last_name',
        sortDir = 'ASC'
      } = req.query;

      const where = { tenantId };

      // Only show ACTIVE employees by default unless status is specifically requested
      if (status) {
        where.status = status;
      } else {
        where.status = 'ACTIVE'; // Default to active employees only
      }

      if (department) where.departmentId = department;
      if (position) where.position = position;
      if (managerId) where.managerId = managerId;

      if (hireFrom || hireTo) {
        where.hireDate = {};
        if (hireFrom) where.hireDate[Op.gte] = new Date(hireFrom);
        if (hireTo) where.hireDate[Op.lte] = new Date(hireTo);
      }

      if (q) {
        const like = { [Op.iLike]: `%${String(q).trim()}%` };
        where[Op.or] = [
          { firstName: like },
          { lastName: like },
          { email: like },
          { position: like }
        ];
      }

      const limit = Math.min(parseInt(String(perPage), 10) || 25, 200);
      const offset = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * limit;

      // Map sortBy field names to database column names
      const fieldMapping = {
        'department': 'department_id',
        'departmentId': 'department_id',
        'firstName': 'first_name',
        'lastName': 'last_name'
      };
      const mappedSortBy = fieldMapping[String(sortBy || 'last_name')] || String(sortBy || 'last_name');
      const order = [[mappedSortBy, String(sortDir || 'ASC').toUpperCase()]];

      const { rows, count } = await Employee.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          {
            model: Department,
            as: 'departmentInfo',
            attributes: ['id', 'name'],
            required: false
          },
          {
            model: Contract,
            as: 'contracts',
            where: { status: 'ACTIVE' },
            attributes: ['id', 'salary', 'currency', 'type', 'startDate', 'endDate'],
            required: false
          }
        ]
      });

      // compute simple facets (counts by department, position, status) scoped to tenant and q (if provided)
      const facetWhere = { tenantId };
      if (q) {
        const like = { [Op.iLike]: `%${String(q).trim()}%` };
        facetWhere[Op.or] = [
          { firstName: like },
          { lastName: like },
          { email: like },
          { position: like }
        ];
      }

      const departments = await Employee.findAll({ where: facetWhere, attributes: ['departmentId', [sequelize.fn('COUNT', sequelize.col('department_id')), 'count']], group: ['departmentId'] });
      const positions = await Employee.findAll({ where: facetWhere, attributes: ['position', [sequelize.fn('COUNT', sequelize.col('position')), 'count']], group: ['position'] });
      const statuses = await Employee.findAll({ where: facetWhere, attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']], group: ['status'] });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit, facets: { departments, positions, statuses } });
    } catch (error) {
      console.error('EmployeeController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const emp = await Employee.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!emp) return res.status(404).json({ error: 'NotFound' });
      return res.status(200).json(emp);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { ...req.body, tenantId: req.user.tenantId };
      const emp = await Employee.create(payload);
      return res.status(201).json(emp);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const emp = await Employee.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!emp) return res.status(404).json({ error: 'NotFound' });
      
      // Vérification si on essaie de désactiver un employé avec un contrat actif
      if (status === 'INACTIVE' || status === 'SUSPENDED') {
        const { Contract } = await import('../models/index.js');
        const activeContracts = await Contract.findAll({
          where: {
            employeeId: id,
            tenantId: req.user.tenantId,
            status: 'ACTIVE'
          }
        });
        
        if (activeContracts.length > 0) {
          return res.status(400).json({ 
            error: 'ActiveContractExists',
            message: 'Impossible de désactiver cet employé car il possède un ou plusieurs contrats actifs. Vous devez d\'abord résilier tous ses contrats actifs avec un motif valide.',
            activeContracts: activeContracts.length,
            details: 'Rendez-vous dans la section "Contrats" pour résilier les contrats actifs de cet employé.'
          });
        }
      }
      
      await emp.update(req.body);
      return res.status(200).json(emp);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      const emp = await Employee.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!emp) return res.status(404).json({ error: 'NotFound' });
      
      // Vérification si l'employé a des contrats actifs
      const { Contract } = await import('../models/index.js');
      const activeContracts = await Contract.findAll({
        where: {
          employeeId: id,
          tenantId: req.user.tenantId,
          status: 'ACTIVE'
        }
      });
      
      if (activeContracts.length > 0) {
        return res.status(400).json({ 
          error: 'ActiveContractExists',
          message: 'Impossible de supprimer cet employé car il possède un ou plusieurs contrats actifs. Vous devez d\'abord résilier tous ses contrats actifs avec un motif valide.',
          activeContracts: activeContracts.length,
          details: 'Rendez-vous dans la section "Contrats" pour résilier les contrats actifs de cet employé.'
        });
      }
      
      await emp.destroy();
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get organizational chart structure
   * Returns hierarchical structure of active employees with active contracts
   */
  static async getOrgChart(req, res) {
    try {
      const tenantId = req.user.tenantId;

      // Récupérer tous les employés actifs avec leurs départements et contrats
      const employees = await Employee.findAll({
        where: { 
          tenantId,
          status: 'ACTIVE'
        },
        include: [
          {
            model: Department,
            as: 'departmentInfo',
            required: false, // LEFT JOIN
            attributes: ['id', 'name', 'description']
          },
          {
            model: Contract,
            as: 'contracts',
            required: false, // LEFT JOIN pour avoir tous les employés
            where: { 
              status: 'ACTIVE'
            },
            attributes: ['id', 'type', 'startDate', 'endDate', 'status', 'salary']
          }
        ],
        attributes: [
          'id', 'firstName', 'lastName', 'position', 'departmentId', 
          'managerId', 'hireDate', 'photoUrl', 'status'
        ],
        order: [['lastName', 'ASC']]
      });

      // Construire la hiérarchie ou la structure plate
      const buildHierarchy = (parentId = null) => {
        return employees
          .filter(emp => emp.managerId === parentId && emp.contracts && emp.contracts.length > 0)
          .map(emp => ({
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            role: emp.position,
            dept: emp.departmentInfo ? emp.departmentInfo.name : 'Non assigné',
            departmentId: emp.departmentId,
            managerId: emp.managerId,
            hireDate: emp.hireDate,
            photoUrl: emp.photoUrl,
            contracts: emp.contracts,
            children: buildHierarchy(emp.id)
          }));
      };

      // Construire la hiérarchie
      const orgChart = buildHierarchy();

      // Si pas de hiérarchie claire, grouper par département
      if (orgChart.length === 0) {
        const departmentGroups = {};
        employees.forEach(emp => {
          // Ne considérer que les employés avec contrats actifs
          if (!emp.contracts || emp.contracts.length === 0) return;

          const deptName = emp.departmentInfo ? emp.departmentInfo.name : 'Non assigné';
          if (!departmentGroups[deptName]) {
            departmentGroups[deptName] = [];
          }
          departmentGroups[deptName].push({
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            role: emp.position,
            dept: deptName,
            departmentId: emp.departmentId,
            managerId: emp.managerId,
            hireDate: emp.hireDate,
            photoUrl: emp.photoUrl,
            contracts: emp.contracts,
            children: []
          });
        });

        return res.status(200).json({
          type: 'flat',
          departments: departmentGroups,
          totalEmployees: Object.values(departmentGroups).reduce((sum, emps) => sum + emps.length, 0)
        });
      }

      return res.status(200).json({
        type: 'hierarchical',
        orgChart,
        totalEmployees: orgChart.length + orgChart.reduce((sum, emp) => sum + emp.children.length, 0)
      });

    } catch (error) {
      console.error('❌ EmployeeController.getOrgChart error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  /**
   * Get HR Dashboard Statistics
   * Returns real-time statistics for the HR dashboard
   */
  static async getHRStats(req, res) {
    try {
      const tenantId = req.user.tenantId;

      // 1. Total des employés actifs avec contrats actifs
      const totalEmployees = await Employee.count({
        where: { 
          tenantId,
          status: 'ACTIVE'
        },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { 
            status: 'ACTIVE',
            [Op.or]: [
              { endDate: null },
              { endDate: { [Op.gte]: new Date() } }
            ]
          },
          required: true
        }]
      });

      // 2. Masse salariale totale (contrats actifs)
      const salaryData = await Contract.findAll({
        where: {
          tenantId,
          status: 'ACTIVE',
          [Op.or]: [
            { endDate: null },
            { endDate: { [Op.gte]: new Date() } }
          ]
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('salary')), 'totalSalary'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'activeContracts']
        ],
        raw: true
      });

      const totalSalary = parseFloat(salaryData[0].totalSalary) || 0;
      const activeContracts = parseInt(salaryData[0].activeContracts) || 0;

      // 3. Congés actifs (en cours)
      const activeLeaves = await Leave.count({
        where: {
          tenantId,
          status: 'APPROVED',
          startDate: { [Op.lte]: new Date() },
          endDate: { [Op.gte]: new Date() }
        }
      });

      // 4. Congés en attente
      const pendingLeaves = await Leave.count({
        where: {
          tenantId,
          status: 'PENDING'
        }
      });

      // 5. Départements actifs
      const activeDepartments = await Department.count({
        where: { tenantId },
        include: [{
          model: Employee,
          as: 'employees',
          where: { status: 'ACTIVE' },
          required: true
        }]
      });

      // 6. Nouveaux employés ce mois
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newEmployeesThisMonth = await Employee.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          hireDate: { [Op.gte]: startOfMonth }
        }
      });

      // 7. Contrats expirant dans les 30 prochains jours
      const next30Days = new Date();
      next30Days.setDate(next30Days.getDate() + 30);

      const expiringContracts = await Contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          endDate: {
            [Op.and]: [
              { [Op.gte]: new Date() },
              { [Op.lte]: next30Days }
            ]
          }
        }
      });

      // Calculer des métriques dérivées
      const averageSalary = activeContracts > 0 ? Math.round(totalSalary / activeContracts) : 0;
      const totalSalaryFormatted = totalSalary >= 1000000 
        ? `${(totalSalary / 1000000).toFixed(1)}M`
        : `${Math.round(totalSalary / 1000)}K`;

      const stats = {
        totalEmployees,
        totalSalary: totalSalaryFormatted,
        totalSalaryRaw: totalSalary,
        averageSalary,
        activeContracts,
        activeLeaves,
        pendingLeaves,
        activeDepartments,
        newEmployeesThisMonth,
        expiringContracts,
        // Calcul d'un taux de performance simplifié basé sur les contrats actifs vs total
        performanceRate: totalEmployees > 0 ? Math.round((activeContracts / totalEmployees) * 100) : 0
      };

      return res.status(200).json(stats);

    } catch (error) {
      console.error('EmployeeController.getHRStats error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Calcule le salaire à payer ce mois-ci pour un employé
   */
  static async getCurrentMonthSalary(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { month } = req.query; // Optionnel, par défaut le mois en cours
      const tenantId = req.user.tenantId;

      // Vérifier que l'employé existe et appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Utiliser le mois fourni ou le mois en cours
      const targetMonth = month ? new Date(month + '-01') : new Date();

      // Calculer le salaire net à payer
      const salaryCalculation = await PayrollCalculationService.calculateNetPayForEmployee(
        employeeId,
        targetMonth,
        tenantId
      );

      return res.status(200).json(salaryCalculation);
    } catch (error) {
      console.error('EmployeeController.getCurrentMonthSalary error:', error);
      return res.status(500).json({ 
        error: error.message,
        details: 'Erreur lors du calcul du salaire du mois'
      });
    }
  }

  /**
   * Calcule les déductions d'avances pour un employé pour un mois donné
   */
  static async getAdvanceDeductions(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { month } = req.query; // Format YYYY-MM
      const tenantId = req.user.tenantId;

      const targetMonth = month ? new Date(month + '-01') : new Date();

      const deductions = await PayrollCalculationService.calculateAdvanceDeductionsForEmployee(
        employeeId,
        targetMonth,
        tenantId
      );

      return res.status(200).json(deductions);
    } catch (error) {
      console.error('EmployeeController.getAdvanceDeductions error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
