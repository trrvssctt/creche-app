import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { CollectionCase, FinanceAuditEvent } from '../models/index.js';

export class NightlyBatchService {

  static async run() {
    console.log('[NIGHTLY BATCH] Démarrage...');

    const updated = await this.updateInstallmentStatuses();
    const casesOpened = await this.autoOpenCollectionCases();
    const casesUpdated = await this.updateCollectionCaseAging();

    console.log(`[NIGHTLY BATCH] Terminé — ${updated} échéances mises à jour, ${casesOpened} dossiers ouverts, ${casesUpdated} dossiers actualisés`);
    return { updated, casesOpened, casesUpdated };
  }

  // Recalculer le statut temporel de chaque échéance
  static async updateInstallmentStatuses() {
    // A_ECHOIR → DUE (date atteinte)
    const [, dueMeta] = await sequelize.query(`
      UPDATE echeances_paiements
      SET statut = 'DUE'
      WHERE statut IN ('EN_ATTENTE', 'A_ECHOIR')
        AND date_echeance = CURRENT_DATE
        AND amount_remaining > 0
    `, { type: QueryTypes.RAW });

    // EN_ATTENTE/A_ECHOIR/DUE → EN_GRACE (date dépassée, dans le délai de grâce)
    const [, graceMeta] = await sequelize.query(`
      UPDATE echeances_paiements
      SET statut = 'EN_GRACE'
      WHERE statut IN ('EN_ATTENTE', 'A_ECHOIR', 'DUE')
        AND date_echeance < CURRENT_DATE
        AND CURRENT_DATE <= date_echeance + COALESCE(grace_days, 5)
        AND amount_remaining > 0
    `, { type: QueryTypes.RAW });

    // EN_GRACE/EN_ATTENTE/DUE → EN_RETARD (délai de grâce dépassé)
    const [, retardMeta] = await sequelize.query(`
      UPDATE echeances_paiements
      SET statut = 'EN_RETARD'
      WHERE statut IN ('EN_ATTENTE', 'A_ECHOIR', 'DUE', 'EN_GRACE')
        AND CURRENT_DATE > date_echeance + COALESCE(grace_days, 5)
        AND amount_remaining > 0
    `, { type: QueryTypes.RAW });

    const total = (dueMeta?.rowCount || 0) + (graceMeta?.rowCount || 0) + (retardMeta?.rowCount || 0);
    return total;
  }

  // Ouvrir automatiquement des dossiers de recouvrement
  static async autoOpenCollectionCases() {
    const debtors = await sequelize.query(`
      SELECT ep.tenant_id, ep.eleve_id,
             SUM(ep.amount_remaining) AS total_outstanding,
             MIN(ep.date_echeance) AS oldest_due_date,
             COUNT(*) AS nb_echeances
      FROM echeances_paiements ep
      WHERE ep.statut = 'EN_RETARD'
        AND ep.amount_remaining > 0
        AND NOT EXISTS (
          SELECT 1 FROM collection_cases cc
          WHERE cc.eleve_id = ep.eleve_id
            AND cc.tenant_id = ep.tenant_id
            AND cc.status IN ('OPEN', 'IN_PROGRESS', 'ARRANGEMENT')
        )
      GROUP BY ep.tenant_id, ep.eleve_id
      HAVING SUM(ep.amount_remaining) > 0
    `, { type: QueryTypes.SELECT });

    let count = 0;
    for (const d of debtors) {
      const daysOverdue = Math.floor((Date.now() - new Date(d.oldest_due_date).getTime()) / 86400000);
      let bucket = '1-30';
      if (daysOverdue > 180) bucket = '>180';
      else if (daysOverdue > 90) bucket = '91-180';
      else if (daysOverdue > 60) bucket = '61-90';
      else if (daysOverdue > 30) bucket = '31-60';

      const caseCount = await CollectionCase.count({ where: { tenantId: d.tenant_id } });
      const reference = `REC-${new Date().getFullYear()}-${String(caseCount + 1).padStart(6, '0')}`;

      await CollectionCase.create({
        tenantId: d.tenant_id,
        reference,
        eleveId: d.eleve_id,
        totalOutstanding: d.total_outstanding,
        oldestDueDate: d.oldest_due_date,
        agingBucket: bucket,
        priority: daysOverdue > 90 ? 'HIGH' : (daysOverdue > 60 ? 'NORMAL' : 'LOW'),
      });
      count++;
    }

    return count;
  }

  // Mettre à jour les montants et tranches d'âge des dossiers existants
  static async updateCollectionCaseAging() {
    const cases = await CollectionCase.findAll({
      where: { status: ['OPEN', 'IN_PROGRESS', 'ARRANGEMENT'] },
    });

    let count = 0;
    for (const c of cases) {
      const [row] = await sequelize.query(`
        SELECT
          COALESCE(SUM(amount_remaining), 0) AS total_outstanding,
          MIN(date_echeance) AS oldest_due_date
        FROM echeances_paiements
        WHERE eleve_id = :eleveId
          AND tenant_id = :tenantId
          AND statut = 'EN_RETARD'
          AND amount_remaining > 0
      `, {
        replacements: { eleveId: c.eleveId, tenantId: c.tenantId },
        type: QueryTypes.SELECT,
      });

      const total = parseFloat(row?.total_outstanding || 0);

      if (total <= 0) {
        await c.update({ status: 'RESOLVED', closedAt: new Date(), closureReason: 'Toutes les échéances soldées' });
      } else {
        const daysOverdue = row.oldest_due_date
          ? Math.floor((Date.now() - new Date(row.oldest_due_date).getTime()) / 86400000)
          : 0;
        let bucket = '1-30';
        if (daysOverdue > 180) bucket = '>180';
        else if (daysOverdue > 90) bucket = '91-180';
        else if (daysOverdue > 60) bucket = '61-90';
        else if (daysOverdue > 30) bucket = '31-60';

        await c.update({
          totalOutstanding: total,
          oldestDueDate: row.oldest_due_date,
          agingBucket: bucket,
        });
      }
      count++;
    }

    return count;
  }
}
