
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';

export class SecurityService {
  /**
   * Vérifie si un log d'audit a été altéré
   */
  static async verifyLogIntegrity(logId) {
    const log = await AuditLog.findByPk(logId);
    if (!log) return false;

    const currentSignature = AuditLog.generateSignature(log);
    return log.signature === currentSignature;
  }

  /**
   * Analyse les tentatives de connexion suspectes
   */
  static async detectBruteForce(email) {
    // Logique pour compter les échecs récents dans les logs
    const recentFailures = await AuditLog.count({
      where: {
        action: 'LOGIN_FAILURE',
        resource: email,
        createdAt: {
          [Op.gt]: new Date(Date.now() - 15 * 60 * 1000) // 15 dernières minutes
        }
      }
    });

    return recentFailures > 5;
  }

  /**
   * Scelle une action critique
   */
  static async sealAction(req, action, resource, severity = 'LOW') {
    return await AuditLog.create({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      action,
      resource,
      severity,
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  }
}
