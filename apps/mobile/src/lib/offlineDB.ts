import * as SQLite from 'expo-sqlite';

// Lazy-initialised so the top-level import never throws.
// openDatabaseSync is called only the first time any DB function is used,
// safely inside initOfflineDB() which runs inside a useEffect.
let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('zimhealth_offline.db');
  }
  return _db;
}

export function initOfflineDB(): void {
  getDb().execSync(`
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
      local_id     TEXT PRIMARY KEY,
      quiz_id      TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      queued_at    INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS offline_assets (
      remote_url TEXT PRIMARY KEY,
      local_uri  TEXT NOT NULL,
      status     TEXT NOT NULL,
      saved_at   INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
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
  answers: Record<string, string>,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO pending_quiz_attempts (local_id, quiz_id, answers_json) VALUES (?, ?, ?)`,
    [localId, quizId, JSON.stringify(answers)],
  );
}

export async function getPendingQuizAttempts(): Promise<
  Array<{ localId: string; quizId: string; answers: Record<string, string> }>
> {
  const rows = await getDb().getAllAsync<{
    local_id: string;
    quiz_id: string;
    answers_json: string;
  }>(
    `SELECT local_id, quiz_id, answers_json FROM pending_quiz_attempts ORDER BY queued_at ASC`,
  );
  return rows.map((row) => ({
    localId: row.local_id,
    quizId: row.quiz_id,
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
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO offline_assets (remote_url, local_uri, status) VALUES (?, ?, ?)`,
    [remoteUrl, localUri, status],
  );
}

export async function getOfflineAsset(
  remoteUrl: string,
): Promise<{ localUri: string; status: string } | null> {
  const row = await getDb().getFirstAsync<{ local_uri: string; status: string }>(
    `SELECT local_uri, status FROM offline_assets WHERE remote_url = ?`,
    [remoteUrl],
  );
  if (!row) return null;
  return { localUri: row.local_uri, status: row.status };
}
