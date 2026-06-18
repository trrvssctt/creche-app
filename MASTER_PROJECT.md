---
name: master-project
description: "Documentation maître complète du projet GeStock Pro / Le Toit des Anges — structure, BD, composants, historique, règles"
metadata: 
  node_type: memory
  type: project
  originSessionId: e169cfcb-853d-4de7-a0c5-6e9629d89d8a
---

# PROJET GESTOCK PRO — LE TOIT DES ANGES
**Fichier de référence maître — toute modification du projet DOIT être reportée ici**

---

## 1. IDENTITÉ DU PROJET

| Champ | Valeur |
|---|---|
| Nom produit | GeStock Pro |
| Client réel | Le Toit des Anges (crèche/maternelle/élémentaire, Dakar, Sénégal) |
| Tenant ID | `b2688399-60a9-42ad-ac8c-d16b0fffdf4c` |
| Directrice (user) | ID `7c99d34d-03e3-4f62-8cbb-601981c0c8d5` — Aïssatou NDIAYE |
| Année scolaire active | 2025-2026 |
| Contexte | ERP SaaS multi-tenant adapté pour une école sénégalaise |

---

## 2. STACK TECHNIQUE

### Frontend
- **React 18 + TypeScript** (Vite)
- Routing : état local dans `App.tsx` (pas de React Router)
- UI : Tailwind CSS + lucide-react
- Contextes globaux : `AnneeContext` (année scolaire), `NiveauxContext` (niveaux scolaires)
- Services : `api.ts` (apiClient), `authBridge.ts`, `paymentService.ts`, `geminiService.ts`, `exportUtils.ts`, `uploadService.ts`
- Répertoire racine : `/home/dianka/Documents/Crèche_project/`

### Backend
- **Node.js / Express** (ES Modules)
- ORM : **Sequelize** (PostgreSQL)
- Auth : JWT + sessions en base (`sessions` table)
- Cron jobs : node-cron (Africa/Dakar timezone)
- Stockage fichiers : S3 MamuteCloud + local fallback (`backend/uploads/`)
- Port : 3000
- Répertoire : `/home/dianka/Documents/Crèche_project/backend/`

### Base de données
- **PostgreSQL 16** (Owner: `gestionapp`)
- Extensions : `pgcrypto`, `uuid-ossp`
- Nom BD : base de production sur VPS

### IA / Chatbot
- n8n webhook : `https://n8n.realtechprint.com/webhook/booba/gestock-ia`
- Modèle local (dev) : `qwen2.5-coder:1.5b` via Ollama sur `185.215.165.43:11434`
- Service Gemini : `services/geminiService.ts`

### Paiements
- Wave, Orange Money, MTN MoMo
- Stripe (tests : carte `4000056655665556`)

---

## 3. VARIABLES D'ENVIRONNEMENT

### Frontend (`/.env`)
```
VITE_BACKEND_URL=http://localhost:3000
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://185.215.165.43:11434
CLAUDE_CODE_USE_OPENAI=1
OPENAI_BASE_URL=http://185.215.165.43:11434/v1
OPENAI_MODEL=qwen2.5-coder:1.5b
```

### Backend (`/backend/.env`)
```
PORT=3000
FRONTEND_URL=http://localhost:5173
S3_ENDPOINT=https://s3-us-east-1.mamutecloud.com
S3_BUCKET=bucket-gestockpro
SMTP_HOST=sandbox.smtp.mailtrap.io
WEBHOOK_URL=https://n8n.realtechprint.com/webhook/booba/gestock-ia
STRIPE_SECRET_KEY=sk_test_51TClxBQ54W1IDtbTn...
```

---

## 4. STRUCTURE DE LA BASE DE DONNÉES

### Tables principales (par domaine)

