# Sprint S19 — Mobile app full implementation

### Priority: HIGH
### Feature: Feature 1 (Three access channels) + Feature 2 (Offline mode) + Feature 5 (Credit tracking)

---

## What this sprint fixes and completes

The mobile app exists but has five concrete defects and several missing features that leave
it non-functional as a learning tool:

| # | Problem | File | Impact |
|---|---------|------|--------|
| 1 | `completedSectionIds` used but API returns `completedSections` | `CoursePlayerScreen.tsx` | Progress is always 0%, Mark Complete never shows as done |
| 2 | `api.post` used instead of `api.patch` for marking a section complete | `CoursePlayerScreen.tsx` | Every mark-complete call gets a 404 |
| 3 | `/api/points/my` does not exist — endpoint is `/api/points/summary` | `DashboardScreen.tsx` | CPD progress bar always empty |
| 4 | `/api/certificates/my` does not exist — endpoint is `/api/certificates/` | `CertificatesScreen.tsx` | Certificate list never loads |
| 5 | FREE-tier learners see a broken Download PDF button (backend returns 402) | `CertificatesScreen.tsx` | Confusing UX, same bug as web S17 |
| 6 | VIDEO sections show a static placeholder — no playback | `CoursePlayerScreen.tsx` | Core learning broken for video courses |
| 7 | DOCUMENT/PDF sections show an image placeholder — no way to view | `CoursePlayerScreen.tsx` | Core learning broken for PDF courses |
| 8 | "Download for offline use" button is a no-op (comment: "Sprint 3") | `CourseDetailScreen.tsx` | Offline mode promise unmet |
| 9 | No `useOnlineStatus` hook — offline-queued progress never syncs on reconnect | missing file | Offline completions lost |
| 10 | `DashboardScreen.tsx` `PointsData` type uses wrong shape | `DashboardScreen.tsx` | TypeScript errors; fallback values always shown |
| 11 | No subscription/voucher screen — learners with sponsor codes cannot redeem on mobile | missing file | Voucher programme unusable on mobile |
| 12 | Enrollment uses `POST /api/enrollments`, but backend enrolls with `POST /api/courses/:id/enroll` | `CourseDetailScreen.tsx` | Mobile "Enrol Now" fails |
| 13 | `QUIZ_LINK` sections are not playable | `CoursePlayerScreen.tsx` | Learners cannot complete course quizzes in-app |
| 14 | Offline download stores course/module JSON only | `CourseDetailScreen.tsx`, `offlineDB.ts` | Videos/PDFs/images still fail offline |
| 15 | Offline quiz attempts are not queued or synced | `CoursePlayerScreen.tsx`, `offlineDB.ts`, `useOnlineStatus.ts` | Offline quiz completions are lost |
| 16 | No current-cycle Wi-Fi pack preparation | new helper/hook or screen action | Learners must manually open/download individual courses |

---

## New packages to install

Run these from `apps/mobile/`:

```bash
npx expo install expo-av expo-web-browser @react-native-community/netinfo
```

- `expo-av` — native video player component
- `expo-web-browser` — opens a URL in the OS browser/SFSafariViewController (used for PDFs)
- `@react-native-community/netinfo` — detects online/offline state changes

`expo-sqlite` is already in `package.json` and is used for offline storage.

---

## Exact files to change

1. `apps/mobile/src/screens/learner/CoursePlayerScreen.tsx` — fix API shape, fix HTTP verb, add video player, add PDF viewer, add quiz player/offline quiz queue
2. `apps/mobile/src/screens/learner/DashboardScreen.tsx` — fix points endpoint and type
3. `apps/mobile/src/screens/learner/CertificatesScreen.tsx` — fix endpoint, add FREE-tier gate, wire PDF download
4. `apps/mobile/src/screens/learner/CourseDetailScreen.tsx` — fix enrollment route and wire offline download button
5. `apps/mobile/src/lib/offlineDB.ts` — **new file** — SQLite-backed offline storage, pending progress, pending quiz attempts, and downloaded asset manifest
6. `apps/mobile/src/hooks/useOnlineStatus.ts` — **new file** — NetInfo hook + bulk progress/quiz sync on reconnect
7. `apps/mobile/src/screens/learner/SubscriptionScreen.tsx` — **new file** — voucher redemption + tier info

