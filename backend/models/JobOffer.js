import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class JobOffer extends Model {}

JobOffer.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  requirements: { type: DataTypes.TEXT },
  location: { type: DataTypes.STRING },
  salaryMin: { type: DataTypes.DECIMAL, field: 'salary_min' },
  salaryMax: { type: DataTypes.DECIMAL, field: 'salary_max' },
  currency: { type: DataTypes.STRING, defaultValue: 'F CFA' },
  employmentType: { 
    type: DataTypes.ENUM('CDI', 'CDD', 'STAGE', 'FREELANCE'), 
    field: 'employment_type' 
  },
  department: { type: DataTypes.STRING },
  status: { 
    type: DataTypes.ENUM('OPEN', 'CLOSED', 'PAUSED'), 
    defaultValue: 'OPEN' 
  },
  publishedAt: { type: DataTypes.DATE, field: 'published_at' },
  expiresAt: { type: DataTypes.DATE, field: 'expires_at' },
  createdBy: { type: DataTypes.UUID, field: 'created_by' }
}, {
  sequelize,
  modelName: 'jobOffer',
  tableName: 'job_offers',
  underscored: true
});

export default JobOffer;