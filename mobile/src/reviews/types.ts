import { booleanField, ContractError, integerField, JsonValue, nullableString, object, stateField, stringField, timestampField } from '../api/contracts';

export interface ReviewSessionCreate { client_session_id: string; }
export interface ApiReviewSession { id: string; client_session_id: string; created_at: string; }
export interface ReviewSession { id: string; clientSessionId: string; createdAt: string; }

/** Captured D4/D5 wire request; queue replay preserves these fields verbatim. */
export interface ReviewAttemptCreate {
  client_event_id: string;
  client_session_id: string;
  session_id?: string | null;
  vocabulary_item_id: string;
  content_revision_id: string;
  content_release_id: string;
  correct: boolean;
  submitted_answer?: string | null;
  response_time_ms: number;
  client_interaction_at: string;
  device_platform: string;
  application_version: string;
}
export interface ApiSchedulingResult {
  scheduler_type: string;
  algorithm_version: string;
  next_interval_seconds: number;
  next_due_at: string;
  scheduler_state: Record<string, JsonValue> | null;
}
export interface SchedulingResult {
  schedulerType: string;
  algorithmVersion: string;
  nextIntervalSeconds: number;
  nextDueAt: string;
  schedulerState: Record<string, JsonValue> | null;
}
export interface ApiReviewAttemptResponse extends ApiSchedulingResult {
  id: string;
  client_event_id: string;
  session_id: string;
  vocabulary_item_id: string;
  content_revision_id: string | null;
  content_release_id: string | null;
  correct: boolean;
  response_time_ms: number;
  server_acceptance_at: string;
}
export interface ReviewAttemptResponse extends SchedulingResult {
  id: string;
  clientEventId: string;
  sessionId: string;
  vocabularyItemId: string;
  contentRevisionId: string | null;
  contentReleaseId: string | null;
  correct: boolean;
  responseTimeMs: number;
  serverAcceptanceAt: string;
}
export function adaptReviewSessionFromApi(value: unknown): ReviewSession {
  const row = object(value);
  return { id: stringField(row, 'id'), clientSessionId: stringField(row, 'client_session_id'), createdAt: timestampField(row, 'created_at') };
}
export function adaptReviewAttemptFromApi(value: unknown): ReviewAttemptResponse {
  const row = object(value);
  const contentRevisionId = nullableString(row, 'content_revision_id');
  const contentReleaseId = nullableString(row, 'content_release_id');
  if ((contentRevisionId === null) !== (contentReleaseId === null) || (contentRevisionId !== null && !contentRevisionId.trim()) || (contentReleaseId !== null && !contentReleaseId.trim())) throw new ContractError('Inconsistent accepted content provenance.');
  const responseTimeMs = integerField(row, 'response_time_ms');
  if (responseTimeMs > 3_600_000) throw new ContractError('Invalid response_time_ms.');
  return {
    id: stringField(row, 'id'), clientEventId: stringField(row, 'client_event_id'), sessionId: stringField(row, 'session_id'),
    vocabularyItemId: stringField(row, 'vocabulary_item_id'), contentRevisionId, contentReleaseId,
    correct: booleanField(row, 'correct'), responseTimeMs,
    schedulerType: stringField(row, 'scheduler_type'), algorithmVersion: stringField(row, 'algorithm_version'),
    nextIntervalSeconds: integerField(row, 'next_interval_seconds'), nextDueAt: timestampField(row, 'next_due_at'),
    serverAcceptanceAt: timestampField(row, 'server_acceptance_at'), schedulerState: stateField(row, 'scheduler_state'),
  };
}
