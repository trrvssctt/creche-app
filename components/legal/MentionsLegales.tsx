
import React from 'react';
import { ArrowLeft, FileText, Globe, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import logo_removebg from '../../assets/logo_gestockpro-removebg-preview.png';

interface MentionsLegalesProps {
  onBack: () => void;
}

const MentionsLegales: React.FC<MentionsLegalesProps> = ({ onBack }) => {
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
              <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">Document légal</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Mentions Légales</h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm">
            Dernière mise à jour : Mars 2026 — Conformément aux obligations légales applicables
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-14">

        {/* Section 1 - Éditeur */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">1</span>
            Éditeur du Service
          </h2>
          <div className="bg-slate-50 rounded-3xl p-8 space-y-4">
            <div className="flex items-start gap-4">
              <img src={logo_removebg} alt="GeStockPro" className="h-10 w-auto mt-1" />
              <div>
                <p className="font-black text-slate-900 text-lg uppercase tracking-tight">GeStockPro</p>
                <p className="text-slate-500 text-sm font-medium">Plateforme SaaS ERP pour TPE/PME Africaines</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3 text-slate-600">
                <MapPin size={16} className="text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium">Dakar, Sénégal</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Mail size={16} className="text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium">diankaseydou52@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={16} className="text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium">+221 78 131 13 71</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Globe size={16} className="text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium">gestock.pro</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 - Directeur de publication */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">2</span>
            Directeur de Publication
          </h2>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed">
              Le directeur de la publication de la plateforme GeStockPro est <strong className="text-slate-900">Seydou Dianka</strong>,
              fondateur et dirigeant de GeStockPro, joignable à l'adresse email :
              <a href="mailto:diankaseydou52@gmail.com" className="text-indigo-600 font-bold ml-1">diankaseydou52@gmail.com</a>.
            </p>
          </div>
        </section>

        {/* Section 3 - Hébergement */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">3</span>
            Hébergement
          </h2>
          <div className="bg-slate-50 rounded-3xl p-8 space-y-4">
            <p className="text-slate-700 font-medium leading-relaxed">
              La plateforme GeStockPro est hébergée sur une infrastructure cloud géo-redondante
              répartie sur plusieurs zones géographiques, garantissant un SLA de disponibilité de 99,9%.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Infrastructure</p>
                <p className="font-bold text-slate-900">Cloud Multi-Zone Géo-Redondant</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Sécurité</p>
                <p className="font-bold text-slate-900">Certifié ISO 27001</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Disponibilité</p>
                <p className="font-bold text-slate-900">SLA 99,9% garanti</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Sauvegarde</p>
                <p className="font-bold text-slate-900">Toutes les heures, 30 jours de rétention</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 - Propriété intellectuelle */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">4</span>
            Propriété Intellectuelle
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-3xl p-8">
              <p className="text-slate-700 font-medium leading-relaxed mb-4">
                L'ensemble des éléments constituant la plateforme GeStockPro (textes, graphiques, logiciels,
                base de données, marques, logos, interfaces, code source) sont la propriété exclusive de
                GeStockPro et sont protégés par les dispositions du droit sénégalais et international relatif
                à la propriété intellectuelle.
              </p>
              <p className="text-slate-700 font-medium leading-relaxed mb-4">
                Toute reproduction, représentation, diffusion ou utilisation, même partielle, de ces éléments
                sans autorisation expresse et préalable de GeStockPro est strictement interdite et constitue
                une contrefaçon sanctionnée par les textes en vigueur.
              </p>
              <p className="text-slate-700 font-medium leading-relaxed">
                Les données des utilisateurs et les données métier générées dans la plateforme demeurent
                la propriété exclusive du client (locataire / tenant). GeStockPro ne revendique aucun droit
                de propriété sur ces données.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 - Responsabilité */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">5</span>
            Limitation de Responsabilité
          </h2>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              GeStockPro s'engage à mettre en œuvre tous les moyens nécessaires pour assurer la disponibilité
              et la sécurité de la plateforme. Cependant, GeStockPro ne saurait être tenu responsable :
            </p>
            <ul className="space-y-3 text-slate-700 font-medium">
              {[
                "Des interruptions de service dues à des opérations de maintenance planifiées ou à des événements de force majeure ;",
                "Des dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service ;",
                "Des pertes de données imputables à une utilisation incorrecte du service par l'utilisateur ;",
                "Des décisions commerciales prises par l'utilisateur sur la base des informations fournies par la plateforme."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 6 - Droit applicable */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">6</span>
            Droit Applicable & Juridiction
          </h2>
          <div className="bg-slate-50 rounded-3xl p-8">
            <p className="text-slate-700 font-medium leading-relaxed mb-4">
              Les présentes mentions légales sont régies par le droit sénégalais et les dispositions du droit
              OHADA (Organisation pour l'Harmonisation en Afrique du Droit des Affaires), ainsi que par les
              exigences du Règlement Général sur la Protection des Données (RGPD) de l'Union Européenne
              pour les utilisateurs européens.
            </p>
            <p className="text-slate-700 font-medium leading-relaxed">
              En cas de litige, les parties s'engagent à chercher une solution amiable. À défaut, tout litige
              sera soumis aux tribunaux compétents de Dakar, Sénégal.
            </p>
          </div>
        </section>

        {/* Section 7 - Contact */}
        <section>
          <div className="bg-indigo-600 rounded-3xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck size={24} />
              <h2 className="text-lg font-black uppercase tracking-tight">Contact & Signalement</h2>
            </div>
            <p className="text-indigo-100 font-medium mb-6">
              Pour toute question relative à ces mentions légales ou pour signaler un abus,
              contactez-nous directement :
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
        </section>

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

export default MentionsLegales;
