import React from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Zap,
  RotateCcw, BarChart3, CalendarDays, CalendarClock, History
} from 'lucide-react';

export type FilterMode = 'all' | 'year' | 'quarter' | 'month' | 'day';

export interface FilterState {
  mode: FilterMode;
  year: number | null;
  quarter: number | null; // 1-4
  month: number | null;   // 0-11
  day: number | null;     // 1-31
}

const MONTHS_S = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_F = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const QTR_RANGES = ['Jan – Mar','Avr – Jun','Jul – Sep','Oct – Déc'];

const _n = new Date();
export const NOW_FILTER = {
  y: _n.getFullYear(),
  m: _n.getMonth(),
  d: _n.getDate(),
  q: Math.ceil((_n.getMonth() + 1) / 3),
};

export const DEFAULT_FILTER: FilterState = {
  mode: 'year',
  year: NOW_FILTER.y,
  quarter: null,
  month: null,
  day: null,
};

export function getPeriodLabel(s: FilterState): string {
  if (s.mode === 'all') return 'Toute la période';
  if (s.mode === 'year') return `Année ${s.year}`;
  if (s.mode === 'quarter' && s.quarter != null)
    return `T${s.quarter} ${s.year}  ·  ${QTR_RANGES[s.quarter - 1]}`;
  if (s.mode === 'month' && s.year != null && s.month != null)
    return `${MONTHS_F[s.month]} ${s.year}`;
  if (s.mode === 'day' && s.year != null && s.month != null && s.day != null)
    return new Date(s.year, s.month, s.day).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  return '—';
}

export function isCurrentPeriod(s: FilterState): boolean {
  if (s.mode === 'all') return true;
  if (s.mode === 'year') return s.year === NOW_FILTER.y;
  if (s.mode === 'quarter') return s.year === NOW_FILTER.y && s.quarter === NOW_FILTER.q;
  if (s.mode === 'month') return s.year === NOW_FILTER.y && s.month === NOW_FILTER.m;
  if (s.mode === 'day') return s.year === NOW_FILTER.y && s.month === NOW_FILTER.m && s.day === NOW_FILTER.d;
  return false;
}

function navigate(s: FilterState, dir: -1 | 1): FilterState {
  const n = { ...s };
  if (n.mode === 'year') {
    n.year = (n.year ?? NOW_FILTER.y) + dir;
  } else if (n.mode === 'quarter') {
    let q = (n.quarter ?? NOW_FILTER.q) + dir;
    let y = n.year ?? NOW_FILTER.y;
    if (q < 1) { q = 4; y--; }
    if (q > 4) { q = 1; y++; }
    n.quarter = q; n.year = y;
  } else if (n.mode === 'month') {
    let m = (n.month ?? NOW_FILTER.m) + dir;
    let y = n.year ?? NOW_FILTER.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    n.month = m; n.year = y;
  } else if (n.mode === 'day') {
    const dt = new Date(n.year ?? NOW_FILTER.y, n.month ?? NOW_FILTER.m, n.day ?? NOW_FILTER.d);
    dt.setDate(dt.getDate() + dir);
    n.year = dt.getFullYear();
    n.month = dt.getMonth();
    n.day = dt.getDate();
  }
  return n;
}

function toPresent(mode: FilterMode): FilterState {
  if (mode === 'all') return { mode: 'all', year: null, quarter: null, month: null, day: null };
  if (mode === 'year') return { mode: 'year', year: NOW_FILTER.y, quarter: null, month: null, day: null };
  if (mode === 'quarter') return { mode: 'quarter', year: NOW_FILTER.y, quarter: NOW_FILTER.q, month: null, day: null };
  if (mode === 'month') return { mode: 'month', year: NOW_FILTER.y, quarter: null, month: NOW_FILTER.m, day: null };
  return { mode: 'day', year: NOW_FILTER.y, quarter: null, month: NOW_FILTER.m, day: NOW_FILTER.d };
}

function switchMode(current: FilterState, mode: FilterMode): FilterState {
  // Preserve year context when switching between modes
  const y = current.year ?? NOW_FILTER.y;
  if (mode === 'all') return { mode: 'all', year: null, quarter: null, month: null, day: null };
  if (mode === 'year') return { mode: 'year', year: y, quarter: null, month: null, day: null };
  if (mode === 'quarter') return { mode: 'quarter', year: y, quarter: NOW_FILTER.q, month: null, day: null };
  if (mode === 'month') return { mode: 'month', year: y, quarter: null, month: NOW_FILTER.m, day: null };
  return { mode: 'day', year: y, quarter: null, month: NOW_FILTER.m, day: NOW_FILTER.d };
}