#### Multi-tenancy
| Table | Colonnes clés | Rôle |
|---|---|---|
| `tenants` | id, name, domain, plan_id, annee_active, whatsapp_number, is_suspended, theme | Tenant (école) |
| `users` | id, tenant_id, email, password, role, roles[], employee_id | Comptes d'accès |
| `sessions` | id, tenant_id, user_id, session_token, jwt_token, expires_at | Sessions JWT actives |
| `super_admins` | id, name, email, password | Admins plateforme |
| `plans` | id, name, price_monthly, price_yearly, features, level | Plans d'abonnement |
| `subscriptions` | tenant_id, plan_id, status (TRIAL/ACTIVE/EXPIRED), next_billing_date | Abonnements |

#### Module Scolaire (spécifique crèche)
| Table | Colonnes clés | Rôle |
|---|---|---|
| `eleves` | id, tenant_id, matricule, nom, prenom, niveau, classe_id, statut, parent1 (jsonb), parent2 (jsonb), whatsapp_principal, annee_scolaire, regime_financier, cantine, transport_bus | Élèves |
| `classes` | id, tenant_id, nom, niveau, enseignant_id, capacite_max, annee_scolaire, enseignants_matiere (jsonb) | Classes |
| `bulletins` | (via BulletinController) notes par matière, trimestre, classe, élève | Bulletins de notes |
| `presences` | (via PresenceController) présences élèves par jour/classe | Présences élèves |
| `creneaux_horaires` | id, tenant_id, classe_id, enseignant_id, jour (0-4), heure_debut, heure_fin, matiere, couleur, annee_scolaire | Emplois du temps |
| `eleve_documents` | id, tenant_id, eleve_id, type, file_url | Documents élèves |
| `abonnements_eleves` | (via AbonnementController) échéances paiement scolarité | Abonnements scolaires |
| `echeances_paiement` | (via EcheancePaiement model) | Échéances mensuelles |

**Niveaux scolaires :** CRECHE, PS, MS, GS, CP, CE1, CE2 (+ MS Inclusion/Handicap)

**Régimes financiers :** NORMAL, CAS_SOCIAL

**Colonnes spécifiques crèche sur `customers`** (migration 20260502) :
statut, niveau, date_naissance, lieu_naissance, regime_financier, remise_pct, cantine, transport_bus, besoin_specifique, parent1_lien, parent1_whatsapp, urgence_nom/tel/lien, date_depot, annee_scolaire, notes

**Fiche sanitaire sur `customers`** (migration 20260520) :
sexe, parent1/2 détails, vaccinations (diphtérie, tétanos, polio, coqueluche, BCG, hep_b, ROR), antécédents maladies, allergies, équipements (lunettes, etc.), médecin traitant, autorisation_photo, autorisation_soins

#### Module `services` (offres scolaires)
Colonnes spécifiques (migration 20260501) :
- `type_offre` : INSCRIPTION | MENSUALITE | REINSCRIPTION | BUS | CANTINE | ACTIVITE | AUTRE
- `niveaux_cibles` : jsonb array de niveaux (ex: ["PS","MS","GS"])
- `duree_mois` : durée en mois (défaut 10)
- `inclut_cantine` : booléen
- `frais_inscription` : montant FCFA
- `annee_scolaire` : ex "2025-2026" (migration 20260519)

