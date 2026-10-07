import { createTestClock } from '../clock';
import { createPresentationTimer, parseTimingEvidence } from '../timing';

it('cannot commit an unpresented prompt and starts only once', () => {
  const clock = createTestClock([100, 1234.5]);
  const timer = createPresentationTimer(clock);
  expect(() => timer.commit()).toThrow('presented');
  timer.start(); timer.start();
  expect(timer.commit().response_time_ms).toBe(1135);
});

it('freezes duration, wall-clock timestamp and interruption evidence before retries', () => {
  const clock = createTestClock([100, 2500, 99999]);
  const timer = createPresentationTimer(clock);
  timer.interrupt('screen_blur'); // Before presentation is not an interrupted measurement.
  timer.start();
  timer.interrupt('app_inactive'); timer.interrupt('app_background'); timer.interrupt('screen_blur');
  jest.useFakeTimers().setSystemTime(new Date('2025-01-01T11:22:33.456Z'));
  try {
    const first = timer.commit();
    expect(first).toEqual({ response_time_ms: 2400, client_interaction_at: '2025-01-01T11:22:33.456Z',
      timing_evidence: { version: 1, clock_source: 'performance_now', start_boundary: 'prompt_layout_frame',
        interruption_count: 3, interruption_reasons: ['app_inactive', 'app_background', 'screen_blur'] } });
    jest.setSystemTime(new Date('2030-01-01'));
    timer.interrupt('app_background'); timer.start();
    expect(timer.commit()).toBe(first);
    expect(Object.isFrozen(first.timing_evidence.interruption_reasons)).toBe(true);
  } finally { jest.useRealTimers(); }
});

it('counts repeated observed interruptions without duplicating reasons', () => {
  const timer = createPresentationTimer(createTestClock([100, 500]));
  timer.start(); timer.interrupt('app_background'); timer.interrupt('app_background');
  expect(timer.commit().timing_evidence).toMatchObject({ interruption_count: 2, interruption_reasons: ['app_background'] });
});

it('keeps legacy absence explicit and rejects inconsistent or secret-bearing timing evidence', () => {
  expect(parseTimingEvidence(undefined)).toBeNull();
  expect(parseTimingEvidence(null)).toBeNull();
  const evidence = { version: 1, clock_source: 'date_now_fallback', start_boundary: 'prompt_layout_frame',
    interruption_count: 1, interruption_reasons: ['app_background'] };
  expect(parseTimingEvidence({ ...evidence, access_token: 'secret' })).toEqual(evidence);
  for (const invalid of [{ ...evidence, version: 2 }, { ...evidence, interruption_count: 0 },
    { ...evidence, interruption_reasons: [] }, { ...evidence, interruption_reasons: ['lock_guessed'] },
    { ...evidence, interruption_count: 1.5 }, { ...evidence, clock_source: 'unknown' }]) {
    expect(() => parseTimingEvidence(invalid)).toThrow();
  }
});
