import React, { useState, useEffect } from 'react';
import {
  CreditCard, AlertCircle, CheckCircle2, Clock, Send, Loader2,
  ChevronDown, ChevronUp, Utensils, Bus, GraduationCap, BookOpen, Users,
  Home, Package, Receipt, Download, FileText, BadgeCheck,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { generateRecu } from '../../services/pdfGenerator';

interface ServiceInfo {
  id: string; name: string; description?: string;
  typeOffre?: string; inclutCantine?: boolean;
}

interface Echeance {
  id: string; eleveId: string; mois: string; montant: number | string;
  statut: 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD' | 'ANNULE';
  dateEcheance?: string; datePaiement?: string;
  eleve?: { nom: string; prenom: string };
  service?: ServiceInfo;
  periodeLabel?: string;
}

interface InvoiceFromApi {
  id: string;
  saleId?: string;
  amount: number | string;
  paidAt?: string;
  invoice?: { id: string; amount: number | string; status: string; invoiceDate: string } | null;
  eleve?: { id: string; nom: string; prenom: string };
  service?: { id: string; name: string };
  periodeLabel?: string;
  dateEcheance?: string;
}

interface Props { echeances: Echeance[]; enfants?: any[]; ecole?: any; onRefresh?: () => void; }

const STATUT_CFG = {
  PAYE:       { label: 'Payé',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_ATTENTE: { label: 'En attente', cls: 'bg-amber-50  text-amber-700  border-amber-200',    icon: Clock },
  EN_RETARD:  { label: 'En retard',  cls: 'bg-red-50    text-red-700    border-red-200',      icon: AlertCircle },
  ANNULE:     { label: 'Annulé',     cls: 'bg-gray-50   text-gray-500   border-gray-200',     icon: AlertCircle },
};

const METHODES = ['Wave', 'Orange Money', 'Free Money', 'Espèces', 'Virement'];
const fmt = (n: number | string) => Number(n).toLocaleString('fr-FR');

// Déduit le type de service à partir du nom — retourne icône + couleur + libellé
function detectServiceType(service?: ServiceInfo, periodeLabel?: string): {
  icon: React.FC<any>; color: string; bg: string; border: string; label: string;
} {
  const raw = (service?.name || periodeLabel || '').toLowerCase();
  const type = (service?.typeOffre || '').toLowerCase();

  if (raw.includes('cantine') || service?.inclutCantine) {
    return { icon: Utensils,      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Cantine' };
  }
  if (raw.includes('transport') || raw.includes('bus') || type.includes('transport')) {
    return { icon: Bus,           color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Transport scolaire' };
  }
  if (raw.includes('inscription') || raw.includes('frais')) {
    return { icon: BookOpen,      color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  label: 'Frais d\'inscription' };
  }
  if (raw.includes('scolarité') || raw.includes('scolarite') || raw.includes('mensualité') || raw.includes('mensualite') || type.includes('mensuel')) {
    return { icon: GraduationCap, color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  label: 'Scolarité' };
  }
  if (raw.includes('internat') || raw.includes('hébergement') || raw.includes('hebergement')) {
    return { icon: Home,          color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'Hébergement' };
  }
  if (raw.includes('fourniture') || raw.includes('materiel') || raw.includes('matériel')) {
    return { icon: Package,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Fournitures' };
  }
  return   { icon: Receipt,       color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200',    label: 'Frais divers' };
}

const ParentFactures: React.FC<Props> = ({ echeances, enfants = [], ecole, onRefresh }) => {
  const [modalEch, setModalEch]     = useState<Echeance | null>(null);
  const [methode, setMethode]       = useState('Wave');
  const [reference, setReference]   = useState('');
  const [sending, setSending]       = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPaids, setShowPaids]   = useState(true);
  const [recuLoading, setRecuLoading] = useState<string | null>(null);

  // Factures confirmées (payées par l'admin) depuis /parent/factures
  const [facturesConfirmees, setFacturesConfirmees] = useState<InvoiceFromApi[]>([]);
  useEffect(() => {
    apiClient.get('/parent/factures')
      .then((data: any) => setFacturesConfirmees(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [echeances]);

  // Index : echeanceId → invoice
  const invoiceByEcheanceId = React.useMemo(() => {
    const map: Record<string, InvoiceFromApi> = {};
    facturesConfirmees.forEach(f => { map[f.id] = f; });
    return map;
  }, [facturesConfirmees]);

  const handleRecu = async (e: Echeance) => {
    setRecuLoading(e.id);
    try { await generateRecu(e, ecole || {}); }
    catch { alert('Erreur lors de la génération du reçu.'); }
    finally { setRecuLoading(null); }
  };

  const impayees = echeances.filter(e => e.statut !== 'PAYE' && e.statut !== 'ANNULE');
  const payees   = echeances.filter(e => e.statut === 'PAYE');
  const totalDu  = impayees.reduce((s, e) => s + Number(e.montant || 0), 0);
  const retard   = impayees.filter(e => e.statut === 'EN_RETARD').length;

  // Résumé par enfant — basé sur la liste complète d'enfants
  const parEnfant = React.useMemo(() => {
    // Partir des enfants connus (tous, même sans écheances)
    const map = new Map<string, { id: string; prenom: string; nom: string; totalDu: number; totalPaye: number; aucune: boolean }>();
    for (const enf of enfants) {
      if (!enf.id) continue;
      map.set(enf.id, { id: enf.id, prenom: enf.prenom || '—', nom: enf.nom || '—', totalDu: 0, totalPaye: 0, aucune: true });
    }
    // Enrichir avec les données d'écheances
    for (const e of echeances) {
      const key = e.eleveId;
      if (!key) continue;
      if (!map.has(key)) {
        // Enfant trouvé dans les écheances mais pas dans la liste enfants (fallback)
        map.set(key, { id: key, prenom: e.eleve?.prenom || '—', nom: e.eleve?.nom || key.slice(0, 8), totalDu: 0, totalPaye: 0, aucune: false });
      }
      const rec = map.get(key)!;
      rec.aucune = false;
      if (e.statut === 'PAYE') rec.totalPaye += Number(e.montant || 0);
      else if (e.statut !== 'ANNULE') rec.totalDu += Number(e.montant || 0);
    }
    return [...map.values()];
  }, [echeances, enfants]);

  const handleDemander = async () => {
    if (!modalEch) return;
    setSending(true);
    try {
      await apiClient.post('/parent/paiement/demander', {
        echeanceId: modalEch.id, eleveId: modalEch.eleveId,
        montant: modalEch.montant, methode, reference: reference || undefined,
      });
      setSuccessMsg(`Demande transmise ! L'école validera votre paiement de ${fmt(modalEch.montant)} FCFA.`);
      setModalEch(null); setReference(''); onRefresh?.();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de l\'envoi.');
    } finally { setSending(false); }
  };

  if (!echeances.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-amber-50 flex items-center justify-center mb-6">
        <CreditCard className="w-12 h-12 text-amber-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">Aucune facture</h3>
      <p className="text-gray-400">Vos factures apparaîtront ici.</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="text-2xl font-black text-gray-800">Mes factures</h2>
        <p className="text-gray-500 mt-1">{echeances.length} facture{echeances.length > 1 ? 's' : ''} au total</p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-red-100 p-3 sm:p-5 shadow-sm">
          <p className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Total à régler</p>
          <p className="text-lg sm:text-2xl font-black text-red-600">{fmt(totalDu)}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-3 sm:p-5 shadow-sm">
          <p className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">En attente</p>
          <p className="text-lg sm:text-2xl font-black text-amber-600">{impayees.filter(e => e.statut === 'EN_ATTENTE').length}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">facture{impayees.length > 1 ? 's' : ''}</p>
        </div>
        <div className={`rounded-2xl border p-3 sm:p-5 shadow-sm ${retard > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">En retard</p>
          <p className={`text-lg sm:text-2xl font-black ${retard > 0 ? 'text-red-600' : 'text-gray-300'}`}>{retard}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">facture{retard > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Résumé par enfant */}
      {parEnfant.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-gray-600 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Détail par enfant
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {parEnfant.map(enfant => (
              <div key={enfant.id}
                className={`border rounded-2xl p-4 flex items-center gap-4 ${
                  enfant.aucune
                    ? 'bg-gray-50 border-gray-100'
                    : enfant.totalDu > 0
                      ? 'bg-white border-red-100'
                      : 'bg-white border-emerald-100'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  enfant.aucune ? 'bg-gray-100 text-gray-400' : enfant.totalDu > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {(enfant.prenom[0] || '?')}{(enfant.nom[0] || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm">{enfant.prenom} {enfant.nom}</p>
                  <p className="text-[10px] font-bold mt-0.5">
                    {enfant.aucune && <span className="text-gray-400">Aucune facture pour le moment</span>}
                    {!enfant.aucune && enfant.totalDu > 0 && <span className="text-red-600">{fmt(enfant.totalDu)} FCFA à régler</span>}
                    {!enfant.aucune && enfant.totalDu > 0 && enfant.totalPaye > 0 && <span className="text-gray-300"> · </span>}
                    {!enfant.aucune && enfant.totalPaye > 0 && <span className="text-emerald-600">{fmt(enfant.totalPaye)} FCFA déjà réglé(s)</span>}
                    {!enfant.aucune && enfant.totalDu === 0 && enfant.totalPaye === 0 && <span className="text-gray-400">Aucune redevance</span>}
                    {!enfant.aucune && enfant.totalDu === 0 && enfant.totalPaye > 0 && <span className="text-emerald-500">Tout est réglé ✓</span>}
                  </p>
                </div>
                {!enfant.aucune && enfant.totalDu > 0 && (
                  <p className="font-black text-red-600 text-sm shrink-0">{fmt(enfant.totalDu)}<span className="text-[9px] font-bold text-gray-400"> FCFA</span></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <p className="text-base text-emerald-700 font-medium">{successMsg}</p>
        </div>
      )}

      {/* Factures à payer */}
      {impayees.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-700">À régler</h3>
          {impayees.map(e => {
            const st  = STATUT_CFG[e.statut] || STATUT_CFG.EN_ATTENTE;
            const StatusIcon = st.icon;
            const svc = detectServiceType(e.service, e.periodeLabel);
            const ServiceIcon = svc.icon;
            const nomService  = e.service?.name || e.periodeLabel || e.mois || '—';
            const periode     = e.service?.name !== e.periodeLabel ? e.periodeLabel : undefined;

            return (
              <div key={e.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icône service */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border ${svc.bg} ${svc.border}`}>
                      <ServiceIcon className={`w-7 h-7 ${svc.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Type de service bien visible */}
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border mb-1 ${svc.bg} ${svc.color} ${svc.border}`}>
                            {svc.label}
                          </span>
                          <p className="font-bold text-gray-900 text-base leading-tight">{nomService}</p>
                          {periode && <p className="text-sm text-gray-400 mt-0.5">{periode}</p>}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border flex-shrink-0 ${st.cls}`}>
                          <StatusIcon className="w-3.5 h-3.5" /> {st.label}
                        </span>
                      </div>

                      {/* Enfant + date */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {e.eleve && (
                          <span className="text-sm text-gray-500 font-medium">
                            👶 {e.eleve.prenom} {e.eleve.nom}
                          </span>
                        )}
                        {e.dateEcheance && (
                          <span className="text-sm text-gray-400">
                            · Échéance le {new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Montant */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black text-gray-900">{fmt(e.montant)}</p>
                      <p className="text-sm text-gray-400 font-medium">FCFA</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-50 px-5 py-3.5 bg-gray-50/60 flex justify-end">
                  <button onClick={() => { setModalEch(e); setSuccessMsg(''); }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-sm hover:shadow-md">
                    <Send className="w-4 h-4" /> Notifier mon paiement
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Factures payées */}
      {payees.length > 0 && (
        <div>
          <button onClick={() => setShowPaids(v => !v)}
            className="flex items-center gap-2 text-base font-semibold text-gray-500 hover:text-gray-700 transition mb-3">
            {showPaids ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            Historique — {payees.length} paiement{payees.length > 1 ? 's' : ''} confirmé{payees.length > 1 ? 's' : ''}
          </button>
          {showPaids && (
            <div className="space-y-2">
              {payees.map(e => {
                const svc = detectServiceType(e.service, e.periodeLabel);
                const ServiceIcon = svc.icon;
                const factureConfirmee = invoiceByEcheanceId[e.id];
                const invoiceRef = factureConfirmee?.invoice?.id;
                return (
                  <div key={e.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${svc.bg} border ${svc.border}`}>
                      <ServiceIcon className={`w-5 h-5 ${svc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-700 text-sm">{e.service?.name || e.periodeLabel || e.mois || '—'}</p>
                      <p className="text-xs text-gray-400">{svc.label} · {e.eleve ? `${e.eleve.prenom} ${e.eleve.nom}` : ''}</p>
                      {invoiceRef && (
                        <p className="text-[10px] font-black text-emerald-600 mt-0.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {invoiceRef}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="font-bold text-gray-500 text-sm">{fmt(e.montant)} FCFA</p>
                      {invoiceRef ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> Confirmé
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Payé
                        </span>
                      )}
                      <button
                        onClick={() => handleRecu(e)}
                        disabled={recuLoading === e.id}
                        title="Télécharger le reçu PDF"
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                      >
                        {recuLoading === e.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Reçu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal paiement */}
      {modalEch && (() => {
        const svc = detectServiceType(modalEch.service, modalEch.periodeLabel);
        const ServiceIcon = svc.icon;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-5 sm:p-8 max-h-[92vh] overflow-y-auto">
              <h3 className="font-black text-xl sm:text-2xl text-gray-900 mb-1">Notifier un paiement</h3>
              <p className="text-gray-500 text-sm mb-5">L'école recevra une notification et validera manuellement.</p>

              {/* Récap facture */}
              <div className={`rounded-2xl border p-5 mb-6 ${svc.bg} ${svc.border}`}>
                <div className="flex items-center gap-3 mb-3">
                  <ServiceIcon className={`w-6 h-6 ${svc.color}`} />
                  <div>
                    <p className={`text-xs font-black uppercase tracking-widest ${svc.color}`}>{svc.label}</p>
                    <p className="font-bold text-gray-800">{modalEch.service?.name || modalEch.periodeLabel || modalEch.mois}</p>
                  </div>
                </div>
                <div className="text-center pt-2 border-t border-current/10">
                  <p className="text-sm font-semibold text-gray-600 mb-1">Montant à régler</p>
                  <p className={`text-3xl sm:text-4xl font-black ${svc.color}`}>{fmt(modalEch.montant)}</p>
                  <p className={`text-base font-bold ${svc.color} opacity-70`}>FCFA</p>
                  {modalEch.eleve && <p className="text-sm text-gray-500 mt-2">Pour {modalEch.eleve.prenom} {modalEch.eleve.nom}</p>}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-3">Méthode de paiement</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {METHODES.map(m => (
                      <button key={m} type="button" onClick={() => setMethode(m)}
                        className={`py-3.5 rounded-xl text-sm font-bold transition border ${
                          methode === m
                            ? 'bg-amber-400 text-white border-amber-400 shadow-md'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Référence de transaction <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                    placeholder="Ex: WV-123456789"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-base outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setModalEch(null)}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button onClick={handleDemander} disabled={sending}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white text-base font-black transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg">
                  {sending ? <><Loader2 className="w-5 h-5 animate-spin" />Envoi…</> : <><Send className="w-5 h-5" />Notifier l'école</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ParentFactures;
