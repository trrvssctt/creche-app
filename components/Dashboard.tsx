import React, { useMemo, useState, useEffect } from 'react';
import SchoolAdminDashboard from './SchoolAdminDashboard';
import {
  TrendingUp, Package, Users, ShieldCheck,
  AlertTriangle, Zap, RefreshCw,
  Wallet, Landmark, Target, Activity,
  ShoppingCart, Boxes,
  Clock, CheckCircle2, UserPlus,
  TrendingDown, ShoppingBag, UserCheck,
  History, Scale, Receipt,
  HandCoins, PiggyBank, Sparkles,
  BrainCircuit, Lightbulb, TrendingDown as TrendDown,
  Trophy, Medal, AlertCircle, CreditCard,
  ShieldAlert, ArrowRight, Bell, ChevronRight,
  ArrowDownCircle, ArrowUpCircle, DollarSign,
  BarChart2, PieChart as PieIcon, Star,
  Calendar, Briefcase, Building2, FileText, MapPin,
  GraduationCap, Baby, BookOpen, Bus
} from 'lucide-react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Legend, ComposedChart
} from 'recharts';
import { User, UserRole, StockItem } from '../types';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { useAnnee } from '../contexts/AnneeContext';
import waveQr from '../assets/qr_code_marchant_wave.png';
import { Timer } from 'lucide-react';
import TimeMachineFilter, {
  FilterState,
  DEFAULT_FILTER,
  isCurrentPeriod,
  getPeriodLabel,
  NOW_FILTER,
} from './TimeMachineFilter';

const fmt = (n: number, currency: string) => `${Number(n || 0).toLocaleString('fr-FR')} ${currency}`;
const fmtShort = (n: number) => Number(n || 0).toLocaleString('fr-FR');
// Normalise un champ customer qui peut être une string ou un objet Customer complet
const getCustomerName = (c: any): string => {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') return c.companyName || c.name || c.email || '';
  return String(c);
};

