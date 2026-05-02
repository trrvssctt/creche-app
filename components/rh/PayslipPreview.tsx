import React from 'react';
import { Mail, Phone, MapPin, CheckCircle2, Globe, Building2, Calendar, Briefcase, CreditCard } from 'lucide-react';

interface SalaryCalculation {
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  totalPrimes: number;
  socialChargesEmployee: number;
  socialChargesEmployer: number;
  totalAdvanceDeductions: number;
  incomeTax?: number;
  ruleDeductions?: number;
  currency: string;
}

interface PayslipPreviewProps {
  employee: any;
  contract: any;
  tenant: any;
  salaryCalculation: SalaryCalculation;
  month: number;
  year: number;
}

// ─── Constantes de pagination ──────────────────────────────────────────────
const ROWS_FIRST_PAGE = 4;  // Rubriques page 1 (section employé prend de la place)
const ROWS_PER_PAGE   = 10; // Rubriques pages suivantes

// ─── Sous-composants définis HORS du composant principal ──────────────────

interface SlipHeaderProps {
  tenant: any;
  monthName: string;
  pageNumber: number;
  totalPages: number;
  generatedDate: string;
}

const SlipHeader: React.FC<SlipHeaderProps> = ({
  tenant, monthName, pageNumber, totalPages, generatedDate,
}) => (
  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
    <div>
      {tenant?.logoUrl ? (
        <img
          src={tenant.logoUrl}
          className="h-16 w-auto object-contain mb-3 max-w-[200px]"
          alt="Logo entreprise"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="text-2xl font-black text-indigo-600 mb-1 uppercase tracking-tighter">
          {tenant?.name || 'GESTOCKPRO ENTERPRISE'}
        </div>
      )}
      <div className="space-y-0.5 text-[9px] uppercase font-bold text-slate-500">
        <p className="flex items-center gap-1.5">
          <MapPin size={9} className="text-indigo-500" /> {tenant?.address || 'Dakar, Sénégal'}
        </p>
        <p className="flex items-center gap-1.5">
          <Phone size={9} className="text-indigo-500" /> {tenant?.phone || ''}
        </p>
        <p className="flex items-center gap-1.5">
          <Mail size={9} className="text-indigo-500" /> {tenant?.email || ''}
        </p>
      </div>
    </div>
    <div className="text-right">
      <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5">BULLETIN DE PAIE</h1>
      <p className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block shadow-sm capitalize">
        {monthName}
      </p>
      <p className="text-[9px] font-black text-slate-400 mt-3 uppercase tracking-widest">
        Généré le : {generatedDate}
      </p>
      {tenant?.siret && (
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          SIRET : {tenant.siret}
        </p>
      )}
      {tenant?.registrationNumber && !tenant?.siret && (
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          N° RCCM : {tenant.registrationNumber}
        </p>
      )}
      {totalPages > 1 && (
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          Page {pageNumber} / {totalPages}
        </p>
      )}
    </div>
  </div>
);

interface SlipFooterProps {
  isLastPage: boolean;
  tenantName: string;
  cachetUrl?: string;
  employeeId: string;
  employeeName: string;
  monthName: string;
  website?: string;
}

const SlipFooter: React.FC<SlipFooterProps> = ({
  isLastPage, tenantName, cachetUrl, employeeId, employeeName, monthName, website,
}) => (
  <div className="pt-6 border-t border-slate-100 mt-auto">
    {isLastPage ? (
      <div className="flex justify-between items-end">
        <div className="text-[8px] text-slate-300 font-bold uppercase space-y-1 italic">
          <p>{tenantName} • Système de Paie GeStockPro</p>
          <p>Généré automatiquement par le moteur de paie GeStockPro.</p>
          <p className="mt-3">EMPLOYÉ ID : {employeeId}</p>
          {website && <p className="mt-1">www: {website}</p>}
        </div>
        <div className="text-center w-56 space-y-3">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest underline decoration-indigo-500 underline-offset-8 decoration-2">
            VISA & CACHET
          </p>
          <div className="h-24 flex items-center justify-center">
            {cachetUrl ? (
              <img
                src={cachetUrl}
                className="h-24 w-auto object-contain mix-blend-multiply hover:scale-110 transition-transform"
                alt="Tampon Officiel"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="border-4 border-emerald-500/30 text-emerald-500 rounded-full px-5 py-1.5 rotate-12 font-black uppercase text-lg">
                VALIDÉ
              </div>
            )}
          </div>
          <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
            <p>Document officiel</p>
            <p>{tenantName}</p>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex justify-between items-center">
        <p className="text-[8px] text-slate-300 font-bold uppercase italic">
          {tenantName} — {employeeName} — {monthName} — Suite →
        </p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          {employeeId}
        </p>
      </div>
    )}
  </div>
);

