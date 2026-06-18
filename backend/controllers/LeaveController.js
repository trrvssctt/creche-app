import { Leave, Employee, Department } from '../models/index.js';
import { Op } from 'sequelize';
import multer from 'multer';
import { uploadToS3 } from '../services/S3Service.js';

// Configuration multer pour l'upload de fichiers (mémoire → S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez PDF, JPG ou PNG.'), false);
    }
  }
});

export class LeaveController {
  static async list(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { 
        employeeId, 
        type, 
        status, 
        startDate, 
        endDate, 
        page = 1, 
        perPage = 25, 
        sortBy = 'start_date', 
        sortDir = 'DESC' 
      } = req.query;

      const where = { tenantId };
      
      if (employeeId) where.employeeId = employeeId;
      if (type) where.type = type;
      if (status) where.status = status;
      
      if (startDate || endDate) {
        where.startDate = {};
        if (startDate) where.startDate[Op.gte] = new Date(startDate);
        if (endDate) where.startDate[Op.lte] = new Date(endDate);
      }

      const limit = Math.min(parseInt(perPage, 10) || 25, 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const order = [[sortBy || 'start_date', (sortDir || 'DESC').toUpperCase()]];

      const { rows, count } = await Leave.findAndCountAll({ 
        where, 
        limit, 
        offset, 
        order,
        include: [
          { 
            model: Employee, 
            as: 'employee', 
            attributes: ['id', 'firstName', 'lastName', 'departmentId', 'position', 'email'],
            include: [
              {
                model: Department,
                as: 'departmentInfo',
                attributes: ['id', 'name']
              }
            ]
          },
          { 
            model: Employee, 
            as: 'approver', 
            attributes: ['id', 'firstName', 'lastName'] 
          }
        ]
      });

      return res.status(200).json({ rows, count, page: Number(page), perPage: limit });
    } catch (error) {
      console.error('LeaveController.list error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      const leave = await Leave.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [
          { model: Employee, as: 'employee' },
          { model: Employee, as: 'approver' }
        ]
      });
      if (!leave) return res.status(404).json({ error: 'Leave not found' });
      return res.status(200).json(leave);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      
      // Multer place les champs dans req.body, même avec les fichiers
      const { employeeId, type, startDate, endDate, reason } = req.body;
      
