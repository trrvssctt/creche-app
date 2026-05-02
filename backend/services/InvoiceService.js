

import { sequelize } from '../config/database.js';
import { StockItem } from '../models/StockItem.js';
import { Invoice } from '../models/Invoice.js';
import { InvoiceItem } from '../models/InvoiceItem.js';
import { ProductMovement } from '../models/ProductMovement.js';
import { Sale } from '../models/Sale.js';
import { SaleItem } from '../models/SaleItem.js';

export class InvoiceService {
  static async validateAndGenerate(tenantId, customerId, items, userId, userName) {
    const transaction = await sequelize.transaction();

    try {
      const cleanCustomerId = (customerId && customerId !== "") ? customerId : null;
      const ht = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const taxRate = 18;
      const tva = ht * (taxRate / 100);
      const ttc = ht + tva;

      const saleRef = `V-${Date.now().toString().slice(-6)}`;
      const sale = await Sale.create({
        tenantId,
        customerId: cleanCustomerId,
        reference: saleRef,
        status: 'EN_COURS',
        totalHt: ht,
        totalTtc: ttc,
        taxAmount: tva,
        amountPaid: 0
      }, { transaction });

      const invoiceId = `INV-${Date.now().toString().slice(-8)}`;
      await Invoice.create({
        id: invoiceId,
        tenantId,
        saleId: sale.id,
        customerId: cleanCustomerId,
        amount: ht,
        taxAmount: tva,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }, { transaction });

      for (const item of items) {
        await SaleItem.create({
          saleId: sale.id,
          stockItemId: item.type === 'PRODUCT' ? item.productId : null,
          serviceId: item.type === 'SERVICE' ? item.productId : null,
          quantity: item.quantity,
          quantityDelivered: 0,
          unitPrice: item.price,
          totalTtc: item.price * item.quantity * 1.18,
          taxRate: 18
        }, { transaction });

        await InvoiceItem.create({
          invoiceId,
          productId: item.type === 'PRODUCT' ? item.productId : null,
          name: item.name || "Article",
          qty: item.quantity,
          price: item.price,
          tva: taxRate
        }, { transaction });

        // NOTE: La décrémentation du stock est désormais déléguée au module de Livraison/Sortie de stock.
        // Aucune action sur StockItem ou ProductMovement n'est effectuée ici.
      }

      await transaction.commit();
      return { sale };
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }
  /**
   * Enregistre un paiement et met à jour l'encours
   */
  static async recordPayment(invoiceId, amount, method, tenantId) {
    const transaction = await sequelize.transaction();
    try {
      const invoice = await Invoice.findOne({ where: { id: invoiceId, tenantId }, transaction });
      if (!invoice) throw new Error('Facture introuvable.');

      const customer = await Customer.findByPk(invoice.customerId, { transaction });
      
      await invoice.update({ status: 'PAID' }, { transaction });
      await customer.decrement('outstandingBalance', { by: amount, transaction });

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
