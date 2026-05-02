
import React, { useState } from 'react';
import { ArrowLeft, FileText, Users, CreditCard, ShieldAlert, CheckCircle2, Mail, Phone, ChevronDown, ChevronUp, Zap, Lock } from 'lucide-react';

interface CGUProps {
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

const CGU: React.FC<CGUProps> = ({ onBack }) => {
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
              <FileText size={28} />
            </div>
            <div>
              <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">Contrat d'utilisation</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Conditions Générales d'Utilisation</h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm">
            Dernière mise à jour : Mars 2026 — Régies par le droit sénégalais, les normes OHADA et les standards SaaS internationaux.
          </p>
        </div>
      </div>

      {/* Résumé des points clés */}
      <div className="bg-amber-50 border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">Points essentiels à retenir</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: <CheckCircle2 size={16} />, text: "Essai gratuit 14 jours, sans engagement, sans carte bancaire" },
              { icon: <CheckCircle2 size={16} />, text: "Résiliation possible à tout moment avec préavis de 30 jours" },
              { icon: <CheckCircle2 size={16} />, text: "Vos données vous appartiennent et sont exportables à tout moment" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-800 font-medium text-sm">
                <span className="text-amber-600 flex-shrink-0 mt-0.5">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-14">

        <Section num="1" title="Objet & Acceptation" icon={<FileText size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la
              plateforme SaaS <strong className="text-slate-900">GeStockPro</strong>, éditée par GeStockPro,
              dont le siège social est à Dakar, Sénégal.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              En créant un compte ou en utilisant le service GeStockPro, vous acceptez sans réserve les
              présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed">
              Ces CGU constituent un contrat juridiquement contraignant entre vous (l'Utilisateur ou le
              Représentant de l'Entreprise Cliente) et GeStockPro.
            </p>
          </div>
        </Section>

        <Section num="2" title="Description du Service" icon={<Zap size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <p className="text-slate-700 font-medium leading-relaxed mb-6">
                GeStockPro est une plateforme ERP (Enterprise Resource Planning) cloud en mode SaaS (Software as a Service)
                spécialement conçue pour les TPE/PME africaines. Le service comprend notamment :
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "Gestion des stocks & inventaires avec alertes IA",
                  "CRM Clients (historique, segmentation, recommandations IA)",
                  "Gestion commerciale (ventes, facturation, services)",
                  "Trésorerie & paiements (Stripe, Mobile Money : Orange Money, Wave)",
                  "Sécurité & gouvernance RBAC multi-rôles",
                  "Tableaux de bord analytiques IA prédictifs",
                  "Module RH complet — Plan Enterprise (CDI, CDD, paie, congés)",
                  "Support client dédié et formations",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-white rounded-2xl border border-slate-100">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    <span className="text-slate-700 font-medium text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 font-medium text-sm mt-4">
                GeStockPro se réserve le droit de faire évoluer, améliorer ou modifier les fonctionnalités
                du service. Les évolutions significatives seront notifiées aux utilisateurs avec un préavis de 30 jours.
              </p>
            </div>
          </div>
        </Section>

        <Section num="3" title="Inscription & Compte Utilisateur" icon={<Users size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Conditions d'éligibilité</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "Être une personne physique majeure (18 ans ou plus) ou une personne morale légalement constituée ;",
                  "Disposer d'un email valide et d'un numéro de téléphone ;",
                  "Utiliser le service dans un cadre professionnel ou commercial légal ;",
                  "Ne pas être soumis à des sanctions économiques ou embargos internationaux."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Responsabilités du titulaire du compte</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "Fournir des informations exactes, complètes et à jour lors de l'inscription ;",
                  "Maintenir la confidentialité de vos identifiants de connexion ;",
                  "Notifier immédiatement GeStockPro de toute utilisation non autorisée de votre compte ;",
                  "Être responsable de toutes les actions effectuées via votre compte et ceux de vos utilisateurs (collaborateurs) ;",
                  "Nommer un Administrateur principal responsable de la gestion du compte tenant."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="4" title="Plans & Tarification" icon={<CreditCard size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4 pr-6">Plan</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4 pr-6">Public cible</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 text-xs pb-4">Facturation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { plan: "Starter", cible: "Auto-entrepreneurs, très petites structures", facturation: "Mensuelle ou annuelle" },
                      { plan: "Pro", cible: "PME en croissance, équipes de 5 à 50 personnes", facturation: "Mensuelle ou annuelle" },
                      { plan: "Enterprise", cible: "Grandes PME, multi-sites, avec module RH", facturation: "Annuelle uniquement" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-4 pr-6 font-black text-indigo-600">{row.plan}</td>
                        <td className="py-4 pr-6 text-slate-600 font-medium">{row.cible}</td>
                        <td className="py-4 text-slate-500 font-medium">{row.facturation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Conditions de paiement</h3>
              <ul className="space-y-3 text-slate-700 font-medium text-sm">
                {[
                  "Essai gratuit de 14 jours sans carte bancaire ni engagement pour les plans Starter et Pro ;",
                  "Le paiement est dû à la souscription de l'abonnement, en F CFA ou en devise internationale via Stripe ;",
                  "Modes de paiement acceptés : Carte bancaire (Visa, Mastercard via Stripe), Orange Money, Wave, Free Money ;",
                  "Les prix sont indiqués hors taxes. La TVA applicable selon la législation en vigueur peut s'ajouter ;",
                  "En cas de défaut de paiement, GeStockPro se réserve le droit de suspendre l'accès après un préavis de 7 jours ;",
                  "Aucun remboursement ne sera effectué pour les périodes d'abonnement entamées, sauf défaillance du service imputable à GeStockPro."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="5" title="Utilisation Acceptable du Service" icon={<CheckCircle2 size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-emerald-600 mb-4">Utilisations autorisées</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "Gestion de votre activité commerciale légale dans le respect des lois applicables ;",
                  "Ajout de collaborateurs (utilisateurs) dans les limites de votre plan d'abonnement ;",
                  "Exportation de vos propres données métier (inventaires, factures, rapports) ;",
                  "Intégration de solutions tierces via les API documentées de GeStockPro."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-rose-600 mb-4">Utilisations strictement interdites</h3>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "Utiliser GeStockPro pour des activités illégales, frauduleuses ou contraires à l'ordre public ;",
                  "Tenter d'accéder aux données d'autres tenants ou de contourner les mécanismes de sécurité ;",
                  "Effectuer des tests de pénétration ou des attaques sur l'infrastructure sans autorisation écrite préalable ;",
                  "Revendre, sous-licencier ou redistribuer l'accès à la plateforme à des tiers non autorisés ;",
                  "Automatiser des accès à la plateforme de manière à surcharger les serveurs (scraping massif, DDoS) ;",
                  "Introduire des virus, malwares ou tout code malveillant dans le système ;",
                  "Usurper l'identité d'autres utilisateurs ou de GeStockPro."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="6" title="Niveaux de Service (SLA)" icon={<Zap size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              {[
                { metric: "99,9%", label: "Disponibilité garantie", detail: "Hors maintenance planifiée" },
                { metric: "<200ms", label: "Temps de réponse", detail: "Temps de chargement cible" },
                { metric: "24h", label: "Délai d'activation", detail: "Après inscription complète" },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white rounded-2xl border border-slate-100">
                  <p className="text-3xl font-black text-indigo-600 mb-1">{item.metric}</p>
                  <p className="font-black uppercase text-xs tracking-widest text-slate-900 mb-1">{item.label}</p>
                  <p className="text-slate-400 text-xs font-medium">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-700 font-medium text-sm leading-relaxed">
              En cas de défaillance de service (disponibilité inférieure à 99,9% sur un mois civil),
              GeStockPro accordera un crédit de service proportionnel à l'interruption, sur demande
              adressée dans les 30 jours suivant l'incident. Les maintenances planifiées (notifiées
              48h à l'avance) sont exclues du calcul du SLA.
            </p>
          </div>
        </Section>

        <Section num="7" title="Propriété des Données & Confidentialité" icon={<Lock size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <p className="text-slate-700 font-medium leading-relaxed mb-4">
                <strong className="text-slate-900">Vos données vous appartiennent intégralement.</strong> GeStockPro agit en tant
                que sous-traitant de vos données métier (au sens de l'Art. 28 RGPD) et ne peut les utiliser
                qu'aux fins de fourniture du service.
              </p>
              <ul className="space-y-3 text-slate-700 font-medium text-sm">
                {[
                  "Exportation de vos données disponible à tout moment (CSV, PDF, JSON) depuis votre espace client ;",
                  "En cas de résiliation, vos données sont disponibles 30 jours après la date de clôture avant suppression définitive ;",
                  "Aucune analyse de vos données à des fins de revente ou de profilage commercial de tiers ;",
                  "Les données utilisées pour l'entraînement des modèles IA sont anonymisées et agrégées."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="8" title="Résiliation" icon={<ShieldAlert size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Résiliation par le Client</h3>
              <p className="text-slate-700 font-medium text-sm leading-relaxed mb-3">
                Vous pouvez résilier votre abonnement à tout moment depuis votre espace de gestion,
                avec un préavis de <strong>30 jours</strong> avant la prochaine échéance de facturation.
                Après résiliation :
              </p>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "L'accès au service est maintenu jusqu'à la fin de la période d'abonnement payée ;",
                  "Vos données restent accessibles en lecture seule pendant 30 jours ;",
                  "Après 30 jours, les données sont définitivement et irréversiblement supprimées ;",
                  "Aucun remboursement prorata pour la période restante d'un abonnement annuel, sauf défaillance de service."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-rose-600 mb-4">Résiliation par GeStockPro</h3>
              <p className="text-slate-700 font-medium text-sm leading-relaxed mb-3">
                GeStockPro peut résilier ou suspendre votre accès immédiatement en cas de :
              </p>
              <ul className="space-y-2 text-slate-700 font-medium text-sm">
                {[
                  "Violation grave des présentes CGU (notamment les utilisations interdites) ;",
                  "Non-paiement persistant après deux relances et préavis de 7 jours ;",
                  "Activités illégales ou frauduleuses avérées ;",
                  "Décision judiciaire ou obligation légale."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section num="9" title="Limitation de Responsabilité" icon={<ShieldAlert size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              Dans les limites permises par la loi, la responsabilité totale de GeStockPro envers vous
              ne pourra excéder le montant des sommes versées par vous au cours des 12 derniers mois
              précédant l'événement donnant lieu à la réclamation.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              GeStockPro n'est pas responsable des dommages indirects, consécutifs, perte de bénéfices,
              perte de données (au-delà des engagements de sauvegarde), préjudice commercial ou d'image,
              résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed">
              GeStockPro n'est pas responsable des décisions de gestion prises par l'utilisateur sur la
              base des informations, analyses ou recommandations IA fournies par la plateforme. Ces
              outils sont des aides à la décision et ne remplacent pas le jugement professionnel.
            </p>
          </div>
        </Section>

        <Section num="10" title="Modifications des CGU" icon={<FileText size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              GeStockPro se réserve le droit de modifier les présentes CGU. En cas de modification
              substantielle, vous serez notifié par email et/ou via la plateforme avec un préavis
              minimum de <strong>30 jours</strong>.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed">
              Si vous n'acceptez pas les nouvelles conditions, vous avez le droit de résilier votre
              abonnement sans pénalité avant l'entrée en vigueur des nouvelles CGU. La poursuite
              de l'utilisation du service après la date d'entrée en vigueur vaut acceptation des
              nouvelles conditions.
            </p>
          </div>
        </Section>

        <Section num="11" title="Droit Applicable & Litiges" icon={<FileText size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              Les présentes CGU sont régies par le droit sénégalais et les actes uniformes OHADA
              applicables. Pour les utilisateurs de l'Union Européenne, les dispositions impératives
              du droit européen de la consommation et de la protection des données (RGPD) s'appliquent
              également.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              En cas de litige, les parties s'engagent à tenter de résoudre le différend à l'amiable
              dans un délai de 30 jours. À défaut, tout litige sera soumis à la compétence exclusive
              des tribunaux de Dakar, Sénégal, sauf disposition légale contraire applicable
              à un utilisateur consommateur.
            </p>
          </div>
        </Section>

        {/* Contact */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Mail size={24} />
            <h2 className="text-lg font-black uppercase tracking-tight">Questions & Support</h2>
          </div>
          <p className="text-indigo-100 font-medium mb-6">
            Pour toute question relative aux présentes CGU ou à votre abonnement :
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

export default CGU;
