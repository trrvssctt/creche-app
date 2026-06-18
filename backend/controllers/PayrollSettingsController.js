import { PayrollSettings } from '../models/index.js';

export class PayrollSettingsController {
  static async get(req, res) {
    try {
      const tenantId = req.user.tenantId;
      
      let settings = await PayrollSettings.findOne({ 
        where: { tenantId } 
      });
      
      // Créer des paramètres par défaut s'ils n'existent pas
      if (!settings) {
        settings = await PayrollSettings.create({ 
          tenantId,
          employerSocialChargeRate: 18.5,  // 18.5% pour l'employeur au Sénégal
          employeeSocialChargeRate: 8.2,   // 8.2% pour le salarié au Sénégal
          taxRate: 10.0, // 10% d'impôt
          minimumWage: 60000, // Salaire minimum sénégalais
          currency: 'F CFA',
          paymentDay: 28,
          overtimeRate: 1.5
        });
      }
      
      return res.status(200).json(settings);
    } catch (error) {
      console.error('PayrollSettingsController.get error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      
      const [settings, created] = await PayrollSettings.findOrCreate({
        where: { tenantId },
        defaults: { 
          tenantId,
          ...req.body 
        }
      });
      
      if (!created) {
        await settings.update(req.body);
      }
      
      return res.status(200).json(settings);
    } catch (error) {
      console.error('PayrollSettingsController.update error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async calculatePayroll(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { baseSalary, overtime = 0, bonuses = 0, deductions = 0 } = req.body;
      
      const settings = await PayrollSettings.findOne({ where: { tenantId } });
      
      if (!settings) {
        return res.status(404).json({ error: 'Payroll settings not configured' });
      }
      
      // Calculs de paie
      const overtimeAmount = overtime * settings.overtimeRate;
      const grossSalary = parseFloat(baseSalary) + overtimeAmount + parseFloat(bonuses);
      
      // Charges sociales employeur et employé (en pourcentage)
      const employerSocialCharges = grossSalary * (settings.employerSocialChargeRate / 100);
      const employeeSocialCharges = grossSalary * (settings.employeeSocialChargeRate / 100);
      const taxes = grossSalary * (settings.taxRate / 100);
      
      const totalEmployeeDeductions = employeeSocialCharges + taxes + parseFloat(deductions);
      const netSalary = grossSalary - totalEmployeeDeductions;
      
      return res.status(200).json({
        baseSalary: parseFloat(baseSalary),
        overtime: overtimeAmount,
        bonuses: parseFloat(bonuses),
        grossSalary,
        employerSocialCharges,
        employeeSocialCharges,
        taxes,
        deductions: parseFloat(deductions),
        totalEmployeeDeductions,
        netSalary,
        calculations: {
          employerSocialChargeRate: settings.employerSocialChargeRate,
          employeeSocialChargeRate: settings.employeeSocialChargeRate,
          taxRate: settings.taxRate,
          overtimeRate: settings.overtimeRate
        }
      });
    } catch (error) {
      console.error('PayrollSettingsController.calculatePayroll error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}