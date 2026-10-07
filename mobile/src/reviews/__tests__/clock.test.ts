import { createMonotonicClock, createTestClock } from '../clock';
import { Platform } from 'react-native';

it('identifies the browser high-resolution source on web', () => {
  const runtime = globalThis as typeof globalThis & { nativePerformanceNow?: () => number };
  const original = runtime.nativePerformanceNow;
  runtime.nativePerformanceNow = undefined;
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(performance, 'now').mockReturnValueOnce(10.25).mockReturnValueOnce(50.75);
  try {
    const clock = createMonotonicClock();
    expect(clock.source).toBe('performance_now');
    expect(clock.elapsedMs(clock.now(), clock.now())).toBe(41);
  } finally { runtime.nativePerformanceNow = original; jest.restoreAllMocks(); }
});

it('falls back explicitly on web when the performance global is absent', () => {
  const runtime = globalThis as typeof globalThis & { nativePerformanceNow?: () => number };
  const original = runtime.nativePerformanceNow;
  runtime.nativePerformanceNow = undefined;
  jest.replaceProperty(Platform, 'OS', 'web');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance')!;
  Reflect.deleteProperty(globalThis, 'performance');
  try { expect(createMonotonicClock().source).toBe('date_now_fallback'); }
  finally { Object.defineProperty(globalThis, 'performance', descriptor); runtime.nativePerformanceNow = original; jest.restoreAllMocks(); }
});

it('identifies the injected elapsed source', () => {
  expect(createTestClock([10, 20]).source).toBe('performance_now');
});

it('identifies a native JSI clock and keeps its epoch when globals change', () => {
  const runtime = globalThis as typeof globalThis & { nativePerformanceNow?: () => number };
  const original = runtime.nativePerformanceNow;
  runtime.nativePerformanceNow = jest.fn().mockReturnValueOnce(10.25).mockReturnValueOnce(20.75);
  try {
    const clock = createMonotonicClock();
    expect(clock.source).toBe('native_performance_now');
    const start = clock.now();
    runtime.nativePerformanceNow = undefined;
    expect(clock.elapsedMs(start, clock.now())).toBe(11);
  } finally { runtime.nativePerformanceNow = original; }
});

it('labels native wall-clock fallback even when performance.now exists and clamps backwards jumps', () => {
  const runtime = globalThis as typeof globalThis & { nativePerformanceNow?: () => number };
  const original = runtime.nativePerformanceNow;
  runtime.nativePerformanceNow = undefined;
  jest.spyOn(Date, 'now').mockReturnValueOnce(500).mockReturnValueOnce(400).mockReturnValueOnce(550);
  try {
    const clock = createMonotonicClock();
    expect(clock.source).toBe('date_now_fallback');
    const start = clock.now();
    expect(clock.elapsedMs(start, clock.now())).toBe(0);
    expect(clock.elapsedMs(start, clock.now())).toBe(50);
  } finally { runtime.nativePerformanceNow = original; jest.restoreAllMocks(); }
});

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
