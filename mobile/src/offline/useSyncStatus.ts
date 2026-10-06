import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getPendingCount } from './reviewQueue';
import { getVerifiedAccountId, subscribeToAuthenticatedAccount } from '../auth/tokenStore';
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
  hasVerifiedAccount: boolean;
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
  const accountId = useSyncExternalStore(subscribeToAuthenticatedAccount, getVerifiedAccountId, getVerifiedAccountId);
  const [queueCount, setQueueCount] = useState<{ owner: string | null; count: number }>({ owner: null, count: 0 });
  const countRequestId = useRef({ id: 0 });
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncInProgress());
  const [isOnline, setIsOnline] = useState<boolean>(getSyncOnlineStatus());
  const [isServerReachable, setIsServerReachable] = useState<boolean>(getServerReachability());
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(getLastSyncedAt());
  const [syncError, setSyncError] = useState<string | null>(null);

  const readCount = useCallback(async () => {
    const requestId = ++countRequestId.current.id;
    const count = await getPendingCount().catch(() => 0);
    return { owner: accountId, count, requestId };
  }, [accountId]);

  const applyCount = useCallback((result: { owner: string | null; count: number; requestId: number }) => {
    if (result.requestId === countRequestId.current.id && result.owner === getVerifiedAccountId()) {
      setQueueCount({ owner: result.owner, count: result.count });
    }
  }, []);

  const refreshCount = useCallback(() => readCount().then(applyCount), [readCount, applyCount]);

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
    const countRequests = countRequestId.current;
    readCount().then((result) => {
      if (isMounted) applyCount(result);
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
      refreshCount();
    });

    return () => {
      isMounted = false;
      countRequests.id++;
      unsubscribe();
    };
  }, [refreshCount, readCount, applyCount]);

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
    // Never render a cached count from the account displayed on the last render.
    pendingCount: accountId && queueCount.owner === accountId ? queueCount.count : 0,
    hasVerifiedAccount: Boolean(accountId),
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
