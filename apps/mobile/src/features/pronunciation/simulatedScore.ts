export type SimulatedPronunciationScore = {
  kind: "simulated";
  overall_score: number;
};

export function isPronunciationDemoScoreEnabled(): boolean {
  // Synthetic score generation remains a test fixture, never a runtime fallback.
  return false;
}

export function createSimulatedPronunciationScore(
  random: () => number = Math.random,
): SimulatedPronunciationScore {
  return {
    kind: "simulated",
    overall_score: Math.floor(random() * 26) + 75,
  };
}
