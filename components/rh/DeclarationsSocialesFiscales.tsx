import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Plus,
  Settings,
  Building2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Download,
  Eye,
  Edit,
  Trash2,
  Send,
  Calculator,
  BarChart3,
  Shield,
  Users,
  Globe,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import { api } from '../../services/api';

interface DeclarationsSocialesFiscalesProps {}

const DECLARATION_TYPES = [
  { value: 'IPRES_MONTHLY', label: 'IPRES Mensuel', organisme: 'IPRES' },
  { value: 'CSS_MONTHLY',   label: 'CSS Mensuel',   organisme: 'CSS'  },
  { value: 'CFCE_MONTHLY',  label: 'CFCE Mensuel',  organisme: 'CFCE' },
  { value: 'VRS_MONTHLY',   label: 'VRS (Impôts sur Salaires)', organisme: 'DGI' },
  { value: 'ITS_ANNUAL',    label: 'ITS Annuel',    organisme: 'DGI'  },
  { value: 'PATENTE',       label: 'Patente',        organisme: 'DGI'  },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-slate-50 text-slate-600',
  READY:     'bg-blue-50 text-blue-600',
  SUBMITTED: 'bg-amber-50 text-amber-600',
  VALIDATED: 'bg-emerald-50 text-emerald-600',
  REJECTED:  'bg-red-50 text-red-600',
  PAID:      'bg-green-50 text-green-600',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     'Brouillon',
  READY:     'Prêt',
  SUBMITTED: 'Soumis',
  VALIDATED: 'Validé',
  REJECTED:  'Rejeté',
  PAID:      'Payé',
};

