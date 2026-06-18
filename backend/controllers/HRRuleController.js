import { HRRule, PayrollSettings } from '../models/index.js';

export class HRRuleController {

  static async list(req, res) {
    try {
      const rules = await HRRule.findAll({
        where: { tenantId: req.user.tenantId },
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
      });
      return res.status(200).json(rules);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const { name, description, type, conditionOperator, conditionValue, conditionUnit, actionType, actionValue, isActive, sortOrder } = req.body;

      if (!name || !type || !actionType || conditionValue === undefined || actionValue === undefined) {
        return res.status(400).json({ error: 'Champs obligatoires : name, type, conditionValue, actionType, actionValue' });
      }

      const rule = await HRRule.create({
        tenantId: req.user.tenantId,
        name,
        description,
        type,
        conditionOperator: conditionOperator || 'GT',
        conditionValue: parseFloat(conditionValue),
        conditionUnit: conditionUnit || 'MINUTES',
        actionType,
        actionValue: parseFloat(actionValue),
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0
      });

      return res.status(201).json(rule);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const rule = await HRRule.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!rule) return res.status(404).json({ error: 'Règle non trouvée' });

      const fields = ['name', 'description', 'type', 'conditionOperator', 'conditionValue', 'conditionUnit', 'actionType', 'actionValue', 'isActive', 'sortOrder'];
      for (const f of fields) {
        if (req.body[f] !== undefined) rule[f] = req.body[f];
      }
      await rule.save();
      return res.status(200).json(rule);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await HRRule.destroy({ where: { id, tenantId: req.user.tenantId } });
      if (!deleted) return res.status(404).json({ error: 'Règle non trouvée' });
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async toggle(req, res) {
    try {
      const { id } = req.params;
      const rule = await HRRule.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!rule) return res.status(404).json({ error: 'Règle non trouvée' });
      rule.isActive = !rule.isActive;
      await rule.save();
      return res.status(200).json(rule);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Calcule les déductions ET les bonus heures supplémentaires issus des règles RH
   * pour un employé sur un mois donné.
   * Appelé par PayrollController.calculateEmployeeSalary
   *
   * @param {string}   tenantId
   * @param {number}   baseSalary             - salaire de base brut
   * @param {Array}    attendances            - enregistrements Attendance du mois
   *                                            (avec meta.lateMinutes et overtimeMinutes)
   * @param {number}   unapprovedAbsences     - jours d'absences injustifiées ce mois
   * @returns {{ totalDeduction, totalBonus, appliedRules }}
   */
  static async computeRuleDeductions(tenantId, baseSalary, attendances = [], unapprovedAbsences = 0) {
    const settings = await PayrollSettings.findOne({ where: { tenantId } });
    if (settings && settings.deductionEnabled === false) {
      return { totalDeduction: 0, totalBonus: 0, appliedRules: [], deductionDisabled: true };
    }

    const rules = await HRRule.findAll({
      where: { tenantId, isActive: true },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
    });

    const workingDaysPerMonth = settings?.workingDaysPerMonth || 26;
    const dailyRate  = baseSalary / workingDaysPerMonth;
    const hourlyRate = dailyRate / 8;

    let totalDeduction = 0;
    let totalBonus     = 0;
    const appliedRules = [];

    // Jours de retard : chaque jour avec N'IMPORTE QUELLE durée de retard → 1 heure entière perdue.
    // On ne cumule pas les minutes exactes — 15 min de retard = 1h déduite, comme 59 min de retard.
    const lateDays = attendances.filter(a => (a.meta?.lateMinutes || 0) > 0).length;
    // Conversion en minutes/heures pour les vérifications de condition
    const totalLateMinutes = lateDays * 60; // 1h = 60 min par jour en retard

    // Minutes d'heures supplémentaires totales du mois
    const totalOvertimeMinutes = attendances.reduce((sum, att) => {
      return sum + (att.overtimeMinutes || att.meta?.overtimeMinutes || 0);
    }, 0);

    for (const rule of rules) {
      const condVal = parseFloat(rule.conditionValue);
      let conditionMet = false;

      /* ── Retards ── */
      if (rule.type === 'LATE') {
        const compareValue = rule.conditionUnit === 'HOURS'
          ? totalLateMinutes / 60
          : totalLateMinutes;
        conditionMet = _compare(compareValue, rule.conditionOperator, condVal);

        if (conditionMet) {
          // Déduction × nombre de jours en retard (1 heure par jour)
          const deduction = _actionDeduction(rule, baseSalary, hourlyRate, dailyRate) * lateDays;
          totalDeduction += deduction;
          appliedRules.push({
            ruleId: rule.id, ruleName: rule.name,
            kind: 'deduction',
            amount: Math.round(deduction * 100) / 100,
            reason: `${lateDays} jour(s) de retard — ${lateDays} heure(s) comptabilisée(s)`
          });
        }

      /* ── Absences injustifiées ── */
      } else if (rule.type === 'ABSENCE') {
        conditionMet = _compare(unapprovedAbsences, rule.conditionOperator, condVal);
        if (conditionMet) {
          const deduction = _actionDeduction(rule, baseSalary, hourlyRate, dailyRate) * unapprovedAbsences;
          totalDeduction += deduction;
          appliedRules.push({
            ruleId: rule.id, ruleName: rule.name,
            kind: 'deduction',
            amount: Math.round(deduction * 100) / 100,
            reason: `${unapprovedAbsences} jour(s) d'absence injustifiée`
          });
        }

      /* ── Congés non payés ── */
      } else if (rule.type === 'UNPAID_LEAVE') {
        conditionMet = _compare(unapprovedAbsences, rule.conditionOperator, condVal);
        if (conditionMet) {
          const deduction = _actionDeduction(rule, baseSalary, hourlyRate, dailyRate) * unapprovedAbsences;
          totalDeduction += deduction;
          appliedRules.push({
            ruleId: rule.id, ruleName: rule.name,
            kind: 'deduction',
            amount: Math.round(deduction * 100) / 100,
            reason: `${unapprovedAbsences} jour(s) de congé non payé`
          });
        }

      /* ── Heures supplémentaires ── */
      } else if (rule.type === 'OVERTIME') {
        const compareValue = rule.conditionUnit === 'MINUTES'
          ? totalOvertimeMinutes
          : totalOvertimeMinutes / 60;
        conditionMet = _compare(compareValue, rule.conditionOperator, condVal);

        if (conditionMet) {
          const overtimeHours = totalOvertimeMinutes / 60;
          const bonus = _actionBonus(rule, baseSalary, hourlyRate, overtimeHours);
          totalBonus += bonus;
          appliedRules.push({
            ruleId: rule.id, ruleName: rule.name,
            kind: 'bonus',
            amount: Math.round(bonus * 100) / 100,
            reason: `${overtimeHours.toFixed(1)} heure(s) sup. ce mois`
          });
        }
      }
    }

    return {
      totalDeduction: Math.round(totalDeduction * 100) / 100,
      totalBonus:     Math.round(totalBonus     * 100) / 100,
      appliedRules
    };
  }
}

// --- Helpers privés ---

function _compare(value, operator, threshold) {
  switch (operator) {
    case 'GT':  return value > threshold;
    case 'GTE': return value >= threshold;
    case 'LT':  return value < threshold;
    case 'LTE': return value <= threshold;
    case 'EQ':  return value === threshold;
    default:    return value > threshold;
  }
}

/** Calcule un montant de DÉDUCTION selon le type d'action */
function _actionDeduction(rule, baseSalary, hourlyRate, dailyRate) {
  const val = parseFloat(rule.actionValue);
  switch (rule.actionType) {
    case 'DEDUCT_FIXED':        return val;
    case 'DEDUCT_SALARY_HOURS': return hourlyRate * val;
    case 'DEDUCT_SALARY_DAYS':  return dailyRate  * val;
    case 'DEDUCT_PERCENT':      return baseSalary * (val / 100);
    default: return 0;
  }
}

/** Calcule un montant de BONUS (heures supplémentaires) selon le type d'action */
function _actionBonus(rule, baseSalary, hourlyRate, overtimeHours) {
  const val = parseFloat(rule.actionValue);
  switch (rule.actionType) {
    case 'ADD_FIXED':         return val;                           // montant fixe brut
    case 'ADD_SALARY_HOURS':  return hourlyRate * val * overtimeHours; // val = multiplicateur (ex: 1.5)
    case 'ADD_PERCENT':       return baseSalary * (val / 100);     // % du salaire de base
    default: return 0;
  }
}
