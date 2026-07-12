import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Eleve } from '../types';

// ── Constantes ──────────────────────────────────────────────────────────────

function getAnnee(): string {
  try {
    const saved = localStorage.getItem('tda_annee_active');
    if (saved) return saved;
    const cfg = localStorage.getItem('tda_school_config');
    if (cfg) { const p = JSON.parse(cfg); if (p?.anneeLibelle) return p.anneeLibelle; }
  } catch { /* ignore */ }
  const y = new Date().getFullYear();
  return new Date().getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const NIVEAUX_MAP: Record<string, string> = {
  CRECHE: 'Crèche (3–12 mois)',
  PS: 'Petite Section',
  MS: 'Moyenne Section',
  GS: 'Grande Section',
  CP: 'CP',
  CE1: 'CE1',
  CE2: 'CE2',
  CM1: 'CM1',
  CM2: 'CM2',
};

const REGIMES_MAP: Record<string, string> = {
  NORMAL: 'Normal',
  CAS_SOCIAL_PARTIEL: 'Cas social (partiel)',
  CAS_SOCIAL_TOTAL: 'Cas social (total)',
};

// ── Logo loader ──────────────────────────────────────────────────────────────

let _logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (_logoBase64Cache) return _logoBase64Cache;
  try {
    const logoUrl = new URL('../assets/Image/logo_entreprise.png', import.meta.url).href;
    const res = await fetch(logoUrl);
    if (!res.ok) throw new Error('logo fetch failed');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _logoBase64Cache = reader.result as string;
        resolve(_logoBase64Cache);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ── CSS partagé ──────────────────────────────────────────────────────────────

const SHARED_CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  @media print {
    body { width: auto !important; max-width: 100% !important; padding: 0 !important; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: #fff;
    width: 794px;
    max-width: 100%;
    padding: 32px 44px 40px;
  }
  .page-header {
    display: flex;
    align-items: center;
    gap: 20px;
    border-bottom: 3px solid #4f46e5;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .logo-wrap img {
    width: 64px;
    height: auto;
    object-fit: contain;
  }
  .school-info { flex: 1; }
  .school-name {
    font-size: 18pt;
    font-weight: 900;
    color: #4f46e5;
    text-transform: uppercase;
    letter-spacing: 2px;
    line-height: 1.1;
  }
  .school-addr {
    font-size: 8.5pt;
    color: #64748b;
    margin-top: 3px;
    line-height: 1.5;
  }
  .doc-badge {
    text-align: right;
  }
  .doc-badge .annee {
    font-size: 8pt;
    color: #64748b;
    font-weight: 700;
    display: block;
  }
  .titre {
    font-size: 14pt;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #0f172a;
    margin-bottom: 8px;
  }
  .ref-box {
    text-align: center;
    background: #eef2ff;
    border: 2px solid #c7d2fe;
    border-radius: 10px;
    padding: 8px 16px;
    font-family: monospace;
    font-size: 13pt;
    font-weight: 900;
    color: #4f46e5;
    margin-bottom: 4px;
  }
  .dossier-label {
    text-align: center;
    font-size: 8pt;
    color: #64748b;
    margin-bottom: 22px;
    font-family: monospace;
  }
  .section { margin-bottom: 18px; }
  .section h2 {
    font-size: 8.5pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .field label {
    font-size: 7.5pt;
    text-transform: uppercase;
    color: #94a3b8;
    display: block;
    margin-bottom: 2px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .field span {
    font-weight: 700;
    font-size: 11pt;
    color: #1e293b;
  }
  .field span.empty { color: #94a3b8; font-style: italic; font-weight: 400; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }
  table td {
    border: 1px solid #e2e8f0;
    padding: 9px 12px;
  }
  table td.lbl {
    width: 42%;
    color: #475569;
    font-weight: 700;
    background: #f8fafc;
  }
  .sigs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 50px;
    margin-top: 48px;
  }
  .sig {
    border-top: 1.5px solid #cbd5e1;
    padding-top: 8px;
    font-size: 8.5pt;
    color: #64748b;
    height: 80px;
    font-weight: 600;
  }
  .footer {
    margin-top: 28px;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    font-size: 7pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }
  .text-block {
    margin: 24px 0;
    font-size: 11.5pt;
    line-height: 2.1;
    text-align: justify;
  }
  .name-highlight {
    text-align: center;
    font-size: 15pt;
    font-weight: 900;
    text-transform: uppercase;
    margin: 18px 0;
    padding: 10px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
`;

// ── En-tête commun ───────────────────────────────────────────────────────────

function pageHeader(logoBase64: string, docTitle: string, ref: string): string {
  const logoHtml = logoBase64
    ? `<div class="logo-wrap"><img src="${logoBase64}" alt="Logo" /></div>`
    : '';
  return `
    <div class="page-header">
      ${logoHtml}
      <div class="school-info">
        <div class="school-name">Le Toit des Anges</div>
        <div class="school-addr">469 Cité Cheikh Omar TALL, Ouakam, Dakar<br>Tél. : +221 77 000 00 00 &nbsp;|&nbsp; contact@letoitdesanges.sn</div>
      </div>
      <div class="doc-badge">
        <span class="annee">Année scolaire ${getAnnee()}</span>
        <span class="annee" style="color:#4f46e5;font-family:monospace">${ref}</span>
      </div>
    </div>
    <div class="titre">${docTitle}</div>`;
}

function pageFooter(docName: string, ref: string): string {
  return `
    <div class="footer">
      <span>Le Toit des Anges — Ouakam, Dakar — Année ${getAnnee()}</span>
      <span>${docName} | ${ref}</span>
    </div>`;
}

function v(val: string | undefined | null, fallback = '—'): string {
  const s = (val || '').trim();
  if (!s) return `<span class="empty">${fallback}</span>`;
  return s;
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

// ── Normalisation données sanitaires ─────────────────────────────────────────
// Les champs santé peuvent être à la racine de l'élève OU sous .ficheSanitaire
// selon que la donnée vient de l'API /eleves ou d'un objet formData local.

function getSani(eleve: any, key: string): any {
  const direct = eleve[key];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  return eleve.ficheSanitaire?.[key] ?? eleve.fiche_sanitaire?.[key] ?? undefined;
}

function sb(eleve: any, key: string): boolean { return !!getSani(eleve, key); }
function ss(eleve: any, key: string): string  { const v = getSani(eleve, key); return v != null ? String(v) : ''; }

// ── Builders HTML ────────────────────────────────────────────────────────────

function buildFicheInscriptionHtml(eleve: Partial<Eleve>, logoBase64: string): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const regimeLib = REGIMES_MAP[eleve.regimeFinancier || ''] || '—';
  const options = [eleve.cantine ? 'Cantine' : '', eleve.transportBus ? 'Bus scolaire' : ''].filter(Boolean).join(', ') || '—';
  const ref = eleve.matricule || `INSC-${Date.now().toString(36).toUpperCase()}`;
  const dossier = `${eleve.matricule || ''}-${(eleve.nom || '').toUpperCase()}-${(eleve.prenom || '').toUpperCase()}-${eleve.niveau || ''}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, "Fiche d'Identité de l'Élève", ref)}
    <div class="dossier-label">Dossier : ${dossier}</div>

    <div class="section">
      <h2>Identité de l'élève</h2>
      <div class="grid2">
        <div class="field"><label>Nom complet</label><span>${v(nomComplet)}</span></div>
        <div class="field"><label>Date de naissance</label><span>${formatDate(eleve.dateNaissance)}</span></div>
        <div class="field"><label>Lieu de naissance</label><span>${v(eleve.lieuNaissance)}</span></div>
        <div class="field"><label>Classe / Niveau</label><span>${niveauLib}</span></div>
        <div class="field"><label>Régime financier</label><span>${regimeLib}</span></div>
        <div class="field"><label>Options souscrites</label><span>${options}</span></div>
        <div class="field"><label>Date d'admission</label><span>${formatDate(eleve.dateAdmission)}</span></div>
        <div class="field"><label>Besoins spécifiques</label><span>${v(eleve.besoinSpecifique, 'Aucun signalé')}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Parent / Tuteur légal (principal)</h2>
      <div class="grid2">
        <div class="field"><label>Nom & Prénom</label><span>${v(parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '')}</span></div>
        <div class="field"><label>Qualité</label><span>${parent?.lien === 'MERE' ? 'Mère' : parent?.lien === 'PERE' ? 'Père' : v(parent?.lien)}</span></div>
        <div class="field"><label>Téléphone</label><span>${v(parent?.telephone)}</span></div>
        <div class="field"><label>WhatsApp</label><span>${v(parent?.whatsapp)}</span></div>
        <div class="field"><label>Email</label><span>${v(parent?.email)}</span></div>
      </div>
    </div>

    ${eleve.parent2 ? `
    <div class="section">
      <h2>Parent / Tuteur (second)</h2>
      <div class="grid2">
        <div class="field"><label>Nom & Prénom</label><span>${v(`${eleve.parent2.prenom || ''} ${eleve.parent2.nom || ''}`.trim())}</span></div>
        <div class="field"><label>Qualité</label><span>${eleve.parent2.lien === 'MERE' ? 'Mère' : eleve.parent2.lien === 'PERE' ? 'Père' : v(eleve.parent2.lien)}</span></div>
        <div class="field"><label>Téléphone</label><span>${v(eleve.parent2.telephone)}</span></div>
        <div class="field"><label>WhatsApp</label><span>${v(eleve.parent2.whatsapp)}</span></div>
      </div>
    </div>` : ''}

    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>
    ${pageFooter("Fiche d'identité", ref)}
  </body></html>`;
}

function buildCertificatScolariteHtml(eleve: Partial<Eleve>, logoBase64: string): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const ref = `CERT-SCOL-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Certificat de Scolarité', ref)}
    <div class="dossier-label">Matricule élève : ${eleve.matricule || '—'}</div>

    <div class="text-block">
      <p>La Directrice de l'établissement <strong>Le Toit des Anges</strong>, sis au 469 Cité Cheikh Omar TALL, Ouakam, Dakar, certifie que l'élève&nbsp;:</p>
      <div class="name-highlight">${nomComplet}</div>
      <p>né(e) le <strong>${formatDate(eleve.dateNaissance)}</strong>
         à <strong>${v(eleve.lieuNaissance)}</strong>,
         est régulièrement inscrit(e) dans notre établissement pour l'année scolaire
         <strong>${getAnnee()}</strong>, en classe de <strong>${niveauLib}</strong>.</p>
      <p style="margin-top:16px">Ce certificat est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>
    </div>

    <div style="margin-top: 16px; font-size: 9.5pt; color: #64748b; font-weight: 600;">
      Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>

    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>
    ${pageFooter('Certificat de scolarité', ref)}
  </body></html>`;
}

function buildFicheSanitaireHtml(eleve: Partial<Eleve>, logoBase64: string): string {
  const e = eleve as any; // accès aux champs santé normalisés via getSani
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent  = eleve.parent1;
  const parent2 = eleve.parent2;
  const urgence = eleve.contactUrgence;
  const ref = `SAN-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;

  // ── Helpers locaux utilisant getSani pour normaliser l'accès aux données ─────
  const yn = (key: string) => sb(e, key)
    ? `<strong style="color:#16a34a">&#10003; OUI</strong>`
    : `<span style="color:#94a3b8">NON</span>`;

  const vaccRow = (label: string, boolKey: string, dateKey: string) => {
    const done = sb(e, boolKey);
    const date = ss(e, dateKey);
    return `<tr>
      <td class="s-lbl">${label}</td>
      <td class="s-yn">${done ? '<strong style="color:#16a34a">&#10003; OUI</strong>' : '<span style="color:#94a3b8">NON</span>'}</td>
      <td>${done && date ? `<strong>${formatDate(date)}</strong>` : '<span style="color:#94a3b8">—</span>'}</td>
    </tr>`;
  };

  const maladieTag = (label: string, key: string) => sb(e, key)
    ? `<span class="m-tag">${label}</span>` : '';

  const autoSoins = getSani(e, 'autorisationSoins') !== false;
  const autoPhoto = getSani(e, 'autorisationPhoto') !== false;
  const sexeStr   = ss(e, 'sexe');
  const mouiller  = ss(e, 'mouillerLit');
  const mouLabels: Record<string,string> = { OUI:'Oui', NON:'Non', OCCASIONNELLEMENT:'Occasionnellement' };

  const SANITAIRE_CSS = `
    @page { size: A4 portrait; margin: 14mm 12mm 12mm 12mm; }
    @media print {
      body { padding: 0 !important; width: auto !important; }
      .no-break { break-inside: avoid; page-break-inside: avoid; }
      .page-break { break-before: page; page-break-before: always; }
      .page-header { break-inside: avoid; }
      .footer { position: fixed; bottom: 0; width: 100%; }
    }
    .s-table { width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:0; }
    .s-table th { background:#f1f5f9; color:#475569; font-size:8pt; font-weight:800;
                  text-transform:uppercase; letter-spacing:.5px; padding:5px 9px;
                  border:1px solid #e2e8f0; }
    .s-table td { border:1px solid #e2e8f0; padding:5px 9px; vertical-align:middle; }
    .s-lbl { background:#f8fafc; color:#475569; font-weight:700; width:45%; font-size:9pt; }
    .s-yn  { width:80px; text-align:center; }
    .s-sub { background:#f1f5f9; color:#64748b; font-size:7.5pt; font-weight:800;
             text-transform:uppercase; letter-spacing:.5px; padding:4px 9px; }
    .m-tag { display:inline-block; background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe;
             border-radius:5px; padding:2px 7px; font-size:8.5pt; font-weight:700; margin:2px; }
    .warn-box { background:#fff7ed; border:1px solid #fed7aa; border-radius:6px;
                padding:7px 12px; color:#c2410c; font-size:9.5pt; font-weight:700; margin-top:7px; }
    .auth-box { border:1.5px solid #c7d2fe; border-radius:6px; padding:10px 14px;
                background:#eef2ff; font-size:9.5pt; line-height:1.9; }
    .sec-title { font-size:8pt; font-weight:800; text-transform:uppercase; letter-spacing:1px;
                 color:#475569; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;
                 margin:14px 0 7px; }
  `;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <style>${SHARED_CSS}${SANITAIRE_CSS}
    body { font-size:10pt; }
  </style></head><body>
    ${pageHeader(logoBase64, 'Fiche Sanitaire de Liaison', ref)}
    <p style="text-align:center;font-size:8.5pt;color:#64748b;margin:-10px 0 14px;font-style:italic">
      Le Toit des Anges — Cette fiche permet de recueillir des informations médicales utiles pendant le séjour de l'enfant
    </p>

    <!-- ═══ 1. IDENTITÉ ═══════════════════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">1 — Identité de l'élève</p>
      <div class="grid3" style="gap:8px">
        <div class="field"><label>Nom &amp; Prénom</label><span>${v(nomComplet)}</span></div>
        <div class="field"><label>Date de naissance</label><span>${formatDate(eleve.dateNaissance)}</span></div>
        <div class="field"><label>Lieu de naissance</label><span>${v(eleve.lieuNaissance)}</span></div>
        <div class="field"><label>Sexe</label><span>${sexeStr === 'M' ? '&#9726; Garçon' : sexeStr === 'F' ? '&#9726; Fille' : '—'}</span></div>
        <div class="field"><label>Niveau / Classe</label><span>${NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—'}</span></div>
        <div class="field"><label>Matricule</label><span style="font-family:monospace">${v(eleve.matricule)}</span></div>
      </div>
    </div>

    <!-- ═══ 2. VACCINATIONS ═══════════════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">2 — Vaccinations (se référer au carnet de santé)</p>
      <table class="s-table">
        <thead>
          <tr><th>Vaccin</th><th class="s-yn">Fait ?</th><th>Date du dernier rappel</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="3" class="s-sub">Vaccins obligatoires</td></tr>
          ${vaccRow('Diphtérie / Tétanos / Poliomyélite', 'vaccDiphterie', 'vaccDiphterieDate')}
          ${vaccRow('Poliomyélite (DT Polio)', 'vaccPolio', 'vaccPolioDate')}
          ${vaccRow('Coqueluche (DTC / Tétracoq)', 'vaccCoqueluche', 'vaccCoquelucheDate')}
          ${vaccRow('BCG (tuberculose)', 'vaccBCG', 'vaccBCGDate')}
          <tr><td colspan="3" class="s-sub">Vaccins recommandés</td></tr>
          ${vaccRow('Hépatite B', 'vaccHepB', 'vaccHepBDate')}
          ${vaccRow('ROR — Rubéole / Oreillons / Rougeole', 'vaccROR', 'vaccRORDate')}
        </tbody>
      </table>
      ${sb(e,'certifContrIndication') ? `<div class="warn-box">&#9888; Certificat médical de contre-indication joint (vaccin(s) non réalisé(s) pour raison médicale)</div>` : ''}
      <p style="font-size:7.5pt;color:#94a3b8;margin-top:4px;font-style:italic">Le vaccin antitétanique ne présente aucune contre-indication médicale.</p>
    </div>

    <!-- ═══ 3. RENSEIGNEMENTS MÉDICAUX ════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">3 — Renseignements médicaux</p>
      <table class="s-table">
        <tr>
          <td class="s-lbl">L'enfant suit-il un traitement médical ?</td>
          <td>${yn('traitementMedical')}</td>
        </tr>
        ${sb(e,'traitementMedical') ? `
        <tr>
          <td class="s-lbl">Détail du traitement</td>
          <td><strong>${v(ss(e,'traitementDetail'))}</strong>
          <br><span style="font-size:7.5pt;color:#64748b">Joindre ordonnance récente + médicaments dans emballage d'origine au nom de l'enfant.</span></td>
        </tr>` : ''}
        <tr>
          <td class="s-lbl">Médecin traitant <span style="font-weight:400;font-style:italic">(facultatif)</span></td>
          <td>${v(ss(e,'medecinNom'))}${ss(e,'medecinTel') ? ` — <strong>${ss(e,'medecinTel')}</strong>` : ''}</td>
        </tr>
      </table>
      <p style="font-size:8pt;font-weight:700;color:#475569;margin:9px 0 5px">Maladies antérieures :</p>
      <div style="min-height:20px">
        ${maladieTag('Rubéole','maladieRubeole')}${maladieTag('Varicelle','maladieVaricelle')}
        ${maladieTag('Angine','maladieAngine')}${maladieTag('Rhumatisme articulaire aigu','maladieRhumatisme')}
        ${maladieTag('Scarlatine','maladieScarlatine')}${maladieTag('Coqueluche','maladieCoqueluche')}
        ${maladieTag('Otite','maladieOtite')}${maladieTag('Rougeole','maladieRougeole')}
        ${maladieTag('Oreillons','maladieOreillons')}
        ${!['maladieRubeole','maladieVaricelle','maladieAngine','maladieRhumatisme',
            'maladieScarlatine','maladieCoqueluche','maladieOtite','maladieRougeole','maladieOreillons']
          .some(k => sb(e,k))
          ? '<span style="color:#94a3b8;font-size:8.5pt;font-style:italic">Aucune maladie antérieure déclarée</span>' : ''}
      </div>
    </div>

    <!-- ═══ 4. ALLERGIES ══════════════════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">4 — Allergies</p>
      <table class="s-table">
        <tr><td class="s-lbl">Asthme</td><td>${yn('allergieAsthme')}</td></tr>
        <tr><td class="s-lbl">Allergies médicamenteuses</td><td>${yn('allergieMedicament')}</td></tr>
        <tr><td class="s-lbl">Allergies alimentaires</td><td>${yn('allergieAlimentaire')}</td></tr>
        ${ss(e,'allergieAutres') ? `<tr><td class="s-lbl">Autres allergies (cause)</td><td><strong style="color:#dc2626">${ss(e,'allergieAutres')}</strong></td></tr>` : ''}
        ${ss(e,'allergieConduite') ? `<tr><td class="s-lbl">Conduite à tenir en cas de crise</td><td><strong>${ss(e,'allergieConduite')}</strong></td></tr>` : ''}
      </table>
      ${eleve.besoinSpecifique ? `<div class="warn-box" style="margin-top:7px">&#9888; Besoins spécifiques : ${eleve.besoinSpecifique}</div>` : ''}
    </div>

    <!-- ═══ 5. DIFFICULTÉS DE SANTÉ ═══════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">5 — Difficultés de santé (hospitalisations, accidents, crises convulsives, opérations, rééducation)</p>
      ${ss(e,'difficulteSante')
        ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 12px;font-size:9.5pt">${ss(e,'difficulteSante').replace(/\n/g,'<br>')}</div>`
        : `<p style="color:#94a3b8;font-size:8.5pt;font-style:italic;padding:6px 0">Aucune difficulté de santé signalée</p>`}
    </div>

    <!-- ═══ 6. RECOMMANDATIONS ════════════════════════════════════════════════ -->
    <div class="no-break">
      <p class="sec-title">6 — Recommandations des parents</p>
      <table class="s-table">
        <tr><td class="s-lbl">Porte des lunettes</td><td>${yn('equipeLunettes')}</td></tr>
        <tr><td class="s-lbl">Porte des lentilles de contact</td><td>${yn('equipeLentilles')}</td></tr>
        <tr><td class="s-lbl">Porte une prothèse auditive</td><td>${yn('equipeProtheseAuditive')}</td></tr>
        <tr><td class="s-lbl">Porte une prothèse dentaire</td><td>${yn('equipeProtheseDentaire')}</td></tr>
        ${ss(e,'equipePrecisions') ? `<tr><td class="s-lbl">Précisions équipements</td><td><strong>${ss(e,'equipePrecisions')}</strong></td></tr>` : ''}
        <tr>
          <td class="s-lbl">L'enfant mouille-t-il son lit la nuit ?</td>
          <td>${mouiller ? `<strong>${mouLabels[mouiller] || mouiller}</strong>` : '<span style="color:#94a3b8">Non renseigné</span>'}</td>
        </tr>
      </table>
    </div>

    <!-- ═══ 7. RESPONSABLES ═══════════════════════════════════════════════════ -->
    <div class="no-break page-break">
      <p class="sec-title">7 — Responsables de l'enfant</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <p style="font-size:8pt;font-weight:800;color:#4f46e5;text-transform:uppercase;margin-bottom:5px">
            ${parent?.lien === 'MERE' ? 'Mère' : parent?.lien === 'PERE' ? 'Père' : 'Parent / Tuteur principal'}
          </p>
          <table class="s-table">
            <tr><td class="s-lbl">Nom &amp; Prénom</td><td><strong>${v(parent ? `${parent.prenom||''} ${parent.nom||''}`.trim() : '')}</strong></td></tr>
            <tr><td class="s-lbl">Tél. portable</td><td>${v(parent?.telephone)}</td></tr>
            <tr><td class="s-lbl">Tél. domicile</td><td>${v(parent?.telDomicile)}</td></tr>
            <tr><td class="s-lbl">Tél. travail</td><td>${v(parent?.telTravail)}</td></tr>
            <tr><td class="s-lbl">WhatsApp</td><td>${v(parent?.whatsapp)}</td></tr>
            ${parent?.adresse ? `<tr><td class="s-lbl">Adresse</td><td>${parent.adresse}</td></tr>` : ''}
            ${parent?.email ? `<tr><td class="s-lbl">Email</td><td>${parent.email}</td></tr>` : ''}
          </table>
        </div>
        <div>
          <p style="font-size:8pt;font-weight:800;color:#4f46e5;text-transform:uppercase;margin-bottom:5px">
            ${parent2 ? (parent2.lien === 'MERE' ? 'Mère' : parent2.lien === 'PERE' ? 'Père' : 'Second parent') : 'Contact d\'urgence'}
          </p>
          <table class="s-table">
            ${parent2 ? `
            <tr><td class="s-lbl">Nom &amp; Prénom</td><td><strong>${v(`${parent2.prenom||''} ${parent2.nom||''}`.trim())}</strong></td></tr>
            <tr><td class="s-lbl">Tél. portable</td><td>${v(parent2.telephone)}</td></tr>
            <tr><td class="s-lbl">Tél. domicile</td><td>${v(parent2.telDomicile)}</td></tr>
            <tr><td class="s-lbl">Tél. travail</td><td>${v(parent2.telTravail)}</td></tr>
            ` : `
            <tr><td class="s-lbl">Nom &amp; Prénom</td><td><strong>${v(urgence ? `${urgence.prenom||''} ${urgence.nom||''}`.trim() : '')}</strong></td></tr>
            <tr><td class="s-lbl">Lien avec l'enfant</td><td>${v(urgence?.lien)}</td></tr>
            <tr><td class="s-lbl">Téléphone</td><td>${v(urgence?.telephone)}</td></tr>
            `}
          </table>
        </div>
      </div>
      ${parent2 && urgence ? `
      <p style="font-size:8pt;font-weight:800;color:#64748b;text-transform:uppercase;margin:10px 0 5px">Contact d'urgence (autre que parents)</p>
      <table class="s-table">
        <tr><td class="s-lbl">Nom &amp; Prénom</td><td>${v(`${urgence.prenom||''} ${urgence.nom||''}`.trim())}</td></tr>
        <tr><td class="s-lbl">Lien avec l'enfant</td><td>${v(urgence.lien)}</td></tr>
        <tr><td class="s-lbl">Téléphone</td><td>${v(urgence.telephone)}</td></tr>
      </table>` : ''}
    </div>

    <!-- ═══ 8. AUTORISATIONS ═══════════════════════════════════════════════════ -->
    <div class="no-break" style="margin-top:14px">
      <p class="sec-title">8 — Déclaration et autorisations parentales</p>
      <div class="auth-box">
        <p style="margin-bottom:8px">
          Je soussigné(e), <strong>${v(parent ? `${parent.prenom||''} ${parent.nom||''}`.trim() : '')}</strong>,
          responsable légal de l'enfant <strong>${nomComplet}</strong>,
          déclare exacts les renseignements portés sur cette fiche.
        </p>
        <p style="${autoSoins ? 'color:#16a34a' : 'color:#64748b'}">
          ${autoSoins ? '&#9745;' : '&#9744;'}
          <strong>Autorisation de soins / hospitalisation d'urgence</strong> — J'autorise le responsable de l'établissement
          à prendre toutes mesures rendues nécessaires (traitement médical, hospitalisation, intervention chirurgicale)
          et à faire sortir mon enfant de l'hôpital après hospitalisation.
        </p>
        <p style="margin-top:7px;${autoPhoto ? 'color:#16a34a' : 'color:#64748b'}">
          ${autoPhoto ? '&#9745;' : '&#9744;'}
          <strong>Autorisation de photographie / vidéo</strong> — J'autorise la prise de photographies et de vidéos
          de mon enfant dans le cadre des activités de l'établissement.
        </p>
      </div>
    </div>

    <div class="sigs no-break" style="margin-top:18px">
      <div class="sig">Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}<br><br>Signature du parent / tuteur légal</div>
      <div class="sig">Cachet &amp; signature de la Direction</div>
    </div>
    ${pageFooter('Fiche sanitaire de liaison — Le Toit des Anges', ref)}
  </body></html>`;
}

function buildCertificatRadiationHtml(eleve: Partial<Eleve> & { motifRadiation?: string }, logoBase64: string): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const ref = `CERT-RAD-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;
  const motif = eleve.motifRadiation || '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Certificat de Radiation', ref)}
    <div class="dossier-label">Matricule élève : ${eleve.matricule || '—'}</div>

    <div class="text-block">
      <p>La Directrice de l'établissement <strong>Le Toit des Anges</strong>, sis au 469 Cité Cheikh Omar TALL, Ouakam, Dakar, certifie que l'élève&nbsp;:</p>
      <div class="name-highlight">${nomComplet}</div>
      <p>né(e) le <strong>${formatDate(eleve.dateNaissance)}</strong>
         à <strong>${v(eleve.lieuNaissance)}</strong>,
         inscrit(e) en classe de <strong>${niveauLib}</strong>
         pour l'année scolaire <strong>${getAnnee()}</strong>,
         a été <strong>radié(e)</strong> des effectifs de notre établissement à la date du
         <strong>${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.</p>
      ${motif ? `<p style="margin-top:16px"><strong>Motif de la radiation :</strong> ${motif}</p>` : ''}
      <p style="margin-top:16px">Ce certificat est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>
    </div>

    <div style="margin-top: 16px; font-size: 9.5pt; color: #64748b; font-weight: 600;">
      Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>

    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>
    ${pageFooter('Certificat de radiation', ref)}
  </body></html>`;
}

function buildAutorisationSortieHtml(
  eleve: Partial<Eleve> & { destinationSortie?: string; dateActiviteSortie?: string },
  logoBase64: string
): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const ref = `AUT-SORT-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;
  const parentNom = parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '___________________________';
  const parentTel = parent?.telephone || parent?.whatsapp || '—';
  const destination = eleve.destinationSortie;
  const dateActivite = eleve.dateActiviteSortie;

  const destinationClause = destination
    ? `à destination de <strong>${destination}</strong>`
    : 'à une sortie scolaire ou activité extrascolaire';

  const dateClause = dateActivite
    ? `prévue le <strong>${dateActivite}</strong>`
    : `durant l'année scolaire <strong>${getAnnee()}</strong>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Autorisation de Sortie Scolaire', ref)}
    <div class="dossier-label">Année scolaire ${getAnnee()} — Classe : ${niveauLib}</div>

    <div class="text-block">
      <p>Je soussigné(e) <strong>${parentNom}</strong>, parent / tuteur légal de l'élève
         <strong>${nomComplet}</strong> (matricule&nbsp;: ${eleve.matricule || '—'}),
         inscrit(e) en classe de <strong>${niveauLib}</strong>,</p>
      <p style="margin-top:14px">autorise mon enfant à participer ${destinationClause},
         organisée par l'établissement <strong>Le Toit des Anges</strong>, ${dateClause}.</p>
      <p style="margin-top:14px">Je m'engage à ce que mon enfant respecte les consignes de sécurité et de discipline
         pendant toute la durée de l'activité. Je reconnais avoir été informé(e) des conditions
         d'encadrement mises en place par l'établissement.</p>
    </div>

    <table style="margin-top:8px">
      <tr>
        <td class="lbl">En cas d'urgence, appeler</td>
        <td><strong>${parentTel}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Autorisation de recevoir des soins d'urgence</td>
        <td>☐&nbsp; Oui &nbsp;&nbsp;&nbsp; ☐&nbsp; Non</td>
      </tr>
      <tr>
        <td class="lbl">Restrictions ou contre-indications médicales</td>
        <td>${v(eleve.besoinSpecifique, 'Aucune')}</td>
      </tr>
    </table>

    <div class="sigs" style="margin-top:40px">
      <div class="sig">Fait à Dakar, le ________________<br><br>Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>
    ${pageFooter('Autorisation de sortie', ref)}
  </body></html>`;
}

// ── Générateur PDF ───────────────────────────────────────────────────────────

async function htmlToBlob(html: string): Promise<Blob> {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '794px',
    background: '#fff',
    zIndex: '-1',
  });

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '794px',
    height: '1123px',
    border: 'none',
    background: '#fff',
  });
  document.body.appendChild(iframe);

  return new Promise((resolve, reject) => {
    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument!;
        doc.open();
        doc.write(html);
        doc.close();

        await new Promise(r => setTimeout(r, 300));

        const body = doc.body;
        const canvas = await html2canvas(body, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 794,
          logging: false,
          windowWidth: 794,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgH = (canvas.height * pageW) / canvas.width;

        if (imgH <= pageH) {
          pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
        } else {
          let posY = 0;
          while (posY < imgH) {
            if (posY > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, -posY, pageW, imgH);
            posY += pageH;
          }
        }

        document.body.removeChild(iframe);
        resolve(pdf.output('blob') as unknown as Blob);
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    };
    iframe.src = 'about:blank';
  });
}

