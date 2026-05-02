
import { PaymentMethod, TransactionStatus, Subscription } from '../types';

/**
 * Simule l'appel à une Cloud Function pour initialiser un paiement
 */
export const initializePaymentSession = async (
  planId: string, 
  method: PaymentMethod,
  amount: number
): Promise<{ sessionId: string; url: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    sessionId: `sess_${Math.random().toString(36).substr(2, 9)}`,
    url: method === 'STRIPE' 
      ? 'https://checkout.stripe.com/pay/simulated' 
      : `https://aggregator.mobilemoney.com/pay/${method.toLowerCase()}/simulated`
  };
};

/**
 * Simule le traitement d'un webhook backend par n8n/Cloud Functions
 */
export const processSubscriptionUpdate = async (
  currentSub: Subscription, 
  newPlanId: string, 
  method: PaymentMethod,
  amount: number
): Promise<Subscription> => {
  // Simulation de traitement backend (mise à jour Firestore)
  await new Promise(resolve => setTimeout(resolve, 1000));

  const newHistoryRecord = {
    id: `PAY-${Date.now().toString().slice(-6)}`,
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    amount,
    method,
    status: 'SUCCESS' as TransactionStatus
  };

  return {
    ...currentSub,
    planId: newPlanId,
    status: 'ACTIVE',
    paymentHistory: [newHistoryRecord, ...currentSub.paymentHistory],
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  };
};

/**
 * Simulation de la logique n8n d'échec de paiement
 */
export const simulatePaymentFailureChain = (attempts: number) => {
  if (attempts >= 3) {
    return { 
      action: 'DOWNGRADE_TO_FREE', 
      message: 'Accès premium révoqué après 3 tentatives infructueuses.' 
    };
  }
  return { 
    action: 'RETRY_LATER', 
    message: `Échec de paiement (Tentative ${attempts}/3). Nouvel essai dans 24h.` 
  };
};
