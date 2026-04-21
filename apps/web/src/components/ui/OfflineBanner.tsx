import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="w-full bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-2 px-4 py-2 z-50">
      <WifiOff size={13} />
      You're offline — showing downloaded content. Progress will sync when reconnected.
    </div>
  );
}