#### RH (Ressources Humaines)
| Table | Colonnes clés | Rôle |
|---|---|---|
| `employees` | id, tenant_id, first_name, last_name, email, phone, hire_date, position, department_id, base_salary, status, photo_url, bank_info (jsonb) | Employés |
| `departments` | id, tenant_id, name, description, manager_id | Départements |
| `contracts` | id, tenant_id, employee_id, type (CDI/CDD/…), start_date, end_date, salary, status, renewal_count, max_renewals | Contrats |
| `leaves` | id, tenant_id, employee_id, type, start_date, end_date, days_count, status, document_url | Congés |
| `attendances` | id, tenant_id, employee_id, date, clock_in, clock_out, status, overtime_minutes, meta (jsonb) | Pointage |
| `overtime_requests` | id, tenant_id, employee_id, requested_date, requested_minutes, status | Heures supplémentaires |
| `payroll_settings` | id, tenant_id, minimum_wage (60000), currency, payment_day, overtime_rate, work_start_time, work_end_time, working_days_per_month, deduction_enabled | Paramètres paie |
| `payroll_items` | id, tenant_id, name, code, type (EARNING/DEDUCTION), category, calculation_type (FIXED/PERCENTAGE/FORMULA), default_value, percentage | Rubriques de paie |
| `advances` | id, tenant_id, employee_id, amount, months, status (PENDING/APPROVED/REJECTED), remaining_amount | Avances sur salaire |
| `primes` | id, tenant_id, employee_id, amount, type (PERFORMANCE/EXCEPTIONAL/…), payroll_month, is_paid | Primes |
| `declarations` | id, tenant_id, declaration_type (IPRES/CSS/CFCE/VRS/TAX/SOCIAL), period, status, total_amount | Déclarations sociales |
| `company_declaration_settings` | ipres_employee_rate (5.6%), ipres_employer_rate (8.4%), css rates, cfce rates | Taux cotisations |
| `performance_reviews` | ratings 1-5 (overall, goals, communication, technical, leadership) | Évaluations |
| `job_offers` | id, tenant_id, title, requirements, status (OPEN/CLOSED) | Offres d'emploi |
| `candidates` | id, tenant_id, job_offer_id, status (NEW/INTERVIEWED/HIRED/REJECTED), rating | Candidats |
| `trainings` | id, tenant_id, title, provider, duration_hours, cost | Formations |
| `training_participants` | training_id, employee_id, status, grade | Participants formations |
| `employee_documents` | type: ID_CARD/CONTRACT/DIPLOMA/BANK_DETAILS/MEDICAL/OTHER | Documents RH |
| `hr_rules` | type, condition_operator/value, action_type/value | Règles RH auto |

**Départements Le Toit des Anges :**
Direction, Pédagogie Maternelle, Pédagogie Élémentaire, Crèche, Administration, Sécurité & Services

#### Commerce / Stock
| Table | Colonnes clés | Rôle |
|---|---|---|
| `stock_items` | id, tenant_id, sku, name, current_level, min_threshold, unit_price, subcategory_id, image_url, purchase_price | Articles stock |
| `categories` | id, tenant_id, name, status | Catégories |
| `subcategories` | id, tenant_id, category_id, name, status | Sous-catégories |
| `product_movements` | id, stock_item_id, type, qty, previous_level, new_level, reason | Mouvements stock |
| `inventory_campaigns` | id, tenant_id, name, status (DRAFT/IN_PROGRESS/DONE) | Campagnes inventaire |
| `inventory_campaign_items` | campaign_id, stock_item_id, system_qty, counted_qty | Détail inventaire |
| `suppliers` | id, tenant_id, company_name, phone, email, payment_terms | Fournisseurs |
| `deliveries` | id, tenant_id, reference, supplier_id, status (PENDING/RECEIVED/PARTIAL/CANCELLED) | Livraisons |
| `delivery_items` | delivery_id, stock_item_id, quantity_received, purchase_price | Détail livraisons |
| `services` | id, tenant_id, name, price, type_offre, niveaux_cibles, annee_scolaire | Services/Prestations |
| `sales` | id, tenant_id, customer_id, reference, status (EN_COURS/TERMINE/ANNULE), total_ttc | Ventes |
| `sale_items` | sale_id, stock_item_id/service_id, quantity, unit_price, tax_rate | Lignes vente |
| `payments` | id, tenant_id, sale_id, amount, method, reference, proof_image, cheque_number | Paiements reçus |
| `invoices` | id, tenant_id, customer_id, amount, status (DRAFT/SENT/PAID) | Factures |
| `invoice_items` | invoice_id, product_id, name, qty, price, tva | Lignes factures |
| `customers` | id, tenant_id, email, name, outstanding_balance, health_status + colonnes crèche | Clients/Parents |

