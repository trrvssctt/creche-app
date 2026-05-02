import React from 'react';
import { ArrowLeft, Wrench, Clock, Sparkles } from 'lucide-react';

interface ModulePlaceholderProps {
  onNavigate: (tab: string, meta?: any) => void;
  moduleName: string;
  description: string;
  icon?: React.ReactNode;
}

const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({ 
  onNavigate, 
  moduleName, 
  description,
  icon = <Wrench size={48} />
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate('rh')}
          className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{moduleName}</h1>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Module en développement</p>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col items-center justify-center p-20 text-center">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-8 border border-indigo-100 shadow-inner">
            {icon}
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Module {moduleName}</h2>
          <p className="text-slate-500 font-medium text-sm max-w-md leading-relaxed mb-8">
            {description}
          </p>
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <Clock className="text-amber-500" size={20} />
            <span className="text-amber-600 font-black text-[10px] uppercase tracking-widest">
              En cours de développement
            </span>
          </div>
        </div>
      </div>

      {/* Coming Soon Features */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-[2.5rem] border border-indigo-100">
          <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Sparkles size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-2">Interface Intuitive</h3>
          <p className="text-xs text-slate-600 leading-relaxed">Interface moderne et ergonomique pour une gestion efficace.</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-[2.5rem] border border-emerald-100">
          <div className="w-12 h-12 bg-white text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Sparkles size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-2">Automatisation</h3>
          <p className="text-xs text-slate-600 leading-relaxed">Processus automatisés pour optimiser votre productivité.</p>
        </div>
        
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-8 rounded-[2.5rem] border border-rose-100">
          <div className="w-12 h-12 bg-white text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Sparkles size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-2">Rapports Avancés</h3>
          <p className="text-xs text-slate-600 leading-relaxed">Analytics et rapports détaillés pour un suivi optimal.</p>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-slate-900 text-white p-10 rounded-[3rem] text-center">
        <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Bientôt Disponible</h3>
        <p className="text-slate-400 font-medium text-sm mb-6 max-w-md mx-auto">
          Ce module sera disponible dans une prochaine mise à jour. Restez connecté pour découvrir toutes les fonctionnalités.
        </p>
        <button 
          onClick={() => onNavigate('rh')}
          className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl"
        >
          Retour au Tableau de Bord RH
        </button>
      </div>
    </div>
  );
};

export default ModulePlaceholder;