import React, { useState } from 'react';
import {
  Baby, Calendar, MapPin, Utensils, Bus, X, Loader2,
  GraduationCap, Stethoscope, Phone, Shield, CheckCircle2,
  AlertTriangle, Heart, Camera, User, Info, ChevronRight,
} from 'lucide-react';
import { apiClient } from '../../services/api';

interface Classe { id: string; nom: string; niveau: string; }
interface Parent1 {
  nom?: string; prenom?: string; telephone?: string; whatsapp?: string;
  email?: string; lien?: string; telDomicile?: string; telTravail?: string; adresse?: string;
}
interface Parent2 {
  nom?: string; prenom?: string; telephone?: string; lien?: string;
  telDomicile?: string; telTravail?: string;
}
interface ContactUrgence { nom?: string; telephone?: string; lien?: string; }
interface FicheSanitaire {
  vaccDiphterie?: boolean;  vaccDiphterieDate?: string;
  vaccPolio?: boolean;      vaccPolioDate?: string;
  vaccCoqueluche?: boolean; vaccCoquelucheDate?: string;
  vaccBCG?: boolean;        vaccBCGDate?: string;
  vaccHepB?: boolean;       vaccHepBDate?: string;
  vaccROR?: boolean;        vaccRORDate?: string;
  certifContrIndication?: boolean;
  traitementMedical?: boolean; traitementDetail?: string;
  maladieRubeole?: boolean; maladieVaricelle?: boolean; maladieAngine?: boolean;
  maladieRhumatisme?: boolean; maladieScarlatine?: boolean; maladieCoqueluche?: boolean;
  maladieOtite?: boolean; maladieRougeole?: boolean; maladieOreillons?: boolean;
  allergieAsthme?: boolean; allergieMedicament?: boolean; allergieAlimentaire?: boolean;
  allergieAutres?: string; allergieConduite?: string;
  difficulteSante?: string;
  equipeLunettes?: boolean; equipeLentilles?: boolean;
  equipeProtheseAuditive?: boolean; equipeProtheseDentaire?: boolean;
  equipePrecisions?: string;
  mouillerLit?: string;
  medecinNom?: string; medecinTel?: string;
  autorisationSoins?: boolean; autorisationPhoto?: boolean;
}

interface Eleve {
  id: string; nom: string; prenom: string; niveau: string; statut: string;
  sexe?: string; dateNaissance?: string; lieuNaissance?: string;
  photoUrl?: string; cantine?: boolean; transportBus?: boolean;
  regimeFinancier?: string; remisePct?: number; besoinSpecifique?: string;
  anneeScolaire?: string; dateAdmission?: string; notes?: string;
  classe?: Classe;
  parent1?: Parent1; parent2?: Parent2; contactUrgence?: ContactUrgence;
  ficheSanitaire?: FicheSanitaire;
}

interface Props { enfants: Eleve[]; onSelect?: (e: Eleve) => void; }

