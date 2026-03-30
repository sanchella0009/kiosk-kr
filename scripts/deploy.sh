#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-web}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if [ ! -d .git ]; then
  echo "This directory is not a git repository yet." >&2
  exit 1
fi

git pull --ff-only

case "$MODE" in
  web)
    sudo docker compose up -d kiosk-web nginx
    sudo docker compose exec -T kiosk-web npm run build
    sudo docker compose restart kiosk-web nginx
    ;;
  all)
    sudo docker compose up -d --build --force-recreate --renew-anon-volumes kiosk-web kiosk-music
    sudo docker compose up -d --force-recreate kiosk-ws kiosk-bot nginx
    ;;
  *)
    echo "Usage: ./scripts/deploy.sh [web|all]" >&2
    exit 1
    ;;
esac

sudo docker compose ps
