import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Eye, X, RefreshCw, ShoppingCart, Wallet,
  Loader2, DollarSign, Trash2, ArrowRight,
  Package, PlusCircle, MinusCircle, FileText,
  CheckCircle, Printer, Truck, Sparkles, Receipt,
  History, Info, ChevronRight, Ban, Boxes, CreditCard,
  Plus as PlusSmall, Minus as MinusSmall, FileDown,
  Download, Upload,
  RotateCcw, AlertTriangle, Edit3, Save, Lock, Clock, Zap, ShieldAlert,
  User as UserIcon, CheckCircle2, Percent, ClipboardList, Filter, Calendar,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '../services/api';
import { authBridge } from '../services/authBridge';
import { User, StockItem, Customer } from '../types';
import YearMonthPicker from './YearMonthPicker';
import DocumentPreview from './DocumentPreview';
import { useToast } from './ToastProvider';
import { buildExportHandlers, ExportColumn } from '../services/exportUtils';

const Sales = ({ currency, user, tenantSettings }: { currency: string, user: User, tenantSettings?: any }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [cartTab, setCartTab] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showDocGenerator, setShowDocGenerator] = useState<{ sale: any, mode: 'FACTURE' | 'RECU' | 'BON_SORTIE' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [activeInventory, setActiveInventory] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Year/Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Filtres
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    customerId: 'ALL',
    dateFrom: '',
    dateTo: '',
    paymentState: 'ALL', // ALL, PAID, UNPAID, PARTIAL
    deliveryState: 'ALL'  // ALL, DELIVERED, PENDING, PARTIAL
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'CASH',
    reference: '',
    proofImage: '',      // base64 image pour mobile money
    chequeNumber: '',
    bankName: '',
    chequeDate: new Date().toISOString().split('T')[0],
    chequeOrder: ''
  });
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({});
  const [cancelForm, setCancelForm] = useState({ reason: '', returnToStock: {} as Record<string, number> });

  const [saleForm, setSaleForm] = useState({
    customerId: '',
    walkinName: '',
    walkinPhone: '',
    paymentMethod: 'CASH',
    amountPaid: 0,
    paymentReference: '',
    paymentProofImage: '',
    chequeNumber: '',
    bankName: '',
    chequeDate: new Date().toISOString().split('T')[0],
    chequeOrder: '',
    items: [] as { productId: string, quantity: number, price: number, name: string, type: 'PRODUCT' | 'SERVICE' }[]
  });
  const showToast = useToast();
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Derive available years from loaded sales
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    sales.forEach(s => { if (s.createdAt) years.add(new Date(s.createdAt).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [sales]);

  // Sync year/month selection → dateFrom/dateTo filter
  useEffect(() => {
    if (selectedYear === null) {
      setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
      return;
    }
    const ms = selectedMonth !== null ? selectedMonth : 0;
    const me = selectedMonth !== null ? selectedMonth : 11;
    setFilters(f => ({
      ...f,
      dateFrom: new Date(selectedYear, ms, 1).toISOString().split('T')[0],
      dateTo:   new Date(selectedYear, me + 1, 0).toISOString().split('T')[0]
    }));
  }, [selectedYear, selectedMonth]);

  // Colonnes pour l'export (partagées CSV/Excel/PDF)
  const exportColumns: ExportColumn[] = [
    { key: 'reference', label: 'Référence' },
    { key: 'createdAt', label: 'Date', format: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
    { key: 'customer', label: 'Client', format: (_v, row) => row.customer?.companyName || row.customer || 'N/A' },
    { key: 'totalHt', label: 'Montant HT', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'totalTtc', label: 'Montant TTC', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'amountPaid', label: 'Encaissé', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'totalTtc', label: 'Solde Restant', format: (_v, row) => Number(Math.max(0, (row.totalTtc || 0) - (row.amountPaid || 0))).toLocaleString('fr-FR') },
    { key: 'status', label: 'Statut', format: (v) => v === 'TERMINE' ? 'Soldé' : v === 'EN_COURS' ? 'En cours' : v === 'ANNULE' ? 'Annulé' : v === 'BROUILLON' ? 'Brouillon (en attente encaissement)' : v || '' },
    { key: 'paymentMethod', label: 'Méthode paiement' },
    { key: 'deliveryStatus', label: 'Livraison' },
  ];


  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesData, stocksData, srvData, customersData, campaigns] = await Promise.all([
        apiClient.get('/sales'),
        apiClient.get('/stock'),
        apiClient.get('/services'),
        apiClient.get('/customers'),
        apiClient.get('/stock/campaigns')
      ]);
      setSales(salesData || []);
      setStocks(stocksData || []);
      setServices((srvData || []).filter((s: any) => s.isActive));
      setCustomers(customersData || []);
      setActiveInventory(campaigns.find((c: any) => c.status === 'DRAFT'));
    } catch (err) {
      console.error("Kernel Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getRates = (sale: any) => {
    const total = parseFloat(sale.totalTtc);
    const paid = parseFloat(sale.amountPaid);
    const payRate = Math.min(100, Math.round((paid / (total || 1)) * 100));

    const productItems = (sale.items || []).filter((i: any) => i.stock_item_id || i.stockItemId);
    const totalQty = productItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
    const deliveredQty = productItems.reduce((sum: number, i: any) => sum + (i.quantityDelivered || 0), 0);
    const delivRate = totalQty > 0 ? Math.min(100, Math.round((deliveredQty / totalQty) * 100)) : 100;

    return { payRate, delivRate, deliveredQty, totalQty, isDeliverable: productItems.length > 0 };
  };

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const { payRate, delivRate } = getRates(sale);
      const sDate = new Date(sale.createdAt).toISOString().split('T')[0];
      
      const matchesSearch = (sale.reference || '').toLowerCase().includes(filters.search.toLowerCase()) || 
                           (sale.customer?.companyName || '').toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesStatus = filters.status === 'ALL' || sale.status === filters.status;
      const matchesCustomer = filters.customerId === 'ALL' || sale.customer_id === filters.customerId;
      const matchesFrom = filters.dateFrom === '' || sDate >= filters.dateFrom;
      const matchesTo = filters.dateTo === '' || sDate <= filters.dateTo;
      
      const matchesPayment = filters.paymentState === 'ALL' || 
                            (filters.paymentState === 'PAID' && payRate === 100) ||
                            (filters.paymentState === 'UNPAID' && payRate === 0) ||
                            (filters.paymentState === 'PARTIAL' && payRate > 0 && payRate < 100);
                            
      const matchesDelivery = filters.deliveryState === 'ALL' ||
                             (filters.deliveryState === 'DELIVERED' && delivRate === 100) ||
                             (filters.deliveryState === 'PENDING' && delivRate === 0) ||
                             (filters.deliveryState === 'PARTIAL' && delivRate > 0 && delivRate < 100);

      return matchesSearch && matchesStatus && matchesCustomer && matchesFrom && matchesTo && matchesPayment && matchesDelivery;
    });
  }, [sales, filters]);

  const visibleSales = useMemo(() => {
    let filtered = filteredSales;
    if (pageSize === -1) return filtered;
    return filtered.slice(0, pageSize);
  }, [filteredSales, pageSize]);

  const addToCart = (item: any, type: 'PRODUCT' | 'SERVICE') => {
    const existing = saleForm.items.find(i => i.productId === item.id && i.type === type);
    if (existing) {
      setSaleForm({
        ...saleForm,
        items: saleForm.items.map(i => i.productId === item.id && i.type === type ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      setSaleForm({
        ...saleForm,
        items: [...saleForm.items, { 
          productId: item.id, 
          quantity: 1, 
          price: type === 'PRODUCT' ? parseFloat(item.unitPrice) : parseFloat(item.price), 
          name: item.name,
          type 
        }]
      });
    }
  };

  const updateCartQty = (idx: number, delta: number) => {
    const newItems = [...saleForm.items];
    newItems[idx].quantity = Math.max(1, newItems[idx].quantity + delta);
    setSaleForm({ ...saleForm, items: newItems });
  };

  const updateCartQtyDirect = (idx: number, newQuantity: number) => {
    const newItems = [...saleForm.items];
    newItems[idx].quantity = Math.max(1, newQuantity || 1);
    setSaleForm({ ...saleForm, items: newItems });
  };

  const removeFromCart = (idx: number) => {
    setSaleForm({ ...saleForm, items: saleForm.items.filter((_, i) => i !== idx) });
  };

  const cartTotal = useMemo(() => {
    return saleForm.items.reduce((sum, i) => sum + (i.price * i.quantity), 0) * 1.18;
  }, [saleForm.items]);

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeInventory) { showToast("Ventes bloquées durant l'inventaire.", 'info'); return; }
    if (saleForm.items.length === 0) { showToast("Le panier est vide.", 'error'); return; }

    const hasPaid = parseFloat(saleForm.amountPaid.toString()) > 0;
    const isMobileMoneyCreate = ['WAVE', 'ORANGE_MONEY', 'MTN_MOMO'].includes(saleForm.paymentMethod);
    const isDirectSale = !saleForm.customerId;

    // Vente directe (client de passage) : nom et numéro obligatoires
    if (!editModeId && isDirectSale) {
      if (!saleForm.walkinName.trim()) {
        showToast('Veuillez renseigner le nom du client de passage', 'error');
        return;
      }
      if (!saleForm.walkinPhone.trim()) {
        showToast('Veuillez renseigner le numéro du client de passage', 'error');
        return;
      }
      // Référence obligatoire pour paiement mobile (vente directe)
      if (hasPaid && isMobileMoneyCreate && !saleForm.paymentReference) {
        showToast('Veuillez saisir la référence de transaction pour ce paiement mobile', 'error');
        return;
      }
    }

    if (!editModeId && hasPaid && isMobileMoneyCreate && !saleForm.paymentReference && !saleForm.paymentProofImage) {
      showToast('Veuillez saisir la référence de transaction ou joindre une preuve (image)', 'error');
      return;
    }
    if (!editModeId && hasPaid && saleForm.paymentMethod === 'CHEQUE' && (!saleForm.chequeNumber || !saleForm.bankName)) {
      showToast('Veuillez renseigner le numéro de chèque et la banque émettrice', 'error');
      return;
    }
    if (!editModeId && hasPaid && saleForm.paymentMethod === 'TRANSFER' && !saleForm.paymentReference) {
      showToast('Veuillez renseigner la référence du virement bancaire', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (editModeId) {
        await apiClient.put(`/sales/${editModeId}`, { customerId: saleForm.customerId || null, items: saleForm.items });
      } else {
        await apiClient.post('/sales', {
          customerId: saleForm.customerId || null,
          walkinName: !saleForm.customerId ? saleForm.walkinName.trim() : null,
          walkinPhone: !saleForm.customerId ? saleForm.walkinPhone.trim() : null,
          items: saleForm.items,
          amountPaid: parseFloat(saleForm.amountPaid.toString()),
          paymentMethod: saleForm.paymentMethod,
          paymentReference: saleForm.paymentReference || null,
          paymentProofImage: saleForm.paymentProofImage || null,
          chequeNumber: saleForm.chequeNumber || null,
          bankName: saleForm.bankName || null,
          chequeDate: saleForm.chequeDate || null,
          chequeOrder: saleForm.chequeOrder || null,
        });
      }
      setShowCreateModal(false);
      setEditModeId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erreur', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (paymentForm.amount <= 0) {
      showToast('Le montant doit être supérieur à 0', 'error');
      return;
    }

    const remainingAmount = parseFloat(showPaymentModal.totalTtc) - parseFloat(showPaymentModal.amountPaid);
    if (paymentForm.amount > remainingAmount) {
      showToast(`Le montant ne peut pas dépasser le solde restant de ${remainingAmount.toLocaleString()} ${currency}`, 'error');
      return;
    }

    const isMobileMoney = ['WAVE', 'ORANGE_MONEY', 'MTN_MOMO'].includes(paymentForm.method);
    if (isMobileMoney && !paymentForm.reference && !paymentForm.proofImage) {
      showToast('Veuillez saisir la référence de transaction ou joindre une preuve (image)', 'error');
      return;
    }

    if (paymentForm.method === 'CHEQUE' && (!paymentForm.chequeNumber || !paymentForm.bankName)) {
      showToast('Veuillez renseigner le numéro de chèque et la banque émettrice', 'error');
      return;
    }

    if (paymentForm.method === 'TRANSFER' && !paymentForm.reference) {
      showToast('Veuillez renseigner la référence du virement bancaire', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.post(`/sales/${showPaymentModal.id}/payments`, paymentForm);
      setShowPaymentModal(null);
      setSelectedSaleDetails(null);
      fetchData();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleUpdateChequeStatus = async (paymentId: string, newStatus: string) => {
    setUpdatingPaymentId(paymentId);
    try {
      await apiClient.put(`/sales/payments/${paymentId}/status`, { status: newStatus });
      showToast('Statut du chèque mis à jour', 'success');
      setSelectedSaleDetails(null);
      fetchData();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
    finally { setUpdatingPaymentId(null); }
  };

  const handleDelivery = async () => {
    const itemsToDeliver = Object.entries(deliveryQuantities).map(([itemId, qty]) => ({ itemId, qtyToDeliver: qty }));
    if (itemsToDeliver.length === 0) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/sales/${showDeliveryModal.id}/delivery`, { items: itemsToDeliver });
      setShowDeliveryModal(null);
      setSelectedSaleDetails(null);
      fetchData();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleCancelSale = async () => {
    if (!cancelForm.reason) { showToast("Raison obligatoire.", 'error'); return; }
    setActionLoading(true);
    try {
      await apiClient.post(`/sales/${showCancelModal.id}/cancel`, { 
        reason: cancelForm.reason, 
        returnToStockMap: cancelForm.returnToStock 
      });
      setShowCancelModal(null);
      setSelectedSaleDetails(null);
      fetchData();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleEditSaleRequest = (sale: any) => {
    setEditModeId(sale.id);
    const formattedItems = sale.items.map((item: any) => ({
      productId: item.stock_item_id || item.stockItemId || item.service_id || item.serviceId,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice),
      name: item.stock_item?.name || item.service?.name || item.name,
      type: item.service_id ? 'SERVICE' as const : 'PRODUCT' as const
    }));
    setSaleForm({
      customerId: sale.customer_id || sale.customerId || '',
      paymentMethod: 'CASH',
      amountPaid: parseFloat(sale.amountPaid),
      items: formattedItems
    });
    setSelectedSaleDetails(null);
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      {activeInventory && (
        <div className="absolute inset-0 z-50 bg-slate-50/60 backdrop-blur-sm flex items-center justify-center p-6 rounded-[3rem]">
           <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-indigo-600 max-w-lg text-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                <ShoppingCart size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Facturation Suspendue</h3>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Inventaire en cours : {activeInventory.name}</p>
              </div>
              <p className="text-sm text-slate-500 font-medium leading-relaxed uppercase">
                Toutes les opérations commerciales sont suspendues pour garantir l'intégrité de l'audit physique.
              </p>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-3">
                 <Lock size={16} className="text-slate-400" />
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registre temporairement scellé</span>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center justify-between bg-white p-4 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <ShoppingCart className="text-indigo-600" size={32} /> Facturation Scolaire
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">
            Factures & Paiements — Le Toit des Anges
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
            Afficher
            <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))} className="ml-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-black outline-none">
              <option value={5}>5</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>Tous</option>
            </select>
          </label>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}>
            <Filter size={20} /> FILTRES {filteredSales.length !== sales.length && <span className="bg-white text-indigo-600 w-4 h-4 rounded-full flex items-center justify-center text-[8px]">!</span>}
          </button>
          <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* EXPORT TOOLBAR */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
            >
              <FileDown size={18} /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 w-52 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {(() => {
                  const exportInfo = buildExportHandlers({
                    data: filteredSales,
                    columns: exportColumns,
                    options: {
                      filename: `ventes-${new Date().toISOString().split('T')[0]}`,
                      sheetName: 'Ventes',
                      title: 'Registre des Ventes',
                      companyInfo: {
                        name: (tenantSettings as any)?.companyName || (tenantSettings as any)?.name,
                        address: (tenantSettings as any)?.address,
                        phone: (tenantSettings as any)?.phone,
                        email: (tenantSettings as any)?.email,
                      }
                    },
                    tableElementId: 'sales-table-export',
                    showToast,
                  });
                  const items = [
                    { label: 'CSV (.csv)', action: exportInfo.csv, icon: '📄' },
                    { label: 'Excel (.xlsx)', action: exportInfo.excel, icon: '📊' },
                    /*{ label: 'PDF (impression)', action: exportInfo.pdf, icon: '🖨️' },
                    { label: 'Image PNG', action: exportInfo.imagePng, icon: '🖼️' },
                    { label: 'Image JPG', action: exportInfo.imageJpg, icon: '📷' },*/
                  ];
                  return items.map(({ label, action, icon }) => (
                    <button
                      key={label}
                      onClick={() => { action(); setShowExportMenu(false); }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                    >
                      <span>{icon}</span> {label}
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>

          <button
            onClick={() => { if (activeInventory) return; setEditModeId(null); setSaleForm({ customerId: '', paymentMethod: 'CASH', amountPaid: 0, paymentReference: '', paymentProofImage: '', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], chequeOrder: '', items: [] }); setShowCreateModal(true); }}
            disabled={!!activeInventory}
            className={`px-4 md:px-10 py-3 md:py-5 rounded-[1.5rem] font-black transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest active:scale-95 ${activeInventory ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
          >
            <Plus size={18} /> NOUVELLE FACTURE
          </button>
        </div>
      </div>

      {/* ZONE FILTRES AVANCÉS */}
      {showFilters && (
        <div className="bg-white p-4 md:p-8 rounded-[3rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-6">
          <YearMonthPicker
            dataYears={availableYears}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Recherche libre</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Réf, Élève..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Statut Transactionnel</label>
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="ALL">Tous les statuts</option>
                <option value="EN_COURS">EN COURS</option>
                <option value="BROUILLON">BROUILLON (en attente d'encaissement)</option>
                <option value="TERMINE">TERMINÉ</option>
                <option value="ANNULE">ANNULÉ</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Élève / Famille</label>
              <select value={filters.customerId} onChange={e => setFilters({...filters, customerId: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="ALL">Tous les élèves</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">État de Paiement</label>
              <select value={filters.paymentState} onChange={e => setFilters({...filters, paymentState: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="ALL">Tout</option>
                <option value="PAID">Totalement Payé</option>
                <option value="PARTIAL">Partiel</option>
                <option value="UNPAID">Non Payé</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Du)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Au)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFilters({search:'', status:'ALL', customerId:'ALL', dateFrom:'', dateTo:'', paymentState:'ALL', deliveryState:'ALL'})} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">RÉINITIALISER</button>
            </div>
          </div>
        </div>
      )}

      <div id="sales-table-export" className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                <th className="px-3 md:px-8 py-3 md:py-5">Référence</th>
                <th className="px-3 md:px-8 py-3 md:py-5">Élève / Payeur</th>
                <th className="px-3 md:px-8 py-3 md:py-5 text-center">Taux Paiement</th>
                <th className="px-3 md:px-8 py-3 md:py-5 text-center">Taux Livraison</th>
                <th className="px-3 md:px-8 py-3 md:py-5 text-right">Montant TTC</th>
                <th className="px-3 md:px-8 py-3 md:py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={40} /></td></tr>
              ) : visibleSales.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center font-black text-slate-300 uppercase text-[10px]">Aucune vente trouvée</td></tr>
              ) : visibleSales.map((sale) => {
                const { payRate, delivRate, deliveredQty, totalQty } = getRates(sale);
                const isAnnule = sale.status === 'ANNULE';
                const isBrouillon = sale.status === 'BROUILLON';
                return (
                  <tr key={sale.id} className={`hover:bg-slate-50/50 transition-all group ${isAnnule ? 'bg-rose-50/20 opacity-60' : isBrouillon ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-3 md:px-8 py-3 md:py-5">
                      <p className={`font-mono text-xs font-black ${isAnnule ? 'text-rose-400 line-through' : isBrouillon ? 'text-amber-600' : 'text-indigo-600'}`}>#{sale.reference}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">{new Date(sale.createdAt).toLocaleDateString()}</p>
                      {isBrouillon && <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[7px] font-black rounded-full uppercase tracking-widest"><Clock size={8}/> Brouillon</span>}
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className={`font-black text-slate-800 text-sm uppercase truncate max-w-[150px] ${isAnnule ? 'text-slate-400' : ''}`}>
                            {sale.customer?.companyName || sale.walkin_name || sale.walkinName || 'PAIEMENT DIRECT'}
                          </p>
                          {!sale.customer && (sale.walkin_name || sale.walkinName) && (
                            <p className="text-[9px] text-sky-600 font-bold mt-0.5">
                              {sale.walkin_phone || sale.walkinPhone}
                            </p>
                          )}
                          {!sale.customer && !(sale.walkin_name || sale.walkinName) && (
                            <p className="text-[8px] text-slate-400 font-bold mt-0.5">Paiement non identifié</p>
                          )}
                        </div>
                        {isAnnule && <span className="bg-rose-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">ANNULÉ</span>}
                      </div>
                    </td>
                      <td className="px-3 md:px-8 py-3 md:py-5">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-16 md:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 ${isAnnule ? 'bg-slate-300' : payRate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${payRate}%` }}></div>
                          </div>
                          <span className={`text-[8px] font-black ${isAnnule ? 'text-slate-400' : payRate === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{payRate}% PAYÉ</span>
                          <span className="text-[9px] font-black text-slate-400 mt-1">{(parseFloat(sale.amountPaid || 0)).toLocaleString()} {currency} réglés</span>
                        </div>
                      </td>
                      <td className="px-3 md:px-8 py-3 md:py-5">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-16 md:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 ${isAnnule ? 'bg-slate-300' : delivRate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${delivRate}%` }}></div>
                          </div>
                          <span className={`text-[8px] font-black ${isAnnule ? 'text-slate-400' : delivRate === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{delivRate}% LIVRÉ</span>
                          <span className="text-[9px] font-black text-slate-400 mt-1">{deliveredQty}/{totalQty} articles livrés</span>
                        </div>
                      </td>
                    <td className={`px-3 md:px-8 py-3 md:py-5 text-right font-black ${isAnnule ? 'text-slate-400' : 'text-slate-900'}`}>
                      {parseFloat(sale.totalTtc).toLocaleString()} {currency}
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-right">
                       <button onClick={() => setSelectedSaleDetails(sale)} className={`p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm transition-all ${isAnnule ? 'text-rose-400 hover:text-rose-600' : 'text-slate-400 hover:text-indigo-600'}`}><Eye size={16}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CRÉATION / ÉDITION DE VENTE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl mx-2 md:mx-4 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row max-h-[90dvh] animate-in zoom-in-95 duration-500">
             <div className="w-full lg:w-2/3 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col bg-slate-50/50 min-h-0">
                <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                   <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 w-fit">
                      <button onClick={() => setCartTab('PRODUCT')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${cartTab === 'PRODUCT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><Package size={14} className="inline mr-2"/> Articles</button>
                      <button onClick={() => setCartTab('SERVICE')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${cartTab === 'SERVICE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><Sparkles size={14} className="inline mr-2"/> Offres Scolarité</button>
                   </div>
                   <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" placeholder="Rechercher..." className="w-full bg-white border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm" />
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">
                   {cartTab === 'PRODUCT' ? (
                     stocks.filter(item => item.status !== 'desactive' && item.status !== 'DESACTIVE').map(item => (
                       <button key={item.id} onClick={() => addToCart(item, 'PRODUCT')} disabled={item.currentLevel <= 0 || item.status === 'desactive' || item.status === 'DESACTIVE'} className={`p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-500 transition-all text-left flex flex-col justify-between group active:scale-95 ${(item.currentLevel <= 0 || item.status === 'desactive' || item.status === 'DESACTIVE') ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Package size={20}/></div>
                              <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full uppercase">Stock: {item.currentLevel}</span>
                            </div>
                            <h4 className="text-sm font-black text-slate-900 uppercase truncate flex items-center gap-2">{item.name} {(item.status === 'desactive' || item.status === 'DESACTIVE') && <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded uppercase ml-2">Désactivé</span>}</h4>
                          </div>
                          <p className="text-lg font-black text-indigo-600 mt-4">{Number(item.unitPrice).toLocaleString()} {currency}</p>
                       </button>
                     ))
                   ) : (
                     services.map(s => (
                       <button key={s.id} onClick={() => addToCart(s, 'SERVICE')} className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-500 transition-all text-left flex flex-col justify-between group active:scale-95">
                          <div>
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Sparkles size={20}/></div>
                            <h4 className="text-sm font-black text-slate-900 uppercase truncate">{s.name}</h4>
                          </div>
                          <p className="text-lg font-black text-amber-600 mt-4">{Number(s.price).toLocaleString()} {currency}</p>
                       </button>
                     ))
                   )}
                </div>
             </div>

             <div className="w-full lg:w-1/3 flex flex-col bg-white overflow-hidden relative shrink-0">
                <div className="p-4 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                   <h3 className="text-lg font-black uppercase tracking-tight">{editModeId ? 'Révision Facture' : 'Panier Actif'}</h3>
                   <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-all"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                   {saleForm.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50"><ShoppingCart size={48}/><p className="text-[10px] font-black uppercase tracking-widest">Le panier est vide</p></div>
                   ) : saleForm.items.map((item, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                         <div className="flex-1">
                            <p className="text-xs font-black text-slate-800 uppercase truncate pr-4">{item.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{Number(item.price).toLocaleString()} {currency} / u</p>
                         </div>
                         <div className="flex items-center gap-3">
                            <button onClick={() => updateCartQty(i, -1)} className="p-1 bg-white text-slate-400 hover:text-rose-500 rounded-lg shadow-sm"><MinusSmall size={14}/></button>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity} 
                              onChange={(e) => updateCartQtyDirect(i, parseInt(e.target.value))}
                              className="w-12 text-sm font-black text-center bg-white border border-slate-200 rounded-lg px-1 py-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button onClick={() => updateCartQty(i, 1)} className="p-1 bg-white text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm"><PlusSmall size={14}/></button>
                            <button onClick={() => removeFromCart(i)} className="p-1.5 ml-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                         </div>
                      </div>
                   ))}
                </div>

                <div className="shrink-0 bg-slate-900 text-white flex flex-col">
                   {/* Zone scrollable : client + paiement */}
                   <div className="overflow-y-auto max-h-[38vh] px-4 md:px-6 pt-4 pb-2 space-y-3 custom-scrollbar">
                      {/* Client */}
                      <select required value={saleForm.customerId} onChange={e => setSaleForm({...saleForm, customerId: e.target.value, walkinName: '', walkinPhone: ''})} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white">
                         <option value="" className="text-slate-900">PAIEMENT DIRECT (sans élève)</option>
                         {customers.map(c => <option key={c.id} value={c.id} className="text-slate-900">{c.companyName}</option>)}
                      </select>

                      {/* Champs obligatoires pour vente directe (client de passage) */}
                      {!saleForm.customerId && !editModeId && (
                        <div className="p-2.5 bg-sky-500/10 border border-sky-400/20 rounded-xl space-y-2">
                          <p className="text-[7px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1"><UserIcon size={9}/> Infos payeur <span className="text-rose-400">*</span></p>
                          <input
                            type="text"
                            placeholder="Nom du payeur *"
                            value={saleForm.walkinName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaleForm({...saleForm, walkinName: e.target.value})}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40"
                          />
                          <input
                            type="tel"
                            placeholder="Numéro de téléphone *"
                            value={saleForm.walkinPhone}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaleForm({...saleForm, walkinPhone: e.target.value})}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40"
                          />
                        </div>
                      )}

                      {!editModeId && (
                        <>
                          {/* Méthode + Montant */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[7px] font-black uppercase text-indigo-400 tracking-widest pl-1 mb-1">Méthode</p>
                              <select value={saleForm.paymentMethod} onChange={e => setSaleForm({...saleForm, paymentMethod: e.target.value, paymentReference: '', paymentProofImage: '', chequeNumber: '', bankName: '', chequeOrder: ''})} className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-black outline-none text-white appearance-none">
                                <option value="CASH" className="text-slate-900">ESPÈCES</option>
                                <option value="WAVE" className="text-slate-900">WAVE</option>
                                <option value="ORANGE_MONEY" className="text-slate-900">ORANGE MONEY</option>
                                <option value="MTN_MOMO" className="text-slate-900">MTN MOMO</option>
                                <option value="TRANSFER" className="text-slate-900">VIREMENT</option>
                                <option value="CHEQUE" className="text-slate-900">CHÈQUE</option>
                              </select>
                            </div>
                            <div>
                              <p className="text-[7px] font-black uppercase text-indigo-400 tracking-widest pl-1 mb-1">
                                {saleForm.paymentMethod === 'CHEQUE' ? 'Montant chèque' : saleForm.paymentMethod === 'TRANSFER' ? 'Montant virement' : 'Acompte'}
                              </p>
                              <input type="number" placeholder="0" value={saleForm.amountPaid} onChange={e => setSaleForm({...saleForm, amountPaid: parseFloat(e.target.value) || 0})} className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-black outline-none text-white" />
                            </div>
                          </div>

                          {/* Mobile Money */}
                          {['WAVE', 'ORANGE_MONEY', 'MTN_MOMO'].includes(saleForm.paymentMethod) && parseFloat(saleForm.amountPaid.toString()) > 0 && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-400/20 rounded-xl space-y-2">
                              <p className="text-[7px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={9}/> Réf. OU preuve obligatoire</p>
                              <input type="text" placeholder="Référence de transaction" value={saleForm.paymentReference} onChange={e => setSaleForm({...saleForm, paymentReference: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40"/>
                              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-[9px] font-black uppercase ${saleForm.paymentProofImage ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40 hover:border-amber-400/30'}`}>
                                <Upload size={10}/>{saleForm.paymentProofImage ? 'Preuve jointe ✓' : 'Joindre preuve'}
                                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setSaleForm({...saleForm, paymentProofImage: ev.target?.result as string}); r.readAsDataURL(f); }}/>
                              </label>
                            </div>
                          )}

                          {/* Virement bancaire — référence obligatoire */}
                          {saleForm.paymentMethod === 'TRANSFER' && parseFloat(saleForm.amountPaid.toString()) > 0 && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-400/20 rounded-xl space-y-2">
                              <p className="text-[7px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={9}/> Virement · encaissement à confirmer · vente en brouillon
                              </p>
                              <input type="text" placeholder="Référence virement *" value={saleForm.paymentReference} onChange={e => setSaleForm({...saleForm, paymentReference: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40"/>
                              <p className="text-[7px] text-amber-300/70 font-bold">Le montant sera crédité en trésorerie uniquement après confirmation de l'encaissement.</p>
                            </div>
                          )}

                          {/* Chèque — grille compacte 2×2 */}
                          {saleForm.paymentMethod === 'CHEQUE' && parseFloat(saleForm.amountPaid.toString()) > 0 && (
                            <div className="p-2.5 bg-indigo-500/10 border border-indigo-400/20 rounded-xl space-y-2">
                              <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                <CreditCard size={9}/> Détails chèque · comptabilisé à l'encaissement
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="N° chèque *" value={saleForm.chequeNumber} onChange={e => setSaleForm({...saleForm, chequeNumber: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40 w-full"/>
                                <input type="text" placeholder="Banque *" value={saleForm.bankName} onChange={e => setSaleForm({...saleForm, bankName: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40 w-full"/>
                                <input type="text" placeholder="Ordre / Bénéficiaire" value={saleForm.chequeOrder} onChange={e => setSaleForm({...saleForm, chequeOrder: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white placeholder-white/40 w-full"/>
                                <input type="date" value={saleForm.chequeDate} onChange={e => setSaleForm({...saleForm, chequeDate: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-white w-full"/>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                   </div>

                   {/* Barre total + bouton — toujours visible */}
                   <div className="px-4 md:px-6 py-4 border-t border-white/10 flex justify-between items-center">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total TTC</p>
                        <p className="text-2xl font-black text-white leading-tight">{cartTotal.toLocaleString()} <span className="text-[10px]">{currency}</span></p>
                      </div>
                      <button onClick={handleSubmitSale} disabled={actionLoading || saleForm.items.length === 0} className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-indigo-900/50 flex items-center gap-2">
                         {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <>{editModeId ? 'METTRE À JOUR' : 'VALIDER'} <ArrowRight size={16}/></>}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS DE VENTE */}
      {selectedSaleDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-5xl mx-2 md:mx-4 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-500">
              <div className="px-4 md:px-10 py-6 md:py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3 md:gap-6">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl ${selectedSaleDetails.status === 'ANNULE' ? 'bg-rose-600' : 'bg-indigo-600'}`}><FileText size={32}/></div>
                    <div>
                      <h3 className="text-base md:text-2xl font-black uppercase tracking-tighter leading-none">Facture #{selectedSaleDetails.reference}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{new Date(selectedSaleDetails.createdAt).toLocaleString('fr-FR')}</p>
                        {selectedSaleDetails.status === 'ANNULE' && <span className="px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded uppercase">ANNULÉE</span>}
                        {selectedSaleDetails.status === 'BROUILLON' && <span className="px-2 py-0.5 bg-amber-400 text-white text-[8px] font-black rounded uppercase flex items-center gap-1"><Clock size={9}/> Brouillon · En attente d'encaissement</span>}
                      </div>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-2 md:gap-3">
                    <button onClick={() => setShowDocGenerator({ sale: selectedSaleDetails, mode: 'FACTURE' })} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all" title="Facture"><Printer size={24}/></button>
                    <button onClick={() => setShowDocGenerator({ sale: selectedSaleDetails, mode: 'BON_SORTIE' })} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-amber-400" title="Bon de Livraison"><ClipboardList size={24}/></button>
                    <button onClick={() => setSelectedSaleDetails(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-slate-50/30 custom-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
                 <div className="lg:col-span-8 space-y-8">
                    <div className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-4">Articles & Offres de Scolarité</h4>
                       <div className="divide-y divide-slate-50">
                          {selectedSaleDetails.items.map((item: any, i: number) => (
                             <div key={i} className="py-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.service_id ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                      {item.service_id ? <Sparkles size={18}/> : <Package size={18}/>}
                                   </div>
                                   <div>
                                      <p className={`text-xs font-black uppercase ${selectedSaleDetails.status === 'ANNULE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.stock_item?.name || item.service?.name}</p>
                                      <p className="text-[9px] text-slate-400 font-bold">Qté: {item.quantity} × {parseFloat(item.unitPrice).toLocaleString()} {currency}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className={`text-sm font-black ${selectedSaleDetails.status === 'ANNULE' ? 'text-slate-400' : 'text-slate-900'}`}>{parseFloat(item.totalTtc).toLocaleString()} {currency}</p>
                                   {!item.service_id && (
                                     <div className="flex items-center gap-2 justify-end mt-1">
                                       <Truck size={10} className={item.quantityDelivered === item.quantity ? 'text-emerald-500' : 'text-amber-500'} />
                                       <p className={`text-[8px] font-black uppercase ${item.quantityDelivered === item.quantity ? 'text-emerald-500' : 'text-amber-500'}`}>Livré: {item.quantityDelivered || 0}/{item.quantity}</p>
                                     </div>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-4 space-y-8">
                    {/* Bloc client (enregistré ou de passage) */}
                    {(selectedSaleDetails.customer || selectedSaleDetails.walkin_name || selectedSaleDetails.walkinName) && (
                      <div className="p-4 md:p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          {selectedSaleDetails.customer ? 'Élève / Famille' : 'Payeur'}
                        </p>
                        <p className="text-sm font-black text-slate-900 uppercase">
                          {selectedSaleDetails.customer?.companyName || selectedSaleDetails.walkin_name || selectedSaleDetails.walkinName}
                        </p>
                        {selectedSaleDetails.customer ? (
                          <>
                            {selectedSaleDetails.customer.phone && <p className="text-xs text-slate-500 font-medium">{selectedSaleDetails.customer.phone}</p>}
                            {selectedSaleDetails.customer.email && <p className="text-xs text-slate-500 font-medium">{selectedSaleDetails.customer.email}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-sky-600 font-bold">{selectedSaleDetails.walkin_phone || selectedSaleDetails.walkinPhone}</p>
                        )}
                      </div>
                    )}

                    <div className={`p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-white shadow-xl space-y-4 md:space-y-6 ${selectedSaleDetails.status === 'ANNULE' ? 'bg-rose-900' : 'bg-slate-900'}`}>
                       <div className="flex justify-between items-center"><span className="text-[10px] font-black text-indigo-400 uppercase">Statut Transaction</span><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${selectedSaleDetails.status === 'TERMINE' ? 'bg-emerald-500/20 text-emerald-400' : selectedSaleDetails.status === 'ANNULE' ? 'bg-white/10 text-white' : selectedSaleDetails.status === 'BROUILLON' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500/20 text-amber-400'}`}>{selectedSaleDetails.status === 'BROUILLON' ? '⏳ BROUILLON' : selectedSaleDetails.status}</span></div>
                       <div className="space-y-1"><p className={`text-3xl font-black ${selectedSaleDetails.status === 'ANNULE' ? 'line-through opacity-50' : ''}`}>{parseFloat(selectedSaleDetails.totalTtc).toLocaleString()} {currency}</p><p className="text-[10px] font-bold text-slate-500 uppercase">Total Net à Payer</p></div>
                       <div className="space-y-4 pt-6 border-t border-white/10">
                          <div className="flex justify-between text-xs font-bold uppercase"><span className="text-slate-400">Déjà réglé</span><span className="text-emerald-400">-{parseFloat(selectedSaleDetails.amountPaid).toLocaleString()}</span></div>
                          <div className="flex justify-between text-xl font-black uppercase"><span>RESTE</span><span className="text-rose-500">{Math.max(0, parseFloat(selectedSaleDetails.totalTtc) - parseFloat(selectedSaleDetails.amountPaid)).toLocaleString()}</span></div>
                       </div>
                    </div>

                    {/* Historique des paiements */}
                    {selectedSaleDetails.payments && selectedSaleDetails.payments.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Historique des règlements</p>
                        {selectedSaleDetails.payments.map((p: any) => {
                          const isCheque = p.method === 'CHEQUE';
                          const isTransferPay = p.method === 'TRANSFER';
                          const isPendingPay = isCheque || isTransferPay;
                          const statusColors: Record<string, string> = {
                            PENDING: 'bg-amber-100 text-amber-700',
                            REGISTERED: 'bg-blue-100 text-blue-700',
                            DEPOSITED: 'bg-indigo-100 text-indigo-700',
                            PROCESSING: 'bg-purple-100 text-purple-700',
                            PAID: 'bg-emerald-100 text-emerald-700',
                            REJECTED: 'bg-rose-100 text-rose-700',
                            FAILED: 'bg-rose-100 text-rose-700',
                          };
                          const statusLabels: Record<string, string> = {
                            PENDING: 'En attente',
                            REGISTERED: 'Enregistré',
                            DEPOSITED: 'Déposé',
                            PROCESSING: 'En traitement',
                            PAID: 'Encaissé ✓',
                            REJECTED: 'Rejeté',
                            FAILED: 'Impayé',
                          };
                          // Workflow chèque : suivi multi-étapes
                          const chequeNextStatuses: Record<string, {value: string, label: string}[]> = {
                            PENDING:    [{ value: 'REGISTERED', label: 'Enregistrer' }, { value: 'REJECTED', label: 'Rejeter' }],
                            REGISTERED: [{ value: 'DEPOSITED', label: 'Déposer en banque' }, { value: 'REJECTED', label: 'Rejeter' }],
                            DEPOSITED:  [{ value: 'PROCESSING', label: 'En traitement' }, { value: 'REJECTED', label: 'Rejeter' }],
                            PROCESSING: [{ value: 'PAID', label: '✓ Encaisser' }, { value: 'REJECTED', label: 'Rejeter' }],
                            PAID: [], REJECTED: [], FAILED: [],
                          };
                          // Workflow virement : simple PENDING → PAID ou FAILED
                          const transferNextStatuses: Record<string, {value: string, label: string}[]> = {
                            PENDING: [{ value: 'PAID', label: '✓ Confirmer encaissement' }, { value: 'FAILED', label: 'Virement impayé' }],
                            PAID: [], FAILED: [], REJECTED: [],
                          };
                          const nextActions = isCheque
                            ? (chequeNextStatuses[p.status] || [])
                            : isTransferPay
                              ? (transferNextStatuses[p.status] || [])
                              : [];
                          return (
                            <div key={p.id} className={`p-4 rounded-2xl border ${isCheque ? 'bg-indigo-50 border-indigo-100' : isTransferPay && p.status === 'PENDING' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-[10px] font-black text-slate-800 uppercase">{p.method.replace('_', ' ')} — {parseFloat(p.amount).toLocaleString()} {currency}</p>
                                  {p.reference && <p className="text-[9px] text-slate-400 font-bold mt-0.5">Réf: {p.reference}</p>}
                                  {isCheque && p.chequeNumber && <p className="text-[9px] text-slate-400 font-bold mt-0.5">Chèque N° {p.chequeNumber} — {p.bankName}</p>}
                                  <p className="text-[8px] text-slate-300 font-bold mt-0.5">{new Date(p.paymentDate || p.createdAt).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${statusColors[p.status] || 'bg-slate-100 text-slate-500'}`}>
                                  {statusLabels[p.status] || p.status}
                                </span>
                              </div>
                              {p.proofImage && (
                                <img src={p.proofImage} alt="preuve" className="mt-2 w-full h-20 object-cover rounded-xl border border-slate-200"/>
                              )}
                              {/* Actions de suivi chèque ou virement */}
                              {isPendingPay && nextActions.length > 0 && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                  {nextActions.map(action => (
                                    <button
                                      key={action.value}
                                      onClick={() => handleUpdateChequeStatus(p.id, action.value)}
                                      disabled={updatingPaymentId === p.id}
                                      className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wide transition-all ${
                                        action.value === 'REJECTED' || action.value === 'FAILED'
                                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white'
                                          : action.value === 'PAID'
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                                      }`}
                                    >
                                      {updatingPaymentId === p.id ? <Loader2 size={10} className="animate-spin"/> : action.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-3">
                       {selectedSaleDetails.status !== 'ANNULE' && parseFloat(selectedSaleDetails.amountPaid) === 0 && !selectedSaleDetails.items.some((i:any) => (i.quantityDelivered || 0) > 0) && (
                          <button onClick={() => handleEditSaleRequest(selectedSaleDetails)} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 hover:bg-amber-600 transition-all"><Edit3 size={16}/> MODIFIER LES ARTICLES</button>
                       )}
                       
                       {selectedSaleDetails.status !== 'ANNULE' && parseFloat(selectedSaleDetails.amountPaid) < parseFloat(selectedSaleDetails.totalTtc) && selectedSaleDetails.paymentMethod !== 'TRANSFER' && selectedSaleDetails.paymentMethod !== 'CHEQUE' && (
                          <button onClick={() => { setPaymentForm({ amount: Math.max(0, parseFloat(selectedSaleDetails.totalTtc) - parseFloat(selectedSaleDetails.amountPaid)), method: 'CASH', reference: '', proofImage: '', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], chequeOrder: '' }); setShowPaymentModal(selectedSaleDetails); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-3"><Wallet size={16}/> ENREGISTRER RÈGLEMENT</button>
                       )}

                       {selectedSaleDetails.status !== 'ANNULE' && parseFloat(selectedSaleDetails.amountPaid) < parseFloat(selectedSaleDetails.totalTtc) && (selectedSaleDetails.paymentMethod === 'TRANSFER' || selectedSaleDetails.paymentMethod === 'CHEQUE') && (
                          <div className="w-full py-4 px-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                            <Clock size={14}/>
                            {selectedSaleDetails.paymentMethod === 'TRANSFER' ? 'Virement en attente · confirmez l\'encaissement ci-dessus' : 'Chèque en attente · suivez le statut ci-dessus'}
                          </div>
                       )}
                       
                       {selectedSaleDetails.status !== 'ANNULE' && selectedSaleDetails.items.some((i:any) => !i.service_id && ((i.quantityDelivered || 0) < i.quantity)) && (
                          <button onClick={() => {
                            const initialQty: Record<string, number> = {};
                            selectedSaleDetails.items.forEach((i:any) => { if(!i.service_id) initialQty[i.id] = i.quantity - (i.quantityDelivered || 0); });
                            setDeliveryQuantities(initialQty);
                            setShowDeliveryModal(selectedSaleDetails);
                          }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-3"><Truck size={16}/> SORTIR DU STOCK (LIVRER)</button>
                       )}
                       
                       {selectedSaleDetails.status !== 'ANNULE' && (
                          <button onClick={() => { setCancelForm({ reason: '', returnToStock: {} }); setShowCancelModal(selectedSaleDetails); }} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-rose-600 hover:text-white transition-all"><Ban size={16}/> ANNULER LA FACTURE</button>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL PAIEMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md mx-4 md:mx-auto rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="px-6 md:px-10 py-6 md:py-8 bg-emerald-600 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tight">Règlement Facture</h3>
                 <button onClick={() => setShowPaymentModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
              </div>
              <div className="p-5 md:p-10 space-y-6">
                 {(() => {
                   const remainingAmount = parseFloat(showPaymentModal.totalTtc) - parseFloat(showPaymentModal.amountPaid);
                   const isAmountExceeded = paymentForm.amount > remainingAmount;
                   const isMobileMoneyMethod = ['WAVE', 'ORANGE_MONEY', 'MTN_MOMO'].includes(paymentForm.method);
                   const mobileMoneyValid = !isMobileMoneyMethod || !!(paymentForm.reference || paymentForm.proofImage);
                   const chequeValid = paymentForm.method !== 'CHEQUE' || !!(paymentForm.chequeNumber && paymentForm.bankName);
                   const transferValid = paymentForm.method !== 'TRANSFER' || !!paymentForm.reference;
                   const isAmountValid = paymentForm.amount > 0 && !isAmountExceeded && mobileMoneyValid && chequeValid && transferValid;
                   
                   return (
                     <>
                       <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-[10px] font-bold uppercase">Solde restant : {remainingAmount.toLocaleString()} {currency}</div>
                       {isAmountExceeded && (
                         <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-[10px] font-bold uppercase flex items-center gap-2">
                           <AlertTriangle size={14} />
                           Le montant dépasse le solde restant de {(paymentForm.amount - remainingAmount).toLocaleString()} {currency}
                         </div>
                       )}
                       <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Montant versé</label>
                            <input 
                              type="number" 
                              value={paymentForm.amount} 
                              max={remainingAmount}
                              onChange={e => {
                                const value = parseFloat(e.target.value) || 0;
                                setPaymentForm({...paymentForm, amount: value});
                              }} 
                              className={`w-full border rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${
                                isAmountExceeded 
                                  ? 'bg-rose-50 border-rose-200 text-rose-600 focus:ring-rose-500/20' 
                                  : 'bg-slate-50 border-slate-100 focus:ring-indigo-500/20'
                              }`} 
                            />
                            {isAmountExceeded && (
                              <p className="text-rose-500 text-[9px] font-bold mt-2 px-2">Montant maximum : {remainingAmount.toLocaleString()} {currency}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Canal de paiement</label>
                            <select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none appearance-none">
                              <option value="CASH">ESPÈCES</option>
                              <option value="WAVE">WAVE</option>
                              <option value="ORANGE_MONEY">ORANGE MONEY</option>
                              <option value="MTN_MOMO">MTN MOMO</option>
                              <option value="TRANSFER">VIREMENT BANCAIRE</option>
                              <option value="CHEQUE">CHÈQUE</option>
                            </select>
                          </div>

                          {/* Mobile Money : référence + preuve image (l'un ou l'autre obligatoire) */}
                          {['WAVE', 'ORANGE_MONEY', 'MTN_MOMO'].includes(paymentForm.method) && (
                            <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                              <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={11}/> Référence OU preuve image obligatoire</p>
                              <input
                                type="text"
                                placeholder="Référence de transaction *"
                                value={paymentForm.reference}
                                onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                                className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"
                              />
                              <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Preuve (capture d'écran, reçu)</label>
                                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${paymentForm.proofImage ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'}`}>
                                  <Upload size={14}/>
                                  <span className="text-[10px] font-black uppercase truncate">{paymentForm.proofImage ? 'Image jointe ✓' : 'Joindre une image'}</span>
                                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = ev => setPaymentForm({...paymentForm, proofImage: ev.target?.result as string});
                                    reader.readAsDataURL(file);
                                  }}/>
                                </label>
                                {paymentForm.proofImage && (
                                  <div className="mt-2 relative">
                                    <img src={paymentForm.proofImage} alt="preuve" className="w-full h-28 object-cover rounded-xl border border-emerald-200"/>
                                    <button onClick={() => setPaymentForm({...paymentForm, proofImage: ''})} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5"><X size={12}/></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* CASH : référence optionnelle */}
                          {paymentForm.method === 'CASH' && (
                            <input type="text" placeholder="Référence (optionnel)" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none"/>
                          )}

                          {/* VIREMENT : référence obligatoire + avertissement brouillon */}
                          {paymentForm.method === 'TRANSFER' && (
                            <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                              <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2"><Clock size={11}/> Virement · en attente d'encaissement</p>
                              <input
                                type="text"
                                placeholder="Référence du virement *"
                                value={paymentForm.reference}
                                onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                                className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"
                              />
                              <p className="text-[8px] text-amber-600 font-bold">Le montant sera crédité en trésorerie uniquement après confirmation de l'encaissement.</p>
                            </div>
                          )}

                          {/* CHÈQUE : formulaire complet */}
                          {paymentForm.method === 'CHEQUE' && (
                            <div className="space-y-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
                              <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Détails du chèque</p>
                              <p className="text-[8px] text-indigo-500 font-bold">Le montant sera comptabilisé uniquement après encaissement.</p>
                              <input type="text" placeholder="N° de chèque *" value={paymentForm.chequeNumber} onChange={e => setPaymentForm({...paymentForm, chequeNumber: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"/>
                              <input type="text" placeholder="Banque émettrice *" value={paymentForm.bankName} onChange={e => setPaymentForm({...paymentForm, bankName: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"/>
                              <input type="text" placeholder="Ordre (nom bénéficiaire)" value={paymentForm.chequeOrder} onChange={e => setPaymentForm({...paymentForm, chequeOrder: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"/>
                              <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Date du chèque</label>
                                <input type="date" value={paymentForm.chequeDate} onChange={e => setPaymentForm({...paymentForm, chequeDate: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"/>
                              </div>
                            </div>
                          )}
                       </div>
                       <button 
                         onClick={handleAddPayment} 
                         disabled={actionLoading || !isAmountValid} 
                         className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${
                           !isAmountValid 
                             ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                             : 'bg-slate-900 text-white hover:bg-emerald-600'
                         }`}
                       >
                          {actionLoading ? <Loader2 className="animate-spin" /> : paymentForm.method === 'CHEQUE' ? <><CheckCircle size={18}/> ENREGISTRER LE CHÈQUE</> : paymentForm.method === 'TRANSFER' ? <><Clock size={18}/> ENREGISTRER LE VIREMENT</> : <><CheckCircle size={18}/> VALIDER L'ENCAISSEMENT</>}
                       </button>
                     </>
                   );
                 })()}
              </div>
           </div>
        </div>
      )}

      {/* MODAL LIVRAISON */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col">
              <div className="px-6 md:px-10 py-6 md:py-8 bg-indigo-600 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tight">Sortie Logistique</h3>
                 <button onClick={() => setShowDeliveryModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
              </div>
              <div className="p-5 md:p-10 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">Validation du retrait physique</p>
                 {showDeliveryModal.items.filter((i:any) => !i.service_id && ((i.quantityDelivered || 0) < i.quantity)).map((item: any) => (
                    <div key={item.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                       <div className="flex-1">
                          <p className="text-xs font-black text-slate-800 uppercase">{item.stock_item?.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Reste à livrer: {item.quantity - (item.quantityDelivered || 0)}</p>
                       </div>
                       <input 
                         type="number" 
                         max={item.quantity - (item.quantityDelivered || 0)}
                         min={0}
                         value={deliveryQuantities[item.id] || 0}
                         onChange={e => setDeliveryQuantities({...deliveryQuantities, [item.id]: parseInt(e.target.value) || 0})}
                         className="w-24 bg-white border border-slate-200 rounded-xl px-4 py-3 text-center text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" 
                       />
                    </div>
                 ))}
                 {showDeliveryModal.items.filter((i:any) => !i.service_id && ((i.quantityDelivered || 0) < i.quantity)).length === 0 && (
                   <div className="p-10 text-center text-[10px] font-black uppercase text-slate-400">Tous les produits ont été livrés.</div>
                 )}
              </div>
              <div className="p-5 md:p-10 border-t border-slate-100">
                 <button onClick={handleDelivery} disabled={actionLoading} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                    {actionLoading ? <Loader2 className="animate-spin" /> : <><Truck size={18}/> SCELLER LA SORTIE DE STOCK</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ANNULATION */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="px-6 md:px-10 py-6 md:py-8 bg-rose-600 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tight">Annulation Transaction</h3>
                 <button onClick={() => setShowCancelModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
              </div>
              <div className="p-5 md:p-10 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Motif de l'annulation <span className="text-rose-600">*</span></label>
                    <textarea 
                      required 
                      placeholder="Indiquez la raison (ex: Erreur saisie, désistement client...)"
                      value={cancelForm.reason}
                      onChange={e => setCancelForm({...cancelForm, reason: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 min-h-[100px]"
                    />
                 </div>

                 {showCancelModal.items.some((i:any) => (i.quantityDelivered || 0) > 0) && (
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Réintégration en Stock (Articles livrés)</label>
                      <div className="space-y-3">
                         {showCancelModal.items.filter((i:any) => (i.quantityDelivered || 0) > 0).map((item: any) => (
                           <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <p className="text-xs font-black text-slate-700 uppercase">{item.stock_item?.name || 'Article'}</p>
                              <div className="flex items-center gap-3">
                                 <span className="text-[9px] font-bold text-slate-400">Rendre :</span>
                                 <input 
                                   type="number" 
                                   max={item.quantityDelivered || 0}
                                   min={0}
                                   value={cancelForm.returnToStock[item.id] || 0}
                                   onChange={e => setCancelForm({...cancelForm, returnToStock: {...cancelForm.returnToStock, [item.id]: parseInt(e.target.value) || 0 }})}
                                   className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-black text-xs" 
                                 />
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}

                 <button onClick={handleCancelSale} disabled={actionLoading || !cancelForm.reason} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95">
                    {actionLoading ? <Loader2 className="animate-spin" /> : <><Ban size={18}/> CONFIRMER L'ANNULATION</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW WRAPPER */}
      {showDocGenerator && (
        <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="w-full max-w-5xl mx-2 md:mx-4 max-h-[90dvh] bg-white rounded-[2rem] md:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-500">
              <div className="px-4 md:px-10 py-4 md:py-6 bg-slate-900 text-white flex justify-between items-center shrink-0 print:hidden">
                 <h3 className="text-lg font-black uppercase tracking-tight">Générateur Documentaire</h3>
                 <div className="flex gap-4">
                    <div className="flex items-center justify-end gap-3 mb-2">
                      <button onClick={async () => {
                        try {
                          // Ensure html2canvas is available (load from CDN if necessary)
                          if (!(window as any).html2canvas) {
                            await new Promise<void>((resolve, reject) => {
                              const s = document.createElement('script');
                              s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                              s.async = true;
                              s.onload = () => resolve();
                              s.onerror = () => reject(new Error('Chargement html2canvas échoué'));
                              document.head.appendChild(s);
                            });
                          }

                          const html2canvas = (window as any).html2canvas;
                          if (!html2canvas) throw new Error('html2canvas non disponible');

                          const node = document.getElementById('document-render');
                          if (!node) throw new Error('Aperçu introuvable');

                          // Render at higher scale for better quality
                          const canvas = await html2canvas(node as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                          // Prefer PNG
                          const mime = 'image/png';
                          canvas.toBlob((blob: Blob | null) => {
                            if (!blob) {
                              showToast('Impossible de générer l\'image', 'error');
                              return;
                            }
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const filename = `${(showDocGenerator?.sale?.reference || showDocGenerator?.sale?.id)}.png`;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          }, mime, 0.95);
                        } catch (err: any) {
                          console.error('Capture/download error', err);
                          showToast(err?.message || 'Erreur lors de la génération de l\'image', 'error');
                        }
                      }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"><Download size={14}/> Télécharger</button>
                    </div>
                    <button onClick={() => setShowDocGenerator(null)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 md:p-10 print:p-0 print:bg-white">
                 <div id="document-render">
                   <DocumentPreview 
                      type={showDocGenerator.mode} 
                      sale={showDocGenerator.sale} 
                      tenant={tenantSettings} 
                      currency={currency} 
                   />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Sales;