import React from 'react';
import { Package, MapPin, Phone, Mail } from 'lucide-react';

interface Props {
  items: any[];
  settings: any;
  campaign: any;
}

// ─── Constantes de pagination ──────────────────────────────────────────────
const ITEMS_FIRST_PAGE = 10; // Moins d'articles page 1 (résumé KPI prend de la place)
const ITEMS_PER_PAGE   = 18; // Articles sur les pages suivantes

// ─── Helpers ──────────────────────────────────────────────────────────────

const getAuditVerdict = (counted: number, system: number) => {
  if (counted === system)
    return { label: 'Normal',      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
  const deltaPercent = Math.abs((counted - system) / (system || 1)) * 100;
  if (deltaPercent <= 5)
    return { label: 'Cohérent',    color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100'   };
  return   { label: 'Incohérent', color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100'    };
};

// ─── Sous-composants définis HORS du composant principal ──────────────────

interface AuditHeaderProps {
  settings: any;
  campaignName: string;
  campaignDate: string;
  pageNumber: number;
  totalPages: number;
}

const AuditHeader: React.FC<AuditHeaderProps> = ({
  settings, campaignName, campaignDate, pageNumber, totalPages,
}) => (
  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
    <div>
      {settings.logoUrl ? (
        <img src={settings.logoUrl} className="h-16 w-auto object-contain mb-3 max-w-[220px]" alt="Logo" />
      ) : (
        <div className="text-2xl font-black text-indigo-600 mb-1 uppercase tracking-tighter">
          {settings.name || 'GESTOCKPRO'}
        </div>
      )}
      <div className="space-y-0.5 text-[9px] uppercase font-bold text-slate-500">
        <p className="flex items-center gap-1.5"><MapPin size={9} className="text-indigo-500" /> {settings.address || ''}</p>
        <p className="flex items-center gap-1.5"><Phone  size={9} className="text-indigo-500" /> {settings.phone   || ''}</p>
        <p className="flex items-center gap-1.5"><Mail   size={9} className="text-indigo-500" /> {settings.email   || ''}</p>
      </div>
    </div>
    <div className="text-right">
      <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5 uppercase">RAPPORT D'AUDIT</h1>
      <p className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block shadow-sm">
        Campagne : {campaignName}
      </p>
      <p className="text-[9px] font-black text-slate-400 mt-3 uppercase tracking-widest">
        Date Audit : {campaignDate}
      </p>
      {totalPages > 1 && (
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          Page {pageNumber} / {totalPages}
        </p>
      )}
    </div>
  </div>
);

interface AuditFooterProps {
  isLastPage: boolean;
  settingsName: string;
  campaignId: string;
  campaignName: string;
  isValidated: boolean;
}

const AuditFooter: React.FC<AuditFooterProps> = ({
  isLastPage, settingsName, campaignId, campaignName, isValidated,
}) => (
  <div className="pt-6 border-t border-slate-100 mt-auto">
    {isLastPage ? (
      <div className="flex justify-between items-end">
        <div className="text-[8px] text-slate-300 font-bold uppercase space-y-1 italic">
          <p>{settingsName} • Kernel Cloud AlwaysData v3.2</p>
          <p>Audit physique certifié conforme à la situation réelle du stock.</p>
          <p className="mt-3">ID TRACE : {campaignId.toUpperCase()}</p>
        </div>
        <div className="text-center w-56 space-y-3">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest underline decoration-indigo-500 underline-offset-8 decoration-2">
            VISA AUDITEUR / DIRECTION
          </p>
          <div className="h-24 flex items-center justify-center">
            {isValidated ? (
              <div className="border-4 border-indigo-600/30 text-indigo-600 rounded-full px-5 py-1.5 rotate-12 font-black uppercase text-lg">
                SCELLÉ
              </div>
            ) : (
              <div className="w-full h-20 border-2 border-dashed border-slate-100 rounded-xl" />
            )}
          </div>
        </div>
      </div>
    ) : (
      <div className="flex justify-between items-center">
        <p className="text-[8px] text-slate-300 font-bold uppercase italic">
          {settingsName} — Campagne : {campaignName} — Suite →
        </p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          {campaignId.toUpperCase()}
        </p>
      </div>
    )}
  </div>
);

interface AuditTableProps {
  items: any[];
}

const AuditTable: React.FC<AuditTableProps> = ({ items }) => (
  <table className="w-full text-left border-separate border-spacing-0">
    <thead>
      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
        <th className="p-4 rounded-l-2xl">ARTICLE / SKU</th>
        <th className="p-4 text-center">SYS. QTY</th>
        <th className="p-4 text-center">COUNT QTY</th>
        <th className="p-4 text-center">DIFF</th>
        <th className="p-4 text-center rounded-r-2xl">CONSTAT D'AUDIT</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {items.map((item: any, i: number) => {
        const numericCounted = Number(item.countedQty) || 0;
        const numericSystem  = Number(item.systemQty)  || 0;
        const verdict = getAuditVerdict(numericCounted, numericSystem);
        const diff    = numericCounted - numericSystem;
        return (
          <tr key={i} className="text-sm font-bold hover:bg-slate-50/50">
            <td className="p-4">
              <p className="text-slate-900 uppercase truncate max-w-[180px]">{item.stock_item?.name}</p>
              <p className="text-[8px] font-mono text-slate-400">SKU: {item.stock_item?.sku}</p>
            </td>
            <td className="p-4 text-center font-black text-slate-400">{numericSystem.toLocaleString()}</td>
            <td className="p-4 text-center font-black text-indigo-600">{numericCounted.toLocaleString()}</td>
            <td className={`p-4 text-center font-black ${diff === 0 ? 'text-slate-300' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </td>
            <td className="p-4 text-center">
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${verdict.bg} ${verdict.color} ${verdict.border}`}>
                {verdict.label}
              </span>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ─── Composant principal ───────────────────────────────────────────────────

const InventoryAuditReport: React.FC<Props> = ({ items, settings, campaign }) => {
  // KPIs globaux (calculés sur tous les articles)
  const totalSystem  = items.reduce((sum, i) => sum + (Number(i.systemQty)  || 0), 0);
  const totalCounted = items.reduce((sum, i) => sum + (Number(i.countedQty) || 0), 0);
  const anomalies    = items.filter(i => i.countedQty !== i.systemQty).length;

  const campaignDate = new Date(campaign.createdAt).toLocaleDateString('fr-FR');
  const isValidated  = campaign.status === 'VALIDATED';

  // ── Découpage en pages ──────────────────────────────────────────────
  const pages: any[][] = [];
  pages.push(items.slice(0, ITEMS_FIRST_PAGE));
  const rest = items.slice(ITEMS_FIRST_PAGE);
  for (let i = 0; i < rest.length; i += ITEMS_PER_PAGE) {
    pages.push(rest.slice(i, i + ITEMS_PER_PAGE));
  }
  const totalPages = pages.length;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body  { margin: 0; }
          .audit-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {pages.map((pageItems, idx) => {
        const pageNumber  = idx + 1;
        const isLastPage  = pageNumber === totalPages;
        const isFirstPage = pageNumber === 1;

        return (
          <div
            key={pageNumber}
            className="audit-page bg-white w-[210mm] min-h-[297mm] mx-auto text-slate-800 font-sans flex flex-col shadow-sm border border-slate-100"
            style={{
              padding: '40px 48px',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter:     isLastPage ? 'auto' : 'page',
            }}
          >
            {/* ══ EN-TÊTE — répété sur TOUTES les pages ══ */}
            <AuditHeader
              settings={settings}
              campaignName={campaign.name}
              campaignDate={campaignDate}
              pageNumber={pageNumber}
              totalPages={totalPages}
            />

            {/* ══ KPIs SYNTHÉTIQUES — page 1 uniquement ══ */}
            {isFirstPage && (
              <div className="grid grid-cols-3 gap-5 mt-8">
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Volume Système</p>
                  <p className="text-2xl font-black text-slate-900">{totalSystem.toLocaleString()}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Volume Physique</p>
                  <p className="text-2xl font-black text-indigo-600">{totalCounted.toLocaleString()}</p>
                </div>
                <div className={`p-5 rounded-3xl border text-center ${anomalies > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Articles avec écart</p>
                  <p className={`text-2xl font-black ${anomalies > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {anomalies}
                  </p>
                </div>
              </div>
            )}

            {/* ══ LABEL CONTINUATION — pages 2+ ══ */}
            {!isFirstPage && (
              <p className="mt-4 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Suite des articles audités — Campagne : {campaign.name}
              </p>
            )}

            {/* ══ TABLEAU D'AUDIT ══ */}
            <div className="mt-6 flex-1">
              <AuditTable items={pageItems} />
            </div>

            {/* ══ PIED DE PAGE — répété sur TOUTES les pages ══ */}
            <AuditFooter
              isLastPage={isLastPage}
              settingsName={settings.name || 'GeStockPro'}
              campaignId={campaign.id}
              campaignName={campaign.name}
              isValidated={isValidated}
            />
          </div>
        );
      })}
    </>
  );
};

export default InventoryAuditReport;
