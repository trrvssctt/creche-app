import { Employee, Contract, Tenant, Department, Advance, Prime, PayrollSettings, HRRule, Attendance, Leave } from '../models/index.js';
import { Op } from 'sequelize';
import { PayslipGeneratorService } from '../services/PayslipGeneratorService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import nodeHtmlToImage from 'node-html-to-image';
import { promises as fsPromises } from 'fs';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PayslipController {
  /**
   * Generate payslip images for all employees with active contracts organized in folders
   */
  static async generateBulkPayslips(req, res) {
    try {
      const { month } = req.body;
      const tenantId = req.user.tenantId;

      if (!month) {
        return res.status(400).json({ error: 'Le mois est requis (format YYYY-MM)' });
      }

      // Récupérer les informations du tenant (entreprise)
      const tenant = await Tenant.findOne({
        where: { id: tenantId }
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Informations de l\'entreprise non trouvées' });
      }

      // Créer le dossier de destination
      const [year, monthNum] = month.split('-');
      const folderName = `fiches_paiement_${year}-${monthNum.padStart(2, '0')}`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const payslipFolder = path.join(uploadsDir, folderName);

      // S'assurer que le dossier uploads existe
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // ── RÈGLE : une seule génération par mois ──────────────────────────────
      const manifestPath = path.join(uploadsDir, `manifest_${tenantId}_${month}.json`);
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return res.status(409).json({
          error: `Les fiches de paie pour ${month} ont déjà été générées le ${new Date(manifest.generatedAt).toLocaleDateString('fr-FR')}.`,
          generatedAt: manifest.generatedAt,
          count: manifest.count
        });
      }
      // ──────────────────────────────────────────────────────────────────────

      // S'assurer que le dossier des fiches de paie existe
      if (!fs.existsSync(payslipFolder)) {
        fs.mkdirSync(payslipFolder, { recursive: true });
      }

      // Paramètres de paie depuis PayrollSettings (taux réels configurés)
      const [settings, hrRules] = await Promise.all([
        PayrollSettings.findOne({ where: { tenantId } }),
        HRRule.findAll({ where: { tenantId, isActive: true }, order: [['sort_order', 'ASC']] })
      ]);

      const empSocialRate = parseFloat(settings?.employeeSocialChargeRate ?? 8.2) / 100;
      const taxRate = parseFloat(settings?.taxRate ?? 10.0) / 100;
      const workingDaysMonth = parseInt(settings?.workingDaysPerMonth ?? 26);
      const deductionEnabled = settings?.deductionEnabled ?? false;
      const currency = settings?.currency || tenant.currency || 'F CFA';

      const startH = parseInt((settings?.workStartTime || '08:00').split(':')[0]);
      const endH = parseInt((settings?.workEndTime || '17:00').split(':')[0]);
      const dailyWorkHours = Math.max(1, endH - startH);

      // Récupérer tous les employés actifs avec leur contrat actif
      const employeesWithContracts = await Employee.findAll({
        where: {
          tenantId: tenantId,
          status: 'ACTIVE'
        },
        include: [{
          model: Contract,
          as: 'contracts',
          where: {
            tenantId: tenantId,
            status: 'ACTIVE'
          },
          required: true, // INNER JOIN pour ne récupérer que les employés avec contrat actif
          order: [['startDate', 'DESC']] // Prendre le contrat le plus récent
        },
        {
          model: Department,
          as: 'departmentInfo',
          required: false
        }]
      });

      if (employeesWithContracts.length === 0) {
        return res.status(404).json({ error: 'Aucun employé avec contrat actif trouvé' });
      }

      // Primes et avances approuvées pour ce tenant
      const [allPrimes, allAdvances] = await Promise.all([
        Prime.findAll({ where: { tenantId, status: 'APPROVED' } }),
        Advance.findAll({ where: { tenantId, status: 'APPROVED' } })
      ]);

      const results = {
        success: [],
        errors: [],
        summary: {
          totalProcessed: 0,
          successCount: 0,
          errorCount: 0
        }
      };

      // Générer les fiches de paie pour chaque employé
      for (const employee of employeesWithContracts) {
        try {
          results.summary.totalProcessed++;

          // Prendre le contrat le plus récent s'il y en a plusieurs actifs
          const contract = employee.contracts[0];

          // VÉRIFICATION : Date d'embauche vs Mois de génération
          if (employee.hireDate) {
            const hDate = new Date(employee.hireDate);
            const hMonthStart = new Date(hDate.getFullYear(), hDate.getMonth(), 1);
            const targetMonthStart = new Date(month + '-01');

            if (targetMonthStart < hMonthStart) {
              results.errors.push({
                employeeId: employee.id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                error: `Antérieur à l'embauche (${hDate.toLocaleDateString('fr-FR')})`
              });
              results.summary.errorCount++;
              continue;
            }
          }

          // Calculer le salaire avec les vrais taux PayrollSettings
          const baseSalary = parseFloat(contract.salary) || 0;

          if (baseSalary === 0) {
            results.errors.push({
              employeeId: employee.id,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              error: 'Salaire non défini dans le contrat'
            });
            results.summary.errorCount++;
            continue;
          }

          // Primes et avances de cet employé
          const empPrimes = allPrimes.filter(p => p.employeeId === employee.id);
          const empAdvances = allAdvances.filter(a => a.employeeId === employee.id);

          const totalPrimes = empPrimes.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
          const totalAdvanceDeductions = empAdvances.reduce((s, a) => {
            const monthly = parseFloat(a.monthlyDeduction || 0) > 0
              ? parseFloat(a.monthlyDeduction)
              : parseFloat(a.amount || 0) / Math.max(1, parseInt(a.months) || 1);
            return s + monthly;
          }, 0);

          const grossSalary = baseSalary + totalPrimes;

          // Cotisations sociales et impôt selon PayrollSettings
          const socialContributions = Math.round(grossSalary * empSocialRate);
          const taxableBase = Math.max(0, grossSalary - socialContributions);
          const incomeTax = Math.round(taxableBase * taxRate);

          // Déductions règles RH si activé
          let hrRulesDeduction = 0;
          if (deductionEnabled && hrRules.length > 0) {
            const dailyRate = workingDaysMonth > 0 ? baseSalary / workingDaysMonth : 0;
            const hourlyRate = dailyWorkHours > 0 ? dailyRate / dailyWorkHours : 0;

            // Plage du mois
            const monthStart = new Date(`${year}-${monthNum.padStart(2, '0')}-01`);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(monthEnd.getDate() - 1);

            // Pointages et congés approuvés de l'employé ce mois
            const [empAttendances, approvedLeaves] = await Promise.all([
              Attendance.findAll({
                where: { employeeId: employee.id, tenantId, date: { [Op.between]: [monthStart, monthEnd] } }
              }),
              Leave.findAll({
                where: {
                  employeeId: employee.id, tenantId, status: 'APPROVED',
                  startDate: { [Op.lte]: monthEnd }, endDate: { [Op.gte]: monthStart }
                }
              })
            ]);

            // Jours en retard : toute durée > 0 min = 1 heure entière perdue
            const lateDays = empAttendances.filter(a => (a.meta?.lateMinutes || 0) > 0).length;
            const totalLateMinutes = lateDays * 60;

            // Absences injustifiées
            const attendanceDates = new Set(empAttendances.map(a => String(a.date).substring(0, 10)));
            const leaveDates = new Set();
            for (const lv of approvedLeaves) {
              let d = new Date(lv.startDate);
              const end = new Date(lv.endDate);
              while (d <= end) { leaveDates.add(d.toISOString().substring(0, 10)); d.setDate(d.getDate() + 1); }
            }
            let unapprovedAbsences = 0;
            let cur = new Date(monthStart);
            while (cur <= monthEnd) {
              const dow = cur.getDay();
              if (dow !== 0 && dow !== 6) {
                const ds = cur.toISOString().substring(0, 10);
                if (!attendanceDates.has(ds) && !leaveDates.has(ds)) unapprovedAbsences++;
              }
              cur.setDate(cur.getDate() + 1);
            }

            const _cmpOp = (a, op, b) => ({ GT: a > b, GTE: a >= b, LT: a < b, LTE: a <= b, EQ: a === b }[op] ?? false);

            for (const rule of hrRules) {
              const av = parseFloat(rule.actionValue || 0);
              const condVal = parseFloat(rule.conditionValue || 0);
              const op = rule.conditionOperator || 'GT';

              if (rule.type === 'LATE') {
                const compareVal = rule.conditionUnit === 'HOURS' ? lateDays : totalLateMinutes;
                if (!_cmpOp(compareVal, op, condVal)) continue;
                if (rule.actionType === 'DEDUCT_FIXED') hrRulesDeduction += av * lateDays;
                else if (rule.actionType === 'DEDUCT_SALARY_HOURS') hrRulesDeduction += av * hourlyRate * lateDays;
                else if (rule.actionType === 'DEDUCT_SALARY_DAYS') hrRulesDeduction += av * dailyRate * lateDays;
                else if (rule.actionType === 'DEDUCT_PERCENT') hrRulesDeduction += baseSalary * (av / 100) * lateDays;

              } else if (rule.type === 'ABSENCE' || rule.type === 'UNPAID_LEAVE') {
                if (!_cmpOp(unapprovedAbsences, op, condVal)) continue;
                if (rule.actionType === 'DEDUCT_FIXED') hrRulesDeduction += av * unapprovedAbsences;
                else if (rule.actionType === 'DEDUCT_SALARY_HOURS') hrRulesDeduction += av * hourlyRate * unapprovedAbsences;
                else if (rule.actionType === 'DEDUCT_SALARY_DAYS') hrRulesDeduction += av * dailyRate * unapprovedAbsences;
                else if (rule.actionType === 'DEDUCT_PERCENT') hrRulesDeduction += baseSalary * (av / 100) * unapprovedAbsences;
              }
            }
            hrRulesDeduction = Math.round(hrRulesDeduction);
          }

          const totalDeductions = socialContributions + incomeTax + Math.round(totalAdvanceDeductions) + hrRulesDeduction;
          const netSalary = Math.max(0, grossSalary - totalDeductions);

          // Générer le HTML de la fiche de paie (même template que downloadAllAsZip)
          const htmlContent = PayslipController.generateZipPayslipHTML({
            employee,
            contract,
            tenant,
            month,
            empPrimes,
            empAdvances,
            calculations: {
              baseSalary,
              totalPrimes,
              grossSalary,
              socialContributions,
              incomeTax,
              totalAdvanceDeductions: Math.round(totalAdvanceDeductions),
              hrRulesDeduction,
              totalDeductions,
              netSalary,
              currency,
              empSocialRate,
              taxRate,
              workingDaysMonth
            }
          });

          // Générer le nom du fichier avec nom et poste
          const sanitizedPosition = (employee.position || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${employee.firstName}_${employee.lastName}_${sanitizedPosition}.png`;
          const filePath = path.join(payslipFolder, filename);

          // Générer l'image PNG à partir du HTML
          await nodeHtmlToImage({
            output: filePath,
            html: htmlContent,
            quality: 100,
            type: 'png',
            puppeteerArgs: {
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
          });

          results.success.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            position: employee.position || 'N/A',
            filename: filename,
            filePath: filePath,
            netSalary: netSalary,
            grossSalary: grossSalary
          });

          results.summary.successCount++;

        } catch (error) {
          console.error(`Erreur pour employé ${employee.firstName} ${employee.lastName}:`, error);
          results.errors.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            error: error.message
          });
          results.summary.errorCount++;
        }
      }

      // Écrire le manifeste de génération (pour la règle une-fois-par-mois)
      if (results.summary.successCount > 0) {
        fs.writeFileSync(manifestPath, JSON.stringify({
          tenantId,
          month,
          generatedAt: new Date().toISOString(),
          count: results.summary.successCount
        }), 'utf8');
      }

      return res.status(200).json({
        message: 'Génération des fiches de paie terminée',
        results: results,
        folderPath: payslipFolder,
        folderName: folderName,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur génération bulk payslips:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Download all payslips for a given month as a ZIP archive.
   * Includes primes (earnings) and advance deductions per employee.
   * GET /hr/payslips/download-all-zip?month=YYYY-MM
   */
  static async downloadAllAsZip(req, res) {
    try {
      const { month } = req.query;
      const tenantId = req.user.tenantId;

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Paramètre month requis (format YYYY-MM)' });
      }

      const tenant = await Tenant.findOne({ where: { id: tenantId } });
      if (!tenant) {
        return res.status(404).json({ error: 'Entreprise non trouvée' });
      }

      // Paramètres de paie et règles RH configurés dans PayrollManagement / rh.time-settings
      const [settings, hrRules] = await Promise.all([
        PayrollSettings.findOne({ where: { tenantId } }),
        HRRule.findAll({ where: { tenantId, isActive: true }, order: [['sort_order', 'ASC']] })
      ]);

      // Taux réels (ou valeurs par défaut si non configurés)
      const empSocialRate = parseFloat(settings?.employeeSocialChargeRate ?? 8.2) / 100;
      const taxRate = parseFloat(settings?.taxRate ?? 10.0) / 100;
      const workingDaysMonth = parseInt(settings?.workingDaysPerMonth ?? 26);
      const deductionEnabled = settings?.deductionEnabled ?? false;
      const currency = settings?.currency || tenant.currency || 'F CFA';

      // Heures de travail journalières (pour DEDUCT_SALARY_HOURS)
      const startH = parseInt((settings?.workStartTime || '08:00').split(':')[0]);
      const endH = parseInt((settings?.workEndTime || '17:00').split(':')[0]);
      const dailyWorkHours = Math.max(1, endH - startH);

      // Employés actifs avec contrat actif
      const employeesWithContracts = await Employee.findAll({
        where: { tenantId, status: 'ACTIVE' },
        include: [
          {
            model: Contract,
            as: 'contracts',
            where: { tenantId, status: 'ACTIVE' },
            required: true,
            order: [['startDate', 'DESC']]
          },
          {
            model: Department,
            as: 'departmentInfo',
            required: false
          }
        ]
      });

      if (employeesWithContracts.length === 0) {
        return res.status(404).json({ error: 'Aucun employé avec contrat actif trouvé' });
      }

      // Primes et avances approuvées pour ce tenant
      const [allAdvances, allPrimes] = await Promise.all([
        Advance.findAll({ where: { tenantId, status: 'APPROVED' } }),
        Prime.findAll({ where: { tenantId, status: 'APPROVED' } })
      ]);

      const zip = new JSZip();
      let generated = 0;
      const htmlPages = []; // accumule { html, employee } avant la conversion PDF

      for (const employee of employeesWithContracts) {
        const contract = employee.contracts[0];
        const baseSalary = parseFloat(contract.salary) || 0;
        if (baseSalary === 0) continue;

        const empPrimes = allPrimes.filter(p => p.employeeId === employee.id);
        const empAdvances = allAdvances.filter(a => a.employeeId === employee.id);

        const totalPrimes = empPrimes.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const totalAdvanceDeductions = empAdvances.reduce((s, a) => {
          const monthly = parseFloat(a.monthlyDeduction || 0) > 0
            ? parseFloat(a.monthlyDeduction)
            : parseFloat(a.amount || 0) / Math.max(1, parseInt(a.months) || 1);
          return s + monthly;
        }, 0);

        const grossSalary = baseSalary + totalPrimes;

        // Cotisations sociales salarié (taux PayrollSettings.employeeSocialChargeRate)
        const socialContributions = Math.round(grossSalary * empSocialRate);

        // Impôt (taux PayrollSettings.taxRate, appliqué sur net social)
        const taxableBase = Math.max(0, grossSalary - socialContributions);
        const incomeTax = Math.round(taxableBase * taxRate);

        // Déductions règles RH (retards / absences) si activé dans rh.time-settings
        let hrRulesDeduction = 0;
        if (deductionEnabled && hrRules.length > 0) {
          const dailyRate = workingDaysMonth > 0 ? baseSalary / workingDaysMonth : 0;
          const hourlyRate = dailyWorkHours > 0 ? dailyRate / dailyWorkHours : 0;
          for (const rule of hrRules) {
            const av = parseFloat(rule.actionValue || 0);
            if (rule.actionType === 'DEDUCT_FIXED') hrRulesDeduction += av;
            else if (rule.actionType === 'DEDUCT_SALARY_HOURS') hrRulesDeduction += av * hourlyRate;
            else if (rule.actionType === 'DEDUCT_SALARY_DAYS') hrRulesDeduction += av * dailyRate;
            else if (rule.actionType === 'DEDUCT_PERCENT') hrRulesDeduction += baseSalary * (av / 100);
          }
          hrRulesDeduction = Math.round(hrRulesDeduction);
        }

        const totalDeductions = socialContributions + incomeTax + Math.round(totalAdvanceDeductions) + hrRulesDeduction;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const html = PayslipController.generateZipPayslipHTML({
          employee,
          contract,
          tenant,
          month,
          empPrimes,
          empAdvances,
          calculations: {
            baseSalary,
            totalPrimes,
            grossSalary,
            socialContributions,
            incomeTax,
            totalAdvanceDeductions: Math.round(totalAdvanceDeductions),
            hrRulesDeduction,
            totalDeductions,
            netSalary,
            currency,
            empSocialRate,
            taxRate,
            workingDaysMonth
          }
        });

        htmlPages.push({ html, employee });
      }

      if (htmlPages.length === 0) {
        return res.status(404).json({ error: 'Aucune fiche générée (vérifiez les salaires dans les contrats)' });
      }

      // Convertir chaque fiche HTML en PDF via Puppeteer
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      try {
        for (const { html, employee } of htmlPages) {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: 'networkidle0' });
          const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
          });
          await page.close();

          const safeName = `${employee.firstName}_${employee.lastName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          zip.file(`${safeName}_${month}.pdf`, pdfBuffer);
          generated++;
        }
      } finally {
        await browser.close();
      }

      if (generated === 0) {
        return res.status(404).json({ error: 'Aucun PDF généré (vérifiez les salaires dans les contrats)' });
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="fiches_paie_${month}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      return res.send(zipBuffer);

    } catch (error) {
      console.error('Erreur downloadAllAsZip:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate payslip HTML for ZIP export — includes primes rows and advance deduction rows.
   */
  static generateZipPayslipHTML({ employee, contract, tenant, month, empPrimes, empAdvances, calculations }) {
    const { baseSalary, totalPrimes, grossSalary, socialContributions, incomeTax,
      totalAdvanceDeductions, hrRulesDeduction = 0, totalDeductions, netSalary, currency,
      empSocialRate = 0.082, taxRate = 0.10, workingDaysMonth = 26 } = calculations;

    const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
    const monthYear = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const contractStartDate = contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A';

    const primesRows = empPrimes.map(p => `
      <tr>
        <td>Prime – ${p.reason || p.type || 'Exceptionnelle'}</td>
        <td class="cat earning">Gain</td>
        <td class="amount">+${fmt(parseFloat(p.amount || 0))} ${currency}</td>
      </tr>`).join('');

    const advancesRows = empAdvances.map(a => {
      const monthly = parseFloat(a.monthlyDeduction || 0) > 0
        ? parseFloat(a.monthlyDeduction)
        : parseFloat(a.amount || 0) / Math.max(1, parseInt(a.months) || 1);
      return `
      <tr>
        <td>Remboursement avance – ${a.reason || 'Avance sur salaire'}</td>
        <td class="cat deduction">Retenue</td>
        <td class="amount deduction">-${fmt(monthly)} ${currency}</td>
      </tr>`;
    }).join('');

    const companyName = tenant.name || tenant.company || 'ENTREPRISE';
    const logoHtml = tenant.logoUrl
      ? `<img src="${tenant.logoUrl}" style="height:48px;width:auto;object-fit:contain;max-width:200px;" alt="Logo"/>`
      : `<div class="logo-box">${companyName.charAt(0).toUpperCase()}</div><span class="company-name">${companyName}</span>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Fiche de Paie – ${employee.firstName} ${employee.lastName} – ${monthYear}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;padding:40px;background:#fff;color:#1e293b;width:210mm;min-height:297mm;line-height:1.5;font-size:13px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:32px;margin-bottom:36px;}
.logo-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.logo-box{width:44px;height:44px;background:#4f46e5;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:18px;}
.company-name{font-size:20px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:1px;}
.company-meta{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;line-height:1.8;}
.title-col{text-align:right;}
.title-col h1{font-size:28px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
.period-badge{display:inline-block;background:#4f46e5;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;}
.ref{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:10px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:36px;}
.info-card{padding:20px 24px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;}
.info-card .label{font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
.info-card .emp-name{font-size:16px;font-weight:900;color:#0f172a;text-transform:uppercase;margin-bottom:6px;}
.info-card .meta{font-size:11px;color:#64748b;font-weight:600;line-height:1.8;}
.status-ok{display:inline-flex;align-items:center;gap:6px;color:#059669;background:#ecfdf5;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:900;text-transform:uppercase;border:1px solid #a7f3d0;margin-top:12px;}
table{width:100%;border-collapse:separate;border-spacing:0;}
thead tr{background:#0f172a;color:#fff;}
th{padding:14px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;}
th:last-child{text-align:right;border-radius:0 12px 0 0;}
th:first-child{border-radius:12px 0 0 0;}
td{padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;}
td.amount{text-align:right;font-weight:900;}
td.cat{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#64748b;}
td.earning{color:#059669;}
td.deduction{color:#dc2626;}
.row-total{background:#f8fafc;}
.row-total td{font-weight:900;}
.row-net{background:#0f172a;}
.row-net td{color:#fff;padding:18px 16px;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;}
.footer{margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e2e8f0;padding-top:36px;}
.sys-info{font-size:8px;color:#cbd5e1;font-weight:700;text-transform:uppercase;line-height:1.4;font-style:italic;}
.sig-box{text-align:center;width:220px;}
.sig-title{font-size:9px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:2px;text-decoration:underline;text-decoration-color:#4f46e5;text-underline-offset:6px;margin-bottom:12px;}
.sig-area{height:100px;border:2px dashed #e2e8f0;border-radius:10px;display:flex;align-items:center;justify-content:center;}
.stamp{border:3px solid rgba(34,197,94,0.3);color:#22c55e;border-radius:50%;padding:18px 20px;transform:rotate(12deg);font-weight:900;text-transform:uppercase;font-size:16px;}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo-row">${logoHtml}</div>
    <div class="company-meta">
      <div>📍 ${tenant.address || 'Adresse non renseignée'}</div>
      <div>📞 ${tenant.phone || ''}</div>
      <div>✉️ ${tenant.email || ''}</div>
    </div>
  </div>
  <div class="title-col">
    <h1>Fiche de Paie</h1>
    <div class="period-badge">${monthYear}</div>
    <div class="ref">Réf : ${employee.id.toString().toUpperCase().substring(0, 8)}-${month}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-card">
    <div class="label">Informations Employé</div>
    <div class="emp-name">${employee.firstName} ${employee.lastName}</div>
    <div class="meta">
      <div><b>Matricule :</b> ${employee.matricule || 'EMP-' + employee.id.toString().substring(0, 6).toUpperCase()}</div>
      <div><b>Poste :</b> ${employee.position || 'Non spécifié'}</div>
      <div><b>Département :</b> ${employee.departmentInfo?.name || 'N/A'}</div>
      <div><b>Type contrat :</b> ${contract.type || 'CDI'}</div>
      <div><b>Date d'entrée :</b> ${contractStartDate}</div>
    </div>
  </div>
  <div class="info-card" style="display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
    <div class="status-ok">✓ Salaire Calculé</div>
    <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:10px;text-align:right;line-height:1.6;">
      Fiche générée conformément<br/>au Code du travail en vigueur.
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="border-radius:12px 0 0 0;">Élément</th>
      <th>Catégorie</th>
      <th style="text-align:right;border-radius:0 12px 0 0;">Montant</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Salaire de base</td>
      <td class="cat earning">Gain</td>
      <td class="amount">+${fmt(baseSalary)} ${currency}</td>
    </tr>
    ${primesRows}
    <tr class="row-total">
      <td><b>Salaire Brut</b></td>
      <td class="cat"></td>
      <td class="amount"><b>${fmt(grossSalary)} ${currency}</b></td>
    </tr>
    <tr>
      <td>Cotisations sociales salarié (${(empSocialRate * 100).toFixed(1)}%)</td>
      <td class="cat deduction">Retenue</td>
      <td class="amount deduction">-${fmt(socialContributions)} ${currency}</td>
    </tr>
    <tr>
      <td>Impôt sur le revenu (${(taxRate * 100).toFixed(1)}% · base imposable)</td>
      <td class="cat deduction">Retenue</td>
      <td class="amount deduction">-${fmt(incomeTax)} ${currency}</td>
    </tr>
    ${advancesRows}
    ${hrRulesDeduction > 0 ? `
    <tr>
      <td>Déductions règles RH (retards / absences)</td>
      <td class="cat deduction">Retenue</td>
      <td class="amount deduction">-${fmt(hrRulesDeduction)} ${currency}</td>
    </tr>` : ''}
    <tr class="row-total">
      <td><b>Total Retenues</b></td>
      <td class="cat"></td>
      <td class="amount"><b>-${fmt(totalDeductions)} ${currency}</b></td>
    </tr>
    <tr class="row-net">
      <td><b>Net à Payer</b></td>
      <td></td>
      <td class="amount"><b>${fmt(netSalary)} ${currency}</b></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <div class="sys-info">
    <div>${companyName} • Système RH GeStockPro v3.2</div>
    <div>Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')}</div>
    <div>ID : ${employee.id.toString().toUpperCase().substring(0, 8)}-${month}</div>
    <div>Taux appliqués : Charges sal. ${(empSocialRate * 100).toFixed(1)}% · Impôt ${(taxRate * 100).toFixed(1)}% · ${workingDaysMonth}j/mois</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">Visa &amp; Cachet Employeur</div>
    <div class="sig-area">
      ${tenant.cachetUrl
        ? `<img src="${tenant.cachetUrl}" style="height:80px;width:auto;object-fit:contain;" alt="Cachet"/>`
        : `<div class="stamp">PAYÉ</div>`}
    </div>
  </div>
</div>
</body>
</html>`;
  }

  /**
   * Helper method to generate payslip HTML with DocumentPreview style
   */
  static async generatePayslipHTML({ employee, contract, tenant, month, calculations }) {
    const monthYear = new Date(month + '-01').toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    });

    const contractStartDate = new Date(contract.startDate).toLocaleDateString('fr-FR');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiche de Paie - ${employee.firstName} ${employee.lastName}</title>
    <style>
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: 'Arial', 'Helvetica', sans-serif;
            padding: 48px; 
            background: white; 
            color: #1e293b;
            width: 210mm;
            min-height: 297mm;
            line-height: 1.6;
            font-size: 14px;
        }

        /* Icones SVG intégrées */
        .icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            vertical-align: middle;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 40px;
            margin-bottom: 48px;
        }

        .company-info {
            flex: 1;
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .logo-icon {
            width: 48px;
            height: 48px;
            background: #4f46e5;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 18px;
        }

        .company-name {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .company-highlight {
            color: #4f46e5;
        }

        .company-details {
            color: #64748b;
            font-size: 11px;
            line-height: 1.8;
            font-weight: 700;
            text-transform: uppercase;
        }

        .detail-line {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }

        .title-section {
            text-align: right;
            flex: 1;
        }

        .title-section h1 {
            font-size: 32px;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .period {
            font-size: 14px;
            font-weight: 700;
            color: white;
            background: #4f46e5;
            padding: 8px 12px;
            border-radius: 8px;
            display: inline-block;
        }

        .reference {
            font-size: 10px;
            font-weight: 900;
            color: #64748b;
            margin-top: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Section employé */
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
        }

        .card-title {
            font-size: 10px;
            font-weight: 900;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 12px;
        }

        .employee-name {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .employee-details {
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.8;
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
            letter-spacing: 1px;
            border: 1px solid #a7f3d0;
            margin-top: 16px;
            justify-content: flex-end;
            width: fit-content;
            margin-left: auto;
        }

        .legal-note {
            font-size: 9px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            line-height: 1.6;
            margin-top: 16px;
        }

        .legal-highlight {
            color: #0f172a;
            font-weight: 900;
            font-style: italic;
        }

        /* Tableau salaire */
        .salary-section {
            margin: 48px 0;
        }

        .salary-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
        }

        .salary-table thead tr {
            background: #0f172a;
            color: white;
        }

        .salary-table th {
            padding: 20px;
            text-align: left;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .salary-table th:first-child {
            border-radius: 16px 0 0 0;
        }

        .salary-table th:last-child {
            border-radius: 0 16px 0 0;
            text-align: right;
        }

        .salary-table td {
            padding: 20px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
            font-weight: 700;
        }

        .salary-table tbody tr:hover {
            background: rgba(248, 250, 252, 0.5);
        }

        .amount {
            text-align: right;
            font-weight: 900;
        }

        .total-row {
            background: #f8fafc !important;
        }

        .net-total {
            background: #0f172a !important;
            color: white !important;
        }

        .net-total td {
            padding: 24px 20px;
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Footer */
        .footer-section {
            margin-top: 96px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #e2e8f0;
            padding-top: 48px;
        }

        .system-info {
            font-size: 8px;
            color: #cbd5e1;
            font-weight: 700;
            text-transform: uppercase;
            line-height: 1.4;
            font-style: italic;
        }

        .signature-section {
            text-align: center;
            width: 250px;
        }

        .signature-title {
            font-size: 10px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-decoration: underline;
            text-decoration-color: #4f46e5;
            text-underline-offset: 8px;
            text-decoration-thickness: 2px;
            margin-bottom: 16px;
        }

        .signature-box {
            height: 120px;
            border: 2px dashed #e2e8f0;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .paid-stamp {
            border: 4px solid rgba(34, 197, 94, 0.3);
            color: #22c55e;
            border-radius: 50%;
            padding: 24px 24px;
            transform: rotate(12deg);
            font-weight: 900;
            text-transform: uppercase;
            font-size: 18px;
        }

        @media print {
            body { padding: 20px; }
            .header { page-break-after: avoid; }
            .employee-section { page-break-inside: avoid; }
            .salary-table { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- Header avec logo et titre -->
    <div class="header">
        <div class="company-info">
            <div class="logo-section">
                ${tenant.logoUrl ?
        `<img src="${tenant.logoUrl}" style="height: 48px; width: auto; object-fit: contain; max-width: 200px;" alt="Logo" />` :
        `<div class="logo-icon">
                        G
                    </div>
                    <div class="company-name">
                        ${tenant.name || tenant.company || 'ENTREPRISE'}<span class="company-highlight">PRO</span>
                    </div>`
      }
            </div>
            <div class="company-details">
                <div class="detail-line">
                    <span class="icon">📍</span>
                    <span>${tenant.address || "Adresse de l'entreprise"}</span>
                </div>
                <div class="detail-line">
                    <span class="icon">📞</span>
                    <span>${tenant.phone || 'Téléphone'}</span>
                </div>
                <div class="detail-line">
                    <span class="icon">✉️</span>
                    <span>${tenant.email || 'Email'}</span>
                </div>
            </div>
        </div>
        <div class="title-section">
            <h1>FICHE DE PAIE</h1>
            <div class="period">${monthYear}</div>
            <div class="reference">Période de paie : ${monthYear}</div>
        </div>
    </div>

    <!-- Informations employé -->
    <div class="employee-section">
        <div class="employee-card">
            <div class="card-title">Informations Employé</div>
            <div class="employee-name">${employee.firstName} ${employee.lastName}</div>
            <div class="employee-details">
                <p><strong>Poste:</strong> ${employee.position || 'Non spécifié'}</p>
                <p><strong>Email:</strong> ${employee.email || 'N/A'}</p>
                <p><strong>Date d'embauche:</strong> ${contractStartDate}</p>
                <p><strong>Type de contrat:</strong> ${contract.type || 'CDI'}</p>
                <p><strong>Statut:</strong> ${contract.status || 'ACTIVE'}</p>
            </div>
        </div>
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
            <div class="status-badge">
                <span>✓</span>
                <span>SALAIRE CALCULÉ</span>
            </div>
            <div class="legal-note">
                Note de conformité :<br/>
                <span class="legal-highlight">Fiche de paie générée conformément au Code du travail.</span>
            </div>
        </div>
    </div>

    <!-- Tableau des salaires -->
    <div class="salary-section">
        <table class="salary-table">
            <thead>
                <tr>
                    <th>ÉLÉMENT</th>
                    <th>MONTANT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Salaire de base</td>
                    <td class="amount">${calculations.baseSalary.toLocaleString()} ${contract.currency || 'F CFA'}</td>
                </tr>
                <tr>
                    <td>Indemnités (10%)</td>
                    <td class="amount">${calculations.allowances.toLocaleString()} ${contract.currency || 'F CFA'}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>SALAIRE BRUT</strong></td>
                    <td class="amount"><strong>${calculations.grossSalary.toLocaleString()} ${contract.currency || 'F CFA'}</strong></td>
                </tr>
                <tr>
                    <td>Cotisations sociales (20%)</td>
                    <td class="amount">-${calculations.socialContributions.toLocaleString()} ${contract.currency || 'F CFA'}</td>
                </tr>
                <tr>
                    <td>Impôt sur le revenu</td>
                    <td class="amount">-${calculations.incomeTax.toLocaleString()} ${contract.currency || 'F CFA'}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>TOTAL DÉDUCTIONS</strong></td>
                    <td class="amount"><strong>-${calculations.totalDeductions.toLocaleString()} ${contract.currency || 'F CFA'}</strong></td>
                </tr>
                <tr class="net-total">
                    <td><strong>SALAIRE NET À PAYER</strong></td>
                    <td class="amount"><strong>${calculations.netSalary.toLocaleString()} ${contract.currency || 'F CFA'}</strong></td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Footer avec signatures -->
    <div class="footer-section">
        <div class="system-info">
            <p>${tenant.name || 'Entreprise'} • Système RH GeStockPro v3.2</p>
            <p>Généré automatiquement par le moteur de paie GeStockPro.</p>
            <p class="mt-4">ID TRANSACTION : ${employee.id.toString().toUpperCase()}-${month}</p>
        </div>
        <div class="signature-section">
            <div class="signature-title">VISA & CACHET EMPLOYEUR</div>
            <div class="signature-box">
                ${tenant.cachetUrl ?
        `<img src="${tenant.cachetUrl}" style="height: 120px; width: auto; object-fit: contain;" alt="Cachet Officiel" />` :
        `<div class="paid-stamp">PAYÉ</div>`
      }
            </div>
        </div>
    </div>
</body>
</html>
`;
  }

  static async generate(req, res) {
    try {
      const { employeeId, month } = req.body;
      const tenantId = req.user.tenantId;

      // Récupérer les données de l'employé
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // VÉRIFICATION : Date d'embauche vs Mois de génération
      if (employee.hireDate) {
        const hDate = new Date(employee.hireDate);
        const hMonthStart = new Date(hDate.getFullYear(), hDate.getMonth(), 1);
        const targetMonthStart = new Date(month + '-01');

        if (targetMonthStart < hMonthStart) {
          return res.status(400).json({
            error: `Impossible de générer un bulletin : l'employé a été embauché le ${hDate.toLocaleDateString('fr-FR')}.`
          });
        }
      }

      // Récupérer le contrat actif de l'employé
      const contract = await Contract.findOne({
        where: {
          employeeId: employeeId,
          tenantId: tenantId,
          status: 'ACTIVE'
        },
        order: [['startDate', 'DESC']]
      });

      if (!contract) {
        return res.status(404).json({ error: 'Aucun contrat actif trouvé pour cet employé' });
      }

      // Récupérer les informations du tenant (entreprise)
      const tenant = await Tenant.findOne({
        where: { id: tenantId }
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Informations de l\'entreprise non trouvées' });
      }

      // Calculer le salaire à partir du contrat
      const baseSalary = parseFloat(contract.salary) || 0;

      if (baseSalary === 0) {
        return res.status(400).json({ error: 'Salaire non défini dans le contrat' });
      }

      const allowances = baseSalary * 0.1; // Indemnités 10%
      const grossSalary = baseSalary + allowances;

      // Cotisations sociales (approximatives pour le Sénégal)
      const socialContributions = grossSalary * 0.20; // 20% approximatif
      const incomeTax = Math.max(0, (grossSalary - 30000) * 0.15); // Impôt sur le revenu

      const totalDeductions = socialContributions + incomeTax;
      const netSalary = grossSalary - totalDeductions;

      // Formater le mois pour l'affichage
      const monthYear = new Date(month + '-01').toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
      });

      // Générer le contenu HTML de la fiche de paie avec le design professionnel (style DocumentPreview)
      const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiche de Paie - ${employee.firstName} ${employee.lastName}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0; 
            padding: 48px; 
            background: white; 
            color: #1e293b;
            width: 210mm;
            min-height: 297mm;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 40px;
            margin-bottom: 48px;
        }
        .company-info .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        .logo-placeholder {
            width: 48px;
            height: 48px;
            background: #4f46e5;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        .company-name { 
            font-size: 24px; 
            font-weight: 900; 
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.5px;
        }
        .company-name .highlight { color: #4f46e5; }
        .company-details { 
            font-size: 10px; 
            color: #64748b; 
            margin-top: 8px;
            font-weight: 700;
            text-transform: uppercase;
            line-height: 1.6;
        }
        .company-details .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
        }
        .detail-icon { 
            width: 10px; 
            height: 10px; 
            color: #4f46e5;
            font-size: 10px;
        }
        
        .document-title {
            text-align: right;
        }
        .title { 
            font-size: 32px; 
            font-weight: 900; 
            color: #0f172a;
            letter-spacing: -1px;
            margin: 0 0 8px 0;
        }
        .reference {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-weight: 700;
            color: #4f46e5;
            background: #eef2ff;
            padding: 8px 12px;
            border-radius: 8px;
            display: inline-block;
            font-size: 14px;
            box-shadow: 0 1px 3px rgba(79, 70, 229, 0.1);
        }
        .date-info {
            font-size: 10px;
            font-weight: 900;
            color: #94a3b8;
            margin-top: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Employee Section */
        .employee-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin: 48px 0;
        }
        .employee-info { 
            background: #f8fafc; 
            padding: 32px; 
            border-radius: 24px; 
            border: 1px solid #e2e8f0;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .section-label {
            font-size: 10px;
            font-weight: 900;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
        }
        .employee-name {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .employee-details {
            font-size: 12px;
            color: #475569;
            font-weight: 600;
            line-height: 1.8;
        }
        .status-section {
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #059669;
            background: #ecfdf5;
            padding: 8px 16px;
            border-radius: 16px;
            border: 1px solid #a7f3d0;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-left: auto;
            width: fit-content;
        }
        .legal-note {
            font-size: 9px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            margin-top: 16px;
            font-style: italic;
            line-height: 1.4;
        }
        .legal-note .important { color: #0f172a; font-weight: 900; }
        
        /* Table */
        .payslip-table { 
            width: 100%; 
            border-collapse: separate;
            border-spacing: 0;
            margin: 48px 0;
        }
        .payslip-table thead tr {
            background: #0f172a;
            color: white;
        }
        .payslip-table th { 
            padding: 20px;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: left;
        }
        .payslip-table th:first-child { border-top-left-radius: 16px; }
        .payslip-table th:last-child { border-top-right-radius: 16px; }
        .payslip-table td { 
            padding: 20px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
            font-weight: 600;
        }
        .payslip-table tbody tr:hover { background: rgba(248, 250, 252, 0.5); }
        .amount { text-align: right; font-weight: 700; }
        
        /* Totals */
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin: 48px 0;
        }
        .totals-container {
            width: 320px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .total-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            padding: 24px;
            border-radius: 32px;
            font-weight: 700;
        }
        .total-net { 
            background: #0f172a; 
            color: white;
            font-weight: 900;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
        }
        .currency { font-size: 12px; font-weight: 600; }
        
        /* Footer */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #e2e8f0;
            padding-top: 48px;
            margin-top: 96px;
        }
        .footer-info {
            font-size: 8px;
            color: #cbd5e1;
            font-weight: 700;
            text-transform: uppercase;
            line-height: 1.6;
            font-style: italic;
        }
        .signature-section {
            text-align: center;
            width: 256px;
        }
        .signature-label {
            font-size: 10px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-decoration: underline;
            text-decoration-color: #4f46e5;
            text-underline-offset: 8px;
            text-decoration-thickness: 2px;
            margin-bottom: 16px;
        }
        .signature-area {
            height: 128px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .paid-stamp {
            border: 4px solid rgba(34, 197, 94, 0.3);
            color: #22c55e;
            border-radius: 50%;
            padding: 12px 24px;
            transform: rotate(12deg);
            font-weight: 900;
            text-transform: uppercase;
            font-size: 20px;
        }
        
        @media print { 
            body { margin: 0; padding: 20px; } 
        }
    </style>
</head>
<body>
    <div id="payslip-document">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                ${tenant.logoUrl ?
          `<img src="${tenant.logoUrl}" style="height: 96px; width: auto; object-fit: contain; margin-bottom: 16px; max-width: 250px;" alt="Logo" />` :
          `<div class="logo-section">
                     <div class="logo-placeholder">GSP</div>
                     <div class="company-name">${tenant.name.includes('GeStockPro') ?
            tenant.name.replace(/GeStockPro/g, 'GESTOCK<span class="highlight">PRO</span>') :
            tenant.name.toUpperCase()
          }</div>
                   </div>`
        }
                <div class="company-details">
                    <div class="detail-item">
                        <span class="detail-icon">📍</span> ${tenant.address || 'Adresse Cloud'}
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">📞</span> ${tenant.phone || 'Standard Téléphonique'}
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">✉️</span> ${tenant.email || 'Contact Support'}
                    </div>
                    ${tenant.siret ? `<div class="detail-item">
                        <span class="detail-icon">🏢</span> SIRET: ${tenant.siret}
                    </div>` : ''}
                </div>
            </div>
            <div class="document-title">
                <h1 class="title">BULLETIN DE PAIE</h1>
                <div class="reference">Ref: #PAY-${employee.id.substring(0, 8)}</div>
                <div class="date-info">Période: ${monthYear}</div>
            </div>
        </div>

        <!-- Employee Info -->
        <div class="employee-section">
            <div class="employee-info">
                <div class="section-label">Employé / Salarié</div>
                <div class="employee-name">${employee.firstName} ${employee.lastName}</div>
                <div class="employee-details">
                    <div><strong>Poste:</strong> ${employee.position || 'Non spécifié'}</div>
                    <div><strong>Matricule:</strong> EMP-${employee.id.substring(0, 8).toUpperCase()}</div>
                    <div><strong>Date d'embauche:</strong> ${employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'Non spécifiée'}</div>
                    <div><strong>Statut:</strong> ${employee.status || 'ACTIF'}</div>
                    <div><strong>Contrat:</strong> ${contract.type || 'CDI'}</div>
                    ${employee.email ? `<div><strong>Email:</strong> ${employee.email}</div>` : ''}
                    ${employee.phone ? `<div><strong>Téléphone:</strong> ${employee.phone}</div>` : ''}
                </div>
            </div>
            <div class="status-section">
                <div class="status-badge">
                    <span>💰</span>
                    <span>Bulletin Validé</span>
                </div>
                <div class="legal-note">
                    Document officiel de paie<br/>
                    <span class="important">${tenant.invoiceFooter || 'Confidentiel - Usage interne uniquement'}</span>
                </div>
            </div>
        </div>

        <!-- Payroll Details Table -->
        <div>
            <table class="payslip-table">
                <thead>
                    <tr>
                        <th>Libellé</th>
                        <th>Base</th>
                        <th>Taux</th>
                        <th class="amount">Gains</th>
                        <th class="amount">Retenues</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Salaire de Base</strong></td>
                        <td class="amount">${baseSalary.toLocaleString('fr-FR')}</td>
                        <td>-</td>
                        <td class="amount"><strong>${baseSalary.toLocaleString('fr-FR')} ${tenant.currency || 'F CFA'}</strong></td>
                        <td class="amount">-</td>
                    </tr>
                    <tr>
                        <td>Indemnités & Primes</td>
                        <td class="amount">${baseSalary.toLocaleString('fr-FR')}</td>
                        <td>10%</td>
                        <td class="amount">${allowances.toLocaleString('fr-FR')} ${tenant.currency || 'F CFA'}</td>
                        <td class="amount">-</td>
                    </tr>
                    <tr>
                        <td>Cotisations Sociales</td>
                        <td class="amount">${grossSalary.toLocaleString('fr-FR')}</td>
                        <td>20%</td>
                        <td class="amount">-</td>
                        <td class="amount">${socialContributions.toLocaleString('fr-FR')} ${tenant.currency || 'F CFA'}</td>
                    </tr>
                    <tr>
                        <td>Impôt sur le Revenu</td>
                        <td class="amount">${Math.max(0, grossSalary - 30000).toLocaleString('fr-FR')}</td>
                        <td>15%</td>
                        <td class="amount">-</td>
                        <td class="amount">${incomeTax.toLocaleString('fr-FR')} ${tenant.currency || 'F CFA'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Totals -->
        <div class="totals-section">
            <div class="totals-container">
                <div class="total-row total-net">
                    <span><strong>NET À PAYER</strong></span>
                    <span><strong>${Math.round(netSalary).toLocaleString('fr-FR')} <span class="currency">${tenant.currency || 'F CFA'}</span></strong></span>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-info">
                <div>${tenant.name} • Kernel Cloud AlwaysData v3.2</div>
                <div>Généré automatiquement par le moteur de paie GeStockPro.</div>
                <div style="margin-top: 16px;">ID TRANSACTION : ${employee.id.toUpperCase()}</div>
            </div>
            <div class="signature-section">
                <div class="signature-label">Visa & Cachet</div>
                <div class="signature-area">
                    ${tenant.cachetUrl ?
          `<img src="${tenant.cachetUrl}" style="height: 128px; width: auto; object-fit: contain; mix-blend-mode: multiply;" alt="Tampon Officiel" />` :
          '<div class="paid-stamp">VALIDÉ</div>'
        }
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

      // Sauvegarder le fichier HTML
      const uploadsDir = path.join(__dirname, '../uploads/payslips');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `payslip_${employeeId}_${month}.html`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, htmlContent, 'utf8');

      const fileUrl = `/uploads/payslips/${fileName}`;

      // TODO: Uploader vers Cloudinary ici si nécessaire
      // Pour l'instant on utilise le stockage local

      // Sauvegarder les informations en base (optionnel)
      const payslipData = {
        employeeId,
        month,
        grossSalary: Math.round(grossSalary),
        netSalary: Math.round(netSalary),
        deductions: Math.round(totalDeductions),
        pdfUrl: fileUrl,
        status: 'GENERATED',
        generatedAt: new Date(),
        generatedBy: req.user.id
      };

      return res.status(200).json({
        success: true,
        pdfUrl: fileUrl,
        downloadUrl: fileUrl, // L'utilisateur peut imprimer en PDF depuis le navigateur
        payslip: {
          id: `PAY-${employeeId.substring(0, 8)}`,
          employeeId,
          month,
          baseSalary: Math.round(baseSalary),
          allowances: Math.round(allowances),
          grossSalary: Math.round(grossSalary),
          socialContributions: Math.round(socialContributions),
          incomeTax: Math.round(incomeTax),
          totalDeductions: Math.round(totalDeductions),
          netSalary: Math.round(netSalary),
          currency: contract.currency || 'F CFA',
          status: 'GENERATED',
          generatedAt: new Date(),
          generatedBy: req.user.id
        }
      });

    } catch (error) {
      console.error('Error generating payslip:', error);
      return res.status(500).json({
        error: 'Erreur lors de la génération de la fiche de paie',
        details: error.message
      });
    }
  }

  static async getEmployeePayslips(req, res) {
    try {
      const { employeeId } = req.params;
      const tenantId = req.user.tenantId;

      // Récupérer l'employé et son contrat pour calculer les données réelles
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      const contract = await Contract.findOne({
        where: {
          employeeId: employeeId,
          tenantId: tenantId,
          status: 'ACTIVE'
        },
        order: [['startDate', 'DESC']]
      });

      if (!contract) {
        return res.status(200).json([]);
      }

      // Calculer le salaire basé sur le contrat
      const baseSalary = parseFloat(contract.salary) || 0;
      const allowances = baseSalary * 0.1;
      const grossSalary = baseSalary + allowances;
      const socialContributions = grossSalary * 0.20;
      const incomeTax = Math.max(0, (grossSalary - 30000) * 0.15);
      const totalDeductions = socialContributions + incomeTax;
      const netSalary = grossSalary - totalDeductions;

      // Filtrer les bulletins mock par date d'embauche
      const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
      const filteredMockPayslips = mockPayslips.filter(slip => {
        if (!hireDate) return true;
        const slipDate = new Date(slip.month + '-01');
        // On garde si le mois du bulletin est >= au mois d'embauche
        // (En comparant le 1er du mois pour simplifier)
        const hireMonthStart = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);
        return slipDate >= hireMonthStart;
      });

      return res.status(200).json(filteredMockPayslips);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      return res.status(500).json({
        error: 'Erreur lors de la r ecupération des fiches de paie',
        details: error.message
      });
    }
  }

  // Télécharger une fiche de paie en utilisant PayslipGeneratorService
  static async downloadPayslip(req, res) {
    try {
      const { employeeId, month, format = 'html' } = req.query;
      const tenantId = req.user.tenantId;

      // Validation des paramètres
      if (!employeeId || !month) {
        return res.status(400).json({
          message: 'ID employé et mois requis (ex: ?employeeId=123&month=2026-03)'
        });
      }

      // Validation du format
      const validFormats = ['html', 'pdf', 'png', 'jpg', 'jpeg'];
      if (!validFormats.includes(format.toLowerCase())) {
        return res.status(400).json({
          message: `Format non supporté. Utilisez: ${validFormats.join(', ')}`
        });
      }

      // Récupérer l'employé avec ses relations
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId },
        include: [{
          model: Department,
          as: 'departmentInfo',
          required: false
        }]
      });

      if (!employee) {
        return res.status(404).json({ message: 'Employé non trouvé' });
      }

      // Récupérer le contrat actif
      const contract = await Contract.findOne({
        where: {
          employeeId: employeeId,
          tenantId: tenantId,
          status: 'ACTIVE'
        },
        order: [['startDate', 'DESC']]
      });

      if (!contract) {
        return res.status(404).json({ message: 'Contrat actif non trouvé pour cet employé' });
      }

      // Récupérer les informations du tenant
      const tenant = await Tenant.findOne({
        where: { id: tenantId }
      });

      if (!tenant) {
        return res.status(404).json({ message: 'Informations de l\'entreprise non trouvées' });
      }

      // Calculer le salaire
      const baseSalary = parseFloat(contract.salary) || 0;
      const totalPrimes = 0; // TODO: Récupérer les primes du mois
      const grossSalary = baseSalary + (baseSalary * 0.1) + totalPrimes; // +10% indemnités
      const socialChargesEmployee = grossSalary * 0.20;
      const totalAdvanceDeductions = 0; // TODO: Récupérer les avances du mois
      const socialChargesEmployer = grossSalary * 0.185; // Info seulement
      const netSalary = grossSalary - socialChargesEmployee - totalAdvanceDeductions;

      const salaryCalculation = {
        baseSalary,
        grossSalary,
        netSalary: Math.round(netSalary),
        totalPrimes,
        socialChargesEmployee: Math.round(socialChargesEmployee),
        socialChargesEmployer: Math.round(socialChargesEmployer),
        totalAdvanceDeductions,
        currency: contract.currency || tenant.currency || 'F CFA'
      };

      // Parser le mois (format YYYY-MM)
      const [year, monthNum] = month.split('-');
      if (!year || !monthNum) {
        return res.status(400).json({
          message: 'Format du mois invalide. Utilisez YYYY-MM (ex: 2026-03)'
        });
      }

      // Générer le fichier avec PayslipGeneratorService
      const result = await PayslipGeneratorService.generatePayslipFile(
        employee,
        contract,
        tenant,
        salaryCalculation,
        parseInt(monthNum),
        parseInt(year),
        format.toLowerCase()
      );

      // Vérifier que le fichier existe
      if (!result.success || !result.fullPath) {
        throw new Error('Génération du fichier échouée');
      }

      // Déterminer le MIME type selon le format
      let mimeType, downloadName;
      switch (format.toLowerCase()) {
        case 'pdf':
          mimeType = 'application/pdf';
          downloadName = `Bulletin_${employee.firstName}_${employee.lastName}_${month}.pdf`;
          break;
        case 'png':
          mimeType = 'image/png';
          downloadName = `Bulletin_${employee.firstName}_${employee.lastName}_${month}.png`;
          break;
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          downloadName = `Bulletin_${employee.firstName}_${employee.lastName}_${month}.jpg`;
          break;
        default:
          mimeType = 'text/html';
          downloadName = `Bulletin_${employee.firstName}_${employee.lastName}_${month}.html`;
      }

      // Envoyer le fichier
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      // Streamer le fichier vers la response
      const fs = await import('fs');
      const fileStream = fs.default.createReadStream(result.fullPath);

      fileStream.on('error', (streamError) => {
        console.error('Error streaming file:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Erreur lors de la lecture du fichier' });
        }
      });

      fileStream.pipe(res);

    } catch (error) {
      console.error('Erreur lors du téléchargement de la fiche de paie:', error);

      if (!res.headersSent) {
        if (error.message.includes('Puppeteer') || error.message.includes('PDF') || error.message.includes('PNG')) {
          res.status(503).json({
            message: 'Service de génération PDF/PNG temporairement indisponible',
            error: error.message,
            suggestion: 'Essayez le format HTML en attendant'
          });
        } else {
          res.status(500).json({
            message: 'Erreur lors de la génération de la fiche de paie',
            error: error.message
          });
        }
      }
    }
  }

  /**
   * List all payslips with filters
   */
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { month, year, status, employeeId } = req.query;

      // Récupérer tous les employés avec contrats actifs
      const employees = await Employee.findAll({
        where: {
          tenantId,
          ...(employeeId && { id: employeeId })
        },
        include: [{
          model: Contract,
          as: 'contracts',
          where: {
            tenantId: tenantId,
            status: 'ACTIVE'
          },
          required: true,
          order: [['startDate', 'DESC']]
        }]
      });

      const payslips = [];

      // Générer des bulletins pour les derniers mois (ou mois spécifié)
      const months = month ? [`${year || new Date().getFullYear()}-${month.padStart(2, '0')}`] : [
        '2026-03',
        '2026-02',
        '2026-01'
      ];

      for (const employee of employees) {
        const contract = employee.contracts[0]; // Le plus récent
        if (!contract) continue;

        const baseSalary = parseFloat(contract.salary) || 0;
        const allowances = baseSalary * 0.1;
        const grossSalary = baseSalary + allowances;
        const socialContributions = grossSalary * 0.20;
        const incomeTax = Math.max(0, (grossSalary - 30000) * 0.15);
        const totalDeductions = socialContributions + incomeTax;
        const netSalary = grossSalary - totalDeductions;

        // Filtrer les mois par date d'embauche
        const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
        const hireMonthStart = hireDate ? new Date(hireDate.getFullYear(), hireDate.getMonth(), 1) : null;

        for (const monthPeriod of months) {
          // Si le mois est antérieur à l'embauche, on ignore
          if (hireMonthStart) {
            const currentMonthDate = new Date(monthPeriod + '-01');
            if (currentMonthDate < hireMonthStart) continue;
          }

          const payslip = {
            id: `${employee.id}-${monthPeriod}`,
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            month: monthPeriod,
            baseSalary: Math.round(baseSalary),
            grossSalary: Math.round(grossSalary),
            netSalary: Math.round(netSalary),
            deductions: Math.round(totalDeductions),
            status: status || 'PAID',
            pdfUrl: null,
            generatedAt: `${monthPeriod}-28`
          };

          // Appliquer les filtres si spécifiés
          if (status && payslip.status !== status) continue;

          payslips.push(payslip);
        }
      }

      // Trier par mois décroissant puis par nom d'employé
      payslips.sort((a, b) => {
        if (a.month !== b.month) {
          return b.month.localeCompare(a.month);
        }
        return a.employeeName.localeCompare(b.employeeName);
      });

      return res.status(200).json({
        rows: payslips,
        total: payslips.length
      });
    } catch (error) {
      console.error('Error fetching payslips list:', error);
      return res.status(500).json({
        error: 'Erreur lors de la récupération des bulletins de paie',
        details: error.message
      });
    }
  }

  /**
   * Delete a payslip file
   */
  static async deletePayslip(req, res) {
    try {
      const { payslipId } = req.params;
      const tenantId = req.user.tenantId;

      // Parse payslipId qui est au format "employeeId-YYYY-MM"
      const parts = payslipId.split('-');
      if (parts.length < 3) {
        return res.status(400).json({
          error: 'Format d\'ID de bulletin invalide. Attendu: employeeId-YYYY-MM'
        });
      }

      const employeeId = parts[0];
      const year = parts[1];
      const month = parts[2];

      if (!employeeId || !year || !month) {
        return res.status(400).json({
          error: 'Format d\'ID de bulletin invalide. Attendu: employeeId-YYYY-MM'
        });
      }

      // Vérifier que l'employé appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId },
        include: [{
          model: Department,
          as: 'departmentInfo',
          required: false
        }]
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Construire le nom de fichier selon le format du PayslipGeneratorService
      const monthName = parseInt(month);

      // Clean names for file system compatibility (same as PayslipGeneratorService)
      const cleanName = (str) => str.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_');
      const firstName = cleanName(employee.firstName || 'Employee');
      const lastName = cleanName(employee.lastName || 'Unknown');
      const departmentName = cleanName(employee.departmentInfo?.name || 'NoDepart');
      const monthPadded = String(monthName).padStart(2, '0');

      // Format: prénom-nom-département-MM.extension
      const baseFileName = `${firstName}-${lastName}-${departmentName}-${monthPadded}`;

      // Chemin vers le dossier des fiches de paie
      const payslipFolderPath = path.join(process.cwd(), 'uploads', 'fiches_paiement', `${year}-${monthPadded}`);

      const filesToDelete = [];
      const extensions = ['html', 'pdf', 'png', 'jpg', 'jpeg'];

      // Supprimer tous les fichiers avec différentes extensions
      for (const ext of extensions) {
        const fileName = `${baseFileName}.${ext}`;
        const filePath = path.join(payslipFolderPath, fileName);

        try {
          if (await fsPromises.access(filePath).then(() => true).catch(() => false)) {
            await fsPromises.unlink(filePath);
            filesToDelete.push(fileName);
          }
        } catch (fileError) {
        }
      }

      // Également vérifier l'ancien format au cas où
      const oldFormatPath = path.join(process.cwd(), 'uploads');
      const oldFileName = `fiche_paie_${employeeId}_${year}-${monthPadded}.html`;
      const oldFilePath = path.join(oldFormatPath, oldFileName);

      try {
        if (await fsPromises.access(oldFilePath).then(() => true).catch(() => false)) {
          await fsPromises.unlink(oldFilePath);
          filesToDelete.push(oldFileName);
        }
      } catch (fileError) {
      }

      return res.status(200).json({
        message: 'Bulletin de paie supprimé avec succès',
        deletedFiles: filesToDelete,
        employee: `${employee.firstName} ${employee.lastName}`,
        period: `${monthName}/${year}`
      });
    } catch (error) {
      console.error('Error deleting payslip:', error);
      return res.status(500).json({
        error: 'Erreur lors de la suppression du bulletin de paie',
        details: error.message
      });
    }
  }
}