
import { DataTypes, Model } from 'sequelize';
import { sequelize_db_template } from '../config/database.js';

export class PromptTemplate extends Model {}

PromptTemplate.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  title: { 
    type: DataTypes.STRING(255), 
    allowNull: false 
  },
  description: { 
    type: DataTypes.TEXT,
    allowNull: true
  },
  promptText: { 
    type: DataTypes.TEXT, 
    allowNull: false,
    field: 'prompt_text'
  },
  category: { 
    type: DataTypes.STRING(100),
    allowNull: true
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true,
    field: 'is_active'
  }
}, { 
  sequelize: sequelize_db_template, 
  modelName: 'prompt_template',
  tableName: 'prompt_templates',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false 
});

export default PromptTemplate;
