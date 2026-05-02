// Payroll configuration and basic compute engine (country-parametrized)

export const PAYROLL_CONFIG = {
  FR: {
    country: 'France',
    currency: '€',
    // Simplified illustrative rates — replace with precise, up-to-date rules per country
    incomeTaxRate: 0.20,
    socialContributionsEmployee: 0.22,
    socialContributionsEmployer: 0.45,
    allowances: {
      transport: 0,
      meals: 0
    }
  },
  CI: {
    country: 'Côte d\'Ivoire',
    currency: 'F CFA',
    incomeTaxRate: 0.10,
    socialContributionsEmployee: 0.07,
    socialContributionsEmployer: 0.18,
    allowances: {}
  }
};

/**
 * computePayroll(gross, countryCode, options)
 * - gross: number
 * - countryCode: string key in PAYROLL_CONFIG (e.g., 'FR', 'CI')
 * - options: { deductions: number, other: object }
 * Returns { gross, taxes, socialEmployee, socialEmployer, deductions, net, meta }
 */
export function computePayroll(gross, countryCode = 'CI', options = {}) {
  const cfg = PAYROLL_CONFIG[countryCode] || PAYROLL_CONFIG.CI;
  
  // Validation et normalisation des montants
  const validGross = validateAmount(gross);
  const validDeductions = validateAmount(options.deductions || 0);
  
  const tax = Number((validGross * cfg.incomeTaxRate).toFixed(2));
  const socialEmployee = Number((validGross * cfg.socialContributionsEmployee).toFixed(2));
  const socialEmployer = Number((validGross * cfg.socialContributionsEmployer).toFixed(2));
  const net = Number((validGross - tax - socialEmployee - validDeductions).toFixed(2));

  return {
    gross: validGross,
    taxes: tax,
    socialEmployee,
    socialEmployer,
    deductions: validDeductions,
    net,
    currency: cfg.currency,
    meta: {
      country: cfg.country,
      appliedRates: {
        incomeTaxRate: cfg.incomeTaxRate,
        socialEmployee: cfg.socialContributionsEmployee,
        socialEmployer: cfg.socialContributionsEmployer
      },
      rawOptions: options
    }
  };
}

/**
 * Valide et normalise un montant financier
 * @param {any} amount - Le montant à valider
 * @returns {number} - Le montant validé et normalisé
 */
export function validateAmount(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return 0;
  }
  
  const parsed = parseFloat(amount);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    console.warn('Montant invalide détecté:', amount, '- Utilisé 0 à la place');
    return 0;
  }
  
  if (parsed < 0) {
    console.warn('Montant négatif détecté:', parsed, '- Utilisé valeur absolue');
    return Math.abs(parsed);
  }
  
  // Vérification des montants aberrants (plus de 1 milliard)
  if (parsed > 1000000000) {
    console.error('Montant aberrant détecté:', parsed, '- Valeur trop élevée, rejeté');
    return 0;
  }
  
  // Arrondir à 2 décimales pour éviter les problèmes de précision flottante
  return Math.round(parsed * 100) / 100;
}

/**
 * Calcule les déductions d'avances pour une période donnée
 * @param {Array} advances - Liste des avances
 * @param {Date} periodStart - Début de la période
 * @param {Date} periodEnd - Fin de la période
 * @returns {number} - Total des déductions pour la période
 */
export function calculateAdvanceDeductions(advances, periodStart, periodEnd) {
  if (!Array.isArray(advances)) {
    return 0;
  }
  
  let totalDeductions = 0;
  
  advances.forEach(advance => {
    if (advance.status !== 'APPROVED' || !advance.startDate || !advance.endDate) {
      return;
    }
    
    const startDate = new Date(advance.startDate);
    const endDate = new Date(advance.endDate);
    
    // Vérifier si l'avance est active pendant la période
    if (startDate <= periodEnd && endDate >= periodStart) {
      const monthlyAmount = validateAmount(advance.amount);
      totalDeductions += monthlyAmount;
    }
  });
  
  return validateAmount(totalDeductions);
}
