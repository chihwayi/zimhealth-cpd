# ZimHealth CPD

> **Learn. Earn. Advance.**  
> A multi-channel Continuing Professional Development platform for Zimbabwean health professionals.

ZimHealth CPD removes every barrier between health professionals and their annual CPD requirements. Three channels — web, mobile, and WhatsApp — ensure that a practitioner in a Harare hospital and a practitioner in a rural Matabeleland clinic can both earn renewal points, regardless of council, device, data budget, or internet reliability.

---

## Channels

| Channel | Stack | Who |
|---|---|---|
| **Web App** (PWA) | React 18 + Vite + TailwindCSS | Learners, Creators, NCZ Officers, Admins |
| **Mobile App** | React Native + Expo | Learners — offline-first, works without data |
| **WhatsApp Bot** | Node.js + WhatsApp Cloud API (Meta) / 360dialog *(fallback)* | Learners — any phone, WhatsApp-only bundle |

---

## Quick Start

**Prerequisites:** Node.js 20+, pnpm 9+, Docker

```bash
# 1. Install
git clone https://github.com/chihwayi/zimhealth-cpd.git
cd zimhealth-cpd
pnpm install

# 2. Environment
cp .env.example .env
# Set JWT_SECRET at minimum. AI keys optional for basic dev.

# 3. Database + Redis
docker-compose up -d

# 4. Migrate + seed
cd backend && pnpm db:migrate && pnpm db:seed

# 5. Start servers
pnpm dev          # starts API (4000), web (3000), and bot (4100) in parallel
```

---

## Server Deploy (single command over SSH)

This repo includes a one-shot deploy script (similar to a typical static-site `deploy.sh`, but for the full stack):

- Local script: `deploy-server.sh`
- Server-side scripts: `scripts/deploy.sh` and `scripts/start.sh`

### First-time server setup (one-time)

SSH into your server and create the project folder + `.env`:

```bash
mkdir -p /opt/zimhealth-cpd && cd /opt/zimhealth-cpd
cp .env.example .env
nano .env
```

If you want to use Ollama on the server, set at minimum:

```bash
AI_PROVIDER_DEFAULT=ollama
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
```

### Deploy from your local machine

With SSH key:

```bash
SERVER="root@YOUR_SERVER_IP" SSH_PORT=22 SSH_KEY="$HOME/.ssh/id_ed25519" REMOTE_PATH="/opt/zimhealth-cpd" ./deploy-server.sh
```

With password (`sshpass`):

```bash
SERVER="root@YOUR_SERVER_IP" SSH_PORT=22 SSHPASS="YOUR_PASSWORD" REMOTE_PATH="/opt/zimhealth-cpd" ./deploy-server.sh
```

**Dev login credentials:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@zimhealthcpd.co.zw | Admin@1234 |
| Content Manager | creator@zimhealthcpd.co.zw | Creator@1234 |
| NCZ Officer | officer@ncz.co.zw | Ncz@12345 |
| Learner | grace@zimhealthcpd.co.zw | Learner@1234 |

**Mobile (separate terminal):**
```bash
cd apps/mobile && pnpm install && npx expo start
```

---

## WhatsApp Bot (Meta Cloud API + 360dialog fallback)

The WhatsApp bot supports multiple transports. Set `WHATSAPP_PROVIDER` in `.env`:

- **Primary (recommended)**: `WHATSAPP_PROVIDER=meta`
- **Fallback**: `WHATSAPP_PROVIDER=360dialog`
- **Legacy/dev**: `WHATSAPP_PROVIDER=twilio`

### Required env vars

**Meta Cloud API**

- `META_WA_TOKEN`: permanent access token
- `META_WA_PHONE_NUMBER_ID`: WhatsApp phone number ID
- `WHATSAPP_VERIFY_TOKEN`: webhook verification token (used by `GET /webhook`)

**360dialog**

- `D360_API_KEY`
- `D360_BASE_URL` *(default: `https://waba.360dialog.io`)*

**Twilio (optional)**

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`

### Webhook

Bot webhook endpoint is always:

- `POST ${BOT_URL}/webhook` (incoming messages)
- `GET ${BOT_URL}/webhook` (Meta verification challenge)

---

## AI Providers

Set at least one key in `.env`:

| Provider | Env var | Model |
|---|---|---|
| Anthropic Claude *(default)* | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-1.5-pro` |
| Ollama *(local)* | `OLLAMA_BASE_URL` | `llama3` |

Switch provider: `AI_PROVIDER_DEFAULT=anthropic` (or `openai`, `gemini`, `ollama`)

---

## Project Structure

```
zimhealth-cpd/
├── apps/
│   ├── web/              React PWA — all 4 role portals
│   ├── mobile/           Expo app — learner offline-first
│   └── whatsapp-bot/     Twilio bot — WhatsApp learning
├── backend/              Express API + Prisma + PostgreSQL
├── packages/
│   ├── ai-client/        Multi-provider AI abstraction
│   ├── types/            Shared TypeScript types
│   └── ui/               Shared React components
└── docs/
    ├── SYSTEM.md         Platform overview, architecture, data model
    └── UI_UX_STANDARDS.md  Design system — web and mobile
```

---

## Tech Stack

- **API:** Node.js 20, Express 4, Prisma 6, PostgreSQL 15, Redis 7, Zod
- **Web:** React 18, Vite, TailwindCSS 3, TanStack Query v5, Zustand v5
- **Mobile:** React Native 0.76, Expo 52, NativeWind v4
- **AI:** Anthropic Claude, OpenAI, Google Gemini, Ollama
- **Payments:** Paynow Zimbabwe (EcoCash), Stripe
- **WhatsApp:** Meta WhatsApp Cloud API *(primary)*, 360dialog *(fallback)*
- **Tooling:** pnpm workspaces, Turborepo, Vitest, TypeScript 5

---

## Documentation

- [`docs/SYSTEM.md`](docs/SYSTEM.md) — full platform overview, user roles, data model, architecture
- [`docs/UI_UX_STANDARDS.md`](docs/UI_UX_STANDARDS.md) — design system for web and mobile
- [`apps/mobile/MOBILE_SPRINTS.md`](apps/mobile/MOBILE_SPRINTS.md) — mobile build plan for AI agents

---

*Private — ZimHealth CPD. All rights reserved.*