// ── Convention de scolarisation (maternelle & élémentaire) ──────────────────

function buildConventionScolarisationHtml(eleve: Partial<Eleve>, logoBase64: string): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const parentNom = parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '';
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const ref = `CONV-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Convention de Scolarisation', ref)}
    <div class="dossier-label">Élève : ${nomComplet} — ${niveauLib} — Matricule : ${eleve.matricule || '—'}</div>

    <div class="text-block">
      <p>Entre l'établissement <strong>Le Toit des Anges</strong>, sis au 469 Cité Cheikh Omar TALL, Ouakam, Dakar,
      représenté par sa Directrice, ci-après désigné « l'Établissement »,</p>
      <p>et <strong>${v(parentNom, 'M. / Mme ____________________')}</strong>,
      agissant en qualité de ${parent?.lien === 'MERE' ? 'mère' : parent?.lien === 'PERE' ? 'père' : 'tuteur légal'}
      de l'enfant <strong>${nomComplet}</strong>, né(e) le <strong>${formatDate(eleve.dateNaissance)}</strong>,
      ci-après désigné « le Parent »,</p>
      <p>il est convenu ce qui suit pour l'année scolaire <strong>${getAnnee()}</strong> :</p>
    </div>

    <div class="section">
      <h2>Article 1 — Objet</h2>
      <div class="text-block"><p>La présente convention règle les conditions de scolarisation de l'enfant
      <strong>${nomComplet}</strong> en classe de <strong>${niveauLib}</strong> au sein de l'Établissement.</p></div>
    </div>

    <div class="section">
      <h2>Article 2 — Engagements de l'Établissement</h2>
      <div class="text-block"><p>L'Établissement s'engage à assurer l'accueil, l'encadrement pédagogique et la
      sécurité de l'enfant conformément à son projet pédagogique et au règlement intérieur, pendant les jours
      et horaires d'ouverture communiqués aux familles.</p></div>
    </div>

    <div class="section">
      <h2>Article 3 — Engagements du Parent</h2>
      <div class="text-block"><p>Le Parent s'engage à : respecter le règlement intérieur de l'Établissement ;
      régler les frais de scolarité selon le tableau des droits et frais en vigueur (frais d'inscription à
      l'admission, mensualités payables au plus tard le 5 de chaque mois) ; fournir les pièces justificatives
      demandées au dossier ; signaler tout changement de situation (adresse, téléphone, santé de l'enfant).</p></div>
    </div>

    <div class="section">
      <h2>Article 4 — Frais de scolarité</h2>
      <div class="text-block"><p>Les tarifs applicables sont ceux du tableau des droits et frais de scolarité
      de l'année ${getAnnee()}, remis au Parent lors de l'inscription. Tout mois entamé est dû.
      Les frais d'inscription ne sont pas remboursables.</p></div>
    </div>

    <div class="section">
      <h2>Article 5 — Résiliation</h2>
      <div class="text-block"><p>La présente convention peut être résiliée par le Parent par écrit avec un
      préavis d'un mois. L'Établissement se réserve le droit de mettre fin à la scolarisation en cas de
      non-paiement persistant ou de manquement grave au règlement intérieur, après notification écrite.</p></div>
    </div>

    <div style="margin-top: 16px; font-size: 9.5pt; color: #64748b; font-weight: 600;">
      Fait à Dakar en deux exemplaires, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>

    <div class="sigs">
      <div class="sig">Le Parent / Tuteur légal<br><em style="font-weight:400;font-size:8pt">(précédé de « Lu et approuvé »)</em></div>
      <div class="sig">La Directrice<br><em style="font-weight:400;font-size:8pt">(cachet & signature)</em></div>
    </div>
    ${pageFooter('Convention de scolarisation', ref)}
  </body></html>`;
}

