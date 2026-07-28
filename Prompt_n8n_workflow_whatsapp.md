# Prompt pour Claude — Workflow n8n + Botpress WhatsApp : Envoi proactif de messages

## Contexte du projet

Tu dois créer un **workflow n8n complet** pour gérer l'envoi de messages WhatsApp sortants (proactifs) depuis une application ERP de crèche/école appelée **GeStockPro — Le Toit des Anges**.

### Architecture existante

- **Backend** : Node.js / Express, hébergé sur un VPS, port 3001
- **Frontend** : React/TypeScript (Vite), même serveur
- **Base de données** : PostgreSQL (AlwaysData)
- **Bot WhatsApp** : Botpress Cloud (agent autonome "Assistant WhatsApp — Le Toit des Anges")
  - Bot ID : `6646c6c7-c56e-4aa0-b1d5-9712aee902a8`
  - Webhook : `https://webhook.botpress.cloud/e3645c1c-3cb7-4a5f-9bdf-b081a07e9f1a`
  - Token : `bp_bak_McGwNSxIMl0y2u_mgb9RxdQIY15U7SbdQPTb`
  - Intégration WhatsApp connectée au bot
  - Le bot utilise un "AutonomousNode" avec un outil "Search Knowledge" pour répondre aux parents
- **n8n** : hébergé sur `https://n8n.realtechprint.com`
- **Domaine prod** : `https://scolarite.letoitdesanges.com`

### Ce qui est déjà en place côté backend

1. **`BotpressService.js`** — envoie un payload JSON à un webhook n8n :
```javascript
// Payload envoyé par le backend à n8n
{
  action: 'send_whatsapp',
  to: '+221XXXXXXXXX',        // numéro normalisé (format international)
  message: 'Texte du message',
  sender: '',                  // optionnel
  timestamp: '2026-07-28T...'
}
```

2. **`NotificationService.js`** — dispatcher existant (relances) qui envoie aussi vers n8n :
```javascript
// Payload relance existant
{
  channel: 'WHATSAPP',
  to: '+221XXXXXXXXX',
  payload: {
    subject: 'Relance redevance — Prénom Nom',
    message: 'Bonjour Parent, ...',
    system: 'GeStockPro-Kernel-v3.1',
    priority: 'NORMAL'
  },
  timestamp: '...'
}
```

3. **`CommunicationController.js`** — module Communications qui :
   - Résout les destinataires depuis la table `eleves` (avec parent1.whatsapp, whatsappPrincipal)
   - Personnalise les messages avec variables `{prenom_enfant}`, `{nom_enfant}`, `{classe}`, `{prenom_parent}`
   - Envoie via `BotpressService.sendBulk()` avec rate-limiting (1s entre chaque)
   - Logue tout dans la table `communication_logs`

4. **`AbonnementController.js`** — génération de factures et enregistrement de paiements :
   - `POST /api/abonnements/echeances/envoyer-facture-email` — génère les factures PDF et envoie par email
   - `PUT /api/abonnements/echeances/:id/payer` — enregistre un paiement unitaire
   - `POST /api/abonnements/echeances/payer-selection` — paiement groupé
   - `POST /api/abonnements/echeances/payer-tout/:eleveId` — paye toutes les échéances d'un élève
   - `POST /api/abonnements/echeances/relancer` — envoie une relance (email ou WhatsApp via NotificationService)

5. **PDF Generator** (frontend) — génère des factures et reçus en PDF côté client :
   - `generateRecu(echeance, ecole)` — génère un reçu PDF
   - `generateInvoicePdfBlob(data)` — génère une facture PDF

### Variables d'environnement disponibles sur le VPS

```
BOTPRESS_WEBHOOK_URL=https://webhook.botpress.cloud/e3645c1c-3cb7-4a5f-9bdf-b081a07e9f1a
BOTPRESS_BOT_ID=6646c6c7-c56e-4aa0-b1d5-9712aee902a8
BOTPRESS_TOKEN=bp_bak_McGwNSxIMl0y2u_mgb9RxdQIY15U7SbdQPTb
N8N_WHATSAPP_WEBHOOK=<à définir — URL du workflow n8n que tu vas créer>
```

---

## Ce que tu dois créer

### Workflow n8n principal : "WhatsApp Outbound — Le Toit des Anges"

Un workflow n8n qui :

#### 1. Réception des requêtes (Webhook Trigger)

- **URL** : `https://n8n.realtechprint.com/webhook/whatsapp-outbound`
- Accepte deux formats de payload (du `BotpressService` et du `NotificationService`) et les normalise

#### 2. Envoi de messages texte

- Envoie un message WhatsApp au numéro `to` via l'intégration Botpress WhatsApp
- **Méthode** : Utiliser l'API Botpress Cloud pour envoyer un message proactif :
  - `POST https://api.botpress.cloud/v1/chat/messages` avec les headers `Authorization: Bearer bp_bak_...` et `x-bot-id: ...`
  - OU utiliser le noeud HTTP Request de n8n pour appeler directement l'API WhatsApp Business (Meta Cloud API) si Botpress ne le permet pas
  - OU utiliser le noeud natif "WhatsApp Business" de n8n si un numéro Meta Business est configuré

#### 3. Envoi de fichiers/pièces jointes (factures, reçus PDF)

Le workflow doit aussi pouvoir recevoir et envoyer des fichiers :
```json
{
  "action": "send_whatsapp_document",
  "to": "+221XXXXXXXXX",
  "message": "Voici votre facture pour le mois de Juillet.",
  "document": {
    "url": "https://scolarite.letoitdesanges.com/api/files?key=factures/facture_Seydou_DIANKA_Juillet_2027.pdf",
    "filename": "facture_Seydou_DIANKA_Juillet_2027.pdf",
    "caption": "Facture mensuelle - Juillet 2027"
  },
  "timestamp": "..."
}
```

