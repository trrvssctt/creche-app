import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface StudentInvoiceData {
  eleve: {
    nom: string;
    prenom: string;
    matricule?: string;
    niveau?: string;
    classeNom?: string;
  };
  parent1?: any;
  tenant?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
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
  const isRecu = d.type === 'RECU';
  const nomEleve = `${d.eleve.prenom} ${d.eleve.nom}`.trim();
  const ref = d.reference ||
    (isRecu
      ? `REC-${(d.eleve.matricule || Date.now().toString(36)).replace(/-/g, '')}`
      : `FAC-${(d.eleve.matricule || Date.now().toString(36)).replace(/-/g, '')}-${d.period.replace(/\s+/g, '').toUpperCase()}`);

  const rows = d.echeances.map(e => {
    const statut = isRecu ? 'PAYE' : e.statut;
    const bg = statut === 'PAYE' ? '#d1fae5' : statut === 'EN_RETARD' ? '#fee2e2' : '#fef3c7';
    const color = statut === 'PAYE' ? '#065f46' : statut === 'EN_RETARD' ? '#991b1b' : '#92400e';
    const label = statut === 'PAYE' ? 'Payé' : statut === 'EN_RETARD' ? 'En retard' : 'En attente';
    const svc = e.service?.name || e.description || 'Redevance';
    const periode = e.periodeLabel || d.period;
    const dt = new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const mnt = Number(e.montant).toLocaleString('fr-FR');
    return `<tr>
      <td>${svc}</td>
      <td style="text-align:center">${periode}</td>
      <td style="text-align:center">${dt}</td>
      <td style="text-align:right;font-weight:700">${mnt} ${d.currency}</td>
      <td style="text-align:center"><span style="background:${bg};color:${color};padding:2px 8px;border-radius:999px;font-size:8pt;font-weight:700">${label}</span></td>
    </tr>`;
  }).join('');

  const parentNom = d.parent1?.prenom ? `${d.parent1.prenom} ${d.parent1.nom || ''}`.trim() : '—';
  const parentTel = d.parent1?.whatsapp || d.parent1?.telephone || d.parent1?.phone || '';
  const parentEmail = d.parent1?.email || '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#1e293b;padding:32px 44px;background:#fff;width:794px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:18px;margin-bottom:20px}
    .school{font-size:16pt;font-weight:900;color:#4f46e5;text-transform:uppercase}
    .school-sub{font-size:8pt;color:#64748b;margin-top:4px;line-height:1.6}
    .doc-title{font-size:15pt;font-weight:900;text-align:right}
    .doc-ref{font-size:8pt;font-weight:700;color:#4f46e5;background:#eef2ff;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:3px}
    .doc-period{font-size:9pt;color:#64748b;font-weight:700;margin-top:3px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px}
    .box h3{font-size:7pt;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .box p{font-size:10pt;font-weight:700;line-height:1.7}
    .box .sub{font-size:9pt;color:#64748b;font-weight:500}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead tr{background:#1e293b;color:#fff}
    th{padding:8px 10px;font-size:8pt;font-weight:800;text-transform:uppercase}
    td{padding:8px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:32px}
    .totals{width:250px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .trow{display:flex;justify-content:space-between;padding:7px 14px;font-size:9pt;font-weight:700}
    .trow.due{background:#f1f5f9;color:#475569}
    .trow.paid{background:#d1fae5;color:#065f46}
    .trow.bal{background:#1e293b;color:#fff;font-size:10pt;font-weight:900}
    .sigs{display:flex;justify-content:space-between;margin-top:48px}
    .sig{border-top:1px solid #cbd5e1;width:180px;padding-top:6px;font-size:8pt;color:#94a3b8;text-align:center}
    .ftr{margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8;font-weight:600}
  </style></head><body>
    <div class="hdr">
      <div>
        <div class="school">${d.tenant?.name || 'Le Toit des Anges'}</div>
        <div class="school-sub">${d.tenant?.address ? d.tenant.address + '<br>' : ''}${d.tenant?.phone || ''}${d.tenant?.phone && d.tenant?.email ? ' | ' : ''}${d.tenant?.email || ''}</div>
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
          : `<div class="trow due"><span>Total dû</span><span>${d.totalDu.toLocaleString('fr-FR')} ${d.currency}</span></div>
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

// ── Core PDF generator ──────────────────────────────────────────────────────

export async function generateInvoicePdfBlob(data: StudentInvoiceData): Promise<Blob> {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: '794px', background: '#fff', zIndex: '-1',
  });
  container.innerHTML = buildInvoiceHtml(data);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 1.8,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false,
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

    return pdf.output('blob') as unknown as Blob;
  } finally {
    document.body.removeChild(container);
  }
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

export async function downloadZipInvoices(
  items: { filename: string; data: StudentInvoiceData }[],
  zipFilename: string
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const item of items) {
    const blob = await generateInvoicePdfBlob(item.data);
    zip.file(item.filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
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
