import { createMonotonicClock, createTestClock } from '../clock';

describe('Monotonic Clock', () => {
  it('measures learner interaction duration independent of network using injected test clock', () => {
    const clock = createTestClock([1000.25, 3560.75]);
    const started = clock.now();
    const finished = clock.now();
    expect(clock.elapsedMs(started, finished)).toBe(2561);
  });

  it('rounds elapsed milliseconds to integer', () => {
    const clock = createTestClock([100.1, 200.4, 300.9]);
    const t0 = clock.now();
    const t1 = clock.now();
    expect(clock.elapsedMs(t0, t1)).toBe(100);

    const t2 = clock.now();
    expect(clock.elapsedMs(t1, t2)).toBe(101);
  });

  it('clamps negative elapsed time to 0 to prevent corrupt data', () => {
    const clock = createTestClock([500, 400]);
    const t0 = clock.now();
    const t1 = clock.now();
    expect(clock.elapsedMs(t0, t1)).toBe(0);
  });

  it('production clock provides monotonic positive numbers', () => {
    const clock = createMonotonicClock();
    const t0 = clock.now();
    const t1 = clock.now();
    expect(t1).toBeGreaterThanOrEqual(t0);
    expect(clock.elapsedMs(t0, t1)).toBeGreaterThanOrEqual(0);
  });
});
