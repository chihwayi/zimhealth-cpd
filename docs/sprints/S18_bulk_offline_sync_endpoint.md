# Sprint S18 — Bulk offline sync endpoint

### Priority: MEDIUM
### Feature: Feature 2 (Work anywhere offline mode)

---

## The Problem

When a learner comes back online after studying offline, `useOnlineStatus.ts` fires
`syncPendingProgress()` which loops through every queued section and calls:

```ts
api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId, totalSections })
```

**One HTTP request per section.** A learner who completed 8 sections offline sends
8 individual PATCH requests in sequence. Each one hits the DB, recalculates progress,
and responds. On a slow mobile connection this can take 5–10 seconds and any single
failure stops the remaining syncs from running.

The fix is a single `POST /api/enrollments/sync-offline` endpoint that accepts an array
of `{ enrollmentId, sectionId }` pairs and processes them all in one DB transaction.
The web app then calls this one endpoint instead of N individual PATCHes. The mobile app
must also use the same endpoint when S19 adds offline progress sync.

---

## Exact files to change

1. `backend/src/routes/enrollments.ts` — add `POST /sync-offline` route.
2. `backend/src/routes/enrollments.schema.ts` — add `SyncOfflineSchema`.
3. `apps/web/src/hooks/useOnlineStatus.ts` — call bulk endpoint instead of per-item loop.
4. `apps/web/src/lib/offlineDB.ts` — update `syncPendingProgress` signature to pass all entries at once.
5. `apps/mobile/src/hooks/useOnlineStatus.ts` — in S19, call this same bulk endpoint for queued mobile progress.

---

## Step-by-step implementation

### Part A — Backend schema: `backend/src/routes/enrollments.schema.ts`

Open the file and add a new schema after the existing ones:

```ts
export const SyncOfflineSchema = z.object({
  items: z
    .array(
      z.object({
        enrollmentId: z.string().min(1),
        sectionId: z.string().min(1),
      }),
    )
    .min(1)
    .max(100), // safety cap — no single sync should have more than 100 queued items
});
```

### Part B — Backend route: `backend/src/routes/enrollments.ts`

#### B1 — Import the new schema

Add `SyncOfflineSchema` to the import at the top of the file:

```ts
import { UpdateProgressSchema, SubmitReviewSchema, SyncOfflineSchema } from './enrollments.schema';
```

#### B2 — Add the bulk sync route

Add this route after the existing `PATCH /:id/progress` handler and before the review route:

```ts
// POST /api/enrollments/sync-offline — bulk progress sync for offline-queued items
router.post('/sync-offline', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const { items } = SyncOfflineSchema.parse(req.body);
    const learnerId = req.user!.id;
    const results: Array<{ enrollmentId: string; sectionId: string; ok: boolean; error?: string }> = [];

    for (const item of items) {
      try {
        // Ownership check
        const enrollment = await db.enrollment.findUnique({ where: { id: item.enrollmentId } });
        if (!enrollment || enrollment.learnerId !== learnerId) {
          results.push({ ...item, ok: false, error: 'Not found or not yours' });
          continue;
        }

        // Validate sectionId belongs to this course
        const sectionExists = await db.contentSection.findFirst({
          where: { id: item.sectionId, module: { courseId: enrollment.courseId } },
          select: { id: true },
        });
        if (!sectionExists) {
          results.push({ ...item, ok: false, error: 'Section not in course' });
          continue;
        }

        // Compute updated progress (same logic as PATCH /:id/progress)
        const courseModules = await db.module.findMany({
          where: { courseId: enrollment.courseId },
          select: { _count: { select: { sections: true } } },
        });
        const realTotalSections = courseModules.reduce((sum, m) => sum + m._count.sections, 0);

        let newCompletedSections = enrollment.completedSections;
        if (!newCompletedSections.includes(item.sectionId)) {
          newCompletedSections = [...newCompletedSections, item.sectionId];
        }
        const newProgress = realTotalSections > 0
          ? newCompletedSections.length / realTotalSections
          : enrollment.progress;

        const isComplete = newProgress >= 1;
        const justCompleted = isComplete && !enrollment.completedAt;

        await db.enrollment.update({
          where: { id: item.enrollmentId },
          data: {
            progress: Math.min(1, newProgress),
            completedSections: newCompletedSections,
            lastAccessAt: new Date(),
            completedAt: justCompleted ? new Date() : enrollment.completedAt,
          },
        });

        if (justCompleted) {
          try {
            await creditPoints({
              learnerId,
              courseId: enrollment.courseId,
              activityType: 'VIDEO_WATCH',
            });
          } catch (creditErr) {
            console.error('CPD credit failed during offline sync', creditErr);
          }
          void invalidateRecommendations(learnerId);
        }

        results.push({ ...item, ok: true });
      } catch (itemErr: any) {
        results.push({ ...item, ok: false, error: itemErr.message ?? 'Unknown error' });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    res.json({ synced: succeeded, total: items.length, results });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Offline sync failed' });
  }
});
```

