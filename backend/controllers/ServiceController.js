
import { Service, SaleItem, AuditLog } from '../models/index.js';
import crypto from 'crypto';

export class ServiceController {
  /**
   * Liste des services actifs
   */
  static async list(req, res) {
    try {
      const { anneeScolaire } = req.query;
      const where = { tenantId: req.user.tenantId, status: 'actif' };

      if (anneeScolaire) {
        // Retourne les services de l'année demandée + les services globaux (sans année)
        const { Op } = await import('sequelize');
        where[Op.or] = [{ anneeScolaire }, { anneeScolaire: null }];
      }

      const services = await Service.findAll({ where, order: [['name', 'ASC']] });
      return res.status(200).json(services);
    } catch (error) {
      return res.status(500).json({ error: 'ListError', message: error.message });
    }
  }

  /**
   * Création d'un service
   */
  static async create(req, res) {
    try {
      const {
        name, description, price, isActive, imageUrl,
        typeOffre, niveauxCibles, dureeMois, inclutCantine, fraisInscription,
        anneeScolaire,
      } = req.body;
      const service = await Service.create({
        tenantId: req.user.tenantId,
        name,
        description,
        price,
        imageUrl,
        isActive: isActive !== undefined ? isActive : true,
        status: 'actif',
        typeOffre: typeOffre || 'MENSUALITE',
        niveauxCibles: niveauxCibles || [],
        dureeMois: dureeMois ?? 10,
        inclutCantine: inclutCantine ?? false,
        fraisInscription: fraisInscription ?? 0,
        anneeScolaire: anneeScolaire || null,
      });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'SERVICE_CREATED',
        resource: `Service: ${name}`,
        severity: 'LOW',
        sha256Signature: crypto.createHash('sha256').update(`${service.id}:${Date.now()}`).digest('hex')
      });

      return res.status(201).json(service);
    } catch (error) {
      return res.status(400).json({ error: 'CreateError', message: error.message });
    }
  }

  /**
   * Mise à jour avec vérification de dépendances (Ventes)
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification des ventes liées
      const salesCount = await SaleItem.count({ where: { serviceId: id } });
      if (salesCount > 0) {
        return res.status(403).json({ 
          error: 'UpdateLocked', 
          message: 'Modification impossible : ce service est lié à une ou plusieurs ventes enregistrées.' 
        });
      }

      const service = await Service.findOne({ where: { id, tenantId, status: 'actif' } });
      if (!service) return res.status(404).json({ error: 'NotFound', message: 'Service introuvable.' });

      await service.update(req.body);
      return res.status(200).json(service);
    } catch (error) {
      return res.status(400).json({ error: 'UpdateError', message: error.message });
    }
  }

  /**
   * Suppression logique (Soft Delete)
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      // 1. Vérification des ventes liées
      const salesCount = await SaleItem.count({ where: { serviceId: id } });
      if (salesCount > 0) {
        return res.status(403).json({ 
          error: 'DeleteLocked', 
          message: 'Suppression impossible : ce service est rattaché à des transactions commerciales.' 
        });
      }

      const service = await Service.findOne({ where: { id, tenantId, status: 'actif' } });
      if (!service) return res.status(404).json({ error: 'NotFound', message: 'Service introuvable ou déjà supprimé.' });

      // 2. Suppression logique : Changement de statut
      await service.update({ 
        status: 'supprimer',
        deletedAt: new Date(),
        isActive: false
      });

      await AuditLog.create({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'SERVICE_DELETED',
        resource: `Service: ${service.name}`,
        severity: 'MEDIUM',
        sha256Signature: crypto.createHash('sha256').update(`${id}:delete:${Date.now()}`).digest('hex')
      });

      return res.status(200).json({ message: 'Le service a été marqué comme supprimé avec succès.' });
    } catch (error) {
      return res.status(400).json({ error: 'DeleteError', message: error.message });
    }
  }
}
