#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ZimHealth CPD — Shared SSH connection config
# Sourced by deploy-server.sh and server-switch.sh
#
# SETUP (one-time):
#   cp scripts/server-auth.example.sh scripts/server-auth.sh
#   # Edit server-auth.sh with your real values — it is gitignored.
# ─────────────────────────────────────────────────────────────────────────────

SERVER="${SERVER:-root@YOUR_SERVER_IP}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"                   # path to private key, e.g. ~/.ssh/id_rsa
REMOTE_PATH="${REMOTE_PATH:-/opt/zimhealth-cpd}"

# Choose ONE of: SSH key (preferred) or password via sshpass
#
# Option A — SSH key (set SSH_KEY above, leave SSHPASS unset)
#
# Option B — Password auth (requires: brew install sshpass  /  apt install sshpass)
#   Uncomment the line below and replace with your password:
# export SSHPASS="your-server-password"

# ── Build SSH / SCP command arrays (do not edit below this line) ──────────────
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
