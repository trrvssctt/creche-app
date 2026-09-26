import React, { useCallback, useEffect, useState } from 'react';
import {
  Smartphone, QrCode, Loader2, CheckCircle2, AlertCircle, LogOut, Power, RefreshCw, KeyRound, ShieldAlert,
} from 'lucide-react';
import { useToast } from './ToastProvider';
import { whatsappService, WaSessionStatus, WA_STATUS_LABELS } from '../services/whatsappService';

// ─── Hook : état de la session WhatsApp (sondage adaptatif) ──────────────────

const BUSY = new Set(['INITIALIZING', 'QR_READY', 'AUTHENTICATING', 'RECONNECTING']);

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WaSessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await whatsappService.getStatus());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Statut WhatsApp indisponible');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sondage rapide pendant la liaison (QR qui tourne), lent une fois connecté
  useEffect(() => {
    const delay = status && BUSY.has(status.status) ? 3000 : 20000;
    const t = setInterval(refresh, delay);
    return () => clearInterval(t);
  }, [status?.status, refresh]);

  return { status, error, refresh, setStatus };
}

// ─── Badge compact (en-têtes) ────────────────────────────────────────────────

export const WhatsAppStatusBadge: React.FC<{ status: WaSessionStatus | null }> = ({ status }) => {
  if (!status) return null;
  const ready = status.status === 'READY';
  const busy = BUSY.has(status.status);
  const cls = ready
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : busy ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cls}`}>
      <span className={`w-2 h-2 rounded-full ${ready ? 'bg-emerald-500' : busy ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
      WhatsApp : {WA_STATUS_LABELS[status.status]}{ready && status.phone ? ` (+${status.phone})` : ''}
    </span>
  );
};

// ─── Panneau complet ─────────────────────────────────────────────────────────

