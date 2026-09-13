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
import {
  RegisterSchema,
  RegisterCreatorSchema,
  LoginSchema,
  RefreshSchema,
  UpdateProfileSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from './auth.schema';
import { requireAuth } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { sendEmail } from '../lib/email';

const router: ExpressRouter = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const council = await db.council.findFirst({
      where: { id: data.councilId, isActive: true },
      select: { id: true, acronym: true, allowedTitles: true },
    });
    if (!council) return res.status(400).json({ error: 'Select a valid council.' });
    if (!council.allowedTitles.includes(data.professionalTitle)) {
      return res.status(400).json({ error: 'Select a valid professional title for this council.' });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        councilId: data.councilId,
        professionalTitle: data.professionalTitle,
        registrationNumber: data.registrationNumber,
        cadre: data.cadre as any,
        nczRegistrationNumber: council.acronym === 'NCZ' ? data.registrationNumber : data.nczRegistrationNumber,
        institution: data.institution,
        province: data.province,
        district: data.district,
        phone: data.phone,
      },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        councilId: user.councilId,
        professionalTitle: user.professionalTitle,
        registrationNumber: user.registrationNumber,
        nczRegistrationNumber: user.nczRegistrationNumber,
        cadre: user.cadre,
        subscriptionTier: user.subscriptionTier,
      },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Email, phone, or registration number is already registered.' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/register-creator
// Creators self-register, but require Admin approval before accessing creator tools.
router.post('/register-creator', async (req, res) => {
  try {
    const data = RegisterCreatorSchema.parse(req.body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    let councilId: string | undefined = undefined;
    if (data.councilId) {
      const council = await db.council.findFirst({ where: { id: data.councilId, isActive: true }, select: { id: true } });
      if (!council) return res.status(400).json({ error: 'Select a valid council.' });
      councilId = council.id;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: 'CONTENT_MANAGER',
        councilId,
        professionalTitle: data.professionalTitle ?? 'Course Creator',
        isApproved: false,
      },
    });

    return res.status(201).json({
      ok: true,
      message:
        'Your creator account has been created and is pending Admin approval. You will be able to access creator tools once approved.',
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isApproved: user.isApproved },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    return res.status(500).json({ error: 'Registration failed' });
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

    if (user.role === 'CONTENT_MANAGER' && !user.isApproved) {
      return res.status(403).json({
        error:
          'Your creator account is pending approval. Please contact the platform admin to verify your account before you can access creator tools.',
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        councilId: user.councilId,
        professionalTitle: user.professionalTitle,
        registrationNumber: user.registrationNumber,
        nczRegistrationNumber: user.nczRegistrationNumber,
        cadre: user.cadre,
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

async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  await sendEmail(
    toEmail,
    'Reset your ZimHealth password',
    `You requested a password reset.\n\nOpen this link to set a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  );
}

// POST /api/auth/forgot-password
// Always returns 200 to avoid account enumeration.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await db.user.update({
        where: { id: user.id },
        data: { resetPasswordTokenHash: tokenHash, resetPasswordExpiresAt: expiresAt },
      });

      const webBase = process.env.WEB_URL ?? 'http://localhost:3000';
      const resetUrl = `${webBase}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not start password reset' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = ResetPasswordSchema.parse(req.body);
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await db.user.findFirst({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { gt: new Date() },
      },
    });
    if (!user) return res.status(400).json({ error: 'Reset link is invalid or expired.' });

    const passwordHash = await hashPassword(password);
    await db.user.update({
      where: { id: user.id },
        data: {
          passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    // Revoke refresh token so previously logged-in sessions can’t continue.
    await revokeRefreshToken(user.id).catch(() => null);

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user.id);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        councilId: user.councilId,
        professionalTitle: user.professionalTitle,
        registrationNumber: user.registrationNumber,
        nczRegistrationNumber: user.nczRegistrationNumber,
        cadre: user.cadre,
        subscriptionTier: user.subscriptionTier,
      },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not reset password' });
  }
});

const ME_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  councilId: true,
  council: { select: { id: true, name: true, acronym: true, requiredPoints: true, renewalMonth: true, renewalDay: true, allowedTitles: true } },
  professionalTitle: true,
  registrationNumber: true,
  cadre: true,
  nczRegistrationNumber: true,
  institution: true,
  province: true,
  district: true,
  phone: true,
  avatarUrl: true,
  specialtyArea: true,
  subscriptionTier: true,
  subscriptionExpiresAt: true,
  isActive: true,
  createdAt: true,
} as const;

// GET /api/auth/me (requires auth)
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: ME_SELECT,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Could not fetch user' });
  }
});

// PATCH /api/auth/me — update own profile (name, professional fields, avatar URL)
router.patch('/me', requireAuth, async (req: any, res) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);

    try {
      const updated = await db.user.update({
        where: { id: req.user.id },
        data,
        select: ME_SELECT,
      });
      res.json(updated);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'That phone number or registration number is already used on another account.' });
      }
      throw err;
    }
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not update profile' });
  }
});

export default router;
