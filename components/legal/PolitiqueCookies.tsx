
import React, { useState } from 'react';
import { ArrowLeft, Cookie, ShieldCheck, Settings, BarChart3, Lock, Mail, Phone, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface PolitiqueCookiesProps {
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

const PolitiqueCookies: React.FC<PolitiqueCookiesProps> = ({ onBack }) => {
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
              <Cookie size={28} />
            </div>
            <div>
              <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">Gestion des traceurs</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Politique de Cookies</h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm">
            Dernière mise à jour : Mars 2026 — Conformément à la directive ePrivacy (2002/58/CE) et au RGPD (UE 2016/679)
          </p>
        </div>
      </div>

      {/* Note importante */}
      <div className="bg-blue-50 border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-blue-900 text-sm uppercase tracking-tight mb-1">Ce que vous devez savoir</p>
              <p className="text-blue-800 font-medium text-sm">
                GeStockPro utilise un nombre minimal de cookies, strictement nécessaires au fonctionnement
                du service. Nous ne déposons pas de cookies publicitaires ou de tracking commercial sans
                votre consentement explicite.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-14">

        <Section num="1" title="Qu'est-ce qu'un Cookie ?" icon={<Cookie size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              Un cookie (ou traceur) est un petit fichier texte déposé sur votre appareil (ordinateur,
              tablette, smartphone) lors de votre visite sur notre plateforme. Il permet au service
              de mémoriser des informations vous concernant pour améliorer votre expérience.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed">
              Les cookies ne peuvent pas lire d'autres fichiers sur votre appareil et ne peuvent pas
              transmettre de virus. Ils servent uniquement aux fins décrites dans la présente politique.
            </p>
          </div>
        </Section>

        <Section num="2" title="Catégories de Cookies Utilisés" icon={<Settings size={18} />}>
          <div className="space-y-4">

            {/* Cookies essentiels */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase text-sm tracking-widest text-emerald-700">Cookies Essentiels / Strictement Nécessaires</h3>
                <span className="text-xs bg-emerald-600 text-white font-bold px-3 py-1 rounded-full">Toujours actifs</span>
              </div>
              <p className="text-slate-700 font-medium text-sm mb-4">
                Ces cookies sont indispensables au fonctionnement de la plateforme. Ils ne peuvent pas
                être désactivés. Sans eux, certaines fonctionnalités essentielles ne seraient pas disponibles.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-emerald-200">
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Nom</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Finalité</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { nom: "gestockpro_session", finalite: "Gestion de la session d'authentification sécurisée", duree: "Session (supprimé à la fermeture)" },
                      { nom: "gestockpro_csrf", finalite: "Protection contre les attaques CSRF (Cross-Site Request Forgery)", duree: "Session" },
                      { nom: "gestockpro_tenant", finalite: "Identification du tenant et isolation multi-tenant", duree: "30 jours (renouvelable)" },
                      { nom: "gestockpro_prefs", finalite: "Préférences d'interface (langue, devise, thème clair/sombre)", duree: "1 an" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-emerald-100 last:border-0">
                        <td className="py-3 pr-4 font-mono font-bold text-slate-800">{row.nom}</td>
                        <td className="py-3 pr-4 text-slate-600">{row.finalite}</td>
                        <td className="py-3 text-slate-500">{row.duree}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cookies de performance */}
            <div className="bg-slate-50 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600">Cookies de Performance & Analytics</h3>
                <span className="text-xs bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-full">Sur consentement</span>
              </div>
              <p className="text-slate-700 font-medium text-sm mb-4">
                Ces cookies nous permettent de mesurer l'audience et les performances de la plateforme
                afin de l'améliorer. Les données sont anonymisées et agrégées — aucun profil individuel n'est créé.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Service</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Finalité</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { service: "Analytics interne (anonymisé)", finalite: "Mesure des pages vues, parcours utilisateur, performance du service", duree: "30 jours" },
                      { service: "Logs de performance", finalite: "Détection des erreurs techniques et suivi du temps de réponse", duree: "90 jours" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4 font-bold text-slate-800">{row.service}</td>
                        <td className="py-3 pr-4 text-slate-600">{row.finalite}</td>
                        <td className="py-3 text-slate-500">{row.duree}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cookies tiers */}
            <div className="bg-slate-50 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600">Cookies Tiers (Paiement)</h3>
                <span className="text-xs bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-full">Fonctionnel</span>
              </div>
              <p className="text-slate-700 font-medium text-sm mb-4">
                Lors du processus de paiement, notre partenaire Stripe peut déposer des cookies nécessaires
                à la sécurisation des transactions financières.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Service</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3 pr-4">Finalité</th>
                      <th className="text-left font-black uppercase tracking-widest text-slate-400 pb-3">En savoir plus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 pr-4 font-bold text-slate-800">Stripe</td>
                      <td className="py-3 pr-4 text-slate-600">Sécurisation des paiements, prévention de la fraude, conformité PCI-DSS</td>
                      <td className="py-3">
                        <span className="text-indigo-600 font-bold text-xs">stripe.com/privacy</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cookies publicitaires */}
            <div className="bg-slate-50 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase text-sm tracking-widest text-slate-500">Cookies Publicitaires & Marketing</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full">Non utilisés</span>
              </div>
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-emerald-800 font-medium text-sm">
                  <strong>GeStockPro ne dépose aucun cookie publicitaire ou de ciblage marketing.</strong> Nous
                  ne partageons pas vos données avec des régies publicitaires et ne créons pas de profils
                  commerciaux basés sur votre navigation.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section num="3" title="Gestion de Vos Préférences" icon={<Settings size={18} />}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Via votre navigateur</h3>
              <p className="text-slate-700 font-medium text-sm leading-relaxed mb-4">
                Vous pouvez configurer votre navigateur pour accepter, refuser ou supprimer les cookies.
                Notez que la désactivation des cookies essentiels entraînera un dysfonctionnement du service :
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { nav: "Google Chrome", path: "Paramètres > Confidentialité et sécurité > Cookies" },
                  { nav: "Mozilla Firefox", path: "Options > Vie privée et sécurité > Cookies" },
                  { nav: "Safari", path: "Préférences > Confidentialité > Gérer les données" },
                  { nav: "Microsoft Edge", path: "Paramètres > Confidentialité > Cookies" },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-white rounded-2xl border border-slate-100">
                    <p className="font-black text-slate-900 text-sm">{item.nav}</p>
                    <p className="text-slate-500 text-xs font-medium mt-1">{item.path}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8">
              <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600 mb-4">Via votre espace GeStockPro</h3>
              <p className="text-slate-700 font-medium text-sm leading-relaxed">
                Une fois connecté, vous pouvez gérer vos préférences de cookies dans votre espace
                <strong> Paramètres &gt; Confidentialité</strong>. Vous pouvez à tout moment modifier
                ou retirer votre consentement pour les cookies non essentiels.
              </p>
            </div>
          </div>
        </Section>

        <Section num="4" title="Durée de Conservation & Sécurité" icon={<Lock size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              La durée de conservation de chaque cookie est indiquée dans le tableau de la section 2.
              En règle générale :
            </p>
            <ul className="space-y-3 text-slate-700 font-medium text-sm">
              {[
                "Les cookies de session sont supprimés dès la fermeture de votre navigateur ;",
                "Les cookies persistants expirent automatiquement à la date définie ;",
                "Vous pouvez les supprimer manuellement à tout moment via les paramètres de votre navigateur ;",
                "Les tokens d'authentification sont chiffrés (AES-256) et liés à votre adresse IP et User-Agent pour limiter les risques de vol de session."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section num="5" title="Mises à Jour de la Politique" icon={<BarChart3 size={18} />}>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed">
              GeStockPro se réserve le droit de modifier la présente politique de gestion des cookies
              pour s'adapter aux évolutions technologiques, légales ou réglementaires. Toute modification
              substantielle vous sera notifiée via la plateforme ou par email.
            </p>
          </div>
        </Section>

        {/* Contact */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Mail size={24} />
            <h2 className="text-lg font-black uppercase tracking-tight">Questions sur les Cookies</h2>
          </div>
          <p className="text-indigo-100 font-medium mb-6">
            Pour toute question sur notre utilisation des cookies ou pour exercer vos droits :
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

export default PolitiqueCookies;
