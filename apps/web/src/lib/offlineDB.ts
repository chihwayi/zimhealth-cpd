import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

// ─── Schema types ─────────────────────────────────────────────────────────────

export interface OfflineModule {
  id: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  moduleOrder: number;
  sections: OfflineSection[];
  quizzes: OfflineQuiz[];
  savedAt: number;
}

export interface OfflineSection {
  id: string;
  type: 'VIDEO' | 'READING' | 'AUDIO' | 'INTERACTIVE' | 'QUIZ';
  title: string;
  order: number;
  content: string;
  mediaUrl?: string | null;
}

export interface OfflineQuiz {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  passMark: number; // 0..1
  attemptLimit: number;
  showAnswersAfter: boolean;
  questions: Array<{
    id: string;
    text: string;
    imageUrl?: string | null;
    correctOptionId?: string | null;
    options: Array<{ id: string; text: string }>;
  }>;
}

export interface PendingProgress {
  key: string; // `${enrollmentId}_${sectionId}`
  enrollmentId: string;
  sectionId: string;
  totalSections: number;
  queuedAt: number;
}

export interface PendingQuizAttempt {
  key: string; // `${quizId}_${queuedAt}`
  quizId: string;
  courseId: string;
  moduleId: string;
  answers: Record<string, string>;
  attemptedAt: number;
  queuedAt: number;
}

// ─── DB setup ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nursepro-offline';
const DB_VERSION = 3;

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_modules')) {
        const store = db.createObjectStore('offline_modules', { keyPath: 'id' });
        store.createIndex('by_course', 'courseId');
      }
      if (!db.objectStoreNames.contains('pending_progress')) {
        db.createObjectStore('pending_progress', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('pending_quiz_attempts')) {
        const store = db.createObjectStore('pending_quiz_attempts', { keyPath: 'key' });
        store.createIndex('by_quiz', 'quizId');
      }
    },
  });
  return _db;
}

// ─── Module cache ─────────────────────────────────────────────────────────────

export async function saveModuleOffline(module: OfflineModule): Promise<void> {
  const db = await getDB();
  await db.put('offline_modules', module);
}

export async function getOfflineModule(moduleId: string): Promise<OfflineModule | undefined> {
  const db = await getDB();
  return db.get('offline_modules', moduleId);
}

export async function getOfflineModulesForCourse(courseId: string): Promise<OfflineModule[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline_modules', 'by_course', courseId);
}

export async function getOfflineQuiz(quizId: string): Promise<OfflineQuiz | undefined> {
  const db = await getDB();
  const modules = (await db.getAll('offline_modules')) as OfflineModule[];
  for (const m of modules) {
    const q = m.quizzes?.find((x) => x.id === quizId);
    if (q) return q;
  }
  return undefined;
}

export async function deleteOfflineModule(moduleId: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline_modules', moduleId);
}

export async function isModuleOffline(moduleId: string): Promise<boolean> {
  const module = await getOfflineModule(moduleId);
  return !!module;
}

// ─── Pending progress sync ────────────────────────────────────────────────────

export async function queueProgressUpdate(
  enrollmentId: string,
  sectionId: string,
  totalSections: number,
): Promise<void> {
  const db = await getDB();
  const entry: PendingProgress = {
    key: `${enrollmentId}_${sectionId}`,
    enrollmentId,
    sectionId,
    totalSections,
    queuedAt: Date.now(),
  };
  await db.put('pending_progress', entry);
}

export async function getPendingProgressUpdates(): Promise<PendingProgress[]> {
  const db = await getDB();
  return db.getAll('pending_progress');
}

export async function clearPendingProgress(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_progress', key);
}

// ─── Pending quiz attempt sync ────────────────────────────────────────────────

export async function queueQuizAttempt(
  quizId: string,
  courseId: string,
  moduleId: string,
  answers: Record<string, string>,
): Promise<PendingQuizAttempt> {
  const db = await getDB();
  const attemptedAt = Date.now();
  const queuedAt = Date.now();
  const entry: PendingQuizAttempt = {
    key: `${quizId}_${queuedAt}`,
    quizId,
    courseId,
    moduleId,
    answers,
    attemptedAt,
    queuedAt,
  };
  await db.put('pending_quiz_attempts', entry);
  return entry;
}

export async function getPendingQuizAttempts(): Promise<PendingQuizAttempt[]> {
  const db = await getDB();
  return db.getAll('pending_quiz_attempts');
}

export async function clearPendingQuizAttempt(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_quiz_attempts', key);
}

export async function syncPendingQuizAttempts(
  apiFn: (entry: PendingQuizAttempt) => Promise<unknown>,
): Promise<number> {
  const pending = await getPendingQuizAttempts();
  let synced = 0;

  for (const entry of pending) {
    try {
      await apiFn(entry);
      await clearPendingQuizAttempt(entry.key);
      synced++;
    } catch {
      // Leave in queue to retry later
    }
  }

  return synced;
}

// ─── Sync pending progress updates when back online ──────────────────────────

export async function syncPendingProgress(
  apiFn: (enrollmentId: string, sectionId: string, totalSections: number) => Promise<unknown>,
): Promise<number> {
  const pending = await getPendingProgressUpdates();
  let synced = 0;

  for (const entry of pending) {
    try {
      await apiFn(entry.enrollmentId, entry.sectionId, entry.totalSections);
      await clearPendingProgress(entry.key);
      synced++;
    } catch {
      // Leave in queue to retry later
    }
  }

  return synced;
}
