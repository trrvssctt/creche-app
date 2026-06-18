import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import {
  AbonnementEleve, EcheancePaiement, Eleve, Service, Sale, SaleItem, Payment
} from '../models/index.js';
import { NotificationService } from '../services/NotificationService.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const PERIODICITE_DAYS = {
  HEBDOMADAIRE:  7,
  MENSUEL:       30,  // logique mois calendaire
  TRIMESTRIEL:   90,
  SEMESTRIEL:    180,
  ANNUEL:        365,
};

function nextDateEcheance(periodicite, from) {
  const d = new Date(from);
  switch (periodicite) {
    case 'HEBDOMADAIRE': d.setDate(d.getDate() + 7); break;
    case 'MENSUEL':      d.setMonth(d.getMonth() + 1); break;
    case 'TRIMESTRIEL':  d.setMonth(d.getMonth() + 3); break;
    case 'SEMESTRIEL':   d.setMonth(d.getMonth() + 6); break;
    case 'ANNUEL':       d.setFullYear(d.getFullYear() + 1); break;
    default:             d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

function periodeLabel(periodicite, date) {
  const d = new Date(date);
  const mois = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  switch (periodicite) {
    case 'HEBDOMADAIRE':
      return `Semaine du ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
    case 'MENSUEL':   return mois.charAt(0).toUpperCase() + mois.slice(1);
    case 'TRIMESTRIEL': {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `T${q} ${d.getFullYear()}`;
    }
    case 'SEMESTRIEL': {
      const s = d.getMonth() < 6 ? 1 : 2;
      return `S${s} ${d.getFullYear()}`;
    }
    case 'ANNUEL':  return `Année ${d.getFullYear()}`;
    default:        return mois;
  }
}

function genRef() {
  return 'VNT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
}

// ── Contrôleur ──────────────────────────────────────────────────────────────

export class AbonnementController {

  // ── Créer un abonnement + générer la première échéance ───────────────────
  static async create(req, res) {
    const t = await sequelize.transaction();
    try {
      const { eleveId, serviceId, dateDebut } = req.body;
      if (!eleveId || !serviceId || !dateDebut)
        return res.status(400).json({ error: 'MissingFields', message: 'Champs obligatoires manquants.' });

      const service = await Service.findByPk(serviceId);
      if (!service) return res.status(404).json({ error: 'ServiceNotFound', message: 'Service introuvable.' });

      const periodicite = req.body.periodicite || 'MENSUEL';
      const montant = req.body.montant != null ? req.body.montant : parseFloat(service.price);

      const abo = await AbonnementEleve.create({
        tenantId: req.user.tenantId, eleveId, serviceId,
        periodicite, montant, dateDebut, isActive: true,
      }, { transaction: t });
      await EcheancePaiement.create({
        tenantId: req.user.tenantId,
        abonnementId: abo.id,
        eleveId,
        serviceId,
        montant,
        dateEcheance: dateDebut,
        periodeLabel: periodeLabel(periodicite, dateDebut),
        statut: 'EN_ATTENTE',
      }, { transaction: t });

      await t.commit();
      return res.status(201).json(abo);
    } catch (err) {
      await t.rollback();
      console.error('[AbonnementController.create]', err);
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  // ── Lister les abonnements d'un élève ────────────────────────────────────
  static async listByEleve(req, res) {
    try {
      const { eleveId } = req.params;
      const abos = await AbonnementEleve.findAll({
        where: { tenantId: req.user.tenantId, eleveId },
        include: [
          { model: Service, as: 'service', attributes: ['id', 'name', 'price', 'typeOffre'] },
          { model: EcheancePaiement, as: 'echeances', order: [['dateEcheance', 'DESC']] },
        ],
        order: [['createdAt', 'DESC']],
      });
      return res.json(abos);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  // ── Désactiver un abonnement ─────────────────────────────────────────────
  static async deactivate(req, res) {
    try {
      const abo = await AbonnementEleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });
      if (!abo) return res.status(404).json({ error: 'NotFound', message: 'Abonnement introuvable.' });
      await abo.update({ isActive: false, dateFin: new Date().toISOString().split('T')[0] });
      return res.json(abo);
    } catch (err) {
      return res.status(500).json({ error: 'UpdateError', message: err.message });
    }
  }

  // ── Lister les échéances (avec filtres) ──────────────────────────────────
  static async listEcheances(req, res) {
    try {
      const { eleveId, statut, dateFrom, dateTo, month, year } = req.query;
      const where = { tenantId: req.user.tenantId };

      if (eleveId) where.eleveId = eleveId;
      if (statut)  where.statut = statut;

      if (month && year) {
        const from = new Date(+year, +month - 1, 1);
        const to   = new Date(+year, +month, 0);
        where.dateEcheance = { [Op.between]: [from.toISOString().split('T')[0], to.toISOString().split('T')[0]] };
      } else if (dateFrom || dateTo) {
        where.dateEcheance = {};
        if (dateFrom) where.dateEcheance[Op.gte] = dateFrom;
        if (dateTo)   where.dateEcheance[Op.lte] = dateTo;
      }

      const echeances = await EcheancePaiement.findAll({
        where,
        include: [
          { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom', 'niveau', 'parent1', 'whatsappPrincipal', 'matricule'] },
          { model: Service, as: 'service', attributes: ['id', 'name', 'typeOffre'] },
        ],
        order: [['dateEcheance', 'ASC']],
      });

      // Marquer EN_RETARD automatiquement
      const today = new Date().toISOString().split('T')[0];
      const toUpdate = echeances.filter(e => e.statut === 'EN_ATTENTE' && e.dateEcheance < today);
      if (toUpdate.length) {
        await EcheancePaiement.update(
          { statut: 'EN_RETARD' },
          { where: { id: toUpdate.map(e => e.id) } }
        );
        toUpdate.forEach(e => { e.statut = 'EN_RETARD'; });
      }

      return res.json(echeances);
    } catch (err) {
      console.error('[AbonnementController.listEcheances]', err);
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  // ── Payer une échéance → création automatique de vente ──────────────────
  static async payEcheance(req, res) {
    const t = await sequelize.transaction();
    try {
      const ech = await EcheancePaiement.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: [
          { model: Eleve, as: 'eleve' },
          { model: Service, as: 'service' },
          { model: AbonnementEleve, as: 'abonnement' },
        ],
      });
      if (!ech) return res.status(404).json({ error: 'NotFound', message: 'Échéance introuvable.' });
      if (ech.statut === 'PAYE') return res.status(400).json({ error: 'AlreadyPaid', message: 'Déjà payée.' });

      const { methodePaiement = 'CASH' } = req.body;
      const montant = parseFloat(ech.montant);

      // Créer la vente
      const sale = await Sale.create({
        tenantId: req.user.tenantId,
        reference: genRef(),
        status: 'TERMINE',
        totalHt: montant,
        totalTtc: montant,
        taxAmount: 0,
        amountPaid: montant,
        saleDate: new Date(),
        walkinName: ech.eleve ? `${ech.eleve.prenom} ${ech.eleve.nom}` : null,
      }, { transaction: t });

      // Créer l'item de vente
      await SaleItem.create({
        saleId: sale.id,
        serviceId: ech.serviceId,
        description: `${ech.service?.name || 'Redevance'} — ${ech.periodeLabel}`,
        quantity: 1,
        unitPrice: montant,
        totalPrice: montant,
      }, { transaction: t });

      // Créer le paiement
      const safeMethod = ['CASH', 'ORANGE_MONEY', 'WAVE', 'MTN_MOMO', 'STRIPE', 'TRANSFER', 'CHEQUE'].includes(methodePaiement)
        ? methodePaiement : 'CASH';
      await Payment.create({
        saleId: sale.id,
        tenantId: req.user.tenantId,
        amount: montant,
        method: safeMethod,
        status: 'PAID',
        paymentDate: new Date(),
      }, { transaction: t });

      // Mettre à jour l'échéance
      await ech.update({ statut: 'PAYE', paidAt: new Date(), saleId: sale.id }, { transaction: t });

      // Générer la prochaine échéance si l'abonnement est actif
      if (ech.abonnement?.isActive) {
        const nextDate = nextDateEcheance(ech.abonnement.periodicite, ech.dateEcheance);
        const fin = ech.abonnement.dateFin;
        if (!fin || nextDate <= fin) {
          const alreadyExists = await EcheancePaiement.findOne({
            where: { abonnementId: ech.abonnementId, dateEcheance: nextDate },
            transaction: t,
          });
          if (!alreadyExists) {
            await EcheancePaiement.create({
              tenantId: req.user.tenantId,
              abonnementId: ech.abonnementId,
              eleveId: ech.eleveId,
              serviceId: ech.serviceId,
              montant: ech.montant,
              dateEcheance: nextDate,
              periodeLabel: periodeLabel(ech.abonnement.periodicite, nextDate),
              statut: 'EN_ATTENTE',
            }, { transaction: t });
          }
        }
      }

      await t.commit();
      return res.json({ echeance: ech, saleId: sale.id });
    } catch (err) {
      await t.rollback();
      console.error('[AbonnementController.payEcheance]', err);
      return res.status(500).json({ error: 'PayError', message: err.message });
    }
  }

  // ── Envoyer une relance ──────────────────────────────────────────────────
  static async sendReminder(req, res) {
    try {
      const { echeanceIds, canal = 'WHATSAPP' } = req.body; // canal: 'EMAIL' | 'WHATSAPP'
      if (!echeanceIds?.length)
        return res.status(400).json({ error: 'MissingIds', message: 'Aucune échéance sélectionnée.' });

      const echeances = await EcheancePaiement.findAll({
        where: { id: echeanceIds, tenantId: req.user.tenantId },
        include: [
          { model: Eleve, as: 'eleve', attributes: ['nom', 'prenom', 'parent1', 'whatsappPrincipal'] },
          { model: Service, as: 'service', attributes: ['name'] },
        ],
      });

      let sent = 0;
      for (const ech of echeances) {
        const eleve = ech.eleve;
        if (!eleve) continue;

        const parentNom = eleve.parent1?.prenom ? `${eleve.parent1.prenom} ${eleve.parent1.nom || ''}`.trim() : 'Parent';
        const montantFmt = parseFloat(ech.montant).toLocaleString('fr-FR');
        const dateFmt = new Date(ech.dateEcheance).toLocaleDateString('fr-FR');

        const message = `Bonjour ${parentNom},\n\nNous vous rappelons qu'une redevance de *${montantFmt} F CFA* pour *${ech.service?.name || 'scolarité'}* (${ech.periodeLabel}) est due le ${dateFmt} pour l'élève *${eleve.prenom} ${eleve.nom}*.\n\nMerci de vous en acquitter auprès de notre caisse.\n\n_Le Toit des Anges_`;

        const recipient = canal === 'EMAIL'
          ? eleve.parent1?.email
          : (eleve.whatsappPrincipal || eleve.parent1?.whatsapp || eleve.parent1?.telephone);

        if (recipient) {
          await NotificationService.send(canal, recipient, {
            subject: `Relance redevance — ${eleve.prenom} ${eleve.nom}`,
            message,
          });
          await ech.update({ reminderSentAt: new Date() });
          sent++;
        }
      }

      return res.json({ sent, total: echeances.length });
    } catch (err) {
      console.error('[AbonnementController.sendReminder]', err);
      return res.status(500).json({ error: 'ReminderError', message: err.message });
    }
  }

  // ── Générer la facture mensuelle d'un élève ──────────────────────────────
  static async factureEleve(req, res) {
    try {
      const { eleveId } = req.params;
      const { month, year } = req.query;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();

      const from = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const to   = new Date(y, m, 0).toISOString().split('T')[0];

      const eleve = await Eleve.findOne({ where: { id: eleveId, tenantId: req.user.tenantId } });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });

      const echeances = await EcheancePaiement.findAll({
        where: { eleveId, tenantId: req.user.tenantId, dateEcheance: { [Op.between]: [from, to] } },
        include: [{ model: Service, as: 'service', attributes: ['name', 'typeOffre'] }],
        order: [['dateEcheance', 'ASC']],
      });

      const totalDu = echeances.reduce((s, e) => s + parseFloat(e.montant), 0);
      const totalPaye = echeances.filter(e => e.statut === 'PAYE').reduce((s, e) => s + parseFloat(e.montant), 0);
      const solde = totalDu - totalPaye;

      return res.json({
        eleve: eleve.toJSON(),
        mois: `${String(m).padStart(2,'0')}/${y}`,
        echeances: echeances.map(e => e.toJSON()),
        totalDu,
        totalPaye,
        solde,
      });
    } catch (err) {
      console.error('[AbonnementController.factureEleve]', err);
      return res.status(500).json({ error: 'FactureError', message: err.message });
    }
  }

  // ── Cron : générer les échéances du jour + envoyer rappels J-5 ──────────
  static async cronGenerateEcheances(tenantId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const abos = await AbonnementEleve.findAll({
        where: { tenantId, isActive: true },
      });

      for (const abo of abos) {
        // Trouver la dernière échéance
        const derniere = await EcheancePaiement.findOne({
          where: { abonnementId: abo.id },
          order: [['dateEcheance', 'DESC']],
        });
        if (!derniere) continue;

        // Calculer la prochaine date
        const nextDate = nextDateEcheance(abo.periodicite, derniere.dateEcheance);
        if (nextDate > today) continue; // Pas encore due
        if (abo.dateFin && nextDate > abo.dateFin) continue;

        const exists = await EcheancePaiement.findOne({
          where: { abonnementId: abo.id, dateEcheance: nextDate },
        });
        if (exists) continue;

        await EcheancePaiement.create({
          tenantId,
          abonnementId: abo.id,
          eleveId: abo.eleveId,
          serviceId: abo.serviceId,
          montant: abo.montant,
          dateEcheance: nextDate,
          periodeLabel: periodeLabel(abo.periodicite, nextDate),
          statut: 'EN_ATTENTE',
        });
      }

      // Marquer EN_RETARD les échéances dépassées
      await EcheancePaiement.update(
        { statut: 'EN_RETARD' },
        { where: { tenantId, statut: 'EN_ATTENTE', dateEcheance: { [Op.lt]: today } } }
      );

      // Rappels J-5
      const jMinus5 = new Date();
      jMinus5.setDate(jMinus5.getDate() + 5);
      const j5Date = jMinus5.toISOString().split('T')[0];

      const aEnvoyer = await EcheancePaiement.findAll({
        where: {
          tenantId,
          statut: 'EN_ATTENTE',
          dateEcheance: j5Date,
          reminderSentAt: null,
        },
        include: [
          { model: Eleve, as: 'eleve', attributes: ['nom', 'prenom', 'parent1', 'whatsappPrincipal'] },
          { model: Service, as: 'service', attributes: ['name'] },
        ],
      });

      for (const ech of aEnvoyer) {
        const eleve = ech.eleve;
        if (!eleve) continue;
        const parentNom = eleve.parent1?.prenom ? `${eleve.parent1.prenom} ${eleve.parent1.nom || ''}`.trim() : 'Parent';
        const montantFmt = parseFloat(ech.montant).toLocaleString('fr-FR');
        const dateFmt = new Date(ech.dateEcheance).toLocaleDateString('fr-FR');
        const canal = 'WHATSAPP';
        const recipient = eleve.whatsappPrincipal || eleve.parent1?.whatsapp || eleve.parent1?.telephone;
        if (!recipient) continue;

        await NotificationService.send(canal, recipient, {
          subject: `Rappel redevance — ${eleve.prenom} ${eleve.nom}`,
          message: `Bonjour ${parentNom}, votre redevance de *${montantFmt} F CFA* (${ech.service?.name || 'scolarité'} — ${ech.periodeLabel}) est due dans 5 jours, le ${dateFmt}.\n\n_Le Toit des Anges_`,
        });
        await ech.update({ reminderSentAt: new Date() });
      }

      console.log(`[CRON] Échéances générées — ${abos.length} abonnements traités, ${aEnvoyer.length} rappels envoyés`);
    } catch (err) {
      console.error('[CRON.cronGenerateEcheances]', err);
    }
  }
}
