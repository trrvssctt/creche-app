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

  // Badge régime affiché dans la box élève
  const regimeBadge = isExonere
    ? `<span style="display:inline-block;margin-top:4px;background:#ffe4e6;color:#9f1239;padding:2px 8px;border-radius:999px;font-size:7pt;font-weight:900;text-transform:uppercase">✦ Exonéré total</span>`
    : hasRemise
      ? `<span style="display:inline-block;margin-top:4px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:7pt;font-weight:900;text-transform:uppercase">Remise ${remisePct}%</span>`
      : '';

  const rows = d.echeances.map(e => {
    const statut  = isRecu ? 'PAYE' : e.statut;
    const bg      = statut === 'PAYE' ? '#d1fae5' : statut === 'EN_RETARD' ? '#fee2e2' : '#fef3c7';
    const color   = statut === 'PAYE' ? '#065f46' : statut === 'EN_RETARD' ? '#991b1b' : '#92400e';
    const label   = statut === 'PAYE' ? 'Payé' : statut === 'EN_RETARD' ? 'En retard' : 'En attente';
    const svc     = e.service?.name || e.description || 'Redevance';
    const periode = e.periodeLabel || d.period;
    const dt      = new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const mnt     = Number(e.montant);

    // Affichage du montant : si remise → prix barré + prix réduit
    let montantCell: string;
    if (hasRemise && mnt > 0) {
      const original = Math.round(mnt / (1 - remisePct / 100));
      montantCell = `<span style="text-decoration:line-through;color:#94a3b8;font-size:7.5pt;font-weight:500">${original.toLocaleString('fr-FR')}</span>
        <span style="font-weight:900;color:#1e293b;margin-left:4px">${mnt.toLocaleString('fr-FR')} ${d.currency}</span>`;
    } else if (isExonere) {
      montantCell = `<span style="color:#94a3b8;font-size:7.5pt;font-style:italic">Exonéré</span>`;
    } else {
      montantCell = `<span style="font-weight:700">${mnt.toLocaleString('fr-FR')} ${d.currency}</span>`;
    }

    return `<tr>
      <td>${svc}</td>
      <td style="text-align:center">${periode}</td>
      <td style="text-align:center">${dt}</td>
      <td style="text-align:right">${montantCell}</td>
      <td style="text-align:center"><span style="background:${bg};color:${color};padding:2px 8px;border-radius:999px;font-size:7.5pt;font-weight:700">${label}</span></td>
    </tr>`;
  }).join('');

  // Calcul de la remise totale pour la section totaux
  let totalOriginal = 0;
  let totalRemise   = 0;
  if (hasRemise && d.totalDu > 0) {
    totalOriginal = Math.round(d.totalDu / (1 - remisePct / 100));
    totalRemise   = totalOriginal - d.totalDu;
  }

  const parentNom   = d.parent1?.prenom ? `${d.parent1.prenom} ${d.parent1.nom || ''}`.trim() : '—';
  const parentTel   = d.parent1?.whatsapp || d.parent1?.telephone || d.parent1?.phone || '';
  const parentEmail = d.parent1?.email || '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9.5pt;color:#1e293b;padding:22px 34px;background:#fff;width:794px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:14px}
    .school{font-size:14pt;font-weight:900;color:#4f46e5;text-transform:uppercase}
    .school-sub{font-size:7.5pt;color:#64748b;margin-top:3px;line-height:1.5}
    .doc-title{font-size:13pt;font-weight:900;text-align:right}
    .doc-ref{font-size:7.5pt;font-weight:700;color:#4f46e5;background:#eef2ff;padding:2px 7px;border-radius:4px;display:inline-block;margin-top:2px}
    .doc-period{font-size:8.5pt;color:#64748b;font-weight:700;margin-top:2px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
    .box h3{font-size:6.5pt;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .box p{font-size:9.5pt;font-weight:700;line-height:1.5}
    .box .sub{font-size:8.5pt;color:#64748b;font-weight:500}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    thead tr{background:#1e293b;color:#fff}
    th{padding:6px 8px;font-size:7.5pt;font-weight:800;text-transform:uppercase}
    td{padding:6px 8px;font-size:8.5pt;border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:14px}
    .totals{width:240px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .trow{display:flex;justify-content:space-between;padding:6px 12px;font-size:8.5pt;font-weight:700}
    .trow.due{background:#f1f5f9;color:#475569}
    .trow.paid{background:#d1fae5;color:#065f46}
    .trow.bal{background:#1e293b;color:#fff;font-size:9.5pt;font-weight:900}
    .sigs{display:flex;justify-content:space-between;margin-top:18px}
    .sig{border-top:1px solid #cbd5e1;width:180px;padding-top:5px;font-size:7.5pt;color:#94a3b8;text-align:center}
    .ftr{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8;font-weight:600}
  </style></head><body>
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12px">
        ${d.tenant?.logoUrl ? `<img src="${d.tenant.logoUrl}" style="height:56px;width:auto;object-fit:contain;flex-shrink:0" alt="Logo" />` : ''}
        <div>
          <div class="school">${d.tenant?.name || 'Le Toit des Anges'}</div>
          <div class="school-sub">${d.tenant?.address ? d.tenant.address + '<br>' : ''}${d.tenant?.phone || ''}${d.tenant?.phone && d.tenant?.email ? ' | ' : ''}${d.tenant?.email || ''}</div>
        </div>
      </div>
      <div>
        <div class="doc-title">${isRecu ? 'REÇU DE PAIEMENT' : 'FACTURE MENSUELLE'}</div>
        <div style="text-align:right"><span class="doc-ref">${ref}</span></div>
        <div class="doc-period" style="text-align:right">${isRecu ? `Mode : ${METHODE_LABELS[d.methodePaiement || ''] || 'Espèces'}` : `Période : ${d.period}`}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h3>Élève</h3>
        <p>${nomEleve}</p>
        ${d.eleve.matricule ? `<p class="sub">Matricule : ${d.eleve.matricule}</p>` : ''}
        ${d.eleve.classeNom ? `<p class="sub">Classe : ${d.eleve.classeNom}</p>` : ''}
        ${d.eleve.niveau ? `<p class="sub">Niveau : ${d.eleve.niveau}</p>` : ''}
        ${regimeBadge}
      </div>
      <div class="box">
        <h3>Parent / Tuteur</h3>
        <p>${parentNom}</p>
        ${parentTel ? `<p class="sub">${parentTel}</p>` : ''}
        ${parentEmail ? `<p class="sub">${parentEmail}</p>` : ''}
      </div>
    </div>

    <table>
      <thead><tr>
        <th style="text-align:left">Service / Offre</th>
        <th style="text-align:center">Période</th>
        <th style="text-align:center">Échéance</th>
        <th style="text-align:right">Montant</th>
        <th style="text-align:center">Statut</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8">Aucune créance pour cette période</td></tr>`}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        ${isRecu
          ? `<div class="trow paid" style="font-size:11pt"><span>Montant encaissé</span><span>${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="trow bal" style="background:#065f46"><span>✓ Solde</span><span>0 ${d.currency}</span></div>`
          : `${hasRemise && totalOriginal > 0
              ? `<div class="trow due" style="color:#94a3b8"><span>Tarif de base</span><span style="text-decoration:line-through">${totalOriginal.toLocaleString('fr-FR')} ${d.currency}</span></div>
                 <div class="trow" style="background:#fef3c7;color:#92400e"><span>Remise (${remisePct}%)</span><span>− ${totalRemise.toLocaleString('fr-FR')} ${d.currency}</span></div>`
              : ''}
             <div class="trow due"><span>Total dû</span><span>${d.totalDu.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="trow paid"><span>Total payé</span><span>${d.totalPaye.toLocaleString('fr-FR')} ${d.currency}</span></div>
             <div class="trow bal"><span>Solde restant</span><span>${d.solde.toLocaleString('fr-FR')} ${d.currency}</span></div>`}
      </div>
    </div>

    <div class="sigs">
      <div class="sig">Signature du parent / tuteur</div>
      <div class="sig">Cachet &amp; signature de la Direction</div>
    </div>
    <div class="ftr">
      <span>${d.tenant?.name || 'Le Toit des Anges'} — ${isRecu ? 'Reçu' : 'Facture'} généré${isRecu ? '' : 'e'} le ${new Date().toLocaleDateString('fr-FR')}</span>
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
