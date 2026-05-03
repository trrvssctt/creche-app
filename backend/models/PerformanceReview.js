import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PerformanceReview extends Model {}

PerformanceReview.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  reviewerId: { type: DataTypes.UUID, allowNull: false, field: 'reviewer_id' },
  reviewPeriod: { 
    type: DataTypes.ENUM('ANNUAL', 'QUARTERLY', 'MONTHLY'), 
    field: 'review_period' 
  },
  periodStart: { type: DataTypes.DATEONLY, field: 'period_start' },
  periodEnd: { type: DataTypes.DATEONLY, field: 'period_end' },
  overallRating: { 
    type: DataTypes.INTEGER,
    field: 'overall_rating',
    validate: { min: 1, max: 5 }
  },
  goalsAchievement: { 
    type: DataTypes.INTEGER,
    field: 'goals_achievement',
    validate: { min: 1, max: 5 }
  },
  communicationSkills: { 
    type: DataTypes.INTEGER,
    field: 'communication_skills',
    validate: { min: 1, max: 5 }
  },
  technicalSkills: { 
    type: DataTypes.INTEGER,
    field: 'technical_skills',
    validate: { min: 1, max: 5 }
  },
  leadershipSkills: { 
    type: DataTypes.INTEGER,
    field: 'leadership_skills',
    validate: { min: 1, max: 5 }
  },
  strengths: { type: DataTypes.TEXT },
  areasForImprovement: { type: DataTypes.TEXT, field: 'areas_for_improvement' },
  goalsNextPeriod: { type: DataTypes.TEXT, field: 'goals_next_period' },
  comments: { type: DataTypes.TEXT },
  status: { 
    type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'FINALIZED'), 
    defaultValue: 'DRAFT' 
  }
}, {
  sequelize,
  modelName: 'performanceReview',
  tableName: 'performance_reviews',
  underscored: true
});

export default PerformanceReview;