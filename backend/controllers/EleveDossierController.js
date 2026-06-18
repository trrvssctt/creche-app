import { EleveDocument, Eleve } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { isTeacher, getTeacherClassIds } from '../utils/teacherGuard.js';

export class EleveDossierController {

  // Vérifie qu'un enseignant a le droit d'accéder à cet élève.
  // Renvoie true si OK, false sinon (la réponse 403 est envoyée ici).
  static async #checkTeacherAccess(req, res, eleveId) {
    if (!isTeacher(req)) return true;
    if (!req.user.employeeId) {
      res.status(403).json({ error: 'Forbidden', message: 'Aucun employé lié à ce compte enseignant.' });
      return false;
    }
    const eleve = await Eleve.findOne({
      where: { id: eleveId, tenantId: req.user.tenantId },
      attributes: ['id', 'classeId'],
    });
    if (!eleve) {
      res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      return false;
    }
    const classeIds = await getTeacherClassIds(req.user.tenantId, req.user.employeeId);
    if (!eleve.classeId || !classeIds.includes(String(eleve.classeId))) {
      res.status(403).json({ error: 'Forbidden', message: 'Accès refusé à cet élève.' });
      return false;
    }
    return true;
  }

  // GET /api/eleves/:eleveId/dossier/admin
  static async listAdmin(req, res) {
    try {
      const { eleveId } = req.params;
      if (!await EleveDossierController.#checkTeacherAccess(req, res, eleveId)) return;

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
  static async listAnnees(req, res) {
    try {
      const { eleveId } = req.params;
      if (!await EleveDossierController.#checkTeacherAccess(req, res, eleveId)) return;

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
      if (!await EleveDossierController.#checkTeacherAccess(req, res, eleveId)) return;

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
  static async addDoc(req, res) {
    try {
      const { eleveId } = req.params;
      if (!await EleveDossierController.#checkTeacherAccess(req, res, eleveId)) return;

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
      if (!await EleveDossierController.#checkTeacherAccess(req, res, eleveId)) return;

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