const StatCard = ({ title, value, subValue, icon: Icon, color, trend, onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden relative ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="absolute -right-3 -top-3 p-6 opacity-5 group-hover:scale-110 transition-transform"><Icon size={64}/></div>
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{title}</p>
        <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter mt-1 truncate">{value}</h3>
      </div>
      <div className={`p-3 rounded-2xl ${color || ''} bg-opacity-10 ${(color || '').replace('bg-', 'text-')} shadow-inner flex-shrink-0`}><Icon size={20}/></div>
    </div>
    {subValue && (
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
        {trend === 'up' && <TrendingUp size={10} className="text-emerald-500"/>}
        {trend === 'down' && <TrendingDown size={10} className="text-rose-500"/>}
        <span className={trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-500' : 'text-slate-400'}>{subValue}</span>
      </p>
    )}
  </div>
);

const SectionHeader = ({ icon: Icon, title, badge, color = 'text-indigo-600' }: any) => (
  <div className="flex items-center justify-between mb-5">
    <h3 className={`text-sm font-black uppercase tracking-tight flex items-center gap-2 ${color}`}>
      <Icon size={18}/> {title}
    </h3>
    {badge && <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">{badge}</span>}
  </div>
);

const ActivityItem = ({ icon: Icon, color, title, sub, time }: any) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
    <div className={`w-7 h-7 rounded-xl ${color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
      <Icon size={12} className="text-white"/>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-800 truncate">{title}</p>
      <p className="text-[9px] text-slate-400 font-semibold truncate">{sub}</p>
    </div>
    <p className="text-[8px] text-slate-300 font-bold flex-shrink-0">{time}</p>
  </div>
);

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
};

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const Dashboard: React.FC<{
  user: User,
  currency: string,
  onNavigate?: (tab: string, meta?: any) => void,
  onLogout?: () => void
}> = ({ user, currency, onNavigate, onLogout }) => {
  const { annee: anneeScolaire } = useAnnee();
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Forecast IA ──────────────────────────────────────────────
  const [forecast, setForecast] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastTimestamp, setForecastTimestamp] = useState<Date | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Time Machine filter
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);

  // Derived filter values used throughout calculations
  const selectedYear = filterState.mode !== 'all' ? filterState.year : null;
  const selectedMonth = (filterState.mode === 'month' || filterState.mode === 'day') ? filterState.month : null;
  const selectedQuarter = filterState.mode === 'quarter' ? filterState.quarter : null;
  const selectedDay = filterState.mode === 'day' ? filterState.day : null;

  const QTR_MONTHS = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]] as const;

  // Extended state for admin dashboard
  const [adminStats, setAdminStats] = useState<any>(null);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [latestPayments, setLatestPayments] = useState<any[]>([]);
  const [revenueStats, setRevenueStats] = useState<any[]>([]);
  const [pendingValidations, setPendingValidations] = useState<any[]>([]);

  const userRoles = user.roles || [user.role];

  useEffect(() => {
    const handleSessionExpired = () => {
      if (onLogout) onLogout();
      else window.location.href = '/';
    };
    const sessionMonitoringId = authBridge.startSessionMonitoring(handleSessionExpired, 300000);
    const initialCheckTimeout = setTimeout(async () => {
      await authBridge.validateCurrentSession();
    }, 30000);
    return () => {
      if (sessionMonitoringId) clearInterval(sessionMonitoringId);
      clearTimeout(initialCheckTimeout);
    };
  }, [onLogout]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN)) {
          const res = await apiClient.get('/admin/dashboard');
          const payload = res.data || res;
          setSales((payload.recentSales || []).concat([]));
          setCustomers(payload.latestCustomers || []);
          setStocks(Array.isArray(payload.stocks) ? payload.stocks : []);
          setUsersList(payload.users?.recent || []);
          setMovements(payload.recentMovements || []);
          if (payload.subscription) setSubscription(payload.subscription);
          // Extended data
          setAdminStats(payload.stats || null);
          setTopDebtors(payload.topDebtors || []);
          setLatestPayments(payload.latestPayments || []);
          setRevenueStats(payload.revenueStats || []);
          setPendingValidations(payload.pendingValidations || []);
        } else {
          const toData = (r: any) => (r && r.data !== undefined) ? r.data : r;
          const anneeParams = { params: { anneeScolaire } };
          if (userRoles.includes(UserRole.ACCOUNTANT)) {
            const [salesRes, customersRes] = await Promise.all([
              apiClient.get('/sales', anneeParams),
              apiClient.get('/customers', anneeParams)
            ]);
            setSales(toData(salesRes) || []);
            setCustomers(toData(customersRes) || []);
          } else {
            const endpoints: any[] = [
              apiClient.get('/sales', anneeParams),
              apiClient.get('/customers', anneeParams),
              apiClient.get('/stock'),
              apiClient.get('/services')
            ];
            if (userRoles.includes(UserRole.STOCK_MANAGER)) {
              endpoints.push(
                apiClient.get('/stock/movements'),
                apiClient.get('/categories'),
                apiClient.get('/subcategories')
              );
            }
            const results = await Promise.all(endpoints);
            setSales(toData(results[0]) || []);
            setCustomers(toData(results[1]) || []);
            setStocks(toData(results[2]) || []);
            setServices(toData(results[3]) || []);
            if (results.length > 4) {
              setMovements(toData(results[4]) || []);
              setCategories(toData(results[5]) || []);
              setSubcategories(toData(results[6]) || []);
            }
          }
        }
      } catch (err) {
        console.error("Dashboard data fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [userRoles, anneeScolaire]); // eslint-disable-line

  // --- ESSAI GRATUIT : jours restants ---
  const trialDaysLeft = useMemo(() => authBridge.getTrialDaysRemaining(user), [user]);

  // --- ABONNEMENT ALERT ---
  const subAlert = useMemo(() => {
    const subObj = subscription?.subscription || subscription;
    const nextBillingRaw = subObj?.nextBillingDate ?? subObj?.next_billing_date;
    if (!nextBillingRaw) return null;
    const expiry = new Date(nextBillingRaw);
    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      daysLeft: diffDays,
      isCritical: diffDays <= 5 && diffDays >= 0,
      isExpired: diffDays < 0,
      formattedDate: expiry.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })
    };
  }, [subscription]);

  // --- CHART TITLE derived from filter state ---
  const chartTitle = useMemo(() => {
    if (!selectedYear) return 'Tendance Revenus — 6 Derniers Mois';
    if (selectedDay !== null && selectedMonth !== null)
      return `Revenus du ${selectedDay} ${MONTH_LABELS[selectedMonth]} ${selectedYear} — par heure`;
    if (selectedQuarter !== null)
      return `Revenus T${selectedQuarter} ${selectedYear}`;
    if (selectedMonth !== null)
      return `Revenus ${MONTH_LABELS[selectedMonth]} ${selectedYear}`;
    return `Revenus ${selectedYear}`;
  }, [selectedYear, selectedMonth, selectedQuarter, selectedDay]);

  // --- SALES STATS ---
  const salesStats = useMemo(() => {
    const s = adminStats;

    // ADMIN PATH: use pre-computed server stats
    if (s) {
      const totalChequesPending = s.totalChequesPending || 0;
      // If year filter + monthly revenue data → compute year totals from revenueStats
      if (selectedYear && revenueStats.length > 0) {
        const filtered = revenueStats.filter(r => {
          const d = new Date(r.month);
          return d.getFullYear() === selectedYear &&
            (selectedMonth === null || d.getMonth() === selectedMonth);
        });
        const totalRevenue = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
        const totalCollected = filtered.reduce((sum, r) => sum + (r.collected || 0), 0);
        // Créances: use all-time outstanding (server doesn't give per-year unpaid)
        const totalUnpaid = s.totalUnpaid ?? Math.max(0, (s.totalRevenue || 0) - (s.totalCollected || 0));
        const overdueCount = s.overdueCount || s.latePayments || 0;
        const recoveryData = [
          { name: 'Encaissé', value: totalCollected, color: '#10b981' },
          { name: 'À Recouvrer', value: Math.max(0, totalUnpaid), color: '#f43f5e' }
        ];
        return { totalRevenue, totalCollected, totalChequesPending, totalUnpaid, overdueCount, totalSalesCount: s.totalSalesCount || sales.length, avgBasket: totalRevenue > 0 && s.totalSalesCount ? totalRevenue / s.totalSalesCount : 0, recoveryData, monthRevenue: 0 };
      }
      // Default admin stats (no year filter or no revenueStats)
      const totalRevenue = s.totalRevenue || 0;
      const totalCollected = s.totalCollected || 0;
      const totalUnpaid = s.totalUnpaid ?? (totalRevenue - totalCollected);
      const overdueCount = s.overdueCount || s.latePayments || 0;
      const totalSalesCount = s.totalSalesCount || sales.length;
      const avgBasket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
      const recoveryData = [
        { name: 'Encaissé', value: totalCollected, color: '#10b981' },
        { name: 'À Recouvrer', value: Math.max(0, totalUnpaid), color: '#f43f5e' }
      ];
      return { totalRevenue, totalCollected, totalChequesPending, totalUnpaid, overdueCount, totalSalesCount, avgBasket, recoveryData, monthRevenue: 0 };
    }

    // ADMIN PATH: also handle quarter filter via revenueStats
    if (s) {
      const totalChequesPending = s.totalChequesPending || 0;
      if (selectedYear && revenueStats.length > 0) {
        const qMonthsFilter = selectedQuarter ? QTR_MONTHS[selectedQuarter - 1] : null;
        const filtered = revenueStats.filter(r => {
          const d = new Date(r.month);
          if (d.getFullYear() !== selectedYear) return false;
          if (selectedMonth !== null) return d.getMonth() === selectedMonth;
          if (qMonthsFilter) return (qMonthsFilter as readonly number[]).includes(d.getMonth());
          return true;
        });
        const totalRevenue = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
        const totalCollected = filtered.reduce((sum, r) => sum + (r.collected || 0), 0);
        const totalUnpaid = s.totalUnpaid ?? Math.max(0, (s.totalRevenue || 0) - (s.totalCollected || 0));
        const overdueCount = s.overdueCount || s.latePayments || 0;
        const recoveryData = [
          { name: 'Encaissé', value: totalCollected, color: '#10b981' },
          { name: 'À Recouvrer', value: Math.max(0, totalUnpaid), color: '#f43f5e' }
        ];
        return { totalRevenue, totalCollected, totalChequesPending, totalUnpaid, overdueCount, totalSalesCount: s.totalSalesCount || sales.length, avgBasket: totalRevenue > 0 && s.totalSalesCount ? totalRevenue / s.totalSalesCount : 0, recoveryData, monthRevenue: 0 };
      }
      const totalRevenue = s.totalRevenue || 0;
      const totalCollected = s.totalCollected || 0;
      const totalUnpaid = s.totalUnpaid ?? (totalRevenue - totalCollected);
      const overdueCount = s.overdueCount || s.latePayments || 0;
      const totalSalesCount = s.totalSalesCount || sales.length;
      const avgBasket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
      const recoveryData = [
        { name: 'Encaissé', value: totalCollected, color: '#10b981' },
        { name: 'À Recouvrer', value: Math.max(0, totalUnpaid), color: '#f43f5e' }
      ];
      return { totalRevenue, totalCollected, totalChequesPending, totalUnpaid, overdueCount, totalSalesCount, avgBasket, recoveryData, monthRevenue: 0 };
    }

    // NON-ADMIN PATH: client-side computation from full sales array
    const validSales = sales.filter(s => s.status !== 'ANNULE');

    // Helper: does a date match the selected period?
    const inPeriod = (dateStr: string) => {
      if (!selectedYear) return true;
      const d = new Date(dateStr);
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedDay !== null && selectedMonth !== null)
        return d.getMonth() === selectedMonth && d.getDate() === selectedDay;
      if (selectedMonth !== null) return d.getMonth() === selectedMonth;
      if (selectedQuarter !== null)
        return (QTR_MONTHS[selectedQuarter - 1] as readonly number[]).includes(d.getMonth());
      return true;
    };

    const periodSales = selectedYear ? validSales.filter(s => inPeriod(s.createdAt)) : validSales;
    const totalRevenue = periodSales.reduce((sum, s) => sum + parseFloat(s.totalTtc || 0), 0);

    const CHEQUE_PENDING_STATUSES = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];

    let totalCollected: number;
    if (selectedYear) {
      totalCollected = validSales
        .flatMap(s => (s.payments || []).filter((p: any) =>
          inPeriod(p.createdAt) && !(p.method === 'CHEQUE' && CHEQUE_PENDING_STATUSES.includes(p.status))
        ))
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    } else {
      totalCollected = validSales.reduce((sum, s) => sum + parseFloat(s.amountPaid || 0), 0);
    }

    const totalChequesPending = validSales
      .flatMap((s: any) => (s.payments || []))
      .filter((p: any) => p.method === 'CHEQUE' && CHEQUE_PENDING_STATUSES.includes(p.status))
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

    let totalUnpaid: number;
    let overdueCount: number;
    if (selectedYear) {
      const endOfPeriod = selectedDay !== null && selectedMonth !== null
        ? new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59)
        : selectedMonth !== null
        ? new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)
        : selectedQuarter !== null
        ? new Date(selectedYear, QTR_MONTHS[selectedQuarter - 1][2] + 1, 0, 23, 59, 59)
        : new Date(selectedYear, 12, 0, 23, 59, 59);
      const historicalSales = validSales.filter(s => new Date(s.createdAt) <= endOfPeriod);
      totalUnpaid = historicalSales.reduce((sum, s) =>
        sum + Math.max(0, parseFloat(s.totalTtc || 0) - parseFloat(s.amountPaid || 0)), 0);
      overdueCount = historicalSales.filter(s => s.status === 'EN_COURS').length;
    } else {
      totalUnpaid = totalRevenue - totalCollected;
      overdueCount = validSales.filter(s => s.status === 'EN_COURS').length;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = (!selectedYear || selectedYear === now.getFullYear())
      ? periodSales.filter(s => new Date(s.createdAt) >= startOfMonth)
          .reduce((sum, s) => sum + parseFloat(s.totalTtc || 0), 0)
      : 0;

    const recoveryData = [
      { name: 'Encaissé', value: totalCollected, color: '#10b981' },
      { name: 'À Recouvrer', value: Math.max(0, totalUnpaid), color: '#f43f5e' }
    ];
    return {
      totalRevenue, totalCollected, totalChequesPending, totalUnpaid, overdueCount,
      totalSalesCount: periodSales.length,
      avgBasket: periodSales.length > 0 ? totalRevenue / periodSales.length : 0,
      recoveryData, monthRevenue
    };
  }, [sales, adminStats, selectedYear, selectedMonth, selectedQuarter, selectedDay, revenueStats, QTR_MONTHS]);

  // --- MÉTRIQUES SCOLAIRES (Le Toit des Anges) ---
  const schoolStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Élèves par statut (stockés comme customers avec champ statut)
    const eleveActifs = customers.filter((c: any) => (c.statut || c.status) === 'ACTIF' || (c.isActive && !(c.statut || c.status))).length;
    const eleveEnAttente = customers.filter((c: any) => (c.statut || c.status) === 'EN_ATTENTE').length;
    const eleveTotal = customers.length;

    // Factures du mois en cours (non annulées)
    const facturesMoisCourant = sales.filter((s: any) => {
      if (s.status === 'ANNULE') return false;
      const d = new Date(s.createdAt);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const totalFactureMois = facturesMoisCourant.reduce((sum: number, s: any) => sum + parseFloat(s.totalTtc || 0), 0);
    const totalEncaisseMois = facturesMoisCourant.reduce((sum: number, s: any) => sum + parseFloat(s.amountPaid || 0), 0);
    const tauxRecouvrementMois = totalFactureMois > 0 ? Math.round((totalEncaisseMois / totalFactureMois) * 100) : 0;
    const impayesMois = facturesMoisCourant.filter((s: any) => parseFloat(s.amountPaid || 0) < parseFloat(s.totalTtc || 0)).length;

    // Prévisionnel annuel (10 mois × CA mois courant)
    const prevAnnuel = totalFactureMois * 10;

    return { eleveActifs, eleveEnAttente, eleveTotal, totalFactureMois, totalEncaisseMois, tauxRecouvrementMois, impayesMois, prevAnnuel };
  }, [customers, sales]);

  // --- STOCK STATS ---
  const stockStats = useMemo(() => {
    if (adminStats) {
      return {
        out: adminStats.stocksRupture || 0,
        low: adminStats.stocksLow || 0,
        total: adminStats.stocksTotal || stocks.length
      };
    }
    return {
      out: stocks.filter(s => (s.currentLevel || 0) <= 0).length,
      low: stocks.filter(s => (s.currentLevel || 0) > 0 && s.minThreshold != null && s.currentLevel <= s.minThreshold).length,
      total: stocks.length
    };
  }, [stocks, adminStats]);

  // --- STAFF PERFORMANCE ---
  const staffPerformance = useMemo(() => {
    const perfMap: Record<string, any> = {};
    const ensureOp = (name: string | null, role: string | null = 'EMPLOYEE') => {
      const key = (name || 'UNKNOWN').toString();
      if (!perfMap[key]) perfMap[key] = { name: key, role: role || 'EMPLOYEE', salesCount: 0, movCount: 0, score: 0 };
      return perfMap[key];
    };
    usersList.forEach((u: any) => {
      if (!u || !u.name) return;
      perfMap[u.name] = { name: u.name, role: u.role || 'EMPLOYEE', salesCount: 0, movCount: 0, score: 0 };
    });
    sales.forEach((s: any) => {
      const op = s.operator || s.operatorName || 'SYSTÈME';
      ensureOp(op, 'SALES').salesCount += 1;
    });
    movements.forEach((m: any) => {
      const op = m.userRef || m.userName || m.user || 'SYSTÈME';
      ensureOp(op, 'STOCK_MANAGER').movCount += 1;
    });
    return Object.values(perfMap).map((u: any) => ({
      ...u,
      score: (Number(u.salesCount || 0) * 10) + (Number(u.movCount || 0) * 2)
    })).sort((a: any, b: any) => b.score - a.score || b.salesCount - a.salesCount);
  }, [usersList, sales, movements]);

  // --- REVENUE CHART DATA ---
  const revenueChartData = useMemo(() => {
    // Determine which months to display based on filter mode
    const monthsToShow: number[] = selectedMonth !== null
      ? [selectedMonth]
      : selectedQuarter !== null
      ? [...QTR_MONTHS[selectedQuarter - 1]]
      : Array.from({ length: 12 }, (_, i) => i);

    if (revenueStats.length > 0) {
      if (selectedYear) {
        const yearStats = revenueStats.filter(r => new Date(r.month).getFullYear() === selectedYear);
        return monthsToShow.map(m => {
          const r = yearStats.find(r => new Date(r.month).getMonth() === m);
          return { label: MONTH_LABELS[m], total: r?.total || 0, collected: r?.collected || 0 };
        });
      }
      return revenueStats.map((r: any) => {
        const d = new Date(r.month);
        return {
          label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
          total: r.total || 0,
          collected: r.collected || 0
        };
      });
    }

    // Fallback: build from sales
    const validSales = sales
      .filter((s: any) => s.status !== 'ANNULE')
      .filter((s: any) => {
        if (s.tenantId && user?.tenantId) return s.tenantId === user.tenantId;
        return true;
      });

    if (selectedYear) {
      // Day mode: show hourly buckets (0h–23h)
      if (selectedDay !== null && selectedMonth !== null) {
        const hours: Record<number, { total: number; collected: number }> = {};
        for (let h = 0; h < 24; h++) hours[h] = { total: 0, collected: 0 };
        validSales
          .filter((s: any) => {
            const d = new Date(s.createdAt);
            return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && d.getDate() === selectedDay;
          })
          .forEach((s: any) => {
            const h = new Date(s.createdAt).getHours();
            hours[h].total += parseFloat(s.totalTtc || 0);
            hours[h].collected += parseFloat(s.amountPaid || 0);
          });
        return Object.entries(hours).map(([h, v]) => ({
          label: `${h}h`,
          total: v.total,
          collected: v.collected
        }));
      }

      const map: Record<number, { total: number; collected: number }> = {};
      monthsToShow.forEach(m => { map[m] = { total: 0, collected: 0 }; });

      validSales
        .filter((s: any) => new Date(s.createdAt).getFullYear() === selectedYear)
        .forEach((s: any) => {
          const m = new Date(s.createdAt).getMonth();
          if (map[m] !== undefined) map[m].total += parseFloat(s.totalTtc || 0);
        });

      const CHEQUE_PENDING_CHART = ['PENDING', 'REGISTERED', 'DEPOSITED', 'PROCESSING'];
      validSales.forEach((s: any) => {
        (s.payments || []).forEach((p: any) => {
          if (p.method === 'CHEQUE' && CHEQUE_PENDING_CHART.includes(p.status)) return;
          const d = new Date(p.createdAt);
          if (d.getFullYear() === selectedYear) {
            const m = d.getMonth();
            if (map[m] !== undefined) map[m].collected += parseFloat(p.amount || 0);
          }
        });
      });

      return monthsToShow.map(m => ({
        label: MONTH_LABELS[m],
        total: map[m]?.total || 0,
        collected: map[m]?.collected || 0
      }));
    }

    // All-time: last 6 months
    const map: Record<string, { total: number; collected: number }> = {};
    validSales.forEach((s: any) => {
      const d = new Date(s.createdAt);
      const key = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { total: 0, collected: 0 };
      map[key].total += parseFloat(s.totalTtc || 0);
      map[key].collected += parseFloat(s.amountPaid || 0);
    });
    return Object.entries(map)
      .map(([label, vals]) => {
        const [mois, annee] = label.split(' ');
        return { label, ...vals, sortKey: Number(annee) * 12 + MONTH_LABELS.indexOf(mois) };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-6)
      .map(({ label, total, collected }) => ({ label, total, collected }));
  }, [revenueStats, sales, user, selectedYear, selectedMonth, selectedQuarter, selectedDay, QTR_MONTHS]);

  // --- ACTIVITY FEED (movements + payments + customers combined) ---
  const activityFeed = useMemo(() => {
    const items: any[] = [];
    movements.slice(0, 5).forEach((m: any) => items.push({
      type: m.type === 'IN' ? 'stock_in' : 'stock_out',
      title: m.productName || 'Produit',
      sub: `${m.type === 'IN' ? '+' : '-'}${m.quantity} unités • ${m.userRef || 'Système'}`,
      date: m.createdAt,
      icon: m.type === 'IN' ? ArrowUpCircle : ArrowDownCircle,
      color: m.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'
    }));
    latestPayments.slice(0, 5).forEach((p: any) => items.push({
      type: 'payment',
      title: getCustomerName(p.customer) || 'Paiement reçu',
      sub: `${Number(p.amount || 0).toLocaleString('fr-FR')} ${currency} encaissé`,
      date: p.createdAt,
      icon: DollarSign,
      color: 'bg-indigo-500'
    }));
    customers.slice(0, 3).forEach((c: any) => items.push({
      type: 'customer',
      title: c.companyName || c.name || 'Nouveau client',
      sub: 'Nouveau client enregistré',
      date: c.createdAt,
      icon: UserPlus,
      color: 'bg-sky-500'
    }));
    return items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);
  }, [movements, latestPayments, customers, currency]);

  // --- STOCK ALERTS ---
  const stockAlerts = useMemo(() => {
    const ruptures = stocks.filter(s => (s.currentLevel || 0) <= 0);
    const low = stocks.filter(s => (s.currentLevel || 0) > 0 && s.minThreshold != null && s.currentLevel <= s.minThreshold);
    return { ruptures: ruptures.slice(0, 6), low: low.slice(0, 6) };
  }, [stocks]);

  // --- TODAY / PERIOD STATS ---
  const todayStats = useMemo(() => {
    if (selectedYear) {
      const periodSales = sales.filter((s: any) => {
        if (s.status === 'ANNULE') return false;
        const d = new Date(s.createdAt);
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedDay !== null && selectedMonth !== null)
          return d.getMonth() === selectedMonth && d.getDate() === selectedDay;
        if (selectedMonth !== null) return d.getMonth() === selectedMonth;
        if (selectedQuarter !== null)
          return (QTR_MONTHS[selectedQuarter - 1] as readonly number[]).includes(d.getMonth());
        return true;
      });
      const label = selectedDay !== null && selectedMonth !== null
        ? `${selectedDay} ${MONTH_LABELS[selectedMonth]} ${selectedYear}`
        : selectedQuarter !== null
        ? `T${selectedQuarter} ${selectedYear}`
        : selectedMonth !== null
        ? `${MONTH_LABELS[selectedMonth]} ${selectedYear}`
        : String(selectedYear);
      return {
        count: periodSales.length,
        revenue: periodSales.reduce((sum: number, s: any) => sum + parseFloat(s.totalTtc || 0), 0),
        periodLabel: label
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter((s: any) => new Date(s.createdAt) >= today);
    return {
      count: todaySales.length,
      revenue: todaySales.reduce((sum: number, s: any) => sum + parseFloat(s.totalTtc || 0), 0),
      periodLabel: "aujourd'hui"
    };
  }, [sales, selectedYear, selectedMonth, selectedQuarter, selectedDay, QTR_MONTHS]);

  // --- PAYMENT MODAL ---
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [txReference, setTxReference] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const processSubscriptionPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const transactionId = txReference || `TX-${Date.now()}`;
      await apiClient.post('/billing/upgrade', {
        planId: subscription?.subscription?.planId || subscription?.planId || 'DEFAULT',
        paymentMethod: 'WAVE',
        transactionId,
        phone: phoneNumber,
        status: 'PENDING'
      });
      setSubscription((prev: any) => ({ ...(prev || {}), status: 'PENDING' }));
      setPaymentSuccess(true);
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentSuccess(false);
        setTxReference('');
        setPhoneNumber('');
      }, 2200);
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement du paiement. " + (err?.message || 'Veuillez réessayer.'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ============================================================
  // FORECAST IA — chargement & rendu
  // ============================================================
  const loadForecast = async () => {
    if (forecastLoading) return;
    setForecastLoading(true);
    setForecastError(null);
    try {
      // Construire le payload avec les données réelles du dashboard
      const histPayload = revenueChartData.slice(-6).map(d => ({
        label: d.label,
        total: d.total || 0,
        collected: d.collected || 0,
      }));

      const stockPayload = stocks.slice(0, 20).map((s: any) => ({
        name: s.name,
        sku: s.sku,
        currentLevel: s.currentLevel ?? 0,
        minThreshold: s.minThreshold ?? 5,
      }));

      const payload = {
        historique: histPayload,
        stock: stockPayload,
        clients: (adminStats?.customersCount ?? customers.length),
        kpis: {
          totalRevenue: salesStats.totalRevenue,
          totalCollected: salesStats.totalCollected,
          overdueCount: salesStats.overdueCount,
          collectionRate: salesStats.totalRevenue > 0
            ? Math.round((salesStats.totalCollected / salesStats.totalRevenue) * 100)
            : 0,
          totalSalesCount: salesStats.totalSalesCount,
        },
        currency,
        tenantId: user.tenantId,
      };

      const message = `PREVISION_DASHBOARD: ${JSON.stringify(payload)}`;

      const res = await apiClient.post('/ai/bridge', {
        chatInput: message,
        sessionId: `${user.tenantId}_forecast`,
        message,
        planId: user.planId || 'BASIC',
      });

      // apiClient retourne le JSON directement (pas d'enveloppe .data)
      // n8n peut retourner un objet OU un tableau [{...}]
      const rawRes = res ?? {};
      const data: any = Array.isArray(rawRes) ? (rawRes[0] ?? {}) : rawRes;
      // Si le fallback bridge a enveloppé dans { fromFallback, data: ... }
      const inner: any = data?.fromFallback ? (Array.isArray(data.data) ? (data.data[0] ?? {}) : (data.data ?? data)) : data;

      let parsed: any = null;

      // 1) Chercher la structure forecast dans toutes les enveloppes possibles
      const objCandidates = [inner, inner?.data, inner?.output, inner?.result, inner?.json];
      for (const c of objCandidates) {
        if (c && typeof c === 'object' && !Array.isArray(c) && (c.type === 'forecast' || c.forecast)) {
          parsed = c;
          break;
        }
      }

      // 2) JSON.parse sur tous les champs string
      if (!parsed) {
        const strCandidates = [
          inner?.formattedResponse, inner?.output, inner?.text, inner?.message,
          inner?.response, inner?.content,
          typeof inner === 'string' ? inner : null,
        ];
        for (const s of strCandidates) {
          if (typeof s === 'string' && s.trim().startsWith('{')) {
            try {
              const p = JSON.parse(s.trim());
              if (p && (p.type === 'forecast' || p.forecast)) { parsed = p; break; }
            } catch { /* ignore */ }
          }
        }
      }

      // 3) Extraction regex dans n'importe quelle string
      if (!parsed) {
        const allStrings = [
          inner?.formattedResponse, inner?.output, inner?.text, inner?.message,
          inner?.response, inner?.content,
          typeof inner === 'string' ? inner : null,
        ];
        for (const s of allStrings) {
          if (typeof s !== 'string') continue;
          const match = s.match(/\{[\s\S]*"forecast"[\s\S]*\}/);
          if (match) {
            try {
              const p = JSON.parse(match[0]);
              if (p?.forecast) { parsed = p; break; }
            } catch { /* ignore */ }
          }
        }
      }

      if (parsed?.forecast) {
        setForecast(parsed.forecast);
        setForecastTimestamp(new Date());
      } else {
        // Diagnostic : afficher les clés de la réponse pour aider au débogage
        const keys = Object.keys(inner || {}).join(', ') || '(vide)';
        const hint = inner?.formattedResponse?.slice?.(0, 150)
          || inner?.output?.toString?.()?.slice?.(0, 150)
          || inner?.message
          || inner?.error;
        const diagMsg = hint
          ? `Réponse reçue (clés: ${keys}) : ${hint}`
          : `Réponse inattendue. Clés reçues : ${keys}`;
        setForecastError(diagMsg);
        console.warn('[Forecast IA] Réponse brute complète:', rawRes);
      }
    } catch (err: any) {
      console.error('[Forecast IA]', err);
      setForecastError(err?.message || 'Erreur lors de la connexion au moteur IA.');
    } finally {
      setForecastLoading(false);
    }
  };

  const renderForecastPanel = () => {
    const SEVERITY_COLORS: Record<string, string> = {
      RUPTURE:  'bg-rose-600 text-white',
      CRITICAL: 'bg-rose-500 text-white',
      HIGH:     'bg-amber-500 text-white',
      MEDIUM:   'bg-amber-100 text-amber-700',
    };

    const fmtM = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
      return String(Math.round(n));
    };

    // Chart data: historique réel + prévisions
    const histData = revenueChartData.slice(-6).map(d => ({
      label: d.label, real: d.total || 0, collected: d.collected || 0, predicted: null,
    }));
    const predData = forecast?.predictions?.map((p: any) => ({
      label: p.label, real: null, collected: null, predicted: p.predicted,
      low: p.low, high: p.high,
    })) ?? [];
    const combinedChart = [...histData, ...predData];

    const trendColors: Record<string, string> = {
      HAUSSE: 'text-emerald-400',
      BAISSE: 'text-rose-400',
      STABLE: 'text-amber-400',
    };
    const trendIcons: Record<string, any> = {
      HAUSSE: TrendingUp,
      BAISSE: TrendingDown,
      STABLE: Activity,
    };
    const TrendIcon = forecast ? (trendIcons[forecast.trend] ?? TrendingUp) : TrendingUp;

    return (
      <div className="rounded-3xl overflow-hidden border border-indigo-900/30 shadow-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">

        {/* ── En-tête ── */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
              <BrainCircuit size={20} className="text-indigo-300" />
            </div>
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                Prévisions IA — Moteur Prédictif
              </h3>
              <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">
                {forecastTimestamp
                  ? `Calculé le ${forecastTimestamp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${forecastTimestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Analyse statistique de vos données réelles'}
              </p>
            </div>
          </div>

          <button
            onClick={loadForecast}
            disabled={forecastLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all text-white"
          >
            <RefreshCw size={13} className={forecastLoading ? 'animate-spin' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">
              {forecast ? 'Actualiser' : 'Générer les prévisions'}
            </span>
          </button>
        </div>

        {/* ── Corps ── */}
        {forecastError && !forecastLoading && (
          <div className="mx-6 mt-5 mb-2 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
            <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">Erreur IA</p>
              <p className="text-[10px] text-rose-200/70 font-medium leading-relaxed">{forecastError}</p>
              <p className="text-[9px] text-rose-300/50 mt-2 uppercase tracking-widest">Vérifiez que le workflow n8n est actif et que le prompt est à jour.</p>
            </div>
          </div>
        )}

        {!forecast && !forecastLoading && !forecastError && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-indigo-300 animate-pulse" />
            </div>
            <p className="text-[11px] font-black text-white/60 uppercase tracking-widest">
              Cliquez sur « Générer les prévisions » pour lancer l'analyse IA
            </p>
            <p className="text-[9px] text-indigo-400/60 font-bold uppercase tracking-widest mt-1">
              Basé sur votre historique de ventes et votre stock actuel
            </p>
          </div>
        )}

        {forecastLoading && (
          <div className="py-16 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-4 h-4 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-4 h-4 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-4 h-4 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.3em] animate-pulse">
              Analyse en cours · Moteur IA actif…
            </p>
          </div>
        )}

        {forecast && !forecastLoading && (
          <div className="p-6 space-y-6">

            {/* ── Résumé tendance ── */}
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
              <TrendIcon size={18} className={trendColors[forecast.trend] ?? 'text-white'} />
              <div className="flex-1">
                <span className={`text-sm font-black ${trendColors[forecast.trend] ?? 'text-white'}`}>
                  Tendance {forecast.trend}
                </span>
                {forecast.growthRate !== undefined && (
                  <span className="text-[10px] font-bold text-white/50 ml-2 uppercase">
                    {forecast.growthRate > 0 ? '+' : ''}{Number(forecast.growthRate).toFixed(1)}% · taux encaissement prévu {forecast.forecastedCollectionRate ?? '—'}%
                  </span>
                )}
              </div>
              {forecast.summary?.businessHealth !== undefined && (
                <div className="text-right flex-shrink-0">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Santé business</p>
                  <p className="text-lg font-black text-white">{forecast.summary.businessHealth}<span className="text-xs text-white/40">/100</span></p>
                </div>
              )}
            </div>

            {/* ── 3 cartes prévisions mensuelles ── */}
            <div className="grid grid-cols-3 gap-3">
              {(forecast.predictions ?? []).map((p: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-2xl p-4 border ${i === 0 ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/5 border-white/5'}`}
                >
                  <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest truncate mb-2">{p.label}</p>
                  <p className="text-xl font-black text-white tracking-tighter">{fmtM(p.predicted)}</p>
                  <p className="text-[8px] text-white/40 font-bold">{currency.split(' ')[0]}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${p.confidence}%` }} />
                    </div>
                    <span className="text-[8px] font-black text-indigo-300">{p.confidence}%</span>
                  </div>
                  <p className="text-[7px] text-white/25 mt-1">
                    {fmtM(p.low)} – {fmtM(p.high)} {currency.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Graphique historique + prévisions ── */}
            {combinedChart.length > 0 && (
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-3">
                  Historique réel + Projections IA
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={combinedChart}>
                      <defs>
                        <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false}
                        tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: 10, color: '#fff' }}
                        formatter={(v: any, name: string) => [
                          `${Number(v || 0).toLocaleString('fr-FR')} ${currency.split(' ')[0]}`,
                          name === 'real' ? 'CA Réel' : name === 'collected' ? 'Encaissé' : 'Prévision IA',
                        ]}
                      />
                      <Area type="monotone" dataKey="real" stroke="#6366f1" strokeWidth={2}
                        fill="url(#gradReal)" dot={false} connectNulls={false} />
                      <Area type="monotone" dataKey="predicted" stroke="#a855f7" strokeWidth={2}
                        strokeDasharray="6 3" fill="url(#gradPred)" dot={{ fill: '#a855f7', r: 4 }} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Risques stock + Recommandations ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Risques stock */}
              {(forecast.stockRisks ?? []).length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Risques de Rupture Stock
                  </p>
                  <div className="space-y-2">
                    {(forecast.stockRisks ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <span className={`text-[7px] font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${SEVERITY_COLORS[r.severity] ?? 'bg-slate-700 text-slate-300'}`}>
                          {r.daysToRupture <= 0 ? 'RUPTURE' : `${r.daysToRupture}j`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-white truncate">{r.product}</p>
                          <p className="text-[8px] text-white/40 font-bold">
                            Stock: {r.currentStock} · Seuil: {r.minThreshold ?? 5}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommandations */}
              {(forecast.recommendations ?? []).length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-amber-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Lightbulb size={11} /> Recommandations IA
                  </p>
                  <ul className="space-y-2">
                    {(forecast.recommendations ?? []).map((rec: string, i: number) => (
                      <li key={i} className="text-[10px] font-bold text-white/70 leading-relaxed">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // ADMIN / SUPER-ADMIN DASHBOARD
  // ============================================================
  const renderAdminDashboard = () => {
    const collectionRate = salesStats.totalRevenue > 0
      ? Math.round((salesStats.totalCollected / salesStats.totalRevenue) * 100) : 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-700">

        {/* BANNIÈRE ESSAI GRATUIT 14 JOURS */}
        {trialDaysLeft !== null && (
          <div className={`p-5 md:p-7 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl ${trialDaysLeft <= 3 ? 'bg-rose-50 border-rose-300' : trialDaysLeft <= 7 ? 'bg-amber-50 border-amber-300' : 'bg-indigo-50 border-indigo-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow ${trialDaysLeft <= 3 ? 'bg-rose-600' : trialDaysLeft <= 7 ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
                <Timer size={24} />
              </div>
              <div>
                <h3 className={`text-base font-black uppercase tracking-tight ${trialDaysLeft <= 3 ? 'text-rose-700' : trialDaysLeft <= 7 ? 'text-amber-700' : 'text-indigo-700'}`}>
                  {trialDaysLeft === 0 ? 'Essai expiré — Passez à un plan payant' : `Essai gratuit — ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} restant${trialDaysLeft > 1 ? 's' : ''}`}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {trialDaysLeft === 0
                    ? 'Votre accès est limité. Souscrivez pour continuer.'
                    : `Profitez de toutes les fonctionnalités gratuitement jusqu'à expiration.`}
                </p>
              </div>
            </div>
            <button onClick={() => onNavigate?.('subscription')}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg text-white transition-all ${trialDaysLeft <= 3 ? 'bg-rose-600 hover:bg-rose-700' : trialDaysLeft <= 7 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              <CreditCard size={14}/> Voir les plans
            </button>
          </div>
        )}

        {/* ALERTE ABONNEMENT */}
        {subAlert && subAlert.isCritical && (
          <div className={`p-5 md:p-7 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl ${subAlert.isExpired ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow ${subAlert.isExpired ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className={`text-base font-black uppercase tracking-tight ${subAlert.isExpired ? 'text-rose-700' : 'text-amber-700'}`}>
                  {subAlert.isExpired ? 'Abonnement Expiré' : `Abonnement expire dans ${subAlert.daysLeft} jours`}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {subAlert.isExpired ? `Instance en mode restreint depuis le ${subAlert.formattedDate}` : `Échéance le ${subAlert.formattedDate}`}
                </p>
              </div>
            </div>
            <button onClick={() => setShowPaymentModal(true)}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg ${subAlert.isExpired ? 'bg-rose-600 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700'} transition-all`}>
              <CreditCard size={14}/> Régulariser
            </button>
          </div>
        )}

        

        {/* ── SECTION SCOLAIRE — Le Toit des Anges ── */}
        <div className="bg-gradient-to-r from-indigo-900 to-violet-900 rounded-3xl p-6 text-white">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center"><GraduationCap size={20}/></div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-300">Tableau de bord scolaire</p>
                <h3 className="font-black text-lg uppercase tracking-tight">Le Toit des Anges</h3>
              </div>
            </div>
            <button onClick={() => onNavigate?.('eleves')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
              Voir élèves <ArrowRight size={14}/>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-2xl p-4 hover:bg-white/15 transition-all cursor-pointer" onClick={() => onNavigate?.('eleves')}>
              <div className="flex items-center gap-2 mb-2"><Baby size={16} className="text-indigo-300"/><p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Élèves actifs</p></div>
              <p className="text-3xl font-black">{schoolStats.eleveActifs.toLocaleString()}</p>
              {schoolStats.eleveEnAttente > 0 && <p className="text-[9px] text-amber-300 font-black mt-1">{schoolStats.eleveEnAttente} en attente d'admission</p>}
            </div>
            <div className="bg-white/10 rounded-2xl p-4 hover:bg-white/15 transition-all cursor-pointer" onClick={() => onNavigate?.('sales')}>
              <div className="flex items-center gap-2 mb-2"><BookOpen size={16} className="text-indigo-300"/><p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Facturé ce mois</p></div>
              <p className="text-3xl font-black">{fmtShort(schoolStats.totalFactureMois)}</p>
              <p className="text-[9px] text-indigo-300 font-black mt-1">{currency}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className={schoolStats.tauxRecouvrementMois >= 80 ? 'text-emerald-400' : 'text-rose-400'}/>
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Taux recouvrement</p>
              </div>
              <p className={`text-3xl font-black ${schoolStats.tauxRecouvrementMois >= 80 ? 'text-emerald-400' : 'text-rose-400'}`}>{schoolStats.tauxRecouvrementMois}%</p>
              <p className="text-[9px] text-indigo-300 font-black mt-1">{schoolStats.impayesMois} facture(s) non soldées</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-indigo-300"/><p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Prévisionnel annuel</p></div>
              <p className="text-3xl font-black">{fmtShort(schoolStats.prevAnnuel)}</p>
              <p className="text-[9px] text-indigo-300 font-black mt-1">{currency} — 10 mois projetés</p>
            </div>
          </div>
        </div>

        {/* ── ROW 1 : 8 KPI CARDS ── */}
        <div id="tour-kpi-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Chiffre d'Affaires" value={fmtShort(salesStats.totalRevenue) + ' ' + currency.split(' ')[0]} subValue={`${todayStats.count} facture(s) — ${todayStats.periodLabel}`} icon={TrendingUp} color="bg-indigo-600" trend="up" onClick={() => onNavigate?.('sales')}/>
          <StatCard title="Trésorerie Réelle" value={fmtShort(salesStats.totalCollected) + ' ' + currency.split(' ')[0]} subValue={`Taux encaissement : ${collectionRate}%`} icon={Wallet} color="bg-emerald-500" trend="up" onClick={() => onNavigate?.('payments')}/>
          <StatCard title="Mensualités Impayées" value={fmtShort(salesStats.totalUnpaid) + ' ' + currency.split(' ')[0]} subValue={`${salesStats.overdueCount} facture(s) en retard${selectedYear ? ' (historique)' : ''}`} icon={Landmark} color="bg-rose-500" trend="down" onClick={() => onNavigate?.('recovery')}/>
          <StatCard title={selectedYear ? `Factures ${todayStats.periodLabel}` : 'Factures du jour'} value={`${todayStats.count}`} subValue={fmtShort(todayStats.revenue) + ' ' + currency.split(' ')[0]} icon={ShoppingCart} color="bg-violet-500" trend={todayStats.count > 0 ? 'up' : undefined} onClick={() => onNavigate?.('sales')}/>
          <StatCard title="Élèves inscrits" value={(adminStats?.customersCount ?? customers.length).toLocaleString()} subValue={`${schoolStats.eleveActifs} actifs • ${schoolStats.eleveEnAttente} en attente`} icon={Users} color="bg-sky-500" onClick={() => onNavigate?.('eleves')}/>
          <StatCard title="Stock Fournitures" value={(adminStats?.stocksTotal ?? stocks.length).toLocaleString()} subValue={`${stockStats.out} rupture(s) • ${stockStats.low} alerte(s)`} icon={Package} color="bg-amber-500" trend={stockStats.out > 0 ? 'down' : 'up'} onClick={() => onNavigate?.('inventory')}/>
          <StatCard title="Utilisateurs" value={(adminStats?.usersCount ?? usersList.length).toLocaleString()} subValue="Accès actifs" icon={UserCheck} color="bg-slate-700" onClick={() => onNavigate?.('governance')}/>
          <StatCard title="Chèques en Transit" value={fmtShort(salesStats.totalChequesPending ?? 0) + ' ' + currency.split(' ')[0]} subValue="En attente d'encaissement" icon={Receipt} color="bg-amber-500" onClick={() => onNavigate?.('payments')}/>
        </div>

        {/* ── ROW 2 : REVENUE TREND + RECOVERY DONUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Tendance CA 6 mois */}
          <div id="tour-chart" className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={BarChart2} title={chartTitle} badge={isCurrentPeriod(filterState) ? 'Live' : 'Historique'} color="text-indigo-600"/>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueChartData.length > 0 ? revenueChartData : sales.filter((s: any) => s.status !== 'ANNULE').slice(-10).map((s: any) => ({
                  label: new Date(s.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }),
                  total: parseFloat(s.totalTtc),
                  collected: parseFloat(s.amountPaid || 0)
                }))}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}/>
                  <YAxis hide/>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: 11 }}
                    formatter={(v: any, name: string) => [`${Number(v).toLocaleString('fr-FR')} ${currency.split(' ')[0]}`, name === 'total' ? 'CA Facturé' : 'Encaissé']}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}
                    formatter={(val: string) => val === 'total' ? 'CA Facturé' : 'Encaissé'} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fill="url(#gradRevenue)"/>
                  <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" fill="url(#gradCollected)"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recouvrement Donut */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
            <SectionHeader icon={Scale} title="Recouvrement" color="text-emerald-600"/>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={salesStats.recoveryData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} startAngle={90} endAngle={-270}>
                      {salesStats.recoveryData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color}/>
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${Number(v).toLocaleString('fr-FR')} ${currency.split(' ')[0]}`}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full grid grid-cols-2 gap-3 mt-2">
                {salesStats.recoveryData.map((d: any) => (
                  <div key={d.name} className="text-center">
                    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: d.color }}/>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{d.name}</p>
                    <p className="text-xs font-black text-slate-800">{fmtShort(d.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3 : TOP DEBTORS + ACTIVITÉ RÉCENTE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Top Débiteurs */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={AlertCircle} title="Top Créances Clients" badge={`${topDebtors.length} clients`} color="text-rose-600"/>
            {topDebtors.length === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2"/>
                <p className="text-[10px] font-black text-slate-400 uppercase">Aucune créance en cours</p>
              </div>
            )}
            <div className="space-y-3">
              {topDebtors.map((d: any, i: number) => (
                <div key={d.id || i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-rose-50 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-[10px] flex-shrink-0">
                    {(d.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{d.name || 'Client'}</p>
                    <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                      <div className="bg-rose-500 h-1 rounded-full" style={{ width: `${Math.min(100, (d.total / (topDebtors[0]?.total || 1)) * 100)}%` }}/>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-black text-rose-600">{fmtShort(d.total)}</p>
                    <p className="text-[8px] text-slate-400">{currency.split(' ')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
            {topDebtors.length > 0 && (
              <button onClick={() => onNavigate?.('recovery')} className="mt-4 w-full py-3 border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center justify-center gap-2">
                Voir Recouvrement <ArrowRight size={12}/>
              </button>
            )}
          </div>

          {/* Flux d'Activité */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={Activity} title="Flux d'Activité Récent" badge="Temps réel" color="text-indigo-600"/>
            {activityFeed.length === 0 ? (
              <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase">Aucune activité récente</div>
            ) : (
              <div className="overflow-y-auto max-h-72 pr-1">
                {activityFeed.map((item: any, i: number) => (
                  <ActivityItem key={i} {...item} time={timeAgo(item.date)}/>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 4 : ALERTES STOCK + LEADERBOARD ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Alertes Stock */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={AlertTriangle} title="Alertes Stock" badge={`${stockStats.out + stockStats.low} items`} color="text-amber-600"/>
            {stockStats.out === 0 && stockStats.low === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2"/>
                <p className="text-[10px] font-black text-slate-400 uppercase">Stock en bonne santé</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stockAlerts.ruptures.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-rose-50 rounded-2xl border border-rose-100">
                    <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-800 truncate">{s.name}</p>
                      <p className="text-[8px] text-rose-600 font-bold uppercase">Rupture totale</p>
                    </div>
                    <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-lg">0</span>
                  </div>
                ))}
                {stockAlerts.low.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-800 truncate">{s.name}</p>
                      <p className="text-[8px] text-amber-600 font-bold uppercase">Sous le seuil min ({s.minThreshold})</p>
                    </div>
                    <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-lg">{s.currentLevel}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => onNavigate?.('inventory')} className="mt-4 w-full py-3 border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all flex items-center justify-center gap-2">
              Gérer le Stock <ArrowRight size={12}/>
            </button>
          </div>

          {/* Leaderboard Performance */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={Trophy} title="Classement Équipe" badge="Période totale" color="text-amber-600"/>
            <div className="space-y-3">
              {staffPerformance.slice(0, 5).map((staff: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-white hover:border hover:border-indigo-100 transition-all">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-800 shadow-sm text-sm uppercase">
                      {staff.name.charAt(0)}
                    </div>
                    {idx === 0 && <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white p-0.5 rounded-full border border-white shadow-sm"><Medal size={9}/></div>}
                    {idx === 1 && <div className="absolute -top-1.5 -right-1.5 bg-slate-400 text-white p-0.5 rounded-full border border-white shadow-sm"><Star size={9}/></div>}
                    {idx === 2 && <div className="absolute -top-1.5 -right-1.5 bg-orange-400 text-white p-0.5 rounded-full border border-white shadow-sm"><Star size={9}/></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-900 uppercase truncate">{staff.name}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{(staff.role || '').replace('_', ' ')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end text-indigo-600">
                      <Zap size={9} fill="currentColor"/>
                      <p className="text-xs font-black">{staff.score}</p>
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold">{staff.salesCount}v • {staff.movCount}f</p>
                  </div>
                </div>
              ))}
              {staffPerformance.length === 0 && (
                <div className="py-8 text-center text-slate-300 font-black uppercase text-[10px]">Aucune activité tracée</div>
              )}
            </div>
            <button onClick={() => onNavigate?.('governance')} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
              Gestion des Accès <ArrowRight size={12}/>
            </button>
          </div>
        </div>

        {/* ── ROW 5 : VENTES RÉCENTES + PAIEMENTS RÉCENTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Dernières Ventes */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={ShoppingBag} title="Dernières Ventes" badge={`30 derniers jours`} color="text-indigo-600"/>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="text-left text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Référence</th>
                    <th className="text-left text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Client</th>
                    <th className="text-right text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Montant</th>
                    <th className="text-center text-[8px] font-black text-slate-400 uppercase pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 8).map((s: any) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all">
                      <td className="py-2.5 pr-3 text-[10px] font-black text-slate-700">{s.reference || `#${s.id?.slice(-6)}`}</td>
                      <td className="py-2.5 pr-3 text-[10px] text-slate-500 truncate max-w-[120px]">{getCustomerName(s.customer) || 'N/A'}</td>
                      <td className="py-2.5 pr-3 text-[10px] font-black text-slate-800 text-right">{Number(s.totalTtc).toLocaleString('fr-FR')}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase ${
                          s.status === 'TERMINE' ? 'bg-emerald-100 text-emerald-700' :
                          s.status === 'EN_COURS' ? 'bg-amber-100 text-amber-700' :
                          s.status === 'ANNULE' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {s.status === 'TERMINE' ? 'Soldé' : s.status === 'EN_COURS' ? 'En cours' : s.status === 'ANNULE' ? 'Annulé' : s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sales.length === 0 && (
                <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase">Aucune vente récente</div>
              )}
            </div>
            <button onClick={() => onNavigate?.('sales')} className="mt-4 w-full py-2.5 border border-slate-200 rounded-2xl text-[9px] font-black uppercase text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2">
              Toutes les ventes <ArrowRight size={11}/>
            </button>
          </div>

          {/* Paiements Récents */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <SectionHeader icon={Receipt} title="Encaissements Récents" color="text-emerald-600"/>
            <div className="space-y-2">
              {latestPayments.slice(0, 8).map((p: any, i: number) => (
                <div key={p.id || i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={12} className="text-emerald-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{getCustomerName(p.customer) || 'Paiement'}</p>
                    <p className="text-[8px] text-slate-400">{timeAgo(p.createdAt)} · Vente #{p.saleId?.slice(-6) || '—'}</p>
                  </div>
                  <p className="text-[10px] font-black text-emerald-600 flex-shrink-0">+{Number(p.amount).toLocaleString('fr-FR')}</p>
                </div>
              ))}
              {latestPayments.length === 0 && (
                <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase">Aucun encaissement récent</div>
              )}
            </div>
            <button onClick={() => onNavigate?.('payments')} className="mt-4 w-full py-2.5 border border-slate-200 rounded-2xl text-[9px] font-black uppercase text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all flex items-center justify-center gap-2">
              Tous les paiements <ArrowRight size={11}/>
            </button>
          </div>
        </div>

        {/* PAYMENT MODAL */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-sm font-black uppercase">Paiement Wave</h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-1.5 hover:bg-white/10 rounded-xl transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="p-6">
                {paymentSuccess ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full mx-auto flex items-center justify-center mb-4"><CheckCircle2 size={28}/></div>
                    <h4 className="text-base font-black">Paiement enregistré</h4>
                    <p className="text-xs text-slate-500">En attente de validation.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                    <div className="flex flex-col items-center gap-3">
                      <img src={waveQr} alt="Wave QR" className="w-48 h-48 object-contain rounded-xl shadow border"/>
                      <p className="text-[9px] text-slate-500 text-center">Scannez avec l'app Wave puis saisissez la référence.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400">Téléphone (optionnel)</label>
                        <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="22177xxxxxxx" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none"/>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400">Référence Transaction</label>
                        <input value={txReference} onChange={e => setTxReference(e.target.value)} placeholder="Référence Wave" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none"/>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 font-black uppercase text-xs">Annuler</button>
                        <button disabled={isProcessingPayment} onClick={processSubscriptionPayment} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs disabled:opacity-50">
                          {isProcessingPayment ? '...' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PRÉVISIONS IA ── */}
        {renderForecastPanel()}
      </div>
    );
  };

  // ============================================================
  // ACCOUNTANT DASHBOARD
  // ============================================================
  const renderAccountantDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total des ventes" value={fmtShort(salesStats.totalRevenue) + ' ' + currency.split(' ')[0]} subValue="Période totale" icon={HandCoins} color="bg-indigo-600"/>
        <StatCard title="Total encaissé" value={fmtShort(salesStats.totalCollected) + ' ' + currency.split(' ')[0]} subValue="Cash flow réel" icon={PiggyBank} color="bg-emerald-600" trend="up"/>
        <StatCard title="Total impayé" value={fmtShort(salesStats.totalUnpaid) + ' ' + currency.split(' ')[0]} subValue="Balance débitrice" icon={Landmark} color="bg-rose-600" trend="down"/>
        <StatCard title="Factures en retard" value={salesStats.overdueCount} subValue="Actions requises" icon={Clock} color="bg-amber-500"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader icon={Scale} title="Encaissements vs Impayés" color="text-indigo-600"/>
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={salesStats.recoveryData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {salesStats.recoveryData.map((entry: any, i: number) => <Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip formatter={(v: any) => `${Number(v).toLocaleString('fr-FR')} ${currency.split(' ')[0]}`}/>
                <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader icon={ShoppingBag} title="Dernières Ventes" color="text-indigo-600"/>
          <div className="space-y-2 overflow-y-auto max-h-52">
            {sales.slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-800 truncate">{s.reference || `#${String(s.id).slice(-6)}`}</p>
                  <p className="text-[8px] text-slate-400">{getCustomerName(s.customer) || 'N/A'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-black text-slate-700">{Number(s.totalTtc).toLocaleString('fr-FR')}</p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${s.status === 'TERMINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.status === 'TERMINE' ? 'Soldé' : 'En cours'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRÉVISIONS IA ── */}
      {renderForecastPanel()}
    </div>
  );

  // ============================================================
  // STOCK MANAGER DASHBOARD
  // ============================================================
  const renderStockManagerDashboard = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Références" value={stocks.length} subValue="Catalogue actif" icon={Boxes} color="bg-indigo-600"/>
        <StatCard title="Ruptures" value={stockStats.out} subValue="Réappro. urgent" icon={AlertTriangle} color="bg-rose-600" trend="down"/>
        <StatCard title="Stocks faibles" value={stockStats.low} subValue="Sous seuil min." icon={TrendingDown} color="bg-amber-500"/>
        <StatCard title="Catégories" value={categories.length} subValue={`${subcategories.length} sous-catégories`} icon={Boxes} color="bg-slate-800"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader icon={AlertTriangle} title="Alertes Stock" color="text-amber-600"/>
          {stockAlerts.ruptures.length === 0 && stockAlerts.low.length === 0 ? (
            <div className="py-10 text-center"><CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2"/><p className="text-[10px] font-black text-slate-400 uppercase">Stock optimal</p></div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.ruptures.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"/>
                  <p className="text-[10px] font-black text-slate-800 flex-1 truncate">{s.name}</p>
                  <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-lg">RUPTURE</span>
                </div>
              ))}
              {stockAlerts.low.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"/>
                  <p className="text-[10px] font-black text-slate-800 flex-1 truncate">{s.name}</p>
                  <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-lg">{s.currentLevel} / {s.minThreshold}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader icon={History} title="Mouvements Récents" badge={`${movements.length}`} color="text-indigo-600"/>
          <div className="space-y-2 overflow-y-auto max-h-60">
            {movements.slice(0, 10).map((m: any, i: number) => (
              <div key={m.id || i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type === 'IN' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {m.type === 'IN' ? <ArrowUpCircle size={12} className="text-emerald-600"/> : <ArrowDownCircle size={12} className="text-rose-600"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-800 truncate">{m.productName || 'Produit'}</p>
                  <p className="text-[8px] text-slate-400">{m.userRef || 'Système'} • {timeAgo(m.createdAt)}</p>
                </div>
                <span className={`text-[9px] font-black ${m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {m.type === 'IN' ? '+' : '-'}{m.quantity}
                </span>
              </div>
            ))}
            {movements.length === 0 && <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase">Aucun mouvement récent</div>}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // SALES DASHBOARD
  // ============================================================
  const renderSalesDashboard = () => {
    const soldedCount = sales.filter((s: any) => s.status === 'TERMINE').length;
    const pendingCount = sales.filter((s: any) => s.status === 'EN_COURS').length;
    const collectionRate = salesStats.totalRevenue > 0
      ? Math.round((salesStats.totalCollected / salesStats.totalRevenue) * 100) : 0;
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        {/* Bannière Performance */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/5 rounded-full pointer-events-none"/>
          <div className="absolute -left-6 bottom-0 w-28 h-28 bg-white/5 rounded-full pointer-events-none"/>
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Performance Commerciale</p>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Tableau de Bord Ventes</h3>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="bg-white/20 border border-white/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{sales.length} transactions</span>
                <span className="bg-white/20 border border-white/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{collectionRate}% encaissé</span>
              </div>
            </div>
            <button onClick={() => onNavigate?.('sales')}
              className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-lg flex-shrink-0">
              <ShoppingCart size={14}/> Nouvelle Vente
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Chiffre d'Affaires" value={fmtShort(salesStats.totalRevenue) + ' ' + currency.split(' ')[0]} subValue="CA total période" icon={TrendingUp} color="bg-indigo-600" trend="up" onClick={() => onNavigate?.('sales')}/>
          <StatCard title="Encaissé" value={fmtShort(salesStats.totalCollected) + ' ' + currency.split(' ')[0]} subValue={`Taux : ${collectionRate}%`} icon={Wallet} color="bg-emerald-600" trend="up"/>
          <StatCard title="Clients" value={customers.length} subValue="Portefeuille actif" icon={UserCheck} color="bg-sky-600" onClick={() => onNavigate?.('customers')}/>
          <StatCard title="Panier Moyen" value={fmtShort(salesStats.avgBasket) + ' ' + currency.split(' ')[0]} subValue="Par transaction" icon={Target} color="bg-amber-500"/>
        </div>

        {/* Progression */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm col-span-1 md:col-span-2">
            <SectionHeader icon={ShoppingBag} title="Mes Dernières Ventes" color="text-indigo-600"/>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="text-left text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Référence</th>
                    <th className="text-left text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Client</th>
                    <th className="text-right text-[8px] font-black text-slate-400 uppercase pb-2 pr-3">Montant</th>
                    <th className="text-center text-[8px] font-black text-slate-400 uppercase pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all">
                      <td className="py-2.5 pr-3 text-[10px] font-black text-slate-700">{s.reference || `#${String(s.id).slice(-6)}`}</td>
                      <td className="py-2.5 pr-3 text-[10px] text-slate-500 truncate max-w-[120px]">{getCustomerName(s.customer) || 'N/A'}</td>
                      <td className="py-2.5 pr-3 text-[10px] font-black text-slate-800 text-right">{Number(s.totalTtc).toLocaleString('fr-FR')}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase ${s.status === 'TERMINE' ? 'bg-emerald-100 text-emerald-700' : s.status === 'EN_COURS' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {s.status === 'TERMINE' ? 'Soldé' : s.status === 'EN_COURS' ? 'En cours' : 'Annulé'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sales.length === 0 && <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase">Aucune vente enregistrée</div>}
            </div>
            <button onClick={() => onNavigate?.('sales')} className="mt-4 w-full py-2.5 border border-slate-200 rounded-2xl text-[9px] font-black uppercase text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2">
              Toutes les ventes <ArrowRight size={11}/>
            </button>
          </div>

          {/* Mini stats */}
          <div className="flex flex-col gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1">
              <SectionHeader icon={CheckCircle2} title="Résumé" color="text-emerald-600"/>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"/>
                    <span className="text-[10px] font-black text-slate-700 uppercase">Soldées</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600">{soldedCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400"/>
                    <span className="text-[10px] font-black text-slate-700 uppercase">En cours</span>
                  </div>
                  <span className="text-sm font-black text-amber-600">{pendingCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500"/>
                    <span className="text-[10px] font-black text-slate-700 uppercase">Impayé</span>
                  </div>
                  <span className="text-sm font-black text-rose-600">{fmtShort(salesStats.totalUnpaid)}</span>
                </div>
              </div>
            </div>
            <button onClick={() => onNavigate?.('customers')}
              className="bg-gradient-to-br from-sky-500 to-blue-600 text-white p-5 rounded-3xl shadow-md hover:shadow-xl hover:scale-[1.02] transition-all text-left">
              <Users size={20} className="mb-2 opacity-90"/>
              <p className="text-[11px] font-black uppercase tracking-tight">{customers.length} Clients</p>
              <p className="text-[9px] text-white/70 font-bold mt-1">Gérer le portefeuille</p>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // HR MANAGER DASHBOARD
  // ============================================================
  const renderHRManagerDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Bannière RH */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/5 rounded-full pointer-events-none"/>
        <div className="absolute -left-6 bottom-0 w-32 h-32 bg-white/5 rounded-full pointer-events-none"/>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Module Ressources Humaines</p>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Centre RH</h3>
            <p className="text-white/70 text-xs font-bold uppercase mt-1 tracking-widest">Gestion du Capital Humain</p>
          </div>
          <button onClick={() => onNavigate?.('rh')}
            className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/30 transition-all flex items-center gap-2 shadow-lg flex-shrink-0">
            <Users size={14}/> Tableau de Bord RH Complet
          </button>
        </div>
      </div>

      {/* Modules RH rapides */}
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Accès Modules RH</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { label: 'Employés', icon: Users, gradient: 'from-rose-500 to-pink-600', tab: 'rh.employees', desc: 'Gérer les employés' },
            { label: 'Congés', icon: Calendar, gradient: 'from-sky-500 to-blue-600', tab: 'rh.leaves', desc: 'Demandes en attente' },
            { label: 'Paie', icon: Wallet, gradient: 'from-emerald-500 to-teal-600', tab: 'rh.payroll.settings', desc: 'Gestion de la paie' },
            { label: 'Pointage', icon: Clock, gradient: 'from-violet-500 to-purple-600', tab: 'rh.attendance', desc: 'Suivi des présences' },
            { label: 'Contrats', icon: Briefcase, gradient: 'from-amber-400 to-orange-500', tab: 'rh.contracts', desc: 'Gérer les contrats' },
            { label: 'Fiches de Paie', icon: Receipt, gradient: 'from-indigo-500 to-blue-600', tab: 'rh.payroll.slips', desc: 'Bulletins de salaire' },
            { label: 'Documents', icon: FileText, gradient: 'from-slate-600 to-slate-800', tab: 'rh.docs', desc: 'Centre documentaire' },
            { label: 'Organigramme', icon: Building2, gradient: 'from-pink-500 to-rose-600', tab: 'rh.org', desc: "Structure d'entreprise" },
          ] as const).map(({ label, icon: Icon, gradient, tab, desc }) => (
            <button key={tab} onClick={() => onNavigate?.(tab)}
              className={`group bg-gradient-to-br ${gradient} text-white p-5 rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.03] transition-all text-left`}>
              <Icon size={20} className="mb-3 opacity-90"/>
              <p className="text-[11px] font-black uppercase tracking-tight leading-tight">{label}</p>
              <p className="text-[9px] text-white/70 font-bold mt-1">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Mes Congés" value="—" subValue="Consulter mes demandes" icon={Calendar} color="bg-sky-500" onClick={() => onNavigate?.('my-leaves')}/>
        <StatCard title="Avances Salariales" icon={HandCoins} value="—" subValue="Suivi des avances" color="bg-amber-500" onClick={() => onNavigate?.('rh.payroll.advances')}/>
        <StatCard title="Primes & Bonus" icon={Sparkles} value="—" subValue="Gestion des primes" color="bg-violet-600" onClick={() => onNavigate?.('rh.payroll.bonuses')}/>
      </div>
    </div>
  );

  // ============================================================
  // EMPLOYEE DASHBOARD
  // ============================================================
  const renderEmployeeDashboard = () => {
    const activeServices = services.filter((s: any) => s.isActive !== false);
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        {/* Bannière Mon Espace */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/5 rounded-full pointer-events-none"/>
          <div className="absolute -left-6 bottom-0 w-28 h-28 bg-white/5 rounded-full pointer-events-none"/>
          <div className="relative">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Mon Espace Collaborateur</p>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">{user.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="bg-white/20 border border-white/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Employé</span>
              <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                <MapPin size={10}/> {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Accès Rapide */}
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Accès Rapide</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: 'Mon Pointage', icon: Clock, gradient: 'from-violet-500 to-purple-600', tab: 'employee-pointage', desc: 'Enregistrer ma présence' },
              { label: 'Mes Congés', icon: Calendar, gradient: 'from-sky-500 to-blue-600', tab: 'my-leaves', desc: 'Demander un congé' },
              { label: 'Catalogue Produits', icon: Package, gradient: 'from-amber-400 to-orange-500', tab: 'inventory', desc: `${stocks.length} références dispo.` },
              { label: 'Base Clients', icon: Users, gradient: 'from-emerald-500 to-teal-600', tab: 'customers', desc: `${customers.length} clients enregistrés` },
            ] as const).map(({ label, icon: Icon, gradient, tab, desc }) => (
              <button key={tab} onClick={() => onNavigate?.(tab)}
                className={`group bg-gradient-to-br ${gradient} text-white p-5 rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.03] transition-all text-left`}>
                <Icon size={22} className="mb-3 opacity-90"/>
                <p className="text-[11px] font-black uppercase tracking-tight leading-tight">{label}</p>
                <p className="text-[9px] text-white/70 font-bold mt-1">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Produits Disponibles" value={stocks.length} subValue="Catalogue en rayon" icon={Package} color="bg-indigo-600" onClick={() => onNavigate?.('inventory')}/>
          <StatCard title="Services Actifs" value={activeServices.length} subValue="Offres disponibles" icon={Sparkles} color="bg-amber-500"/>
          <StatCard title="Base Partenaires" value={customers.length} subValue="Clients enregistrés" icon={Users} color="bg-emerald-600" onClick={() => onNavigate?.('customers')}/>
        </div>

        {/* Info / conseil */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Bell size={18}/>
          </div>
          <div>
            <p className="text-[11px] font-black text-indigo-800 uppercase tracking-wide">Bienvenue dans votre espace</p>
            <p className="text-[10px] text-indigo-600 font-semibold mt-1">Utilisez les raccourcis ci-dessus pour accéder à vos fonctionnalités. Pour tout besoin de congé ou signaler une présence, utilisez les modules dédiés.</p>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // ROUTER
  // ============================================================
  const activeDashboard = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <RefreshCw className="animate-spin text-indigo-600" size={40}/>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Chargement du Centre de Commandement...</p>
        </div>
      );
    }
    if (userRoles.includes(UserRole.SUPER_ADMIN) || userRoles.includes(UserRole.ADMIN))
      return <SchoolAdminDashboard user={user} currency={currency} onNavigate={onNavigate} />;
    if (userRoles.includes(UserRole.ACCOUNTANT)) return renderAccountantDashboard();
    if (userRoles.includes(UserRole.STOCK_MANAGER)) return renderStockManagerDashboard();
    if (userRoles.includes(UserRole.HR_MANAGER)) return renderHRManagerDashboard();
    if (userRoles.includes(UserRole.EMPLOYEE)) return renderEmployeeDashboard();
    return renderSalesDashboard();
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-rose-600 text-white',
    ADMIN: 'bg-indigo-600 text-white',
    HR_MANAGER: 'bg-pink-600 text-white',
    STOCK_MANAGER: 'bg-amber-500 text-white',
    ACCOUNTANT: 'bg-emerald-600 text-white',
    SALES: 'bg-teal-600 text-white',
    EMPLOYEE: 'bg-slate-700 text-white',
  };
  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrateur',
    HR_MANAGER: 'Responsable RH',
    STOCK_MANAGER: 'Gestionnaire Stock',
    ACCOUNTANT: 'Comptable',
    SALES: 'Commercial',
    EMPLOYEE: 'Employé',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">
            {greeting}, <span className="text-indigo-600">{user.name}</span>
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {userRoles.map(r => (
              <span key={r} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm ${roleColors[r] || 'bg-slate-200 text-slate-700'}`}>
                {roleLabels[r] || r.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[9px] font-black uppercase tracking-widest self-start md:self-auto">
          <ShieldCheck size={12}/> Connexion Sécurisée • Kernel v3.2.1
        </div>
      </div>

      {/* TIME MACHINE FILTER — visible pour tous les rôles */}
      <TimeMachineFilter value={filterState} onChange={setFilterState} />

      {/* BANNIÈRE ESSAI GRATUIT — visible pour tous les rôles non-admin aussi */}
      {trialDaysLeft !== null && !userRoles.includes(UserRole.ADMIN) && !userRoles.includes(UserRole.SUPER_ADMIN) && (
        <div className={`p-5 rounded-3xl border-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md ${trialDaysLeft <= 3 ? 'bg-rose-50 border-rose-300' : trialDaysLeft <= 7 ? 'bg-amber-50 border-amber-300' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow text-white ${trialDaysLeft <= 3 ? 'bg-rose-600' : trialDaysLeft <= 7 ? 'bg-amber-500' : 'bg-indigo-600'}`}>
              <Timer size={20} />
            </div>
            <div>
              <p className={`text-sm font-black uppercase tracking-tight ${trialDaysLeft <= 3 ? 'text-rose-700' : trialDaysLeft <= 7 ? 'text-amber-700' : 'text-indigo-700'}`}>
                {trialDaysLeft === 0 ? 'Essai expiré' : `Essai gratuit — ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} restant${trialDaysLeft > 1 ? 's' : ''}`}
              </p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Contactez l'administrateur pour renouveler l'accès.</p>
            </div>
          </div>
        </div>
      )}

      {activeDashboard()}
    </div>
  );
};

export default Dashboard;
