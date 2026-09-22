import { useCallback, useEffect, useState } from 'react';
import { getPendingCount } from './reviewQueue';
import {
  checkServerReachability,
  drainReviewQueue,
  getLastSyncedAt,
  getServerReachability,
  getSyncOnlineStatus,
  isSyncInProgress,
  subscribeToSyncStatus,
  SyncResult,
} from './syncWorker';

export interface SyncStatusState {
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  isServerReachable: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  syncNow: () => Promise<SyncResult>;
  refreshCount: () => Promise<void>;
  refreshReachability: () => Promise<boolean>;
}

export function useSyncStatus(): SyncStatusState {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncInProgress());
  const [isOnline, setIsOnline] = useState<boolean>(getSyncOnlineStatus());
  const [isServerReachable, setIsServerReachable] = useState<boolean>(getServerReachability());
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

  const refreshReachability = useCallback(async (): Promise<boolean> => {
    try {
      const reachable = await checkServerReachability();
      setIsServerReachable(reachable);
      return reachable;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getPendingCount().then((count) => {
      if (isMounted) setPendingCount(count);
    });
    checkServerReachability().then((reachable) => {
      if (isMounted) setIsServerReachable(reachable);
    });

    const unsubscribe = subscribeToSyncStatus(() => {
      if (!isMounted) return;
      setIsSyncing(isSyncInProgress());
      setIsOnline(getSyncOnlineStatus());
      setIsServerReachable(getServerReachability());
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
    isServerReachable,
    lastSyncedAt,
    syncError,
    syncNow,
    refreshCount,
    refreshReachability,
  };
}
