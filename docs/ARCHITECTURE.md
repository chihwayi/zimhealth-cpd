# ZimHealth CPD — Unified Project Document

> **Learn. Earn. Advance.**  
> Council-aware Continuing Professional Development platform for Zimbabwe health professionals.

This document replaces prior scattered sprint notes and reference artifacts (spreadsheet/template/image sources). It is the single source of truth for **what the platform is**, **how to run it**, **seeded credentials**, and the **multi‑council architecture**.

---

## 1) What this platform does

ZimHealth CPD provides CPD learning and compliance across **multiple Zimbabwe health councils** via:
- **Web app (PWA)** for learners, creators, council officers, and admins
- **Mobile app (Expo / React Native)** — fully implemented, offline-capable, Moodle-style
- **WhatsApp bot** for micro‑learning and point crediting

Core product principles:
- **Council-first identity**: learners are tied to a `Council` + `professionalTitle` + `registrationNumber`
- **Eligibility-first content**: learners only see courses allowed for their council/title (plus all-user courses)
- **Creator audience controls**: creators must choose the course audience (all users OR councils/titles) before review/publish
- **Council-scoped compliance**: council officers only see learners under their council (admin is cross-council)
- **Council-driven CPD rules**: required points and renewal dates come from council configuration

---

## 2) Quick start (local)

**Prereqs**: Node.js 20+, pnpm 9+, Docker

```bash
pnpm install
cp .env.example .env
docker-compose up -d

# Reset DB + apply migrations + seed demo data
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true pnpm --filter @zimhealth/backend db:reset
pnpm --filter @zimhealth/backend db:seed

# Dev
pnpm --filter @zimhealth/backend dev   # API http://localhost:4000
pnpm --filter @zimhealth/web dev       # Web http://localhost:3000
```

Health check: `GET http://localhost:4000/health`

### Mobile quick start (local dev)

```bash
# Create apps/mobile/.env
echo "EXPO_PUBLIC_API_URL=http://localhost:4000" > apps/mobile/.env

cd apps/mobile
pnpm expo start          # scan QR in Expo Go (offline/background features need a real build)
```

For background sync (`expo-background-fetch`) to work, a real native build is required:

```bash
npx expo run:ios     # or
npx expo run:android
```

---

## 3) Seeded logins (dev)

These credentials are seeded by `backend/prisma/seed.ts`:

| Role | Email | Password | Portal |
|---|---|---|---|
| Admin | `admin@zimhealthcpd.co.zw` | `Admin@1234` | `/admin` |
| Creator | `creator@zimhealthcpd.co.zw` | `Creator@1234` | `/creator` |
| Council Officer (legacy) | `officer@ncz.co.zw` | `Ncz@12345` | `/ncz` *(alias)* |
| Council Officer (primary) | `officer@council.co.zw` | `Council@12345` | `/council` |
| Learner | `grace@zimhealthcpd.co.zw` | `Learner@1234` | `/dashboard` |

Notes:
- Council portal API primary path is **`/api/council/*`** with **`/api/ncz/*`** kept as an alias.
- Council officer access is `COUNCIL_OFFICER` (with `NCZ_OFFICER` supported for backwards compatibility).

---

## 4) Multi‑council data model (high level)

### Council
Each council defines:
- `requiredPoints` (annual target)
- `renewalMonth`, `renewalDay` (cycle deadline)
- `allowedTitles` (professional titles under that council)
- optional `registrationPrefix`

### User
Key identity fields:
- `councilId`
- `professionalTitle`
- `registrationNumber`

Legacy fields remain temporarily for compatibility:
- `cadre`
- `nczRegistrationNumber`

### Course audience targeting
Courses can be:
- `isPublicToAll = true`, OR
- targeted via `targetCouncilIds` and/or `targetTitles` (legacy `targetCadres` still supported)

---

## 5) Supported regulatory councils (seeded)

Seeded councils are derived from the Zimbabwe councils overview and are editable via the Admin UI (`/admin/settings`):

- **NCZ** — Nurses Council of Zimbabwe — 12 points — renewal typically Jan 31
- **PCZ** — Pharmacists Council of Zimbabwe — 60 points
- **MDPCZ** — Medical & Dental Practitioners Council — 15 points — renewal typically Dec 31
- **MLCSCZ** — Medical Laboratory & Clinical Scientists Council — points required (defaults seed to 12; adjust in Admin)
- **AHPCZ** — Allied Health Practitioners Council — 50 points (radiographers noted)
- **MRPCZ** — Medical Rehabilitation Practitioners Council — points required (defaults seed to 12; adjust in Admin)
- **EHPCZ** — Environmental Health Practitioners Council — points required (defaults seed to 12; adjust in Admin)
- **NTCZ** — Natural Therapists Council — points required (defaults seed to 12; adjust in Admin)

