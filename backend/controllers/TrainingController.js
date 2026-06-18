import { Training, TrainingParticipant, Employee } from '../models/index.js';
import { Op } from 'sequelize';

export class TrainingController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        q, 
        status, 
        provider,
        startDate,
        endDate,
        page = 1, 
        perPage = 25, 
        sortBy = 'start_date', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (status) where.status = status;
      if (provider) where.provider = { [Op.iLike]: `%${provider}%` };
      
      if (startDate || endDate) {
        where.startDate = {};
        if (startDate) where.startDate[Op.gte] = new Date(startDate);
        if (endDate) where.startDate[Op.lte] = new Date(endDate);
      }
      
      if (q) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { provider: { [Op.iLike]: `%${q}%` } },
          { trainer: { [Op.iLike]: `%${q}%` } }
        ];
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'start_date', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await Training.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { model: Employee, as: 'creator', attributes: ['firstName', 'lastName'] },
          { model: TrainingParticipant, as: 'participants', attributes: ['id', 'status'] }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('TrainingController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const training = await Training.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [
          { model: Employee, as: 'creator' },
          { 
            model: TrainingParticipant, 
            as: 'participants',
            include: [{ model: Employee, as: 'employee' }]
          }
        ]
      });
      if (!training) return res.status(404).json({ error: 'Training not found' });
      return res.status(200).json(training);
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
      
      const training = await Training.create(payload);
      return res.status(201).json(training);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await Training.update(req.body, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!updated) return res.status(404).json({ error: 'Training not found' });
      
      const training = await Training.findByPk(id);
      return res.status(200).json(training);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      
      // Supprimer d'abord les participants
      await TrainingParticipant.destroy({ 
        where: { trainingId: id, tenantId: req.user.tenantId } 
      });
      
      const deleted = await Training.destroy({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!deleted) return res.status(404).json({ error: 'Training not found' });
      
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async addParticipant(req, res) {
    try {
      const { id } = req.params;
      const { employeeId } = req.body;
      
      // Vérifier que la formation existe
      const training = await Training.findOne({ 
        where: { id, tenantId: req.user.tenantId } 
      });
      if (!training) return res.status(404).json({ error: 'Training not found' });
      
      // Vérifier que l'employé n'est pas déjà inscrit
      const existing = await TrainingParticipant.findOne({
        where: { trainingId: id, employeeId, tenantId: req.user.tenantId }
      });
      if (existing) {
        return res.status(400).json({ error: 'Employee already enrolled' });
      }
      
      const participant = await TrainingParticipant.create({
        trainingId: id,
        employeeId,
        tenantId: req.user.tenantId
      });
      
      return res.status(201).json(participant);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}