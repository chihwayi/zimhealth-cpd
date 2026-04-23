import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getPendingProgressUpdates, getPendingQuizAttempts } from '../../lib/offlineDB';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const [progress, quizzes] = await Promise.all([getPendingProgressUpdates(), getPendingQuizAttempts()]);
        if (mounted) setPendingCount(progress.length + quizzes.length);
      } catch {
        // ignore
      }
    };

    void refresh();
    const onSynced = () => void refresh();
    window.addEventListener('zimhealth:progress-synced', onSynced);
    window.addEventListener('zimhealth:quiz-attempts-synced', onSynced);
    window.addEventListener('online', onSynced);
    window.addEventListener('offline', onSynced);
    return () => {
      mounted = false;
      window.removeEventListener('zimhealth:progress-synced', onSynced);
      window.removeEventListener('zimhealth:quiz-attempts-synced', onSynced);
      window.removeEventListener('online', onSynced);
      window.removeEventListener('offline', onSynced);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={
        isOnline
          ? 'w-full bg-blue-600 text-white text-xs font-medium flex items-center justify-center gap-2 px-4 py-2 z-50'
          : 'w-full bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-2 px-4 py-2 z-50'
      }
      role="status"
    >
      <WifiOff size={13} />
      {isOnline ? (
        <span>
          Back online — syncing {pendingCount} saved update{pendingCount !== 1 ? 's' : ''}…
        </span>
      ) : (
        <span>
          You're offline — showing downloaded content. {pendingCount > 0 ? `${pendingCount} update${pendingCount !== 1 ? 's' : ''} queued to sync.` : 'Progress will sync when reconnected.'}
        </span>
      )}
    </div>
  );
}
