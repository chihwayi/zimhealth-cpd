import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../lib/api';
import {
  clearPendingProgress,
  clearPendingQuizAttempt,
  getPendingProgress,
  getPendingQuizAttempts,
} from '../lib/offlineDB';

export function useOnlineStatus(): void {
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (!isOnline) {
        wasOfflineRef.current = true;
        return;
      }

      // Only run sync when transitioning from offline → online.
      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;

      // ── Sync pending section progress ─────────────────────────────────────
      const pending = await getPendingProgress();
      if (pending.length > 0) {
        try {
          const response = await api.post<{
            synced: number;
            total: number;
            results: Array<{ enrollmentId: string; sectionId: string; ok: boolean }>;
          }>('/api/enrollments/sync-offline', { items: pending });

          for (const result of response.results) {
            if (result.ok) {
              await clearPendingProgress(result.enrollmentId, result.sectionId);
            }
          }

          if (response.synced > 0) {
            console.log(`[offline] Synced ${response.synced} pending progress items on reconnect`);
          }
        } catch {
          // Leave queued items in place and retry on the next reconnect.
        }
      }

      // ── Sync pending quiz attempts ────────────────────────────────────────
      const pendingQuizAttempts = await getPendingQuizAttempts();
      for (const attempt of pendingQuizAttempts) {
        try {
          await api.post(`/api/quizzes/${attempt.quizId}/attempt`, {
            answers: attempt.answers,
          });
          await clearPendingQuizAttempt(attempt.localId);
          console.log(`[offline] Synced quiz attempt ${attempt.localId} for quiz ${attempt.quizId}`);
        } catch {
          // Leave the attempt queued for the next reconnect.
        }
      }
    });

    return () => unsubscribe();
  }, []);
}
