import { apiClient } from '../../api/client';
import { createReviewSession, submitReviewAttempt } from '../api';
import { adaptReviewAttemptFromApi, adaptReviewSessionFromApi } from '../types';
import { ACCOUNT, CLIENT_SESSION, SERVER_SESSION, EVENT, reviewWire } from '../../testUtils/contracts';
import { sanitizeReviewAttempt } from '../payload';

jest.mock('../../api/client', () => ({ apiClient: jest.fn() }));

it('creates a session using only the original client UUID and preserves the distinct server UUID', async () => {
  (apiClient as jest.Mock).mockResolvedValue({ id: SERVER_SESSION, client_session_id: CLIENT_SESSION,
    created_at: '2025-01-01T00:00:00Z' });
  const session = await createReviewSession(CLIENT_SESSION, ACCOUNT);
  expect(JSON.parse((apiClient as jest.Mock).mock.calls[0][1].body)).toEqual({ client_session_id: CLIENT_SESSION });
  expect(session).toEqual({ id: SERVER_SESSION, clientSessionId: CLIENT_SESSION, createdAt: '2025-01-01T00:00:00Z' });
  expect(session.id).not.toBe(session.clientSessionId);
});

it('adapts the flat authoritative review result with seconds and ISO timestamps', () => {
  const result = adaptReviewAttemptFromApi(reviewWire());
  expect(result).toEqual({ id: reviewWire().id, clientEventId: EVENT, sessionId: SERVER_SESSION,
    vocabularyItemId: reviewWire().vocabulary_item_id, contentRevisionId: reviewWire().content_revision_id,
    contentReleaseId: reviewWire().content_release_id, correct: false, responseTimeMs: 1234, timingEvidence: null,
    schedulerType: 'development', algorithmVersion: 'dev-0.1', nextIntervalSeconds: 600,
    nextDueAt: '2025-01-01T11:32:33.456Z', serverAcceptanceAt: '2025-01-02T12:00:00Z', schedulerState: { correct: false } });
  expect(result).not.toHaveProperty('schedule');
});

it.each(['id', 'client_event_id', 'session_id', 'correct', 'response_time_ms', 'next_interval_seconds', 'next_due_at', 'server_acceptance_at'])
('rejects a review response missing %s instead of inventing it', (field) => {
  const wire: Record<string, unknown> = reviewWire();
  delete wire[field];
  expect(() => adaptReviewAttemptFromApi(wire)).toThrow();
});

it('preserves paired legacy null provenance but rejects inconsistent absence', () => {
  expect(adaptReviewAttemptFromApi({ ...reviewWire(), content_revision_id: null, content_release_id: null }))
    .toMatchObject({ contentRevisionId: null, contentReleaseId: null });
  expect(() => adaptReviewAttemptFromApi({ ...reviewWire(), content_revision_id: null })).toThrow();
  expect(() => adaptReviewSessionFromApi({ id: SERVER_SESSION, created_at: '2025-01-01T00:00:00Z' })).toThrow();
});

it('submits the unchanged canonical D4/D5 wire request and adapts its response', async () => {
  (apiClient as jest.Mock).mockClear().mockResolvedValue(reviewWire());
  const payload = { client_event_id: EVENT, client_session_id: CLIENT_SESSION, session_id: SERVER_SESSION,
    vocabulary_item_id: reviewWire().vocabulary_item_id, content_revision_id: reviewWire().content_revision_id,
    content_release_id: reviewWire().content_release_id, correct: false, response_time_ms: 1234,
    submitted_answer: null, client_interaction_at: '2025-01-01T11:22:33.456Z', device_platform: 'ios', application_version: '1.0.0' };
  const result = await submitReviewAttempt(payload, ACCOUNT);
  expect(JSON.parse((apiClient as jest.Mock).mock.calls[0][1].body)).toEqual(payload);
  expect(result.clientEventId).toBe(EVENT);
});

it('preserves canonical timing evidence while stripping nested extras and keeping legacy absence explicit', () => {
  const evidence = { version: 1 as const, clock_source: 'date_now_fallback' as const,
    start_boundary: 'prompt_layout_frame' as const, interruption_count: 1,
    interruption_reasons: ['app_background' as const] };
  const payload = { client_event_id: EVENT, client_session_id: CLIENT_SESSION, vocabulary_item_id: 'word',
    content_revision_id: 'revision', content_release_id: 'release', correct: false, response_time_ms: 1234,
    client_interaction_at: '2025-01-01T11:22:33.456Z', device_platform: 'ios', application_version: '1.0.0',
    timing_evidence: { ...evidence, email: 'private@example.test', access_token: 'secret' } };
  expect(sanitizeReviewAttempt(payload).timing_evidence).toEqual(evidence);
  expect(adaptReviewAttemptFromApi({ ...reviewWire(), timing_evidence: evidence }).timingEvidence).toEqual(evidence);
  expect(adaptReviewAttemptFromApi(reviewWire()).timingEvidence).toBeNull();
  expect(() => sanitizeReviewAttempt({ ...payload, timing_evidence: { ...evidence, interruption_count: 0 } })).toThrow();
});
