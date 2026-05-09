#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ZimHealth CPD — Remote ON/OFF Kill Switch (run from your LOCAL machine)
#
# SETUP (one-time):
#   cp scripts/server-auth.example.sh scripts/server-auth.sh
#   # Fill in your server IP and credentials in scripts/server-auth.sh
#   cp server-switch.example.sh server-switch.sh
#   chmod +x server-switch.sh
#
# Usage:
#   ./server-switch.sh off      — stop all services, free ports + resources
#   ./server-switch.sh on       — start all services back up
#   ./server-switch.sh status   — show current PM2 status + port listeners
#
# Override connection at call time (overrides server-auth.sh defaults):
#   SERVER="root@other-ip" SSHPASS="pass" ./server-switch.sh off
# ─────────────────────────────────────────────────────────────────────────────

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <on|off|status>"
  exit 1
fi

case "$ACTION" in
  on|off|status) ;;
  *)
    echo "ERROR: Unknown action '$ACTION'. Use: on | off | status"
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── SSH / connection config ───────────────────────────────────────────────────
if [[ ! -f "$ROOT_DIR/scripts/server-auth.sh" ]]; then
  echo "ERROR: scripts/server-auth.sh not found."
  echo "  Run: cp scripts/server-auth.example.sh scripts/server-auth.sh"
  echo "  Then edit scripts/server-auth.sh with your server IP and credentials."
  exit 1
fi
# shellcheck source=scripts/server-auth.sh
source "$ROOT_DIR/scripts/server-auth.sh"

# ── Execute remote action ─────────────────────────────────────────────────────
case "$ACTION" in

  off)
    echo "▶ Turning ZimHealth CPD OFF on $SERVER..."
    "${ssh_base[@]}" "$SERVER" bash -s << 'REMOTE'
set -euo pipefail
if ! command -v pm2 >/dev/null; then
  echo "  pm2 not found — nothing running."
  exit 0
fi

echo "  Stopping all PM2 processes..."
pm2 stop ecosystem.config.cjs 2>/dev/null || pm2 stop all 2>/dev/null || true
pm2 save

echo ""
pm2 status

echo ""
echo "✓ All services stopped. Ports 3000 / 4000 are now free."
echo "  Postgres and Redis are still running (persistent data layer)."
echo "  Run ./server-switch.sh on to bring everything back up."
REMOTE
    ;;

  on)
    echo "▶ Turning ZimHealth CPD ON on $SERVER..."
    "${ssh_base[@]}" "$SERVER" \
      REMOTE_PATH="$REMOTE_PATH" \
      bash -s << 'REMOTE'
set -euo pipefail
cd "$REMOTE_PATH"

if [[ ! -f "backend/dist/app.js" ]]; then
  echo "ERROR: backend/dist/app.js not found."
  echo "  The server has no build yet. Run ./deploy-server.sh first."
  exit 1
fi

if ! command -v pm2 >/dev/null; then
  echo "  pm2 not found — installing..."
  npm i -g pm2
fi

if pm2 list 2>/dev/null | grep -qE 'zimhealth-(api|bot|web|expo)'; then
  echo "  Existing PM2 processes found — reloading..."
  pm2 reload ecosystem.config.cjs --update-env
else
  echo "  No existing processes — starting fresh..."
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
pm2 status

echo ""
echo "✓ All services are running."
echo "  Expo QR: pm2 logs zimhealth-expo --lines 80 --nostream"
REMOTE
    ;;

  status)
    echo "▶ Checking ZimHealth CPD status on $SERVER..."
    "${ssh_base[@]}" "$SERVER" bash -s << 'REMOTE'
if ! command -v pm2 >/dev/null; then
  echo "  pm2 not installed — no services managed."
  exit 0
fi

pm2 status

echo ""
echo "Port usage:"
ss -tlnp 2>/dev/null | grep -E ':3000|:4000' || echo "  (no listeners on 3000/4000)"
REMOTE
    ;;

esac
