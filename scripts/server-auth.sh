#!/usr/bin/env bash
# Shared SSH connection config — sourced by deploy-server.sh and server-switch.sh
# Override any value with environment variables before calling the parent script.

SERVER="${SERVER:-root@173.212.195.88}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_PATH="${REMOTE_PATH:-/opt/zimhealth-cpd}"

if [[ -z "$SSH_KEY" && -z "${SSHPASS:-}" ]]; then
  export SSHPASS="b-4wB:cpC2i"
fi

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
