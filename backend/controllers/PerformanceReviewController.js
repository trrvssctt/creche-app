import { PerformanceReview, Employee } from '../models/index.js';
import { Op } from 'sequelize';

export class PerformanceReviewController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        employeeId,
        reviewerId,
        status,
        reviewPeriod,
        year,
        page = 1, 
        perPage = 25, 
        sortBy = 'period_start', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (employeeId) where.employeeId = employeeId;
      if (reviewerId) where.reviewerId = reviewerId;
      if (status) where.status = status;
      if (reviewPeriod) where.reviewPeriod = reviewPeriod;
      
      if (year) {
        where.periodStart = {
          [Op.gte]: new Date(`${year}-01-01`),
          [Op.lt]: new Date(`${parseInt(year) + 1}-01-01`)
        };
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'period_start', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await PerformanceReview.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { model: Employee, as: 'employee', attributes: ['firstName', 'lastName', 'position', 'departmentId'] },
          { model: Employee, as: 'reviewer', attributes: ['firstName', 'lastName', 'position'] }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('PerformanceReviewController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const review = await PerformanceReview.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [
          { model: Employee, as: 'employee' },
          { model: Employee, as: 'reviewer' }
        ]
      });
      if (!review) return res.status(404).json({ error: 'Performance review not found' });
      return res.status(200).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { 
        ...req.body, 
        tenantId: req.user.tenantId,
        reviewerId: req.user.id
      };
      
      const review = await PerformanceReview.create(payload);
      return res.status(201).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await PerformanceReview.update(req.body, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!updated) return res.status(404).json({ error: 'Performance review not found' });
      
      const review = await PerformanceReview.findByPk(id);
      return res.status(200).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async submit(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await PerformanceReview.update(
        { status: 'SUBMITTED' }, 
        { 
          where: { 
            id, 
            tenantId: req.user.tenantId, 
            status: 'DRAFT' 
          } 
        }
      );
      
      if (!updated) {
        return res.status(404).json({ error: 'Review not found or already submitted' });
      }
      
      const review = await PerformanceReview.findByPk(id);
      return res.status(200).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async approve(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await PerformanceReview.update(
        { status: 'APPROVED' }, 
        { 
          where: { 
            id, 
            tenantId: req.user.tenantId, 
            status: 'SUBMITTED' 
          } 
        }
      );
      
      if (!updated) {
        return res.status(404).json({ error: 'Review not found or not in submittable state' });
      }
      
      const review = await PerformanceReview.findByPk(id);
      return res.status(200).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async finalize(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await PerformanceReview.update(
        { status: 'FINALIZED' }, 
        { 
          where: { 
            id, 
            tenantId: req.user.tenantId, 
            status: 'APPROVED' 
          } 
        }
      );
      
      if (!updated) {
        return res.status(404).json({ error: 'Review not found or not approved' });
      }
      
      const review = await PerformanceReview.findByPk(id);
      return res.status(200).json(review);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      
      const deleted = await PerformanceReview.destroy({ 
        where: { 
          id, 
          tenantId: req.user.tenantId,
          status: { [Op.in]: ['DRAFT', 'SUBMITTED'] } // Seules les évaluations non finalisées peuvent être supprimées
        } 
      });
      
      if (!deleted) {
        return res.status(404).json({ error: 'Review not found or cannot be deleted' });
      }
      
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}