Ou en base64 :
```json
{
  "action": "send_whatsapp_document",
  "to": "+221XXXXXXXXX",
  "message": "Voici votre reçu de paiement.",
  "document": {
    "base64": "JVBERi0xLjQK...",
    "filename": "recu_Seydou_DIANKA_Juillet_2027.pdf",
    "mimeType": "application/pdf",
    "caption": "Reçu de paiement confirmé"
  },
  "timestamp": "..."
}
```

#### 4. Synchronisation du contexte avec Botpress

Le bot Botpress doit avoir le contexte de ce qui a été envoyé (factures, reçus, relances) pour pouvoir répondre intelligemment aux parents s'ils posent des questions. Pour cela :
- Après chaque envoi réussi, le workflow doit **créer/mettre à jour la conversation** dans Botpress pour que le bot ait l'historique
- Le bot doit savoir qu'un message a été envoyé par le système (pas par un humain) — taguer avec `source: 'system'` ou similaire

#### 5. Actions attendues selon le type

| Action | Déclencheur dans l'app | Payload attendu |
|--------|----------------------|-----------------|
| `send_whatsapp` | Module Communications (message libre/template) | `{action, to, message}` |
| `send_whatsapp_document` | Facturation → génération facture | `{action, to, message, document}` |
| `send_whatsapp_document` | Recouvrement → paiement confirmé (reçu) | `{action, to, message, document}` |
| `send_whatsapp` | Recouvrement → relance impayé | `{action, to, message}` |
| `send_whatsapp` | Événements/annonces | `{action, to, message}` |

---

## Contraintes techniques

1. **Rate limiting** : WhatsApp limite les messages. Le workflow doit gérer un délai entre les envois (1-2 secondes)
2. **Logging** : Chaque envoi doit retourner un statut `{success: true/false, messageId, error?}` pour que le backend puisse loguer dans `communication_logs`
3. **Numéros sénégalais** : Format `+221XXXXXXXXX` (9 chiffres après +221, commençant par 7)
4. **Fichiers** : Les factures/reçus sont générés côté frontend en PDF. Soit on les upload sur le storage (Cloudinary/S3) d'abord et on passe l'URL, soit on les passe en base64
5. **Réponse synchrone** : Le webhook n8n doit répondre en JSON avec le résultat pour chaque message (le backend attend la réponse)

---

## Livrables attendus

1. **Le JSON complet du workflow n8n** (importable directement dans n8n)
2. **Les instructions de configuration** :
   - Credentials à configurer dans n8n (WhatsApp Business / Botpress)
   - Variables d'environnement à ajouter côté VPS
3. **Modifications backend suggérées** (si nécessaire) pour :
   - Le `BotpressService.js` : adapter le payload pour les documents
   - L'`AbonnementController.js` : appeler l'envoi WhatsApp après paiement et après génération de facture
   - Le `CommunicationController.js` : supporter l'envoi de documents
4. **Explication du flux** :
   - Comment le bot Botpress garde le contexte
   - Comment les messages proactifs apparaissent dans la conversation WhatsApp du parent

---

## Informations sur l'API Botpress Cloud (pour envoyer des messages proactifs)

L'API Botpress Cloud pour messages sortants :
- Base URL : `https://api.botpress.cloud/v1`
- Headers : `Authorization: Bearer <PAT>`, `x-bot-id: <botId>`
- Pour envoyer un message proactif, il faut :
  1. Récupérer ou créer un user avec ses tags WhatsApp
  2. Récupérer ou créer une conversation
  3. Poster un message dans cette conversation

Endpoints utiles :
- `POST /v1/chat/users` — créer un user
- `GET /v1/chat/users` — lister/rechercher des users (par tags)
- `POST /v1/chat/conversations` — créer une conversation
- `POST /v1/chat/messages` — envoyer un message
- `GET /v1/chat/conversations` — lister les conversations d'un user

---

## Flux automatisés à mettre en place

### Flux 1 : Facturation → WhatsApp
```
[Facturation Scolaire] → Génère facture PDF → Upload sur storage → 
Backend POST au webhook n8n {action: send_whatsapp_document, to, message, document: {url, filename}} →
n8n → Envoi WhatsApp avec PDF en pièce jointe → Log dans Botpress
```

### Flux 2 : Paiement → Reçu WhatsApp
```
[Recouvrement] → Paiement enregistré → Génère reçu PDF → Upload sur storage →
Backend POST au webhook n8n {action: send_whatsapp_document, to, message: "Merci...", document: {url, filename}} →
n8n → Envoi WhatsApp avec reçu PDF → Log dans Botpress
```

### Flux 3 : Relance impayé → WhatsApp
```
[Recouvrement] → Clic "Relancer via WhatsApp" →
Backend POST au webhook n8n {action: send_whatsapp, to, message: "Bonjour...rappel redevance..."} →
n8n → Envoi message texte → Log dans Botpress
```

### Flux 4 : Communications libres → WhatsApp
```
[Module Communications] → Compose message + sélectionne destinataires →
Backend POST au webhook n8n (pour chaque destinataire) {action: send_whatsapp, to, message} →
n8n → Envoi message texte → Log dans Botpress
```

---

## Note importante

Le bot Botpress existant (AutonomousNode "Assistant WhatsApp — Le Toit des Anges") est un chatbot de support qui répond aux parents. Les messages proactifs envoyés par l'application (factures, reçus, relances) doivent apparaître dans la même conversation WhatsApp pour que l'expérience soit unifiée. Le parent doit pouvoir répondre à une facture reçue et le bot doit comprendre le contexte ("j'ai une question sur cette facture").
