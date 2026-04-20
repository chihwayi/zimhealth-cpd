# Sprint 24 — Hardening & Launch Prep

**Phase:** 6 — Hardening & Launch
**Duration:** 1 week (can extend to 2)
**Goal:** Security hardening, accessibility audit, performance testing, Sentry monitoring, and soft launch readiness. This sprint has NO new features — only quality and production-readiness.

**Validator:** Claude Code is the final reviewer before any code is considered production-ready.

---

## Pre-conditions
- [ ] Sprints S01–S23 all signed off
- [ ] All validation checklists from previous sprints are green
- [ ] Staging environment deployed and accessible

---

## Tasks

### T24.1 — Security hardening checklist

Work through each item. For each: verify, fix if failing, mark done.

#### 1. JWT & Authentication
- [ ] `JWT_SECRET` in production is at least 64 random characters (not the dev default)
- [ ] Tokens expire in 7d max; refresh tokens expire in 30d
- [ ] Refresh tokens are stored in Redis, not just JWTs (so they can be revoked)
- [ ] All auth routes have rate limiting (install `express-rate-limit`)

CREATE FILE: `backend/src/middleware/rate-limit.middleware.ts`
```typescript
import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 auth attempts per IP per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Rate limit exceeded.' },
});
```

Install: `pnpm add express-rate-limit && pnpm add -D @types/express-rate-limit` (in backend)

EDIT FILE: `backend/src/app.ts`
Add rate limiters:
```typescript
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';
app.use('/api/auth', authRateLimit);
app.use('/api', apiRateLimit);
```

#### 2. Input validation
- [ ] Every route that accepts a body uses Zod parsing — no raw `req.body` access without validation
- [ ] No SQL injection vectors (Prisma ORM prevents raw SQL injection — verify no raw `$queryRaw` with user input)
- [ ] File uploads: check MIME type on server, not just client — verify `upload.middleware.ts` blocks `.exe`, `.sh`, etc.

#### 3. CORS & Headers
- [ ] `CORS_ORIGINS` in production is set to exact frontend domain only (not `*`)
- [ ] Helmet is configured (already in `app.ts`)
- [ ] Add Content Security Policy header:

EDIT FILE: `backend/src/app.ts`
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', process.env.CDN_BASE_URL ?? ''],
      connectSrc: ["'self'", process.env.API_URL ?? ''],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

#### 4. Payment webhooks
- [ ] Stripe webhook verifies signature before processing (NEVER trust webhook body without signature check)
- [ ] Paynow callback validates hash (check Paynow SDK docs)
- [ ] Webhook endpoints do NOT require normal auth — they use signature verification only

#### 5. Media uploads
- [ ] S3 bucket is NOT publicly readable — all access via signed URLs
- [ ] CDN signed URLs used for paid content (verify `getSignedDownloadUrl` is called for premium content)
- [ ] Maximum file sizes enforced both client-side (UI feedback) and server-side (Multer config)

#### 6. AI safety
- [ ] AI endpoints (WhatsApp tutor) cannot return PII — verify system prompt explicitly forbids it
- [ ] AI response caching uses content hash as key (no user PII in cache key)
- [ ] Admin can disable AI features without redeployment (via Redis config flag)

---

### T24.2 — Accessibility audit (WCAG 2.1 AA)

Run through these items on the learner dashboard, course browser, login page, and quiz screen:

- [ ] All images have `alt` attributes
- [ ] All form inputs have associated `<label>` elements (use `htmlFor`)
- [ ] All icon-only buttons have `aria-label` attributes
- [ ] Colour contrast: check teal-500 on white = 3.06:1 (borderline — use teal-600 for small text)
- [ ] Focus rings visible on all interactive elements (verify `focus:ring-2 focus:ring-primary-500`)
- [ ] Tab order is logical — no focus traps
- [ ] Quiz: keyboard navigation works (Tab to select option, Enter to confirm)
- [ ] Loading skeletons have `aria-busy="true"` or use `role="status"`
- [ ] Error messages use `role="alert"` for screen readers

FIX: In all button and input components, add missing aria attributes.

Install axe-core for automated accessibility testing:
```bash
RUN COMMAND: cd apps/web && pnpm add -D @axe-core/react
```

EDIT FILE: `apps/web/src/main.tsx`
Add in development mode only:
```tsx
if (import.meta.env.DEV) {
  import('@axe-core/react').then(({ default: axe }) => {
    axe(React, ReactDOM, 1000);
  });
}
```

- [ ] Run the web app in dev mode and check browser console — fix all axe violations before launch

---

### T24.3 — Performance checklist

#### Frontend
- [ ] All page-level components are lazy-loaded (already done in App.tsx — verify no direct imports)
- [ ] Images use WebP format (verify media pipeline converts to WebP)
- [ ] TanStack Query stale times set (5 minutes default — verify in QueryClient config)
- [ ] PWA manifest is correct — run Lighthouse on `/login`:
  ```bash
  RUN COMMAND: npx lighthouse https://staging.nursepro.co.zw/login --output html --output-path ./lighthouse-report.html
  ```
  Target scores: Performance ≥80, Accessibility ≥90, Best Practices ≥90, PWA ✅

#### Backend
- [ ] Database indexes: verify all foreign keys and common query fields have indexes
  - Check `schema.prisma` for `@@index` on: userId, courseId, learnerId, cycleYear, status, email
