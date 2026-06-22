import React from 'react';
import { Bell, Pin, Info, AlertTriangle, Zap, Tag, GraduationCap } from 'lucide-react';

interface Annonce {
  id: string; title: string; body: string;
  type?: string; isPinned?: boolean; createdAt: string;
}

interface Props { annonces: Annonce[]; }

const TYPE_CFG: Record<string, { label: string; icon: React.FC<any>; cls: string; bg: string }> = {
  INFO:        { label: 'Info',       icon: Info,          cls: 'bg-blue-100 text-blue-700 border-blue-200',   bg: 'border-blue-100' },
  WARNING:     { label: 'Important',  icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 border-amber-200', bg: 'border-amber-100' },
  UPDATE:      { label: 'Mise à jour',icon: Zap,           cls: 'bg-purple-100 text-purple-700 border-purple-200', bg: 'border-purple-100' },
  PROMO:       { label: 'Promo',      icon: Tag,           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bg: 'border-emerald-100' },
  MAINTENANCE: { label: 'Infos école',icon: Bell,          cls: 'bg-gray-100 text-gray-700 border-gray-200',   bg: 'border-gray-100' },
  URGENT:      { label: 'Urgent',     icon: AlertTriangle, cls: 'bg-red-100 text-red-700 border-red-200',       bg: 'border-red-100' },
  EVENEMENT:   { label: 'Événement',  icon: Bell,          cls: 'bg-purple-100 text-purple-700 border-purple-200', bg: 'border-purple-100' },
  FERMETURE:   { label: 'Fermeture',  icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 border-amber-200',   bg: 'border-amber-100' },
  INSCRIPTION: { label: 'Inscription',icon: GraduationCap, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bg: 'border-emerald-200' },
};

const ParentActualites: React.FC<Props> = ({ annonces }) => {
  if (!annonces.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-purple-50 flex items-center justify-center mb-6">
        <Bell className="w-12 h-12 text-purple-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">Pas d'actualités</h3>
      <p className="text-gray-400">Les informations de l'école apparaîtront ici.</p>
    </div>
  );

  const pinned  = annonces.filter(a => a.isPinned);
  const regular = annonces.filter(a => !a.isPinned);

  const Card = (a: Annonce) => {
    const cfg = TYPE_CFG[a.type || ''] || TYPE_CFG.INFO;
    const Icon = cfg.icon;
    return (
      <div key={a.id} className={`bg-white rounded-3xl border ${a.isPinned ? 'border-amber-300 shadow-lg shadow-amber-50' : a.type === 'INSCRIPTION' ? 'border-emerald-300 shadow-sm shadow-emerald-50' : cfg.bg} overflow-hidden`}>
        {a.isPinned && <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />}
        {a.type === 'INSCRIPTION' && !a.isPinned && <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400" />}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {a.isPinned && (
                <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <Pin className="w-3 h-3" /> Épinglé
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                <Icon className="w-3 h-3" /> {cfg.label}
              </span>
            </div>
            <time className="text-sm text-gray-400 font-medium flex-shrink-0">
              {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-3">{a.title}</h3>
          <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{a.body}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="text-2xl font-black text-gray-800">Actualités de l'école</h2>
        <p className="text-gray-500 mt-1">{annonces.length} message{annonces.length > 1 ? 's' : ''}</p>
      </div>

      {pinned.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
            <Pin className="w-4 h-4" /> Épinglés
          </p>
          {pinned.map(a => <div key={a.id}>{Card(a)}</div>)}
        </div>
      )}
      {regular.length > 0 && (
        <div className="space-y-4">
          {pinned.length > 0 && <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Toutes les actualités</p>}
          {regular.map(a => <div key={a.id}>{Card(a)}</div>)}
        </div>
      )}
    </div>
  );
};

export default ParentActualites;
