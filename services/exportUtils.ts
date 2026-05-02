/**
 * exportUtils.ts
 * Utilitaires d'export partagés : CSV, Excel (xlsx), PDF (print), Image (PNG/JPG)
 * Utilise la librairie xlsx déjà installée dans le projet.
 */

import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => any;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
  title?: string;
}

// ─── CSV ───────────────────────────────────────────────────────────────────
export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const { filename, companyInfo, title } = options;

  const lines: string[] = [];

  // En-tête entreprise
  if (companyInfo?.name) lines.push(`"${companyInfo.name}"`);
  if (companyInfo?.address) lines.push(`"Adresse: ${companyInfo.address}"`);
  if (companyInfo?.phone) lines.push(`"Tél: ${companyInfo.phone}"`);
  if (companyInfo?.email) lines.push(`"Email: ${companyInfo.email}"`);
  if (title) lines.push(`"${title}"`);
  lines.push(`"Exporté le: ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}"`);
  lines.push('');

  // En-têtes colonnes
  lines.push(columns.map(c => `"${c.label}"`).join(';'));

  // Données
  data.forEach(row => {
    const cells = columns.map(c => {
      const raw = c.format ? c.format(row[c.key], row) : row[c.key];
      const val = raw == null ? '' : String(raw).replace(/"/g, '""');
      return `"${val}"`;
    });
    lines.push(cells.join(';'));
  });

  const csv = lines.join('\n');
  const bom = '\uFEFF'; // BOM pour UTF-8 (Excel FR)
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

// ─── EXCEL ─────────────────────────────────────────────────────────────────
export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const { filename, sheetName = 'Données', companyInfo, title } = options;

  const wsData: any[][] = [];

  // En-tête entreprise (premières lignes)
  if (companyInfo?.name) wsData.push([companyInfo.name]);
  if (companyInfo?.address) wsData.push([`Adresse: ${companyInfo.address}`]);
  if (companyInfo?.phone) wsData.push([`Tél: ${companyInfo.phone}`]);
  if (companyInfo?.email) wsData.push([`Email: ${companyInfo.email}`]);
  if (title) wsData.push([title]);
  wsData.push([`Exporté le: ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`]);
  wsData.push([]); // ligne vide

  // En-têtes colonnes
  wsData.push(columns.map(c => c.label));

  // Données
  data.forEach(row => {
    wsData.push(
      columns.map(c => {
        const raw = c.format ? c.format(row[c.key], row) : row[c.key];
        return raw == null ? '' : raw;
      })
    );
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map(c => ({ wch: Math.max(c.label.length, 18) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF (via impression navigateur) ──────────────────────────────────────
export function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const { filename, companyInfo, title } = options;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les pop-ups pour exporter en PDF.');
    return;
  }

  const rows = data.map(row =>
    `<tr>${columns.map(c => {
      const raw = c.format ? c.format(row[c.key], row) : row[c.key];
      return `<td>${raw == null ? '' : String(raw)}</td>`;
    }).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1e293b; padding: 24px; }
    .header { border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #4f46e5; }
    .company-info { font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.6; }
    .title { font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
    .date { font-size: 8px; color: #94a3b8; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #1e293b; color: white; font-weight: 900; text-transform: uppercase; font-size: 8px; padding: 8px 10px; text-align: left; letter-spacing: 0.05em; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { @page { margin: 1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${companyInfo?.name || 'GeStockPro'}</div>
      <div class="company-info">
        ${companyInfo?.address ? `${companyInfo.address}<br/>` : ''}
        ${companyInfo?.phone ? `Tél : ${companyInfo.phone}<br/>` : ''}
        ${companyInfo?.email ? `Email : ${companyInfo.email}` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div class="title">${title || filename}</div>
      <div class="date">Exporté le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>
  <table>
    <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    ${companyInfo?.name || 'GeStockPro'} • Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

// ─── IMAGE (PNG via html2canvas) ───────────────────────────────────────────
export async function exportToImage(
  elementId: string,
  filename: string,
  format: 'png' | 'jpg' = 'png'
): Promise<void> {
  // Charge html2canvas si absent
  if (!(window as any).html2canvas) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Chargement html2canvas échoué'));
      document.head.appendChild(s);
    });
  }

  const html2canvas = (window as any).html2canvas;
  const node = document.getElementById(elementId);
  if (!node) throw new Error(`Élément #${elementId} introuvable`);

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const canvas = await html2canvas(node as HTMLElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  canvas.toBlob(
    (blob: Blob | null) => {
      if (!blob) throw new Error('Génération image échouée');
      triggerDownload(blob, `${filename}.${format}`);
    },
    mime,
    format === 'jpg' ? 0.92 : undefined
  );
}

// ─── Utilitaire interne ─────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Composant boutons d'export réutilisable (JSX inline via createElement) ─
export interface ExportToolbarConfig {
  data: any[];
  columns: ExportColumn[];
  options: ExportOptions;
  tableElementId?: string; // pour l'export image
  showToast?: (msg: string, type: 'success' | 'error') => void;
}

export function buildExportHandlers(cfg: ExportToolbarConfig) {
  const { data, columns, options, tableElementId, showToast } = cfg;
  const toast = showToast || ((msg: string) => console.log(msg));

  return {
    csv: () => {
      try { exportToCSV(data, columns, options); toast('Export CSV réussi', 'success'); }
      catch (e: any) { toast(e.message || 'Erreur CSV', 'error'); }
    },
    excel: () => {
      try { exportToExcel(data, columns, options); toast('Export Excel réussi', 'success'); }
      catch (e: any) { toast(e.message || 'Erreur Excel', 'error'); }
    },
    pdf: () => {
      try { exportToPDF(data, columns, options); toast('Impression PDF lancée', 'success'); }
      catch (e: any) { toast(e.message || 'Erreur PDF', 'error'); }
    },
    imagePng: async () => {
      if (!tableElementId) { toast('Identifiant de tableau manquant', 'error'); return; }
      try { await exportToImage(tableElementId, options.filename, 'png'); toast('Export PNG réussi', 'success'); }
      catch (e: any) { toast(e.message || 'Erreur image', 'error'); }
    },
    imageJpg: async () => {
      if (!tableElementId) { toast('Identifiant de tableau manquant', 'error'); return; }
      try { await exportToImage(tableElementId, options.filename, 'jpg'); toast('Export JPG réussi', 'success'); }
      catch (e: any) { toast(e.message || 'Erreur image', 'error'); }
    },
  };
}
