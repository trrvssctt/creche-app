import axios from 'axios';
import { Tenant } from '../models/Tenant.js';

export const PaymentGateway = {
  /**
   * n8n Relance Webhook
   */
  async triggerN8NRelance(tenantId, invoiceId) {
    const webhookUrl = process.env.N8N_RELANCE_URL;
    if (!webhookUrl) return;

    try {
      await axios.post(webhookUrl, { tenantId, invoiceId, timestamp: new Date() });
    } catch (e) {
      console.error('n8n Relance failed');
    }
  },

  /**
   * Gère les callbacks multi-providers
   */
  async processPaymentCallback(payload) {
    const { tenantId, amount, status, provider } = payload || {};
    
    if (status === 'SUCCESS') {
      const tenant = await Tenant.findByPk(tenantId);
      if (tenant) {
        await tenant.update({ 
          isActive: true, 
          paymentStatus: 'UP_TO_DATE',
          lastPaymentDate: new Date()
        });
        return true;
      }
    }
    return false;
  },

  /**
   * Initialise un paiement (implémentation minimale/mock)
   * Retourne un objet { provider, sessionId, redirectUrl }
   */
  async initializePayment(paymentMethod, amount, currency = 'F CFA', metadata = {}) {
    // Si Stripe est configuré, l'intégration réelle pourrait être faite ici.
    // Pour garder la dépendance optionnelle, on retourne une réponse mock.
    const sessionId = `sess_${Date.now()}`;
    return {
      provider: 'MOCK',
      sessionId,
      amount,
      currency,
      redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payments/complete/${sessionId}`,
      metadata
    };
  }
};

// Backward compatibility: export default-like name
export const PaymentService = PaymentGateway;
