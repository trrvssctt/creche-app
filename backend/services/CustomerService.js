
import { Customer, Invoice } from '../models/index.js';
import { Op } from 'sequelize';

export class CustomerService {
  /**
   * Analyse les retards de paiement et met à jour le healthStatus
   */
  static async refreshHealthStatus(customerId) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) return;

    const overdueInvoices = await Invoice.count({
      where: {
        customerId,
        status: { [Op.ne]: 'PAID' },
        dueDate: { [Op.lt]: new Date() }
      }
    });

    let newStatus = 'GOOD';
    if (overdueInvoices > 3) {
      newStatus = 'CRITICAL';
    } else if (overdueInvoices > 0) {
      newStatus = 'WARNING';
    }

    if (customer.healthStatus !== newStatus) {
      await customer.update({ healthStatus: newStatus });
    }
    
    return newStatus;
  }
}
