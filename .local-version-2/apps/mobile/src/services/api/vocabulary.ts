import { ApiError, request, type AuthContext } from "./client";
export type VocabularyStudy = { id: string; title: string; status: string };
export type VocabularyDue = { title: string; items: { id: string; due_at: string }[] };
export type VocabularyReview = {
  id: string; phase: "answer" | "rating" | "finished";
  question: { vocabulary_item_id: string; content_version: number; format: "multiple_choice" | "typed_recall"; prompt: string; options: { id: string; text: string }[] };
  feedback?: { response: string; correct: boolean; answer: string }; due_at?: string;
};
export type RecallRating = "again" | "hard" | "good" | "easy";
const root = (id: string) => `/me/vocabulary/studies/${encodeURIComponent(id)}`;
function validate(row: VocabularyReview) {
  if (!row || typeof row.id !== "string" || !["answer", "rating", "finished"].includes(row.phase)
    || !row.question || typeof row.question.prompt !== "string" || !Array.isArray(row.question.options)
    || !["multiple_choice", "typed_recall"].includes(row.question.format)
    || ["accepted_forms", "correct_option_id", "meaning", "term", "answer_key"].some(k => k in row.question)
    || (row.phase !== "answer" && (!row.feedback || typeof row.feedback.correct !== "boolean" || typeof row.feedback.answer !== "string")))
    throw new ApiError(0, "We couldn’t confirm this review. Please reload.");
  return row;
}
export function vocabularyAccess(run: <T>(operation: (auth: AuthContext) => Promise<T>) => Promise<T>) {
  const mutate = (url: string, body: unknown, key: string) => run(async auth => validate(await request<VocabularyReview>(url, "POST", body, auth, { "Idempotency-Key": key })));
  return {
    studies: () => run(auth => request<{ items: VocabularyStudy[] }>("/me/vocabulary/studies", "GET", undefined, auth)),
    due: (id: string) => run(auth => request<VocabularyDue>(`${root(id)}/due`, "GET", undefined, auth)),
    start: (id: string, state: string, key: string) => mutate(`${root(id)}/items/${encodeURIComponent(state)}/start`, undefined, key),
    answer: (id: string, review: string, response: string, key: string) => mutate(`${root(id)}/reviews/${encodeURIComponent(review)}/answer`, { response }, key),
    rate: (id: string, review: string, rating: RecallRating, key: string) => mutate(`${root(id)}/reviews/${encodeURIComponent(review)}/rating`, { rating }, key),
  };
}
export type VocabularyAccess = ReturnType<typeof vocabularyAccess>;
