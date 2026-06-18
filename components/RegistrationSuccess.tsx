
import React from 'react';
import { CheckCircle, Zap, ArrowRight, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  mustPay: boolean;
  onContinue: () => void;
  planName: string;
}

const RegistrationSuccess: React.FC<Props> = ({ mustPay, onContinue, planName }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
      
      <div className="max-w-md w-full animate-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-[0_20px_50px_rgba(16,185,129,0.3)] animate-bounce">
          <CheckCircle size={48} />
        </div>

        <h1 className="text-4xl font-black text-white tracking-tighter mb-4">
          Instance Créée !
        </h1>
        <p className="text-slate-400 font-medium mb-10 leading-relaxed uppercase text-[10px] tracking-[0.3em]">
          Le Kernel GeStockPro est prêt pour <span className="text-emerald-400 font-black">{planName}</span>.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-10 backdrop-blur-xl text-left space-y-4">
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
               <Zap size={18} />
             </div>
             <div>
               <p className="text-xs font-black text-white uppercase tracking-widest">Base de données isolée</p>
               <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Chiffrement AES-256 Actif</p>
             </div>
          </div>
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
               <ShieldCheck size={18} />
             </div>
             <div>
               <p className="text-xs font-black text-white uppercase tracking-widest">Environnement Sécurisé</p>
               <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Conformité RGPD & ISO-27001</p>
             </div>
          </div>
        </div>

        <button 
          onClick={onContinue}
          className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 active:scale-95 group"
        >
          {mustPay ? "PROCÉDER AU PAIEMENT" : "ACCÉDER AU DASHBOARD"} 
          <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
        </button>
      </div>
    </div>
  );
};

export default RegistrationSuccess;
