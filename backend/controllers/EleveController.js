import { Eleve, Classe, Sale, SaleItem, Payment, Service, AbonnementEleve, EcheancePaiement, Tenant } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { isTeacher, getTeacherClassIds } from '../utils/teacherGuard.js';
import { findDuplicateEleve, duplicateMessage } from '../utils/eleveDedup.js';
import { EmailService } from '../services/EmailService.js';
import { PdfReceiptService } from '../services/PdfReceiptService.js';

// ── Création automatique des abonnements à l'inscription ────────────────────
// Cherche les offres (MENSUALITE/BUS/CANTINE) applicables au niveau/options de
// l'élève et crée un AbonnementEleve + première EcheancePaiement pour chacune.
// Idempotent : vérifie les doublons avant de créer. Ne lève jamais d'exception
// pour ne pas bloquer la réponse de l'endpoint qui l'appelle.
async function createAbonnementsAuto(tenantId, eleve) {
  try {
    // Si l'élève a déjà des abonnements (configurés via le batch frontend), ne rien faire
    const existingCount = await AbonnementEleve.count({ where: { tenantId, eleveId: eleve.id, isActive: true } });
    if (existingCount > 0) return;

    const RECURRING = ['MENSUALITE', 'BUS', 'CANTINE'];

    // Charger les offres récurrentes actives pour ce tenant + année scolaire
    const services = await Service.findAll({
      where: {
        tenantId,
        status: 'actif',
        typeOffre: { [Op.in]: RECURRING },
        [Op.or]: [
          { anneeScolaire: eleve.anneeScolaire || null },
          { anneeScolaire: null },
        ],
      },
    });

    // Filtrer par niveau / options de l'élève
    const applicable = services.filter(svc => {
      const type    = svc.typeOffre?.toUpperCase();
      const niveaux = Array.isArray(svc.niveauxCibles) ? svc.niveauxCibles : [];

      if (type === 'CANTINE' && !eleve.cantine)      return false;
      if (type === 'BUS'     && !eleve.transportBus)  return false;
      // niveauxCibles vide → offre générale non liée à un niveau, on l'exclut
      // (ce cas correspond aux frais ponctuels, pas aux mensualités)
      if (niveaux.length === 0) return false;
      if (!niveaux.includes(eleve.niveau)) return false;
      return true;
    });

    if (applicable.length === 0) return;

    // Date de début : 1er du mois courant
    const now      = new Date();
    const dateDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const moisLabel = new Date(dateDebut).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const periodeLabel = moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

    // Remise cas social
    const remisePct = parseFloat(eleve.remisePct || 0);

    for (const svc of applicable) {
      // Idempotence : ne pas créer si un abonnement actif existe déjà
      const existing = await AbonnementEleve.findOne({
        where: { tenantId, eleveId: eleve.id, serviceId: svc.id, isActive: true },
      });
      if (existing) continue;

      const prixBase = parseFloat(svc.price || 0);
      const montant  = remisePct > 0 ? Math.round(prixBase * (1 - remisePct / 100)) : prixBase;

      const abo = await AbonnementEleve.create({
        tenantId,
        eleveId:    eleve.id,
        serviceId:  svc.id,
        periodicite: 'MENSUEL',
        montant,
        dateDebut,
        isActive: true,
      });

      await EcheancePaiement.create({
        tenantId,
        abonnementId: abo.id,
        eleveId:      eleve.id,
        serviceId:    svc.id,
        montant,
        dateEcheance: dateDebut,
        periodeLabel,
        statut: 'EN_ATTENTE',
      });
    }
  } catch (err) {
    // Ne jamais bloquer l'inscription à cause des abonnements
    console.error('[EleveController] createAbonnementsAuto error:', err.message);
  }
}

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
      if (niveau) where.niveau = niveau;
      if (statut) where.statut = statut;

      const andConditions = [];

      if (anneeScolaire) {
        andConditions.push({ anneeScolaire });
      }

      if (search) {
        andConditions.push({
          [Op.or]: [
            { nom:       { [Op.iLike]: `%${search}%` } },
            { prenom:    { [Op.iLike]: `%${search}%` } },
            { matricule: { [Op.iLike]: `%${search}%` } },
          ],
        });
      }

      if (andConditions.length > 0) where[Op.and] = andConditions;

      // Enseignant/Maîtresse : limiter aux élèves de leurs classes (prof principal + intervenant)
      if (isTeacher(req)) {
        if (!req.user.employeeId) {
          return res.status(403).json({ error: 'NoEmployee', message: 'Aucun employé lié à ce compte enseignant.' });
        }
        const classeIds = await getTeacherClassIds(req.user.tenantId, req.user.employeeId);
        if (classeIds.length === 0) return res.json([]);
        where.classeId = { [Op.in]: classeIds };
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

      // Enseignant : vérifier que l'élève est dans une de ses classes
      if (isTeacher(req)) {
        if (!req.user.employeeId) {
          return res.status(403).json({ error: 'Forbidden', message: 'Aucun employé lié à ce compte enseignant.' });
        }
        const classeIds = await getTeacherClassIds(req.user.tenantId, req.user.employeeId);
        if (!eleve.classeId || !classeIds.includes(String(eleve.classeId))) {
          return res.status(403).json({ error: 'Forbidden', message: 'Accès refusé à cet élève.' });
        }
      }

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

      // Anti-doublon : même enfant (nom + prénom + date de naissance) déjà présent pour la même année
      const dup = await findDuplicateEleve({
        tenantId: req.user.tenantId,
        nom: payload.nom, prenom: payload.prenom,
        dateNaissance: payload.dateNaissance,
        anneeScolaire: payload.anneeScolaire,
      });
      if (dup) {
        return res.status(409).json({ error: 'Duplicate', message: duplicateMessage(dup) });
      }

      if (payload.classeId) {
        const classe = await Classe.findOne({ where: { id: payload.classeId, tenantId: req.user.tenantId } });
        if (classe) {
          const nb = await Eleve.count({ where: { classeId: classe.id, tenantId: req.user.tenantId, anneeScolaire: payload.anneeScolaire } });
          if (nb >= classe.capaciteMax) {
            return res.status(400).json({ error: 'ClasseFull', message: `La classe "${classe.nom}" est complète (${nb}/${classe.capaciteMax} élèves).` });
          }
        }
      }

      const eleve = await Eleve.create(payload);

      // Si l'élève est inscrit/actif et affecté à une classe → créer les abonnements
      if (['INSCRIT', 'ACTIF'].includes(eleve.statut) && eleve.classeId) {
        await createAbonnementsAuto(req.user.tenantId, eleve);
      }

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
          const anneeScolaire = req.body.anneeScolaire || eleve.anneeScolaire;
          const nb = await Eleve.count({ where: { classeId: classe.id, tenantId: req.user.tenantId, anneeScolaire } });
          if (nb >= classe.capaciteMax) {
            return res.status(400).json({ error: 'ClasseFull', message: `La classe "${classe.nom}" est complète (${nb}/${classe.capaciteMax} élèves).` });
          }
        }
      }

      const statutAvant = eleve.statut;
      await eleve.update(req.body);

      // Transition vers INSCRIT ou ACTIF : créer les abonnements s'ils n'existent pas
      const statutApres = eleve.statut;
      if (
        !['INSCRIT', 'ACTIF'].includes(statutAvant) &&
        ['INSCRIT', 'ACTIF'].includes(statutApres) &&
        eleve.classeId
      ) {
        await createAbonnementsAuto(req.user.tenantId, eleve);
      }

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

      const VALID_METHODS = ['CASH', 'ORANGE_MONEY', 'OM', 'WAVE', 'FREE', 'MTN_MOMO', 'STRIPE', 'TRANSFER', 'VIREMENT', 'CHEQUE'];
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

      // Remise cas social : CAS_SOCIAL_TOTAL = gratuité complète, sinon remisePct de l'élève
      // (même logique que les abonnements mensuels dans AbonnementController)
      const remisePct = eleve.regimeFinancier === 'CAS_SOCIAL_TOTAL'
        ? 100
        : parseFloat(eleve.remisePct || 0);
      const applyRemise = (prix) => remisePct > 0
        ? Math.round(Number(prix) * (1 - remisePct / 100))
        : Number(prix);

      const totalHt = feeServices.reduce((s, svc) => s + applyRemise(svc.price), 0);
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
        const prixRemise = applyRemise(svc.price);
        await SaleItem.create({
          saleId: sale.id,
          serviceId: svc.id || null,
          quantity: 1,
          unitPrice: prixRemise,
          taxRate: 0,
          totalTtc: prixRemise,
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

      // Envoyer la facture d'inscription par email au parent avec PDF en pièce jointe
      const parentEmail = eleve.parent1?.email;
      if (parentEmail) {
        try {
          const tenant = await Tenant.findByPk(req.user.tenantId, { attributes: ['name', 'logoUrl', 'address', 'phone', 'email'] });
          const ecoleNom = tenant?.name || "L'école";
          const parentName = [eleve.parent1?.prenom, eleve.parent1?.nom].filter(Boolean).join(' ') || 'Parent';
          const parentTel = eleve.parent1?.telephone || eleve.parent1?.whatsapp || '';
          const enfantNom = `${eleve.prenom} ${eleve.nom}`.trim();
          const dateFmt = new Date().toLocaleDateString('fr-FR');

          const pdfLignes = feeServices.map(svc => ({
            label: `${svc.name}${remisePct > 0 ? ` (remise ${remisePct}%)` : ''}`,
            periode: '',
            echeance: dateFmt,
            montant: applyRemise(svc.price),
            statut: 'Payé',
          }));

          const pdfBuffer = await PdfReceiptService.generateReceipt({
            ecoleNom,
            ecoleAdresse: tenant?.address || '',
            ecoleTel: tenant?.phone || '',
            ecoleEmail: tenant?.email || '',
            logoUrl: tenant?.logoUrl || '',
            parentName,
            parentTel,
            enfantNom,
            matricule: eleve.matricule || '',
            classe: '',
            niveau: eleve.niveau || '',
            reference: ref,
            type: "Reçu — Frais d'inscription",
            date: dateFmt,
            periode: '',
            currency: 'F CFA',
            lignes: pdfLignes,
            totalDu: totalHt,
            totalPaye: totalHt,
            soldeRestant: 0,
            isPaid: true,
          });

          const lignes = feeServices.map(svc => {
            const prix = applyRemise(svc.price);
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;color:#475569">${svc.name}${remisePct > 0 ? ` <em>(remise ${remisePct}%)</em>` : ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:14px;font-weight:700;color:#1e293b;text-align:right">${prix.toLocaleString('fr-FR')} FCFA</td>
            </tr>`;
          }).join('');

          await EmailService.sendGenericInfo({
            to: parentEmail,
            subject: `Reçu de paiement — Inscription ${enfantNom} — ${ecoleNom}`,
            ecoleNom,
            logoUrl: tenant?.logoUrl,
            role: 'comptabilite',
            attachments: [{
              filename: `recu_inscription_${enfantNom.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }],
            body: `
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Reçu de paiement — Frais d'inscription</h2>
              <p style="color:#475569;font-size:14px;line-height:1.7">
                Bonjour ${parentName},<br>
                Nous confirmons la réception du paiement des frais d'inscription pour <strong>${enfantNom}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #f0ede8;border-radius:8px;overflow:hidden">
                <tr style="background:#faf9f7">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Description</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Montant</th>
                </tr>
                ${lignes}
                <tr style="background:#fffbeb">
                  <td style="padding:12px;font-size:13px;font-weight:800;color:#92400e;text-transform:uppercase">Total payé</td>
                  <td style="padding:12px;font-size:16px;font-weight:900;color:#d97706;text-align:right">${totalHt.toLocaleString('fr-FR')} FCFA</td>
                </tr>
              </table>
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
                <p style="margin:0;font-size:12px;font-weight:700;color:#065f46">Référence : ${ref}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#047857">Méthode : ${methodePaiement}</p>
              </div>
              <p style="color:#475569;font-size:12px;margin-top:12px">
                📎 Le reçu de paiement PDF est joint à cet email.
              </p>
              <p style="color:#94a3b8;font-size:12px;line-height:1.6">
                Conservez cet email comme preuve de paiement. Pour toute question, contactez l'administration.
              </p>`,
          });
        } catch (emailErr) {
          console.warn('[EleveController.factureInscription] Email non envoyé:', emailErr.message);
        }
      }

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

  // ── Réinscription : crée un nouveau record pour l'année suivante ────────────
  static async reinscription(req, res) {
    try {
      const eleve = await Eleve.findOne({
        where: { id: req.params.id, tenantId: req.user.tenantId },
      });
      if (!eleve) return res.status(404).json({ error: 'NotFound', message: 'Élève introuvable.' });

      const { newAnneeScolaire, newNiveau, newClasseId } = req.body;
      if (!newAnneeScolaire || !newNiveau) {
        return res.status(400).json({ error: 'MissingFields', message: 'newAnneeScolaire et newNiveau sont requis.' });
      }

      // Vérifier qu'il n'existe pas déjà un record pour cet élève cette année
      const existingNiveau = await Eleve.findOne({
        where: {
          tenantId: req.user.tenantId,
          matricule: eleve.matricule,
          anneeScolaire: newAnneeScolaire,
        },
      });
      if (existingNiveau) {
        return res.status(409).json({
          error: 'AlreadyExists',
          message: `Cet élève est déjà inscrit pour l'année ${newAnneeScolaire}.`,
          eleve: existingNiveau,
        });
      }

      // Vérifier la capacité de la classe cible (pour la nouvelle année uniquement)
      if (newClasseId) {
        const classe = await Classe.findOne({ where: { id: newClasseId, tenantId: req.user.tenantId } });
        if (classe) {
          const nb = await Eleve.count({ where: { classeId: classe.id, tenantId: req.user.tenantId, anneeScolaire: newAnneeScolaire } });
          if (nb >= classe.capaciteMax) {
            return res.status(400).json({
              error: 'ClasseFull',
              message: `La classe "${classe.nom}" est complète pour ${newAnneeScolaire} (${nb}/${classe.capaciteMax}).`,
            });
          }
        }
      }

      // Copier les données personnelles, changer année/niveau/classe
      const { id: _id, createdAt: _c, updatedAt: _u, classeId: _oldClasse, ...rest } = eleve.toJSON();
      const newEleve = await Eleve.create({
        ...rest,
        tenantId: req.user.tenantId,
        anneeScolaire: newAnneeScolaire,
        niveau: newNiveau,
        classeId: newClasseId || null,
        statut: 'INSCRIT',
        dateAdmission: new Date().toISOString().slice(0, 10),
        dateRadiation: null,
      });

      // Créer les abonnements pour la nouvelle année d'inscription
      if (newEleve.classeId) {
        await createAbonnementsAuto(req.user.tenantId, newEleve);
      }

      return res.status(201).json(newEleve);
    } catch (err) {
      return res.status(500).json({ error: 'ReinscriptionError', message: err.message });
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

  // ── Synchronisation en masse des abonnements ─────────────────────────────
  // Crée les abonnements manquants pour tous les élèves INSCRIT/ACTIF de l'année.
  // Idempotent : les abonnements existants ne sont pas recréés.
  // Utile pour les élèves déjà inscrits avant l'activation de cette fonctionnalité.
  static async syncAbonnements(req, res) {
    try {
      const { anneeScolaire } = req.query;
      const where = {
        tenantId: req.user.tenantId,
        statut:   { [Op.in]: ['INSCRIT', 'ACTIF'] },
        classeId: { [Op.not]: null },
      };
      if (anneeScolaire) where.anneeScolaire = anneeScolaire;

      const eleves = await Eleve.findAll({ where });

      let crees = 0;
      let sautes = 0;

      for (const eleve of eleves) {
        const avantCount = await AbonnementEleve.count({
          where: { tenantId: req.user.tenantId, eleveId: eleve.id, isActive: true },
        });
        await createAbonnementsAuto(req.user.tenantId, eleve);
        const apresCount = await AbonnementEleve.count({
          where: { tenantId: req.user.tenantId, eleveId: eleve.id, isActive: true },
        });
        if (apresCount > avantCount) crees += (apresCount - avantCount);
        else sautes += 1;
      }

      return res.json({
        message: `Synchronisation terminée : ${crees} abonnement(s) créé(s), ${sautes} élève(s) déjà à jour.`,
        elevesTraites: eleves.length,
        abonnementsCrees: crees,
        elevesSautes: sautes,
      });
    } catch (err) {
      console.error('[EleveController.syncAbonnements]', err);
      return res.status(500).json({ error: 'SyncError', message: err.message });
    }
  }
}
