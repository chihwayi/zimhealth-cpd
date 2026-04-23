# ZimHealth CPD — System Overview

> **Learn. Earn. Advance.**  
> A multi-channel Continuing Professional Development platform for Zimbabwean health professionals.

---

## 1. Why This Exists

Zimbabwe health professionals must earn CPD points every year to renew professional licences through their respective councils. The initial implementation focuses on the Nurses Council of Zimbabwe (NCZ), but the product direction is broader: one CPD platform for multiple Zimbabwe health councils.

ZimHealth CPD solves every one of these problems:

| Gap in existing platforms | ZimHealth solution |
|---|---|
| No offline learning | Offline-first mobile app — download on Wi-Fi, complete anywhere |
| No WhatsApp access | Full WhatsApp bot with AI tutor, quizzes, and point crediting |
| Hard paywall | Freemium — free tier earns enough points for basic renewal |
| Manual NCZ submission | Automated sync adapter — points go directly to NCZ |
| Static, generic content | AI recommendations adapt to each professional's cadre and specialty |
| Content goes stale | Auto-generate courses directly from published health guidelines |

---

## 2. The Killer Features

### Zero Barriers to Entry
Three channels ensure every health professional can access the platform regardless of location, device, or data budget. A hospital administrator uses the web app, a smartphone user uses the mobile app, and anyone with WhatsApp — even on a basic handset — can complete full lessons through the WhatsApp bot. Zimbabwe's WhatsApp-only data bundles make the bot channel effectively free to use.

### Work Anywhere — Offline Mode
The mobile app downloads course materials over Wi-Fi. Nurses complete lessons and quizzes with no internet connection, then sync progress automatically when they reconnect. This solves high data costs and frequent power outages in one feature.

### AI Tutor on WhatsApp
The most significant differentiator. A dedicated WhatsApp number connects health professionals to an AI assistant that delivers micro-lessons, runs quizzes, and answers clinical questions in plain language — all inside WhatsApp. No app install, no data plan beyond a WhatsApp bundle.

### Smart Personalised Learning
The system learns as each professional progresses. A paediatrics-focused learner gets paediatric recommendations. A midwife gets obstetrics content. A pharmacist, lab professional, or clinical officer can receive role-relevant pathways as additional councils are onboarded. New courses are auto-generated directly from published national health guidelines (EDLIZ, MOH circulars), ensuring content is always current without manual editorial work.

### Effortless Credit Tracking
As a learner completes activities, the platform automatically credits points to the configured council integration. No paperwork, no chasing. The current NCZ sync adapter runs on a schedule and reconciles records automatically.

### Free-to-Start Model
The free tier provides enough CPD points to meet basic annual renewal requirements — entirely through WhatsApp where eligible. Premium unlocks the full course library, formal PDF certificates, and advanced AI tutor interactions. This removes the paywall barrier that drives health professionals away from competitor platforms.

---

## 3. Platform Channels

| Channel | Tech | Who uses it |
|---|---|---|
| **Web App** (PWA) | React 18 + Vite + TailwindCSS | All roles — learners, creators, NCZ officers, admins |
| **Mobile App** | React Native + Expo | Learners — offline-first, push notifications |
| **WhatsApp Bot** | Node.js + Twilio | Learners — basic phone, limited data, no app |

---

## 4. User Roles

The platform uses strict Role-Based Access Control enforced at the API layer. Every role sees a different interface.

### System Administrator
Full, unrestricted access. The only role that can:
- Configure CPD rules per cadre (points required, renewal cycle)
- Approve or reject Content Manager accounts
- Override CPD points for any learner
- Manage payment gateways and subscription tiers
- Control the NCZ sync adapter
- Access all audit logs and financial reports
- Toggle AI provider or switch at runtime

### Content Manager (Course Creator)
Verified healthcare educators or institutions. Can:
- Build and publish courses (video, reading, audio, quizzes)
- View analytics on their own courses only
- Use AI to auto-generate course content from guidelines
- Cannot access other creators' data, learner personal data, or financial records

Publishing workflow: Creator → Submit for Review → Admin approves → Live  
*(Approval can be disabled for trusted creators by Admin)*

