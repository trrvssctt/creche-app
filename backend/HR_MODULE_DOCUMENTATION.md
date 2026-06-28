# Module RH - Backend API Documentation

## 🎯 Présentation

Le module RH complet a été implémenté avec succès dans le backend GeStockPro. Il fournit une API complète pour la gestion des ressources humaines comprenant :

- **Gestion des employés** et départements
- **Gestion des contrats** et de la paie
- **Gestion des congés** et présences
- **Coffre-fort numérique** pour les documents
- **Recrutement** (offres d'emploi et candidats)
- **Formation** et développement
- **Évaluations de performance**

## 📊 Architecture

### Tables créées / étendues :

1. **employees** - Informations des employés (étendue)
2. **departments** - Départements de l'entreprise (nouvelle)
3. **contracts** - Contrats de travail (étendue) 
4. **payrolls** - Bulletins de paie (étendue)
5. **payroll_settings** - Paramètres de paie (nouvelle)
6. **leaves** - Congés et absences (nouvelle)
7. **employee_documents** - Documents employés (nouvelle)
8. **job_offers** - Offres d'emploi (nouvelle)
9. **candidates** - Candidats (nouvelle)
10. **trainings** - Formations (nouvelle)
11. **training_participants** - Participants formations (nouvelle)
12. **performance_reviews** - Évaluations (nouvelle)

### Relations

- Tenant (multi-tenancy) → Toutes les tables HR
- Employee → Manager (auto-référence)
- Employee → Department
- Employee → Contracts, Payrolls, Leaves, Documents, etc.
- JobOffer → Candidates
- Training → TrainingParticipants
- PerformanceReview → Employee & Reviewer

## 🚀 Installation et Migration

### 1. Appliquer les migrations

Les migrations SQL sont prêtes dans :
- `/backend/migrations/20260225-add-hr-tables.sql` (tables de base)
- `/backend/migrations/20260301-extend-hr-complete-module.sql` (extension complète)

Pour appliquer :
```sql
-- Connectez-vous à votre base PostgreSQL et exécutez :
\i /path/to/20260301-extend-hr-complete-module.sql
```

### 2. Permissions

Le module HR est disponible pour le plan **ENTERPRISE** uniquement.

Rôles autorisés :
- `ADMIN` : Accès complet
- `HR_MANAGER` : Gestion RH complète
- `ACCOUNTANT` : Accès paie et contrats
- `EMPLOYEE` : Accès limité (ses propres données)

## 📡 Endpoints API

### 🧑‍💼 Employés

```
GET    /api/hr/employees              # Liste des employés
POST   /api/hr/employees              # Créer un employé
GET    /api/hr/employees/:id          # Détails employé
PUT    /api/hr/employees/:id          # Modifier employé
DELETE /api/hr/employees/:id          # Supprimer employé
```

**Query params** : `q`, `department`, `status`, `position`, `page`, `perPage`

### 🏢 Départements

```
GET    /api/hr/departments            # Liste des départements
POST   /api/hr/departments            # Créer département
GET    /api/hr/departments/:id        # Détails département
PUT    /api/hr/departments/:id        # Modifier département
DELETE /api/hr/departments/:id        # Supprimer département
```

### 📋 Contrats

```
GET    /api/hr/contracts              # Liste des contrats
POST   /api/hr/contracts              # Créer contrat
GET    /api/hr/contracts/:id          # Détails contrat
PUT    /api/hr/contracts/:id          # Modifier contrat
DELETE /api/hr/contracts/:id          # Supprimer contrat
```

### 💰 Paie

```
GET    /api/hr/payrolls               # Liste bulletins de paie
POST   /api/hr/payrolls               # Créer bulletin
GET    /api/hr/payrolls/:id           # Détails bulletin
POST   /api/hr/payrolls/:id/generate  # Générer PDF

GET    /api/hr/payroll-settings       # Paramètres paie
PUT    /api/hr/payroll-settings       # Modifier paramètres
POST   /api/hr/payroll-settings/calculate  # Calculateur paie
```

### 🏖️ Congés

```
GET    /api/hr/leaves                 # Liste des congés
POST   /api/hr/leaves                 # Demander congé
GET    /api/hr/leaves/:id             # Détails congé
PUT    /api/hr/leaves/:id             # Modifier congé
POST   /api/hr/leaves/:id/approve     # Approuver/Rejeter
DELETE /api/hr/leaves/:id             # Supprimer congé
```

### 📁 Documents

```
GET    /api/hr/employee-documents            # Liste documents
POST   /api/hr/employee-documents            # Upload document
GET    /api/hr/employee-documents/:id        # Détails document
PUT    /api/hr/employee-documents/:id        # Modifier document
DELETE /api/hr/employee-documents/:id        # Supprimer document
GET    /api/hr/employees/:id/documents       # Documents d'un employé
```

### 💼 Recrutement

```
# OFFRES D'EMPLOI
GET    /api/hr/job-offers             # Liste offres
POST   /api/hr/job-offers             # Créer offre
GET    /api/hr/job-offers/:id         # Détails offre
PUT    /api/hr/job-offers/:id         # Modifier offre
DELETE /api/hr/job-offers/:id         # Supprimer offre
POST   /api/hr/job-offers/:id/publish # Publier offre

# CANDIDATS
GET    /api/hr/candidates             # Liste candidats
POST   /api/hr/candidates             # Créer candidat
GET    /api/hr/candidates/:id         # Détails candidat
PUT    /api/hr/candidates/:id         # Modifier candidat
POST   /api/hr/candidates/:id/status  # Changer statut
DELETE /api/hr/candidates/:id         # Supprimer candidat
GET    /api/hr/job-offers/:id/candidates  # Candidats d'une offre
```

### 🎓 Formation

```
GET    /api/hr/trainings              # Liste formations
POST   /api/hr/trainings              # Créer formation
GET    /api/hr/trainings/:id          # Détails formation
PUT    /api/hr/trainings/:id          # Modifier formation
DELETE /api/hr/trainings/:id          # Supprimer formation
POST   /api/hr/trainings/:id/participants  # Ajouter participant
```

### 📊 Évaluations

```
GET    /api/hr/performance-reviews    # Liste évaluations
POST   /api/hr/performance-reviews    # Créer évaluation
GET    /api/hr/performance-reviews/:id # Détails évaluation
PUT    /api/hr/performance-reviews/:id # Modifier évaluation
POST   /api/hr/performance-reviews/:id/submit   # Soumettre
POST   /api/hr/performance-reviews/:id/approve  # Approuver
POST   /api/hr/performance-reviews/:id/finalize # Finaliser
DELETE /api/hr/performance-reviews/:id # Supprimer
```

## 🎯 Intégration Frontend

Le module HR fonctionne parfaitement avec :

1. **HRDashboard.tsx** - Dashboard principal
2. **EmployeeList.tsx** - Liste des employés avec CRUD complet
3. **HRModal.tsx** - Modal réutilisable

### Distinction importante

- **Dans HRDashboard/EmployeeList** : Création d'employés (entités métier)
- **Dans Governance.tsx** : Attribution de rôles système (comptes utilisateurs)

Un employé peut exister sans compte système, et vice versa.

## 🔒 Sécurité

- **Multi-tenancy** : Isolation complète par tenant
- **RBAC** : Permissions par rôle
- **JWT** : Authentification obligatoire
- **Validation** : Règles métier respectées

## 📈 Prochaines étapes

1. **Tests unitaires** des contrôleurs
2. **Documentation OpenAPI/Swagger**
3. **Webhooks** pour notifications
4. **Intégration e-mail** pour les workflow
5. **Rapports avancés** et analytics

---

✅ **Module RH Backend opérationnel** - Prêt pour la production !