---

## Part A0 — Fix mobile enrollment route

Before fixing the player, make sure learners can actually enter it.

In `CourseDetailScreen.tsx`, replace the invalid enrollment mutation:

```ts
// BEFORE:
api.post<Enrollment>('/api/enrollments', { courseId })

// AFTER:
api.post<Enrollment>(`/api/courses/${courseId}/enroll`, {})
```

Acceptance:

- Tapping "Enrol Now" creates or returns an enrollment and navigates to `CoursePlayer`.
- The request works for FREE learners when the course is council-approved/public and not paywalled.
- Re-enrolling in the same course is idempotent or gracefully returns the existing enrollment.

---

## Part A — Fix `CoursePlayerScreen.tsx`

### A1 — Fix API type mismatch and HTTP verb

At the top of the file, replace the `EnrollmentProgress` type:

```ts
// BEFORE:
type EnrollmentProgress = {
  completedSectionIds: string[];
};

// AFTER:
type EnrollmentProgress = {
  completedSections: string[];
  progressPercent: number;
};
```

The `progress` query also uses the wrong URL. The enrollment object returned by
`GET /api/enrollments` already contains `completedSections`. Rather than adding a
separate progress query, update the `progress` query to use the correct shape:

Find the line:
```ts
const completedIds = progress?.completedSectionIds ?? [];
```

Replace with:
```ts
const completedIds = progress?.completedSections ?? [];
```

Find the `completeMutation`:
```ts
// BEFORE:
const completeMutation = useMutation({
  mutationFn: (sectionId: string) =>
    api.post(`/api/enrollments/${enrollmentId}/progress`, { sectionId }),
```

Replace `api.post` with `api.patch`:
```ts
// AFTER:
const completeMutation = useMutation({
  mutationFn: (sectionId: string) =>
    api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId }),
```

Also fix the progress query URL — the current query fetches
`/api/enrollments/${enrollmentId}/progress` which doesn't exist as a separate
endpoint. Replace the entire `progress` query with one that gets the enrollment directly:

```ts
// BEFORE:
const { data: progress } = useQuery({
  queryKey: ['enrollment-progress', enrollmentId],
  queryFn: () =>
    api.get<EnrollmentProgress>(`/api/enrollments/${enrollmentId}/progress`),
});

// AFTER:
const { data: enrollmentData } = useQuery({
  queryKey: ['enrollment-detail', enrollmentId],
  queryFn: () => api.get<{ id: string; completedSections: string[]; progressPercent: number }>(
    `/api/enrollments?courseId=${courseId}`,
  ).then((arr: any) => Array.isArray(arr) ? arr[0] : arr),
});
```

Then update the reference:
```ts
// BEFORE:
const completedIds = progress?.completedSectionIds ?? [];

// AFTER:
const completedIds = enrollmentData?.completedSections ?? [];
```

And update `onSuccess` to also invalidate the new query key:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['enrollment-detail', enrollmentId] });
  queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
},
```

### A2 — Add `expo-av` video player for VIDEO sections

Add the import at the top of the file:
```ts
import { Video, ResizeMode } from 'expo-av';
```

In the content render block, replace the VIDEO placeholder:

```tsx
// BEFORE:
} : currentSection.type === 'VIDEO' ? (
  <View className="bg-slate-900 rounded-2xl h-48 items-center justify-center">
    <Ionicons name="play-circle" size={52} color="white" />
    <Text className="text-white text-xs mt-2 opacity-60">Video content</Text>
  </View>
)

// AFTER:
} : currentSection.type === 'VIDEO' ? (
  <View className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: 16 / 9 }}>
    {currentSection.content ? (
      <Video
        source={{ uri: currentSection.content }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={{ flex: 1 }}
        shouldPlay={false}
      />
    ) : (
      <View className="flex-1 items-center justify-center">
        <Ionicons name="play-circle" size={52} color="white" />
        <Text className="text-white text-xs mt-2 opacity-60">No video URL</Text>
      </View>
    )}
  </View>
)
```

### A3 — Add PDF/document viewer for DOCUMENT sections

Add the import at the top of the file:
```ts
import * as WebBrowser from 'expo-web-browser';
```

In the content render block, find the final `else` branch (currently shows an image
placeholder). Replace it with a proper handler that distinguishes DOCUMENT from IMAGE:

```tsx
// BEFORE (the else branch):
) : (
  <View className="bg-slate-100 rounded-2xl h-48 items-center justify-center">
    <Ionicons name="image-outline" size={40} color="#94a3b8" />
  </View>
)}

