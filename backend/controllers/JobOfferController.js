import { JobOffer, Candidate, Employee } from '../models/index.js';
import { Op } from 'sequelize';

export class JobOfferController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        q, 
        status, 
        department, 
        employmentType,
        page = 1, 
        perPage = 25, 
        sortBy = 'created_at', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (status) where.status = status;
      if (department) where.department = department;
      if (employmentType) where.employmentType = employmentType;
      
      if (q) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { location: { [Op.iLike]: `%${q}%` } }
        ];
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'created_at', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await JobOffer.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { model: Employee, as: 'creator', attributes: ['firstName', 'lastName'] },
          { model: Candidate, as: 'candidates', attributes: ['id', 'status'] }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('JobOfferController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const jobOffer = await JobOffer.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [
          { model: Employee, as: 'creator' },
          { model: Candidate, as: 'candidates' }
        ]
      });
      if (!jobOffer) return res.status(404).json({ error: 'Job offer not found' });
      return res.status(200).json(jobOffer);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { 
        ...req.body, 
        tenantId: req.user.tenantId,
        createdBy: req.user.id
      };
      
      const jobOffer = await JobOffer.create(payload);
      return res.status(201).json(jobOffer);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await JobOffer.update(req.body, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!updated) return res.status(404).json({ error: 'Job offer not found' });
      
      const jobOffer = await JobOffer.findByPk(id);
      return res.status(200).json(jobOffer);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      
      // Vérifier s'il y a des candidats
      const candidateCount = await Candidate.count({ 
        where: { jobOfferId: id, tenantId: req.user.tenantId } 
      });
      
      if (candidateCount > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete job offer with existing candidates' 
        });
      }

      const deleted = await JobOffer.destroy({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!deleted) return res.status(404).json({ error: 'Job offer not found' });
      
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async publish(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await JobOffer.update(
        { status: 'OPEN', publishedAt: new Date() }, 
        { where: { id, tenantId: req.user.tenantId } }
      );
      
      if (!updated) return res.status(404).json({ error: 'Job offer not found' });
      
      const jobOffer = await JobOffer.findByPk(id);
      return res.status(200).json(jobOffer);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}