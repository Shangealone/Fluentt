import { getDatabase } from './db';

export interface PendingReviewPayload {
  client_event_id: string;
  session_id: string;
  vocabulary_item_id: string;
  response_time_ms: number;
  performance_rating: 'again' | 'hard' | 'good' | 'easy' | string;
  created_at?: string;
}

export interface PendingReviewItem {
  client_event_id: string;
  payload: PendingReviewPayload;
  status: 'pending' | 'syncing' | 'failed';
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function enqueuePendingReview(payload: PendingReviewPayload): Promise<void> {
  // Strip any accidental sensitive credentials
  const sanitized: PendingReviewPayload = {
    client_event_id: payload.client_event_id,
    session_id: payload.session_id,
    vocabulary_item_id: payload.vocabulary_item_id,
    response_time_ms: payload.response_time_ms,
    performance_rating: payload.performance_rating,
    created_at: payload.created_at ?? new Date().toISOString(),
  };

  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO pending_review_events (
      client_event_id,
      payload_json,
      status,
      attempt_count,
      last_error,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sanitized.client_event_id, JSON.stringify(sanitized), 'pending', 0, null, sanitized.created_at, now]
  );
}

export async function getPendingReviews(status?: 'pending' | 'syncing' | 'failed'): Promise<PendingReviewItem[]> {
  const db = await getDatabase();
  let rows: any[];
  if (status) {
    rows = await db.getAllAsync(`SELECT * FROM pending_review_events WHERE status = ? ORDER BY created_at ASC`, [status]);
  } else {
    rows = await db.getAllAsync(`SELECT * FROM pending_review_events ORDER BY created_at ASC`);
  }

  return rows.map((r) => ({
    client_event_id: r.client_event_id,
    payload: typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json,
    status: r.status,
    attempt_count: r.attempt_count,
    last_error: r.last_error,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function markReviewStatus(
  client_event_id: string,
  status: 'pending' | 'syncing' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  if (status === 'syncing' || status === 'failed') {
    await db.runAsync(
      `UPDATE pending_review_events SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ? WHERE client_event_id = ?`,
      [status, error ?? null, now, client_event_id]
    );
  } else {
    await db.runAsync(
      `UPDATE pending_review_events SET status = ?, last_error = ?, updated_at = ? WHERE client_event_id = ?`,
      [status, error ?? null, now, client_event_id]
    );
  }
}

export async function deletePendingReview(client_event_id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM pending_review_events WHERE client_event_id = ?`, [client_event_id]);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_review_events WHERE status = 'pending'`
  );
  return row?.count ?? 0;
}

export async function getTotalPendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM pending_review_events`);
  return row?.count ?? 0;
}