const MODES: { key: FilterMode; label: string; icon: React.ElementType }[] = [
  { key: 'all',     label: 'Tout',       icon: History },
  { key: 'day',     label: 'Jour',       icon: CalendarClock },
  { key: 'month',   label: 'Mois',       icon: CalendarDays },
  { key: 'quarter', label: 'Trimestre',  icon: BarChart3 },
  { key: 'year',    label: 'Année',      icon: Zap },
];

interface Props {
  value: FilterState;
  onChange: (s: FilterState) => void;
}

const TimeMachineFilter: React.FC<Props> = ({ value, onChange }) => {
  const live = isCurrentPeriod(value);
  const showNav = value.mode !== 'all';

  const isFuture = (() => {
    if (value.mode === 'year' && value.year != null) return value.year > NOW_FILTER.y;
    if (value.mode === 'quarter' && value.year != null && value.quarter != null) {
      return value.year > NOW_FILTER.y || (value.year === NOW_FILTER.y && value.quarter > NOW_FILTER.q);
    }
    if (value.mode === 'month' && value.year != null && value.month != null) {
      return value.year > NOW_FILTER.y || (value.year === NOW_FILTER.y && value.month > NOW_FILTER.m);
    }
    if (value.mode === 'day' && value.year != null && value.month != null && value.day != null) {
      const sel = new Date(value.year, value.month, value.day);
      const tod = new Date(NOW_FILTER.y, NOW_FILTER.m, NOW_FILTER.d);
      return sel > tod;
    }
    return false;
  })();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md bg-white">

      {/* ── HEADER STRIP ── */}
      <div
        className={`px-5 py-3 flex items-center justify-between transition-all duration-500 ${
          live
            ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700'
            : isFuture
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
            : 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {live ? (
            <Zap size={14} className="text-white" />
          ) : isFuture ? (
            <Zap size={14} className="text-white" />
          ) : (
            <Clock size={14} className="text-amber-300" />
          )}
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white">
            {live ? 'Tableau de bord en direct' : isFuture ? 'Projection future' : 'Machine à remonter le temps'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {live ? (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
              </span>
              <span className="text-[9px] font-black text-white uppercase tracking-widest">En Direct</span>
            </div>
          ) : (
            <button
              onClick={() => onChange(toPresent(value.mode))}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/25 px-3 py-1.5 rounded-full transition-all group"
            >
              <RotateCcw size={10} className="text-white/80 group-hover:text-white group-hover:rotate-180 transition-transform duration-300" />
              <span className="text-[9px] font-black text-white/80 group-hover:text-white uppercase tracking-widest">
                Retour au présent
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-4 space-y-3">

        {/* Mode tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mr-2 hidden sm:block">
            Granularité
          </span>
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onChange(switchMode(value, key))}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                value.mode === key
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              <Icon size={10} />
              {label}
            </button>
          ))}
        </div>

        {/* Navigation row */}
        {showNav && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange(navigate(value, -1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 transition-all duration-200 shadow-sm flex-shrink-0"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1 min-w-0 text-center py-1">
              <p
                className={`text-sm md:text-base font-black uppercase tracking-tight truncate transition-colors duration-300 ${
                  live ? 'text-slate-900' : isFuture ? 'text-amber-600' : 'text-indigo-600'
                }`}
              >
                {getPeriodLabel(value)}
              </p>
              {!live && value.mode !== 'all' && (
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center justify-center gap-1">
                  {isFuture ? (
                    <><Zap size={8} className="text-amber-400" /> Période future</>
                  ) : (
                    <><Clock size={8} /> Consultation historique</>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={() => onChange(navigate(value, 1))}
              disabled={isFuture && value.mode === 'day'}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 transition-all duration-200 shadow-sm flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── SUB-SELECTOR : MONTH mode → show month grid ── */}
        {value.mode === 'month' && (
          <>
            <div className="flex flex-wrap gap-1">
              {MONTHS_S.map((m, i) => {
                const isSelected = value.month === i;
                const isCurrent = value.year === NOW_FILTER.y && i === NOW_FILTER.m;
                return (
                  <button
                    key={i}
                    onClick={() => onChange({ ...value, month: i })}
                    className={`relative px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wide transition-all duration-200 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100'
                    }`}
                  >
                    {m}
                    {isCurrent && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Year navigation for month mode */}
            <div className="flex items-center justify-center gap-3 pt-0.5">
              <button
                onClick={() => onChange({ ...value, year: (value.year ?? NOW_FILTER.y) - 1 })}
                className="text-[9px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                <ChevronLeft size={11} />
                {(value.year ?? NOW_FILTER.y) - 1}
              </button>
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-full">
                {value.year}
              </span>
              <button
                onClick={() => onChange({ ...value, year: (value.year ?? NOW_FILTER.y) + 1 })}
                className="text-[9px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                {(value.year ?? NOW_FILTER.y) + 1}
                <ChevronRight size={11} />
              </button>
            </div>
          </>
        )}

        {/* ── SUB-SELECTOR : QUARTER mode → show quarter cards ── */}
        {value.mode === 'quarter' && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {(['T1', 'T2', 'T3', 'T4'] as const).map((q, i) => {
                const isSelected = value.quarter === i + 1;
                const isCurrent = value.year === NOW_FILTER.y && NOW_FILTER.q === i + 1;
                return (
                  <button
                    key={q}
                    onClick={() => onChange({ ...value, quarter: i + 1 })}
                    className={`relative py-2.5 rounded-xl text-center transition-all duration-200 ${
                      isSelected
                        ? 'bg-indigo-600 shadow-sm shadow-indigo-200'
                        : 'bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200'
                    }`}
                  >
                    {isCurrent && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
                    )}
                    <p className={`text-[11px] font-black uppercase ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                      {q}
                    </p>
                    <p className={`text-[7px] font-bold mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {QTR_RANGES[i]}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Year navigation for quarter mode */}
            <div className="flex items-center justify-center gap-3 pt-0.5">
              <button
                onClick={() => onChange({ ...value, year: (value.year ?? NOW_FILTER.y) - 1 })}
                className="text-[9px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                <ChevronLeft size={11} />
                {(value.year ?? NOW_FILTER.y) - 1}
              </button>
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-full">
                {value.year}
              </span>
              <button
                onClick={() => onChange({ ...value, year: (value.year ?? NOW_FILTER.y) + 1 })}
                className="text-[9px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                {(value.year ?? NOW_FILTER.y) + 1}
                <ChevronRight size={11} />
              </button>
            </div>
          </>
        )}

        {/* ── SUB-SELECTOR : DAY mode → date picker ── */}
        {value.mode === 'day' && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="date"
                value={
                  value.year != null && value.month != null && value.day != null
                    ? `${value.year}-${String(value.month + 1).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
                    : ''
                }
                onChange={(e) => {
                  if (!e.target.value) return;
                  // Parse as local date to avoid timezone issues
                  const [y, mo, d] = e.target.value.split('-').map(Number);
                  onChange({ mode: 'day', year: y, month: mo - 1, day: d, quarter: null });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              />
            </div>

            {/* Quick jumps */}
            <div className="flex items-center gap-1">
              {[
                { label: 'Hier', offset: -1 },
                { label: 'Avant-hier', offset: -2 },
              ].map(({ label, offset }) => {
                const dt = new Date(NOW_FILTER.y, NOW_FILTER.m, NOW_FILTER.d + offset);
                return (
                  <button
                    key={label}
                    onClick={() =>
                      onChange({
                        mode: 'day',
                        year: dt.getFullYear(),
                        month: dt.getMonth(),
                        day: dt.getDate(),
                        quarter: null,
                      })
                    }
                    className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-xl text-[8px] font-black uppercase tracking-wide transition-all whitespace-nowrap"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Quick presets strip ── */}
        <div className="flex flex-wrap gap-1 pt-0.5 border-t border-slate-50">
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest self-center mr-1">
            Accès rapide
          </span>
          {[
            {
              label: 'Ce mois',
              action: () => onChange({ mode: 'month', year: NOW_FILTER.y, month: NOW_FILTER.m, quarter: null, day: null }),
            },
            {
              label: 'Mois passé',
              action: () => {
                const m = NOW_FILTER.m === 0 ? 11 : NOW_FILTER.m - 1;
                const y = NOW_FILTER.m === 0 ? NOW_FILTER.y - 1 : NOW_FILTER.y;
                onChange({ mode: 'month', year: y, month: m, quarter: null, day: null });
              },
            },
            {
              label: `T${NOW_FILTER.q}`,
              action: () => onChange({ mode: 'quarter', year: NOW_FILTER.y, quarter: NOW_FILTER.q, month: null, day: null }),
            },
            {
              label: `T${NOW_FILTER.q === 1 ? 4 : NOW_FILTER.q - 1} passé`,
              action: () => {
                const q = NOW_FILTER.q === 1 ? 4 : NOW_FILTER.q - 1;
                const y = NOW_FILTER.q === 1 ? NOW_FILTER.y - 1 : NOW_FILTER.y;
                onChange({ mode: 'quarter', year: y, quarter: q, month: null, day: null });
              },
            },
            {
              label: `${NOW_FILTER.y}`,
              action: () => onChange({ mode: 'year', year: NOW_FILTER.y, quarter: null, month: null, day: null }),
            },
            {
              label: `${NOW_FILTER.y - 1}`,
              action: () => onChange({ mode: 'year', year: NOW_FILTER.y - 1, quarter: null, month: null, day: null }),
            },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimeMachineFilter;
