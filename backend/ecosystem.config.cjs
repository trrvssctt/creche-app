/**
 * Fichier de configuration PM2 pour le VPS Contabo.
 * Lancement : pm2 start ecosystem.config.cjs
 * Mise à jour : pm2 reload ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'gestockpro-backend',
      script: 'server.js',
      cwd: __dirname, // toujours démarré depuis le dossier backend/
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Les variables sensibles restent dans backend/.env
      // Le server.js charge .env avec un chemin absolu (dirname de server.js)
      // donc même si PM2 est lancé depuis un autre dossier, ça fonctionne
    },
  ],
};
