# ZimHealth CPD

> **Learn. Earn. Advance.**
> Multi-council Continuing Professional Development platform for Zimbabwean health professionals.

ZimHealth CPD removes every barrier between health professionals and their annual CPD requirements. Three channels — web, mobile, and WhatsApp — ensure practitioners in urban hospitals and rural clinics can both earn renewal points, regardless of council, device, or connectivity.

---

## Channels

| Channel | Stack | Audience |
|---|---|---|
| **Web App** | React 18 + Vite + TailwindCSS | Learners, Creators, Council Officers, Admins |
| **Mobile App** | React Native + Expo (offline-first) | Learners — works without data |
| **WhatsApp Bot** | Node.js + Meta Cloud API | Learners — any phone, no app required |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **API** | Node.js 20, Express 4, Prisma 6, PostgreSQL 15, Redis 7, Zod |
| **Web** | React 18, Vite, TailwindCSS 3, TanStack Query v5, Zustand v5 |
| **Mobile** | React Native 0.76, Expo 52, NativeWind v4 |
| **AI** | Anthropic Claude, OpenAI, Google Gemini, Ollama (multi-provider, auto-fallback) |
| **Payments** | Paynow Zimbabwe (EcoCash/OneMoney), Stripe |
| **WhatsApp** | Meta WhatsApp Cloud API (primary), 360dialog (fallback) |
| **Tooling** | pnpm workspaces, Turborepo, Vitest, TypeScript 5 |

---

## Project Structure

```
zimhealth-cpd/
├── apps/
│   ├── web/                React PWA — learner, creator, council, admin portals
│   ├── mobile/             Expo app — offline-first learner experience
│   └── whatsapp-bot/       WhatsApp bot — enroll, learn, and earn points via chat
├── backend/                Express API, Prisma ORM, Bull job queues
├── packages/
│   ├── ai-client/          Multi-provider AI abstraction (Claude / OpenAI / Gemini / Ollama)
│   ├── types/              Shared TypeScript types
│   └── ui/                 Shared React component library
├── docs/
│   └── ARCHITECTURE.md     Platform architecture, data model, role definitions
├── scripts/                Server-side deploy, start, stop, LibreOffice install
└── deploy-server.sh        One-command remote deployment (run locally)
```

---

## Local Development

**Prerequisites:** Node.js 20+, pnpm 9+, Docker

```bash
# 1. Clone and install
git clone https://github.com/chihwayi/zimhealth-cpd.git
cd zimhealth-cpd
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum. AI keys optional.

# 3. Start Postgres + Redis
docker compose up -d

# 4. Migrate database and seed reference data
cd backend && pnpm db:migrate && pnpm db:seed && cd ..

# 5. Start all services
pnpm dev          # API :4000 · Web :3000 · Bot :4100
```

**Mobile (separate terminal):**
```bash
cd apps/mobile && pnpm install && npx expo start
```

### Dev Credentials (after seed)

All demo accounts share one password: **`Demo@1234`**

| Role | Email |
|---|---|
| Admin | admin@zimhealthcpd.co.zw |
| Content Manager | creator@zimhealthcpd.co.zw |
| Content Manager (NCZ) | creator.ncz@zimhealthcpd.co.zw |
| Content Manager (MDPCZ) | creator.mdpcz@zimhealthcpd.co.zw |
| Content Manager (PCZ) | creator.pcz@zimhealthcpd.co.zw |
| NCZ Officer | officer@ncz.co.zw |
| Council Officer | officer@council.co.zw |
| Learner | grace@zimhealthcpd.co.zw |
| Learner | chipo@zimhealthcpd.co.zw |
| Learner (MDPCZ) | learner.mdpcz@zimhealthcpd.co.zw |
| Learner (PCZ) | learner.pcz@zimhealthcpd.co.zw |

---

## Deployment

The repo ships a zero-touch deployment pipeline — one command packages, uploads, migrates, builds, and reloads PM2 on the server.

### First-time server setup

SSH into your server and create the environment file:

```bash
mkdir -p /opt/zimhealth-cpd
cp /opt/zimhealth-cpd/.env.example /opt/zimhealth-cpd/.env
nano /opt/zimhealth-cpd/.env
```

Key variables to set:

```env
APP_HOST=your-server-ip-or-domain   # replaces localhost everywhere
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=a-long-random-string
```

### Deploy

```bash
# Re-deploy (after first setup):
./deploy-server.sh

# First-ever deploy — also seeds councils and admin user:
RESEED=1 ./deploy-server.sh
```

The script will:
1. Package the repo (excluding `node_modules`, `dist`, `.git`)
2. Upload to server via SCP
3. Atomically replace project files (preserving `.env`)
4. Install/verify LibreOffice for DOCX/PPTX conversion
5. Install dependencies, run all pending Prisma migrations
6. Build web, API, and bot
7. Gracefully reload PM2 (or start fresh on first deploy)

PM2 manages three processes: `zimhealth-api`, `zimhealth-bot`, `zimhealth-web`.

---

## AI Providers

Set at least one key. The platform auto-falls back to a deterministic recommendation engine if no AI is available.

| Provider | Env var | Default model |
|---|---|---|
| Anthropic Claude *(recommended)* | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-1.5-pro` |
| Ollama (self-hosted) | `OLLAMA_BASE_URL` | `llama3` |

Switch default: `AI_PROVIDER_DEFAULT=anthropic` (or `openai`, `gemini`, `ollama`)

AI health status is visible at `GET /api/admin/ai/health` (admin token required).

---

## WhatsApp Bot

Set `WHATSAPP_PROVIDER` in `.env` to choose transport:

| Value | Transport |
|---|---|
| `meta` *(recommended)* | Meta WhatsApp Cloud API |
| `360dialog` | 360dialog BSP |
| `twilio` | Twilio sandbox (dev only) |

Webhook endpoints (register these in your WhatsApp provider dashboard):
- `POST {BOT_URL}/webhook` — incoming messages
- `GET  {BOT_URL}/webhook` — Meta verification challenge

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — platform overview, data model, council architecture, role definitions

---

*Private — ZimHealth CPD. All rights reserved.*
