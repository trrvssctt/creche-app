
import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, Eye, Database, Lock, UserCheck, Globe, Mail, Phone, ChevronDown, ChevronUp } from 'lucide-react';

interface PolitiqueConfidentialiteProps {
  onBack: () => void;
}

const Section: React.FC<{ num: string; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ num, title, icon, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 mb-4 text-left group"
      >
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
          <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0">{num}</span>
          <span className="flex items-center gap-2">{icon}{title}</span>
        </h2>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && <div>{children}</div>}
    </section>
  );
};

const PolitiqueConfidentialite: React.FC<PolitiqueConfidentialiteProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 text-xs font-black uppercase tracking-widest"
          >
            <ArrowLeft size={16} /> Retour à l'accueil
          </button>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">RGPD & Protection des données</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Politique de Confidentialité</h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm">
            Dernière mise à jour : Mars 2026 — Conformément au RGPD (UE 2016/679), à la loi sénégalaise sur la protection des données personnelles et aux normes OHADA.
          </p>
        </div>
      </div>

      {/* Résumé RGPD */}
      <div className="bg-indigo-50 border-b border-indigo-100">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: <Lock size={20} />, title: "Chiffrement AES-256", desc: "Toutes vos données sont chiffrées en transit et au repos" },
              { icon: <Database size={20} />, title: "Données isolées", desc: "Architecture multi-tenant : vos données sont strictement isolées" },
              { icon: <UserCheck size={20} />, title: "Vos droits RGPD", desc: "Accès, rectification, effacement et portabilité garantis" }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{item.title}</p>
                  <p className="text-slate-500 text-xs font-medium mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-14">

        <Section num="1" title="Identité du Responsable de Traitement" icon={<UserCheck size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8 space-y-3">
            <p className="text-slate-700 font-medium leading-relaxed">
              Le responsable du traitement de vos données personnelles est :
            </p>
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Entité</p>
                <p className="font-bold text-slate-900">GeStockPro</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Représentant légal</p>
                <p className="font-bold text-slate-900">Seydou Dianka</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Email DPO</p>
                <p className="font-bold text-slate-900">diankaseydou52@gmail.com</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Siège</p>
                <p className="font-bold text-slate-900">Dakar, Sénégal</p>
              </div>
            </div>
          </div>
        </Section>

        <Section num="2" title="Données Collectées" icon={<Database size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">A — Données d'identification et de compte</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {["Nom complet et prénom", "Adresse email professionnelle", "Numéro de téléphone", "Nom de l'entreprise / raison sociale", "Pays et ville de résidence"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">B — Données de facturation et de paiement</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {["Informations de facturation (adresse, entreprise)", "Référence des transactions de paiement (Stripe, Mobile Money)", "Historique des abonnements et des plans", "Aucune donnée de carte bancaire complète n'est stockée par GeStockPro (déléguée à Stripe PCI-DSS)"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">C — Données métier (données du tenant)</h3>
              <p className="text-slate-700 font-medium text-sm mb-3">
                Ces données appartiennent exclusivement au client (tenant) et sont traitées pour compte de tiers :
              </p>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {["Produits, stocks et mouvements d'inventaire", "Données clients et fournisseurs", "Factures, commandes et transactions commerciales", "Données RH (employés, contrats, fiches de paie) — Plan Enterprise uniquement", "Données analytiques et tableaux de bord"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">D — Données techniques et de navigation</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {["Adresse IP (anonymisée après 30 jours)", "Journaux d'accès et d'audit (RBAC)", "Type de navigateur et système d'exploitation", "Données de session et tokens d'authentification (stockage sécurisé)"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full flex-shrink-0"></span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="3" title="Finalités & Bases Légales du Traitement" icon={<Eye size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4 pr-6">Finalité</th>
                  <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4 pr-6">Base légale (RGPD)</th>
                  <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4">Durée</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {[
                  { finalite: "Fourniture du service SaaS", base: "Exécution du contrat — Art. 6.1.b", duree: "Durée de l'abonnement + 1 an" },
                  { finalite: "Facturation & comptabilité", base: "Obligation légale — Art. 6.1.c", duree: "10 ans (obligations comptables)" },
                  { finalite: "Sécurité & journaux d'audit", base: "Intérêt légitime — Art. 6.1.f", duree: "12 mois glissants" },
                  { finalite: "Support client", base: "Exécution du contrat — Art. 6.1.b", duree: "3 ans après clôture du ticket" },
                  { finalite: "Communications marketing", base: "Consentement — Art. 6.1.a", duree: "Jusqu'au retrait du consentement" },
                  { finalite: "Amélioration du produit (données anonymisées)", base: "Intérêt légitime — Art. 6.1.f", duree: "Indéfinie (données anonymes)" },
                  { finalite: "Conformité légale (OHADA, fisc)", base: "Obligation légale — Art. 6.1.c", duree: "Selon obligations applicables" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-4 pr-6 font-bold text-slate-900">{row.finalite}</td>
                    <td className="py-4 pr-6 text-slate-600 font-medium">{row.base}</td>
                    <td className="py-4 text-slate-500 font-medium">{row.duree}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section num="4" title="Sécurité des Données" icon={<Lock size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <p className="text-slate-700 font-medium leading-relaxed mb-6">
                GeStockPro applique des mesures de sécurité de niveau bancaire pour protéger vos données :
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { title: "Chiffrement AES-256", desc: "Toutes les données sont chiffrées en transit (TLS 1.3) et au repos" },
                  { title: "Infrastructure ISO 27001", desc: "Certifiée selon les normes internationales de sécurité de l'information" },
                  { title: "Multi-tenant isolé", desc: "Isolation stricte des données entre tenants via RBAC et cloisonnement DB" },
                  { title: "Sauvegardes automatiques", desc: "Toutes les heures, conservées 30 jours sur 3 zones géographiques" },
                  { title: "Journaux d'audit complets", desc: "Toutes les actions sont tracées avec horodatage et identification" },
                  { title: "Authentification renforcée", desc: "Gestion des sessions sécurisée, expiration automatique des tokens" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Lock size={14} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{item.title}</p>
                      <p className="text-slate-500 text-xs font-medium mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section num="5" title="Transferts Internationaux de Données" icon={<Globe size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              GeStockPro peut utiliser des sous-traitants internationaux pour la fourniture du service :
            </p>
            <div className="space-y-3">
              {[
                { service: "Stripe", objet: "Paiement en ligne", localisation: "États-Unis (Conforme Privacy Shield / SCCs)", justif: "Contrat DPA signé" },
                { service: "Infrastructure Cloud", objet: "Hébergement des données", localisation: "Multi-zones (dont Afrique de l'Ouest)", justif: "Serveurs certifiés ISO 27001" },
                { service: "Google (Analytics anonymisé)", objet: "Mesure d'audience", localisation: "États-Unis", justif: "Anonymisation préalable" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100">
                  <span className="font-black text-slate-900 text-sm w-32 flex-shrink-0">{item.service}</span>
                  <span className="text-slate-500 text-xs font-medium flex-1">{item.objet} — {item.localisation}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg">{item.justif}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-600 font-medium text-sm mt-4">
              Tous les transferts de données hors UE sont encadrés par des Clauses Contractuelles Types (CCT)
              conformes à l'article 46 du RGPD ou des mécanismes équivalents reconnus.
            </p>
          </div>
        </Section>

        <Section num="6" title="Vos Droits (RGPD Art. 15 à 22)" icon={<UserCheck size={18} />}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { droit: "Droit d'accès", desc: "Obtenir une copie de toutes vos données personnelles traitées par GeStockPro", art: "Art. 15" },
                { droit: "Droit de rectification", desc: "Faire corriger des données inexactes ou incomplètes", art: "Art. 16" },
                { droit: "Droit à l'effacement", desc: "Demander la suppression de vos données (« droit à l'oubli »)", art: "Art. 17" },
                { droit: "Droit à la portabilité", desc: "Recevoir vos données dans un format structuré et lisible (CSV, JSON)", art: "Art. 20" },
                { droit: "Droit d'opposition", desc: "Vous opposer au traitement à des fins de marketing ou d'intérêt légitime", art: "Art. 21" },
                { droit: "Droit à la limitation", desc: "Suspendre le traitement dans certaines circonstances définies", art: "Art. 18" },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{item.droit}</p>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{item.art}</span>
                  </div>
                  <p className="text-slate-500 text-xs font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
              <p className="font-black text-amber-900 text-sm uppercase tracking-tight mb-2">Comment exercer vos droits ?</p>
              <p className="text-amber-800 font-medium text-sm leading-relaxed">
                Envoyez votre demande par email à <strong>diankaseydou52@gmail.com</strong> en indiquant
                votre identité et la nature de votre demande. Nous répondrons dans un délai maximum de
                <strong> 30 jours</strong> conformément au RGPD. Des pièces justificatives d'identité pourront être requises.
              </p>
            </div>
            <div className="bg-slate-50 rounded-3xl p-6">
              <p className="font-black text-slate-900 text-sm uppercase tracking-tight mb-2">Droit de recours</p>
              <p className="text-slate-700 font-medium text-sm leading-relaxed">
                Vous avez le droit d'introduire une réclamation auprès de l'autorité de contrôle compétente.
                Pour le Sénégal : <strong>Commission de Protection des Données Personnelles (CDP)</strong>.
                Pour les utilisateurs européens : votre autorité nationale de protection des données (ex. CNIL en France).
              </p>
            </div>
          </div>
        </Section>

        <Section num="7" title="Sous-traitants & Partage de Données" icon={<Database size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              GeStockPro ne vend jamais vos données personnelles à des tiers. Le partage est limité aux cas suivants :
            </p>
            <ul className="space-y-3 text-slate-700 font-medium text-sm">
              {[
                { cas: "Sous-traitants techniques", detail: "Hébergement, paiement, envoi d'emails — soumis à des DPA (Data Processing Agreements)" },
                { cas: "Obligations légales", detail: "Sur réquisition judiciaire ou obligation légale applicable au Sénégal" },
                { cas: "Protection des droits", detail: "En cas de fraude avérée ou d'atteinte aux droits de GeStockPro ou de tiers" },
                { cas: "Consentement explicite", detail: "Avec votre accord préalable exprès pour tout autre cas" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  <div>
                    <span className="font-black text-slate-900">{item.cas} : </span>
                    <span className="text-slate-600">{item.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section num="8" title="Violations de Données (Data Breach)" icon={<ShieldCheck size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              En cas de violation de données à caractère personnel susceptible d'engendrer un risque pour vos
              droits et libertés, GeStockPro s'engage à :
            </p>
            <ul className="space-y-3 text-slate-700 font-medium text-sm">
              {[
                "Notifier l'autorité de contrôle compétente dans un délai de 72 heures (Art. 33 RGPD) ;",
                "Vous informer sans délai injustifié si la violation est susceptible d'engendrer un risque élevé (Art. 34 RGPD) ;",
                "Documenter toutes les violations dans un registre interne ;",
                "Mettre en œuvre les mesures correctives nécessaires pour éviter la récurrence."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section num="9" title="Modifications de la Politique" icon={<Eye size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed">
              GeStockPro se réserve le droit de modifier la présente politique de confidentialité pour refléter
              les évolutions légales, réglementaires ou techniques. En cas de modification substantielle,
              nous vous informerons par email ou via une notification dans la plateforme avec un préavis
              minimum de 30 jours. La poursuite de l'utilisation du service après notification vaut
              acceptation des modifications.
            </p>
          </div>
        </Section>

        {/* Contact DPO */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={24} />
            <h2 className="text-lg font-black uppercase tracking-tight">Contacter notre DPO</h2>
          </div>
          <p className="text-indigo-100 font-medium mb-6">
            Pour toute question relative à la protection de vos données personnelles :
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:diankaseydou52@gmail.com" className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-xl font-bold text-sm">
              <Mail size={16} /> diankaseydou52@gmail.com
            </a>
            <a href="tel:+221781311371" className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-xl font-bold text-sm">
              <Phone size={16} /> +221 78 131 13 71
            </a>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            © 2024-2026 GeStockPro. Tous droits réservés.
          </p>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft size={14} /> Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolitiqueConfidentialite;
