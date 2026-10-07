/** Complete backend-shaped fixtures; never imported by production code. */
export const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PROFILE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const CLIENT_SESSION = '99999999-9999-4999-8999-999999999999';
export const SERVER_SESSION = '22222222-2222-4222-8222-222222222222';
export const EVENT = '11111111-1111-4111-8111-111111111111';
export const LESSON = '44444444-4444-4444-8444-444444444444';
export const REVISION = '77777777-7777-4777-8777-777777777777';
export const RELEASE = '88888888-8888-4888-8888-888888888888';
export const ATTEMPT = '55555555-5555-4555-8555-555555555555';
export const profileWire = {
  id: PROFILE, user_id: ACCOUNT, participant_code: 'P_D6', email: 'learner@example.test',
  interface_language: null, target_learning_language: 'en' as const,
  created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T00:00:00Z',
};
export function reviewWire(eventId = EVENT) {
  return { id: ATTEMPT, client_event_id: eventId, session_id: SERVER_SESSION,
    vocabulary_item_id: '33333333-3333-4333-8333-333333333333',
    content_revision_id: REVISION, content_release_id: RELEASE, correct: false,
    response_time_ms: 1234, scheduler_type: 'development', algorithm_version: 'dev-0.1',
    next_interval_seconds: 600, next_due_at: '2025-01-01T11:32:33.456Z',
    server_acceptance_at: '2025-01-02T12:00:00Z', scheduler_state: { correct: false } };
}
export function syncWire(...eventIds: string[]) {
  return { accepted_events: eventIds.map((id) => reviewWire(id)), processed_count: eventIds.length };
}
export function detailWire(version = 'lesson-label') {
  return { id: LESSON, language_code: 'en', title: 'Greetings', description: null,
    content_version: version, content_release_id: RELEASE, sort_order: 1, is_active: true,
    vocabulary_items: [{ id: '33333333-3333-4333-8333-333333333333', lesson_id: LESSON,
      term: 'hello', definition: 'greeting', example_sentence: 'Hello there.', difficulty: 'hard',
      category: null, translation: null, content_version: 'word-label', sort_order: 0, is_active: true,
      content_revision_id: REVISION, content_release_id: RELEASE }] };
}
