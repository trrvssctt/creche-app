
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, Session } from '../models/index.js';

// Utilisation d'une clé unique partagée par tout le Kernel AlwaysData
const JWT_SECRET = process.env.JWT_SECRET || 'GESTOCK_KERNEL_SECURE_2024_@PRIV';

export class AuthService {
  /**
   * Valide les identifiants email/password via bcrypt
   */
  static async validateCredentials(email, password) {
    const user = await User.findOne({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return user;
  }

  /**
   * Génère un token JWT contenant le payload d'isolation (tenantId)
   * Inclut impérativement le tableau 'roles' pour le middleware RBAC.
   */
  static generateToken(user) {
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'EMPLOYEE'];

    return jwt.sign(
      {
        id: user.id,
        tenantId: user.tenantId,
        roles: userRoles,
        role: userRoles[0], // Compatibilité descendante
        name: user.name,
        employeeId: user.employeeId, // ✅ Ajouter le employeeId dans le JWT
        planId: user.planId || undefined   // Inclus pour que /me retourne le plan
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  /**
   * Décodage et vérification du token
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return null;
    }
  }

  /**
   * Crée une nouvelle session pour un utilisateur
   */
  static async createSession(userData, ipAddress = null, userAgent = null, deviceInfo = null) {
    const jwtToken = this.generateToken(userData);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Calculer la date d'expiration (24h par défaut)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await Session.create({
      tenantId: userData.tenantId,
      userId: userData.id,
      sessionToken,
      jwtToken,
      ipAddress,
      userAgent,
      deviceInfo,
      expiresAt
    });

    // Récupérer l'instance utilisateur et marquer comme ayant une session active
    const userInstance = await User.findByPk(userData.id);
    if (userInstance) {
      await userInstance.update({ activeSession: true, lastLogin: new Date() });
    }

    return {
      session,
      token: jwtToken,
      sessionToken
    };
  }

  /**
   * Valide une session et retourne l'utilisateur si la session est valide
   */
  static async validateSession(sessionToken) {
    const session = await Session.findByToken(sessionToken);
    if (!session || !session.isValid()) {
      return null;
    }

    // Mettre à jour la dernière activité
    await session.updateActivity();

    // Retourner l'utilisateur associé à la session
    const user = await User.findByPk(session.userId);
    return { user, session };
  }

  /**
   * Termine toutes les sessions actives d'un utilisateur
   */
  static async terminateAllUserSessions(userId) {
    const activeSessions = await Session.findActiveByUserId(userId);
    
    for (const session of activeSessions) {
      await session.terminate();
    }

    // Marquer l'utilisateur comme n'ayant plus de session active
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ activeSession: false });
    }

    return activeSessions.length;
  }

  /**
   * Termine une session spécifique
   */
  static async terminateSession(sessionToken) {
    const session = await Session.findByToken(sessionToken);
    if (!session) {
      return false;
    }

    await session.terminate();

    // Vérifier si l'utilisateur a encore des sessions actives
    const remainingSessions = await Session.findActiveByUserId(session.userId);
    if (remainingSessions.length === 0) {
      const user = await User.findByPk(session.userId);
      if (user) {
        await user.update({ activeSession: false });
      }
    }

    return true;
  }

  /**
   * Nettoie les sessions expirées (à exécuter périodiquement)
   */
  static async cleanupExpiredSessions() {
    const cleanedCount = await Session.cleanupExpiredSessions();
    
    // Mettre à jour les utilisateurs qui n'ont plus de sessions actives
    const usersWithExpiredSessions = await User.findAll({
      where: { activeSession: true }
    });

    for (const user of usersWithExpiredSessions) {
      const activeSessions = await Session.findActiveByUserId(user.id);
      if (activeSessions.length === 0) {
        await user.update({ activeSession: false });
      }
    }

    return cleanedCount;
  }

  /**
   * Retourne la liste des sessions actives d'un utilisateur
   */
  static async getUserActiveSessions(userId) {
    return await Session.findActiveByUserId(userId);
  }

  /**
   * Vérifie si un utilisateur a des sessions actives
   */
  static async hasActiveSessions(userId) {
    const sessions = await Session.findActiveByUserId(userId);
    return sessions.length > 0;
  }
}
