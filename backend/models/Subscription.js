
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Subscription extends Model {}

Subscription.init({
  // Utilisation de tenantId comme clé primaire pour l'isolation stricte 1:1 par tenant
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false, 
    primaryKey: true, 
    field: 'tenant_id' 
  },
  planId: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    field: 'plan_id',
    defaultValue: 'FREE_TRIAL'
  },
  status: { 
    type: DataTypes.STRING(20), 
    defaultValue: 'TRIAL' 
  },
  nextBillingDate: { 
    type: DataTypes.DATE, 
    field: 'next_billing_date' 
  },
  autoRenew: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'auto_renew'
  },
  currentPeriod: {
    type: DataTypes.STRING(10),
    defaultValue: '1M',
    field: 'current_period'
  }
}, {
  sequelize,
  modelName: 'subscription',
  tableName: 'subscriptions',
  underscored: true,
  timestamps: true // Active createdAt/updatedAt pour le suivi
});

export default Subscription;
