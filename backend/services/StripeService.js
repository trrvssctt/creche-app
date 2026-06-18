let stripe = null;
try {
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
  if (stripeKey) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  }
} catch (e) {
  stripe = null;
}

const PERIOD_MONTHS = { '1M': 1, '3M': 3, '1Y': 12 };
const PERIOD_LABELS = { '1M': '1 mois', '3M': '3 mois', '1Y': '1 an' };

export const StripeService = {
  isAvailable() {
    return stripe !== null;
  },

  /**
   * Crée une Stripe Checkout Session et retourne l'URL de paiement.
   * @param {object} opts
   * @param {string} opts.planId
   * @param {string} opts.planName
   * @param {'1M'|'3M'|'1Y'} opts.period
   * @param {number}  opts.amount  - montant total en FCFA (entier)
   * @param {string}  opts.tenantId
   * @param {string}  opts.userId
   * @param {string}  [opts.cardHolder]
   * @returns {Promise<{url: string, sessionId: string}>}
   */
  async createCheckoutSession({ planId, planName, period, amount, tenantId, userId, cardHolder }) {
    if (!stripe) throw new Error('Stripe non configuré. Veuillez renseigner STRIPE_SECRET.');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Stripe travaille en centimes — FCFA ≈ XOF, code ISO 4217: xof
    // Stripe accepte XOF en mode "zéro-décimal" (1 unité = 1 FCFA)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'xof',
            unit_amount: Math.round(amount), // XOF est zéro-décimal
            product_data: {
              name: `GeStockPro — ${planName}`,
              description: `Abonnement ${PERIOD_LABELS[period] || period}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenantId,
        userId,
        planId,
        period,
        cardHolder: cardHolder || '',
      },
      success_url: `${frontendUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/stripe/cancel`,
    });

    return { url: session.url, sessionId: session.id };
  },

  /**
   * Crée une Stripe Checkout Session pour une nouvelle inscription (sans compte existant).
   * @param {object} opts
   * @param {string} opts.planId
   * @param {string} opts.planName
   * @param {'1M'|'3M'|'1Y'} opts.period
   * @param {number} opts.amount
   * @param {string} opts.intentId - ID du RegistrationIntent
   */
  async createRegistrationCheckoutSession({ planId, planName, period, amount, intentId }) {
    if (!stripe) throw new Error('Stripe non configuré. Veuillez renseigner STRIPE_SECRET_KEY.');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'xof',
            unit_amount: Math.round(amount),
            product_data: {
              name: `GeStockPro — ${planName}`,
              description: `Abonnement ${PERIOD_LABELS[period] || period}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        registrationIntentId: intentId,
        planId,
        period,
      },
      success_url: `${frontendUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&registration=true`,
      cancel_url: `${frontendUrl}/stripe/cancel?registration=true`,
    });

    return { url: session.url, sessionId: session.id };
  },

  /**
   * Vérifie la signature d'un webhook Stripe et retourne l'événement.
   */
  constructEvent(payload, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && signature && stripe) {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    }
    try {
      if (Buffer.isBuffer(payload)) return JSON.parse(payload.toString());
      return typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return payload;
    }
  },

  /**
   * Récupère une session Stripe par son ID.
   */
  async retrieveSession(sessionId) {
    if (!stripe) throw new Error('Stripe non configuré.');
    return stripe.checkout.sessions.retrieve(sessionId);
  },
};
