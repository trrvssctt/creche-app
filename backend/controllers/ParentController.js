import { Op } from 'sequelize';
import axios from 'axios';
import {
  Eleve, EcheancePaiement, Bulletin, CreneauHoraire,
  Announcement, EleveDocument, Classe, Service,
} from '../models/index.js';
import { Tenant } from '../models/Tenant.js';
import { User }   from '../models/User.js';
import { uploadToCloudinary } from '../services/CloudinaryService.js';

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
      res.json(eleve);
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

      res.json([...inscriptionEvents, ...annonces]);
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
        typeDoc,
        nom: nom || req.file.originalname,
        fileUrl: url,
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
        attributes: ['id', 'nom', 'prenom', 'niveau', 'sexe', 'statut', 'dateNaissance', 'cantine', 'transportBus', 'notes', 'createdAt', 'updatedAt'],
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
        regimeFinancier, remisePct, cantine, transportBus, besoinSpecifique,
        ficheSanitaire, parent1, parent2, contactUrgence, notes,
      } = req.body;

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
        besoinSpecifique: besoinSpecifique || eleve.besoinSpecifique,
        ficheSanitaire:   ficheSanitaire   || eleve.ficheSanitaire,
        parent1:          parent1          || eleve.parent1,
        parent2:          parent2          || eleve.parent2,
        contactUrgence:   contactUrgence   || eleve.contactUrgence,
        statut:           'EN_ATTENTE',
        notes:            nouvellesNotes,
      });

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
        regimeFinancier, remisePct, cantine, transportBus, besoinSpecifique,
        ficheSanitaire, parent1, parent2, contactUrgence,
        anneeScolaire, notes,
      } = req.body;

      if (!nom || !prenom) {
        return res.status(400).json({ error: 'Nom et prénom requis.' });
      }

      // Utilise l'année active du tenant pour que le dossier apparaisse dans la vue admin
      const tenant = await Tenant.findOne({ where: { id: tenantId }, attributes: ['anneeActive'] });
      const anneeResolue = anneeScolaire || tenant?.anneeActive || null;

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
        besoinSpecifique: besoinSpecifique || null,
        ficheSanitaire:   ficheSanitaire  || null,
        parent1:          parent1         || null,
        parent2:          parent2         || null,
        contactUrgence:   contactUrgence  || null,
        anneeScolaire:    anneeResolue,
        statut: 'EN_ATTENTE',
        notes: `${notes || "Inscription soumise via le portail parent."} [parent_user:${req.user.id}]`,
      });

      res.status(201).json({
        success: true,
        message: "Dossier d'inscription soumis. L'école vous contactera pour confirmer.",
        eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, statut: eleve.statut },
      });
    } catch (err) {
      console.error('[ParentController] soumettreAdmission:', err.message);
      res.status(500).json({ error: 'Erreur serveur', message: err.message });
    }
  }
}