// ── Règlement intérieur + accusé de réception (crèche) ───────────────────────

function buildReglementInterieurHtml(eleve: Partial<Eleve>, logoBase64: string): string {
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const parentNom = parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '';
  const ref = `REGL-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Règlement Intérieur — Crèche', ref)}
    <div class="dossier-label">Enfant : ${nomComplet} — Matricule : ${eleve.matricule || '—'}</div>

    <div class="section">
      <h2>1. Horaires et accueil</h2>
      <div class="text-block"><p>La crèche accueille les enfants du lundi au vendredi selon les horaires
      communiqués aux familles. Les parents sont priés de respecter les heures d'arrivée et de départ.
      Tout retard répété à la récupération de l'enfant pourra donner lieu à une facturation complémentaire.</p></div>
    </div>

    <div class="section">
      <h2>2. Santé et hygiène</h2>
      <div class="text-block"><p>Un enfant fiévreux ou présentant une maladie contagieuse ne peut être accueilli.
      Tout traitement médical doit être signalé et accompagné d'une ordonnance. Les vaccins obligatoires
      doivent être à jour (fiche sanitaire). La crèche doit être informée immédiatement de toute allergie.</p></div>
    </div>

    <div class="section">
      <h2>3. Sécurité et récupération de l'enfant</h2>
      <div class="text-block"><p>L'enfant ne sera remis qu'à ses parents ou à la personne majeure expressément
      autorisée dans le dossier d'inscription, sur présentation d'une pièce d'identité. Tout changement de
      personne autorisée doit être notifié par écrit à la Direction.</p></div>
    </div>

    <div class="section">
      <h2>4. Effets personnels</h2>
      <div class="text-block"><p>Les affaires de l'enfant (change, biberons, doudou…) doivent être marquées à
      son nom. La crèche décline toute responsabilité en cas de perte d'objets de valeur ou de bijoux.</p></div>
    </div>

    <div class="section">
      <h2>5. Paiements</h2>
      <div class="text-block"><p>Les frais d'inscription sont dus à l'admission et non remboursables.
      Les mensualités sont payables au plus tard le 5 de chaque mois, selon le tableau des tarifs en vigueur.
      Tout mois entamé est dû. Le non-paiement persistant peut entraîner la suspension de l'accueil.</p></div>
    </div>

    <div class="section" style="border:2px solid #4f46e5;border-radius:10px;padding:12px;margin-top:18px">
      <h2>Accusé de réception</h2>
      <div class="text-block">
        <p>Je soussigné(e) <strong>${v(parentNom, 'M. / Mme ____________________')}</strong>,
        parent / tuteur de l'enfant <strong>${nomComplet}</strong>, reconnais avoir reçu et pris connaissance
        du présent règlement intérieur de la crèche <strong>Le Toit des Anges</strong> pour l'année
        <strong>${getAnnee()}</strong>, et m'engage à le respecter.</p>
        <p style="margin-top:12px">Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
      <div class="sigs">
        <div class="sig">Signature du parent / tuteur<br><em style="font-weight:400;font-size:8pt">(précédée de « Lu et approuvé »)</em></div>
        <div class="sig">Cachet & signature de la Direction</div>
      </div>
    </div>
    ${pageFooter('Règlement intérieur crèche', ref)}
  </body></html>`;
}

