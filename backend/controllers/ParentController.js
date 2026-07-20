import { Op, QueryTypes } from 'sequelize';
import axios from 'axios';
import bcrypt from 'bcrypt';
import {
  findDuplicateEleve, duplicateMessage,
  validatePiecesJointes, createPiecesJointes, missingRequiredPieces,
} from '../utils/eleveDedup.js';
import {
  Eleve, EcheancePaiement, Bulletin, CreneauHoraire,
  Announcement, EleveDocument, Classe, Service, Invoice, InvoiceItem, Sale,
} from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Tenant } from '../models/Tenant.js';
import { User }   from '../models/User.js';
import { uploadToCloudinary } from '../services/CloudinaryService.js';
import { EmailService } from '../services/EmailService.js';

// Vérifie que l'eleveId appartient bien au parent connecté
function assertOwnsEleve(eleveId, req) {
  const eleveIds = req.user?.eleveIds || [];
  if (!eleveIds.includes(eleveId)) {
    return false;
  }
  return true;
}

// Résout tous les eleveIds d'un parent :
// - ceux stockés dans le JWT (eleveIds)
// - + les élèves INSCRIT/ACTIF dont les notes contiennent [parent_user:userId]
//   (dossiers soumis via portail et validés par l'admin)
async function resolveAllEleveIds(userId, tenantId, eleveIdsFromJWT = []) {
  try {
    const tagged = await Eleve.findAll({
      where: {
        tenantId,
        notes:  { [Op.like]: `%[parent_user:${userId}]%` },
        statut: { [Op.in]: ['INSCRIT', 'ACTIF'] },
      },
      attributes: ['id'],
    });
    const taggedIds = tagged.map(e => e.id);
    return [...new Set([...eleveIdsFromJWT, ...taggedIds])];
  } catch {
    return eleveIdsFromJWT;
  }
}

export class ParentController {

