#!/usr/bin/env bash
set -euo pipefail

# Single-command deployment script (modeled after ../lomagundi-construction-services-ltd/deploy.sh)
#
# Usage (SSH key):
#   SERVER="root@1.2.3.4" SSH_PORT=22 SSH_KEY="$HOME/.ssh/id_ed25519" REMOTE_PATH="/opt/zimhealth-cpd" ./deploy-server.sh
#
# Usage (password via sshpass):
#   SERVER="root@1.2.3.4" SSH_PORT=22 SSHPASS="your-password" REMOTE_PATH="/opt/zimhealth-cpd" ./deploy-server.sh
#
# Notes:
# - You must create/edit REMOTE_PATH/.env on the server before first run (or copy it in manually).
# - This script uploads a tarball of the repo (excluding heavy folders) and runs the server-side scripts.

SERVER="${SERVER:-}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_PATH="${REMOTE_PATH:-/opt/zimhealth-cpd}"

if [[ -z "$SERVER" ]]; then
  echo "Missing SERVER. Example: SERVER=\"root@173.212.195.88\" ./deploy-server.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE_NAME="zimhealth-cpd-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"

ssh_base=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no)
scp_base=(scp -P "$SSH_PORT" -o StrictHostKeyChecking=no)

if [[ -n "${SSHPASS:-}" ]]; then
  if ! command -v sshpass >/dev/null; then
    echo "sshpass not found. Install it (macOS: brew install sshpass) or use SSH_KEY."
    exit 1
  fi
  ssh_base=(sshpass -e "${ssh_base[@]}")
  scp_base=(sshpass -e "${scp_base[@]}")
elif [[ -n "$SSH_KEY" ]]; then
  ssh_base+=(-i "$SSH_KEY")
  scp_base+=(-i "$SSH_KEY")
fi

echo "▶ Packaging repo..."
COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 tar --no-xattrs \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="**/node_modules" \
  --exclude="**/dist" \
  --exclude="**/.turbo" \
  --exclude=".DS_Store" \
  -czf "$ARCHIVE_PATH" \
  -C "$ROOT_DIR" \
  .

echo "▶ Uploading archive to server..."
"${scp_base[@]}" "$ARCHIVE_PATH" "$SERVER:/tmp/$ARCHIVE_NAME"

echo "▶ Deploying on server (extract + install + migrate + build + start)..."
"${ssh_base[@]}" "$SERVER" bash -lc "set -euo pipefail
  mkdir -p \"$REMOTE_PATH\"

  # Atomic-ish deploy:
  # - Extract to a temp dir first (so a failed tar doesn't wipe the app)
  # - Then replace project files while preserving .env
  RELEASE_DIR=\"/tmp/zimhealth-cpd-release-\$(date +%s)\"
  mkdir -p \"\$RELEASE_DIR\"
  tar -xzf \"/tmp/$ARCHIVE_NAME\" -C \"\$RELEASE_DIR\"

  # Preserve .env if it exists; require it for runtime
  if [[ ! -f \"$REMOTE_PATH/.env\" ]]; then
    echo \"ERROR: .env missing at $REMOTE_PATH/.env\"
    echo \"Create it first: cp .env.example .env && nano .env\"
    exit 1
  fi

  # Replace everything except .env
  find \"$REMOTE_PATH\" -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
  cp -a \"\$RELEASE_DIR\"/. \"$REMOTE_PATH\"/
  rm -rf \"\$RELEASE_DIR\"

  cd \"$REMOTE_PATH\"

  chmod +x scripts/*.sh || true
  ./scripts/deploy.sh

  # Hard fail if build outputs aren't present (prevents PM2 starting half a stack)
  test -f backend/dist/app.js || { echo \"ERROR: Missing backend/dist/app.js\"; exit 1; }
  test -f apps/whatsapp-bot/dist/index.js || { echo \"ERROR: Missing apps/whatsapp-bot/dist/index.js\"; exit 1; }

  ./scripts/start.sh
  echo \"✓ Deployed and started ZimHealth services\"
"

echo "▶ Cleaning up local temp archive..."
rm -f "$ARCHIVE_PATH"

echo "✓ Done."
