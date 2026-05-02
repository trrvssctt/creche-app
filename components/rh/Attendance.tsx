
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Filter,
  Search,
  Clock3,
  Sunrise,
  Sunset,
  Timer,
  BarChart3,
  ArrowLeft,
  Edit3,
  Save,
  X,
  TrendingUp,
  Scale,
  LogIn,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import { api, apiClient } from '../../services/api';

interface AttendanceProps {
  onNavigate?: (tab: string, meta?: any) => void;
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' | 'REMOTE';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatus;
  overtimeMinutes?: number;
  meta?: { lateMinutes?: number; expectedStart?: string };
  source?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  photoUrl?: string;
  status: string;
  departmentInfo?: { name: string };
}

interface DayRecord {
  employee: Employee;
  attendance: AttendanceRecord | null;
}

interface PayrollSettings {
  workStartTime: string;
  workEndTime: string;
  workingDaysPerMonth: number;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'En retard',
  HALF_DAY: 'Mi-journée',
  HOLIDAY: 'Congé',
  REMOTE: 'Télétravail'
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
  LATE: 'bg-amber-100 text-amber-700 border-amber-200',
  HALF_DAY: 'bg-blue-100 text-blue-700 border-blue-200',
  HOLIDAY: 'bg-purple-100 text-purple-700 border-purple-200',
  REMOTE: 'bg-cyan-100 text-cyan-700 border-cyan-200'
};

const STATUS_ICONS: Record<AttendanceStatus, React.ReactNode> = {
  PRESENT: <CheckCircle2 size={12} />,
  ABSENT: <XCircle size={12} />,
  LATE: <AlertTriangle size={12} />,
  HALF_DAY: <Clock3 size={12} />,
  HOLIDAY: <Calendar size={12} />,
  REMOTE: <Users size={12} />
};

const toDateOnly = (dateStr: string): string => dateStr?.substring(0, 10) ?? '';

const fmtTime = (isoStr?: string): string => {
  if (!isoStr) return '--:--';
  try {
    return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr.substring(11, 16) || '--:--';
  }
};

const calcWorkMinutes = (clockIn?: string, clockOut?: string): number => {
  if (!clockIn || !clockOut) return 0;
  try {
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    return Math.max(0, Math.round(diff / 60000));
  } catch { return 0; }
};

const fmtDuration = (minutes: number): string => {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};

