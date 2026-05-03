import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Declaration = sequelize.define('Declaration', {
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
  
  // Type et période de déclaration
  declarationType: {
    type: DataTypes.ENUM(
      'IPRES_MONTHLY', 'CSS_MONTHLY', 'CFCE_MONTHLY',
      'VRS_MONTHLY', 'TAX_QUARTERLY', 'TAX_ANNUAL',
      'SOCIAL_ANNUAL', 'DADS', 'OTHER'
    ),
    allowNull: false,
    field: 'declaration_type'
  },
  period: {
    type: DataTypes.STRING(7), // Format: YYYY-MM ou YYYY-QX
    allowNull: false,
    comment: 'Période de déclaration (ex: 2024-03 ou 2024-Q1)'
  },
  fiscalYear: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'fiscal_year',
    comment: 'Année fiscale concernée'
  },
  
  // Informations sur la déclaration
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Statut et échéances
  status: {
    type: DataTypes.ENUM('DRAFT', 'READY', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'PAID'),
    allowNull: false,
    defaultValue: 'DRAFT'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'due_date',
    comment: 'Date limite de déclaration'
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'submitted_at',
    comment: 'Date de soumission effective'
  },
  validatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'validated_at',
    comment: 'Date de validation par l\'organisme'
  },
  
  // Montants
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_amount',
    comment: 'Montant total de la déclaration'
  },
  employeeCotisations: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'employee_cotisations',
    comment: 'Cotisations salariales'
  },
  employerCotisations: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'employer_cotisations',
    comment: 'Cotisations patronales'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'tax_amount',
    comment: 'Montant des impôts'
  },
  
  // Détails techniques
  numberOfEmployees: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'number_of_employees',
    comment: 'Nombre d\'employés concernés'
  },
  totalSalaryBase: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_salary_base',
    comment: 'Masse salariale de base'
  },
  
  // Références externes
  referenceNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reference_number',
    comment: 'Numéro de référence organisme'
  },
  fileReference: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'file_reference',
    comment: 'Référence du fichier généré'
  },
  organisme: {
    type: DataTypes.ENUM('IPRES', 'CSS', 'CFCE', 'DGI', 'OTHER'),
    allowNull: false,
    comment: 'Organisme destinataire'
  },
  
  // Fichiers et documents
  generatedFiles: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'generated_files',
    comment: 'Liste des fichiers générés (PDF, XML, etc.)'
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Documents joints à la déclaration'
  },
  
  // Commentaires et notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes internes sur la déclaration'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason',
    comment: 'Motif de rejet si applicable'
  },
  
  // Audit
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  submittedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'submitted_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  lastModifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'last_modified_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'declarations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['tenant_id', 'period', 'declaration_type'],
      name: 'declarations_tenant_period_type_idx'
    },
    {
      fields: ['status'],
      name: 'declarations_status_idx'
    },
    {
      fields: ['due_date'],
      name: 'declarations_due_date_idx'
    },
    {
      fields: ['organisme'],
      name: 'declarations_organisme_idx'
    },
    {
      unique: true,
      fields: ['tenant_id', 'period', 'declaration_type'],
      name: 'declarations_unique_per_period'
    }
  ]
});