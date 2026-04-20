# NursePro CPD

> **Learn. Earn. Advance.**  
> A multi-channel Continuing Professional Development platform for Zimbabwean nurses and healthcare professionals.

---

## What is NursePro CPD?

NursePro CPD delivers CPD content via three channels to ensure every nurse can earn required CPD points regardless of device, internet reliability, or data budget:

| Channel | Who it's for |
|---|---|
| **Web App** (PWA) | All roles — learners, creators, NCZ officers, admins |
| **WhatsApp Bot** | Learners with basic phones and limited data |
| **Mobile App** (React Native) | Offline-first learning — works without internet |

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Clone and install
```bash
git clone https://github.com/chihwayi/nurseprocpd.git
cd nurseprocpd
pnpm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env — fill in JWT_SECRET at minimum. AI keys optional for basic dev.
```

### 3. Start database and Redis
```bash
docker-compose up -d
```

### 4. Set up database
```bash
cd backend
pnpm db:migrate    # Run Prisma migrations
pnpm db:seed       # Seed dev data
```

### 5. Start development servers
```bash
# Terminal 1 — API
cd backend && pnpm dev

# Terminal 2 — Web app
cd apps/web && pnpm dev

# Terminal 3 (optional) — WhatsApp bot
cd apps/whatsapp-bot && pnpm dev
```

Web app: http://localhost:3000  
API: http://localhost:4000  
Bot: http://localhost:4100

### Dev login credentials (from seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@nursepro.co.zw | Admin@1234 |
| Content Manager | creator@nursepro.co.zw | Creator@1234 |
| NCZ Officer | officer@ncz.co.zw | Ncz@12345 |
| Learner | grace@nursepro.co.zw | Learner@1234 |

---

## AI Provider Configuration

NursePro CPD supports 4 AI providers. Set at least one API key in `.env`:

| Provider | Env Var | Default Model |
|---|---|---|
| **Anthropic Claude** (default) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| **OpenAI / ChatGPT** | `OPENAI_API_KEY` | `gpt-4o-mini` |
| **Google Gemini** | `GEMINI_API_KEY` | `gemini-1.5-pro` |
| **Ollama** (local/offline) | `OLLAMA_BASE_URL` | `llama3` |

Switch the active provider:
```bash
AI_PROVIDER_DEFAULT=anthropic   # or: openai, gemini, ollama
```

The Admin portal also allows switching providers at runtime without redeployment.

---

## Project Structure

```
nurseprocpd/
├── apps/
│   ├── web/              ← React 18 + Vite PWA (TailwindCSS)
│   ├── mobile/           ← React Native + Expo (offline-first)
│   └── whatsapp-bot/     ← WhatsApp bot (Node.js + Twilio)
├── backend/              ← Express API + Prisma + PostgreSQL
├── packages/
│   ├── types/            ← Shared TypeScript types
│   ├── ai-client/        ← Multi-provider AI client
│   └── ui/               ← Shared React components
└── docs/
    ├── NursePro_CPD_Platform_Spec.md
    ├── design/DESIGN_SYSTEM.md
    └── sprints/          ← 24 detailed sprint documents
```

---

## Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS, TanStack Query, Zustand
- **Backend:** Node.js 20, Express, Prisma ORM, PostgreSQL 15, Redis 7
- **AI:** Anthropic Claude, OpenAI, Google Gemini, Ollama (multi-provider)
- **WhatsApp:** Twilio WhatsApp Business API
- **Payments:** Paynow Zimbabwe (EcoCash), Stripe
- **Storage:** AWS S3 / Cloudflare R2 + Cloudflare CDN
- **Mobile:** React Native + Expo (offline SQLite sync)
- **Tooling:** pnpm workspaces + Turborepo, Vitest, Playwright

---

## Sprint Plan

See `docs/sprints/` for the full 24-sprint build plan. Each sprint is a self-contained document with exact tasks, file paths, and validation checklists.

| Sprint | Topic |
|---|---|
| S01–S02 | Monorepo foundation + Database |
| S03–S06 | Auth, CPD engine, Courses API, Media |
| S07–S12 | Web app shell, Learner dashboard, Quiz, Payments, Certs |
| S13–S15 | WhatsApp bot + AI tutor |
| S16–S18 | Creator portal |
| S19–S20 | NCZ portal + Sync adapter |
| S21–S23 | Admin portal + AI recommendations |
| S24 | Security hardening + Launch |

---

## Design System

See `docs/design/DESIGN_SYSTEM.md` for the complete design specification:
- Teal primary colour palette
- Typography scale (Inter font)
- Component library (Buttons, Cards, Forms, Tables, Charts)
- Page-level designs for all 4 portals
- Accessibility standards (WCAG 2.1 AA)

---

## License

Private — NursePro CPD. All rights reserved.