#### Système
| Table | Colonnes clés | Rôle |
|---|---|---|
| `audit_logs` | tenant_id, user_id, action, resource, sha256_signature | Journal d'audit |
| `backups` | tenant_id, type (AUTOMATIC/MANUAL), status, storage_path, checksum | Sauvegardes |
| `notifications` | tenant_id, target_user_id, title, body, type | Notifications |
| `notification_reads` | notification_id, user_id | Lu/Non-lu |
| `announcements` | type (INFO/WARNING/UPDATE/PROMO/MAINTENANCE), target_plan, is_pinned | Annonces SaaS |
| `support_tickets` | tenant_id, subject, category, priority, status (OPEN/RESOLVED) | Support |
| `contact_messages` | full_name, email, subject, status (non_lus/lus) | Contacts landing |
| `payment_records` | tenant_id, amount, method, transaction_id | Paiements SaaS |
| `registration_intents` | stripe_session_id, registration_data, status | Inscriptions en attente |
| `n8n_chat_histories` | session_id, message (json), sender | Historique chat IA |

### Triggers & Fonctions DB
- `update_updated_at_column()` — MAJ auto du champ `updated_at`
- `update_sessions_updated_at()` — idem pour sessions
- `update_employee_documents_updated_at()` — idem employee_documents
- `update_payroll_items_updated_at()` — idem payroll_items
- `prevent_category_change_if_subcats_exist()` — protection intégrité catégories
- `prevent_subcategory_change_if_items_exist()` — protection intégrité sous-catégories

---

## 5. RÔLES UTILISATEURS

```typescript
enum UserRole {
  ADMIN       // directeur/admin — accès total
  DIRECTEUR   // alias métier de ADMIN
  ENSEIGNANT  // accès module pédagogie
  MAITRESSE   // alias ENSEIGNANT
  COMPTABLE   // accès finances
  ASSISTANTE  // secrétariat
  HR_MANAGER  // module RH backend
  EMPLOYEE    // personnel générique
  INFIRMIERE  // accès infirmerie
  CHAUFFEUR   // transport scolaire
}
```

---

## 6. COMPOSANTS FRONTEND

### Racine / Système
| Fichier | Rôle |
|---|---|
| `App.tsx` | Router central — gestion navigation par état, auth, rôles |
| `components/Layout.tsx` | Sidebar + header + navigation |
| `components/Login.tsx` | Connexion utilisateur |
| `components/Dashboard.tsx` | Tableau de bord principal |
| `components/Settings.tsx` | Paramètres tenant |
| `components/SecurityPanel.tsx` | Gestion sécurité |
| `components/AuditLogs.tsx` | Journal d'audit |
| `components/ChatInterface.tsx` | Chat IA n8n |
| `components/AIAnalysis.tsx` | Analyse IA |
| `components/Support.tsx` | Tickets support |
| `components/Governance.tsx` | Gouvernance |
| `components/SessionManager.tsx` | Gestion sessions |
| `components/ToastProvider.tsx` | Notifications toast |
| `components/Info.tsx` | Informations système |

### Module Scolaire (Crèche)
| Fichier | Rôle |
|---|---|
| `components/Eleves.tsx` | Liste et gestion des élèves |
| `components/Classes.tsx` | Gestion des classes |
| `components/Admission.tsx` | Admission nouveaux élèves |
| `components/Bulletins.tsx` | Bulletins de notes |
| `components/Certificats.tsx` | Certificats scolaires |
| `components/EmploiDuTemps.tsx` | Emplois du temps |
| `components/Evenements.tsx` | Événements scolaires |
| `components/WhatsApp.tsx` | Communication WhatsApp parents |
| `components/FacturationMensuelle.tsx` | Facturation mensuelle scolarité |
| `components/EleveDossier.tsx` | Dossier complet élève |
| `components/SchoolAdminDashboard.tsx` | Dashboard administratif école |
| `components/TeacherPortal.tsx` | Portail enseignant |
| `contexts/AnneeContext.tsx` | Contexte année scolaire active |
| `contexts/NiveauxContext.tsx` | Contexte niveaux scolaires |

