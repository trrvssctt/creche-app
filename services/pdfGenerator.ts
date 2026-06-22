import { jsPDF } from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Ecole {
  name?: string; logoUrl?: string; address?: string;
  phone?: string; email?: string;
}

export interface EleveForPdf {
  id: string; nom: string; prenom: string; niveau: string; statut: string;
  sexe?: string; dateNaissance?: string; lieuNaissance?: string;
  anneeScolaire?: string;
  cantine?: boolean; transportBus?: boolean;
  regimeFinancier?: string; remisePct?: number;
  classe?: { nom: string; niveau: string };
  parent1?: { nom?: string; prenom?: string; telephone?: string; whatsapp?: string; email?: string; lien?: string; telDomicile?: string; telTravail?: string; adresse?: string };
  parent2?: { nom?: string; prenom?: string; telephone?: string; lien?: string; telDomicile?: string; telTravail?: string };
  contactUrgence?: { nom?: string; telephone?: string; lien?: string };
  ficheSanitaire?: Record<string, any>;
}

export interface EcheanceForPdf {
  id: string; mois?: string; montant: number | string; statut: string;
  dateEcheance?: string; datePaiement?: string;
  eleve?: { nom: string; prenom: string };
  service?: { name: string };
  periodeLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NIVEAUX: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section',
  GS: 'Grande Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const LIEN: Record<string, string> = { MERE: 'Mère', PERE: 'Père', TUTEUR: 'Tuteur légal' };

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function today(): string {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imgFormat(b64: string): string {
  if (b64.includes('image/png'))  return 'PNG';
  if (b64.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

// ─── En-tête commune ──────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, ecole: Ecole, logo: string | null) {
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 38, 'F');

  let tx = 14;
  if (logo) {
    try {
      doc.addImage(logo, imgFormat(logo), 8, 5, 26, 26);
      tx = 40;
    } catch { /* ignore */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(ecole.name || 'École', tx, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const contact = [ecole.address, ecole.phone, ecole.email].filter(Boolean).join('   •   ');
  if (contact) doc.text(contact, tx, 24);

  // Bande décorative en bas de l'en-tête
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 36, W, 2, 'F');

  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF, ecole: Ecole, ref?: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(248, 250, 252);
  doc.rect(0, H - 14, W, 14, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(0, H - 14, W, H - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const left = ref ? `Réf: ${ref}` : ecole.name || '';
  doc.text(left, 15, H - 5);
  doc.text(`Document généré le ${today()}`, W / 2, H - 5, { align: 'center' });
  doc.text(ecole.name || '', W - 15, H - 5, { align: 'right' });
}

function divider(doc: jsPDF, y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, y, W - 15, y);
}

// ─── Certificat de scolarité ──────────────────────────────────────────────────

export async function generateCertificat(eleve: EleveForPdf, ecole: Ecole): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const logo = ecole.logoUrl ? await loadImageBase64(ecole.logoUrl) : null;
  drawHeader(doc, ecole, logo);

  let y = 52;
  const annee = eleve.anneeScolaire || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICAT DE SCOLARITÉ', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Année scolaire ${annee}`, W / 2, y, { align: 'center' });
  y += 10;

  divider(doc, y);
  y += 14;

  // Corps
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const intro = `Je soussigné(e), la Direction de l'établissement scolaire`;
  doc.text(intro, 20, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(ecole.name || '', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y += 9;

  doc.text('certifie que :', 20, y);
  y += 14;

  // Bloc enfant
  doc.setFillColor(238, 242, 255);
  doc.rect(18, y - 6, W - 36, 28, 'F');
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.8);
  doc.rect(18, y - 6, W - 36, 28, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(67, 56, 202);
  doc.text(`${eleve.prenom.toUpperCase()} ${eleve.nom.toUpperCase()}`, W / 2, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const birth = eleve.dateNaissance
    ? `né(e) le ${fmtDate(eleve.dateNaissance)}${eleve.lieuNaissance ? ` à ${eleve.lieuNaissance}` : ''}`
    : '';
  if (birth) doc.text(birth, W / 2, y + 14, { align: 'center' });
  y += 34;

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('est régulièrement inscrit(e) dans notre établissement', 20, y);
  y += 8;

  const classeLabel = eleve.classe
    ? `${eleve.classe.nom} — ${NIVEAUX[eleve.niveau] || eleve.niveau}`
    : NIVEAUX[eleve.niveau] || eleve.niveau;

  doc.text('en classe de :', 20, y);
  doc.setFont('helvetica', 'bold');
  doc.text(classeLabel, 60, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  doc.text(`pour l'année scolaire ${annee}.`, 20, y);
  y += 18;

  divider(doc, y);
  y += 12;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  const legal = doc.splitTextToSize(
    'Ce certificat est délivré à la demande des parents et représentants légaux, pour servir et valoir ce que de droit.',
    W - 40
  );
  doc.text(legal, 20, y);
  y += legal.length * 5 + 16;

  // Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fait à Dakar, le ${today()}`, 20, y);
  doc.text('La Directrice / Le Directeur', W - 20, y, { align: 'right' });
  y += 22;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(W - 70, y, W - 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('(Signature et cachet)', W - 45, y + 5, { align: 'center' });

  drawFooter(doc, ecole, `CERT-${eleve.id.slice(0, 8).toUpperCase()}`);
  doc.save(`certificat_scolarite_${eleve.prenom}_${eleve.nom}_${annee}.pdf`);
}

// ─── Fiche de renseignements ──────────────────────────────────────────────────

export async function generateFicheRenseignements(eleve: EleveForPdf, ecole: Ecole): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const logo = ecole.logoUrl ? await loadImageBase64(ecole.logoUrl) : null;
  drawHeader(doc, ecole, logo);

  let y = 50;

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('FICHE DE RENSEIGNEMENTS', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${eleve.prenom} ${eleve.nom}  —  ${eleve.anneeScolaire || ''}`, W / 2, y, { align: 'center' });
  y += 12;

  // Helpers locaux
  const sectionHeader = (title: string, r: number, g: number, b: number) => {
    doc.setFillColor(r, g, b);
    doc.rect(15, y, W - 30, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 20, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 12;
  };

  const row = (label: string, value?: string | null) => {
    if (!value) return;
    const H = doc.internal.pageSize.getHeight();
    if (y > H - 22) {
      doc.addPage();
      drawHeader(doc, ecole, logo);
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value, W - 90);
    doc.text(lines, 80, y);
    y += Math.max(6, lines.length * 5);
  };

  // Identité
  sectionHeader('IDENTITÉ DE L\'ENFANT', 67, 56, 202);
  row('Nom complet', `${eleve.prenom} ${eleve.nom}`);
  row('Sexe', eleve.sexe === 'M' ? 'Garçon' : eleve.sexe === 'F' ? 'Fille' : null);
  row('Date de naissance', fmtDate(eleve.dateNaissance));
  row('Lieu de naissance', eleve.lieuNaissance);
  row('Niveau', NIVEAUX[eleve.niveau] || eleve.niveau);
  row('Classe', eleve.classe?.nom);
  row('Année scolaire', eleve.anneeScolaire);
  row('Régime financier', eleve.regimeFinancier);
  if ((eleve.remisePct ?? 0) > 0) row('Remise accordée', `${eleve.remisePct} %`);
  const opts = [eleve.cantine && 'Cantine', eleve.transportBus && 'Transport scolaire'].filter(Boolean).join(', ');
  if (opts) row('Options souscrites', opts);
  y += 4;

  // Parent 1
  const p1 = eleve.parent1;
  if (p1?.nom || p1?.telephone) {
    sectionHeader('PARENT / TUTEUR PRINCIPAL', 16, 185, 129);
    row('Nom complet', [p1.prenom, p1.nom].filter(Boolean).join(' '));
    row('Lien avec l\'enfant', LIEN[p1.lien || ''] || p1.lien);
    row('Téléphone portable', p1.telephone);
    row('WhatsApp', p1.whatsapp !== p1.telephone ? p1.whatsapp : null);
    row('Email', p1.email);
    row('Tél. domicile', p1.telDomicile);
    row('Tél. travail', p1.telTravail);
    row('Adresse', p1.adresse);
    y += 4;
  }

  // Parent 2
  const p2 = eleve.parent2;
  if (p2?.nom || p2?.telephone) {
    sectionHeader('SECOND PARENT / CONJOINT(E)', 245, 158, 11);
    row('Nom complet', [p2.prenom, p2.nom].filter(Boolean).join(' '));
    row('Lien', LIEN[p2.lien || ''] || p2.lien);
    row('Téléphone', p2.telephone);
    row('Tél. domicile', p2.telDomicile);
    row('Tél. travail', p2.telTravail);
    y += 4;
  }

  // Contact urgence
  const urg = eleve.contactUrgence;
  if (urg?.nom) {
    sectionHeader('CONTACT D\'URGENCE', 239, 68, 68);
    row('Nom complet', urg.nom);
    row('Téléphone', urg.telephone);
    row('Lien avec l\'enfant', urg.lien);
    y += 4;
  }

  // Fiche sanitaire
  const fs = eleve.ficheSanitaire;
  if (fs) {
    sectionHeader('FICHE SANITAIRE', 236, 72, 153);
    const vacc: string[] = [];
    if (fs.vaccDiphterie)  vacc.push('Diphtérie');
    if (fs.vaccPolio)      vacc.push('Polio');
    if (fs.vaccCoqueluche) vacc.push('Coqueluche');
    if (fs.vaccBCG)        vacc.push('BCG');
    if (fs.vaccHepB)       vacc.push('Hépatite B');
    if (fs.vaccROR)        vacc.push('ROR');
    if (vacc.length) row('Vaccins confirmés', vacc.join(', '));

    if (fs.traitementMedical) row('Traitement médical', fs.traitementDetail || 'En cours (voir ordonnance jointe)');

    const aller: string[] = [];
    if (fs.allergieAsthme)      aller.push('Asthme');
    if (fs.allergieMedicament)  aller.push('Médicamenteuse');
    if (fs.allergieAlimentaire) aller.push('Alimentaire');
    if (fs.allergieAutres)      aller.push(fs.allergieAutres);
    if (aller.length) row('Allergies', aller.join(', '));
    if (fs.allergieConduite) row('Conduite en cas de crise', fs.allergieConduite);

    if (fs.medecinNom) row('Médecin traitant', `${fs.medecinNom}${fs.medecinTel ? '  —  ' + fs.medecinTel : ''}`);
    if (fs.difficulteSante) row('Antécédents de santé', fs.difficulteSante);

    const auths: string[] = [];
    if (fs.autorisationSoins) auths.push('Soins d\'urgence autorisés');
    if (fs.autorisationPhoto) auths.push('Prise de photos autorisée');
    if (auths.length) row('Autorisations parentales', auths.join(' · '));
    y += 4;
  }

  drawFooter(doc, ecole, `FICHE-${eleve.id.slice(0, 8).toUpperCase()}`);
  doc.save(`fiche_renseignements_${eleve.prenom}_${eleve.nom}.pdf`);
}

// ─── Reçu de paiement ─────────────────────────────────────────────────────────

export async function generateRecu(echeance: EcheanceForPdf, ecole: Ecole): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const logo = ecole.logoUrl ? await loadImageBase64(ecole.logoUrl) : null;
  drawHeader(doc, ecole, logo);

  let y = 52;
  const ref = `REC-${echeance.id.slice(0, 8).toUpperCase()}`;
  const datePmt = fmtDate(echeance.datePaiement || new Date().toISOString());

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('REÇU DE PAIEMENT', W / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Référence : ${ref}  •  Date : ${datePmt}`, W / 2, y, { align: 'center' });
  y += 12;

  divider(doc, y);
  y += 12;

  // Bénéficiaire
  if (echeance.eleve) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('BÉNÉFICIAIRE', 20, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(`${echeance.eleve.prenom} ${echeance.eleve.nom}`, 20, y);
    y += 14;
  }

  // Tableau montant
  const tableY = y;
  doc.setFillColor(248, 250, 252);
  doc.rect(18, tableY, W - 36, 40, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.rect(18, tableY, W - 36, 40, 'D');

  // En-tête tableau
  doc.setFillColor(226, 232, 240);
  doc.rect(18, tableY, W - 36, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DÉSIGNATION', 24, tableY + 6);
  doc.text('MONTANT', W - 24, tableY + 6, { align: 'right' });

  // Ligne service
  const serviceName = echeance.service?.name || echeance.periodeLabel || echeance.mois || 'Service';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(serviceName, 24, tableY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${Number(echeance.montant).toLocaleString('fr-FR')} FCFA`, W - 24, tableY + 20, { align: 'right' });

  // Ligne total
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(18, tableY + 26, W - 18, tableY + 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105);
  doc.text('TOTAL RÉGLÉ', 24, tableY + 35);
  doc.setFontSize(13);
  doc.text(`${Number(echeance.montant).toLocaleString('fr-FR')} FCFA`, W - 24, tableY + 35, { align: 'right' });
  y += 50;

  // Badge PAYÉ
  doc.setFillColor(5, 150, 105);
  doc.rect(W / 2 - 28, y, 56, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('✓  PAYÉ', W / 2, y + 8, { align: 'center' });
  y += 22;

  divider(doc, y);
  y += 12;

  // Note légale
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const note = doc.splitTextToSize(
    `Ce reçu constitue un document officiel de paiement émis par ${ecole.name || 'l\'établissement'}. `
    + 'Conservez-le précieusement. En cas de litige, ce document fait foi.',
    W - 40
  );
  doc.text(note, 20, y);

  drawFooter(doc, ecole, ref);
  doc.save(`recu_paiement_${ref}_${(echeance.eleve?.nom || 'eleve').replace(/\s/g, '_')}.pdf`);
}
