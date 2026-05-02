
import jwt from 'jsonwebtoken';

// Cette clé doit être strictement identique à celle du AuthService
const SECRET = process.env.JWT_SECRET || 'GESTOCK_KERNEL_SECURE_2024_@PRIV';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Authentication Required',
      message: 'Token de sécurité manquant.' 
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' ? 'Session expirée' : 'Token invalide';
      console.error(`[AUTH REJECT] ${message} - Reason: ${err.message}`);
      return res.status(403).json({ error: 'Forbidden', message });
    }
    
    // Injecter l'utilisateur décodé dans la requête
    req.user = user;
    next();
  });
};