### NCZ Officer
Read-only access to compliance data. Can:
- View CPD history for all registered learners
- Search and filter by registration number, name, institution, cadre, district
- Export compliance reports (CSV, PDF)
- Verify certificates by ID
- Cannot modify any data

### Learner (Nurse / Midwife / Healthcare Professional)
The primary end-user. Can:
- Browse, enrol in, and complete CPD courses
- Earn CPD points on passing assessments
- Download PDF certificates
- Access offline content packs (mobile app)
- Learn via WhatsApp bot
- View personal CPD dashboard and renewal status

### Role × Permission Matrix

| Action | Admin | Creator | NCZ Officer | Learner |
|---|:---:|:---:|:---:|:---:|
| Create / edit courses | ✅ all | ✅ own only | ❌ | ❌ |
| Upload media | ✅ | ✅ | ❌ | ❌ |
| View all learner CPD data | ✅ | ❌ | ✅ read-only | ❌ own only |
| Adjust CPD points | ✅ | ❌ | ❌ | ❌ |
| Export NCZ reports | ✅ | ❌ | ✅ | ❌ |
| Manage user accounts | ✅ | ❌ | ❌ | ❌ |
| Configure payments | ✅ | ❌ | ❌ | ❌ |
| Configure AI/Claude | ✅ | ❌ | ❌ | ❌ |
| Earn CPD points | ❌ | ❌ | ❌ | ✅ |
| Download personal certificate | ❌ | ❌ | ❌ | ✅ |

---

## 5. Core Features

### CPD Points Engine
The authoritative system for all CPD credit. Rules are Admin-configurable per cadre.
- Points granted on passing assessments (configurable pass mark)
- Annual cycle with no carryover
- Full audit trail — every point credit logged with timestamp, activity ID, and score
- Manual Admin override logged and flagged

### Certificate Generation
- PDF certificates auto-generated on reaching point thresholds
- Unique UUID certificate ID — verifiable by NCZ Officers
- QR code on certificate links to public verification page
- Contains: name, NCZ registration number, points earned, courses completed, period, platform signature

### Learning Engine
- Content types: video, rich-text reading, audio, image, PDF
- Quiz types: multiple choice, true/false, image-based MCQ
- Configurable: pass mark, attempt limits, time limits, question randomisation
- Prerequisite module chains
- Completion states: not started / in progress / completed / passed / failed

### AI Integration
Four AI providers supported (multi-provider abstraction in `packages/ai-client`):

| Provider | Default model | Notes |
|---|---|---|
| Anthropic Claude | `claude-sonnet-4-6` | Default — best for clinical content |
| OpenAI | `gpt-4o-mini` | Fallback option |
| Google Gemini | `gemini-1.5-pro` | Alternative |
| Ollama | `llama3` | Local/offline deployment |

AI is used for:
- **Adaptive recommendations** — courses suggested based on cadre, specialty, completion history
- **WhatsApp AI tutor** — answers clinical questions, delivers micro-lessons
- **Content generation** — auto-generate courses from health guidelines (`POST /api/ai/ingest-guideline`)
- **Cold-start recommendations** — new users with 0 completions get suggestions from profile alone

### NCZ Sync Adapter
- Scheduled daily sync (`cron`) pushes completed CPD records to NCZ systems
- Sync status viewable by Admin and NCZ Officers
- Reconciliation report generated per sync run
- Configurable: frequency, field mappings, retry policy

### Offline Mode
Web (PWA): Workbox service worker caches API responses; IndexedDB stores downloaded modules and queues pending progress updates.  
Mobile: SQLite stores full module content; background sync on reconnect via NetInfo.

### Notifications
- Push notifications (mobile — Expo Notifications)
- WhatsApp reminders (bot)
- Email (Nodemailer)
- Schedule: 90, 60, 30, 7 days before renewal deadline

### Payments
- **Paynow Zimbabwe** — EcoCash, OneMoney (primary ZWL gateway)
- **Stripe** — USD card payments
- Webhook handling for both gateways
- Subscription tiers: FREE, PREMIUM, INSTITUTIONAL

---

## 6. Data Model (Key Entities)