const Attendance: React.FC<AttendanceProps> = ({ onNavigate }) => {
  const today = new Date().toISOString().substring(0, 10);

  const [activeView, setActiveView] = useState<'daily' | 'history' | 'stats'>('daily');
  const [selectedDate, setSelectedDate] = useState(today);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'ALL'>('ALL');
  const [editingRecord, setEditingRecord] = useState<{ empId: string; record: Partial<AttendanceRecord> } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // History filters
  const [historyMonth, setHistoryMonth] = useState(today.substring(0, 7));
  const [historyEmployee, setHistoryEmployee] = useState('');
  const [historyStatus, setHistoryStatus] = useState<AttendanceStatus | 'ALL'>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Stats filters
  const [statsMonth, setStatsMonth] = useState(today.substring(0, 7));
  const [statsEmployee, setStatsEmployee] = useState('');

  const showNotif = (msg: string) => {
    setAlertMsg(msg);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [empsData, attendData, settingsData] = await Promise.all([
        api.get('/hr/employees'),
        api.get('/hr/attendance'),
        api.get('/hr/payroll-settings').catch(() => null)
      ]);
      const emps: Employee[] = (empsData?.rows || empsData || []).filter((e: Employee) => e.status === 'ACTIVE');
      const atts: AttendanceRecord[] = attendData || [];
      setEmployees(emps);
      setAllAttendances(atts);
      if (settingsData) setPayrollSettings(settingsData as PayrollSettings);
    } catch (err) {
      console.error('Erreur chargement pointage:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Rebuild day records whenever date or data changes
  useEffect(() => {
    const records: DayRecord[] = employees.map(emp => ({
      employee: emp,
      attendance: allAttendances.find(a => a.employeeId === emp.id && toDateOnly(a.date) === selectedDate) ?? null
    }));
    setDayRecords(records);
  }, [employees, allAttendances, selectedDate]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  // Quick-mark a status for one employee on the selected date
  const handleQuickMark = async (empId: string, status: AttendanceStatus) => {
    const existing = allAttendances.find(a => a.employeeId === empId && toDateOnly(a.date) === selectedDate);
    setSaving(empId);
    try {
      if (existing) {
        const updated = await api.put(`/hr/attendance/${existing.id}`, { status });
        setAllAttendances(prev => prev.map(a => a.id === existing.id ? { ...a, ...updated } : a));
      } else {
        const created = await api.post('/hr/attendance', {
          employeeId: empId,
          date: selectedDate,
          status,
          source: 'manual'
        });
        setAllAttendances(prev => [...prev, created]);
      }
    } catch (err: any) {
      showNotif(err.message || 'Erreur lors du pointage');
    } finally {
      setSaving(null);
    }
  };

  // Open detail edit modal
  const openEdit = (empId: string, current: AttendanceRecord | null) => {
    setEditingRecord({
      empId,
      record: current
        ? { ...current }
        : {
            employeeId: empId,
            date: selectedDate,
            status: 'PRESENT',
            clockIn: `${selectedDate}T08:00`,
            clockOut: `${selectedDate}T17:00`,
            overtimeMinutes: 0
          }
    });
    setIsEditModalOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!editingRecord) return;
    const { empId, record } = editingRecord;
    const existing = allAttendances.find(a => a.employeeId === empId && toDateOnly(a.date) === selectedDate);
    setSaving(empId);
    try {
      if (existing) {
        const updated = await api.put(`/hr/attendance/${existing.id}`, record);
        setAllAttendances(prev => prev.map(a => a.id === existing.id ? { ...a, ...updated } : a));
      } else {
        const created = await api.post('/hr/attendance', { ...record, employeeId: empId, date: selectedDate, source: 'manual' });
        setAllAttendances(prev => [...prev, created]);
      }
      setIsEditModalOpen(false);
      showNotif('Pointage enregistré');
    } catch (err: any) {
      showNotif(err.message || 'Erreur');
    } finally {
      setSaving(null);
    }
  };

  // Admin clock-in / clock-out pour un employé
  const handleAdminClock = async (empId: string, direction: 'in' | 'out') => {
    // Validation plage horaire pour la date du jour uniquement
    if (selectedDate === today && payrollSettings) {
      const now = new Date();
      const [sh, sm] = (payrollSettings.workStartTime || '08:00').split(':').map(Number);
      const [eh, em] = (payrollSettings.workEndTime   || '17:00').split(':').map(Number);
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (currentMin < sh * 60 + sm || currentMin > eh * 60 + em) {
        showNotif(`Pointage non autorisé en dehors des heures de travail (${payrollSettings.workStartTime} – ${payrollSettings.workEndTime})`);
        return;
      }
    }
    setSaving(empId);
    try {
      const endpoint = direction === 'in' ? '/hr/attendance/admin/clock-in' : '/hr/attendance/admin/clock-out';
      const result = await apiClient.post(endpoint, { employeeId: empId, date: selectedDate });
      setAllAttendances(prev => {
        const existing = prev.find(a => a.id === result.id);
        return existing ? prev.map(a => a.id === result.id ? { ...a, ...result } : a) : [...prev, result];
      });
      showNotif(`${direction === 'in' ? 'Arrivée' : 'Départ'} pointé pour ${employees.find(e => e.id === empId)?.firstName || 'l\'employé'}`);
    } catch (err: any) {
      showNotif(err.message || 'Erreur lors du pointage');
    } finally {
      setSaving(null);
    }
  };

  // Bulk mark all employees for today
  const handleMarkAllPresent = async () => {
    const unmarked = dayRecords.filter(r => !r.attendance);
    if (unmarked.length === 0) { showNotif('Tous les employés sont déjà pointés'); return; }
    setLoading(true);
    try {
      const created = await Promise.all(unmarked.map(r =>
        api.post('/hr/attendance', { employeeId: r.employee.id, date: selectedDate, status: 'PRESENT', source: 'manual' })
      ));
      setAllAttendances(prev => [...prev, ...created]);
      showNotif(`${created.length} employé(s) marqué(s) présent`);
    } catch (err: any) {
      showNotif(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  // Computed stats for selected date
  const stats = {
    present: dayRecords.filter(r => r.attendance?.status === 'PRESENT').length,
    absent: dayRecords.filter(r => !r.attendance || r.attendance.status === 'ABSENT').length,
    late: dayRecords.filter(r => r.attendance?.status === 'LATE' || (r.attendance?.meta?.lateMinutes ?? 0) > 0).length,
    halfDay: dayRecords.filter(r => r.attendance?.status === 'HALF_DAY').length,
    holiday: dayRecords.filter(r => r.attendance?.status === 'HOLIDAY').length,
    remote: dayRecords.filter(r => r.attendance?.status === 'REMOTE').length,
    total: employees.length
  };

  const filteredRecords = dayRecords.filter(r => {
    const matchSearch = !searchTerm
      || `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      || r.employee.position?.toLowerCase().includes(searchTerm.toLowerCase());
    const effectiveStatus: AttendanceStatus = r.attendance?.status as AttendanceStatus || 'ABSENT';
    const matchStatus = filterStatus === 'ALL' || effectiveStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  // History: all records for the month (optionally filtered by employee/status/search)
  const historyRecords = allAttendances.filter(a => {
    const matchMonth = a.date && toDateOnly(a.date).startsWith(historyMonth);
    const matchEmp = !historyEmployee || a.employeeId === historyEmployee;
    const matchStatus = historyStatus === 'ALL' || a.status === historyStatus;
    const emp = employees.find(e => e.id === a.employeeId);
    const matchSearch = !historySearch ||
      `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.toLowerCase().includes(historySearch.toLowerCase());
    return matchMonth && matchEmp && matchStatus && matchSearch;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Stats: per-employee monthly summary (filterable)
  const statsMonth2 = statsMonth;
  const statsEmployees = statsEmployee
    ? employees.filter(e => e.id === statsEmployee)
    : employees;

  const buildEmpStats = (emp: Employee) => {
    const atts = allAttendances.filter(a => a.employeeId === emp.id && toDateOnly(a.date).startsWith(statsMonth2));
    const presentDays  = atts.filter(a => ['PRESENT', 'LATE', 'REMOTE', 'HALF_DAY'].includes(a.status)).length;
    const explicitAbsent = atts.filter(a => a.status === 'ABSENT').length;
    const holidayDays  = atts.filter(a => a.status === 'HOLIDAY').length;
    const lateDays     = atts.filter(a => (a.meta?.lateMinutes ?? 0) > 0).length;
    const totalLateMin = atts.reduce((s, a) => s + (a.meta?.lateMinutes ?? 0), 0);
    const totalOTMin   = atts.reduce((s, a) => s + (a.overtimeMinutes ?? 0), 0);
    const totalWorkMin = atts.reduce((s, a) => s + calcWorkMinutes(a.clockIn, a.clockOut), 0);

    // ── Moyenne arrivée / départ (vraie moyenne arithmétique en minutes) ──────
    const toMins = (iso?: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes();
    };
    const fmtMins = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const inMins  = atts.map(a => toMins(a.clockIn)).filter((m): m is number => m !== null);
    const outMins = atts.map(a => toMins(a.clockOut)).filter((m): m is number => m !== null);
    const avgArrival   = inMins.length  > 0 ? fmtMins(Math.round(inMins.reduce((s, m)  => s + m,  0) / inMins.length))  : '—';
    const avgDeparture = outMins.length > 0 ? fmtMins(Math.round(outMins.reduce((s, m) => s + m, 0) / outMins.length)) : '—';

    // ── Absences implicites : jours ouvrés passés sans aucun enregistrement ──
    const [y, mo] = statsMonth2.split('-').map(Number);
    const isCurrentMonth = statsMonth2 === today.substring(0, 7);
    const monthStart = new Date(y, mo - 1, 1);
    // Pour le mois courant on s'arrête à hier (aujourd'hui n'est pas terminé).
    // Pour un mois passé, on prend jusqu'au 1er du mois suivant (exclusif) pour inclure le dernier jour.
    const periodEnd = isCurrentMonth
      ? new Date(today + 'T00:00:00')
      : new Date(y, mo, 1); // 1er du mois suivant (exclusif)

    const recordedDates = new Set(atts.map(a => toDateOnly(a.date)));
    let implicitAbsent = 0;
    let workdaysInPeriod = 0;
    for (let d = new Date(monthStart); d < periodEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // ignorer samedi/dimanche
      workdaysInPeriod++;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!recordedDates.has(ds)) implicitAbsent++;
    }
    const absentDays    = explicitAbsent + implicitAbsent;
    const workdaysInMonth = Math.max(workdaysInPeriod, 1);

    const workStart = payrollSettings?.workStartTime || '08:00';
    const workEnd   = payrollSettings?.workEndTime   || '17:00';
    const [sh, sm]  = workStart.split(':').map(Number);
    const [eh, em]  = workEnd.split(':').map(Number);
    const workDayMinutes = (eh * 60 + em) - (sh * 60 + sm);

    const rate = Math.min(100, workdaysInMonth > 0 ? Math.round(presentDays / workdaysInMonth * 100) : 0);
    const totalDeficit = absentDays * workDayMinutes + totalLateMin;
    const compensated  = Math.min(totalOTMin, totalDeficit);
    const remainDeficit = totalDeficit - compensated;
    const remainOT      = totalOTMin   - compensated;

    return {
      atts, presentDays, absentDays, explicitAbsent, implicitAbsent,
      holidayDays, lateDays, totalLateMin, totalOTMin, totalWorkMin,
      avgArrival, avgDeparture, rate, totalDeficit, compensated,
      remainDeficit, remainOT, workdaysInMonth
    };
  };

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const dateDisplay = new Date(selectedDate + 'T12:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Alert */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 border border-slate-700"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            {alertMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onNavigate && (
              <button
                onClick={() => onNavigate('rh')}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Clock size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Pointage & Présences</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em] mt-0.5">Gestion des présences · Absences · Retards</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{employees.length} actifs</span>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
          {[
            { id: 'daily', label: 'Journalier', icon: <Calendar size={14} />, color: 'from-indigo-500 to-violet-600' },
            { id: 'history', label: 'Historique', icon: <Clock size={14} />, color: 'from-slate-700 to-slate-900' },
            { id: 'stats', label: 'Statistiques', icon: <BarChart3 size={14} />, color: 'from-emerald-500 to-teal-600' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeView === tab.id
                  ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ─── DAILY VIEW ─── */}
        {activeView === 'daily' && (
          <div className="space-y-6">
            {/* Date navigation */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
              <div className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => shiftDate(-1)}
                      className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center">
                        <Calendar size={16} className="text-indigo-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-900 capitalize leading-tight">{dateDisplay}</h2>
                        {selectedDate === today && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            ● Aujourd'hui
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => shiftDate(1)}
                      disabled={selectedDate >= today}
                      className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      max={today}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleMarkAllPresent}
                    disabled={loading}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-100"
                  >
                    <CheckCircle2 size={14} /> Tous présents
                  </button>
                </div>

                {/* Stats summary */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
                  {[
                    { label: 'Présents', value: stats.present, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
                    { label: 'Absents', value: stats.absent, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} className="text-rose-500" /> },
                    { label: 'Retards', value: stats.late, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', icon: <AlertTriangle size={14} className="text-amber-500" /> },
                    { label: 'Mi-temps', value: stats.halfDay, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: <Clock3 size={14} className="text-blue-500" /> },
                    { label: 'Congés', value: stats.holiday, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-100', icon: <Calendar size={14} className="text-purple-500" /> },
                    { label: 'Télétravail', value: stats.remote, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-100', icon: <Users size={14} className="text-cyan-500" /> }
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4 text-center space-y-1`}>
                      <div className="flex justify-center">{s.icon}</div>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un employé…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'REMOTE'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                      filterStatus === s
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {s === 'ALL' ? 'Tous' : STATUS_LABELS[s as AttendanceStatus]}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee List */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <RefreshCw size={24} className="animate-spin mr-3" />
                  <span className="font-medium">Chargement…</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Users size={40} className="mb-4 text-slate-300" />
                  <p className="font-bold text-slate-500">Aucun employé trouvé</p>
                  <p className="text-sm mt-1">Ajustez les filtres ou ajoutez des employés</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-50/50 border-b border-slate-100">
                      <th className="text-left py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                      <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                      <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Sunrise size={10} className="text-amber-400" /> Arrivée</span>
                      </th>
                      <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Sunset size={10} className="text-indigo-400" /> Départ</span>
                      </th>
                      <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Timer size={10} className="text-amber-400" /> Retard</span>
                      </th>
                      <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><TrendingUp size={10} className="text-emerald-400" /> Heures supp.</span>
                      </th>
                      <th className="text-right py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredRecords.map(({ employee, attendance }) => {
                        const effectiveStatus: AttendanceStatus = attendance?.status as AttendanceStatus || 'ABSENT';
                        const lateMin = attendance?.meta?.lateMinutes ?? 0;
                        const isSavingThis = saving === employee.id;
                        const statusBorderColor: Record<AttendanceStatus, string> = {
                          PRESENT: 'border-l-emerald-400', ABSENT: 'border-l-rose-400',
                          LATE: 'border-l-amber-400', HALF_DAY: 'border-l-blue-400',
                          HOLIDAY: 'border-l-purple-400', REMOTE: 'border-l-cyan-400'
                        };

                        return (
                          <motion.tr
                            key={employee.id}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors border-l-2 ${statusBorderColor[effectiveStatus]}`}
                          >
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ${
                                  effectiveStatus === 'PRESENT' ? 'ring-emerald-200 bg-emerald-50' :
                                  effectiveStatus === 'ABSENT'  ? 'ring-rose-200 bg-rose-50' :
                                  effectiveStatus === 'LATE'    ? 'ring-amber-200 bg-amber-50' :
                                  'ring-slate-100 bg-slate-100'
                                }`}>
                                  {employee.photoUrl ? (
                                    <img src={employee.photoUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-xs font-black text-slate-600">
                                      {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900">{employee.firstName} {employee.lastName}</p>
                                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                                    {employee.departmentInfo?.name || employee.position || '—'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[effectiveStatus]}`}>
                                {STATUS_ICONS[effectiveStatus]}
                                {STATUS_LABELS[effectiveStatus]}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`text-sm font-bold ${attendance?.clockIn ? 'text-slate-700' : 'text-slate-300'}`}>
                                {fmtTime(attendance?.clockIn)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`text-sm font-bold ${attendance?.clockOut ? 'text-slate-700' : 'text-slate-300'}`}>
                                {fmtTime(attendance?.clockOut)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              {lateMin > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                                  <AlertTriangle size={10} /> {lateMin} min
                                </span>
                              ) : (
                                <span className="text-slate-200 text-sm">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {(attendance?.overtimeMinutes ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                  <TrendingUp size={10} /> +{attendance!.overtimeMinutes} min
                                </span>
                              ) : (
                                <span className="text-slate-200 text-sm">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-6">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* Boutons pointer arrivée / départ admin (date du jour seulement) */}
                                {selectedDate === today && (
                                  <>
                                    <button
                                      onClick={() => handleAdminClock(employee.id, 'in')}
                                      disabled={isSavingThis || !!attendance?.clockIn}
                                      title="Pointer l'arrivée"
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                    >
                                      {isSavingThis ? <RefreshCw size={9} className="animate-spin" /> : <Sunrise size={9} />} IN
                                    </button>
                                    <button
                                      onClick={() => handleAdminClock(employee.id, 'out')}
                                      disabled={isSavingThis || !attendance?.clockIn || !!attendance?.clockOut}
                                      title="Pointer le départ"
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                    >
                                      {isSavingThis ? <RefreshCw size={9} className="animate-spin" /> : <Sunset size={9} />} OUT
                                    </button>
                                  </>
                                )}
                                {/* Quick status buttons */}
                                {(['PRESENT', 'ABSENT', 'LATE', 'HOLIDAY', 'REMOTE'] as AttendanceStatus[]).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleQuickMark(employee.id, s)}
                                    disabled={isSavingThis}
                                    title={STATUS_LABELS[s]}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] transition-all border ${
                                      effectiveStatus === s && attendance
                                        ? STATUS_COLORS[s] + ' shadow-sm scale-110'
                                        : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300 hover:scale-105'
                                    } disabled:opacity-50`}
                                  >
                                    {isSavingThis ? <RefreshCw size={9} className="animate-spin" /> : STATUS_ICONS[s]}
                                  </button>
                                ))}
                                {/* Detail edit */}
                                <button
                                  onClick={() => openEdit(employee.id, attendance)}
                                  className="w-7 h-7 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                                  title="Modifier le détail"
                                >
                                  <Edit3 size={11} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── HISTORY VIEW ─── */}
        {activeView === 'history' && (
          <div className="space-y-5">

            {/* Filtres */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-slate-700 to-slate-900" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-slate-300" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">Historique des Présences</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Recherche nom */}
                  <div className="relative md:col-span-1">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un employé…"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  {/* Mois */}
                  <div>
                    <input
                      type="month"
                      value={historyMonth}
                      onChange={e => setHistoryMonth(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  {/* Employé */}
                  <div>
                    <select
                      value={historyEmployee}
                      onChange={e => setHistoryEmployee(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Tous les employés</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                      ))}
                    </select>
                  </div>
                  {/* Statut */}
                  <div>
                    <select
                      value={historyStatus}
                      onChange={e => setHistoryStatus(e.target.value as AttendanceStatus | 'ALL')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="ALL">Tous les statuts</option>
                      {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtres rapides statut */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Filter size={12} className="text-slate-400 flex-shrink-0" />
                  {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'REMOTE'] as const).map(s => (
                    <button key={s} onClick={() => setHistoryStatus(s)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        historyStatus === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                      }`}>
                      {s === 'ALL' ? 'Tous' : STATUS_LABELS[s as AttendanceStatus]}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {historyRecords.length} ligne(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Résumé rapide */}
            {historyRecords.length > 0 && (() => {
              const totalWork = historyRecords.reduce((s, a) => s + calcWorkMinutes(a.clockIn, a.clockOut), 0);
              const totalLate = historyRecords.reduce((s, a) => s + (a.meta?.lateMinutes ?? 0), 0);
              const totalOT   = historyRecords.reduce((s, a) => s + (a.overtimeMinutes ?? 0), 0);
              const nbPresent = historyRecords.filter(a => ['PRESENT','LATE','REMOTE','HALF_DAY'].includes(a.status)).length;
              const nbAbsent  = historyRecords.filter(a => a.status === 'ABSENT').length;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'Jours présents',    value: nbPresent,              color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                    { label: 'Jours absents',     value: nbAbsent,               color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-100' },
                    { label: 'Heures travaillées',value: fmtDuration(totalWork), color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-100' },
                    { label: 'Total retards',     value: totalLate > 0 ? fmtDuration(totalLate) : '—', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
                    { label: 'Heures supp.',      value: totalOT   > 0 ? fmtDuration(totalOT)   : '—', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100' },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} border rounded-2xl p-4 text-center`}>
                      <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{c.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tableau */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              {historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Clock size={36} className="mb-3 text-slate-200" />
                  <p className="font-bold text-slate-500">Aucun enregistrement trouvé</p>
                  <p className="text-xs mt-1 text-slate-400">Modifiez les filtres pour voir plus de résultats</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <th className="text-left py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Sunrise size={9} className="text-amber-400" /> Arrivée</span>
                        </th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Sunset size={9} className="text-indigo-400" /> Départ</span>
                        </th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Clock3 size={9} className="text-teal-400" /> Durée</span>
                        </th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Timer size={9} className="text-amber-400" /> Retard</span>
                        </th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><TrendingUp size={9} className="text-emerald-400" /> H.Supp</span>
                        </th>
                        <th className="text-left py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.map(att => {
                        const emp = getEmployee(att.employeeId);
                        const status: AttendanceStatus = att.status as AttendanceStatus || 'ABSENT';
                        const duration = calcWorkMinutes(att.clockIn, att.clockOut);
                        const lateMin  = att.meta?.lateMinutes ?? 0;
                        const otMin    = att.overtimeMinutes ?? 0;
                        const borderColors: Record<AttendanceStatus, string> = {
                          PRESENT: 'border-l-emerald-400', ABSENT: 'border-l-rose-400',
                          LATE: 'border-l-amber-400', HALF_DAY: 'border-l-blue-400',
                          HOLIDAY: 'border-l-purple-400', REMOTE: 'border-l-cyan-400',
                        };
                        return (
                          <tr key={att.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors border-l-2 ${borderColors[status]}`}>
                            {/* Date */}
                            <td className="py-3.5 px-5">
                              <p className="text-sm font-black text-slate-900">
                                {new Date(toDateOnly(att.date) + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium">
                                {new Date(toDateOnly(att.date) + 'T12:00').toLocaleDateString('fr-FR', { year: 'numeric' })}
                              </p>
                            </td>
                            {/* Employé */}
                            <td className="py-3.5 px-4">
                              {emp ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-600 flex-shrink-0">
                                    {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-800">{emp.firstName} {emp.lastName}</p>
                                    <p className="text-[9px] text-slate-400 font-medium">{emp.position || '—'}</p>
                                  </div>
                                </div>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            {/* Statut */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[status]}`}>
                                {STATUS_ICONS[status]} {STATUS_LABELS[status]}
                              </span>
                            </td>
                            {/* Arrivée */}
                            <td className="py-3.5 px-4">
                              {att.clockIn ? (
                                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                  {fmtTime(att.clockIn)}
                                </span>
                              ) : <span className="text-slate-200 text-sm">—</span>}
                            </td>
                            {/* Départ */}
                            <td className="py-3.5 px-4">
                              {att.clockOut ? (
                                <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                  {fmtTime(att.clockOut)}
                                </span>
                              ) : <span className="text-slate-200 text-sm">—</span>}
                            </td>
                            {/* Durée */}
                            <td className="py-3.5 px-4">
                              {duration > 0 ? (
                                <span className="text-sm font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                                  {fmtDuration(duration)}
                                </span>
                              ) : <span className="text-slate-200 text-sm">—</span>}
                            </td>
                            {/* Retard */}
                            <td className="py-3.5 px-4">
                              {lateMin > 0 ? (
                                <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                  +{lateMin} min
                                </span>
                              ) : <span className="text-slate-200 text-sm">—</span>}
                            </td>
                            {/* H.Supp */}
                            <td className="py-3.5 px-4">
                              {otMin > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                  <TrendingUp size={9} /> +{otMin} min
                                </span>
                              ) : <span className="text-slate-200 text-sm">—</span>}
                            </td>
                            {/* Source */}
                            <td className="py-3.5 px-4">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                att.source === 'auto' || att.source === 'qr' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-400 bg-slate-50 border border-slate-100'
                              }`}>
                                {att.source || 'manuel'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── STATS VIEW ─── */}
        {activeView === 'stats' && (
          <div className="space-y-5">

            {/* Filtres mois + employé */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500" />
              <div className="p-5 flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <BarChart3 size={14} className="text-white" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">Présence Détaillée par Employé</h3>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Mois analysé</label>
                    <input type="month" value={statsMonth}
                      onChange={e => setStatsMonth(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Filtrer employé</label>
                    <select value={statsEmployee} onChange={e => setStatsEmployee(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-w-[160px]">
                      <option value="">Tous les employés</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI globaux du mois */}
            {(() => {
              const allMonth   = allAttendances.filter(a => toDateOnly(a.date).startsWith(statsMonth));
              const totalWork  = allMonth.reduce((s, a) => s + calcWorkMinutes(a.clockIn, a.clockOut), 0);
              const totalLate  = allMonth.reduce((s, a) => s + (a.meta?.lateMinutes ?? 0), 0);
              const totalOT    = allMonth.reduce((s, a) => s + (a.overtimeMinutes ?? 0), 0);
              const nbPresent  = allMonth.filter(a => ['PRESENT','LATE','REMOTE','HALF_DAY'].includes(a.status)).length;
              // Absences explicites + implicites (somme de tous les employés filtrés)
              const nbAbsent   = statsEmployees.reduce((sum, emp) => sum + buildEmpStats(emp).absentDays, 0);
              const [ky, kmo]  = statsMonth.split('-').map(Number);
              const isCurrentMo = statsMonth === today.substring(0, 7);
              const kPeriodEnd = isCurrentMo ? new Date(today + 'T00:00:00') : new Date(ky, kmo, 1);
              let kWorkdays = 0;
              for (let d = new Date(ky, kmo - 1, 1); d < kPeriodEnd; d.setDate(d.getDate() + 1)) {
                if (d.getDay() !== 0 && d.getDay() !== 6) kWorkdays++;
              }
              const expected   = statsEmployees.length * Math.max(kWorkdays, 1);
              const globalRate = expected > 0 ? Math.round(nbPresent / expected * 100) : 0;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Jours présents',    value: nbPresent,              color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: 'Jours absents',     value: nbAbsent,               color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-100' },
                    { label: 'Heures travaillées',value: fmtDuration(totalWork), color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                    { label: 'Total retards',     value: totalLate > 0 ? fmtDuration(totalLate) : '—', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: 'Heures supp.',      value: totalOT  > 0 ? fmtDuration(totalOT)   : '—', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
                    { label: 'Taux présence',     value: `${Math.min(globalRate, 100)}%`,
                      color: globalRate >= 90 ? 'text-emerald-700' : globalRate >= 70 ? 'text-amber-700' : 'text-rose-700',
                      bg:    globalRate >= 90 ? 'bg-emerald-50'    : globalRate >= 70 ? 'bg-amber-50'    : 'bg-rose-50',
                      border:globalRate >= 90 ? 'border-emerald-100' : globalRate >= 70 ? 'border-amber-100' : 'border-rose-100' },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
                      <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tableau détaillé par employé */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              {statsEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users size={36} className="mb-3 text-slate-200" />
                  <p className="font-bold text-slate-400">Aucun employé actif</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <th className="text-left py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><CheckCircle2 size={9} className="text-emerald-400"/>Présents</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><XCircle size={9} className="text-rose-400"/>Absents</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><Sunrise size={9} className="text-amber-400"/>Arr. moy.</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><Sunset size={9} className="text-indigo-400"/>Dép. moy.</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><Clock3 size={9} className="text-teal-400"/>Durée totale</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><Timer size={9} className="text-amber-400"/>Total retard</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><TrendingUp size={9} className="text-emerald-400"/>H.Supp</span>
                        </th>
                        <th className="text-center py-3.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center justify-center gap-1"><Scale size={9} className="text-violet-400"/>Bilan</span>
                        </th>
                        <th className="text-center py-3.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsEmployees.map(emp => {
                        const s = buildEmpStats(emp);
                        return (
                          <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                            {/* Employé */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ring-2 ${
                                  s.rate >= 90 ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' :
                                  s.rate >= 70 ? 'bg-amber-50 ring-amber-200 text-amber-700' :
                                  'bg-rose-50 ring-rose-200 text-rose-700'
                                }`}>
                                  {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{emp.departmentInfo?.name || emp.position || '—'}</p>
                                </div>
                              </div>
                            </td>
                            {/* Présents */}
                            <td className="py-3.5 px-3 text-center">
                              <span className="text-base font-black text-emerald-600">{s.presentDays}</span>
                              <p className="text-[8px] text-slate-400 font-black">/{s.workdaysInMonth}j</p>
                            </td>
                            {/* Absents */}
                            <td className="py-3.5 px-3 text-center">
                              {s.absentDays > 0 ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-base font-black text-rose-600">{s.absentDays}</span>
                                  {s.implicitAbsent > 0 && (
                                    <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest whitespace-nowrap">
                                      {s.explicitAbsent > 0 ? `${s.explicitAbsent} saisi + ` : ''}{s.implicitAbsent} non pointé{s.implicitAbsent > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-emerald-500 text-sm font-black">✓</span>
                              )}
                            </td>
                            {/* Arrivée moy. */}
                            <td className="py-3.5 px-3 text-center">
                              {s.avgArrival !== '—'
                                ? <span className="text-sm font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">{s.avgArrival}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                            {/* Départ moy. */}
                            <td className="py-3.5 px-3 text-center">
                              {s.avgDeparture !== '—'
                                ? <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{s.avgDeparture}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                            {/* Durée totale */}
                            <td className="py-3.5 px-3 text-center">
                              {s.totalWorkMin > 0
                                ? <span className="text-sm font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">{fmtDuration(s.totalWorkMin)}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                            {/* Retard total */}
                            <td className="py-3.5 px-3 text-center">
                              {s.totalLateMin > 0
                                ? <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">+{fmtDuration(s.totalLateMin)}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                            {/* H.Supp */}
                            <td className="py-3.5 px-3 text-center">
                              {s.totalOTMin > 0
                                ? <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+{fmtDuration(s.totalOTMin)}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                            {/* Bilan compensation */}
                            <td className="py-3.5 px-3 text-center min-w-[100px]">
                              {s.remainDeficit > 0
                                ? <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 whitespace-nowrap">−{fmtDuration(s.remainDeficit)}</span>
                                : s.remainOT > 0
                                  ? <span className="text-xs font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 whitespace-nowrap">+{fmtDuration(s.remainOT)}</span>
                                  : s.compensated > 0
                                    ? <span className="text-xs font-black text-indigo-600">✓ équilibré</span>
                                    : <span className="text-slate-200 text-xs">—</span>}
                            </td>
                            {/* Taux */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                                <span className={`text-xs font-black ${s.rate >= 90 ? 'text-emerald-600' : s.rate >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {s.rate}%
                                </span>
                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${s.rate >= 90 ? 'bg-emerald-500' : s.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${s.rate}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── DETAIL EDIT MODAL ─── */}
      <HRModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Détail du Pointage"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveDetail}
              disabled={!!saving}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              Enregistrer
            </button>
          </div>
        }
      >
        {editingRecord && (() => {
          const emp = employees.find(e => e.id === editingRecord.empId);
          const rec = editingRecord.record;
          const update = (patch: Partial<AttendanceRecord>) =>
            setEditingRecord(prev => prev ? { ...prev, record: { ...prev.record, ...patch } } : prev);

          const toTimeInput = (isoStr?: string) => isoStr ? isoStr.substring(11, 16) : '';
          const fromTimeInput = (t: string) => t ? `${selectedDate}T${t}:00` : undefined;

          return (
            <div className="space-y-6 p-2">
              {emp && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-sm font-black text-slate-600">
                    {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-slate-500">{new Date(selectedDate + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => update({ status: s })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        rec.status === s ? STATUS_COLORS[s] + ' shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {STATUS_ICONS[s]} {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Sunrise size={10} /> Heure d'arrivée
                  </label>
                  <input
                    type="time"
                    value={toTimeInput(rec.clockIn)}
                    onChange={e => update({ clockIn: fromTimeInput(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Sunset size={10} /> Heure de départ
                  </label>
                  <input
                    type="time"
                    value={toTimeInput(rec.clockOut)}
                    onChange={e => update({ clockOut: fromTimeInput(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heure de début attendue</label>
                  <input
                    type="time"
                    value={rec.meta?.expectedStart || '08:00'}
                    onChange={e => update({ meta: { ...rec.meta, expectedStart: e.target.value } })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heures supplémentaires (min)</label>
                  <input
                    type="number"
                    min={0}
                    value={rec.overtimeMinutes ?? 0}
                    onChange={e => update({ overtimeMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {(rec.meta?.lateMinutes ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-black text-amber-700">Retard calculé : {rec.meta!.lateMinutes} minutes</p>
                    <p className="text-[10px] text-amber-600">Sera appliqué aux déductions salariales si des règles RH le prévoient</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </HRModal>
    </div>
  );
};

export default Attendance;
