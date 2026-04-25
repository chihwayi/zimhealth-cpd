#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ZimHealth CPD — PM2 Start / Reload Script
#
# Handles two scenarios transparently:
#   • First deploy  → pm2 start  (processes don't exist yet)
#   • Re-deploy     → pm2 reload (graceful in-place reload of new dist files)
#
# pm2 startOrReload covers both cases without manual intervention.
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env not found in $ROOT_DIR"
  exit 1
fi

# ── Guard: build outputs must exist ──────────────────────────────────────────
if [[ ! -f "backend/dist/app.js" ]]; then
  echo "ERROR: backend/dist/app.js not found. Run ./scripts/deploy.sh first."
  exit 1
fi
if [[ ! -f "apps/whatsapp-bot/dist/index.js" ]]; then
  echo "ERROR: apps/whatsapp-bot/dist/index.js not found. Run ./scripts/deploy.sh first."
  exit 1
fi

# Expo check — warn if mobile .env is missing (no hard exit; Expo can still start)
if [[ ! -f "apps/mobile/.env" ]]; then
  echo "  WARNING: apps/mobile/.env not found."
  echo "  The zimhealth-expo process will start but the mobile app will not know"
  echo "  which API to connect to. Create apps/mobile/.env with:"
  echo "    EXPO_PUBLIC_API_URL=http://$(hostname -I | awk '{print $1}'):4000"
  echo "    EXPO_PUBLIC_API_URL_IOS=http://$(hostname -I | awk '{print $1}'):4000"
  echo "    EXPO_PUBLIC_API_URL_ANDROID=http://$(hostname -I | awk '{print $1}'):4000"
fi

# ── Ensure PM2 is installed ───────────────────────────────────────────────────
if ! command -v pm2 >/dev/null; then
  echo "==> pm2 not found; installing globally..."
  npm i -g pm2
fi

# ── Start or gracefully reload all processes ──────────────────────────────────
echo "==> Starting / reloading ZimHealth services with PM2..."

# pm2 startOrRestart: starts if not running, restarts if already running.
# For zero-downtime reload on subsequent deploys, use `pm2 reload` instead —
# but that requires SIGINT handlers in the app. startOrRestart is safe for all cases.

if pm2 list 2>/dev/null | grep -qE 'zimhealth-(api|bot|web)'; then
  echo "    Existing PM2 processes found — reloading with new build..."
  pm2 reload ecosystem.config.cjs --update-env
else
  echo "    No existing processes — starting fresh..."
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "==> Current PM2 status"
pm2 status

echo ""
echo "✓ All ZimHealth services are running."
echo "  Logs (all)   : pm2 logs"
echo "  Logs (expo)  : pm2 logs zimhealth-expo --lines 80"
echo "  Monitor      : pm2 monit"
echo ""
echo "  To get the Expo tunnel URL / QR code for your physical device:"
echo "    pm2 logs zimhealth-expo --lines 80 --nostream"
echo "  Then open Expo Go on your device and scan the QR code."
