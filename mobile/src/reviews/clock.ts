import { Platform } from 'react-native';

export type ClockSource = 'native_performance_now' | 'performance_now' | 'date_now_fallback';

export interface MonotonicClock {
  readonly source: ClockSource;
  now(): number;
  elapsedMs(started: number, finished: number): number;
}

export function createTestClock(ticks: number[]): MonotonicClock {
  let index = 0;
  return {
    source: 'performance_now',
    now(): number {
      if (ticks.length === 0) return 0;
      if (index >= ticks.length) {
        return ticks[ticks.length - 1];
      }
      const val = ticks[index];
      index++;
      return val;
    },
    elapsedMs(started: number, finished: number): number {
      const diff = finished - started;
      if (diff <= 0) return 0;
      return Math.round(Number(diff.toFixed(4)));
    },
  };
}

export function createMonotonicClock(): MonotonicClock {
  const nativeNow = (globalThis as typeof globalThis & { nativePerformanceNow?: () => number }).nativePerformanceNow;
  // RN's performance.now shim can itself use Date.now. Prefer the explicit JSI
  // source on native; only identify browser performance.now as such on web.
  const browserNow = Platform.OS === 'web' && typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now.bind(performance) : undefined;
  const read = nativeNow ?? browserNow ?? Date.now;
  const source: ClockSource = nativeNow ? 'native_performance_now'
    : browserNow ? 'performance_now' : 'date_now_fallback';
  let lastTime = -Infinity;
  return {
    source,
    now(): number {
      let t = read();
      if (!Number.isFinite(t)) throw new Error('Elapsed clock is unavailable.');
      // Ensure monotonic non-decreasing even if system clock shifts
      if (t < lastTime) {
        t = lastTime;
      } else {
        lastTime = t;
      }
      return t;
    },
    elapsedMs(started: number, finished: number): number {
      const diff = finished - started;
      if (diff <= 0) return 0;
      return Math.round(Number(diff.toFixed(4)));
    },
  };
}
