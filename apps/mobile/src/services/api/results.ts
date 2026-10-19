import { request, ApiError } from "./client.ts";
import { validateItem, type AssignmentItem, type AssignmentPage } from "./assignments.ts";
export type Evaluation = { id: string; status: "COMPLETE" | "REVIEW_REQUIRED" | "NOT_APPLICABLE"; engine_version: string; policy_version: string; evaluated_at: string };
export type ReviewItem = { result_id: string; assignment_question_id: string; question_revision_id: string; response_id: string | null;
  position: number; question: AssignmentItem; answer: Record<string, unknown> | null; state: "AUTO_GRADABLE" | "MANUAL_REVIEW_REQUIRED" | "NOT_APPLICABLE" | "UNSUPPORTED";
  correct: boolean | null; awarded_points: string | null; max_points: string | null };
export type AssessmentResult = { assignment_id: string; class_id: string; version_id: string; title: string; attempt_id: string | null;
  student_id: string | null; student_username: string | null; submitted_at: string | null; submission_status: "not_started" | "in_progress" | "submitted";
  state: "not_submitted" | "submitted" | "awaiting_manual_review" | "withheld" | "released" | "not_applicable"; released: boolean;
  revision: string; pinned_run_id: string | null; evaluation: Evaluation | null; earned_points: string | null; possible_points: string | null; items: ReviewItem[] };
export type Submission = { attempt_id: string; student_id: string; student_username: string; submitted_at: string };
const points = (value: unknown) => value === null || (typeof value === "string" && /^\d+\.\d{2}$/.test(value));
export function validateResult(row: AssessmentResult, instructor = false): AssessmentResult {
  if (!row || typeof row.assignment_id !== "string" || typeof row.class_id !== "string" || typeof row.version_id !== "string"
    || typeof row.title !== "string" || !/^[a-f0-9]{64}$/.test(row.revision) || typeof row.released !== "boolean"
    || !["not_submitted", "submitted", "awaiting_manual_review", "withheld", "released", "not_applicable"].includes(row.state)
    || !Array.isArray(row.items) || !points(row.earned_points) || !points(row.possible_points)
    || (row.released && (row.state !== "released" || row.evaluation?.status !== "COMPLETE" || !row.pinned_run_id || row.earned_points === null || row.possible_points === null))
    || (!instructor && !row.released && (row.items.length > 0 || row.earned_points !== null || row.possible_points !== null)))
    throw new ApiError(0, "Unexpected result data. Refresh to verify access.");
  row.items.forEach(item => {
    validateItem(item.question);
    if (item.question_revision_id !== item.question.id || typeof item.result_id !== "string" || typeof item.assignment_question_id !== "string"
      || !Number.isInteger(item.position) || item.position < 1 || !points(item.awarded_points) || !points(item.max_points)
      || (item.answer !== null && (typeof item.answer !== "object" || Array.isArray(item.answer)))) throw new ApiError(0, "Unexpected review data.");
  });
  return row;
}
const assignment = (id: string) => `/assignments/${encodeURIComponent(id)}`;
const attempt = (id: string) => `/assignments/results/${encodeURIComponent(id)}`;
export const resultsApi = {
  student: async (secret: string, id: string) => validateResult(await request<AssessmentResult>(`${assignment(id)}/result`, "GET", undefined, secret)),
  submissions: (secret: string, id: string, offset = 0) => request<AssignmentPage<Submission>>(`${assignment(id)}/results?offset=${offset}`, "GET", undefined, secret),
  owner: async (secret: string, id: string, run?: string) => validateResult(await request<AssessmentResult>(`${attempt(id)}${run ? `?run_id=${encodeURIComponent(run)}` : ""}`, "GET", undefined, secret), true),
  evaluations: (secret: string, id: string, offset = 0) => request<AssignmentPage<Evaluation>>(`${attempt(id)}/evaluations?offset=${offset}`, "GET", undefined, secret),
  release: async (secret: string, row: AssessmentResult, released: boolean, key: string) => {
    if (!row.attempt_id || !row.evaluation) throw new ApiError(0, "Choose an evaluated submission first.");
    return validateResult(await request<AssessmentResult>(`${attempt(row.attempt_id)}/release`, "POST",
      { run_id: row.evaluation.id, released, confirm: true }, secret, { "If-Match": row.revision, "Idempotency-Key": key }), true);
  },
};
export function resultsAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return { student: (id: string) => run(s => resultsApi.student(s, id)),
    submissions: (id: string, offset = 0) => run(s => resultsApi.submissions(s, id, offset)),
    owner: (id: string, selected?: string) => run(s => resultsApi.owner(s, id, selected)),
    evaluations: (id: string, offset = 0) => run(s => resultsApi.evaluations(s, id, offset)),
    release: (row: AssessmentResult, released: boolean, key: string) => run(s => resultsApi.release(s, row, released, key)) };
}
export type ResultsAccess = ReturnType<typeof resultsAccess>;