const WhatsAppConnexion: React.FC<{ canManage: boolean; wa: ReturnType<typeof useWhatsAppStatus> }> = ({ canManage, wa }) => {
  const showToast = useToast();
  const { status, error, refresh, setStatus } = wa;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pairPhone, setPairPhone] = useState('');
  const [pairCode, setPairCode] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<any>, okMsg?: string) => {
    setBusyAction(name);
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'status' in res) setStatus(res as WaSessionStatus);
      if (okMsg) showToast(okMsg, 'success');
      return res;
    } catch (e: any) {
      showToast(e?.message || 'Action impossible.', 'error');
    } finally {
      setBusyAction(null);
      refresh();
    }
  };

  const handlePairing = async () => {
    if (!pairPhone.trim()) return;
    const res = await run('pair', () => whatsappService.requestPairingCode(pairPhone.trim()));
    if (res?.code) setPairCode(res.code);
  };

  const s = status?.status;
  const code = pairCode || status?.pairingCode;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Smartphone size={18} className="text-green-600" /> Compte WhatsApp de l'établissement
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Les messages partent automatiquement depuis ce numéro, en arrière-plan — aucune fenêtre WhatsApp à ouvrir.
          </p>
        </div>
        <WhatsAppStatusBadge status={status} />
      </div>

      {error && !status && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 rounded-xl p-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Connecté */}
      {s === 'READY' && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700 font-medium">Numéro lié</p>
            <p className="font-bold text-emerald-900">+{status?.phone}</p>
            {status?.pushname && <p className="text-xs text-emerald-700">{status.pushname}</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500 font-medium">Envoyés aujourd'hui</p>
            <p className="font-bold text-slate-800">
              {status?.sentToday ?? 0}{status?.dailyCap ? ` / ${status.dailyCap}` : ''}
            </p>
            {status?.dailyCap && <p className="text-[11px] text-slate-500">Plafond progressif anti-bannissement</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500 font-medium">En file d'attente</p>
            <p className="font-bold text-slate-800">{status?.queueLength ?? 0}</p>
            {status?.pausedUntil && (
              <p className="text-[11px] text-amber-700">Pause jusqu'à {new Date(status.pausedUntil).toLocaleTimeString('fr-FR')}</p>
            )}
          </div>
        </div>
      )}

      {/* QR code */}
      {s === 'QR_READY' && (
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col items-center gap-3">
            {status?.qr ? (
              <img src={status.qr} alt="QR code WhatsApp" className="w-64 h-64 rounded-xl border border-slate-200" />
            ) : (
              <div className="w-64 h-64 rounded-xl bg-slate-100 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
            )}
            <p className="text-[11px] text-slate-400">Le QR code se renouvelle automatiquement.</p>
          </div>
          <div className="space-y-4 text-sm text-slate-600">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Ouvrez WhatsApp sur le téléphone de l'établissement</li>
              <li>Menu <b>⋮</b> ou <b>Réglages</b> → <b>Appareils connectés</b></li>
              <li><b>Connecter un appareil</b>, puis scannez ce QR code</li>
            </ol>
            {canManage && (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <KeyRound size={14} /> Vous êtes sur ce téléphone ? Liez avec un code
                </p>
                <div className="flex gap-2">
                  <input
                    value={pairPhone}
                    onChange={e => setPairPhone(e.target.value)}
                    placeholder="Numéro WhatsApp (ex. 77 123 45 67)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                  <button
                    onClick={handlePairing}
                    disabled={!pairPhone.trim() || busyAction === 'pair'}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {busyAction === 'pair' ? <Loader2 size={16} className="animate-spin" /> : 'Obtenir'}
                  </button>
                </div>
                {code && (
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-2xl font-black tracking-[0.3em] text-green-800">{code.slice(0, 4)}-{code.slice(4)}</p>
                    <p className="text-[11px] text-green-700 mt-1">
                      Appareils connectés → Connecter un appareil → « Lier avec le numéro de téléphone »
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transitoires */}
      {s && ['INITIALIZING', 'AUTHENTICATING', 'RECONNECTING'].includes(s) && (
        <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 rounded-xl p-4">
          <Loader2 size={18} className="animate-spin text-green-600" />
          {s === 'INITIALIZING' && 'Démarrage de WhatsApp Web en arrière-plan (10 à 60 s)…'}
          {s === 'AUTHENTICATING' && 'Appareil lié, synchronisation des conversations…'}
          {s === 'RECONNECTING' && `Connexion perdue, reconnexion automatique${status?.nextReconnectAt ? ` à ${new Date(status.nextReconnectAt).toLocaleTimeString('fr-FR')}` : ''}…`}
        </div>
      )}

      {/* Problèmes */}
      {s === 'RESTRICTED' && (
        <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 rounded-xl p-4">
          <ShieldAlert size={18} className="shrink-0" />
          <span>WhatsApp a restreint ce compte ou l'adresse IP du serveur ({status?.restriction}). Vérifiez le téléphone avant de relancer.</span>
        </div>
      )}
      {status?.lastError && s !== 'READY' && s !== 'RESTRICTED' && (
        <p className="text-xs text-slate-500 flex items-center gap-1.5"><AlertCircle size={13} /> Dernière erreur : {status.lastError}</p>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex flex-wrap gap-2 pt-1">
          {s && ['DISCONNECTED', 'LOGGED_OUT', 'RESTRICTED'].includes(s) && (
            <button
              onClick={() => run('connect', whatsappService.connect)}
              disabled={busyAction === 'connect'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {busyAction === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
              {s === 'DISCONNECTED' ? 'Connecter WhatsApp' : 'Relier WhatsApp'}
            </button>
          )}
          {s && s !== 'DISCONNECTED' && s !== 'LOGGED_OUT' && (
            <button
              onClick={() => run('disconnect', whatsappService.disconnect, 'WhatsApp mis en pause (liaison conservée).')}
              disabled={!!busyAction}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <Power size={16} /> Mettre en pause
            </button>
          )}
          {s === 'READY' && (
            <button
              onClick={() => {
                if (window.confirm('Délier ce téléphone ? Il faudra rescanner un QR code pour renvoyer des messages.')) {
                  run('logout', whatsappService.logout, 'Téléphone délié.');
                }
              }}
              disabled={!!busyAction}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              <LogOut size={16} /> Délier le téléphone
            </button>
          )}
          <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 text-sm hover:bg-slate-50">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      )}
      {!canManage && s !== 'READY' && (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <AlertCircle size={13} /> Demandez à la direction de connecter le WhatsApp de l'établissement.
        </p>
      )}
    </div>
  );
};

export default WhatsAppConnexion;
