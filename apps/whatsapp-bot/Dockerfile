# Build from repo root: docker build -f apps/whatsapp-bot/Dockerfile .
FROM node:20-slim AS build
# Coolify injects every app-level env var (including NODE_ENV=production) as a
# build ARG/ENV on every stage — force development here so pnpm still installs
# devDependencies (turbo, typescript) needed to build. Same fix as backend/Dockerfile.
ENV NODE_ENV=development
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm exec turbo run build --filter=@zimhealth/whatsapp-bot

FROM node:20-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV BOT_PORT=4100
EXPOSE 4100
WORKDIR /app/apps/whatsapp-bot
CMD ["node", "dist/index.js"]
