import type { Attempt, CapturedResponse, ImmediateScore } from "../services/api/capture";
import { responseComplete } from "../features/assignments/captureState";

// In-memory demo only. Real classroom submissions are evaluated on the API server.
export function scoreDemoAttempt(attempt: Attempt, responses: CapturedResponse[], keys: Record<string, unknown>): ImmediateScore {
  const base = { engine_version: "demo-objective-exact-v1", policy_version: "objective-exact-v1" };
  const answers = new Map(responses.map(row => [row.assignment_question_id, row.answer]));
  if (attempt.questions.some(item => !responseComplete(item, answers.get(item.assignment_question_id))))
    return { ...base, status: "incomplete", earned_points: null, possible_points: null };
  let earned = 0, possible = 0;
  for (const item of attempt.questions) {
    const method = item.definition.method;
    const content = item.definition.content as Record<string, unknown>;
    const answer = answers.get(item.assignment_question_id) as Record<string, unknown>;
    const key = keys[item.id] as Record<string, unknown> | undefined;
    if (!key) return { ...base, status: "review_required", earned_points: null, possible_points: null };
    if (method === "flashcards") continue;
    let correct = false;
    if (method === "multiple_choice") correct = answer.option_id === key.correct_option_id;
    else if (method === "true_false") correct = answer.value === key.value;
    else if (method === "identification") correct = (key.accepted_answers as string[]).some(value =>
      key.case_sensitive === true ? answer.text === value : String(answer.text).toLowerCase() === value.toLowerCase());
    else if (method === "fill_in_the_blank") {
      const values = new Map((answer.blanks as { blank_id: string; text: string }[]).map(row => [row.blank_id, row.text]));
      correct = (content.blank_ids as string[]).every(id => ((key.accepted_answers as Record<string, string[]>)[id] ?? []).includes(values.get(id) ?? ""));
    } else if (method === "multiple_select" || method === "error_identification") {
      const field = method === "multiple_select" ? "option_ids" : "selected_token_ids";
      const expected = method === "multiple_select" ? "correct_option_ids" : "error_token_ids";
      correct = JSON.stringify([...(answer[field] as string[])].sort()) === JSON.stringify([...(key[expected] as string[])].sort());
    } else if (method === "word_arrangement" || method === "sentence_arrangement") {
      const field = method === "word_arrangement" ? "ordered_token_ids" : "ordered_sentence_ids";
      correct = JSON.stringify(answer[field]) === JSON.stringify(key.ordered_ids);
    } else if (method === "matching_type") {
      const order = (pairs: { left_id: string; right_id: string }[]) => pairs.map(pair => `${pair.left_id}\u0000${pair.right_id}`).sort();
      correct = JSON.stringify(order(answer.pairs as { left_id: string; right_id: string }[]))
        === JSON.stringify(order(key.pairs as { left_id: string; right_id: string }[]));
    } else return { ...base, status: "review_required", earned_points: null, possible_points: null };
    possible += 1;
    if (correct) earned += 1;
  }
  return possible
    ? { ...base, status: "complete", earned_points: earned.toFixed(2), possible_points: possible.toFixed(2) }
    : { ...base, status: "not_applicable", earned_points: null, possible_points: null };
}
