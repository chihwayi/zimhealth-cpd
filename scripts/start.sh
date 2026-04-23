#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing .env in $ROOT_DIR"
  exit 1
fi

if ! command -v pm2 >/dev/null; then
  echo "pm2 not found; installing globally"
  npm i -g pm2
fi

echo "==> Starting processes with PM2"
if [[ ! -f "backend/dist/app.js" ]]; then
  echo "ERROR: backend/dist/app.js not found. Run ./scripts/deploy.sh first."
  exit 1
fi
if [[ ! -f "apps/whatsapp-bot/dist/index.js" ]]; then
  echo "ERROR: apps/whatsapp-bot/dist/index.js not found. Run ./scripts/deploy.sh first."
  exit 1
fi
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Current status"
pm2 status