// AFTER:
) : currentSection.type === 'DOCUMENT' ? (
  <View className="bg-slate-50 rounded-2xl border border-slate-200 p-6 items-center gap-y-4">
    <Ionicons name="document-text-outline" size={48} color="#0d9488" />
    <Text className="text-sm text-slate-600 text-center">PDF document</Text>
    {currentSection.content ? (
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(currentSection.content)}
        className="bg-primary-500 rounded-xl px-6 py-3"
      >
        <Text className="text-white font-semibold text-sm">Open PDF</Text>
      </Pressable>
    ) : (
      <Text className="text-xs text-slate-400">No document URL available</Text>
    )}
  </View>
) : (
  <View className="bg-slate-100 rounded-2xl h-48 items-center justify-center">
    <Ionicons name="image-outline" size={40} color="#94a3b8" />
  </View>
)}
```

Also update the `ContentSection` type to include `DOCUMENT`:
```ts
// BEFORE:
type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'QUIZ_LINK';

// AFTER:
type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'QUIZ_LINK';
```

---

## Part B — Fix `DashboardScreen.tsx`

### B1 — Fix the points endpoint and type

The endpoint `/api/points/my` does not exist. The correct endpoint is
`/api/points/summary` which returns a `getLearnerCPDSummary` result.

Replace the `PointsData` type:

```ts
// BEFORE:
type PointsData = {
  total: number;
  target: number;
  entries: Array<{ id: string; points: number; reason: string; createdAt: string }>;
};

// AFTER:
type PointsData = {
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  cycleYear: number;
};
```

Replace the points query:

```ts
// BEFORE:
const { data: pointsData, isLoading: pointsLoading } = useQuery({
  queryKey: ['points'],
  queryFn: () => api.get<PointsData>('/api/points/my'),
});

// AFTER:
const { data: pointsData, isLoading: pointsLoading } = useQuery({
  queryKey: ['points-summary'],
  queryFn: () => api.get<PointsData>('/api/points/summary'),
});
```

Fix the derived values to use the new field names:

```ts
// BEFORE:
const totalPoints   = pointsData?.total ?? 0;
const targetPoints  = pointsData?.target ?? 60;
const progressPct   = Math.min((totalPoints / targetPoints) * 100, 100);

// AFTER:
const totalPoints   = pointsData?.totalPoints ?? 0;
const targetPoints  = pointsData?.requiredPoints ?? 60;
const progressPct   = pointsData?.percentComplete ?? 0;
```

Also update the refresh handler to use the new query key:

```ts
// In the refreshControl onRefresh:
// BEFORE:
void queryClient.invalidateQueries({ queryKey: ['points'] });

// AFTER:
void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
```

---

## Part C — Fix `CertificatesScreen.tsx`

### C1 — Fix the API endpoint

```ts
// BEFORE:
queryFn: () => api.get<Certificate[]>('/api/certificates/my'),

// AFTER:
queryFn: () => api.get<Certificate[]>('/api/certificates'),
```

### C2 — Fix the Certificate type to include pdfUrl

```ts
// BEFORE:
type Certificate = {
  id: string;
  issuedAt: string;
  cpdPoints: number;
  verifyCode: string;
  course: { title: string; category: string };
};

