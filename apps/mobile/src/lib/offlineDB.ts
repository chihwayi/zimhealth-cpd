import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('zimhealth_offline.db');
  }
  return _db;
}

export function initOfflineDB(): void {
  const db = getDb();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS pending_progress (
      enrollment_id TEXT NOT NULL,
      section_id    TEXT NOT NULL,
      queued_at     INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (enrollment_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS offline_modules (
      module_id   TEXT PRIMARY KEY,
      data_json   TEXT NOT NULL,
      saved_at    INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS pending_quiz_attempts (
      local_id      TEXT PRIMARY KEY,
      quiz_id       TEXT NOT NULL,
      enrollment_id TEXT NOT NULL DEFAULT '',
      section_id    TEXT NOT NULL DEFAULT '',
      answers_json  TEXT NOT NULL,
      queued_at     INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS offline_assets (
      remote_url TEXT PRIMARY KEY,
      local_uri  TEXT NOT NULL,
      status     TEXT NOT NULL,
      saved_at   INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS offline_course_cache (
      course_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      saved_at  INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  try { db.execSync(`ALTER TABLE pending_quiz_attempts ADD COLUMN enrollment_id TEXT NOT NULL DEFAULT ''`); } catch {}
  try { db.execSync(`ALTER TABLE pending_quiz_attempts ADD COLUMN section_id TEXT NOT NULL DEFAULT ''`); } catch {}
  try { db.execSync(`ALTER TABLE offline_assets ADD COLUMN resume_data TEXT`); } catch {}
}

// ── Pending progress ──────────────────────────────────────────────────────────

export async function savePendingProgress(
  enrollmentId: string,
  sectionId: string,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR IGNORE INTO pending_progress (enrollment_id, section_id) VALUES (?, ?)`,
    [enrollmentId, sectionId],
  );
}

export async function getPendingProgress(): Promise<
  Array<{ enrollmentId: string; sectionId: string }>
> {
  const rows = await getDb().getAllAsync<{ enrollment_id: string; section_id: string }>(
    `SELECT enrollment_id, section_id FROM pending_progress ORDER BY queued_at ASC`,
  );
  return rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    sectionId: row.section_id,
  }));
}

export async function clearPendingProgress(
  enrollmentId: string,
  sectionId: string,
): Promise<void> {
  await getDb().runAsync(
    `DELETE FROM pending_progress WHERE enrollment_id = ? AND section_id = ?`,
    [enrollmentId, sectionId],
  );
}

// ── Offline module cache ──────────────────────────────────────────────────────

export async function saveOfflineModule(moduleId: string, data: unknown): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO offline_modules (module_id, data_json) VALUES (?, ?)`,
    [moduleId, JSON.stringify(data)],
  );
}

export async function getOfflineModule<T = unknown>(moduleId: string): Promise<T | null> {
  const row = await getDb().getFirstAsync<{ data_json: string }>(
    `SELECT data_json FROM offline_modules WHERE module_id = ?`,
    [moduleId],
  );
  if (!row) return null;
  return JSON.parse(row.data_json) as T;
}

// ── Pending quiz attempts ─────────────────────────────────────────────────────

export async function savePendingQuizAttempt(
  localId: string,
  quizId: string,
  enrollmentId: string,
  sectionId: string,
  answers: Record<string, string>,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO pending_quiz_attempts
       (local_id, quiz_id, enrollment_id, section_id, answers_json)
     VALUES (?, ?, ?, ?, ?)`,
    [localId, quizId, enrollmentId, sectionId, JSON.stringify(answers)],
  );
}

export async function getPendingQuizAttempts(): Promise<
  Array<{
    localId: string;
    quizId: string;
    enrollmentId: string;
    sectionId: string;
    answers: Record<string, string>;
  }>
> {
  const rows = await getDb().getAllAsync<{
    local_id: string;
    quiz_id: string;
    enrollment_id: string;
    section_id: string;
    answers_json: string;
  }>(
    `SELECT local_id, quiz_id, enrollment_id, section_id, answers_json
     FROM pending_quiz_attempts ORDER BY queued_at ASC`,
  );
  return rows.map((row) => ({
    localId: row.local_id,
    quizId: row.quiz_id,
    enrollmentId: row.enrollment_id,
    sectionId: row.section_id,
    answers: JSON.parse(row.answers_json) as Record<string, string>,
  }));
}

export async function clearPendingQuizAttempt(localId: string): Promise<void> {
  await getDb().runAsync(
    `DELETE FROM pending_quiz_attempts WHERE local_id = ?`,
    [localId],
  );
}

// ── Offline asset cache ───────────────────────────────────────────────────────

export async function saveOfflineAsset(
  remoteUrl: string,
  localUri: string,
  status: 'ready' | 'failed',
  resumeData?: string,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO offline_assets (remote_url, local_uri, status, resume_data)
     VALUES (?, ?, ?, ?)`,
    [remoteUrl, localUri, status, resumeData ?? null],
  );
}

export async function getOfflineAsset(
  remoteUrl: string,
): Promise<{ localUri: string; status: string; resumeData?: string } | null> {
  const row = await getDb().getFirstAsync<{
    local_uri: string;
    status: string;
    resume_data: string | null;
  }>(
    `SELECT local_uri, status, resume_data FROM offline_assets WHERE remote_url = ?`,
    [remoteUrl],
  );
  if (!row) return null;
  return {
    localUri: row.local_uri,
    status: row.status,
    resumeData: row.resume_data ?? undefined,
  };
}

export async function saveOfflineCourseList(courses: unknown[]): Promise<void> {
  for (const course of courses) {
    const c = course as { id: string };
    await getDb().runAsync(
      `INSERT OR REPLACE INTO offline_course_cache (course_id, data_json) VALUES (?, ?)`,
      [c.id, JSON.stringify(c)],
    );
  }
}

export async function getOfflineCourseList<T = unknown>(): Promise<T[]> {
  const rows = await getDb().getAllAsync<{ data_json: string }>(
    `SELECT data_json FROM offline_course_cache ORDER BY saved_at DESC`,
  );
  return rows.map((r) => JSON.parse(r.data_json) as T);
}

export async function saveOfflineCourseDetail(courseId: string, detail: unknown): Promise<void> {
  await saveOfflineModule(`course-detail:${courseId}`, detail);
}

export async function getOfflineCourseDetail<T = unknown>(courseId: string): Promise<T | null> {
  return getOfflineModule<T>(`course-detail:${courseId}`);
}

export async function getCourseDownloadStatus(
  courseId: string,
): Promise<'downloaded' | 'partial' | 'not_downloaded'> {
  const modules = await getOfflineModule<
    Array<{ sections?: Array<{ type: string; content: string }> }>
  >(`course:${courseId}`);

  if (!modules) return 'not_downloaded';

  const assetUrls = modules
    .flatMap((m) => m.sections ?? [])
    .filter(
      (s) =>
        ['VIDEO', 'DOCUMENT', 'IMAGE'].includes(s.type) &&
        /^https?:\/\//i.test(s.content),
    )
    .map((s) => s.content);

  if (assetUrls.length === 0) return 'downloaded';

  for (const url of assetUrls) {
    const asset = await getOfflineAsset(url);
    if (!asset || asset.status !== 'ready') return 'partial';
  }

  return 'downloaded';
}
