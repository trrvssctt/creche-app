import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, LogIn, LogOut, CheckCircle2, AlertCircle, Loader2,
  Calendar, Timer, Sun, Moon, Coffee, TrendingUp, History,
  ArrowLeft, RefreshCw, Zap, TrendingDown, Scale, ChevronDown, ChevronUp,
  Plus, FileText, XCircle, Send, Umbrella, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import { authBridge } from '../../services/authBridge';

interface EmployeePointageProps {
  onNavigate: (tab: string, meta?: any) => void;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  overtimeMinutes: number;
  meta?: { lateMinutes?: number; expectedStart?: string; autoClockout?: boolean };
}

interface OvertimeSummary {
  month: string;
  totalOvertimeMinutes: number;
  totalAbsenceMinutes: number;
  totalLateMinutes: number;
  totalDeficitMinutes: number;
  compensatedMinutes: number;
  remainingOvertimeMinutes: number;
  remainingDeficitMinutes: number;
  workDayMinutes: number;
}

interface Settings {
  workStartTime: string;
  workEndTime: string;
  workingDaysPerMonth: number;
  deductionEnabled: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PRESENT:    { label: 'Présent',    color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  LATE:       { label: 'Retard',     color: 'bg-amber-50  text-amber-600  border-amber-200'  },
  ABSENT:     { label: 'Absent',     color: 'bg-rose-50   text-rose-600   border-rose-200'   },
  HALF_DAY:   { label: 'Demi-jour',  color: 'bg-blue-50   text-blue-600   border-blue-200'   },
  HOLIDAY:    { label: 'Congé',      color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  REMOTE:     { label: 'Télétravail',color: 'bg-purple-50 text-purple-600 border-purple-200' },
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

interface OvertimeRequestRecord {
  id: string;
  requestedDate: string;
  startTime?: string;
  endTime?: string;
  requestedMinutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewNote?: string;
  actualMinutes: number;
}

const OT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED:  { label: 'Approuvée',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:  { label: 'Refusée',    color: 'bg-rose-50 text-rose-700 border-rose-200' },
  COMPLETED: { label: 'Effectuée',  color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const EmployeePointage: React.FC<EmployeePointageProps> = ({ onNavigate }) => {
  const [now,              setNow]             = useState(new Date());
  const [today,            setToday]           = useState<AttendanceRecord | null>(null);
  const [settings,         setSettings]        = useState<Settings | null>(null);
  const [history,          setHistory]         = useState<AttendanceRecord[]>([]);
  const [overtimeSummary,  setOvertimeSummary] = useState<OvertimeSummary | null>(null);
  const [loading,          setLoading]         = useState(true);
  const [noEmployee,       setNoEmployee]      = useState(false);
  const [actionLoading,    setActionLoading]   = useState(false);
  const [toast,            setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [showBilanDetail,  setShowBilanDetail] = useState(false);

  // Demandes heures supplémentaires
  const [otRequests,       setOtRequests]      = useState<OvertimeRequestRecord[]>([]);
  const [showOtForm,       setShowOtForm]      = useState(false);
  const [otLoading,        setOtLoading]       = useState(false);
  const [otForm,           setOtForm]          = useState({ requestedDate: '', startTime: '', endTime: '', reason: '' });

  // Justification d'absence par congé
  const [justifyRecord,    setJustifyRecord]   = useState<AttendanceRecord | null>(null);
  const [justifyType,      setJustifyType]     = useState<string>('PAID');
  const [justifyReason,    setJustifyReason]   = useState<string>('');
  const [justifyLoading,   setJustifyLoading]  = useState(false);

  const session   = authBridge.getSession();
  const userName  = (session?.user as any)?.firstName || (session?.user as any)?.name || 'Employé';

  // ── live clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── load ────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setNoEmployee(false);
      const month = new Date().toISOString().substring(0, 7);
      const [todayRes, histRes, summaryRes, otRes] = await Promise.all([
        apiClient.get('/hr/attendance/my/today'),
        apiClient.get('/hr/attendance/my'),
        apiClient.get('/hr/attendance/my/overtime-summary').catch(() => null),
        apiClient.get(`/hr/overtime/my?month=${month}`).catch(() => []),
      ]);
      setToday(todayRes.attendance);
      setSettings(todayRes.settings);
      setHistory(Array.isArray(histRes) ? histRes : []);
      if (summaryRes) setOvertimeSummary(summaryRes as OvertimeSummary);
      setOtRequests(Array.isArray(otRes) ? otRes : []);
    } catch (err: any) {
      if (err.error === 'NoEmployeeLinked' || err.status === 400) {
        setNoEmployee(true);
      } else {
        showToast(err.message || 'Erreur de chargement', false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOtSubmit = async () => {
    if (!otForm.requestedDate) { showToast('Sélectionnez une date', false); return; }
    if (!otForm.reason.trim()) { showToast('La raison est obligatoire', false); return; }
    setOtLoading(true);
    try {
      await apiClient.post('/hr/overtime', otForm);
      showToast('Demande envoyée avec succès', true);
      setShowOtForm(false);
      setOtForm({ requestedDate: '', startTime: '', endTime: '', reason: '' });
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l\'envoi', false);
    } finally {
      setOtLoading(false);
    }
  };

  const handleJustifyAbsence = async () => {
    if (!justifyRecord) return;
    setJustifyLoading(true);
    try {
      await apiClient.post('/hr/leaves/my/justify-absence', {
        type:   justifyType,
        date:   justifyRecord.date,
        reason: justifyReason.trim() || undefined,
      });
      showToast('Demande de justification envoyée — en attente d\'approbation', true);
      setJustifyRecord(null);
      setJustifyReason('');
      setJustifyType('PAID');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l\'envoi', false);
    } finally {
      setJustifyLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // Le dépointage automatique est géré côté serveur (cron toutes les minutes).
  // On rafraîchit les données toutes les 2 minutes pour refléter un éventuel auto-dépointage.
  useEffect(() => {
    const id = setInterval(() => { loadData(); }, 120_000);
    return () => clearInterval(id);
  }, [loadData]);

  // ── toast ───────────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── actions ─────────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/attendance/clock-in', {});
      await loadData();
      showToast('Arrivée enregistrée', true);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du pointage', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/attendance/clock-out', {});
      await loadData();
      showToast('Départ enregistré', true);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du dépointage', false);
    } finally {
      setActionLoading(false);
    }
  };

  // ── helpers ─────────────────────────────────────────────────────────────────
  const timeStr  = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const GreetIcon= hour < 12 ? Sun : hour < 18 ? Coffee : Moon;

  const lateMinutes = today?.meta?.lateMinutes ?? 0;
  const isLate      = lateMinutes > 0;

  // ── Vérification plage horaire ──────────────────────────────────────────────
  const workHoursStatus = (() => {
    if (!settings) return 'ok';
    const [sh, sm] = settings.workStartTime.split(':').map(Number);
    const [eh, em] = settings.workEndTime.split(':').map(Number);
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (currentMin < sh * 60 + sm) return 'before';
    if (currentMin > eh * 60 + em) return 'after';
    return 'ok';
  })();
  const outsideWorkHours = workHoursStatus !== 'ok';

  const workingMinutes = (() => {
    if (!today?.clockIn) return 0;
    const from = new Date(today.clockIn).getTime();
    const to   = today.clockOut ? new Date(today.clockOut).getTime() : now.getTime();
    return Math.floor((to - from) / 60000);
  })();
  const workH = Math.floor(workingMinutes / 60);
  const workM = workingMinutes % 60;

  const state: 'idle' | 'in' | 'done' =
    !today?.clockIn ? 'idle' : !today.clockOut ? 'in' : 'done';

  // ── helpers bilan ───────────────────────────────────────────────────────────
  const fmtMin = (min: number) => {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.abs(min) % 60;
    return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 max-w-2xl mx-auto">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
          >
            {toast.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modale justification absence ── */}
      <AnimatePresence>
        {justifyRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setJustifyRecord(null); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden"
            >
              {/* En-tête */}
              <div className="bg-indigo-600 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Umbrella size={18} className="text-indigo-200" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Justifier une absence</span>
                </div>
                <button
                  onClick={() => setJustifyRecord(null)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>

              {/* Corps */}
              <div className="p-6 space-y-5">
                {/* Date de l'absence */}
                <div className="bg-rose-50 border border-rose-100 rounded-2xl px-5 py-4">
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Absence concernée</p>
                  <p className="text-sm font-black text-rose-700">
                    {new Date(justifyRecord.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>

                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                  Cette absence sera convertie en demande de congé. Un jour sera déduit de votre solde si approuvé — et la retenue salariale n'aura pas lieu.
                </p>

                {/* Type de congé */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Type de congé à imputer <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'PAID',      label: 'Congé payé' },
                      { value: 'ANNUAL',    label: 'Congé annuel' },
                      { value: 'SICK',      label: 'Maladie' },
                      { value: 'UNPAID',    label: 'Sans solde' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setJustifyType(opt.value)}
                        className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${
                          justifyType === opt.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motif optionnel */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Motif (optionnel)</label>
                  <textarea
                    value={justifyReason}
                    onChange={e => setJustifyReason(e.target.value)}
                    rows={2}
                    placeholder="Ex : rendez-vous médical, urgence familiale…"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleJustifyAbsence}
                    disabled={justifyLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {justifyLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Envoyer la demande
                  </button>
                  <button
                    onClick={() => setJustifyRecord(null)}
                    className="px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <Clock className="text-indigo-600" size={26} /> Pointage
          </h1>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em] mt-0.5">
            <GreetIcon size={11} className="inline mr-1" /> {greeting}, {userName}
          </p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Chargement…</p>
        </div>
      ) : noEmployee ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">Aucun profil employé lié</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">
              Votre compte n'est pas encore associé à une fiche employée. Contactez votre administrateur RH pour lier votre profil.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Horloge live ── */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-center shadow-2xl">
            <p className="text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums">{timeStr}</p>
            <p className="mt-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] capitalize">{dateStr}</p>
            {settings && (
              <div className="mt-4 flex items-center justify-center gap-6">
                <span className="flex items-center gap-1.5 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                  <LogIn size={11} /> Début {settings.workStartTime}
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                  <LogOut size={11} /> Fin {settings.workEndTime}
                </span>
                {settings.deductionEnabled && (
                  <span className="flex items-center gap-1.5 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                    <Zap size={11} /> Déductions actives
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Carte action principale ── */}
          <div className={`rounded-[2.5rem] border shadow-md overflow-hidden transition-all duration-300 ${
            state === 'idle' ? 'bg-white border-slate-100'
            : state === 'in' ? 'bg-white border-indigo-100'
            : 'bg-white border-emerald-100'
          }`}>
            {/* Status header */}
            <div className={`px-8 py-5 ${
              state === 'idle' ? 'bg-slate-50'
              : state === 'in' ? 'bg-indigo-600'
              : 'bg-emerald-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {state === 'idle' && <><Clock size={20} className="text-slate-400" /><span className="font-black text-slate-500 text-xs uppercase tracking-widest">Non pointé</span></>}
                  {state === 'in'   && <><LogIn size={20} className="text-white" /><span className="font-black text-white text-xs uppercase tracking-widest">En cours de journée</span></>}
                  {state === 'done' && <><CheckCircle2 size={20} className="text-white" /><span className="font-black text-white text-xs uppercase tracking-widest">Journée terminée</span></>}
                </div>
                {today?.status && (
                  <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border ${STATUS_LABELS[today.status]?.color || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {STATUS_LABELS[today.status]?.label || today.status}
                  </span>
                )}
              </div>
            </div>

            {/* Info + action */}
            <div className="p-8 space-y-6">
              {/* Temps de travail */}
              {state !== 'idle' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrivée</p>
                    <p className="text-xl font-black text-slate-900">{fmt(today?.clockIn ?? null)}</p>
                    {isLate && (
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">
                        +{lateMinutes} min retard
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {state === 'done' ? 'Départ' : 'Temps écoulé'}
                    </p>
                    {state === 'done'
                      ? <p className="text-xl font-black text-slate-900">{fmt(today?.clockOut ?? null)}</p>
                      : <p className="text-xl font-black text-indigo-600 tabular-nums">{workH}h{String(workM).padStart(2,'0')}</p>
                    }
                    {state === 'done' && (today?.overtimeMinutes ?? 0) > 0 && (
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                        +{Math.floor((today?.overtimeMinutes ?? 0) / 60)}h{String((today?.overtimeMinutes ?? 0) % 60).padStart(2,'0')} supp.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Durée totale si done */}
              {state === 'done' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Timer size={18} className="text-emerald-600" />
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Durée totale</span>
                  </div>
                  <span className="text-lg font-black text-emerald-700 tabular-nums">
                    {workH}h{String(workM).padStart(2,'0')}
                  </span>
                </div>
              )}

              {/* Auto-clockout info */}
              {today?.meta?.autoClockout && (
                <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <Zap size={14} className="text-indigo-500 shrink-0" />
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    Dépointage automatique à {settings?.workEndTime}
                  </p>
                </div>
              )}

              {/* Message hors heures de travail */}
              {outsideWorkHours && state !== 'done' && settings && (
                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertCircle size={16} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                      {workHoursStatus === 'before'
                        ? `Pointage disponible à partir de ${settings.workStartTime}`
                        : `Heures de travail terminées à ${settings.workEndTime}`}
                    </p>
                    <p className="text-[9px] text-amber-600 mt-0.5">
                      Plage autorisée : {settings.workStartTime} – {settings.workEndTime}
                    </p>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              {state === 'idle' && (
                <button
                  onClick={handleClockIn}
                  disabled={actionLoading || outsideWorkHours}
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                  Pointer l'Arrivée
                </button>
              )}

              {state === 'in' && (
                <button
                  onClick={handleClockOut}
                  disabled={actionLoading || outsideWorkHours}
                  className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                  Pointer le Départ
                </button>
              )}

              {state === 'done' && (
                <div className="flex items-center justify-center gap-3 py-3 text-emerald-600">
                  <CheckCircle2 size={20} />
                  <span className="font-black text-xs uppercase tracking-widest">Journée complète enregistrée</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Historique ── */}
          {history.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <History size={15} className="text-slate-400" />
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historique récent</h2>
              </div>
              <div className="space-y-2">
                {history.slice(0, 7).map(rec => {
                  const s     = STATUS_LABELS[rec.status] ?? { label: rec.status, color: 'bg-slate-50 text-slate-500 border-slate-100' };
                  const wkMin = rec.clockIn && rec.clockOut
                    ? Math.floor((new Date(rec.clockOut).getTime() - new Date(rec.clockIn).getTime()) / 60000) : 0;
                  return (
                    <div key={rec.id} className={`flex items-center justify-between bg-white border rounded-2xl px-5 py-4 shadow-sm ${rec.status === 'ABSENT' ? 'border-rose-100' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rec.status === 'ABSENT' ? 'bg-rose-50' : 'bg-slate-50'}`}>
                          <Calendar size={16} className={rec.status === 'ABSENT' ? 'text-rose-400' : 'text-slate-400'} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{fmtDate(rec.date)}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {fmt(rec.clockIn)} — {fmt(rec.clockOut)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {wkMin > 0 && (
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest tabular-nums">
                            {Math.floor(wkMin/60)}h{String(wkMin%60).padStart(2,'0')}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${s.color}`}>
                          {s.label}
                        </span>
                        {rec.status === 'ABSENT' && (
                          <button
                            onClick={() => { setJustifyRecord(rec); setJustifyType('PAID'); setJustifyReason(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest border border-indigo-200 transition-all"
                            title="Justifier cette absence par un congé"
                          >
                            <Umbrella size={10} />
                            Justifier
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats mensuelles ── */}
          {history.length > 0 && (() => {
            const month  = new Date().toISOString().substring(0, 7);
            const month_records = history.filter(r => r.date.startsWith(month));
            const presents = month_records.filter(r => ['PRESENT','LATE'].includes(r.status)).length;
            const lates    = month_records.filter(r => r.status === 'LATE').length;
            const absents  = month_records.filter(r => r.status === 'ABSENT').length;
            return (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Présences', value: presents, color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Retards',   value: lates,    color: 'bg-amber-50  text-amber-600'   },
                  { label: 'Absences',  value: absents,  color: 'bg-rose-50   text-rose-600'    },
                ].map(stat => (
                  <div key={stat.label} className={`${stat.color} rounded-2xl p-4 text-center`}>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">{stat.label}</p>
                    <p className="text-[8px] opacity-60 uppercase tracking-widest">ce mois</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Bilan Heures Supp / Absences / Compensation ── */}
          {overtimeSummary && (
            <div className="rounded-[2rem] border border-slate-100 bg-white shadow-md overflow-hidden">
              {/* En-tête bilan */}
              <button
                onClick={() => setShowBilanDetail(v => !v)}
                className="w-full px-6 py-5 flex items-center justify-between bg-slate-900 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Scale size={18} className="text-indigo-400" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">
                    Bilan Heures Supp. & Absences
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {overtimeSummary.remainingOvertimeMinutes > 0 && (
                    <span className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                      +{fmtMin(overtimeSummary.remainingOvertimeMinutes)} crédit
                    </span>
                  )}
                  {overtimeSummary.remainingDeficitMinutes > 0 && (
                    <span className="px-3 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                      -{fmtMin(overtimeSummary.remainingDeficitMinutes)} déficit
                    </span>
                  )}
                  {overtimeSummary.remainingOvertimeMinutes === 0 && overtimeSummary.remainingDeficitMinutes === 0 && (
                    <span className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                      Équilibré
                    </span>
                  )}
                  {showBilanDetail ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Barre de progression compensation */}
              <div className="px-6 pt-4">
                {(() => {
                  const total = Math.max(overtimeSummary.totalOvertimeMinutes + overtimeSummary.totalDeficitMinutes, 1);
                  const overtimePct = Math.round((overtimeSummary.totalOvertimeMinutes / total) * 100);
                  const deficitPct  = Math.round((overtimeSummary.totalDeficitMinutes  / total) * 100);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                        <span className="text-emerald-600 flex items-center gap-1"><TrendingUp size={10}/> Heures supp.</span>
                        <span className="text-rose-500 flex items-center gap-1"><TrendingDown size={10}/> Absences + retards</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${overtimePct}%` }}
                        />
                        <div
                          className="h-full bg-rose-400 transition-all duration-700"
                          style={{ width: `${deficitPct}%` }}
                        />
                      </div>
                      {overtimeSummary.compensatedMinutes > 0 && (
                        <p className="text-center text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                          ✓ {fmtMin(overtimeSummary.compensatedMinutes)} d'absences compensées par les heures supp.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Détail dépliable */}
              {showBilanDetail && (
                <div className="px-6 py-4 space-y-3 border-t border-slate-100 mt-4">
                  {[
                    {
                      label: 'Heures supplémentaires effectuées',
                      value: overtimeSummary.totalOvertimeMinutes,
                      color: 'text-emerald-600',
                      bg: 'bg-emerald-50',
                      icon: TrendingUp
                    },
                    {
                      label: 'Minutes d\'absence (jours non pointés)',
                      value: overtimeSummary.totalAbsenceMinutes,
                      color: 'text-rose-500',
                      bg: 'bg-rose-50',
                      icon: TrendingDown
                    },
                    {
                      label: 'Minutes de retard',
                      value: overtimeSummary.totalLateMinutes,
                      color: 'text-amber-500',
                      bg: 'bg-amber-50',
                      icon: Clock
                    },
                    {
                      label: 'Compensation par heures supp.',
                      value: overtimeSummary.compensatedMinutes,
                      color: 'text-indigo-600',
                      bg: 'bg-indigo-50',
                      icon: Scale
                    },
                  ].map(row => (
                    <div key={row.label} className={`${row.bg} rounded-xl px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <row.icon size={13} className={row.color} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${row.color}`}>{row.label}</span>
                      </div>
                      <span className={`text-sm font-black tabular-nums ${row.color}`}>
                        {row.value > 0 ? fmtMin(row.value) : '—'}
                      </span>
                    </div>
                  ))}

                  {/* Solde final */}
                  <div className={`rounded-xl px-4 py-4 flex items-center justify-between border-2 ${
                    overtimeSummary.remainingDeficitMinutes > 0
                      ? 'bg-rose-50 border-rose-200'
                      : overtimeSummary.remainingOvertimeMinutes > 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      Solde net du mois
                    </span>
                    <div className="text-right">
                      {overtimeSummary.remainingDeficitMinutes > 0 && (
                        <p className="text-sm font-black text-rose-600 tabular-nums">
                          -{fmtMin(overtimeSummary.remainingDeficitMinutes)} non compensé
                        </p>
                      )}
                      {overtimeSummary.remainingOvertimeMinutes > 0 && (
                        <p className="text-sm font-black text-emerald-600 tabular-nums">
                          +{fmtMin(overtimeSummary.remainingOvertimeMinutes)} crédit heures supp.
                        </p>
                      )}
                      {overtimeSummary.remainingDeficitMinutes === 0 && overtimeSummary.remainingOvertimeMinutes === 0 && (
                        <p className="text-sm font-black text-slate-600">Équilibré</p>
                      )}
                    </div>
                  </div>

                  <p className="text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                    Mois de {new Date(overtimeSummary.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* ── Demandes Heures Supplémentaires ── */}
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-md overflow-hidden">
            <div className="px-6 py-5 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-indigo-200" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Demandes Heures Supplémentaires</span>
              </div>
              <button
                onClick={() => setShowOtForm(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={13} /> Nouvelle demande
              </button>
            </div>

            {/* Formulaire */}
            {showOtForm && (
              <div className="p-6 border-b border-slate-100 bg-indigo-50/30 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nouvelle demande d'heures supplémentaires</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date prévue <span className="text-red-500">*</span></label>
                    <input type="date" value={otForm.requestedDate}
                      onChange={e => setOtForm(f => ({ ...f, requestedDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Heure début</label>
                    <input type="time" value={otForm.startTime}
                      onChange={e => setOtForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Heure fin</label>
                    <input type="time" value={otForm.endTime}
                      onChange={e => setOtForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Raison / Justification <span className="text-red-500">*</span></label>
                    <textarea value={otForm.reason}
                      onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))}
                      rows={3}
                      placeholder="Décrivez la raison de la demande d'heures supplémentaires…"
                      className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleOtSubmit} disabled={otLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {otLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Envoyer la demande
                  </button>
                  <button onClick={() => setShowOtForm(false)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste des demandes */}
            <div className="p-4 space-y-2">
              {otRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText size={28} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-xs font-medium">Aucune demande ce mois-ci</p>
                </div>
              ) : (
                otRequests.map(req => {
                  const cfg = OT_STATUS[req.status] ?? OT_STATUS.PENDING;
                  return (
                    <div key={req.id} className="flex items-start justify-between bg-slate-50 rounded-2xl px-4 py-3 gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                          <Calendar size={14} className="text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                            {new Date(req.requestedDate + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {req.startTime && <span className="font-medium text-slate-500 ml-2 normal-case">{req.startTime}–{req.endTime}</span>}
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium mt-0.5 truncate">{req.reason}</p>
                          {req.reviewNote && req.status === 'REJECTED' && (
                            <p className="text-[9px] text-rose-500 font-medium mt-0.5 italic">Motif refus: {req.reviewNote}</p>
                          )}
                          {req.status === 'COMPLETED' && req.actualMinutes > 0 && (
                            <p className="text-[9px] text-emerald-600 font-black mt-0.5">
                              ✓ {Math.floor(req.actualMinutes/60)}h{req.actualMinutes%60>0?String(req.actualMinutes%60).padStart(2,'0'):''} effectuées
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border ${cfg.color}`}>
                          {req.status === 'PENDING' && <Clock size={9}/>}
                          {req.status === 'APPROVED' && <CheckCircle2 size={9}/>}
                          {req.status === 'REJECTED' && <XCircle size={9}/>}
                          {req.status === 'COMPLETED' && <Zap size={9}/>}
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeePointage;