// AFTER:
type Certificate = {
  id: string;
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  coursesCompleted: string[];
  issuedAt: string;
  pdfUrl: string | null;
  pdfKey: string | null;
};
```

Note: the `GET /api/certificates/` endpoint returns raw Prisma Certificate rows which
do NOT include a nested `course` object. Remove the `course` reference from the render.
Update the card to use the new fields:

```tsx
// In the renderItem, replace the card content:
<Card className="gap-y-3">
  <View className="h-1.5 bg-primary-500 rounded-full -mt-1" />

  <View className="flex-row items-start justify-between">
    <View className="flex-1 pr-4">
      <Text className="text-base font-bold text-slate-900 leading-5">
        CPD Certificate {item.cycleYear}
      </Text>
      <Text className="text-xs text-slate-500 mt-1">
        {item.coursesCompleted.length} course{item.coursesCompleted.length !== 1 ? 's' : ''} completed
      </Text>
      <Text className="text-xs text-slate-400 mt-1">
        Issued {new Date(item.issuedAt).toLocaleDateString('en-ZW', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}
      </Text>
    </View>

    <View className="items-center bg-primary-50 rounded-2xl px-3 py-2">
      <Text className="text-2xl font-bold text-primary-600">{item.totalPoints}</Text>
      <Text className="text-xs text-primary-500 font-medium">CPD pts</Text>
    </View>
  </View>

  <View className="flex-row gap-x-2 pt-1 border-t border-slate-100">
    <Pressable
      onPress={() => void shareCertificate(item)}
      className="flex-1 flex-row items-center justify-center gap-x-1.5 py-2"
    >
      <Ionicons name="share-social-outline" size={16} color="#0d9488" />
      <Text className="text-primary-600 text-sm font-semibold">Share</Text>
    </Pressable>

    <View className="w-px bg-slate-100" />

    {item.pdfUrl ? (
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(item.pdfUrl!)}
        className="flex-1 flex-row items-center justify-center gap-x-1.5 py-2"
      >
        <Ionicons name="cloud-download-outline" size={16} color="#0d9488" />
        <Text className="text-primary-600 text-sm font-semibold">Download PDF</Text>
      </Pressable>
    ) : (
      <View className="flex-1 flex-row items-center justify-center gap-x-1.5 py-2 opacity-40">
        <Ionicons name="cloud-download-outline" size={16} color="#94a3b8" />
        <Text className="text-slate-400 text-sm">No PDF yet</Text>
      </View>
    )}
  </View>
</Card>
```

### C3 — Add FREE-tier upgrade gate

Add imports at the top of the file:
```ts
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/auth.store';
```

At the top of the component function, add:
```ts
const user = useAuthStore((s) => s.user);
const isFree = !user?.subscriptionTier || user.subscriptionTier === 'FREE';
```

Update `shareCertificate` to match the new type:
```ts
async function shareCertificate(cert: Certificate) {
  await Share.share({
    title: `ZimHealth CPD Certificate ${cert.cycleYear}`,
    message: `I completed my CPD requirements for ${cert.cycleYear} and earned ${cert.totalPoints} CPD points on ZimHealth!\nVerification code: ${cert.certificateUuid}`,
  });
}
```

Wrap the FlatList (and loading skeletons) with an `isFree` check. Add this block
immediately **before** the `isLoading` conditional:

```tsx
{isFree ? (
  <View className="flex-1 items-center justify-center px-8">
    <Ionicons name="ribbon-outline" size={56} color="#cbd5e1" />
    <Text className="text-lg font-bold text-slate-900 mt-4 text-center">
      Certificate generation is a premium feature
    </Text>
    <Text className="text-sm text-slate-500 mt-2 text-center leading-5">
      Upgrade to Standard to download your official CPD certificate and have your
      points automatically submitted to your council.
    </Text>
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(`${BASE_URL}/subscription`)}
      className="mt-6 bg-amber-500 rounded-xl px-6 py-3"
    >
      <Text className="text-white font-semibold">View upgrade options</Text>
    </Pressable>
  </View>
) : (
  /* existing isLoading + FlatList block, unchanged */
  isLoading ? (
    ...
  ) : (
    <FlatList ... />
  )
)}
```

To get `BASE_URL` in this file, import it from the api module or reconstruct it:
```ts
import Constants from 'expo-constants';
const BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000';
```

---

## Part D — Wire offline download in `CourseDetailScreen.tsx`

The "Download for offline use" button currently has a comment `/* Sprint 3: offline download */`.
Wire it to the offline DB and asset cache.

Add the import at the top of the file:
```ts
import { saveOfflineModule } from '../../lib/offlineDB';
```

Replace the no-op Pressable handler:

```tsx
// BEFORE:
<Pressable className="items-center" onPress={() => { /* Sprint 3: offline download */ }}>