---

## 6) Branding assets (current)

The web app uses these public assets (already committed):
- `apps/web/public/logo.png`
- `apps/web/public/favicon.png`
- `apps/web/public/apple-touch-icon.png`

Source/reference artifacts (spreadsheet/template/source image) are intentionally not kept in the repo after consolidation.

---

## 7) Mobile app architecture

### Offline capabilities (Moodle-style)
The mobile app provides a complete offline learning experience:
- **Course download**: entire course content (videos, PDFs, SCORM, quiz data) cached to SQLite + device filesystem via `expo-file-system`
- **Resumable downloads**: `FileSystem.createDownloadResumable` with `resume_data` persisted in SQLite — interrupted downloads resume where they left off
- **Offline playback**: video (`expo-av`), PDFs, SCORM, quizzes all work without network
- **Progress sync**: all quiz completions and lesson progress saved locally (`offline_progress`, `offline_quiz_attempts` SQLite tables) and synced when connectivity returns
- **Background sync**: `expo-background-fetch` + `expo-task-manager` syncs pending progress while the app is closed (iOS: OS-controlled ~15 min minimum; Android: more reliable). Requires real build — does NOT work in Expo Go.
- **Offline banner**: `useOnlineStatus` hook shows amber banner when device is offline

### Key files
| File | Purpose |
|---|---|
| `src/lib/offlineDB.ts` | SQLite schema, migrations, all CRUD helpers |
| `src/lib/offlineDownload.ts` | `cacheCourseOffline`, `retryFailedDownloads`, resumable asset downloads |
| `src/lib/backgroundSync.ts` | `TaskManager.defineTask` (module-level) + `registerBackgroundSyncAsync` |
| `src/lib/syncQueue.ts` | Queues progress/quiz events for deferred network sync |
| `src/hooks/useOnlineStatus.ts` | NetInfo-based connectivity state |
| `src/hooks/useOfflineSync.ts` | Triggers sync on reconnection |

### Navigation structure
```
RootNavigator
├── AuthNavigator      (Login, Register)
└── MainNavigator (tab bar)
    ├── DashboardScreen
    ├── CoursesScreen → CourseDetailScreen → CoursePlayerScreen
    ├── CertificatesScreen
    ├── SubscriptionScreen
    └── ProfileScreen
```

---

## 8) Deployment

### Server deploy (production)

Default target: `root@173.212.195.88`

```bash
./deploy-server.sh          # standard deploy
RESEED=1 ./deploy-server.sh # first deploy — seeds councils + admin
```

The script:
1. Packages the repo (excluding `node_modules`, `dist`, `.git`, `apps/mobile/.expo`)
2. Uploads via `scp`
3. On server: extracts, preserves `.env` + `apps/mobile/.env`, runs `scripts/deploy.sh` (migrate, build), then `scripts/start.sh` (PM2)

### PM2 processes (4 total)

| Name | What | Port |
|---|---|---|
| `zimhealth-api` | Fastify backend | 4000 |
| `zimhealth-bot` | WhatsApp bot | — |
| `zimhealth-web` | Vite/Express web frontend | 3000 |
| `zimhealth-expo` | Expo Metro bundler (`--tunnel`) | ngrok URL |

```bash
pm2 status
pm2 logs zimhealth-expo --lines 80 --nostream   # get QR code / tunnel URL
```

### One-time server setup for mobile

SSH into the server and create the mobile env file:

```bash
cat > /opt/zimhealth-cpd/apps/mobile/.env << 'EOF'
EXPO_PUBLIC_API_URL=http://173.212.195.88:4000
EXPO_PUBLIC_API_URL_IOS=http://173.212.195.88:4000
EXPO_PUBLIC_API_URL_ANDROID=http://173.212.195.88:4000
EOF
```

This file is gitignored and preserved across deploys by the backup/restore logic in `deploy-server.sh`.

---

## 9) CI / “green check” commands

Run the same checks CI runs:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

If Prisma advisory-lock issues occur locally, re-run DB commands with:
`PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true`

