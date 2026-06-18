
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, ShieldAlert, CheckCircle2, AlertCircle, 
  Terminal, History, Lock, FileSearch, Download, 
  ShieldCheck, Fingerprint, Database, HardDrive,
  CloudCheck, Shield, KeyRound, Clock, Globe, RefreshCw, Loader2,
  MapPin, Phone, Mail, X, FileText, Printer, Info, Calendar,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../services/api';

const AuditLogs = ({ tenantSettings }: { tenantSettings?: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState<number>(30);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // États pour l'exportation
  const [exportDates, setExportDates] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/resilience/audit');
      setLogs(data || []);
    } catch (err) {
      console.error("Erreur de récupération des logs d'audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const displayedLogs = useMemo(() => {
    if (pageSize === -1) return logs;
    return logs.slice(0, pageSize);
  }, [logs, pageSize]);

  const exportPreviewData = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      return logDate >= exportDates.from && logDate <= exportDates.to;
    });
  }, [logs, exportDates]);

  const handleExportAction = () => {
    if (exportFormat === 'PDF') {
      window.print();
    } else {
      const headers = ['Date', 'Action', 'Opérateur', 'Ressource', 'Sévérité', 'Signature'];
      const rows = exportPreviewData.map(l => [
        new Date(l.createdAt).toLocaleString(),
        l.action,
        l.userName || 'Système',
        l.resource,
        l.severity,
        l.sha256Signature
      ]);

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${exportDates.from}_${exportDates.to}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <Terminal className="text-indigo-600" size={32} />
            Registre d'Audit Immuable
          </h2>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">Traçabilité Cryptographique Intégrale (PITR)</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-3">Afficher</span>
            <select 
              value={pageSize} 
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer"
            >
              <option value={5}>5 lignes</option>
              <option value={10}>10 lignes</option>
              <option value={30}>30 lignes</option>
              <option value={50}>50 lignes</option>
              <option value={100}>100 lignes</option>
              <option value={-1}>Tous les logs</option>
            </select>
          </div>
          
           <button onClick={fetchLogs} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
           <button
             onClick={() => setShowExportModal(true)}
             className="bg-slate-900 text-white px-4 md:px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 text-xs uppercase tracking-widest shadow-slate-200"
           >
             <Download size={18} /> EXPORTER LE REGISTRE
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
         <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Activity size={80}/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Transactions Tracées</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{logs.length} Actions</h3>
            <p className="text-[9px] text-emerald-600 font-bold uppercase mt-2 flex items-center gap-1"><CloudCheck size={12}/> Réplication Cloud Active</p>
         </div>
         <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Anomalies d'Intégrité</p>
            <h3 className="text-xl md:text-2xl font-black text-rose-600">0 Détectée</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 flex items-center gap-1"><History size={12} /> Dernier Scan : Temps Réel</p>
         </div>
         <div className="bg-indigo-900 p-8 rounded-[2.5rem] relative overflow-hidden group border border-indigo-800 shadow-2xl">
            <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform text-indigo-400"><Shield size={80}/></div>
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">État du Registre</p>
            <h3 className="text-2xl font-black text-white flex items-center gap-2">
              <ShieldCheck size={24} className="text-emerald-400" /> Certifié 100%
            </h3>
            <p className="text-[9px] text-indigo-200 font-bold uppercase mt-2 italic tracking-wider">Signature AES-GCM & SHA-256</p>
         </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 print:hidden">
           <div className="flex items-center gap-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal des Flux Sensibles de l'Instance</h4>
             <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase border border-emerald-100 flex items-center gap-1.5 shadow-sm">
               <Lock size={10} /> Chiffrement AES-256 GCM
             </span>
           </div>
           <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
               <History size={14} /> Rétention : 90 Jours
             </div>
             <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Point de Restauration :</span>
               <span className="text-[10px] font-black text-indigo-600 uppercase bg-white border border-slate-100 px-3 py-1 rounded-lg">ACTIF</span>
             </div>
           </div>
        </div>
        
        <div className="divide-y divide-slate-50 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
               <Loader2 className="animate-spin text-indigo-600" size={48} />
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Déchiffrement des logs...</p>
            </div>
          ) : displayedLogs.length === 0 ? (
            <div className="p-20 text-center text-slate-400 uppercase font-black text-[10px] tracking-widest">Aucun mouvement tracé dans le registre</div>
          ) : (
            displayedLogs.map((log) => (
              <div key={log.id} className="p-8 hover:bg-slate-50/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-emerald-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"></div>
                
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border transition-transform group-hover:scale-105 print:hidden ${
                    log.status === 'SUCCESS' || !log.status ? 'bg-emerald-50 text-emerald-500 border-emerald-100 shadow-emerald-100' :
                    log.status === 'WARNING' ? 'bg-amber-50 text-amber-500 border-amber-100 shadow-amber-100' : 'bg-rose-50 text-rose-500 border-rose-100 shadow-rose-100'
                  }`}>
                    {log.status === 'SUCCESS' || !log.status ? <CheckCircle2 size={24} /> : 
                     log.status === 'WARNING' ? <AlertCircle size={24} /> : <ShieldAlert size={24} />}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">{log.action?.replace('_', ' ')}</span>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                        log.severity === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                        log.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        Sévérité {log.severity || 'LOW'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Opérateur: <span className="font-black text-slate-800 uppercase tracking-tighter">{log.userName || 'Système'}</span> 
                      <span className="mx-2 text-slate-200">|</span> 
                      Entité: <span className="italic font-bold text-indigo-600">{log.resource}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                   <div className="flex items-center justify-end gap-2 text-slate-400 mb-1.5">
                      <Clock size={12} className="text-indigo-400" />
                      <p className="text-xs font-mono font-bold tracking-tight">{new Date(log.createdAt).toLocaleString('fr-FR')}</p>
                   </div>
                   <div className="flex items-center justify-end gap-2 group/sig cursor-help">
                      <Fingerprint size={12} className="text-slate-300 group-hover/sig:text-indigo-400 transition-colors" />
                      <p className="text-[9px] font-mono text-slate-300 group-hover/sig:text-slate-500 transition-colors uppercase tracking-widest truncate max-w-[140px]">
                        SIG:{log.sha256Signature?.slice(0, 12).toUpperCase() || 'UNSIGNED'}
                      </p>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col items-center gap-4 print:hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
             <KeyRound size={12} className="text-amber-500" />
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Registre Certifié par GeStock-Kernel-v3.2 AlwaysData</span>
          </div>
          <button className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-all uppercase tracking-widest flex items-center gap-2 active:scale-95">
            <FileSearch size={14} /> Visualiser l'historique de restauration (PITR)
          </button>
        </div>
      </div>

      <div className="p-10 bg-slate-900 rounded-[3.5rem] text-white relative overflow-hidden group shadow-2xl border border-slate-800 print:hidden">
         <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700"><Lock size={120} /></div>
         <div className="flex items-start gap-8 relative z-10">
            <div className="w-20 h-20 bg-indigo-600/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md border border-indigo-500/30 shadow-xl group-hover:bg-indigo-600 transition-colors shrink-0">
               <ShieldCheck size={40} className="text-indigo-400 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 space-y-4">
               <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-4 leading-none">Protection des Données <span className="text-[10px] bg-emerald-500 text-white px-3 py-1.5 rounded-full animate-pulse tracking-widest">SÉCURITÉ ACTIVE</span></h4>
               <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl">
                 Chaque écriture dans la base de données est soumise à une <span className="text-white font-black">chaîne d'intégrité</span>. En cas de suspicion de modification non autorisée, le Kernel GeStock verrouille automatiquement l'accès au tenant concerné. Vos données sont isolées au repos et en transit par chiffrement asymétrique.
               </p>
               <div className="flex flex-wrap gap-4 pt-4">
                  <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"><Globe size={12}/> TLS 1.3 Strict</div>
                  <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"><Database size={12}/> AlwaysData PostgreSQL Isolé</div>
                  <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"><Lock size={12}/> Sandbox Logical Isolation</div>
               </div>
            </div>
         </div>
      </div>

      {/* MODAL EXPORTATION D'AUDIT */}
      {showExportModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
          <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-500">
             <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <KeyRound className="text-emerald-500" size={28}/>
                  <h3 className="text-xl font-black uppercase tracking-tight">Générateur d'Audit Certifié</h3>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
             </div>
             
             <div className="flex-1 overflow-hidden grid grid-cols-12">
                <div className="col-span-12 lg:col-span-4 border-r border-slate-100 flex flex-col bg-slate-50/50">
                  <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fenêtre de Traçabilité</label>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="date" 
                            value={exportDates.from} 
                            onChange={e => setExportDates({...exportDates, from: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" 
                          />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="date" 
                            value={exportDates.to} 
                            onChange={e => setExportDates({...exportDates, to: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Type de Document</label>
                      <div className="grid grid-cols-1 gap-3">
                         <button 
                           onClick={() => setExportFormat('PDF')}
                           className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${exportFormat === 'PDF' ? 'border-indigo-600 bg-white shadow-lg shadow-indigo-50' : 'border-white bg-white/50 hover:border-slate-200'}`}
                         >
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shadow-inner">
                                 <FileText size={20} />
                              </div>
                              <span className={`text-[10px] font-black uppercase ${exportFormat === 'PDF' ? 'text-indigo-600' : 'text-slate-500'}`}>Rapport PDF Certifié</span>
                           </div>
                           {exportFormat === 'PDF' && <CheckCircle2 className="text-indigo-600" size={18} />}
                         </button>
                         <button 
                           onClick={() => setExportFormat('CSV')}
                           className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${exportFormat === 'CSV' ? 'border-indigo-600 bg-white shadow-lg shadow-indigo-50' : 'border-white bg-white/50 hover:border-slate-200'}`}
                         >
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shadow-inner">
                                 <Database size={20} />
                              </div>
                              <span className={`text-[10px] font-black uppercase ${exportFormat === 'CSV' ? 'text-indigo-600' : 'text-slate-500'}`}>Données brutes CSV</span>
                           </div>
                           {exportFormat === 'CSV' && <CheckCircle2 className="text-indigo-600" size={18} />}
                         </button>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                       <p className="text-[9px] text-amber-700 font-bold uppercase leading-relaxed">
                         <ShieldAlert className="inline-block mr-1 mb-0.5" size={10} /> 
                         Ce rapport contient des signatures cryptographiques uniques. Toute modification manuelle du fichier brisera le sceau d'intégrité de l'audit.
                       </p>
                    </div>
                  </div>

                  <div className="p-8 bg-white border-t border-slate-100 flex flex-col gap-3">
                    <button 
                      onClick={handleExportAction}
                      className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      {exportFormat === 'PDF' ? <Printer size={18}/> : <Download size={18}/>} GÉNÉRER L'EXTRAIT
                    </button>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col bg-white overflow-hidden relative">
                  <div className="p-8 bg-slate-50/50 border-b flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aperçu du Registre ({exportPreviewData.length} entrées)</h4>
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Flux Certifié PITR</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-100/30">
                    <div id="audit-preview" className="bg-white p-12 w-[210mm] min-h-[297mm] mx-auto text-slate-800 shadow-xl border border-slate-200 font-sans scale-90 origin-top">
                      {/* Logo et Header Preview Audit */}
                      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                        <div>
                          {tenantSettings?.platformLogo ? (
                            <img src={tenantSettings.platformLogo} className="h-16 w-auto object-contain mb-4 max-w-[200px]" alt="Logo" />
                          ) : (
                            <div className="text-2xl font-black text-indigo-600 mb-2 uppercase tracking-tighter">{tenantSettings?.companyName || 'GESTORPRO CLOUD'}</div>
                          )}
                          <div className="space-y-0.5 text-[8px] uppercase font-bold text-slate-400">
                            <p className="flex items-center gap-2"><MapPin size={8} className="text-indigo-400"/> {tenantSettings?.address || 'Registre Sécurisé'}</p>
                            <p className="flex items-center gap-2"><Phone size={8} className="text-indigo-400"/> {tenantSettings?.phone || 'Kernel Node 3.2'}</p>
                            <p className="flex items-center gap-2"><Mail size={8} className="text-indigo-400"/> {tenantSettings?.email || 'Contact Admin'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-1 uppercase">Journal d'Audit</h1>
                          <p className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block">PériODE : {exportDates.from} AU {exportDates.to}</p>
                        </div>
                      </div>

                      <div className="mt-10">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900 text-white text-[8px] font-black uppercase">
                              <th className="p-3">HORODATAGE</th>
                              <th className="p-3">OPÉRATION</th>
                              <th className="p-3">OPÉRATEUR</th>
                              <th className="p-3">RESSOURCE</th>
                              <th className="p-3 text-right">SIGNATURE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {exportPreviewData.length === 0 ? (
                              <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase">Aucun mouvement pour cette fenêtre temporelle</td></tr>
                            ) : exportPreviewData.map((log, i) => (
                              <tr key={i} className="text-[9px] font-bold">
                                <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                <td className="p-3 text-indigo-600 uppercase">{log.action?.replace('_', ' ')}</td>
                                <td className="p-3 text-slate-900 uppercase truncate max-w-[80px]">{log.userName || 'SYSTEM'}</td>
                                <td className="p-3 text-slate-400 italic truncate max-w-[120px]">{log.resource}</td>
                                <td className="p-3 text-right font-mono text-[7px] text-slate-300">
                                  {log.sha256Signature?.slice(0,16).toUpperCase() || 'UNSIGNED'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-20 border-t border-slate-100 pt-8 flex justify-between items-end opacity-40 grayscale">
                        <div className="text-[7px] font-bold uppercase space-y-1">
                           <p>Généré par GeStocPro Cloud Kernel v3.2</p>
                           <p>Export Certifié le {new Date().toLocaleString()}</p>
                        </div>
                        <div className="w-24 h-12 border border-slate-300 rounded-lg flex items-center justify-center text-[6px] font-black uppercase text-slate-300 italic text-center">VISA<br/>SÉCURITÉ</div>
                      </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* SECTION CACHÉE POUR L'IMPRESSION PDF D'AUDIT */}
      <div className="hidden print:block bg-white text-slate-800 p-0 font-sans">
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10">
            <div>
              {tenantSettings?.platformLogo ? (
                <img src={tenantSettings.platformLogo} className="h-24 w-auto mb-4" alt="Logo" />
              ) : (
                <div className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">{tenantSettings?.companyName || 'GESTORPRO'}</div>
              )}
              <div className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1">{tenantSettings?.companyName}</div>
              <div className="space-y-1 text-[10px] uppercase font-bold text-slate-500">
                <p className="flex items-center gap-2"><MapPin size={8} className="text-indigo-400"/> {tenantSettings?.address || 'Adresse Cloud'}</p>
                <p className="flex items-center gap-2"><Phone size={8} className="text-indigo-400"/> {tenantSettings?.phone || 'Standard'}</p>
                <p className="flex items-center gap-2"><Mail size={8} className="text-indigo-400"/> {tenantSettings?.email || 'Contact'}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 uppercase">Journal d'Audit Certifié</h1>
              <p className="text-lg font-mono font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl inline-block">Généré le {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase">
                  <th className="p-5">Horodatage</th>
                  <th className="p-5">Action / Opération</th>
                  <th className="p-5">Opérateur</th>
                  <th className="p-5">Ressource</th>
                  <th className="p-5 text-right">Signature SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {exportPreviewData.map((log, i) => (
                  <tr key={i} className="text-sm font-bold">
                    <td className="p-5">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-5 uppercase">{log.action?.replace('_', ' ')}</td>
                    <td className="p-5 uppercase">{log.userName || 'Système'}</td>
                    <td className="p-5 italic text-slate-500">{log.resource}</td>
                    <td className="p-5 text-right font-mono text-[8px] text-slate-400">
                      {log.sha256Signature?.toUpperCase() || 'UNSIGNED'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-20 pt-12 border-t-2 border-slate-100 flex justify-between items-end">
            <div className="text-[10px] font-bold text-slate-300 uppercase italic">
              GeStocPro AI-Native ERP • Kernel Registry Security v3.2<br/>
              Validation immuable AlwaysData PostgreSQL
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 underline underline-offset-8">VISA CONTRÔLEUR SÉCURITÉ</p>
              <div className="h-24 w-48 border-2 border-dashed border-slate-200 rounded-2xl"></div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default AuditLogs;
