import { useCallback, useEffect, useState } from 'react';
import { getPendingCount } from './reviewQueue';
import {
  drainReviewQueue,
  getLastSyncedAt,
  getSyncOnlineStatus,
  isSyncInProgress,
  subscribeToSyncStatus,
  SyncResult,
} from './syncWorker';

export interface SyncStatusState {
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  syncNow: () => Promise<SyncResult>;
  refreshCount: () => Promise<void>;
}

export function useSyncStatus(): SyncStatusState {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncInProgress());
  const [isOnline, setIsOnline] = useState<boolean>(getSyncOnlineStatus());
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(getLastSyncedAt());
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // Ignore database access issues
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getPendingCount().then((count) => {
      if (isMounted) setPendingCount(count);
    });

    const unsubscribe = subscribeToSyncStatus(() => {
      if (!isMounted) return;
      setIsSyncing(isSyncInProgress());
      setIsOnline(getSyncOnlineStatus());
      setLastSyncedAt(getLastSyncedAt());
      getPendingCount().then((count) => {
        if (isMounted) setPendingCount(count);
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    setSyncError(null);
    const result = await drainReviewQueue();
    if (result.error) {
      setSyncError(result.error);
    }
    await refreshCount();
    return result;
  }, [refreshCount]);

  return {
    pendingCount,
    isSyncing,
    isOnline,
    lastSyncedAt,
    syncError,
    syncNow,
    refreshCount,
  };
}
