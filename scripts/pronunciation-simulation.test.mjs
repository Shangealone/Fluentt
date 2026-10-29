import test from 'node:test';
import assert from 'node:assert/strict';
import * as simulatedScore from '../apps/mobile/src/features/pronunciation/simulatedScore.ts';

test('simulated pronunciation score is an explicitly marked integer from 75 through 100', () => {
  assert.equal(typeof simulatedScore.createSimulatedPronunciationScore, 'function');
  const low = simulatedScore.createSimulatedPronunciationScore(() => 0);
  const high = simulatedScore.createSimulatedPronunciationScore(() => 0.999999);
  assert.deepEqual(low, { kind: 'simulated', overall_score: 75 });
  assert.deepEqual(high, { kind: 'simulated', overall_score: 100 });
  for (const random of [0.02, 0.25, 0.5, 0.75, 0.98]) {
    const result = simulatedScore.createSimulatedPronunciationScore(() => random);
    assert.equal(result.kind, 'simulated');
    assert.ok(Number.isInteger(result.overall_score));
    assert.ok(result.overall_score >= 75 && result.overall_score <= 100);
  }
});

test('simulated score remains an internal fixture even if an old demo flag is set', () => {
  const previous = process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE;
  try {
    delete process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE;
    assert.equal(simulatedScore.isPronunciationDemoScoreEnabled(), false);
    process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE = 'true';
    assert.equal(simulatedScore.isPronunciationDemoScoreEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE;
    else process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE = previous;
  }
});