// ── API publique ─────────────────────────────────────────────────────────────

export type DocAdminType =
  | 'fiche_inscription' | 'certificat_scolarite' | 'certificat_radiation'
  | 'fiche_sanitaire' | 'autorisation_sortie'
  | 'convention_scolarisation' | 'reglement_interieur';

// Documents applicables selon le cycle de l'élève :
// - Crèche               → fiche d'identité + règlement intérieur (+ sanitaire)
// - Maternelle/Élémentaire → fiche d'identité + convention de scolarisation (+ certificat, sanitaire)
export function docsForNiveau(niveau: string | undefined): DocAdminType[] {
  if (niveau === 'CRECHE') {
    return ['fiche_inscription', 'reglement_interieur', 'fiche_sanitaire'];
  }
  return ['fiche_inscription', 'convention_scolarisation', 'certificat_scolarite', 'fiche_sanitaire'];
}

function buildHtml(type: DocAdminType, eleve: Partial<Eleve> & { motifRadiation?: string }, logoBase64: string): string {
  switch (type) {
    case 'fiche_inscription':          return buildFicheInscriptionHtml(eleve, logoBase64);
    case 'certificat_scolarite':       return buildCertificatScolariteHtml(eleve, logoBase64);
    case 'certificat_radiation':       return buildCertificatRadiationHtml(eleve, logoBase64);
    case 'fiche_sanitaire':            return buildFicheSanitaireHtml(eleve, logoBase64);
    case 'autorisation_sortie':        return buildAutorisationSortieHtml(eleve, logoBase64);
    case 'convention_scolarisation':   return buildConventionScolarisationHtml(eleve, logoBase64);
    case 'reglement_interieur':        return buildReglementInterieurHtml(eleve, logoBase64);
  }
}

