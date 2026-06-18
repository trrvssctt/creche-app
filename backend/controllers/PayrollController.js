import { Payroll, Advance, Prime, Employee, Department, Contract, Attendance, Leave, HRRule, PayrollSettings } from '../models/index.js';
import { Op } from 'sequelize';
import { validateAmount, calculateAdvanceDeductions } from '../config/payroll.js';
import PayslipGeneratorService from '../services/PayslipGeneratorService.js';
import { HRRuleController } from './HRRuleController.js';

export class PayrollController {
  static async list(req, res) {
    try {
      const items = await Payroll.findAll({ where: { tenantId: req.user.tenantId } });
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const item = await Payroll.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!item) return res.status(404).json({ error: 'NotFound' });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { ...req.body, tenantId: req.user.tenantId };
      const item = await Payroll.create(payload);
      return res.status(201).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async generatePaystub(req, res) {
    try {
      // Minimal implementation: mark payroll as FINALIZED and return record
      const { id } = req.params;
      const item = await Payroll.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!item) return res.status(404).json({ error: 'NotFound' });
      item.status = 'FINALIZED';
      await item.save();
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // --- GESTION DES AVANCES ---

  static async listAdvances(req, res) {
    try {
      const advances = await Advance.findAll({ 
        where: { tenantId: req.user.tenantId },
        include: [
          {
            model: Employee,
            as: 'employee',
            include: [{ model: Department, as: 'departmentInfo' }]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(advances);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createAdvance(req, res) {
    try {
      const { employeeId, amount, months, reason, currency } = req.body;

      // Validation
      if (!employeeId || !amount || !reason) {
        return res.status(400).json({ error: 'Champs obligatoires manquants' });
      }

      // Vérifier que l'employé existe et appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { status: 'ACTIVE' },
          required: false,
          attributes: ['id', 'salary', 'currency']
        }]
      });
      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Récupérer le salaire du contrat actif le plus récent
      const activeContracts = employee.contracts || [];
      const latestContract = activeContracts.length > 0 
        ? activeContracts.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0]
        : null;
      const currentSalary = latestContract?.salary || employee.baseSalary || 0;

      // Vérifier que le montant ne dépasse pas le salaire pour la période
      const totalAmount = amount * (months || 1);
      const maxAmount = currentSalary * (months || 1);
      if (totalAmount > maxAmount) {
        return res.status(400).json({ 
          error: `Le montant total (${totalAmount.toLocaleString()} F CFA) dépasse le salaire pour ${months || 1} mois (${maxAmount.toLocaleString()} F CFA)` 
        });
      }

      const advance = await Advance.create({
        employeeId,
        amount: parseFloat(amount),
        months: months || 1,
        reason,
        currency: currency || 'F CFA',
        tenantId: req.user.tenantId,
        status: 'PENDING',
        remainingAmount: parseFloat(amount) * (months || 1), // Montant total restant à déduire
        startDate: null, // Sera défini lors de l'approbation
        endDate: null    // Sera défini lors de l'approbation
      });

      // Recharger avec les associations
      const createdAdvance = await Advance.findByPk(advance.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            include: [{ model: Department, as: 'departmentInfo' }]
          }
        ]
      });

      return res.status(201).json(createdAdvance);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async approveAdvance(req, res) {
    try {
      const { id } = req.params;
      const advance = await Advance.findOne({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!advance) {
        return res.status(404).json({ error: 'Avance non trouvée' });
      }

      if (advance.status !== 'PENDING') {
        return res.status(400).json({ error: 'Cette avance a déjà été traitée' });
      }

      advance.status = 'APPROVED';
      advance.approvedBy = req.user.id;
      advance.approvedAt = new Date();
      advance.startDate = new Date();
      
      // Calculer la date de fin basée sur le nombre de mois
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + advance.months);
      advance.endDate = endDate;

      await advance.save();

      return res.status(200).json(advance);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async rejectAdvance(req, res) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      
      const advance = await Advance.findOne({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!advance) {
        return res.status(404).json({ error: 'Avance non trouvée' });
      }

      if (advance.status !== 'PENDING') {
        return res.status(400).json({ error: 'Cette avance a déjà été traitée' });
      }

      advance.status = 'REJECTED';
      advance.approvedBy = req.user.id;
      advance.approvedAt = new Date();
      advance.rejectionReason = rejectionReason;

      await advance.save();

      return res.status(200).json(advance);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // --- GESTION DES PRIMES ---

  static async listPrimes(req, res) {
    try {
      const primes = await Prime.findAll({ 
        where: { tenantId: req.user.tenantId },
        include: [
          {
            model: Employee,
            as: 'employee',
            include: [{ model: Department, as: 'departmentInfo' }]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(primes);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createPrime(req, res) {
    try {
      const { employeeId, amount, reason, type, currency, category } = req.body;

      // Validation
      if (!employeeId || !amount || !reason) {
        return res.status(400).json({ error: 'Champs obligatoires manquants' });
      }

      // Vérifier que l'employé existe et appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId }
      });
      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      const prime = await Prime.create({
        employeeId,
        amount: parseFloat(amount),
        reason,
        type: type || 'PERFORMANCE',
        currency: currency || 'F CFA',
        category: category || null,
        tenantId: req.user.tenantId,
        status: 'APPROVED', // Les primes sont automatiquement approuvées
        approvedBy: req.user.id,
        approvedAt: new Date()
      });

      // Recharger avec les associations
      const createdPrime = await Prime.findByPk(prime.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            include: [{ model: Department, as: 'departmentInfo' }]
          }
        ]
      });

      return res.status(201).json(createdPrime);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updatePrime(req, res) {
    try {
      const { id } = req.params;
      const { amount, reason, type, category } = req.body;

      const prime = await Prime.findOne({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!prime) {
        return res.status(404).json({ error: 'Prime non trouvée' });
      }

      if (prime.isPaid) {
        return res.status(400).json({ error: 'Cette prime a déjà été payée et ne peut plus être modifiée' });
      }

      if (amount !== undefined) prime.amount = parseFloat(amount);
      if (reason) prime.reason = reason;
      if (type) prime.type = type;
      if (category !== undefined) prime.category = category;

      await prime.save();

      return res.status(200).json(prime);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async deletePrime(req, res) {
    try {
      const { id } = req.params;
      
      const prime = await Prime.findOne({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!prime) {
        return res.status(404).json({ error: 'Prime non trouvée' });
      }

      if (prime.isPaid) {
        return res.status(400).json({ error: 'Cette prime a déjà été payée et ne peut plus être supprimée' });
      }

      await prime.destroy();

      return res.status(200).json({ message: 'Prime supprimée avec succès' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Calculer les déductions mensuelles en cours pour un employé
  static async getMonthlyDeductions(req, res) {
    try {
      const { employeeId } = req.params;
      const currentDate = new Date();
      
      // Récupérer les avances approuvées et en cours pour cet employé
      const activeAdvances = await Advance.findAll({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: 'APPROVED',
          startDate: { [Op.lte]: currentDate }, // Avance déjà commencée
          endDate: { [Op.gte]: currentDate }    // Avance pas encore finie
        },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName']
        }]
      });
      
      let totalMonthlyDeduction = 0;
      const deductionDetails = [];
      
      for (const advance of activeAdvances) {
        // Calculer combien de mois se sont écoulés depuis le début
        const startDate = new Date(advance.startDate);
        const monthsElapsed = Math.floor(
          (currentDate - startDate) / (1000 * 60 * 60 * 24 * 30)
        );
        
        // Si l'avance n'est pas encore terminée
        if (monthsElapsed < advance.months) {
          const monthlyAmount = parseFloat(advance.amount) || 0;
          
          // Validation du montant mensuel
          if (monthlyAmount > 0) {
            totalMonthlyDeduction += monthlyAmount;
            
            deductionDetails.push({
              id: advance.id,
              reason: advance.reason,
              monthlyAmount: Math.round(monthlyAmount * 100) / 100,
              totalAmount: Math.round((advance.amount * advance.months) * 100) / 100,
              remainingMonths: advance.months - monthsElapsed,
              startDate: advance.startDate,
              endDate: advance.endDate,
              currency: advance.currency
            });
          }
        }
      }
      
      return res.status(200).json({
        employeeId,
        totalMonthlyDeduction: Math.round(totalMonthlyDeduction * 100) / 100,
        deductionDetails,
        currency: activeAdvances[0]?.currency || 'F CFA'
      });
    } catch (error) {
      console.error('Error calculating monthly deductions:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Calculer le salaire net mensuel d'un employé
  static async calculateMonthlySalary(req, res) {
    try {
      const { employeeId } = req.params;
      const { month } = req.query; // Format: YYYY-MM, défaut = mois courant
      
      const targetMonth = month || new Date().toISOString().substring(0, 7);
      const targetDate = new Date(targetMonth + '-01');
      
      // Récupérer l'employé avec son contrat actif
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { status: 'ACTIVE' },
          required: false
        }]
      });
      
      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }
      
      const activeContract = employee.contracts?.[0];
      if (!activeContract) {
        return res.status(400).json({ error: 'Aucun contrat actif trouvé' });
      }
      
      // Validation et normalisation du salaire de base
      const baseSalary = validateAmount(activeContract.salary);
      
      // Validation des données de base
      if (baseSalary <= 0) {
        return res.status(400).json({ error: 'Salaire de base invalide ou non défini' });
      }
      
      // Récupérer les primes du mois
      const monthStart = new Date(targetMonth + '-01');
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      
      const primes = await Prime.findAll({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: 'APPROVED',
          createdAt: {
            [Op.between]: [monthStart, monthEnd]
          }
        }
      });
      
      // Récupérer les déductions d'avances pour ce mois
      const advances = await Advance.findAll({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: 'APPROVED',
          startDate: { [Op.lte]: monthEnd },
          endDate: { [Op.gte]: monthStart }
        }
      });
      
      let totalPrimes = 0;
      let totalAdvanceDeductions = 0;
      
      // Calculer les primes avec validation
      primes.forEach(prime => {
        totalPrimes += validateAmount(prime.amount);
      });
      
      // Calculer les déductions d'avances pour ce mois avec la fonction utilitaire
      totalAdvanceDeductions = calculateAdvanceDeductions(advances, monthStart, monthEnd);
      
      // Validation finale des montants calculés
      totalPrimes = validateAmount(totalPrimes);
      totalAdvanceDeductions = validateAmount(totalAdvanceDeductions);
      
      // Calculs des charges sociales avec validation
      const socialChargesEmployee = validateAmount(baseSalary * 0.22); // 22% employé
      const socialChargesEmployer = validateAmount(baseSalary * 0.18); // 18% employeur
      
      const grossSalary = validateAmount(baseSalary + totalPrimes);
      const netSalary = validateAmount(grossSalary - socialChargesEmployee - totalAdvanceDeductions);
      
      return res.status(200).json({
        employeeId,
        month: targetMonth,
        baseSalary: Math.round(baseSalary * 100) / 100,
        totalPrimes: Math.round(totalPrimes * 100) / 100,
        totalAdvanceDeductions: Math.round(totalAdvanceDeductions * 100) / 100,
        socialChargesEmployee: Math.round(socialChargesEmployee * 100) / 100,
        socialChargesEmployer: Math.round(socialChargesEmployer * 100) / 100,
        grossSalary: Math.round(grossSalary * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        currency: activeContract.currency || 'F CFA',
        details: {
          primesCount: primes.length,
          advancesCount: advances.length,
          contractType: activeContract.type
        }
      });
    } catch (error) {
      console.error('Error calculating monthly salary:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // --- GÉNÉRATION DE PAIE MENSUELLE ---
  static async generateMonthlyPayroll(req, res) {
    try {
      const { month, year, includeAdvances = true, generateFiles = true, fileFormat = 'png' } = req.body;
      const tenantId = req.user.tenantId;

      if (!month) {
        return res.status(400).json({ error: 'Mois requis' });
      }

      // Normaliser month/year : le frontend envoie "YYYY-MM" (string) mais
      // Payroll.month est INTEGER en base → on extrait les entiers
      let monthInt, yearInt, monthStr;
      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        yearInt  = parseInt(parts[0], 10);
        monthInt = parseInt(parts[1], 10);
        monthStr = month; // "YYYY-MM" pour calculateEmployeeSalary
      } else {
        monthInt = parseInt(month, 10);
        yearInt  = parseInt(year, 10) || new Date().getFullYear();
        monthStr = `${yearInt}-${String(monthInt).padStart(2, '0')}`;
      }

      if (isNaN(monthInt) || isNaN(yearInt)) {
        return res.status(400).json({ error: 'Format de mois invalide (attendu YYYY-MM ou entier)' });
      }

      // 1. Récupérer tous les employés actifs avec contrats actifs
      const employeesWithActiveContracts = await Employee.findAll({
        where: { 
          tenantId: tenantId,
          status: 'ACTIVE'
        },
        include: [
          {
            model: Contract,
            as: 'contracts',
            where: { 
              status: 'ACTIVE',
              tenantId: tenantId
            },
            required: true // Only employees with active contracts
          },
          {
            model: Department,
            as: 'departmentInfo',
            required: false
          }
        ]
      });

      if (employeesWithActiveContracts.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'Aucun employé avec contrat actif trouvé',
          processedEmployees: 0,
          generatedFiles: 0,
          totalAmount: 0
        });
      }

      const processedEmployees = [];
      const skippedEmployees = [];
      let totalPayrollAmount = 0;
      let generatedFilesCount = 0;

      // 2. Traiter chaque employé
      for (const employee of employeesWithActiveContracts) {
        try {
          // Récupérer le contrat actif le plus récent
          const activeContract = employee.contracts
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

          if (!activeContract) {
            skippedEmployees.push({ employeeId: employee.id, reason: 'Pas de contrat actif' });
            continue;
          }

          // Calculer le salaire pour ce mois (calculateEmployeeSalary attend "YYYY-MM")
          const salaryCalculation = await this.calculateEmployeeSalary(employee.id, monthStr, tenantId, includeAdvances);

          // Champs mappés sur le vrai modèle Payroll
          const totalDeductionsAmount = (salaryCalculation.totalAdvanceDeductions || 0)
            + (salaryCalculation.ruleDeductions || 0)
            + (salaryCalculation.unpaidLeaveDeduction || 0);

          // 3. Créer ou mettre à jour l'enregistrement de paie
          const [payrollRecord, created] = await Payroll.findOrCreate({
            where: {
              employeeId: employee.id,
              tenantId: tenantId,
              month: monthInt,   // INTEGER
              year:  yearInt     // INTEGER
            },
            defaults: {
              employeeId:   employee.id,
              tenantId:     tenantId,
              month:        monthInt,
              year:         yearInt,
              baseSalary:   salaryCalculation.baseSalary,
              gross:        salaryCalculation.grossSalary,
              net:          salaryCalculation.netSalary,
              netSalary:    salaryCalculation.netSalary,
              bonuses:      salaryCalculation.totalPrimes,
              deductions:   totalDeductionsAmount,
              socialCharges: salaryCalculation.socialChargesEmployee,
              status:       'DRAFT'   // ENUM valide : DRAFT / VALIDATED / PAID
            }
          });

          if (!created) {
            // Mettre à jour si déjà existant
            await payrollRecord.update({
              baseSalary:   salaryCalculation.baseSalary,
              gross:        salaryCalculation.grossSalary,
              net:          salaryCalculation.netSalary,
              netSalary:    salaryCalculation.netSalary,
              bonuses:      salaryCalculation.totalPrimes,
              deductions:   totalDeductionsAmount,
              socialCharges: salaryCalculation.socialChargesEmployee,
              status:       'DRAFT',
              updatedAt:    new Date()
            });
          }

          // 4. Générer le fichier de paie si demandé
          if (generateFiles) {
            try {
              // generatePayslipFile attend month en entier et year en entier
              await this.generatePayslipFile(employee, activeContract, salaryCalculation, monthInt, yearInt, fileFormat);
              generatedFilesCount++;
            } catch (fileError) {
              console.error(`Erreur génération fichier pour ${employee.firstName} ${employee.lastName}:`, fileError);
              // Continue même si la génération de fichier échoue
            }
          }

          processedEmployees.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            netSalary: salaryCalculation.netSalary,
            payrollId: payrollRecord.id
          });

          totalPayrollAmount += salaryCalculation.netSalary;

        } catch (employeeError) {
          console.error(`Erreur traitement employé ${employee.id}:`, employeeError);
          skippedEmployees.push({ 
            employeeId: employee.id, 
            reason: employeeError.message || 'Erreur de calcul' 
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Traitement de paie ${monthStr} terminé`,
        processedEmployees: processedEmployees.length,
        generatedFiles: generatedFilesCount,
        totalAmount: Math.round(totalPayrollAmount * 100) / 100,
        skippedEmployees: skippedEmployees,
        details: processedEmployees
      });

    } catch (error) {
      console.error('Error in generateMonthlyPayroll:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de la génération de paie mensuelle',
        details: error.message 
      });
    }
  }

  // Méthode utilitaire pour calculer le salaire d'un employé
  // Utilise la même logique que PayslipController.downloadAllAsZip pour des fiches de paie identiques
  static async calculateEmployeeSalary(employeeId, month, tenantId, includeAdvances = true) {
    try {
      // Récupérer l'employé avec son contrat actif
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: tenantId },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { status: 'ACTIVE' },
          required: true
        }, {
          model: Department,
          as: 'departmentInfo',
          required: false
        }]
      });

      if (!employee || !employee.contracts || employee.contracts.length === 0) {
        throw new Error('Employé ou contrat actif non trouvé');
      }

      const activeContract = employee.contracts
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

      const baseSalary = parseFloat(activeContract.salary) || 0;

      if (baseSalary === 0) {
        throw new Error('Salaire de base non défini');
      }

      // Récupérer les paramètres de paie (mêmes que downloadAllAsZip)
      const [settings, hrRules] = await Promise.all([
        PayrollSettings.findOne({ where: { tenantId } }),
        HRRule.findAll({ where: { tenantId, isActive: true }, order: [['sort_order', 'ASC']] })
      ]);

      // Taux réels depuis PayrollSettings
      const empSocialRate = parseFloat(settings?.employeeSocialChargeRate ?? 8.2) / 100;
      const taxRate = parseFloat(settings?.taxRate ?? 10.0) / 100;
      const workingDaysMonth = parseInt(settings?.workingDaysPerMonth ?? 26);
      const deductionEnabled = settings?.deductionEnabled ?? false;
      const currency = settings?.currency || activeContract.currency || 'F CFA';

      const startH = parseInt((settings?.workStartTime || '08:00').split(':')[0]);
      const endH = parseInt((settings?.workEndTime || '17:00').split(':')[0]);
      const dailyWorkHours = Math.max(1, endH - startH);

      const monthStart = new Date(`${month}-01`);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

      // Récupérer les primes approuvées (toutes, pas seulement ce mois - comme downloadAllAsZip)
      const empPrimes = await Prime.findAll({
        where: {
          employeeId,
          tenantId,
          status: 'APPROVED'
        }
      });
      const totalPrimes = empPrimes.reduce((sum, prime) => sum + parseFloat(prime.amount || 0), 0);

      // Récupérer les avances approuvées
      const empAdvances = await Advance.findAll({
        where: {
          employeeId,
          tenantId,
          status: 'APPROVED'
        }
      });

      // Calculer déduction avances (même logique que downloadAllAsZip)
      let totalAdvanceDeductions = 0;
      if (includeAdvances && empAdvances.length > 0) {
        totalAdvanceDeductions = empAdvances.reduce((sum, advance) => {
          const monthly = parseFloat(advance.monthlyDeduction || 0) > 0
            ? parseFloat(advance.monthlyDeduction)
            : parseFloat(advance.amount || 0) / Math.max(1, parseInt(advance.months) || 1);
          return sum + monthly;
        }, 0);
      }

      const grossSalary = baseSalary + totalPrimes;

      // Cotisations sociales et impôt (mêmes calculs que downloadAllAsZip)
      const socialContributions = Math.round(grossSalary * empSocialRate);
      const taxableBase = Math.max(0, grossSalary - socialContributions);
      const incomeTax = Math.round(taxableBase * taxRate);

      // Déductions règles RH si activé
      let hrRulesDeduction = 0;
      if (deductionEnabled && hrRules.length > 0) {
        // Pointages du mois
        const attendances = await Attendance.findAll({
          where: {
            employeeId,
            tenantId,
            date: { [Op.between]: [monthStart, monthEnd] }
          }
        });

        // Absences injustifiées
        const approvedLeaves = await Leave.findAll({
          where: {
            employeeId,
            tenantId,
            status: 'APPROVED',
            startDate: { [Op.lte]: monthEnd },
            endDate: { [Op.gte]: monthStart }
          }
        });

        const attendanceDates = new Set(attendances.map(a => String(a.date).substring(0, 10)));
        const approvedLeaveDates = new Set();
        for (const leave of approvedLeaves) {
          let d = new Date(leave.startDate);
          const end = new Date(leave.endDate);
          while (d <= end) {
            approvedLeaveDates.add(d.toISOString().substring(0, 10));
            d.setDate(d.getDate() + 1);
          }
        }

        let unapprovedAbsences = 0;
        let current = new Date(monthStart);
        while (current <= monthEnd) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = current.toISOString().substring(0, 10);
            if (!attendanceDates.has(dateStr) && !approvedLeaveDates.has(dateStr)) {
              unapprovedAbsences++;
            }
          }
          current.setDate(current.getDate() + 1);
        }

        const dailyRate = workingDaysMonth > 0 ? baseSalary / workingDaysMonth : 0;
        const hourlyRate = dailyWorkHours > 0 ? dailyRate / dailyWorkHours : 0;

        // Jours en retard : toute durée de retard > 0 = 1 heure entière perdue
        const lateDays = attendances.filter(a => (a.meta?.lateMinutes || 0) > 0).length;
        const totalLateMinutes = lateDays * 60;

        const _cmpOp = (a, op, b) => ({ GT: a > b, GTE: a >= b, LT: a < b, LTE: a <= b, EQ: a === b }[op] ?? false);

        for (const rule of hrRules) {
          const av  = parseFloat(rule.actionValue   || 0);
          const condVal = parseFloat(rule.conditionValue || 0);
          const op  = rule.conditionOperator || 'GT';

          if (rule.type === 'LATE') {
            // Vérifier la condition (en minutes ou en heures selon conditionUnit)
            const compareVal = rule.conditionUnit === 'HOURS' ? lateDays : totalLateMinutes;
            if (!_cmpOp(compareVal, op, condVal)) continue;
            // Déduction × nombre de jours en retard (1h par jour)
            if (rule.actionType === 'DEDUCT_FIXED')            hrRulesDeduction += av * lateDays;
            else if (rule.actionType === 'DEDUCT_SALARY_HOURS') hrRulesDeduction += av * hourlyRate * lateDays;
            else if (rule.actionType === 'DEDUCT_SALARY_DAYS')  hrRulesDeduction += av * dailyRate  * lateDays;
            else if (rule.actionType === 'DEDUCT_PERCENT')      hrRulesDeduction += baseSalary * (av / 100) * lateDays;

          } else if (rule.type === 'ABSENCE' || rule.type === 'UNPAID_LEAVE') {
            if (!_cmpOp(unapprovedAbsences, op, condVal)) continue;
            if (rule.actionType === 'DEDUCT_FIXED')            hrRulesDeduction += av * unapprovedAbsences;
            else if (rule.actionType === 'DEDUCT_SALARY_HOURS') hrRulesDeduction += av * hourlyRate * unapprovedAbsences;
            else if (rule.actionType === 'DEDUCT_SALARY_DAYS')  hrRulesDeduction += av * dailyRate  * unapprovedAbsences;
            else if (rule.actionType === 'DEDUCT_PERCENT')      hrRulesDeduction += baseSalary * (av / 100) * unapprovedAbsences;
          }
        }
        hrRulesDeduction = Math.round(hrRulesDeduction);
      }

      const totalDeductions = socialContributions + incomeTax + Math.round(totalAdvanceDeductions) + hrRulesDeduction;
      const netSalary = Math.max(0, grossSalary - totalDeductions);

      return {
        baseSalary: Math.round(baseSalary * 100) / 100,
        totalPrimes: Math.round(totalPrimes * 100) / 100,
        totalAdvanceDeductions: Math.round(totalAdvanceDeductions * 100) / 100,
        ruleDeductions: hrRulesDeduction,
        socialChargesEmployee: socialContributions,
        socialChargesEmployer: Math.round(grossSalary * (parseFloat(settings?.employerSocialChargeRate ?? 18.5) / 100) * 100) / 100,
        incomeTax,
        grossSalary: Math.round(grossSalary * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        currency,
        empSocialRate: empSocialRate * 100,
        taxRate: taxRate * 100,
        workingDaysMonth
      };
    } catch (error) {
      console.error(`Erreur calculateEmployeeSalary pour employé ${employeeId}:`, error);
      throw error;
    }
  }

  // Méthode utilitaire pour générer le fichier de paie
  static async generatePayslipFile(employee, contract, salaryCalculation, month, year, format = 'png') {
    try {
      // Récupérer les informations du tenant
      const tenantInfo = await PayslipGeneratorService.getTenantInfo(employee.tenantId);

      // Générer le fichier de paie
      const result = await PayslipGeneratorService.generatePayslipFile(
        employee,
        contract,
        tenantInfo,
        salaryCalculation,
        month,
        year,
        format
      );

      return result;
    } catch (error) {
      console.error(`Erreur génération fichier de paie pour ${employee.firstName} ${employee.lastName}:`, error);
      throw error;
    }
  }

  // --- VÉRIFICATION PRÉ-PAIE : Vérifie si un employé a travaillé les heures convenues ---
  static async validatePayrollEligibility(req, res) {
    try {
      const { employeeId, month } = req.query; // month format: YYYY-MM
      const tenantId = req.user.tenantId;

      if (!employeeId || !month) {
        return res.status(400).json({ error: 'employeeId et month sont requis' });
      }

      const targetDate = new Date(month + '-01');
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      // Récupérer l'employé et son contrat actif
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId, status: 'ACTIVE' },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { status: 'ACTIVE' },
          required: true
        }]
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employé actif non trouvé' });
      }

      const activeContract = employee.contracts[0];

      // Récupérer les paramètres de paie
      const payrollSettings = await PayrollSettings.findOne({ where: { tenantId } });
      const workStartTime = payrollSettings?.workStartTime || '08:00';
      const workEndTime = payrollSettings?.workEndTime || '17:00';
      const workingDaysPerMonth = payrollSettings?.workingDaysPerMonth || 26;

      // Calculer les heures de travail attendues par mois
      const [startHour, startMin] = workStartTime.split(':').map(Number);
      const [endHour, endMin] = workEndTime.split(':').map(Number);
      const dailyWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const expectedMonthlyMinutes = dailyWorkMinutes * workingDaysPerMonth;
      const expectedMonthlyHours = expectedMonthlyMinutes / 60;

      // Récupérer tous les pointages du mois pour cet employé
      const attendances = await Attendance.findAll({
        where: {
          employeeId,
          tenantId,
          date: { [Op.between]: [monthStart, monthEnd] }
        },
        order: [['date', 'ASC']]
      });

      // Calculer les heures réellement travaillées
      let totalWorkedMinutes = 0;
      let totalLateMinutes = 0;
      let totalOvertimeMinutes = 0;
      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;

      const attendanceDates = new Set();
      for (const att of attendances) {
        if (att.status === 'PRESENT' || att.status === 'LATE' || att.status === 'REMOTE') {
          presentDays++;
          attendanceDates.add(att.date);

          // Calculer le temps travaillé
          if (att.clockIn && att.clockOut) {
            const clockIn = new Date(att.clockIn);
            const clockOut = new Date(att.clockOut);
            const workedMinutes = (clockOut - clockIn) / (1000 * 60);
            totalWorkedMinutes += workedMinutes;
          } else {
            // Si pas de pointage, compter la journée complète
            totalWorkedMinutes += dailyWorkMinutes;
          }

          // Retards
          const lateMin = att.meta?.lateMinutes || 0;
          if (lateMin > 0) {
            totalLateMinutes += lateMin;
            lateDays++;
          }
        } else if (att.status === 'ABSENT') {
          absentDays++;
        }
      }

      // Compter les absences implicites (jours ouvrés sans pointage)
      const [year, monthNum] = month.split('-').map(Number);
      const isCurrentMonth = month === new Date().toISOString().substring(0, 7);
      const periodEnd = isCurrentMonth ? new Date() : new Date(year, monthNum, 1);

      let implicitAbsentDays = 0;
      let totalWorkDaysInPeriod = 0;
      for (let d = new Date(year, monthNum - 1, 1); d < periodEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue; // Week-end
        totalWorkDaysInPeriod++;
        const dateStr = d.toISOString().substring(0, 10);
        if (!attendanceDates.has(dateStr)) {
          implicitAbsentDays++;
        }
      }

      const totalAbsentDays = absentDays + implicitAbsentDays;
      const totalWorkedHours = totalWorkedMinutes / 60;
      const totalLateHours = totalLateMinutes / 60;

      // Calculer le pourcentage de présence
      const attendanceRate = totalWorkDaysInPeriod > 0
        ? Math.round((presentDays / totalWorkDaysInPeriod) * 100)
        : 100;

      // Déterminer si l'employé est éligible au paiement complet
      const isEligibleForFullPay = attendanceRate >= 100 && totalAbsentDays === 0 && totalLateMinutes === 0;
      const isEligibleForPartialPay = attendanceRate >= 50;

      // Calculer le salaire proportionnel
      const baseSalary = parseFloat(activeContract.salary) || 0;
      const expectedSalary = baseSalary;
      const actualSalary = isEligibleForFullPay
        ? baseSalary
        : Math.round((presentDays / Math.max(totalWorkDaysInPeriod, 1)) * baseSalary);

      const warnings = [];
      if (totalLateMinutes > 0) {
        warnings.push(`${totalLateMinutes} minutes de retard (${lateDays} jour(s))`);
      }
      if (totalAbsentDays > 0) {
        warnings.push(`${totalAbsentDays} jour(s) d'absence (dont ${implicitAbsentDays} non pointé(s))`);
      }
      if (totalWorkedMinutes < expectedMonthlyMinutes && !isEligibleForFullPay) {
        const deficitHours = ((expectedMonthlyMinutes - totalWorkedMinutes) / 60).toFixed(1);
        warnings.push(`${deficitHours} heures non travaillées sur les ${expectedMonthlyHours}h attendues`);
      }

      return res.status(200).json({
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        month,
        eligibility: {
          isEligibleForFullPay,
          isEligibleForPartialPay,
          isBlocked: !isEligibleForPartialPay
        },
        attendance: {
          presentDays,
          totalAbsentDays,
          implicitAbsentDays,
          lateDays,
          totalWorkDaysInPeriod,
          attendanceRate
        },
        hours: {
          expectedMonthlyHours: Math.round(expectedMonthlyHours * 100) / 100,
          totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
          totalLateHours: Math.round(totalLateHours * 100) / 100,
          totalOvertimeHours: Math.round((attendances.reduce((s, a) => s + (a.overtimeMinutes || 0), 0)) / 60 * 100) / 100
        },
        salary: {
          baseSalary,
          expectedSalary,
          actualSalary,
          salaryRate: Math.round((actualSalary / Math.max(expectedSalary, 1)) * 100)
        },
        warnings,
        canProceedToPayroll: isEligibleForPartialPay
      });

    } catch (error) {
      console.error('Erreur validatePayrollEligibility:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // --- VÉRIFICATION GLOBALE AVANT GÉNÉRATION PAIE MENSUELLE ---
  static async prePayrollCheck(req, res) {
    try {
      const { month } = req.query; // YYYY-MM
      const tenantId = req.user.tenantId;

      if (!month) {
        return res.status(400).json({ error: 'month est requis (format YYYY-MM)' });
      }

      // Récupérer tous les employés actifs avec contrat actif
      const employees = await Employee.findAll({
        where: { tenantId, status: 'ACTIVE' },
        include: [{
          model: Contract,
          as: 'contracts',
          where: { status: 'ACTIVE' },
          required: true
        }]
      });

      const payrollSettings = await PayrollSettings.findOne({ where: { tenantId } });
      const paymentDay = payrollSettings?.paymentDay || 28;

      const results = [];
      let readyCount = 0;
      let warningCount = 0;
      let blockedCount = 0;

      for (const emp of employees) {
        try {
          // Appel interne avec mock de response
          const mockRes = {
            status: () => ({ json: (data) => data })
          };
          const mockReq = {
            query: { employeeId: emp.id, month },
            user: { tenantId }
          };
          const eligibility = await this.validatePayrollEligibility(mockReq, mockRes);

          results.push(eligibility);

          if (eligibility.eligibility?.isBlocked) {
            blockedCount++;
          } else if (!eligibility.eligibility?.isEligibleForFullPay) {
            warningCount++;
          } else {
            readyCount++;
          }
        } catch (err) {
          results.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            error: err.message
          });
          blockedCount++;
        }
      }

      return res.status(200).json({
        month,
        paymentDay,
        summary: {
          totalEmployees: employees.length,
          readyForFullPay: readyCount,
          readyForPartialPay: warningCount,
          blocked: blockedCount
        },
        employees: results
      });

    } catch (error) {
      console.error('Erreur prePayrollCheck:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
