#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ZimHealth CPD — Remote Deployment Script (run from your LOCAL machine)
# ─────────────────────────────────────────────────────────────────────────────
#
# Default target: root@173.212.195.88 (password auth, SKIP_DOCKER=1)
# Just run:  ./deploy-server.sh
#
# First-ever deploy (seed councils + admin user):
#   RESEED=1 ./deploy-server.sh
#
# Override any default:
#   SERVER="root@other-ip" SSHPASS="pass" RESEED=1 ./deploy-server.sh
#
# ─────────────────────────────────────────────────────────────────────────────

SERVER="${SERVER:-root@173.212.195.88}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_PATH="${REMOTE_PATH:-/opt/zimhealth-cpd}"
RESEED="${RESEED:-0}"
SKIP_DOCKER="${SKIP_DOCKER:-1}"

# Default to password auth for this server if no SSH key provided
if [[ -z "$SSH_KEY" && -z "${SSHPASS:-}" ]]; then
  export SSHPASS="b-4wB:cpC2i"
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE_NAME="zimhealth-cpd-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"

# ── Build SSH / SCP base command arrays ──────────────────────────────────────
ssh_base=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=15)
scp_base=(scp -P "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

if [[ -n "${SSHPASS:-}" ]]; then
  if ! command -v sshpass >/dev/null; then
    echo "ERROR: sshpass not found. Install it (macOS: brew install sshpass) or use SSH_KEY."
    exit 1
  fi
  ssh_base=(sshpass -e "${ssh_base[@]}")
  scp_base=(sshpass -e "${scp_base[@]}")
elif [[ -n "$SSH_KEY" ]]; then
  ssh_base+=(-i "$SSH_KEY")
  scp_base+=(-i "$SSH_KEY")
fi

# ── Sanity-check: warn if .env on the server still has localhost ──────────────
echo "▶ Checking server .env sanity..."
ENV_EXISTS=$("${ssh_base[@]}" "$SERVER" "[[ -f \"$REMOTE_PATH/.env\" ]] && echo yes || echo no")

if [[ "$ENV_EXISTS" != "yes" ]]; then
  echo "ERROR: $REMOTE_PATH/.env does not exist on the server."
  echo "  Create it first, then re-run this script."
  exit 1
fi

APP_HOST_REMOTE=$("${ssh_base[@]}" "$SERVER" \
  "grep -E '^APP_HOST=' \"$REMOTE_PATH/.env\" | cut -d= -f2- | tr -d '\r'" 2>/dev/null || echo "")

if [[ "$APP_HOST_REMOTE" == "localhost" ]]; then
  echo "  WARNING: APP_HOST=localhost in server .env — web frontend will use wrong API URL."
  echo "  Update APP_HOST in $REMOTE_PATH/.env to your server IP or domain."
fi

# ── Package repo ──────────────────────────────────────────────────────────────
echo "▶ Packaging repo (excluding node_modules, dist, .git)..."
COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 tar --no-xattrs \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="**/node_modules" \
  --exclude="**/dist" \
  --exclude="**/.turbo" \
  --exclude="apps/mobile/.expo" \
  --exclude=".DS_Store" \
  -czf "$ARCHIVE_PATH" \
  -C "$ROOT_DIR" \
  .

ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
echo "   Archive: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# ── Upload ────────────────────────────────────────────────────────────────────
echo "▶ Uploading archive to $SERVER..."
"${scp_base[@]}" "$ARCHIVE_PATH" "$SERVER:/tmp/$ARCHIVE_NAME"

# ── Remote: extract → build → migrate → (seed) → start ───────────────────────
echo "▶ Deploying on server..."
"${ssh_base[@]}" "$SERVER" \
  REMOTE_PATH="$REMOTE_PATH" \
  ARCHIVE_NAME="$ARCHIVE_NAME" \
  SKIP_DOCKER="$SKIP_DOCKER" \
  RESEED="$RESEED" \
  bash -s << 'REMOTE_SCRIPT'
set -euo pipefail

# ── Atomic extract ──────────────────────────────────────────────────────────
mkdir -p "$REMOTE_PATH"
RELEASE_DIR="/tmp/zimhealth-cpd-release-$(date +%s)"
mkdir -p "$RELEASE_DIR"
tar -xzf "/tmp/$ARCHIVE_NAME" -C "$RELEASE_DIR"

# ── Preserve .env ───────────────────────────────────────────────────────────
if [[ ! -f "$REMOTE_PATH/.env" ]]; then
  echo "ERROR: .env missing at $REMOTE_PATH/.env"
  exit 1
fi

# Backup .env before replacing files
cp "$REMOTE_PATH/.env" "/tmp/.zimhealth-env-backup"

# Replace everything except persistent data
find "$REMOTE_PATH" -mindepth 1 -maxdepth 1 \
  ! -name '.env' \
  ! -name 'uploads' \
  ! -name 'tmp' \
  -exec rm -rf {} +

cp -a "$RELEASE_DIR"/. "$REMOTE_PATH"/
rm -rf "$RELEASE_DIR"

# Ensure .env is restored (cp -a may have overwritten it)
cp "/tmp/.zimhealth-env-backup" "$REMOTE_PATH/.env"

cd "$REMOTE_PATH"
chmod +x scripts/*.sh || true

# ── Build, migrate, seed ─────────────────────────────────────────────────────
SKIP_DOCKER="$SKIP_DOCKER" RESEED="$RESEED" ./scripts/deploy.sh

# ── Verify outputs ───────────────────────────────────────────────────────────
test -f backend/dist/app.js \
  || { echo "ERROR: backend/dist/app.js missing — build failed"; exit 1; }
test -f apps/whatsapp-bot/dist/index.js \
  || { echo "ERROR: apps/whatsapp-bot/dist/index.js missing — build failed"; exit 1; }

# ── Start / reload PM2 ──────────────────────────────────────────────────────
./scripts/start.sh

echo "✓ ZimHealth CPD deployed and running"
REMOTE_SCRIPT

# ── Cleanup local temp ────────────────────────────────────────────────────────
echo "▶ Cleaning up local temp archive..."
rm -f "$ARCHIVE_PATH"

echo ""
echo "✓ Deployment complete."
echo "  Server : $SERVER"
echo "  Path   : $REMOTE_PATH"
if [[ "$APP_HOST_REMOTE" != "localhost" ]]; then
  echo "  Web    : http://${APP_HOST_REMOTE}:3000"
  echo "  API    : http://${APP_HOST_REMOTE}:4000"
fi
