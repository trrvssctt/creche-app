# WhatsApp — envoi en arrière-plan (WhatsApp Web headless)

Remplace l'ancienne chaîne Botpress → n8n → API Meta (templates) et les liens `wa.me`.
Principe détaillé : `RAPPORT_EMULATION_WHATSAPP.md`.

Le backend lance un Chromium headless par établissement (`whatsapp-web.js`), ouvre
web.whatsapp.com lié au téléphone de l'école, et envoie les messages en appelant les
fonctions internes de WhatsApp Web. Aucun template : le texte est envoyé tel quel.

## Liaison du téléphone

Menu **Communication WhatsApp → Connexion** (rôles ADMIN / DIRECTEUR) :
1. « Connecter WhatsApp » → un QR code s'affiche (10 à 60 s) ;
2. sur le téléphone de l'école : Appareils connectés → Connecter un appareil → scanner ;
   (ou « Lier avec le numéro de téléphone » avec le code à 8 caractères proposé).

La session est gardée dans `backend/wa-data/` et restaurée automatiquement au redémarrage.
« Mettre en pause » ferme le navigateur sans délier ; « Délier » oblige à rescanner.

## Code

| Fichier | Rôle |
|---|---|
| `backend/services/WhatsAppService.js` | API unique : `sendWhatsApp`, `sendDocument`, `sendBulk` (options : `tenantId`, `category`, `reference`, `wait`) |
| `backend/services/whatsapp/WhatsAppSession.js` | Session : états, QR, watchdog, reconnexion avec backoff, file d'envoi |
| `backend/services/whatsapp/WhatsAppManager.js` | Une session par établissement, restauration au démarrage, arrêt propre |
| `backend/services/whatsapp/webVersion.js` | Épinglage de la version de WhatsApp Web (registre wa-version, build de plus de 12 h) |
| `backend/services/whatsapp/pacing.js` | Délais aléatoires, plafond journalier progressif, disjoncteur |
| `backend/services/whatsapp/store.js` | Tables `whatsapp_accounts`, `whatsapp_messages` (statut + accusés) |
| `backend/routes/whatsapp.routes.js` | `/api/whatsapp/status, connect, pairing-code, disconnect, logout, send, send-bulk, messages` |
| `components/WhatsAppConnexion.tsx`, `services/whatsappService.ts` | Front : panneau QR / état, client API |

## Déploiement VPS

```bash
cd backend && npm install          # installe whatsapp-web.js + Chrome (puppeteer)
# Si Chrome ne démarre pas, installer ses dépendances système :
sudo apt install -y libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2t64 fonts-liberation libxss1 libgtk-3-0
pm2 reload ecosystem.config.cjs
```

- Compter environ 300 Mo de RAM par établissement connecté (process Chromium séparé de Node).
- `backend/wa-data/` **est** la session WhatsApp : ne jamais la committer ni la partager, la sauvegarder comme un mot de passe.

## Variables d'environnement (toutes facultatives)

| Variable | Défaut | Effet |
|---|---|---|
| `WA_ENABLED` | `true` | `false` : pas de restauration des sessions au démarrage |
| `WA_DATA_PATH` | `backend/wa-data` | Dossier des profils Chromium |
| `WA_CHROME_PATH` | Chrome de puppeteer | Chemin d'un Chrome/Chromium système |
| `WA_WEB_VERSION` | `auto` | `off` = pas d'épinglage, ou version imposée `2.3000.xxx` |
| `WA_WEB_VERSION_REMOTE` | GitHub wa-version | Gabarit d'URL du HTML archivé (`{version}`) |
| `WA_DAILY_CAPS` | `20,40,80,160,320,640,1000` | Plafond par jour d'ancienneté de la liaison |
| `WA_PACING` | `on` | `off` : pas de plafond ni de disjoncteur |
| `WA_DELAY_MIN_MS` / `WA_DELAY_MAX_MS` | `3000` / `10000` | Délai entre deux messages |
| `WA_BREAKER_FAILURES` / `WA_BREAKER_PAUSE_MS` | `5` / `900000` | Disjoncteur |
| `WA_DEFAULT_TENANT_ID` | — | Établissement utilisé si un envoi n'en précise pas |
| `WA_PROXY` | — | Proxy Chromium |

## Risques

- L'automatisation d'un compte WhatsApp est contraire aux CGU de WhatsApp : le numéro peut
  être restreint (état `RESTRICTED`). Les plafonds et délais réduisent ce risque sans l'annuler.
- Une mise à jour de WhatsApp Web peut casser l'envoi : la version est épinglée, et
  `whatsapp-web.js` est figé en 1.34.7 (à mettre à jour volontairement, après test).
