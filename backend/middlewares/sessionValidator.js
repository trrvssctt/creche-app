import { AuthService } from '../services/AuthService.js';

/**
 * Middleware pour vérifier les sessions actives
 * Ce middleware vérifie que la session utilisateur est toujours valide
 * et met à jour automatiquement la dernière activité
 */
export const validateSession = async (req, res, next) => {
  try {
    // Récupérer le token de session depuis les headers
    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({
        error: 'SessionRequired',
        message: 'Token de session manquant. Veuillez vous reconnecter.',
        shouldLogout: true
      });
    }

    // Valider la session
    const sessionData = await AuthService.validateSession(sessionToken);
    
    if (!sessionData) {
      return res.status(401).json({
        error: 'InvalidSession',
        message: 'Session invalide ou expirée. Veuillez vous reconnecter.',
        shouldLogout: true
      });
    }

    // Ajouter les données de session à la requête
    req.sessionData = sessionData;
    req.activeSession = sessionData.session;
    
    // Si req.user n'est pas déjà défini par le middleware JWT, l'ajouter
    if (!req.user) {
      req.user = sessionData.user;
    }

    next();
  } catch (error) {
    console.error('[SESSION VALIDATION ERROR]:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Erreur lors de la validation de session.',
      shouldLogout: true
    });
  }
};

/**
 * Middleware optionnel pour vérifier les sessions sans bloquer l'accès
 * Utile pour les endpoints qui peuvent fonctionner avec ou sans session valide
 */
export const validateSessionOptional = async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    
    if (sessionToken) {
      const sessionData = await AuthService.validateSession(sessionToken);
      
      if (sessionData) {
        req.sessionData = sessionData;
        req.activeSession = sessionData.session;
        
        if (!req.user) {
          req.user = sessionData.user;
        }
      }
    }

    next();
  } catch (error) {
    console.error('[OPTIONAL SESSION VALIDATION ERROR]:', error);
    // Continue sans bloquer l'accès en cas d'erreur
    next();
  }
};

/**
 * Middleware pour nettoyer les sessions expirées périodiquement
 * À utiliser sur des endpoints fréquemment appelés ou via une tâche cron
 */
export const cleanupExpiredSessions = async (req, res, next) => {
  try {
    // Nettoyer seulement 1 fois sur 100 requêtes pour éviter la surcharge
    if (Math.random() < 0.01) {
      AuthService.cleanupExpiredSessions()
        .then(() => {})

        .catch(err => {
          console.error('[SESSION CLEANUP ERROR]:', err);
        });
    }
    
    next();
  } catch (error) {
    console.error('[SESSION CLEANUP MIDDLEWARE ERROR]:', error);
    next();
  }
};