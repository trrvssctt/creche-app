import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Candidate extends Model {}

Candidate.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  jobOfferId: { type: DataTypes.UUID, allowNull: false, field: 'job_offer_id' },
  firstName: { type: DataTypes.STRING, allowNull: false, field: 'first_name' },
  lastName: { type: DataTypes.STRING, allowNull: false, field: 'last_name' },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  resumeUrl: { type: DataTypes.TEXT, field: 'resume_url' },
  coverLetter: { type: DataTypes.TEXT, field: 'cover_letter' },
  status: { 
    type: DataTypes.ENUM('NEW', 'REVIEWED', 'INTERVIEW', 'HIRED', 'REJECTED'), 
    defaultValue: 'NEW' 
  },
  rating: { 
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 }
  },
  notes: { type: DataTypes.TEXT },
  interviewDate: { type: DataTypes.DATE, field: 'interview_date' }
}, {
  sequelize,
  modelName: 'candidate',
  tableName: 'candidates',
  underscored: true
});

export default Candidate;