# Build from repo root: docker build -f apps/web/Dockerfile .
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false
# Baked into the static bundle at build time — must be passed as a build arg.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm exec turbo run build --filter=@zimhealth/web

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app/scripts/web-server.mjs /app/scripts/web-server.mjs
COPY --from=build /app/apps/web/dist /app/apps/web/dist
ENV WEB_PORT=3000
ENV WEB_HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "scripts/web-server.mjs"]