```
User
 ├── id, email, fullName, cadre, nczRegistrationNumber
 ├── institution, province, district, phone
 ├── specialtyArea (drives AI recommendations)
 ├── subscriptionTier, subscriptionExpiresAt
 ├── role: ADMIN | CONTENT_MANAGER | NCZ_OFFICER | LEARNER
 └── avatarUrl, isActive

Course
 ├── id, title, subtitle, description
 ├── category, difficulty, language
 ├── cpdPoints, estimatedMinutes
 ├── status: DRAFT | PUBLISHED | ARCHIVED
 └── creatorId → User

Module
 └── courseId, title, order

ContentSection
 └── moduleId, title, type (TEXT|VIDEO|IMAGE|PDF), content, order

Quiz
 └── courseId, moduleId, title, passMark

Question
 └── quizId, text, type (MULTIPLE_CHOICE), order

QuestionOption
 └── questionId, text, isCorrect

Enrollment
 └── userId, courseId, completedAt, startedAt

PointEntry
 └── userId, points, reason, activityId, createdAt

Certificate
 └── userId, courseId, issuedAt, cpdPoints, verifyCode

RefreshToken
 └── userId, token, expiresAt

NczRecord
 └── userId, syncedAt, cycleYear, totalPoints, status
```

---

## 7. Architecture

### Monorepo structure
```
zimhealth-cpd/
├── apps/
│   ├── web/              React 18 + Vite PWA (all 4 portal roles)
│   ├── mobile/           React Native + Expo (learner, offline-first)
│   └── whatsapp-bot/     Node.js + Twilio (learner via WhatsApp)
├── backend/              Express API + Prisma ORM
│   ├── src/routes/       REST endpoints (/api/*)
│   ├── src/services/     Business logic (auth, adaptive-learning, ai-content-gen, …)
│   ├── src/middleware/   auth, role, rate-limit
│   ├── src/jobs/         syncWorker, notificationWorker (cron)
│   └── prisma/           schema.prisma + migrations
├── packages/
│   ├── types/            Shared TypeScript types across all packages
│   ├── ai-client/        Multi-provider AI abstraction (Claude / OpenAI / Gemini / Ollama)
│   └── ui/               Shared React component primitives
└── docs/
    ├── SYSTEM.md         ← this file
    └── UI_UX_STANDARDS.md
```

### API layer
All HTTP communication goes through the Express backend at `http://localhost:4000` (dev) or `https://api.zimhealthcpd.co.zw` (prod). The frontend apps and WhatsApp bot are API clients — they share no direct database access.

Key middleware chain per request:
```
rate-limit → CORS → express.json → morgan → authRouter | apiRouter
```

JWT-based auth: short-lived access tokens (15m) + long-lived refresh tokens (30d) stored in SecureStore (mobile) or httpOnly cookie (web).

### Infrastructure
| Service | Technology |
|---|---|
| Database | PostgreSQL 15 (Supabase or self-hosted) |
| Cache / queues | Redis 7 |
| Object storage | AWS S3 / Cloudflare R2 |
| CDN | Cloudflare |
| Email | Nodemailer + SMTP (Gmail or Zoho) |
| WhatsApp | Twilio WhatsApp Business API |
| Monitoring | Sentry (frontend + backend) |
| Process manager | PM2 |
| Container | Docker Compose (dev), custom VPS or Railway (prod) |

---

## 8. Tech Stack Summary

| Layer | Stack |
|---|---|
| Web frontend | React 18, Vite, TailwindCSS 3, TanStack Query v5, Zustand v5, React Router v6 |
| Mobile frontend | React Native 0.76, Expo 52, NativeWind v4, TanStack Query v5, Zustand v5 |
| WhatsApp bot | Node.js 20, TypeScript, Twilio SDK |
| Backend API | Node.js 20, Express 4, Prisma 6, PostgreSQL, Redis, Zod |
| AI | Anthropic SDK, OpenAI SDK, Google Generative AI SDK, Ollama |
| Payments | Paynow (Zimbabwe), Stripe |
| Tooling | pnpm workspaces, Turborepo, Vitest, TypeScript 5 |