### Part C — Web offlineDB: `apps/web/src/lib/offlineDB.ts`

Find `syncPendingProgress` at the bottom of the file. It currently calls a per-item
`apiFn` callback. Replace its implementation so it collects ALL pending items and
calls the callback once with the full array:

```ts
export async function syncPendingProgress(
  bulkApiFn: (items: Array<{ enrollmentId: string; sectionId: string }>) => Promise<{ synced: number; results: Array<{ enrollmentId: string; sectionId: string; ok: boolean }> }>,
): Promise<number> {
  const pending = await getPendingProgressUpdates();
  if (pending.length === 0) return 0;

  const items = pending.map((p) => ({ enrollmentId: p.enrollmentId, sectionId: p.sectionId }));

  try {
    const response = await bulkApiFn(items);
    // Clear only the items that succeeded
    for (const result of response.results) {
      if (result.ok) {
        const key = `${result.enrollmentId}_${result.sectionId}`;
        await clearPendingProgress(key);
      }
    }
    return response.synced;
  } catch {
    // Network failure — leave all items in queue to retry next time
    return 0;
  }
}
```

### Part D — Web hook: `apps/web/src/hooks/useOnlineStatus.ts`

Update the `runSync` callback to call the bulk endpoint. Replace the progress sync block:

```ts
// BEFORE:
const synced = await syncPendingProgress((enrollmentId, sectionId, totalSections) =>
  api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId, totalSections }),
);

// AFTER:
const synced = await syncPendingProgress((items) =>
  api.post('/api/enrollments/sync-offline', { items }),
);
```

That is the only change needed in `useOnlineStatus.ts`.

---

## Acceptance criteria

- A learner completes 5 sections offline. On reconnect, exactly **1** POST request is made
  to `/api/enrollments/sync-offline` (not 5 individual PATCHes). Verify with browser DevTools Network tab.
- A mobile learner who completes 5 sections offline also sends exactly **1** POST request
  to `/api/enrollments/sync-offline` when the mobile device reconnects.
- All 5 sections are marked complete in the DB after the single request.
- If one `sectionId` is invalid (e.g. stale key from a course restructure), that item returns
  `ok: false` in `results` and is NOT removed from the queue — it is retried next reconnect.
  The other 4 valid sections are still synced successfully.
- If the learner completed all sections offline (crossing the 100% threshold), a `CPDRecord`
  is created on sync — same as the online path.
- TypeScript compiles without errors after all changes.
- The old per-item `PATCH /:id/progress` route is **not removed** — the mobile app and bot
  still use it for individual section updates.

---

## Do NOT change

- Do not remove `PATCH /:id/progress` — it is still used for online (real-time) section completion.
- Do not change `syncPendingQuizAttempts` — quiz attempts continue to sync individually
  (each is an independent attempt and they do not benefit from batching the same way).
- Do not change any backend service files outside `enrollments.ts` and `enrollments.schema.ts`.
- Do not change bot files.
