import { useEffect, useState, useCallback } from 'react';
import { syncPendingProgress } from '../lib/offlineDB';
import { api } from '../lib/api';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const runSync = useCallback(async () => {
    try {
      const synced = await syncPendingProgress((enrollmentId, sectionId, totalSections) =>
        api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId, totalSections }),
      );
      if (synced > 0) {
        // Dispatch a custom event so components can react (e.g. invalidate TanStack queries)
        window.dispatchEvent(new CustomEvent('nursepro:progress-synced', { detail: { count: synced } }));
      }
    } catch {
      // Silent — will retry on next reconnect
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [runSync]);

  return isOnline;
}
