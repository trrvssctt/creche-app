import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class ContactMessage extends Model {}

ContactMessage.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  fullName: { 
    type: DataTypes.STRING(255), 
    allowNull: false,
    field: 'full_name'
  },
  email: { 
    type: DataTypes.STRING(255), 
    allowNull: false 
  },
  phone: { 
    type: DataTypes.STRING(50), 
    allowNull: true 
  },
  subject: { 
    type: DataTypes.STRING(500), 
    allowNull: true 
  },
  message: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  status: { 
    type: DataTypes.ENUM('non_lus', 'lus'), 
    defaultValue: 'non_lus',
    allowNull: false 
  },
  ipAddress: { 
    type: DataTypes.STRING(45), // Utiliser STRING au lieu de INET pour la compatibilité
    allowNull: true,
    field: 'ip_address'
  },
  userAgent: { 
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  },
  source: { 
    type: DataTypes.STRING(100),
    defaultValue: 'landing_page',
    allowNull: true
  },
  adminNotes: { 
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes'
  },
  repliedAt: { 
    type: DataTypes.DATE,
    allowNull: true,
    field: 'replied_at'
  },
  repliedBy: { 
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'replied_by'
  },
  // Définir explicitement les timestamps avec le bon mapping
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, { 
  sequelize,
  modelName: 'ContactMessage',
  tableName: 'contact_messages',
  paranoid: false,
  timestamps: true,
  // Ne pas redéfinir createdAt/updatedAt ici puisqu'ils sont définis comme attributs
  // Assurer que les noms de colonnes sont corrects
  underscored: false, // Garder false car nous mappons manuellement
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['email']
    }
  ]
});

export default ContactMessage;