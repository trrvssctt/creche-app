
import { Sale, SaleItem, Payment, StockItem, ProductMovement, Customer, AuditLog, Service, Invoice, InvoiceItem } from '../models/index.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { sequelize } from '../config/database.js';



async function checkActiveInventory(tenantId) {
  const [active] = await sequelize.query(
    'SELECT name FROM inventory_campaigns WHERE tenant_id = :tenantId AND status = \'DRAFT\' LIMIT 1',
    { replacements: { tenantId }, type: sequelize.QueryTypes.SELECT }
  );
  if (active) throw new Error(`Action bloquée : Un inventaire physique ("${active.name}") est actuellement en cours.`);
}

export class SaleController {

  
  static async list(req, res) {
    try {
      const sales = await Sale.findAll({
        where: { tenantId: req.user.tenantId },
        include: [
          { model: Customer, attributes: ['companyName', 'email', 'phone', 'billingAddress'] },
          { 
            model: SaleItem, 
            as: 'items',
            include: [
              { model: StockItem, as: 'stock_item', attributes: ['name', 'sku'] },
              { model: Service, as: 'service', attributes: ['name'] }
            ] 
          },
          { model: Payment, as: 'payments' }
        ],
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(sales);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const { customerId, walkinName, walkinPhone, items, amountPaid, paymentMethod, paymentReference, paymentProofImage, chequeNumber, bankName, chequeDate, chequeOrder } = req.body;
      const result = await InvoiceService.validateAndGenerate(req.user.tenantId, customerId, items, req.user.id, req.user.name);

      // Sauvegarder les infos du client de passage sur la vente
      if (!customerId && (walkinName || walkinPhone)) {
        await result.sale.update({ walkinName: walkinName || null, walkinPhone: walkinPhone || null });
      }

      const isCheque = paymentMethod === 'CHEQUE';
      const isTransfer = paymentMethod === 'TRANSFER';
      // Chèque et virement : paiement en attente d'encaissement
      const isPendingMethod = isCheque || isTransfer;

      if (amountPaid > 0) {
        await Payment.create({
          tenantId: req.user.tenantId,
          saleId: result.sale.id,
          amount: amountPaid,
          method: paymentMethod || 'CASH',
          reference: paymentReference || (isPendingMethod ? null : 'ACOMPTE_INITIAL'),
          proofImage: paymentProofImage || null,
          chequeNumber: chequeNumber || null,
          bankName: bankName || null,
          chequeDate: chequeDate || null,
          chequeOrder: chequeOrder || null,
          // Chèque et virement : PENDING jusqu'à confirmation d'encaissement
          status: isPendingMethod ? 'PENDING' : 'PAID'
        });
        if (!isPendingMethod) {
          // Méthodes immédiates (espèces, mobile money) → créditer directement
          await result.sale.update({ amountPaid });
        } else {
          // Chèque / virement → la vente passe en BROUILLON en attendant l'encaissement
          await result.sale.update({ status: 'BROUILLON' });
        }
      }
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  static async updateSale(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { customerId, items } = req.body;
      const tenantId = req.user.tenantId;

      const sale = await Sale.findByPk(id, { include: [{ model: SaleItem, as: 'items' }], transaction });
      if (!sale) throw new Error("Vente introuvable.");
      
      if (parseFloat(sale.amountPaid) > 0) throw new Error("Modification interdite : des règlements sont déjà enregistrés.");
      const hasDeliveries = sale.items.some(i => parseInt(i.quantityDelivered || i.quantity_delivered || 0) > 0);
      if (hasDeliveries) throw new Error("Modification interdite : certains articles ont déjà été livrés.");

      await SaleItem.destroy({ where: { saleId: id }, transaction });
      const invoice = await Invoice.findOne({ where: { saleId: id, tenantId }, transaction });
      if (invoice) {
        await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction });
      }

      let newTotalHt = 0;
      for (const item of items) {
        const itemHt = item.price * item.quantity;
        newTotalHt += itemHt;

        await SaleItem.create({
          saleId: id, 
          stockItemId: item.type === 'PRODUCT' ? item.productId : null,
          serviceId: item.type === 'SERVICE' ? item.productId : null,
          quantity: item.quantity, quantityDelivered: 0, unitPrice: item.price,
          totalTtc: itemHt * 1.18, taxRate: 18
        }, { transaction });

        if (invoice) {
          await InvoiceItem.create({
            invoiceId: invoice.id, productId: item.type === 'PRODUCT' ? item.productId : null,
            name: item.name, qty: item.quantity, price: item.price, tva: 18
          }, { transaction });
        }
        // Pas de mouvement de stock ici non plus.
      }

      const ttc = newTotalHt * 1.18;
      await sale.update({ 
        customerId: customerId || null, 
        totalHt: newTotalHt, 
        totalTtc: ttc, 
        taxAmount: ttc - newTotalHt 
      }, { transaction });

      if (invoice) {
        await invoice.update({ 
          customerId: customerId || null, 
          amount: newTotalHt, 
          taxAmount: ttc - newTotalHt 
        }, { transaction });
      }

      await transaction.commit();
      return res.status(200).json({ message: "Transaction mise à jour." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  static async cancelSale(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { reason, returnToStockMap } = req.body; 

      const sale = await Sale.findByPk(id, { include: [{ model: SaleItem, as: 'items' }], transaction });
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      
      // Restauration uniquement pour ce qui a ÉTÉ livré physiquement
      for (const item of sale.items) {
        const delivered = parseInt(item.quantityDelivered || item.quantity_delivered || 0);
        const qtyToReturn = Math.min(delivered, returnToStockMap?.[item.id] || 0);
        const sId = item.stockItemId || item.stock_item_id;
        
        if (qtyToReturn > 0 && sId) {
          const product = await StockItem.findByPk(sId, { transaction });
          if (product) {
            const prev = product.currentLevel;
            await product.increment('currentLevel', { by: qtyToReturn, transaction });
            await ProductMovement.create({
              tenantId: req.user.tenantId, stockItemId: sId, type: 'IN', qty: qtyToReturn,
              reason: `Annulation Livraison Vente ${sale.reference}`, previousLevel: prev, newLevel: prev + qtyToReturn,
              userRef: req.user.name, referenceId: sale.reference
            }, { transaction });
          }
        }
      }

      const totalPaid = parseFloat(sale.amountPaid || 0);
      if (totalPaid > 0) {
        await Payment.create({
          tenantId: req.user.tenantId,
          saleId: id,
          amount: -totalPaid,
          method: 'CASH',
          reference: `ANNULATION_${sale.reference}`,
          paymentDate: new Date()
        }, { transaction });
      }

      await sale.update({ status: 'ANNULE', amountPaid: 0 }, { transaction });
      await Invoice.update({ status: 'CANCELLED' }, { where: { saleId: id, tenantId: req.user.tenantId }, transaction });

      await transaction.commit();
      return res.status(200).json({ message: 'Vente annulée.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: 'CancelError', message: error.message });
    }
  }

  static async addPayment(req, res) {
    try {
      const { id } = req.params;
      const { amount, method, reference, proofImage, chequeNumber, bankName, chequeDate, chequeOrder } = req.body;
      const sale = await Sale.findByPk(id);
      if (!sale) return res.status(404).json({ error: 'Sale not found' });

      const isCheque = method === 'CHEQUE';
      const isTransfer = method === 'TRANSFER';
      const isPendingMethod = isCheque || isTransfer;

      await Payment.create({
        tenantId: req.user.tenantId,
        saleId: id,
        amount,
        method,
        reference: reference || null,
        proofImage: proofImage || null,
        chequeNumber: chequeNumber || null,
        bankName: bankName || null,
        chequeDate: chequeDate || null,
        chequeOrder: chequeOrder || null,
        // Chèque et virement commencent en PENDING, les autres sont directement PAID
        status: isPendingMethod ? 'PENDING' : 'PAID'
      });

      if (!isPendingMethod) {
        // Méthodes immédiates → créditer et mettre à jour le statut de la vente
        const newPaid = parseFloat(sale.amountPaid) + parseFloat(amount);
        const newStatus = newPaid >= parseFloat(sale.totalTtc) ? 'TERMINE' : 'EN_COURS';
        await sale.update({ amountPaid: newPaid, status: newStatus });
      } else {
        // Chèque / virement → passer en BROUILLON si pas encore encaissé
        if (sale.status === 'EN_COURS' && parseFloat(sale.amountPaid) === 0) {
          await sale.update({ status: 'BROUILLON' });
        }
      }

      return res.status(200).json({ message: 'Paiement enregistré.' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updatePaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const { status } = req.body;

      const VALID_STATUSES = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED'];
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }

      const payment = await Payment.findByPk(paymentId);
      if (!payment) return res.status(404).json({ error: 'Paiement introuvable' });
      if (!['CHEQUE', 'TRANSFER'].includes(payment.method)) {
        return res.status(400).json({ error: 'Seuls les paiements par chèque ou virement peuvent être mis à jour via ce endpoint' });
      }

      const prevStatus = payment.status;
      await payment.update({ status });

      if (payment.saleId) {
        const sale = await Sale.findByPk(payment.saleId);
        if (sale) {
          // Paiement confirmé encaissé (PAID) → créditer la trésorerie
          if (status === 'PAID' && prevStatus !== 'PAID') {
            const newPaid = parseFloat(sale.amountPaid) + parseFloat(payment.amount);
            const newSaleStatus = newPaid >= parseFloat(sale.totalTtc) ? 'TERMINE' : 'EN_COURS';
            await sale.update({ amountPaid: newPaid, status: newSaleStatus });
          }
          // Paiement rejeté/impayé alors qu'il était déjà PAID → décréditer
          if (['REJECTED', 'FAILED'].includes(status) && prevStatus === 'PAID') {
            const newPaid = Math.max(0, parseFloat(sale.amountPaid) - parseFloat(payment.amount));
            const newSaleStatus = newPaid >= parseFloat(sale.totalTtc) ? 'TERMINE' : 'EN_COURS';
            await sale.update({ amountPaid: newPaid, status: newSaleStatus });
          }
          // Paiement rejeté depuis PENDING → la vente repasse EN_COURS si plus de PENDING
          if (['REJECTED', 'FAILED'].includes(status) && prevStatus === 'PENDING') {
            const pendingCount = await Payment.count({ where: { saleId: sale.id, status: 'PENDING' } });
            if (pendingCount === 0 && sale.status === 'BROUILLON') {
              await sale.update({ status: 'EN_COURS' });
            }
          }
        }
      }

      return res.status(200).json({ message: 'Statut mis à jour.' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async recordDelivery(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { items } = req.body; 
      const tenantId = req.user.tenantId;

      const sale = await Sale.findByPk(id, { transaction });
      if (!sale) throw new Error("Vente non trouvée");

      for (const deliveryLine of items) {
        const saleItem = await SaleItem.findByPk(deliveryLine.itemId, { transaction });
        if (saleItem && saleItem.stockItemId) {
          const product = await StockItem.findOne({ where: { id: saleItem.stockItemId, tenantId }, transaction });
          
          if (!product || product.currentLevel < deliveryLine.qtyToDeliver) {
            throw new Error(`Stock physique insuffisant pour ${product?.name || 'article'}.`);
          }

          const currentDel = parseInt(saleItem.quantityDelivered || saleItem.quantity_delivered || 0);
          const updatedDelQty = currentDel + parseInt(deliveryLine.qtyToDeliver);
          
          const prevStock = product.currentLevel;
          await product.decrement('currentLevel', { by: deliveryLine.qtyToDeliver, transaction });
          await saleItem.update({ quantityDelivered: updatedDelQty }, { transaction });

          await ProductMovement.create({
            tenantId,
            stockItemId: saleItem.stockItemId,
            type: 'OUT',
            qty: deliveryLine.qtyToDeliver,
            reason: `Livraison Vente ${sale.reference}`,
            previousLevel: prevStock,
            newLevel: prevStock - deliveryLine.qtyToDeliver,
            userRef: req.user.name,
            referenceId: sale.reference
          }, { transaction });
        }
      }

      await transaction.commit();
      return res.status(200).json({ message: 'Livraison scellée et stock décrémenté.' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ error: 'DeliveryError', message: error.message });
    }
  }
}
