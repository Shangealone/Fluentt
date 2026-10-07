import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { generateUUID } from '../utils/uuid';
import { ReviewAttemptCreate } from './types';

/** Capture at answer commitment, before authentication or transport awaits. */
export function captureReviewAttempt(
  facts: Pick<ReviewAttemptCreate, 'client_session_id' | 'session_id' | 'vocabulary_item_id' |
    'response_time_ms' | 'correct' | 'submitted_answer' | 'content_revision_id' | 'content_release_id' |
    'timing_evidence'> & { client_interaction_at?: string }
): ReviewAttemptCreate {
  const version = Constants.expoConfig?.version;
  if (typeof version !== 'string' || !version.trim() || version.length > 32) {
    throw new Error('The configured application version is unavailable.');
  }
  return {
    ...facts,
    client_event_id: generateUUID(),
    client_interaction_at: facts.client_interaction_at ?? new Date().toISOString(),
    device_platform: Platform.OS,
    application_version: version,
  };
}
