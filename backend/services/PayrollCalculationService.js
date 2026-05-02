import { Advance } from '../models/Advance.js';
import { Prime } from '../models/Prime.js';
import { Contract } from '../models/Contract.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

/**
 * Service pour les calculs de paie
 */
export class PayrollCalculationService {
  
  /**
   * Calcule la déduction d'avance pour un mois donné
   * @param {Object} advance - L'avance approuvée
   * @param {Date} targetMonth - Le mois pour lequel calculer la déduction
   * @returns {number} - Montant à déduire ce mois-ci
   */
  static calculateAdvanceDeductionForMonth(advance, targetMonth) {
    if (!advance || advance.status !== 'APPROVED' || !advance.approvedAt) {
      return 0;
    }

    const approvedDate = new Date(advance.approvedAt);
    const startDate = advance.startDate ? new Date(advance.startDate) : approvedDate;
    
    // Normaliser les dates au premier du mois
    const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const normalizedTarget = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    
    // Si le mois cible est avant le début de l'avance
    if (normalizedTarget < normalizedStart) {
      return 0;
    }
    
    // Calculer combien de mois se sont écoulés depuis le début
    const monthsElapsed = this.getMonthsDifference(normalizedStart, normalizedTarget);
    
    // Si on dépasse la durée de l'avance
    if (monthsElapsed >= advance.months) {
      return 0;
    }
    
    // Retourner le montant mensuel à déduire
    return parseFloat(advance.amount);
  }

  /**
   * Calcule le montant total des déductions d'avances pour un employé pour un mois donné
   * @param {string} employeeId - ID de l'employé
   * @param {Date} targetMonth - Mois cible
   * @param {string} tenantId - ID du tenant
   * @returns {Object} - Détails des déductions
   */
  static async calculateAdvanceDeductionsForEmployee(employeeId, targetMonth, tenantId) {
    try {
      const advances = await Advance.findAll({
        where: {
          employeeId,
          tenantId,
          status: 'APPROVED'
        },
        order: [['approvedAt', 'ASC']]
      });

      let totalDeduction = 0;
      const deductionDetails = [];

      for (const advance of advances) {
        const monthlyDeduction = this.calculateAdvanceDeductionForMonth(advance, targetMonth);
        
        if (monthlyDeduction > 0) {
          totalDeduction += monthlyDeduction;
          deductionDetails.push({
            advanceId: advance.id,
            reason: advance.reason,
            monthlyAmount: monthlyDeduction,
            totalAmount: advance.amount * advance.months,
            remainingMonths: advance.months - this.getMonthsDifference(
              new Date(advance.startDate || advance.approvedAt), 
              targetMonth
            )
          });
        }
      }

      return {
        totalDeduction,
        deductionDetails,
        advancesCount: deductionDetails.length
      };
    } catch (error) {
      console.error('Erreur calcul déductions avances:', error);
      return {
        totalDeduction: 0,
        deductionDetails: [],
        advancesCount: 0
      };
    }
  }

  /**
   * Calcule le montant total des primes pour un mois donné
   * @param {string} employeeId - ID de l'employé
   * @param {Date} targetMonth - Mois cible
   * @param {string} tenantId - ID du tenant
   * @returns {Object} - Détails des primes
   */
  static async calculatePrimesForEmployee(employeeId, targetMonth, tenantId) {
    try {
      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

      const primes = await Prime.findAll({
        where: {
          employeeId,
          tenantId,
          status: 'APPROVED',
          createdAt: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        }
      });

      let totalPrimes = 0;
      const primeDetails = primes.map(prime => {
        const amount = parseFloat(prime.amount);
        totalPrimes += amount;
        
        return {
          primeId: prime.id,
          type: prime.type,
          reason: prime.reason,
          amount: amount,
          createdAt: prime.createdAt
        };
      });

      return {
        totalPrimes,
        primeDetails,
        primesCount: primeDetails.length
      };
    } catch (error) {
      console.error('Erreur calcul primes:', error);
      return {
        totalPrimes: 0,
        primeDetails: [],
        primesCount: 0
      };
    }
  }

  /**
   * Calcule le salaire net à payer pour un employé pour un mois donné
   * @param {string} employeeId - ID de l'employé
   * @param {Date} targetMonth - Mois cible (par défaut le mois en cours)
   * @param {string} tenantId - ID du tenant
   * @returns {Object} - Détails complets du calcul de paie
   */
  static async calculateNetPayForEmployee(employeeId, targetMonth = new Date(), tenantId) {
    try {
      // Récupérer le contrat actif
      const activeContract = await Contract.findOne({
        where: {
          employeeId,
          tenantId,
          status: 'ACTIVE'
        },
        order: [['createdAt', 'DESC']]
      });

      if (!activeContract) {
        throw new Error('Aucun contrat actif trouvé pour cet employé');
      }

      const baseSalary = parseFloat(activeContract.salary) || 0;
      const currency = activeContract.currency || 'F CFA';

      // Calculer les primes du mois
      const primesData = await this.calculatePrimesForEmployee(employeeId, targetMonth, tenantId);

      // Calculer les déductions d'avances du mois
      const advancesData = await this.calculateAdvanceDeductionsForEmployee(employeeId, targetMonth, tenantId);

      // Paramètres de charges sociales (à récupérer depuis les settings)
      const employeeSocialChargeRate = 0.082; // 8.2%
      const employerSocialChargeRate = 0.185; // 18.5%

      // Calculs
      const grossSalary = baseSalary + primesData.totalPrimes;
      const socialChargesEmployee = grossSalary * employeeSocialChargeRate;
      const socialChargesEmployer = grossSalary * employerSocialChargeRate;
      const netBeforeAdvances = grossSalary - socialChargesEmployee;
      const netSalary = netBeforeAdvances - advancesData.totalDeduction;

      return {
        employeeId,
        month: targetMonth.toISOString().substring(0, 7),
        baseSalary,
        currency,
        primes: primesData,
        advances: advancesData,
        calculations: {
          grossSalary,
          socialChargesEmployee,
          socialChargesEmployer,
          netBeforeAdvances,
          totalDeductions: advancesData.totalDeduction,
          netSalary
        },
        contractInfo: {
          contractId: activeContract.id,
          type: activeContract.type,
          startDate: activeContract.startDate
        }
      };
    } catch (error) {
      console.error('Erreur calcul salaire net:', error);
      throw error;
    }
  }

  /**
   * Calcule la différence en mois entre deux dates
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {number}
   */
  static getMonthsDifference(startDate, endDate) {
    const years = endDate.getFullYear() - startDate.getFullYear();
    const months = endDate.getMonth() - startDate.getMonth();
    return years * 12 + months;
  }

  /**
   * Vérifie si un employé a des avances en cours de déduction
   * @param {string} employeeId 
   * @param {string} tenantId 
   * @returns {boolean}
   */
  static async hasActiveAdvances(employeeId, tenantId) {
    const currentMonth = new Date();
    const advancesData = await this.calculateAdvanceDeductionsForEmployee(employeeId, currentMonth, tenantId);
    return advancesData.totalDeduction > 0;
  }
}