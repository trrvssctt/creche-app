#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Mise à jour du VPS — https://scolarite.letoitdesanges.com
#
#  Usage (sur le VPS) :   bash /opt/creche-app/scripts/deploy-vps.sh [branche]
#
#  Ce que fait le script, dans l'ordre :
#    1. Verrou : empêche deux déploiements simultanés.
#    2. Git : GitHub fait foi. Les modifications locales du VPS sont sauvegardées
#       (patch dans deploy-backups/) puis écrasées → plus jamais de conflit.
#       .env, uploads/, wa-data/ (session WhatsApp) et node_modules/ sont ignorés
#       par git et ne sont JAMAIS touchés.
#    3. Dépendances : npm ci (ou npm install en secours, puis réinstallation propre).
#    4. Build du frontend dans un dossier temporaire, puis bascule : si le build
#       échoue, le site en ligne continue de tourner sur l'ancien dist/.
#    5. Redémarrage pm2 + test de santé (/health).
#    6. En cas d'échec à n'importe quelle étape : retour automatique à la version
#       précédente, réinstallation et redémarrage.
#
#  Journal complet : /opt/creche-app/logs/deploy.log
# ═══════════════════════════════════════════════════════════════════════════

# ── Configuration ──────────────────────────────────────────────────────────
APP_DIR="/opt/creche-app"
BRANCH="${1:-main}"
REMOTE="origin"
PM2_APP="gestockpro-backend"
ECOSYSTEM="$APP_DIR/backend/ecosystem.config.cjs"
PORT="3000"
HEALTH_URL="http://127.0.0.1:$PORT/health"
PUBLIC_URL="https://scolarite.letoitdesanges.com/"
KEEP_BACKUPS=10

# ── Se relancer depuis une copie ─────────────────────────────────────────────
# Le script vit dans le dépôt : git reset pourrait le modifier pendant qu'il tourne
# (bash lit les scripts au fil de l'eau). On s'exécute donc depuis /tmp.
if [ -z "${DEPLOY_RUNNING_FROM_COPY:-}" ]; then
  COPY="$(mktemp /tmp/deploy-vps.XXXXXX.sh)"
  cp "$0" "$COPY"
  DEPLOY_RUNNING_FROM_COPY=1 exec bash "$COPY" "$@"
fi
trap 'rm -f "$0"' EXIT

set -uo pipefail

LOG_DIR="$APP_DIR/logs"
BACKUP_DIR="$APP_DIR/deploy-backups"
mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG="$LOG_DIR/deploy.log"
exec > >(tee -a "$LOG") 2>&1

STAMP="$(date +%Y%m%d-%H%M%S)"
C_OK=$'\e[32m'; C_ERR=$'\e[31m'; C_WARN=$'\e[33m'; C_INFO=$'\e[36m'; C_0=$'\e[0m'
step() { echo; echo "${C_INFO}▶ $*${C_0}"; }
ok()   { echo "${C_OK}✔ $*${C_0}"; }
warn() { echo "${C_WARN}⚠ $*${C_0}"; }
die()  { echo "${C_ERR}✖ $*${C_0}"; exit 1; }

echo
echo "═══════════ Déploiement $STAMP — branche $BRANCH ═══════════"

# ── 1. Verrou ──────────────────────────────────────────────────────────────
exec 9>"/tmp/creche-deploy.lock"
flock -n 9 || die "Un déploiement est déjà en cours. Réessayez dans quelques minutes."

# ── Prérequis ──────────────────────────────────────────────────────────────
for bin in git node npm pm2 curl; do
  command -v "$bin" >/dev/null || die "Commande manquante : $bin"
done
cd "$APP_DIR" || die "Dossier $APP_DIR introuvable"
[ -d .git ] || die "$APP_DIR n'est pas un dépôt git"
[ -f backend/.env ] || die "backend/.env manquant : le déploiement est annulé (rien n'a été modifié)."

FREE_MB=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
[ "${FREE_MB:-0}" -lt 1024 ] && warn "Peu d'espace disque : ${FREE_MB} Mo libres"

# ── Fonctions ──────────────────────────────────────────────────────────────
install_deps() { # $1 = dossier
  local dir="$1"
  ( cd "$dir" || exit 1
    if [ -f package-lock.json ] && npm ci --no-audit --no-fund; then exit 0; fi
    echo "npm ci a échoué → npm install"
    npm install --no-audit --no-fund && exit 0
    echo "npm install a échoué → réinstallation propre (node_modules supprimé)"
    rm -rf node_modules
    npm cache verify >/dev/null 2>&1
    npm install --no-audit --no-fund
  )
}

build_frontend() {
  rm -rf dist.new
  npx vite build --outDir dist.new --emptyOutDir || return 1
  [ -f dist.new/index.html ] || { echo "dist.new/index.html absent"; return 1; }
  cp dist.new/index.html dist.new/200.html
  rm -rf dist.old
  [ -d dist ] && mv dist dist.old
  mv dist.new dist
}

restart_app() {
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 reload "$ECOSYSTEM" --only "$PM2_APP" --update-env || pm2 restart "$PM2_APP" --update-env
  else
    pm2 start "$ECOSYSTEM" --only "$PM2_APP"
  fi
  pm2 save >/dev/null 2>&1
}

health_check() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo "")"
ROLLING_BACK=0

