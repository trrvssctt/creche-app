import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { authBridge } from './authBridge';

interface LeaveInfo {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
}

interface EmployeePresenceStatus {
  isPresent: boolean;
  leave?: LeaveInfo;
  leaveType?: string;
  leaveEndDate?: string;
}

// Service pour obtenir le statut de présence d'un employé
export const getEmployeePresenceStatus = (leaves: any[], employeeId: string): EmployeePresenceStatus => {
  const today = new Date().toISOString().split('T')[0];
  
  const activeLeave = leaves.find(leave => {
    return leave.employeeId === employeeId && 
           leave.status === 'APPROVED' && 
           leave.startDate <= today && 
           leave.endDate >= today;
  });
  
  return {
    isPresent: !activeLeave,
    leave: activeLeave,
    leaveType: activeLeave?.type,
    leaveEndDate: activeLeave?.endDate
  };
};

// Hook pour vérifier le statut d'absence de l'employé connecté
export const useCurrentEmployeeAbsenceStatus = () => {
  const [absenceStatus, setAbsenceStatus] = useState<EmployeePresenceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAbsenceStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtenir les informations de l'utilisateur connecté
        const session = authBridge.getSession();
        if (!session?.user) {
          setAbsenceStatus(null);
          setLoading(false);
          return;
        }

        // Vérifier si l'utilisateur a un employeeId (lié à un employé)
        if (!session.user.employeeId) {
          setAbsenceStatus(null);
          setLoading(false);
          return;
        }

        // Récupérer tous les congés
        const leavesResponse = await apiClient.get('/hr/leaves');
        const leaves = leavesResponse?.rows || leavesResponse || [];

        // Vérifier le statut de présence de l'employé connecté
        const status = getEmployeePresenceStatus(leaves, session.user.employeeId);
        setAbsenceStatus(status);

      } catch (err: any) {
        console.error('Error checking employee absence status:', err);
        setError('Impossible de vérifier le statut d\'absence');
        setAbsenceStatus(null);
      } finally {
        setLoading(false);
      }
    };

    checkAbsenceStatus();

    // Recharger le statut toutes les heures pour s'assurer qu'il est à jour
    const interval = setInterval(checkAbsenceStatus, 60 * 60 * 1000); // 1 heure

    return () => clearInterval(interval);
  }, []);

  return { absenceStatus, loading, error, refresh: async () => {
    // Permettre un refresh manuel
    const checkAbsenceStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const session = authBridge.getSession();
        if (!session?.user?.employeeId) {
          setAbsenceStatus(null);
          return;
        }

        const leavesResponse = await apiClient.get('/hr/leaves');
        const leaves = leavesResponse?.rows || leavesResponse || [];

        const status = getEmployeePresenceStatus(leaves, session.user.employeeId);
        setAbsenceStatus(status);

      } catch (err: any) {
        console.error('Error checking employee absence status:', err);
        setError('Impossible de vérifier le statut d\'absence');
        setAbsenceStatus(null);
      } finally {
        setLoading(false);
      }
    };

    await checkAbsenceStatus();
  }};
};

// Types de congés avec leurs libellés en français
export const getLeaveTypeLabel = (type: string): string => {
  const leaveTypes: Record<string, string> = {
    'ANNUAL': 'Congés Annuels',
    'SICK': 'Congé Maladie',
    'MATERNITY': 'Congé Maternité',
    'PATERNITY': 'Congé Paternité',
    'FAMILY': 'Congé Familial',
    'STUDY': 'Congé Formation',
    'UNPAID': 'Congé sans Solde',
    'OTHER': 'Autre Congé'
  };
  
  return leaveTypes[type] || type;
};

// Calculer le nombre de jours restants d'absence
export const getDaysUntilReturn = (endDate: string): number => {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};