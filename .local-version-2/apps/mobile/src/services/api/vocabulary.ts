import { ApiError, request, type AuthContext } from "./client";
export type VocabularyStudy = { id: string; title: string; status: string };
export type VocabularyDue = { title: string; items: { id: string; due_at: string }[] };
export type VocabularyReview = {
  id: string; phase: "answer" | "rating" | "finished";
  question: { vocabulary_item_id: string; content_version: number; format: "multiple_choice" | "typed_recall"; prompt: string; options: { id: string; text: string }[] };
  feedback?: { response: string; correct: boolean; answer: string }; due_at?: string;
};
export type RecallRating = "again" | "hard" | "good" | "easy";
export type ParallelTask = { id: string; kind: "assessment" | "activity"; title: string; status: string };
export type ParallelStudy = { id: string; title: string; status: string };
export type ParallelAttempt = { id: string; status: "draft" | "completed"; revision: number; development_only: true;
  responses?: Record<string, string>; ratings?: Record<string, RecallRating>;
  cards?: { response_id: string; format: "multiple_choice" | "typed_recall"; prompt: string; options: { id: string; text: string }[] }[];
  result?: { points: number; maximum: number; scheduler: string | null }; submitted_at?: string };
export type ParallelSnapshot = { responses: Record<string, string>; ratings: Record<string, RecallRating>; expected_revision: number; request_id: string };
export type ParallelMonitor = { development_only: true; participants: { participant_code: string; status: string; tasks: { id: string; title: string; status: string }[] }[]; fifakt_path: string };
const parallelRoot = (id: string) => `/me/parallel-test/studies/${encodeURIComponent(id)}`;
function development<T extends { development_only?: boolean }>(value: T): T {
  if (!value || value.development_only !== true) throw new ApiError(0, "This is not a verified development-study response.");
  return value;
}
function parallelAttempt(value: ParallelAttempt) {
  development(value);
  if (!value.id || !["draft", "completed"].includes(value.status) || !Number.isInteger(value.revision) || value.revision < 1
      || (value.status === "completed" && (!value.result || !Number.isInteger(value.result.points)
        || !Number.isInteger(value.result.maximum) || value.result.maximum < 1 || value.result.points < 0
        || value.result.points > value.result.maximum || !Number.isFinite(Date.parse(value.submitted_at ?? ""))))
      || (value.status === "draft" && (!Array.isArray(value.cards) || value.cards.some(card =>
        !card.response_id || !["multiple_choice", "typed_recall"].includes(card.format) || typeof card.prompt !== "string"
        || ["correct_option_id", "accepted_forms", "answer_key", "term", "meaning"].some(key => key in card)))))
    throw new ApiError(0, "Study attempt could not be verified. Reload it before continuing.");
  return value;
}
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
    parallelStudies: (instructor = false) => run(async auth => {
      try {
        return development(await request<{ items: ParallelStudy[]; development_only: true }>(instructor ? "/instructor/parallel-test/studies" : "/me/parallel-test/studies", "GET", undefined, auth));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return { items: [] as ParallelStudy[], development_only: false };
        throw error;
      }
    }),
    parallelDirectory: (id: string) => run(async auth => development(await request<{ status: string; tasks: ParallelTask[]; development_only: true }>(parallelRoot(id), "GET", undefined, auth))),
    parallelStart: (id: string, task: ParallelTask) => run(async auth => parallelAttempt(await request<ParallelAttempt>(`${parallelRoot(id)}/${task.kind}/${encodeURIComponent(task.id)}/start`, "POST", undefined, auth))),
    parallelAttempt: (id: string, attempt: string) => run(async auth => parallelAttempt(await request<ParallelAttempt>(`${parallelRoot(id)}/attempts/${encodeURIComponent(attempt)}`, "GET", undefined, auth))),
    parallelWrite: (id: string, attempt: string, action: "save" | "submit", body: ParallelSnapshot) => run(async auth => parallelAttempt(await request<ParallelAttempt>(`${parallelRoot(id)}/attempts/${encodeURIComponent(attempt)}/${action}`, "POST", body, auth))),
    parallelWithdraw: (id: string) => run(async auth => development(await request<{ status: string; development_only: true }>(`${parallelRoot(id)}/withdraw`, "POST", undefined, auth))),
    parallelMonitor: (id: string) => run(async auth => development(await request<ParallelMonitor>(`/instructor/parallel-test/${encodeURIComponent(id)}`, "GET", undefined, auth))),
    parallelPublish: (id: string) => run(async auth => development(await request<{ development_only: true }>(`/instructor/parallel-test/${encodeURIComponent(id)}/publish`, "POST", undefined, auth))),
    parallelStatus: () => run(async auth => {
      const value = await request<{ status: string; participation_enabled: boolean }>("/me/parallel-study/status", "GET", undefined, auth);
      if (value.status !== "inactive" || value.participation_enabled !== false) throw new ApiError(0, "Study availability could not be confirmed.");
      return value;
    }),
    studies: () => run(auth => request<{ items: VocabularyStudy[] }>("/me/vocabulary/studies", "GET", undefined, auth)),
    due: (id: string) => run(auth => request<VocabularyDue>(`${root(id)}/due`, "GET", undefined, auth)),
    start: (id: string, state: string, key: string) => mutate(`${root(id)}/items/${encodeURIComponent(state)}/start`, undefined, key),
    answer: (id: string, review: string, response: string, key: string) => mutate(`${root(id)}/reviews/${encodeURIComponent(review)}/answer`, { response }, key),
    rate: (id: string, review: string, rating: RecallRating, key: string) => mutate(`${root(id)}/reviews/${encodeURIComponent(review)}/rating`, { rating }, key),
  };
}
export type VocabularyAccess = ReturnType<typeof vocabularyAccess>;
