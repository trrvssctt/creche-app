import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, AlertTriangle, Trash2, Edit3, Plus, 
  Search, RefreshCw, Eye, Boxes, Lock, X, Save,
  ArrowRight, Loader2, AlertCircle, MapPin, Tag, Layers,
  TrendingUp, History, ArrowUpCircle, ArrowDownCircle, Info, ShieldAlert,
  ShieldCheck, CheckCircle2, Upload, ImageIcon, BarChart3, Ban
} from 'lucide-react';
import { StockItem, UserRole, User, StockMovement } from '../types';
import { apiClient } from '../services/api';
import { uploadFile } from '../services/uploadService';
import YearMonthPicker from './YearMonthPicker';
import { useToast } from './ToastProvider';
import { authBridge } from '../services/authBridge';
import { buildExportHandlers, ExportColumn } from '../services/exportUtils';
import { FileDown } from 'lucide-react';


const Inventory = ({ currency, refreshKey }: { currency: string, userRole?: UserRole; refreshKey?: number }) => {
    // State pour le modal de désactivation
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<StockItem | null>(null);

    // Handler de désactivation
    const handleConfirmDeactivate = async () => {
      if (!showDeactivateConfirm || !canModify || activeInventory) return;
      setActionLoading(true);
      setError(null);
      try {
        const updated = await apiClient.put(`/stock/${showDeactivateConfirm.id}`, { ...showDeactivateConfirm, status: 'desactive' });
        setStocks(stocks.map(s => s.id === updated.id ? updated : s));
        setShowDeactivateConfirm(null);
        setShowSuccessMessage(`Le produit "${updated.name}" a été désactivé avec succès.`);
        setTimeout(() => setShowSuccessMessage(null), 4000);
      } catch (err: any) {
        setError(err.message || "Erreur Kernel lors de la désactivation.");
        setShowDeactivateConfirm(null);
      } finally {
        setActionLoading(false);
      }
    };

    const handleConfirmReactivate = async (item: StockItem) => {
    if (!item || !canModify || activeInventory) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiClient.put(`/stock/${item.id}`, { ...item, status: 'actif' });
      setStocks(stocks.map(s => s.id === updated.id ? updated : s));
      setShowSuccessMessage(`Le produit "${updated.name}" a été réactivé avec succès.`);
      setTimeout(() => setShowSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Erreur Kernel lors de la réactivation.");
    } finally {
      setActionLoading(false);
    }
  };
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // View mode, pagination and filters
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [pageSize, setPageSize] = useState<number>(6);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', subcategoryId: '', status: 'ALL' });

  // Year/Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    stocks.forEach((s: any) => { if (s.createdAt) years.add(new Date(s.createdAt).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [stocks]);

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
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<StockItem | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInventory, setActiveInventory] = useState<any>(null);

  // Pour création multiple : tableau de 1 à 5 produits
  const [formDataList, setFormDataList] = useState([
    { name: '', purchasePrice: 0, unitPrice: 0, minThreshold: 5, quantity: 0, subcategoryId: '', location: '', imageUrl: '' }
  ]);
  
  const currentUser = authBridge.getSession()?.user;
  const canModify = currentUser ? authBridge.canPerform(currentUser, 'EDIT', 'inventory') : false;
  const isLimitReached = false; // Plus de limite sur l'inventaire
  const showToast = useToast();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const exportColumns: ExportColumn[] = [
    { key: 'name', label: 'Produit' },
    { key: 'sku', label: 'SKU' },
    { key: 'currentLevel', label: 'Stock Actuel', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'minThreshold', label: 'Seuil Min', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'purchasePrice', label: 'Prix Achat (PUMP)', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'unitPrice', label: 'Prix Vente', format: (v) => Number(v || 0).toLocaleString('fr-FR') },
    { key: 'subcategory', label: 'Sous-catégorie', format: (_v, row) => row.subcategory?.name || row.subcategoryId || '' },
    { key: 'location', label: 'Emplacement' },
    { key: 'status', label: 'Statut', format: (v) => v === 'actif' ? 'Actif' : 'Inactif' },
  ];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockData, subData, campaigns, salesData] = await Promise.all([
        apiClient.get('/stock'),
        apiClient.get('/subcategories'),
        apiClient.get('/stock/campaigns'),
        apiClient.get('/sales')
      ]);
      setStocks(stockData || []);
      setSubcategories(subData || []);
      setActiveInventory(campaigns.find((c: any) => c.status === 'DRAFT'));
      setSales(salesData || []);
    } catch (err: any) { 
      setError("Échec de synchronisation avec le Kernel.");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Upload pour un index donné (création multiple)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadFile(file, 'images');
      setFormDataList(prev => prev.map((f, i) => i === idx ? { ...f, imageUrl: result.url } : f));
    } catch (err) {
      console.error("Upload Error:", err);
      showToast("Échec de l'envoi de l'image.", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const isProductLinked = (productId: string) => {
    return sales.some(sale => 
      (sale.items || []).some((item: any) => (item.stock_item_id || item.stockItemId) === productId)
    );
  };

  const openCreate = () => {
    if (activeInventory) return;
    if (subcategories.length === 0) {
      showToast("Impossible de créer un produit : aucune sous-catégorie disponible. Veuillez d'abord créer des catégories.", 'error');
      return;
    }
    setFormDataList([
      { name: '', purchasePrice: 0, unitPrice: 0, minThreshold: 5, quantity: 0, subcategoryId: subcategories[0]?.id || '', location: '', imageUrl: '' }
    ]);
    setError(null);
    setModalMode('CREATE');
  };

  const openEdit = (item: StockItem) => {
    if (activeInventory) return;
    if (isProductLinked(item.id)) {
      showToast("Modification bloquée : Ce produit est déjà lié à des ventes.", 'error');
      return;
    }
    setSelectedItem(item);
    setFormDataList([
      {
        name: item.name,
        purchasePrice: Number((item as any).purchasePrice || 0),
        unitPrice: Number(item.unitPrice),
        minThreshold: item.minThreshold,
        quantity: item.currentLevel,
        subcategoryId: item.subcategoryId || '',
        location: item.location || '',
        imageUrl: item.imageUrl || ''
      }
    ]);
    setError(null);
    setModalMode('EDIT');
  };

  const openDetails = async (item: StockItem) => {
    setSelectedItem(item);
    setModalMode('VIEW');
    try {
      const allMovements = await apiClient.get('/stock/movements');
      const itemMovements = allMovements.filter((m: any) => 
        (m.stockItemId || m.stock_item_id || m.stockItem?.id) === item.id
      );
      setSelectedItem(prev => prev ? { ...prev, movements: itemMovements } : null);
    } catch (e) {
      console.error("Erreur flux");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify || activeInventory) return;
    setActionLoading(true);
    setError(null);
    try {
      if (modalMode === 'CREATE') {
        // Création multiple
        const validForms = formDataList.filter(f => f.name && f.unitPrice && f.subcategoryId);
        if (validForms.length === 0) {
          showToast("Veuillez remplir au moins un produit.", 'error');
          setActionLoading(false);
          return;
        }
        const created = await Promise.all(validForms.map(f => apiClient.post('/stock', f)));
        setStocks(prev => [...created, ...prev]);
      } else if (modalMode === 'EDIT' && selectedItem) {
        const updated = await apiClient.put(`/stock/${selectedItem.id}`, formDataList[0]);
        setStocks(stocks.map(s => s.id === updated.id ? updated : s));
      }
      setModalMode(null);
    } catch (err: any) {
      setError(err.message || "Erreur Kernel");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm || !canModify || activeInventory) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/stock/${showDeleteConfirm.id}`);
      setStocks(stocks.filter(s => s.id !== showDeleteConfirm.id));
      const deletedName = showDeleteConfirm.name;
      setShowDeleteConfirm(null);
      setShowSuccessMessage(`Le produit "${deletedName}" a été marqué comme supprimé avec succès.`);
      setTimeout(() => setShowSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Erreur Kernel lors de la suppression.");
      setShowDeleteConfirm(null);
    } finally {
      setActionLoading(false);
    }
  };

  const stockStats = useMemo(() => {
    const totalProducts = stocks.length;
    const outOfStock = stocks.filter(item => item.currentLevel <= item.minThreshold).length;
    const inStock = totalProducts - outOfStock;
    // Valorisation au coût d'achat (PUMP) — si indisponible, fallback sur prix vente
    const totalValue = stocks.reduce((sum, item) => sum + (item.currentLevel * Number((item as any).purchasePrice || item.unitPrice || 0)), 0);
    const totalQuantity = stocks.reduce((sum, item) => sum + item.currentLevel, 0);
    const averageValue = totalProducts > 0 ? totalValue / totalProducts : 0;
    
    return {
      totalProducts,
      outOfStock,
      inStock,
      totalValue,
      totalQuantity,
      averageValue,
      outOfStockPercentage: totalProducts > 0 ? Math.round((outOfStock / totalProducts) * 100) : 0
    };
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    const filtered = stocks.filter(item => {
      const q = filters.search || '';
      const matchesText = (item.name || '').toLowerCase().includes(q.toLowerCase()) || (item.sku || '').toLowerCase().includes(q.toLowerCase());

      const scMatch = !filters.subcategoryId || (item.subcategoryId || item.subcategory_id) === filters.subcategoryId;

      const created = (item as any).createdAt || (item as any).created_at || '';
      const createdDate = created ? new Date(created).toISOString().split('T')[0] : '';
      const matchesFrom = filters.dateFrom === '' || (createdDate && createdDate >= filters.dateFrom);
      const matchesTo = filters.dateTo === '' || (createdDate && createdDate <= filters.dateTo);

      const statusMatch = filters.status === 'ALL' || (filters.status === 'ALERT' && item.currentLevel <= item.minThreshold) || (filters.status === 'OK' && item.currentLevel > item.minThreshold);

      return matchesText && scMatch && matchesFrom && matchesTo && statusMatch;
    });

    // Trier pour que les produits en rupture de stock apparaissent en premier
    return filtered.sort((a, b) => {
      const aOutOfStock = a.currentLevel <= a.minThreshold;
      const bOutOfStock = b.currentLevel <= b.minThreshold;
      
      if (aOutOfStock && !bOutOfStock) return -1;
      if (!aOutOfStock && bOutOfStock) return 1;
      
      // Si même statut, trier par niveau de stock croissant pour les ruptures
      if (aOutOfStock && bOutOfStock) {
        return a.currentLevel - b.currentLevel;
      }
      
      // Pour les produits en stock, trier par nom
      return a.name.localeCompare(b.name);
    });
  }, [stocks, filters]);

  const visibleStocks = viewMode === 'CARD' ? filteredStocks.slice(0, pageSize) : filteredStocks;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      {activeInventory && (
        <div className="absolute inset-0 z-50 bg-slate-50/60 backdrop-blur-sm flex items-center justify-center p-6 rounded-[3rem]">
           <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-indigo-600 max-w-lg text-center space-y-8 animate-in zoom-in-95">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 uppercase">Instance Verrouillée</h3>
              <p className="text-sm text-slate-500 font-medium uppercase leading-relaxed">Opérations suspendues par l'inventaire : {activeInventory.name}</p>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-3">
                 <Lock size={16} className="text-slate-400" />
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mode Lecture Seule</span>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3 uppercase">
            <Boxes className="text-indigo-600" size={32} /> Centre Logistique
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Gestion Active du Stock</p>
        </div>
        {canModify && !isLimitReached && subcategories.length > 0 ? (
          <button onClick={openCreate} disabled={!!activeInventory} className="px-4 md:px-8 py-3 md:py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest">
            <Plus size={18} /> RÉFÉRENCER ARTICLE
          </button>
        ) : canModify && !isLimitReached && subcategories.length === 0 ? (
          <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
            <AlertCircle size={16} /> Créez d'abord des catégories pour référencer des articles
          </div>
        ) : null}
      </div>

      {showSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[10px] font-black uppercase flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
           <CheckCircle2 size={24} /> {showSuccessMessage}
        </div>
      )}

      {/* Bannière Statistiques du Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 print:hidden">
        <div className={`p-4 md:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group border transition-all ${stockStats.outOfStock > 0 ? 'bg-rose-900 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'}`}>
          <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            {stockStats.outOfStock > 0 ? <ShieldAlert size={80}/> : <Boxes size={80}/>}
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stockStats.outOfStock > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
            {stockStats.outOfStock > 0 ? 'ALERTE RUPTURES' : 'PRODUITS TOTAUX'}
          </p>
          <h3 className="text-4xl font-black">{stockStats.outOfStock > 0 ? stockStats.outOfStock : stockStats.totalProducts}</h3>
          <p className={`text-sm font-black opacity-80 ${stockStats.outOfStock > 0 ? 'animate-pulse' : ''}`}>
            {stockStats.outOfStock > 0 ? `${stockStats.outOfStockPercentage}% en rupture` : 'Articles référencés'}
          </p>
        </div>
        
        <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:rotate-12 transition-transform"><Package size={60}/></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Disponible</p>
          <h3 className="text-2xl font-black text-slate-900">{stockStats.inStock}</h3>
          <div className="w-full h-1.5 bg-slate-50 rounded-full mt-4 overflow-hidden shadow-inner">
            <div className="h-full bg-emerald-500" style={{ width: `${stockStats.totalProducts > 0 ? (stockStats.inStock / stockStats.totalProducts) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:-rotate-12 transition-transform"><TrendingUp size={60}/></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valorisation Stock (coût)</p>
          <h3 className="text-2xl font-black text-slate-900">{stockStats.totalValue.toLocaleString()} {currency}</h3>
          <div className="w-full h-1.5 bg-slate-50 rounded-full mt-4 overflow-hidden shadow-inner">
            <div className="h-full bg-indigo-500" style={{ width: '85%' }}></div>
          </div>
        </div>

        <div className="bg-emerald-50 p-4 md:p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute right-0 bottom-0 p-4 opacity-20"><BarChart3 size={80} className="text-emerald-700"/></div>
          <div className="flex items-center gap-3 text-emerald-600 mb-2 relative z-10">
            <TrendingUp size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Quantité Globale</span>
          </div>
          <p className="text-lg font-black text-emerald-800 leading-tight relative z-10">{stockStats.totalQuantity.toLocaleString()}</p>
          <p className="text-[8px] text-emerald-600 font-bold mt-1 relative z-10 uppercase">Unités en stock</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher par nom ou SKU..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => setViewMode('CARD')} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'CARD' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Carte</button>
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${viewMode === 'LIST' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Liste</button>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>FILTRES</button>
        </div>

        <button onClick={fetchData} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* EXPORT TOOLBAR */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
            title="Exporter"
          >
            <FileDown size={18} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 w-52 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {(() => {
                // Récupère les infos tenant depuis appSettings si disponible (fallback sur currentUser.tenant)
                const appSettings = (window as any).appSettings || {};
                const tenantSettings = {
                  ...((currentUser as any)?.tenant || {}),
                  ...appSettings,
                };
                const exportInfo = buildExportHandlers({
                  data: filteredStocks,
                  columns: exportColumns,
                  options: {
                    filename: `inventaire-${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'Inventaire',
                    title: 'Registre du Stock',
                    companyInfo: {
                      name: tenantSettings?.name,
                      address: tenantSettings?.address,
                      phone: tenantSettings?.phone,
                      email: tenantSettings?.email,
                      logoUrl: tenantSettings?.logoUrl || tenantSettings?.platformLogo || tenantSettings?.invoiceLogo || '',
                    }
                  },
                  tableElementId: 'inventory-table-export',
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
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3 animate-in shake">
          <AlertCircle size={16}/> {error}
        </div>
      )}

          {/* Filtres avancés */}
          {showFilters && (
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-4">
              <YearMonthPicker
                dataYears={availableYears}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Recherche</label>
                <input type="text" value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Nom, SKU..." />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Sous-catégorie</label>
                <select value={filters.subcategoryId} onChange={e => setFilters({...filters, subcategoryId: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
                  <option value="">Toutes</option>
                  {subcategories.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Statut Stock</label>
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
                  <option value="ALL">Tous les statuts</option>
                  <option value="ALERT">⚠️ En Rupture</option>
                  <option value="OK">✅ En Stock</option>
                  
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Du)</label>
                <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Période (Au)</label>
                <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>

              <div className="sm:col-span-2 md:col-span-4 flex gap-2 pt-2">
                <button onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', subcategoryId: '', status: 'ALL' })} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all w-full">RÉINITIALISER LES FILTRES</button>
              </div>
              </div>
            </div>
          )}

      {viewMode === 'CARD' ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {loading ? [...Array(6)].map((_, i) => <div key={i} className="h-64 bg-white rounded-[3rem] animate-pulse border border-slate-100"></div>) :
             filteredStocks.length === 0 ? (
               <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center col-span-1 md:col-span-2 xl:col-span-3">
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aucun produit trouvé</p>
               </div>
             ) : visibleStocks.map((item) => {
              const isLinked = isProductLinked(item.id);
              const isDisabled = item.status === 'desactive' || item.status === 'DESACTIVE';
              return (
                <div key={item.id} className={`bg-white rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all p-8 flex flex-col group border-b-4 border-transparent hover:border-indigo-500 ${isLinked ? 'grayscale-[0.3]' : ''} ${isDisabled ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                      ) : (
                        <Package size={28} />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 relative">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${item.currentLevel <= item.minThreshold ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {item.currentLevel <= item.minThreshold ? 'ALERTE STOCK' : 'EN STOCK'}
                      </span>
                      {isLinked && (
                        <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Ventes liées</span>
                      )}
                      {isDisabled && (
                        <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded uppercase">Désactivé</span>
                      )}
                      {/* Le bouton de désactivation est déplacé à côté des boutons modifier/supprimer */}
                    </div>
                        {/* MODAL CONFIRM DEACTIVATE */}
                        {showDeactivateConfirm && (
                          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                             <div className="bg-white w-full max-w-md mx-4 md:mx-auto rounded-[3rem] shadow-2xl overflow-hidden p-5 md:p-10 text-center animate-in zoom-in-95">
                                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                  <Ban size={40} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la désactivation ?</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
                                  Souhaitez-vous désactiver le produit <span className="text-rose-600 font-black">"{showDeactivateConfirm.name}"</span> ?<br/>
                                  Il ne sera plus disponible à la vente.
                                </p>
                                <div className="flex flex-col gap-3">
                                  <button
                                    onClick={handleConfirmDeactivate}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm"
                                  >
                                    Oui, désactiver
                                  </button>
                                  <button
                                    onClick={() => setShowDeactivateConfirm(null)}
                                    className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm"
                                  >
                                    Annuler
                                  </button>
                                </div>
                             </div>
                          </div>
                        )}
                  </div>
                  <h3 className="font-black text-slate-900 text-lg uppercase truncate leading-none">{item.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-3 truncate font-bold">SKU: {item.sku}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-6">
                     <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Disponible</p>
                       <p className="text-sm font-black text-slate-900">{item.currentLevel}</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Prix Vente</p>
                       <p className="text-sm font-black text-slate-900">{Number(item.unitPrice).toLocaleString()} {currency}</p>
                     </div>
                     <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                       <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Prix Achat (PUMP)</p>
                       <p className="text-sm font-black text-indigo-700">{Number((item as any).purchasePrice || 0).toLocaleString()} {currency}</p>
                     </div>
                     <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                       <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Marge</p>
                       <p className="text-sm font-black text-emerald-700">
                         {(item as any).purchasePrice && Number(item.unitPrice) > 0
                           ? `${Math.round(((Number(item.unitPrice) - Number((item as any).purchasePrice)) / Number(item.unitPrice)) * 100)}%`
                           : '—'}
                       </p>
                     </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                     <button onClick={() => openDetails(item)} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">DÉTAILS <Eye size={16}/></button>
                     {canModify && (
                       <div className="flex gap-1">
                          <button 
                            onClick={() => openEdit(item)} 
                            disabled={!!activeInventory} 
                            title={isLinked ? "Modification verrouillée" : "Modifier"}
                            className={`p-2.5 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                          >
                            <Edit3 size={18}/>
                          </button>
                          <button 
                            onClick={() => !isLinked && setShowDeleteConfirm(item)} 
                            disabled={!!activeInventory}
                            title={isLinked ? "Suppression verrouillée" : "Supprimer"}
                            className={`p-2.5 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                          >
                            <Trash2 size={18}/>
                          </button>
                          {item.status === 'desactive' || item.status === 'DESACTIVE' ? (
                            <button
                              onClick={() => handleConfirmReactivate(item)}
                              disabled={!!activeInventory}
                              title="Réactiver"
                              className="p-2.5 rounded-xl transition-all text-emerald-600 hover:text-white hover:bg-emerald-600 border border-emerald-100"
                            >
                              Réactiver
                            </button>
                          ) : (
                            <button
                              onClick={() => !isLinked && setShowDeactivateConfirm(item)}
                              disabled={!!activeInventory || isLinked}
                              title={isLinked ? "Désactivation verrouillée" : "Désactiver"}
                              className={`p-2.5 rounded-xl transition-all ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                            >
                              <Ban size={16}/>
                            </button>
                          )}
                       </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStocks.length > visibleStocks.length && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setPageSize(prev => prev + 6)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest">VOIR PLUS</button>
            </div>
          )}
        </div>
      ) : (
        <div id="inventory-table-export" className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                <th className="px-3 md:px-6 py-3 md:py-4">Produit</th>
                <th className="px-3 md:px-6 py-3 md:py-4">SKU</th>
                <th className="px-3 md:px-6 py-3 md:py-4">Sous-catégorie</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-center">Stock</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Prix Achat (PUMP)</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Prix Vente</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? [...Array(6)].map((_, i) => (
                <tr key={i} className="h-16 bg-slate-50 animate-pulse"><td colSpan={6}></td></tr>
              )) : filteredStocks.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun produit trouvé</td></tr>
              ) : filteredStocks.map(item => {
                const isLinked = isProductLinked(item.id);
                const scName = subcategories.find((s:any) => s.id === (item.subcategoryId || item.subcategory_id))?.name || '';
                return (
                  <tr key={item.id} className={`group hover:bg-slate-50/50 transition-all ${item.status === 'desactive' || item.status === 'DESACTIVE' ? 'opacity-50 grayscale' : ''}`}> 
                    <td className="px-3 md:px-6 py-3 md:py-4 font-black text-slate-900 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">{item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="" /> : <Package size={18} />}</div>
                      <div className="truncate flex items-center gap-2">{item.name} {item.status === 'desactive' || item.status === 'DESACTIVE' ? <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded uppercase ml-2">Désactivé</span> : null}</div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-slate-500 font-mono">{item.sku}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-slate-600">{scName}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center font-black">{item.currentLevel}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right font-black text-indigo-700">{Number((item as any).purchasePrice || 0).toLocaleString()} {currency}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right font-black">{Number(item.unitPrice).toLocaleString()} {currency}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right flex items-center justify-end gap-2">
                      <button onClick={() => openDetails(item)} className="px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-600">Voir</button>
                      {canModify && (
                        <>
                          <button onClick={() => openEdit(item)} disabled={!!activeInventory} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}><Edit3 size={16} /></button>
                          <button onClick={() => !isLinked && setShowDeleteConfirm(item)} disabled={!!activeInventory} className={`px-3 py-2 rounded-xl ${isLinked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CRÉATION / ÉDITION */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl mx-4 md:mx-auto rounded-[2rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 max-h-[90dvh] flex flex-col">
             <div className={`px-4 md:px-10 py-5 md:py-8 text-white flex justify-between items-center ${modalMode === 'CREATE' ? 'bg-slate-900' : 'bg-amber-500'}`}> 
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                   {modalMode === 'CREATE' ? <Plus size={24}/> : <Edit3 size={24}/>} 
                   {modalMode === 'CREATE' ? 'Nouveaux Articles' : 'Révision Article'}
                </h3>
                <button onClick={() => setModalMode(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
             </div>
             <form onSubmit={handleSubmit} className="p-4 md:p-10 space-y-6 md:space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                {modalMode === 'CREATE' ? (
                  <>
                    {formDataList.map((formData, idx) => (
                      <div key={idx} className="mb-8 border-b border-slate-100 pb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-indigo-600 text-xs uppercase">Produit {idx + 1}</span>
                          {formDataList.length > 1 && (
                            <button type="button" onClick={() => setFormDataList(list => list.filter((_, i) => i !== idx))} className="text-rose-500 text-xs font-black">Supprimer</button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Désignation Produit <span className="text-rose-500">*</span></label>
                            <input type="text" required placeholder="Désignation" value={formData.name} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Visual Produit</label>
                            <div className="relative group">
                              <input type="file" id={`product_img_up_${idx}`} hidden onChange={e => handleFileUpload(e, idx)} accept="image/*" />
                              <label htmlFor={`product_img_up_${idx}`} className={`block p-4 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${formData.imageUrl ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-indigo-600'}`}> 
                                {isUploading ? (
                                  <Loader2 className="animate-spin mx-auto text-indigo-600" />
                                ) : formData.imageUrl ? (
                                  <img src={formData.imageUrl} className="h-16 mx-auto rounded-lg object-contain" alt="Preview" />
                                ) : (
                                  <div className="py-2">
                                    <ImageIcon className="mx-auto text-slate-300" size={24} />
                                    <p className="text-[8px] font-black uppercase mt-1 text-slate-500">Ajouter Photo</p>
                                  </div>
                                )}
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tarification & Catégorie <span className="text-rose-600">*</span></label>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-indigo-400 uppercase px-2">Prix d'achat initial (PUMP)</label>
                              <input type="number" min="0" step="0.01" placeholder="Prix achat fournisseur" value={(formData as any).purchasePrice || 0} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, purchasePrice: Number(e.target.value) } : f))} className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-400 uppercase px-2">Prix de vente TTC <span className="text-rose-500">*</span></label>
                              <input type="number" required placeholder="Prix Unit. TTC" value={formData.unitPrice} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, unitPrice: Number(e.target.value) } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                            </div>
                            <select value={formData.subcategoryId} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, subcategoryId: e.target.value } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none appearance-none cursor-pointer shadow-inner">
                              <option value="">Sélectionner Sous-Catégorie</option>
                              {subcategories.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gestion Stock</label>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-400 uppercase px-2">Seuil d'alerte <span className="text-rose-600">*</span></label>
                              <input type="number" value={formData.minThreshold} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, minThreshold: Number(e.target.value) } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none shadow-inner" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-400 uppercase px-2">Emplacement</label>
                              <input type="text" placeholder="Ex: Zone A-04" value={formData.location} onChange={e => setFormDataList(list => list.map((f, i) => i === idx ? { ...f, location: e.target.value } : f))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none shadow-inner" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {formDataList.length < 5 && (
                      <button type="button" onClick={() => setFormDataList(list => [...list, { name: '', unitPrice: 0, minThreshold: 5, quantity: 0, subcategoryId: subcategories[0]?.id || '', location: '', imageUrl: '' }])} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all mb-4">+ Ajouter un produit</button>
                    )}
                  </>
                ) : (
                  // Mode édition (un seul produit)
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Désignation Produit <span className="text-rose-500">*</span></label>
                        <input type="text" required placeholder="Désignation" value={formDataList[0].name} onChange={e => setFormDataList(list => [{ ...list[0], name: e.target.value }])} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Visual Produit</label>
                        <div className="relative group">
                          <input type="file" id="product_img_up_edit" hidden onChange={e => handleFileUpload(e, 0)} accept="image/*" />
                          <label htmlFor="product_img_up_edit" className={`block p-4 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${formDataList[0].imageUrl ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-indigo-600'}`}> 
                            {isUploading ? (
                              <Loader2 className="animate-spin mx-auto text-indigo-600" />
                            ) : formDataList[0].imageUrl ? (
                              <img src={formDataList[0].imageUrl} className="h-16 mx-auto rounded-lg object-contain" alt="Preview" />
                            ) : (
                              <div className="py-2">
                                <ImageIcon className="mx-auto text-slate-300" size={24} />
                                <p className="text-[8px] font-black uppercase mt-1 text-slate-500">Ajouter Photo</p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tarification & Catégorie <span className="text-rose-600">*</span></label>
                        <input type="number" required placeholder="Prix Unit. TTC" value={formDataList[0].unitPrice} onChange={e => setFormDataList(list => [{ ...list[0], unitPrice: Number(e.target.value) }])} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-indigo-400 uppercase px-2">Prix d'achat (PUMP)</label>
                          <input type="number" min="0" step="0.01" placeholder="Prix achat fournisseur" value={(formDataList[0] as any).purchasePrice || 0} onChange={e => setFormDataList(list => [{ ...list[0], purchasePrice: Number(e.target.value) }])} className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10" />
                        </div>
                        <select value={formDataList[0].subcategoryId} onChange={e => setFormDataList(list => [{ ...list[0], subcategoryId: e.target.value }])} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none appearance-none cursor-pointer shadow-inner">
                          <option value="">Sélectionner Sous-Catégorie</option>
                          {subcategories.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gestion Stock</label>
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase px-2">Seuil d'alerte <span className="text-rose-600">*</span></label>
                          <input type="number" value={formDataList[0].minThreshold} onChange={e => setFormDataList(list => [{ ...list[0], minThreshold: Number(e.target.value) }])} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none shadow-inner" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase px-2">Emplacement</label>
                          <input type="text" placeholder="Ex: Zone A-04" value={formDataList[0].location} onChange={e => setFormDataList(list => [{ ...list[0], location: e.target.value }])} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none shadow-inner" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                    <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-rose-700 leading-relaxed">{error}</p>
                  </div>
                )}
                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => { setModalMode(null); setError(null); }} className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">ANNULER</button>
                  <button type="submit" disabled={actionLoading || isUploading} className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${modalMode === 'CREATE' ? 'bg-indigo-600' : 'bg-amber-600'}`}>
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <>{modalMode === 'CREATE' ? 'SCELLER LES PRODUITS' : 'ENREGISTRER'} <ArrowRight size={18}/></>}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md mx-4 md:mx-auto rounded-[3rem] shadow-2xl overflow-hidden p-5 md:p-10 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmer la suppression ?</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-relaxed mb-8">
                Souhaitez-vous marquer le produit <span className="text-rose-600 font-black">"{showDeleteConfirm.name}"</span> comme "supprimer" ?<br/>
                Il sera retiré du catalogue actif du Kernel AlwaysData.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmDelete} 
                  disabled={actionLoading}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-200"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  OUI, SUPPRIMER L'ARTICLE
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                >
                  Annuler l'action
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL VUE DÉTAILLÉE (VIEW) */}
      {modalMode === 'VIEW' && selectedItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">

            {/* ── Header ── */}
            <div className="px-6 md:px-10 py-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-500/30 border border-indigo-400/30 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                  {selectedItem.imageUrl
                    ? <img src={selectedItem.imageUrl} className="w-full h-full object-cover" alt={selectedItem.name} />
                    : <Package size={26} />}
                </div>
                <div>
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Détail Produit</p>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">{selectedItem.name}</h3>
                  <p className="text-[9px] text-indigo-300/70 font-mono mt-1 uppercase tracking-widest">
                    SKU: {selectedItem.sku || '—'} &nbsp;·&nbsp; REF: {String(selectedItem.id).slice(0, 8)}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="p-3 bg-white/5 hover:bg-white/15 rounded-2xl transition-all shrink-0"><X size={22} /></button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/60 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Colonne gauche */}
                <div className="lg:col-span-1 space-y-4">

                  {/* KPI stock */}
                  <div className={`p-6 rounded-2xl text-white shadow-lg relative overflow-hidden ${selectedItem.currentLevel > selectedItem.minThreshold ? 'bg-gradient-to-br from-indigo-600 to-indigo-700' : 'bg-gradient-to-br from-rose-600 to-rose-700'}`}>
                    <div className="absolute -right-4 -bottom-4 opacity-10"><Package size={80} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-70 mb-3">Niveau de stock</p>
                    <p className="text-4xl font-black">{selectedItem.currentLevel}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">
                      {selectedItem.currentLevel > selectedItem.minThreshold ? 'Niveaux opérationnels' : 'Seuil critique — réappro. requis'}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[9px] font-black bg-white/15 px-2 py-0.5 rounded-full uppercase">Seuil min : {selectedItem.minThreshold}</span>
                    </div>
                  </div>

                  {/* Valorisation */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Tag size={13} /> Valorisation PRMP</h4>
                    <p className="text-2xl font-black text-indigo-600">
                      {(selectedItem.currentLevel * Number(selectedItem.unitPrice)).toLocaleString()}
                      <span className="text-xs font-bold ml-1">{currency}</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                      Prix unitaire : {Number(selectedItem.unitPrice).toLocaleString()} {currency}
                    </p>
                  </div>

                  {/* Localisation */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><MapPin size={13} /> Localisation</h4>
                    <p className="text-sm font-black text-slate-800 uppercase leading-snug">{selectedItem.location || 'Zone de stockage indéfinie'}</p>
                  </div>

                  {/* Image si disponible */}
                  {selectedItem.imageUrl && (
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <img src={selectedItem.imageUrl} className="w-full rounded-xl object-cover aspect-square" alt={selectedItem.name} />
                    </div>
                  )}
                </div>

                {/* Colonne droite — flux logistiques */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between shrink-0">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <History size={14} className="text-indigo-400" /> Flux Logistiques
                    </h4>
                    <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">
                      {selectedItem.movements?.length ?? 0} mouvement{(selectedItem.movements?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[300px]">
                    {(!selectedItem.movements || selectedItem.movements.length === 0) ? (
                      <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
                        <Boxes size={36} />
                        <p className="text-[9px] font-black uppercase tracking-widest">Aucun flux tracé pour cet article</p>
                      </div>
                    ) : selectedItem.movements.map((m: any, idx: number) => (
                      <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.type === 'IN' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {m.type === 'IN'
                            ? <ArrowUpCircle size={18} className="text-emerald-500" />
                            : <ArrowDownCircle size={18} className="text-rose-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-800 text-sm truncate">{m.reason || 'Saisie Manuelle'}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">
                            {new Date(m.createdAt || m.movementDate).toLocaleDateString('fr-FR')} · {m.userRef || 'Kernel Node'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {m.type === 'IN' ? '+' : '-'}{m.qty}
                          </p>
                          <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">→ {m.newLevel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;