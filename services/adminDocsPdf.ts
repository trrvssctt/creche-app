import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Eleve } from '../types';
import { apiClient } from './api';

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

// ── Tenant assets loader (logo, cachet, signature) ──────────────────────────

interface TenantAssets {
  logoBase64: string;
  cachetBase64: string;
  signatureBase64: string;
}

let _assetsCache: TenantAssets | null = null;

async function urlToBase64(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function getTenantAssets(): Promise<TenantAssets> {
  if (_assetsCache) return _assetsCache;

  let logoUrl = '';
  let cachetUrl = '';
  let signatureUrl = '';

  try {
    const data = await apiClient.get('/settings');
    logoUrl = data.logoUrl || '';
    cachetUrl = data.cachetUrl || '';
    signatureUrl = data.signatureDirectionUrl || '';
  } catch {
    // fallback: pas d'accès API
  }

  // Fallback logo local si pas en BD
  if (!logoUrl) {
    try {
      logoUrl = new URL('../assets/Image/logo_entreprise.png', import.meta.url).href;
    } catch { /* ignore */ }
  }

  const [logoBase64, cachetBase64, signatureBase64] = await Promise.all([
    urlToBase64(logoUrl),
    urlToBase64(cachetUrl),
    urlToBase64(signatureUrl),
  ]);

  _assetsCache = { logoBase64, cachetBase64, signatureBase64 };
  return _assetsCache;
}

export function invalidateAssetsCache() {
  _assetsCache = null;
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
    min-height: 80px;
    font-weight: 600;
    text-align: center;
  }
  .sig-images {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    min-height: 60px;
  }
  .sig-images img {
    height: 60px;
    width: auto;
    object-fit: contain;
    mix-blend-mode: multiply;
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

function sigDirectionBlock(assets: TenantAssets): string {
  const hasImages = assets.cachetBase64 || assets.signatureBase64;
  if (!hasImages) return '<div class="sig">Cachet & signature de la Direction</div>';
  const cachetImg = assets.cachetBase64 ? `<img src="${assets.cachetBase64}" alt="Cachet"/>` : '';
  const sigImg = assets.signatureBase64 ? `<img src="${assets.signatureBase64}" alt="Signature"/>` : '';
  return `<div class="sig">Cachet & signature de la Direction<div class="sig-images">${cachetImg}${sigImg}</div></div>`;
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

function buildFicheInscriptionHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
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
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter("Fiche d'identité", ref)}
  </body></html>`;
}

function buildCertificatScolariteHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
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
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter('Certificat de scolarité', ref)}
  </body></html>`;
}

function buildFicheSanitaireHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
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
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter('Fiche sanitaire de liaison — Le Toit des Anges', ref)}
  </body></html>`;
}

function buildCertificatRadiationHtml(eleve: Partial<Eleve> & { motifRadiation?: string }, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
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
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter('Certificat de radiation', ref)}
  </body></html>`;
}

