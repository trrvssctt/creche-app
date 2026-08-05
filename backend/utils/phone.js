// Country plans: code, NSN length, mobile prefix patterns
const PLANS = {
  '221': { nsn: 9, mobile: /^7/ },
  '223': { nsn: 8, mobile: /^[56789]/ },
  '224': { nsn: 9, mobile: /^6/ },
  '225': { nsn: 10, mobile: /^0[157]/ },
  '226': { nsn: 8, mobile: /^[567]/ },
  '227': { nsn: 8, mobile: /^[89]/ },
  '228': { nsn: 8, mobile: /^9/ },
  '229': { nsn: 8, mobile: /^[4569]/ },
  '230': { nsn: 8, mobile: /^5/ },
  '237': { nsn: 9, mobile: /^6/ },
  '241': { nsn: 8, mobile: /^0/ },
  '33':  { nsn: 9, mobile: /^[67]/, trunk: true },
};

const CODES_SORTED = Object.keys(PLANS).sort((a, b) => b.length - a.length);

function stripSpacesAndDashes(raw) {
  return raw.replace(/[\s\-().]/g, '');
}

function detectCountryFromDigits(digits) {
  for (const code of CODES_SORTED) {
    if (digits.startsWith(code)) {
      return { code, nsn: digits.slice(code.length) };
    }
  }
  return null;
}

function validateNsn(nsn, plan) {
  if (nsn.length !== plan.nsn) {
    return `Longueur invalide : ${nsn.length} chiffres au lieu de ${plan.nsn}`;
  }
  if (!plan.mobile.test(nsn)) {
    return `Prefixe mobile invalide pour ce pays`;
  }
  return null;
}

export function normaliserNumero(brut, paysParDefaut = '221') {
  if (!brut || typeof brut !== 'string') {
    return { ok: false, erreur: 'Numero vide ou invalide' };
  }

  let cleaned = stripSpacesAndDashes(brut.trim());

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  if (!/^\d+$/.test(cleaned)) {
    return { ok: false, erreur: 'Le numero contient des caracteres invalides' };
  }

  if (cleaned.length < 7) {
    return { ok: false, erreur: `Numero trop court (${cleaned.length} chiffres)` };
  }

  let detected = detectCountryFromDigits(cleaned);

  if (detected) {
    const plan = PLANS[detected.code];

    if (detected.code === '221' && detected.nsn.startsWith('221')) {
      const inner = detected.nsn.slice(3);
      if (inner.length === plan.nsn && plan.mobile.test(inner)) {
        detected = { code: '221', nsn: inner };
      }
    }

    const err = validateNsn(detected.nsn, plan);
    if (!err) {
      return {
        ok: true,
        e164: `+${detected.code}${detected.nsn}`,
        digits: `${detected.code}${detected.nsn}`,
        pays: detected.code,
      };
    }
  }

  const plan = PLANS[paysParDefaut];
  if (!plan) {
    return { ok: false, erreur: `Code pays inconnu : ${paysParDefaut}` };
  }

  let nsn = cleaned;

  if (plan.trunk && nsn.startsWith('0') && nsn.length === plan.nsn + 1) {
    nsn = nsn.slice(1);
  }

  if (detected && detected.code !== paysParDefaut) {
    nsn = cleaned;
    if (plan.trunk && nsn.startsWith('0') && nsn.length === plan.nsn + 1) {
      nsn = nsn.slice(1);
    }
  }

  const err = validateNsn(nsn, plan);
  if (err) {
    return { ok: false, erreur: err };
  }

  return {
    ok: true,
    e164: `+${paysParDefaut}${nsn}`,
    digits: `${paysParDefaut}${nsn}`,
    pays: paysParDefaut,
  };
}

export function normalizePhone(raw, paysParDefaut = '221') {
  const result = normaliserNumero(raw, paysParDefaut);
  return result.ok ? result.e164 : null;
}