### Module Commerce / Stock
| Fichier | Rôle |
|---|---|
| `components/Inventory.tsx` | Gestion des stocks |
| `components/InventoryCampaign.tsx` | Campagnes d'inventaire |
| `components/InventoryAuditReport.tsx` | Rapport d'audit inventaire |
| `components/InventoryCampaignAudit.tsx` | Audit campagne |
| `components/StockMovements.tsx` | Mouvements de stock |
| `components/CategoryManager.tsx` | Gestion catégories |
| `components/SubcategoryManager.tsx` | Gestion sous-catégories |
| `components/Customers.tsx` | Clients/Parents |
| `components/Suppliers.tsx` | Fournisseurs |
| `components/Deliveries.tsx` | Livraisons |
| `components/Sales.tsx` | Ventes |
| `components/Services.tsx` | Services/Prestations |
| `components/Payments.tsx` | Paiements |
| `components/Recovery.tsx` | Recouvrement créances |
| `components/Checkout.tsx` | Caisse/point de vente |

### Module RH
| Fichier | Rôle |
|---|---|
| `components/rh/HRDashboard.tsx` | Tableau de bord RH |
| `components/rh/EmployeeList.tsx` | Liste employés |
| `components/rh/EmployeeProfile.tsx` | Fiche employé |
| `components/rh/ContractList.tsx` | Contrats |
| `components/rh/PayrollManagement.tsx` | Gestion de la paie |
| `components/rh/PayslipPreview.tsx` | Prévisualisation fiche de paie |
| `components/rh/LeaveManagement.tsx` | Congés |
| `components/rh/Attendance.tsx` | Pointage employés |
| `components/rh/EmployeePointage.tsx` | Pointage individuel |
| `components/rh/OvertimeRequests.tsx` | Heures supplémentaires |
| `components/rh/TimeDeductionSettings.tsx` | Paramètres déductions horaires |
| `components/rh/DocumentCenter.tsx` | Centre documents RH |
| `components/rh/OrgChart.tsx` | Organigramme |
| `components/rh/DepartmentManager.tsx` | Gestion départements |
| `components/rh/DeclarationsSocialesFiscales.tsx` | Déclarations sociales/fiscales |
| `components/rh/HRModal.tsx` | Modal RH générique |

### SaaS / Abonnement
| Fichier | Rôle |
|---|---|
| `components/Subscription.tsx` | Gestion abonnement |
| `components/SuperAdmin.tsx` | Interface super-admin |
| `components/SuperAdminLogin.tsx` | Login super-admin |
| `components/LandingPage.tsx` | Page d'accueil SaaS |
| `components/OnboardingWizard.tsx` | Wizard de démarrage |
| `components/RegistrationSuccess.tsx` | Confirmation inscription |
| `components/StripeRedirect.tsx` | Redirection Stripe |

---

## 7. BACKEND — ROUTES & CONTROLLERS

### Routes principales (`backend/routes/api.js`)
| Route prefix | Fichier routes | Controller |
|---|---|---|
| `/api/auth` | `auth.routes.js` | `AuthController` |
| `/api/stock` | `stock.routes.js` | `InventoryController`, `StockMovementController` |
| `/api/categories` | `categories.routes.js` | `CategoryController` |
| `/api/subcategories` | `subcategories.routes.js` | `SubcategoryController` |
| `/api/customers` | `customers.routes.js` | `CustomerController` |
| `/api/suppliers` | `suppliers.routes.js` | `SupplierController` |
| `/api/deliveries` | `deliveries.routes.js` | `DeliveryController` |
| `/api/sales` | `sales.routes.js` | `SalesController` |
| `/api/services` | `services.routes.js` | `ServiceController` |
| `/api/finance` | `finance.routes.js` | `FinanceController` |
| `/api/recovery` | `recovery.routes.js` | `RecoveryController` |
| `/api/eleves` | `eleves.routes.js` | `EleveController` |
| `/api/eleve-dossier` | `eleve-dossier.routes.js` | `EleveDossierController` |
| `/api/classes` | `classes.routes.js` | `ClasseController` |
| `/api/bulletins` | `bulletins.routes.js` | `BulletinController` |
| `/api/abonnements` | `abonnements.routes.js` | `AbonnementController` |
| `/api/planning` | `planning.routes.js` | `PlanningController` |
| `/api/schedule` | `schedule.routes.js` | `ScheduleController` |
| `/api/hr` | `hr.routes.js` | EmployeeController, ContractController, LeaveController, PayrollController, AttendanceController, etc. |
| `/api/teacher` | `teacher.routes.js` | TeacherPortal |
| `/api/ai` | `ai.routes.js` | `AIController` |
| `/api/billing` | `billing.routes.js` | `BillingService` |
| `/api/admin` | `admin.routes.js` | `AdminController` |
| `/api/support` | `support.routes.js` | `SupportController` |
| `/api/upload` | `upload.routes.js` | `UploadController` |
| `/api/document` | `document.routes.js` | `DocumentController` |
| `/api/resilience` | `resilience.routes.js` | `ResilienceController` |
| `/api/contact` | `contact.routes.js` | ContactMessage |

