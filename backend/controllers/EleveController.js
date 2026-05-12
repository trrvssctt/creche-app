import { Eleve, Classe, Sale, SaleItem, Payment } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

const PREFIX_MAP = {
  CRECHE: 'CR', PS: 'PS', MS: 'MS', GS: 'GS',
  CP: 'CP', CE1: 'C1', CE2: 'C2', CM1: 'M1', CM2: 'M2',
};

function genMatricule(niveau) {
  const year = new Date().getFullYear();
  const rand = String(Date.now()).slice(-4);
  return `${PREFIX_MAP[niveau] || 'EL'}-${year}-${rand}`;
}

export class EleveController {
  static async list(req, res) {
    try {
      const { niveau, statut, anneeScolaire, search } = req.query;
      const where = { tenantId: req.user.tenantId };
      if (niveau)        where.niveau = niveau;
      if (statut)        where.statut = statut;
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;
      if (search) {
        where[Op.or] = [
          { nom:       { [Op.iLike]: `%${search}%` } },
          { prenom:    { [Op.iLike]: `%${search}%` } },
          { matricule: { [Op.iLike]: `%${search}%` } },
        ];
      }
      const eleves = await Eleve.findAll({
        where,
        order: [['nom', 'ASC'], ['prenom', 'ASC']],
      });
      return res.json(eleves);
    } catch (err) {
      return res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      return res.json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'GetError', message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = { ...req.body, tenantId: req.user.tenantId };
      if (!payload.matricule) {
        payload.matricule = genMatricule(payload.niveau || 'PS');
      }

      if (payload.classeId) {
        const classe = await Classe.findOne({ where: { id: payload.classeId, tenantId: req.user.tenantId } });
        if (classe) {
          const nb = await Eleve.count({ where: { classeId: classe.id, tenantId: req.user.tenantId } });
          if (nb >= classe.capaciteMax) {
            return res.status(400).json({ error: 'ClasseFull', message: `La classe "${classe.nom}" est complète (${nb}/${classe.capaciteMax} élèves).` });
          }
        }
      }

      const eleve = await Eleve.create(payload);
      return res.status(201).json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'CreateError', message: err.message });
    }
  }

  static async update(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });

      const newClasseId = req.body.classeId;
      if (newClasseId && newClasseId !== String(eleve.classeId)) {
        const classe = await Classe.findOne({ where: { id: newClasseId, tenantId: req.user.tenantId } });
        if (classe) {
          const nb = await Eleve.count({ where: { classeId: classe.id, tenantId: req.user.tenantId } });
          if (nb >= classe.capaciteMax) {
            return res.status(400).json({ error: 'ClasseFull', message: `La classe "${classe.nom}" est complète (${nb}/${classe.capaciteMax} élèves).` });
          }
        }
      }

      await eleve.update(req.body);
      return res.json(eleve);
    } catch (err) {
      return res.status(500).json({ error: 'UpdateError', message: err.message });
    }
  }

  // ── Enregistrer le paiement des frais d'inscription ────────────────────
  static async factureInscription(req, res) {
    const t = await sequelize.transaction();
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        transaction: t,
      });
      if (!eleve) { await t.rollback(); return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' }); }

      const { services, methodePaiement: rawMethod } = req.body;
      if (!Array.isArray(services) || services.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'NoServices', message: 'Aucun service fourni.' });
      }

      const VALID_METHODS = ['CASH', 'ORANGE_MONEY', 'WAVE', 'MTN_MOMO', 'STRIPE', 'TRANSFER', 'CHEQUE'];
      const methodePaiement = VALID_METHODS.includes(rawMethod) ? rawMethod : 'CASH';

      const RECURRING = ['MENSUALITE', 'BUS', 'CANTINE'];

      // Séparer frais d'inscription (payés maintenant) des services récurrents
      const feeServices = services.filter(s => {
        const type = (s.typeOffre || s.type_offre || '').toUpperCase();
        return !RECURRING.includes(type);
      });
      const recurringServices = services.filter(s => {
        const type = (s.typeOffre || s.type_offre || '').toUpperCase();
        return RECURRING.includes(type);
      });

      if (feeServices.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'NoFees', message: 'Aucun frais d\'inscription trouvé dans les services fournis.' });
      }

      const totalHt = feeServices.reduce((s, svc) => s + Number(svc.price), 0);
      const ref = `REC-INSC-${(eleve.matricule || Date.now().toString(36)).replace(/-/g, '').toUpperCase()}`;

      // Créer la vente (entièrement réglée)
      const sale = await Sale.create({
        tenantId: req.user.tenantId,
        reference: ref,
        walkinName: `${eleve.prenom} ${eleve.nom}`,
        walkinPhone: eleve.parent1?.whatsapp || eleve.parent1?.telephone || null,
        status: 'TERMINE',
        totalHt,
        totalTtc: totalHt,
        taxAmount: 0,
        amountPaid: totalHt,
        saleDate: new Date(),
      }, { transaction: t });

      for (const svc of feeServices) {
        await SaleItem.create({
          saleId: sale.id,
          serviceId: svc.id || null,
          description: svc.name || 'Frais d\'inscription',
          quantity: 1,
          unitPrice: Number(svc.price),
          totalPrice: Number(svc.price),
        }, { transaction: t });
      }

      // Enregistrer le paiement
      const payment = await Payment.create({
        saleId: sale.id,
        tenantId: req.user.tenantId,
        amount: totalHt,
        method: methodePaiement,
        status: 'PAID',
        paymentDate: new Date(),
      }, { transaction: t });

      await t.commit();

      return res.status(201).json({
        sale: sale.toJSON(),
        payment: payment.toJSON(),
        eleve: eleve.toJSON(),
        recurringServices,
      });
    } catch (err) {
      await t.rollback();
      console.error('[EleveController.factureInscription]', err);
      return res.status(500).json({ error: 'FactureError', message: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });
      await eleve.destroy();
      return res.json({ message: 'Élève supprimé.' });
    } catch (err) {
      return res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}