// AFTER:
<Pressable
  className="items-center"
  onPress={async () => {
    if (!course) return;
    const moduleData = await api.get<any[]>(`/api/courses/${courseId}/modules`);
    await saveOfflineModule(`course:${courseId}`, moduleData);
    await Promise.all(moduleData.map((mod) => saveOfflineModule(mod.id, mod)));
    alert('Course downloaded for offline use.');
  }}
>
```

### D2 — Cache media/document assets, not only JSON

JSON alone is not enough for genuine offline learning. For each section with a remote
`content` URL and type `VIDEO`, `DOCUMENT`, or `IMAGE`, download the file to app storage
using Expo FileSystem or an equivalent native-safe library, then store a mapping from
remote URL to local URI in SQLite.

Acceptance:

- Offline video/document/image sections resolve to local URIs when the device has no network.
- Failed asset downloads are shown in the UI as "not available offline" instead of silently
  pretending the course is fully downloaded.
- The offline download screen shows enough progress/state for the learner to know when
  a pack is ready.

### D3 — Prepare current-cycle offline packs on Wi-Fi

Add a conservative "Prepare offline pack" workflow for the current CPD cycle:

- detect Wi-Fi via NetInfo
- fetch enrolled/current-cycle courses
- download course JSON, quizzes, and supported media/document assets
- skip large assets on metered/cellular networks unless the learner explicitly confirms

Acceptance:

- On Wi-Fi, the learner can prepare all current-cycle enrolled courses for offline use
  from one action.
- On cellular, the app asks before downloading large assets.
- The feature does not block normal manual per-course downloads.

---

## Part E — New file: `apps/mobile/src/lib/offlineDB.ts`

Create this file from scratch. It uses `expo-sqlite` (already in `package.json`) to
persist offline state across app restarts.

```ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('zimhealth_offline.db');

// Initialise tables on first open.
// Call this once at app startup (e.g. in App.tsx useEffect).
export function initOfflineDB(): void {
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
      answers_json  TEXT NOT NULL,
      queued_at     INTEGER DEFAULT (strftime('%s','now'))
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
  await db.runAsync(
    `INSERT OR IGNORE INTO pending_progress (enrollment_id, section_id) VALUES (?, ?)`,
    [enrollmentId, sectionId],
  );
}

export async function getPendingProgress(): Promise<
  Array<{ enrollmentId: string; sectionId: string }>
> {
  const rows = await db.getAllAsync<{ enrollment_id: string; section_id: string }>(
    `SELECT enrollment_id, section_id FROM pending_progress ORDER BY queued_at ASC`,
  );
  return rows.map((r) => ({ enrollmentId: r.enrollment_id, sectionId: r.section_id }));
}

export async function clearPendingProgress(
  enrollmentId: string,
  sectionId: string,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM pending_progress WHERE enrollment_id = ? AND section_id = ?`,
    [enrollmentId, sectionId],
  );
}

// ── Offline module cache ──────────────────────────────────────────────────────

export async function saveOfflineModule(moduleId: string, data: unknown): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_modules (module_id, data_json) VALUES (?, ?)`,
    [moduleId, JSON.stringify(data)],
  );
}

export async function getOfflineModule<T = unknown>(moduleId: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ data_json: string }>(
    `SELECT data_json FROM offline_modules WHERE module_id = ?`,
    [moduleId],
  );
  if (!row) return null;
  return JSON.parse(row.data_json) as T;
}
```

Also add helper functions for:

- `savePendingQuizAttempt(localId, quizId, answers)`
- `getPendingQuizAttempts()`
- `clearPendingQuizAttempt(localId)`
- `saveOfflineAsset(remoteUrl, localUri, status)`
- `getOfflineAsset(remoteUrl)`

### Call `initOfflineDB()` at app startup

Open `apps/mobile/App.tsx` (or whichever file runs first before the navigator).
Add:

```ts
import { initOfflineDB } from './src/lib/offlineDB';

