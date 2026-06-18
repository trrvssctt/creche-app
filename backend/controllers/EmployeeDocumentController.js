import { EmployeeDocument, Employee } from '../models/index.js';
import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EmployeeDocumentController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        employeeId, 
        type, 
        category, 
        q,
        page = 1, 
        perPage = 25, 
        sortBy = 'uploaded_at', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (employeeId) where.employeeId = employeeId;
      if (type) where.type = type;
      if (category) where.category = category;
      
      if (q) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { category: { [Op.iLike]: `%${q}%` } }
        ];
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'uploaded_at', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await EmployeeDocument.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { model: Employee, as: 'employee', attributes: ['firstName', 'lastName', 'departmentId'] },
          { model: Employee, as: 'uploader', attributes: ['firstName', 'lastName'] }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('EmployeeDocumentController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const document = await EmployeeDocument.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [
          { model: Employee, as: 'employee' },
          { model: Employee, as: 'uploader' }
        ]
      });
      if (!document) return res.status(404).json({ error: 'Document not found' });
      return res.status(200).json(document);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      // Mapper les types de document vers les valeurs ENUM autorisées
      const mapDocumentType = (inputType) => {
        const typeMapping = {
          'document': 'OTHER',
          'id_card': 'ID_CARD',
          'contract': 'CONTRACT', 
          'diploma': 'DIPLOMA',
          'bank_details': 'BANK_DETAILS',
          'medical': 'MEDICAL'
        };
        
        const normalizedType = inputType?.toLowerCase() || 'document';
        return typeMapping[normalizedType] || 'OTHER';
      };

      const payload = { 
        ...req.body, 
        type: mapDocumentType(req.body.type), // Mapper le type vers les valeurs ENUM
        tenantId: req.user.tenantId,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };
      
      const document = await EmployeeDocument.create(payload);
      return res.status(201).json(document);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      // Ne pas permettre la modification de certains champs sensibles
      delete req.body.uploadedBy;
      delete req.body.uploadedAt;
      delete req.body.tenantId;
      
      const [updated] = await EmployeeDocument.update(req.body, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!updated) return res.status(404).json({ error: 'Document not found' });
      
      const document = await EmployeeDocument.findByPk(id);
      return res.status(200).json(document);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      
      // TODO: Ici on pourrait ajouter la suppression du fichier physique
      // const document = await EmployeeDocument.findByPk(id);
      // if (document && document.fileUrl) {
      //   // Supprimer le fichier du système de fichiers ou du cloud
      // }
      
      const deleted = await EmployeeDocument.destroy({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!deleted) return res.status(404).json({ error: 'Document not found' });
      
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getByEmployee(req, res) {
    try {
      const { employeeId } = req.params;
      const { type, category } = req.query;
      
      const where = { 
        employeeId, 
        tenantId: req.user.tenantId 
      };
      
      if (type) where.type = type;
      if (category) where.category = category;
      
      const documents = await EmployeeDocument.findAll({
        where,
        order: [['uploadedAt', 'DESC']],
        include: [
          { model: Employee, as: 'uploader', attributes: ['firstName', 'lastName'] }
        ]
      });
      
      return res.status(200).json(documents);
    } catch (error) {
      console.error('Error fetching employee documents:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de la récupération des documents',
        details: error.message 
      });
    }
  }

  static async uploadLocal(req, res) {
    try {
      const { employeeId, name, type, category } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      // Mapper les types de document vers les valeurs ENUM autorisées
      const mapDocumentType = (inputType) => {
        const typeMapping = {
          'document': 'OTHER',
          'id_card': 'ID_CARD',
          'contract': 'CONTRACT', 
          'diploma': 'DIPLOMA',
          'bank_details': 'BANK_DETAILS',
          'medical': 'MEDICAL'
        };
        
        const normalizedType = inputType?.toLowerCase() || 'document';
        return typeMapping[normalizedType] || 'OTHER';
      };

      // Créer le dossier d'upload s'il n'existe pas
      const uploadsDir = path.join(__dirname, '../uploads/employee-documents');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Générer un nom de fichier unique
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${Date.now()}_${employeeId}_${Math.random().toString(36).substring(7)}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Sauvegarder le fichier
      fs.writeFileSync(filePath, req.file.buffer);

      // URL du fichier pour accès
      const fileUrl = `/uploads/employee-documents/${fileName}`;

      // Sauvegarder en base de données
      const payload = {
        employeeId: employeeId, // Utilisé comme UUID tel quel, pas de parseInt
        name: name.trim(),
        type: mapDocumentType(type), // Mapper vers les valeurs ENUM autorisées
        category: category?.trim() || null,
        fileUrl,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        tenantId: req.user.tenantId,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };

      const document = await EmployeeDocument.create(payload);
      return res.status(201).json(document);
    } catch (error) {
      console.error('Error uploading document locally:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de l\'upload local',
        details: error.message 
      });
    }
  }
}