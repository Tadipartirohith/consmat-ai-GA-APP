#!/usr/bin/env bash
# =============================================================================
# Consmat AI — ONE COMMAND to build + launch the whole platform locally.
#   ./start.sh
# Brings up the backend API + all four frontends (buyer/vendor/admin/operator)
# on Docker, waits for health, and prints every URL + demo login.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

B='\033[0;34m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
say(){ echo -e "${B}▸${N} $*"; }; ok(){ echo -e "${G}✓${N} $*"; }

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else echo -e "${R}Docker Compose not found. Install Docker Desktop.${N}"; exit 1; fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${R}Docker daemon is not running. Start Docker Desktop and retry.${N}"; exit 1
fi

[ -f .env ] || { cp .env.example .env; ok "Created .env from .env.example"; }
# shellcheck disable=SC1091
set -a; . ./.env; set +a

say "Building images and starting all services (first run downloads/builds — a few minutes)…"
$COMPOSE up -d --build

say "Waiting for the backend API to become healthy…"
tries=90
until curl -fsS "http://localhost:${BACKEND_PORT:-3000}/health" >/dev/null 2>&1; do
  tries=$((tries-1)); [ $tries -le 0 ] && { echo -e "${R}Backend didn't come up. Logs:${N}"; $COMPOSE logs --tail=40 backend; exit 1; }
  sleep 2
done
ok "Backend healthy. Frontends are served by nginx."

echo ""
echo -e "${G}================= Consmat AI is LIVE =================${N}"
echo -e "  🛒 Buyer      ${B}http://localhost:${BUYER_PORT:-8080}${N}"
echo -e "  🏭 Vendor     ${B}http://localhost:${VENDOR_PORT:-8081}${N}"
echo -e "  🛡️  Admin      ${B}http://localhost:${ADMIN_PORT:-8082}${N}"
echo -e "  🚚 Operator   ${B}http://localhost:${DISPATCH_PORT:-8083}${N}"
echo -e "  ⚙️  API + docs ${B}http://localhost:${BACKEND_PORT:-3000}/docs${N}"
echo ""
echo -e "  Demo logins (password: ${Y}consmat123${N}):"
echo -e "    Buyer    ${Y}buyer@consmat.com${N}"
echo -e "    Vendor   ${Y}vendor@consmat.com${N}"
echo -e "    Admin    ${Y}admin@consmat.com${N}"
echo -e "    Operator ${Y}operator@consmat.in${N}"
echo ""
echo -e "  Edit business data:  ${B}backend/config.yaml${N}   (restart backend to apply)"
echo -e "  Stop:  ${B}./stop.sh${N}    Logs:  ${B}$COMPOSE logs -f${N}"
echo -e "${G}=====================================================${N}"
