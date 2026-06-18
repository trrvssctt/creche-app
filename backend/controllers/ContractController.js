import { Contract, Employee } from '../models/index.js';
import { transactionWithRetry, executeWithRetry } from '../utils/dbRetry.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

export class ContractController {
  static async list(req, res) {
    try {
      const items = await Contract.findAll({ 
        where: { tenantId: req.user.tenantId },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId']
        }]
      });
      return res.status(200).json(items);
    } catch (error) {
      // Fallback: if the error is about a missing column (e.g., contract_type), try a raw select with JOIN
      console.error('ContractController.list error:', error);
      if (String(error?.message || '').toLowerCase().includes('contract_type') || String(error?.message || '').toLowerCase().includes('column "contract_type"')) {
        try {
          const sql = `
            SELECT 
              c.id, c.tenant_id, c.employee_id, c.start_date, c.end_date, 
              c.salary, c.status, c.meta, c.created_at, c.updated_at,
              e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.position as employee_position,
              e.department_id as employee_department_id
            FROM contracts c 
            LEFT JOIN employees e ON c.employee_id = e.id
            WHERE c.tenant_id = $1
            ORDER BY c.created_at DESC
          `;
          const [results] = await sequelize.query(sql, { bind: [req.user.tenantId] });
          
          // Transform the results to match the expected structure
          const transformedResults = results.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            employeeId: row.employee_id,
            startDate: row.start_date,
            endDate: row.end_date,
            salary: row.salary,
            status: row.status,
            meta: row.meta,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            employee: {
              id: row.employee_id,
              firstName: row.employee_first_name,
              lastName: row.employee_last_name,
              email: row.employee_email,
              position: row.employee_position,
              departmentId: row.employee_department_id
            }
          }));
          
          return res.status(200).json(transformedResults);
        } catch (inner) {
          console.error('ContractController.list fallback error:', inner);
          return res.status(500).json({ error: inner.message || String(inner) });
        }
      }

      return res.status(500).json({ error: error.message });
    }
  }

  static async get(req, res) {
    try {
      const { id } = req.params;
      let item;
      try {
        item = await Contract.findOne({ 
          where: { id, tenantId: req.user.tenantId },
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId']
          }]
        });
      } catch (err) {
        // fallback raw select with JOIN
        if (String(err?.message || '').toLowerCase().includes('contract_type')) {
          const sql = `
            SELECT 
              c.id, c.tenant_id, c.employee_id, c.start_date, c.end_date, 
              c.salary, c.status, c.meta, c.created_at, c.updated_at,
              e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.position as employee_position,
              e.department_id as employee_department_id
            FROM contracts c 
            LEFT JOIN employees e ON c.employee_id = e.id
            WHERE c.id = $1 AND c.tenant_id = $2 
            LIMIT 1
          `;
          const [rows] = await sequelize.query(sql, { bind: [id, req.user.tenantId] });
          if (rows.length > 0) {
            const row = rows[0];
            item = {
              id: row.id,
              tenantId: row.tenant_id,
              employeeId: row.employee_id,
              startDate: row.start_date,
              endDate: row.end_date,
              salary: row.salary,
              status: row.status,
              meta: row.meta,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              employee: {
                id: row.employee_id,
                firstName: row.employee_first_name,
                lastName: row.employee_last_name,
                email: row.employee_email,
                position: row.employee_position,
                departmentId: row.employee_department_id
              }
            };
          }
        } else throw err;
      }
      if (!item) return res.status(404).json({ error: 'NotFound' });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { employeeId } = req.body;
      
      // Check if employee exists and belongs to the same tenant
      const employee = await Employee.findOne({ 
        where: { id: employeeId, tenantId } 
      });
      
      if (!employee) {
        return res.status(400).json({ error: 'Employé non trouvé ou n\'appartient pas à votre organisation.' });
      }
      
      // Check if employee already has an active contract
      const existingContract = await Contract.findOne({ 
        where: { 
          employeeId: employeeId, 
          tenantId: tenantId,
          status: 'ACTIVE'
        } 
      });
      
      if (existingContract) {
        return res.status(400).json({ error: 'L\'employé a déjà un contrat actif. Résiliez le contrat existant avant d\'en créer un nouveau.' });
      }

      const payload = { ...req.body, tenantId };
      
      const item = await Contract.create(payload);
      
      return res.status(201).json(item);
    } catch (error) {
      console.error('ContractController.create error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { modificationReason, ...updateData } = req.body;
      const tenantId = req.user.tenantId;
      
      // Vérification de la raison de modification
      if (!modificationReason || modificationReason.trim().length < 10) {
        return res.status(400).json({ 
          error: 'Une raison détaillée (minimum 10 caractères) est requise pour toute modification de contrat' 
        });
      }

      // Récupérer le contrat existant
      const contract = await Contract.findOne({ 
        where: { id, tenantId },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      });
      
      if (!contract) {
        return res.status(404).json({ error: 'Contrat non trouvé' });
      }

      // Validation selon le type de contrat
      if (updateData.type) {
        // CDI ne doit pas avoir de date de fin
        if (updateData.type === 'CDI' && updateData.endDate) {
          return res.status(400).json({ 
            error: 'Un contrat CDI ne peut pas avoir de date de fin' 
          });
        }

        // CDD et STAGE doivent avoir une date de fin
        if ((updateData.type === 'CDD' || updateData.type === 'STAGE') && 
            !updateData.endDate && !contract.endDate) {
          return res.status(400).json({ 
            error: `Un contrat de type ${updateData.type} doit avoir une date de fin` 
          });
        }
      }

      // Validation des dates si fournies
      if (updateData.startDate && updateData.endDate) {
        const startDate = new Date(updateData.startDate);
        const endDate = new Date(updateData.endDate);
        
        if (endDate <= startDate) {
          return res.status(400).json({ 
            error: 'La date de fin doit être postérieure à la date de début' 
          });
        }
      }

      // Sauvegarder les valeurs précédentes pour l'historique
      const previousValues = {
        type: contract.type,
        startDate: contract.startDate,
        endDate: contract.endDate,
        salary: contract.salary,
        currency: contract.currency,
        workLocation: contract.workLocation,
        trialPeriodEnd: contract.trialPeriodEnd
      };

      // Préparer les données de mise à jour avec historique
      const updatePayload = {
        ...updateData,
        modifiedAt: new Date(),
        modifiedBy: req.user.id || 'system',
        lastModificationReason: modificationReason.trim()
      };

      // Construire l'historique des modifications
      const changes = [];
      Object.keys(updateData).forEach(key => {
        if (previousValues.hasOwnProperty(key) && previousValues[key] !== updateData[key]) {
          changes.push({
            field: key,
            oldValue: previousValues[key],
            newValue: updateData[key]
          });
        }
      });

      // Sauvegarder l'historique dans le champ meta
      const existingMeta = contract.meta ? (typeof contract.meta === 'string' ? JSON.parse(contract.meta) : contract.meta) : {};
      const modificationHistory = existingMeta.modificationHistory || [];
      
      modificationHistory.push({
        timestamp: new Date().toISOString(),
        modifiedBy: req.user.id || 'system',
        reason: modificationReason.trim(),
        changes: changes,
        previousSnapshot: previousValues
      });

      updatePayload.meta = JSON.stringify({
        ...existingMeta,
        modificationHistory
      });

      // Effectuer la mise à jour
      await contract.update(updatePayload);
      
      // Recharger le contrat avec les données de l'employé
      const updatedContract = await Contract.findOne({
        where: { id, tenantId },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId']
        }]
      });
      
      return res.status(200).json({
        contract: updatedContract,
        modification: {
          reason: modificationReason,
          timestamp: new Date().toISOString(),
          changes: changes
        }
      });
    } catch (error) {
      console.error('ContractController.update error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id } = req.params;
      const item = await Contract.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!item) return res.status(404).json({ error: 'NotFound' });
      await item.destroy();
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async terminate(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Validation stricte du motif de résiliation
      if (!reason || typeof reason !== 'string' || reason.trim().length < 15) {
        return res.status(400).json({ 
          error: 'ValidationError',
          message: 'Le motif de résiliation est obligatoire et doit contenir au moins 15 caractères pour des raisons légales et de traçabilité.' 
        });
      }

      const contract = await Contract.findOne({ 
        where: { id, tenantId: req.user.tenantId },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      });
      
      if (!contract) {
        return res.status(404).json({ 
          error: 'NotFound', 
          message: 'Contrat non trouvé ou n\'appartient pas à votre organisation.' 
        });
      }
      
      if (contract.status !== 'ACTIVE') {
        return res.status(400).json({ 
          error: 'InvalidStatus',
          message: `Seuls les contrats actifs peuvent être résiliés. Le contrat actuel est en statut: ${contract.status}` 
        });
      }

      // Enregistrer les détails de la résiliation
      const terminationData = {
        status: 'TERMINATED',
        terminationDate: new Date(),
        terminationReason: reason.trim(),
        terminatedBy: req.user.id || 'system',
        terminatedAt: new Date().toISOString()
      };

      await contract.update(terminationData);

      return res.status(200).json({
        contract,
        termination: {
          reason: reason.trim(),
          date: terminationData.terminationDate,
          terminatedBy: req.user.id
        },
        message: 'Contrat résilié avec succès. L\'employé peut maintenant être désactivé si nécessaire.'
      });
    } catch (error) {
      console.error('ContractController.terminate error:', error);
      return res.status(500).json({ 
        error: 'InternalError', 
        message: 'Erreur lors de la résiliation du contrat' 
      });
    }
  }

  static async suspend(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: 'La raison de suspension doit contenir au moins 10 caractères.' });
      }

      const contract = await Contract.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!contract) return res.status(404).json({ error: 'Contrat non trouvé' });
      
      if (contract.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Seuls les contrats actifs peuvent être suspendus.' });
      }

      await contract.update({
        status: 'SUSPENDED',
        suspensionDate: new Date(),
        suspensionReason: reason.trim()
      });

      return res.status(200).json(contract);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async reactivate(req, res) {
    try {
      const { id } = req.params;
      
      const contract = await Contract.findOne({ where: { id, tenantId: req.user.tenantId } });
      if (!contract) return res.status(404).json({ error: 'Contrat non trouvé' });
      
      if (contract.status !== 'SUSPENDED') {
        return res.status(400).json({ error: 'Seuls les contrats suspendus peuvent être réactivés.' });
      }

      await contract.update({
        status: 'ACTIVE',
        suspensionDate: null,
        suspensionReason: null
      });

      return res.status(200).json(contract);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async renew(req, res) {
    try {
      const { id } = req.params;
      const { newEndDate, newSalary, newType, renewalReason, effectiveDate } = req.body;
      const tenantId = req.user.tenantId;

      // Validation des données requises
      if (!renewalReason || !effectiveDate) {
        return res.status(400).json({ 
          error: 'Raison du renouvellement et date d\'effet sont requis' 
        });
      }
      
      // Validation selon le type de contrat
      if (newType === 'CDI' && newEndDate) {
        return res.status(400).json({ 
          error: 'Un contrat CDI ne peut pas avoir de date de fin' 
        });
      }
      
      if ((newType === 'CDD' || newType === 'STAGE') && !newEndDate) {
        return res.status(400).json({ 
          error: `Une date de fin est obligatoire pour un contrat de type ${newType}` 
        });
      }

      // Validation des dates stricte
      const effectiveDateObj = new Date(effectiveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare dates only
      effectiveDateObj.setHours(0, 0, 0, 0);

      // Validation date d'effet stricte
      if (effectiveDateObj < today) {
        return res.status(400).json({ 
          error: 'La date d\'effet ne peut pas être antérieure à aujourd\'hui',
          field: 'effectiveDate',
          details: `Date d'effet: ${effectiveDate}, Aujourd'hui: ${today.toISOString().split('T')[0]}`
        });
      }

      // Validation que la date d'effet n'est pas trop lointaine (max 1 an)
      const maxEffectiveDate = new Date(today);
      maxEffectiveDate.setFullYear(today.getFullYear() + 1);
      if (effectiveDateObj > maxEffectiveDate) {
        return res.status(400).json({ 
          error: 'La date d\'effet ne peut pas être supérieure à 1 an dans le futur',
          field: 'effectiveDate',
          details: `Date limite: ${maxEffectiveDate.toISOString().split('T')[0]}`
        });
      }

      // Validation de la date de fin seulement si elle existe - STRICTE
      if (newEndDate) {
        const newEndDateObj = new Date(newEndDate);
        newEndDateObj.setHours(0, 0, 0, 0);
        
        // Date de fin doit être postérieure à la date d'effet (au moins 1 jour)
        if (newEndDateObj <= effectiveDateObj) {
          return res.status(400).json({ 
            error: 'La nouvelle date de fin doit être au moins 1 jour après la date d\'effet',
            field: 'newEndDate',
            details: `Date d'effet: ${effectiveDate}, Date de fin proposée: ${newEndDate}`
          });
        }

        // Validation durée minimale selon le type de contrat
        const diffDays = Math.ceil((newEndDateObj.getTime() - effectiveDateObj.getTime()) / (1000 * 60 * 60 * 24));
        
        if (newType === 'CDD' && diffDays < 7) {
          return res.status(400).json({ 
            error: 'Un CDD doit avoir une durée minimale de 7 jours',
            field: 'newEndDate',
            details: `Durée actuelle: ${diffDays} jour(s)`
          });
        }

        if (newType === 'STAGE' && diffDays < 14) {
          return res.status(400).json({ 
            error: 'Un stage doit avoir une durée minimale de 14 jours',
            field: 'newEndDate',
            details: `Durée actuelle: ${diffDays} jour(s)`
          });
        }
        
        // Validation durée Stage (max 6 mois STRICTE)
        if (newType === 'STAGE') {
          const maxStageDate = new Date(effectiveDateObj);
          maxStageDate.setMonth(effectiveDateObj.getMonth() + 6);
          
          if (newEndDateObj > maxStageDate) {
            return res.status(400).json({ 
              error: 'Un stage ne peut pas dépasser 6 mois exactement',
              field: 'newEndDate',
              details: `Date limite: ${maxStageDate.toISOString().split('T')[0]}`
            });
          }
        }
        
        // Validation durée maximale (5 ans STRICTE)
        const maxEndDate = new Date(effectiveDateObj);
        maxEndDate.setFullYear(effectiveDateObj.getFullYear() + 5);
        if (newEndDateObj > maxEndDate) {
          return res.status(400).json({ 
            error: 'La durée du contrat ne peut pas excéder 5 ans exactement',
            field: 'newEndDate',
            details: `Date limite: ${maxEndDate.toISOString().split('T')[0]}`
          });
        }

        // Validation que la date de fin n'est pas un weekend (pour les contrats professionnels)
        const dayOfWeek = newEndDateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return res.status(400).json({ 
            error: 'La date de fin de contrat ne peut pas être un weekend',
            field: 'newEndDate',
            details: 'Choisissez un jour de semaine (Lundi à Vendredi)'
          });
        }
      }

      // Exécuter l'opération de renouvellement avec retry automatique
      const result = await transactionWithRetry(
        sequelize,
        async (transaction) => {
          // Récupérer le contrat initial avec transaction et retry
          const existingContract = await Contract.findOne({
            where: { id, tenantId },
            transaction
          });

          if (!existingContract) {
            throw new Error('Contrat non trouvé');
          }

          if (existingContract.status !== 'ACTIVE') {
            throw new Error('Seuls les contrats actifs peuvent être renouvelés');
          }

          // Vérifier le plafond de renouvellements
          if (
            existingContract.maxRenewals !== null &&
            existingContract.maxRenewals !== undefined &&
            (existingContract.renewalCount || 0) >= existingContract.maxRenewals
          ) {
            throw new Error(
              `Renouvellement impossible : ce contrat a atteint son nombre maximum de renouvellements (${existingContract.renewalCount || 0}/${existingContract.maxRenewals})`
            );
          }

          // Vérifier qu'il n'y a pas d'autres contrats actifs pour cet employé
          const otherActiveContracts = await Contract.findAll({
            where: {
              employeeId: existingContract.employeeId,
              tenantId,
              status: 'ACTIVE',
              id: { [Op.ne]: id }
            },
            transaction
          });

          if (otherActiveContracts.length > 0) {
            throw new Error('Impossible de renouveler : l\'employé a d\'autres contrats actifs');
          }

          // Marquer le contrat actuel comme renouvelé dans la transaction
          await existingContract.update({
            status: 'RENEWED',
            endDate: effectiveDate, // Le contrat actuel se termine à la date d'effet du nouveau
            renewedAt: new Date(),
            renewedBy: req.user.id,
            renewalReason: renewalReason
          }, { transaction });

          // Créer le nouveau contrat dans la transaction
          const newContract = await Contract.create({
            employeeId: existingContract.employeeId,
            tenantId,
            type: newType || existingContract.type,
            startDate: effectiveDate,
            endDate: newEndDate || null,
            salary: newSalary || existingContract.salary,
            currency: existingContract.currency,
            workLocation: existingContract.workLocation,
            status: 'ACTIVE',
            previousContractId: existingContract.id,
            isRenewal: true,
            renewalReason: renewalReason,
            renewalCount: (existingContract.renewalCount || 0) + 1,
            maxRenewals: existingContract.maxRenewals ?? null,
            createdBy: req.user.id
          }, { transaction });

          return { existingContract, newContract };
        },
        { maxRetries: 2 } // Réessayer jusqu'à 2 fois en cas d'erreur de connexion
      );

      // Récupérer le nouveau contrat avec les données de l'employé (en dehors de la transaction)
      const contractWithEmployee = await executeWithRetry(
        () => Contract.findOne({
          where: { id: result.newContract.id },
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['id', 'firstName', 'lastName', 'email', 'position', 'departmentId']
          }]
        }),
        { maxRetries: 2 }
      );

      return res.status(200).json({
        message: 'Contrat renouvelé avec succès',
        oldContract: result.existingContract,
        newContract: contractWithEmployee || result.newContract,
        renewalInfo: {
          effectiveDate,
          reason: renewalReason,
          renewedAt: new Date(),
          renewedBy: req.user.id
        }
      });
    } catch (error) {
      console.error('ContractController.renew error:', error);
      
      // Gestion spécifique des erreurs de connexion
      if (error.name === 'SequelizeConnectionError' || 
          error.code === 'ETIMEDOUT' ||
          error.message.includes('timeout') ||
          error.message.includes('Connection')) {
        return res.status(503).json({ 
          error: 'Problème de connexion à la base de données. Veuillez réessayer dans quelques instants.',
          details: 'Service temporairement indisponible',
          retryable: true
        });
      }
      
      // Erreurs de validation métier
      if (error.message.includes('Contrat non trouvé') ||
          error.message.includes('Seuls les contrats actifs') ||
          error.message.includes('autres contrats actifs')) {
        return res.status(400).json({ 
          error: error.message,
          retryable: false
        });
      }
      
      return res.status(500).json({ 
        error: error.message || 'Erreur lors du renouvellement du contrat',
        details: 'Une erreur inattendue s\'est produite',
        retryable: false
      });
    }
  }

  static async getContractHistory(req, res) {
    try {
      const { employeeId } = req.params;
      const tenantId = req.user.tenantId;

      // Récupérer tous les contrats de l'employé triés par date de début
      const contracts = await Contract.findAll({
        where: {
          employeeId,
          tenantId
        },
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email', 'position']
        }],
        order: [['startDate', 'ASC']]
      });

      // Construire la timeline avec les événements
      const timeline = [];
      
      for (let contract of contracts) {
        // Événement de début de contrat
        timeline.push({
          id: `start-${contract.id}`,
          contractId: contract.id,
          type: 'CONTRACT_START',
          date: contract.startDate,
          title: contract.isRenewal ? `Renouvellement de contrat ${contract.type}` : `Début de contrat ${contract.type}`,
          description: contract.isRenewal ? 
            `Contrat renouvelé - Raison: ${contract.renewalReason}` : 
            `Nouveau contrat de travail de type ${contract.type}`,
          salary: contract.salary,
          currency: contract.currency,
          contractType: contract.type,
          status: contract.status,
          isRenewal: contract.isRenewal || false,
          renewalReason: contract.renewalReason
        });

        // Ajouter les événements de modification s'ils existent
        if (contract.meta) {
          try {
            // Vérifier si meta est déjà un objet ou une chaîne JSON
            const meta = typeof contract.meta === 'string' ? JSON.parse(contract.meta) : contract.meta;
            const modifications = meta.modificationHistory || [];
            
            modifications.forEach((modification, index) => {
              timeline.push({
                id: `modification-${contract.id}-${index}`,
                contractId: contract.id,
                type: 'CONTRACT_MODIFICATION',
                date: modification.timestamp,
                title: 'Modification de contrat',
                description: modification.reason,
                changes: modification.changes,
                previousSnapshot: modification.previousSnapshot,
                modifiedBy: modification.modifiedBy,
                contractType: contract.type,
                isModification: true
              });
            });
          } catch (e) {
            console.error('Error parsing contract meta:', e);
          }
        }

        // Événement de fin de contrat (sauf pour les contrats actifs sans date de fin)
        if (contract.endDate && contract.status !== 'ACTIVE') {
          let endType = 'CONTRACT_END';
          let endTitle = 'Fin de contrat';
          let endDescription = 'Contrat arrivé à terme';

          switch (contract.status) {
            case 'TERMINATED':
              endType = 'CONTRACT_TERMINATED';
              endTitle = 'Contrat résilié';
              endDescription = 'Contrat résilié avant terme';
              break;
            case 'SUSPENDED':
              endType = 'CONTRACT_SUSPENDED';
              endTitle = 'Contrat suspendu';
              endDescription = 'Contrat temporairement suspendu';
              break;
            case 'RENEWED':
              endType = 'CONTRACT_RENEWED';
              endTitle = 'Contrat renouvelé';
              endDescription = `Contrat renouvelé - ${contract.renewalReason}`;
              break;
          }

          timeline.push({
            id: `end-${contract.id}`,
            contractId: contract.id,
            type: endType,
            date: contract.endDate,
            title: endTitle,
            description: endDescription,
            salary: contract.salary,
            currency: contract.currency,
            contractType: contract.type,
            status: contract.status,
            renewalReason: contract.renewalReason
          });
        }
      }

      // Trier la timeline par date
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      return res.status(200).json({
        contracts,
        timeline,
        summary: {
          totalContracts: contracts.length,
          activeContracts: contracts.filter(c => c.status === 'ACTIVE').length,
          renewedContracts: contracts.filter(c => c.status === 'RENEWED').length,
          terminatedContracts: contracts.filter(c => c.status === 'TERMINATED').length
        }
      });
    } catch (error) {
      console.error('ContractController.getContractHistory error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async getExpiringContracts(req, res) {
    try {
      const { days = 30 } = req.query;
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() + parseInt(days));

      const [results] = await sequelize.query(`
        SELECT c.*, e.first_name, e.last_name, e.email 
        FROM contracts c 
        JOIN employees e ON c.employee_id = e.id 
        WHERE c.tenant_id = $1 
        AND c.status = 'ACTIVE' 
        AND c.end_date IS NOT NULL 
        AND c.end_date <= $2
        ORDER BY c.end_date ASC
      `, {
        bind: [req.user.tenantId, alertDate]
      });

      return res.status(200).json(results);
    } catch (error) {
      console.error('ContractController.getExpiringContracts error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
