import { arrayField, ContractError, integerField, object } from '../api/contracts';
import { adaptReviewAttemptFromApi, ApiReviewAttemptResponse, ReviewAttemptResponse } from '../reviews/types';

export interface ApiSyncReviewEventsResponse { accepted_events: ApiReviewAttemptResponse[]; processed_count: number; }
export interface SyncReviewEventsResponse { acceptedEvents: ReviewAttemptResponse[]; processedCount: number; }
/** One current backend shape. Missing/malformed acknowledgement remains retryable. */
export function parseSyncReviewEventsResponse(value: unknown): SyncReviewEventsResponse {
  const row = object(value);
  const acceptedEvents = arrayField(row, 'accepted_events').map(adaptReviewAttemptFromApi);
  const processedCount = integerField(row, 'processed_count');
  if (processedCount !== acceptedEvents.length || new Set(acceptedEvents.map((event) => event.clientEventId)).size !== acceptedEvents.length) {
    throw new ContractError('Inconsistent synchronization acknowledgement.');
  }
  return { acceptedEvents, processedCount };
}
