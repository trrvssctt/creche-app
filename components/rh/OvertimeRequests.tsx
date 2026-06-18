import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, TrendingUp, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Filter, Search, ArrowLeft, Users, Calendar,
  ChevronDown, ChevronUp, User, FileText, BarChart3, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import { apiClient } from '../../services/api';
import { useToast } from '../ToastProvider';

interface OvertimeRequestsProps {
  onNavigate?: (tab: string, meta?: any) => void;
}

interface OvertimeRecord {
  id: string;
  employeeId: string;
  requestedDate: string;
  startTime?: string;
  endTime?: string;
  requestedMinutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewedBy?: string;
  reviewNote?: string;
  actualMinutes: number;
  employee?: { id: string; firstName: string; lastName: string; position?: string; photoUrl?: string };
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'En attente',  color: 'bg-amber-50 text-amber-700 border-amber-200',    icon: <AlertTriangle size={11}/> },
  APPROVED:  { label: 'Approuvée',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={11}/> },
  REJECTED:  { label: 'Refusée',     color: 'bg-rose-50 text-rose-700 border-rose-200',       icon: <XCircle size={11}/> },
  COMPLETED: { label: 'Effectuée',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Zap size={11}/> },
};

const fmtMin = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}` : `${m}min`;
};

const OvertimeRequests: React.FC<OvertimeRequestsProps> = ({ onNavigate }) => {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(true);

  // Modal état
  const [modalRecord, setModalRecord] = useState<OvertimeRecord | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | 'complete' | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalMinutes, setModalMinutes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const showToast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterEmployee) params.set('employeeId', filterEmployee);
      if (filterMonth) params.set('month', filterMonth);

      const [recs, emps, sum] = await Promise.all([
        apiClient.get(`/hr/overtime?${params}`),
        apiClient.get('/hr/employees'),
        apiClient.get(`/hr/overtime/summary?month=${filterMonth}`).catch(() => null)
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      setEmployees((emps?.rows || emps || []).filter((e: any) => e.status === 'ACTIVE'));
      if (sum) setSummary(sum);
    } catch (err: any) {
      showToast(err.message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterEmployee, filterMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const openModal = (rec: OvertimeRecord, type: 'approve' | 'reject' | 'complete') => {
    setModalRecord(rec);
    setModalType(type);
    setModalNote('');
    setModalMinutes(String(rec.requestedMinutes));
  };

  const handleAction = async () => {
    if (!modalRecord || !modalType) return;
    setModalLoading(true);
    try {
      if (modalType === 'approve') {
        await apiClient.post(`/hr/overtime/${modalRecord.id}/approve`, { reviewNote: modalNote });
        showToast('Demande approuvée', 'success');
      } else if (modalType === 'reject') {
        await apiClient.post(`/hr/overtime/${modalRecord.id}/reject`, { reviewNote: modalNote });
        showToast('Demande refusée', 'success');
      } else if (modalType === 'complete') {
        await apiClient.post(`/hr/overtime/${modalRecord.id}/complete`, {
          actualMinutes: parseInt(modalMinutes) || modalRecord.requestedMinutes,
          reviewNote: modalNote
        });
        showToast('Heures supplémentaires enregistrées', 'success');
      }
      setModalRecord(null);
      setModalType(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Erreur', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const filtered = records.filter(r => {
    if (!searchTerm) return true;
    const name = `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || r.reason?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate?.('rh.attendance')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <TrendingUp className="text-indigo-500" size={24} /> Heures Supplémentaires
            </h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Demandes · Validation · Effectuation</p>
          </div>
        </div>
        <button onClick={loadData} disabled={loading}
          className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm self-start">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Résumé mensuel */}
      {summary && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSummary(v => !v)}
            className="w-full px-6 py-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 size={16} className="text-indigo-400" />
              <span className="text-xs font-black text-white uppercase tracking-widest">
                Bilan {new Date(filterMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            {showSummary ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {showSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-100">
              {[
                { label: 'En attente',  value: summary.pending,   color: 'text-amber-600',   bg: 'bg-amber-50' },
                { label: 'Approuvées',  value: summary.approved,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Refusées',    value: summary.rejected,  color: 'text-rose-600',    bg: 'bg-rose-50' },
                { label: 'Effectuées',  value: summary.completed, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
                { label: 'H. Supp totales', value: fmtMin(summary.totalActualMinutes || 0), color: 'text-slate-800', bg: 'bg-slate-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} p-5 text-center`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par employé, raison…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none">
          {Array.from({ length: 6 }, (_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const val = d.toISOString().substring(0, 7);
            return <option key={val} value={val}>{d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>;
          })}
        </select>
        <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
          className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Tous les employés</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] as const).map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                filterStatus === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
              }`}>
              {s === 'ALL' ? 'Tous' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des demandes */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3" />
            <span className="font-medium">Chargement…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <TrendingUp size={40} className="mb-4 text-slate-200" />
            <p className="font-bold text-slate-500">Aucune demande trouvée</p>
            <p className="text-sm mt-1">Modifiez les filtres pour voir plus de demandes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Horaire</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Raison</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Demandé</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Effectué</th>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="text-right py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map(rec => {
                    const cfg = STATUS_CONFIG[rec.status];
                    return (
                      <motion.tr key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors">

                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                              {rec.employee?.photoUrl ? (
                                <img src={rec.employee.photoUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xs font-black text-slate-500">
                                  {rec.employee?.firstName?.charAt(0)}{rec.employee?.lastName?.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{rec.employee?.firstName} {rec.employee?.lastName}</p>
                              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{rec.employee?.position || '—'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                            <Calendar size={12} className="text-slate-400" />
                            {new Date(rec.requestedDate + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                            {new Date(rec.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </p>
                        </td>

                        <td className="py-4 px-4">
                          {rec.startTime && rec.endTime ? (
                            <span className="text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg">
                              {rec.startTime} – {rec.endTime}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-4 px-4 max-w-[180px]">
                          <p className="text-xs text-slate-700 font-medium truncate" title={rec.reason}>{rec.reason}</p>
                          {rec.reviewNote && (
                            <p className="text-[9px] text-slate-400 mt-0.5 italic truncate" title={rec.reviewNote}>
                              Note: {rec.reviewNote}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className="text-sm font-black text-indigo-600">{fmtMin(rec.requestedMinutes)}</span>
                        </td>

                        <td className="py-4 px-4">
                          {rec.actualMinutes > 0 ? (
                            <span className="text-sm font-black text-emerald-600">{fmtMin(rec.actualMinutes)}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${cfg?.color}`}>
                            {cfg?.icon} {cfg?.label}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {rec.status === 'PENDING' && (
                              <>
                                <button onClick={() => openModal(rec, 'approve')}
                                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 size={11}/> Approuver
                                </button>
                                <button onClick={() => openModal(rec, 'reject')}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-200 flex items-center gap-1">
                                  <XCircle size={11}/> Refuser
                                </button>
                              </>
                            )}
                            {rec.status === 'APPROVED' && (
                              <button onClick={() => openModal(rec, 'complete')}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center gap-1">
                                <Zap size={11}/> Effectuer
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal action */}
      <HRModal
        isOpen={!!modalRecord && !!modalType}
        onClose={() => { setModalRecord(null); setModalType(null); }}
        title={
          modalType === 'approve' ? 'Approuver la demande' :
          modalType === 'reject'  ? 'Refuser la demande'  :
          'Enregistrer les heures supplémentaires'
        }
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button onClick={() => { setModalRecord(null); setModalType(null); }}
              disabled={modalLoading}
              className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleAction} disabled={modalLoading}
              className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 ${
                modalType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                modalType === 'reject'  ? 'bg-rose-600 hover:bg-rose-700' :
                'bg-indigo-600 hover:bg-indigo-700'
              }`}>
              {modalLoading && <RefreshCw size={14} className="animate-spin" />}
              {modalType === 'approve' ? 'Confirmer l\'approbation' :
               modalType === 'reject'  ? 'Confirmer le refus' :
               'Enregistrer l\'effectuation'}
            </button>
          </div>
        }
      >
        {modalRecord && (
          <div className="space-y-5">
            {/* Info demande */}
            <div className="bg-slate-50 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-3">
                <User size={14} className="text-slate-400" />
                <span className="text-sm font-black text-slate-900">
                  {modalRecord.employee?.firstName} {modalRecord.employee?.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-700">
                  {new Date(modalRecord.requestedDate + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {modalRecord.startTime && (
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{modalRecord.startTime} – {modalRecord.endTime} ({fmtMin(modalRecord.requestedMinutes)} demandées)</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <FileText size={14} className="text-slate-400 mt-0.5" />
                <span className="text-sm text-slate-700">{modalRecord.reason}</span>
              </div>
            </div>

            {/* Minutes réelles (seulement pour complete) */}
            {modalType === 'complete' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Minutes réellement effectuées
                </label>
                <input
                  type="number"
                  min="0"
                  max="480"
                  value={modalMinutes}
                  onChange={e => setModalMinutes(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  = {fmtMin(parseInt(modalMinutes) || 0)} — Sera ajouté au pointage du {new Date(modalRecord.requestedDate + 'T12:00').toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                {modalType === 'reject' ? 'Motif du refus (obligatoire)' : 'Note (optionnel)'}
              </label>
              <textarea
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                rows={3}
                placeholder={modalType === 'reject' ? 'Expliquez la raison du refus…' : 'Ajouter une note…'}
                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
          </div>
        )}
      </HRModal>
    </div>
  );
};

export default OvertimeRequests;
