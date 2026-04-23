#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing .env in $ROOT_DIR"
  echo "Create it with: cp .env.example .env"
  exit 1
fi

echo "==> Checking prerequisites"
command -v docker >/dev/null || { echo "docker not found"; exit 1; }
command -v node >/dev/null || { echo "node not found (need Node 20+)"; exit 1; }

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node version must be >= 20 (found $(node -v))"
  exit 1
fi

if ! command -v pnpm >/dev/null; then
  echo "pnpm not found; enabling via corepack"
  corepack enable
  corepack prepare pnpm@9 --activate
fi

echo "==> Installing dependencies"
pnpm install --frozen-lockfile=false

echo "==> Ensuring dotenv-cli can load .env (safe .env loading)"
# dotenv-cli does not reliably support `--version` across versions; do a real no-op command.
pnpm exec dotenv -e .env -- node -e "process.exit(0)" >/dev/null

echo "==> Starting Postgres + Redis"
docker compose up -d

echo "==> Waiting for database to accept connections"
if command -v pg_isready >/dev/null; then
  for _ in {1..30}; do
    # Prefer POSTGRES_HOST/PORT if exported by caller; otherwise use defaults.
    if pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  # Fallback: just sleep a bit if pg_isready isn't installed
  sleep 3
fi

echo "==> Prisma generate + migrate (deploy-style)"
pushd backend >/dev/null
pnpm db:generate
pnpm exec dotenv -e ../.env -- pnpm exec prisma migrate deploy
popd >/dev/null

echo "==> Building web/api/bot"
pnpm exec dotenv -e .env -- pnpm build

echo "==> Verifying build outputs exist"
test -f backend/dist/app.js || { echo "Missing backend/dist/app.js (build failed)"; exit 1; }
test -f apps/whatsapp-bot/dist/index.js || { echo "Missing apps/whatsapp-bot/dist/index.js (build failed)"; exit 1; }

echo "==> Done. Start services with: ./scripts/start.sh"