// Inside the root component, before the navigator renders:
useEffect(() => {
  initOfflineDB();
}, []);
```

---

## Part F — New file: `apps/mobile/src/hooks/useOnlineStatus.ts`

Create this hook. It uses `@react-native-community/netinfo` to watch connectivity and,
on reconnect, calls the bulk sync endpoint from S18 with any queued pending progress
and syncs queued quiz attempts.

```ts
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../lib/api';
import {
  getPendingProgress,
  clearPendingProgress,
  getPendingQuizAttempts,
  clearPendingQuizAttempt,
} from '../lib/offlineDB';

export function useOnlineStatus(): void {
  // Track previous state so we only fire on RECONNECT, not on every render.
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (!isOnline) {
        wasOfflineRef.current = true;
        return;
      }

      // We just came back online — run sync if we were previously offline.
      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;

      const pending = await getPendingProgress();
      if (pending.length === 0) return;

      try {
        const response = await api.post<{
          synced: number;
          total: number;
          results: Array<{ enrollmentId: string; sectionId: string; ok: boolean }>;
        }>('/api/enrollments/sync-offline', { items: pending });

        // Clear only the items that the server confirmed as successful.
        for (const result of response.results) {
          if (result.ok) {
            await clearPendingProgress(result.enrollmentId, result.sectionId);
          }
        }

        if (response.synced > 0) {
          console.log(`[offline] Synced ${response.synced} pending progress items on reconnect`);
        }
      } catch {
        // Network blip — leave items in queue to retry next reconnect.
      }

      const pendingQuizAttempts = await getPendingQuizAttempts();
      for (const attempt of pendingQuizAttempts) {
        try {
          await api.post(`/api/quizzes/${attempt.quizId}/attempt`, {
            answers: attempt.answers,
          });
          await clearPendingQuizAttempt(attempt.localId);
        } catch {
          // Leave the attempt queued for the next reconnect.
        }
      }
    });

    return () => unsubscribe();
  }, []);
}
```

### Use the hook at the top level

Open `apps/mobile/App.tsx` (or the root navigator component). Add:

```ts
import { useOnlineStatus } from './src/hooks/useOnlineStatus';

