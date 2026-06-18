import { OvertimeRequest, Employee, Attendance } from '../models/index.js';
import { Op } from 'sequelize';

export class OvertimeController {

  // ── Employé : liste ses propres demandes ─────────────────────────────────
  static async myList(req, res) {
    try {
      const { tenantId, employeeId } = req.user;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked' });

      const { status, month } = req.query;
      const where = { tenantId, employeeId };
      if (status) where.status = status;
      if (month) {
        const [y, m] = month.split('-').map(Number);
        where.requestedDate = {
          [Op.between]: [`${month}-01`, new Date(y, m, 0).toISOString().split('T')[0]]
        };
      }

      const records = await OvertimeRequest.findAll({
        where,
        order: [['requestedDate', 'DESC']],
        limit: 50
      });
      return res.json(records);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Employé : créer une demande ───────────────────────────────────────────
  static async create(req, res) {
    try {
      const { tenantId, employeeId } = req.user;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked' });

      const { requestedDate, startTime, endTime, reason } = req.body;
      if (!requestedDate) return res.status(400).json({ error: 'requestedDate requis' });
      if (!reason?.trim()) return res.status(400).json({ error: 'La raison est obligatoire' });

      // Calcul des minutes demandées
      let requestedMinutes = 0;
      if (startTime && endTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        requestedMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }

      // Vérifier qu'il n'y a pas déjà une demande PENDING/APPROVED pour cette date
      const existing = await OvertimeRequest.findOne({
        where: { tenantId, employeeId, requestedDate, status: { [Op.in]: ['PENDING', 'APPROVED'] } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Une demande existe déjà pour cette date', existingId: existing.id });
      }

      const record = await OvertimeRequest.create({
        tenantId, employeeId, requestedDate,
        startTime, endTime, requestedMinutes,
        reason: reason.trim(),
        status: 'PENDING'
      });
      return res.status(201).json(record);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Admin/RH : liste toutes les demandes du tenant ────────────────────────
  static async list(req, res) {
    try {
      const { tenantId } = req.user;
      const { status, employeeId, month } = req.query;
      const where = { tenantId };
      if (status) where.status = status;
      if (employeeId) where.employeeId = employeeId;
      if (month) {
        const [y, m] = month.split('-').map(Number);
        where.requestedDate = {
          [Op.between]: [`${month}-01`, new Date(y, m, 0).toISOString().split('T')[0]]
        };
      }

      const records = await OvertimeRequest.findAll({
        where,
        include: [{ model: Employee, as: 'employee', attributes: ['id', 'firstName', 'lastName', 'position', 'photoUrl'] }],
        order: [['requestedDate', 'DESC'], ['createdAt', 'DESC']],
        limit: 100
      });
      return res.json(records);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Admin/RH : approuver ─────────────────────────────────────────────────
  static async approve(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const { reviewNote } = req.body;

      const record = await OvertimeRequest.findOne({ where: { id, tenantId } });
      if (!record) return res.status(404).json({ error: 'NotFound' });
      if (record.status !== 'PENDING') {
        return res.status(400).json({ error: `Impossible d'approuver une demande en statut "${record.status}"` });
      }

      await record.update({
        status: 'APPROVED',
        reviewedBy: req.user.id,
        reviewNote: reviewNote || null
      });
      return res.json(record);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Admin/RH : rejeter ───────────────────────────────────────────────────
  static async reject(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const { reviewNote } = req.body;

      const record = await OvertimeRequest.findOne({ where: { id, tenantId } });
      if (!record) return res.status(404).json({ error: 'NotFound' });
      if (record.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Impossible de rejeter une demande déjà complétée' });
      }

      await record.update({
        status: 'REJECTED',
        reviewedBy: req.user.id,
        reviewNote: reviewNote || null
      });
      return res.json(record);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Admin/RH : marquer comme effectuées (avec minutes réelles) ────────────
  static async complete(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const { actualMinutes, reviewNote } = req.body;

      const record = await OvertimeRequest.findOne({ where: { id, tenantId } });
      if (!record) return res.status(404).json({ error: 'NotFound' });
      if (record.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Seules les demandes approuvées peuvent être complétées' });
      }

      const minutes = parseInt(actualMinutes) || record.requestedMinutes;

      await record.update({
        status: 'COMPLETED',
        actualMinutes: minutes,
        reviewNote: reviewNote || record.reviewNote
      });

      // Mettre à jour le pointage du jour concerné si existant
      const att = await Attendance.findOne({ where: { tenantId, employeeId: record.employeeId, date: record.requestedDate } });
      if (att) {
        await att.update({ overtimeMinutes: (att.overtimeMinutes || 0) + minutes });
      } else {
        // Créer un enregistrement de pointage avec les heures supp
        await Attendance.create({
          tenantId,
          employeeId: record.employeeId,
          date: record.requestedDate,
          status: 'PRESENT',
          overtimeMinutes: minutes,
          source: 'admin',
          meta: { overtimeRequestId: record.id, adminSet: true }
        });
      }

      return res.json(record);
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }

  // ── Résumé mensuel admin (par employé) ────────────────────────────────────
  static async summary(req, res) {
    try {
      const { tenantId } = req.user;
      const month = req.query.month || new Date().toISOString().substring(0, 7);
      const [y, m] = month.split('-').map(Number);
      const startDate = `${month}-01`;
      const endDate = new Date(y, m, 0).toISOString().split('T')[0];

      const records = await OvertimeRequest.findAll({
        where: { tenantId, requestedDate: { [Op.between]: [startDate, endDate] } },
        include: [{ model: Employee, as: 'employee', attributes: ['id', 'firstName', 'lastName', 'position'] }],
        order: [['requestedDate', 'ASC']]
      });

      const pending   = records.filter(r => r.status === 'PENDING').length;
      const approved  = records.filter(r => r.status === 'APPROVED').length;
      const rejected  = records.filter(r => r.status === 'REJECTED').length;
      const completed = records.filter(r => r.status === 'COMPLETED').length;
      const totalActualMinutes = records
        .filter(r => r.status === 'COMPLETED')
        .reduce((s, r) => s + (r.actualMinutes || 0), 0);

      return res.json({ month, pending, approved, rejected, completed, totalActualMinutes, records });
    } catch (err) {
      console.error('[OvertimeController]', err);
      return res.status(500).json({ error: 'ServerError', message: err.message });
    }
  }
}
