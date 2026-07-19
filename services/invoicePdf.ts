import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface StudentInvoiceData {
  eleve: {
    nom: string;
    prenom: string;
    matricule?: string;
    niveau?: string;
    classeNom?: string;
    regimeFinancier?: string;
    remisePct?: number;
  };
  parent1?: any;
  tenant?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
  period: string;
  currency: string;
  reference?: string;
  type?: 'RECU' | 'FACTURE'; // RECU = reçu de paiement (tout payé), FACTURE = facture mensuelle
  methodePaiement?: string;
  echeances: Array<{
    service?: { name: string };
    periodeLabel?: string;
    montant: number | string;
    statut: string;
    dateEcheance: string;
    description?: string;
  }>;
  totalDu: number;
  totalPaye: number;
  solde: number;
}

// ── HTML invoice template ──────────────────────────────────────────────────

const METHODE_LABELS: Record<string, string> = {
  CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave',
  MTN_MOMO: 'MTN MoMo', STRIPE: 'Carte bancaire', TRANSFER: 'Virement', CHEQUE: 'Chèque',
};

function buildInvoiceHtml(d: StudentInvoiceData): string {
  const isRecu    = d.type === 'RECU';
  const nomEleve  = `${d.eleve.prenom} ${d.eleve.nom}`.trim();
  const ref = d.reference ||
    (isRecu
      ? `REC-${(d.eleve.matricule || Date.now().toString(36)).replace(/-/g, '')}`
      : `FAC-${(d.eleve.matricule || Date.now().toString(36)).replace(/-/g, '')}-${d.period.replace(/\s+/g, '').toUpperCase()}`);

  const remisePct       = d.eleve.remisePct ?? 0;
  const regimeFinancier = d.eleve.regimeFinancier ?? 'NORMAL';
  const isExonere       = regimeFinancier === 'CAS_SOCIAL_TOTAL';
  const hasRemise       = !isExonere && remisePct > 0;

  const rows = d.echeances.map(e => {
    const statut  = isRecu ? 'PAYE' : e.statut;
    const bg      = statut === 'PAYE' ? '#d1fae5' : statut === 'EN_RETARD' ? '#fee2e2' : '#fef9c4';
    const color   = statut === 'PAYE' ? '#065f46' : statut === 'EN_RETARD' ? '#991b1b' : '#92400e';
    const label   = statut === 'PAYE' ? 'Payé' : statut === 'EN_RETARD' ? 'En retard' : 'En attente';
    const svc     = e.service?.name || e.description || 'Redevance';
    const periode = e.periodeLabel || d.period;
    const dt      = new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const mnt     = Number(e.montant);

    let montantCell: string;
    if (hasRemise && mnt > 0) {
      const original = Math.round(mnt / (1 - remisePct / 100));
      montantCell = `<span style="text-decoration:line-through;color:#94a3b8;font-size:8pt">${original.toLocaleString('fr-FR')}</span>
        <br><strong>${mnt.toLocaleString('fr-FR')} ${d.currency}</strong>`;
    } else if (isExonere) {
      montantCell = `<em style="color:#94a3b8">Exonéré</em>`;
    } else {
      montantCell = `<strong>${mnt.toLocaleString('fr-FR')} ${d.currency}</strong>`;
    }

    return `<tr>
      <td>${svc}</td>
      <td class="c">${periode}</td>
      <td class="c">${dt}</td>
      <td class="r">${montantCell}</td>
      <td class="c"><span class="badge" style="background:${bg};color:${color}">${label}</span></td>
    </tr>`;
  }).join('');

  let totalOriginal = 0;
  let totalRemise   = 0;
  if (hasRemise && d.totalDu > 0) {
    totalOriginal = Math.round(d.totalDu / (1 - remisePct / 100));
    totalRemise   = totalOriginal - d.totalDu;
  }

  const parentNom   = d.parent1?.prenom ? `${d.parent1.prenom} ${d.parent1.nom || ''}`.trim() : '—';
  const parentTel   = d.parent1?.whatsapp || d.parent1?.telephone || d.parent1?.phone || '';

  const dateEmission = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.5pt;color:#1e293b;padding:28px 36px;background:#fff;width:794px}
    .header{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px}
    .logo{height:52px;width:auto;object-fit:contain}
    .school-name{font-size:15pt;font-weight:800;color:#1a3a6b}
    .school-sub{font-size:8pt;color:#64748b;line-height:1.6}
    .meta-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
    .ref-box{background:#f0f4fa;border:1px solid #d0daea;border-radius:6px;padding:10px 14px;font-size:8.5pt;line-height:1.8}
    .ref-box strong{color:#1a3a6b}
    .client-box{text-align:right;font-size:9.5pt;font-weight:600;line-height:1.6}
    .summary{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:16px}
    .summary-left{flex:1}
    .summary-left h2{font-size:11pt;font-weight:800;color:#1a3a6b;margin-bottom:6px;border-bottom:2px solid #1a3a6b;padding-bottom:4px;display:inline-block}
    .summary-table{width:100%;max-width:300px}
    .summary-table td{padding:4px 0;font-size:9pt}
    .summary-table td:last-child{text-align:right;font-weight:700}
    .summary-table tr:last-child td{font-size:11pt;font-weight:900;padding-top:6px;border-top:2px solid #1a3a6b}
    .info-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;font-size:8.5pt;max-width:220px}
    .info-box strong{color:#92400e}
    .eleve-parent{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
    .ep-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px}
    .ep-box h4{font-size:6.5pt;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px}
    .ep-box p{font-size:9pt;font-weight:600;line-height:1.5}
    .ep-box .sub{font-size:8pt;color:#64748b;font-weight:400}
    table.items{width:100%;border-collapse:collapse;margin-bottom:6px}
    table.items thead{background:#1a3a6b}
    table.items th{color:#fff;padding:7px 10px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
    table.items td{padding:7px 10px;font-size:8.5pt;border-bottom:1px solid #e8ecf2}
    table.items tbody tr:nth-child(even){background:#f8fafc}
    table.items .c{text-align:center}
    table.items .r{text-align:right}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:7.5pt;font-weight:700}
    .totals-row{display:flex;justify-content:flex-end;margin:12px 0 16px}
    .totals-box{width:260px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .tot-line{display:flex;justify-content:space-between;padding:7px 14px;font-size:9pt;font-weight:600}
    .tot-line.sub{background:#f8fafc;color:#64748b;font-size:8.5pt}
    .tot-line.paid{background:#d1fae5;color:#065f46}
    .tot-line.total{background:#1a3a6b;color:#fff;font-size:10.5pt;font-weight:900}
    .sigs{display:flex;justify-content:space-between;margin-top:22px;padding-top:0}
    .sig{border-top:1px solid #cbd5e1;width:200px;padding-top:6px;font-size:7.5pt;color:#94a3b8;text-align:center}
    .footer{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8;font-weight:600}
  </style></head><body>

    <!-- HEADER -->
    <div class="header">
      ${d.tenant?.logoUrl ? `<img src="${d.tenant.logoUrl}" class="logo" alt="Logo" />` : ''}
      <div>
        <div class="school-name">${d.tenant?.name || 'LE TOIT DES ANGES'}</div>
        <div class="school-sub">${d.tenant?.address || 'Ouakam, Dakar, Sénégal'}<br>${d.tenant?.phone || ''}${d.tenant?.email ? ' | ' + d.tenant.email : ''}</div>
      </div>
    </div>

    <!-- REFERENCE + CLIENT -->
    <div class="meta-row">
      <div class="ref-box">
        Référence de la facture : <strong>${ref}</strong><br>
        Type de facture : <strong>${isRecu ? 'Reçu de paiement' : 'Facture mensuelle'}</strong><br>
        Date d'émission : <strong>${dateEmission}</strong><br>
        ${!isRecu ? `Période : <strong>${d.period}</strong>` : `Mode : <strong>${METHODE_LABELS[d.methodePaiement || ''] || 'Espèces'}</strong>`}
      </div>
      <div class="client-box">
        ${parentNom}<br>
        ${parentTel ? parentTel + '<br>' : ''}
        <span style="font-size:8pt;color:#64748b">Parent / Tuteur</span>
      </div>
    </div>

    <!-- SUMMARY -->
    <div class="summary">
      <div class="summary-left">
        <h2>${isRecu ? `Reçu ${ref}` : `Facture ${ref}`} du ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</h2>
        <table class="summary-table">
          ${isRecu
            ? `<tr><td>Montant encaissé</td><td>${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</td></tr>
               <tr><td><strong>Solde</strong></td><td><strong>0 ${d.currency}</strong></td></tr>`
            : `${hasRemise ? `<tr><td>Sous-total</td><td>${totalOriginal.toLocaleString('fr-FR')} ${d.currency}</td></tr>
               <tr><td>Remise (${remisePct}%)</td><td>- ${totalRemise.toLocaleString('fr-FR')} ${d.currency}</td></tr>` : ''}
               <tr><td>Total dû</td><td>${d.totalDu.toLocaleString('fr-FR')} ${d.currency}</td></tr>
               <tr><td>Total payé</td><td style="color:#065f46">${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</td></tr>
               <tr><td><strong>Solde restant</strong></td><td><strong>${d.solde.toLocaleString('fr-FR')} ${d.currency}</strong></td></tr>`}
        </table>
      </div>
      ${!isRecu && d.solde > 0 ? `<div class="info-box">
        <strong>Information de paiement :</strong><br>
        Le montant de <strong>${d.solde.toLocaleString('fr-FR')} ${d.currency}</strong> est à régler avant la fin du mois.<br>
        Facture payable dès réception.
      </div>` : ''}
    </div>

    <!-- ELEVE + PARENT -->
    <div class="eleve-parent">
      <div class="ep-box">
        <h4>Élève</h4>
        <p><strong>${nomEleve}</strong></p>
        ${d.eleve.matricule ? `<p class="sub">Matricule : ${d.eleve.matricule}</p>` : ''}
        ${d.eleve.classeNom ? `<p class="sub">Classe : ${d.eleve.classeNom}</p>` : ''}
        ${d.eleve.niveau ? `<p class="sub">Niveau : ${d.eleve.niveau}</p>` : ''}
        ${isExonere ? `<p style="margin-top:3px;font-size:7pt;color:#9f1239;font-weight:700">✦ Exonéré total</p>` : ''}
        ${hasRemise ? `<p style="margin-top:3px;font-size:7pt;color:#92400e;font-weight:700">Remise ${remisePct}%</p>` : ''}
      </div>
      <div class="ep-box">
        <h4>Parent / Tuteur</h4>
        <p><strong>${parentNom}</strong></p>
        ${parentTel ? `<p class="sub">${parentTel}</p>` : ''}
      </div>
    </div>

    <!-- TABLEAU DES SERVICES -->
    <table class="items">
      <thead><tr>
        <th style="text-align:left">Service / Offre</th>
        <th class="c">Période</th>
        <th class="c">Échéance</th>
        <th style="text-align:right">Montant</th>
        <th class="c">Statut</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8">Aucune créance pour cette période</td></tr>`}</tbody>
    </table>

    <!-- TOTAUX -->
    <div class="totals-row">
      <div class="totals-box">
        ${isRecu
          ? `<div class="tot-line paid"><span>Montant encaissé</span><span>${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="tot-line total" style="background:#065f46"><span>✓ Solde</span><span>0 ${d.currency}</span></div>`
          : `${hasRemise ? `<div class="tot-line sub"><span>Sous-total</span><span style="text-decoration:line-through">${totalOriginal.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="tot-line sub" style="color:#92400e"><span>Remise (${remisePct}%)</span><span>- ${totalRemise.toLocaleString('fr-FR')} ${d.currency}</span></div>` : ''}
             <div class="tot-line sub"><span>Total dû</span><span>${d.totalDu.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="tot-line paid"><span>Total payé</span><span>${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="tot-line total"><span>Solde restant</span><span>${d.solde.toLocaleString('fr-FR')} ${d.currency}</span></div>`}
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet & signature de la Direction</div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span>${d.tenant?.name || 'Le Toit des Anges'} — ${isRecu ? 'Reçu' : 'Facture'} généré${isRecu ? '' : 'e'} le ${dateEmission}</span>
      <span>${ref}</span>
    </div>
  </body></html>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Charge une URL image et la convertit en data-URL base64.
 * Intégrer le logo en base64 dans le HTML évite tout problème CORS
 * lors du rendu par html2canvas dans l'iframe isolée.
 */
async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ── Core PDF generator ──────────────────────────────────────────────────────
// Utilise un iframe isolé pour éviter que html2canvas capture les images du DOM
// principal qui pourraient être cassées et faire planter le rendu.

export async function generateInvoicePdfBlob(data: StudentInvoiceData): Promise<Blob> {
  // Pré-charger le logo en base64 pour l'embarquer directement dans le HTML
  // (évite les erreurs CORS de html2canvas avec les URLs Cloudinary cross-origin)
  let invoiceData = data;
  if (data.tenant?.logoUrl) {
    const logoDataUrl = await fetchAsDataUrl(data.tenant.logoUrl);
    if (logoDataUrl) {
      invoiceData = { ...data, tenant: { ...data.tenant, logoUrl: logoDataUrl } };
    }
  }

  const html = buildInvoiceHtml(invoiceData);

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: '794px', height: '1123px',
    border: 'none', background: '#fff',
  });
  document.body.appendChild(iframe);

  return new Promise<Blob>((resolve, reject) => {
    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument!;
        doc.open();
        doc.write(html);
        doc.close();

        // Laisser le navigateur finir le rendu CSS
        await new Promise(r => setTimeout(r, 400));

        const canvas = await html2canvas(doc.body, {
          scale: 1.8,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 794,
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();   // 210mm
        const pageH = pdf.internal.pageSize.getHeight();  // 297mm

        // Calculer la hauteur naturelle de l'image une fois mise à l'échelle de la page
        const naturalH = (canvas.height * pageW) / canvas.width;

        if (naturalH <= pageH) {
          // Tient sur une page → placer normalement
          pdf.addImage(imgData, 'PNG', 0, 0, pageW, naturalH);
        } else {
          // Contenu trop long → réduire proportionnellement pour tenir sur une seule page
          // (évite les factures de 2 pages pour quelques pixels de dépassement)
          const scale  = pageH / naturalH;
          const fittedW = pageW * scale;
          const marginX = (pageW - fittedW) / 2;
          pdf.addImage(imgData, 'PNG', marginX, 0, fittedW, pageH);
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

// ── Download helpers ────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Construit le ZIP en mémoire sans le télécharger automatiquement.
// onProgress(done, total) est appelé après chaque PDF rendu.
export async function buildZipBlob(
  items: { filename: string; data: StudentInvoiceData }[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (let i = 0; i < items.length; i++) {
    const pdfBlob = await generateInvoicePdfBlob(items[i].data);
    zip.file(items[i].filename, pdfBlob);
    onProgress?.(i + 1, items.length);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// Compat — conservé pour ne pas casser d'autres appelants éventuels
export async function downloadZipInvoices(
  items: { filename: string; data: StudentInvoiceData }[],
  zipFilename: string,
): Promise<void> {
  const zipBlob = await buildZipBlob(items);
  downloadBlob(zipBlob, zipFilename);
}

// ── Print window fallback (for enrollment single invoice) ──────────────────

export function openInvoicePrintWindow(data: StudentInvoiceData) {
  const w = window.open('', '_blank', 'width=860,height=1100');
  if (!w) return;
  w.document.write(buildInvoiceHtml(data));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}
