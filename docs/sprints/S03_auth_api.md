# Sprint 03 — Auth API

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Full authentication system — register, login, JWT tokens, refresh, RBAC middleware. Every subsequent sprint depends on this working correctly.

---

## Inputs (must be complete)
- [ ] S01 and S02 complete
- [ ] `backend/src/lib/db.ts` — Prisma singleton
- [ ] `backend/src/lib/redis.ts` — Redis singleton
- [ ] Users table seeded with dev credentials

---

## Tasks

### T03.1 — Install missing backend deps (if not installed)
```bash
RUN COMMAND: cd backend && pnpm install
```

---

### T03.2 — Auth validation schemas

CREATE FILE: `backend/src/routes/auth.schema.ts`
```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  cadre: z.enum(['NURSE','MIDWIFE','PHARMACIST','CLINICAL_OFFICER','LAB_TECH']).optional(),
  nczRegistrationNumber: z.string().optional(),
  institution: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  phone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
```

---

### T03.3 — Auth service

CREATE FILE: `backend/src/services/auth.service.ts`
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import type { User, Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface TokenPayload {
  sub: string;   // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export async function signRefreshToken(userId: string): Promise<string> {
  const token = jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
  await redis.setex(`refresh:${userId}`, REFRESH_TTL_SECONDS, token);
  return token;
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<string> {
  const payload = jwt.verify(token, JWT_SECRET) as { sub: string; type: string };
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  const stored = await redis.get(`refresh:${payload.sub}`);
  if (stored !== token) throw new Error('Refresh token revoked or invalid');
  return payload.sub;
}

export async function revokeRefreshToken(userId: string): Promise<void> {
  await redis.del(`refresh:${userId}`);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}
```

---

### T03.4 — Auth middleware

CREATE FILE: `backend/src/middleware/auth.middleware.ts`
```typescript
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

CREATE FILE: `backend/src/middleware/role.middleware.ts`
```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

---

### T03.5 — Auth routes

CREATE FILE: `backend/src/routes/auth.ts`
```typescript
import { Router } from 'express';
import { db } from '../lib/db';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  revokeRefreshToken, hashPassword, verifyPassword,
} from '../services/auth.service';
import { RegisterSchema, LoginSchema, RefreshSchema } from './auth.schema';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await hashPassword(data.password);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        cadre: data.cadre as any,
        nczRegistrationNumber: data.nczRegistrationNumber,
        institution: data.institution,
        province: data.province,
        district: data.district,
        phone: data.phone,
      },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user.id);

    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, subscriptionTier: user.subscriptionTier },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const userId = await verifyRefreshToken(refreshToken);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = await signRefreshToken(user.id);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const { sub } = require('jsonwebtoken').decode(refreshToken) as { sub: string };
    await revokeRefreshToken(sub);
    res.json({ message: 'Logged out successfully' });
  } catch {
    res.status(400).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me  (requires auth)
import { requireAuth } from '../middleware/auth.middleware';
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, fullName: true, role: true, cadre: true,
        nczRegistrationNumber: true, institution: true, province: true, district: true,
        phone: true, avatarUrl: true, subscriptionTier: true, subscriptionExpiresAt: true,
        isActive: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Could not fetch user' });
  }
});

export default router;
```

---

### T03.6 — Wire routes into app.ts

EDIT FILE: `backend/src/app.ts`
Replace the existing content with:
```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-api', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`NursePro API running on port ${PORT}`);
});

export default app;
```

---

### T03.7 — Write auth tests

CREATE FILE: `backend/src/routes/auth.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../lib/db';

const TEST_EMAIL = `test+${Date.now()}@nursepro.co.zw`;
const TEST_PASSWORD = 'Test@1234';

describe('Auth API', () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('POST /api/auth/register — creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      fullName: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /api/auth/login — returns tokens', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('GET /api/auth/me — returns user with valid token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const { accessToken } = loginRes.body;
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(TEST_EMAIL);
  });
});
```

Install `supertest`:
```bash
RUN COMMAND: cd backend && pnpm add -D supertest @types/supertest
```

Run tests:
```bash
RUN COMMAND: cd backend && pnpm test
```

---

## Validation Checklist

- [ ] `POST /api/auth/register` with valid body returns 201 + tokens
- [ ] `POST /api/auth/register` with duplicate email returns 409
- [ ] `POST /api/auth/login` with correct credentials returns 200 + tokens
- [ ] `POST /api/auth/login` with wrong password returns 401
- [ ] `GET /api/auth/me` with valid Bearer token returns user object
- [ ] `GET /api/auth/me` without token returns 401
- [ ] `requireRole('ADMIN')` blocks a LEARNER — returns 403
- [ ] All auth tests pass: `pnpm test`

**Sign-off:** Claude Code validates test results and API responses before S04 begins.
