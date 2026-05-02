
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  GitPullRequest, 
  FolderOpen, 
  CreditCard, 
  Settings, 
  Play, 
  ClipboardList, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Award,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  UserPlus,
  Briefcase,
  Layers,
  ShieldCheck,
  History,
  FileCheck,
  DollarSign,
  PieChart,
  Activity,
  GraduationCap,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';

interface HRDashboardProps {
  onNavigate: (tab: string, meta?: any) => void;
}

interface HRStats {
  totalEmployees: number;
  totalSalary: string;
  totalSalaryRaw: number;
  averageSalary: number;
  activeContracts: number;
  activeLeaves: number;
  pendingLeaves: number;
  activeDepartments: number;
  newEmployeesThisMonth: number;
  expiringContracts: number;
  performanceRate: number;
}

const HRDashboard: React.FC<HRDashboardProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState<'admin' | 'payroll'>('admin');
  const [hrStats, setHrStats] = useState<HRStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyConfigured, setCompanyConfigured] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [checkingConfig, setCheckingConfig] = useState<boolean>(true);

  // Paramètres paie & temps
  const [showPayrollSettingsModal, setShowPayrollSettingsModal] = useState<boolean>(false);
  const [payrollOk, setPayrollOk] = useState<boolean>(true);
  const [timeOk, setTimeOk] = useState<boolean>(true);

  // Charger les statistiques et vérifier la configuration au montage du composant
  useEffect(() => {
    checkCompanyConfiguration();
  }, []);

  // Charger les stats + vérifier paramètres paie/temps seulement si l'entreprise est configurée
  useEffect(() => {
    if (companyConfigured && !checkingConfig) {
      loadHRStats();
      checkPayrollAndTimeSettings();
    }
  }, [companyConfigured, checkingConfig]);

  const checkCompanyConfiguration = async () => {
    try {
      setCheckingConfig(true);
      const response = await apiClient.get('/hr/declarations/settings');
      
      // Vérifier si les informations essentielles de l'entreprise sont renseignées
      const isConfigured = response && 
        response.companyName && 
        response.country && 
        response.legalForm &&
        response.ipresEmployeeRate !== undefined &&
        response.ipresEmployerRate !== undefined;
      
      setCompanyConfigured(isConfigured);
      
      if (!isConfigured) {
        setShowConfigModal(true);
      }
    } catch (err: any) {
      console.error('Erreur lors de la vérification de la configuration:', err);
      // En cas d'erreur, on considère que la configuration n'est pas faite
      setCompanyConfigured(false);
      setShowConfigModal(true);
    } finally {
      setCheckingConfig(false);
    }
  };

  const loadHRStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get('/hr/employees/hr-stats');
      setHrStats(data);
    } catch (err: any) {
      console.error('Erreur lors du chargement des statistiques RH:', err);
      setError('Impossible de charger les statistiques. ' + (err.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  const checkPayrollAndTimeSettings = async () => {
    try {
      const [settingsData, rulesData] = await Promise.all([
        apiClient.get('/hr/payroll-settings'),
        apiClient.get('/hr/rules')
      ]);
      const s = settingsData?.data || settingsData || {};
      const rules = Array.isArray(rulesData) ? rulesData : (rulesData?.data || []);

      // Paie configurée : taux cotisations explicitement sauvegardés
      const pOk = s.employerSocialChargeRate != null && s.employeeSocialChargeRate != null;
      // Temps configurés : horaires de référence renseignés + au moins une règle active
      const tOk = !!(s.workStartTime && s.workEndTime && s.workingDaysPerMonth) && rules.length > 0;

      setPayrollOk(pOk);
      setTimeOk(tOk);

      if (!pOk || !tOk) {
        setShowPayrollSettingsModal(true);
      }
    } catch (err) {
      // Silencieux : on affiche le modal par précaution
      setPayrollOk(false);
      setTimeOk(false);
      setShowPayrollSettingsModal(true);
    }
  };

  const handleModuleClick = (moduleId: string) => {
    // Vérifier si l'entreprise est configurée avant de permettre la navigation
    if (!companyConfigured) {
      setShowConfigModal(true);
      return;
    }
    console.log('Navigation vers:', moduleId); // Debug log
    onNavigate(moduleId);
  };

  const handleConfigureCompany = () => {
    // Rediriger vers la gestion de paie avec l'onglet déclarations pour la configuration
    onNavigate('rh.payroll', { initialTab: 'declarations' });
  };

  const handleSkipConfiguration = () => {
    setShowConfigModal(false);
    setCompanyConfigured(true); // Permettre l'accès temporaire
  };

  const adminModules = [
    { id: 'rh.employees', title: 'Employés', desc: 'Gestion administrative, fiches salariés, dossiers numériques.', icon: <Users />, color: 'bg-blue-500' },
    { id: 'rh.departments', title: 'Départements', desc: 'Organisation des équipes et structures hiérarchiques.', icon: <Building2 />, color: 'bg-slate-600' },
    { id: 'rh.contracts', title: 'Contrats', desc: 'Gestion des contrats, renouvellements, périodes d\'essai.', icon: <FileText />, color: 'bg-indigo-500' },
    { id: 'rh.org', title: 'Organigramme', desc: 'Vue graphique hiérarchique et structurelle.', icon: <GitPullRequest />, color: 'bg-purple-500' },
    { id: 'rh.docs', title: 'Documents', desc: 'Gestion centralisée des documents employés (CNI, Diplômes).', icon: <FolderOpen />, color: 'bg-amber-500' },
    { id: 'rh.leaves', title: 'Congés', desc: 'Gestion des absences, congés payés et planning d\'équipe.', icon: <Calendar />, color: 'bg-emerald-500' },
    { id: 'rh.attendance', title: 'Pointage', desc: 'Suivi des présences, retards et heures d\'arrivée/départ.', icon: <Clock />, color: 'bg-amber-500' },
    { id: 'rh.overtime', title: 'Heures Supplémentaires', desc: 'Demandes, validation et effectuation des heures supplémentaires.', icon: <TrendingUp />, color: 'bg-indigo-500' },
    { id: 'rh.time-settings', title: 'Paramètres Temps', desc: 'Règles de déduction retard/absence, horaires de référence.', icon: <Settings />, color: 'bg-slate-500' },
    //{ id: 'rh.recruitment', title: 'Recrutement', desc: 'Gestion des offres d\'emploi et suivi des candidats.', icon: <Briefcase />, color: 'bg-rose-500' },
    //{ id: 'rh.training', title: 'Formation', desc: 'Planification des sessions et suivi des compétences.', icon: <GraduationCap />, color: 'bg-cyan-500' },
    //{ id: 'rh.performance', title: 'Performance', desc: 'Campagnes d\'évaluation et suivi des objectifs.', icon: <Activity />, color: 'bg-orange-500' },
  ];

  const payrollModules = [
    { id: 'rh.payroll.settings', title: 'Paramétrage', desc: 'Charges sociales, impôts, rubriques de paie.', icon: <Settings />, color: 'bg-slate-700' },
    { id: 'rh.payroll.generation', title: 'Génération Paie', desc: 'Calcul mensuel, validation globale, bulletins.', icon: <Play />, color: 'bg-emerald-600' },
    { id: 'rh.payroll.slips', title: 'Fiches de Paie', desc: 'Consultation et téléchargement des bulletins PDF.', icon: <ClipboardList />, color: 'bg-blue-600' },
    { id: 'rh.payroll.bonuses', title: 'Primes', desc: 'Gestion des primes exceptionnelles et de performance.', icon: <TrendingUp />, color: 'bg-rose-500' },
    { id: 'rh.payroll.advances', title: 'Avances', desc: 'Demandes d\'avances sur salaire et acomptes.', icon: <CreditCard />, color: 'bg-orange-500' },
    { id: 'rh.payroll.declarations', title: 'Déclarations', desc: 'Rapports sociaux et fiscaux officiels.', icon: <FileCheck />, color: 'bg-cyan-600' },
  ];

  // Statistiques basées sur les vraies données ou valeurs par défaut
  const stats = hrStats ? [
    { 
      label: 'Total Employés', 
      value: hrStats.totalEmployees.toString(), 
      change: hrStats.newEmployeesThisMonth > 0 ? `+${hrStats.newEmployeesThisMonth} ce mois` : 'Aucun nouveau',
      icon: <Users /> 
    },
    { 
      label: 'Masse Salariale', 
      value: `${hrStats.totalSalary} F CFA`, 
      change: hrStats.activeContracts > 0 ? `${hrStats.activeContracts} contrats` : 'Aucun contrat',
      icon: <DollarSign /> 
    },
    { 
      label: 'Congés Actifs', 
      value: hrStats.activeLeaves.toString(), 
      change: hrStats.pendingLeaves > 0 ? `${hrStats.pendingLeaves} en attente` : 'Aucun en attente',
      icon: <Calendar /> 
    },
    { 
      label: 'Taux Contrats', 
      value: `${hrStats.performanceRate}%`, 
      change: hrStats.expiringContracts > 0 ? `${hrStats.expiringContracts} expirent` : 'Tous stables',
      icon: <Activity /> 
    },
  ] : [
    { label: 'Total Employés', value: '0', change: 'Chargement...', icon: <Users /> },
    { label: 'Masse Salariale', value: '0', change: 'Chargement...', icon: <DollarSign /> },
    { label: 'Congés Actifs', value: '0', change: 'Chargement...', icon: <Calendar /> },
    { label: 'Taux Contrats', value: '0%', change: 'Chargement...', icon: <Activity /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Modal de Configuration d'Entreprise */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-5 md:p-10 max-w-2xl w-full mx-4 md:mx-auto shadow-2xl relative"
            >
              <div className="text-center space-y-8">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center mx-auto">
                  <Building2 className="text-white" size={40} />
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">
                    Configuration Entreprise Requise
                  </h2>
                  <p className="text-slate-600 font-medium leading-relaxed mb-2">
                    Pour utiliser le module RH, vous devez d'abord configurer les informations de votre entreprise.
                  </p>
                  <p className="text-sm text-slate-500 font-medium">
                    Cette étape est essentielle pour les calculs de paie, les déclarations sociales et fiscales.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-left">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="text-indigo-600" size={20} />
                      <span className="font-bold text-indigo-900 text-sm">Informations Générales</span>
                    </div>
                    <p className="text-xs text-indigo-700">Nom, forme juridique, adresse</p>
                  </div>
                  
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      <span className="font-bold text-emerald-900 text-sm">Paramètres Sociaux</span>
                    </div>
                    <p className="text-xs text-emerald-700">Taux IPRES, CSS, organismes</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="text-purple-600" size={20} />
                      <span className="font-bold text-purple-900 text-sm">Paramètres Fiscaux</span>
                    </div>
                    <p className="text-xs text-purple-700">Régime d'imposition, taux</p>
                  </div>
                  
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="text-amber-600" size={20} />
                      <span className="font-bold text-amber-900 text-sm">Responsable Légal</span>
                    </div>
                    <p className="text-xs text-amber-700">Gérant, DG, responsable RH</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={handleConfigureCompany}
                    className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:shadow-xl transition-all flex items-center gap-3 justify-center"
                  >
                    <Settings size={18} />
                    Configurer Maintenant
                  </button>
                  
                  <button 
                    onClick={handleSkipConfiguration}
                    className="px-8 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Passer (temporaire)
                  </button>
                </div>
                
                <div className="text-xs text-slate-400 font-medium">
                  💡 La configuration peut être modifiée à tout moment dans les paramètres de paie
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Paramètres Paie & Temps */}
      <AnimatePresence>
        {showPayrollSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-6 md:p-10 max-w-2xl w-full shadow-2xl relative"
            >
              {/* Close */}
              <button
                onClick={() => setShowPayrollSettingsModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-2xl transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>

              <div className="space-y-8">
                {/* Header */}
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[1.5rem] flex items-center justify-center shrink-0">
                    <AlertCircle className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                      Paramètres de Paie Incomplets
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Ces paramètres sont appliqués automatiquement à <strong className="text-slate-700">tous les calculs</strong> :
                      salaires, primes, avances, déductions retard/absence et déclarations sociales.
                      Sans eux, les résultats de paie seront incorrects ou impossibles à générer.
                    </p>
                  </div>
                </div>

                {/* Cartes statut */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Gestion de la Paie */}
                  <div className={`p-5 rounded-2xl border-2 space-y-3 ${payrollOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payrollOk ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          <DollarSign size={20} />
                        </div>
                        <span className="font-black text-slate-900 text-sm uppercase tracking-tight">Gestion de la Paie</span>
                      </div>
                      {payrollOk
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertCircle size={18} className="text-amber-500" />
                      }
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Taux de cotisations patronales & salariales, rubriques de paie, monnaie.
                      Utilisés pour chaque bulletin de salaire et déclaration sociale.
                    </p>
                    {!payrollOk && (
                      <button
                        onClick={() => { setShowPayrollSettingsModal(false); onNavigate('rh.payroll', { initialTab: 'settings' }); }}
                        className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-600 transition-all"
                      >
                        <Settings size={14} /> Configurer maintenant <ArrowRight size={14} />
                      </button>
                    )}
                    {payrollOk && (
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={12} /> Configuré
                      </p>
                    )}
                  </div>

                  {/* Gestion des Temps */}
                  <div className={`p-5 rounded-2xl border-2 space-y-3 ${timeOk ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${timeOk ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          <Clock size={20} />
                        </div>
                        <span className="font-black text-slate-900 text-sm uppercase tracking-tight">Gestion des Temps</span>
                      </div>
                      {timeOk
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertCircle size={18} className="text-rose-500" />
                      }
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Horaires de référence, nombre de jours/mois et règles de déduction retard & absence.
                      Appliqués automatiquement à la fiche de paie.
                    </p>
                    {!timeOk && (
                      <button
                        onClick={() => { setShowPayrollSettingsModal(false); onNavigate('rh.time-settings'); }}
                        className="w-full py-2.5 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-600 transition-all"
                      >
                        <Settings size={14} /> Configurer maintenant <ArrowRight size={14} />
                      </button>
                    )}
                    {timeOk && (
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={12} /> Configuré
                      </p>
                    )}
                  </div>
                </div>

                {/* Note importance */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Ces paramètres sont <strong>partagés et appliqués globalement</strong> à tous vos employés.
                    Une modification ultérieure affectera les prochains calculs de paie.
                  </p>
                </div>

                <button
                  onClick={() => setShowPayrollSettingsModal(false)}
                  className="w-full py-3 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Configurer plus tard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur de vérification */}
      {checkingConfig && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-lg">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
          <span className="text-sm font-bold text-slate-700">Vérification de la configuration...</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">Module RH & Paie</h1>
          <div className="flex items-center gap-3">
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Gestion du capital humain - Enterprise Edition</p>
            {!companyConfigured && !checkingConfig && (
              <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-200">
                ⚠️ Configuration Requise
              </span>
            )}
            {companyConfigured && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-200">
                ✅ Configuré
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!companyConfigured ? (
            <button 
              onClick={() => setShowConfigModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:shadow-xl transition-all active:scale-95"
            >
              <Settings size={16} /> Configurer Entreprise
            </button>
          ) : (
            <button 
              onClick={() => handleModuleClick('rh.employees')}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
            >
              <UserPlus size={16} /> Nouvel Employé
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-4 md:p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-800 mb-2">Erreur de chargement des statistiques</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={loadHRStats}
            className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : stat.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  loading ? 'bg-slate-100 text-slate-400' : 
                  stat.change.includes('+') || stat.change.includes('Tous stables') ? 'bg-emerald-50 text-emerald-500' :
                  stat.change.includes('attente') || stat.change.includes('expirent') ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">{stat.label}</p>
              <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">
                {loading ? <Loader2 className="animate-spin" size={24} /> : stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[2rem] w-fit">
        <button 
          onClick={() => setActiveSection('admin')}
          className={`px-4 md:px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${activeSection === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Administration RH
        </button>
        <button 
          onClick={() => setActiveSection('payroll')}
          className={`px-4 md:px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${activeSection === 'payroll' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Gestion de la Paie
        </button>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(activeSection === 'admin' ? adminModules : payrollModules).map((module, i) => (
          <motion.div 
            key={module.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleModuleClick(module.id)}
            className={`group cursor-pointer ${!companyConfigured ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <div className="bg-white p-4 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden h-full flex flex-col">
              {!companyConfigured && (
                <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] rounded-[3rem] flex items-center justify-center z-10">
                  <div className="text-center">
                    <Settings className="text-slate-400 mx-auto mb-2" size={32} />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Configuration Requise</p>
                  </div>
                </div>
              )}
              <div className={`w-16 h-16 ${module.color} text-white rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform duration-500`}>
                {React.cloneElement(module.icon as React.ReactElement, { size: 32 })}
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">{module.title}</h3>
              <p className="text-slate-500 font-medium text-xs leading-relaxed mb-8 flex-grow">{module.desc}</p>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                  {companyConfigured ? 'Accéder au module' : 'Configuration requise'}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  {companyConfigured ? <ChevronRight size={16} /> : <Settings size={16} />}
                </div>
              </div>
              {/* Decorative element */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity / Alerts */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
              <History className="text-indigo-500" /> Activité Récente
            </h3>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Voir tout</button>
          </div>
          <div className="space-y-6">
            {hrStats && hrStats.expiringContracts > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl shadow-sm border border-amber-200 flex items-center justify-center">
                    <ShieldCheck className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-amber-800">Système d'Alerte</p>
                    <p className="text-xs text-amber-700 font-medium">{hrStats.expiringContracts} contrat(s) expire(nt) dans les 30 prochains jours</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Urgent</span>
              </div>
            )}
            {hrStats && hrStats.pendingLeaves > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl shadow-sm border border-blue-200 flex items-center justify-center">
                    <Calendar className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-blue-800">Demandes en Attente</p>
                    <p className="text-xs text-blue-700 font-medium">{hrStats.pendingLeaves} demande(s) de congé à valider</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">À traiter</span>
              </div>
            )}
            {hrStats && hrStats.newEmployeesThisMonth > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl shadow-sm border border-emerald-200 flex items-center justify-center">
                    <UserPlus className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-800">Nouvelles Embauches</p>
                    <p className="text-xs text-emerald-700 font-medium">{hrStats.newEmployeesThisMonth} nouveau(x) employé(s) ce mois</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Ce mois</span>
              </div>
            )}
            {[
              { user: 'Système RH', action: `${hrStats?.totalEmployees || 0} employés actifs`, time: 'Maintenant', icon: <Users className="text-blue-500" /> },
              { user: 'Gestion Paie', action: `Masse salariale: ${hrStats?.totalSalary || '0'} F CFA`, time: 'Temps réel', icon: <DollarSign className="text-emerald-500" /> },
              { user: 'Départements', action: `${hrStats?.activeDepartments || 0} département(s) actif(s)`, time: 'Actualisé', icon: <Building2 className="text-purple-500" /> },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{item.user}</p>
                    <p className="text-xs text-slate-500 font-medium">{item.action}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full"></div>
          <h3 className="text-lg font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
            <TrendingUp className="text-indigo-400" /> Aperçu Performance
          </h3>
          <div className="space-y-8 relative z-10">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employés Actifs</span>
                <span className="text-sm font-black text-emerald-400">
                  {hrStats ? `${hrStats.totalEmployees}` : '0'}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: hrStats ? `${Math.min(hrStats.totalEmployees / 150 * 100, 100)}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contrats Actifs</span>
                <span className="text-sm font-black text-indigo-400">
                  {hrStats ? `${hrStats.performanceRate}%` : '0%'}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000"
                  style={{ width: hrStats ? `${hrStats.performanceRate}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Départements</span>
                <span className="text-sm font-black text-blue-400">
                  {hrStats ? `${hrStats.activeDepartments}` : '0'}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: hrStats ? `${Math.min(hrStats.activeDepartments / 10 * 100, 100)}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div className="pt-6">
              <button 
                onClick={loadHRStats}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
              >
                {loading ? 'Actualisation...' : 'Actualiser les Données'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
