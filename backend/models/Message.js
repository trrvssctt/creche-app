
import { DataTypes, Model } from 'sequelize';
import { sequelize_db_template } from '../config/database.js';

export class Message extends Model {}

Message.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  conversationId: { 
    type: DataTypes.UUID,
    allowNull: true,
    field: 'conversation_id'
  },
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false,
    field: 'tenant_id'
  },
  sender: { 
    type: DataTypes.ENUM('user', 'ai'), 
    allowNull: false 
  },
  message: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  metadata: { 
    type: DataTypes.JSON,
    allowNull: true
  },
  requetteUtiliser: { 
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'requette_utiliser'
  },
  databaseUsed: { 
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'database_used'
  },
  tokensUsed: { 
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'tokens_used'
  }
}, { 
  sequelize: sequelize_db_template, 
  modelName: 'message',
  tableName: 'messages',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false 
});

export default Message;
