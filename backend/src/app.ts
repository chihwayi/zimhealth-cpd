import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRouter from './routes/auth';
import pointsRouter from './routes/points';

const app: express.Express = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/points', pointsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-api', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Only listen when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NursePro API running on port ${PORT}`);
  });
}

export default app;

