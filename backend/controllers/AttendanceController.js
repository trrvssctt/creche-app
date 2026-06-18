import { Attendance, PayrollSettings } from '../models/index.js';
import { Op } from 'sequelize';

/** Vérifie qu'un instant est dans la plage horaire [workStartTime, workEndTime] */
function isWithinWorkHours(dateTime, workStartTime, workEndTime) {
  const ch = dateTime.getHours(), cm = dateTime.getMinutes();
  const [sh, sm] = workStartTime.split(':').map(Number);
  const [eh, em] = workEndTime.split(':').map(Number);
  const cMin = ch * 60 + cm;
  return cMin >= sh * 60 + sm && cMin <= eh * 60 + em;
}

export class AttendanceController {
  static async list(req, res) {
    try {
      const { date, employeeId } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (date) where.date = date;
      if (employeeId) where.employeeId = employeeId;
      const items = await Attendance.findAll({ where, order: [['date', 'DESC']] });
      return res.status(200).json(items);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  // ── Employee self-service ─────────────────────────────────────────────────

  /** GET /hr/attendance/my/today — état du jour pour l'employé connecté */
  static async myToday(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.user.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });

      const today = new Date().toISOString().split('T')[0];
      const [record, settings] = await Promise.all([
        Attendance.findOne({ where: { tenantId, employeeId, date: today } }),
        PayrollSettings.findOne({ where: { tenantId } })
      ]);

      return res.json({
        attendance: record || null,
        settings: {
          workStartTime:       settings?.workStartTime       || '08:00',
          workEndTime:         settings?.workEndTime         || '17:00',
          workingDaysPerMonth: settings?.workingDaysPerMonth || 26,
          deductionEnabled:    settings?.deductionEnabled    || false,
        }
      });
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** GET /hr/attendance/my — historique des 30 derniers jours pour l'employé connecté */
  static async myHistory(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.user.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });

