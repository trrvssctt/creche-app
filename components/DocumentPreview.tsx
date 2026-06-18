import React, { useEffect, useState } from 'react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { Mail, Phone, MapPin, CheckCircle2, Truck, Globe } from 'lucide-react';
import { useToast } from './ToastProvider';

interface DocumentProps {
  type: 'FACTURE' | 'RECU' | 'BON_SORTIE' | 'SUBSCRIPTION_INVOICE';
  sale: any;
  tenant: any;
  currency: string;
}

// ─── Constantes de pagination ──────────────────────────────────────────────
const ITEMS_FIRST_PAGE = 8;  // Articles page 1 (section client prend de la place)
const ITEMS_PER_PAGE   = 16; // Articles pages suivantes

// ─── Sous-composants définis HORS du composant principal ──────────────────
// IMPORTANT : les définir à l'intérieur provoquerait un remontage complet
// à chaque render, ce qui efface le contenu affiché.

interface HeaderProps {
  issuer: any;
  isSubInvoice: boolean;
  isBonSortie: boolean;
  saleType: string;
  reference: string;
  createdAt: string;
  pageNumber: number;
  totalPages: number;
}

const DocHeader: React.FC<HeaderProps> = ({
  issuer, isSubInvoice, isBonSortie, saleType,
  reference, createdAt, pageNumber, totalPages,
}) => (
  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
    <div>
      {isSubInvoice ? (
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Globe size={20} />
          </div>
          <div className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
            GESTOCK<span className="text-indigo-600">PRO</span>
          </div>
        </div>
      ) : issuer?.logoUrl ? (
        <img src={issuer.logoUrl} className="h-16 w-auto object-contain mb-3 max-w-[200px]" alt="Logo" />
      ) : (
        <div className="text-2xl font-black text-indigo-600 mb-1 uppercase tracking-tighter">
          {issuer?.name}
        </div>
      )}
      <div className="space-y-0.5 text-[9px] uppercase font-bold text-slate-500">
        <p className="flex items-center gap-1.5">
          <MapPin size={9} className="text-indigo-500" /> {issuer?.address || ''}
        </p>
        <p className="flex items-center gap-1.5">
          <Phone size={9} className="text-indigo-500" /> {issuer?.phone || ''}
        </p>
        <p className="flex items-center gap-1.5">
          <Mail size={9} className="text-indigo-500" /> {issuer?.email || ''}
        </p>
      </div>
    </div>
    <div className="text-right">
      <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5">
        {isBonSortie ? 'BON DE LIVRAISON' : isSubInvoice ? 'FACTURE SERVICES' : saleType}
      </h1>
      <p className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block shadow-sm">
        Ref: #{reference}
      </p>
      <p className="text-[9px] font-black text-slate-400 mt-3 uppercase tracking-widest">
        Date d'émission : {new Date(createdAt).toLocaleDateString('fr-FR')}
      </p>
      {totalPages > 1 && (
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          Page {pageNumber} / {totalPages}
        </p>
      )}
    </div>
  </div>
);

interface FooterProps {
  isLastPage: boolean;
  isSubInvoice: boolean;
  isBonSortie: boolean;
  isPaid: boolean;
  tenantName: string;
  cachetUrl?: string;
  isValidated?: boolean;
  saleId: string;
  reference: string;
  recipientName: string;
}