function docFilename(type: DocAdminType, eleve: Partial<Eleve>): string {
  const slug = `${(eleve.nom || '').toUpperCase()}_${(eleve.prenom || '').toUpperCase()}_${eleve.matricule || ''}`;
  const labels: Record<DocAdminType, string> = {
    fiche_inscription:        'Fiche_Identite',
    certificat_scolarite:     'Certificat_Scolarite',
    certificat_radiation:     'Certificat_Radiation',
    fiche_sanitaire:          'Fiche_Sanitaire',
    autorisation_sortie:      'Autorisation_Sortie',
    convention_scolarisation: 'Convention_Scolarisation',
    reglement_interieur:      'Reglement_Interieur',
  };
  return `${labels[type]}_${slug}.pdf`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function getDocHtml(
  type: DocAdminType,
  eleve: Partial<Eleve> & { motifRadiation?: string; destinationSortie?: string; dateActiviteSortie?: string }
): Promise<string> {
  const logoBase64 = await getLogoBase64();
  return buildHtml(type, eleve, logoBase64);
}

export async function downloadSingleAdminDoc(
  type: DocAdminType,
  eleve: Partial<Eleve> & { motifRadiation?: string }
): Promise<void> {
  const logoBase64 = await getLogoBase64();
  const html = buildHtml(type, eleve, logoBase64);
  const w = window.open('', '_blank', 'width=900,height=750');
  if (!w) {
    const blob = await htmlToBlob(html);
    downloadBlob(blob, docFilename(type, eleve));
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

// Téléchargement direct en PDF sans dialog d'impression (pour l'espace parent)
export async function downloadAdminDocAsPdf(
  type: DocAdminType,
  eleve: Partial<Eleve> & { motifRadiation?: string }
): Promise<void> {
  const logoBase64 = await getLogoBase64();
  const html = buildHtml(type, eleve, logoBase64);
  const blob = await htmlToBlob(html);
  downloadBlob(blob, docFilename(type, eleve));
}

export async function downloadAdminDocsZip(eleve: Partial<Eleve>): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const logoBase64 = await getLogoBase64();

  // Documents adaptés au cycle de l'élève (crèche ≠ maternelle/élémentaire)
  const types: DocAdminType[] = [...docsForNiveau(eleve.niveau), 'autorisation_sortie'];

  const zip = new JSZip();
  const folder = zip.folder(`Dossier_${(eleve.nom || '').toUpperCase()}_${(eleve.prenom || '').toUpperCase()}`);

  for (const type of types) {
    const html = buildHtml(type, eleve, logoBase64);
    const blob = await htmlToBlob(html);
    folder!.file(docFilename(type, eleve), blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const zipName = `Documents_Administratifs_${(eleve.nom || '').toUpperCase()}_${(eleve.prenom || '').toUpperCase()}_${getAnnee().replace('/', '-')}.zip`;
  downloadBlob(zipBlob, zipName);
}
