import { apiClient, AuthenticationError, getApiBaseUrl, getApiErrorMessage } from '../api/client';
import { AuthenticatedAccount, isAccountCurrent, loadAuthenticatedAccount } from '../auth/tokenStore';
import { getPendingReviews } from './reviewQueue';
import {
  acknowledgeReview, claimReview, finishReview, recoverStaleReviews,
  renewReviewLease, SYNC_HEARTBEAT_MS,
} from './queueTransitions';
import { generateUUID } from '../utils/uuid';
import { parseSyncReviewEventsResponse } from './syncContract';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  authPaused?: boolean;
  skipped?: boolean;
  error?: string | null;
}
let isSyncing = false;
let isOnline = true;
let isServerReachable = true;
let lastSyncedAt: Date | null = null;
let lastSyncedOwner: string | null = null;
const listeners = new Set<() => void>();

export function notifySyncStatusListeners(): void {
  for (const listener of listeners) {
    try { listener(); } catch { /* A subscriber must not interrupt persistence. */ }
  }
}
export function setSyncOnlineStatus(online: boolean): void {
  isOnline = online;
  if (!online) isServerReachable = false;
  notifySyncStatusListeners();
}
export function getSyncOnlineStatus(): boolean { return isOnline; }
export function getServerReachability(): boolean { return isServerReachable; }
export function setServerReachability(reachable: boolean): void {
  isServerReachable = reachable;
  notifySyncStatusListeners();
}
export function isSyncInProgress(): boolean { return isSyncing; }
export function getLastSyncedAt(owner?: string | null): Date | null {
  return owner === undefined || owner === lastSyncedOwner ? lastSyncedAt : null;
}
export function subscribeToSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function checkServerReachability(): Promise<boolean> {
  if (!isOnline) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  timer.unref?.();
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    setServerReachability(isOnline && response.ok);
  } catch {
    setServerReachability(false);
  } finally {
    clearTimeout(timer);
  }
  return isServerReachable;
}
export function classifySyncFailure(error: unknown): 'auth' | 'permanent' | 'transient' {
  const status = (error as { status?: number } | null)?.status;
  if (error instanceof AuthenticationError || status === 401 || status === 403) return 'auth';
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return 'permanent';
  return 'transient';
}

/** Single JS-runtime flight plus atomic, owner-scoped SQLite claims and lease fencing. */
export async function drainReviewQueue(expectedAccount?: AuthenticatedAccount, shouldContinue = () => true): Promise<SyncResult> {
  if (!isOnline || isSyncing) return { syncedCount: 0, failedCount: 0, skipped: true };
  isSyncing = true; // Acquire before the first await, including identity verification.
  notifySyncStatusListeners();
  let syncedCount = 0;
  let failedCount = 0;
  try {
    const account = await loadAuthenticatedAccount();
    if (!account || !isAccountCurrent(account) || (expectedAccount && !isAccountCurrent(expectedAccount))) {
      return { syncedCount, failedCount, authPaused: true };
    }
    const owner = account.userId;
    await recoverStaleReviews(owner);
    if (!isAccountCurrent(account)) return { syncedCount, failedCount, authPaused: true };
    const pending = await getPendingReviews('pending', owner);
    if (pending.some((item) => item.failure_kind === 'auth')) return { syncedCount, failedCount, authPaused: true };

    // The backend commits per event before a whole-batch response. One event per
    // request isolates invalid work and makes every acknowledgement unambiguous.
    for (const item of pending) {
      if (!isOnline || !shouldContinue()) return { syncedCount, failedCount, skipped: true };
      if (!isAccountCurrent(account)) return { syncedCount, failedCount, authPaused: true };
      const lease = generateUUID();
      if (!await claimReview(item, owner, lease)) continue;
      const controller = new AbortController();
      let rejectDeadline!: (error: Error) => void;
      const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
      const timeout = setTimeout(() => {
        controller.abort();
        rejectDeadline(new Error('Synchronization request timed out.'));
      }, 30_000);
      timeout.unref?.();
      const heartbeat = setInterval(() => {
        if (isAccountCurrent(account)) renewReviewLease(item.client_event_id, owner, lease).catch(() => controller.abort());
      }, SYNC_HEARTBEAT_MS);
      heartbeat.unref?.();
      try {
        const response = await Promise.race([apiClient<unknown>('/sync/review-events', {
          method: 'POST', body: JSON.stringify({ events: [item.payload] }),
          expectedUserId: owner, signal: controller.signal,
        }), deadline]);
        const result = parseSyncReviewEventsResponse(response).acceptedEvents.find((entry) => entry.clientEventId === item.client_event_id);
        if (!result) throw new Error('Server did not acknowledge the queued event.');
        if (await acknowledgeReview(item.client_event_id, owner, lease)) syncedCount++;
        lastSyncedOwner = owner;
        lastSyncedAt = new Date();
        isServerReachable = true;
      } catch (error) {
        const kind = classifySyncFailure(error);
        const message = getApiErrorMessage(error, 'Synchronization failed');
        await finishReview(item, owner, lease, kind, message);
        if (kind === 'auth') return { syncedCount, failedCount, authPaused: true };
        if (kind === 'permanent') { failedCount++; continue; }
        isServerReachable = false;
        return { syncedCount, failedCount, error: message };
      } finally {
        clearInterval(heartbeat);
        clearTimeout(timeout);
      }
    }
    return { syncedCount, failedCount };
  } catch (error) {
    // Storage errors remain visible; any claimed row is recoverable by expiry.
    return { syncedCount, failedCount, error: getApiErrorMessage(error, 'Queue storage unavailable') };
  } finally {
    isSyncing = false;
    notifySyncStatusListeners();
  }
}