const STATUT_CFG: Record<string, { label: string; cls: string }> = {
  INSCRIT:    { label: 'Inscrit',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ACTIF:      { label: 'Actif',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  EN_ATTENTE: { label: 'En attente', cls: 'bg-amber-100  text-amber-700  border-amber-200' },
  ADMIS:      { label: 'Admis',      cls: 'bg-blue-100   text-blue-700   border-blue-200' },
  RADIE:      { label: 'Radié',      cls: 'bg-red-100    text-red-700    border-red-200' },
};

const REGIME_LABELS: Record<string, string> = {
  NORMAL:             'Normal',
  CAS_SOCIAL_PARTIEL: 'Cas social (partiel)',
  CAS_SOCIAL_TOTAL:   'Cas social (total)',
};

const NIVEAUX: Record<string, string> = {
  CRECHE: 'Crèche', PS: 'Petite Section', MS: 'Moyenne Section',
  GS: 'Grande Section', CP: 'CP', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2',
};

const GRADIENTS = [
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-indigo-400 to-violet-500',
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-cyan-500',
];

const LIEN_LABELS: Record<string, string> = { MERE: 'Mère', PERE: 'Père', TUTEUR: 'Tuteur légal' };

// Sous-section du modal avec titre iconé
const Section: React.FC<{ icon: React.FC<any>; title: string; color: string; bg: string; border: string; children: React.ReactNode }> =
  ({ icon: Icon, title, color, bg, border, children }) => (
    <div className={`rounded-2xl border ${border} ${bg} overflow-hidden`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-inherit">
        <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
        <p className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

// Ligne label / valeur
const Row: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({ label, value, mono }) =>
  value ? (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-white/40 last:border-0">
      <span className="text-xs font-bold text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm font-bold text-gray-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null;

function fmtDate(d?: string) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

// ─── Modal de détail complet ─────────────────────────────────────────────────

const EleveDetailModal: React.FC<{ eleve: Eleve; grad: string; onClose: () => void }> = ({ eleve, grad, onClose }) => {
  const fs = eleve.ficheSanitaire || {};
  const p1 = eleve.parent1 || {};
  const p2 = eleve.parent2 || {};
  const urg = eleve.contactUrgence || {};
  const stat = STATUT_CFG[eleve.statut] || { label: eleve.statut, cls: 'bg-gray-100 text-gray-600 border-gray-200' };

  const vaccinsOK  = [fs.vaccDiphterie, fs.vaccPolio, fs.vaccCoqueluche, fs.vaccBCG, fs.vaccHepB, fs.vaccROR].filter(Boolean).length;
  const hasAllergie = fs.allergieAsthme || fs.allergieMedicament || fs.allergieAlimentaire || fs.allergieAutres;
  const hasEquip    = fs.equipeLunettes || fs.equipeLentilles || fs.equipeProtheseAuditive || fs.equipeProtheseDentaire;
  const maladies    = [
    fs.maladieRubeole && 'Rubéole', fs.maladieVaricelle && 'Varicelle', fs.maladieAngine && 'Angine',
    fs.maladieRhumatisme && 'Rhumatisme', fs.maladieScarlatine && 'Scarlatine', fs.maladieCoqueluche && 'Coqueluche',
    fs.maladieOtite && 'Otite', fs.maladieRougeole && 'Rougeole', fs.maladieOreillons && 'Oreillons',
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-3">
      <div className="bg-gray-50 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">

        {/* ── En-tête ── */}
        <div className={`bg-gradient-to-r ${grad} p-4 sm:p-6 flex items-start justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center shadow-lg flex-shrink-0">
              {eleve.photoUrl
                ? <img src={eleve.photoUrl} alt={eleve.prenom} className="w-full h-full object-cover rounded-2xl" />
                : <span className="text-xl sm:text-2xl font-black text-white">{eleve.prenom[0]}{eleve.nom[0]}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-0.5">Dossier élève</p>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">{eleve.prenom} {eleve.nom}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border bg-white/20 text-white border-white/30`}>
                  {stat.label}
                </span>
                <span className="text-white/70 text-xs font-bold">{NIVEAUX[eleve.niveau] || eleve.niveau}</span>
                {eleve.classe && <span className="text-white/60 text-xs">· {eleve.classe.nom}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Corps scrollable ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Identité */}
          <Section icon={Baby} title="Identité" color="text-indigo-600" bg="bg-white" border="border-gray-100">
            <Row label="Prénom" value={eleve.prenom} />
            <Row label="Nom" value={eleve.nom} />
            <Row label="Sexe" value={eleve.sexe === 'M' ? 'Garçon' : eleve.sexe === 'F' ? 'Fille' : null} />
            <Row label="Date de naissance" value={fmtDate(eleve.dateNaissance)} />
            <Row label="Lieu de naissance" value={eleve.lieuNaissance} />
            <Row label="Année scolaire" value={eleve.anneeScolaire} />
            <Row label="Date de dépôt" value={fmtDate(eleve.dateAdmission)} />
          </Section>

          {/* Scolarité & options */}
          <Section icon={GraduationCap} title="Scolarité & options" color="text-violet-600" bg="bg-white" border="border-gray-100">
            <Row label="Niveau" value={NIVEAUX[eleve.niveau] || eleve.niveau} />
            <Row label="Classe" value={eleve.classe?.nom} />
            <Row label="Régime financier" value={REGIME_LABELS[eleve.regimeFinancier || ''] || eleve.regimeFinancier} />
            {(eleve.remisePct ?? 0) > 0 && <Row label="Remise" value={`${eleve.remisePct} %`} />}
            {eleve.besoinSpecifique && <Row label="Besoins spécifiques" value={eleve.besoinSpecifique} />}
            <div className="flex gap-2 mt-2">
              {eleve.cantine && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                  <Utensils className="w-3.5 h-3.5" /> Cantine incluse
                </span>
              )}
              {eleve.transportBus && (
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                  <Bus className="w-3.5 h-3.5" /> Transport scolaire
                </span>
              )}
            </div>
          </Section>

          {/* Fiche sanitaire */}
          <Section icon={Stethoscope} title="Fiche sanitaire" color="text-rose-600" bg="bg-white" border="border-rose-100">
            {/* Vaccins */}
            <div className="mb-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Vaccinations</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: 'vaccDiphterie' as keyof FicheSanitaire,  dk: 'vaccDiphterieDate'  as keyof FicheSanitaire, l: 'Diphtérie' },
                  { k: 'vaccPolio'     as keyof FicheSanitaire,  dk: 'vaccPolioDate'      as keyof FicheSanitaire, l: 'Polio' },
                  { k: 'vaccCoqueluche'as keyof FicheSanitaire,  dk: 'vaccCoquelucheDate' as keyof FicheSanitaire, l: 'Coqueluche' },
                  { k: 'vaccBCG'       as keyof FicheSanitaire,  dk: 'vaccBCGDate'        as keyof FicheSanitaire, l: 'BCG' },
                  { k: 'vaccHepB'      as keyof FicheSanitaire,  dk: 'vaccHepBDate'       as keyof FicheSanitaire, l: 'Hépatite B' },
                  { k: 'vaccROR'       as keyof FicheSanitaire,  dk: 'vaccRORDate'        as keyof FicheSanitaire, l: 'ROR' },
                ].map(v => {
                  const ok = !!fs[v.k];
                  const date = fs[v.dk] as string | undefined;
                  return (
                    <div key={v.k as string} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      <span>{ok ? '✓' : '✗'}</span>
                      <span>{v.l}</span>
                      {ok && date && <span className="font-normal text-emerald-500">— {fmtDate(date)}</span>}
                    </div>
                  );
                })}
              </div>
              {fs.certifContrIndication && (
                <p className="mt-2 text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Certificat de contre-indication joint
                </p>
              )}
            </div>

            {/* Traitement */}
            {fs.traitementMedical && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-black text-amber-700 uppercase mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Traitement médical en cours
                </p>
                {fs.traitementDetail && <p className="text-sm text-gray-700">{fs.traitementDetail}</p>}
              </div>
            )}

            {/* Allergies */}
            {hasAllergie && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-black text-rose-700 uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Allergies
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {fs.allergieAsthme     && <span className="text-xs font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">Asthme</span>}
                  {fs.allergieMedicament && <span className="text-xs font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">Médicamenteuses</span>}
                  {fs.allergieAlimentaire&& <span className="text-xs font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">Alimentaires</span>}
                </div>
                {fs.allergieAutres && <p className="text-sm text-gray-700"><span className="font-bold text-gray-500">Autres : </span>{fs.allergieAutres}</p>}
                {fs.allergieConduite && <p className="text-sm text-gray-700"><span className="font-bold text-gray-500">Conduite à tenir : </span>{fs.allergieConduite}</p>}
              </div>
            )}

            {/* Maladies antérieures */}
            {maladies.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Maladies antérieures</p>
                <div className="flex flex-wrap gap-1.5">
                  {maladies.map(m => (
                    <span key={m} className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Difficultés de santé */}
            {fs.difficulteSante && (
              <div className="mb-4">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Difficultés de santé / Antécédents</p>
                <p className="text-sm text-gray-700 bg-slate-50 rounded-xl p-3">{fs.difficulteSante}</p>
              </div>
            )}

            {/* Équipements */}
            {hasEquip && (
              <div className="mb-4">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Équipements portés</p>
                <div className="flex flex-wrap gap-1.5">
                  {fs.equipeLunettes         && <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">Lunettes</span>}
                  {fs.equipeLentilles        && <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">Lentilles</span>}
                  {fs.equipeProtheseAuditive && <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">Prothèse auditive</span>}
                  {fs.equipeProtheseDentaire && <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">Prothèse dentaire</span>}
                </div>
                {fs.equipePrecisions && <p className="text-sm text-gray-600 mt-2">{fs.equipePrecisions}</p>}
              </div>
            )}

            {/* Énurésie */}
            {fs.mouillerLit && (
              <Row label="Mouille son lit la nuit"
                value={fs.mouillerLit === 'OUI' ? 'Oui' : fs.mouillerLit === 'NON' ? 'Non' : 'Occasionnellement'} />
            )}

            {/* Médecin */}
            {(fs.medecinNom || fs.medecinTel) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Médecin traitant</p>
                <Row label="Nom" value={fs.medecinNom} />
                <Row label="Téléphone" value={fs.medecinTel} />
              </div>
            )}

            {/* Autorisations */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4">
              <p className={`text-xs font-black flex items-center gap-1.5 ${fs.autorisationSoins ? 'text-emerald-600' : 'text-red-500'}`}>
                <Camera className="w-3.5 h-3.5" />
                {fs.autorisationSoins ? '✓' : '✗'} Autorisation soins d'urgence
              </p>
              <p className={`text-xs font-black flex items-center gap-1.5 ${fs.autorisationPhoto ? 'text-emerald-600' : 'text-gray-400'}`}>
                <Camera className="w-3.5 h-3.5" />
                {fs.autorisationPhoto ? '✓' : '✗'} Autorisation photo
              </p>
            </div>
          </Section>

          {/* Parent 1 */}
          {(p1.nom || p1.prenom || p1.telephone) && (
            <Section icon={Phone} title={`Parent — ${LIEN_LABELS[p1.lien || ''] || p1.lien || 'Responsable légal'}`} color="text-blue-600" bg="bg-white" border="border-blue-100">
              <Row label="Nom complet" value={[p1.prenom, p1.nom].filter(Boolean).join(' ')} />
              <Row label="Lien" value={LIEN_LABELS[p1.lien || ''] || p1.lien} />
              <Row label="Téléphone" value={p1.telephone} />
              <Row label="WhatsApp" value={p1.whatsapp !== p1.telephone ? p1.whatsapp : null} />
              <Row label="Email" value={p1.email} />
              <Row label="Tél. domicile" value={p1.telDomicile} />
              <Row label="Tél. travail" value={p1.telTravail} />
              <Row label="Adresse" value={p1.adresse} />
            </Section>
          )}

          {/* Parent 2 */}
          {(p2.nom || p2.telephone) && (
            <Section icon={User} title={`Second parent — ${LIEN_LABELS[p2.lien || ''] || p2.lien || 'Conjoint(e)'}`} color="text-purple-600" bg="bg-white" border="border-purple-100">
              <Row label="Nom complet" value={[p2.prenom, p2.nom].filter(Boolean).join(' ')} />
              <Row label="Lien" value={LIEN_LABELS[p2.lien || ''] || p2.lien} />
              <Row label="Téléphone" value={p2.telephone} />
              <Row label="Tél. domicile" value={p2.telDomicile} />
              <Row label="Tél. travail" value={p2.telTravail} />
            </Section>
          )}

          {/* Contact urgence */}
          {urg.nom && (
            <Section icon={Shield} title="Contact d'urgence" color="text-red-600" bg="bg-white" border="border-red-100">
              <Row label="Nom" value={urg.nom} />
              <Row label="Téléphone" value={urg.telephone} />
              <Row label="Lien" value={urg.lien} />
            </Section>
          )}

          {/* Notes */}
          {eleve.notes && (
            <Section icon={Info} title="Notes" color="text-gray-500" bg="bg-white" border="border-gray-100">
              <p className="text-sm text-gray-600">{eleve.notes}</p>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Liste principale ─────────────────────────────────────────────────────────

const MesEnfants: React.FC<Props> = ({ enfants, onSelect }) => {
  const [selected, setSelected] = useState<Eleve | null>(null);
  const [detail, setDetail]     = useState<Eleve | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openDetail = async (e: Eleve, grad: string) => {
    setLoadingId(e.id);
    try {
      // On charge le dossier complet depuis le backend
      const full = await apiClient.get(`/parent/enfants/${e.id}`);
      setDetail(full as Eleve);
      setSelected(e);
    } catch {
      // Fallback : on utilise les données déjà chargées
      setDetail(e);
      setSelected(e);
    } finally {
      setLoadingId(null);
    }
  };

  if (!enfants.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-3xl bg-amber-50 flex items-center justify-center mb-6">
        <Baby className="w-12 h-12 text-amber-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">Aucun enfant associé</h3>
      <p className="text-gray-400 max-w-xs">Contactez l'administration de l'école pour lier vos enfants à ce compte.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-6 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Mes enfants</h2>
          <p className="text-gray-500 mt-1">{enfants.length} enfant{enfants.length > 1 ? 's' : ''}</p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {enfants.map((e, i) => {
            const stat = STATUT_CFG[e.statut] || { label: e.statut, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
            const grad = GRADIENTS[i % GRADIENTS.length];
            const isLoading = loadingId === e.id;
            return (
              <div key={e.id} onClick={() => openDetail(e, grad)}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer group">

                {/* Bande couleur */}
                <div className={`h-2 bg-gradient-to-r ${grad}`} />

                <div className="p-6">
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      {e.photoUrl
                        ? <img src={e.photoUrl} alt={e.prenom} className="w-full h-full object-cover rounded-2xl" />
                        : <span className="text-3xl font-black text-white">{e.prenom[0]}{e.nom[0]}</span>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-xl font-black text-gray-900">{e.prenom} {e.nom}</h3>
                          {e.classe
                            ? <p className="text-sm text-gray-500 mt-0.5">{e.classe.nom}</p>
                            : <p className="text-sm text-gray-400 mt-0.5">{NIVEAUX[e.niveau] || e.niveau}</p>
                          }
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${stat.cls}`}>
                          {stat.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-sm mb-4">
                        {e.dateNaissance && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span>{new Date(e.dateNaissance).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                        {e.classe && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <span>{NIVEAUX[e.niveau] || e.niveau}</span>
                          </div>
                        )}
                      </div>

                      {/* Options + CTA */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {e.cantine && (
                            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                              <Utensils className="w-3.5 h-3.5" /> Cantine
                            </span>
                          )}
                          {e.transportBus && (
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                              <Bus className="w-3.5 h-3.5" /> Bus
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 group-hover:text-amber-600 transition">
                          {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><span>Voir le dossier</span><ChevronRight className="w-4 h-4" /></>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal détail */}
      {detail && selected && (
        <EleveDetailModal
          eleve={detail}
          grad={GRADIENTS[enfants.findIndex(e => e.id === selected.id) % GRADIENTS.length]}
          onClose={() => { setDetail(null); setSelected(null); }}
        />
      )}
    </>
  );
};

export default MesEnfants;