function buildAutorisationSortieHtml(
  eleve: Partial<Eleve> & { destinationSortie?: string; dateActiviteSortie?: string },
  assets: TenantAssets
): string {
  const logoBase64 = assets.logoBase64;
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
      ${sigDirectionBlock(assets)}
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

function buildConventionScolarisationHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const parentNom = parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '';
  const parentAdresse = parent?.adresse || '';
  const niveauLib = NIVEAUX_MAP[eleve.niveau || ''] || eleve.niveau || '—';
  const ref = `CONV-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;
  const annee = getAnnee();

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}
    .article { margin-bottom: 14px; }
    .article h2 { font-size: 10pt; font-weight: 900; color: #1e293b; margin-bottom: 6px; border-bottom: none; padding-bottom: 0; text-transform: none; letter-spacing: 0; }
    .article p { font-size: 10.5pt; line-height: 1.8; text-align: justify; margin-bottom: 6px; }
    .article ul { font-size: 10.5pt; line-height: 1.8; margin-left: 18px; margin-bottom: 6px; }
    .article ul li { margin-bottom: 3px; }
    .sub-article { margin-top: 10px; margin-left: 12px; }
    .sub-article h3 { font-size: 9.5pt; font-weight: 800; color: #334155; margin-bottom: 4px; }
    .convention-header { font-size: 10.5pt; line-height: 2; margin-bottom: 18px; }
    .convention-title { font-size: 13pt; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 16px 0 6px; }
    .convention-subtitle { text-align: center; font-size: 9.5pt; font-style: italic; color: #64748b; margin-bottom: 20px; }
  </style></head><body>
    ${pageHeader(logoBase64, 'Convention de Scolarisation', ref)}
    <div class="convention-subtitle">(en deux exemplaires)</div>

    <div class="convention-header">
      <p><strong>Entre :</strong><br>
      Le Toit des Anges situé au 469 Cité Cheikh Omar TALL Ouakam</p>
      <p style="margin-top:10px"><strong>Et :</strong><br>
      M. Mme <strong>${v(parentNom, '.........')}</strong><br>
      Demeurant : <strong>${v(parentAdresse, '.........')}</strong><br>
      Représentant(s) légal(aux) de l'élève : <strong>${nomComplet}</strong></p>
      <p style="margin-top:12px"><em>Il est convenu ce qui suit :</em></p>
    </div>

    <div class="article">
      <h2>Article 1 – Objet</h2>
      <p>La présente convention a pour objet de définir les conditions dans lesquelles l'élève
      <strong>${nomComplet}</strong> sera scolarisé(e) par le(s) parent(s) au sein de l'école privée
      « Le Toit des Anges », ainsi que les droits et obligations réciproques de chacune des parties.</p>
    </div>

    <div class="article">
      <h2>Article 2 – Obligation de l'établissement</h2>
      <p>L'école privée « Le Toit des Anges » s'engage à scolariser l'enfant <strong>${nomComplet}</strong>
      en classe de <strong>${niveauLib}</strong> pour l'année scolaire ${annee}.
      L'établissement s'engage à fournir par ailleurs d'autres prestations selon le choix définis par les
      parents : cantine, garderie, activités périscolaires.</p>
    </div>

    <div class="article">
      <h2>Article 3 – Obligation des parents</h2>
      <p>Le(s) parent(s) s'engage(nt) à inscrire l'enfant <strong>${nomComplet}</strong> en classe de
      <strong>${niveauLib}</strong> pour l'année scolaire ${annee} au sein de l'établissement
      « Le Toit des Anges », et à respecter l'assiduité scolaire pour leur enfant.</p>
      <p>Les parents reconnaissent avoir pris connaissance du projet éducatif, du projet d'établissement,
      du règlement intérieur de l'établissement et acceptent d'y adhérer et mettre tout en œuvre afin de
      les respecter.</p>
      <p>Les Parents reconnaissent avoir pris connaissance du coût de la scolarisation de leur enfant au
      sein de l'école privée « Le Toit des Anges » et s'engagent à en assurer la charge financière.</p>
    </div>

    <div class="article">
      <h2>Article 4 – Coût de la scolarisation</h2>
      <p>Le coût de la scolarisation comprend plusieurs éléments : les frais d'inscriptions, la scolarité,
      la cantine, la garderie, les participations à des sorties scolaires,...</p>
    </div>

    <div class="article">
      <h2>Article 5 – Modalités de paiement</h2>
      <p>Les contributions des familles et les prestations annexes choisies par les parents, sont payées :
      par virement bancaire tous les 5 du mois ou trimestriel (Octobre, janvier et avril). Par espèces tous
      les 5 du mois ou trimestriel (Octobre, janvier et avril).</p>
      <p>Lors de l'inscription ou de la réinscription de l'enfant, les frais plus la dernière mensualité
      sont payables immédiatement. En cas de désistement, ces frais seront conservés par l'établissement.</p>
    </div>

    <div class="article">
      <h2>Article 6 – Assurances</h2>
      <p>Les parents s'engagent à assurer l'enfant pour sa scolarisation et à produire une attestation
      d'assurance RESPONSABILITE CIVILE et INDIVIDUELLE ACCIDENT avant le 11 septembre ${annee.split('-')[0]}.</p>
    </div>

    <div class="article">
      <h2>Article 7 – Dégradations volontaires de matériel</h2>
      <p>La remise en état ou le remplacement du matériel dégradé par un élève fera l'objet d'une facturation
      aux parents sur la base du coût incluant les frais de main d'œuvre.</p>
    </div>

    <div class="article">
      <h2>Article 8 – Durée et résiliation du contrat</h2>
      <p>La présente convention est valable pour l'année scolaire ${annee}.</p>

      <div class="sub-article">
        <h3>8-1 Résiliation en cours d'année scolaire</h3>
        <p>La présente convention ne peut être résiliée par l'établissement ou par les parents. Toutefois
        celle-ci peut être résiliée pour des causes réelles et sérieuses telles que :</p>
        <ul>
          <li>Déménagement ou tout autre motif légitime accepté expressément par l'établissement,</li>
          <li>Indiscipline, désaccord relatif aux choix pédagogiques, perte de la confiance entre la famille
          et l'établissement, impayés.</li>
        </ul>
        <p>La rupture du contrat et la radiation de l'élève ne pourront être définitives qu'après entretien
        entre le chef de l'établissement et les représentants légaux de l'enfant, puis envoi d'un courrier
        qui témoignera des manquements constatés.</p>
        <p>Le coût annuel de la scolarisation, au prorata temporis pour la période écoulée (tout mois commencé
        est dû en entier) reste dû dans tous les cas ainsi que toutes les dépenses ou frais engagés par la famille.</p>
      </div>

      <div class="sub-article">
        <h3>8-2 Résiliation au terme d'une année scolaire</h3>
        <p>Les parents informent l'établissement de la non-réinscription de leur enfant le second trimestre
        scolaire à l'occasion de la demande qui est faite à tous les parents d'élèves au plus tard le 1er juin.</p>
        <p>L'établissement s'engage à respecter ce même délai (le 1er juin) pour informer les parents de la
        non-réinscription de leur enfant, pour une cause réelle et sérieuse (Indiscipline, désaccord relatif
        aux choix pédagogiques, perte de la confiance entre la famille et l'établissement, impayés).</p>
      </div>
    </div>

    <div style="margin-top: 20px; font-size: 9.5pt; color: #64748b; font-weight: 600;">
      Fait à Dakar en deux exemplaires, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>

    <div class="sigs">
      <div class="sig">Le Parent / Tuteur légal<br><em style="font-weight:400;font-size:8pt">(précédé de « Lu et approuvé »)</em></div>
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter('Convention de scolarisation', ref)}
  </body></html>`;
}

