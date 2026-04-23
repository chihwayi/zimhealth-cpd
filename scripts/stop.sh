#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null; then
  echo "pm2 not installed; nothing to stop"
  exit 0
fi

pm2 stop ecosystem.config.cjs || true
pm2 delete ecosystem.config.cjs || true
pm2 save || true

