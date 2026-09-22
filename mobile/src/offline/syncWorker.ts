import { apiClient, AuthenticationError, getApiErrorMessage } from '../api/client';
import {
  deletePendingReview,
  getPendingReviews,
  markReviewStatus,
} from './reviewQueue';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  authPaused?: boolean;
  skipped?: boolean;
  error?: string | null;
}

interface ServerEventResult {
  client_event_id: string;
  status: 'accepted' | 'error';
  attempt_id?: string;
  due_date?: string;
  error_detail?: string;
}

interface SyncReviewEventsResponse {
  processed_count: number;
  results: ServerEventResult[];
}

let isSyncing = false;
let isOnline = true;
let lastSyncedAt: Date | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setSyncOnlineStatus(online: boolean): void {
  isOnline = online;
  notifyListeners();
}

export function getSyncOnlineStatus(): boolean {
  return isOnline;
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}

export function getLastSyncedAt(): Date | null {
  return lastSyncedAt;
}

export function subscribeToSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Drain the SQLite pending review queue in chronological batches to POST /sync/review-events.
 *
 * Guarantees:
 * - 401/Session expiry: queue is retained, status reset to pending, draining paused for auth handling.
 * - Network failure: items retained, error recorded, status reset to pending.
 * - 200 OK: accepted items deleted from SQLite queue, distinct client_event_id items preserved.
 * - Mutex: prevents concurrent drain invocations.
 */
export async function drainReviewQueue(): Promise<SyncResult> {
  if (!isOnline) {
    return { syncedCount: 0, failedCount: 0, skipped: true };
  }

  if (isSyncing) {
    return { syncedCount: 0, failedCount: 0, skipped: true };
  }

  isSyncing = true;
  notifyListeners();

  let totalSynced = 0;
  let totalFailed = 0;

  try {
    const pendingItems = await getPendingReviews('pending');
    if (pendingItems.length === 0) {
      return { syncedCount: 0, failedCount: 0 };
    }

    const batchSize = 50;
    for (let i = 0; i < pendingItems.length; i += batchSize) {
      const batch = pendingItems.slice(i, i + batchSize);

      // Mark batch as syncing
      for (const item of batch) {
        await markReviewStatus(item.client_event_id, 'syncing');
      }

      const payload = {
        events: batch.map((item) => ({
          client_event_id: item.payload.client_event_id,
          session_id: item.payload.session_id,
          vocabulary_item_id: item.payload.vocabulary_item_id,
          response_time_ms: item.payload.response_time_ms,
          performance_rating: item.payload.performance_rating,
          created_at: item.payload.created_at,
        })),
      };

      try {
        const response = await apiClient<SyncReviewEventsResponse>('/sync/review-events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        for (const res of response.results) {
          if (res.status === 'accepted') {
            await deletePendingReview(res.client_event_id);
            totalSynced++;
          } else {
            await markReviewStatus(res.client_event_id, 'failed', res.error_detail);
            totalFailed++;
          }
        }

        lastSyncedAt = new Date();
      } catch (err: any) {
        // Clarification 4.A: Auth failure during sync
        if (err instanceof AuthenticationError || err?.status === 401 || err?.status === 403) {
          // Reset syncing items back to pending, DO NOT delete queue
          for (const item of batch) {
            await markReviewStatus(item.client_event_id, 'pending');
          }
          return {
            syncedCount: totalSynced,
            failedCount: totalFailed,
            authPaused: true,
          };
        }

        // Network error or timeout: reset to pending and save last_error
        const errorMsg = getApiErrorMessage(err, 'Network failure during sync');
        for (const item of batch) {
          await markReviewStatus(item.client_event_id, 'pending', errorMsg);
        }

        return {
          syncedCount: totalSynced,
          failedCount: totalFailed,
          error: errorMsg,
        };
      }
    }

    return {
      syncedCount: totalSynced,
      failedCount: totalFailed,
    };
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

// Subscribe to NetInfo network changes if available
export function initNetInfoSyncListener(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo');
    const addEventListener = NetInfo?.default?.addEventListener || NetInfo?.addEventListener;
    if (typeof addEventListener === 'function') {
      addEventListener((state: any) => {
        const online = Boolean(state.isConnected && state.isInternetReachable !== false);
        const wasOffline = !isOnline;
        isOnline = online;
        notifyListeners();

        if (wasOffline && online) {
          drainReviewQueue().catch((err) => {
            console.warn('Auto-sync on reconnect error:', err);
          });
        }
      });
    }
  } catch {
    // Gracefully ignored in non-native environments
  }
}

initNetInfoSyncListener();

