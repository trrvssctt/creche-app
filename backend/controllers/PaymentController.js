
import { Tenant, Subscription, Payment } from '../models/index.js';
import { StripeService } from '../services/StripeService.js';

export class PaymentController {
  static async handleWebhook(req, res) {
    let provider, status, tenantId, amount, transactionId, planId, period;

    try {
      // Détection webhook Stripe
      const stripeSig = req.headers['stripe-signature'];
      if (stripeSig && process.env.STRIPE_WEBHOOK_SECRET) {
        const event = StripeService.constructEvent(req.body, stripeSig);
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          provider = 'STRIPE';
          status = 'SUCCESS';
          tenantId = session.metadata?.tenantId;
          planId = session.metadata?.planId;
          transactionId = session.id;
          amount = (session.amount_total || 0) / 100;
        } else {
          return res.status(200).send('Ignored');
        }
      } else {
        // Webhook agrégateur générique (Mobile Money / Mock)
        let payload = req.body;
        if (Buffer.isBuffer(payload)) {
          try { payload = JSON.parse(payload.toString()); } catch (e) { }
        }
        ({ provider, status, tenantId, amount, transactionId, planId } = payload || {});
        // Extraire la période pour calculer correctement nextBillingDate
        period = payload?.period || payload?.billingPeriod || '1M';
      }

      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      // Always record the payment event (PENDING or SUCCESS). Activation only on SUCCESS.
      try {
        await Payment.create({
          tenantId,
          saleId: null,
          amount: amount || 0,
          method: provider || 'MOBILE_MONEY',
          reference: transactionId || `SUB-INITIAL-${Date.now()}`,
          status: status || 'PENDING',
          paymentDate: new Date()
        });
      } catch (e) {
        console.error('[PAYMENT CREATE ERROR]', e);
      }

      const PERIOD_MONTHS = { '1M': 1, '3M': 3, '1Y': 12 };
      const billingMonths = PERIOD_MONTHS[period] || 1;

      if (status === 'SUCCESS') {
        // Base calculation on current subscriptionEndsAt if it's in the future (renewal before expiry)
        const currentEnd = tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt) : null;
        const baseDate = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
        const nextBilling = new Date(baseDate);
        nextBilling.setMonth(nextBilling.getMonth() + billingMonths);

        await tenant.update({
          isActive: true,
          paymentStatus: 'UP_TO_DATE',
          lastPaymentDate: new Date(),
          ...(planId ? { planId } : {}),
          subscriptionEndsAt: nextBilling,
        });

        const sub = await Subscription.findOne({ where: { tenantId } });
        if (sub) {
          await sub.update({
            status: 'ACTIVE',
            planId: planId || sub.planId,
            nextBillingDate: nextBilling,
            currentPeriod: period || '1M',
          });
        }
      } else {
        // PENDING : stocker la période et le plan demandé pour que validateSubscription les retrouve
        try {
          await tenant.update({
            paymentStatus: 'PENDING',
            ...(planId ? { pendingPlanId: planId } : {}),
            ...(period ? { pendingPeriod: period } : {}),
          });
          const sub = await Subscription.findOne({ where: { tenantId } });
          if (sub) await sub.update({ status: 'PENDING' });
        } catch (e) {
        }
      }

      return res.status(200).send('OK');
    } catch (error) {
      console.error('Payment webhook error', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
