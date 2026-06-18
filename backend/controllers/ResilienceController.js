
import { Backup } from '../models/index.js';
import { ResilienceService } from '../services/ResilienceService.js';

export class ResilienceController {
  /**
   * Liste les points de restauration disponibles
   */
  static async getRestorePoints(req, res) {
    try {
      const backups = await Backup.findAll({
        where: { tenantId: req.user.tenantId },
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(backups);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Force un backup immédiat
   */
  static async triggerManualBackup(req, res) {
    try {
      const snapshot = await ResilienceService.createTenantSnapshot(req.user.tenantId, 'MANUAL');
      return res.status(201).json({
        message: 'Snapshot de sécurité généré avec succès.',
        snapshot
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Diagnostic de santé de l'instance (Audit Loop)
   */
  static async getHealthReport(req, res) {
    try {
      const report = await ResilienceService.checkKernelIntegrity(req.user.tenantId);
      return res.status(200).json(report);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
