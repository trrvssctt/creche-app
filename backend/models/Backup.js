
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Backup extends Model {}

Backup.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // null = sauvegarde système globale (SUPER_ADMIN), non null = snapshot tenant
  tenantId: { type: DataTypes.UUID, allowNull: true, field: 'tenant_id' },
  type: { type: DataTypes.ENUM('AUTOMATIC', 'MANUAL', 'SYSTEM', 'DELETION'), defaultValue: 'AUTOMATIC' },
  status: { type: DataTypes.ENUM('SUCCESS', 'FAILED', 'RESTORED'), defaultValue: 'SUCCESS' },
  size: { type: DataTypes.BIGINT, defaultValue: 0 }, // Taille en octets
  storagePath: { type: DataTypes.STRING, field: 'storage_path' },
  checksum: { type: DataTypes.STRING }, // Hash SHA-256 pour intégrité
  retainUntil: { type: DataTypes.DATE, allowNull: true, field: 'retain_until' }, // Date d'expiration
  metadata: { type: DataTypes.JSONB } // Statistiques au moment du backup
}, { 
  sequelize, 
  modelName: 'backup',
  indexes: [{ fields: ['tenantId', 'createdAt'] }]
});
