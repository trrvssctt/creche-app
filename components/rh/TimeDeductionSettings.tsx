import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Clock, ToggleLeft, ToggleRight,
  Plus, Trash2, Edit3, Save, X, ArrowLeft,
  RefreshCw, CheckCircle2, AlertTriangle, Info,
  TrendingDown, TrendingUp, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';

interface TimeDeductionSettingsProps {
  onNavigate?: (tab: string, meta?: any) => void;
}

interface PayrollSettings {
  deductionEnabled: boolean;
  workStartTime: string;
  workEndTime: string;
  workingDaysPerMonth: number;
}

type RuleType     = 'LATE' | 'ABSENCE' | 'UNPAID_LEAVE' | 'OVERTIME';
type CondOp       = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ';
type CondUnit     = 'MINUTES' | 'HOURS' | 'DAYS';
type DeductAction = 'DEDUCT_FIXED' | 'DEDUCT_SALARY_HOURS' | 'DEDUCT_SALARY_DAYS' | 'DEDUCT_PERCENT';
type BonusAction  = 'ADD_FIXED' | 'ADD_SALARY_HOURS' | 'ADD_PERCENT';
type ActionType   = DeductAction | BonusAction;

interface HRRule {
  id: string;
  name: string;
  description?: string;
  type: RuleType;
  conditionOperator: CondOp;
  conditionValue: number;
  conditionUnit: CondUnit;
  actionType: ActionType;
  actionValue: number;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_DEDUCT_RULE: Omit<HRRule, 'id'> = {
  name: '', description: '', type: 'LATE',
  conditionOperator: 'GT', conditionValue: 15, conditionUnit: 'MINUTES',
  actionType: 'DEDUCT_PERCENT', actionValue: 1, isActive: true, sortOrder: 0
};

const EMPTY_OVERTIME_RULE: Omit<HRRule, 'id'> = {
  name: '', description: '', type: 'OVERTIME',
  conditionOperator: 'GT', conditionValue: 0, conditionUnit: 'HOURS',
  actionType: 'ADD_SALARY_HOURS', actionValue: 1.5, isActive: true, sortOrder: 0
};

/* ── Labels ───────────────────────────────── */
const TYPE_LABELS: Record<RuleType, string> = {
  LATE: 'Retard', ABSENCE: 'Absence', UNPAID_LEAVE: 'Congé non payé', OVERTIME: 'Heures sup.'
};
const OP_LABELS: Record<CondOp, string> = {
  GT: '>', GTE: '≥', LT: '<', LTE: '≤', EQ: '='
};
const DEDUCT_ACTION_LABELS: Record<DeductAction, string> = {
  DEDUCT_FIXED:        'Montant fixe (F CFA)',
  DEDUCT_SALARY_HOURS: 'Heures de salaire',
  DEDUCT_SALARY_DAYS:  'Jours de salaire',
  DEDUCT_PERCENT:      '% du salaire de base'
};
const BONUS_ACTION_LABELS: Record<BonusAction, string> = {
  ADD_FIXED:        'Montant fixe (F CFA)',
  ADD_SALARY_HOURS: 'Multiplicateur du taux horaire (ex: 1.5×)',
  ADD_PERCENT:      '% du salaire de base'
};

/* ── Couleurs badges ──────────────────────── */
const TYPE_COLORS: Record<RuleType, string> = {
  LATE:        'bg-amber-100 text-amber-700 border-amber-200',
  ABSENCE:     'bg-rose-100 text-rose-700 border-rose-200',
  UNPAID_LEAVE:'bg-purple-100 text-purple-700 border-purple-200',
  OVERTIME:    'bg-emerald-100 text-emerald-700 border-emerald-200'
};

/* ── Décrire une règle en langage naturel ─── */
function ruleDescription(rule: HRRule): string {
  const unit = rule.conditionUnit === 'MINUTES' ? 'min' : rule.conditionUnit === 'HOURS' ? 'h' : 'j';
  const verb = rule.type === 'OVERTIME' ? 'ajouter' : 'déduire';

  let actionStr = '';
  switch (rule.actionType) {
    case 'DEDUCT_FIXED': case 'ADD_FIXED':
      actionStr = `${rule.actionValue.toLocaleString('fr-FR')} F CFA`;
      break;
    case 'DEDUCT_PERCENT': case 'ADD_PERCENT':
      actionStr = `${rule.actionValue}% du salaire`;
      break;
    case 'DEDUCT_SALARY_HOURS':
      actionStr = `${rule.actionValue} heure(s) de salaire`;
      break;
    case 'DEDUCT_SALARY_DAYS':
      actionStr = `${rule.actionValue} jour(s) de salaire`;
      break;
    case 'ADD_SALARY_HOURS':
      actionStr = `taux horaire × ${rule.actionValue}`;
      break;
  }

  return `Si ${TYPE_LABELS[rule.type]} ${OP_LABELS[rule.conditionOperator]} ${rule.conditionValue}${unit} → ${verb} ${actionStr}`;
}

/* ══════════════════════════════════════════ */
const TimeDeductionSettings: React.FC<TimeDeductionSettingsProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'deductions' | 'overtime'>('deductions');

