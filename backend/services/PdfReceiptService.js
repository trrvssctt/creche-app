import PDFDocument from 'pdfkit';
import axios from 'axios';

// Cache du logo en mémoire pour éviter de le re-télécharger à chaque PDF
let logoCache = null;

async function fetchLogo(url) {
  if (!url) return null;
  if (logoCache?.url === url) return logoCache.buffer;
  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const buffer = Buffer.from(resp.data);
    logoCache = { url, buffer };
    return buffer;
  } catch {
    return null;
  }
}

function fmtMontant(n, currency = 'F CFA') {
  return `${(n || 0).toLocaleString('fr-FR')} ${currency}`;
}

export class PdfReceiptService {
  /**
   * Génère un buffer PDF de facture/reçu au format professionnel.
   * @param {Object} opts
   * @param {string} opts.ecoleNom
   * @param {string} opts.ecoleAdresse
   * @param {string} opts.ecoleTel
   * @param {string} opts.ecoleEmail
   * @param {string} opts.logoUrl
   * @param {string} opts.parentName
   * @param {string} opts.parentTel
   * @param {string} opts.enfantNom
   * @param {string} opts.matricule
   * @param {string} opts.classe
   * @param {string} opts.niveau
   * @param {string} opts.reference
   * @param {string} opts.type - ex: "Facture mensuelle", "Reçu inscription"
   * @param {string} opts.date
   * @param {string} opts.periode
   * @param {string} opts.currency
   * @param {Array<{label: string, periode?: string, echeance?: string, montant: number, statut?: string}>} opts.lignes
   * @param {number} opts.totalDu
   * @param {number} opts.totalPaye
   * @param {number} opts.soldeRestant
   * @param {boolean} [opts.isPaid] - Affiche le tampon PAYÉ
   * @returns {Promise<Buffer>}
   */
  static async generateReceipt(opts) {
    const {
      ecoleNom = "L'école", ecoleAdresse = '', ecoleTel = '', ecoleEmail = '',
      logoUrl = '', parentName = 'Parent', parentTel = '', enfantNom = '',
      matricule = '', classe = '', niveau = '', reference = '', type = 'Facture mensuelle',
      date = '', periode = '', currency = 'F CFA', lignes = [],
      totalDu = 0, totalPaye = 0, soldeRestant = 0, isPaid = false,
    } = opts;

    const logoBuffer = await fetchLogo(logoUrl);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = 595.28;
      const ml = 36, mr = 36;
      const contentW = pageW - ml - mr;

      // ═══════════════════════════════════════════════════════════════════
      // EN-TÊTE : Logo + Infos école
      // ═══════════════════════════════════════════════════════════════════
      const headerY = 36;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, ml, headerY, { width: 50, height: 50 });
        } catch { /* logo non valide */ }
      }

      const infoX = ml + 60;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e293b').text(ecoleNom, infoX, headerY + 2);
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      if (ecoleAdresse) doc.text(ecoleAdresse, infoX, headerY + 22);
      const contactLine = [ecoleTel, ecoleEmail].filter(Boolean).join(' | ');
      if (contactLine) doc.text(contactLine, infoX, headerY + 34);

      // ═══════════════════════════════════════════════════════════════════
      // BLOC PARENT (en haut à droite)
      // ═══════════════════════════════════════════════════════════════════
      const rightX = pageW - mr - 160;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(parentName, rightX, headerY + 4, { width: 155, align: 'right' });
      if (parentTel) doc.fontSize(9).font('Helvetica').fillColor('#666').text(parentTel, rightX, headerY + 20, { width: 155, align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#999').text('Parent / Tuteur', rightX, headerY + 34, { width: 155, align: 'right' });

      // ═══════════════════════════════════════════════════════════════════
      // BLOC RÉFÉRENCE (encadré)
      // ═══════════════════════════════════════════════════════════════════
      const refY = headerY + 65;
      doc.roundedRect(ml, refY, contentW * 0.55, 72, 4).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      let ry = refY + 10;
      doc.font('Helvetica').text('Référence de la facture : ', ml + 12, ry, { continued: true }).font('Helvetica-Bold').text(reference);
      ry += 15;
      doc.font('Helvetica').fillColor('#475569').text('Type de facture : ', ml + 12, ry, { continued: true }).font('Helvetica-Bold').fillColor('#b45309').text(type);
      ry += 15;
      doc.font('Helvetica').fillColor('#475569').text("Date d'émission : ", ml + 12, ry, { continued: true }).font('Helvetica-Bold').fillColor('#1e293b').text(date);
      ry += 15;
      if (periode) doc.font('Helvetica').fillColor('#475569').text('Période : ', ml + 12, ry, { continued: true }).font('Helvetica-Bold').fillColor('#1e293b').text(periode);

      // ═══════════════════════════════════════════════════════════════════
      // INFO PAIEMENT (encadré droite, fond jaune)
      // ═══════════════════════════════════════════════════════════════════
      if (!isPaid) {
        const ipX = ml + contentW * 0.58;
        const ipW = contentW * 0.42;
        doc.rect(ipX, refY, ipW, 72).fill('#fffbeb');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#b45309').text('Information de paiement :', ipX + 10, refY + 10);
        doc.fontSize(8).font('Helvetica').fillColor('#78716c');
        doc.text(`Le montant de ${fmtMontant(totalDu, currency)} est à`, ipX + 10, refY + 26, { width: ipW - 20 });
        doc.text("régler avant la fin du mois.", ipX + 10, refY + 38, { width: ipW - 20 });
        doc.text("Facture payable dès réception.", ipX + 10, refY + 50, { width: ipW - 20 });
      }

      // ═══════════════════════════════════════════════════════════════════
      // RÉSUMÉ FINANCIER
      // ═══════════════════════════════════════════════════════════════════
      let cy = refY + 85;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text(`Facture ${reference} du ${date}`, ml, cy);
      cy += 24;

      doc.fontSize(10).font('Helvetica').fillColor('#333');
      doc.text('Total dû', ml, cy);
      doc.font('Helvetica-Bold').text(fmtMontant(totalDu, currency), ml + 130, cy);
      cy += 16;
      doc.font('Helvetica').fillColor('#333').text('Total payé', ml, cy);
      doc.font('Helvetica-Bold').fillColor('#16a34a').text(fmtMontant(totalPaye, currency), ml + 130, cy);
      cy += 18;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('Solde restant', ml, cy);
      doc.text(fmtMontant(soldeRestant, currency), ml + 130, cy);

      // ═══════════════════════════════════════════════════════════════════
      // BLOCS ÉLÈVE / PARENT
      // ═══════════════════════════════════════════════════════════════════
      cy += 30;
      const boxH = 60;
      const boxW = contentW * 0.48;

      // Élève
      doc.roundedRect(ml, cy, boxW, boxH, 4).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8').text('ÉLÈVE', ml + 10, cy + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(enfantNom, ml + 10, cy + 20);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b');
      if (matricule) doc.text(`Matricule : ${matricule}`, ml + 10, cy + 33);
      if (classe) doc.text(`Classe : ${classe}`, ml + 10, cy + 44);
      if (niveau) doc.text(`Niveau : ${niveau}`, ml + 10, cy + 55);

      // Parent
      const px = ml + contentW * 0.52;
      doc.roundedRect(px, cy, boxW, boxH, 4).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8').text('PARENT / TUTEUR', px + 10, cy + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(parentName, px + 10, cy + 20);
      if (parentTel) doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(parentTel, px + 10, cy + 33);

      // ═══════════════════════════════════════════════════════════════════
      // TABLEAU DES LIGNES
      // ═══════════════════════════════════════════════════════════════════
      cy += boxH + 16;
      const colService = ml;
      const colPeriode = ml + contentW * 0.38;
      const colEch = ml + contentW * 0.53;
      const colMontant = ml + contentW * 0.68;
      const colStatut = ml + contentW * 0.84;
      const rowH = 26;

      // Header
      doc.rect(ml, cy, contentW, rowH).fill('#1e3a5f');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#fff');
      doc.text('SERVICE / OFFRE', colService + 8, cy + 9);
      doc.text('PÉRIODE', colPeriode, cy + 9);
      doc.text('ÉCHÉANCE', colEch, cy + 9);
      doc.text('MONTANT', colMontant, cy + 9);
      doc.text('STATUT', colStatut, cy + 9);
      cy += rowH;

      // Lignes
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(ml, cy, contentW, rowH).fill(bg);
        doc.fontSize(8).font('Helvetica').fillColor('#333');
        doc.text(l.label || '', colService + 8, cy + 9, { width: contentW * 0.36 });
        doc.text(l.periode || periode, colPeriode, cy + 9);
        doc.text(l.echeance || '', colEch, cy + 9);
        doc.font('Helvetica-Bold').text(fmtMontant(l.montant, currency), colMontant, cy + 9);

        // Statut
        const statut = l.statut || (isPaid ? 'Payé' : 'En attente');
        const statutColor = statut === 'Payé' || statut === 'PAYE' ? '#16a34a' : '#f59e0b';
        const statutBg = statut === 'Payé' || statut === 'PAYE' ? '#dcfce7' : '#fef3c7';
        doc.roundedRect(colStatut - 2, cy + 5, 55, 16, 3).fill(statutBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(statutColor).text(
          statut === 'PAYE' ? 'Payé' : statut === 'EN_ATTENTE' ? 'En attente' : statut === 'EN_RETARD' ? 'En retard' : statut,
          colStatut + 4, cy + 9
        );
        cy += rowH;
      }

      // ═══════════════════════════════════════════════════════════════════
      // TOTAUX (en bas à droite)
      // ═══════════════════════════════════════════════════════════════════
      cy += 10;
      const totX = ml + contentW * 0.5;
      const totW = contentW * 0.5;

      doc.rect(totX, cy, totW, 22).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(9).font('Helvetica').fillColor('#333').text('Total dû', totX + 10, cy + 7);
      doc.font('Helvetica-Bold').text(fmtMontant(totalDu, currency), totX + totW - 110, cy + 7, { width: 100, align: 'right' });
      cy += 22;

      doc.rect(totX, cy, totW, 22).fill('#ecfdf5');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#16a34a').text('Total payé', totX + 10, cy + 7);
      doc.text(fmtMontant(totalPaye, currency), totX + totW - 110, cy + 7, { width: 100, align: 'right' });
      cy += 22;

      const soldeBg = soldeRestant <= 0 ? '#dcfce7' : '#1e3a5f';
      const soldeTxt = soldeRestant <= 0 ? '#16a34a' : '#fff';
      doc.rect(totX, cy, totW, 24).fill(soldeBg);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(soldeTxt).text('Solde restant', totX + 10, cy + 8);
      doc.text(fmtMontant(soldeRestant, currency), totX + totW - 110, cy + 8, { width: 100, align: 'right' });

      // ═══════════════════════════════════════════════════════════════════
      // TAMPON PAYÉ (si soldé)
      // ═══════════════════════════════════════════════════════════════════
      if (isPaid) {
        doc.save();
        doc.translate(pageW - 180, cy - 40);
        doc.rotate(-15);
        doc.roundedRect(0, 0, 100, 40, 4).lineWidth(3).strokeColor('#16a34a').stroke();
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#16a34a').text('PAYÉ', 18, 10);
        doc.restore();
      }

      // ═══════════════════════════════════════════════════════════════════
      // SIGNATURES
      // ═══════════════════════════════════════════════════════════════════
      cy += 50;
      doc.moveTo(ml, cy).lineTo(ml + 180, cy).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.moveTo(pageW - mr - 180, cy).lineTo(pageW - mr, cy).stroke();

      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
      doc.text('Signature du parent / tuteur', ml, cy + 5, { width: 180, align: 'center' });
      doc.text('Cachet & signature de la Direction', pageW - mr - 180, cy + 5, { width: 180, align: 'center' });

      // ═══════════════════════════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════════════════════════
      const footerY = 780;
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
      doc.text(`${ecoleNom} — Facture générée le ${date}`, ml, footerY);
      doc.text(reference, ml, footerY, { width: contentW, align: 'right' });

      doc.end();
    });
  }
}
