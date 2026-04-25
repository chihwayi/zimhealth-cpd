import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  clearPendingProgress,
  clearPendingQuizAttempt,
  getPendingProgress,
  getPendingQuizAttempts,
} from '../lib/offlineDB';

export function useOnlineStatus(): void {
  const wasOfflineRef = useRef(false);
  const queryClient = useQueryClient();

  async function syncPendingItems(): Promise<void> {
    let totalSynced = 0;

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
            totalSynced++;
          }
        }
      } catch {
        // Leave queued for the next reconnect.
      }
    }

    const pendingQuizAttempts = await getPendingQuizAttempts();
    for (const attempt of pendingQuizAttempts) {
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
            // Leave retry to a later sync.
          }
        }

        await clearPendingQuizAttempt(attempt.localId);
        totalSynced++;
      } catch {
        // Leave queued for the next reconnect.
      }
    }

    if (totalSynced > 0) {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
      void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['certificates'] });

      Alert.alert(
        'Sync complete',
        `${totalSynced} offline item${totalSynced > 1 ? 's' : ''} synced to your account.`,
        [{ text: 'OK' }],
        { cancelable: true },
      );
    }
  }

  useEffect(() => {
    void syncPendingItems();

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (!isOnline) {
        wasOfflineRef.current = true;
        return;
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void syncPendingItems();
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
