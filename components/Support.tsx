/**
 * Support.tsx
 * Page support côté client — soumission et suivi des tickets.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LifeBuoy, Send, ChevronRight, Clock, CheckCircle2,
  AlertCircle, MessageSquare, RefreshCw, Plus, X
} from 'lucide-react';
import { apiClient } from '../services/api';
import { User } from '../types';

const CATEGORIES = [
  { id: 'BILLING', label: 'Facturation / Abonnement' },
  { id: 'TECHNICAL', label: 'Problème technique' },
  { id: 'FEATURE_REQUEST', label: 'Demande de fonctionnalité' },
  { id: 'ACCOUNT', label: 'Compte / Accès' },
  { id: 'OTHER', label: 'Autre' },
];

const PRIORITIES = [
  { id: 'LOW', label: 'Faible', color: 'text-slate-500' },
  { id: 'NORMAL', label: 'Normal', color: 'text-sky-600' },
  { id: 'HIGH', label: 'Urgent', color: 'text-amber-600' },
  { id: 'URGENT', label: 'Critique', color: 'text-rose-600' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  OPEN: { label: 'Ouvert', color: 'bg-sky-100 text-sky-700', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  RESOLVED: { label: 'Résolu', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  CLOSED: { label: 'Fermé', color: 'bg-slate-100 text-slate-500', icon: X },
};

interface SupportProps {
  user: User;
}

const Support: React.FC<SupportProps> = ({ user }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({
    subject: '',
    message: '',
    category: 'TECHNICAL',
    priority: 'NORMAL',
  });

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/support');
      setTickets((res as any)?.tickets || res || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      showToast('Sujet et message obligatoires.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/support', form);
      showToast('Ticket soumis avec succès.', 'success');
      setForm({ subject: '', message: '', category: 'TECHNICAL', priority: 'NORMAL' });
      setShowForm(false);
      fetchTickets();
    } catch (e: any) {
      showToast(e?.message || 'Erreur lors de la soumission.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = useMemo(() => tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length, [tickets]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest text-white transition-all ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
            <LifeBuoy size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Support</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {openCount > 0 ? `${openCount} ticket(s) en cours` : 'Aucun ticket en cours'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchTickets} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setShowForm(true); setSelectedTicket(null); }}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
            <Plus size={14} /> Nouveau ticket
          </button>
        </div>
      </div>

      {/* Formulaire nouveau ticket */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-600"/> Nouveau ticket
            </h2>
            <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-700"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sujet *</label>
              <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Décrivez brièvement votre demande..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Priorité</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20">
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Message *</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={5} placeholder="Décrivez votre problème en détail (version, étapes pour reproduire, captures d'écran si besoin)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-5 py-3 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {submitting ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14}/>}
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Détail ticket */}
      {selectedTicket && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">{selectedTicket.subject}</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                {new Date(selectedTicket.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' • '}
                {CATEGORIES.find(c => c.id === selectedTicket.category)?.label || selectedTicket.category}
              </p>
            </div>
            <button onClick={() => setSelectedTicket(null)} className="p-2 text-slate-400 hover:text-slate-700 flex-shrink-0"><X size={16}/></button>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Votre message</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.message}</p>
          </div>
          {selectedTicket.adminReply && (
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Réponse du support</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.adminReply}</p>
              {selectedTicket.resolvedAt && (
                <p className="text-[9px] text-slate-400 mt-2">
                  Résolu le {new Date(selectedTicket.resolvedAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          )}
          {!selectedTicket.adminReply && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <Clock size={16} className="text-amber-500 flex-shrink-0"/>
              <p className="text-xs font-bold text-amber-700">En attente de réponse de notre équipe support.</p>
            </div>
          )}
        </div>
      )}

      {/* Liste des tickets */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={28} className="text-indigo-400 animate-spin"/>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <LifeBuoy size={40} className="text-slate-200 mx-auto mb-4"/>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun ticket soumis</p>
          <p className="text-[9px] text-slate-300 mt-1">Créez votre premier ticket pour contacter le support.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
            const StatusIcon = cfg.icon;
            const prio = PRIORITIES.find(p => p.id === ticket.priority);
            return (
              <button key={ticket.id} onClick={() => { setSelectedTicket(ticket); setShowForm(false); }}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 p-4 text-left transition-all flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                  <StatusIcon size={16}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{ticket.subject}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 truncate">
                    {CATEGORIES.find(c => c.id === ticket.category)?.label} •{' '}
                    {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {prio && <span className={`text-[9px] font-black uppercase ${prio.color}`}>{prio.label}</span>}
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${cfg.color}`}>{cfg.label}</span>
                  <ChevronRight size={14} className="text-slate-300"/>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-start gap-4">
        <AlertCircle size={20} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-xs font-black text-slate-700 uppercase tracking-tight mb-1">Temps de réponse moyen</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Notre équipe répond généralement sous <strong>24–48h</strong> en jours ouvrés.
            Pour les urgences critiques, indiquez la priorité "Critique" pour un traitement accéléré.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Support;