### Middlewares
| Fichier | Rôle |
|---|---|
| `auth.js` | Vérification JWT |
| `rbac.js` | Contrôle d'accès par rôle |
| `tenant.js` | Extraction tenant depuis header |
| `sessionValidator.js` | Validation session active |
| `securityHeaders.js` | En-têtes sécurité (CSP, etc.) |
| `floodProtection.js` | Rate limiting / anti-flood |
| `errorHandler.js` | Gestionnaire d'erreurs global |

### Services backend
| Fichier | Rôle |
|---|---|
| `AuthService.js` | Authentification, JWT, sessions |
| `BackupService.js` | Sauvegardes auto + traitement suppression comptes |
| `BillingService.js` | Facturation abonnements |
| `PaymentGateway.js` | Wave, Orange Money, MTN MoMo |
| `StripeService.js` | Paiements Stripe |
| `PayrollCalculationService.js` | Calcul salaires |
| `PayslipGeneratorService.js` | Génération fiches de paie |
| `InvoiceService.js` | Génération factures |
| `FinanceService.js` | Rapports financiers |
| `DocumentService.js` | Gestion documents |
| `S3Service.js` | Upload S3 MamuteCloud |
| `NotificationService.js` | Notifications |
| `SecurityService.js` | Audit, SHA256 |
| `AIService.js` | Intégration IA |
| `ResilienceService.js` | Reprise après panne |
| `CustomerService.js` | Logique métier clients |

---

## 8. CRON JOBS (automatiques, Africa/Dakar timezone)

| Horaire | Action |
|---|---|
| Chaque minute | Auto-dépointage employés si `deductionEnabled=true` et heure >= workEndTime |
| 02h00 chaque jour | Sauvegarde système automatique (rétention 7 jours) |
| 03h00 chaque jour | Traitement suppressions de compte planifiées (backup 90j → suppression) |
| 07h00 chaque jour | Génération échéances scolaires pour tous les tenants |

---

## 9. DONNÉES RÉELLES — LE TOIT DES ANGES

### Classes 2025-2026
| ID | Nom | Niveau | Enseignant | Élèves |
|---|---|---|---|---|
| `9b000001` | Crèche | CRECHE | Fatima DIOP | 8 |
| `b90013ac` | Petite Section A | PS | Mariama BA | 12 |
| `687a7bc3` | Moyenne Section A | MS | Fatou SALL | 11 |
| `8a4f8c38` | Section Inclusion (Handicap) | MS | - | 4 |
| `9b000004` | Grande Section A | GS | Rokhaya FALL | 13+ |
| `16cfa884` | CP A | CP | Moussa Cissokho | 12 |
| `9b000006` | CE1 A | CE1 | Ndèye DIAW | 10 |
| `9b000007` | CE2 A | CE2 | Ousmane DIALLO | 10 |

