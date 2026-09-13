/// <reference path="./types/paynow.d.ts" />

import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRouter from './routes/auth';
import pointsRouter from './routes/points';
import coursesRouter from './routes/courses';
import mediaRouter from './routes/media';
import enrollmentsRouter from './routes/enrollments';
import quizzesRouter from './routes/quizzes';
import paymentsRouter from './routes/payments';
import vouchersRouter from './routes/vouchers';
import certificatesRouter from './routes/certificates';
import entitlementsRouter from './routes/entitlements';
import adminRouter from './routes/admin';
import nczRouter from './routes/ncz';
import councilsRouter from './routes/councils';
import creatorRouter from './routes/creator';
import botRouter from './routes/bot';
import aiRouter from './routes/ai';
import telemetryRouter from './routes/telemetry';
import issuesRouter from './routes/issues';
import mockCouncilRegistryRouter from './routes/dev/mock-council-registry';
import { scheduleDailySync } from './jobs/syncWorker';
import recommendationsRouter from './routes/recommendations';
import { scheduleRenewalReminders } from './jobs/notificationWorker';
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';

const app: express.Express = express();
const PORT = process.env.PORT ?? 4000;
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\r/g, '').replace(/\/$/, '');
}

const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

function originToParts(origin: string): { protocol: string; hostname: string; port: string } | null {
  try {
    const url = new URL(normalizeOrigin(origin));
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return { protocol: url.protocol, hostname: url.hostname, port };
  } catch {
    return null;
  }
}

function isCorsOriginAllowed(origin: string | undefined | null): boolean {
  // Same-origin / server-to-server / curl requests often omit Origin.
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  // Explicit allow-list
  if (corsOrigins.includes('*')) return true;
  if (corsOrigins.includes(normalizedOrigin)) return true;

  // Compare parsed host/port (more robust than raw string match)
  const incoming = originToParts(normalizedOrigin);
  if (incoming) {
    for (const allowed of corsOrigins) {
      const allowedParts = originToParts(allowed);
      if (!allowedParts) continue;
      if (
        incoming.protocol === allowedParts.protocol &&
        incoming.hostname === allowedParts.hostname &&
        incoming.port === allowedParts.port
      ) {
        return true;
      }
    }
  }

  // If APP_HOST is set, allow any port on that host (common for deployments).
  const appHost = process.env.APP_HOST;
  const appScheme = process.env.APP_SCHEME;
  if (appHost) {
    try {
      const url = new URL(normalizedOrigin);
      const matchesHost = url.hostname === appHost;
      const matchesScheme = appScheme ? url.protocol.replace(':', '') === appScheme : true;
      if (matchesHost && matchesScheme) return true;
    } catch {
      // ignore malformed origins
    }
  }

  return false;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', process.env.CDN_BASE_URL ?? ''],
        connectSrc: ["'self'", process.env.API_URL ?? '', ...corsOrigins],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  }),
);
app.use(compression());
// Stripe webhooks require the raw request body for signature verification.
// We skip JSON parsing for this path and let the payments router attach express.raw().
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook/stripe') return next();
  return express.json({ limit: '10mb' })(req, res, next);
});
app.use(morgan('dev'));
app.use('/api/auth', authRateLimit);
app.use('/api', apiRateLimit);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/points', pointsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin/vouchers', vouchersRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/entitlements', entitlementsRouter);
app.use('/api/admin', adminRouter);
// Council portal endpoints (primary). `/api/ncz/*` remains as an alias during transition.
app.use('/api/council', nczRouter);
app.use('/api/ncz', nczRouter);
app.use('/api/councils', councilsRouter);
app.use('/api/creator', creatorRouter);
app.use('/api', recommendationsRouter);
app.use('/api/bot', botRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/ai', aiRouter);
app.use('/api', telemetryRouter);

// Dev/demo-only mock of a council's registration system, for exercising the
// full CPD sync flow without a real council partner API — see
// docs/integrations/ncz-sync-api-spec.md. Never mounted in production.
if (process.env.NODE_ENV !== 'production') {
  app.use('/dev/mock-council-registry', mockCouncilRegistryRouter);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'zimhealth-api', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Only listen when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ZimHealth API running on port ${PORT}`);
  });
  scheduleDailySync().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Council Sync] Schedule failed:', message);
  });
  scheduleRenewalReminders().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Notifications] Schedule failed:', message);
  });
}

export default app;
