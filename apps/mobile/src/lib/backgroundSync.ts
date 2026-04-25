/**
 * Background sync task for ZimHealth CPD.
 *
 * This module MUST be imported as a side-effect before the React app renders
 * (see index.js). The TaskManager.defineTask call at module level registers the
 * task with the OS. registerBackgroundSyncAsync() then schedules it to run
 * periodically even when the app is closed.
 *
 * Platform behaviour:
 *   iOS  — OS controls exact timing; minimum 15 min; task gets ~30 s to finish.
 *   Android — More reliable; honours minimumInterval; may be delayed by battery saver.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';
import {
  clearPendingProgress,
  clearPendingQuizAttempt,
  getPendingProgress,
  getPendingQuizAttempts,
  initOfflineDB,
} from './offlineDB';

export const BACKGROUND_SYNC_TASK = 'ZIMHEALTH_BACKGROUND_SYNC';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    initOfflineDB();

    let totalSynced = 0;

    const pending = await getPendingProgress();
    if (pending.length > 0) {
      try {
        const response = await api.post<{
          results: Array<{ enrollmentId: string; sectionId: string; ok: boolean }>;
        }>('/api/enrollments/sync-offline', { items: pending });

        for (const result of response.results) {
          if (result.ok) {
            await clearPendingProgress(result.enrollmentId, result.sectionId);
            totalSynced++;
          }
        }
      } catch {
        // Leave queued for next background execution.
      }
    }

    const quizAttempts = await getPendingQuizAttempts();
    for (const attempt of quizAttempts) {
      try {
        const result = await api.post<{ passed: boolean }>(
          `/api/quizzes/${attempt.quizId}/attempt`,
          {
            answers: attempt.answers,
            enrollmentId: attempt.enrollmentId,
            sectionId: attempt.sectionId,
          },
        );

        if (result.passed && attempt.enrollmentId && attempt.sectionId) {
          try {
            await api.patch(`/api/enrollments/${attempt.enrollmentId}/progress`, {
              sectionId: attempt.sectionId,
            });
          } catch {
            // Non-fatal.
          }
        }

        await clearPendingQuizAttempt(attempt.localId);
        totalSynced++;
      } catch {
        // Leave queued for next background execution.
      }
    }

    return totalSynced > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSyncAsync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Ignore duplicate/already-registered task errors.
  }
}
