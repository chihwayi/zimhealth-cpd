import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const SESSION_TTL = 60 * 60 * 24; // 24 hours inactivity

export type BotState = 'MENU' | 'LEARNING' | 'QUIZ' | 'AI_TUTOR' | 'PAYMENT' | 'AWAITING_REGISTRATION';

export interface BotSession {
  phone: string;
  userId?: string;
  state: BotState;
  quizState?: {
    quizId: string;
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ id: string; text: string }>;
      correctId: string;
    }>;
    currentIndex: number;
    answers: Record<string, string>;
    score: number;
  };
  lastActivity: number;
}

function key(phone: string): string {
  return `bot:session:${phone}`;
}

export async function getSession(phone: string): Promise<BotSession> {
  const raw = await redis.get(key(phone));
  if (raw) {
    await redis.expire(key(phone), SESSION_TTL);
    return JSON.parse(raw) as BotSession;
  }
  return { phone, state: 'MENU', lastActivity: Date.now() };
}

export async function saveSession(session: BotSession): Promise<void> {
  session.lastActivity = Date.now();
  await redis.setex(key(session.phone), SESSION_TTL, JSON.stringify(session));
}

export async function clearSession(phone: string): Promise<void> {
  await redis.del(key(phone));
}

