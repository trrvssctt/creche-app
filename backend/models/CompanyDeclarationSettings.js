import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CompanyDeclarationSettings = sequelize.define('CompanyDeclarationSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tenant_id',
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  
  // Informations entreprise
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'company_name'
  },
  siret: {
    type: DataTypes.STRING(14),
    allowNull: true,
    validate: {
      is: /^[0-9]{14}$/i
    }
  },
  nafCode: {
    type: DataTypes.STRING(5),
    allowNull: true,
    field: 'naf_code',
    validate: {
      is: /^[0-9]{4}[A-Z]$/i
    }
  },
  legalForm: {
    type: DataTypes.ENUM('SARL', 'SA', 'SAS', 'SASU', 'EURL', 'EI', 'SNC', 'SCS', 'OTHER'),
    allowNull: false,
    defaultValue: 'SARL',
    field: 'legal_form'
  },
  collectiveAgreement: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'collective_agreement'
  },
  
  // Adresse
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  postalCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'postal_code'
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Sénégal'
  },
  
  // Organismes sociaux
  ipresNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ipres_number',
    comment: 'Numéro IPRES (Institution de Prévoyance Retraite du Sénégal)'
  },
  cssNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'css_number',
    comment: 'Numéro CSS (Caisse de Sécurité Sociale)'
  },
  cfceNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'cfce_number',
    comment: 'Numéro CFCE (Caisse de Compensation des Prestations Familiales)'
  },
  
  // Paramètres fiscaux
  taxNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'tax_number',
    comment: 'Numéro d\'identification fiscal'
  },
  vatNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'vat_number',
    comment: 'Numéro de TVA'
  },
  taxRegime: {
    type: DataTypes.ENUM('RSI', 'RNI', 'OTHER'),
    allowNull: false,
    defaultValue: 'RSI',
    field: 'tax_regime',
    comment: 'Régime fiscal (RSI: Régime Synthétique d\'Imposition, RNI: Régime Normal d\'Imposition)'
  },
  
  // Taux de cotisations (en pourcentage)
  ipresEmployeeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 5.6,
    field: 'ipres_employee_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux cotisation IPRES salarié'
  },
  ipresEmployerRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 8.4,
    field: 'ipres_employer_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux cotisation IPRES employeur'
  },
  cssEmployeeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 3.5,
    field: 'css_employee_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux cotisation CSS salarié'
  },
  cssEmployerRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 7.0,
    field: 'css_employer_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux cotisation CSS employeur'
  },
  cfceEmployerRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 7.0,
    field: 'cfce_employer_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux cotisation CFCE employeur uniquement'
  },
  accidentWorkRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 3.0,
    field: 'accident_work_rate',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Taux accidents du travail'
  },
  
  // Paramètres de déclaration
  declarationDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15,
    field: 'declaration_day',
    validate: {
      min: 1,
      max: 31
    },
    comment: 'Jour du mois pour les déclarations (ex: 15 = avant le 15 de chaque mois)'
  },
  fiscalYearStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'fiscal_year_start',
    comment: 'Début de l\'exercice fiscal'
  },
  
  // Contact responsable
  responsibleName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'responsible_name'
  },
  responsibleEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'responsible_email',
    validate: {
      isEmail: true
    }
  },
  responsiblePhone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'responsible_phone'
  },
  
  // Configuration
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastUpdatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'last_updated_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'company_declaration_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['tenant_id'],
      name: 'company_declaration_settings_tenant_unique'
    },
    {
      fields: ['siret'],
      name: 'company_declaration_settings_siret_idx'
    },
    {
      fields: ['tax_number'],
      name: 'company_declaration_settings_tax_number_idx'
    }
  ]
});