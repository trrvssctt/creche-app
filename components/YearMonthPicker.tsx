import React from 'react';
import { Calendar } from 'lucide-react';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

interface YearMonthPickerProps {
  dataYears: number[];
  selectedYear: number | null;
  selectedMonth: number | null;
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: number | null) => void;
}

const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  dataYears,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from(new Set([...dataYears, currentYear])).sort((a, b) => b - a);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Calendar size={13} className="text-indigo-400"/>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Période</span>
      </div>

      {/* Year buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => { onYearChange(null); onMonthChange(null); }}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
            selectedYear === null
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
          }`}
        >
          Tout
        </button>
        {years.map(y => (
          <button
            key={y}
            onClick={() => {
              if (selectedYear === y) { onYearChange(null); onMonthChange(null); }
              else { onYearChange(y); onMonthChange(null); }
            }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedYear === y
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month buttons — only when a year is selected */}
      {selectedYear !== null && (
        <div className="flex flex-wrap gap-1">
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => onMonthChange(selectedMonth === i ? null : i)}
              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${
                selectedMonth === i
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default YearMonthPicker;
