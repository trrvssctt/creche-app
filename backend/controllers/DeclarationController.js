import { CompanyDeclarationSettings, Declaration, Tenant, User } from '../models/index.js';
import { Op } from 'sequelize';

export const DeclarationController = {
  // === PARAMÈTRES DE DÉCLARATION ===
  
  // Récupérer les paramètres de déclaration de l'entreprise
  async getDeclarationSettings(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      
      let settings = await CompanyDeclarationSettings.findOne({
        where: { tenantId },
        include: [{
          model: Tenant,
          attributes: ['id', 'name', 'domain']
        }]
      });
      
      // Si pas de paramètres, créer des paramètres par défaut
      if (!settings) {
        const tenant = await Tenant.findByPk(tenantId);
        settings = await CompanyDeclarationSettings.create({
          tenantId,
          companyName: tenant?.name || 'Mon Entreprise',
          country: 'Sénégal',
          legalForm: 'SARL',
          taxRegime: 'RSI',
          // Taux par défaut (Sénégal)
          ipresEmployeeRate: 5.6,
          ipresEmployerRate: 8.4,
          cssEmployeeRate: 3.5,
          cssEmployerRate: 7.0,
          cfceEmployerRate: 7.0,
          accidentWorkRate: 3.0,
          declarationDay: 15,
          fiscalYearStart: new Date(`${new Date().getFullYear()}-01-01`),
          isActive: true
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Mettre à jour les paramètres de déclaration
  async updateDeclarationSettings(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;
      
      // Mapper les champs du frontend vers les attributs du modèle
      const modelData = {
        tenantId,
        companyName: req.body.companyName,
        siret: req.body.siret,
        nafCode: req.body.nafCode,
        legalForm: req.body.legalForm,
        collectiveAgreement: req.body.collectiveAgreement,
        address: req.body.address,
        city: req.body.city,
        postalCode: req.body.postalCode,
        country: req.body.country,
        ipresNumber: req.body.ipresNumber,
        cssNumber: req.body.cssNumber,
        cfceNumber: req.body.cfceNumber,
        taxNumber: req.body.taxNumber,
        vatNumber: req.body.vatNumber,
        taxRegime: req.body.taxRegime,
        ipresEmployeeRate: req.body.ipresEmployeeRate,
        ipresEmployerRate: req.body.ipresEmployerRate,
        cssEmployeeRate: req.body.cssEmployeeRate,
        cssEmployerRate: req.body.cssEmployerRate,
        cfceEmployerRate: req.body.cfceEmployerRate,
        accidentWorkRate: req.body.accidentWorkRate,
        declarationDay: req.body.declarationDay,
        responsibleName: req.body.responsibleName,
        responsibleEmail: req.body.responsibleEmail,
        responsiblePhone: req.body.responsiblePhone,
        lastUpdatedBy: userId
      };
      
      const [settings, created] = await CompanyDeclarationSettings.findOrCreate({
        where: { tenantId },
        defaults: modelData
      });
      
      if (!created) {
        await settings.update(modelData);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // === GESTION DES DÉCLARATIONS ===
  
  // Récupérer toutes les déclarations
  async getDeclarations(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { status, organisme, year, type } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      
      const where = { tenantId };
      
      // Filtres optionnels
      if (status) where.status = status;
      if (organisme) where.organisme = organisme;
      if (year) where.fiscalYear = parseInt(year);
      if (type) where.declarationType = type;
      
      const { rows: declarations, count } = await Declaration.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'submitter',
            attributes: ['id', 'name']
          }
        ],
        order: [['due_date', 'DESC'], ['created_at', 'DESC']],
        limit,
        offset
      });
      
      res.json({
        declarations,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des déclarations:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Récupérer une déclaration spécifique
  async getDeclaration(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;
      
      const declaration = await Declaration.findOne({
        where: { id, tenantId },
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'submitter',
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'modifier',
            attributes: ['id', 'firstName', 'lastName']
          }
        ]
      });
      
      if (!declaration) {
        return res.status(404).json({ error: 'Déclaration non trouvée' });
      }
      
      res.json(declaration);
    } catch (error) {
      console.error('Erreur lors de la récupération de la déclaration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Créer une nouvelle déclaration
  async createDeclaration(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;
      
      const declaration = await Declaration.create({
        ...req.body,
        tenantId,
        createdBy: userId,
        lastModifiedBy: userId
      });
      
      res.status(201).json(declaration);
    } catch (error) {
      console.error('Erreur lors de la création de la déclaration:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'Une déclaration existe déjà pour cette période et ce type' 
        });
      }
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Mettre à jour une déclaration
  async updateDeclaration(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;
      const userId = req.user.id;
      
      const declaration = await Declaration.findOne({
        where: { id, tenantId }
      });
      
      if (!declaration) {
        return res.status(404).json({ error: 'Déclaration non trouvée' });
      }
      
      // Vérifier qu'on peut encore modifier
      if (['SUBMITTED', 'VALIDATED'].includes(declaration.status)) {
        return res.status(400).json({ 
          error: 'Impossible de modifier une déclaration déjà soumise ou validée' 
        });
      }
      
      await declaration.update({
        ...req.body,
        lastModifiedBy: userId
      });
      
      res.json(declaration);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la déclaration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Supprimer une déclaration
  async deleteDeclaration(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;
      
      const declaration = await Declaration.findOne({
        where: { id, tenantId }
      });
      
      if (!declaration) {
        return res.status(404).json({ error: 'Déclaration non trouvée' });
      }
      
      // Vérifier qu'on peut supprimer
      if (['SUBMITTED', 'VALIDATED', 'PAID'].includes(declaration.status)) {
        return res.status(400).json({ 
          error: 'Impossible de supprimer une déclaration déjà soumise' 
        });
      }
      
      await declaration.destroy();
      res.json({ message: 'Déclaration supprimée avec succès' });
    } catch (error) {
      console.error('Erreur lors de la suppression de la déclaration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Soumettre une déclaration
  async submitDeclaration(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;
      const userId = req.user.id;
      
      const declaration = await Declaration.findOne({
        where: { id, tenantId }
      });
      
      if (!declaration) {
        return res.status(404).json({ error: 'Déclaration non trouvée' });
      }
      
      if (declaration.status !== 'READY') {
        return res.status(400).json({ 
          error: 'Seules les déclarations prêtes peuvent être soumises' 
        });
      }
      
      await declaration.update({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
        lastModifiedBy: userId
      });
      
      res.json(declaration);
    } catch (error) {
      console.error('Erreur lors de la soumission de la déclaration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // === FONCTIONNALITÉS AVANCÉES ===
  
  // Générer les déclarations mensuelles automatiquement
  async generateMonthlyDeclarations(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const userId = req.user.id;
      const { period } = req.body; // Format: "2024-03"
      
      const [year, month] = period.split('-');
      const dueDate = new Date(parseInt(year), parseInt(month), 15); // Due le 15 du mois suivant
      
      // Types de déclarations mensuelles à générer
      const declarationTypes = [
        {
          type: 'IPRES_MONTHLY',
          organisme: 'IPRES',
          title: `Déclaration IPRES - ${new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}`
        },
        {
          type: 'CSS_MONTHLY',
          organisme: 'CSS',
          title: `Déclaration CSS - ${new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}`
        },
        {
          type: 'CFCE_MONTHLY',
          organisme: 'CFCE',
          title: `Déclaration CFCE - ${new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}`
        },
        {
          type: 'VRS_MONTHLY',
          organisme: 'DGI',
          title: `VRS (Impôts sur Salaires) - ${new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}`
        }
      ];
      
      const createdDeclarations = [];
      
      for (const declType of declarationTypes) {
        // Vérifier si la déclaration existe déjà
        const existing = await Declaration.findOne({
          where: {
            tenantId,
            period,
            declarationType: declType.type
          }
        });
        
        if (!existing) {
          const declaration = await Declaration.create({
            tenantId,
            declarationType: declType.type,
            period,
            fiscalYear: parseInt(year),
            title: declType.title,
            organisme: declType.organisme,
            status: 'DRAFT',
            dueDate,
            totalAmount: 0,
            employeeCotisations: 0,
            employerCotisations: 0,
            taxAmount: 0,
            numberOfEmployees: 0,
            totalSalaryBase: 0,
            createdBy: userId,
            lastModifiedBy: userId
          });
          
          createdDeclarations.push(declaration);
        }
      }
      
      res.json({
        message: `${createdDeclarations.length} déclarations générées pour ${period}`,
        declarations: createdDeclarations
      });
    } catch (error) {
      console.error('Erreur lors de la génération des déclarations:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Calculer les montants d'une déclaration depuis les données de paie
  async calculateDeclarationAmounts(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const { id } = req.params;
      
      const declaration = await Declaration.findOne({
        where: { id, tenantId }
      });
      
      if (!declaration) {
        return res.status(404).json({ error: 'Déclaration non trouvée' });
      }
      
      // TODO: Implémenter le calcul depuis les données de paie
      // Pour l'instant, simulation avec des données fictives
      const calculatedAmounts = {
        numberOfEmployees: 12,
        totalSalaryBase: 2400000, // 2,4M CFA
        employeeCotisations: declaration.declarationType === 'IPRES_MONTHLY' ? 134400 : 84000,
        employerCotisations: declaration.declarationType === 'IPRES_MONTHLY' ? 201600 : 168000,
        taxAmount: declaration.declarationType === 'VRS_MONTHLY' ? 96000 : 0,
        totalAmount: 0
      };
      
      calculatedAmounts.totalAmount = calculatedAmounts.employeeCotisations + 
                                     calculatedAmounts.employerCotisations + 
                                     calculatedAmounts.taxAmount;
      
      // Mettre à jour la déclaration
      await declaration.update(calculatedAmounts);
      
      res.json(declaration);
    } catch (error) {
      console.error('Erreur lors du calcul des montants:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  // Tableau de bord des déclarations
  async getDeclarationsDashboard(req, res) {
    try {
      const { tenantId } = req.tenantFilter;
      const currentYear = new Date().getFullYear();
      
      // Statistiques générales
      const totalDeclarations = await Declaration.count({ 
        where: { tenantId, fiscalYear: currentYear }
      });
      
      const submittedDeclarations = await Declaration.count({
        where: { 
          tenantId, 
          fiscalYear: currentYear,
          status: { [Op.in]: ['SUBMITTED', 'VALIDATED', 'PAID'] }
        }
      });
      
      const pendingDeclarations = await Declaration.count({
        where: { 
          tenantId, 
          fiscalYear: currentYear,
          status: { [Op.in]: ['DRAFT', 'READY'] },
          dueDate: { [Op.gte]: new Date() }
        }
      });
      
      const overdueDeclarations = await Declaration.count({
        where: { 
          tenantId, 
          fiscalYear: currentYear,
          status: { [Op.in]: ['DRAFT', 'READY'] },
          dueDate: { [Op.lt]: new Date() }
        }
      });
      
      // Prochaines échéances
      const upcomingDeadlines = await Declaration.findAll({
        where: {
          tenantId,
          status: { [Op.in]: ['DRAFT', 'READY'] },
          dueDate: { 
            [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
          }
        },
        order: [['due_date', 'ASC']],
        limit: 5
      });
      
      // Montants totaux par organisme
      const amountsByOrganisme = await Declaration.findAll({
        where: { 
          tenantId, 
          fiscalYear: currentYear,
          status: { [Op.in]: ['SUBMITTED', 'VALIDATED', 'PAID'] }
        },
        attributes: [
          'organisme',
          [Declaration.sequelize.fn('SUM', Declaration.sequelize.col('total_amount')), 'totalAmount']
        ],
        group: ['organisme']
      });
      
      res.json({
        statistics: {
          totalDeclarations,
          submittedDeclarations,
          pendingDeclarations,
          overdueDeclarations,
          submissionRate: totalDeclarations > 0 ? Math.round((submittedDeclarations / totalDeclarations) * 100) : 0
        },
        upcomingDeadlines,
        amountsByOrganisme
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};