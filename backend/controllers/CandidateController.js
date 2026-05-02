import { Candidate, JobOffer } from '../models/index.js';
import { Op } from 'sequelize';

export class CandidateController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        jobOfferId,
        status, 
        rating,
        q,
        page = 1, 
        perPage = 25, 
        sortBy = 'created_at', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (jobOfferId) where.jobOfferId = jobOfferId;
      if (status) where.status = status;
      if (rating) where.rating = rating;
      
      if (q) {
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${q}%` } },
          { lastName: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ];
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'created_at', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await Candidate.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { model: JobOffer, as: 'jobOffer', attributes: ['title', 'department', 'employmentType'] }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('CandidateController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const candidate = await Candidate.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [{ model: JobOffer, as: 'jobOffer' }]
      });
      if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
      return res.status(200).json(candidate);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { ...req.body, tenantId: req.user.tenantId };
      
      const candidate = await Candidate.create(payload);
      return res.status(201).json(candidate);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await Candidate.update(req.body, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!updated) return res.status(404).json({ error: 'Candidate not found' });
      
      const candidate = await Candidate.findByPk(id);
      return res.status(200).json(candidate);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, rating, notes, interviewDate } = req.body;
      
      const updateData = { status };
      if (rating) updateData.rating = rating;
      if (notes) updateData.notes = notes;
      if (interviewDate) updateData.interviewDate = interviewDate;
      
      const [updated] = await Candidate.update(updateData, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!updated) return res.status(404).json({ error: 'Candidate not found' });
      
      const candidate = await Candidate.findByPk(id);
      return res.status(200).json(candidate);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      
      const deleted = await Candidate.destroy({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!deleted) return res.status(404).json({ error: 'Candidate not found' });
      
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getByJobOffer(req, res) {
    try {
      const { jobOfferId } = req.params;
      
      const candidates = await Candidate.findAll({
        where: { 
          jobOfferId, 
          tenantId: req.user.tenantId 
        },
        order: [['createdAt', 'DESC']]
      });
      
      return res.status(200).json(candidates);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}