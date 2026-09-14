import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import type { User, Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET as jwt.Secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function assertSecureJwtSecret(): void {
  if (process.env.NODE_ENV === 'production') {
    const secret = String(process.env.JWT_SECRET ?? '');
    if (secret.length < 64 || secret === 'change-me-to-a-long-random-string') {
      throw new Error('JWT_SECRET must be a production-grade random string with at least 64 characters');
    }
  }
}

export interface TokenPayload {
  sub: string; // userId
  email: string;
  role: Role;
  // Set only for impersonation tokens: the id of the PLATFORM_OWNER who
  // triggered the impersonation. Every action taken while this claim is
  // present is attributable to both the impersonated user AND the real actor.
  impersonatedBy?: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  assertSecureJwtSecret();
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

const IMPERSONATION_TTL = '30m';

// Short-lived, non-refreshable token for support impersonation. No refresh
// token is ever issued for this — the session simply expires in 30 minutes
// and the Platform Owner must re-trigger it. See routes/auth.ts
// POST /impersonate/:userId.
export function signImpersonationToken(
  target: Pick<User, 'id' | 'email' | 'role'>,
  platformOwnerId: string,
): string {
  assertSecureJwtSecret();
  return jwt.sign(
    { sub: target.id, email: target.email, role: target.role, impersonatedBy: platformOwnerId },
    JWT_SECRET,
    { expiresIn: IMPERSONATION_TTL },
  );
}

export async function signRefreshToken(userId: string): Promise<string> {
  assertSecureJwtSecret();
  const token = jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
  await redis.setex(`refresh:${userId}`, REFRESH_TTL_SECONDS, token);
  return token;
}

export function verifyAccessToken(token: string): TokenPayload {
  assertSecureJwtSecret();
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<string> {
  assertSecureJwtSecret();
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
