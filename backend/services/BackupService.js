
import { createGzip, createGunzip } from 'zlib';
import { promisify } from 'util';
import zlib from 'zlib';
import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { sequelize } from '../config/database.js';
import { Backup } from '../models/Backup.js';
import { s3Client, getS3Config } from './S3Service.js';

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/** Rétention des sauvegardes système : 7 jours */
const RETENTION_DAYS = 7;

/** Rétention des sauvegardes de suppression de compte : 90 jours */
const DELETION_RETENTION_DAYS = 90;

/** Délai de réflexion avant suppression effective : 30 jours */
const DELETION_GRACE_DAYS = 30;

/**
 * Ordre d'insertion lors d'une restauration (respect des FK).
 * Les tables parents avant les tables enfants.
 */
const RESTORE_INSERT_ORDER = [
  'plans',
  'tenants',
  'users',
  'subscriptions',
  'customers',
  'categories',
  'subcategories',
  'stock_items',
  'services',
  'suppliers',
  'sales',
  'sale_items',
  'payments',
  'deliveries',
  'employees',
  'attendances',
  'overtime_requests',
  'leaves',
  'payroll_settings',
  'audit_logs',
  'notifications',
  'notification_reads',
  'support_tickets',
  'registration_intents',
  'contact_messages',
  'announcements',
  'stock_movements',
  'inventory_campaigns',
];

/**
 * Tables à ne PAS restaurer (méta-système, recréées automatiquement au démarrage).
 */
const SKIP_RESTORE_TABLES = ['backups', 'sessions', 'sequelize_meta'];

export class BackupService {

  // ─── Découverte des tables ─────────────────────────────────────────────────