// Inside the root component:
useOnlineStatus();
```

### Queue offline progress when marking a section complete

In `CoursePlayerScreen.tsx`, update the `completeMutation` to also queue progress
when the device is offline (so it syncs on reconnect):

Add the import:
```ts
import NetInfo from '@react-native-community/netinfo';
import { savePendingProgress } from '../../lib/offlineDB';
```

Update the Mark Complete button's `onPress` to handle offline gracefully:

```tsx
// Replace the existing Button onPress:
onPress={async () => {
  const netState = await NetInfo.fetch();
  const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;

  if (isOnline) {
    completeMutation.mutate(currentSection.id);
  } else {
    // Queue for later sync and update UI optimistically.
    await savePendingProgress(enrollmentId, currentSection.id);
    // Force the section to appear complete locally by invalidating with a stale entry.
    queryClient.setQueryData(['enrollment-detail', enrollmentId], (old: any) => {
      if (!old) return old;
      const already = old.completedSections ?? [];
      if (already.includes(currentSection.id)) return old;
      return { ...old, completedSections: [...already, currentSection.id] };
    });
  }
}}
```

### Add an in-app quiz player for `QUIZ_LINK`

`QUIZ_LINK` sections must not render as a generic image placeholder. Add a quiz component
inside `CoursePlayerScreen.tsx` or a focused child component.

Minimum behavior:

- fetch quiz questions and options from the backend when online
- read cached quiz data when offline
- allow selecting answers and submitting
- when online, submit to the backend quiz attempt endpoint
- when offline, save a pending quiz attempt in SQLite
- show pass/fail/result state after submission or queued offline submission

Acceptance:

- A learner can complete a quiz from the mobile app without opening web.
- A learner can complete a cached quiz offline; the attempt syncs on reconnect.
- Quiz data is included in the course/offline pack download.

---

## Acceptance criteria

- A learner navigates to a course with video sections. The video player renders with
  native transport controls (play/pause/scrub). No placeholder.
- A learner navigates to a course with PDF/document sections. Tapping "Open PDF" opens
  the document in the system browser. No placeholder.
- The CPD progress bar on the Dashboard shows the correct percentage, sourced from
  `/api/points/summary` not a non-existent `/api/points/my`.
- The Certificates screen loads without error (was calling `/api/certificates/my`,
  now calls `/api/certificates/`).
- A FREE-tier learner on the Certificates screen sees the upgrade prompt — not a
  broken download button.
- A STANDARD-tier learner with a certificate that has `pdfUrl` can tap "Download PDF"
  and the document opens in a browser.
- Marking a section complete offline (no network) queues the update. On reconnect,
  `POST /api/enrollments/sync-offline` is called with the queued items, and the
  server confirms them.
- Tapping "Enrol Now" uses `POST /api/courses/:id/enroll` and works against the backend.
- `QUIZ_LINK` sections render an actual quiz player, not a placeholder.
- Offline quiz attempts are queued and synced after reconnect.
- Offline course download includes quiz data and supported media/document assets, not
  only module JSON.
- A current-cycle offline pack can be prepared on Wi-Fi from one workflow.
- TypeScript compiles without errors: `cd apps/mobile && npx tsc --noEmit`.

---

---

## Part G — New screen: Voucher redemption in `SubscriptionScreen.tsx`

The platform supports sponsor/NGO voucher codes (format `ZHCPD-XXXX-XXXX-XXXX`).
The web app has a voucher redemption card on `/subscription`. The mobile app needs
the equivalent so learners who receive voucher codes can activate them without a browser.

The backend endpoint already exists: `POST /api/payments/redeem-voucher` (LEARNER role,
requires auth token). It accepts `{ code: string }` and returns:
```json
{ "ok": true, "tier": "STANDARD", "sponsorName": "Red Cross", "message": "Your account has been upgraded..." }
```

### G1 — Create `apps/mobile/src/screens/learner/SubscriptionScreen.tsx`

This is a **new file**:

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

const TIERS = [
  {
    tier: 'STANDARD',
    title: 'Standard',
    price: '$5 / year',
    features: ['Full course library', 'AI Tutor on WhatsApp', 'Certificates', 'CPD tracking'],
  },
  {
    tier: 'DIASPORA',
    title: 'Diaspora',
    price: '$15 / year',
    features: ['All Standard features', 'Priority support'],
  },
] as const;

export default function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc = useQueryClient();

  const [voucherCode, setVoucherCode] = useState('');
  const [redeemed, setRedeemed] = useState<{ message: string; tier: string } | null>(null);

  const redeemMutation = useMutation({
    mutationFn: (code: string) =>
      api.post<{ ok: boolean; tier: string; sponsorName: string; message: string }>(
        '/api/payments/redeem-voucher',
        { code },
      ),
    onSuccess: (data) => {
      setRedeemed({ message: data.message, tier: data.tier });
      setVoucherCode('');
      updateUser({ subscriptionTier: data.tier as any });
      qc.invalidateQueries({ queryKey: ['points-summary'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
    onError: (err: any) => {
      Alert.alert('Could not redeem', err?.message ?? 'Check the code and try again.');
    },
  });

  const expiresAt = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20, gap: 20 }}>
      {/* Current status */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current plan</Text>
        <Text className="text-2xl font-bold text-slate-900 mt-1">{user?.subscriptionTier ?? 'FREE'}</Text>
        {expiresAt ? (
          <Text className="text-sm text-slate-500 mt-1">
            Expires {expiresAt.toLocaleDateString('en-ZW')}
          </Text>
        ) : null}
      </View>

      {/* Tier cards */}
      {TIERS.map((t) => (
        <View key={t.tier} className="bg-white rounded-2xl p-5 border border-slate-200">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-lg font-bold text-slate-900">{t.title}</Text>
              <Text className="text-2xl font-bold text-primary-600 mt-1">{t.price}</Text>
            </View>
            {user?.subscriptionTier === t.tier ? (
              <View className="bg-green-100 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-green-800">Current</Text>
              </View>
            ) : null}
          </View>
          <View className="mt-3 gap-y-1.5">
            {t.features.map((f) => (
              <View key={f} className="flex-row items-center gap-x-2">
                <Ionicons name="checkmark-circle" size={16} color="#0d9488" />
                <Text className="text-sm text-slate-600">{f}</Text>
              </View>
            ))}
          </View>
          <Text className="text-xs text-slate-400 mt-4">
            To subscribe, visit the ZimHealth web portal and use Stripe or EcoCash (Paynow).
          </Text>
        </View>
      ))}

      {/* Voucher redemption */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200 gap-y-4">
        <View>
          <Text className="text-base font-bold text-slate-900">Redeem a Sponsor Voucher</Text>
          <Text className="text-sm text-slate-500 mt-1">
            Have a code from an NGO, employer, or sponsor? Enter it below.
          </Text>
        </View>

        {redeemed ? (
          <View className="rounded-xl border border-green-200 bg-green-50 p-4">
            <Text className="text-sm font-bold text-green-800">Voucher redeemed!</Text>
            <Text className="text-sm text-green-700 mt-1">{redeemed.message}</Text>
          </View>
        ) : (
          <View className="gap-y-3">
            <TextInput
              value={voucherCode}
              onChangeText={(text) => setVoucherCode(text.toUpperCase())}
              placeholder="ZHCPD-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-slate-900 bg-white"
              placeholderTextColor="#94a3b8"
            />
            <Pressable
              onPress={() => {
                const trimmed = voucherCode.trim();
                if (!trimmed) return;
                redeemMutation.mutate(trimmed);
              }}
              disabled={redeemMutation.isPending || !voucherCode.trim()}
              className="bg-slate-800 rounded-xl py-3 items-center disabled:opacity-40"
            >
              <Text className="text-white font-semibold text-sm">
                {redeemMutation.isPending ? 'Checking…' : 'Redeem Code'}
              </Text>
            </Pressable>
          </View>
        )}

        <Text className="text-xs text-slate-400">
          Each voucher code can only be used once and activates a 1-year subscription.
        </Text>
      </View>
    </ScrollView>
  );
}
```

