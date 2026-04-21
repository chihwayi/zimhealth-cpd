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
import certificatesRouter from './routes/certificates';
import entitlementsRouter from './routes/entitlements';
import adminRouter from './routes/admin';
import nczRouter from './routes/ncz';
import creatorRouter from './routes/creator';
import botRouter from './routes/bot';
import aiRouter from './routes/ai';
import telemetryRouter from './routes/telemetry';
import { scheduleDailySync } from './jobs/syncWorker';
import recommendationsRouter from './routes/recommendations';
import { scheduleRenewalReminders } from './jobs/notificationWorker';
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';

const app: express.Express = express();
const PORT = process.env.PORT ?? 4000;
const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
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
app.use('/api/certificates', certificatesRouter);
app.use('/api/entitlements', entitlementsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ncz', nczRouter);
app.use('/api/creator', creatorRouter);
app.use('/api', recommendationsRouter);
app.use('/api/bot', botRouter);
app.use('/api/ai', aiRouter);
app.use('/api', telemetryRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-api', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Only listen when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NursePro API running on port ${PORT}`);
  });
  scheduleDailySync().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[NCZ Sync] Schedule failed:', message);
  });
  scheduleRenewalReminders().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Notifications] Schedule failed:', message);
  });
}

export default app;
