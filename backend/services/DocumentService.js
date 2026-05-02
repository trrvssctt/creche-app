
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Document, AuditLog } from '../models/index.js';

export class DocumentService {
  /**
   * Calcule le hash SHA-256 d'un fichier
   */
  static async calculateHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Archive un document dans le coffre-fort logique du tenant
   */
  static async archiveDocument(req, fileData, entityInfo) {
    const tenantId = req.user.tenantId;
    const { entityType, entityId } = entityInfo;
    
    // Calcul de l'empreinte avant archivage définitif
    const hash = await this.calculateHash(fileData.path);

    const doc = await Document.create({
      tenantId,
      originalName: fileData.originalname,
      mimeType: fileData.mimetype,
      size: fileData.size,
      path: fileData.path,
      sha256: hash,
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      uploadedBy: req.user.id
    });

    // Audit Log
    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      action: 'DOC_UPLOAD',
      resource: doc.id,
      severity: 'LOW',
      signature: 'GED_SIG_' + hash.slice(0, 10)
    });

    return doc;
  }

  /**
   * Vérifie si le fichier sur disque correspond toujours au hash enregistré
   */
  static async checkIntegrity(docId) {
    const doc = await Document.findByPk(docId);
    if (!doc) return false;
    
    const currentHash = await this.calculateHash(doc.path);
    return currentHash === doc.sha256;
  }
}
