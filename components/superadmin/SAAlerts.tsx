import React from 'react';
import {
  AlertTriangle, Clock, CheckCircle2, Mail, Eye, Check, Bell,
  Ban, TrendingDown, Calendar, Zap
} from 'lucide-react';

interface Props {
  tenants: any[];
  pendingValidations: any[];
  upcomingAlerts: any[];
  overdueTenantsRaw: any[];
  onValidate: (v: any) => void;
  onOpenBilling: (id: string) => void;
  onEmail: (tenantId: string, tenantName: string, subject?: string, body?: string) => void;
  fmt: (n: number) => string;
  fmtDate: (d: any) => string;
}

const PaymentBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    UP_TO_DATE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    TRIAL:      'bg-sky-500/15 text-sky-400 border border-sky-500/20',
    PENDING:    'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    REJECTED:   'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  };
  const labels: Record<string, string> = { UP_TO_DATE: 'À JOUR', TRIAL: 'ESSAI', PENDING: 'EN ATTENTE', REJECTED: 'REJETÉ' };
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${map[status] || 'bg-zinc-500/15 text-zinc-400'}`}>{labels[status] || status}</span>;
};

const SAAlerts: React.FC<Props> = ({
  tenants, pendingValidations, upcomingAlerts, overdueTenantsRaw,
  onValidate, onOpenBilling, onEmail, fmt, fmtDate
}) => {
  const totalAlerts = overdueTenantsRaw.length + pendingValidations.length + upcomingAlerts.length;

  return (
    <div className="space-y-6 p-6">
      {/* Alert summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`relative overflow-hidden rounded-2xl p-5 border ${overdueTenantsRaw.length > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
          {overdueTenantsRaw.length > 0 && <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full -translate-y-6 translate-x-6" />}
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-xl ${overdueTenantsRaw.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-700 text-zinc-400'}`}>
              <TrendingDown size={16} />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${overdueTenantsRaw.length > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>En retard</p>
          </div>
          <p className={`text-4xl font-black ${overdueTenantsRaw.length > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>{overdueTenantsRaw.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">Paiements SaaS manquants</p>
          {overdueTenantsRaw.length > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping" />}
        </div>

        <div className={`relative overflow-hidden rounded-2xl p-5 border ${upcomingAlerts.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
          {upcomingAlerts.length > 0 && <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-6 translate-x-6" />}
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-xl ${upcomingAlerts.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'}`}>
              <Calendar size={16} />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${upcomingAlerts.length > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>Échéances proches</p>
          </div>
          <p className={`text-4xl font-black ${upcomingAlerts.length > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>{upcomingAlerts.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">Dans les 7 prochains jours</p>
        </div>

        <div className={`relative overflow-hidden rounded-2xl p-5 border ${pendingValidations.length > 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
          {pendingValidations.length > 0 && <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full -translate-y-6 translate-x-6" />}
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-xl ${pendingValidations.length > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-700 text-zinc-400'}`}>
              <Clock size={16} />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${pendingValidations.length > 0 ? 'text-indigo-400' : 'text-zinc-400'}`}>Validations</p>
          </div>
          <p className={`text-4xl font-black ${pendingValidations.length > 0 ? 'text-indigo-400' : 'text-zinc-400'}`}>{pendingValidations.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">En attente d'approbation</p>
          {pendingValidations.length > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
        </div>
      </div>

      {totalAlerts === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-12 text-center">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
          <h3 className="font-black text-white text-xl mb-2">Tout est sous contrôle</h3>
          <p className="text-sm text-zinc-400">Aucune alerte active. Tous les comptes sont à jour.</p>
        </div>
      )}

      {/* Comptes en retard */}
      {overdueTenantsRaw.length > 0 && (
        <div className="bg-zinc-800/50 border border-rose-500/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-rose-500/20 bg-rose-500/5 flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-400 animate-pulse" />
            <h3 className="font-bold text-white">Comptes SaaS en retard de paiement</h3>
            <span className="ml-1 bg-rose-500/20 text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full">{overdueTenantsRaw.length}</span>
          </div>
          <div className="divide-y divide-zinc-700/30">
            {overdueTenantsRaw.map((t: any) => (
              <div key={t.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-700/20 transition-colors gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{t.name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">{t.domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-zinc-300 font-semibold">{t.planName}</p>
                    <p className="text-[10px] text-zinc-500">Dernier: {fmtDate(t.lastPaymentDate)}</p>
                  </div>
                  <PaymentBadge status={t.paymentStatus} />
                  <button
                    onClick={() => onOpenBilling(t.id)}
                    className="p-2 bg-zinc-700/50 hover:bg-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-all"
                    title="Voir détails"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => onEmail(t.id, t.name,
                      'Rappel de paiement – GeStockPro',
                      `Bonjour,\n\nNous constatons un retard de paiement sur votre abonnement GeStockPro.\n\nMerci de régulariser votre situation dans les plus brefs délais.\n\nCordialement,\nL'équipe GeStockPro`
                    )}
                    className="p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-400 hover:text-amber-300 transition-all"
                    title="Envoyer rappel email"
                  >
                    <Mail size={13} />
                  </button>
                  <button
                    onClick={() => onValidate({ tenantId: t.id, tenantName: t.name, planId: t.subscription?.planId })}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all"
                    title="Valider paiement"
                  >
                    <Check size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validations en attente */}
      {pendingValidations.length > 0 && (
        <div className="bg-zinc-800/50 border border-indigo-500/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center gap-3">
            <Clock size={16} className="text-indigo-400" />
            <h3 className="font-bold text-white">Validations de paiement en attente</h3>
            <span className="ml-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-full">{pendingValidations.length}</span>
          </div>
          <div className="divide-y divide-zinc-700/30">
            {pendingValidations.map((v: any) => {
              const name = v?.tenantName || v?.tenant?.name || 'Inconnu';
              return (
                <div key={v.tenantId || v.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-700/20 transition-colors gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">{name}</p>
                    <p className="text-[10px] text-indigo-400 mt-0.5">{v.planId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onValidate(v)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Check size={12} /> Valider
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming billing */}
      {upcomingAlerts.length > 0 && (
        <div className="bg-zinc-800/50 border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
            <Calendar size={16} className="text-amber-400" />
            <h3 className="font-bold text-white">Échéances à venir (7 jours)</h3>
          </div>
          <div className="divide-y divide-zinc-700/30">
            {upcomingAlerts.map((a: any, i: number) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-700/20 transition-colors">
                <div>
                  <p className="font-bold text-white">{a.name || a.tenantName || 'Inconnu'}</p>
                  <p className="text-[10px] text-zinc-400">{a.planName || a.planId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-400">{fmtDate(a.nextBillingDate)}</p>
                  <p className="text-[10px] text-zinc-500">Prochain prélèvement</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SAAlerts;
