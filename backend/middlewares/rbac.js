
/**
 * Middleware de protection RBAC Multi-Rôles (Kernel v3.2)
 * Autorise l'accès si au moins UN des rôles de l'utilisateur est présent dans allowedRoles.
 */
export const checkPermission = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ 
        error: 'SecurityError', 
        message: 'Accès non authentifié.' 
      });
    }

    // Récupération sécurisée du tableau des rôles (cumulatif)
    // On priorise 'roles' du token, puis on fallback sur 'role' unique
    let userRoles = [];
    if (Array.isArray(user.roles)) {
      userRoles = user.roles;
    } else if (user.role) {
      userRoles = [user.role];
    }

    // Le SUPER_ADMIN a un accès universel absolu
    if (userRoles.includes('SUPER_ADMIN')) return next();

    // Vérification de l'intersection entre les rôles requis et les rôles cumulés
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'AccessDenied', 
        message: `Droits insuffisants (Périmètre requis: ${allowedRoles.join(' ou ')})`,
        status: 403
      });
    }

    next();
  };
};

// Alias pour compatibilité
export const checkRole = checkPermission;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  STOCK_MANAGER: 'STOCK_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  HR_MANAGER: 'HR_MANAGER',
  SALES: 'SALES',
  EMPLOYEE: 'EMPLOYEE'
};
