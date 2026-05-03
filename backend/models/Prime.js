import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Prime = sequelize.define('Prime', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('PERFORMANCE', 'EXCEPTIONAL', 'ANNUAL_BONUS', 'PROJECT_BONUS', 'OTHER'),
    allowNull: false,
    defaultValue: 'PERFORMANCE'
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'F CFA'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'APPROVED' // Les primes sont généralement approuvées directement
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  payrollMonth: {
    type: DataTypes.STRING(7), // Format YYYY-MM
    allowNull: true,
    comment: 'Mois de paie où cette prime sera incluse'
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Catégorie de la prime pour les rapports'
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  }
}, {
  tableName: 'primes',
  timestamps: true,
  indexes: [
    {
      fields: ['employeeId']
    },
    {
      fields: ['tenantId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    },
    {
      fields: ['payrollMonth']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Hooks pour gérer l'approbation automatique
Prime.beforeSave((prime) => {
  if (prime.status === 'APPROVED' && !prime.approvedAt) {
    prime.approvedAt = new Date();
  }
});