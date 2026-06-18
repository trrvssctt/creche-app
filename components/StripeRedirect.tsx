/**
 * StripeRedirect.tsx
 * Pages de retour Stripe après paiement par carte bancaire.
 * Affichées lorsque l'URL correspond à /stripe/success ou /stripe/cancel.
 */

import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '../services/api';

interface StripeSuccessPageProps {
  onContinue: () => void;
  onAutoLogin?: (data: { token: string; user: any }) => void;
}

export const StripeSuccessPage: React.FC<StripeSuccessPageProps> = ({ onContinue, onAutoLogin }) => {
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'error'>('loading');
  const [isRegistration, setIsRegistration] = useState(false);
  const [pollMsg, setPollMsg] = useState('Vérification du paiement...');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = 30; // 30 × 2s = 60 secondes max

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const registration = params.get('registration') === 'true';
    setIsRegistration(registration);

    if (!sessionId) {
      setStatus('confirmed');
      return;
    }

    if (!registration) {
      // Upgrade abonnement existant — pas besoin de polling
      apiClient.get(`/billing/stripe/session/${sessionId}`)
        .then(() => setStatus('confirmed'))
        .catch(() => setStatus('confirmed'));
      return;
    }

    // Nouvelle inscription via Stripe — polling jusqu'à ce que le webhook ait créé le compte
    const poll = async () => {
      attemptsRef.current += 1;

      if (attemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        setStatus('confirmed'); // fallback : montrer "SE CONNECTER" manuellement
        return;
      }

      if (attemptsRef.current > 10) setPollMsg('Finalisation du compte...');
      if (attemptsRef.current > 20) setPollMsg('Presque prêt...');

      try {
        const res = await apiClient.get(`/auth/register-check/${sessionId}`);
        if (res.status === 'completed' && res.token && onAutoLogin) {
          clearInterval(pollRef.current!);
          onAutoLogin({ token: res.token, user: res.user });
        } else if (res.status === 'failed' || res.status === 'expired') {
          clearInterval(pollRef.current!);
          setStatus('error');
        }
        // 'pending' → continuer à poller
      } catch {
        // erreur réseau → continuer à poller
      }
    };

    pollRef.current = setInterval(poll, 2000);
    poll(); // appel immédiat

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Pendant le polling — nouvelle inscription
  if (isRegistration && status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8">
          <Loader2 size={48} className="text-indigo-400 animate-spin mx-auto" />
          <div className="space-y-3">
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Déploiement en cours</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">{pollMsg}</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div
              className="h-1.5 bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((attemptsRef.current / MAX_ATTEMPTS) * 100, 95)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={48} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full animate-in zoom-in-95 duration-700 space-y-10">
          <div className="w-24 h-24 bg-rose-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse">
            <AlertCircle size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Erreur de création</h1>
            <p className="text-slate-400 font-medium leading-relaxed uppercase text-[10px] tracking-[0.3em] px-8">
              Le paiement a été reçu mais une erreur est survenue lors de la création du compte. Contactez le support.
            </p>
          </div>
          <button onClick={onContinue} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-400 transition-all flex items-center justify-center gap-3 active:scale-95">
            RETOUR <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Registration success fallback (si polling timeout ou pas de onAutoLogin)
  if (isRegistration) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full animate-in zoom-in-95 duration-700 space-y-10">
          <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-bounce">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Compte Créé !</h1>
            <p className="text-slate-400 font-medium leading-relaxed uppercase text-[10px] tracking-[0.3em] px-8">
              Votre paiement a été confirmé. Connectez-vous avec vos identifiants pour accéder à votre instance.
            </p>
          </div>
          <button onClick={onContinue} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 active:scale-95">
            SE CONNECTER <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Upgrade abonnement existant
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-700 space-y-10">
        <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Paiement Réussi !</h1>
          <p className="text-slate-400 font-medium leading-relaxed uppercase text-[10px] tracking-[0.3em] px-8">
            Votre paiement par carte a été traité avec succès. Votre abonnement sera activé sous quelques instants.
          </p>
        </div>
        <button onClick={onContinue} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 active:scale-95">
          ACCÉDER À MON ESPACE <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

interface StripeCancelPageProps {
  onBack: () => void;
}

export const StripeCancelPage: React.FC<StripeCancelPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-700 space-y-10">
        <div className="w-24 h-24 bg-amber-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
          <XCircle size={48} />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Paiement Annulé</h1>
          <p className="text-slate-400 font-medium leading-relaxed uppercase text-[10px] tracking-[0.3em] px-8">
            Vous avez annulé le processus de paiement. Aucun montant n'a été prélevé. Vous pouvez réessayer à tout moment.
          </p>
        </div>
        <button onClick={onBack} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-3 active:scale-95">
          RETOUR AUX ABONNEMENTS <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

interface StripeErrorPageProps {
  onBack: () => void;
}

export const StripeErrorPage: React.FC<StripeErrorPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-700 space-y-10">
        <div className="w-24 h-24 bg-rose-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse">
          <AlertCircle size={48} />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Erreur de Paiement</h1>
          <p className="text-slate-400 font-medium leading-relaxed uppercase text-[10px] tracking-[0.3em] px-8">
            Une erreur est survenue lors du traitement de votre paiement. Veuillez réessayer ou contacter le support.
          </p>
        </div>
        <button onClick={onBack} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-400 transition-all flex items-center justify-center gap-3 active:scale-95">
          RÉESSAYER <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