### G2 — Wire `SubscriptionScreen` into the navigator

The mobile app uses a bottom tab navigator or stack navigator. Add the screen to the
learner tab stack.

In the learner navigator file (typically `apps/mobile/src/navigation/LearnerNavigator.tsx`
or wherever the learner tabs are defined):

```ts
import SubscriptionScreen from '../screens/learner/SubscriptionScreen';
```

Add a stack screen or tab entry:
```tsx
<Stack.Screen
  name="Subscription"
  component={SubscriptionScreen}
  options={{ title: 'Subscription' }}
/>
```

If the navigator has a dedicated Profile tab, consider adding "Subscription" as a
button/link on the `ProfileScreen` that navigates to `Subscription`:
```tsx
<Pressable onPress={() => navigation.navigate('Subscription')}>
  <Text>Manage subscription</Text>
</Pressable>
```

### G3 — Update the `useAuthStore` `updateUser` type

The `updateUser` call passes `subscriptionTier` as a string. Ensure the auth store's
`User` type includes this field so the cast doesn't throw TypeScript errors:

```ts
// In apps/mobile/src/store/auth.store.ts (or equivalent)
// The User type should include:
subscriptionTier?: 'FREE' | 'STANDARD' | 'DIASPORA';
subscriptionExpiresAt?: string | null;
```

---

## Acceptance criteria (updated)

All criteria from the original list, plus:

- A learner opens the Subscription screen on mobile and sees their current tier.
- A learner with a valid voucher code enters it and taps "Redeem Code". The server
  confirms the code, the tier badge in the UI updates immediately, and the success
  message appears without navigating away.
- A learner entering an already-redeemed code sees an Alert: "This voucher has already
  been redeemed."
- A learner entering a non-existent code sees an Alert: "Voucher code not found."
- TypeScript compiles without errors: `cd apps/mobile && npx tsc --noEmit`.

---

## Do NOT change

- Do not change backend payment/voucher behavior — the voucher redemption endpoint
  (`POST /api/payments/redeem-voucher`) is already live.
- Backend changes are allowed only if mobile needs a missing quiz/offline-pack read endpoint;
  keep them narrowly scoped and add tests.
- Do not change `LoginScreen.tsx` or `RegisterScreen.tsx`.
- Do not change any bot or web files.
