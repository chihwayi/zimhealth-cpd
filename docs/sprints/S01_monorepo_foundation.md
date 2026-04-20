# Sprint 01 — Monorepo Foundation

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Get the monorepo running locally with all tooling, Docker services, and environment in place. No feature code yet — just the scaffold that everything else builds on.

---

## Inputs (already done — verify they exist)

- [ ] `pnpm-workspace.yaml` — lists `apps/*`, `backend`, `packages/*`
- [ ] `turbo.json` — build, dev, test, lint, type-check tasks
- [ ] `package.json` (root) — turbo + prettier dev deps
- [ ] `docker-compose.yml` — postgres:15 + redis:7
- [ ] `.env.example` — all required env vars documented
- [ ] `.gitignore` — node_modules, dist, .env, .expo
- [ ] `packages/types/` — user.ts, course.ts, points.ts, index.ts, package.json
- [ ] `packages/ai-client/` — multi-provider AI client (Anthropic, OpenAI, Gemini, Ollama)
- [ ] `backend/package.json`
- [ ] `apps/web/package.json`

---

## Tasks

### T01.1 — Install pnpm globally (if not already installed)
```bash
RUN COMMAND: npm install -g pnpm@9
```
Verify: `pnpm --version` prints `9.x.x`

---

### T01.2 — Install Turborepo globally
```bash
RUN COMMAND: pnpm add -g turbo
```
Verify: `turbo --version` prints `2.x.x`

---

### T01.3 — Create TypeScript config at root

CREATE FILE: `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

### T01.4 — Create TypeScript config for backend

CREATE FILE: `backend/tsconfig.json`
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### T01.5 — Create TypeScript config for web app

CREATE FILE: `apps/web/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

CREATE FILE: `apps/web/tsconfig.node.json`
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
```

---

### T01.6 — Create Vite config for web app

CREATE FILE: `apps/web/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'NursePro CPD',
        short_name: 'NursePro',
        description: 'Continuing Professional Development for Zimbabwe Healthcare Professionals',
        theme_color: '#14b8a6',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.nursepro\.co\.zw\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 3000 },
});
```

---

### T01.7 — Create TailwindCSS config

CREATE FILE: `apps/web/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a',
        },
        accent: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
```

CREATE FILE: `apps/web/postcss.config.js`
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

---

### T01.8 — Create main HTML entry point

CREATE FILE: `apps/web/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#14b8a6" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>NursePro CPD</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### T01.9 — Create web app entry files

CREATE FILE: `apps/web/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

CREATE FILE: `apps/web/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply antialiased; }
  body { @apply bg-slate-50 text-slate-900; }
  * { @apply border-slate-200; }
}
```

CREATE FILE: `apps/web/src/App.tsx`
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-8 text-2xl font-bold text-primary-600">NursePro CPD — Sprint 01 ✅</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

---

### T01.10 — Create backend entry file

CREATE FILE: `backend/src/app.ts`
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-api', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NursePro API running on port ${PORT}`);
});

export default app;
```

---

### T01.11 — Create `.env` from example

```bash
RUN COMMAND: cp .env.example .env
```
Then EDIT `.env` and fill in local dev values:
- `DATABASE_URL` — use the docker-compose defaults: `postgresql://nursepro:nursepro_dev@localhost:5432/nursepro`
- `REDIS_URL` — `redis://localhost:6379`
- `JWT_SECRET` — any 32+ character random string for dev

---

### T01.12 — Start Docker services

```bash
RUN COMMAND: docker-compose up -d
```
Verify: `docker-compose ps` shows both `postgres` and `redis` as `Up`

---

### T01.13 — Install all dependencies

```bash
RUN COMMAND: pnpm install
```
Verify: no errors, `node_modules` directories created in each package.

---

### T01.14 — GitHub Actions CI pipeline

CREATE FILE: `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: nursepro
          POSTGRES_PASSWORD: nursepro_dev
          POSTGRES_DB: nursepro
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://nursepro:nursepro_dev@localhost:5432/nursepro
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: ci-test-secret-do-not-use-in-prod
```

---

## Validation Checklist

- [ ] `docker-compose up -d` starts without errors
- [ ] `pnpm install` completes without errors
- [ ] `cd apps/web && pnpm dev` → browser opens at `http://localhost:3000` showing "NursePro CPD — Sprint 01 ✅"
- [ ] `cd backend && pnpm dev` → API starts on port 4000
- [ ] `curl http://localhost:4000/health` → returns `{"status":"ok","service":"nursepro-api",...}`
- [ ] TypeScript files in `packages/types` have no TS errors
- [ ] `packages/ai-client` structure is in place with all 4 providers

**Sign-off:** Claude Code reviews output and marks sprint complete before S02 begins.
