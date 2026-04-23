#!/usr/bin/env bash
set -euo pipefail

if ! command -v pm2 >/dev/null; then
  echo "pm2 not installed"
  exit 0
fi

pm2 status