  static async discoverTables() {
    const [rows] = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return rows.map(r => r.tablename);
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  /**
   * Exporte toutes les tables de la base en un Buffer JSON compressé (gzip).
   * Retourne : { buffer, checksum, size, rowCounts, totalTables }
   */
  static async exportDatabaseToBuffer() {
    const existingTables = await this.discoverTables();

    const payload = {
      version:   '1.0',
      timestamp: new Date().toISOString(),
      database:  process.env.DB_NAME || 'gestionapp_creche_app',
      tables:    {}
    };

    // Ordre : tables connues en premier, puis tables découvertes non listées
    const orderedTables = [
      ...RESTORE_INSERT_ORDER.filter(t => existingTables.includes(t)),
      ...existingTables.filter(t => !RESTORE_INSERT_ORDER.includes(t))
    ];

    const rowCounts = {};
    for (const table of orderedTables) {
      try {
        const [rows] = await sequelize.query(`SELECT * FROM "${table}"`);
        payload.tables[table] = rows;
        rowCounts[table] = rows.length;
      } catch (err) {
        console.warn(`[BackupService] Table "${table}" ignorée :`, err.message);
        payload.tables[table] = [];
        rowCounts[table] = 0;
      }
    }

    const jsonStr  = JSON.stringify(payload);
    const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');
    const buffer   = await gzip(Buffer.from(jsonStr, 'utf-8'));

    return {
      buffer,
      checksum,
      size:        buffer.length,
      rowCounts,
      totalTables: orderedTables.length
    };
  }

  // ─── Sauvegarde complète ───────────────────────────────────────────────────

  /**
   * Exécute un backup complet de la base, l'upload sur S3 et enregistre le résultat.
   * @param {'AUTOMATIC'|'MANUAL'} type
   * @returns {Backup} Instance Sequelize du backup créé
   */
  static async runSystemBackup(type = 'AUTOMATIC') {
    const startedAt = Date.now();
    console.log(`[BackupService] ▶ Démarrage backup ${type}…`);

    try {
      const { buffer, checksum, size, rowCounts, totalTables } =
        await this.exportDatabaseToBuffer();

      // Clé S3 : system/backups/YYYY-MM-DD_HH-mm-ss_type.json.gz
      const now     = new Date();
      const dateStr = now.toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
      const s3Key   = `system/backups/${dateStr}_${type.toLowerCase()}.json.gz`;

      const { bucket } = getS3Config();
      await s3Client.send(new PutObjectCommand({
        Bucket:      bucket,
        Key:         s3Key,
        Body:        buffer,
        ContentType: 'application/gzip',
        Metadata: {
          checksum,
          'backup-type': type,
          'created-at':  now.toISOString()
        }
      }));

      // Date d'expiration = maintenant + RETENTION_DAYS
      const retainUntil = new Date(now);
      retainUntil.setDate(retainUntil.getDate() + RETENTION_DAYS);

      const record = await Backup.create({
        tenantId:    null, // null = backup système global
        type,
        status:      'SUCCESS',
        size,
        storagePath: s3Key,
        checksum,
        retainUntil,
        metadata: {
          timestamp:   now.toISOString(),
          durationMs:  Date.now() - startedAt,
          totalTables,
          rowCounts
        }
      });

      console.log(
        `[BackupService] ✅ Backup terminé en ${Date.now() - startedAt}ms` +
        ` — ${(size / 1024 / 1024).toFixed(2)} Mo — ${s3Key}`
      );

      // Purger les anciennes sauvegardes après chaque backup automatique
      await this.purgeExpiredBackups();

      return record;

    } catch (err) {
      console.error('[BackupService] ❌ Erreur backup système :', err.message);
      // Enregistrer l'échec pour traçabilité
      try {
        await Backup.create({
          tenantId: null,
          type,
          status:   'FAILED',
          size:     0,
          metadata: { error: err.message, timestamp: new Date().toISOString() }
        });
      } catch (_) { /* non-bloquant */ }
      throw err;
    }
  }

  // ─── Purge ─────────────────────────────────────────────────────────────────

  /**
   * Supprime de S3 et de la DB les sauvegardes dont retainUntil est dépassée.
   */
  static async purgeExpiredBackups() {
    const now = new Date();

    const expired = await Backup.findAll({
      where: {
        tenantId:    null,
        status:      'SUCCESS',
        retainUntil: { [Op.lt]: now }
      }
    });

    if (expired.length === 0) {
      console.log('[BackupService] Aucun backup expiré à purger.');
      return;
    }

    const { bucket } = getS3Config();
    let purged = 0;

    for (const backup of expired) {
      try {
        if (backup.storagePath) {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: backup.storagePath })
          );
        }
        await backup.destroy();
        purged++;
        console.log(`[BackupService] Purgé : ${backup.storagePath}`);
      } catch (err) {
        console.warn(`[BackupService] Impossible de purger ${backup.id} :`, err.message);
      }
    }

    console.log(
      `[BackupService] ${purged}/${expired.length} backup(s) purgé(s) (rétention ${RETENTION_DAYS}j).`
    );
  }

  // ─── Restauration ─────────────────────────────────────────────────────────

  /**
   * Restaure la base de données depuis un backup stocké sur S3.
   * ATTENTION : opération destructive — remplace toutes les données existantes.
   *
   * @param {string} backupId - UUID du record Backup
   * @returns {{ tablesRestored: number, timestamp: string }}
   */
  static async restoreFromBackup(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup)                     throw new Error('Backup introuvable.');
    if (backup.status === 'FAILED')  throw new Error('Impossible de restaurer depuis un backup échoué.');
    if (!backup.storagePath)         throw new Error('Ce backup ne possède pas de fichier S3.');

    console.log(`[BackupService] ▶ Restauration depuis : ${backup.storagePath}`);

    // 1. Téléchargement S3
    const { bucket } = getS3Config();
    const s3Response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: backup.storagePath })
    );
    const chunks = [];
    for await (const chunk of s3Response.Body) chunks.push(chunk);
    const compressed = Buffer.concat(chunks);

    // 2. Décompression
    const jsonBuffer = await gunzip(compressed);
    const jsonStr    = jsonBuffer.toString('utf-8');

    // 3. Vérification checksum
    if (backup.checksum) {
      const computed = crypto.createHash('sha256').update(jsonStr).digest('hex');
      if (computed !== backup.checksum) {
        throw new Error('Checksum invalide — le fichier de backup est corrompu ou altéré.');
      }
    }

    const payload = JSON.parse(jsonStr);

    // 4. Restauration dans une transaction DB
    const tableNames = Object.keys(payload.tables || {});

    // Ordre d'insertion : tables connues d'abord (parents → enfants), reste ensuite
    const insertOrder = [
      ...RESTORE_INSERT_ORDER.filter(t => tableNames.includes(t) && !SKIP_RESTORE_TABLES.includes(t)),
      ...tableNames.filter(t => !RESTORE_INSERT_ORDER.includes(t) && !SKIP_RESTORE_TABLES.includes(t))
    ];

    // Ordre de suppression = inverse
    const deleteOrder = [...insertOrder].reverse();

    const transaction = await sequelize.transaction();
    let tablesRestored = 0;

    try {
      // ── Étape A : vider dans l'ordre inverse (enfants → parents) ──
      for (const table of deleteOrder) {
        const rows = payload.tables[table];
        if (!rows || rows.length === 0) continue;
        try {
          await sequelize.query(`DELETE FROM "${table}"`, { transaction });
        } catch (err) {
          console.warn(`[BackupService] DELETE "${table}" ignoré :`, err.message);
        }
      }

      // ── Étape B : ré-insérer dans l'ordre direct (parents → enfants) ──
      const qi = sequelize.getQueryInterface();

      for (const table of insertOrder) {
        const rows = payload.tables[table];
        if (!rows || rows.length === 0) continue;

        try {
          // Insertion par batch de 500 lignes pour éviter les timeouts
          const BATCH_SIZE = 500;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            await qi.bulkInsert(`"${table}"`, batch, { transaction });
          }
          tablesRestored++;
        } catch (err) {
          console.warn(`[BackupService] INSERT "${table}" partiel :`, err.message);
        }
      }

      await transaction.commit();

      // Marquer le backup comme source d'une restauration
      await backup.update({ status: 'RESTORED' });

      console.log(
        `[BackupService] ✅ Restauration terminée — ${tablesRestored} table(s) — depuis ${payload.timestamp}`
      );

      return {
        tablesRestored,
        timestamp: payload.timestamp,
        database:  payload.database
      };

    } catch (err) {
      await transaction.rollback();
      console.error('[BackupService] ❌ Restauration échouée :', err.message);
      throw err;
    }
  }

  // ─── URL de téléchargement signée ─────────────────────────────────────────

  /**
   * Génère une URL S3 signée (valide 1h) pour télécharger le fichier de backup.
   */
  static async getDownloadUrl(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup || !backup.storagePath) {
      throw new Error('Backup introuvable ou sans fichier S3.');
    }
    const { bucket } = getS3Config();
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: backup.storagePath }),
      { expiresIn: 3600 }
    );
  }

  // ─── Statistiques ─────────────────────────────────────────────────────────

  /**
   * Résumé des sauvegardes système (dernière, prochaine, espace utilisé).
   */
  static async getStats() {
    const all = await Backup.findAll({
      where: { tenantId: null },
      order: [['createdAt', 'DESC']]
    });

    const successful = all.filter(b => b.status === 'SUCCESS');
    const failed     = all.filter(b => b.status === 'FAILED');
    const last       = successful[0] || null;
    const totalSize  = successful.reduce((acc, b) => acc + Number(b.size || 0), 0);

    // Prochaine sauvegarde automatique prévue demain à 02:00
    const nextBackup = new Date();
    nextBackup.setDate(nextBackup.getDate() + 1);
    nextBackup.setHours(2, 0, 0, 0);

    return {
      totalBackups:     all.length,
      successfulCount:  successful.length,
      failedCount:      failed.length,
      totalSizeBytes:   totalSize,
      totalSizeMB:      +(totalSize / 1024 / 1024).toFixed(2),
      lastBackup:       last ? {
        id:          last.id,
        createdAt:   last.createdAt,
        sizeMB:      +((Number(last.size) || 0) / 1024 / 1024).toFixed(2),
        storagePath: last.storagePath,
        metadata:    last.metadata
      } : null,
      nextScheduled:    nextBackup.toISOString(),
      retentionDays:    RETENTION_DAYS
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SUPPRESSION DE COMPTE TENANT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Exporte UNIQUEMENT les données d'un tenant donné (toutes les tables avec tenant_id = X).
   * Inclut aussi le record tenant lui-même.
   * Retourne : { buffer, checksum, size, rowCounts }
   */
  static async exportTenantToBuffer(tenantId) {
    // Découvrir toutes les tables ayant une colonne tenant_id
    const [cols] = await sequelize.query(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE column_name = 'tenant_id'
        AND table_schema = 'public'
      ORDER BY table_name
    `);
    const tenantTables = cols.map(c => c.table_name).filter(t => t !== 'tenants');

    const payload = {
      version:   '1.0',
      tenantId,
      timestamp: new Date().toISOString(),
      tables:    {}
    };

    const rowCounts = {};

    // Export du record tenant
    const [tenantRows] = await sequelize.query(
      `SELECT * FROM tenants WHERE id = $1`,
      { bind: [tenantId] }
    );
    payload.tables['tenants'] = tenantRows;
    rowCounts['tenants'] = tenantRows.length;

    // Export de toutes les tables liées au tenant
    for (const table of tenantTables) {
      try {
        const [rows] = await sequelize.query(
          `SELECT * FROM "${table}" WHERE tenant_id = $1`,
          { bind: [tenantId] }
        );
        payload.tables[table] = rows;
        rowCounts[table]       = rows.length;
      } catch (err) {
        console.warn(`[BackupService] Export tenant "${table}" ignoré :`, err.message);
        payload.tables[table] = [];
        rowCounts[table]      = 0;
      }
    }

    const jsonStr  = JSON.stringify(payload);
    const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');
    const buffer   = await gzip(Buffer.from(jsonStr, 'utf-8'));

    return { buffer, checksum, size: buffer.length, rowCounts };
  }

  /**
   * Crée un backup de suppression pour un tenant :
   *  1. Exporte toutes les données tenant → JSON.gz
   *  2. Upload sur S3 sous system/deletions/
   *  3. Enregistre en DB avec rétention 90 jours
   *
   * @param {string} tenantId
   * @param {string} reason   - Motif de suppression fourni par l'admin
   * @returns {Backup}
   */
  static async createDeletionBackup(tenantId, reason) {
    console.log(`[BackupService] ▶ Backup de suppression pour tenant ${tenantId}…`);
    const startedAt = Date.now();

    const { buffer, checksum, size, rowCounts } = await this.exportTenantToBuffer(tenantId);

    const now     = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
    const s3Key   = `system/deletions/${tenantId}/${dateStr}_deletion.json.gz`;

    const { bucket } = getS3Config();
    await s3Client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         s3Key,
      Body:        buffer,
      ContentType: 'application/gzip',
      Metadata: {
        checksum,
        'tenant-id':   tenantId,
        'backup-type': 'DELETION',
        'reason':      reason.slice(0, 200),
        'created-at':  now.toISOString()
      }
    }));

    const retainUntil = new Date(now);
    retainUntil.setDate(retainUntil.getDate() + DELETION_RETENTION_DAYS);

    const record = await Backup.create({
      tenantId,
      type:        'DELETION',
      status:      'SUCCESS',
      size,
      storagePath: s3Key,
      checksum,
      retainUntil,
      metadata: {
        reason,
        timestamp:    now.toISOString(),
        durationMs:   Date.now() - startedAt,
        rowCounts,
        retentionDays: DELETION_RETENTION_DAYS
      }
    });

    console.log(
      `[BackupService] ✅ Backup suppression tenant ${tenantId} — ` +
      `${(size / 1024 / 1024).toFixed(2)} Mo — expire le ${retainUntil.toDateString()}`
    );

    return record;
  }

  /**
   * Supprime TOUTES les données d'un tenant de la base opérationnelle.
   * Utilise session_replication_role=replica pour désactiver les FK temporairement.
   * @param {string} tenantId
   */
  static async deleteTenantData(tenantId) {
    console.log(`[BackupService] ▶ Suppression données opérationnelles tenant ${tenantId}…`);

    // Découvrir toutes les tables liées au tenant
    const [cols] = await sequelize.query(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE column_name = 'tenant_id'
        AND table_schema = 'public'
      ORDER BY table_name
    `);
    const tenantTables = cols.map(c => c.table_name).filter(t => t !== 'tenants');

    const transaction = await sequelize.transaction();
    try {
      // Désactiver les FK pour cette session
      await sequelize.query('SET session_replication_role = replica', { transaction });

      // Supprimer de chaque table liée
      let deletedFrom = 0;
      for (const table of tenantTables) {
        try {
          const [, meta] = await sequelize.query(
            `DELETE FROM "${table}" WHERE tenant_id = $1`,
            { bind: [tenantId], transaction }
          );
          if ((meta?.rowCount ?? 0) > 0) deletedFrom++;
        } catch (err) {
          console.warn(`[BackupService] DELETE "${table}" ignoré :`, err.message);
        }
      }

      // Supprimer le record tenant lui-même (en dernier)
      await sequelize.query(
        `DELETE FROM tenants WHERE id = $1`,
        { bind: [tenantId], transaction }
      );

      // Réactiver les FK
      await sequelize.query('SET session_replication_role = DEFAULT', { transaction });

      await transaction.commit();
      console.log(
        `[BackupService] ✅ Tenant ${tenantId} supprimé — ` +
        `données effacées dans ${deletedFrom} table(s).`
      );
    } catch (err) {
      await sequelize.query('SET session_replication_role = DEFAULT', { transaction });
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Traite les tenants dont la suppression planifiée est arrivée à échéance.
   * Appelé par le cron quotidien.
   */
  static async processPendingDeletions() {
    const { Tenant } = await import('../models/Tenant.js');

    const now     = new Date();
    const pending = await Tenant.findAll({
      where: {
        pendingDeletion:      true,
        deletionScheduledFor: { [Op.lte]: now }
      }
    });

    if (pending.length === 0) {
      console.log('[BackupService] Aucune suppression de compte à traiter.');
      return;
    }

    console.log(`[BackupService] ${pending.length} compte(s) à supprimer définitivement…`);

    for (const tenant of pending) {
      try {
        console.log(`[BackupService] ▶ Traitement suppression : ${tenant.name} (${tenant.id})`);

        // 1. Sauvegarder les données (90 jours)
        const backup = await this.createDeletionBackup(
          tenant.id,
          tenant.deletionReason || 'Suppression planifiée'
        );

        // 2. Supprimer les données opérationnelles
        await this.deleteTenantData(tenant.id);

        console.log(
          `[BackupService] ✅ Compte supprimé : ${tenant.name} — ` +
          `backup conservé jusqu'au ${backup.retainUntil?.toDateString()}`
        );
      } catch (err) {
        console.error(
          `[BackupService] ❌ Échec suppression tenant ${tenant.id} :`, err.message
        );
      }
    }
  }
}
