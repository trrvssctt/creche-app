# Plan d'adaptation — GeStock Pro → Plateforme Le Toit des Anges
> Dernière mise à jour : 2026-05-01

---

## Contexte

L'application **GeStock Pro** est un ERP complet (stock, ventes, RH, trésorerie). Le client **Le Toit des Anges** (crèche-maternelle-élémentaire, Dakar, Sénégal) veut utiliser cette base pour gérer intégralement son établissement scolaire : élèves, admissions, facturation, pédagogie, communication parents.

C'est une application dédiée à un client unique — il n'y a plus de notion d'abonnement, de plans tarifaires, ou de multi-tenant. Un seul établissement, un seul accès.

**Philosophie :** Ne pas recoder. Adapter, renommer, étendre.

---

## Tableau de correspondance général

| Module existant | Équivalent scolaire | Action |
|---|---|---|
| Customers | Élèves / Enfants | Adapté ✅ |
| Services/Prestations | Offres de scolarité (niveaux, forfaits) | Adapté ✅ |
| Categories | Catégories fournitures & matières scolaires | Conservé ✅ |
| Subcategories | Sous-catégories / Sous-matières | Conservé ✅ |
| Sales/Invoices | Facturation scolaire (inscription, mensualités) | Adapté ✅ |
| Payments | Paiements scolarité (caisse, mobile money…) | Conservé ✅ |
| Recovery | Recouvrement mensualités impayées | Conservé ✅ |
| Deliveries | Livraisons fournitures scolaires (livres…) | Conservé ✅ |
| HR Module complet | Gestion enseignants & personnel administratif | Conservé ✅ |
| Dashboard | Tableau de bord direction | Adapté ✅ |
| Settings | Configuration établissement | Adapté ✅ |
| Subscription / Plans / LandingPage | Hors périmètre — application client dédié | Supprimé ✅ |

---

## PHASE 1 — FONDATIONS ✅ TERMINÉE

### ✅ 1.1 types.ts
- Enum `UserRole` mis à jour : ADMIN, DIRECTEUR, ENSEIGNANT, MAITRESSE, COMPTABLE, ASSISTANTE, HR_MANAGER, EMPLOYEE
- Types SaaS supprimés : Tenant, SubscriptionPlan, SubscriptionPayment, Subscription
- Nouveaux types scolaires ajoutés : NiveauScolaire, RegimeFinancier, StatutAdmission, Trimestre, NiveauCompetence, Eleve, Classe, ContactParent, ContactUrgence, BulletinMaternelle, BulletinElementaire, EvenementEcole

### ✅ 1.2 authBridge.ts
- Logique PLAN_RULES entièrement supprimée
- Remplacée par ROLE_MODULES : accès par rôle uniquement
- ADMIN/DIRECTEUR : accès total sans restriction
- Rôles scolaires définis : ENSEIGNANT, MAITRESSE, COMPTABLE, ASSISTANTE, HR_MANAGER, EMPLOYEE

### ✅ 1.3 App.tsx
- Supprimé : LandingPage, Subscription, Checkout, OnboardingWizard, StripeRedirect, RegistrationSuccess, SuperAdmin, SuperAdminLogin
- Supprimé : tous les états SaaS (showLanding, showRegSuccess, showCheckout, showOnboarding, upgradeContext, activationPending, isTenantExpired, isTenantSuspended, currentPlan, currentTenant, resolvePlanId)
- Flux simplifié : isInitializing → Login → Dashboard
- Nouveau module `eleves` routé vers `Eleves.tsx`

### ✅ 1.4 constants.tsx
- Supprimé : MOCK_TENANTS, SUBSCRIPTION_PLANS, MOCK_SUBSCRIPTION, MOCK_CUSTOMERS (B2B)
- Mis à jour : MOCK_USERS avec rôles scolaires (Directrice, Enseignante, Comptable)
- Mis à jour : MOCK_EMPLOYEES, MOCK_STOCKS avec données de l'établissement

### ✅ 1.5 Layout.tsx
- Supprimé : menu 'superadmin', 'subscription'
- Renommés : 'Clients' → 'Élèves', 'Ventes & Factures' → 'Facturation', 'Catalogue Services' → 'Offres de Scolarité', 'Catalogue Stocks' → 'Stock Fournitures', etc.
- Supprimé : prop `isSuperAdminMode` et toutes ses conditionnelles

