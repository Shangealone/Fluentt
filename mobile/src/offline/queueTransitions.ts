import { getDatabase } from './db';
import { getPendingReviews, PendingReviewItem } from './reviewQueue';

// Synchronization infrastructure, not a learner timing/exclusion threshold.
export const SYNC_LEASE_MS = 5 * 60_000;
export const SYNC_HEARTBEAT_MS = 30_000;

export function retryDelayMs(attemptCount: number): number {
  return Math.min(300_000, 5000 * 2 ** Math.min(6, Math.max(0, attemptCount - 1)));
}

async function transition(
  item: PendingReviewItem, owner: string, status: PendingReviewItem['status'],
  error: string | null, kind: PendingReviewItem['failure_kind'], retryAt: number | null,
  lease: string | null, now: number, increment = false, stale = false
): Promise<boolean> {
  if (!owner.trim() || item.owner_user_id !== owner) return false;
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE pending_review_events SET status = ?, last_error = ?, updated_at = ?,
      failure_kind = ?, next_retry_at = ?, lease_id = ?${increment ? ', attempt_count = attempt_count + 1' : ''}
      WHERE client_event_id = ? AND owner_user_id = ? AND status = ? AND lease_id IS ?
      ${stale ? 'AND updated_at = ?' : ''}
      ${increment ? "AND (failure_kind IS NULL OR failure_kind = 'transient') AND (next_retry_at IS NULL OR next_retry_at <= ?)" : ''}`,
    [status, error, new Date(now).toISOString(), kind, retryAt, lease,
      item.client_event_id, owner, item.status, item.lease_id,
      ...(stale ? [item.updated_at] : []), ...(increment ? [now] : [])]
  );
  return result.changes === 1;
}

export async function recoverStaleReviews(owner: string, now = Date.now()): Promise<void> {
  for (const item of await getPendingReviews('syncing', owner)) {
    const updated = Date.parse(item.updated_at);
    if (Number.isFinite(updated) && updated <= now - SYNC_LEASE_MS) {
      await transition(item, owner, 'pending', 'Interrupted synchronization; awaiting replay.', 'transient', null, null, now, false, true);
    }
  }
}

export async function resumeAuthPausedReviews(owner: string, now = Date.now()): Promise<void> {
  for (const item of await getPendingReviews('pending', owner)) {
    if (item.failure_kind === 'auth') {
      await transition(item, owner, 'pending', item.last_error, null, null, null, now);
    }
  }
}

export async function claimReview(item: PendingReviewItem, owner: string, lease: string, now = Date.now()): Promise<boolean> {
  if (item.status !== 'pending' || item.failure_kind === 'auth' || item.failure_kind === 'permanent') return false;
  return transition(item, owner, 'syncing', null, null, null, lease, now, true);
}

export async function renewReviewLease(id: string, owner: string, lease: string): Promise<void> {
  if (!owner.trim()) throw new Error('An explicit review owner is required.');
  const db = await getDatabase();
  await db.runAsync(`UPDATE pending_review_events SET updated_at = ?
    WHERE client_event_id = ? AND owner_user_id = ? AND status = 'syncing' AND lease_id = ?`,
    [new Date().toISOString(), id, owner, lease]);
}

export async function finishReview(
  item: PendingReviewItem, owner: string, lease: string,
  kind: NonNullable<PendingReviewItem['failure_kind']>, error: string, now = Date.now()
): Promise<void> {
  await transition({ ...item, status: 'syncing', lease_id: lease }, owner,
    kind === 'permanent' ? 'failed' : 'pending', error, kind,
    kind === 'transient' ? now + retryDelayMs(item.attempt_count + 1) : null, null, now);
}

export async function acknowledgeReview(id: string, owner: string, lease: string): Promise<boolean> {
  if (!owner.trim()) throw new Error('An explicit review owner is required.');
  const db = await getDatabase();
  const result = await db.runAsync(`DELETE FROM pending_review_events WHERE client_event_id = ?
    AND owner_user_id = ? AND status = 'syncing' AND lease_id = ?`, [id, owner, lease]);
  return result.changes === 1;
}
