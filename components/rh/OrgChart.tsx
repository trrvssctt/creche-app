import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Users, Building2, Download, Search, Filter,
  CheckCircle2, Loader2, AlertCircle, UserCheck, RefreshCw,
  Crown, Briefcase, X, GitPullRequest
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import { authBridge } from '../../services/authBridge';

interface OrgChartProps {
  onNavigate: (tab: string, meta?: any) => void;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  dept: string;
  departmentId: string;
  managerId: string | null;
  hireDate: string;
  photoUrl: string | null;
  contracts: any[];
  children: Employee[];
}

interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  employeeCount?: number;
  manager?: { id: string; firstName: string; lastName: string; };
}

interface OrgChartData {
  type: 'hierarchical' | 'flat';
  orgChart?: Employee[];
  departments?: { [key: string]: Employee[] };
  totalEmployees: number;
}

interface PendingChange {
  draggedId: string;
  draggedName: string;
  targetId: string;
  targetName: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Flatten the recursive tree into a plain array */
const flattenTree = (nodes: Employee[]): Employee[] => {
  const result: Employee[] = [];
  const walk = (arr: Employee[]) => {
    arr.forEach(n => { result.push(n); if (n.children?.length) walk(n.children); });
  };
  walk(nodes);
  return result;
};

/** Get initials from a full name string */
const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

/** Contract badge color */
const contractColor = (type: string) => {
  switch (type) {
    case 'CDI': return 'bg-emerald-50 text-emerald-600';
    case 'CDD': return 'bg-blue-50 text-blue-600';
    case 'STAGE': return 'bg-amber-50 text-amber-600';
    default: return 'bg-slate-50 text-slate-500';
  }
};

// ─── component ────────────────────────────────────────────────────────────────

const OrgChart: React.FC<OrgChartProps> = ({ onNavigate }) => {
  const [orgData,      setOrgData]      = useState<OrgChartData | null>(null);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [alertMessage,     setAlertMessage]     = useState('');

  // drag & drop
  const [draggedEmpId,   setDraggedEmpId]   = useState<string | null>(null);
  const [draggedEmpName, setDraggedEmpName] = useState('');
  const [dropTargetId,   setDropTargetId]   = useState<string | null>(null);
  const [pendingChange,  setPendingChange]  = useState<PendingChange | null>(null);
  const [changingMgr,    setChangingMgr]    = useState(false);
  const dragCounter = useRef(0);

  const session  = authBridge.getSession();
  const tenantName =
    (session?.user as any)?.tenant?.name ||
    (session?.user as any)?.company ||
    'Direction Générale';

  // ── data loading ────────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orgRes, deptRes] = await Promise.all([
        apiClient.get('/hr/employees/orgchart'),
        apiClient.get('/hr/departments'),
      ]);
      setOrgData(orgRes);
      setDepartments(deptRes?.rows || deptRes || []);
    } catch (err: any) {
      setError('Impossible de charger l\'organigramme. ' + (err.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── alert ───────────────────────────────────────────────────────────────────

  const showAlert = (msg: string) => {
    setAlertMessage(msg);
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  // ── drag & drop ─────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, empId: string, empName: string) => {
    setDraggedEmpId(empId);
    setDraggedEmpName(empName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', empId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== draggedEmpId) setDropTargetId(targetId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, target: Employee) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!draggedEmpId || draggedEmpId === target.id) return;
    setPendingChange({ draggedId: draggedEmpId, draggedName: draggedEmpName, targetId: target.id, targetName: target.name });
    setDraggedEmpId(null);
    setDraggedEmpName('');
  };

  const handleDragEnd = () => { setDraggedEmpId(null); setDropTargetId(null); dragCounter.current = 0; };

  const handleConfirmMgrChange = async () => {
    if (!pendingChange) return;
    try {
      setChangingMgr(true);
      await apiClient.put(`/hr/employees/${pendingChange.draggedId}`, { managerId: pendingChange.targetId });
      showAlert(`Manager de ${pendingChange.draggedName} changé pour ${pendingChange.targetName}`);
      setPendingChange(null);
      await loadData();
    } catch (err: any) {
      showAlert('Erreur : ' + (err.message || 'Impossible de modifier le manager'));
    } finally {
      setChangingMgr(false);
    }
  };

  // ── build structure ─────────────────────────────────────────────────────────

  const getAllEmployees = (): Employee[] => {
    if (!orgData) return [];
    if (orgData.type === 'hierarchical' && orgData.orgChart) return flattenTree(orgData.orgChart);
    if (orgData.departments) return (Object.values(orgData.departments) as Employee[][]).flat();
    if ((orgData as any).employees) return (orgData as any).employees;
    return [];
  };

  const buildHierarchy = () => {
    const allEmps = getAllEmployees();

    const matched = departments.map(dept => {
      const emps = allEmps.filter(e => e.departmentId === dept.id);
      const manager = emps.find(e => e.id === dept.managerId) || null;
      const members = emps.filter(e => e.id !== dept.managerId);
      return { dept, manager, members, allEmps: emps };
    }).filter(row => {
      if (selectedDept !== 'all' && row.dept.name !== selectedDept) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return row.allEmps.some(e => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
      }
      return true;
    }).map(row => {
      if (!searchTerm) return row;
      const q = searchTerm.toLowerCase();
      const keep = (e: Employee) => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
      const manager = row.manager && keep(row.manager) ? row.manager : null;
      const members = row.members.filter(keep);
      return { ...row, manager, members };
    });

    const assignedIds = new Set(allEmps.filter(e => e.departmentId).map(e => e.id));
    const unassigned = allEmps.filter(e => !assignedIds.has(e.id) || !departments.some(d => d.id === e.departmentId));

    return { matched, unassigned };
  };

  // ── employee card ────────────────────────────────────────────────────────────

  const EmployeeCard: React.FC<{ emp: Employee; isManager?: boolean }> = ({ emp, isManager = false }) => {
    const isDragging   = draggedEmpId === emp.id;
    const isDropTarget = dropTargetId === emp.id && draggedEmpId !== emp.id;
    const contract     = emp.contracts?.[0];

    return (
      <div
        draggable
        onDragStart={e  => handleDragStart(e, emp.id, emp.name)}
        onDragOver={e   => handleDragOver(e, emp.id)}
        onDragLeave={handleDragLeave}
        onDrop={e       => handleDrop(e, emp)}
        onDragEnd={handleDragEnd}
        title="Glisser pour changer le manager"
        className={[
          'relative flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none',
          isManager
            ? 'bg-emerald-50 border-emerald-200 shadow-sm'
            : 'bg-white border-slate-100 hover:bg-slate-50',
          isDragging   ? 'opacity-40 scale-95' : '',
          isDropTarget ? 'border-2 border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50' : '',
        ].join(' ')}
      >
        {isDropTarget && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap shadow">
            Nouveau manager
          </div>
        )}

        {/* Avatar */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden
          ${isManager ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'}`}>
          {emp.photoUrl
            ? <img src={emp.photoUrl} className="w-full h-full object-cover" alt={emp.name}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : initials(emp.name)
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isManager && <Crown size={10} className="text-emerald-500 shrink-0" />}
            <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{emp.name}</p>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{emp.role || '—'}</p>
        </div>

        {/* Contract badge */}
        {contract && (
          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 ${contractColor(contract.type)}`}>
            {contract.type}
          </span>
        )}
      </div>
    );
  };

  // ── department column ────────────────────────────────────────────────────────

  const DeptColumn: React.FC<{ dept: Department; manager: Employee | null; members: Employee[] }> = ({ dept, manager, members }) => (
    <div className="flex flex-col items-center">
      {/* connector from horizontal bar */}
      <div className="w-px h-8 bg-slate-200" />

      {/* Department card */}
      <div className="w-64 bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden">
        {/* Dept header */}
        <div className="bg-indigo-600 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm uppercase tracking-tight truncate">{dept.name}</p>
              <p className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest">
                {(manager ? 1 : 0) + members.length} employé{((manager ? 1 : 0) + members.length) > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Employees list */}
        <div className="p-3 space-y-2">
          {!manager && members.length === 0 && (
            <div className="py-4 text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase">Aucun employé</p>
            </div>
          )}
          {manager && <EmployeeCard emp={manager} isManager />}
          {manager && members.length > 0 && <div className="border-t border-slate-100 mt-1 pt-1" />}
          {members.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
        </div>
      </div>
    </div>
  );

  // ── main render ──────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Chargement de l'organigramme…</p>
      </div>
    );

    if (error) return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-lg font-black text-rose-800 uppercase mb-2">Erreur de chargement</h3>
          <p className="text-rose-600 text-sm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all">
            Réessayer
          </button>
        </div>
      </div>
    );

    const totalEmps = orgData?.totalEmployees ?? 0;
    if (!orgData || totalEmps === 0) return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center max-w-md">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-500 uppercase mb-2">Aucun employé actif</h3>
          <p className="text-slate-400 text-sm">Ajoutez des employés et des contrats pour visualiser l'organigramme.</p>
        </div>
      </div>
    );

    const { matched, unassigned } = buildHierarchy();

    return (
      <div className="flex flex-col items-center gap-0 pb-8 min-w-max mx-auto">

        {/* ── TIER 1 : TENANT ── */}
        <div className="w-80 bg-slate-900 rounded-[2.5rem] shadow-2xl p-6 text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Building2 size={28} className="text-white" />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">{tenantName}</h3>
          <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-1">Direction Générale</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase">
              <Users size={11} /> {totalEmps} employés
            </span>
            <span className="flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase">
              <Building2 size={11} /> {departments.length} dép.
            </span>
          </div>
        </div>

        {/* ── CONNECTOR TENANT → DEPTS ── */}
        {matched.length > 0 && (
          <>
            <div className="w-px h-10 bg-slate-200" />
            {/* Horizontal bar */}
            <div className="relative flex items-start justify-center gap-6">
              {matched.length > 1 && (
                <div className="absolute top-0 h-px bg-slate-200"
                  style={{
                    left:  `calc(${100 / (2 * matched.length)}% + 12px)`,
                    right: `calc(${100 / (2 * matched.length)}% + 12px)`,
                  }}
                />
              )}
              {matched.map(({ dept, manager, members }) => (
                <DeptColumn key={dept.id} dept={dept} manager={manager} members={members} />
              ))}
            </div>
          </>
        )}

        {/* ── Aucun département correspondant ── */}
        {matched.length === 0 && !loading && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Aucun département ne correspond aux filtres</p>
          </div>
        )}

        {/* ── TIER : EMPLOYÉS NON ASSIGNÉS ── */}
        {unassigned.length > 0 && (
          <div className="mt-12 w-full max-w-3xl">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Sans département ({unassigned.length})</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {unassigned.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const deptNames = departments.map(d => d.name).sort();

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── Toast ── */}
      <AnimatePresence>
        {showSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest"
          >
            <CheckCircle2 size={18} /> {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('rh')}
            className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <GitPullRequest className="text-indigo-600" size={28} /> Organigramme
            </h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em] mt-1">
              Structure hiérarchique · {orgData?.totalEmployees ?? 0} employés actifs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="px-6 py-3 bg-white border border-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={15} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Hint ── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 flex items-center gap-3">
        <UserCheck size={15} className="text-indigo-500 shrink-0" />
        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
          Glissez une carte sur une autre pour modifier le manager direct de l'employé
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="Rechercher un employé ou un poste…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={15} className="text-slate-400" />
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="bg-slate-50 border-none rounded-2xl px-4 py-4 font-black text-xs uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer appearance-none"
          >
            <option value="all">Tous les départements</option>
            {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div className="bg-slate-50/60 border border-slate-100 rounded-[3rem] shadow-inner overflow-auto min-h-[600px] p-8 md:p-12">
        {renderContent()}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-6 px-2">
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="w-4 h-4 bg-emerald-50 border border-emerald-200 rounded-md" /> Manager du département
        </span>
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="w-4 h-4 bg-white border border-slate-100 rounded-md" /> Employé
        </span>
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="w-4 h-4 bg-indigo-600 rounded-md" /> Département
        </span>
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="w-4 h-4 bg-slate-900 rounded-md" /> Direction
        </span>
      </div>

      {/* ── Modal confirmation drag & drop ── */}
      <AnimatePresence>
        {pendingChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center"
            >
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                <UserCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Changer le manager ?</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-6">
                Nouveau lien hiérarchique direct
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Employé déplacé</span>
                  <span className="text-sm font-black text-slate-900">{pendingChange.draggedName}</span>
                </div>
                <div className="text-indigo-400 font-black text-lg">↓</div>
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl">
                  <span className="text-[10px] font-black text-indigo-400 uppercase">Nouveau manager</span>
                  <span className="text-sm font-black text-indigo-700">{pendingChange.targetName}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmMgrChange}
                  disabled={changingMgr}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                >
                  {changingMgr ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Confirmer
                </button>
                <button onClick={() => setPendingChange(null)} className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrgChart;