// ── Règlement intérieur + accusé de réception (crèche) ───────────────────────

function buildReglementInterieurHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
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
        ${sigDirectionBlock(assets)}
      </div>
    </div>
    ${pageFooter('Règlement intérieur crèche', ref)}
  </body></html>`;
}

// ── Autorisation de soins (crèche) ──────────────────────────────────────────

function buildAutorisationSoinsHtml(eleve: Partial<Eleve>, assets: TenantAssets): string {
  const logoBase64 = assets.logoBase64;
  const nomComplet = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || '—';
  const parent = eleve.parent1;
  const parentNom = parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : '';
  const ref = `AUT-SOINS-${(eleve.matricule || '').replace(/-/g, '')}-${new Date().getFullYear()}`;
  const urgence = eleve.contactUrgence;
  const e = eleve as any;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head><body>
    ${pageHeader(logoBase64, 'Autorisation de Soins', ref)}
    <div class="dossier-label">Enfant : ${nomComplet} — Matricule : ${eleve.matricule || '—'} — Année scolaire ${getAnnee()}</div>

    <div class="text-block">
      <p>Je soussigné(e) <strong>${v(parentNom, 'M. / Mme ____________________')}</strong>,
      agissant en qualité de ${parent?.lien === 'MERE' ? 'mère' : parent?.lien === 'PERE' ? 'père' : 'représentant(e) légal(e)'}
      de l'enfant <strong>${nomComplet}</strong>, né(e) le <strong>${formatDate(eleve.dateNaissance)}</strong>,
      inscrit(e) à la crèche <strong>Le Toit des Anges</strong>,</p>

      <p style="margin-top:16px"><strong>AUTORISE</strong> expressément le personnel de l'établissement à :</p>
    </div>

    <div class="section">
      <div class="text-block" style="margin-top:8px;line-height:2.4">
        <p>&#9745; Faire appel aux services d'urgence (SAMU, pompiers) en cas de nécessité ;</p>
        <p>&#9745; Faire transporter mon enfant vers l'établissement hospitalier le plus proche ;</p>
        <p>&#9745; Autoriser toute intervention médicale ou chirurgicale d'urgence jugée indispensable
        par le médecin pour préserver la santé ou la vie de mon enfant ;</p>
        <p>&#9745; Administrer les premiers soins (désinfection, pansement, prise de température) ;</p>
        <p>&#9745; Administrer un traitement médical prescrit, à condition qu'une ordonnance en cours de
        validité soit fournie avec les médicaments dans leur emballage d'origine, au nom de l'enfant.</p>
      </div>
    </div>

    <div class="section">
      <h2>Informations médicales importantes</h2>
      <table>
        <tr><td class="lbl">Allergies connues</td><td>${v(getSani(e, 'allergieAutres') || (getSani(e, 'allergieAlimentaire') ? 'Alimentaire' : '') || (getSani(e, 'allergieMedicament') ? 'Médicamenteuse' : ''), 'Aucune signalée')}</td></tr>
        <tr><td class="lbl">Traitement en cours</td><td>${v(getSani(e, 'traitementDetail'), 'Aucun')}</td></tr>
        <tr><td class="lbl">Médecin traitant</td><td>${v(getSani(e, 'medecinNom'), 'Non renseigné')}${getSani(e, 'medecinTel') ? ` — Tél. : <strong>${getSani(e, 'medecinTel')}</strong>` : ''}</td></tr>
        <tr><td class="lbl">Contre-indications</td><td>${v(eleve.besoinSpecifique, 'Aucune signalée')}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Contacts en cas d'urgence</h2>
      <table>
        <tr><td class="lbl">Parent principal</td><td><strong>${v(parentNom)}</strong> — Tél. : ${v(parent?.telephone)}</td></tr>
        ${eleve.parent2 ? `<tr><td class="lbl">Second parent</td><td><strong>${v(`${eleve.parent2.prenom || ''} ${eleve.parent2.nom || ''}`.trim())}</strong> — Tél. : ${v(eleve.parent2.telephone)}</td></tr>` : ''}
        ${urgence ? `<tr><td class="lbl">Contact d'urgence</td><td><strong>${v(`${urgence.prenom || ''} ${urgence.nom || ''}`.trim())}</strong> (${v(urgence.lien)}) — Tél. : ${v(urgence.telephone)}</td></tr>` : ''}
      </table>
    </div>

    <div style="margin-top:20px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:9pt;color:#475569;line-height:1.7">
      <p><strong>Note :</strong> En cas d'impossibilité de joindre les personnes ci-dessus, j'autorise
      la Direction à prendre toute décision nécessaire dans l'intérêt de la santé de mon enfant.
      Je m'engage à communiquer tout changement concernant l'état de santé de mon enfant ou
      les coordonnées des personnes à contacter.</p>
    </div>

    <div style="margin-top: 16px; font-size: 9.5pt; color: #64748b; font-weight: 600;">
      Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>

    <div class="sigs">
      <div class="sig">Signature du parent / tuteur<br><em style="font-weight:400;font-size:8pt">(précédée de « Lu et approuvé »)</em></div>
      ${sigDirectionBlock(assets)}
    </div>
    ${pageFooter('Autorisation de soins', ref)}
  </body></html>`;
}

// ── API publique ─────────────────────────────────────────────────────────────

export type DocAdminType =
  | 'fiche_inscription' | 'certificat_scolarite' | 'certificat_radiation'
  | 'fiche_sanitaire' | 'autorisation_sortie' | 'autorisation_soins'
  | 'convention_scolarisation' | 'reglement_interieur';

// Documents applicables selon le cycle de l'élève :
// - Crèche               → fiche d'identité + règlement intérieur + sanitaire + autorisation soins
// - Maternelle/Élémentaire → fiche d'identité + convention de scolarisation + certificat + sanitaire
export function docsForNiveau(niveau: string | undefined): DocAdminType[] {
  if (niveau === 'CRECHE') {
    return ['fiche_inscription', 'reglement_interieur', 'fiche_sanitaire', 'autorisation_soins'];
  }
  return ['fiche_inscription', 'convention_scolarisation', 'certificat_scolarite', 'fiche_sanitaire'];
}

function buildHtml(type: DocAdminType, eleve: Partial<Eleve> & { motifRadiation?: string }, assets: TenantAssets): string {
  switch (type) {
    case 'fiche_inscription':          return buildFicheInscriptionHtml(eleve, assets);
    case 'certificat_scolarite':       return buildCertificatScolariteHtml(eleve, assets);
    case 'certificat_radiation':       return buildCertificatRadiationHtml(eleve, assets);
    case 'fiche_sanitaire':            return buildFicheSanitaireHtml(eleve, assets);
    case 'autorisation_sortie':        return buildAutorisationSortieHtml(eleve, assets);
    case 'autorisation_soins':         return buildAutorisationSoinsHtml(eleve, assets);
    case 'convention_scolarisation':   return buildConventionScolarisationHtml(eleve, assets);
    case 'reglement_interieur':        return buildReglementInterieurHtml(eleve, assets);
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
    autorisation_soins:       'Autorisation_Soins',
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
  const assets = await getTenantAssets();
  return buildHtml(type, eleve, assets);
}

export async function downloadSingleAdminDoc(
  type: DocAdminType,
  eleve: Partial<Eleve> & { motifRadiation?: string }
): Promise<void> {
  const assets = await getTenantAssets();
  const html = buildHtml(type, eleve, assets);
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
  const assets = await getTenantAssets();
  const html = buildHtml(type, eleve, assets);
  const blob = await htmlToBlob(html);
  downloadBlob(blob, docFilename(type, eleve));
}

export async function downloadAdminDocsZip(eleve: Partial<Eleve>): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const assets = await getTenantAssets();

  // Documents adaptés au cycle de l'élève (crèche ≠ maternelle/élémentaire)
  const types: DocAdminType[] = [...docsForNiveau(eleve.niveau), 'autorisation_sortie'];

  const zip = new JSZip();
  const folder = zip.folder(`Dossier_${(eleve.nom || '').toUpperCase()}_${(eleve.prenom || '').toUpperCase()}`);

  for (const type of types) {
    const html = buildHtml(type, eleve, assets);
    const blob = await htmlToBlob(html);
    folder!.file(docFilename(type, eleve), blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const zipName = `Documents_Administratifs_${(eleve.nom || '').toUpperCase()}_${(eleve.prenom || '').toUpperCase()}_${getAnnee().replace('/', '-')}.zip`;
  downloadBlob(zipBlob, zipName);
}
