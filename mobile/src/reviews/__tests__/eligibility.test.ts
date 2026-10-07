import { apiClient } from '../../api/client';
import { ACCOUNT, ATTEMPT, eligibilityWire, LESSON, RELEASE, reviewWire, REVISION } from '../../testUtils/contracts';
import { adaptReviewEligibility, fetchReviewEligibility } from '../eligibility';

jest.mock('../../api/client', () => ({ apiClient: jest.fn() }));

const current = { id: ATTEMPT, scheduler_type: 'development', algorithm_version: 'dev-0.1',
  next_interval_seconds: 600, next_due_at: '2025-01-01T00:00:00Z', scheduler_state: reviewWire().scheduler_state };

it('adapts explicit new/due classes and preserves authoritative seconds, timestamps, and provenance', () => {
  const wire = eligibilityWire();
  expect(adaptReviewEligibility(wire).items[0]).toMatchObject({ eligibility: 'new', currentSchedule: null });
  const result = adaptReviewEligibility({ ...wire, items: [{ ...wire.items[0], eligibility: 'due', current_schedule: current }] });
  expect(result).toMatchObject({ lessonId: LESSON, contentReleaseId: RELEASE, evaluatedAt: wire.evaluated_at,
    items: [{ vocabularyItem: { contentRevisionId: REVISION, contentReleaseId: RELEASE }, eligibility: 'due',
      currentSchedule: { id: ATTEMPT, schedulerType: 'development', algorithmVersion: 'dev-0.1', nextIntervalSeconds: 600,
        nextDueAt: current.next_due_at, schedulerState: current.scheduler_state } }] });
});

const wire = eligibilityWire();
it.each([
  { ...wire, evaluated_at: undefined },
  { ...wire, content_release_id: null },
  { ...wire, items: undefined },
  { ...wire, items: [{ ...wire.items[0], eligibility: 'due' }] },
  { ...wire, items: [{ ...wire.items[0], current_schedule: current }] },
  { ...wire, items: [{ ...wire.items[0], current_schedule: undefined }] },
  { ...wire, items: [{ ...wire.items[0], eligibility: 'future' }] },
  { ...wire, items: [wire.items[0], wire.items[0]] },
  { ...wire, items: [{ ...wire.items[0], vocabulary_item: { ...wire.items[0].vocabulary_item, content_release_id: REVISION } }] },
])('rejects malformed eligibility without guessed facts: %j', (malformed) => {
  expect(() => adaptReviewEligibility(malformed)).toThrow();
});

it('requests exact release and verified owner, and rejects substituted release or network failure', async () => {
  (apiClient as jest.Mock).mockResolvedValueOnce(wire);
  await fetchReviewEligibility(LESSON, ACCOUNT, RELEASE);
  expect(apiClient).toHaveBeenCalledWith(`/reviews/eligible-items?lesson_id=${LESSON}&content_release_id=${RELEASE}`, { expectedUserId: ACCOUNT });
  (apiClient as jest.Mock).mockResolvedValueOnce(wire);
  await expect(fetchReviewEligibility(LESSON, ACCOUNT, REVISION)).rejects.toThrow('Unexpected review lesson/release');
  (apiClient as jest.Mock).mockRejectedValueOnce(new TypeError('offline'));
  await expect(fetchReviewEligibility(LESSON, ACCOUNT, RELEASE)).rejects.toThrow('offline');
});
