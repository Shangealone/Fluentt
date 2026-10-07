import { parseSyncReviewEventsResponse } from '../syncContract';
import { EVENT, reviewWire, syncWire } from '../../testUtils/contracts';

it('uses accepted_events with a complete authoritative result as the current acknowledgement', () => {
  const response = parseSyncReviewEventsResponse(syncWire(EVENT));
  expect(response.acceptedEvents[0]).toMatchObject({ clientEventId: EVENT, id: reviewWire().id, nextIntervalSeconds: 600 });
  expect(response.processedCount).toBe(1);
});

it.each([
  { results: [{ client_event_id: EVENT, status: 'accepted' }] },
  { accepted_events: [{ client_event_id: EVENT }], processed_count: 1 },
  { accepted_events: [reviewWire()], processed_count: 0 },
  { accepted_events: [reviewWire(), reviewWire()], processed_count: 2 },
  { accepted_events: [{ ...reviewWire(), correct: 'false' }], processed_count: 1 },
])('rejects malformed or obsolete acknowledgements as retryable contract errors', (wire) => {
  try {
    parseSyncReviewEventsResponse(wire);
    throw new Error('Malformed acknowledgement was accepted');
  } catch (error) {
    expect(error).not.toHaveProperty('status');
    expect((error as Error).message).not.toBe('Malformed acknowledgement was accepted');
  }
});