  const [settings, setSettings] = useState<PayrollSettings>({
    deductionEnabled: false,
    workStartTime: '08:00',
    workEndTime: '17:00',
    workingDaysPerMonth: 26
  });
  const [rules, setRules] = useState<HRRule[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  const [showModal, setShowModal]       = useState(false);
  const [editingRule, setEditingRule]   = useState<Partial<HRRule> | null>(null);
  const [isNewRule, setIsNewRule]       = useState(false);

  const [alertMsg, setAlertMsg]   = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg(msg); setAlertType(type); setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3500);
  };

  /* ── Chargement ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, rulesData] = await Promise.all([
        api.get('/hr/payroll-settings'),
        api.get('/hr/rules')
      ]);
      if (settingsData) {
        setSettings({
          deductionEnabled:    settingsData.deductionEnabled ?? false,
          workStartTime:       settingsData.workStartTime    || '08:00',
          workEndTime:         settingsData.workEndTime      || '17:00',
          workingDaysPerMonth: settingsData.workingDaysPerMonth || 26
        });
      }
      setRules(rulesData || []);
    } catch {
      showNotif('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Règles filtrées selon l'onglet ── */
  const deductionRules = rules.filter(r => r.type !== 'OVERTIME');
  const overtimeRules  = rules.filter(r => r.type === 'OVERTIME');

  /* ── Toggle déductions globales ── */
  const handleToggleDeduction = async () => {
    const updated = { ...settings, deductionEnabled: !settings.deductionEnabled };
    setSettings(updated);
    try {
      await api.put('/hr/payroll-settings', updated);
      showNotif(updated.deductionEnabled ? 'Règles activées' : 'Règles désactivées');
    } catch {
      setSettings(settings);
      showNotif('Erreur lors de la mise à jour', 'error');
    }
  };

  /* ── Sauvegarde horaires ── */
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/hr/payroll-settings', settings);
      showNotif('Horaires enregistrés');
    } catch (err: any) {
      showNotif(err.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle par règle ── */
  const handleToggleRule = async (rule: HRRule) => {
    setSavingRuleId(rule.id);
    try {
      const updated = await api.patch(`/hr/rules/${rule.id}/toggle`, {});
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: updated.isActive } : r));
    } catch {
      showNotif('Erreur', 'error');
    } finally {
      setSavingRuleId(null);
    }
  };

  /* ── Ouvrir modal ── */
  const openNew = (tab: 'deductions' | 'overtime') => {
    setEditingRule(tab === 'overtime' ? { ...EMPTY_OVERTIME_RULE } : { ...EMPTY_DEDUCT_RULE });
    setIsNewRule(true);
    setShowModal(true);
  };

  const openEdit = (rule: HRRule) => {
    setEditingRule({ ...rule });
    setIsNewRule(false);
    setShowModal(true);
  };

  /* ── Sauvegarde règle ── */
  const handleSaveRule = async () => {
    if (!editingRule?.name || !editingRule.type) {
      showNotif('Nom et type requis', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isNewRule) {
        const created = await api.post('/hr/rules', editingRule);
        setRules(prev => [...prev, created]);
      } else {
        const updated = await api.put(`/hr/rules/${editingRule.id}`, editingRule);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      }
      setShowModal(false);
      showNotif(isNewRule ? 'Règle créée' : 'Règle mise à jour');
    } catch (err: any) {
      showNotif(err.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Suppression ── */
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette règle ?')) return;
    try {
      await api.delete(`/hr/rules/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
      showNotif('Règle supprimée');
    } catch {
      showNotif('Erreur lors de la suppression', 'error');
    }
  };

  /* ── Aperçu dans la modal ── */
  const previewText = () => {
    if (!editingRule) return '';
    const unit = editingRule.conditionUnit === 'MINUTES' ? ' min' : editingRule.conditionUnit === 'HOURS' ? ' h' : ' j';
    const verb = editingRule.type === 'OVERTIME' ? 'ajouter' : 'déduire';
    let actionStr = '';
    switch (editingRule.actionType) {
      case 'DEDUCT_FIXED': case 'ADD_FIXED':
        actionStr = `${editingRule.actionValue ?? 0} F CFA`; break;
      case 'DEDUCT_PERCENT': case 'ADD_PERCENT':
        actionStr = `${editingRule.actionValue ?? 0}% du salaire`; break;
      case 'DEDUCT_SALARY_HOURS':
        actionStr = `${editingRule.actionValue ?? 0} heure(s) de salaire`; break;
      case 'DEDUCT_SALARY_DAYS':
        actionStr = `${editingRule.actionValue ?? 0} jour(s) de salaire`; break;
      case 'ADD_SALARY_HOURS':
        actionStr = `taux horaire × ${editingRule.actionValue ?? 1.5} par heure sup.`; break;
    }
    return `Si ${TYPE_LABELS[editingRule.type as RuleType] ?? ''} ${OP_LABELS[editingRule.conditionOperator as CondOp] ?? '>'} ${editingRule.conditionValue ?? 0}${unit} → ${verb} ${actionStr}`;
  };

  const isOvertimeRule = editingRule?.type === 'OVERTIME';

  /* ══════════ RENDU ══════════ */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Toast ── */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${
              alertType === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {alertType === 'success'
              ? <CheckCircle2 size={16} className="text-emerald-400" />
              : <AlertTriangle size={16} />}
            {alertMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          {onNavigate && (
            <button onClick={() => onNavigate('rh')}
              className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
              Règles de Facturation RH
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configurez les déductions retard/absence et les majorations heures supplémentaires
            </p>
          </div>
          <button onClick={loadData} disabled={loading}
            className="ml-auto w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Toggle global ── */}
        <div className={`p-7 rounded-[2.5rem] border shadow-sm transition-all ${
          settings.deductionEnabled ? 'bg-indigo-950 border-indigo-900' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className={`text-base font-black uppercase tracking-tighter ${settings.deductionEnabled ? 'text-white' : 'text-slate-900'}`}>
                Application des règles
              </h2>
              <p className={`text-xs font-medium mt-1 ${settings.deductionEnabled ? 'text-indigo-300' : 'text-slate-400'}`}>
                {settings.deductionEnabled
                  ? 'Activé — déductions et majorations s\'appliquent au calcul de la paie'
                  : 'Désactivé — aucune règle ne s\'applique lors du calcul de la paie'}
              </p>
            </div>
            <button onClick={handleToggleDeduction}
              className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                settings.deductionEnabled
                  ? 'bg-white text-indigo-900 hover:bg-indigo-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}>
              {settings.deductionEnabled
                ? <><ToggleRight size={18} /> Activé</>
                : <><ToggleLeft size={18} /> Désactivé</>}
            </button>
          </div>

          {!settings.deductionEnabled && (
            <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">
                Tant que cette option est désactivée, aucune règle ne sera appliquée lors du calcul des fiches de paie.
                Vous pouvez configurer les règles à l'avance.
              </p>
            </div>
          )}
        </div>

        {/* ── Horaires ── */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
            <Clock size={16} className="text-indigo-500" /> Horaires de référence
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Heure d'arrivée normale", key: 'workStartTime', hint: 'Référence pour les retards', type: 'time' },
              { label: "Heure de départ normale", key: 'workEndTime',   hint: 'Référence pour les heures sup.', type: 'time' },
              { label: "Jours ouvrables / mois",  key: 'workingDaysPerMonth', hint: 'Pour le taux journalier', type: 'number' }
            ].map(({ label, key, hint, type }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                <input
                  type={type}
                  min={type === 'number' ? 20 : undefined}
                  max={type === 'number' ? 31 : undefined}
                  value={(settings as any)[key]}
                  onChange={e => setSettings(s => ({
                    ...s,
                    [key]: type === 'number' ? (parseInt(e.target.value) || 26) : e.target.value
                  }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[9px] text-slate-400">{hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSaveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('deductions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === 'deductions'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <TrendingDown size={14} /> Retards & Absences
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
              activeTab === 'deductions' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
            }`}>{deductionRules.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('overtime')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === 'overtime'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <TrendingUp size={14} /> Heures Supplémentaires
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
              activeTab === 'overtime' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
            }`}>{overtimeRules.length}</span>
          </button>
        </div>

        {/* ── Panneau Retards & Absences ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'deductions' && (
            <motion.div key="deductions"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <TrendingDown size={16} className="text-rose-500" /> Règles de déduction
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Définissez ce qui est retenu sur le salaire en cas de retard ou absence
                  </p>
                </div>
                <button onClick={() => openNew('deductions')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all">
                  <Plus size={13} /> Nouvelle règle
                </button>
              </div>

              {/* Info si désactivé globalement */}
              {!settings.deductionEnabled && deductionRules.length > 0 && (
                <div className="mb-4 flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 font-medium">
                    Ces règles sont configurées mais <strong>inactives globalement</strong>. Activez l'application des règles ci-dessus.
                  </p>
                </div>
              )}

              <RulesList
                rules={deductionRules}
                savingRuleId={savingRuleId}
                deductionEnabled={settings.deductionEnabled}
                onToggle={handleToggleRule}
                onEdit={openEdit}
                onDelete={handleDelete}
                emptyIcon={<TrendingDown size={40} className="text-slate-200" />}
                emptyText="Aucune règle de déduction"
                emptyHint="Créez une règle pour les retards ou absences"
              />
            </motion.div>
          )}

          {/* ── Panneau Heures Supplémentaires ── */}
          {activeTab === 'overtime' && (
            <motion.div key="overtime"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <TrendingUp size={16} className="text-emerald-500" /> Règles de majoration
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Définissez le bonus appliqué au salaire lorsqu'un employé fait des heures supplémentaires
                  </p>
                </div>
                <button onClick={() => openNew('overtime')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">
                  <Plus size={13} /> Nouvelle règle
                </button>
              </div>

              {/* Explications des calculs */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  { title: 'Montant fixe', desc: 'Ajoute une prime brute fixe (ex: 5 000 F CFA) quel que soit le nombre d\'heures.', color: 'bg-sky-50 border-sky-100 text-sky-700' },
                  { title: 'Multiplicateur horaire', desc: 'Taux horaire × coefficient × heures réalisées (ex: coeff 1.5 = 50% de plus par heure).', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                  { title: '% du salaire', desc: 'Ajoute un pourcentage du salaire de base mensuel (ex: 2% = prime mensuelle forfaitaire).', color: 'bg-violet-50 border-violet-100 text-violet-700' }
                ].map(({ title, desc, color }) => (
                  <div key={title} className={`p-4 rounded-2xl border ${color} space-y-1`}>
                    <p className="text-[9px] font-black uppercase tracking-widest">{title}</p>
                    <p className="text-[9px] font-medium leading-relaxed opacity-80">{desc}</p>
                  </div>
                ))}
              </div>

              {!settings.deductionEnabled && overtimeRules.length > 0 && (
                <div className="mb-4 flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 font-medium">
                    Ces règles sont configurées mais <strong>inactives globalement</strong>. Activez l'application des règles ci-dessus.
                  </p>
                </div>
              )}

              <RulesList
                rules={overtimeRules}
                savingRuleId={savingRuleId}
                deductionEnabled={settings.deductionEnabled}
                onToggle={handleToggleRule}
                onEdit={openEdit}
                onDelete={handleDelete}
                emptyIcon={<TrendingUp size={40} className="text-slate-200" />}
                emptyText="Aucune règle de majoration"
                emptyHint="Créez une règle pour les heures supplémentaires"
                isBonus
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════ MODAL CRÉATION / ÉDITION ══════════ */}
      <AnimatePresence>
        {showModal && editingRule && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Titre modal */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOvertimeRule
                    ? <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp size={16} className="text-emerald-600" /></div>
                    : <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center"><TrendingDown size={16} className="text-rose-600" /></div>}
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">
                    {isNewRule
                      ? (isOvertimeRule ? 'Règle heures sup.' : 'Règle de déduction')
                      : 'Modifier la règle'}
                  </h3>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* Nom */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nom *</label>
                <input type="text"
                  placeholder={isOvertimeRule ? 'Ex: Majoration heures sup. 50%' : 'Ex: Retard > 15 min'}
                  value={editingRule.name || ''}
                  onChange={e => setEditingRule(r => ({ ...r!, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Type (uniquement pour règles de déduction) */}
              {!isOvertimeRule && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type de déduction *</label>
                  <select
                    value={editingRule.type || 'LATE'}
                    onChange={e => setEditingRule(r => ({
                      ...r!,
                      type: e.target.value as RuleType,
                      conditionUnit: e.target.value === 'LATE' ? 'MINUTES' : 'DAYS'
                    }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="LATE">Retard</option>
                    <option value="ABSENCE">Absence injustifiée</option>
                    <option value="UNPAID_LEAVE">Congé non payé</option>
                  </select>
                </div>
              )}

              {/* Condition */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Condition — appliquer la règle si…
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={editingRule.conditionOperator || 'GT'}
                    onChange={e => setEditingRule(r => ({ ...r!, conditionOperator: e.target.value as CondOp }))}
                    className="px-3 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-20"
                  >
                    <option value="GT">&gt;</option>
                    <option value="GTE">≥</option>
                    <option value="LT">&lt;</option>
                    <option value="LTE">≤</option>
                    <option value="EQ">=</option>
                  </select>
                  <input type="number" min={0}
                    value={editingRule.conditionValue ?? 0}
                    onChange={e => setEditingRule(r => ({ ...r!, conditionValue: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <select
                    value={editingRule.conditionUnit || (isOvertimeRule ? 'HOURS' : 'MINUTES')}
                    onChange={e => setEditingRule(r => ({ ...r!, conditionUnit: e.target.value as CondUnit }))}
                    className="px-3 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {isOvertimeRule ? (
                      <>
                        <option value="MINUTES">min</option>
                        <option value="HOURS">heures</option>
                      </>
                    ) : (editingRule.type === 'LATE') ? (
                      <>
                        <option value="MINUTES">min</option>
                        <option value="HOURS">heures</option>
                      </>
                    ) : (
                      <option value="DAYS">jours</option>
                    )}
                  </select>
                </div>
                <p className="text-[9px] text-slate-400">
                  {isOvertimeRule
                    ? 'Nombre d\'heures supplémentaires réalisées ce mois'
                    : editingRule.type === 'LATE'
                    ? 'Total des minutes/heures de retard cumulées sur le mois'
                    : 'Nombre de jours d\'absence ou de congé non payé'}
                </p>
              </div>

              {/* Action */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {isOvertimeRule ? 'Majoration à appliquer' : 'Déduction à appliquer'}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={editingRule.actionType || (isOvertimeRule ? 'ADD_SALARY_HOURS' : 'DEDUCT_PERCENT')}
                    onChange={e => setEditingRule(r => ({ ...r!, actionType: e.target.value as ActionType }))}
                    className="flex-1 px-3 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {isOvertimeRule ? (
                      <>
                        <option value="ADD_FIXED">Montant fixe (F CFA)</option>
                        <option value="ADD_SALARY_HOURS">Multiplicateur du taux horaire (ex: 1.5×)</option>
                        <option value="ADD_PERCENT">% du salaire de base</option>
                      </>
                    ) : (
                      <>
                        <option value="DEDUCT_PERCENT">% du salaire de base</option>
                        <option value="DEDUCT_FIXED">Montant fixe (F CFA)</option>
                        <option value="DEDUCT_SALARY_HOURS">Heures de salaire</option>
                        <option value="DEDUCT_SALARY_DAYS">Jours de salaire</option>
                      </>
                    )}
                  </select>
                  <input
                    type="number" min={0}
                    step={['DEDUCT_PERCENT', 'ADD_PERCENT', 'ADD_SALARY_HOURS'].includes(editingRule.actionType || '') ? 0.1 : 1}
                    value={editingRule.actionValue ?? (isOvertimeRule ? 1.5 : 1)}
                    onChange={e => setEditingRule(r => ({ ...r!, actionValue: parseFloat(e.target.value) || 0 }))}
                    className="w-28 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {editingRule.actionType === 'ADD_SALARY_HOURS' && (
                  <p className="text-[9px] text-emerald-600 font-medium">
                    Exemple : coeff 1.5 = taux horaire × 1.5 × nombre d'heures sup. (soit +50%)
                  </p>
                )}
                {editingRule.actionType === 'ADD_PERCENT' && (
                  <p className="text-[9px] text-violet-600 font-medium">
                    Exemple : 2% du salaire de base = prime mensuelle forfaitaire quel que soit les heures
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Note interne (optionnel)</label>
                <input type="text"
                  placeholder="Description ou justification de cette règle…"
                  value={editingRule.description || ''}
                  onChange={e => setEditingRule(r => ({ ...r!, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Aperçu */}
              <div className={`p-4 rounded-2xl border ${isOvertimeRule ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap size={12} className={isOvertimeRule ? 'text-emerald-500' : 'text-rose-500'} />
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isOvertimeRule ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Aperçu de la règle
                  </p>
                </div>
                <p className={`text-xs font-bold ${isOvertimeRule ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {previewText()}
                </p>
              </div>

              {/* Actions modal */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">
                  Annuler
                </button>
                <button onClick={handleSaveRule} disabled={saving}
                  className={`flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 ${
                    isOvertimeRule ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {isNewRule ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ══ Composant liste de règles ══ */
interface RulesListProps {
  rules: HRRule[];
  savingRuleId: string | null;
  deductionEnabled: boolean;
  onToggle: (r: HRRule) => void;
  onEdit: (r: HRRule) => void;
  onDelete: (id: string) => void;
  emptyIcon: React.ReactNode;
  emptyText: string;
  emptyHint: string;
  isBonus?: boolean;
}

const RulesList: React.FC<RulesListProps> = ({
  rules, savingRuleId, deductionEnabled,
  onToggle, onEdit, onDelete,
  emptyIcon, emptyText, emptyHint,
  isBonus = false
}) => {
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        {emptyIcon}
        <p className="font-bold text-slate-500 mt-4">{emptyText}</p>
        <p className="text-sm mt-1 text-slate-400">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <motion.div key={rule.id} layout
          className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${
            rule.isActive && deductionEnabled
              ? isBonus
                ? 'bg-emerald-50/40 border-emerald-100 shadow-sm'
                : 'bg-white border-rose-100 shadow-sm'
              : 'bg-slate-50 border-slate-100'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${TYPE_COLORS[rule.type]}`}>
                {TYPE_LABELS[rule.type]}
              </span>
              {isBonus && (
                <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-emerald-100 text-emerald-700 border-emerald-200">
                  + Gain
                </span>
              )}
              <span className="text-sm font-black text-slate-900">{rule.name}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{ruleDescription(rule)}</p>
            {rule.description && (
              <p className="text-[10px] text-slate-400 mt-1">{rule.description}</p>
            )}
          </div>

          {/* Toggle par règle */}
          <button onClick={() => onToggle(rule)} disabled={savingRuleId === rule.id}
            title={rule.isActive ? 'Désactiver' : 'Activer'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border disabled:opacity-50 ${
              rule.isActive
                ? isBonus
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-300 border-slate-100 hover:border-slate-300'
            }`}>
            {savingRuleId === rule.id
              ? <RefreshCw size={12} className="animate-spin" />
              : rule.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>

          <button onClick={() => onEdit(rule)}
            className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
            <Edit3 size={13} />
          </button>
          <button onClick={() => onDelete(rule.id)}
            className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 transition-all">
            <Trash2 size={13} />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

export default TimeDeductionSettings;