const DocFooter: React.FC<FooterProps> = ({
  isLastPage, isSubInvoice, isBonSortie, isPaid,
  tenantName, cachetUrl, isValidated, saleId, reference, recipientName,
}) => (
  <div className="pt-6 border-t border-slate-100 mt-auto">
    {isLastPage ? (
      <div className="flex justify-between items-end">
        <div className="text-[8px] text-slate-300 font-bold uppercase space-y-1 italic">
          <p>{isSubInvoice ? 'GeStocPro AI-Native SaaS' : tenantName} • Kernel Cloud AlwaysData v3.2</p>
          <p>Généré automatiquement par le moteur de facturation GeStockPro.</p>
          <p className="mt-3">ID TRANSACTION : {saleId.toUpperCase()}</p>
        </div>
        <div className="text-center w-56 space-y-3">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest underline decoration-indigo-500 underline-offset-8 decoration-2">
            {isBonSortie ? 'LE CLIENT / RÉCEPTIONNAIRE' : 'VISA & CACHET'}
          </p>
          <div className="h-24 flex items-center justify-center">
            {isSubInvoice ? (
              isValidated ? (
                <div className="border-4 border-indigo-600/30 text-indigo-600 rounded-full px-5 py-1.5 rotate-12 font-black uppercase text-lg">
                  GESTORPRO
                </div>
              ) : (
                <div className="w-full h-20 border-2 border-dashed border-slate-100 rounded-xl" />
              )
            ) : isPaid && !isBonSortie && cachetUrl ? (
              <img
                src={cachetUrl}
                className="h-24 w-auto object-contain mix-blend-multiply hover:scale-110 transition-transform"
                alt="Tampon Officiel"
              />
            ) : isPaid && !isBonSortie ? (
              <div className="border-4 border-emerald-500/30 text-emerald-500 rounded-full px-5 py-1.5 rotate-12 font-black uppercase text-lg">
                PAYÉ
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
          {isSubInvoice ? 'GeStocPro AI-Native SaaS' : tenantName} — Ref. #{reference} — {recipientName} — Suite →
        </p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          {saleId.toUpperCase()}
        </p>
      </div>
    )}
  </div>
);

interface ItemsTableProps {
  items: any[];
  isBonSortie: boolean;
  isSubInvoice: boolean;
}

const ItemsTable: React.FC<ItemsTableProps> = ({ items, isBonSortie, isSubInvoice }) => (
  <table className="w-full text-left border-separate border-spacing-0">
    <thead>
      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
        <th className="p-4 rounded-l-2xl">RÉFÉRENCE</th>
        <th className="p-4">DÉSIGNATION</th>
        <th className="p-4 text-center">{isBonSortie ? 'QTÉ LIVRÉE' : 'QTÉ'}</th>
        {!isBonSortie && <th className="p-4 text-right">P.U TTC</th>}
        {!isBonSortie && <th className="p-4 text-right rounded-r-2xl">TOTAL TTC</th>}
        {isBonSortie  && <th className="p-4 text-center rounded-r-2xl">VÉRIFIÉ</th>}
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {items.map((item: any, i: number) => {
        const name         = item.stock_item?.name || item.service?.name || item.name || 'Article sans nom';
        const skuLabel     = item.stock_item?.sku ? item.stock_item.sku : (isSubInvoice ? 'GSP-SaaS' : 'SERVICE');
        const qtyDelivered = item.quantityDelivered ?? item.quantity_delivered ?? 0;
        const qtyTotal     = item.quantity ?? 1;
        const unitPrice    = parseFloat(item.unitPrice || item.price || 0);
        const lineTtc      = parseFloat(item.totalTtc  || (unitPrice * qtyTotal) || 0);
        return (
          <tr key={i} className="text-sm font-bold hover:bg-slate-50/50">
            <td className="p-4">
              <span className="text-[8px] font-mono text-slate-400">{skuLabel}</span>
            </td>
            <td className="p-4">
              <p className="text-slate-900 uppercase tracking-tight">{name}</p>
            </td>
            <td className="p-4 text-center font-black">
              {isBonSortie ? qtyDelivered : qtyTotal}
            </td>
            {!isBonSortie && <td className="p-4 text-right font-medium">{unitPrice.toLocaleString()}</td>}
            {!isBonSortie && <td className="p-4 text-right font-black">{lineTtc.toLocaleString()}</td>}
            {isBonSortie  && <td className="p-4 text-center text-[10px] text-slate-300 italic">[ ]</td>}
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ─── Composant principal ───────────────────────────────────────────────────

const DocumentPreview: React.FC<DocumentProps> = ({ type, sale, tenant, currency }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const showToast = useToast();

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await apiClient.get(`/documents/entity/${type}/${sale.id}`);
        setDocuments(Array.isArray(docs) ? docs : []);
      } catch (err) {
        console.warn('Failed to load documents', err);
      }
    };
    fetchDocs();
  }, [sale.id, type]);

  const downloadDocument = async (docId: string, filename: string) => {
    try {
      setDownloadLoading(docId);
      const session = authBridge.getSession();
      const token   = session?.token;
      //const res = await fetch(`http://localhost:3000/api/documents/download/${docId}`, {
      const res = await fetch(`https://gestock.realtechprint.com/api/documents/download/${docId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.bin';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du téléchargement', 'error');
    } finally {
      setDownloadLoading(null);
    }
  };

  // ── Données calculées ────────────────────────────────────────────────
  const isPaid       = parseFloat(sale.amountPaid || 0) >= parseFloat(sale.totalTtc || 0);
  const totalTtc     = parseFloat(sale.totalTtc   || 0);
  const amountPaid   = parseFloat(sale.amountPaid  || 0);
  const remaining    = Math.max(0, totalTtc - amountPaid);
  const isBonSortie  = type === 'BON_SORTIE';
  const isSubInvoice = type === 'SUBSCRIPTION_INVOICE';

  const issuer: any = isSubInvoice ? {
    name: 'GESTOCKPRO SaaS',
    address: "Centre Technologique, Avenue de l'IA, Dakar, Sénégal",
    phone: '+221 78 131 13 71',
    email: 'diankaseydou@gestock.pro',
    logoUrl: null,
  } : tenant;

  const recipient = sale.customer;
  const walkinName  = sale.walkin_name  || sale.walkinName  || null;
  const walkinPhone = sale.walkin_phone || sale.walkinPhone || null;
  const recipientName = recipient?.companyName || recipient?.name || walkinName || 'Client de Passage';

  const allItems = isBonSortie
    ? (sale.items?.filter((i: any) => i.stockItemId || i.stock_item_id || i.stock_item) || [])
    : (sale.items || []);

  // ── Découpage en pages ────────────────────────────────────────────────
  const pages: any[][] = [];
  pages.push(allItems.slice(0, ITEMS_FIRST_PAGE));
  const rest = allItems.slice(ITEMS_FIRST_PAGE);
  for (let i = 0; i < rest.length; i += ITEMS_PER_PAGE) {
    pages.push(rest.slice(i, i + ITEMS_PER_PAGE));
  }
  const totalPages = pages.length;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body   { margin: 0; }
          .doc-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {pages.map((pageItems, idx) => {
        const pageNumber  = idx + 1;
        const isLastPage  = pageNumber === totalPages;
        const isFirstPage = pageNumber === 1;

        return (
          <div
            key={pageNumber}
            className="doc-page bg-white w-[210mm] min-h-[297mm] mx-auto text-slate-800 font-sans flex flex-col shadow-sm border border-slate-100"
            style={{
              padding: '40px 48px',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter:     isLastPage ? 'auto' : 'page',
            }}
          >
            {/* ══ EN-TÊTE — répété sur TOUTES les pages ══ */}
            <DocHeader
              issuer={issuer}
              isSubInvoice={isSubInvoice}
              isBonSortie={isBonSortie}
              saleType={type}
              reference={sale.reference}
              createdAt={sale.createdAt}
              pageNumber={pageNumber}
              totalPages={totalPages}
            />

            {/* ══ BLOC CLIENT — page 1 uniquement ══ */}
            {isFirstPage && (
              <div className="grid grid-cols-2 gap-8 mt-8">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Client / Destinataire
                  </p>
                  <h2 className="text-lg font-black text-slate-900 uppercase mb-1.5">
                    {recipientName}
                  </h2>
                  <div className="space-y-0.5 text-xs text-slate-600 font-medium leading-relaxed">
                    <p>{recipient?.billingAddress || recipient?.address || (walkinName ? 'Client de passage' : 'Vente Directe')}</p>
                    <p>{recipient?.phone || walkinPhone}</p>
                    <p>{recipient?.email}</p>
                  </div>
                </div>
                <div className="flex flex-col justify-center text-right space-y-3">
                  {isBonSortie ? (
                    <div className="inline-flex items-center justify-end gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-2xl w-fit ml-auto border border-amber-100">
                      <Truck size={18} />
                      <span className="text-base font-black uppercase tracking-tight">LOGISTIQUE SORTIE</span>
                    </div>
                  ) : (isPaid || (isSubInvoice && sale?.isValidated)) && (
                    <div className="inline-flex items-center justify-end gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl w-fit ml-auto border border-emerald-100">
                      <CheckCircle2 size={18} />
                      <span className="text-base font-black uppercase tracking-tight">SOLDE ENCAISSÉ</span>
                    </div>
                  )}
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">
                    {isBonSortie ? 'Validation de sortie physique des marchandises :' : 'Note légale :'}<br />
                    <span className="text-slate-900 font-black italic">
                      {isSubInvoice
                        ? 'Facture acquittée. Merci de votre confiance en GeStocPro.'
                        : (tenant?.invoiceFooter || 'Paiement selon conditions générales.')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ LABEL CONTINUATION — pages 2+ ══ */}
            {!isFirstPage && (
              <p className="mt-4 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Suite des articles — {recipientName}
              </p>
            )}

            {/* ══ TABLEAU DES ARTICLES ══ */}
            <div className="mt-6 flex-1">
              <ItemsTable items={pageItems} isBonSortie={isBonSortie} isSubInvoice={isSubInvoice} />
            </div>

            {/* ══ TOTAUX — dernière page uniquement ══ */}
            {isLastPage && !isBonSortie && (
              <div className="mt-8 flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between items-center p-5 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                    <span className="text-xs font-black uppercase tracking-widest">NET À PAYER</span>
                    <span className="text-xl font-black">
                      {totalTtc.toLocaleString()} <span className="text-xs">{currency}</span>
                    </span>
                  </div>
                  <div className="px-5 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      <span>DÉJÀ RÉGLÉ</span>
                      <span>-{amountPaid.toLocaleString()} {currency}</span>
                    </div>
                    {remaining > 0 && (
                      <div className="flex justify-between text-sm font-black text-rose-600 uppercase tracking-widest pt-1.5 border-t border-slate-100">
                        <span>SOLDE À PAYER</span>
                        <span>{remaining.toLocaleString()} {currency}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ PIED DE PAGE — répété sur TOUTES les pages ══ */}
            <DocFooter
              isLastPage={isLastPage}
              isSubInvoice={isSubInvoice}
              isBonSortie={isBonSortie}
              isPaid={isPaid}
              tenantName={tenant?.name || ''}
              cachetUrl={tenant?.cachetUrl}
              isValidated={sale?.isValidated}
              saleId={sale.id}
              reference={sale.reference}
              recipientName={recipientName}
            />
          </div>
        );
      })}
    </>
  );
};

export default DocumentPreview;
