import PDFDocument from 'pdfkit';

export class PdfReceiptService {
  /**
   * Génère un buffer PDF pour un reçu de paiement / facture.
   * @param {Object} opts
   * @param {string} opts.ecoleNom
   * @param {string} opts.parentName
   * @param {string} opts.enfantNom
   * @param {string} opts.reference
   * @param {string} opts.date
   * @param {string} opts.methode
   * @param {string} opts.currency
   * @param {Array<{label: string, montant: number}>} opts.lignes
   * @param {number} opts.total
   * @param {string} [opts.titre] - Titre du document (ex: "Reçu de paiement")
   * @returns {Promise<Buffer>}
   */
  static async generateReceipt({ ecoleNom, parentName, enfantNom, reference, date, methode, currency, lignes, total, titre = 'Reçu de paiement' }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(ecoleNom, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#666').text('Espace Scolarite', { align: 'center' });
      doc.moveDown(1.5);

      // Titre
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b').text(titre, { align: 'center' });
      doc.moveDown(1);

      // Infos
      doc.fontSize(10).font('Helvetica').fillColor('#333');
      doc.text(`Date : ${date}`);
      doc.text(`Reference : ${reference}`);
      doc.text(`Parent : ${parentName}`);
      doc.text(`Eleve : ${enfantNom}`);
      if (methode) doc.text(`Methode de paiement : ${methode}`);
      doc.moveDown(1);

      // Tableau
      const tableTop = doc.y;
      const col1 = 50, col2 = 400, colWidth1 = 340, colWidth2 = 120;

      // Header du tableau
      doc.rect(col1, tableTop, colWidth1 + colWidth2, 22).fill('#faf9f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#92400e');
      doc.text('Description', col1 + 10, tableTop + 7, { width: colWidth1 });
      doc.text('Montant', col2, tableTop + 7, { width: colWidth2, align: 'right' });

      let y = tableTop + 28;
      doc.font('Helvetica').fillColor('#333').fontSize(10);

      for (const ligne of lignes) {
        doc.text(ligne.label, col1 + 10, y, { width: colWidth1 });
        doc.text(`${(ligne.montant || 0).toLocaleString('fr-FR')} ${currency}`, col2, y, { width: colWidth2, align: 'right' });
        y += 20;
        doc.moveTo(col1, y - 4).lineTo(col1 + colWidth1 + colWidth2, y - 4).strokeColor('#f0ede8').stroke();
      }

      // Total
      y += 4;
      doc.rect(col1, y, colWidth1 + colWidth2, 24).fill('#fffbeb');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#d97706');
      doc.text('TOTAL', col1 + 10, y + 7, { width: colWidth1 });
      doc.text(`${(total || 0).toLocaleString('fr-FR')} ${currency}`, col2, y + 7, { width: colWidth2, align: 'right' });

      // Footer
      doc.moveDown(4);
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8');
      doc.text('Ce document fait office de recu de paiement. Conservez-le precieusement.', col1, doc.y, { align: 'center' });
      doc.text(`${ecoleNom} — Document genere automatiquement`, { align: 'center' });

      doc.end();
    });
  }
}
