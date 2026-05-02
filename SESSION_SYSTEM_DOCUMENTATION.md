# 🔐 Système de Gestion de Sessions - GeStockPro

## Vue d'ensemble

Ce document décrit l'implémentation complète du système de gestion de sessions avec déconnexion automatique pour GeStockPro. Le système assure la sécurité et la traçabilité des connexions utilisateur.

## 🏗️ Architecture

### Backend

#### 1. Table Sessions (`sessions`)
```sql
- id (UUID, Primary Key)
- tenant_id (UUID, Foreign Key vers tenants)
- user_id (UUID, Foreign Key vers users)
- session_token (VARCHAR, Unique)
- jwt_token (TEXT)
- ip_address (INET)
- user_agent (TEXT)
- device_info (TEXT)
- is_active (BOOLEAN)
- last_activity (TIMESTAMP)
- login_at (TIMESTAMP)
- logout_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. Modèle Session (`models/Session.js`)
- Méthodes d'instance : `isValid()`, `updateActivity()`, `terminate()`
- Méthodes statiques : `findActiveByUserId()`, `findByToken()`, `cleanupExpiredSessions()`

#### 3. AuthService étendu (`services/AuthService.js`)
Nouvelles méthodes :
- `createSession()` - Créer une nouvelle session
- `validateSession()` - Valider une session existante
- `terminateSession()` - Terminer une session spécifique
- `terminateAllUserSessions()` - Terminer toutes les sessions d'un utilisateur
- `cleanupExpiredSessions()` - Nettoyer les sessions expirées
- `getUserActiveSessions()` - Lister les sessions actives d'un utilisateur

#### 4. AuthController étendu (`controllers/AuthController.js`)
Nouvelles routes :
- `POST /auth/logout` - Déconnexion avec terminaison de session
- `POST /auth/logout-all` - Déconnexion de toutes les sessions
- `GET /auth/sessions` - Récupérer les sessions actives
- `POST /auth/validate-session` - Valider une session

#### 5. Middleware de validation (`middlewares/sessionValidator.js`)
- `validateSession` - Middleware strict de validation
- `validateSessionOptional` - Middleware optionnel
- `cleanupExpiredSessions` - Nettoyage périodique

### Frontend

#### 1. AuthBridge étendu (`services/authBridge.ts`)
Nouvelles méthodes :
- `getSessionToken()` - Récupérer le token de session
- `validateCurrentSession()` - Valider la session côté serveur
- `logout()` - Déconnexion avec nettoyage serveur
- `startSessionMonitoring()` - Surveiller la validité de session

#### 2. API Client mis à jour (`services/api.ts`)
- Inclusion automatique du `x-session-token` dans les headers
- Gestion améliorée des erreurs de session expirée

#### 3. Login.tsx mis à jour
- Sauvegarde du `sessionToken` lors du login
- Support des sessions dans MFA

#### 4. Dashboard.tsx avec monitoring
- Surveillance automatique des sessions
- Déconnexion automatique en cas d'expiration

#### 5. Composant SessionManager (`components/SessionManager.tsx`)
- Wrapper pour gérer les sessions dans toute l'application
- Interface utilisateur pour session expirée
- Monitoring en arrière-plan

## 🚀 Utilisation

### 1. Connexion avec session
```javascript
// Le login retourne maintenant un sessionToken
const response = await apiClient.post('/auth/login', { email, password });
// response = { token, sessionToken, user }

// Sauvegarde automatique dans authBridge
authBridge.saveSession(user, response.token, response.sessionToken);
```

### 2. Validation automatique
```javascript
// Démarrer le monitoring (toutes les 5 minutes par défaut)
const monitorId = authBridge.startSessionMonitoring(() => {
  // Callback de déconnexion automatique
  window.location.href = '/login';
}, 300000);
```

### 3. Déconnexion propre
```javascript
// Déconnexion avec nettoyage serveur
await authBridge.logout();
```

### 4. Utilisation du SessionManager
```jsx
import SessionManager from './components/SessionManager';

function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
    // Redirection vers login
  };

  if (!user) {
    return <Login onSuccess={setUser} />;
  }

  return (
    <SessionManager user={user} onLogout={handleLogout}>
      <Dashboard user={user} />
      {/* Autres composants */}
    </SessionManager>
  );
}
```

## 🔧 Configuration

### Variables d'environnement
```env
# Durée de vie des sessions (en heures)
SESSION_DURATION=24

# Intervalle de nettoyage (en millisecondes)
CLEANUP_INTERVAL=3600000

# Secret JWT (partagé avec les sessions)
JWT_SECRET=your-secret-key
```

### Paramètres frontend
```javascript
// Intervalle de vérification des sessions (5 minutes)
const SESSION_CHECK_INTERVAL = 300000;

// URL de l'API backend
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';
```

## 🛡️ Sécurité

### Fonctionnalités de sécurité
- ✅ Tokens de session uniques et cryptographiquement sécurisés
- ✅ Expiration automatique des sessions (24h par défaut)
- ✅ Traçabilité complète (IP, User-Agent, Device)
- ✅ Déconnexion automatique en cas de session expirée
- ✅ Nettoyage périodique des sessions expirées
- ✅ Isolation par tenant (multi-tenant)
- ✅ Validation côté client et serveur

### Bonnes pratiques
- Les sessions sont automatiquement nettoyées après expiration
- La dernière activité est mise à jour à chaque requête API
- Les tokens de session sont stockés séparément des JWT
- Validation périodique côté client (configurable)

## 📊 Monitoring

### Logs disponibles
- Création de sessions
- Validation de sessions
- Terminaison de sessions
- Nettoyage des sessions expirées
- Tentatives d'accès avec sessions invalides

### Métriques
- Nombre de sessions actives par utilisateur
- Sessions expirées nettoyées
- Dernière activité par session

## 🧪 Tests

### Script de test
```bash
cd backend
node test-sessions-simple.js
```

Le script teste :
- Création de session
- Validation de session
- Mise à jour d'activité
- Terminaison de session
- Nettoyage

## 🔄 Migration

### Appliquer la migration
```bash
cd backend
node --input-type=module -e "
import { sequelize } from './config/database.js';
import fs from 'fs';

(async () => {
  const sql = fs.readFileSync('./migrations/20260311-create-sessions-table.sql', 'utf8');
  await sequelize.query(sql);
  console.log('Migration appliquée');
  process.exit(0);
})();
"
```

## 📱 Compatibilité

- ✅ React/TypeScript
- ✅ Node.js/Express
- ✅ PostgreSQL
- ✅ JWT basé
- ✅ Multi-tenant
- ✅ Sessions multiples par utilisateur

## 🎯 Prochaines étapes possibles

1. **Dashboard admin** pour visualiser les sessions actives
2. **Notifications push** pour sessions suspectes
3. **Géolocalisation** des connexions
4. **Limits de sessions** par utilisateur
5. **Session refresh** automatique
6. **Remember me** avec sessions longues

---

*Documentation générée le 11 mars 2026 - GeStockPro v3.2.3*