
import { Backup } from '../models/Backup.js';
import { AuditLog } from '../models/AuditLog.js';
import { BackupService } from '../services/BackupService.js';
import { Op } from 'sequelize';
import crypto from 'crypto';

export class BackupController {

  // ─── Lister les sauvegardes système ───────────────────────────────────────

  /**
   * GET /api/admin/backups
   * Liste toutes les sauvegardes système (SUPER_ADMIN uniquement).
   */
  static async listBackups(req, res) {
    try {
      const limit  = Math.min(parseInt(req.query.limit  || 50), 100);
      const offset = parseInt(req.query.offset || 0);
      const status = req.query.status; // optionnel : SUCCESS | FAILED | RESTORED

      const where = { tenantId: null };
      if (status) where.status = status;

      const { count, rows } = await Backup.findAndCountAll({
        where,
        order:  [['createdAt', 'DESC']],
        limit,
        offset
      });

      return res.status(200).json({
        total:   count,
        limit,
        offset,
        backups: rows
      });
    } catch (error) {
      return res.status(500).json({ error: 'ListBackupsError', message: error.message });
    }
  }

  // ─── Statistiques de backup ───────────────────────────────────────────────

  /**
   * GET /api/admin/backups/stats
   * Retourne un résumé : dernière sauvegarde, prochaine, espace utilisé.
   */
  static async getBackupStats(req, res) {
    try {
      const stats = await BackupService.getStats();
      return res.status(200).json(stats);
    } catch (error) {
      return res.status(500).json({ error: 'StatsError', message: error.message });
    }
  }

  // ─── Déclencher une sauvegarde manuelle ──────────────────────────────────

  /**
   * POST /api/admin/backups/trigger
   * Force une sauvegarde système immédiate (SUPER_ADMIN uniquement).
   */
  static async triggerBackup(req, res) {
    try {
      const backup = await BackupService.runSystemBackup('MANUAL');

      await AuditLog.create({
        tenantId:       'SYSTEM',
        userId:         req.user?.id || null,
        userName:       req.user?.name || 'SUPER_ADMIN',
        action:         'SYSTEM_BACKUP_MANUAL',
        resource:       'Backup',
        severity:       'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`BACKUP:${backup.id}:${req.user?.id}:${Date.now()}`)
          .digest('hex')
      });

      return res.status(201).json({
        message: 'Sauvegarde système déclenchée avec succès.',
        backup: {
          id:          backup.id,
          type:        backup.type,
          status:      backup.status,
          sizeMB:      +((Number(backup.size) || 0) / 1024 / 1024).toFixed(2),
          storagePath: backup.storagePath,
          retainUntil: backup.retainUntil,
          createdAt:   backup.createdAt,
          metadata:    backup.metadata
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'TriggerBackupError', message: error.message });
    }
  }

  // ─── Détail d'un backup ───────────────────────────────────────────────────

  /**
   * GET /api/admin/backups/:id
   * Retourne les détails complets d'une sauvegarde.
   */
  static async getBackup(req, res) {
    try {
      const backup = await Backup.findOne({
        where: { id: req.params.id, tenantId: null }
      });
      if (!backup) {
        return res.status(404).json({ error: 'NotFound', message: 'Sauvegarde introuvable.' });
      }
      return res.status(200).json(backup);
    } catch (error) {
      return res.status(500).json({ error: 'GetBackupError', message: error.message });
    }
  }

  // ─── URL de téléchargement ────────────────────────────────────────────────

  /**
   * GET /api/admin/backups/:id/download
   * Retourne une URL signée (1h) pour télécharger le fichier .json.gz depuis S3.
   */
  static async downloadBackup(req, res) {
    try {
      const url = await BackupService.getDownloadUrl(req.params.id);
      return res.status(200).json({
        downloadUrl: url,
        expiresIn:   '1 heure',
        message:     'L\'URL expire dans 1 heure.'
      });
    } catch (error) {
      return res.status(500).json({ error: 'DownloadError', message: error.message });
    }
  }

  // ─── Restauration ─────────────────────────────────────────────────────────

  /**
   * POST /api/admin/backups/:id/restore
   * Restaure la base de données depuis un backup.
   * ATTENTION : opération destructive — exige le header X-Restore-Confirm: CONFIRM
   */
  static async restoreBackup(req, res) {
    try {
      // Double confirmation obligatoire pour éviter une restauration accidentelle
      const confirm = req.headers['x-restore-confirm'] || req.body.confirm;
      if (confirm !== 'CONFIRM') {
        return res.status(400).json({
          error:   'ConfirmationRequired',
          message: 'Envoyez le header "X-Restore-Confirm: CONFIRM" ou le champ body "confirm: CONFIRM" pour confirmer la restauration.',
          warning: 'Cette opération est DESTRUCTIVE et remplace toutes les données actuelles par celles du backup sélectionné.'
        });
      }

      const result = await BackupService.restoreFromBackup(req.params.id);

      await AuditLog.create({
        tenantId:        'SYSTEM',
        userId:          req.user?.id || null,
        userName:        req.user?.name || 'SUPER_ADMIN',
        action:          'SYSTEM_BACKUP_RESTORED',
        resource:        `Backup:${req.params.id}`,
        severity:        'HIGH',
        sha256Signature: crypto
          .createHash('sha256')
          .update(`RESTORE:${req.params.id}:${req.user?.id}:${Date.now()}`)
          .digest('hex')
      });

      return res.status(200).json({
        message:        'Restauration effectuée avec succès.',
        tablesRestored: result.tablesRestored,
        restoredFrom:   result.timestamp,
        database:       result.database
      });
    } catch (error) {
      return res.status(500).json({ error: 'RestoreError', message: error.message });
    }
  }

  // ─── Suppression manuelle ─────────────────────────────────────────────────

  /**
   * DELETE /api/admin/backups/:id
   * Supprime un backup (S3 + DB) avant son expiration naturelle.
   */
  static async deleteBackup(req, res) {
    try {
      const backup = await Backup.findOne({
        where: { id: req.params.id, tenantId: null }
      });
      if (!backup) {
        return res.status(404).json({ error: 'NotFound', message: 'Sauvegarde introuvable.' });
      }

      if (backup.storagePath) {
        const { bucket } = (await import('../services/S3Service.js')).getS3Config();
        const { s3Client } = await import('../services/S3Service.js');
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: backup.storagePath }));
      }

      await backup.destroy();

      return res.status(200).json({ message: 'Sauvegarde supprimée avec succès.' });
    } catch (error) {
      return res.status(500).json({ error: 'DeleteBackupError', message: error.message });
    }
  }
}