      // Validation des champs requis
      if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID is required' });
      }
      
      if (!type || !['PAID', 'SICK', 'MATERNITY', 'UNPAID', 'ANNUAL'].includes(type)) {
        return res.status(400).json({ error: 'Valid leave type is required' });
      }
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      // Validation des dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start < today) {
        return res.status(400).json({ error: 'Start date cannot be in the past' });
      }

      if (end < start) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays > 365) {
        return res.status(400).json({ error: 'Leave duration cannot exceed 365 days' });
      }

      // Vérifier que l'employé existe et appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      // Vérifier qu'il n'y a pas déjà une demande en cours ou un congé actif pour cet employé
      
      const activeOrPendingLeave = await Leave.findOne({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          [Op.or]: [
            // Demande en attente
            { status: 'PENDING' },
            // Congé approuvé et actif (dates qui couvrent aujourd'hui ou dans le futur)
            {
              status: 'APPROVED',
              endDate: { [Op.gte]: today }
            }
          ]
        },
        order: [['startDate', 'ASC']]
      });

      if (activeOrPendingLeave) {
        const startDate = new Date(activeOrPendingLeave.startDate).toLocaleDateString('fr-FR');
        const endDate = new Date(activeOrPendingLeave.endDate).toLocaleDateString('fr-FR');
        
        if (activeOrPendingLeave.status === 'PENDING') {
          return res.status(409).json({ 
            error: `Une demande de congé est déjà en cours de traitement (du ${startDate} au ${endDate}). Vous devez attendre la réponse avant de faire une nouvelle demande.`,
            activeLeave: {
              id: activeOrPendingLeave.id,
              type: activeOrPendingLeave.type,
              startDate: activeOrPendingLeave.startDate,
              endDate: activeOrPendingLeave.endDate,
              status: activeOrPendingLeave.status
            }
          });
        } else {
          // Congé approuvé et actif
          const isCurrentlyActive = new Date(activeOrPendingLeave.startDate) <= today;
          const message = isCurrentlyActive 
            ? `Vous êtes actuellement en congé (du ${startDate} au ${endDate}). Impossible de créer une nouvelle demande pendant cette période.`
            : `Vous avez déjà un congé approuvé prévu (du ${startDate} au ${endDate}). Impossible de créer une nouvelle demande tant que ce congé n'est pas terminé.`;
            
          return res.status(409).json({ 
            error: message,
            activeLeave: {
              id: activeOrPendingLeave.id,
              type: activeOrPendingLeave.type,
              startDate: activeOrPendingLeave.startDate,
              endDate: activeOrPendingLeave.endDate,
              status: activeOrPendingLeave.status
            }
          });
        }
      }

      // Vérifier les conflits de dates pour le même employé
      const existingLeave = await Leave.findOne({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: ['PENDING', 'APPROVED'],
          [Op.or]: [
            {
              startDate: {
                [Op.between]: [startDate, endDate]
              }
            },
            {
              endDate: {
                [Op.between]: [startDate, endDate]
              }
            },
            {
              [Op.and]: [
                { startDate: { [Op.lte]: startDate } },
                { endDate: { [Op.gte]: endDate } }
              ]
            }
          ]
        },
        include: [
          { 
            model: Employee, 
            as: 'employee', 
            attributes: ['firstName', 'lastName']
          }
        ]
      });

      if (existingLeave) {
        const employeeName = existingLeave.employee ? 
          `${existingLeave.employee.firstName} ${existingLeave.employee.lastName}` : 
          'Cet employé';
        
        const conflictStart = new Date(existingLeave.startDate).toLocaleDateString('fr-FR');
        const conflictEnd = new Date(existingLeave.endDate).toLocaleDateString('fr-FR');
        const statusText = existingLeave.status === 'PENDING' ? 'en attente d\'approbation' : 'approuvé';
        
        return res.status(409).json({ 
          error: `${employeeName} a déjà un congé ${statusText} du ${conflictStart} au ${conflictEnd}. Impossible de créer un congé sur cette période.`,
          conflictingLeave: {
            id: existingLeave.id,
            type: existingLeave.type,
            startDate: existingLeave.startDate,
            endDate: existingLeave.endDate,
            status: existingLeave.status,
            reason: existingLeave.reason
          }
        });
      }
      
      const payload = {
        employeeId,
        type,
        startDate,
        endDate,
        daysCount: diffDays,
        reason: reason || null,
        tenantId: req.user.tenantId
      };

      // Gérer l'upload du document pour les congés maladie
      if (type === 'SICK' && req.file) {
        try {
          const uploadResult = await uploadToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.user.tenantId,
            'leaves'
          );

          payload.documentUrl = uploadResult.url;
          payload.documentName = req.file.originalname;
        } catch (uploadError) {
          console.error('⚠️ Erreur upload document:', uploadError);
          return res.status(400).json({ 
            error: 'Erreur lors de l\'upload du justificatif médical: ' + uploadError.message 
          });
        }
      }
      
      const leave = await Leave.create(payload);
      
      // Retourner avec les informations de l'employé
      const createdLeave = await Leave.findOne({
        where: { id: leave.id },
        include: [
          { 
            model: Employee, 
            as: 'employee', 
            attributes: ['id', 'firstName', 'lastName', 'position'],
            include: [
              {
                model: Department,
                as: 'departmentInfo',
                attributes: ['id', 'name']
              }
            ]
          }
        ]
      });
      
      return res.status(201).json(createdLeave);
    } catch (error) {
      console.error('LeaveController.create error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      
      // Vérifier que le congé existe et appartient au tenant
      const existingLeave = await Leave.findOne({
        where: { id, tenantId: req.user.tenantId }
      });
      
      if (!existingLeave) {
        return res.status(404).json({ error: 'Congé non trouvé' });
      }
      
      // Si les dates changent, vérifier les conflits (sauf avec lui-même)
      if (req.body.startDate && req.body.endDate) {
        const conflictingLeave = await Leave.findOne({
          where: {
            id: { [Op.ne]: id }, // Exclure le congé actuel
            employeeId: req.body.employeeId || existingLeave.employeeId,
            tenantId: req.user.tenantId,
            status: ['PENDING', 'APPROVED'],
            [Op.or]: [
              {
                startDate: {
                  [Op.between]: [req.body.startDate, req.body.endDate]
                }
              },
              {
                endDate: {
                  [Op.between]: [req.body.startDate, req.body.endDate]
                }
              },
              {
                [Op.and]: [
                  { startDate: { [Op.lte]: req.body.startDate } },
                  { endDate: { [Op.gte]: req.body.endDate } }
                ]
              }
            ]
          },
          include: [
            { 
              model: Employee, 
              as: 'employee', 
              attributes: ['firstName', 'lastName']
            }
          ]
        });

        if (conflictingLeave) {
          const conflictStart = new Date(conflictingLeave.startDate).toLocaleDateString('fr-FR');
          const conflictEnd = new Date(conflictingLeave.endDate).toLocaleDateString('fr-FR');
          const statusText = conflictingLeave.status === 'PENDING' ? 'en attente d\'approbation' : 'approuvé';
          
          return res.status(409).json({ 
            error: `Conflit détecté : l'employé a déjà un congé ${statusText} du ${conflictStart} au ${conflictEnd}.`,
            conflictingLeave: {
              id: conflictingLeave.id,
              type: conflictingLeave.type,
              startDate: conflictingLeave.startDate,
              endDate: conflictingLeave.endDate,
              status: conflictingLeave.status
            }
          });
        }
      }
      
      // Préparer les données de mise à jour - seulement les champs fournis
      // PAR CECI — utiliser les attributs Sequelize (camelCase) sans field mapping
      const updateData = {};

      const fieldMap = {
        employeeId: req.body.employeeId,
        type: req.body.type,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        reason: req.body.reason ?? null,
      };

      Object.entries(fieldMap).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          updateData[key] = value;
        }
      });
      
      // Recalculer les jours SEULEMENT si les deux dates sont présentes
      if (updateData.startDate && updateData.endDate) {
        try {
          const start = new Date(updateData.startDate);
          const end = new Date(updateData.endDate);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Dates invalides fournies' });
          }
          
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          updateData.daysCount = diffDays;
        } catch (dateError) {
          console.error('❌ Erreur calcul dates:', dateError);
          return res.status(400).json({ error: 'Erreur lors du calcul des jours' });
        }
      }
      
      // Gérer l'upload du document si un fichier est fourni
      if (req.file) {
        try {
          const uploadResult = await uploadToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.user.tenantId,
            'leaves'
          );

          updateData.documentUrl = uploadResult.url;
          updateData.documentName = req.file.originalname;
        } catch (uploadError) {
          console.error('❌ Erreur upload document:', uploadError);
          return res.status(400).json({ 
            error: 'Erreur lors de l\'upload du justificatif: ' + uploadError.message 
          });
        }
      }
      
      // Vérifier qu'il y a au moins quelque chose à mettre à jour
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Aucune donnée fournie pour la mise à jour' });
      }
      
      const [updated] = await Leave.update(updateData, { 
        where: { id, tenantId: req.user.tenantId } 
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Congé non trouvé pour mise à jour' });
      }
      
      // Récupérer les données mises à jour avec les relations
      const leave = await Leave.findOne({
        where: { id },
        include: [
          { 
            model: Employee, 
            as: 'employee', 
            attributes: ['id', 'firstName', 'lastName', 'position'],
            include: [
              {
                model: Department,
                as: 'departmentInfo',
                attributes: ['id', 'name']
              }
            ]
          }
        ]
      });
      return res.status(200).json(leave);
    } catch (error) {
      console.error('❌ LeaveController.update error:', error);
      console.error('❌ Stack trace:', error.stack);
      return res.status(500).json({ 
        error: 'Erreur serveur lors de la mise à jour', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async approve(req, res) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const userId = req.user.id;
      
      // Vérifier que le congé existe et est en attente
      const existingLeave = await Leave.findOne({
        where: { id, tenantId: req.user.tenantId, status: 'PENDING' }
      });
      
      if (!existingLeave) {
        return res.status(404).json({ error: 'Congé non trouvé ou déjà traité' });
      }
      
      const updateData = {
        approvedBy: userId
      };
      
      // Si rejectionReason est fourni, c'est un refus
      if (rejectionReason) {
        if (typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
          return res.status(400).json({ error: 'Le motif de refus est obligatoire' });
        }
        
        updateData.status = 'REJECTED';
        updateData.rejectionReason = rejectionReason.trim();
        updateData.rejectedAt = new Date();
      } else {
        // Sinon, c'est une approbation
        updateData.status = 'APPROVED';
        updateData.approvedAt = new Date();
      }
      
      const [updated] = await Leave.update(updateData, { 
        where: { id, tenantId: req.user.tenantId, status: 'PENDING' } 
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Congé non trouvé ou déjà traité' });
      }
      
      // Récupérer le congé mis à jour avec les relations
      const leave = await Leave.findOne({
        where: { id },
        include: [
          { 
            model: Employee, 
            as: 'employee', 
            attributes: ['id', 'firstName', 'lastName', 'position']
          },
          { 
            model: Employee, 
            as: 'approver', 
            attributes: ['id', 'firstName', 'lastName'] 
          }
        ]
      });
      
      return res.status(200).json(leave);
    } catch (error) {
      console.error('LeaveController.approve error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Leave.destroy({
        where: { id, tenantId: req.user.tenantId }
      });
      if (!deleted) return res.status(404).json({ error: 'Leave not found' });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /hr/leaves/my/justify-absence
   * L'employé justifie une de ses absences passées en l'imputant sur ses congés.
   * Si approuvé, le calcul de paie ne déduira plus ce jour comme absence non justifiée.
   */
  static async justifyAbsence(req, res) {
    try {
      const employeeId = req.user.employeeId;
      if (!employeeId) {
        return res.status(400).json({ error: 'NoEmployeeLinked', message: 'Aucun employé lié à ce compte' });
      }

      const { type, date, reason } = req.body;

      if (!type || !['PAID', 'SICK', 'MATERNITY', 'UNPAID', 'ANNUAL'].includes(type)) {
        return res.status(400).json({ error: 'Type de congé invalide. Valeurs acceptées : PAID, SICK, MATERNITY, UNPAID, ANNUAL' });
      }

      if (!date) {
        return res.status(400).json({ error: 'La date de l\'absence est obligatoire' });
      }

      const absenceDate = new Date(date);
      if (isNaN(absenceDate.getTime())) {
        return res.status(400).json({ error: 'Date invalide' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      absenceDate.setHours(0, 0, 0, 0);

      if (absenceDate >= today) {
        return res.status(400).json({ error: 'La date de justification doit être dans le passé' });
      }

      // Vérifier que l'employé appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId },
        attributes: ['id', 'firstName', 'lastName']
      });
      if (!employee) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Vérifier qu'il n'existe pas déjà un congé (en attente ou approuvé) pour cette date
      const existing = await Leave.findOne({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: { [Op.in]: ['PENDING', 'APPROVED'] },
          startDate: { [Op.lte]: date },
          endDate:   { [Op.gte]: date }
        }
      });
      if (existing) {
        return res.status(409).json({
          error: `Un congé ${existing.status === 'PENDING' ? 'en attente' : 'approuvé'} couvre déjà cette date.`
        });
      }

      const dateLabel = absenceDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const leave = await Leave.create({
        employeeId,
        type,
        startDate: date,
        endDate:   date,
        daysCount: 1,
        reason: reason?.trim() || `Justification d'absence du ${dateLabel}`,
        tenantId: req.user.tenantId,
        status: 'PENDING'
      });

      const created = await Leave.findOne({
        where: { id: leave.id },
        include: [
          { model: Employee, as: 'employee', attributes: ['id', 'firstName', 'lastName', 'position'] }
        ]
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error('LeaveController.justifyAbsence error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Solde de congés payés pour un employé sur l'année en cours.
   * acquiredDays = 2,5 jours/mois depuis le 1er janvier (ou date d'embauche si postérieure)
   * usedDays     = somme des daysCount des congés PAID/ANNUAL approuvés cette année
   */
  static async getLeaveBalance(req, res) {
    try {
      const { employeeId } = req.params;
      const year = parseInt(req.query.year) || new Date().getFullYear();

      // Vérifier que l'employé appartient au tenant
      const employee = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId },
        attributes: ['id', 'firstName', 'lastName', 'hireDate']
      });
      if (!employee) return res.status(404).json({ error: 'Employé non trouvé' });

      // Période de l'année
      const yearStart = new Date(year, 0, 1);   // 1er janvier
      const yearEnd   = new Date(year, 11, 31, 23, 59, 59); // 31 décembre
      const today     = new Date();

      // Date de début d'accumulation : max(1er janvier, date d'embauche)
      const hireDate  = employee.hireDate ? new Date(employee.hireDate) : yearStart;
      const accrualStart = hireDate > yearStart ? hireDate : yearStart;
      const accrualEnd   = today < yearEnd ? today : yearEnd;

      // Calcul des mois écoulés depuis accrualStart (arrondi au mois complet)
      const msPerMonth    = 1000 * 60 * 60 * 24 * 30.44;
      const monthsElapsed = Math.max(0, (accrualEnd - accrualStart) / msPerMonth);
      const acquiredDays  = Math.round(monthsElapsed * 2.5 * 10) / 10; // 2,5 j/mois

      // Jours utilisés = congés PAID + ANNUAL approuvés sur l'année
      const usedLeaves = await Leave.findAll({
        where: {
          employeeId,
          tenantId: req.user.tenantId,
          status: 'APPROVED',
          type: { [Op.in]: ['PAID', 'ANNUAL'] },
          startDate: { [Op.lte]: yearEnd },
          endDate:   { [Op.gte]: yearStart }
        }
      });
      const usedDays = usedLeaves.reduce((sum, l) => sum + (parseFloat(l.daysCount) || 0), 0);

      return res.status(200).json({
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        year,
        acquiredDays: Math.round(acquiredDays * 10) / 10,
        usedDays:     Math.round(usedDays * 10) / 10,
        remainingDays: Math.max(0, Math.round((acquiredDays - usedDays) * 10) / 10),
        accrualStart: accrualStart.toISOString().substring(0, 10),
        ratePerMonth: 2.5
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

// APRÈS - middleware conditionnel qui gère JSON ET multipart
export const leaveDocumentUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Si c'est du multipart (FormData avec fichier), laisser multer parser
  if (contentType.includes('multipart/form-data')) {
    upload.single('document')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          error: 'Erreur upload fichier: ' + err.message 
        });
      }
      next();
    });
  } else {
    // JSON classique → passer directement, express.json() a déjà parsé req.body
    next();
  }
};