### ✅ 1.6 CategoryManager.tsx + SubcategoryManager.tsx
- Supprimé : prop `plan?: SubscriptionPlan`
- Supprimé : `isLimitReached` (limite trial 3 catégories)
- Bouton Créer toujours actif (plus de restrictions de plan)

### ✅ 1.7 components/Eleves.tsx (NOUVEAU)
- Module complet de gestion des élèves
- KPIs : élèves actifs, en attente, cas sociaux, besoins spécifiques
- Vue carte + vue liste avec filtres (niveau, statut, régime)
- Fiche élève complète : matricule auto-généré, niveau scolaire, régime financier, remise, cantine, transport bus, besoins spécifiques, parent principal, contacts d'urgence
- Modal Créer / Modifier / Voir
- Contrôle d'accès par rôle (canModify, canDelete)

---

## PHASE 2 — FINANCE & COMMUNICATION ✅ TERMINÉE

### ✅ 2.1 Services.tsx → Offres de Scolarité (2026-05-01)
- Migration SQL : colonnes `type_offre`, `niveaux_cibles`, `duree_mois`, `inclut_cantine`, `frais_inscription` sur table `services`
- Catalogue par type d'offre (INSCRIPTION, MENSUALITE, REINSCRIPTION, BUS, CANTINE, ACTIVITE)
- Sélecteur multi-niveaux scolaires (CRECHE → CM2)
- Badges visuels type d'offre sur les cartes
- Fiche détail enrichie avec caractéristiques scolaires

### ✅ 2.2 Sales.tsx → Facturation Scolaire (2026-05-01)
- Renommages : "Registre des Ventes" → "Facturation Scolaire", "CRÉER UNE VENTE" → "NOUVELLE FACTURE"
- Labels : "Client" → "Élève / Payeur", "Vente directe" → "Paiement direct", etc.
- Suppression des restrictions plan (isLimitReached, plan checks)
- Correction bug type `tenantSettings?: any?:` → `any`

### ✅ 2.3 Dashboard → Métriques scolaires (2026-05-01)
- Section "Tableau de bord scolaire — Le Toit des Anges" en tête de dashboard
- KPIs : Élèves actifs, Facturé ce mois, Taux de recouvrement mensuel (%), Prévisionnel annuel
- Renommages StatCards : "Clients" → "Élèves inscrits", "Créances Clients" → "Mensualités Impayées"
- Import icônes scolaires (GraduationCap, Baby, BookOpen, Bus)

### ✅ 2.4 Settings.tsx → Configuration Établissement (2026-05-01)
- Titre : "Personnalisation Instance" → "Configuration Établissement"
- Onglet "Établissement" : nom, email, téléphone, adresse, **numéro WhatsApp Business**
- Onglet "Design & Branding" : inchangé (couleurs, polices, logo, cachet officiel)
- Onglet "Scolarité" (NOUVEAU) — persisté en `localStorage` (`tda_school_config`) :
  - Libellé + dates début/fin de l'année scolaire + nombre de mois (défaut 10)
  - Jour limite de paiement des mensualités (défaut : 5 du mois suivant)
  - Dates des 3 trimestres (T1 : Décembre, T2 : Mars, T3 : Juin)
  - Pénalité retard paiement : 2 000 FCFA/jour (configurable)
  - Pénalité retard de garde : 2 500 FCFA/heure (configurable)
  - Frais d'inscription par niveau : Crèche → CM2 (défaut 85 000 FCFA)
- Onglet "Reçus & Finances" : devise, taux taxe, préfixe reçu, pied de page
- Onglet "Sécurité" : changement mdp, MFA, registre de connexion
- Supprimé : SIRET, "Isolation Multi-Tenant", "Moteur Factur-X", Zone Dangereuse (désactivation/suppression compte)