### Personnel clé
| Rôle | Nom | Email |
|---|---|---|
| Directrice | Aïssatou NDIAYE | directrice@toit-des-anges.sn |
| Enseignante Crèche | Fatima DIOP | (emp existant) |
| Enseignante PS | Mariama BA | mariama.ba@toit-des-anges.sn |
| Enseignante MS | Fatou SALL | (emp existant) |
| Enseignante GS | Rokhaya FALL | rokhaya.fall@toit-des-anges.sn |
| Enseignant CP | Moussa Cissokho | (emp existant) |
| Enseignante CE1 | Ndèye DIAW | ndeye.diaw@toit-des-anges.sn |
| Enseignant CE2 | Ousmane DIALLO | ousmane.diallo@toit-des-anges.sn |
| Prof Anglais | Ibrahima SECK | ibrahima.seck@toit-des-anges.sn |
| Prof EPS | Modou MBAYE | modou.mbaye@toit-des-anges.sn |
| Infirmière | Khady CISSÉ | khady.cisse@toit-des-anges.sn |
| Secrétaire | Amy TOURÉ | amy.toure@toit-des-anges.sn |
| Chauffeur | Samba SARR | samba.sarr@toit-des-anges.sn |

---

## 10. HISTORIQUE DES MIGRATIONS

| Date | Fichier | Description |
|---|---|---|
| 2026-02-03 | add-plan-and-status | Plans et statuts abonnements |
| 2026-02-11 | add-payment-status | Statut paiements tenants |
| 2026-02-18 | add-ui-fields | Champs UI (thème, fonts) |
| 2026-02-19 | add-button-color | Couleur boutons |
| 2026-02-25 | add-hr-tables | Tables RH de base |
| 2026-03-01 | extend-hr-complete-module | Module RH complet |
| 2026-03-02 | add-contract-management-fields | Champs renouvellement contrats |
| 2026-03-02 | employee-documents | Documents employés |
| 2026-03-02 | add-employee-photo-url | Photo employés |
| 2026-03-03 | create-payroll-items-table | Rubriques de paie |
| 2026-03-03 | update-payroll-settings-social-charges | Taux charges sociales |
| 2026-03-11 | create-sessions-table | Table sessions JWT |
| 2026-03-25 | add-renewal-tracking-fields | Suivi renouvellements contrats |
| 2026-03-25 | add-time-deduction-settings | Paramètres pointage auto |
| 2026-03-31 | add-suppliers-deliveries | Fournisseurs et livraisons |
| 2026-05-01 | add-school-columns-to-services | Colonnes scolaires sur services |
| 2026-05-02 | add-creche-columns-to-customers | Colonnes crèche sur customers |
| 2026-05-19 | add-annee-active-and-service-year | annee_active sur tenants, annee_scolaire sur services |
| 2026-05-20 | add-fiche-sanitaire-to-customers | Fiche sanitaire complète (vaccins, allergies, etc.) |
| 2026-05-20 | seed_toit_des_anges | Données réelles Le Toit des Anges |

---

## 11. FICHIERS DOCUMENTS RÉELS (dossier Marketing)
- Bulletins de notes : PS, MS, GS, CP, CE1, CE2
- Fiche d'identité maternelle
- Convention de scolarisation
- Règlement intérieur + accusé réception
- Tableau des droits et frais de scolarités 2026
- Autorisation de sortie scolaire
- Fiche sanitaire de liaison ACM avec autorisation photographie
- Tableau des tarifs crèche

---

## 12. RÈGLE D'OR — PROTOCOLE DE MODIFICATION

**TOUTE modification du projet doit être consignée ici avant exécution :**
1. **Tables BD** : ajouter la colonne/table dans la section 4 + créer une migration SQL
2. **Composants** : mettre à jour section 6
3. **Routes/Controllers** : mettre à jour section 7
4. **Données réelles** : mettre à jour section 9
5. Dater et décrire la modification dans la section 10 (Migrations) ou une nouvelle section "Journal des modifications"

---

## 13. JOURNAL DES MODIFICATIONS (post-seed)

> *Chaque modification faite après le 2026-05-20 doit être listée ici avec date, description et fichiers modifiés.*

| Date | Description | Fichiers modifiés |
|---|---|---|
| 2026-06-10 | Création de ce fichier maître de documentation | memory/master_project.md |
Mercredi