- [ ] N+1 queries: search for `db.X.findMany` calls inside loops — fix with `include` or `Promise.all`
- [ ] Redis caching on expensive endpoints: AI recommendations (✅ done), compliance counts (add for NCZ portal)

---

### T24.4 — Error monitoring (Sentry)

Install Sentry in both backend and web:
```bash
RUN COMMAND: cd backend && pnpm add @sentry/node @sentry/tracing
RUN COMMAND: cd apps/web && pnpm add @sentry/react
```

EDIT FILE: `backend/src/app.ts`
Add at the top (before other imports):
```typescript
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  app.use(Sentry.Handlers.requestHandler());
}
```

Add after routes:
```typescript
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}
```

EDIT FILE: `apps/web/src/main.tsx`
Add:
```tsx
import * as Sentry from '@sentry/react';
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 });
}
```

Add to `.env.example`:
```bash
SENTRY_DSN=https://xxx@sentry.io/yyy
VITE_SENTRY_DSN=https://xxx@sentry.io/yyy
```

- [ ] Sentry captures unhandled errors in backend
- [ ] Sentry captures React component errors in web app
- [ ] Sentry dashboard shows at least 1 test event

---

### T24.5 — End-to-end test coverage

Run Playwright tests for critical flows:

CREATE FILE: `apps/web/e2e/auth.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('learner can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'grace@nursepro.co.zw');
  await page.fill('input[type="password"]', 'Learner@1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('CPD Progress')).toBeVisible();
});

test('unauthenticated user redirected to login from /dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});

test('learner cannot access /admin', async ({ page }) => {
  // Log in as learner
  await page.goto('/login');
  await page.fill('input[type="email"]', 'grace@nursepro.co.zw');
  await page.fill('input[type="password"]', 'Learner@1234');
  await page.click('button[type="submit"]');
  // Try to access admin
  await page.goto('/admin');
  await expect(page).toHaveURL('/dashboard');
});
```

CREATE FILE: `apps/web/playwright.config.ts`
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', screenshot: 'only-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

Run:
```bash
RUN COMMAND: cd apps/web && pnpm test:e2e
```

- [ ] All 3 Playwright tests pass

---

### T24.6 — Production deployment checklist

Go through this before any production traffic:

**Environment**
- [ ] All `.env` values set in production (no missing vars — compare against `.env.example`)
- [ ] `NODE_ENV=production` set
- [ ] `JWT_SECRET` is a production-grade random string (generate with `openssl rand -hex 64`)
- [ ] Stripe is in live mode (not test mode) — `sk_live_` prefix
- [ ] Paynow integration is in production mode

**Database**
- [ ] Prisma migrations run on production database
- [ ] Database has connection pooling (PgBouncer or Railway's managed pooling)
- [ ] Database has daily backups enabled

**Infrastructure**
- [ ] Vercel deployment for web app with correct env vars set
- [ ] Railway/Render deployment for backend API
- [ ] Redis managed instance (not local Docker)
- [ ] S3/R2 bucket created with correct CORS policy
- [ ] Cloudflare DNS pointing to correct services
- [ ] SSL certificates valid (Vercel and Railway handle this automatically)

**Monitoring**
- [ ] Sentry projects created and DSN configured
- [ ] Uptime monitoring set up (UptimeRobot or Checkly): check `/health` every 5 minutes
- [ ] Alert on: 5xx rate > 1%, response time > 3s, Sentry error spike

**Final smoke test on staging**
- [ ] Register as new learner
- [ ] Browse course catalogue
- [ ] Enrol and complete a module
- [ ] Take and pass a quiz
- [ ] CPD points credited correctly
- [ ] Certificate generated and downloadable
- [ ] WhatsApp bot responds to "Hi"
- [ ] Admin can approve a course
- [ ] NCZ Officer can search learners and export CSV
- [ ] Payment flow works (use test credentials)

---

## Final Validation — Claude Code Sign-off

Claude Code must verify ALL of the following before marking the project launch-ready:

### Security
- [ ] No SQL injection possible (Prisma ORM used throughout)
- [ ] No XSS possible (React escapes by default; TipTap content rendered with sanitisation)
- [ ] Auth middleware protects all private routes
- [ ] Rate limiting on auth endpoints
- [ ] Webhook signature verification for Stripe and Paynow
- [ ] CORS locked to known origins

### Data integrity
- [ ] CPD engine prevents duplicate point crediting
- [ ] Admin manual overrides are logged in audit trail
- [ ] NCZ sync marks records as synced (no double submission)

### Performance
- [ ] Lighthouse score ≥80 on login page
- [ ] API response times: p95 < 500ms for standard queries
- [ ] No N+1 queries in learner dashboard or NCZ search

### UX
- [ ] Login → dashboard flow takes < 3 seconds on 3G
- [ ] All loading states have skeleton placeholders (no layout shifts)
- [ ] All error states have clear user-facing messages
- [ ] Mobile PWA installs correctly from Chrome on Android

### Monitoring
- [ ] Sentry capturing errors in both backend and frontend
- [ ] Uptime check configured
- [ ] Docker health checks working in docker-compose

---

**LAUNCH APPROVED** when all checklists above are green.

---

*NursePro CPD — Sprint 24 of 24 | Phase 6: Hardening & Launch*
*Platform ready for soft launch to pilot institutions.*
