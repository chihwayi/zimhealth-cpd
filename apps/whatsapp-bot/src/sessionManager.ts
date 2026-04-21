import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const SESSION_TTL = 60 * 60 * 24; // 24 hours inactivity

export type BotState =
  | 'MENU'
  | 'LEARNING'
  | 'QUIZ'
  | 'AI_TUTOR'
  | 'PAYMENT'
  | 'AWAITING_REGISTRATION';

export interface BotCourseOption {
  id: string;
  title: string;
  moduleCount: number;
  progressPercent: number;
}

export interface BotModuleOption {
  id: string;
  title: string;
  order: number;
  sectionCount: number;
}

export interface BotSection {
  id: string;
  type: 'VIDEO' | 'READING' | 'AUDIO' | 'INTERACTIVE' | 'QUIZ';
  title: string;
  content: string;
  mediaUrl?: string | null;
}

export interface BotQuizQuestion {
  id: string;
  text: string;
  options: Array<{ letter: string; text: string }>;
  correctLetter: string;
}

export interface LearningState {
  step: 'SELECT_COURSE' | 'SELECT_MODULE' | 'READING';
  courseOptions?: BotCourseOption[];
  moduleOptions?: BotModuleOption[];
  courseId?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  sections: BotSection[];
  quizId?: string | null;
  quizQuestions?: BotQuizQuestion[];
  sectionIndex: number; // which section we're currently on
}

export interface RegistrationState {
  step: 'NAME' | 'CADRE' | 'NCZ' | 'INSTITUTION' | 'CONFIRM';
  fullName?: string;
  cadre?: string;
  nczRegistrationNumber?: string;
  institution?: string;
}

export interface BotSession {
  phone: string;
  userId?: string;
  state: BotState;
  registrationState?: RegistrationState;
  learningState?: LearningState;
  quizState?: {
    quizId: string;
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ letter: string; text: string }>;
      correctLetter: string;
    }>;
    currentIndex: number;
    answers: Record<string, string>;
    score: number;
    // When set, return to LEARNING after quiz instead of MENU
    returnToLearning?: boolean;
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
