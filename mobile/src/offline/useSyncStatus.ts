import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getPendingCount, getQueueProblems } from './reviewQueue';
import { getVerifiedAccountId, loadAuthenticatedAccount, subscribeToAuthenticatedAccount } from '../auth/tokenStore';
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
  failedCount: number;
  authPaused: boolean;
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
  const { t } = useTranslation();
  const accountId = useSyncExternalStore(subscribeToAuthenticatedAccount, getVerifiedAccountId, getVerifiedAccountId);
  const [queueCount, setQueueCount] = useState<{
    owner: string | null; count: number; failedCount: number; authPaused: boolean; storageError: boolean;
  }>({ owner: null, count: 0, failedCount: 0, authPaused: false, storageError: false });
  const countRequestId = useRef({ id: 0 });
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncInProgress());
  const [isOnline, setIsOnline] = useState<boolean>(getSyncOnlineStatus());
  const [isServerReachable, setIsServerReachable] = useState<boolean>(getServerReachability());
  const [syncError, setSyncError] = useState<{ owner: string | null; message: string } | null>(null);

  const readCount = useCallback(async () => {
    const requestId = ++countRequestId.current.id;
    try {
      const [count, problems] = await Promise.all([getPendingCount(), getQueueProblems()]);
      return { owner: accountId, count, requestId, ...problems, storageError: false };
    } catch {
      return { owner: accountId, count: 0, requestId, failedCount: 0, authPaused: false, storageError: true };
    }
  }, [accountId]);

  const applyCount = useCallback((result: { owner: string | null; count: number; requestId: number; failedCount: number; authPaused: boolean; storageError: boolean }) => {
    if (result.requestId === countRequestId.current.id && result.owner === getVerifiedAccountId()) {
      setQueueCount(result);
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
      refreshCount();
    });

    return () => {
      isMounted = false;
      countRequests.id++;
      unsubscribe();
    };
  }, [refreshCount, readCount, applyCount, accountId]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    setSyncError(null);
    const account = await loadAuthenticatedAccount();
    const result = account && account.userId === accountId
      ? await drainReviewQueue(account) : { syncedCount: 0, failedCount: 0, authPaused: true };
    if (result.error) {
      setSyncError({ owner: accountId, message: result.error });
    }
    await refreshCount();
    return result;
  }, [refreshCount, accountId]);

  return {
    // Never render a cached count from the account displayed on the last render.
    pendingCount: accountId && queueCount.owner === accountId ? queueCount.count : 0,
    failedCount: accountId && queueCount.owner === accountId ? queueCount.failedCount : 0,
    authPaused: Boolean(accountId && queueCount.owner === accountId && queueCount.authPaused),
    hasVerifiedAccount: Boolean(accountId),
    isSyncing,
    isOnline,
    isServerReachable,
    lastSyncedAt: accountId ? getLastSyncedAt(accountId) ?? null : null,
    syncError: accountId && queueCount.owner === accountId && queueCount.storageError
      ? t('sync.storageError') : accountId && syncError?.owner === accountId ? syncError.message : null,
    syncNow,
    refreshCount,
    refreshReachability,
  };
}
