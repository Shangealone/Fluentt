export interface MonotonicClock {
  now(): number;
  elapsedMs(started: number, finished: number): number;
}

export function createTestClock(ticks: number[]): MonotonicClock {
  let index = 0;
  return {
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
  let lastTime = 0;
  return {
    now(): number {
      let t: number;
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        t = performance.now();
      } else {
        t = Date.now();
      }
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
