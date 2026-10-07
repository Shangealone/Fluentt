import { apiClient } from '../api/client';
import { sanitizeReviewAttempt } from './payload';
import {
  ReviewAttemptCreate,
  ReviewAttemptResponse,
  ReviewSession,
  ReviewSessionCreate,
  adaptReviewAttemptFromApi,
  adaptReviewSessionFromApi,
} from './types';

export async function createReviewSession(
  clientSessionId: string,
  ownerUserId: string
): Promise<ReviewSession> {
  const payload: ReviewSessionCreate = {
    client_session_id: clientSessionId,
  };
  const wire = await apiClient<unknown>('/reviews/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
    expectedUserId: ownerUserId,
  });
  const session = adaptReviewSessionFromApi(wire);
  if (session.clientSessionId !== clientSessionId) throw new Error('Server returned a different client session.');
  return session;
}

export async function submitReviewAttempt(
  attempt: ReviewAttemptCreate,
  ownerUserId: string
): Promise<ReviewAttemptResponse> {
  const wire = await apiClient<unknown>('/reviews/attempts', {
    method: 'POST',
    body: JSON.stringify(sanitizeReviewAttempt(attempt)),
    expectedUserId: ownerUserId,
  });
  const response = adaptReviewAttemptFromApi(wire);
  if (response.clientEventId !== attempt.client_event_id) throw new Error('Server did not acknowledge the submitted event.');
  return response;
}
