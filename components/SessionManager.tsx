import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';

interface SessionManagerProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

/**
 * Composant wrapper qui gère automatiquement les sessions et la déconnexion
 * Utilise ce composant pour wrapper votre application après login
 */
export const SessionManager: React.FC<SessionManagerProps> = ({ 
  user, 
  onLogout, 
  children 
}) => {
  const [isValidatingSession, setIsValidatingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'expired' | 'checking'>('active');

  // Fonction de déconnexion avec nettoyage
  const handleLogout = async () => {
    try {
      await authBridge.logout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      onLogout();
    }
  };

  // Validation manuelle de session
  const validateSession = async () => {
    setIsValidatingSession(true);
    setSessionStatus('checking');
    
    try {
      const isValid = await authBridge.validateCurrentSession();
      
      if (!isValid) {
        setSessionStatus('expired');
        setTimeout(handleLogout, 2000); // Délai de 2 secondes pour afficher le message
      } else {
        setSessionStatus('active');
      }
    } catch (error) {
      console.error('Erreur validation session:', error);
      setSessionStatus('expired');
      setTimeout(handleLogout, 2000);
    } finally {
      setIsValidatingSession(false);
    }
  };

  // Configuration du monitoring automatique des sessions
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('Session détectée comme expirée par le monitor');
      setSessionStatus('expired');
      setTimeout(handleLogout, 1500);
    };

    // Démarrer le monitoring (vérification toutes les 5 minutes)
    const monitorId = authBridge.startSessionMonitoring(handleSessionExpired, 300000);

    // Validation immédiate au montage
    validateSession();

    return () => {
      if (monitorId) {
        clearInterval(monitorId);
      }
    };
  }, []);

  // Interface de déconnexion si session expirée
  if (sessionStatus === 'expired') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            ⏰
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Session expirée</h3>
          <p className="text-slate-600 mb-4">
            Votre session a expiré pour des raisons de sécurité. 
            Vous allez être redirigé vers la page de connexion.
          </p>
          <button 
            onClick={handleLogout}
            className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Se reconnecter
          </button>
        </div>
      </div>
    );
  }

  // Interface de vérification
  if (sessionStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // Application normale avec session active
  return (
    <div className="relative">
      {/* Header avec infos de session (optionnel) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-emerald-50 border border-emerald-200 p-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Session active - {user.name}</span>
            <div className="flex gap-2">
              <button 
                onClick={validateSession}
                disabled={isValidatingSession}
                className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              >
                {isValidatingSession ? '⏳' : '🔍'} Vérifier session
              </button>
              <button 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                🚪 Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenu de l'application */}
      {children}
    </div>
  );
};

export default SessionManager;