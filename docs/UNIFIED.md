# ZimHealth CPD — Unified Project Document

> **Learn. Earn. Advance.**  
> Council-aware Continuing Professional Development platform for Zimbabwe health professionals.

This document replaces prior scattered sprint notes and reference artifacts (spreadsheet/template/image sources). It is the single source of truth for **what the platform is**, **how to run it**, **seeded credentials**, and the **multi‑council architecture**.

---

## 1) What this platform does

ZimHealth CPD provides CPD learning and compliance across **multiple Zimbabwe health councils** via:
- **Web app (PWA)** for learners, creators, council officers, and admins
- **Mobile (Expo)** (in progress / optional)
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

## 7) CI / “green check” commands

Run the same checks CI runs:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

If Prisma advisory-lock issues occur locally, re-run DB commands with:
`PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true`

