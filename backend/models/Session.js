import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Session extends Model {
  /**
   * Méthode pour vérifier si une session est encore valide
   */
  isValid() {
    const now = new Date();
    return this.isActive && this.expiresAt > now;
  }

  /**
   * Méthode pour mettre à jour la dernière activité
   */
  async updateActivity() {
    this.lastActivity = new Date();
    await this.save();
  }

  /**
   * Méthode pour terminer une session
   */
  async terminate() {
    this.isActive = false;
    this.logoutAt = new Date();
    await this.save();
  }
}

Session.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false, 
    field: 'tenant_id' 
  },
  userId: { 
    type: DataTypes.UUID, 
    allowNull: false,
    field: 'user_id'
  },
  sessionToken: { 
    type: DataTypes.STRING(255), 
    allowNull: false,
    unique: true,
    field: 'session_token'
  },
  jwtToken: { 
    type: DataTypes.TEXT, 
    allowNull: false,
    field: 'jwt_token'
  },
  ipAddress: { 
    type: DataTypes.INET,
    allowNull: true,
    field: 'ip_address'
  },
  userAgent: { 
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  },
  deviceInfo: { 
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'device_info'
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true,
    field: 'is_active'
  },
  lastActivity: { 
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_activity'
  },
  loginAt: { 
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'login_at'
  },
  logoutAt: { 
    type: DataTypes.DATE,
    allowNull: true,
    field: 'logout_at'
  },
  expiresAt: { 
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  }
}, { 
  sequelize, 
  modelName: 'session',
  tableName: 'sessions',
  underscored: true,
  hooks: {
    beforeCreate: (session) => {
      // Auto-générer le session token si pas fourni
      if (!session.sessionToken) {
        session.sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      }
      
      // Par défaut, expiration dans 24h si pas spécifié
      if (!session.expiresAt) {
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24);
        session.expiresAt = expirationTime;
      }
    }
  }
});

// Méthodes statiques pour la gestion des sessions
Session.findActiveByUserId = function(userId) {
  return this.findAll({
    where: {
      userId,
      isActive: true,
      expiresAt: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    },
    order: [['lastActivity', 'DESC']]
  });
};

Session.findByToken = function(sessionToken) {
  return this.findOne({
    where: {
      sessionToken,
      isActive: true,
      expiresAt: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    }
  });
};

Session.cleanupExpiredSessions = async function() {
  const expiredSessions = await this.findAll({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { isActive: false },
        { expiresAt: { [sequelize.Sequelize.Op.lt]: new Date() } }
      ]
    }
  });
  
  for (const session of expiredSessions) {
    await session.destroy();
  }
  
  return expiredSessions.length;
};