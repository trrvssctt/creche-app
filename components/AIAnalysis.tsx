
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, Send, Sparkles, Activity, 
  Table as TableIcon, History, RefreshCw, CheckCircle2,
  TrendingUp, Search, BookOpen, PlusCircle,
  ChevronRight, X, Lightbulb, Zap, Bot, FileDown, 
  BarChart3, DownloadCloud, ArrowUpRight, List as ListIcon,
  // Added ShieldCheck import
  ShieldCheck
} from 'lucide-react';
import { 
  getAIResponse, AIChatResponse, 
  fetchChatHistory, fetchPromptTemplates,
  cleanProfessionalText, extractDataFromText
} from '../services/geminiService';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

interface Message extends AIChatResponse {
  role: 'user' | 'ai';
  timestamp: Date;
}

const AIAnalysis = ({ user }: { user: any }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [hist, temps] = await Promise.all([
          fetchChatHistory(),
          fetchPromptTemplates()
        ]);
        
        const mappedHistory: Message[] = (hist || []).map(h => {
          const data = extractDataFromText(h.message);
          return {
            role: h.sender,
            formattedResponse: cleanProfessionalText(h.message),
            format: data.length > 0 ? 'chart' : 'general',
            rawResults: data,
            resultCount: data.length,
            status: 'SUCCESS',
            timestamp: new Date(h.created_at)
          };
        });
        
        setMessages(mappedHistory);
        setTemplates(temps || []);
      } catch (err) {
        console.error("Kernel Sync Error");
      } finally {
        setLoadingHistory(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async (customMsg?: string) => {
    const messageToSend = customMsg || input.trim();
    if (!messageToSend || isLoading) return;
    
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      formattedResponse: messageToSend,
      format: 'general',
      resultCount: 0,
      status: 'SUCCESS',
      timestamp: new Date() 
    }]);
    
    setIsLoading(true);
    const aiResponse = await getAIResponse(messageToSend, user.tenantId);
    setMessages(prev => [...prev, { ...aiResponse, role: 'ai', timestamp: new Date() }]);
    setIsLoading(false);
  };

  const renderVisuals = (msg: Message) => {
    const { format, rawResults, downloadUrl } = msg;

    // 1. Format TABLEAU (Haute Densité)
    if (format === 'table' && rawResults && rawResults.length > 0) {
      const cols = Object.keys(rawResults[0]).filter(c => !c.startsWith('_'));
      return (
        <div className="mt-6 border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm bg-white animate-in zoom-in-95">
          <div className="bg-slate-50 px-8 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
               <TableIcon size={14} className="text-indigo-600"/>
               <span className="text-[9px] font-black uppercase tracking-widest">Registre de Données</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{rawResults.length} entrées</span>
          </div>
          <div className="overflow-x-auto max-h-80 custom-scrollbar">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-white sticky top-0 border-b">
                <tr>{cols.map(c => <th key={c} className="px-6 py-4 font-black uppercase text-slate-400 tracking-tighter">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rawResults.map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                    {cols.map(c => <td key={c} className="px-6 py-4 font-bold text-slate-700 group-hover:text-indigo-900">{row[c]?.toString()}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // 2. Format GRAPHIQUE (Analytique)
    if (format === 'chart' && rawResults && rawResults.length > 0) {
      return (
        <div className="mt-6 p-8 bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-8">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <BarChart3 size={14} /> Projection des Flux
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rawResults}>
                <defs>
                  <linearGradient id="aiTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" hide />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', fontSize: '10px', color: '#fff' }} />
                <Area type="monotone" dataKey="Montant" stroke="#818cf8" fill="url(#aiTrend)" strokeWidth={4} animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 3. Format EXCEL / TÉLÉCHARGEMENT
    if (format === 'excel' || downloadUrl) {
      return (
        <div className="mt-6 p-8 bg-emerald-900 rounded-[3rem] border border-emerald-800 flex items-center justify-between animate-in zoom-in-95 group shadow-2xl">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                <FileDown size={32}/>
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-tight">Export de données prêt</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">SÉCURISÉ PAR KERNEL-V3.2</p>
              </div>
           </div>
           <a 
             href={downloadUrl} 
             target="_blank" 
             rel="noopener noreferrer"
             className="px-10 py-5 bg-white text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all flex items-center gap-3 shadow-xl"
           >
             TÉLÉCHARGER MAINTENANT <ArrowUpRight size={18}/>
           </a>
        </div>
      );
    }

    // 4. Format LISTE
    if (format === 'list' && rawResults && rawResults.length > 0) {
      return (
        <div className="mt-6 grid grid-cols-1 gap-3">
          {rawResults.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-500 hover:shadow-md transition-all group">
               <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-500 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">{i + 1}</div>
               <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">{typeof item === 'object' ? Object.values(item)[0]?.toString() : item.toString()}</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 animate-in fade-in duration-700">
      
      {/* BIBLIOTHÈQUE DE PROMPTS */}
      <aside className="w-80 flex flex-col bg-white rounded-[4rem] border border-slate-100 shadow-sm overflow-hidden shrink-0 hidden lg:flex">
        <div className="p-10 bg-slate-900 text-white">
           <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><BookOpen size={24}/></div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Templates</h3>
           </div>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" placeholder="Filtrer..." 
                className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-3 text-[10px] font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {templates.filter(t => t.title.toLowerCase().includes(templateSearch.toLowerCase())).map(t => (
             <button 
               key={t.id} onClick={() => setInput(t.prompt_text)}
               className="w-full p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 hover:bg-white text-left transition-all group shadow-sm active:scale-95"
             >
                <div className="flex justify-between items-start mb-3">
                   <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{t.category}</span>
                   <PlusCircle size={16} className="text-slate-300 group-hover:text-indigo-600" />
                </div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase leading-snug">{t.title}</h4>
             </button>
           ))}
        </div>
      </aside>

      {/* ZONE DE CHAT IA */}
      <div className="flex-1 flex flex-col bg-white rounded-[4.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="bg-slate-900 px-12 py-8 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center shadow-2xl relative group cursor-pointer active:scale-95 transition-transform">
              <Bot size={32} />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-slate-900 rounded-full animate-pulse"></span>
            </div>
            <div>
              <h2 className="font-black text-2xl uppercase tracking-tighter">Kernel AI Orchestrator</h2>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em] flex items-center gap-2 mt-1">
                <Activity size={12} className="animate-pulse" /> AlwaysData Sync Active
              </p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-12 space-y-12 bg-slate-50/20 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-1000">
               <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-500 shadow-inner">
                 <Sparkles size={48} className="animate-pulse" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Comment puis-je vous aider ?</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs">Analyse de stock, graphiques de vente, ou génération d'exports.</p>
               </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
              <div className={`max-w-[90%] p-10 rounded-[3rem] shadow-sm border ${
                m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none border-indigo-500 shadow-2xl' 
                  : 'bg-white text-slate-800 border-slate-100 rounded-bl-none'
              }`}>
                <div className="space-y-5">
                  {m.formattedResponse.split('\n').filter(l => l.trim()).map((line, idx) => (
                    <p key={idx} className={`text-base leading-relaxed ${m.role === 'user' ? 'font-black' : 'font-bold text-slate-700'}`}>{line}</p>
                  ))}
                </div>
                {renderVisuals(m)}
                <div className={`mt-6 pt-6 border-t ${m.role === 'user' ? 'border-white/10' : 'border-slate-50'} flex justify-between items-center opacity-40`}>
                   <span className="text-[9px] font-black uppercase tracking-widest">{m.role === 'ai' ? 'Bot Identity #GSP-4.0' : user.name}</span>
                   <span className="text-[9px] font-bold uppercase">{m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex gap-5 items-center animate-in zoom-in-95">
                  <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Interrogation du Registry AlwaysData...</span>
               </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-white border-t border-slate-50 shrink-0">
          <div className="max-w-5xl mx-auto relative group">
            <textarea 
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Demandez une analyse, un graphique ou un export Excel..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-10 py-8 text-lg font-black focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-600 outline-none pr-28 transition-all shadow-inner h-24 resize-none"
            />
            <button 
              onClick={() => handleSend()} disabled={isLoading || !input.trim()}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-5 bg-slate-900 text-white rounded-[1.8rem] hover:bg-indigo-600 transition-all disabled:opacity-20 shadow-2xl active:scale-90"
            >
              <Send size={24} />
            </button>
          </div>
          <div className="flex justify-center gap-6 mt-6">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] flex items-center gap-2"><Zap size={10}/> DeepSeek-R1 Architecture</p>
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] flex items-center gap-2"><ShieldCheck size={10}/> Encryption GSP-AES</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
