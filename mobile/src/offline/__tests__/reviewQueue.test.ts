import {
  enqueuePendingReview,
  getPendingReviews,
  markReviewStatus,
  deletePendingReview,
  getPendingCount,
  PendingReviewPayload,
} from '../reviewQueue';
import { resetDatabaseForTesting, closeDatabaseForTesting } from '../db';

describe('Review Queue SQLite Storage', () => {
  beforeEach(async () => {
    await resetDatabaseForTesting();
  });

  const samplePayload: PendingReviewPayload = {
    client_event_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    vocabulary_item_id: '33333333-3333-4333-8333-333333333333',
    response_time_ms: 1250,
    performance_rating: 'good',
    created_at: '2026-09-22T08:00:00Z',
  };

  it('enqueues a review event and retrieves it in pending status', async () => {
    await enqueuePendingReview(samplePayload);

    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
    expect(pending[0].client_event_id).toBe(samplePayload.client_event_id);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(0);
    expect(pending[0].payload.response_time_ms).toBe(1250);
    expect(pending[0].payload.performance_rating).toBe('good');
  });

  it('is idempotent when enqueuing identical client_event_id', async () => {
    await enqueuePendingReview(samplePayload);
    await enqueuePendingReview(samplePayload);

    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
    expect(await getPendingCount()).toBe(1);
  });

  it('updates review status and increments attempt count', async () => {
    await enqueuePendingReview(samplePayload);

    await markReviewStatus(samplePayload.client_event_id, 'syncing');
    let items = await getPendingReviews();
    expect(items[0].status).toBe('syncing');

    await markReviewStatus(samplePayload.client_event_id, 'failed', 'Network timeout');
    items = await getPendingReviews();
    expect(items[0].status).toBe('failed');
    expect(items[0].last_error).toBe('Network timeout');
    expect(items[0].attempt_count).toBeGreaterThanOrEqual(1);
  });

  it('deletes review event upon successful sync', async () => {
    await enqueuePendingReview(samplePayload);
    expect(await getPendingCount()).toBe(1);

    await deletePendingReview(samplePayload.client_event_id);
    expect(await getPendingCount()).toBe(0);
    const items = await getPendingReviews();
    expect(items).toHaveLength(0);
  });

  it('does not store authentication tokens in queue payload', async () => {
    const payloadWithLeak: any = {
      ...samplePayload,
      access_token: 'secret-token-do-not-store',
      password: 'mypassword',
    };
    await enqueuePendingReview(payloadWithLeak);

    const items = await getPendingReviews();
    expect((items[0].payload as any).access_token).toBeUndefined();
    expect((items[0].payload as any).password).toBeUndefined();
  });

  it('counts pending events even when in syncing or failed status so reviews are never hidden', async () => {
    await enqueuePendingReview(samplePayload);
    await markReviewStatus(samplePayload.client_event_id, 'failed', 'Network timeout');

    // Must be counted as pending sync so the user does NOT see "All reviews are synchronized"
    expect(await getPendingCount()).toBe(1);

    await markReviewStatus(samplePayload.client_event_id, 'syncing');
    expect(await getPendingCount()).toBe(1);
  });

  it('preserves pending review events across database reopen simulating app restart', async () => {
    await enqueuePendingReview(samplePayload);
    expect(await getPendingCount()).toBe(1);

    // Simulate closing the database when app terminates
    await closeDatabaseForTesting();

    // Reopen database on new app start
    const items = await getPendingReviews();
    expect(items).toHaveLength(1);
    expect(items[0].client_event_id).toBe(samplePayload.client_event_id);
    expect(items[0].payload.vocabulary_item_id).toBe(samplePayload.vocabulary_item_id);
    expect(items[0].payload.performance_rating).toBe(samplePayload.performance_rating);
    expect(await getPendingCount()).toBe(1);
  });
});
