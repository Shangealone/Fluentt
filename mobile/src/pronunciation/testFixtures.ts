import { AttemptMetadata } from './api';

export const metadata: AttemptMetadata = {
  client_pronunciation_attempt_id: '11111111-1111-4111-8111-111111111111',
  content_release_id: '22222222-2222-4222-8222-222222222222',
  content_revision_id: '33333333-3333-4333-8333-333333333333',
  vocabulary_item_id: '44444444-4444-4444-8444-444444444444',
  target_kind: 'term', original_interaction_at: '2026-10-19T12:00:00Z',
  capture_profile_version: 'expo57-term-m4a-v1', device_platform: 'android', application_version: '1.0.0',
};

export function payload(status = 'scored') {
  return {
    schema_version: 'pronunciation-result-v1', status, client_pronunciation_attempt_id: metadata.client_pronunciation_attempt_id,
    target: { ...metadata, term: 'water' },
    assessment: { accuracy_score: status === 'scored' ? 89.995 : null, accuracy_score_display: status === 'scored' ? '90.00' : null, category: status === 'scored' ? 'B' : null },
    feedback: { general_feedback_key: status === 'scored' ? 'pronunciation.feedback.B' : status === 'unscorable' ? 'pronunciation.feedback.unscorable' : null },
    issues: [], reason: status === 'failed' ? { recovery: 'operator_action' } : status === 'unscorable' ? { recovery: 'rerecord' } : null,
  };
}
