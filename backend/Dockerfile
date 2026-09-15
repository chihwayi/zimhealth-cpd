# Build from repo root: docker build -f backend/Dockerfile .
FROM node:20-slim AS build
# Coolify injects every app-level env var (including NODE_ENV=production) as a
# build ARG/ENV on every stage — force development here so pnpm still installs
# devDependencies (turbo, typescript, prisma CLI) needed to build.
ENV NODE_ENV=development
# Without openssl present, Prisma's postinstall can't detect the libssl
# version and defaults to the wrong query engine target (1.1.x) — which then
# fails to load at runtime against the image's actual openssl 3.0.x.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false
# backend's db:generate script runs `bash -lc '...'`, a login shell that resets
# PATH via /etc/profile, dropping pnpm's node_modules/.bin. Symlinking the bins
# directly breaks prisma's own realpath-based module resolution, so use exec
# wrapper scripts instead — they resolve the real path the same way a direct
# call would. node-linker=hoisted (root .npmrc, needed for Expo/EAS Android
# builds elsewhere in this monorepo) hoists bins to the workspace root's
# node_modules/.bin instead of each package's own, so resolve there — with a
# fallback to the per-package path in case linking mode changes again.
RUN printf '#!/bin/sh\nif [ -x /app/node_modules/.bin/prisma ]; then exec /app/node_modules/.bin/prisma "$@"; else exec /app/backend/node_modules/.bin/prisma "$@"; fi\n' > /usr/local/bin/prisma \
  && printf '#!/bin/sh\nif [ -x /app/node_modules/.bin/dotenv ]; then exec /app/node_modules/.bin/dotenv "$@"; else exec /app/backend/node_modules/.bin/dotenv "$@"; fi\n' > /usr/local/bin/dotenv \
  && chmod +x /usr/local/bin/prisma /usr/local/bin/dotenv
# prisma generate reads schema.prisma's env("DATABASE_URL") but does not connect —
# a placeholder is enough to satisfy it during the image build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm exec turbo run build --filter=@zimhealth/backend

FROM node:20-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice ffmpeg \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
WORKDIR /app/backend
CMD ["node", "dist/app.js"]
