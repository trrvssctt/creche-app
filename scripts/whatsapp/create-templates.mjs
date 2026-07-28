#!/usr/bin/env node
/**
 * Crée les 4 templates WhatsApp sur le WABA Le Toit des Anges.
 * Usage :
 *   node scripts/whatsapp/create-templates.mjs           # crée les templates manquants
 *   node scripts/whatsapp/create-templates.mjs --status  # affiche l'état actuel
 *
 * Prérequis : variable d'environnement WA_TOKEN (token système Meta, jamais commité).
 */

const WABA_ID = '1050993424073060';
const APP_ID = '1260415382840492';
const PHONE_NUMBER_ID = '1172273209313492';
const API_VERSION = 'v23.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const LANG = 'fr';

// ── Vérification token ──────────────────────────────────────────────────────

const WA_TOKEN = process.env.WA_TOKEN;
if (!WA_TOKEN) {
  console.error('\n❌ Variable WA_TOKEN manquante.');
  console.error('   Export-la avant de relancer :');
  console.error('   export WA_TOKEN="votre_token_systeme_meta"\n');
  process.exit(1);
}

// ── Définition des templates ────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'relance_redevance',
    category: 'UTILITY',
    language: LANG,
    components: [
      {
        type: 'BODY',
        text: 'Bonjour {{1}}, la redevance de {{2}} pour {{3}} d\'un montant de {{4}} reste à régler. Nous restons à votre disposition pour toute question.',
        example: { body_text: [['Awa', 'Fatou Diop', 'Juillet 2026', '45 000 FCFA']] },
      },
      {
        type: 'FOOTER',
        text: 'Le Toit des Anges',
      },
    ],
  },
  {
    name: 'notification_ecole',
    category: 'UTILITY',
    language: LANG,
    components: [
      {
        type: 'BODY',
        text: 'Bonjour {{1}}, information de l\'établissement concernant {{2}} : {{3}} Merci de votre attention.',
        example: { body_text: [['Awa', 'Fatou Diop', 'la sortie scolaire du 12 août est reportée au 19 août.']] },
      },
      {
        type: 'FOOTER',
        text: 'Le Toit des Anges',
      },
    ],
  },
  {
    name: 'facture_mensuelle',
    category: 'UTILITY',
    language: LANG,
    needsDocumentHeader: true,
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // example.header_handle sera ajouté dynamiquement après upload
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}}, voici la facture de {{2}} pour {{3}}. Montant à régler : {{4}}. Merci de votre confiance.',
        example: { body_text: [['Awa', 'Fatou Diop', 'Juillet 2026', '45 000 FCFA']] },
      },
      {
        type: 'FOOTER',
        text: 'Le Toit des Anges',
      },
    ],
  },
  {
    name: 'recu_paiement',
    category: 'UTILITY',
    language: LANG,
    needsDocumentHeader: true,
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
      },
      {
        type: 'BODY',
        text: 'Merci {{1}}, nous confirmons la réception de votre paiement de {{2}} pour {{3}}. Référence : {{4}}. Ce reçu vous est joint.',
        example: { body_text: [['Awa', '20 000 FCFA', 'Fatou Diop', 'REC-2026-0143']] },
      },
      {
        type: 'FOOTER',
        text: 'Le Toit des Anges',
      },
    ],
  },
];

// ── Helpers API ─────────────────────────────────────────────────────────────