rollback() {
  [ "$ROLLING_BACK" = 1 ] && return
  ROLLING_BACK=1
  echo
  echo "${C_ERR}✖ Échec : $1${C_0}"
  if [ -z "$PREV_COMMIT" ]; then die "Pas de version précédente connue, retour arrière impossible."; fi
  warn "Retour à la version précédente ${PREV_COMMIT:0:7}…"
  git reset --hard "$PREV_COMMIT"
  if [ -d dist.old ]; then rm -rf dist; mv dist.old dist; fi
  install_deps "$APP_DIR" || warn "Réinstallation frontend en échec"
  install_deps "$APP_DIR/backend" || warn "Réinstallation backend en échec"
  [ -d dist ] || build_frontend || warn "Rebuild frontend en échec"
  restart_app
  if health_check; then
    warn "Le site tourne à nouveau sur l'ancienne version (${PREV_COMMIT:0:7})."
  else
    echo "${C_ERR}✖ Le site ne répond pas même après retour arrière. Voir : pm2 logs $PM2_APP${C_0}"
    pm2 logs "$PM2_APP" --lines 40 --nostream
  fi
  die "Déploiement annulé. Journal : $LOG"
}

# ── 2. Git ─────────────────────────────────────────────────────────────────
step "Récupération du code depuis GitHub ($REMOTE/$BRANCH)"

# Nettoyer un éventuel état git bloqué (crash précédent, merge/rebase à moitié)
rm -f .git/index.lock .git/HEAD.lock
git merge --abort       >/dev/null 2>&1
git rebase --abort      >/dev/null 2>&1
git cherry-pick --abort >/dev/null 2>&1
git am --abort          >/dev/null 2>&1

git fetch --prune "$REMOTE" "$BRANCH" || die "git fetch impossible (réseau ou accès GitHub). Rien n'a été modifié."
TARGET="$(git rev-parse "$REMOTE/$BRANCH")" || die "Branche $REMOTE/$BRANCH introuvable"

# Sauvegarder toute modification faite à la main sur le VPS avant de l'écraser
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  PATCH="$BACKUP_DIR/modifs-locales-$STAMP.patch"
  git diff HEAD > "$PATCH"
  warn "Modifications locales détectées sur le VPS → sauvegardées dans $PATCH puis écrasées"
  git status --short --untracked-files=no
fi
# Fichiers non suivis qui entreraient en conflit avec des fichiers du dépôt
CONFLICTS="$(git diff --name-only HEAD "$TARGET" --diff-filter=A 2>/dev/null | while read -r f; do [ -e "$f" ] && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "$f"; done)"
if [ -n "$CONFLICTS" ]; then
  printf '%s\n' "$CONFLICTS" | tar czf "$BACKUP_DIR/fichiers-remplaces-$STAMP.tar.gz" -T - 2>/dev/null
  warn "Fichiers locaux remplacés par ceux du dépôt (sauvegarde : fichiers-remplaces-$STAMP.tar.gz) :"
  echo "$CONFLICTS"
fi

git checkout -B "$BRANCH" "$TARGET" >/dev/null 2>&1 || git checkout -f -B "$BRANCH" "$TARGET"
git reset --hard "$TARGET"
git branch --set-upstream-to="$REMOTE/$BRANCH" "$BRANCH" >/dev/null 2>&1

if [ "$PREV_COMMIT" = "$TARGET" ]; then
  ok "Code déjà à jour (${TARGET:0:7}) — réinstallation et redémarrage quand même"
else
  ok "Code mis à jour : ${PREV_COMMIT:0:7} → ${TARGET:0:7}"
  git --no-pager log --oneline "${PREV_COMMIT}..${TARGET}" 2>/dev/null | head -20
fi

# Garder uniquement les N dernières sauvegardes
ls -1t "$BACKUP_DIR" 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while read -r f; do rm -f "$BACKUP_DIR/$f"; done

# ── 3. Dépendances ─────────────────────────────────────────────────────────
step "Installation des dépendances frontend"
install_deps "$APP_DIR" || rollback "installation des dépendances frontend"
ok "Frontend : dépendances OK"

step "Installation des dépendances backend"
install_deps "$APP_DIR/backend" || rollback "installation des dépendances backend"
ok "Backend : dépendances OK"

# ── 4. Vérification rapide du backend ──────────────────────────────────────
step "Vérification de la syntaxe du backend"
SYNTAX_ERR=0
while IFS= read -r f; do
  node --check "$f" 2>/tmp/creche-check.err || { SYNTAX_ERR=1; cat /tmp/creche-check.err; }
done < <(git ls-files 'backend/*.js' | grep -v -e '/scripts/' -e '\.test\.js$')
[ "$SYNTAX_ERR" = 0 ] || rollback "erreur de syntaxe dans le backend"
ok "Backend : syntaxe OK"

# ── 5. Build frontend ──────────────────────────────────────────────────────
step "Build du frontend"
build_frontend || rollback "build du frontend"
ok "Frontend construit"

# ── 6. Redémarrage + santé ─────────────────────────────────────────────────
step "Redémarrage de l'application ($PM2_APP)"
restart_app || rollback "redémarrage pm2"

step "Test de santé ($HEALTH_URL)"
health_check || { pm2 logs "$PM2_APP" --lines 40 --nostream; rollback "l'application ne répond pas après redémarrage"; }
ok "Application en ligne"

CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_URL" || true)"
if [ "$CODE" = "200" ]; then ok "$PUBLIC_URL répond (HTTP 200)"; else warn "$PUBLIC_URL répond HTTP $CODE (vérifier nginx / DNS)"; fi

rm -rf dist.old
echo
echo "${C_OK}═══════════ Déploiement terminé : $(git --no-pager log -1 --format='%h %s') ═══════════${C_0}"
