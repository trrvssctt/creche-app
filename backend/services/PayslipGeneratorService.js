import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PayslipGeneratorService {

  // ─── PUBLIC ENTRY POINT ────────────────────────────────────────────────────

  static async generatePayslipFile(employee, contract, tenantInfo, salaryCalculation, month, year, format = 'png') {
    try {
      
      // Clean names for file system compatibility
      const cleanName = (str) => str.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_');
      
      const firstName = cleanName(employee.firstName || 'Employee');
      const lastName = cleanName(employee.lastName || 'Unknown');
      const departmentName = cleanName(employee.departmentInfo?.name || 'NoDepart');
      const monthPadded = String(month).padStart(2, '0');
      
      // Ensure we have the right file extension
      let fileExtension;
      switch (format.toLowerCase()) {
        case 'pdf':
          fileExtension = 'pdf';
          break;
        case 'png':
        case 'image':
          fileExtension = 'png';
          break;
        case 'html':
          fileExtension = 'html';
          break;
        default:
          fileExtension = 'png'; // Default fallback
          format = 'png';
      }
      
      const fileName = `${firstName}-${lastName}-${departmentName}-${monthPadded}.${fileExtension}`;
      const folderPath     = path.join(process.cwd(), 'uploads', 'fiches_paiement', `${year}-${monthPadded}`);
      const filePath       = path.join(folderPath, fileName);

      // Create directory
      await fs.mkdir(folderPath, { recursive: true });

      // Generate HTML content
      const html = this.generatePayslipHTML(employee, contract, tenantInfo, salaryCalculation, month, year);

      // Handle HTML format (no conversion needed)
      if (format === 'html') {
        await fs.writeFile(filePath, html, 'utf8');
        return { 
          success: true, 
          fileName, 
          folderPath, 
          fullPath: filePath, 
          relativePath: `uploads/fiches_paiement/${year}-${monthPadded}/${fileName}`,
          format: 'html'
        };
      }

      // Handle PDF and PNG formats (require Puppeteer)
      try {
        await this.renderWithPuppeteer(html, filePath, format);
        
        // Verify file was created and has content
        try {
          const stats = await fs.stat(filePath);
          if (stats.size === 0) {
            throw new Error('Generated file is empty');
          }
        } catch (accessError) {
          throw new Error(`Generated file verification failed: ${accessError.message}`);
        }
        
        return {
          success: true,
          fileName,
          folderPath,
          fullPath: filePath,
          relativePath: `uploads/fiches_paiement/${year}-${monthPadded}/${fileName}`,
          format: format
        };
      } catch (puppeteerError) {
        console.error(`Puppeteer failed for ${format}:`, puppeteerError);
        
        // For debugging: log more details about the error
        if (puppeteerError.message.includes('waitForTimeout')) {
          console.error('Puppeteer version compatibility issue detected');
        }
        
        // Don't fall back to HTML - throw the error so caller knows PDF/PNG failed
        throw new Error(`Cannot generate ${format.toUpperCase()} format: ${puppeteerError.message}. This may be due to Puppeteer compatibility issues.`);
      }
      
    } catch (error) {
      console.error('Error generating payslip file:', error);
      throw new Error(`Failed to generate payslip: ${error.message}`);
    }
  }

  // ─── PUPPETEER RENDERER ────────────────────────────────────────────────────

  static async renderWithPuppeteer(htmlContent, outputPath, format = 'png') {
    let browser;
    try {
      
      // Dynamic import with better error handling
      let puppeteer;
      try {
        puppeteer = (await import('puppeteer')).default;
      } catch (importError) {
        console.error('Puppeteer not available:', importError.message);
        throw new Error('Puppeteer is required for PDF/PNG generation. Please install it with: npm install puppeteer');
      }

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();

      // Set A4 dimensions for proper layout (210mm x 297mm = 794px x 1123px at 96 DPI)
      await page.setViewport({ 
        width: 794, 
        height: 1123, 
        deviceScaleFactor: 2 
      });

      // Set content and wait for everything to load
      await page.setContent(htmlContent, { 
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30000
      });

      // Wait for fonts and images to load
      await page.evaluate(() => {
        return Promise.all([
          document.fonts.ready,
          ...Array.from(document.images, img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', resolve);
            });
          })
        ]);
      });

      // Give a small delay for final rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (format === 'pdf') {
        await page.pdf({
          path: outputPath,
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { 
            top: '0mm', 
            right: '0mm', 
            bottom: '0mm', 
            left: '0mm' 
          },
        });
      } else {
        // PNG/JPG generation
        const element = await page.$('#payslip-render');
        if (element) {
          await element.screenshot({ 
            path: outputPath, 
            type: 'png',
            omitBackground: false
          });
        } else {
          // Fallback to full page screenshot
          await page.screenshot({ 
            path: outputPath, 
            type: 'png', 
            fullPage: true,
            omitBackground: false 
          });
        }
      }
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
      throw new Error(`Failed to generate ${format}: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  // ─── HTML TEMPLATE (matches PayslipPreview.tsx exactly) ────────────────

  static generatePayslipHTML(employee, contract, tenantInfo, salary, month, year) {
    const monthPadded = String(month).padStart(2, '0');
    const monthName   = new Date(`${year}-${monthPadded}-01`)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const currency = salary.currency || tenantInfo?.currency || 'F CFA';
    const fmt = (n) => (parseFloat(n) || 0).toLocaleString('fr-FR');

    // Employer brand
    const companyName = tenantInfo?.name || tenantInfo?.companyName || 'ENTREPRISE';
    const address     = tenantInfo?.address || '—';
    const phone       = tenantInfo?.phone   || '—';
    const email       = tenantInfo?.email   || '—';
    const logoUrl     = tenantInfo?.logoUrl || null;
    const cachetUrl   = tenantInfo?.cachetUrl || null;
    const footer      = tenantInfo?.invoiceFooter || 'Paiement selon conditions générales en vigueur au Sénégal.';
    const siret       = tenantInfo?.siret || null;

    // Employee data
    const fullName      = `${employee.firstName} ${employee.lastName}`;
    const position      = employee.position    || 'N/A';
    const department    = employee.departmentInfo?.name || 'N/A';
    const hireDate      = employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'N/A';
    const contractType  = contract?.type || employee.contractType || 'N/A';
    const country       = employee.country || 'Sénégal';
    const matricule     = employee.matricule   || 'N/A';
    const photoUrl      = employee.photoUrl    || null;
    const employeeId    = (employee.id || '').toString().toUpperCase();

    // Salary figures
    const baseSalary              = fmt(salary.baseSalary);
    const totalPrimes             = fmt(salary.totalPrimes);
    const grossSalary             = fmt(salary.grossSalary);
    const socialChargesEmployee   = fmt(salary.socialChargesEmployee);
    const totalAdvanceDeductions  = fmt(salary.totalAdvanceDeductions);
    const socialChargesEmployer   = fmt(salary.socialChargesEmployer);
    const incomeTaxAmt            = parseFloat(salary.incomeTax) || 0;
    const incomeTax               = fmt(incomeTaxAmt);
    const hrRulesDeductionAmt     = parseFloat(salary.ruleDeductions) || 0;
    const hrRulesDeduction        = fmt(hrRulesDeductionAmt);
    const netSalary               = fmt(salary.netSalary);
    // Total retenues = cotisations + impôt + avances + déductions RH (aligné avec calculateEmployeeSalary)
    const totalDeductionsAmt = (parseFloat(salary.socialChargesEmployee) || 0)
      + incomeTaxAmt
      + (parseFloat(salary.totalAdvanceDeductions) || 0)
      + hrRulesDeductionAmt;
    const totalDeductions         = fmt(totalDeductionsAmt);
    const hasPrimes               = (parseFloat(salary.totalPrimes) || 0) > 0;
    const hasAdvances             = (parseFloat(salary.totalAdvanceDeductions) || 0) > 0;
    const hasHrDeductions         = hrRulesDeductionAmt > 0;
    // Taux affichés
    const socialRateDisplay = salary.empSocialRate != null ? `${parseFloat(salary.empSocialRate).toFixed(1)}%` : '8.2%';
    const taxRateDisplay    = salary.taxRate        != null ? `${parseFloat(salary.taxRate).toFixed(1)}%`    : '10.0%';

    const today = new Date().toLocaleDateString('fr-FR');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Bulletin de Paie – ${fullName}</title>
<style>
  *, *::before, *::after { 
    box-sizing: border-box; 
    margin: 0; 
    padding: 0; 
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: white;
    padding: 48px;
    color: #1e293b;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #payslip-render {
    background: white;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 48px;
    color: #1e293b;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
    border: 1px solid #f1f5f9;
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 40px;
    margin-bottom: 48px;
  }

  .company-logo {
    height: 80px;
    width: auto;
    object-fit: contain;
    margin-bottom: 16px;
    max-width: 220px;
  }

  .company-name {
    font-size: 30px;
    font-weight: 900;
    color: #4f46e5;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: -0.05em;
  }

  .company-details {
    margin-top: 16px;
  }

  .detail-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 4px;
  }

  .icon-pin, .icon-phone, .icon-mail {
    width: 10px;
    height: 10px;
    color: #4f46e5;
  }

  .title-section {
    text-align: right;
  }

  .doc-title {
    font-size: 32px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.05em;
    margin-bottom: 8px;
  }

  .period-badge {
    display: inline-block;
    font-family: monospace;
    font-weight: 700;
    font-size: 14px;
    color: #4f46e5;
    background: #eef2ff;
    padding: 8px 12px;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,.1);
    text-transform: capitalize;
  }

  .generation-date {
    font-size: 10px;
    font-weight: 900;
    color: #64748b;
    margin-top: 16px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  /* ── EMPLOYEE SECTION ── */
  .employee-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 48px;
  }

  .employee-card {
    padding: 32px;
    background: #f8fafc;
    border-radius: 24px;
    border: 1px solid #e2e8f0;
    box-shadow: inset 0 2px 4px rgba(0,0,0,.04);
  }

  .card-title {
    font-size: 10px;
    font-weight: 900;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin-bottom: 12px;
  }

  .employee-photo {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    object-fit: cover;
    margin-bottom: 16px;
    border: 2px solid white;
    box-shadow: 0 4px 6px rgba(0,0,0,.1);
  }

  .employee-name {
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .info-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 900;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  .info-value {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
  }

  .status-section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    gap: 16px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #059669;
    background: #ecfdf5;
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    border: 1px solid #a7f3d0;
  }

  .legal-note {
    font-size: 9px;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    line-height: 1.6;
    text-align: right;
  }

  .legal-highlight {
    color: #0f172a;
    font-weight: 900;
    font-style: italic;
  }

  /* ── TABLE ── */
  .salary-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-bottom: 48px;
  }

  .salary-table thead tr {
    background: #0f172a;
    color: white;
  }

  .salary-table th {
    padding: 20px;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  .salary-table th:first-child {
    border-radius: 16px 0 0 0;
  }

  .salary-table th:last-child {
    border-radius: 0 16px 0 0;
    text-align: right;
  }

  .salary-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
  }

  .salary-table tbody tr:hover {
    background: rgba(248, 250, 252, 0.5);
  }

  .salary-table td {
    padding: 20px;
    font-size: 14px;
    font-weight: 700;
  }

  .rubrique-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot-green { background: #10b981; }
  .dot-red { background: #f43f5e; }
  .dot-gray { background: #94a3b8; }

  .nature-badge {
    display: inline-block;
    font-size: 8px;
    font-family: monospace;
    font-weight: 900;
    padding: 4px 8px;
    border-radius: 6px;
    text-transform: uppercase;
  }

  .badge-gain {
    background: #ecfdf5;
    color: #065f46;
  }

  .badge-retenue {
    background: #fff1f2;
    color: #9f1239;
  }

  .badge-info {
    background: #f1f5f9;
    color: #64748b;
  }

  .amount-cell {
    text-align: right;
    font-weight: 900;
  }

  .amount-green { color: #059669; }
  .amount-red { color: #e11d48; }
  .amount-gray { color: #94a3b8; }

  .gross-row {
    background: #f8fafc;
  }

  .gross-row td {
    font-weight: 900;
  }

  .info-row-table {
    opacity: 0.6;
  }

  /* ── TOTALS ── */
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 48px;
  }

  .totals-box {
    width: 320px;
  }

  .summary-lines {
    padding: 0 24px;
    margin-bottom: 16px;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin-bottom: 8px;
  }

  .summary-gray { color: #64748b; }
  .summary-red { color: #e11d48; }
  .summary-green { color: #059669; }

  .net-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    background: #0f172a;
    color: white;
    border-radius: 32px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,.2);
  }

  .net-label {
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  .net-amount {
    font-size: 24px;
    font-weight: 900;
  }

  .net-currency {
    font-size: 12px;
  }

  /* ── FOOTER ── */
  .footer-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #e2e8f0;
    margin-top: 96px;
    padding-top: 48px;
  }

  .system-info {
    font-size: 8px;
    color: #e2e8f0;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-style: italic;
    line-height: 1.8;
  }

  .signature-section {
    text-align: center;
    width: 256px;
  }

  .signature-title {
    font-size: 10px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    text-decoration: underline;
    text-decoration-color: #4f46e5;
    text-underline-offset: 8px;
    text-decoration-thickness: 2px;
    margin-bottom: 16px;
  }

  .signature-box {
    height: 128px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cachet-image {
    height: 128px;
    width: auto;
    object-fit: contain;
    mix-blend-mode: multiply;
    transition: transform 0.3s ease;
  }

  .cachet-image:hover {
    transform: scale(1.1);
  }

  .paid-stamp {
    border: 4px solid rgba(16, 185, 129, 0.3);
    color: #10b981;
    border-radius: 50%;
    padding: 8px 24px;
    transform: rotate(12deg);
    font-weight: 900;
    text-transform: uppercase;
    font-size: 20px;
  }

  @media print {
    body { padding: 20px; }
    #payslip-render { box-shadow: none; border: none; }
    .cachet-image:hover { transform: none; }
  }
</style>
</head>
<body>
<div id="payslip-render">

  <!-- ── HEADER ─────────────────────────────────────────────────────── -->
  <div class="header">
    <div>
      ${logoUrl ? 
        `<img src="${logoUrl}" class="company-logo" alt="Logo" />` :
        `<div class="company-name">${companyName}</div>`
      }
      <div class="company-details">
        <div class="detail-line">
          <svg class="icon-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${address}</span>
        </div>
        <div class="detail-line">
          <svg class="icon-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>${phone}</span>
        </div>
        <div class="detail-line">
          <svg class="icon-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>${email}</span>
        </div>
      </div>
    </div>
    <div class="title-section">
      <h1 class="doc-title">BULLETIN DE PAIE</h1>
      <div class="period-badge">${monthName}</div>
      <div class="generation-date">Généré le : ${today}</div>
      ${siret ? `<div class="generation-date" style="margin-top:4px;">SIRET : ${siret}</div>` : ''}
    </div>
  </div>

  <!-- ── EMPLOYÉ + STATUT ──────────────────────────────────────────── -->
  <div class="employee-section">
    <div class="employee-card">
      <div class="card-title">Salarié</div>
      ${photoUrl ? `<img src="${photoUrl}" alt="${fullName}" class="employee-photo" />` : ''}
      <div class="employee-name">${fullName}</div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Matricule
        </div>
        <div class="info-value">${matricule}</div>
      </div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          Poste
        </div>
        <div class="info-value">${position}</div>
      </div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21h18"></path>
            <path d="M5 21V7l8-4v18"></path>
            <path d="M19 21V11l-6-4"></path>
          </svg>
          Département
        </div>
        <div class="info-value">${department}</div>
      </div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Date d'embauche
        </div>
        <div class="info-value">${hireDate}</div>
      </div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          Type de contrat
        </div>
        <div class="info-value">${contractType}</div>
      </div>
      
      <div class="info-row">
        <div class="info-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2C17.5 6.67 17.5 17.33 12 22"></path>
            <path d="M12 2C6.5 6.67 6.5 17.33 12 22"></path>
          </svg>
          Pays
        </div>
        <div class="info-value">${country}</div>
      </div>
    </div>

    <div class="status-section">
      <div class="status-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22,4 12,14.01 9,11.01"></polyline>
        </svg>
        <span>SOLDE ENCAISSÉ</span>
      </div>
      <div class="legal-note">
        Mention légale :<br/>
        <span class="legal-highlight">${footer}</span>
      </div>
    </div>
  </div>

  <!-- ── TABLEAU DES RUBRIQUES ─────────────────────────────────────── -->
  <table class="salary-table">
    <thead>
      <tr>
        <th>Rubrique</th>
        <th>Nature</th>
        <th>Montant (${currency})</th>
      </tr>
    </thead>
    <tbody>
      <!-- Salaire de base -->
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-green"></span>
            <span>SALAIRE DE BASE</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-gain">Gain</span>
        </td>
        <td class="amount-cell">${baseSalary}</td>
      </tr>

      <!-- Primes -->
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-green"></span>
            <span>PRIMES DU MOIS</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-gain">Gain</span>
        </td>
        <td class="amount-cell amount-green">+${totalPrimes}</td>
      </tr>

      <!-- Salaire brut -->
      <tr class="gross-row">
        <td>SALAIRE BRUT</td>
        <td></td>
        <td class="amount-cell">${grossSalary}</td>
      </tr>

      <!-- Charges sociales salarié -->
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-red"></span>
            <span>CHARGES SOCIALES SALARIÉ (${socialRateDisplay})</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-retenue">Retenue</span>
        </td>
        <td class="amount-cell amount-red">-${socialChargesEmployee}</td>
      </tr>

      <!-- Impôt sur le revenu -->
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-red"></span>
            <span>IMPÔT SUR LE REVENU (${taxRateDisplay})</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-retenue">Retenue</span>
        </td>
        <td class="amount-cell amount-red">-${incomeTax}</td>
      </tr>

      <!-- Avances déduites (si présentes) -->
      ${hasAdvances ? `
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-red"></span>
            <span>AVANCES DÉDUITES</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-retenue">Retenue</span>
        </td>
        <td class="amount-cell amount-red">-${totalAdvanceDeductions}</td>
      </tr>` : ''}

      <!-- Déductions règles RH (si présentes) -->
      ${hasHrDeductions ? `
      <tr>
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-red"></span>
            <span>DÉDUCTIONS RÈGLES RH (retards/absences)</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-retenue">Retenue</span>
        </td>
        <td class="amount-cell amount-red">-${hrRulesDeduction}</td>
      </tr>` : ''}

      <!-- Charges patronales (info) -->
      <tr class="info-row-table">
        <td>
          <div class="rubrique-cell">
            <span class="dot dot-gray"></span>
            <span>CHARGES PATRONALES (INFO)</span>
          </div>
        </td>
        <td>
          <span class="nature-badge badge-info">Info</span>
        </td>
        <td class="amount-cell amount-gray">${socialChargesEmployer}</td>
      </tr>
    </tbody>
  </table>

  <!-- ── TOTAUX ─────────────────────────────────────────────────────── -->
  <div class="totals-section">
    <div class="totals-box">
      <div class="summary-lines">
        <div class="summary-line summary-gray">
          <span>Salaire brut</span>
          <span>${grossSalary} ${currency}</span>
        </div>
        <div class="summary-line summary-red">
          <span>Total retenues</span>
          <span>-${totalDeductions} ${currency}</span>
        </div>
        ${hasPrimes ? `
        <div class="summary-line summary-green">
          <span>Total primes</span>
          <span>+${totalPrimes} ${currency}</span>
        </div>` : ''}
      </div>
      <div class="net-total">
        <span class="net-label">NET À PAYER</span>
        <span class="net-amount">${netSalary} <span class="net-currency">${currency}</span></span>
      </div>
    </div>
  </div>

  <!-- ── FOOTER / SIGNATURES ───────────────────────────────────────── -->
  <div class="footer-section">
    <div class="system-info">
      <div>${companyName} • Système de Paie GeStockPro</div>
      <div>Généré automatiquement par le moteur de paie GeStockPro.</div>
      <div style="margin-top:16px;">EMPLOYÉ ID : ${employeeId}</div>
    </div>
    <div class="signature-section">
      <div class="signature-title">VISA &amp; CACHET</div>
      <div class="signature-box">
        ${cachetUrl ? 
          `<img src="${cachetUrl}" class="cachet-image" alt="Tampon Officiel" />` :
          `<div class="paid-stamp">PAYÉ</div>`
        }
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
  }

  // ─── TENANT HELPER (keep for backward compat) ──────────────────────────────

  static async getTenantInfo(tenantId) {
    try {
      return {
        companyName: 'GeStockPro Enterprise',
        address: 'Dakar, Sénégal',
        phone: '+221 XX XXX XX XX',
        email: 'contact@gestockpro.com',
        tenantId,
      };
    } catch (error) {
      return { companyName: 'GeStockPro', address: '—', phone: '—', email: '—' };
    }
  }
}

export default PayslipGeneratorService;