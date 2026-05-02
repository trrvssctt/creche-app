
import { FinanceService } from '../services/FinanceService.js';
import { Invoice, InvoiceItem } from '../models/index.js';

export class FinanceController {
  /**
   * Récupère le rapport de performance global
   */
  static async getFinancialReport(req, res) {
    try {
      const { period } = req.query; // e.g., '30d', '90d', 'year'
      const tenantId = req.user.tenantId;

      const days = period === 'year' ? 365 : parseInt(period) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const summary = await FinanceService.getCashFlowSummary(tenantId, startDate, endDate);
      const topCustomers = await FinanceService.getTopCustomers(tenantId);

      return res.status(200).json({
        period,
        summary,
        topCustomers,
        currency: 'F CFA',
        timestamp: new Date()
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Génère un export JSON des ventes (prêt pour conversion CSV/XLS)
   */
  static async exportAccountingJournal(req, res) {
    try {
      const { month, year } = req.query;
      const tenantId = req.user.tenantId;

      const journal = await Invoice.findAll({
        where: {
          tenantId,
          // Logique de filtrage par mois/année simplifiée
          status: 'PAID'
        },
        include: [InvoiceItem]
      });

      return res.status(200).json({
        exportType: 'ACCOUNTING_JOURNAL',
        tenant: tenantId,
        data: journal
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
