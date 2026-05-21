import { EleveDocument, Eleve } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

const ALLOWED_ROLES = ['ADMIN', 'MAITRESSE', 'ENSEIGNANT', 'COMPTABLE', 'ASSISTANTE',
                       'ACCOUNTANT', 'SALES', 'HR_MANAGER'];

export class EleveDossierController {

  // GET /api/eleves/:eleveId/dossier/admin
  static async listAdmin(req, res) {
    try {
      const { eleveId } = req.params;
      const docs = await EleveDocument.findAll({
        where: { tenantId: req.user.tenantId, eleveId, categorie: 'ADMINISTRATIF' },
        order: [['createdAt', 'DESC']],
      });
      return res.json(docs);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/eleves/:eleveId/dossier/academique
  // Retourne les années scolaires disponibles avec leur nombre de documents
  static async listAnnees(req, res) {
    try {
      const { eleveId } = req.params;
      const rows = await EleveDocument.findAll({
        where: { tenantId: req.user.tenantId, eleveId, categorie: 'ACADEMIQUE' },
        attributes: [
          'anneeScolaire',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        ],
        group: ['annee_scolaire'],
        order: [['anneeScolaire', 'DESC']],
        raw: true,
      });
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/eleves/:eleveId/dossier/academique/:annee
  static async listAnneeDoc(req, res) {
    try {
      const { eleveId, annee } = req.params;
      const docs = await EleveDocument.findAll({
        where: { tenantId: req.user.tenantId, eleveId, categorie: 'ACADEMIQUE', anneeScolaire: annee },
        order: [['createdAt', 'DESC']],
      });
      return res.json(docs);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/eleves/:eleveId/dossier
  // Body : { categorie, anneeScolaire?, typeDoc, nom, fileUrl, s3Key?, mimeType?, fileSize? }
  static async addDoc(req, res) {
    try {
      const { eleveId } = req.params;
      const eleve = await Eleve.findOne({ where: { id: eleveId, tenantId: req.user.tenantId } });
      if (!eleve) return res.status(404).json({ error: 'Élève introuvable.' });

      const payload = {
        tenantId: req.user.tenantId,
        eleveId,
        uploadedBy: req.user.id,
        categorie: req.body.categorie,
        anneeScolaire: req.body.anneeScolaire || null,
        typeDoc: req.body.typeDoc || 'AUTRE',
        nom: req.body.nom,
        fileUrl: req.body.fileUrl,
        s3Key: req.body.s3Key || null,
        mimeType: req.body.mimeType || null,
        fileSize: req.body.fileSize || null,
      };

      if (!payload.categorie || !payload.nom || !payload.fileUrl) {
        return res.status(400).json({ error: 'categorie, nom et fileUrl sont requis.' });
      }
      if (payload.categorie === 'ACADEMIQUE' && !payload.anneeScolaire) {
        return res.status(400).json({ error: 'anneeScolaire est requis pour les documents académiques.' });
      }

      const doc = await EleveDocument.create(payload);
      return res.status(201).json(doc);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE /api/eleves/:eleveId/dossier/:docId
  static async deleteDoc(req, res) {
    try {
      const { eleveId, docId } = req.params;
      const deleted = await EleveDocument.destroy({
        where: { id: docId, eleveId, tenantId: req.user.tenantId },
      });
      if (!deleted) return res.status(404).json({ error: 'Document introuvable.' });
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
