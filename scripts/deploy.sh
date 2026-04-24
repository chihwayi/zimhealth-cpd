#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ZimHealth CPD — Server-side Build & Migration Script
# Runs ON the server after the repo has been extracted by deploy-server.sh.
#
# Environment flags (set before calling this script):
#   SKIP_DOCKER=1   — skip `docker compose up`. Use when Postgres/Redis run
#                     natively on the server (not in containers).
#   RESEED=1        — run `prisma db seed` after migrations (safe: uses upsert).
#                     Use on first deploy or after a full DB wipe.
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_DOCKER="${SKIP_DOCKER:-0}"
RESEED="${RESEED:-0}"

# ── .env check ────────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  echo "ERROR: .env not found in $ROOT_DIR"
  echo "  Create it: cp .env.example .env && nano .env"
  exit 1
fi

# Warn if APP_HOST is still localhost (will break Vite build API URL)
APP_HOST_VAL="$(grep -E '^APP_HOST=' .env | cut -d= -f2- | tr -d '\r' || echo '')"
if [[ "$APP_HOST_VAL" == "localhost" ]]; then
  echo ""
  echo "  WARNING: APP_HOST=localhost in .env"
  echo "  The web frontend will embed 'localhost' as its API base URL."
  echo "  Update APP_HOST to your server's domain or IP and re-deploy."
  echo ""
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────
echo "==> Checking prerequisites"

# Node
command -v node >/dev/null || { echo "ERROR: node not found (need Node 20+)"; exit 1; }
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "ERROR: Node.js >= 20 required (found $(node -v))"
  exit 1
fi
echo "    node   : $(node -v)"

# pnpm
if ! command -v pnpm >/dev/null; then
  echo "    pnpm not found; enabling via corepack..."
  corepack enable
  corepack prepare pnpm@9 --activate
fi
echo "    pnpm   : $(pnpm -v)"

# ── LibreOffice ───────────────────────────────────────────────────────────────
# LibreOffice is used to convert DOCX/PPTX uploads to PDF for the media worker.
echo "==> Checking LibreOffice (required for DOCX/PPTX → PDF conversion)"

if [[ "$(uname -s)" == "Linux" ]]; then
  if [[ $EUID -ne 0 ]]; then
    echo "    WARN: Not running as root — cannot auto-install LibreOffice."
    echo "    Install manually: apt-get install -y libreoffice"
    echo "    Then set LIBREOFFICE_PATH=/usr/bin/soffice in your .env"
  else
    ./scripts/install-libreoffice.sh
  fi

  # Auto-detect soffice path and write it into .env if not already set
  SOFFICE_PATH="$(command -v soffice 2>/dev/null || echo '')"
  if [[ -n "$SOFFICE_PATH" ]]; then
    CURRENT_LO_PATH="$(grep -E '^LIBREOFFICE_PATH=' .env | cut -d= -f2- | tr -d '\r' || echo '')"
    if [[ -z "$CURRENT_LO_PATH" ]]; then
      echo "    Auto-setting LIBREOFFICE_PATH=$SOFFICE_PATH in .env"
      # Append or update LIBREOFFICE_PATH
      if grep -qE '^LIBREOFFICE_PATH=' .env; then
        sed -i "s|^LIBREOFFICE_PATH=.*|LIBREOFFICE_PATH=$SOFFICE_PATH|" .env
      else
        echo "LIBREOFFICE_PATH=$SOFFICE_PATH" >> .env
      fi
    else
      echo "    LibreOffice path already set: $CURRENT_LO_PATH"
    fi
  fi
else
  echo "    Skipping LibreOffice check on non-Linux host."
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo "==> Installing dependencies"
pnpm install --frozen-lockfile=false

# ── Verify dotenv-cli works ───────────────────────────────────────────────────
echo "==> Verifying dotenv-cli"
pnpm exec dotenv -e .env -- node -e "process.exit(0)" >/dev/null

# ── Database / Redis ──────────────────────────────────────────────────────────
if [[ "$SKIP_DOCKER" == "1" ]]; then
  echo "==> Skipping docker compose (SKIP_DOCKER=1) — using native Postgres/Redis"

  # Verify Postgres is reachable before we try migrations
  DB_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\r' || echo '')"
  if [[ -z "$DB_URL" ]]; then
    echo "ERROR: DATABASE_URL not set in .env"
    exit 1
  fi

  if command -v pg_isready >/dev/null; then
    PG_HOST="$(node -e "const u=new URL(process.env.DATABASE_URL||''); console.log(u.hostname)" 2>/dev/null || echo 'localhost')"
    PG_PORT="$(node -e "const u=new URL(process.env.DATABASE_URL||''); console.log(u.port||5432)" 2>/dev/null || echo '5432')"
    echo "==> Waiting for Postgres at $PG_HOST:$PG_PORT..."
    WAITED=0
    until pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; do
      if [[ $WAITED -ge 30 ]]; then
        echo "ERROR: Postgres did not become ready after 30 s. Check DATABASE_URL and pg service."
        exit 1
      fi
      sleep 1
      WAITED=$((WAITED + 1))
    done
    echo "    Postgres ready."
  else
    echo "    pg_isready not found; skipping DB readiness check."
    sleep 2
  fi
else
  # docker-compose path (local / containerised deployments)
  command -v docker >/dev/null || { echo "ERROR: docker not found (needed when SKIP_DOCKER != 1)"; exit 1; }
  echo "==> Starting Postgres + Redis via docker compose"
  docker compose up -d

  echo "==> Waiting for Postgres to accept connections..."
  WAITED=0
  if command -v pg_isready >/dev/null; then
    until pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1; do
      if [[ $WAITED -ge 30 ]]; then
        echo "ERROR: Postgres did not become ready after 30 s."
        exit 1
      fi
      sleep 1
      WAITED=$((WAITED + 1))
    done
  else
    sleep 4
  fi
  echo "    Postgres ready."
fi

# ── Prisma: generate client + run all pending migrations ─────────────────────
echo "==> Prisma generate + migrate deploy"
pushd backend >/dev/null
pnpm db:generate
pnpm exec dotenv -e ../.env -- pnpm exec prisma migrate deploy
popd >/dev/null

# ── Optional: seed (safe because seed uses upsert throughout) ─────────────────
if [[ "$RESEED" == "1" ]]; then
  echo "==> Running Prisma seed (RESEED=1)"
  echo "    Seeding councils, admin user, sample courses..."
  pushd backend >/dev/null
  pnpm exec dotenv -e ../.env -- pnpm exec ts-node prisma/seed.ts
  popd >/dev/null
  echo "    Seed complete."
else
  echo "==> Skipping seed (pass RESEED=1 on first deploy or after a DB wipe)"
fi

# ── Build all packages ────────────────────────────────────────────────────────
echo "==> Building web / api / bot"
pnpm exec dotenv -e .env -- pnpm build

# ── Verify outputs ────────────────────────────────────────────────────────────
echo "==> Verifying build outputs"
test -f backend/dist/app.js \
  || { echo "ERROR: backend/dist/app.js missing — build failed"; exit 1; }
test -f apps/whatsapp-bot/dist/index.js \
  || { echo "ERROR: apps/whatsapp-bot/dist/index.js missing — build failed"; exit 1; }
echo "    backend/dist/app.js             OK"
echo "    apps/whatsapp-bot/dist/index.js OK"

# Check web dist (vite output location)
if [[ -d apps/web/dist ]]; then
  echo "    apps/web/dist/                  OK"
else
  echo "    WARNING: apps/web/dist/ not found — check vite build output"
fi

echo "==> Build complete. Run ./scripts/start.sh to launch services."
