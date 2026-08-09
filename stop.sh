#!/usr/bin/env bash
# Stop the whole platform. Pass --clean to also remove built images.
set -euo pipefail
cd "$(dirname "$0")"
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi
if [ "${1:-}" = "--clean" ]; then
  echo "Stopping and removing images…"; $COMPOSE down --rmi local
else
  echo "Stopping…"; $COMPOSE down
fi
