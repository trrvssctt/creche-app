import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import {
  AbonnementEleve, EcheancePaiement, Eleve, Service, Sale, SaleItem, Payment,
  Invoice, InvoiceItem,
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

function genInvoiceId() {
  return 'FAC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
}

const SAFE_METHODS = ['CASH', 'ORANGE_MONEY', 'WAVE', 'MTN_MOMO', 'STRIPE', 'TRANSFER', 'CHEQUE'];

// Crée Sale + SaleItems + Payment + Invoice + InvoiceItems pour une liste d'échéances
async function createPaymentBundle({ tenantId, echeances, methodePaiement, eleve }, t) {
  const total = echeances.reduce((s, e) => s + parseFloat(e.montant), 0);
  const safeMethod = SAFE_METHODS.includes(methodePaiement) ? methodePaiement : 'CASH';

  const sale = await Sale.create({
    tenantId,
    reference: genRef(),
    status: 'TERMINE',
    totalHt: total,
    totalTtc: total,
    taxAmount: 0,
    amountPaid: total,
    saleDate: new Date(),
    walkinName: eleve ? `${eleve.prenom} ${eleve.nom}` : null,
  }, { transaction: t });

  for (const ech of echeances) {
    const m = parseFloat(ech.montant);
    await SaleItem.create({
      saleId: sale.id,
      serviceId: ech.serviceId,
      quantity: 1,
      unitPrice: m,
      taxRate: 0,
      totalTtc: m,
    }, { transaction: t });
  }

  await Payment.create({
    saleId: sale.id,
    tenantId,
    amount: total,
    method: safeMethod,
    status: 'PAID',
    paymentDate: new Date(),
  }, { transaction: t });

  const invoiceId = genInvoiceId();
  const eleveLabel = eleve ? `${eleve.prenom} ${eleve.nom}` : 'Élève';
  await Invoice.create({
    id: invoiceId,
    tenantId,
    saleId: sale.id,
    invoiceDate: new Date(),
    amount: total,
    taxAmount: 0,
    currency: 'F CFA',
    status: 'PAID',
    type: 'REDEVANCE',
  }, { transaction: t });

  for (const ech of echeances) {
    await InvoiceItem.create({
      invoiceId,
      name: `${ech.service?.name || 'Redevance'} — ${ech.periodeLabel || ''} · ${eleveLabel}`,
      qty: 1,
      price: parseFloat(ech.montant),
      tva: 0,
    }, { transaction: t });
  }

  return { sale, invoiceId };
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

  // ── Payer une échéance → Sale + Invoice + reçu ─────────────────────────
  static async payEcheance(req, res) {
    const t = await sequelize.transaction();
    try {
      const ech = await EcheancePaiement.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: [
          { model: Eleve,           as: 'eleve' },
          { model: Service,         as: 'service' },
          { model: AbonnementEleve, as: 'abonnement' },
        ],
      });
      if (!ech) return res.status(404).json({ error: 'NotFound', message: 'Échéance introuvable.' });
      if (ech.statut === 'PAYE') return res.status(400).json({ error: 'AlreadyPaid', message: 'Déjà payée.' });

      const { methodePaiement = 'CASH' } = req.body;

      const { sale, invoiceId } = await createPaymentBundle({
        tenantId: req.user.tenantId,
        echeances: [ech],
        methodePaiement,
        eleve: ech.eleve,
      }, t);

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
      return res.json({ echeance: ech, saleId: sale.id, invoiceId });
    } catch (err) {
      await t.rollback();
      console.error('[AbonnementController.payEcheance]', err);
      return res.status(500).json({ error: 'PayError', message: err.message });
    }
  }

  // ── Payer toutes les échéances en attente d'un élève ────────────────────
  static async payAllEleve(req, res) {
    const t = await sequelize.transaction();
    try {
      const { eleveId } = req.params;
      const { methodePaiement = 'CASH' } = req.body;

      const echeances = await EcheancePaiement.findAll({
        where: {
          eleveId,
          tenantId: req.user.tenantId,
          statut: { [Op.in]: ['EN_ATTENTE', 'EN_RETARD'] },
        },
        include: [
          { model: Eleve,   as: 'eleve' },
          { model: Service, as: 'service' },
          { model: AbonnementEleve, as: 'abonnement' },
        ],
        order: [['dateEcheance', 'ASC']],
      });

      if (!echeances.length)
        return res.status(400).json({ error: 'NoDue', message: 'Aucune échéance à payer pour cet élève.' });

      const eleve = echeances[0].eleve;

      const { sale, invoiceId } = await createPaymentBundle({
        tenantId: req.user.tenantId,
        echeances,
        methodePaiement,
        eleve,
      }, t);

      for (const ech of echeances) {
        await ech.update({ statut: 'PAYE', paidAt: new Date(), saleId: sale.id }, { transaction: t });

        if (ech.abonnement?.isActive) {
          const nextDate = nextDateEcheance(ech.abonnement.periodicite, ech.dateEcheance);
          const fin = ech.abonnement.dateFin;
          if (!fin || nextDate <= fin) {
            const exists = await EcheancePaiement.findOne({
              where: { abonnementId: ech.abonnementId, dateEcheance: nextDate },
              transaction: t,
            });
            if (!exists) {
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
      }

      await t.commit();
      return res.json({ count: echeances.length, saleId: sale.id, invoiceId });
    } catch (err) {
      await t.rollback();
      console.error('[AbonnementController.payAllEleve]', err);
      return res.status(500).json({ error: 'PayAllError', message: err.message });
    }
  }

  // ── Payer une sélection d'échéances (ex: Cantine + Bus) ────────────────
  static async paySelection(req, res) {
    const t = await sequelize.transaction();
    try {
      const { echeanceIds, methodePaiement = 'CASH' } = req.body;
      if (!Array.isArray(echeanceIds) || echeanceIds.length === 0)
        return res.status(400).json({ error: 'MissingIds', message: 'Aucune échéance sélectionnée.' });

      const echeances = await EcheancePaiement.findAll({
        where: {
          id: { [Op.in]: echeanceIds },
          tenantId: req.user.tenantId,
          statut: { [Op.in]: ['EN_ATTENTE', 'EN_RETARD'] },
        },
        include: [
          { model: Eleve,   as: 'eleve' },
          { model: Service, as: 'service' },
          { model: AbonnementEleve, as: 'abonnement' },
        ],
        order: [['dateEcheance', 'ASC']],
      });

      if (!echeances.length)
        return res.status(400).json({ error: 'NoDue', message: 'Aucune échéance payable dans la sélection.' });

      const eleve = echeances[0].eleve;

      const { sale, invoiceId } = await createPaymentBundle({
        tenantId: req.user.tenantId,
        echeances,
        methodePaiement,
        eleve,
      }, t);

      for (const ech of echeances) {
        await ech.update({ statut: 'PAYE', paidAt: new Date(), saleId: sale.id }, { transaction: t });

        if (ech.abonnement?.isActive) {
          const nextDate = nextDateEcheance(ech.abonnement.periodicite, ech.dateEcheance);
          const fin = ech.abonnement.dateFin;
          if (!fin || nextDate <= fin) {
            const exists = await EcheancePaiement.findOne({
              where: { abonnementId: ech.abonnementId, dateEcheance: nextDate },
              transaction: t,
            });
            if (!exists) {
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
      }

      await t.commit();
      return res.json({
        count: echeances.length,
        saleId: sale.id,
        invoiceId,
        total: echeances.reduce((s, e) => s + parseFloat(e.montant), 0),
      });
    } catch (err) {
      await t.rollback();
      console.error('[AbonnementController.paySelection]', err);
      return res.status(500).json({ error: 'PaySelectionError', message: err.message });
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
  // Logique : chercher les EcheancePaiement enregistrées pour le mois donné.
  // Si aucune n'existe encore (mois futur ou cron pas encore passé), calculer
  // les montants à la volée depuis les AbonnementEleve actifs de l'élève.
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

      // ── 1. Chercher les échéances déjà enregistrées pour ce mois ────────
      let echeances = await EcheancePaiement.findAll({
        where: { eleveId, tenantId: req.user.tenantId, dateEcheance: { [Op.between]: [from, to] } },
        include: [{ model: Service, as: 'service', attributes: ['name', 'typeOffre'] }],
        order: [['dateEcheance', 'ASC']],
      });

      // ── 2. Fallback niveau 2 : aucune échéance → calculer depuis abonnements actifs ──
      if (echeances.length === 0) {
        const abos = await AbonnementEleve.findAll({
          where: { tenantId: req.user.tenantId, eleveId, isActive: true },
          include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'typeOffre'] }],
        });

        if (abos.length > 0) {
          echeances = abos.map(abo => ({
            id: null,
            abonnementId: abo.id,
            eleveId,
            serviceId: abo.serviceId,
            service:      abo.service ? abo.service.toJSON() : null,
            montant:      abo.montant,
            dateEcheance: from,
            periodeLabel: periodeLabel(abo.periodicite || 'MENSUEL', from),
            statut:  'EN_ATTENTE',
            virtuelle: true,
          }));
        } else {
          // ── 3. Fallback niveau 3 : aucun abonnement → calculer depuis les services applicables ──
          // Couvre le cas où la synchronisation n'a pas encore été lancée.
          const RECURRING = ['MENSUALITE', 'BUS', 'CANTINE'];
          const allSvcs = await Service.findAll({
            where: {
              tenantId: req.user.tenantId,
              status: 'actif',
              typeOffre: { [Op.in]: RECURRING },
              [Op.or]: [
                { anneeScolaire: eleve.anneeScolaire || null },
                { anneeScolaire: null },
              ],
            },
          });

          const remisePct = parseFloat(eleve.remisePct || 0);
          const pl = periodeLabel('MENSUEL', from);

          const applicable = allSvcs.filter(svc => {
            const type    = svc.typeOffre?.toUpperCase();
            const niveaux = Array.isArray(svc.niveauxCibles) ? svc.niveauxCibles : [];
            if (type === 'CANTINE' && !eleve.cantine)      return false;
            if (type === 'BUS'     && !eleve.transportBus)  return false;
            if (niveaux.length === 0) return false;
            return niveaux.includes(eleve.niveau);
          });

          echeances = applicable.map(svc => {
            const prixBase = parseFloat(svc.price || 0);
            const montant  = remisePct > 0 ? Math.round(prixBase * (1 - remisePct / 100)) : prixBase;
            return {
              id: null,
              abonnementId: null,
              eleveId,
              serviceId:    svc.id,
              service:      svc.toJSON(),
              montant,
              dateEcheance: from,
              periodeLabel: pl,
              statut:  'EN_ATTENTE',
              virtuelle: true,
            };
          });
        }
      }

      const serialize = e => (typeof e.toJSON === 'function' ? e.toJSON() : e);

      const totalDu   = echeances.reduce((s, e) => s + parseFloat(e.montant || 0), 0);
      const totalPaye = echeances.filter(e => e.statut === 'PAYE').reduce((s, e) => s + parseFloat(e.montant || 0), 0);
      const solde     = totalDu - totalPaye;

      return res.json({
        eleve: eleve.toJSON(),
        mois: `${String(m).padStart(2,'0')}/${y}`,
        echeances: echeances.map(serialize),
        totalDu,
        totalPaye,
        solde,
      });
    } catch (err) {
      console.error('[AbonnementController.factureEleve]', err);
      return res.status(500).json({ error: 'FactureError', message: err.message });
    }
  }

  // ── Synchronisation mensuelle : abonnements + échéances pour tous les élèves ──
  static async syncMensuel(req, res) {
    const tenantId = req.user.tenantId;
    const now = new Date();
    const m = parseInt(req.body.month) || now.getMonth() + 1;
    const y = parseInt(req.body.year)  || now.getFullYear();

    const from  = new Date(y, m - 1, 1).toISOString().split('T')[0]; // 1er du mois
    const to    = new Date(y, m,     0).toISOString().split('T')[0]; // dernier du mois
    const today = now.toISOString().split('T')[0];
    const RECURRING = ['MENSUALITE', 'BUS', 'CANTINE'];

    try {
      // 1 — Services récurrents actifs du tenant
      const services = await Service.findAll({
        where: { tenantId, status: 'actif', typeOffre: { [Op.in]: RECURRING }, deletedAt: null },
      });

      if (!services.length)
        return res.json({ message: 'Aucun service récurrent configuré.', elevesTraites: 0, abonnementsCreated: 0, echeancesCreated: 0 });

      // 2 — Tous les élèves INSCRIT/ACTIF
      const eleves = await Eleve.findAll({
        where: { tenantId, statut: { [Op.in]: ['INSCRIT', 'ACTIF'] } },
        attributes: ['id', 'niveau', 'anneeScolaire', 'regimeFinancier', 'remisePct', 'cantine', 'transportBus'],
      });

      let abosCreated = 0;
      let echCreated  = 0;
      let skipped     = 0;

      for (const eleve of eleves) {
        // Exonéré total → pas de facturation
        if (eleve.regimeFinancier === 'CAS_SOCIAL_TOTAL') { skipped++; continue; }

        const remisePct = parseFloat(eleve.remisePct || 0);

        // Filtrer les services applicables à cet élève
        const applicable = services.filter(svc => {
          const type    = (svc.typeOffre || '').toUpperCase();
          const niveaux = Array.isArray(svc.niveauxCibles) ? svc.niveauxCibles : [];

          if (type === 'CANTINE' && !eleve.cantine)     return false;
          if (type === 'BUS'     && !eleve.transportBus) return false;

          // Filtre niveau (vide ou 'TOUS' = tous niveaux)
          if (niveaux.length > 0 && !niveaux.includes('TOUS') && !niveaux.includes(eleve.niveau)) return false;

          return true;
        });

        for (const svc of applicable) {
          const prixBase = parseFloat(svc.price || 0);
          const montant  = remisePct > 0 ? Math.round(prixBase * (1 - remisePct / 100)) : prixBase;

          // Trouver ou créer l'abonnement actif
          let [abo, createdAbo] = await AbonnementEleve.findOrCreate({
            where: { tenantId, eleveId: eleve.id, serviceId: svc.id, isActive: true },
            defaults: {
              tenantId, eleveId: eleve.id, serviceId: svc.id,
              periodicite: 'MENSUEL',
              montant,
              dateDebut: from,
              isActive: true,
            },
          });
          if (createdAbo) abosCreated++;

          // Vérifier si une échéance existe déjà pour ce mois
          const existingEch = await EcheancePaiement.findOne({
            where: {
              abonnementId: abo.id,
              tenantId,
              dateEcheance: { [Op.between]: [from, to] },
            },
          });

          if (!existingEch) {
            await EcheancePaiement.create({
              tenantId,
              abonnementId: abo.id,
              eleveId:   eleve.id,
              serviceId: svc.id,
              montant,
              dateEcheance: from,
              periodeLabel: periodeLabel('MENSUEL', from),
              statut: 'EN_ATTENTE',
            });
            echCreated++;
          }
        }
      }

      // Marquer EN_RETARD les échéances dépassées
      await EcheancePaiement.update(
        { statut: 'EN_RETARD' },
        { where: { tenantId, statut: 'EN_ATTENTE', dateEcheance: { [Op.lt]: today } } }
      );

      return res.json({
        message: 'Synchronisation terminée.',
        elevesTraites:     eleves.length - skipped,
        elevesExoneres:    skipped,
        abonnementsCreated: abosCreated,
        echeancesCreated:  echCreated,
        mois: `${String(m).padStart(2, '0')}/${y}`,
      });
    } catch (err) {
      console.error('[AbonnementController.syncMensuel]', err);
      return res.status(500).json({ error: 'SyncError', message: err.message });
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
