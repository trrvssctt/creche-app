
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Plan extends Model {}

Plan.init({
  id: { type: DataTypes.STRING, primaryKey: true }, 
  name: { type: DataTypes.STRING, allowNull: false },
  priceMonthly: { type: DataTypes.FLOAT, allowNull: false, field: 'price_monthly' },
  priceThreeMonths: { type: DataTypes.FLOAT, allowNull: true, field: 'price_three_months' },
  priceYearly: { type: DataTypes.FLOAT, allowNull: false, field: 'price_yearly' },
  trialDays: { type: DataTypes.INTEGER, defaultValue: 14, field: 'trial_days' },
  maxUsers: { type: DataTypes.INTEGER, defaultValue: 1, field: 'max_users' },
  hasAiChatbot: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_ai_chatbot' },
  hasStockForecast: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_stock_forecast' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  features: { type: DataTypes.JSONB, defaultValue: [] }
}, { 
  sequelize, 
  modelName: 'plan',
  tableName: 'plans',
  underscored: true 
});

export default Plan;