type RowNature = 'Gain' | 'Retenue' | 'Info' | 'Brut';

interface SalaryRow {
  label: string;
  value: number;
  color: string;
  sign: string;
  nature: RowNature;
  dotColor: string;
}

interface RowsTableProps {
  rows: SalaryRow[];
  currency: string;
  fmt: (n: number | null | undefined) => string;
}

const RowsTable: React.FC<RowsTableProps> = ({ rows, currency, fmt }) => (
  <table className="w-full text-left border-separate border-spacing-0">
    <thead>
      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
        <th className="p-4 rounded-l-2xl">Rubrique</th>
        <th className="p-4">Nature</th>
        <th className="p-4 text-right rounded-r-2xl">Montant ({currency})</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.map((row, i) => (
        <tr
          key={i}
          className={`text-sm font-bold hover:bg-slate-50/50 ${row.nature === 'Brut' ? 'bg-slate-50 font-black border-t-2 border-slate-200' : ''}`}
        >
          <td className="p-4">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${row.dotColor} inline-block`} />
              <span className="text-slate-900 uppercase tracking-tight">{row.label}</span>
            </span>
          </td>
          <td className="p-4">
            <span className={`text-[8px] font-mono px-2 py-1 rounded-md uppercase
              ${row.nature === 'Gain'    ? 'bg-emerald-50 text-emerald-700' : ''}
              ${row.nature === 'Retenue' ? 'bg-rose-50 text-rose-700'       : ''}
              ${row.nature === 'Info' || row.nature === 'Brut' ? 'bg-slate-100 text-slate-500' : ''}
            `}>
              {row.nature === 'Brut' ? 'Brut' : row.nature}
            </span>
          </td>
          <td className={`p-4 text-right font-black ${row.color}`}>
            {row.sign}{fmt(row.value)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Composant principal ───────────────────────────────────────────────────

const PayslipPreview: React.FC<PayslipPreviewProps> = ({
  employee,
  contract,
  tenant,
  salaryCalculation: salary,
  month,
  year,
}) => {
  const monthName = new Date(`${year}-${String(month).padStart(2, '0')}-01`)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const currency     = salary.currency || tenant?.currency || 'F CFA';
  const generatedDate = new Date().toLocaleDateString('fr-FR');
  const employeeId    = employee.matricule || `EMP${employee.id}`;
  const employeeName  = `${employee.firstName} ${employee.lastName}`;

  const fmt = (n: number | undefined | null): string => {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Math.round(Number(n) * 100 / 100).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const incomeTaxAmt     = salary.incomeTax     ?? 0;
  const ruleDeductionsAmt = salary.ruleDeductions ?? 0;

  // Toutes les lignes de rubriques dans l'ordre logique
  const baseRows: SalaryRow[] = [
    { label: 'Salaire de base',           value: salary.baseSalary,            color: 'text-slate-900',   sign: '',  nature: 'Gain',    dotColor: 'bg-emerald-500' },
    { label: 'Primes du mois',            value: salary.totalPrimes,           color: 'text-emerald-600', sign: '+', nature: 'Gain',    dotColor: 'bg-emerald-500' },
    { label: 'Salaire Brut',              value: salary.grossSalary,           color: 'text-slate-900',   sign: '',  nature: 'Brut',    dotColor: 'bg-slate-400'   },
    { label: 'Charges sociales salarié',  value: salary.socialChargesEmployee, color: 'text-rose-600',    sign: '-', nature: 'Retenue', dotColor: 'bg-rose-500'    },
    { label: 'Impôt sur le revenu',       value: incomeTaxAmt,                 color: 'text-rose-600',    sign: '-', nature: 'Retenue', dotColor: 'bg-rose-500'    },
    { label: 'Avances déduites',          value: salary.totalAdvanceDeductions,color: 'text-rose-600',    sign: '-', nature: 'Retenue', dotColor: 'bg-rose-500'    },
  ];
  if (ruleDeductionsAmt > 0) {
    baseRows.push({ label: 'Déductions règles RH',     value: ruleDeductionsAmt,            color: 'text-rose-600',    sign: '-', nature: 'Retenue', dotColor: 'bg-rose-500'    });
  }
  baseRows.push({ label: 'Charges patronales (info)', value: salary.socialChargesEmployer, color: 'text-slate-500',   sign: '',  nature: 'Info',    dotColor: 'bg-slate-400'   });
  const allRows: SalaryRow[] = baseRows;

  // Découpage en pages
  const pages: SalaryRow[][] = [];
  pages.push(allRows.slice(0, ROWS_FIRST_PAGE));
  const rest = allRows.slice(ROWS_FIRST_PAGE);
  for (let i = 0; i < rest.length; i += ROWS_PER_PAGE) {
    pages.push(rest.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = pages.length;

  const infoRows = [
    { icon: <Briefcase size={10} />, label: 'Poste',           value: employee.position || 'N/A' },
    { icon: <Building2 size={10} />, label: 'Département',     value: employee.departmentInfo?.name || 'N/A' },
    { icon: <Calendar  size={10} />, label: "Date d'embauche", value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'N/A' },
    { icon: <CreditCard size={10}/>, label: 'Type de contrat', value: contract?.type || employee.contractType || 'N/A' },
    { icon: <Globe     size={10} />, label: 'Pays',            value: employee.country || 'Sénégal' },
  ];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body  { margin: 0; }
          .slip-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {pages.map((pageRows, idx) => {
        const pageNumber  = idx + 1;
        const isLastPage  = pageNumber === totalPages;
        const isFirstPage = pageNumber === 1;

        return (
          <div
            key={pageNumber}
            className="slip-page bg-white w-[210mm] min-h-[297mm] mx-auto text-slate-800 font-sans flex flex-col shadow-sm border border-slate-100"
            style={{
              padding: '40px 48px',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter:     isLastPage ? 'auto' : 'page',
            }}
          >
            {/* ══ EN-TÊTE — répété sur TOUTES les pages ══ */}
            <SlipHeader
              tenant={tenant}
              monthName={monthName}
              pageNumber={pageNumber}
              totalPages={totalPages}
              generatedDate={generatedDate}
            />

            {/* ══ FICHE EMPLOYÉ — page 1 uniquement ══ */}
            {isFirstPage && (
              <div className="grid grid-cols-2 gap-8 mt-8">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salarié</p>
                  {employee.photoUrl && (
                    <img
                      src={employee.photoUrl}
                      alt={employee.firstName}
                      className="w-14 h-14 rounded-2xl object-cover mb-3 border-2 border-white shadow"
                    />
                  )}
                  <h2 className="text-lg font-black text-slate-900 uppercase mb-2">{employeeName}</h2>
                  <div className="space-y-1.5">
                    {infoRows.map(({ icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="text-indigo-500">{icon}</span>{label}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-center text-right space-y-3">
                  <div className="inline-flex items-center justify-end gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl w-fit ml-auto border border-emerald-100">
                    <CheckCircle2 size={18} />
                    <span className="text-base font-black uppercase tracking-tight">BULLETIN OFFICIEL</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">
                    Mention légale :<br />
                    <span className="text-slate-900 font-black italic">
                      {tenant?.invoiceFooter || tenant?.legalMention || 'Bulletin conforme à la législation du travail en vigueur au Sénégal.'}
                    </span>
                  </div>
                  {tenant?.socialSecurityNumber && (
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                      CNSS : {tenant.socialSecurityNumber}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ LABEL CONTINUATION — pages 2+ ══ */}
            {!isFirstPage && (
              <p className="mt-4 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Suite des rubriques — {employeeName} — {monthName}
              </p>
            )}

            {/* ══ TABLEAU DES RUBRIQUES ══ */}
            <div className="mt-6 flex-1">
              <RowsTable rows={pageRows} currency={currency} fmt={fmt} />
            </div>

            {/* ══ TOTAUX — dernière page uniquement ══ */}
            {isLastPage && (
              <div className="mt-8 flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="px-5 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span>Salaire brut</span>
                      <span>{fmt(salary.grossSalary)} {currency}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                      <span>Total retenues</span>
                      <span>-{fmt((salary.socialChargesEmployee ?? 0) + (salary.totalAdvanceDeductions ?? 0))} {currency}</span>
                    </div>
                    {(salary.totalPrimes ?? 0) > 0 && (
                      <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                        <span>Total primes</span>
                        <span>+{fmt(salary.totalPrimes)} {currency}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center p-5 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                    <span className="text-xs font-black uppercase tracking-widest">NET À PAYER</span>
                    <span className="text-xl font-black">
                      {fmt(salary.netSalary)} <span className="text-xs">{currency}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ PIED DE PAGE — répété sur TOUTES les pages ══ */}
            <SlipFooter
              isLastPage={isLastPage}
              tenantName={tenant?.name || 'GeStockPro Enterprise'}
              cachetUrl={tenant?.cachetUrl}
              employeeId={employeeId}
              employeeName={employeeName}
              monthName={monthName}
              website={tenant?.website}
            />
          </div>
        );
      })}
    </>
  );
};

export default PayslipPreview;
