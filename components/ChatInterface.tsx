/**
 * ChatInterface.tsx — Kernel IA Orchestrator
 * 
 * Assistant IA d'analyse métier (vente, stock, RH) pour un SaaS.
 * 
 * Architecture :
 * - Sous-composants isolés : ChatHeader, MessageBubble, VisualBlock, MarkdownRenderer
 * - Helpers purs et testables : parseStructuredFormatted, arrayToCSV, formatStatValue, safeStr, detectChartType
 * - Zéro objet affiché dans les tooltips Recharts
 * - Responsive, accessible (aria-label, role, keyboard), dark-mode ready
 * - Exports CSV / XLSX / PNG robustes
 * - Scroll automatique, plein écran, mobile-first
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  MessageSquare, Send, X, Bot, Sparkles,
  BarChart3, Table as TableIcon, Activity,
  Loader2, Maximize2, Minimize2, Download,
  AlertCircle, ChevronDown,
} from 'lucide-react';
import { getAIResponse, AIChatResponse, cleanProfessionalText, fetchChatHistory } from '../services/geminiService';
import { apiClient } from '../services/api';
import { UserRole } from '../types';
import DocumentPreview from './DocumentPreview';
import {
  ResponsiveContainer,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
  PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
} from 'recharts';

// ─────────────────────────────────────────────
// ThinkingBubble — animation pendant le chargement IA
// ─────────────────────────────────────────────

const THINKING_PHRASES = [
  { text: "Un instant…",                    sub: "Je consulte vos données" },
  { text: "Je réfléchis…",                  sub: "Analyse en cours" },
  { text: "J'analyse vos chiffres…",        sub: "Croisement des indicateurs" },
  { text: "Ça arrive…",                     sub: "Encore quelques secondes" },
  { text: "Je prépare votre réponse…",      sub: "Mise en forme finale" },
  { text: "Je croise les données…",         sub: "Calculs statistiques" },
  { text: "Presque prêt…",                  sub: "Dernière vérification" },
  { text: "Je consulte votre base…",        sub: "Requête en cours" },
  { text: "Analyse approfondie…",           sub: "Traitement des résultats" },
  { text: "Je génère votre rapport…",       sub: "Mise en page du document" },
];

const ThinkingBubble = memo(() => {
  const [phraseIdx, setPhraseIdx]   = useState(0);
  const [visible,   setVisible]     = useState(true);
  const [barWidth,  setBarWidth]    = useState(15);

  // Cycle des phrases avec fondu
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIdx(i => (i + 1) % THINKING_PHRASES.length);
        setVisible(true);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Barre de progression simulée (monte lentement, jamais 100 %)
  useEffect(() => {
    setBarWidth(15);
    const timer = setInterval(() => {
      setBarWidth(w => {
        if (w >= 88) return 88;
        return w + Math.random() * 4;
      });
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const { text, sub } = THINKING_PHRASES[phraseIdx];

  return (
    <div className="flex items-end gap-2 justify-start" role="status" aria-live="polite" aria-label="L'assistant réfléchit">
      {/* Avatar pulsant */}
      <div className="relative flex-shrink-0 mb-1">
        <div className="absolute inset-0 rounded-xl bg-indigo-500 opacity-30 animate-ping" />
        <div className="relative w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
          <Bot size={15} className="text-white" />
        </div>
      </div>

      {/* Bulle */}
      <div className="max-w-[240px] px-4 py-3 bg-white rounded-3xl rounded-bl-lg border border-slate-200 shadow-sm overflow-hidden">

        {/* Phrase cyclique */}
        <p
          className="text-[12px] font-700 text-slate-800 leading-snug transition-all duration-300"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}
        >
          {text}
        </p>
        <p
          className="text-[10px] text-slate-400 font-medium mt-0.5 transition-all duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {sub}
        </p>

        {/* Barre de progression */}
        <div className="mt-2.5 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${barWidth}%`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
        </div>

        {/* Dots */}
        <div className="flex gap-1 mt-2.5 justify-center">
          {[0, 200, 400].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              style={{
                animation: `thinking-dot 1.2s ease-in-out ${delay}ms infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS injecté une seule fois */}
      <style>{`
        @keyframes thinking-dot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
});
ThinkingBubble.displayName = 'ThinkingBubble';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

// Tous les formats produits par le workflow n8n v2 + anciens formats pour rétrocompatibilité
type MessageFormat =
  | 'general' | 'list' | 'table' | 'stats' | 'excel'
  // Graphiques — workflow v2
  | 'chart' | 'bar_chart' | 'histogram' | 'donut_chart' | 'multi_chart' | 'heatmap'
  // Anciens formats / rétrocompat
  | 'advanced_chart' | 'advancedchart' | 'chart_advanced'
  // Documents
  | 'document_invoice' | 'document_delivery' | 'document_payslip' | 'document_report'
  | 'document_html'   // Format généré par le nœud "Generate Document HTML" n8n
  | 'prediction' | 'trend'  // Régression linéaire + prévision (Phase 3)
  | 'error' | 'empty';

interface Message {
  role: 'user' | 'ai';
  formattedResponse: string;
  format: MessageFormat;
  rawResults?: any[];
  downloadUrl?: string;
  documentHtml?: string;
  // Génération en masse
  isMultiDoc?: boolean;
  documentArray?: Array<{ html: string; title: string; filename: string }>;
  documentCount?: number;
  createZip?: boolean;
  // Données structurées pour DocumentPreview React (persistance rechargement)
  documentData?: {
    type: 'FACTURE' | 'RECU' | 'BON_SORTIE' | 'SUBSCRIPTION_INVOICE';
    sale: Record<string, any>;
    tenant: Record<string, any>;
    currency: string;
  };
  resultCount: number;
  status: 'SUCCESS' | 'ERROR';
  mode?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface ParsedStructured {
  text: string | null;
  format: string | null;
  rawResults?: any[];
}

interface ChartMeta {
  // Champs de base
  xAxis?: string;
  yAxis?: string | string[];
  series?: Array<{ key: string; type?: string; color?: string; label?: string; yAxisId?: string }> | string[];
  chartType?: string;
  type?: string; // alias de chartType dans chart_config
  colors?: string[];
  // Champs enrichis workflow n8n v2
  horizontal?: boolean;
  dataLabels?: boolean;
  dual_axis?: boolean;
  nameKey?: string;
  valueKey?: string;
  smooth?: boolean;
  // Histogramme spécifique
  barGap?: number;              // 0 = barres jointives (style histogramme)
  secondaryAxis?: string;       // colonne pour la ligne secondaire (ex: montant_total)
  showSecondaryLine?: boolean;  // affiche une courbe de tendance en overlay
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

/** Palette harmonieuse, accessible (WCAG AA), personnalisable via meta.colors */
const CHART_COLORS = ['#818cf8', '#06b6d4', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#4ade80', '#fb923c', '#60a5fa', '#f472b6'];

const SAMPLE_QUESTIONS = [
  'Top 5 produits vendus ce mois-ci',
  'Montant total des factures impayées',
  'Articles en rupture de stock ?',
  'Prévision de stock 30 prochains jours',
];

// ─────────────────────────────────────────────
// Helpers purs (facilement testables avec Jest)
// ─────────────────────────────────────────────

/**
 * Convertit n'importe quelle valeur en string sûre pour les tooltips.
 * Évite l'erreur "Objects are not valid as a React child".
 */
export const safeStr = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * Formate une valeur numérique avec séparateurs locaux.
 * Utilisé dans les cartes stats.
 */
export const formatStatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]+/g, '');
    const n = Number(cleaned);
    if (!Number.isNaN(n) && /^[-0-9,.]+$/.test(v.trim())) return n.toLocaleString('fr-FR');
    return v;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * Génère un CSV robuste depuis un tableau d'objets.
 * Gère les valeurs null/undefined, les virgules, les guillemets.
 */
export const arrayToCSV = (arr: Record<string, unknown>[]): string => {
  if (!arr?.length) return '';
  const keys = Array.from(
    arr.reduce<Set<string>>((acc, row) => {
      Object.keys(row ?? {}).forEach(k => acc.add(k));
      return acc;
    }, new Set<string>())
  );
  const escape = (v: unknown) => {
    const s = safeStr(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    keys.join(','),
    ...arr.map(row => keys.map(k => escape(row[k])).join(',')),
  ].join('\n');
};

/**
 * Détecte le type de graphique Recharts à rendre.
 * Priorité : meta.type / meta.chartType → format string → détection auto structure.
 * Couvre tous les formats produits par le workflow n8n v2.
 */
export const detectChartType = (
  data: Record<string, unknown>[],
  meta: ChartMeta,
  format: string
): 'bar' | 'area' | 'pie' | 'composed' => {
  // 1. Priorité aux instructions explicites de la méta chart_config
  const explicitType = (meta.type ?? meta.chartType ?? '').toLowerCase();
  if (explicitType === 'bar') return 'bar';
  if (explicitType === 'pie' || explicitType === 'donut') return 'pie';
  if (explicitType === 'area' || explicitType === 'line') return 'area';
  if (explicitType === 'composed') return 'composed';

  // 2. Déduction depuis le nom du format n8n
  if (format === 'bar_chart') return 'bar';
  if (format === 'histogram') return 'bar'; // histogramme → rendu BarChart avec barGap=0
  if (format === 'donut_chart') return 'pie';
  if (format === 'multi_chart') return 'composed';
  if (['advanced_chart', 'advancedchart', 'chart_advanced'].includes(format)) return 'bar';

  // 3. Détection auto : 2 colonnes (string + number) → donut
  const keys = Object.keys(data[0] ?? {});
  if (keys.length === 2) {
    const sample = data[0];
    const v1 = sample[keys[0]]; const v2 = sample[keys[1]];
    if (typeof v1 === 'string' && (typeof v2 === 'number' || !isNaN(Number(v2)))) return 'pie';
  }

  // 4. Défaut : courbe area
  return 'area';
};

/**
 * Nettoie et parse la réponse IA, qui peut être du JSON brut ou du texte.
 * Retourne toujours un objet safe avec text, format et rawResults.
 */
export const parseStructuredFormatted = (formatted: string): ParsedStructured => {
  if (!formatted || typeof formatted !== 'string') {
    return { text: formatted || '', format: null };
  }

  // Supprime les balises markdown de code fences et préfixes courants
  let trimmed = formatted.trim()
    .replace(/^```(?:json|js|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^json\s+/i, '')
    .trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { text: trimmed, format: null };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    // Cas tableau racine → format list ou table
    if (Array.isArray(parsed)) {
      return { text: null, format: 'list', rawResults: parsed };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { text: trimmed, format: null };
    }

    const obj = parsed as Record<string, unknown>;

    // Extraction du texte principal
    const TEXT_KEYS = ['response', 'formattedResponse', 'formatted_response', 'finalresponse',
      'finalResponse', 'final_response', 'final', 'message', 'text', 'summary'];
    const textKey = TEXT_KEYS.find(k => obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim().length > 0);
    let text: string | null = textKey ? safeStr(obj[textKey]) : null;

    // Extraction des données brutes
    let rawResults = (obj.rawResults ?? obj.data ?? obj.results ?? obj.rows) as any[] | undefined;
    if (Array.isArray(rawResults)) {
      // Supprime les métadonnées internes de chaque ligne
      rawResults = rawResults.map(row => {
        if (row && typeof row === 'object' && '_metadata' in row) {
          const { _metadata, ...rest } = row as Record<string, unknown>;
          return rest;
        }
        return row;
      });
    }

    const format = (obj.format ?? obj.type ?? (Array.isArray(rawResults) ? 'table' : null)) as string | null;

    if (!text && rawResults) {
      text = safeStr(obj.summary ?? obj.title) || `Résultats : ${Array.isArray(rawResults) ? rawResults.length : 1}`;
    }

    if (!text) {
      const keys = Object.keys(obj).filter(k => !['data', 'results', 'rows', 'rawResults'].includes(k));
      text = keys.length
        ? keys.map(k => `**${k}** : ${typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : safeStr(obj[k])}`).join('\n')
        : 'Réponse structurée reçue.';
    }

    return { text, format, rawResults };
  } catch {
    return { text: 'Réponse structurée (format non exploitable).', format: null };
  }
};

/**
 * Extrait le premier tableau Markdown d'un texte et le convertit en array d'objets.
 * Utile pour proposer l'export CSV/XLSX sur les tableaux inline.
 */
export const parseMarkdownTableToData = (content: string | undefined): Record<string, string>[] | null => {
  if (!content) return null;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1] ?? '';
    if (lines[i].includes('|') && /(^|\s)\|?\s*[-:]{3,}/.test(next.replace(/\s*\|\s*/g, '|'))) {
      const splitRow = (l: string) => {
        let cells = l.split('|').map(c => c.trim());
        if (cells[0] === '') cells = cells.slice(1);
        if (cells[cells.length - 1] === '') cells = cells.slice(0, -1);
        return cells;
      };
      const tableLines: string[] = [lines[i], next];
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|')) tableLines.push(lines[j++]);
      const header = splitRow(tableLines[0]);
      return tableLines.slice(2).map(l => {
        const cells = splitRow(l);
        return Object.fromEntries(header.map((h, ci) => [h || `col${ci}`, cells[ci] ?? '']));
      });
    }
  }
  return null;
};

// ─────────────────────────────────────────────
// Téléchargements
// ─────────────────────────────────────────────

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const exportCSV = (data: Record<string, unknown>[], filename = 'export.csv') => {
  try {
    downloadBlob(new Blob([arrayToCSV(data)], { type: 'text/csv;charset=utf-8;' }), filename);
  } catch (e) { console.error('CSV export error', e); }
};

const exportXLSX = async (data: Record<string, unknown>[], filename = 'export.xlsx') => {
  try {
    // Importation dynamique : graceful degradation vers CSV si xlsx absent
    const XLSX = (await import('xlsx')).default as any;
    const ws = XLSX.utils.json_to_sheet(data ?? []);
    const wb = { Sheets: { data: ws }, SheetNames: ['data'] };
    downloadBlob(
      new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
      filename
    );
  } catch {
    console.warn('xlsx absent, fallback CSV');
    exportCSV(data, filename.replace(/\.xlsx$/i, '.csv'));
  }
};

const exportChartPNG = async (el: HTMLDivElement | null, filename = 'chart.png') => {
  if (!el) return;
  const svg = el.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return;
  try {
    const { width, height } = svg.getBoundingClientRect();
    const canvas = Object.assign(document.createElement('canvas'), { width: width * 2, height: height * 2 });
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const img = new Image();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => { if (b) downloadBlob(b, filename); }, 'image/png');
  } catch (e) { console.error('PNG export error', e); }
};

// ─────────────────────────────────────────────
// Sous-composant : Tooltip Recharts robuste
// ─────────────────────────────────────────────

/** Tooltip Recharts : jamais d'objet affiché, tout est stringifié */
const SafeTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      role="tooltip"
      style={{
        background: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 10,
        padding: '8px 12px',
        color: '#f1f5f9',
        fontSize: 11,
        fontWeight: 600,
        border: '1px solid rgba(99,102,241,0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        maxWidth: 220,
      }}
    >
      {label !== undefined && (
        <div style={{ fontWeight: 800, marginBottom: 4, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {safeStr(label)}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color ?? '#6366f1', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 10 }}>{safeStr(p.name)}:</span>
          <span style={{ fontWeight: 900 }}>{safeStr(p.value)}</span>
        </div>
      ))}
    </div>
  );
});
SafeTooltip.displayName = 'SafeTooltip';

// ─────────────────────────────────────────────
// Sous-composant : Bouton d'export
// ─────────────────────────────────────────────

interface ExportButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  dark?: boolean;
}

const ExportButton = memo(({ label, icon, onClick, dark }: ExportButtonProps) => (
  <button
    aria-label={`Exporter ${label}`}
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold
      transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
      ${dark
        ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
));
ExportButton.displayName = 'ExportButton';

// ─────────────────────────────────────────────
// Sous-composant : VisualBlock (graphiques, tableaux, stats, listes)
// ─────────────────────────────────────────────

interface VisualBlockProps {
  msg: Message;
  chartRef: (el: HTMLDivElement | null) => void;
  exportKey: string;
  isFullscreen?: boolean;
}

const VisualBlock = memo(({ msg, chartRef, exportKey, isFullscreen = false }: VisualBlockProps) => {
  const { format, rawResults, downloadUrl } = msg;
  // Ref pour l'impression du document au rechargement (docHtml absent en DB)
  const docPreviewRef = React.useRef<HTMLDivElement>(null);

  // ── Guard : sort SAUF pour les formats document ────────────────────────
  // Les documents (document_html, document_invoice, etc.) peuvent ne pas avoir
  // de rawResults mais avoir documentData → il ne faut pas les bloquer ici.
  // isMultiDocFlag aussi : documentArray présent ou placeholder rechargement.
  const isDocFormat = format === 'document_html'
    || ['document_invoice','document_delivery','document_payslip','document_report'].includes(format);
  const isMultiDocFlag = !!(msg.isMultiDoc ?? msg.metadata?.isMultiDoc);

  if (!rawResults?.length && !isDocFormat && !isMultiDocFlag) return null;

  // ── TABLE ──────────────────────────────────
  if (format === 'table') {
    const cols = Object.keys(rawResults[0]);
    return (
      <div className="mt-3 border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="flex justify-end gap-2 p-2 bg-slate-50 border-b border-slate-100">
          <ExportButton label="CSV" icon={<Download size={11} />} onClick={() => exportCSV(rawResults, `table-${exportKey}.csv`)} />
          <ExportButton label="XLSX" icon={<TableIcon size={11} />} onClick={() => exportXLSX(rawResults, `table-${exportKey}.xlsx`)} />
        </div>
        <div className="overflow-x-auto max-h-56 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left text-[11px]" role="table">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {cols.map(c => (
                  <th key={c} scope="col" className="px-3 py-2 font-black uppercase text-[9px] text-slate-400 tracking-wider whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rawResults.map((row, i) => (
                <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                  {cols.map(c => (
                    <td key={c} className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                      {safeStr(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[9px] text-slate-400 font-bold">
          {rawResults.length} ligne{rawResults.length > 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  // ── CHART (tous formats graphiques) ────────
  // Reconnaît : chart, bar_chart, donut_chart, multi_chart, heatmap,
  //             advanced_chart, advancedchart, chart_advanced (rétrocompat)
  const ALL_CHART_FORMATS: MessageFormat[] = [
    'chart', 'bar_chart', 'histogram', 'donut_chart', 'multi_chart', 'heatmap',
    'advanced_chart', 'advancedchart', 'chart_advanced',
    'prediction', 'trend',
  ];
  if ((ALL_CHART_FORMATS as string[]).includes(format)) {
    // chart_config provient de metadata.chart_config (workflow v2) ou directement de metadata
    const chartCfg: ChartMeta = (msg.metadata?.chart_config ?? msg.metadata ?? {}) as ChartMeta;
    const keys = Object.keys(rawResults[0]);

    // xAxis : priorité chart_config, sinon 1ère colonne
    const xKey = chartCfg.xAxis ?? keys[0];

    // yAxis : priorité chart_config.yAxis, puis series (objet ou string[])
    const rawSeries = chartCfg.series;
    const rawY = chartCfg.yAxis;
    let yKeys: string[];
    if (Array.isArray(rawSeries) && rawSeries.length) {
      // series peut être Array<{key, type, color, label}> ou string[]
      yKeys = (rawSeries as any[]).map((s: any) => (typeof s === 'string' ? s : s.key));
    } else if (Array.isArray(rawY)) {
      yKeys = rawY as string[];
    } else if (typeof rawY === 'string') {
      yKeys = [rawY];
    } else {
      // Fallback : toutes les colonnes numériques sauf xKey
      yKeys = keys.filter(k => k !== xKey).slice(0, 3);
      if (!yKeys.length) yKeys = [keys[1] ?? keys[0]];
    }

    const chartType = detectChartType(rawResults, chartCfg, format);
    const isHorizontal = chartCfg.horizontal === true;
    const isHistogram  = format === 'histogram'; // barres jointives, axe continu
    const colors = chartCfg.colors?.length ? chartCfg.colors : CHART_COLORS;

    // Colonne secondaire pour la ligne de tendance des histogrammes
    const secondaryKey = chartCfg.secondaryAxis ?? null;
    const showSecondLine = chartCfg.showSecondaryLine === true && !!secondaryKey;

    // Nettoyage des données :
    // - xKey → string safe
    // - yKeys + secondaryKey → nombre (parseFloat, fallback 0)
    const cleanedData = rawResults.map(row => {
      const out: Record<string, unknown> = { [xKey]: safeStr(row[xKey]) };
      for (const y of yKeys) {
        const v = row[y];
        out[y] = typeof v === 'number' ? v : (parseFloat(String(v)) || 0);
      }
      // Colonne secondaire (ligne de tendance histogramme)
      if (secondaryKey && row[secondaryKey] !== undefined) {
        const sv = row[secondaryKey];
        out[secondaryKey] = typeof sv === 'number' ? sv : (parseFloat(String(sv)) || 0);
      }
      return out;
    });

    // Hauteur adaptive : fullscreen = plus grand, mobile = adaptatif
    const baseH = isFullscreen ? 460 : 340;
    const containerH = isHorizontal
      ? Math.max(isFullscreen ? 340 : 260, cleanedData.length * (isFullscreen ? 54 : 40) + 80)
      : isHistogram
        ? Math.max(isFullscreen ? 420 : 320, cleanedData.length * 32 + 80)
        : baseH;

    // Formatter axe des valeurs
    const fmtValue = (v: number) =>
      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : safeStr(v);

    // Label personnalisé centré au-dessus de chaque barre (histogramme / bar_chart)
    const CustomBarLabel = ({ x, y, width, value }: any) => {
      if (!chartCfg.dataLabels || value === 0) return null;
      return (
        <text
          x={(x ?? 0) + (width ?? 0) / 2}
          y={(y ?? 0) - 4}
          fill="#94a3b8"
          fontSize={8}
          fontWeight={700}
          textAnchor="middle"
        >
          {fmtValue(value)}
        </text>
      );
    };

    return (
      <div
        ref={chartRef}
        className="mt-3 rounded-2xl relative overflow-hidden"
        style={{
          height: containerH,
          background: 'linear-gradient(145deg,#0f172a 0%,#1e1b4b 55%,#0c1a3a 100%)',
          border: '1px solid rgba(99,102,241,0.22)',
          boxShadow: '0 8px 40px rgba(99,102,241,0.14),0 2px 8px rgba(0,0,0,0.35)',
        }}
        aria-label="Graphique d'analyse"
      >
        {/* Fond décoratif radial */}
        <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle at 15% 25%,#6366f1,transparent 50%),radial-gradient(circle at 85% 75%,#06b6d4,transparent 50%)',pointerEvents:'none' }} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0 relative z-10">
          <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color:'#818cf8' }}>
            <BarChart3 size={10} />
            <span>
              {format === 'histogram' ? 'Distribution'
                : format === 'bar_chart'   ? 'Barres'
                : format === 'donut_chart' ? 'Répartition'
                : format === 'multi_chart' ? 'Multi-Séries'
                : (format === 'prediction' || format === 'trend') ? 'Tendance & Prévision'
                : 'Analytique'}
            </span>
            {msg.metadata?.title && (
              <span style={{ color:'#64748b',fontWeight:600,textTransform:'none',letterSpacing:0,marginLeft:4 }}>
                — {msg.metadata.title}
              </span>
            )}
          </p>
          <div className="flex gap-1.5">
            <ExportButton dark label="CSV"  icon={<Download size={10} />} onClick={() => exportCSV(rawResults,  `chart-${exportKey}.csv`)} />
            <ExportButton dark label="XLSX" icon={<TableIcon size={10} />} onClick={() => exportXLSX(rawResults, `chart-${exportKey}.xlsx`)} />
          </div>
        </div>

        {/* ── Recharts ── */}
        <div style={{ width:'100%', height: containerH - 52, paddingLeft:4, paddingRight:4 }}>
          <ResponsiveContainer width="100%" height="100%">

            {/* ── HISTOGRAMME — BarChart sans gap avec ligne de tendance optionnelle ── */}
            {chartType === 'bar' && isHistogram ? (
              <ComposedChart
                data={cleanedData}
                margin={{ top: 18, right: showSecondLine ? 32 : 8, bottom: 28, left: 0 }}
                barCategoryGap={0}   // barres jointives = style histogramme
                barGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false} tickLine={false}
                  interval={0}
                  angle={cleanedData.length > 5 ? -25 : 0}
                  textAnchor={cleanedData.length > 5 ? 'end' : 'middle'}
                  height={cleanedData.length > 5 ? 42 : 22}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 8, fill: '#64748b' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={fmtValue}
                />
                {/* Axe Y droit pour la ligne secondaire (ex: montant_total) */}
                {showSecondLine && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 8, fill: '#22d3ee' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmtValue}
                  />
                )}
                <Tooltip content={<SafeTooltip />} cursor={{ fill: 'rgba(99,102,241,0.12)' }} />
                {showSecondLine && <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }} />}

                {/* Barres de fréquence (histogramme) */}
                {yKeys.map((yk, i) => (
                  <Bar
                    key={yk}
                    dataKey={yk}
                    yAxisId="left"
                    fill={colors[i % colors.length]}
                    radius={0}              // coins droits = histogramme
                    maxBarSize={999}        // occupe toute la largeur disponible
                    label={chartCfg.dataLabels ? <CustomBarLabel /> : undefined}
                  >
                    {/* Dégradé vertical pour chaque barre */}
                    {cleanedData.map((_, ci) => (
                      <Cell
                        key={`cell-${ci}`}
                        fill={`url(#hist-grad-${exportKey}-${i})`}
                        stroke={colors[i % colors.length]}
                        strokeWidth={1}
                        strokeOpacity={0.5}
                      />
                    ))}
                  </Bar>
                ))}

                {/* Ligne de tendance secondaire (montant_total, moyenne, etc.) */}
                {showSecondLine && secondaryKey && (
                  <Line
                    type="monotone"
                    dataKey={secondaryKey}
                    yAxisId="right"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    name={secondaryKey}
                  />
                )}

                {/* Définitions des dégradés */}
                <defs>
                  {yKeys.map((_, i) => (
                    <linearGradient key={i} id={`hist-grad-${exportKey}-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={colors[i % colors.length]} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
              </ComposedChart>

            ) : chartType === 'bar' ? (
            /* ── BAR_CHART classique (vertical ou horizontal) ── */
              <BarChart
                data={cleanedData}
                layout={isHorizontal ? 'vertical' : 'horizontal'}
                margin={{ top: chartCfg.dataLabels ? 18 : 4, right: 24, bottom: isHorizontal ? 4 : 20, left: isHorizontal ? 90 : 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={!isHorizontal} vertical={isHorizontal} />
                {isHorizontal ? (
                  <>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 8, fill: '#64748b' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={fmtValue}
                    />
                    <YAxis
                      type="category"
                      dataKey={xKey}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                      width={85}
                      tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v}
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      dataKey={xKey}
                      tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                      interval={0}
                      angle={cleanedData.length > 6 ? -30 : 0}
                      textAnchor={cleanedData.length > 6 ? 'end' : 'middle'}
                      height={cleanedData.length > 6 ? 40 : 20}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + '…' : v}
                    />
                    <YAxis
                      tick={{ fontSize: 8, fill: '#64748b' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={fmtValue}
                    />
                  </>
                )}
                <Tooltip content={<SafeTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                {yKeys.map((yk, i) => (
                  <Bar
                    key={yk}
                    dataKey={yk}
                    fill={colors[i % colors.length]}
                    radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                    maxBarSize={32}
                    label={chartCfg.dataLabels ? <CustomBarLabel /> : undefined}
                  />
                ))}
              </BarChart>

            ) : chartType === 'pie' ? (
            /* ── DONUT / PIE ── */
              <PieChart>
                <Tooltip content={<SafeTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }} />
                <Pie
                  data={cleanedData}
                  dataKey={chartCfg.valueKey ?? yKeys[0]}
                  nameKey={chartCfg.nameKey ?? xKey}
                  cx="50%" cy="50%"
                  outerRadius="65%"
                  innerRadius="35%"
                  paddingAngle={3}
                  label={({ name, percent }: any) =>
                    percent > 0.05 ? `${safeStr(name).slice(0, 10)} ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {cleanedData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
              </PieChart>

            ) : chartType === 'composed' ? (
            /* ── MULTI-SÉRIES / COMPOSED ── */
              (() => {
                // series enrichies depuis chart_config.series si dispo
                const seriesCfg = Array.isArray(chartCfg.series) && typeof (chartCfg.series as any[])[0] === 'object'
                  ? (chartCfg.series as any[])
                  : yKeys.map((k, i) => ({ key: k, type: 'bar', color: colors[i % colors.length], label: k }));

                return (
                  <ComposedChart data={cleanedData} margin={{ top: 4, right: 24, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtValue} />
                    {chartCfg.dual_axis && (
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    )}
                    <Tooltip content={<SafeTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }} />
                    {seriesCfg.map((s: any, i: number) => {
                      const yId = s.yAxisId ?? 'left';
                      const col = s.color ?? colors[i % colors.length];
                      if (s.type === 'line') {
                        return <Line key={s.key} type="monotone" dataKey={s.key} stroke={col} strokeWidth={2} dot={false} yAxisId={yId} name={s.label ?? s.key} />;
                      }
                      if (s.type === 'area') {
                        return (
                          <Area key={s.key} type="monotone" dataKey={s.key} stroke={col}
                            fill={`url(#grad-${exportKey}-${i})`} strokeWidth={2} dot={false}
                            yAxisId={yId} name={s.label ?? s.key} />
                        );
                      }
                      return <Bar key={s.key} dataKey={s.key} fill={col} radius={[4, 4, 0, 0]} maxBarSize={28} yAxisId={yId} name={s.label ?? s.key} />;
                    })}
                  </ComposedChart>
                );
              })()

            ) : (
            /* ── AREA / LINE (défaut) ── */
              <AreaChart data={cleanedData} margin={{ top: 4, right: 24, bottom: 20, left: 0 }}>
                <defs>
                  {yKeys.map((yk, i) => (
                    <linearGradient key={yk} id={`grad-${exportKey}-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v} />
                <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtValue} />
                <Tooltip content={<SafeTooltip />} />
                {yKeys.map((yk, i) => (
                  <Area key={yk} type={chartCfg.smooth !== false ? 'monotone' : 'linear'} dataKey={yk}
                    stroke={colors[i % colors.length]} fill={`url(#grad-${exportKey}-${i})`}
                    strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                ))}
              </AreaChart>
            )}

          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── STATS ──────────────────────────────────
  if (format === 'stats') {
    const items: Array<{ label: string; value: unknown }> = [];
    const raw = rawResults;
    if (Array.isArray(raw)) {
      for (const s of raw) {
        if (s && typeof s === 'object') {
          const keys = Object.keys(s);
          if ('label' in s || 'value' in s) {
            items.push({ label: safeStr((s as any).label ?? (s as any).name ?? (s as any).title), value: (s as any).value ?? (s as any).v ?? (s as any).count ?? (s as any).amount });
          } else if (keys.length === 1) {
            items.push({ label: keys[0], value: (s as any)[keys[0]] });
          } else {
            items.push({ label: safeStr((s as any).title ?? (s as any).name ?? keys[0]), value: (s as any).value ?? (s as any)[keys[1] ?? keys[0]] });
          }
        } else {
          items.push({ label: `#${items.length + 1}`, value: s });
        }
      }
    } else if (raw && typeof raw === 'object') {
      for (const k of Object.keys(raw as object)) {
        items.push({ label: k, value: (raw as any)[k] });
      }
    }

    const STAT_GRADIENTS = [
      { bg:'linear-gradient(135deg,#1e1b4b,#312e81)', border:'rgba(99,102,241,0.45)',  barA:'#6366f1', barB:'#818cf8', lbl:'#818cf8', val:'#e0e7ff' },
      { bg:'linear-gradient(135deg,#0c4a6e,#075985)', border:'rgba(6,182,212,0.45)',   barA:'#0891b2', barB:'#22d3ee', lbl:'#22d3ee', val:'#e0f2fe' },
      { bg:'linear-gradient(135deg,#064e3b,#065f46)', border:'rgba(16,185,129,0.45)',  barA:'#059669', barB:'#34d399', lbl:'#34d399', val:'#d1fae5' },
      { bg:'linear-gradient(135deg,#451a03,#78350f)', border:'rgba(251,191,36,0.45)',  barA:'#d97706', barB:'#fbbf24', lbl:'#fbbf24', val:'#fef3c7' },
      { bg:'linear-gradient(135deg,#4a044e,#6b21a8)', border:'rgba(168,85,247,0.45)', barA:'#9333ea', barB:'#a78bfa', lbl:'#a78bfa', val:'#f3e8ff' },
      { bg:'linear-gradient(135deg,#450a0a,#7f1d1d)', border:'rgba(248,113,113,0.45)',barA:'#e11d48', barB:'#f87171', lbl:'#f87171', val:'#ffe4e6' },
    ];
    return (
      <div className={`mt-3 grid gap-3 ${items.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {items.map((it, idx) => {
          const numVal = typeof it.value === 'number' ? it.value : Number(String(it.value).replace(/[^0-9.-]+/g, ''));
          const isNum = !Number.isNaN(numVal);
          const g = STAT_GRADIENTS[idx % STAT_GRADIENTS.length];
          return (
            <div key={idx} className="p-4 rounded-xl relative overflow-hidden" style={{ background:g.bg, border:`1px solid ${g.border}`, boxShadow:`0 4px 20px ${g.border.replace('0.45','0.2')}` }}>
              <div style={{ fontSize:8, fontWeight:900, color:g.lbl, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{it.label}</div>
              <div style={{ fontSize:20, fontWeight:900, color:g.val, letterSpacing:'-0.5px', lineHeight:1.1 }}>{formatStatValue(it.value)}</div>
              {isNum && (
                <div className="mt-2.5 h-1 w-full rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width:`${Math.min(100, isFinite(numVal) ? Math.abs(numVal) > 100 ? 75 : Math.abs(numVal) : 50)}%`, background:`linear-gradient(90deg,${g.barA},${g.barB})` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── LIST ───────────────────────────────────
  if (format === 'list') {
    return (
      <ul className="mt-2 space-y-1" role="list">
        {rawResults.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-slate-700">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            {safeStr(item)}
          </li>
        ))}
      </ul>
    );
  }

  // ── EXCEL / téléchargement ─────────────────
  if (format === 'excel') {
    return (
      <a
        href={downloadUrl ?? '#'}
        className="mt-2 inline-flex items-center gap-2 text-indigo-600 font-bold text-[11px] hover:text-indigo-800 underline"
        download
        aria-label="Télécharger le fichier Excel"
      >
        <Download size={13} /> Télécharger le fichier
      </a>
    );
  }

  // ── MULTI-DOCUMENTS (fiches de paie en masse, etc.) ──────────────────
  const docArray = msg.documentArray as Array<{ html: string; title: string; filename: string }> | undefined;

  // Rechargement : documentArray n'est pas persisté en DB → placeholder
  if (isMultiDocFlag && !docArray?.length) {
    const storedCount = msg.documentCount ?? msg.metadata?.documentCount ?? '';
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500">
        <span className="text-base">📁</span>
        <span>
          <strong className="text-slate-700">{storedCount ? `${storedCount} documents` : 'Documents groupés'}</strong>
          {' '}— aperçu non disponible après rechargement.{' '}
          <span className="text-slate-400">Relancez la même requête pour les régénérer.</span>
        </span>
      </div>
    );
  }

  if (isMultiDocFlag && docArray?.length) {
    const total = docArray.length;
    const needsZip = (msg as any).createZip || total > 5;

    const downloadOne = (doc: { html: string; filename: string }) => {
      const blob = new Blob([doc.html], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, doc.filename);
    };

    const printOne = (doc: { html: string; title: string }) => {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(doc.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    };

    const downloadAllZip = async () => {
      try {
        const zipName = `documents_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`;
        const { blob, filename } = await apiClient.requestBlob('/ai/export-zip', {
          method: 'POST',
          body: JSON.stringify({
            documents: docArray.map(d => ({ html: d.html, filename: d.filename })),
            zipName,
          }),
        });
        downloadBlob(blob, filename || `${zipName}.zip`);
      } catch (err: any) {
        alert(`Impossible de créer le ZIP : ${err?.message ?? 'erreur inconnue'}. Téléchargez les fichiers individuellement.`);
      }
    };

    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              📁 {total} document{total > 1 ? 's' : ''}
            </span>
          </div>
          {needsZip && (
            <button
              onClick={downloadAllZip}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-500 transition"
            >
              <Download size={10} /> Tout télécharger (.zip)
            </button>
          )}
        </div>
        {/* Liste des documents */}
        <div className="divide-y divide-slate-100 bg-white max-h-72 overflow-y-auto">
          {docArray.map((doc, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[55%]">
                📄 {doc.title}
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => printOne(doc)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg hover:bg-indigo-100 transition"
                >
                  🖨️ PDF
                </button>
                <button
                  onClick={() => downloadOne(doc)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-lg hover:bg-slate-200 transition"
                >
                  <Download size={9} /> HTML
                </button>
              </div>
            </div>
          ))}
        </div>
        {needsZip && (
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[8px] text-slate-400">
            💡 Plus de 5 documents — utilisez <strong>Tout télécharger</strong> pour obtenir un dossier ZIP.
          </div>
        )}
      </div>
    );
  }

  // ── DOCUMENT HTML (facture, bon de livraison, rapport…) ──────────────
  if (format === 'document_html' || ['document_invoice','document_delivery','document_payslip','document_report'].includes(format)) {
    const docTitle: string = msg.metadata?.title ?? msg.metadata?.document_type ?? 'Document';
    const refNum: string   = msg.metadata?.ref ?? '';
    const docHtml: string | undefined = (msg as any).documentHtml ?? msg.metadata?.documentHtml;

    // documentData : données structurées pour DocumentPreview React
    // Priorité : champ direct > metadata.documentData (rechargement historique)
    const docData = (msg as any).documentData ?? msg.metadata?.documentData;

    // ── Impression PDF (HTML brut si dispo, sinon innerHTML du DocumentPreview rendu) ──
    const printDoc = () => {
      if (docHtml) {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(docHtml);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
        return;
      }
      // Rechargement : docHtml absent en DB mais DocumentPreview est rendu → on l'imprime
      if (docPreviewRef.current) {
        const styles = Array.from(document.styleSheets)
          .map(s => { try { return Array.from(s.cssRules).map((r: any) => r.cssText).join('\n'); } catch { return ''; } })
          .join('\n');
        const inner = docPreviewRef.current.innerHTML;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styles}\n*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff;margin:0;padding:0}[style*="scale"]{transform:none!important;width:100%!important}</style></head><body>${inner}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 800);
      }
    };

    // ── Téléchargement HTML ───────────────────────────────────────────────
    const downloadDoc = () => {
      if (docHtml) {
        const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, `${docTitle.replace(/\s+/g, '_')}_${refNum || exportKey}.html`);
        return;
      }
      printDoc(); // Fallback au rechargement : impression = meilleure option
    };

    // ── Cas 1 : DocumentPreview React disponible (données structurées) ────
    // Rendu natif avec le design exact de l'application, persistant au rechargement
    if (docData?.sale && docData?.tenant) {
      return (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          {/* Barre d'actions */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                📄 {docTitle}
              </span>
              {refNum && (
                <span className="text-[8px] text-slate-500 font-mono bg-slate-700 px-2 py-0.5 rounded">
                  #{refNum}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {/* PDF toujours disponible : depuis docHtml (session active) ou depuis ref (rechargement) */}
              <button
                onClick={printDoc}
                aria-label="Imprimer / Exporter PDF"
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-500 transition"
              >
                🖨️ PDF
              </button>
              {docHtml && (
                <button
                  onClick={downloadDoc}
                  aria-label="Télécharger HTML"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 border border-white/20 text-white text-[9px] font-bold rounded-lg hover:bg-white/20 transition"
                >
                  <Download size={10} /> HTML
                </button>
              )}
            </div>
          </div>

          {/* DocumentPreview natif — même design que l'appli, scroll interne */}
          <div
            ref={docPreviewRef}
            className="overflow-y-auto bg-slate-100"
            style={{ maxHeight: isFullscreen ? 700 : 520 }}
          >
            <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', width: '139%' }}>
              <DocumentPreview
                type={docData.type}
                sale={docData.sale}
                tenant={docData.tenant}
                currency={docData.currency || 'FCFA'}
              />
            </div>
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[8px] text-slate-400 font-medium">
            💡 Cliquez sur <strong>PDF</strong> pour imprimer ou exporter via votre navigateur.
          </div>
        </div>
      );
    }

    // ── Cas 2 : HTML brut seulement (fallback iframe) ─────────────────────
    if (docHtml) {
      return (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">📄 {docTitle}</span>
            <div className="flex gap-1.5">
              <button onClick={printDoc} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-500 transition">
                🖨️ PDF
              </button>
              <button onClick={downloadDoc} className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 border border-white/20 text-white text-[9px] font-bold rounded-lg hover:bg-white/20 transition">
                <Download size={10} /> HTML
              </button>
            </div>
          </div>
          <div className="relative bg-slate-100" style={{ height: 400 }}>
            <iframe
              srcDoc={docHtml}
              title={`Aperçu — ${docTitle}`}
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[8px] text-slate-400">
            💡 Cliquez sur <strong>PDF</strong> pour exporter.
          </div>
        </div>
      );
    }

    // ── Cas 3 : Rechargement — HTML non disponible en DB ─────────────────
    // On n'affiche pas les données brutes pour les documents (confus et illisible).
    // On affiche une card invitant à régénérer.
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500">
        <span className="text-base">📄</span>
        <span>
          <strong className="text-slate-700">{docTitle}</strong>
          {' '}— aperçu non disponible après rechargement.{' '}
          <span className="text-slate-400">Relancez la même requête pour régénérer le document.</span>
        </span>
      </div>
    );
  }

  return null;
});
VisualBlock.displayName = 'VisualBlock';

// ─────────────────────────────────────────────
// Sous-composant : MarkdownRenderer
// ─────────────────────────────────────────────

/** Rend le Markdown minimal (titres, listes, gras, tableaux, séparateurs) en JSX sûr */
const MarkdownRenderer = memo(({ content }: { content: string }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    const isTableHeader = line.includes('|') && /(^|\s)\|?\s*[-:]{3,}/.test(next.replace(/\s*\|\s*/g, '|'));

    if (isTableHeader) {
      const tableLines: string[] = [line, next];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) tableLines.push(lines[i++]);
      const splitRow = (l: string) => {
        let cells = l.split('|').map(c => c.trim());
        if (cells[0] === '') cells = cells.slice(1);
        if (cells[cells.length - 1] === '') cells = cells.slice(0, -1);
        return cells;
      };
      const parsedRows = tableLines.map(l => splitRow(l));
      const header = parsedRows[0] ?? [];
      const body = parsedRows.slice(2).map(r => header.map((_, ci) => r[ci] ?? ''));
      nodes.push(
        <div key={nodes.length} className="mt-2 border border-slate-100 rounded-lg overflow-auto">
          <table className="w-full text-left text-[11px]" role="table">
            <thead className="bg-slate-50">
              <tr>{header.map((h, ci) => <th key={ci} scope="col" className="px-2 py-1.5 font-black uppercase text-[9px] text-slate-400">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {body.map((r, ri) => (
                <tr key={ri} className="hover:bg-indigo-50/30">
                  {r.map((c, ci) => <td key={ci} className="px-2 py-1.5 text-slate-700">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^###\s/.test(line)) { nodes.push(<h4 key={nodes.length} className="text-[12px] font-black text-slate-800 mt-2">{line.slice(4)}</h4>); i++; continue; }
    if (/^##\s/.test(line)) { nodes.push(<h3 key={nodes.length} className="text-[13px] font-black text-slate-900 mt-2">{line.slice(3)}</h3>); i++; continue; }
    if (/^#\s/.test(line)) { nodes.push(<h2 key={nodes.length} className="text-sm font-black text-slate-900 mt-2">{line.slice(2)}</h2>); i++; continue; }

    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={nodes.length} className="mt-1 space-y-0.5" role="list">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-slate-700">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) { nodes.push(<hr key={nodes.length} className="my-2 border-slate-100" />); i++; continue; }
    if (!line.trim()) { nodes.push(<div key={nodes.length} className="h-1" />); i++; continue; }

    nodes.push(
      <p key={nodes.length} className="text-[11px] leading-relaxed text-current"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded text-[10px] font-mono">$1</code>') }}
      />
    );
    i++;
  }

  return <div className="space-y-1">{nodes}</div>;
});
MarkdownRenderer.displayName = 'MarkdownRenderer';

// ─────────────────────────────────────────────
// Sous-composant : MessageBubble
// ─────────────────────────────────────────────

interface MessageBubbleProps {
  msg: Message;
  chartRef: (el: HTMLDivElement | null) => void;
  exportKey: string;
  onExportCSV: (data: Record<string, unknown>[], name: string) => void;
  onExportXLSX: (data: Record<string, unknown>[], name: string) => void;
  isFullscreen?: boolean;
}

const MessageBubble = memo(({ msg, chartRef, exportKey, onExportCSV, onExportXLSX, isFullscreen = false }: MessageBubbleProps) => {
  const isUser = msg.role === 'user';
  const isError = msg.status === 'ERROR';

  // ── Anti-doublon : formats avec rawResults ──────────────────────────────
  // Quand rawResults est présent ET que le format est un tableau/graphique/stats/liste,
  // le formattedResponse contient souvent la même donnée en Markdown (générée par n8n).
  // VisualBlock affiche déjà la version structurée → on ne passe à MarkdownRenderer
  // que le texte introductif (titre + description), sans les lignes de tableau.
  const VISUAL_FORMATS: MessageFormat[] = [
    'table', 'stats', 'list',
    'chart', 'bar_chart', 'histogram', 'donut_chart', 'multi_chart', 'heatmap',
    'advanced_chart', 'advancedchart', 'chart_advanced',
  ];
  const hasVisualData = !!(msg.rawResults?.length && VISUAL_FORMATS.includes(msg.format));

  // Calcule le texte à passer au MarkdownRenderer :
  // - Si format visuel avec rawResults → ne garde QUE les lignes avant le premier "|"
  //   (titre + description), supprime le tableau Markdown redondant
  // - Sinon → texte complet
  const displayText = (() => {
    if (!hasVisualData) return msg.formattedResponse;
    const lines = msg.formattedResponse.split('\n');
    // Trouve la première ligne de tableau Markdown (commence par | ou ---) 
    const firstTableLine = lines.findIndex(l => /^\s*\|/.test(l) || /^\s*\|?[-:]{3,}/.test(l));
    if (firstTableLine === -1) return msg.formattedResponse; // pas de tableau Markdown → texte complet
    // Garde uniquement ce qui précède le tableau
    const before = lines.slice(0, firstTableLine).join('\n').trimEnd();
    return before || msg.formattedResponse;
  })();

  // Export pour tableaux Markdown inline (seulement si pas de rawResults)
  const tableData: Record<string, string>[] | null = (!msg.rawResults?.length)
    ? parseMarkdownTableToData(msg.formattedResponse)
    : null;
  const hasExportableTable = tableData && tableData.length > 0;

  const ts = new Date(msg.timestamp);
  const now = new Date();
  const timeStr = ts.toDateString() === now.toDateString()
    ? ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : ts.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} role="listitem">
      {/* Avatar IA */}
      {!isUser && (
        <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow">
          <Bot size={14} className="text-white" />
        </div>
      )}

      <div
        className={`
          max-w-[92%] sm:max-w-[88%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-3xl text-xs leading-relaxed shadow-sm border relative
          ${isUser
            ? 'bg-indigo-600 text-white rounded-br-lg border-indigo-500/50 font-semibold'
            : isError
              ? 'bg-rose-50 text-rose-800 border-rose-200 rounded-bl-lg'
              : 'bg-white text-slate-900 border-slate-200/80 rounded-bl-lg font-medium'
          }
        `}
      >
        {/* Boutons d'export pour tableaux Markdown inline (sans rawResults) */}
        {hasExportableTable && !isUser && (
          <div className="flex gap-1.5 mb-2 justify-end">
            <ExportButton label="CSV" icon={<Download size={10} />} onClick={() => onExportCSV(tableData as any, `export-${exportKey}.csv`)} />
            <ExportButton label="XLSX" icon={<TableIcon size={10} />} onClick={() => onExportXLSX(tableData as any, `export-${exportKey}.xlsx`)} />
          </div>
        )}

        {/* Icône d'erreur */}
        {isError && (
          <div className="flex items-center gap-1.5 mb-1 text-rose-600">
            <AlertCircle size={12} />
            <span className="text-[10px] font-black uppercase tracking-wide">Erreur</span>
          </div>
        )}

        {/* Texte principal — tableau Markdown supprimé si VisualBlock prend le relais */}
        {isUser
          ? <span>{msg.formattedResponse}</span>
          : <MarkdownRenderer content={displayText} />
        }

        {/* Bloc visuel — source de vérité pour tableaux, graphiques, stats, documents */}
        {!isUser && (
          <VisualBlock msg={msg} chartRef={chartRef} exportKey={exportKey} isFullscreen={isFullscreen} />
        )}

        {/* Timestamp */}
        <div className={`text-right mt-2 ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
          <time dateTime={ts.toISOString()} className="text-[9px] font-bold">{timeStr}</time>
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ─────────────────────────────────────────────
// Sous-composant : ChatHeader
// ─────────────────────────────────────────────

interface ChatHeaderProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

const ChatHeader = memo(({ isFullscreen, onToggleFullscreen, onClose }: ChatHeaderProps) => (
  <div className="bg-slate-900 px-3 sm:px-5 py-3 sm:py-4 text-white flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
        <Bot size={20} />
        {/* Indicateur "en ligne" */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" aria-label="En ligne" />
      </div>
      <div>
        <h4 className="font-black text-[13px] tracking-tight">Kernel IA Orchestrator</h4>
        <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
          <Activity size={7} /> n8n · Live Analysis
        </p>
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      <button
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      <button
        onClick={onClose}
        aria-label="Fermer l'assistant"
        className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <X size={18} />
      </button>
    </div>
  </div>
));
ChatHeader.displayName = 'ChatHeader';

// ─────────────────────────────────────────────
// Sous-composant : ScrollToBottomButton
// ─────────────────────────────────────────────

const ScrollToBottomButton = memo(({ onClick, visible }: { onClick: () => void; visible: boolean }) => (
  <button
    onClick={onClick}
    aria-label="Défiler vers le bas"
    className={`
      absolute bottom-4 left-1/2 -translate-x-1/2 z-20
      flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-lg
      transition-all duration-200
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
    `}
  >
    <ChevronDown size={12} /> Bas
  </button>
));
ScrollToBottomButton.displayName = 'ScrollToBottomButton';

// ─────────────────────────────────────────────
// Composant principal : ChatInterface
// ─────────────────────────────────────────────

const ChatInterface = ({ user }: { user: any }) => {
  const isAdmin = !!(user?.roles?.includes(UserRole.ADMIN) || user?.roles?.includes(UserRole.SUPER_ADMIN));

  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Refs pour les exports PNG des graphiques (clé = exportKey du message)
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Scroll auto ────────────────────────────
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Détection scroll pour le bouton "Défiler vers le bas"
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  // ── Chargement historique ──────────────────
  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await fetchChatHistory();

        /**
         * AIController.getHistory (v2) retourne maintenant des objets enrichis :
         * {
         *   id, sender,
         *   message:     string  — texte affiché dans la bulle
         *   rawResults:  any[]   — données pour graphiques/tableaux (null pour texte simple)
         *   metadata:    object  — chart_config, kpi_config, title, etc.
         *   format:      string  — bar_chart, donut_chart, stats, table, general…
         *   resultCount: number
         *   created_at:  string
         * }
         *
         * Les anciens enregistrements (avant migration) ont rawResults=null et format='general'.
         * Le mapper gère les deux cas.
         */
        // ── Tri canonique : id entier DB (auto-incrément) ────────────────────
        // Le workflow n8n insère maintenant le message user EN PREMIER (avant
        // tout traitement IA), donc le id user < id réponse IA, toujours.
        // Tiebreakers pour les anciens enregistrements sans id fiable :
        //   1. created_at ASC   2. user avant IA (même instant)
        const isUser = (s: string) => s === 'user' || s === 'human';
        const sortedData = [...data].sort((a: any, b: any) => {
          const aId = Number(a.id) || 0;
          const bId = Number(b.id) || 0;
          if (aId > 0 && bId > 0 && aId !== bId) return aId - bId;
          const tA = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
          const tB = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
          if (tA !== tB) return tA - tB;
          if (isUser(a.sender) && !isUser(b.sender)) return -1;
          if (!isUser(a.sender) && isUser(b.sender)) return 1;
          return 0;
        });

        const mapped: Message[] = sortedData
          .map((m: any) => {
            const role: 'user' | 'ai' = m.sender === 'user' ? 'user' : 'ai';
            const ts = m.created_at ?? m.createdAt ?? null;

            // ── rawResults ──────────────────────────────────────────────
            // Vient directement du champ dédié retourné par AIController v2.
            // Pour les anciens messages, peut être null.
            const rawResults: any[] | undefined =
              (Array.isArray(m.rawResults) && m.rawResults.length > 0)
                ? m.rawResults
                : undefined;

            // ── Format ──────────────────────────────────────────────────
            // Priorité : champ format dédié → metadata.format → fallback 'general'
            const format = (
              m.format
              ?? m.metadata?.format
              ?? (rawResults ? 'table' : 'general')
            ) as MessageFormat;

            // ── Texte affiché ────────────────────────────────────────────
            // `m.message` est le formattedResponse stocké par n8n.
            // Cas particuliers :
            //  - '[GRAPH_DATA]' ou vide → générer un texte de contexte
            //  - Contient du CSS/HTML (document reloadé avant fix) → utiliser le titre
            let text = String(m.message ?? '').trim();

            // Détecte si le texte est du CSS/HTML brut (bug historique pré-fix)
            const looksLikeCssOrHtml = text.startsWith(':root')
              || text.startsWith('<!DOCTYPE')
              || text.startsWith('<html')
              || text.includes('font-family:')
              || text.includes('border-collapse:');

            if (!text || text === '[GRAPH_DATA]' || looksLikeCssOrHtml) {
              const title = m.metadata?.title ?? m.metadata?.document_type ?? '';
              const docData = m.documentData ?? m.metadata?.documentData;
              if (docData || looksLikeCssOrHtml) {
                // Message document : afficher le titre proprement
                text = title
                  ? `📄 **${title}** généré avec succès.`
                  : '📄 Document généré avec succès.';
              } else {
                text = rawResults?.length
                  ? `${title || 'Données'} — ${rawResults.length} résultat(s)`
                  : title || 'Réponse reçue.';
              }
            }

            return {
              role,
              formattedResponse: cleanProfessionalText(text),
              format,
              rawResults,
              // metadata : essentiel pour reconstruire graphiques et documents
              metadata: m.metadata ?? undefined,
              // documentData : rehydrate le composant DocumentPreview au rechargement
              // Stocké dans metadata.documentData par le nœud n8n "Generate Document HTML"
              documentData: m.documentData ?? m.metadata?.documentData ?? undefined,
              // documentHtml non persisté en DB (trop volumineux) — PDF via bouton print
              resultCount: m.resultCount ?? rawResults?.length ?? 0,
              status: 'SUCCESS' as const,
              timestamp: ts ? new Date(ts) : new Date(),
            } satisfies Message;
          });

        setMessages(mapped);
      } catch (err) {
        console.error('Chat history fetch error:', err);
        setMessages([{
          role: 'ai',
          formattedResponse: 'Impossible de charger l\'historique. Vérifiez votre connexion et réessayez.',
          format: 'general',
          resultCount: 0,
          status: 'ERROR',
          timestamp: new Date(),
        }]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [isOpen]);

  // ── Envoi message ──────────────────────────
  const handleSend = useCallback(async (overrideMsg?: string) => {
    const raw = (overrideMsg ?? input).trim();
    if (!raw || isLoading) return;

    const tenantId = user.tenantId ?? 'system-default';
    // Résolution du planId depuis toutes les sources disponibles sur l'objet user
    // Résolution planId — priorité : user.planId > subscription.planId > plan.id > tenant > fallback
    // On utilise || (pas ??) pour ignorer null et '' en plus de undefined
    const planId: string =
      (user as any).planId ||
      (user as any).subscription?.planId ||
      (user as any).plan?.id ||
      (user as any).tenant?.plan ||
      (user as any).tenant?.subscription_plan ||
      (user as any).tenant?.planId ||
      'FREE_TRIAL';
    setInput('');
    inputRef.current?.focus();

    setMessages(prev => [...prev, {
      role: 'user',
      formattedResponse: raw,
      format: 'general',
      resultCount: 0,
      status: 'SUCCESS',
      timestamp: new Date(),
    }]);

    setIsLoading(true);
    try {
      const aiResponse = await getAIResponse(raw, tenantId, planId) as AIChatResponse & Record<string, any>;

      // ── Format : priorité absolue à la valeur du workflow n8n ──
      // parseStructuredFormatted ne sert que si aiResponse.formattedResponse est du JSON brut
      // (cas de workflows qui envoient le JSON en texte). Si le format est déjà dans aiResponse,
      // on ne le réinterprète pas — c'est le workflow qui fait autorité.
      const finalFormat = (aiResponse.format ?? 'general') as MessageFormat;
      const finalRaw = aiResponse.rawResults?.length ? aiResponse.rawResults : undefined;

      // Texte affiché : si rawResults dispo et formattedResponse non vide → afficher le texte
      // Si formattedResponse est '[GRAPH_DATA]' ou vide, on met une phrase de contexte
      let finalText = aiResponse.formattedResponse ?? '';
      if (!finalText || finalText === '[GRAPH_DATA]') {
        finalText = finalRaw?.length
          ? `${aiResponse.metadata?.title ?? 'Données'} — ${finalRaw.length} résultat(s)`
          : 'Données reçues.';
      }

      setMessages(prev => [...prev, {
        role: 'ai',
        formattedResponse: finalText,
        format: finalFormat,
        rawResults: finalRaw,
        downloadUrl: aiResponse.downloadUrl,
        documentHtml: aiResponse.documentHtml,
        documentData: aiResponse.documentData,
        isMultiDoc: aiResponse.isMultiDoc,
        documentArray: aiResponse.documentArray,
        documentCount: aiResponse.documentCount,
        createZip: aiResponse.createZip,
        resultCount: finalRaw?.length ?? aiResponse.resultCount ?? 0,
        status: aiResponse.status ?? 'SUCCESS',
        mode: aiResponse.mode ?? 'BRIDGE',
        metadata: aiResponse.metadata,
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      // Détecte les erreurs réseau / timeout / HTTP pour afficher un message précis
      const status   = err?.response?.status ?? err?.status ?? 0;
      const errData  = err?.response?.data ?? err?.data ?? {};
      const errCode  = errData?.error ?? '';
      const errMsg   = errData?.message ?? err?.message ?? '';

      const friendlyMessages: Record<string, string> = {
        'WebhookNotRegistered': '⚙️ Le workflow IA n\'est pas activé. Contactez votre administrateur.',
        'WebhookUnavailable':   '🔌 Le service IA est indisponible. Réessayez dans quelques instants.',
        'BridgeError':          '🌐 Impossible de joindre le service IA. Vérifiez votre connexion.',
      };

      let displayMsg = '💬 Une erreur est survenue. Veuillez réessayer.';
      if (friendlyMessages[errCode])         displayMsg = friendlyMessages[errCode];
      else if (status === 404)               displayMsg = '⚙️ Le workflow IA n\'est pas activé sur n8n.';
      else if (status === 503)               displayMsg = '🔌 Le service IA est temporairement indisponible.';
      else if (status === 401 || status === 403) displayMsg = '🔒 Session expirée. Veuillez vous reconnecter.';
      else if (status >= 500)                displayMsg = '🔧 Erreur serveur. L\'équipe technique a été notifiée.';
      else if (errMsg.toLowerCase().includes('timeout') || errMsg.toLowerCase().includes('network'))
                                             displayMsg = '⏱️ Le service IA met trop de temps à répondre. Réessayez.';

      setMessages(prev => [...prev, {
        role: 'ai',
        formattedResponse: displayMsg,
        format: 'error',
        resultCount: 0,
        status: 'ERROR',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, user]);

  // ── Render ─────────────────────────────────
  if (!isAdmin) return null;

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[1000]">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir l'assistant IA"
          className="
            w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-[1.75rem]
            flex items-center justify-center shadow-2xl
            hover:scale-105 active:scale-95 transition-all duration-200
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500
            relative
          "
        >
          <MessageSquare size={22} />
          <span
            className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-6 h-6 bg-indigo-600 border-4 border-slate-50 rounded-full flex items-center justify-center text-[7px] font-black uppercase"
            aria-hidden="true"
          >
            IA
          </span>
        </button>
      </div>
    );
  }

  const panelCls = isFullscreen
    ? 'fixed inset-0 rounded-none z-[2000]'
    : 'fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-8 sm:right-8 sm:w-[440px] sm:h-[640px] h-[calc(100dvh-5rem)] rounded-[2rem] sm:rounded-[2.5rem] z-[1000]';

  return (
    <div
      className={`${panelCls} bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label="Assistant IA Kernel"
    >
      {/* ── Header ── */}
      <ChatHeader
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(p => !p)}
        onClose={() => setIsOpen(false)}
      />

      {/* ── Zone messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4 sm:py-5 space-y-4 bg-slate-50/40 relative"
        role="list"
        aria-label="Historique de conversation"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* État vide */}
        {messages.length === 0 && !loadingHistory && (
          <div className="flex flex-col items-center justify-center h-full py-4 sm:py-8 text-center">
            <div className="w-14 h-14 bg-indigo-100 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
              <Sparkles size={28} className="text-indigo-600" />
            </div>
            <h3 className="text-[13px] font-black text-slate-700 mb-1">Bonjour, comment puis-je vous aider ?</h3>
            <p className="text-[10px] text-slate-400 font-medium max-w-[90%] sm:max-w-[260px] mb-4 sm:mb-5">
              Analysez vos ventes, factures et stocks. Commencez par une question ou essayez :
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center px-2">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-indigo-100 text-indigo-700 rounded-full text-[9px] sm:text-[10px] font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chargement historique */}
        {loadingHistory && (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Chargement de l'historique…</span>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const exportKey = `${msg.timestamp.getTime()}-${idx}`;
          return (
            <MessageBubble
              key={exportKey}
              msg={msg}
              exportKey={exportKey}
              chartRef={el => { chartRefs.current[exportKey] = el; }}
              onExportCSV={exportCSV}
              onExportXLSX={exportXLSX}
              isFullscreen={isFullscreen}
            />
          );
        })}

        {/* Indicateur de chargement IA */}
        {isLoading && <ThinkingBubble />}

        {/* Bouton "Défiler vers le bas" */}
        <ScrollToBottomButton onClick={scrollToBottom} visible={showScrollBtn} />
      </div>

      {/* ── Zone input ── */}
      <div className="flex-shrink-0 px-3 sm:px-4 py-3 sm:py-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-300 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ex: Top 5 produits vendus ce mois-ci…"
            aria-label="Message pour l'assistant"
            disabled={isLoading}
            className="flex-1 bg-transparent text-[12px] font-medium text-slate-800 placeholder:text-slate-400 outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label="Envoyer le message"
            className="
              w-9 h-9 flex-shrink-0 bg-slate-900 text-white rounded-xl
              flex items-center justify-center
              hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 active:scale-90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            "
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-center text-[8px] text-slate-300 font-medium mt-2">
          Entrée pour envoyer · Propulsé par n8n + Gemini
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;

// ─────────────────────────────────────────────
// Tests unitaires (Jest / Vitest)
// ─────────────────────────────────────────────
// Pour exécuter : npx vitest run ChatInterface.test.ts
//
// import { safeStr, formatStatValue, arrayToCSV, parseStructuredFormatted, detectChartType, parseMarkdownTableToData } from './ChatInterface';
//
// describe('safeStr', () => {
//   it('gère null/undefined', () => { expect(safeStr(null)).toBe('—'); expect(safeStr(undefined)).toBe('—'); });
//   it('gère les nombres', () => { expect(safeStr(1000)).toBe('1 000'); });
//   it('stringifie les objets', () => { expect(safeStr({ a: 1 })).toBe('{"a":1}'); });
// });
//
// describe('arrayToCSV', () => {
//   it('crée un CSV valide', () => {
//     const result = arrayToCSV([{ name: 'Alice', age: 30 }]);
//     expect(result).toContain('"Alice"');
//     expect(result).toContain('"30"');
//   });
//   it('retourne vide pour tableau vide', () => { expect(arrayToCSV([])).toBe(''); });
// });
//
// describe('parseStructuredFormatted', () => {
//   it('parse un JSON valide', () => {
//     const r = parseStructuredFormatted('{"response":"Bonjour","format":"general"}');
//     expect(r.text).toBe('Bonjour');
//     expect(r.format).toBe('general');
//   });
//   it('retourne le texte brut si pas de JSON', () => {
//     const r = parseStructuredFormatted('Bonjour monde');
//     expect(r.text).toBe('Bonjour monde');
//   });
//   it('gère les code fences', () => {
//     const r = parseStructuredFormatted('```json\n{"response":"ok"}\n```');
//     expect(r.text).toBe('ok');
//   });
// });
//
// describe('detectChartType', () => {
//   it('respecte meta.chartType', () => {
//     expect(detectChartType([{}], { chartType: 'bar' }, 'chart')).toBe('bar');
//     expect(detectChartType([{}], { chartType: 'pie' }, 'chart')).toBe('pie');
//   });
//   it('détecte pie auto (string + number)', () => {
//     expect(detectChartType([{ cat: 'A', val: 10 }], {}, 'chart')).toBe('pie');
//   });
// });
//
// describe('parseMarkdownTableToData', () => {
//   it('extrait un tableau Markdown', () => {
//     const md = '| Nom | Score |\n|---|---|\n| Alice | 42 |\n| Bob | 7 |';
//     const data = parseMarkdownTableToData(md);
//     expect(data).toHaveLength(2);
//     expect(data![0]['Nom']).toBe('Alice');
//   });
//   it('retourne null si pas de tableau', () => {
//     expect(parseMarkdownTableToData('Pas de tableau ici.')).toBeNull();
//   });
// });