      const records = await Attendance.findAll({
        where: { tenantId, employeeId },
        order: [['date', 'DESC']],
        limit: 30
      });
      return res.json(records);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** POST /hr/attendance/clock-in — l'employé pointe son arrivée */
  static async clockIn(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.user.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });

      const now   = new Date();
      const today = now.toISOString().split('T')[0];

      const existing = await Attendance.findOne({ where: { tenantId, employeeId, date: today } });
      if (existing?.clockIn) {
        return res.status(400).json({ error: 'Vous avez déjà pointé l\'arrivée aujourd\'hui' });
      }

      const settings      = await PayrollSettings.findOne({ where: { tenantId } });
      const startTime     = settings?.workStartTime || '08:00';
      const endTime       = settings?.workEndTime   || '17:00';

      if (!isWithinWorkHours(now, startTime, endTime)) {
        return res.status(400).json({
          error: 'HorsHeuresTravail',
          message: `Le pointage n'est autorisé qu'entre ${startTime} et ${endTime}`
        });
      }

      const expectedTs    = new Date(`${today}T${startTime}`);
      const lateMinutes   = Math.max(0, Math.floor((now - expectedTs) / 60000));
      const status        = lateMinutes > 0 ? 'LATE' : 'PRESENT';

      let record;
      if (existing) {
        await existing.update({
          clockIn: now.toISOString(),
          status,
          meta: { ...(existing.meta || {}), lateMinutes, expectedStart: startTime }
        });
        record = existing;
      } else {
        record = await Attendance.create({
          tenantId, employeeId,
          date:    today,
          clockIn: now.toISOString(),
          status,
          source:  'self',
          meta:    { lateMinutes, expectedStart: startTime }
        });
      }
      return res.status(200).json(record);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** POST /hr/attendance/clock-out — l'employé pointe son départ */
  static async clockOut(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.user.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });

      const today  = new Date().toISOString().split('T')[0];
      const record = await Attendance.findOne({ where: { tenantId, employeeId, date: today } });

      if (!record?.clockIn) {
        return res.status(400).json({ error: 'Vous n\'avez pas encore pointé l\'arrivée aujourd\'hui' });
      }
      if (record.clockOut) {
        return res.status(400).json({ error: 'Vous avez déjà pointé le départ aujourd\'hui' });
      }

      const now         = new Date();
      const settings    = await PayrollSettings.findOne({ where: { tenantId } });
      const startTime2  = settings?.workStartTime || '08:00';
      const endTime     = settings?.workEndTime   || '17:00';

      if (!isWithinWorkHours(now, startTime2, endTime)) {
        return res.status(400).json({
          error: 'HorsHeuresTravail',
          message: `Le dépointage n'est autorisé qu'entre ${startTime2} et ${endTime}`
        });
      }

      const expectedEnd = new Date(`${today}T${endTime}`);
      const overtimeMinutes = Math.max(0, Math.floor((now - expectedEnd) / 60000));

      await record.update({
        clockOut: now.toISOString(),
        overtimeMinutes,
        meta: { ...(record.meta || {}), workEndTime: endTime }
      });
      return res.status(200).json(record);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** POST /hr/attendance/auto-clockout — dépointage automatique à l'heure de fin */
  static async autoClockout(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const settings = await PayrollSettings.findOne({ where: { tenantId } });

      if (!settings?.deductionEnabled) {
        return res.json({ message: 'Déductions non activées', updated: 0 });
      }

      const endTime     = settings.workEndTime || '17:00';
      const today       = new Date().toISOString().split('T')[0];
      const now         = new Date();
      const expectedEnd = new Date(`${today}T${endTime}`);

      if (now < expectedEnd) {
        return res.json({ message: 'Heure de fin non encore atteinte', updated: 0 });
      }

      const records = await Attendance.findAll({
        where: {
          tenantId,
          date:     today,
          clockIn:  { [Op.ne]: null },
          clockOut: null
        }
      });

      for (const r of records) {
        await r.update({
          clockOut:        expectedEnd.toISOString(),
          overtimeMinutes: 0,
          meta: { ...(r.meta || {}), autoClockout: true, workEndTime: endTime }
        });
      }
      return res.json({ message: `${records.length} employé(s) dépointé(s) automatiquement`, updated: records.length });
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /**
   * GET /hr/attendance/my/overtime-summary
   * Bilan mensuel : heures supplémentaires vs absences/retards + compensation
   * ?month=YYYY-MM (optionnel, défaut = mois courant)
   */
  static async myOvertimeSummary(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.user.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });

      const month = req.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
      const [year, mon] = month.split('-').map(Number);

      const startDate = `${month}-01`;
      const endDate   = new Date(year, mon, 0).toISOString().split('T')[0]; // dernier jour du mois

      const [records, settings] = await Promise.all([
        Attendance.findAll({
          where: {
            tenantId,
            employeeId,
            date: { [Op.between]: [startDate, endDate] }
          },
          order: [['date', 'ASC']]
        }),
        PayrollSettings.findOne({ where: { tenantId } })
      ]);

      const workStart = settings?.workStartTime || '08:00';
      const workEnd   = settings?.workEndTime   || '17:00';
      const [sh, sm]  = workStart.split(':').map(Number);
      const [eh, em]  = workEnd.split(':').map(Number);
      const workDayMinutes = (eh * 60 + em) - (sh * 60 + sm); // durée journée normale

      let totalOvertimeMinutes = 0;
      let totalAbsenceMinutes  = 0;
      let totalLateMinutes     = 0;

      for (const rec of records) {
        // Heures supplémentaires
        totalOvertimeMinutes += rec.overtimeMinutes || 0;

        // Absences (journée complète non pointée)
        if (rec.status === 'ABSENT') {
          totalAbsenceMinutes += workDayMinutes;
        }

        // Retards
        const lateMin = rec.meta?.lateMinutes || 0;
        totalLateMinutes += lateMin;
      }

      // Total du "déficit" à combler (absences + retards)
      const totalDeficitMinutes = totalAbsenceMinutes + totalLateMinutes;

      // Compensation : les heures supp couvrent d'abord les absences, puis les retards
      const compensatedMinutes      = Math.min(totalOvertimeMinutes, totalDeficitMinutes);
      const remainingOvertimeMinutes = totalOvertimeMinutes - compensatedMinutes;
      const remainingDeficitMinutes  = totalDeficitMinutes  - compensatedMinutes;

      return res.json({
        month,
        totalOvertimeMinutes,
        totalAbsenceMinutes,
        totalLateMinutes,
        totalDeficitMinutes,
        compensatedMinutes,
        remainingOvertimeMinutes,
        remainingDeficitMinutes,
        recordsCount: records.length,
        workDayMinutes,
        settings: { workStart, workEnd }
      });
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /**
   * GET /hr/attendance/overtime-summary (admin/RH)
   * Bilan d'un employé : ?employeeId=xxx&month=YYYY-MM
   */
  static async overtimeSummaryAdmin(req, res) {
    try {
      const tenantId   = req.user.tenantId;
      const employeeId = req.query.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'employeeId requis' });

      const month = req.query.month || new Date().toISOString().substring(0, 7);
      const [year, mon] = month.split('-').map(Number);

      const startDate = `${month}-01`;
      const endDate   = new Date(year, mon, 0).toISOString().split('T')[0];

      const [records, settings] = await Promise.all([
        Attendance.findAll({
          where: { tenantId, employeeId, date: { [Op.between]: [startDate, endDate] } },
          order: [['date', 'ASC']]
        }),
        PayrollSettings.findOne({ where: { tenantId } })
      ]);

      const workStart = settings?.workStartTime || '08:00';
      const workEnd   = settings?.workEndTime   || '17:00';
      const [sh, sm]  = workStart.split(':').map(Number);
      const [eh, em]  = workEnd.split(':').map(Number);
      const workDayMinutes = (eh * 60 + em) - (sh * 60 + sm);

      let totalOvertimeMinutes = 0;
      let totalAbsenceMinutes  = 0;
      let totalLateMinutes     = 0;

      for (const rec of records) {
        totalOvertimeMinutes += rec.overtimeMinutes || 0;
        if (rec.status === 'ABSENT') totalAbsenceMinutes += workDayMinutes;
        totalLateMinutes += rec.meta?.lateMinutes || 0;
      }

      const totalDeficitMinutes      = totalAbsenceMinutes + totalLateMinutes;
      const compensatedMinutes        = Math.min(totalOvertimeMinutes, totalDeficitMinutes);
      const remainingOvertimeMinutes  = totalOvertimeMinutes - compensatedMinutes;
      const remainingDeficitMinutes   = totalDeficitMinutes  - compensatedMinutes;

      return res.json({
        month, employeeId,
        totalOvertimeMinutes,
        totalAbsenceMinutes,
        totalLateMinutes,
        totalDeficitMinutes,
        compensatedMinutes,
        remainingOvertimeMinutes,
        remainingDeficitMinutes,
        recordsCount: records.length,
        workDayMinutes
      });
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const { employeeId, date, clockIn, clockOut, source, expectedStart, overtimeMinutes } = req.body;

      // Lire l'heure de début configurée pour ce tenant
      const settings = await PayrollSettings.findOne({ where: { tenantId: req.user.tenantId } });
      const tenantStartTime = settings?.workStartTime || '08:00';

      // Calcul automatique des minutes de retard
      let lateMinutes = 0;
      const resolvedStart = expectedStart || tenantStartTime;
      if (clockIn && date) {
        const clockInTs = new Date(`${date}T${clockIn}`);
        const expectedTs = new Date(`${date}T${resolvedStart}`);
        lateMinutes = Math.max(0, Math.floor((clockInTs - expectedTs) / 60000));
      }

      const payload = {
        ...req.body,
        tenantId: req.user.tenantId,
        meta: {
          ...(req.body.meta || {}),
          lateMinutes,
          expectedStart: resolvedStart
        }
      };

      const item = await Attendance.create(payload);
      return res.status(201).json(item);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const item = await Attendance.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!item) return res.status(404).json({ error: 'NotFound' });

      // Recalculer les minutes de retard si clockIn ou date change
      const date      = req.body.date      || item.date;
      const clockIn   = req.body.clockIn   || item.clockIn;
      const existingMeta    = item.meta    || {};

      const settings = await PayrollSettings.findOne({ where: { tenantId: req.user.tenantId } });
      const tenantStartTime = settings?.workStartTime || '08:00';
      const expectedStart   = req.body.expectedStart || existingMeta.expectedStart || tenantStartTime;

      let lateMinutes = existingMeta.lateMinutes || 0;
      if (clockIn && date) {
        const clockInTs  = new Date(`${date}T${clockIn}`);
        const expectedTs = new Date(`${date}T${expectedStart}`);
        lateMinutes = Math.max(0, Math.floor((clockInTs - expectedTs) / 60000));
      }

      await item.update({
        ...req.body,
        meta: {
          ...existingMeta,
          ...(req.body.meta || {}),
          lateMinutes,
          expectedStart
        }
      });

      return res.status(200).json(item);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** POST /hr/attendance/admin/clock-in — l'admin/RH pointe l'arrivée d'un employé */
  static async adminClockIn(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { employeeId, date: reqDate, clockIn: reqClockIn } = req.body;
      if (!employeeId) return res.status(400).json({ error: 'employeeId requis' });

      const today = reqDate || new Date().toISOString().split('T')[0];
      const clockInTs = reqClockIn ? new Date(`${today}T${reqClockIn}`) : new Date();

      const settings = await PayrollSettings.findOne({ where: { tenantId } });
      const startTime = settings?.workStartTime || '08:00';
      const adminEndTime = settings?.workEndTime || '17:00';

      if (!isWithinWorkHours(clockInTs, startTime, adminEndTime)) {
        return res.status(400).json({
          error: 'HorsHeuresTravail',
          message: `Le pointage n'est autorisé qu'entre ${startTime} et ${adminEndTime}`
        });
      }

      const expectedTs = new Date(`${today}T${startTime}`);
      const lateMinutes = Math.max(0, Math.floor((clockInTs - expectedTs) / 60000));
      const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

      const existing = await Attendance.findOne({ where: { tenantId, employeeId, date: today } });
      let record;
      if (existing) {
        await existing.update({
          clockIn: clockInTs.toISOString(),
          status,
          source: 'admin',
          meta: { ...(existing.meta || {}), lateMinutes, expectedStart: startTime, adminSet: true }
        });
        record = existing;
      } else {
        record = await Attendance.create({
          tenantId, employeeId,
          date: today,
          clockIn: clockInTs.toISOString(),
          status,
          source: 'admin',
          meta: { lateMinutes, expectedStart: startTime, adminSet: true }
        });
      }
      return res.status(200).json(record);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** POST /hr/attendance/admin/clock-out — l'admin/RH pointe le départ d'un employé */
  static async adminClockOut(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { employeeId, date: reqDate, clockOut: reqClockOut } = req.body;
      if (!employeeId) return res.status(400).json({ error: 'employeeId requis' });

      const today = reqDate || new Date().toISOString().split('T')[0];
      const clockOutTs = reqClockOut ? new Date(`${today}T${reqClockOut}`) : new Date();

      const record = await Attendance.findOne({ where: { tenantId, employeeId, date: today } });
      if (!record) return res.status(404).json({ error: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui' });

      const settings = await PayrollSettings.findOne({ where: { tenantId } });
      const adminStartTime2 = settings?.workStartTime || '08:00';
      const endTime = settings?.workEndTime || '17:00';

      if (!isWithinWorkHours(clockOutTs, adminStartTime2, endTime)) {
        return res.status(400).json({
          error: 'HorsHeuresTravail',
          message: `Le dépointage n'est autorisé qu'entre ${adminStartTime2} et ${endTime}`
        });
      }

      const expectedEnd = new Date(`${today}T${endTime}`);
      const overtimeMinutes = Math.max(0, Math.floor((clockOutTs - expectedEnd) / 60000));

      await record.update({
        clockOut: clockOutTs.toISOString(),
        overtimeMinutes,
        source: 'admin',
        meta: { ...(record.meta || {}), workEndTime: endTime, adminSet: true }
      });
      return res.status(200).json(record);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }

  /** GET /hr/attendance/today — tous les pointages du jour (admin) */
  static async today(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const today = new Date().toISOString().split('T')[0];
      const items = await Attendance.findAll({
        where: { tenantId, date: today },
        order: [['clockIn', 'ASC']]
      });
      return res.status(200).json(items);
    } catch (error) {
      console.error('[AttendanceController]', error);
      return res.status(500).json({ error: 'ServerError', message: error.message });
    }
  }
}