const DeclarationsSocialesFiscales: React.FC<DeclarationsSocialesFiscalesProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  // Paramètres entreprise
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    companyName: '',
    siret: '',
    nafCode: '',
    legalForm: 'SARL',
    collectiveAgreement: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Sénégal',
    ipresNumber: '',
    cssNumber: '',
    cfceNumber: '',
    taxNumber: '',
    vatNumber: '',
    taxRegime: 'RSI',
    ipresEmployeeRate: 5.6,
    ipresEmployerRate: 8.4,
    cssEmployeeRate: 3.5,
    cssEmployerRate: 7.0,
    cfceEmployerRate: 7.0,
    accidentWorkRate: 3.0,
    declarationDay: 15,
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: ''
  });

  // Déclarations
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState<any>(null);
  const [isDeclarationModalOpen, setIsDeclarationModalOpen] = useState(false);
  const [isNewDeclarationModalOpen, setIsNewDeclarationModalOpen] = useState(false);
  const [newDeclarationForm, setNewDeclarationForm] = useState({
    declarationType: 'IPRES_MONTHLY',
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    dueDate: '',
    notes: ''
  });

  // Alertes
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  const subTabs = [
    { id: 'dashboard',    label: 'Tableau de Bord',      icon: <BarChart3 size={16} /> },
    { id: 'declarations', label: 'Déclarations',          icon: <FileCheck size={16} /> },
    { id: 'settings',     label: 'Paramètres Entreprise', icon: <Building2 size={16} /> },
  ];

  // Chargement initial (une seule fois)
  useEffect(() => {
    loadDashboard();
    loadCompanySettings();
  }, []);

  // Chargement à chaque changement d'onglet
  useEffect(() => {
    if (activeSubTab === 'declarations') loadDeclarations();
    if (activeSubTab === 'dashboard')    loadDashboard();
  }, [activeSubTab]);

  // === CHARGEMENT ===

  const loadDashboard = async () => {
    try {
      const response = await api.get('/hr/declarations/dashboard');
      setDashboard(response?.data || response || null);
    } catch (error) {
      console.error('Erreur dashboard:', error);
      setDashboard(null);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const response = await api.get('/hr/declarations/settings');
      const data = response?.data || response || null;
      setCompanySettings(data);
      if (data) {
        setSettingsForm({
          companyName:        data.companyName        || '',
          siret:              data.siret              || '',
          nafCode:            data.nafCode            || '',
          legalForm:          data.legalForm          || 'SARL',
          collectiveAgreement:data.collectiveAgreement|| '',
          address:            data.address            || '',
          city:               data.city               || '',
          postalCode:         data.postalCode         || '',
          country:            data.country            || 'Sénégal',
          ipresNumber:        data.ipresNumber        || '',
          cssNumber:          data.cssNumber          || '',
          cfceNumber:         data.cfceNumber         || '',
          taxNumber:          data.taxNumber          || '',
          vatNumber:          data.vatNumber          || '',
          taxRegime:          data.taxRegime          || 'RSI',
          ipresEmployeeRate:  data.ipresEmployeeRate  ?? 5.6,
          ipresEmployerRate:  data.ipresEmployerRate  ?? 8.4,
          cssEmployeeRate:    data.cssEmployeeRate    ?? 3.5,
          cssEmployerRate:    data.cssEmployerRate    ?? 7.0,
          cfceEmployerRate:   data.cfceEmployerRate   ?? 7.0,
          accidentWorkRate:   data.accidentWorkRate   ?? 3.0,
          declarationDay:     data.declarationDay     ?? 15,
          responsibleName:    data.responsibleName    || '',
          responsibleEmail:   data.responsibleEmail   || '',
          responsiblePhone:   data.responsiblePhone   || ''
        });
      }
    } catch (error) {
      console.error('Erreur paramètres:', error);
    }
  };

  const loadDeclarations = async () => {
    try {
      const response = await api.get('/hr/declarations');
      const data = response?.data || response || {};
      setDeclarations(Array.isArray(data) ? data : (data.declarations || []));
    } catch (error) {
      console.error('Erreur déclarations:', error);
      setDeclarations([]);
    }
  };

  // === HANDLERS ===

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const requiredFields: Record<string, string> = {
      companyName:        'Nom de l\'entreprise',
      legalForm:          'Forme juridique',
      country:            'Pays',
      ipresEmployeeRate:  'Taux IPRES salarié',
      ipresEmployerRate:  'Taux IPRES employeur',
      cssEmployeeRate:    'Taux CSS salarié',
      cssEmployerRate:    'Taux CSS employeur',
      declarationDay:     'Jour de déclaration'
    };

    const errors: string[] = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      const val = settingsForm[field as keyof typeof settingsForm];
      if (val === '' || val === null || val === undefined) errors.push(label);
    }
    if (errors.length > 0) {
      showAlertMessage(`Champs manquants : ${errors.join(', ')}`, 'error');
      return;
    }

    try {
      setIsLoading(true);
      await api.put('/hr/declarations/settings', settingsForm);
      await loadCompanySettings();
      setIsSettingsModalOpen(false);
      showAlertMessage('Paramètres sauvegardés avec succès', 'success');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      showAlertMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = DECLARATION_TYPES.find(t => t.value === newDeclarationForm.declarationType);
    const organisme = found?.organisme || '';
    const label = found?.label || '';

    const [year, month] = newDeclarationForm.period.split('-');
    const periodLabel = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' })
      .format(new Date(parseInt(year), parseInt(month) - 1));

    try {
      setIsLoading(true);
      await api.post('/hr/declarations', {
        declarationType: newDeclarationForm.declarationType,
        period: newDeclarationForm.period,
        fiscalYear: parseInt(year),
        title: `${label} – ${periodLabel}`,
        organisme,
        status: 'DRAFT',
        dueDate: newDeclarationForm.dueDate || null,
        notes: newDeclarationForm.notes,
        totalAmount: 0,
        employeeCotisations: 0,
        employerCotisations: 0,
        taxAmount: 0,
        numberOfEmployees: 0,
        totalSalaryBase: 0,
      });
      await loadDeclarations();
      await loadDashboard();
      setIsNewDeclarationModalOpen(false);
      setNewDeclarationForm({
        declarationType: 'IPRES_MONTHLY',
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        dueDate: '',
        notes: ''
      });
      showAlertMessage('Déclaration créée avec succès', 'success');
    } catch (error: any) {
      console.error('Erreur création:', error);
      const msg = error?.response?.data?.error || 'Erreur lors de la création';
      showAlertMessage(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = async (declaration: any) => {
    try {
      setIsLoading(true);
      const response = await api.post(`/hr/declarations/${declaration.id}/calculate`, {});
      const updated = response?.data || response;
      setDeclarations(prev => prev.map(d => d.id === updated.id ? updated : d));
      if (selectedDeclaration?.id === updated.id) setSelectedDeclaration(updated);
      showAlertMessage('Montants calculés avec succès', 'success');
    } catch (error) {
      console.error('Erreur calcul:', error);
      showAlertMessage('Erreur lors du calcul', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDeclaration = async (declaration: any) => {
    if (!window.confirm(`Soumettre la déclaration "${declaration.title}" ? Cette action est irréversible.`)) return;
    try {
      setIsLoading(true);
      const response = await api.post(`/hr/declarations/${declaration.id}/submit`, {});
      const updated = response?.data || response;
      setDeclarations(prev => prev.map(d => d.id === updated.id ? updated : d));
      showAlertMessage('Déclaration soumise avec succès', 'success');
    } catch (error: any) {
      console.error('Erreur soumission:', error);
      showAlertMessage(error?.response?.data?.error || 'Erreur lors de la soumission', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeclaration = async (declaration: any) => {
    if (!window.confirm(`Supprimer la déclaration "${declaration.title}" ?`)) return;
    try {
      setIsLoading(true);
      await api.delete(`/hr/declarations/${declaration.id}`);
      setDeclarations(prev => prev.filter(d => d.id !== declaration.id));
      await loadDashboard();
      showAlertMessage('Déclaration supprimée', 'success');
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      showAlertMessage(error?.response?.data?.error || 'Erreur lors de la suppression', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMonthlyDeclarations = async () => {
    try {
      setIsLoading(true);
      const d = new Date();
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      await api.post('/hr/declarations/generate-monthly', { period });
      await loadDeclarations();
      await loadDashboard();
      showAlertMessage('Déclarations mensuelles générées avec succès', 'success');
    } catch (error) {
      console.error('Erreur génération:', error);
      showAlertMessage('Erreur lors de la génération', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintDeclaration = (declaration: any) => {
    const company = companySettings || {};
    const period = declaration.period || declaration.declarationPeriod || '';
    const organisme = declaration.organisme || declaration.type || '';
    const amounts = declaration.calculatedAmounts || declaration.amounts || {};

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Déclaration ${organisme} – ${period}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; }
  .company-name { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #1e293b; }
  .company-info { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.6; }
  .badge { background: #4f46e5; color: white; padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #4f46e5; margin: 20px 0 12px; border-left: 4px solid #4f46e5; padding-left: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f8fafc; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; color: #475569; padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0; }
  td { padding: 7px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
  tr:nth-child(even) { background: #f8fafc; }
  .total-row td { font-weight: 900; background: #f1f5f9; font-size: 11px; }
  .amount { text-align: right; font-weight: 700; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .signature-box { border: 1px solid #cbd5e1; padding: 16px 24px; width: 200px; text-align: center; }
  .signature-box p { font-size: 9px; text-transform: uppercase; font-weight: 900; color: #64748b; margin-bottom: 40px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">${company.companyName || 'Entreprise'}</div>
    <div class="company-info">
      NINEA : ${company.taxNumber || 'N/A'} &nbsp;|&nbsp; IPRES : ${company.ipresNumber || 'N/A'} &nbsp;|&nbsp; CSS : ${company.cssNumber || 'N/A'}<br/>
      ${company.address || ''} ${company.city || ''}, ${company.country || 'Sénégal'}
    </div>
  </div>
  <div>
    <div class="badge">${organisme}</div>
    <div style="text-align:right; margin-top:8px; font-size:10px; color:#64748b">
      Période : <strong>${period}</strong><br/>
      Échéance : <strong>${declaration.dueDate ? new Date(declaration.dueDate).toLocaleDateString('fr-FR') : 'N/A'}</strong><br/>
      Généré le : <strong>${new Date().toLocaleDateString('fr-FR')}</strong>
    </div>
  </div>
</div>
<h2>${declaration.title || 'Déclaration Sociale & Fiscale'}</h2>
<table>
  <thead>
    <tr>
      <th>Libellé</th>
      <th>Base de calcul</th>
      <th>Taux employé</th>
      <th>Taux employeur</th>
      <th class="amount">Cotisation salariale</th>
      <th class="amount">Cotisation patronale</th>
      <th class="amount">Total</th>
    </tr>
  </thead>
  <tbody>
    ${amounts && typeof amounts === 'object' && Object.keys(amounts).length > 0
      ? Object.entries(amounts).filter(([k]) => !k.toLowerCase().includes('total')).map(([key, val]: [string, any]) => `
    <tr>
      <td>${key}</td>
      <td class="amount">${typeof val === 'object' ? (val.base || 0).toLocaleString('fr-FR') : '-'} F CFA</td>
      <td>${typeof val === 'object' ? (val.employeeRate || '-') : '-'}%</td>
      <td>${typeof val === 'object' ? (val.employerRate || '-') : '-'}%</td>
      <td class="amount">${typeof val === 'object' ? (val.employeeAmount || val.employee || 0).toLocaleString('fr-FR') : (typeof val === 'number' ? val.toLocaleString('fr-FR') : '-')} F CFA</td>
      <td class="amount">${typeof val === 'object' ? (val.employerAmount || val.employer || 0).toLocaleString('fr-FR') : '-'} F CFA</td>
      <td class="amount">${typeof val === 'object' ? ((val.employeeAmount || val.employee || 0) + (val.employerAmount || val.employer || 0)).toLocaleString('fr-FR') : '-'} F CFA</td>
    </tr>`).join('')
      : `<tr><td colspan="7" style="text-align:center;color:#94a3b8">Montants non calculés — veuillez calculer la déclaration d'abord</td></tr>`}
    <tr class="total-row">
      <td colspan="4"><strong>TOTAL À VERSER</strong></td>
      <td class="amount"><strong>${(declaration.employeeCotisations || 0).toLocaleString('fr-FR')} F CFA</strong></td>
      <td class="amount"><strong>${(declaration.employerCotisations || 0).toLocaleString('fr-FR')} F CFA</strong></td>
      <td class="amount"><strong>${(declaration.totalAmount || 0).toLocaleString('fr-FR')} F CFA</strong></td>
    </tr>
  </tbody>
</table>
<div class="footer">
  <div>
    <p>Document généré par <strong>GeStockPro</strong> — Ne pas modifier manuellement</p>
    <p>Référence : ${declaration.reference || declaration.id?.slice(0, 8) || 'N/A'} &nbsp;|&nbsp; Statut : ${declaration.status || 'DRAFT'}</p>
  </div>
  <div class="signature-box">
    <p>Cachet & Signature</p>
  </div>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const showAlertMessage = (message: string, type: 'success' | 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 4000);
  };

  // === RENDER ===

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Statistiques */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                <FileCheck className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black text-blue-600">{dashboard.statistics?.totalDeclarations || 0}</span>
            </div>
            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Total Déclarations</p>
            <p className="text-xs text-slate-500">Cette année</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-[2rem] border border-emerald-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black text-emerald-600">{dashboard.statistics?.submissionRate || 0}%</span>
            </div>
            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Taux de Soumission</p>
            <p className="text-xs text-slate-500">{dashboard.statistics?.submittedDeclarations} / {dashboard.statistics?.totalDeclarations}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-[2rem] border border-amber-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
                <Clock className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black text-amber-600">{dashboard.statistics?.pendingDeclarations || 0}</span>
            </div>
            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">En Attente</p>
            <p className="text-xs text-slate-500">À traiter</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-[2rem] border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black text-red-600">{dashboard.statistics?.overdueDeclarations || 0}</span>
            </div>
            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">En Retard</p>
            <p className="text-xs text-slate-500">Action requise</p>
          </div>
        </div>
      )}

      {/* Prochaines échéances */}
      {dashboard?.upcomingDeadlines && dashboard.upcomingDeadlines.length > 0 && (
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
            <Calendar className="text-amber-500" /> Prochaines Échéances
          </h3>
          <div className="space-y-3">
            {dashboard.upcomingDeadlines.map((d: any) => {
              const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={d.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <FileText className="text-amber-600" size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{d.title}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d.organisme} • {d.period}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-700">{new Date(d.dueDate).toLocaleDateString('fr-FR')}</p>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${daysLeft <= 5 ? 'text-red-500' : 'text-amber-500'}`}>
                      {daysLeft <= 0 ? 'En retard' : `Dans ${daysLeft}j`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Montants par organisme */}
      {dashboard?.amountsByOrganisme && dashboard.amountsByOrganisme.length > 0 && (
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
            <DollarSign className="text-indigo-500" /> Cotisations Soumises par Organisme
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dashboard.amountsByOrganisme.map((item: any) => (
              <div key={item.organisme} className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">{item.organisme}</p>
                <p className="text-lg font-black text-slate-900">{Number(item.totalAmount || 0).toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-slate-400">F CFA</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
          <TrendingUp className="text-indigo-500" /> Actions Rapides
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleGenerateMonthlyDeclarations}
            disabled={isLoading}
            className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-3"
          >
            <Plus size={20} /> Générer Déclarations Mensuelles
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className="p-6 bg-gradient-to-br from-slate-500 to-slate-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-slate-600 hover:to-slate-700 transition-all shadow-lg flex items-center gap-3"
          >
            <Settings size={20} /> Configurer Entreprise
          </button>

          <button
            onClick={() => setActiveSubTab('declarations')}
            className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-3"
          >
            <FileCheck size={20} /> Voir Déclarations
          </button>
        </div>
      </div>
    </div>
  );

  const renderDeclarations = () => (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
          <FileCheck className="text-indigo-500" /> Liste des Déclarations
        </h3>
        <button
          onClick={() => setIsNewDeclarationModalOpen(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
        >
          <Plus size={16} /> Nouvelle Déclaration
        </button>
      </div>

      <div className="space-y-4">
        {declarations.length > 0 ? declarations.map((declaration: any) => {
          const canEdit   = !['SUBMITTED', 'VALIDATED', 'PAID'].includes(declaration.status);
          const canSubmit = declaration.status === 'READY';
          const canDelete = !['SUBMITTED', 'VALIDATED', 'PAID'].includes(declaration.status);

          return (
            <div key={declaration.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
              <div className="flex items-start justify-between gap-4">
                {/* Infos */}
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-110 transition-transform shrink-0">
                    <FileCheck size={26} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{declaration.title}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {declaration.organisme} • Période {declaration.period} • Échéance {declaration.dueDate ? new Date(declaration.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </p>
                    {declaration.totalAmount > 0 && (
                      <p className="text-sm font-black text-indigo-600 mt-1">
                        {Number(declaration.totalAmount).toLocaleString('fr-FR')} F CFA
                      </p>
                    )}
                  </div>
                </div>

                {/* Statut + Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[declaration.status] || STATUS_COLORS.DRAFT}`}>
                    {STATUS_LABELS[declaration.status] || declaration.status}
                  </span>

                  {/* Voir détail */}
                  <button
                    onClick={() => { setSelectedDeclaration(declaration); setIsDeclarationModalOpen(true); }}
                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    title="Voir le détail"
                  >
                    <Eye size={14} />
                  </button>

                  {/* Calculer */}
                  {canEdit && (
                    <button
                      onClick={() => handleCalculate(declaration)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-50"
                      title="Calculer les montants"
                    >
                      <Calculator size={13} /> Calculer
                    </button>
                  )}

                  {/* Soumettre */}
                  {canSubmit && (
                    <button
                      onClick={() => handleSubmitDeclaration(declaration)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50"
                      title="Soumettre la déclaration"
                    >
                      <Send size={13} /> Soumettre
                    </button>
                  )}

                  {/* Imprimer */}
                  <button
                    onClick={() => handlePrintDeclaration(declaration)}
                    className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    title="Imprimer"
                  >
                    <Download size={13} /> Imprimer
                  </button>

                  {/* Supprimer */}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteDeclaration(declaration)}
                      disabled={isLoading}
                      className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-16">
            <FileCheck className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">Aucune déclaration trouvée</p>
            <p className="text-xs text-slate-400 mt-2">Cliquez sur "Nouvelle Déclaration" ou "Générer Déclarations Mensuelles"</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
          <Building2 className="text-indigo-500" /> Paramètres de l'Entreprise
        </h3>
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
        >
          <Edit size={16} /> {companySettings ? 'Modifier' : 'Configurer'}
        </button>
      </div>

      {companySettings ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50 rounded-2xl">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Building2 size={16} /> Informations Générales
              </h4>
              <div className="space-y-4">
                {[
                  { label: 'Nom de l\'entreprise', value: companySettings.companyName },
                  { label: 'SIRET / NINEA',         value: companySettings.siret     },
                  { label: 'Code NAF / APE',         value: companySettings.nafCode   },
                  { label: 'Forme juridique',        value: companySettings.legalForm },
                  { label: 'Régime fiscal',          value: companySettings.taxRegime },
                  { label: 'Numéro fiscal',          value: companySettings.taxNumber },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-black text-slate-900">{value || 'Non défini'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe size={16} /> Organismes Sociaux & Adresse
              </h4>
              <div className="space-y-4">
                {[
                  { label: 'Numéro IPRES', value: companySettings.ipresNumber },
                  { label: 'Numéro CSS',   value: companySettings.cssNumber   },
                  { label: 'Numéro CFCE',  value: companySettings.cfceNumber  },
                  { label: 'Adresse',      value: companySettings.address     },
                  { label: 'Ville',        value: companySettings.city        },
                  { label: 'Pays',         value: companySettings.country     },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-black text-slate-900">{value || 'Non défini'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calculator size={16} /> Taux de Cotisations
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'IPRES Salarié',   value: companySettings.ipresEmployeeRate ?? 5.6 },
                { label: 'IPRES Employeur', value: companySettings.ipresEmployerRate ?? 8.4 },
                { label: 'CSS Salarié',     value: companySettings.cssEmployeeRate   ?? 3.5 },
                { label: 'CSS Employeur',   value: companySettings.cssEmployerRate   ?? 7.0 },
                { label: 'CFCE Employeur',  value: companySettings.cfceEmployerRate  ?? 7.0 },
                { label: 'Accident Travail',value: companySettings.accidentWorkRate  ?? 3.0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                  <p className="text-lg font-black text-indigo-600">{value}%</p>
                </div>
              ))}
            </div>
          </div>

          {(companySettings.responsibleName || companySettings.responsibleEmail) && (
            <div className="p-6 bg-slate-50 rounded-2xl">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users size={16} /> Responsable Déclarations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nom</p>
                  <p className="text-sm font-black text-slate-900">{companySettings.responsibleName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email</p>
                  <p className="text-sm font-black text-slate-900">{companySettings.responsibleEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Téléphone</p>
                  <p className="text-sm font-black text-slate-900">{companySettings.responsiblePhone || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-medium">Paramètres non configurés</p>
          <p className="text-xs text-slate-400 mt-2">Cliquez sur "Configurer" pour définir les informations de votre entreprise</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Alert */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black uppercase text-[10px] tracking-widest ${
              alertType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {alertType === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Paramètres Entreprise */}
      <HRModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Configuration de l'Entreprise"
        size="xl"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={isLoading}
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50"
            >
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Informations générales */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Building2 size={16} /> Informations Générales
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nom de l'entreprise *</label>
                <input
                  type="text"
                  value={settingsForm.companyName}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${!settingsForm.companyName ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Nom complet de l'entreprise"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Forme juridique *</label>
                <select
                  value={settingsForm.legalForm}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, legalForm: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="SARL">SARL</option>
                  <option value="SA">SA</option>
                  <option value="SAS">SAS</option>
                  <option value="SASU">SASU</option>
                  <option value="EURL">EURL</option>
                  <option value="EI">EI</option>
                  <option value="SNC">SNC</option>
                  <option value="SCS">SCS</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">SIRET / NINEA</label>
                <input
                  type="text"
                  value={settingsForm.siret}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, siret: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Numéro d'identification"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Code NAF / APE</label>
                <input
                  type="text"
                  value={settingsForm.nafCode}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, nafCode: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Code activité"
                />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <MapPin size={16} /> Adresse
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Adresse complète</label>
                <textarea
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                  placeholder="Rue, avenue, quartier..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ville</label>
                  <input type="text" value={settingsForm.city} onChange={(e) => setSettingsForm(prev => ({ ...prev, city: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Code postal</label>
                  <input type="text" value={settingsForm.postalCode} onChange={(e) => setSettingsForm(prev => ({ ...prev, postalCode: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pays *</label>
                  <input
                    type="text"
                    value={settingsForm.country}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, country: e.target.value }))}
                    className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${!settingsForm.country ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                    placeholder="Sénégal"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organismes sociaux */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield size={16} /> Organismes Sociaux
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Numéro IPRES</label>
                <input type="text" value={settingsForm.ipresNumber} onChange={(e) => setSettingsForm(prev => ({ ...prev, ipresNumber: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Institution de Prévoyance Retraite" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Numéro CSS</label>
                <input type="text" value={settingsForm.cssNumber} onChange={(e) => setSettingsForm(prev => ({ ...prev, cssNumber: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Caisse de Sécurité Sociale" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Numéro CFCE</label>
                <input type="text" value={settingsForm.cfceNumber} onChange={(e) => setSettingsForm(prev => ({ ...prev, cfceNumber: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Caisse Prestations Familiales" />
              </div>
            </div>
          </div>

          {/* Paramètres fiscaux */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <DollarSign size={16} /> Paramètres Fiscaux
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Numéro fiscal (NINEA)</label>
                <input type="text" value={settingsForm.taxNumber} onChange={(e) => setSettingsForm(prev => ({ ...prev, taxNumber: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Régime fiscal</label>
                <select value={settingsForm.taxRegime} onChange={(e) => setSettingsForm(prev => ({ ...prev, taxRegime: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="RSI">RSI – Régime Synthétique d'Imposition</option>
                  <option value="RNI">RNI – Régime Normal d'Imposition</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Taux de cotisations */}
          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calculator size={16} /> Taux de Cotisations (%)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { key: 'ipresEmployeeRate', label: 'IPRES Salarié *',   default: 5.6 },
                { key: 'ipresEmployerRate', label: 'IPRES Employeur *', default: 8.4 },
                { key: 'cssEmployeeRate',   label: 'CSS Salarié *',     default: 3.5 },
                { key: 'cssEmployerRate',   label: 'CSS Employeur *',   default: 7.0 },
                { key: 'cfceEmployerRate',  label: 'CFCE Employeur',    default: 7.0 },
                { key: 'accidentWorkRate',  label: 'Accident Travail',  default: 3.0 },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={settingsForm[key as keyof typeof settingsForm] as number}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required={label.includes('*')}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Responsable */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users size={16} /> Responsable Déclarations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nom complet</label>
                <input type="text" value={settingsForm.responsibleName} onChange={(e) => setSettingsForm(prev => ({ ...prev, responsibleName: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3"><Mail size={12} className="inline mr-1" /> Email</label>
                <input type="email" value={settingsForm.responsibleEmail} onChange={(e) => setSettingsForm(prev => ({ ...prev, responsibleEmail: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3"><Phone size={12} className="inline mr-1" /> Téléphone</label>
                <input type="tel" value={settingsForm.responsiblePhone} onChange={(e) => setSettingsForm(prev => ({ ...prev, responsiblePhone: e.target.value }))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          {/* Jour de déclaration */}
          <div className="p-6 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar size={16} /> Paramètres de Déclaration
            </h4>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Jour de déclaration mensuelle (1–31) *</label>
              <input
                type="number"
                min="1"
                max="31"
                value={settingsForm.declarationDay}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, declarationDay: parseInt(e.target.value) || 15 }))}
                className="w-32 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-400 mt-2">Les déclarations sociales (IPRES, CSS) sont dues avant le 15 de chaque mois suivant</p>
            </div>
          </div>
        </form>
      </HRModal>

      {/* Modal Nouvelle Déclaration */}
      <HRModal
        isOpen={isNewDeclarationModalOpen}
        onClose={() => setIsNewDeclarationModalOpen(false)}
        title="Nouvelle Déclaration"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsNewDeclarationModalOpen(false)}
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={(e) => handleCreateDeclaration(e as any)}
              disabled={isLoading}
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50"
            >
              {isLoading ? 'Création...' : 'Créer la Déclaration'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateDeclaration} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Type de déclaration *</label>
            <select
              value={newDeclarationForm.declarationType}
              onChange={(e) => setNewDeclarationForm(prev => ({ ...prev, declarationType: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              {DECLARATION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label} ({t.organisme})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Période (AAAA-MM) *</label>
            <input
              type="month"
              value={newDeclarationForm.period}
              onChange={(e) => setNewDeclarationForm(prev => ({ ...prev, period: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Date d'échéance</label>
            <input
              type="date"
              value={newDeclarationForm.dueDate}
              onChange={(e) => setNewDeclarationForm(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Notes</label>
            <textarea
              value={newDeclarationForm.notes}
              onChange={(e) => setNewDeclarationForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
              placeholder="Observations, remarques..."
            />
          </div>
        </form>
      </HRModal>

      {/* Modal Détail Déclaration */}
      {selectedDeclaration && (
        <HRModal
          isOpen={isDeclarationModalOpen}
          onClose={() => { setIsDeclarationModalOpen(false); setSelectedDeclaration(null); }}
          title="Détail de la Déclaration"
          size="lg"
          footer={
            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={() => handlePrintDeclaration(selectedDeclaration)}
                className="flex items-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
              >
                <Download size={14} /> Imprimer
              </button>
              <div className="flex gap-3">
                {!['SUBMITTED', 'VALIDATED', 'PAID'].includes(selectedDeclaration.status) && (
                  <button
                    type="button"
                    onClick={() => { handleCalculate(selectedDeclaration); setIsDeclarationModalOpen(false); }}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-4 bg-blue-50 text-blue-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    <Calculator size={14} /> Calculer
                  </button>
                )}
                {selectedDeclaration.status === 'READY' && (
                  <button
                    type="button"
                    onClick={() => { handleSubmitDeclaration(selectedDeclaration); setIsDeclarationModalOpen(false); }}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    <Send size={14} /> Soumettre
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setIsDeclarationModalOpen(false); setSelectedDeclaration(null); }}
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <p className="text-sm font-black text-slate-900">{selectedDeclaration.title}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {selectedDeclaration.organisme} • Période {selectedDeclaration.period}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[selectedDeclaration.status] || STATUS_COLORS.DRAFT}`}>
                {STATUS_LABELS[selectedDeclaration.status] || selectedDeclaration.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Échéance',            value: selectedDeclaration.dueDate ? new Date(selectedDeclaration.dueDate).toLocaleDateString('fr-FR') : '—' },
                { label: 'Nombre d\'employés',  value: selectedDeclaration.numberOfEmployees || '—' },
                { label: 'Base salariale',       value: selectedDeclaration.totalSalaryBase ? `${Number(selectedDeclaration.totalSalaryBase).toLocaleString('fr-FR')} F CFA` : '—' },
                { label: 'Cotisations salariales', value: selectedDeclaration.employeeCotisations ? `${Number(selectedDeclaration.employeeCotisations).toLocaleString('fr-FR')} F CFA` : '—' },
                { label: 'Cotisations patronales', value: selectedDeclaration.employerCotisations ? `${Number(selectedDeclaration.employerCotisations).toLocaleString('fr-FR')} F CFA` : '—' },
                { label: 'Impôts sur salaires', value: selectedDeclaration.taxAmount ? `${Number(selectedDeclaration.taxAmount).toLocaleString('fr-FR')} F CFA` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                  <p className="text-sm font-black text-slate-900 mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Total à Verser</p>
              <p className="text-2xl font-black text-indigo-600">
                {selectedDeclaration.totalAmount ? `${Number(selectedDeclaration.totalAmount).toLocaleString('fr-FR')} F CFA` : '—'}
              </p>
            </div>
          </div>
        </HRModal>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-6">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
          <FileCheck size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Déclarations Sociales & Fiscales</h2>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Gestion des obligations déclaratives</p>
        </div>
      </div>

      {/* Navigation sous-onglets */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[2rem] w-fit overflow-x-auto no-scrollbar">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeSubTab === 'dashboard'    && renderDashboard()}
        {activeSubTab === 'declarations' && renderDeclarations()}
        {activeSubTab === 'settings'     && renderSettings()}
      </motion.div>
    </div>
  );
};

export default DeclarationsSocialesFiscales;
