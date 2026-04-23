#!/usr/bin/env bash
set -euo pipefail

# Installs LibreOffice for headless document conversion (soffice).
# Intended for Linux servers during build/deploy.

if command -v soffice >/dev/null 2>&1; then
  echo "==> LibreOffice already installed: $(command -v soffice)"
  exit 0
fi

echo "==> Installing LibreOffice (headless)"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  # libreoffice-core provides soffice in many distros; libreoffice adds full filters.
  apt-get install -y --no-install-recommends libreoffice
  # Common fonts to reduce layout surprises during conversion.
  apt-get install -y --no-install-recommends fonts-dejavu-core fonts-liberation || true
  apt-get clean
  rm -rf /var/lib/apt/lists/*
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y libreoffice || dnf install -y libreoffice-core
elif command -v yum >/dev/null 2>&1; then
  yum install -y libreoffice || yum install -y libreoffice-core
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache libreoffice
else
  echo "ERROR: No supported package manager found to install LibreOffice."
  echo "Install LibreOffice manually and ensure 'soffice' is on PATH, or set LIBREOFFICE_PATH=/path/to/soffice"
  exit 1
fi

if ! command -v soffice >/dev/null 2>&1; then
  echo "ERROR: LibreOffice install completed but 'soffice' not found on PATH."
  echo "Set LIBREOFFICE_PATH=/path/to/soffice in your environment."
  exit 1
fi

echo "==> LibreOffice installed: $(soffice --version 2>/dev/null || command -v soffice)"

