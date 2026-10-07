import { ReviewAttemptCreate } from './types';

/** Copy only captured research facts. Never reconstruct missing legacy facts. */
export function sanitizeReviewAttempt(payload: ReviewAttemptCreate): ReviewAttemptCreate {
  for (const field of ['client_event_id', 'client_session_id', 'vocabulary_item_id',
    'client_interaction_at', 'device_platform', 'application_version', 'content_revision_id', 'content_release_id'] as const) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) {
      throw new Error(`Missing captured review metadata: ${field}`);
    }
  }
  if (typeof payload.correct !== 'boolean' || !Number.isInteger(payload.response_time_ms) ||
    payload.response_time_ms < 0 || payload.response_time_ms > 3_600_000) {
    throw new Error('Invalid captured review response.');
  }
  return {
    client_event_id: payload.client_event_id,
    client_session_id: payload.client_session_id,
    session_id: payload.session_id,
    vocabulary_item_id: payload.vocabulary_item_id,
    content_revision_id: payload.content_revision_id,
    content_release_id: payload.content_release_id,
    response_time_ms: payload.response_time_ms,
    correct: payload.correct,
    submitted_answer: payload.submitted_answer,
    client_interaction_at: payload.client_interaction_at,
    device_platform: payload.device_platform,
    application_version: payload.application_version,
  };
}
