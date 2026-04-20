import { Redis } from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const CACHE_TTL = 60 * 60 * 24; // 24 hours

/**
 * Optional runtime override for the active AI provider.
 * Written by the backend admin endpoint to: `config:ai:provider`
 */
export async function getAIProviderOverride(): Promise<string | null> {
  return redis.get('config:ai:provider');
}

export function cacheKey(question: string): string {
  return `ai:cache:${crypto.createHash('sha256').update(question.toLowerCase().trim()).digest('hex')}`;
}

export async function getCached(question: string): Promise<string | null> {
  return redis.get(cacheKey(question));
}

export async function setCached(question: string, answer: string): Promise<void> {
  await redis.setex(cacheKey(question), CACHE_TTL, answer);
}
