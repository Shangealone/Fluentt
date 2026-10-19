import type { Attempt, CaptureItem, Progress } from "../../services/api/capture.ts";
export type Buffers = Record<string, Record<string, unknown>>;
export function savedBuffers(row: Attempt): Buffers { return Object.fromEntries(row.responses.map(value => [value.assignment_question_id, value.answer])); }
export function progress(row: Attempt, buffers: Buffers, position: number): Progress {
  return { position, responses: row.questions.flatMap(item => Object.hasOwn(buffers, item.assignment_question_id)
    ? [{ assignment_question_id: item.assignment_question_id, answer: buffers[item.assignment_question_id] }] : []) };
}
export function responseComplete(item: CaptureItem, answer: Record<string, unknown> | undefined): boolean {
  if (!answer) return false;
  const method = item.definition.method, content = item.definition.content;
  if (method === "multiple_choice") return typeof answer.option_id === "string";
  if (method === "true_false") return typeof answer.value === "boolean";
  if (method === "identification") return typeof answer.text === "string" && !!answer.text.trim();
  if (method === "fill_in_the_blank") {
    const entries = answer.blanks as { blank_id: string; text: string }[];
    return Array.isArray(entries) && (content.blank_ids as string[]).every(id => entries.some(entry => entry.blank_id === id && !!entry.text.trim()));
  }
  if (method === "flashcards") return typeof answer.recall === "string";
  const key = method === "multiple_select" ? "option_ids" : method === "error_identification" ? "selected_token_ids"
    : method === "word_arrangement" ? "ordered_token_ids" : method === "sentence_arrangement" ? "ordered_sentence_ids" : "pairs";
  const selected = answer[key];
  if (!Array.isArray(selected)) return false;
  if (method === "multiple_select" || method === "error_identification") return selected.length > 0;
  return selected.length === ((method === "matching_type" ? content.left : content.items) as unknown[]).length;
}
