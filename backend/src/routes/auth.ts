import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  hashPassword,
  verifyPassword,
} from '../services/auth.service';
import { RegisterSchema, LoginSchema, RefreshSchema } from './auth.schema';
import { requireAuth } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';

const router: ExpressRouter = Router();

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
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
      },
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
    const decoded = jwt.decode(refreshToken) as { sub?: string } | null;
    if (!decoded?.sub) return res.status(400).json({ error: 'Logout failed' });
    await revokeRefreshToken(decoded.sub);
    res.json({ message: 'Logged out successfully' });
  } catch {
    res.status(400).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me (requires auth)
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        cadre: true,
        nczRegistrationNumber: true,
        institution: true,
        province: true,
        district: true,
        phone: true,
        avatarUrl: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Could not fetch user' });
  }
});

export default router;