async function metaGet(path) {
  const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}access_token=${WA_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function metaPost(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Upload PDF d'exemple pour les headers DOCUMENT ──────────────────────────

async function uploadExamplePdf() {
  const fs = await import('fs');
  const path = await import('path');
  const pdfPath = path.join(import.meta.dirname || '.', 'exemple-facture.pdf');

  let pdfBuffer;
  if (fs.existsSync(pdfPath)) {
    pdfBuffer = fs.readFileSync(pdfPath);
  } else {
    // Générer un PDF minimal valide (1 page blanche)
    console.log('   ℹ️  Génération d\'un PDF d\'exemple minimal...');
    pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF',
      'utf-8'
    );
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`   ✅ PDF d'exemple créé : ${pdfPath}`);
  }

  // Étape 1 : ouvrir une session d'upload
  console.log('   📤 Upload du PDF d\'exemple vers Meta...');
  const uploadSession = await metaPost(`/${APP_ID}/uploads?file_length=${pdfBuffer.length}&file_type=application/pdf&access_token=${WA_TOKEN}`, {});

  if (!uploadSession.id) {
    // Fallback : essayer avec GET + query params (certaines versions de l'API)
    const sessionRes = await fetch(
      `${BASE_URL}/${APP_ID}/uploads?file_length=${pdfBuffer.length}&file_type=application/pdf&access_token=${WA_TOKEN}`,
      { method: 'POST' }
    );
    const sessionData = await sessionRes.json();
    if (!sessionData.id) {
      throw new Error(`Impossible d'ouvrir une session upload: ${JSON.stringify(sessionData)}`);
    }
    uploadSession.id = sessionData.id;
  }

  // Étape 2 : téléverser le contenu
  const uploadRes = await fetch(`${BASE_URL}/${uploadSession.id}`, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${WA_TOKEN}`,
      'file_offset': '0',
      'Content-Type': 'application/pdf',
    },
    body: pdfBuffer,
  });
  const uploadData = await uploadRes.json();

  if (!uploadData.h) {
    throw new Error(`Upload échoué, pas de header_handle: ${JSON.stringify(uploadData)}`);
  }

  console.log(`   ✅ header_handle obtenu : ${uploadData.h.slice(0, 30)}...`);
  return uploadData.h;
}

// ── Lister les templates existants ──────────────────────────────────────────

async function listExistingTemplates() {
  const data = await metaGet(`/${WABA_ID}/message_templates?limit=100`);
  return data.data || [];
}

// ── Afficher le statut ──────────────────────────────────────────────────────

function printStatusTable(existing) {
  const targetNames = TEMPLATES.map(t => t.name);
  const relevant = existing.filter(t => targetNames.includes(t.name) && t.language === LANG);

  console.log('\n┌────────────────────────┬────────┬──────────────┬──────────┐');
  console.log('│ Template               │ Langue │ Statut       │ Catégorie│');
  console.log('├────────────────────────┼────────┼──────────────┼──────────┤');

  for (const tmpl of TEMPLATES) {
    const found = relevant.find(t => t.name === tmpl.name);
    const status = found?.status || '—';
    const cat = found?.category || '—';
    const statusColor = status === 'APPROVED' ? '\x1b[32m' :
                        status === 'PENDING' ? '\x1b[33m' :
                        status === 'REJECTED' ? '\x1b[31m' : '\x1b[90m';
    console.log(
      `│ ${tmpl.name.padEnd(22)} │ ${LANG.padEnd(6)} │ ${statusColor}${status.padEnd(12)}\x1b[0m │ ${(cat || '').padEnd(8)}│`
    );
  }

  console.log('└────────────────────────┴────────┴──────────────┴──────────┘\n');

  // Templates pas encore créés
  const missing = TEMPLATES.filter(t => !relevant.find(e => e.name === t.name));
  if (missing.length > 0) {
    console.log(`⚠️  ${missing.length} template(s) non encore créé(s) : ${missing.map(t => t.name).join(', ')}`);
  }

  const pending = relevant.filter(t => t.status === 'PENDING');
  if (pending.length > 0) {
    console.log(`⏳ ${pending.length} template(s) en attente d'approbation (généralement 1-24h)`);
  }

  const rejected = relevant.filter(t => t.status === 'REJECTED');
  if (rejected.length > 0) {
    console.log(`❌ ${rejected.length} template(s) rejeté(s) — voir WhatsApp Manager pour le motif`);
    console.log('   → Supprimer et recréer après correction (un template rejeté ne peut pas être modifié)');
  }
}

// ── Création des templates ──────────────────────────────────────────────────

async function createTemplates() {
  console.log('\n🔄 Récupération des templates existants...');
  const existing = await listExistingTemplates();
  const existingByName = {};
  for (const t of existing) {
    if (t.language === LANG) existingByName[t.name] = t;
  }

  let headerHandle = null;
  const needsUpload = TEMPLATES.some(t => t.needsDocumentHeader && !existingByName[t.name]);
  if (needsUpload) {
    try {
      headerHandle = await uploadExamplePdf();
    } catch (err) {
      console.warn(`\n⚠️  Upload PDF échoué : ${err.message}`);
      console.warn('   Les templates avec en-tête DOCUMENT seront créés sans exemple.');
      console.warn('   → Ajoutez le PDF manuellement dans WhatsApp Manager après création.\n');
    }
  }

  console.log('\n📋 Création des templates...\n');

  for (const tmpl of TEMPLATES) {
    const existingTmpl = existingByName[tmpl.name];
    if (existingTmpl) {
      const statusIcon = existingTmpl.status === 'APPROVED' ? '✅' :
                         existingTmpl.status === 'PENDING' ? '⏳' : '❌';
      console.log(`   ${statusIcon} ${tmpl.name} — existe déjà (${existingTmpl.status}), ignoré`);
      continue;
    }

    // Préparer les composants
    const components = tmpl.components.map(c => {
      if (c.type === 'HEADER' && c.format === 'DOCUMENT') {
        const header = { type: 'HEADER', format: 'DOCUMENT' };
        if (headerHandle) {
          header.example = { header_handle: [headerHandle] };
        }
        return header;
      }
      return { ...c };
    });

    const payload = {
      name: tmpl.name,
      category: tmpl.category,
      language: tmpl.language,
      components,
    };

    try {
      const result = await metaPost(`/${WABA_ID}/message_templates`, payload);
      console.log(`   ✅ ${tmpl.name} — créé avec succès (id: ${result.id}, status: ${result.status || 'PENDING'})`);
    } catch (err) {
      console.error(`   ❌ ${tmpl.name} — échec : ${err.message}`);
    }
  }

  // Afficher le statut final
  console.log('\n📊 État final des templates :');
  const updated = await listExistingTemplates();
  printStatusTable(updated);
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--status') || args.includes('-s')) {
  console.log('\n📊 Statut des templates WhatsApp (WABA: Le Toit des Anges)');
  const existing = await listExistingTemplates();
  printStatusTable(existing);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage :
  node scripts/whatsapp/create-templates.mjs           Créer les templates manquants
  node scripts/whatsapp/create-templates.mjs --status  Voir l'état actuel
  node scripts/whatsapp/create-templates.mjs --help    Cette aide

Prérequis :
  export WA_TOKEN="votre_token_systeme_meta"
`);
} else {
  await createTemplates();
}