### ✅ 2.5 WhatsApp.tsx — Module Communication (2026-05-01)
- 7 modèles de messages : Reçu provisoire, Reçu définitif, Facture mensuelle, Relance, Bulletin, Admission confirmée, Retard de garde
- Modèles éditables, persistés en localStorage, prévisualisation avec données exemple
- Onglet Envoyer : sélection élève + modèle → variables pré-remplies auto → aperçu style WhatsApp → lien wa.me
- Onglet Envoi groupé : filtre niveau + variables communes → génération de liens pour tous les élèves actifs
- Onglet Historique : log localStorage des envois (200 entrées max)
- KPIs : modèles configurés, envois total/jour, parents avec numéro
- Accès : ADMIN/DIRECTEUR/COMPTABLE (envoi complet) ; ASSISTANTE (accès mais canPerform=false)
- Intégré dans Layout.tsx (menu "WhatsApp") et App.tsx (route 'whatsapp')
- authBridge.ts mis à jour : `whatsapp` ajouté dans ALL_MODULES, COMPTABLE et ASSISTANTE

### ✅ 2.6 Certificats.tsx — Documents officiels (2026-05-01)
- 4 types de documents : Certificat de scolarité, Certificat de radiation, Autorisation de sortie scolaire, Fiche sanitaire de liaison
- Sélection élève → pré-remplissage automatique depuis la fiche (nom, niveau, parent, contacts d'urgence)
- Champs complémentaires contextuels : motif (radiation), destination + date (sortie scolaire)
- Prévisualisation en temps réel avec mise en page officielle (en-tête République du Sénégal, tampon Directrice)
- Impression native `window.print()` + export PDF via navigateur, styles `@media print` dédiés
- Numéro de référence auto-généré (CS-XXXXX, CR-XXXXX, AS-XXXXX, FS-XXXXX)
- Onglet Historique : log localStorage des émissions (300 entrées max)
- Accès : ADMIN/DIRECTEUR/ENSEIGNANT/MAITRESSE/COMPTABLE ; ASSISTANTE lecture seule
- Intégré dans Layout.tsx (menu "Certificats") et App.tsx (route 'certificats')

### ✅ 2.7 Admission.tsx — Nouveau module (2026-05-01)
- Module complet : liste, création, vue détail, changement de statut
- KPIs : total dossiers, en attente, admis, actifs, nouveaux du jour
- Formulaire : identité enfant, niveau scolaire, régime financier, cantine/bus, parent légal
- Workflow statut : EN_ATTENTE → ADMIS → ACTIF → SUSPENDU/RADIE
- Ajouté dans Layout.tsx (menu "Admissions") et App.tsx (route 'admission')

---

## PHASE 3 — PÉDAGOGIE ✅ TERMINÉE

### ✅ 3.1 Bulletins.tsx — Module Bulletins Scolaires (2026-05-01)
- Module unifié Maternelle + Élémentaire détecté automatiquement par niveau
- **Crèche / PS / MS / GS** : évaluation par domaines (Motricité, Langage, Cognitif, Social, Artistique...)
  - Grille de compétences spécifique à chaque niveau (CRECHE / PS / MS / GS)
  - Boutons A / EC / NA par compétence
  - Barre de progression globale (% acquis)
- **CP → CM2** : bulletin de notes avec coefficients
  - Matières adaptées par niveau (CP, CE1/CE2, CM1/CM2)
  - Sous-matières avec coefficient → note /20 → moyenne matière auto-calculée
  - Moyenne générale pondérée auto-calculée
  - Appréciation générée automatiquement (Excellent / Très bien / Bien / Passable / Insuffisant)
- KPIs : élèves concernés, bulletins publiés, brouillons, à faire
- Workflow : Brouillon → Publier & Notifier (mock WhatsApp)
- Impression native (window.print + styles dédiés)
- Contrôle d'accès : ENSEIGNANT/MAITRESSE/DIRECTEUR peuvent modifier
- Ajouté dans Layout.tsx (menu "Bulletins") et App.tsx (route 'bulletins')

### ✅ 3.2 EmploiDuTemps.tsx — Emploi du temps & Cahier de texte (2026-05-01)
- **Emploi du temps** : grille hebdomadaire Lun–Ven par niveau (Crèche → CM2)
- Créneaux configurables : jour, heure début/fin, matière, enseignant, couleur
- Sélecteur de matières pré-défini par niveau, couleur par défaut personnalisable
- Persistance localStorage par niveau (`edt_creneaux`)
- **Cahier de texte** : vue semaine par niveau, navigation semaine ±7 jours
- Entrées : date, matière, contenu du cours, devoirs, auteur
- Résumé hebdomadaire (total entrées, entrées avec devoirs)
- Accès en écriture : ENSEIGNANT, MAITRESSE, DIRECTEUR, ADMIN
- Accès en lecture : tous les rôles (ASSISTANTE incluse)
- Intégré dans Layout.tsx (menu "Emploi du Temps") et App.tsx (route 'emploidutemps')

### ✅ 3.3 Evenements.tsx — Événements & Communication (2026-05-01)
- 6 types d'événements : Sortie scolaire, Réunion parents-profs, Fête/Spectacle, Évaluation, Fermeture, Information
- Vue liste avec filtres (type, statut, niveau) + Vue calendrier mensuel interactif
- Workflow : BROUILLON → PUBLIE → ANNULE
- Diffusion WhatsApp : modal avec liste parents (élèves actifs selon niveaux ciblés), liens wa.me pré-remplis, marquage "diffusé"
- Message WhatsApp auto-construit avec emoji type, titre, date(s), heure(s), lieu, niveaux, description
- Niveaux cibles multi-sélection (Tous ou combinaison de niveaux)
- KPIs : total, à venir, publiés, diffusés WhatsApp
- Accès en écriture : ADMIN, DIRECTEUR, ENSEIGNANT, MAITRESSE ; lecture : ASSISTANTE, COMPTABLE
- Intégré dans Layout.tsx (menu "Événements") et App.tsx (route 'evenements')

---

## PHASE 4 — CONFORT & EXPANSION 🔄 À FAIRE

### 4.1 Transport.tsx — Module Bus Scolaire
- Liste des élèves inscrits au transport
- Circuits / arrêts configurables
- Tarif bus par élève (lié aux Offres de Scolarité)
- Suivi présence / absences sur le bus

### 4.2 PortailParent.tsx — Portail Famille (lecture seule)
- Accès parent avec identifiants propres
- Consultation : bulletins publiés, factures, emploi du temps, événements
- Notifications reçues (WhatsApp + in-app)

### 4.3 Notifications en temps réel
- Notifications in-app pour les rôles internes
- Alertes : mensualité en retard, nouveau bulletin publié, événement créé

---

## TYPES & RÔLES dans `types.ts` ✅

```typescript
export enum UserRole {
  ADMIN      = 'ADMIN',
  DIRECTEUR  = 'DIRECTEUR',
  ENSEIGNANT = 'ENSEIGNANT',
  MAITRESSE  = 'MAITRESSE',
  COMPTABLE  = 'COMPTABLE',
  ASSISTANTE = 'ASSISTANTE',
  HR_MANAGER = 'HR_MANAGER',
  EMPLOYEE   = 'EMPLOYEE',
}

type NiveauScolaire = 'CRECHE' | 'PS' | 'MS' | 'GS' | 'CP' | 'CE1' | 'CE2' | 'CM1' | 'CM2'
type RegimeFinancier = 'NORMAL' | 'CAS_SOCIAL_PARTIEL' | 'CAS_SOCIAL_TOTAL'
type StatutAdmission = 'EN_ATTENTE' | 'ADMIS' | 'ACTIF' | 'RADIE' | 'SUSPENDU'
type Trimestre = 'T1' | 'T2' | 'T3'
type NiveauCompetence = 'ACQUIS' | 'EN_COURS' | 'NON_ACQUIS'
// + Eleve, Classe, BulletinMaternelle, BulletinElementaire, EvenementEcole
```

---

## RÉSUMÉ D'AVANCEMENT

| Phase | Contenu | Statut |
|---|---|---|
| Phase 1 — Fondations | 7 tâches (types, auth, App, constants, Layout, categories, Eleves) | ✅ Terminée |
| Phase 2 — Finance & Communication | 7 modules (Services, Sales, Dashboard, Settings, WhatsApp, Certificats, Admission) | ✅ Terminée |
| Phase 3 — Pédagogie | 3 modules (Bulletins, EmploiDuTemps, Evenements) | ✅ Terminée |
| Phase 4 — Confort & Expansion | 3 modules (Transport, Portail Parent, Notifications) | 🔄 À faire |

**Modules actifs dans l'application (17 au total) :**
`eleves` · `admission` · `services` · `sales` · `payments` · `recovery` · `deliveries` · `stocks` · `categories` · `subcategories` · `hr` · `dashboard` · `whatsapp` · `certificats` · `bulletins` · `emploidutemps` · `evenements`
