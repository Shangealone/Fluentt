import { ContractError, integerField, object, stringField } from '../api/contracts';
import { ClockSource, MonotonicClock } from './clock';

export type TimingInterruption = 'app_inactive' | 'app_background' | 'app_state_unknown' |
  'app_blur' | 'screen_blur' | 'navigation_transition' | 'navigation_away';

/** Evidence of observation, not an analytical validity/exclusion decision. */
export interface TimingEvidence {
  version: 1;
  clock_source: ClockSource;
  start_boundary: 'prompt_layout_frame';
  interruption_count: number;
  interruption_reasons: readonly TimingInterruption[];
}

export function parseTimingEvidence(value: unknown): TimingEvidence | null {
  if (value == null) return null;
  const row = object(value);
  const source = stringField(row, 'clock_source');
  const count = integerField(row, 'interruption_count');
  const reasons = row.interruption_reasons;
  const allowed: readonly string[] = ['app_inactive', 'app_background', 'app_state_unknown',
    'app_blur', 'screen_blur', 'navigation_transition', 'navigation_away'];
  if (row.version !== 1 || row.start_boundary !== 'prompt_layout_frame' ||
    !['native_performance_now', 'performance_now', 'date_now_fallback'].includes(source) ||
    !Array.isArray(reasons) || reasons.some((reason) => !allowed.includes(reason)) ||
    new Set(reasons).size !== reasons.length || reasons.length > count ||
    (count === 0) !== (reasons.length === 0)) {
    throw new ContractError('Invalid timing evidence.');
  }
  return { version: 1, clock_source: source as ClockSource, start_boundary: 'prompt_layout_frame',
    interruption_count: count, interruption_reasons: [...reasons] as TimingInterruption[] };
}

export interface CapturedTiming {
  response_time_ms: number;
  client_interaction_at: string;
  timing_evidence: TimingEvidence;
}

/** One in-memory presentation. Never persisted/reconstructed before commitment. */
export function createPresentationTimer(clock: MonotonicClock) {
  let start: number | null = null;
  let captured: CapturedTiming | null = null;
  let count = 0;
  const reasons = new Set<TimingInterruption>();
  return {
    start() {
      if (start === null && captured === null) start = clock.now();
    },
    interrupt(reason: TimingInterruption) {
      if (start === null || captured !== null) return;
      count += 1;
      reasons.add(reason);
    },
    commit(): CapturedTiming {
      if (captured) return captured;
      if (start === null) throw new Error('Review prompt has not been presented.');
      const finish = clock.now();
      const interactionAt = new Date().toISOString();
      captured = Object.freeze({ response_time_ms: clock.elapsedMs(start, finish),
        client_interaction_at: interactionAt,
        timing_evidence: Object.freeze({ version: 1, clock_source: clock.source,
          start_boundary: 'prompt_layout_frame', interruption_count: count,
          interruption_reasons: Object.freeze([...reasons]) }) });
      return captured;
    },
  };
}
