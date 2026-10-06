import { apiClient } from '../api/client';
import {
  ReviewAttemptCreate,
  ReviewAttemptResponse,
  ReviewSession,
  ReviewSessionCreate,
} from './types';

export async function createReviewSession(
  clientSessionId: string,
  lessonId?: string | null,
  ownerUserId?: string
): Promise<ReviewSession> {
  const payload: ReviewSessionCreate = {
    client_session_id: clientSessionId,
    lesson_id: lessonId ?? null,
  };
  return apiClient<ReviewSession>('/reviews/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
    expectedUserId: ownerUserId,
  });
}

export async function submitReviewAttempt(
  attempt: ReviewAttemptCreate,
  ownerUserId: string
): Promise<ReviewAttemptResponse> {
  return apiClient<ReviewAttemptResponse>('/reviews/attempts', {
    method: 'POST',
    body: JSON.stringify(attempt),
    expectedUserId: ownerUserId,
  });
}
