import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import type { User, Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET as jwt.Secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface TokenPayload {
  sub: string; // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
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

