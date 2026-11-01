import type { WavLMScore } from "../../services/api/wavlm";
/** Explain only validated acoustic outputs; never infer a score from recognized text. */
export function pronunciationFeedback(result: WavLMScore) {
  const flagged = result.words.flatMap(word => word.phonemes.filter(phone => phone.error).map(phone => ({ ...phone, word: word.word })));
  const focus = [...flagged].sort((a, b) => b.pherr_prob - a.pherr_prob);
  const seen = new Set<string>();
  const tips = focus.filter(phone => { if (seen.has(phone.phone)) return false; seen.add(phone.phone); return true; }).slice(0, 3);
  return {
    summary: flagged.length
      ? `The model flagged ${flagged.length} sound occurrence${flagged.length === 1 ? "" : "s"} to practise. Listen to the reference, then try the sentence again.`
      : "The model did not flag a sound at its current threshold. This does not prove perfect pronunciation.",
    tips,
  };
}
