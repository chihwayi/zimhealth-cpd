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
  title: string;
}

export interface PendingProgress {
  key: string; // `${enrollmentId}_${sectionId}`
  enrollmentId: string;
  sectionId: string;
  totalSections: number;
  queuedAt: number;
}

// ─── DB setup ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nursepro-offline';
const DB_VERSION = 1;

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