  // GET /api/parent/enfants
  static async getMesEnfants(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;
      const allIds = await resolveAllEleveIds(id, tenantId, eleveIds);
      if (!allIds.length) return res.json([]);

      const eleves = await Eleve.findAll({
        where: { id: { [Op.in]: allIds }, tenantId },
        include: [{ model: Classe, as: 'classe', attributes: ['id', 'nom', 'niveau'] }],
      });
      res.json(eleves);
    } catch (err) {
      console.error('[ParentController] getMesEnfants:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/enfants/:id
  static async getMesEnfantById(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;

      if (!assertOwnsEleve(id, req)) {
        return res.status(403).json({ error: 'Accès refusé à cet élève.' });
      }

      const eleve = await Eleve.findOne({
        where: { id, tenantId },
        include: [{ model: Classe, as: 'classe', attributes: ['id', 'nom', 'niveau'] }],
      });
      if (!eleve) return res.status(404).json({ error: 'Élève introuvable.' });

      const result = eleve.toJSON();
      const user = await User.findByPk(req.user.id, { attributes: ['signatureUrl', 'documentsSignes'] });
      if (user?.signatureUrl) result._parentSignatureUrl = user.signatureUrl;
      result._documentsSignes = user?.documentsSignes || [];
      res.json(result);
    } catch (err) {
      console.error('[ParentController] getMesEnfantById:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/echeances?eleveId=&statut=&annee=
  static async getMesEcheances(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;
      const allIds = await resolveAllEleveIds(id, tenantId, eleveIds);
      if (!allIds.length) return res.json([]);

      const where = { eleveId: { [Op.in]: allIds }, tenantId };
      if (req.query.eleveId) {
        if (!allIds.includes(req.query.eleveId)) {
          return res.status(403).json({ error: 'Accès refusé à cet élève.' });
        }
        where.eleveId = req.query.eleveId;
      }
      if (req.query.statut) where.statut = req.query.statut;
      if (req.query.annee)  where.anneeScolaire = req.query.annee;

      const echeances = await EcheancePaiement.findAll({
        where,
        include: [
          { model: Eleve,   as: 'eleve',   attributes: ['id', 'nom', 'prenom', 'photoUrl'] },
          { model: Service, as: 'service', attributes: ['id', 'name', 'description', 'typeOffre', 'inclutCantine'] },
        ],
        order: [['date_echeance', 'ASC']],
      });
      res.json(echeances);
    } catch (err) {
      console.error('[ParentController] getMesEcheances:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/factures
  static async getMesFactures(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;
      const allIds = await resolveAllEleveIds(id, tenantId, eleveIds);
      if (!allIds.length) return res.json([]);

      // Récupérer les échéances payées pour les enfants du parent
      const where = { eleveId: { [Op.in]: allIds }, tenantId, statut: 'PAYE' };
      if (req.query.eleveId) {
        if (!allIds.includes(req.query.eleveId))
          return res.status(403).json({ error: 'Accès refusé à cet élève.' });
        where.eleveId = req.query.eleveId;
      }

      const echeances = await EcheancePaiement.findAll({
        where,
        attributes: ['id', 'saleId', 'eleveId', 'montant', 'periodeLabel', 'dateEcheance', 'paidAt'],
        include: [
          { model: Eleve,   as: 'eleve',   attributes: ['id', 'nom', 'prenom'] },
          { model: Service, as: 'service', attributes: ['id', 'name'] },
        ],
        order: [['paidAt', 'DESC']],
      });

      // Regrouper par saleId pour retrouver la facture
      const saleIds = [...new Set(echeances.map(e => e.saleId).filter(Boolean))];
      const invoices = saleIds.length
        ? await Invoice.findAll({
            where: { saleId: { [Op.in]: saleIds }, tenantId },
            include: [{ model: InvoiceItem, as: 'items' }],
          })
        : [];

      const invoiceMap = Object.fromEntries(invoices.map(inv => [inv.saleId, inv]));

      // Associer chaque écheance à sa facture
      const result = echeances.map(ech => ({
        id: ech.id,
        saleId: ech.saleId,
        eleve: ech.eleve,
        service: ech.service,
        montant: ech.montant,
        periodeLabel: ech.periodeLabel,
        dateEcheance: ech.dateEcheance,
        paidAt: ech.paidAt,
        invoice: ech.saleId ? (invoiceMap[ech.saleId] || null) : null,
      }));

      res.json(result);
    } catch (err) {
      console.error('[ParentController] getMesFactures:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/bulletins?eleveId=&trimestre=&annee=
  static async getMesBulletins(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;
      const allIds = await resolveAllEleveIds(id, tenantId, eleveIds);
      if (!allIds.length) return res.json([]);

      const where = { eleveId: { [Op.in]: allIds }, tenantId };
      if (req.query.eleveId) {
        if (!allIds.includes(req.query.eleveId)) {
          return res.status(403).json({ error: 'Accès refusé à cet élève.' });
        }
        where.eleveId = req.query.eleveId;
      }
      if (req.query.trimestre) where.trimestre = req.query.trimestre;
      if (req.query.annee)     where.anneeScolaire = req.query.annee;

      const bulletins = await Bulletin.findAll({
        where,
        include: [{ model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom', 'niveau'] }],
        order: [['annee_scolaire', 'DESC'], ['trimestre', 'ASC']],
      });
      res.json(bulletins);
    } catch (err) {
      console.error('[ParentController] getMesBulletins:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/planning?eleveId=
  static async getMonPlanning(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;
      const allIds = await resolveAllEleveIds(id, tenantId, eleveIds);
      if (!allIds.length) return res.json([]);

      // Résoudre les classeIds des enfants du parent
      const where = { tenantId, id: { [Op.in]: allIds } };
      if (req.query.eleveId) {
        if (!allIds.includes(req.query.eleveId)) {
          return res.status(403).json({ error: 'Accès refusé à cet élève.' });
        }
        where.id = req.query.eleveId;
      }

      const eleves = await Eleve.findAll({ where, attributes: ['id', 'classeId'] });
      const classeIds = [...new Set(eleves.map(e => e.classeId).filter(Boolean))];
      if (!classeIds.length) return res.json([]);

      const creneaux = await CreneauHoraire.findAll({
        where: { tenantId, classeId: { [Op.in]: classeIds } },
        include: [{ model: Classe, as: 'classe', attributes: ['id', 'nom', 'niveau'] }],
        order: [['jour', 'ASC'], ['heure_debut', 'ASC']],
      });
      res.json(creneaux);
    } catch (err) {
      console.error('[ParentController] getMonPlanning:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/actualites
  static async getActualites(req, res) {
    try {
      const { id, tenantId } = req.user;
      const now = new Date();

      const [annonces, elevesInscrits] = await Promise.all([
        Announcement.findAll({
          where: {
            isActive: true,
            [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
          },
          order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
          limit: 50,
        }),
        Eleve.findAll({
          where: {
            tenantId,
            notes:  { [Op.like]: `%[parent_user:${id}]%` },
            statut: { [Op.in]: ['INSCRIT', 'ACTIF'] },
          },
          attributes: ['id', 'nom', 'prenom', 'niveau', 'anneeScolaire', 'dateAdmission', 'updatedAt', 'createdAt'],
        }),
      ]);

      let schoolEvents = [];
      try {
        schoolEvents = await sequelize.query(
          `SELECT id, titre, description, type_evenement, statut,
                  date_debut, date_fin, heure_debut, heure_fin, lieu,
                  niveaux_cibles, diffuse, created_at
           FROM school_events
           WHERE tenant_id = :tenantId AND statut = 'PUBLIE'
           ORDER BY date_debut ASC`,
          { replacements: { tenantId }, type: QueryTypes.SELECT }
        );
      } catch (_) { /* table may not exist yet */ }

      const NIVEAUX_LABELS = {
        CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section',
        GS: 'Grande Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
      };

      // Événements synthétiques : une carte par enfant inscrit via le portail
      const inscriptionEvents = elevesInscrits.map(e => ({
        id: `inscription-${e.id}`,
        title: `Inscription confirmée — ${e.prenom} ${e.nom}`,
        body: `La candidature de ${e.prenom} ${e.nom} a été acceptée.\n${e.prenom} est inscrit(e) en ${NIVEAUX_LABELS[e.niveau] || e.niveau}${e.anneeScolaire ? ` pour l'année scolaire ${e.anneeScolaire}` : ''}.\n\nBienvenue à l'école !`,
        type: 'INSCRIPTION',
        isPinned: false,
        isActive: true,
        createdAt: e.dateAdmission || e.updatedAt || e.createdAt,
        expiresAt: null,
      }));

      const eventCards = schoolEvents.map(ev => ({
        id: `event-${ev.id}`,
        title: ev.titre,
        body: [
          ev.description || '',
          ev.heure_debut ? `⏰ ${ev.heure_debut}${ev.heure_fin ? ` – ${ev.heure_fin}` : ''}` : '',
          ev.lieu ? `📍 ${ev.lieu}` : '',
        ].filter(Boolean).join('\n'),
        type: ev.type_evenement,
        isPinned: false,
        isActive: true,
        dateDebut: ev.date_debut,
        dateFin: ev.date_fin,
        createdAt: ev.created_at,
        expiresAt: ev.date_fin ? new Date(ev.date_fin + 'T23:59:59') : null,
      }));

      res.json([...inscriptionEvents, ...eventCards, ...annonces]);
    } catch (err) {
      console.error('[ParentController] getActualites:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/dossiers?eleveId=
  static async getMesDossiers(req, res) {
    try {
      const { tenantId, eleveIds = [] } = req.user;
      if (!eleveIds.length) return res.json([]);

      const where = { eleveId: { [Op.in]: eleveIds }, tenantId };
      if (req.query.eleveId) {
        if (!assertOwnsEleve(req.query.eleveId, req)) {
          return res.status(403).json({ error: 'Accès refusé à cet élève.' });
        }
        where.eleveId = req.query.eleveId;
      }

      const docs = await EleveDocument.findAll({
        where,
        order: [['created_at', 'DESC']],
      });
      res.json(docs);
    } catch (err) {
      console.error('[ParentController] getMesDossiers:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/parent/dossiers/upload
  static async uploadDocument(req, res) {
    try {
      const { tenantId } = req.user;
      const { eleveId, typeDoc = 'AUTRE', nom } = req.body;

      if (!eleveId) return res.status(400).json({ error: 'eleveId requis.' });
      if (!assertOwnsEleve(eleveId, req)) {
        return res.status(403).json({ error: 'Accès refusé à cet élève.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });

      const { url } = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        tenantId,
        'eleve-documents'
      );

      const doc = await EleveDocument.create({
        eleveId,
        tenantId,
        categorie: 'ADMINISTRATIF', // NOT NULL en BD — l'omission faisait échouer l'upload parent
        typeDoc,
        nom: nom || req.file.originalname,
        fileUrl: url,
        mimeType: req.file.mimetype || null,
        fileSize: req.file.size || null,
        uploadedBy: req.user.id,
      });
      res.status(201).json(doc);
    } catch (err) {
      console.error('[ParentController] uploadDocument:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/parent/paiement/demander
  static async demanderPaiement(req, res) {
    try {
      const { tenantId, name, eleveIds = [] } = req.user;
      const { echeanceId, eleveId, montant, methode = 'Wave', reference } = req.body;

      if (eleveId && !assertOwnsEleve(eleveId, req)) {
        return res.status(403).json({ error: 'Accès refusé à cet élève.' });
      }

      const webhookUrl = process.env.PROD_WEBHOOK || process.env.WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(503).json({ error: 'Service de notification indisponible.' });
      }

      const payload = {
        type: 'DEMANDE_PAIEMENT_PARENT',
        tenantId,
        parentNom: name,
        eleveId,
        echeanceId,
        montant,
        methode,
        reference: reference || null,
        message: `💳 Demande de paiement\nParent : ${name}\nMontant : ${montant} FCFA\nMéthode : ${methode}${reference ? `\nRéférence : ${reference}` : ''}`,
        timestamp: new Date().toISOString(),
      };

      try {
        await axios.post(webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000,
        });
      } catch (webhookErr) {
        console.warn('[ParentController] webhook non joignable:', webhookErr.message);
      }

      res.json({ success: true, message: 'Votre demande de paiement a été transmise à l\'école.' });
    } catch (err) {
      console.error('[ParentController] demanderPaiement:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/mes-admissions — dossiers soumis via le portail parent
  static async getMesAdmissions(req, res) {
    try {
      const { id, tenantId } = req.user;
      const dossiers = await Eleve.findAll({
        where: {
          tenantId,
          notes: { [Op.like]: `%[parent_user:${id}]%` },
        },
        attributes: ['id', 'nom', 'prenom', 'niveau', 'sexe', 'statut', 'dateNaissance', 'cantine', 'transportBus', 'garderie', 'photoUrl', 'notes', 'createdAt', 'updatedAt'],
        order: [['created_at', 'DESC']],
      });
      res.json(dossiers);
    } catch (err) {
      console.error('[ParentController] getMesAdmissions:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/me — profil complet du parent connecté
  static async getMonProfil(req, res) {
    try {
      const { id, tenantId, eleveIds = [] } = req.user;

      // Récupère email + name depuis la BD (pas toujours dans le JWT)
      const user = await User.findOne({ where: { id, tenantId }, attributes: ['id', 'name', 'email'] });
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

      // Tente de récupérer les coordonnées parent1 depuis le premier enfant lié
      let parent1 = null;
      if (eleveIds.length > 0) {
        const eleve = await Eleve.findOne({ where: { id: eleveIds[0], tenantId } });
        if (eleve?.parent1) parent1 = eleve.parent1;
      }

      // Décompose le name "Prenom NOM" → prenom / nom
      const parts  = (user.name || '').trim().split(' ');
      const prenom = parts[0] || '';
      const nom    = parts.slice(1).join(' ') || '';

      res.json({ name: user.name, email: user.email, prenom, nom, parent1 });
    } catch (err) {
      console.error('[ParentController] getMonProfil:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/ecole
  static async getEcoleInfo(req, res) {
    try {
      const { tenantId } = req.user;
      const tenant = await Tenant.findOne({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ error: 'École introuvable.' });
      res.json({
        name:    tenant.name    || null,
        logoUrl: tenant.logoUrl || null,
        address: tenant.address || null,
        phone:   tenant.phone   || null,
        email:   tenant.email   || null,
      });
    } catch (err) {
      console.error('[ParentController] getEcoleInfo:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // PUT /api/parent/admission/:id — resoumission d'un dossier rejeté
  static async resoumettreAdmission(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { id } = req.params;
      const {
        nom, prenom, dateNaissance, lieuNaissance, sexe, niveau,
        regimeFinancier, remisePct, cantine, transportBus, garderie, besoinSpecifique,
        ficheSanitaire, parent1, parent2, contactUrgence, personneAutorisee,
        photoUrl, piecesJointes, notes,
      } = req.body;

      // Pièces justificatives jointes lors de la resoumission
      const pj = validatePiecesJointes(piecesJointes);
      if (!pj.ok) return res.status(400).json({ error: pj.error });

      const eleve = await Eleve.findOne({ where: { id, tenantId } });
      if (!eleve) return res.status(404).json({ error: 'Dossier introuvable.' });
      if (!eleve.notes?.includes(`[parent_user:${userId}]`)) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }
      if (eleve.statut !== 'REJETE') {
        return res.status(400).json({ error: 'Ce dossier n\'est pas en statut rejeté.' });
      }

      // Reconstruit les notes : on efface le bloc REJET, on garde le tag parent
      const nouvellesNotes = `${notes || 'Dossier corrigé et resoumis via le portail parent.'} [parent_user:${userId}]`;

      await eleve.update({
        nom:              nom              || eleve.nom,
        prenom:           prenom           || eleve.prenom,
        dateNaissance:    dateNaissance    || eleve.dateNaissance,
        lieuNaissance:    lieuNaissance    || eleve.lieuNaissance,
        sexe:             sexe             || eleve.sexe,
        niveau:           niveau           || eleve.niveau,
        regimeFinancier:  regimeFinancier  || eleve.regimeFinancier,
        remisePct:        remisePct        ?? eleve.remisePct,
        cantine:          !!cantine,
        transportBus:     !!transportBus,
        garderie:         !!garderie,
        besoinSpecifique: besoinSpecifique || eleve.besoinSpecifique,
        ficheSanitaire:   ficheSanitaire   || eleve.ficheSanitaire,
        parent1:          parent1          || eleve.parent1,
        parent2:          parent2          || eleve.parent2,
        contactUrgence:   contactUrgence   || eleve.contactUrgence,
        personneAutorisee: personneAutorisee || eleve.personneAutorisee,
        photoUrl:         photoUrl         || eleve.photoUrl,
        statut:           'EN_ATTENTE',
        notes:            nouvellesNotes,
      });

      // Nouvelles pièces jointes versées au dossier numérique
      if (pj.list.length) await createPiecesJointes(eleve, pj.list, userId);

      res.json({
        success: true,
        message: 'Dossier corrigé et resoumis. L\'école examinera votre demande.',
        eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, statut: 'EN_ATTENTE' },
      });
    } catch (err) {
      console.error('[ParentController] resoumettreAdmission:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/parent/admission
  static async soumettreAdmission(req, res) {
    try {
      const { tenantId } = req.user;
      const {
        nom, prenom, dateNaissance, lieuNaissance, sexe, niveau,
        regimeFinancier, remisePct, cantine, transportBus, garderie, besoinSpecifique,
        ficheSanitaire, parent1, parent2, contactUrgence, personneAutorisee,
        photoUrl, piecesJointes, anneeScolaire, notes,
        situationMatrimoniale, parentsMemeResidence,
      } = req.body;

      if (!nom || !prenom) {
        return res.status(400).json({ error: 'Nom et prénom requis.' });
      }

      // Pièces justificatives jointes (images/PDF en data-URL)
      const pj = validatePiecesJointes(piecesJointes);
      if (!pj.ok) return res.status(400).json({ error: pj.error });

      // Les pièces obligatoires doivent toutes être jointes (nouveau dossier)
      const manquantes = missingRequiredPieces(pj.list);
      if (manquantes.length) {
        return res.status(400).json({
          error: `Pièces obligatoires manquantes : ${manquantes.join(', ')}.`,
        });
      }

      // Utilise l'année active du tenant pour que le dossier apparaisse dans la vue admin
      const tenant = await Tenant.findOne({ where: { id: tenantId }, attributes: ['anneeActive'] });
      const anneeResolue = anneeScolaire || tenant?.anneeActive || null;

      // Anti-doublon : même enfant déjà soumis pour la même année
      const dup = await findDuplicateEleve({
        tenantId, nom, prenom, dateNaissance, anneeScolaire: anneeResolue,
      });
      if (dup) {
        return res.status(409).json({ error: 'Duplicate', message: duplicateMessage(dup) });
      }

      const eleve = await Eleve.create({
        tenantId,
        nom,
        prenom,
        dateNaissance:    dateNaissance   || null,
        lieuNaissance:    lieuNaissance   || null,
        sexe:             sexe            || null,
        niveau:           niveau          || 'PS',
        regimeFinancier:  regimeFinancier || 'NORMAL',
        remisePct:        remisePct       || 0,
        cantine:          !!cantine,
        transportBus:     !!transportBus,
        garderie:         !!garderie,
        besoinSpecifique: besoinSpecifique || null,
        ficheSanitaire:   ficheSanitaire  || null,
        parent1:          parent1         || null,
        parent2:          parent2         || null,
        contactUrgence:   contactUrgence  || null,
        personneAutorisee: personneAutorisee || null,
        photoUrl:         photoUrl        || null,
        anneeScolaire:    anneeResolue,
        statut: 'EN_ATTENTE',
        notes: `${notes || "Inscription soumise via le portail parent."} [parent_user:${req.user.id}]`,
        situationMatrimoniale: situationMatrimoniale || null,
        parentsMemeResidence:  parentsMemeResidence ?? null,
      });

      // Enregistrer les pièces jointes dans le dossier numérique de l'élève
      if (pj.list.length) await createPiecesJointes(eleve, pj.list, req.user.id);

      const ref = `PRE-${new Date().getFullYear()}-${eleve.id.slice(0, 6).toUpperCase()}`;

      // Email de confirmation au parent
      const user = await User.findByPk(req.user.id, { attributes: ['email', 'name'] });
      const tenantInfo = await Tenant.findByPk(tenantId, { attributes: ['name', 'domain', 'logoUrl'] });
      const ecoleNom = tenantInfo?.name || "L'école";
      const frontendUrl = process.env.FRONTEND_URL || `https://${tenantInfo?.domain || 'scolarite.letoitdesanges.com'}`;

      if (user?.email) {
        try {
          await EmailService.sendGenericInfo({
            to: user.email,
            subject: `Confirmation de dépôt de dossier — ${ecoleNom}`,
            ecoleNom,
            logoUrl: tenantInfo?.logoUrl,
            role: 'support',
            body: `
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">Dossier d'inscription déposé</h2>
              <p style="color:#475569;font-size:14px;line-height:1.7">
                Bonjour ${user.name},<br>
                Votre dossier d'inscription pour <strong>${prenom} ${nom}</strong> a bien été transmis à <strong>${ecoleNom}</strong>.
              </p>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">Votre référence de suivi</p>
                <p style="margin:0;font-weight:900;color:#d97706;font-size:28px;font-family:monospace;letter-spacing:3px">${ref}</p>
              </div>
              <p style="color:#475569;font-size:13px;line-height:1.6">
                Vous pouvez suivre l'avancement depuis votre portail parents. L'école examinera votre dossier et vous contactera.
              </p>`,
          });
        } catch (emailErr) {
          console.warn('[ParentController] Email confirmation admission non envoyé:', emailErr.message);
        }
      }

      res.status(201).json({
        success: true,
        reference: ref,
        message: "Dossier d'inscription soumis. L'école vous contactera pour confirmer.",
        eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, statut: eleve.statut },
      });
    } catch (err) {
      console.error('[ParentController] soumettreAdmission:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // ─── SIGNATURE DIGITALE ─────────────────────────────────────────────────────

  // POST /api/parent/signature — enregistrer la signature du parent (base64 data URL)
  static async enregistrerSignature(req, res) {
    try {
      const { signatureDataUrl } = req.body;
      if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Format de signature invalide.' });
      }

      // Upload vers Cloudinary
      const result = await uploadToCloudinary(
        Buffer.from(signatureDataUrl.split(',')[1], 'base64'),
        `signatures/parent_${req.user.id}`,
        'image/png'
      );
      const url = result?.secure_url || result?.url || signatureDataUrl;

      await User.update(
        { signatureUrl: url },
        { where: { id: req.user.id } }
      );

      res.json({ success: true, signatureUrl: url });
    } catch (err) {
      console.error('[ParentController] enregistrerSignature:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/signature — récupérer la signature actuelle
  static async getSignature(req, res) {
    try {
      const user = await User.findByPk(req.user.id, { attributes: ['signatureUrl', 'documentsSignes'] });
      res.json({
        signatureUrl: user?.signatureUrl || null,
        documentsSignes: user?.documentsSignes || [],
      });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // GET /api/parent/documents-a-signer — liste les documents en attente de signature
  static async getDocumentsASigner(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const eleveIds = await resolveAllEleveIds(req.user.id, tenantId, req.user.eleveIds || []);

      if (!eleveIds.length) return res.json([]);

      const eleves = await Eleve.findAll({
        where: { id: eleveIds, tenantId, statut: { [Op.in]: ['INSCRIT', 'ACTIF'] } },
        attributes: ['id', 'nom', 'prenom', 'niveau', 'anneeScolaire'],
        include: [{ model: Classe, as: 'classe', attributes: ['nom', 'niveau'] }],
      });

      const user = await User.findByPk(req.user.id, { attributes: ['documentsSignes'] });
      const signes = user?.documentsSignes || [];
      const signeSet = new Set(signes.map(d => `${d.eleveId}:${d.typeDoc}`));

      const DOCS_A_SIGNER = [
        'fiche_inscription',
        'convention_scolarisation',
        'autorisation_sortie',
        'fiche_sanitaire',
        'autorisation_soins',
        'reglement_interieur',
      ];

      const docs = [];
      for (const eleve of eleves) {
        for (const typeDoc of DOCS_A_SIGNER) {
          const key = `${eleve.id}:${typeDoc}`;
          docs.push({
            eleveId: eleve.id,
            eleveNom: `${eleve.prenom} ${eleve.nom}`,
            eleveNiveau: eleve.classe?.nom || eleve.niveau || '',
            typeDoc,
            signe: signeSet.has(key),
            dateSigne: signes.find(d => d.eleveId === eleve.id && d.typeDoc === typeDoc)?.date || null,
          });
        }
      }

      res.json(docs);
    } catch (err) {
      console.error('[ParentController] getDocumentsASigner:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/parent/signer-document — signer un document spécifique
  static async signerDocument(req, res) {
    try {
      const { eleveId, typeDoc } = req.body;
      if (!eleveId || !typeDoc) {
        return res.status(400).json({ error: 'eleveId et typeDoc sont requis.' });
      }

      const tenantId = req.user.tenantId;
      const eleveIds = await resolveAllEleveIds(req.user.id, tenantId, req.user.eleveIds || []);
      if (!eleveIds.includes(eleveId)) {
        return res.status(403).json({ error: 'Accès refusé à cet élève.' });
      }

      const user = await User.findByPk(req.user.id, { attributes: ['id', 'signatureUrl', 'documentsSignes'] });
      if (!user?.signatureUrl) {
        return res.status(400).json({ error: 'Veuillez d\'abord enregistrer votre signature.' });
      }

      const signes = user.documentsSignes || [];
      const existing = signes.find(d => d.eleveId === eleveId && d.typeDoc === typeDoc);
      if (existing) {
        return res.json({ success: true, message: 'Document déjà signé.', alreadySigned: true });
      }

      signes.push({ eleveId, typeDoc, date: new Date().toISOString() });
      await User.update(
        { documentsSignes: signes },
        { where: { id: req.user.id } }
      );

      res.json({ success: true, message: 'Document signé avec succès.' });
    } catch (err) {
      console.error('[ParentController] signerDocument:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // POST /api/parent/factures/envoyer-email — Envoyer une facture par email au parent
  static async sendInvoiceEmail(req, res) {
    try {
      const { tenantId } = req.user;
      const { eleveId, echeanceIds } = req.body;
      if (!eleveId || !echeanceIds?.length) {
        return res.status(400).json({ error: 'eleveId et echeanceIds[] requis.' });
      }

      const allIds = await resolveAllEleveIds(req.user.id, tenantId, req.user.eleveIds || []);
      if (!allIds.includes(eleveId)) {
        return res.status(403).json({ error: 'Accès refusé à cet élève.' });
      }

      const echeances = await EcheancePaiement.findAll({
        where: { id: { [Op.in]: echeanceIds }, eleveId, tenantId },
        include: [
          { model: Eleve, as: 'eleve', attributes: ['id', 'nom', 'prenom'] },
          { model: Service, as: 'service', attributes: ['id', 'name'] },
        ],
      });
      if (!echeances.length) return res.status(404).json({ error: 'Aucune échéance trouvée.' });

      const user = await User.findByPk(req.user.id, { attributes: ['email', 'name'] });
      const tenant = await Tenant.findByPk(tenantId, { attributes: ['name', 'currency', 'logoUrl'] });
      const eleve = echeances[0].eleve;
      const currency = tenant?.currency || 'F CFA';
      const total = echeances.reduce((s, e) => s + (parseFloat(e.montant) || 0), 0);

      await EmailService.sendInvoice({
        to: user.email,
        parentName: user.name,
        ecoleNom: tenant?.name || 'L\'école',
        logoUrl: tenant?.logoUrl,
        enfantNom: `${eleve?.prenom || ''} ${eleve?.nom || ''}`.trim(),
        mois: echeances.map(e => e.periodeLabel).join(', '),
        montant: total,
        currency,
        echeances: echeances.map(e => ({
          label: e.service?.name || 'Scolarité',
          mois: e.periodeLabel,
          montant: parseFloat(e.montant) || 0,
        })),
      });

      res.json({ success: true, message: 'Facture envoyée par email.' });
    } catch (err) {
      console.error('[ParentController] sendInvoiceEmail:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }

  // PUT /api/parent/change-password
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await User.update({ password: hashed }, { where: { id: user.id }, individualHooks: false });

      res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (err) {
      console.error('[ParentController] changePassword:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }
}
