import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  ChevronRight,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  FileCheck,
  FileWarning,
  FileClock,
  Loader2,
  Eye,
  Edit2,
  Edit3,
  Pause,
  X,
  Play,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { Contract, Employee } from '../../types';
import { apiClient, fetchWithToken } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import { useToast } from '../ToastProvider';

interface ContractListProps {
  onNavigate: (tab: string, meta?: any) => void;
}

const ContractList: React.FC<ContractListProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [creating, setCreating] = useState(false);

  const [contractForm, setContractForm] = useState({
    employeeId: '',
    type: 'CDI',
    startDate: '',
    endDate: '',
    salary: '',
    trialPeriodEnd: '',
    currency: 'F CFA',
    workLocation: '',
    maxRenewals: ''
  });

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [terminationForm, setTerminationForm] = useState({ reason: '' });
  const [suspensionForm, setSuspensionForm] = useState({ reason: '' });
  const [processing, setProcessing] = useState(false);

  const showToast = useToast();

  const [isBulkPayslipModalOpen, setIsBulkPayslipModalOpen] = useState(false);
  const [bulkPayslipForm, setBulkPayslipForm] = useState({
    month: new Date().toISOString().substring(0, 7)
  });
  const [generatingPayslips, setGeneratingPayslips] = useState(false);

  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewalForm, setRenewalForm] = useState({
    newEndDate: '',
    newSalary: '',
    newType: '',
    renewalReason: '',
    effectiveDate: ''
  });
  const [isRenewing, setIsRenewing] = useState(false);
  const [contractHistory, setContractHistory] = useState([]);

  const [renewalErrors, setRenewalErrors] = useState({
    effectiveDate: '',
    newEndDate: '',
    newType: '',
    renewalReason: '',
    newSalary: ''
  });
  const [renewalWarnings, setRenewalWarnings] = useState({
    effectiveDate: '',
    newEndDate: '',
    duration: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    type: '',
    startDate: '',
    endDate: '',
    salary: '',
    trialPeriodEnd: '',
    currency: 'F CFA',
    workLocation: '',
    modificationReason: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  const contractTypes = ['All', 'CDI', 'CDD', 'STAGE', 'FREELANCE'];

  const safeJSONParse = (jsonString: string | null) => {
    if (!jsonString) return null;
    try {
      if (typeof jsonString === 'object') return jsonString;
      if (typeof jsonString !== 'string') {
        console.warn('Meta field is not a string:', typeof jsonString, jsonString);
        return null;
      }
      const cleanedString = jsonString.trim();
      if (!cleanedString.match(/^[\[\{].*[\]\}]$/)) {
        console.warn('Meta field does not appear to be valid JSON:', cleanedString.substring(0, 100));
        return null;
      }
      return JSON.parse(cleanedString);
    } catch (error) {
      console.error('Error parsing meta JSON:', error, 'Content:', typeof jsonString === 'string' ? jsonString.substring(0, 100) : jsonString);
      return null;
    }
  };

  const getContractTypeRules = (type: string) => {
    switch (type) {
      case 'CDI':
        return {
          needsEndDate: false,
          maxTrialPeriod: 4,
          helpText: 'CDI : Contrat permanent. Date de fin optionnelle (si omise, contrat permanent).'
        };
      case 'CDD':
        return {
          needsEndDate: true,
          maxTrialPeriod: 1,
          helpText: 'CDD : Contrat temporaire. Date de fin obligatoire (maximum 5 ans).'
        };
      case 'STAGE':
        return {
          needsEndDate: true,
          maxTrialPeriod: 0,
          maxDuration: 6,
          helpText: 'STAGE : Stage limité à 6 mois maximum. Pas de période d\'essai.'
        };
      default:
        return { needsEndDate: true, maxTrialPeriod: 4, helpText: 'Sélectionnez un type de contrat pour voir les règles.' };
    }
  };

  const getAvailableEmployees = () => {
    if (!Array.isArray(employees) || !Array.isArray(contracts)) {
      return [];
    }

    const available = employees.filter(employee => {
      const hasActiveContract = contracts.some(contract => {
        const employeeIdMatch = String(contract.employeeId) === String(employee.id);
        const isActive = contract.status === 'ACTIVE';
        return employeeIdMatch && isActive;
      });
      return !hasActiveContract;
    });

    return available;
  };

  const resetContractForm = () => {
    setContractForm({
      employeeId: '',
      type: 'CDI',
      startDate: '',
      endDate: '',
      salary: '',
      trialPeriodEnd: '',
      currency: 'F CFA',
      workLocation: '',
      maxRenewals: ''
    });
  };

  const resetRenewalForm = () => {
    setRenewalForm({
      newEndDate: '',
      newSalary: '',
      newType: '',
      renewalReason: '',
      effectiveDate: ''
    });
    setRenewalErrors({
      effectiveDate: '',
      newEndDate: '',
      newType: '',
      renewalReason: '',
      newSalary: ''
    });
    setRenewalWarnings({
      effectiveDate: '',
      newEndDate: '',
      duration: ''
    });
  };

  const resetEditForm = () => {
    setEditForm({
      type: '',
      startDate: '',
      endDate: '',
      salary: '',
      trialPeriodEnd: '',
      currency: 'F CFA',
      workLocation: '',
      modificationReason: ''
    });
  };

  const handleContractTypeChange = (newType: string) => {
    const updatedForm = { ...contractForm, type: newType };
    if (newType === 'CDI') {
      updatedForm.endDate = '';
      updatedForm.maxRenewals = '';
    }
    if (newType === 'CDD') {
      updatedForm.maxRenewals = '2';
    }
    if (newType === 'STAGE') {
      updatedForm.trialPeriodEnd = '';
      updatedForm.maxRenewals = '0';
    }
    if (newType === 'FREELANCE') {
      updatedForm.maxRenewals = '';
    }
    setContractForm(updatedForm);
  };

  useEffect(() => {
    loadData();
    loadPayrollSettings();
  }, []);

  const loadPayrollSettings = async () => {
    try {
      setLoadingSettings(true);
      const data = await apiClient.get('/hr/payroll-settings');
      setPayrollSettings(data);
    } catch (error) {
      console.error('Error loading payroll settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const paydayInfo = useMemo(() => {
    const payDay = payrollSettings?.paymentDay || 28;
    const today = new Date();
    const todayDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let nextPayDate = new Date(currentYear, currentMonth, payDay);
    if (todayDay > payDay) {
      nextPayDate = new Date(currentYear, currentMonth + 1, payDay);
    }

    const diffTime = nextPayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isPayday = todayDay === payDay;

    return { payDay, isPayday, diffDays };
  }, [payrollSettings?.paymentDay]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [contractsData, employeesData] = await Promise.all([
        apiClient.get('/hr/contracts'),
        apiClient.get('/hr/employees')
      ]);

      const contractsList = Array.isArray(contractsData) ? contractsData :
        contractsData?.rows ? contractsData.rows : [];
      const employeesList = Array.isArray(employeesData) ? employeesData :
        employeesData?.rows ? employeesData.rows : [];

      setContracts(contractsList);
      setEmployees(employeesList);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
      console.error('Error loading data:', err);
      setContracts([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (contract: Contract) => {
    if (contract.employee) {
      return `${contract.employee.firstName} ${contract.employee.lastName}`;
    }
    if (!Array.isArray(employees) || employees.length === 0) {
      return 'Inconnu';
    }
    const emp = employees.find(e => e.id === contract.employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Inconnu';
  };

  const getEmployeePhoto = (contract: Contract) => {
    if (contract.employee && contract.employee.photoUrl) {
      return contract.employee.photoUrl;
    }
    if (!Array.isArray(employees) || employees.length === 0) {
      return `https://picsum.photos/seed/${contract.employeeId}/100/100`;
    }
    const emp = employees.find(e => e.id === contract.employeeId);
    return emp?.photoUrl || `https://picsum.photos/seed/${contract.employeeId}/100/100`;
  };

  const filteredContracts = Array.isArray(contracts) ? contracts.filter(contract => {
    const empName = getEmployeeName(contract).toLowerCase();
    const matchesSearch = empName.includes(searchTerm.toLowerCase()) ||
      (contract.type && contract.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'All' || contract.type === filterType;
    return matchesSearch && matchesType;
  }) : [];

  const stats = {
    active: Array.isArray(contracts) ? contracts.filter(c => c.status === 'ACTIVE').length : 0,
    critical: Array.isArray(contracts) ? contracts.filter(c => {
      if (!c.endDate || c.status !== 'ACTIVE') return false;
      const diffDays = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).length : 0,
    expiring: Array.isArray(contracts) ? contracts.filter(c => {
      if (!c.endDate || c.status !== 'ACTIVE') return false;
      const endDate = new Date(c.endDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays >= 0;
    }).length : 0,
    renewals: Array.isArray(contracts) ? contracts.filter(c => {
      if (!c.endDate || c.status !== 'ACTIVE') return false;
      const endDate = new Date(c.endDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 90 && diffDays > 30;
    }).length : 0
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contractForm.employeeId || !contractForm.type || !contractForm.startDate) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const startDate = new Date(contractForm.startDate);
    const today = new Date();
    const maxPastDate = new Date();
    maxPastDate.setFullYear(today.getFullYear() - 10);
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(today.getFullYear() + 2);

    if (startDate < maxPastDate) {
      setError('La date de début ne peut pas être antérieure à 10 ans');
      return;
    }
    if (startDate > maxFutureDate) {
      setError('La date de début ne peut pas être supérieure à 2 ans dans le futur');
      return;
    }

    if ((contractForm.type === 'CDD' || contractForm.type === 'STAGE') && !contractForm.endDate) {
      setError(`Une date de fin est obligatoire pour un contrat de type ${contractForm.type}`);
      return;
    }

    if (contractForm.type === 'CDI' && contractForm.endDate) {
      setError('Un contrat CDI ne peut pas avoir de date de fin');
      return;
    }

    if (contractForm.endDate) {
      const endDate = new Date(contractForm.endDate);

      if (endDate <= startDate) {
        setError('La date de fin doit être postérieure à la date de début');
        return;
      }

      const maxEndDate = new Date(startDate);
      maxEndDate.setFullYear(startDate.getFullYear() + 5);
      if (endDate > maxEndDate) {
        setError('La durée du contrat ne peut pas excéder 5 ans');
        return;
      }

      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (contractForm.type === 'CDD' && diffDays < 1) {
        setError('Un CDD doit avoir une durée minimale d\'1 jour');
        return;
      }

      if (contractForm.type === 'STAGE') {
        const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (diffMonths > 6) {
          setError('Un stage ne peut pas dépasser 6 mois');
          return;
        }
      }
    }

    if (contractForm.trialPeriodEnd) {
      const trialEnd = new Date(contractForm.trialPeriodEnd);

      if (trialEnd <= startDate) {
        setError('La fin de période d\'essai doit être postérieure à la date de début');
        return;
      }

      if (contractForm.endDate && trialEnd >= new Date(contractForm.endDate)) {
        setError('La période d\'essai doit se terminer avant la fin du contrat');
        return;
      }

      const maxTrialMonths = contractForm.type === 'CDI' ? 4 :
        contractForm.type === 'CDD' ? 1 :
          contractForm.type === 'STAGE' ? 0 : 2;

      if (maxTrialMonths === 0) {
        setError('Les stages ne peuvent pas avoir de période d\'essai');
        return;
      }

      const trialMonths = (trialEnd.getFullYear() - startDate.getFullYear()) * 12 + (trialEnd.getMonth() - startDate.getMonth());
      if (trialMonths > maxTrialMonths) {
        setError(`La période d'essai ne peut pas excéder ${maxTrialMonths} mois pour un ${contractForm.type}`);
        return;
      }
    }

    if (contractForm.salary && parseFloat(contractForm.salary) < 0) {
      setError('Le salaire ne peut pas être négatif');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload = {
        employeeId: contractForm.employeeId,
        type: contractForm.type,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate || null,
        salary: contractForm.salary ? parseFloat(contractForm.salary) : null,
        trialPeriodEnd: contractForm.trialPeriodEnd || null,
        currency: contractForm.currency,
        workLocation: contractForm.workLocation || null,
        maxRenewals: (contractForm.type === 'CDD' || contractForm.type === 'STAGE') && contractForm.maxRenewals !== ''
          ? parseInt(contractForm.maxRenewals) : null,
        status: 'ACTIVE'
      };

      await apiClient.post('/hr/contracts', payload);

      setIsModalOpen(false);
      resetContractForm();
      setSuccessMessage('Contrat créé avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      await loadData();
    } catch (err: any) {
      console.error('Error creating contract:', err);
      setError(err.response?.data?.error || 'Erreur lors de la création du contrat');
    } finally {
      setCreating(false);
    }
  };

  const handleViewContract = (contract: Contract) => {
    setSelectedContract(contract);
    if (contract.employee?.id || contract.employeeId) {
      loadContractHistory(contract.employee?.id || contract.employeeId);
    }
    setIsDetailsModalOpen(true);
  };

  const handleTerminateClick = (contract: Contract) => {
    setSelectedContract(contract);
    setTerminationForm({ reason: '' });
    setIsTerminateModalOpen(true);
  };

  const handleSuspendClick = (contract: Contract) => {
    setSelectedContract(contract);
    setSuspensionForm({ reason: '' });
    setIsSuspendModalOpen(true);
  };

  const handleTerminateContract = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation renforcée du motif de résiliation
    if (!selectedContract || !terminationForm.reason.trim()) {
      showToast('Veuillez saisir un motif de résiliation', 'error');
      return;
    }

    if (terminationForm.reason.trim().length < 15) {
      showToast('Le motif de résiliation doit contenir au moins 15 caractères', 'error');
      return;
    }

    try {
      setProcessing(true);
      const response = await apiClient.post(`/hr/contracts/${selectedContract.id}/terminate`, {
        reason: terminationForm.reason.trim()
      });

      setIsTerminateModalOpen(false);
      setTerminationForm({ reason: '' });
      setSuccessMessage(response.data.message || 'Contrat résilié avec succès. L\'employé peut maintenant être désactivé si nécessaire.');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 5000);
      await loadData();

      if (isDetailsModalOpen && selectedContract) {
        const employeeId = selectedContract.employee?.id || selectedContract.employeeId;
        if (employeeId) {
          await loadContractHistory(employeeId);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la résiliation du contrat');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !suspensionForm.reason.trim()) return;

    try {
      setProcessing(true);
      await apiClient.post(`/hr/contracts/${selectedContract.id}/suspend`, {
        reason: suspensionForm.reason.trim()
      });

      setIsSuspendModalOpen(false);
      setSuccessMessage('Contrat suspendu avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      await loadData();

      if (isDetailsModalOpen && selectedContract) {
        const employeeId = selectedContract.employee?.id || selectedContract.employeeId;
        if (employeeId) {
          await loadContractHistory(employeeId);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la suspension du contrat');
    } finally {
      setProcessing(false);
    }
  };

  const handleEditClick = (contract: Contract) => {
    setSelectedContract(contract);
    setEditForm({
      type: contract.type || '',
      startDate: contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : '',
      endDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : '',
      salary: contract.salary ? String(contract.salary) : '',
      trialPeriodEnd: contract.trialPeriodEnd ? new Date(contract.trialPeriodEnd).toISOString().split('T')[0] : '',
      currency: contract.currency || 'F CFA',
      workLocation: contract.workLocation || '',
      modificationReason: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !editForm.modificationReason.trim()) {
      setError('Veuillez fournir une raison pour la modification');
      return;
    }

    if (!editForm.type || !editForm.startDate) {
      setError('Le type de contrat et la date de début sont obligatoires');
      return;
    }

    const startDate = new Date(editForm.startDate);

    if (editForm.endDate) {
      const endDate = new Date(editForm.endDate);
      if (endDate <= startDate) {
        setError('La date de fin doit être postérieure à la date de début');
        return;
      }
    }

    if ((editForm.type === 'CDD' || editForm.type === 'STAGE') && !editForm.endDate) {
      setError(`Une date de fin est obligatoire pour un contrat de type ${editForm.type}`);
      return;
    }

    if (editForm.type === 'CDI' && editForm.endDate) {
      setError('Un contrat CDI ne peut pas avoir de date de fin');
      return;
    }

    try {
      setIsEditing(true);
      setError(null);

      const updateData = {
        type: editForm.type,
        startDate: editForm.startDate,
        endDate: editForm.endDate || null,
        salary: parseFloat(editForm.salary) || null,
        trialPeriodEnd: editForm.trialPeriodEnd || null,
        currency: editForm.currency,
        workLocation: editForm.workLocation,
        modificationReason: editForm.modificationReason.trim(),
        modifiedAt: new Date().toISOString(),
        modifiedBy: 'current_user'
      };

      await apiClient.put(`/hr/contracts/${selectedContract.id}`, updateData);

      await loadData();

      if (isDetailsModalOpen && selectedContract) {
        const employeeId = selectedContract.employee?.id || selectedContract.employeeId;
        if (employeeId) {
          await loadContractHistory(employeeId);
        }
      }

      setShowSuccessAlert(true);
      setSuccessMessage('Contrat modifié avec succès');
      setIsEditModalOpen(false);
      resetEditForm();

      setTimeout(() => setShowSuccessAlert(false), 3000);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la modification du contrat');
    } finally {
      setIsEditing(false);
    }
  };

  const validateRenewalField = (fieldName: string, value: string, allValues = renewalForm) => {
    const errors = { ...renewalErrors };
    const warnings = { ...renewalWarnings };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (fieldName) {
      case 'effectiveDate':
        const effectiveDate = new Date(value);
        effectiveDate.setHours(0, 0, 0, 0);

        if (!value) {
          errors.effectiveDate = 'La date d\'effet est obligatoire';
        } else if (effectiveDate < today) {
          errors.effectiveDate = 'La date d\'effet ne peut pas être antérieure à aujourd\'hui';
        } else if (effectiveDate > new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          errors.effectiveDate = 'La date d\'effet ne peut pas être supérieure à 1 an dans le futur';
        } else {
          errors.effectiveDate = '';
          const diffDays = Math.ceil((effectiveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) {
            warnings.effectiveDate = `⚠️ Renouvellement prévu dans ${diffDays} jour(s). Assurez-vous que les délais sont respectés.`;
          } else {
            warnings.effectiveDate = '';
          }
        }
        break;

      case 'newEndDate':
        if (allValues.newType !== 'CDI' && !value) {
          errors.newEndDate = `Une date de fin est obligatoire pour un contrat de type ${allValues.newType}`;
        } else if (allValues.newType === 'CDI' && value) {
          errors.newEndDate = 'Un contrat CDI ne peut pas avoir de date de fin';
        } else if (value && allValues.effectiveDate) {
          const endDate = new Date(value);
          const effectiveDate = new Date(allValues.effectiveDate);
          endDate.setHours(0, 0, 0, 0);
          effectiveDate.setHours(0, 0, 0, 0);

          const diffDays = Math.ceil((endDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));

          if (endDate <= effectiveDate) {
            errors.newEndDate = 'La date de fin doit être au moins 1 jour après la date d\'effet';
          } else if (allValues.newType === 'CDD' && diffDays < 7) {
            errors.newEndDate = 'Un CDD doit avoir une durée minimale de 7 jours';
          } else if (allValues.newType === 'STAGE' && diffDays < 14) {
            errors.newEndDate = 'Un stage doit avoir une durée minimale de 14 jours';
          } else if (allValues.newType === 'STAGE' && diffDays > 183) {
            errors.newEndDate = 'Un stage ne peut pas dépasser 6 mois (183 jours)';
          } else if (diffDays > 1825) {
            errors.newEndDate = 'La durée du contrat ne peut pas excéder 5 ans';
          } else {
            const dayOfWeek = endDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              errors.newEndDate = 'La date de fin ne peut pas être un weekend';
            } else {
              errors.newEndDate = '';

              const months = Math.floor(diffDays / 30);
              const days = diffDays % 30;
              warnings.duration = `📅 Durée: ${diffDays} jour(s) ${months > 0 ? `(≈ ${months} mois ${days > 0 ? `et ${days} jours` : ''})` : ''}`;

              if (diffDays > 365) {
                warnings.newEndDate = `⚠️ Contrat de longue durée (${Math.floor(diffDays / 365)} an(s)). Vérifiez la conformité légale.`;
              } else {
                warnings.newEndDate = '';
              }
            }
          }
        } else {
          errors.newEndDate = '';
          warnings.newEndDate = '';
        }
        break;

      case 'newType':
        if (!value) {
          errors.newType = 'Le type de contrat est obligatoire';
        } else {
          errors.newType = '';
        }
        break;

      case 'renewalReason':
        if (!value.trim()) {
          errors.renewalReason = 'La raison du renouvellement est obligatoire';
        } else if (value.trim().length < 10) {
          errors.renewalReason = 'La raison doit contenir au moins 10 caractères';
        } else if (value.trim().length > 500) {
          errors.renewalReason = 'La raison ne peut pas dépasser 500 caractères';
        } else {
          errors.renewalReason = '';
        }
        break;

      case 'newSalary':
        if (value && (isNaN(Number(value)) || Number(value) <= 0)) {
          errors.newSalary = 'Le salaire doit être un nombre positif';
        } else if (value && Number(value) < 50000) {
          errors.newSalary = 'Le salaire semble très bas. Vérifiez le montant.';
        } else {
          errors.newSalary = '';
        }
        break;
    }

    setRenewalErrors(errors);
    setRenewalWarnings(warnings);
    return errors[fieldName as keyof typeof errors] === '';
  };

  const handleRenewalFormChange = (field: string, value: string) => {
    const newForm = { ...renewalForm, [field]: value };
    setRenewalForm(newForm);

    validateRenewalField(field, value, newForm);

    if (field === 'effectiveDate' && newForm.newEndDate) {
      validateRenewalField('newEndDate', newForm.newEndDate, newForm);
    }
    if (field === 'newType') {
      validateRenewalField('newEndDate', newForm.newEndDate, newForm);
    }
  };

  // ✅ FIXED: handleRenewClick was missing - added here
  const handleRenewClick = (contract: Contract) => {
    setSelectedContract(contract);
    const initialForm = {
      newEndDate: '',
      newSalary: contract.salary ? String(contract.salary) : '',
      newType: contract.type || 'CDI',
      renewalReason: '',
      effectiveDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    };
    setRenewalForm(initialForm);

    setRenewalErrors({
      effectiveDate: '',
      newEndDate: '',
      newType: '',
      renewalReason: '',
      newSalary: ''
    });
    setRenewalWarnings({
      effectiveDate: '',
      newEndDate: '',
      duration: ''
    });

    setTimeout(() => {
      Object.keys(initialForm).forEach(key => {
        validateRenewalField(key, initialForm[key as keyof typeof initialForm], initialForm);
      });
    }, 100);

    setIsRenewModalOpen(true);
  };

  const handleRenewContract = async (e: React.FormEvent, retryCount = 0) => {
    e.preventDefault();

    const fieldsToValidate = ['effectiveDate', 'newEndDate', 'newType', 'renewalReason', 'newSalary'];
    let hasErrors = false;

    fieldsToValidate.forEach(field => {
      if (!validateRenewalField(field, renewalForm[field as keyof typeof renewalForm], renewalForm)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setError('Veuillez corriger les erreurs dans le formulaire avant de continuer');
      return;
    }

    if (!selectedContract || !renewalForm.renewalReason.trim() || !renewalForm.effectiveDate) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (renewalForm.newType === 'CDI' && renewalForm.newEndDate) {
      setError('Un contrat CDI ne peut pas avoir de date de fin');
      return;
    }

    if (
      selectedContract.maxRenewals !== undefined &&
      selectedContract.maxRenewals !== null &&
      (selectedContract.renewalCount ?? 0) >= selectedContract.maxRenewals
    ) {
      setError(
        `Renouvellement impossible : ce contrat a atteint son nombre maximum de renouvellements (${selectedContract.renewalCount ?? 0}/${selectedContract.maxRenewals})`
      );
      return;
    }

    if ((renewalForm.newType === 'CDD' || renewalForm.newType === 'STAGE') && !renewalForm.newEndDate) {
      setError(`Une date de fin est obligatoire pour un contrat de type ${renewalForm.newType}`);
      return;
    }

    const effectiveDate = new Date(renewalForm.effectiveDate);
    const today = new Date();

    if (effectiveDate < today) {
      setError('La date d\'effet ne peut pas être antérieure à aujourd\'hui');
      return;
    }

    if (renewalForm.newEndDate) {
      const newEndDate = new Date(renewalForm.newEndDate);

      if (newEndDate <= effectiveDate) {
        setError('La nouvelle date de fin doit être postérieure à la date d\'effet');
        return;
      }

      if (renewalForm.newType === 'STAGE') {
        const diffMonths = (newEndDate.getFullYear() - effectiveDate.getFullYear()) * 12 + (newEndDate.getMonth() - effectiveDate.getMonth());
        if (diffMonths > 6) {
          setError('Un stage ne peut pas dépasser 6 mois');
          return;
        }
      }

      const maxEndDate = new Date(effectiveDate);
      maxEndDate.setFullYear(effectiveDate.getFullYear() + 5);
      if (newEndDate > maxEndDate) {
        setError('La durée du contrat ne peut pas excéder 5 ans');
        return;
      }
    }

    try {
      setIsRenewing(true);
      setError(null);

      const payload = {
        newEndDate: renewalForm.newEndDate || null,
        newSalary: renewalForm.newSalary ? parseFloat(renewalForm.newSalary) : null,
        newType: renewalForm.newType,
        renewalReason: renewalForm.renewalReason.trim(),
        effectiveDate: renewalForm.effectiveDate
      };

      await apiClient.post(`/hr/contracts/${selectedContract.id}/renew`, payload);

      setIsRenewModalOpen(false);
      resetRenewalForm();
      setSuccessMessage('Contrat renouvelé avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      await loadData();

      if (isDetailsModalOpen && selectedContract) {
        const employeeId = selectedContract.employee?.id || selectedContract.employeeId;
        if (employeeId) {
          await loadContractHistory(employeeId);
        }
      }
    } catch (error: any) {
      console.error('ContractList - Renewal error:', error);

      if (error.response?.status === 503 ||
        error.code === 'NETWORK_ERROR' ||
        error.message.includes('timeout') ||
        error.message.includes('connexion') ||
        error.message.includes('ETIMEDOUT')) {

        if (retryCount < 2) {
          setError(`Problème de connexion, nouvelle tentative en cours... (${retryCount + 1}/3)`);
          setTimeout(() => {
            handleRenewContract(e, retryCount + 1);
          }, (retryCount + 1) * 2000);
          return;
        } else {
          setError('Problème de connexion persistant. Vérifiez votre connexion internet et réessayez plus tard.');
        }
      } else if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.field) {
          const fieldErrors = { ...renewalErrors };
          fieldErrors[errorData.field as keyof typeof fieldErrors] = errorData.error;
          setRenewalErrors(fieldErrors);
          setError(`Erreur de validation: ${errorData.error}`);
        } else {
          setError(errorData.error || 'Données invalides pour le renouvellement');
        }
      } else if (error.response?.status === 404) {
        setError('Contrat non trouvé. Il a peut-être été supprimé.');
        await loadData();
      } else {
        setError(error.response?.data?.error || error.message || 'Erreur lors du renouvellement du contrat');
      }
    } finally {
      setIsRenewing(false);
    }
  };

  const hasRenewalFormErrors = () => {
    return Object.values(renewalErrors).some(error => error !== '') ||
      !renewalForm.renewalReason.trim() ||
      !renewalForm.effectiveDate ||
      !renewalForm.newType ||
      ((renewalForm.newType === 'CDD' || renewalForm.newType === 'STAGE') && !renewalForm.newEndDate);
  };

  const loadContractHistory = async (employeeId: string) => {
    try {
      const response = await apiClient.get(`/hr/contracts/employee/${employeeId}/history`);
      setContractHistory(response.timeline || []);
    } catch (error: any) {
      console.error('Error loading contract history:', error);
      setContractHistory([]);
    }
  };

  const isContractExpiring = (contract: Contract) => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return false;
    const endDate = new Date(contract.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 60;
  };

  const getExpirationUrgency = (contract: Contract) => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return null;
    const diffDays = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) return { level: 'critical' as const, days: diffDays };
    if (diffDays >= 0 && diffDays <= 30) return { level: 'warning' as const, days: diffDays };
    if (diffDays >= 0 && diffDays <= 60) return { level: 'info' as const, days: diffDays };
    return null;
  };

  const canRenewContract = (contract: Contract) => {
    return contract.status === 'ACTIVE' && contract.endDate;
  };

  const handleReactivateContract = async (contract: Contract) => {
    if (contract.status !== 'SUSPENDED') return;

    const hasActiveContract = Array.isArray(contracts) && contracts.some(c =>
      c.employeeId === contract.employeeId &&
      c.id !== contract.id &&
      c.status === 'ACTIVE'
    );

    if (hasActiveContract) {
      setError('Impossible de réactiver : cet employé a déjà un contrat actif. Un employé ne peut pas avoir plus d\'un contrat actif simultanément.');
      return;
    }

    try {
      setProcessing(true);
      await apiClient.post(`/hr/contracts/${contract.id}/reactivate`, {});

      setSuccessMessage('Contrat réactivé avec succès');
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      await loadData();
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la réactivation du contrat');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateBulkPayslips = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPayslipForm.month) {
      setError('Veuillez sélectionner un mois');
      return;
    }
    try {
      setGeneratingPayslips(true);
      setError(null);

      const res = await fetchWithToken(`/hr/payslips/download-all-zip?month=${bulkPayslipForm.month}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `Erreur ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiches_paie_${bulkPayslipForm.month}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsBulkPayslipModalOpen(false);
      setSuccessMessage(`Fiches de paie (${bulkPayslipForm.month}) téléchargées en ZIP`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléchargement des fiches de paie');
    } finally {
      setGeneratingPayslips(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Success Alert */}
      <AnimatePresence>
        {showSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black uppercase text-[10px] tracking-widest"
          >
            <CheckCircle2 size={20} /> {successMessage || 'Opération réussie'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('rh')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestion des Contrats</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Suivi juridique et renouvellements</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (paydayInfo.isPayday) {
                setIsBulkPayslipModalOpen(true);
              }
            }}
            disabled={!paydayInfo.isPayday}
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl ${paydayInfo.isPayday
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 shadow-none border border-slate-200"
              }`}
            title={paydayInfo.isPayday ? "Générer les fiches de paie pour tous" : `Disponible le ${paydayInfo.payDay} du mois (J-${paydayInfo.diffDays})`}
          >
            <FileText size={16} /> {paydayInfo.isPayday ? "Fiches de Paie" : `Paie le ${paydayInfo.payDay}`}
          </button>
          <button className="px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} /> Rapport d'échéance
          </button>
          {getAvailableEmployees().length > 0 ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
            >
              <Plus size={16} /> Nouveau Contrat
            </button>
          ) : !loading && (
            <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
              <AlertCircle size={16} /> Aucun employé sans contrat actif
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className={`border px-6 py-4 rounded-2xl flex items-center gap-3 ${error.includes('nouvelle tentative')
            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
            : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          {error.includes('nouvelle tentative') ? (
            <div className="animate-spin h-5 w-5 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="font-medium whitespace-pre-line flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className={`ml-auto ${error.includes('nouvelle tentative')
                ? 'text-yellow-600 hover:text-yellow-800'
                : 'text-red-600 hover:text-red-800'
              }`}
          >
            ×
          </button>
        </div>
      )}

      {/* Critical 7-day expiration banner */}
      {!loading && stats.critical > 0 && (
        <div className="bg-red-600 text-white px-6 py-4 rounded-2xl flex items-start gap-4 shadow-lg shadow-red-200">
          <AlertTriangle size={20} className="animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-black text-[10px] uppercase tracking-widest mb-2">
              Alerte urgente — {stats.critical} contrat(s) expirent dans 7 jours ou moins
            </p>
            <div className="flex flex-wrap gap-2">
              {contracts
                .filter((c: Contract) => getExpirationUrgency(c)?.level === 'critical')
                .map((c: Contract) => {
                  const urgency = getExpirationUrgency(c)!;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleRenewClick(c)}
                      className="text-xs bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                      {getEmployeeName(c)} — {urgency.days === 0 ? "Expire aujourd'hui" : `${urgency.days}j restant${urgency.days > 1 ? 's' : ''}`}
                      <RefreshCw size={11} />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <FileCheck size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contrats Actifs</p>
            <p className="text-2xl font-black text-slate-900">{loading ? '-' : stats.active}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <FileWarning size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En fin de période</p>
            <p className="text-2xl font-black text-slate-900">{loading ? '-' : stats.expiring}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <FileClock size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Renouvellements</p>
            <p className="text-2xl font-black text-slate-900">{loading ? '-' : stats.renewals}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par employé ou type..."
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 px-6 py-4 rounded-2xl">
            <Filter size={18} className="text-slate-400" />
            <select
              className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest text-slate-600"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              disabled={loading}
            >
              {contractTypes.map(type => (
                <option key={type} value={type}>{type === 'All' ? 'Tous les Types' : type}</option>
              ))}
            </select>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Chargement...</span>
            </div>
          )}
        </div>
      </div>

      {/* Contract Table */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire Base</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-slate-400">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="font-medium">Chargement des contrats...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <FileText size={32} className="mx-auto opacity-50" />
                      <p className="font-medium">Aucun contrat trouvé</p>
                      <p className="text-xs">Essayez de modifier vos filtres ou créez un nouveau contrat</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => {
                  const statusInfo = {
                    ACTIVE: { color: 'text-emerald-500', icon: CheckCircle2, label: 'Actif' },
                    EXPIRED: { color: 'text-red-500', icon: AlertCircle, label: 'Expiré' },
                    TERMINATED: { color: 'text-slate-500', icon: Clock, label: 'Résilié' },
                    SUSPENDED: { color: 'text-amber-500', icon: Clock, label: 'Suspendu' }
                  };

                  const isExpiring = isContractExpiring(contract);
                  const isExpiringSoon = contract.endDate && contract.status === 'ACTIVE' && (() => {
                    const endDate = new Date(contract.endDate);
                    const today = new Date();
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays > 0 && diffDays <= 30;
                  })();

                  const status = statusInfo[contract.status as keyof typeof statusInfo] || statusInfo.ACTIVE;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={contract.id} className={`transition-colors group ${isExpiringSoon
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 hover:from-amber-100 hover:to-orange-100'
                        : isExpiring
                          ? 'bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 hover:from-orange-100 hover:to-red-100'
                          : 'hover:bg-slate-50/50'
                      }`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden shadow-sm relative">
                            <img
                              src={getEmployeePhoto(contract)}
                              alt={getEmployeeName(contract)}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://picsum.photos/seed/${contract.employeeId}/100/100`;
                              }}
                            />
                            {isExpiringSoon && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse border border-white"></div>
                            )}
                            {isExpiring && !isExpiringSoon && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse border border-white"></div>
                            )}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-900">{getEmployeeName(contract)}</span>
                            {(isExpiringSoon || isExpiring) && (
                              <div className="flex items-center gap-1 mt-1">
                                <Clock size={10} className={isExpiringSoon ? 'text-amber-600' : 'text-orange-600'} />
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isExpiringSoon ? 'text-amber-600' : 'text-orange-600'
                                  }`}>
                                  {isExpiringSoon ? 'Expire bientôt' : 'À renouveler'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {contract.type}
                          </span>
                          {isExpiringSoon && (
                            <span className="px-2 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                              <AlertTriangle size={10} />
                              URGENT
                            </span>
                          )}
                          {isExpiring && !isExpiringSoon && (
                            <span className="px-2 py-1 bg-orange-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                              <Clock size={10} />
                              ACTION
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900">Du {new Date(contract.startDate).toLocaleDateString('fr-FR')}</p>
                          <div className="flex items-center gap-2">
                            <p className={`text-[10px] font-medium italic ${contract.endDate
                                ? (isExpiringSoon
                                  ? 'text-amber-700 font-bold'
                                  : isExpiring
                                    ? 'text-orange-700 font-bold'
                                    : 'text-slate-400')
                                : 'text-slate-400'
                              }`}>
                              {contract.endDate ? `Au ${new Date(contract.endDate).toLocaleDateString('fr-FR')}` : 'Durée Indéterminée'}
                            </p>
                            {(isExpiringSoon || isExpiring) && contract.endDate && (
                              <div className={`w-2 h-2 rounded-full animate-ping ${isExpiringSoon ? 'bg-amber-500' : 'bg-orange-500'
                                }`}></div>
                            )}
                          </div>
                          {(isExpiringSoon || isExpiring) && contract.endDate && (() => {
                            const endDate = new Date(contract.endDate);
                            const today = new Date();
                            const diffTime = endDate.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return (
                              <p className={`text-[9px] font-black uppercase tracking-wider ${isExpiringSoon ? 'text-amber-600' : 'text-orange-600'
                                }`}>
                                {diffDays > 0 ? `${diffDays} jours restants` : 'EXPIRÉ'}
                              </p>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-900">{contract.salary?.toLocaleString()} F CFA</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${contract.status === 'ACTIVE'
                              ? (isExpiringSoon
                                ? 'text-amber-600'
                                : isExpiring
                                  ? 'text-orange-600'
                                  : status.color)
                              : status.color
                            }`}>
                            <StatusIcon size={14} />
                            {contract.status === 'ACTIVE' && isExpiringSoon
                              ? 'EXPIRE BIENTÔT'
                              : contract.status === 'ACTIVE' && isExpiring
                                ? 'À RENOUVELER'
                                : status.label}
                          </span>
                          {(isExpiringSoon || isExpiring) && (
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isExpiringSoon ? 'bg-amber-500' : 'bg-orange-500'
                              }`}></div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewContract(contract)}
                            className="w-10 h-10 bg-white border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:text-slate-900 hover:shadow-md transition-all"
                            title="Voir les détails"
                          >
                            <Eye size={16} />
                          </button>

                          {contract.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleEditClick(contract)}
                              className="w-10 h-10 bg-white border border-slate-100 text-indigo-500 rounded-xl flex items-center justify-center hover:text-indigo-700 hover:shadow-md transition-all"
                              title="Modifier le contrat"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}

                          {contract.status === 'ACTIVE' && (
                            <>
                              {canRenewContract(contract) && (
                                <button
                                  onClick={() => handleRenewClick(contract)}
                                  className={`w-10 h-10 border rounded-xl flex items-center justify-center hover:shadow-md transition-all ${isExpiringSoon
                                      ? 'bg-amber-500 text-white border-amber-500 animate-pulse hover:bg-amber-600 shadow-lg shadow-amber-200'
                                      : isExpiring
                                        ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200'
                                        : 'bg-white border-slate-100 text-green-500 hover:text-green-700'
                                    }`}
                                  title={isExpiringSoon
                                    ? "URGENT: Contrat expire dans moins de 30 jours !"
                                    : isExpiring
                                      ? "Attention: Contrat à renouveler bientôt"
                                      : "Renouveler le contrat"}
                                >
                                  <RefreshCw size={16} className={isExpiringSoon ? 'animate-spin' : ''} />
                                </button>
                              )}
                              <button
                                onClick={() => handleSuspendClick(contract)}
                                className="w-10 h-10 bg-white border border-slate-100 text-amber-500 rounded-xl flex items-center justify-center hover:text-amber-700 hover:shadow-md transition-all"
                                title="Suspendre le contrat"
                              >
                                <Pause size={16} />
                              </button>
                              <button
                                onClick={() => handleTerminateClick(contract)}
                                className="w-10 h-10 bg-white border border-slate-100 text-red-500 rounded-xl flex items-center justify-center hover:text-red-700 hover:shadow-md transition-all"
                                title="Résilier le contrat"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}

                          {contract.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleReactivateContract(contract)}
                              className="w-10 h-10 bg-white border border-slate-100 text-emerald-500 rounded-xl flex items-center justify-center hover:text-emerald-700 hover:shadow-md transition-all"
                              title="Réactiver le contrat"
                            >
                              <Play size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <HRModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetContractForm();
        }}
        title="Nouveau Contrat de Travail"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetContractForm();
              }}
              disabled={creating}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="contract-form"
              disabled={creating || !contractForm.employeeId || !contractForm.startDate}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {creating && <Loader2 size={16} className="animate-spin" />}
              {creating ? 'Création...' : 'Créer le Contrat'}
            </button>
          </div>
        }
      >
        <form id="contract-form" onSubmit={handleCreateContract} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employé *</label>
            <select
              value={contractForm.employeeId}
              onChange={(e) => setContractForm({ ...contractForm, employeeId: e.target.value })}
              required
              disabled={creating}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
            >
              <option value="">Sélectionner un employé</option>
              {getAvailableEmployees().map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} - {emp.position}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {getAvailableEmployees().length === 0 ?
                'Aucun employé disponible (tous ont déjà un contrat actif)' :
                `${getAvailableEmployees().length} employé(s) disponible(s)`
              }
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Contrat *</label>
            <select
              value={contractForm.type}
              onChange={(e) => handleContractTypeChange(e.target.value)}
              required
              disabled={creating}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
            >
              <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
              <option value="CDD">CDD (Contrat à Durée Déterminée)</option>
              <option value="STAGE">Stage</option>
              <option value="FREELANCE">Prestation / Freelance</option>
            </select>
            <p className="text-xs text-indigo-600 font-medium">
              {getContractTypeRules(contractForm.type).helpText}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de Début *</label>
              <input
                type="date"
                value={contractForm.startDate}
                onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                required
                disabled={creating}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date de Fin {(contractForm.type === 'CDD' || contractForm.type === 'STAGE') ? '*' : ''}
              </label>
              <input
                type="date"
                value={contractForm.endDate}
                onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                required={contractForm.type === 'CDD' || contractForm.type === 'STAGE'}
                disabled={creating || contractForm.type === 'CDI'}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-30"
              />
              {contractForm.type === 'CDI' && (
                <p className="text-xs text-slate-500">Les CDI n'ont pas de date de fin</p>
              )}
            </div>
          </div>

          {contractForm.type !== 'STAGE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fin de Période d'Essai</label>
              <input
                type="date"
                value={contractForm.trialPeriodEnd}
                onChange={(e) => setContractForm({ ...contractForm, trialPeriodEnd: e.target.value })}
                disabled={creating}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
              <p className="text-xs text-slate-500">
                Maximum {getContractTypeRules(contractForm.type).maxTrialPeriod} mois pour un {contractForm.type}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salaire de Base Mensuel</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={contractForm.salary}
                onChange={(e) => setContractForm({ ...contractForm, salary: e.target.value })}
                disabled={creating}
                placeholder="Ex: 1500000"
                className="flex-1 px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
              <select
                value={contractForm.currency}
                onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })}
                disabled={creating}
                className="px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              >
                <option value="F CFA">F CFA</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lieu de Travail</label>
            <input
              type="text"
              value={contractForm.workLocation}
              onChange={(e) => setContractForm({ ...contractForm, workLocation: e.target.value })}
              disabled={creating}
              placeholder="Ex: Dakar Plateau"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
            />
          </div>

          {(contractForm.type === 'CDD' || contractForm.type === 'STAGE') && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Renouvellements Maximum
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={contractForm.maxRenewals}
                onChange={(e) => setContractForm({ ...contractForm, maxRenewals: e.target.value })}
                disabled={creating || contractForm.type === 'STAGE'}
                placeholder={contractForm.type === 'STAGE' ? '0 — stages non renouvelables' : 'Ex: 2'}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-30"
              />
              <p className="text-xs text-slate-500">
                {contractForm.type === 'CDD'
                  ? '0 = aucun renouvellement possible · max 5'
                  : 'Les stages ne sont pas renouvelables'}
              </p>
            </div>
          )}
        </form>
      </HRModal>

      {/* Edit Contract Modal */}
      <HRModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetEditForm();
        }}
        title="Modifier le Contrat"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                resetEditForm();
              }}
              disabled={isEditing}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="edit-contract-form"
              disabled={isEditing || !editForm.modificationReason.trim()}
              className="px-4 md:px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {isEditing && <Loader2 size={16} className="animate-spin" />}
              {isEditing ? 'Modification...' : 'Enregistrer les modifications'}
            </button>
          </div>
        }
      >
        <form id="edit-contract-form" onSubmit={handleEditContract} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Contrat *</label>
            <select
              value={editForm.type}
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              required
              disabled={isEditing}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
            >
              {['CDI', 'CDD', 'STAGE', 'FREELANCE'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de Début *</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                required
                disabled={isEditing}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date de Fin {(editForm.type === 'CDD' || editForm.type === 'STAGE') ? '*' : '(Optionnelle)'}
              </label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                required={editForm.type === 'CDD' || editForm.type === 'STAGE'}
                disabled={isEditing || editForm.type === 'CDI'}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-30"
              />
            </div>
          </div>

          {editForm.type !== 'STAGE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fin de Période d'Essai (Optionnelle)</label>
              <input
                type="date"
                value={editForm.trialPeriodEnd}
                onChange={(e) => setEditForm({ ...editForm, trialPeriodEnd: e.target.value })}
                disabled={isEditing}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salaire de Base</label>
              <input
                type="number"
                value={editForm.salary}
                onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                disabled={isEditing}
                step="0.01"
                min="0"
                placeholder="Ex: 500000"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Devise</label>
              <select
                value={editForm.currency}
                onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                disabled={isEditing}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
              >
                <option value="F CFA">F CFA</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lieu de Travail</label>
            <input
              type="text"
              value={editForm.workLocation}
              onChange={(e) => setEditForm({ ...editForm, workLocation: e.target.value })}
              disabled={isEditing}
              placeholder="Ex: Dakar Plateau"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raison de la Modification *</label>
            <textarea
              value={editForm.modificationReason}
              onChange={(e) => setEditForm({ ...editForm, modificationReason: e.target.value })}
              required
              disabled={isEditing}
              rows={3}
              placeholder="Décrivez la raison de cette modification (augmentation salariale, changement de type, etc.)"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-slate-500">
              Cette justification sera conservée dans l'historique du contrat
            </p>
          </div>
        </form>
      </HRModal>

      {/* Bulk Payslip Generation Modal */}
      <HRModal
        isOpen={isBulkPayslipModalOpen}
        onClose={() => setIsBulkPayslipModalOpen(false)}
        title="Téléchargement des Fiches de Paie"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsBulkPayslipModalOpen(false)}
              disabled={generatingPayslips}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="bulk-payslip-form"
              disabled={generatingPayslips || !bulkPayslipForm.month}
              className="px-4 md:px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {generatingPayslips ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {generatingPayslips ? 'Génération...' : 'Télécharger le ZIP'}
            </button>
          </div>
        }
      >
        <form id="bulk-payslip-form" onSubmit={handleGenerateBulkPayslips} className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-emerald-600" size={24} />
              <h3 className="font-bold text-emerald-800">Archive ZIP — Fiches de Paie</h3>
            </div>
            <p className="text-emerald-700 text-sm mb-4">
              Génère et télécharge les fiches de paie de tous les employés ayant un contrat actif, avec les taux configurés dans <strong>Gestion de la Paie</strong> et <strong>Gestion des Temps</strong>.
            </p>
            <div className="bg-white rounded-xl p-4 border border-emerald-100">
              <p className="text-sm text-emerald-800 font-medium">
                <strong>{stats.active}</strong> employé{stats.active > 1 ? 's' : ''} avec contrat actif seront inclus
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Mois de Paie *
            </label>
            <input
              type="month"
              value={bulkPayslipForm.month}
              onChange={(e) => setBulkPayslipForm({ month: e.target.value })}
              required
              disabled={generatingPayslips}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-sm disabled:opacity-50"
            />
            <p className="text-xs text-slate-500">
              Par défaut : mois courant. Assurez-vous que les salaires sont à jour dans les contrats.
            </p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1.5">
            <p className="text-indigo-800 text-[10px] font-black uppercase tracking-widest">Paramètres appliqués</p>
            <p className="text-indigo-700 text-xs">• Taux charges sociales salarié — <em>PayrollSettings.employeeSocialChargeRate</em></p>
            <p className="text-indigo-700 text-xs">• Taux d'imposition — <em>PayrollSettings.taxRate</em></p>
            <p className="text-indigo-700 text-xs">• Jours ouvrables / mois — <em>PayrollSettings.workingDaysPerMonth</em></p>
            <p className="text-indigo-700 text-xs">• Règles retard / absence — <em>rh.time-settings (si déductions activées)</em></p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-amber-800 text-xs">
              <strong>Format :</strong> Un fichier <code>.zip</code> contenant une fiche <strong>PDF</strong> par employé (format A4), prête à imprimer ou archiver.
            </p>
          </div>
        </form>
      </HRModal>

      {/* Contract Details Modal */}
      <HRModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Détails du Contrat"
        size="lg"
      >
        {selectedContract && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employé</label>
                  <p className="text-sm font-bold text-slate-900">{getEmployeeName(selectedContract)}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Contrat</label>
                  <p className="text-sm font-bold text-slate-900">{selectedContract.type}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</label>
                  <span className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${selectedContract.status === 'ACTIVE' ? 'text-emerald-500' :
                      selectedContract.status === 'SUSPENDED' ? 'text-amber-500' :
                        selectedContract.status === 'TERMINATED' ? 'text-slate-500' :
                          'text-red-500'
                    }`}>
                    {selectedContract.status === 'ACTIVE' && <CheckCircle2 size={14} />}
                    {selectedContract.status === 'SUSPENDED' && <Clock size={14} />}
                    {selectedContract.status === 'TERMINATED' && <Clock size={14} />}
                    {selectedContract.status === 'EXPIRED' && <AlertCircle size={14} />}
                    {selectedContract.status === 'ACTIVE' ? 'Actif' :
                      selectedContract.status === 'SUSPENDED' ? 'Suspendu' :
                        selectedContract.status === 'TERMINATED' ? 'Résilié' :
                          'Expiré'}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de Début</label>
                  <p className="text-sm font-bold text-slate-900">{new Date(selectedContract.startDate).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de Fin</label>
                  <p className="text-sm font-bold text-slate-900">{selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString('fr-FR') : 'Durée Indéterminée'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salaire</label>
                  <p className="text-sm font-bold text-slate-900">{selectedContract.salary?.toLocaleString()} F CFA</p>
                </div>
              </div>
            </div>

            {/* Document joint au contrat */}
            {selectedContract.documentUrl && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-2">
                  <FileText size={16} /> Document du Contrat
                </h3>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                  {selectedContract.documentUrl.toLowerCase().includes('.pdf') ||
                    selectedContract.documentUrl.toLowerCase().includes('/raw/') ? (
                    <div>
                      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">📄</div>
                          <p className="text-sm font-bold text-slate-700">Contrat PDF</p>
                        </div>
                        <a
                          href={selectedContract.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          <ExternalLink size={13} /> Ouvrir
                        </a>
                      </div>
                      <iframe
                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedContract.documentUrl)}&embedded=true`}
                        title="Contrat PDF"
                        className="w-full border-0"
                        style={{ height: '500px' }}
                      />
                    </div>
                  ) : selectedContract.documentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                    selectedContract.documentUrl.includes('/image/') ? (
                    <div className="p-4 flex flex-col items-center gap-4">
                      <img
                        src={selectedContract.documentUrl}
                        alt="Document contrat"
                        className="max-w-full max-h-96 object-contain rounded-xl shadow"
                      />
                      <a
                        href={selectedContract.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all"
                      >
                        <ExternalLink size={13} /> Ouvrir en plein écran
                      </a>
                    </div>
                  ) : (
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">📎</div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Document joint</p>
                          <p className="text-xs text-slate-500">Cliquer pour ouvrir</p>
                        </div>
                      </div>
                      <a
                        href={selectedContract.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                      >
                        <ExternalLink size={13} /> Ouvrir
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-6 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Historique Complet</h3>

              {selectedContract.meta && (() => {
                const meta = safeJSONParse(selectedContract.meta);
                if (!meta) return null;

                const modifications = meta.modificationHistory || [];

                if (modifications.length > 0) {
                  return (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Edit2 size={16} />
                        Modifications du Contrat Actuel
                      </h4>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {modifications.reverse().map((modification: any, index: number) => (
                          <div key={index} className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                            <div className="flex-grow">
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-bold text-slate-900">Modification du Contrat</h5>
                                <span className="text-xs font-medium text-slate-500">
                                  {new Date(modification.timestamp).toLocaleString('fr-FR')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 italic">{modification.reason}</p>

                              {modification.changes && modification.changes.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-slate-700">Changements effectués:</p>
                                  {modification.changes.map((change: any, changeIndex: number) => (
                                    <div key={changeIndex} className="text-xs text-slate-600 ml-2">
                                      <span className="font-medium">{change.field}:</span>{' '}
                                      <span className="text-red-600">{change.oldValue || 'Non défini'}</span> →
                                      <span className="text-green-600 ml-1">{change.newValue || 'Non défini'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {contractHistory && contractHistory.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} />
                    Historique des Contrats de l'Employé
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {contractHistory.map((event: any) => (
                      <div key={event.id} className={`flex items-start gap-4 p-4 rounded-xl border ${event.isRenewal ? 'bg-green-50 border-green-200' :
                          event.type === 'CONTRACT_START' ? 'bg-indigo-50 border-indigo-200' :
                            event.type === 'CONTRACT_TERMINATION' ? 'bg-red-50 border-red-200' :
                              'bg-slate-50 border-slate-100'
                        }`}>
                        <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${event.isRenewal ? 'bg-green-500' :
                            event.type === 'CONTRACT_START' ? 'bg-indigo-500' :
                              event.type === 'CONTRACT_TERMINATION' ? 'bg-red-500' :
                                'bg-slate-400'
                          }`}></div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-bold text-slate-900">{event.title}</h5>
                            <span className="text-xs font-medium text-slate-500">
                              {new Date(event.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{event.description}</p>
                          {event.salary && (
                            <p className="text-xs font-medium text-indigo-600 mt-2">
                              Salaire: {event.salary.toLocaleString()} {event.currency}
                            </p>
                          )}
                          {event.renewalReason && (
                            <p className="text-xs text-green-600 mt-1 italic">
                              Raison: {event.renewalReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                let hasModifications = false;
                if (selectedContract.meta) {
                  const meta = safeJSONParse(selectedContract.meta);
                  hasModifications = meta && meta.modificationHistory && meta.modificationHistory.length > 0;
                }

                const hasContractHistory = contractHistory && contractHistory.length > 0;

                if (!hasModifications && !hasContractHistory) {
                  return (
                    <div className="text-center py-8 text-slate-400">
                      <Clock size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucun historique disponible pour ce contrat</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}
      </HRModal>

      {/* Contract Renewal Modal */}
      <HRModal
        isOpen={isRenewModalOpen}
        onClose={() => {
          setIsRenewModalOpen(false);
          resetRenewalForm();
        }}
        title="Renouveler le Contrat"
        size="lg"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setIsRenewModalOpen(false);
                resetRenewalForm();
              }}
              disabled={isRenewing}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="renewal-form"
              disabled={isRenewing || hasRenewalFormErrors()}
              className={`px-4 md:px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 flex items-center gap-2 ${hasRenewalFormErrors()
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
              {isRenewing ? (
                <><RefreshCw className="animate-spin" size={16} /> Renouvellement...</>
              ) : hasRenewalFormErrors() ? (
                <><AlertCircle size={16} /> Formulaire incomplet</>
              ) : (
                <><RefreshCw size={16} /> Renouveler</>
              )}
            </button>
          </div>
        }
      >
        {selectedContract && (
          <form id="renewal-form" onSubmit={handleRenewContract} className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
              <h3 className="text-green-800 font-bold mb-2">Renouvellement de Contrat</h3>
              <p className="text-green-700 text-sm">
                Employé: <strong>{getEmployeeName(selectedContract)}</strong><br />
                Contrat actuel: <strong>{selectedContract.type}</strong><br />
                Date de fin actuelle: <strong>{selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString('fr-FR') : 'Indéterminée'}</strong>
              </p>
              {selectedContract.maxRenewals !== undefined && selectedContract.maxRenewals !== null && (
                <div className={`mt-3 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${(selectedContract.renewalCount ?? 0) >= selectedContract.maxRenewals
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : (selectedContract.renewalCount ?? 0) >= selectedContract.maxRenewals - 1
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-white text-green-700 border border-green-200'
                  }`}>
                  <RefreshCw size={14} />
                  Renouvellements : {selectedContract.renewalCount ?? 0} / {selectedContract.maxRenewals}
                  {(selectedContract.renewalCount ?? 0) >= selectedContract.maxRenewals && (
                    <span className="text-red-600 font-black text-[10px] uppercase tracking-widest">— Limite atteinte</span>
                  )}
                  {(selectedContract.renewalCount ?? 0) === selectedContract.maxRenewals - 1 && (
                    <span className="text-amber-600 font-black text-[10px] uppercase tracking-widest">— Dernier renouvellement possible</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date d'Effet du Renouvellement *
                </label>
                <input
                  type="date"
                  value={renewalForm.effectiveDate}
                  onChange={(e) => handleRenewalFormChange('effectiveDate', e.target.value)}
                  required
                  disabled={isRenewing}
                  className={`w-full px-6 py-4 border-2 rounded-2xl focus:ring-2 transition-all font-bold text-sm disabled:opacity-50 ${renewalErrors.effectiveDate
                      ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-500'
                      : renewalWarnings.effectiveDate
                        ? 'bg-yellow-50 border-yellow-300 focus:ring-yellow-500'
                        : 'bg-slate-50 border-slate-200 focus:ring-green-500'
                    }`}
                />
                {renewalErrors.effectiveDate && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <span className="text-red-500">❌</span> {renewalErrors.effectiveDate}
                  </p>
                )}
                {!renewalErrors.effectiveDate && renewalWarnings.effectiveDate && (
                  <p className="text-xs text-yellow-700 font-medium">
                    {renewalWarnings.effectiveDate}
                  </p>
                )}
                {!renewalErrors.effectiveDate && !renewalWarnings.effectiveDate && (
                  <p className="text-xs text-slate-500">
                    📅 Date à laquelle le nouveau contrat prend effet
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Nouvelle Date de Fin {(renewalForm.newType === 'CDD' || renewalForm.newType === 'STAGE') ? '*' : '(Optionnelle)'}
                </label>
                <input
                  type="date"
                  value={renewalForm.newEndDate}
                  onChange={(e) => handleRenewalFormChange('newEndDate', e.target.value)}
                  required={renewalForm.newType === 'CDD' || renewalForm.newType === 'STAGE'}
                  disabled={isRenewing || renewalForm.newType === 'CDI'}
                  className={`w-full px-6 py-4 border-2 rounded-2xl focus:ring-2 transition-all font-bold text-sm disabled:opacity-30 ${renewalErrors.newEndDate
                      ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-500'
                      : renewalWarnings.newEndDate
                        ? 'bg-yellow-50 border-yellow-300 focus:ring-yellow-500'
                        : 'bg-slate-50 border-slate-200 focus:ring-green-500'
                    }`}
                />
                {renewalErrors.newEndDate && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <span className="text-red-500">❌</span> {renewalErrors.newEndDate}
                  </p>
                )}
                {!renewalErrors.newEndDate && renewalWarnings.newEndDate && (
                  <p className="text-xs text-yellow-700 font-medium">
                    {renewalWarnings.newEndDate}
                  </p>
                )}
                {!renewalErrors.newEndDate && renewalWarnings.duration && (
                  <p className="text-xs text-green-700 font-medium">
                    {renewalWarnings.duration}
                  </p>
                )}
                {renewalForm.newType === 'CDI' && (
                  <p className="text-xs text-slate-500 italic flex items-center gap-1">
                    <span>ℹ️</span> Les contrats CDI n'ont pas de date de fin
                  </p>
                )}
                {renewalForm.newType === 'STAGE' && !renewalErrors.newEndDate && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <span>⏰</span> Maximum 6 mois pour un stage (183 jours)
                  </p>
                )}
                {renewalForm.newType === 'CDD' && !renewalErrors.newEndDate && (
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <span>📋</span> Minimum 7 jours pour un CDD
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Nouveau Type de Contrat *
                </label>
                <select
                  value={renewalForm.newType}
                  onChange={(e) => handleRenewalFormChange('newType', e.target.value)}
                  disabled={isRenewing}
                  className={`w-full px-6 py-4 border-2 rounded-2xl focus:ring-2 transition-all font-bold text-sm disabled:opacity-50 ${renewalErrors.newType
                      ? 'bg-red-50 border-red-300 focus:ring-red-500'
                      : 'bg-slate-50 border-slate-200 focus:ring-green-500'
                    }`}
                >
                  <option value="">Sélectionnez un type</option>
                  <option value="CDI">CDI - Contrat à Durée Indéterminée</option>
                  <option value="CDD">CDD - Contrat à Durée Déterminée</option>
                  <option value="STAGE">STAGE - Stage</option>
                  <option value="FREELANCE">FREELANCE - Freelance</option>
                </select>
                {renewalErrors.newType && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <span className="text-red-500">❌</span> {renewalErrors.newType}
                  </p>
                )}
                {!renewalErrors.newType && renewalForm.newType && (
                  <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                    <span>📋</span> {getContractTypeRules(renewalForm.newType).helpText}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Nouveau Salaire (optionnel)
                </label>
                <input
                  type="number"
                  value={renewalForm.newSalary}
                  onChange={(e) => handleRenewalFormChange('newSalary', e.target.value)}
                  placeholder="Laisser vide pour conserver le salaire actuel"
                  disabled={isRenewing}
                  min="0"
                  step="1000"
                  className={`w-full px-6 py-4 border-2 rounded-2xl focus:ring-2 transition-all font-bold text-sm disabled:opacity-50 ${renewalErrors.newSalary
                      ? 'bg-red-50 border-red-300 focus:ring-red-500'
                      : 'bg-slate-50 border-slate-200 focus:ring-green-500'
                    }`}
                />
                {renewalErrors.newSalary && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <span className="text-red-500">❌</span> {renewalErrors.newSalary}
                  </p>
                )}
                {!renewalErrors.newSalary && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span>💰</span> Salaire actuel : {selectedContract?.salary?.toLocaleString()} {selectedContract?.currency}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Raison du Renouvellement *
              </label>
              <textarea
                value={renewalForm.renewalReason}
                onChange={(e) => handleRenewalFormChange('renewalReason', e.target.value)}
                placeholder="Veuillez expliquer la raison du renouvellement (minimum 10 caractères)..."
                rows={4}
                className={`w-full px-6 py-4 border-2 rounded-2xl focus:ring-2 transition-all font-medium text-sm resize-none disabled:opacity-50 ${renewalErrors.renewalReason
                    ? 'bg-red-50 border-red-300 focus:ring-red-500'
                    : 'bg-slate-50 border-slate-200 focus:ring-green-500'
                  }`}
                disabled={isRenewing}
                required
                minLength={10}
                maxLength={500}
              />
              {renewalErrors.renewalReason && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <span className="text-red-500">❌</span> {renewalErrors.renewalReason}
                </p>
              )}
              <div className="flex justify-between items-center">
                {!renewalErrors.renewalReason && (
                  <p className="text-xs text-slate-500">
                    💡 Exemples: "Performance satisfaisante", "Poursuite du projet", "Évolution de carrière"
                  </p>
                )}
                <p className={`text-xs ${renewalForm.renewalReason.length > 450 ? 'text-red-600' : 'text-slate-400'}`}>
                  {renewalForm.renewalReason.length}/500 caractères
                </p>
              </div>
            </div>

            {!hasRenewalFormErrors() && renewalForm.effectiveDate && renewalForm.newType && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
                <h4 className="text-green-800 font-bold mb-3 flex items-center gap-2">
                  <span>✅</span> Résumé du Renouvellement
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600"><strong>Employé:</strong> {getEmployeeName(selectedContract)}</p>
                    <p className="text-gray-600"><strong>Type:</strong> {selectedContract.type} → <span className="text-green-700 font-medium">{renewalForm.newType}</span></p>
                    <p className="text-gray-600"><strong>Effet:</strong> <span className="text-green-700 font-medium">{new Date(renewalForm.effectiveDate).toLocaleDateString('fr-FR')}</span></p>
                  </div>
                  <div>
                    {renewalForm.newEndDate && (
                      <p className="text-gray-600"><strong>Fin:</strong> <span className="text-green-700 font-medium">{new Date(renewalForm.newEndDate).toLocaleDateString('fr-FR')}</span></p>
                    )}
                    {renewalForm.newSalary && (
                      <p className="text-gray-600"><strong>Salaire:</strong> <span className="text-green-700 font-medium">{Number(renewalForm.newSalary).toLocaleString()} {selectedContract.currency}</span></p>
                    )}
                    {renewalWarnings.duration && (
                      <p className="text-gray-600"><strong>Durée:</strong> <span className="text-blue-600 font-medium">{renewalWarnings.duration.replace('📅 Durée: ', '')}</span></p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-amber-800 text-xs">
                <strong>⚠️ Attention :</strong> Le renouvellement va marquer le contrat actuel comme "RENOUVELÉ"
                et créer un nouveau contrat actif avec les nouvelles conditions à partir de la date d'effet.
              </p>
            </div>
          </form>
        )}
      </HRModal>

      {/* Terminate Contract Modal */}
      <HRModal
        isOpen={isTerminateModalOpen}
        onClose={() => setIsTerminateModalOpen(false)}
        title="Résilier le Contrat"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsTerminateModalOpen(false)}
              disabled={processing}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="terminate-form"
              disabled={processing || !terminationForm.reason.trim() || terminationForm.reason.trim().length < 15}
              className="px-4 md:px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {processing && <Loader2 size={16} className="animate-spin" />}
              {processing ? 'Résiliation...' : 'Résilier le Contrat'}
            </button>
          </div>
        }
      >
        <form id="terminate-form" onSubmit={handleTerminateContract} className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-600" size={24} />
              <h3 className="font-bold text-red-800">Attention - Résiliation Définitive</h3>
            </div>
            <div className="space-y-2 text-sm text-red-700">
              <p>Cette action résiliera définitivement le contrat. Elle ne peut pas être annulée.</p>
              <p>✅ <strong>Action suivante possible :</strong> Après résiliation, vous pourrez désactiver l'employé si nécessaire.</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-blue-700">
                <p className="font-semibold mb-1">Important pour la gestion RH :</p>
                <p>La résiliation d'un contrat actif est nécessaire avant toute désactivation d'employé. Cette contrainte garantit la conformité légale et la traçabilité des actions RH.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Motif de Résiliation * (Obligatoire)
            </label>
            <textarea
              value={terminationForm.reason}
              onChange={(e) => setTerminationForm({ reason: e.target.value })}
              placeholder="Exemple: Fin de mission, démission, licenciement pour motif économique, rupture conventionnelle... (minimum 15 caractères requis)"
              rows={4}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm resize-none"
              disabled={processing}
              required
              minLength={15}
            />
            <div className="flex justify-between text-xs">
              <span className={`${terminationForm.reason.length >= 15 ? 'text-green-600' : 'text-amber-600'}`}>
                {terminationForm.reason.length}/15 caractères minimum requis
              </span>
              {terminationForm.reason.length >= 15 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Motif valide
                </span>
              )}
            </div>
          </div>
        </form>
      </HRModal>

      {/* Suspend Contract Modal */}
      <HRModal
        isOpen={isSuspendModalOpen}
        onClose={() => setIsSuspendModalOpen(false)}
        title="Suspendre le Contrat"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsSuspendModalOpen(false)}
              disabled={processing}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="suspend-form"
              disabled={processing || !suspensionForm.reason.trim()}
              className="px-4 md:px-10 py-4 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {processing && <Loader2 size={16} className="animate-spin" />}
              {processing ? 'Suspension...' : 'Suspendre le Contrat'}
            </button>
          </div>
        }
      >
        <form id="suspend-form" onSubmit={handleSuspendContract} className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Pause className="text-amber-600" size={24} />
              <h3 className="font-bold text-amber-800">Suspension Temporaire</h3>
            </div>
            <p className="text-amber-700 text-sm">
              Cette action suspendra temporairement le contrat. Vous pourrez le réactiver plus tard.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Raison de la Suspension *
            </label>
            <textarea
              value={suspensionForm.reason}
              onChange={(e) => setSuspensionForm({ reason: e.target.value })}
              placeholder="Veuillez expliquer la raison de la suspension (minimum 10 caractères)..."
              rows={4}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all font-medium text-sm resize-none"
              disabled={processing}
              required
              minLength={10}
            />
            <p className="text-xs text-slate-500">
              {suspensionForm.reason.length}/10 caractères minimum
            </p>
          </div>
        </form>
      </HRModal>
    </div>
  );
};

export default ContractList;
