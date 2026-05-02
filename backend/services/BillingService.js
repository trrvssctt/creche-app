
import { Invoice, Tenant } from '../models/index.js';

export class BillingService {
  /**
   * Génère un numéro de facture unique basé sur le préfixe configuré du Tenant
   */
  static async generateInvoiceNumber(tenantId) {
    const tenant = await Tenant.findByPk(tenantId);
    const prefix = tenant ? tenant.invoicePrefix : 'INV-';
    
    const count = await Invoice.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const sequential = (count + 1).toString().padStart(5, '0');
    
    return `${prefix}${year}-${sequential}`;
  }

  /**
   * Calcule les totaux en fonction du taux de TVA paramétré du Tenant
   */
  static calculateTotals(items, customTaxRate = null) {
    const ht = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const taxRate = customTaxRate !== null ? customTaxRate : 18; // 18% par défaut si non spécifié
    const tva = ht * (taxRate / 100);
    
    return {
      ht,
      tva,
      ttc: ht + tva,
      taxRate
    };
  }
}
