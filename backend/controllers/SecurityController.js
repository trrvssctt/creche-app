
import { AuditLog } from '../models/index.js';
import crypto from 'crypto';

export class SecurityController {
  /**
   * Récupère le registre d'audit immuable filtré par tenant
   */
  static async getAuditTrail(req, res) {
    try {
      const logs = await AuditLog.findAll({
        where: { tenantId: req.user.tenantId },
        order: [['createdAt', 'DESC']],
        limit: 100
      });
      // Renvoie un tableau vide si aucun log, mais pas d'erreur 404
      return res.status(200).json(logs || []);
    } catch (error) {
      console.error("[SECURITY KERNEL] Audit Trail Error:", error);
      return res.status(500).json({ error: 'AuditFetchError', message: error.message });
    }
  }

  /**
   * Analyseur d'intégrité cryptographique des transactions
   */
  static async checkTenantIntegrity(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const logs = await AuditLog.findAll({ where: { tenantId }, limit: 200 });

      let suspectCount = 0;
      const secret = process.env.AUDIT_SECRET || 'GESTOCK_KERNEL_SECURE_2024';

      for (const log of logs) {
        // Recalcul du hash pour comparaison
        const payload = {
          tenantId: log.tenantId,
          userId: log.userId,
          action: log.action,
          resource: log.resource,
          severity: log.severity,
          status: log.status
        };
        
        const expected = crypto.createHash('sha256')
          .update(JSON.stringify(payload) + secret)
          .digest('hex');
        
        if (log.sha256Signature !== expected) {
          suspectCount++;
        }
      }

      return res.status(200).json({
        integrityLevel: suspectCount === 0 ? 'CERTIFIED' : 'WARNING',
        anomalies: suspectCount,
        lastScan: new Date(),
        compliance: "ISO-27001 Ready"
      });
    } catch (error) {
      return res.status(500).json({ error: 'IntegrityCheckError', message: error.message });
    }
  }
}
