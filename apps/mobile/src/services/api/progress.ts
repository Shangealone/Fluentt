import { request, ApiError } from "./client.ts";
import type { AssignmentPage, LessonContext } from "./assignments.ts";
export type SubmissionStatus = "not_started" | "in_progress" | "submitted";
export type HistoryFilters = { class_id?: string; status?: "all" | SubmissionStatus; since?: string; before?: string };
export type ProgressSummary = { availability: "available" | "unavailable"; as_of: string; class_id: string | null; class_name: string | null;
  class_count: number | null; counts: { available: number; not_started: number; in_progress: number; submitted: number; pending: number } | null; policy_version: "submission-counts-v1" };
export type ProgressClass = { id: string; class_name: string; grade: number; language: "english" | "tagalog" };
export type HistoryItem = { id: string; version_id: string; class_id: string; class_name: string; language: "english" | "tagalog"; title: string;
  context: LessonContext; submission_status: SubmissionStatus; result_state: "not_submitted" | "submitted" | "awaiting_manual_review" | "withheld" | "released" | "not_applicable";
  attempt_id: string | null; published_at: string; started_at: string | null; last_activity_at: string | null; submitted_at: string | null; sort_at: string;
  released_run_id: string | null; policy_version: string | null; earned_points: string | null; possible_points: string | null };
export type LearningHistory = AssignmentPage<HistoryItem> & { availability: "available" | "unavailable"; as_of: string };
function invalid(): never { throw new ApiError(0, "Unexpected progress data. Refresh to verify your activity."); }
const natural = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const decimal = (value: unknown) => typeof value === "string" && /^\d+\.\d{2}$/.test(value);
export function validateSummary(row: ProgressSummary): ProgressSummary {
  if (!row || !["available", "unavailable"].includes(row.availability) || row.policy_version !== "submission-counts-v1" || !date(row.as_of)) invalid();
  if (row.availability === "unavailable") { if (row.counts !== null || row.class_count !== null) invalid(); return row; }
  const c = row.counts;
  if (!natural(row.class_count) || !c || ![c.available, c.not_started, c.in_progress, c.submitted, c.pending].every(natural)
    || c.available !== c.not_started + c.in_progress + c.submitted || c.pending !== c.not_started + c.in_progress) invalid();
  return row;
}
export function validateHistory(page: LearningHistory): LearningHistory {
  if (!page || !["available", "unavailable"].includes(page.availability) || !date(page.as_of) || !Array.isArray(page.items)
    || !natural(page.offset) || !natural(page.limit) || page.limit < 1 || page.limit > 100 || typeof page.has_more !== "boolean"
    || page.items.length > page.limit || (page.availability === "unavailable" && (page.items.length > 0 || page.has_more))) invalid();
  const ids = new Set<string>();
  for (const row of page.items) {
    if (!row || typeof row.id !== "string" || ids.has(row.id) || typeof row.version_id !== "string" || typeof row.class_id !== "string"
      || typeof row.title !== "string" || typeof row.class_name !== "string" || !["english", "tagalog"].includes(row.language)
      || !row.context || typeof row.context.lesson_id !== "string" || typeof row.context.lesson_name !== "string" || typeof row.context.curriculum_version_id !== "string"
      || !["not_started", "in_progress", "submitted"].includes(row.submission_status)
      || !["not_submitted", "submitted", "awaiting_manual_review", "withheld", "released", "not_applicable"].includes(row.result_state)
      || !date(row.sort_at) || !date(row.published_at) || [row.started_at, row.last_activity_at, row.submitted_at].some(value => value !== null && !date(value))
      || (row.result_state === "released" ? row.submission_status !== "submitted" || !row.released_run_id || !row.policy_version || !decimal(row.earned_points) || !decimal(row.possible_points)
        : row.earned_points !== null || row.possible_points !== null || row.released_run_id !== null || row.policy_version !== null)
      || "answer_key" in row || "answers" in row || "items" in row) invalid();
    ids.add(row.id);
  }
  return page;
}
const params = (filters: HistoryFilters) => {
  const query = new URLSearchParams();
  for (const key of ["class_id", "status", "since", "before"] as const) if (filters[key]) query.set(key, filters[key]!);
  return query;
};
export const progressApi = {
  summary: async (secret: string, classId?: string) => validateSummary(await request<ProgressSummary>(`/me/progress${classId ? `?class_id=${encodeURIComponent(classId)}` : ""}`, "GET", undefined, secret)),
  classes: async (secret: string, offset = 0) => {
    const page = await request<AssignmentPage<ProgressClass>>(`/me/progress/classes?offset=${offset}`, "GET", undefined, secret);
    if (!page || !Array.isArray(page.items) || typeof page.has_more !== "boolean" || !natural(page.offset) || page.items.some(row => typeof row.id !== "string" || typeof row.class_name !== "string" || !natural(row.grade) || row.grade < 1 || row.grade > 12 || !["english", "tagalog"].includes(row.language))) invalid();
    return page;
  },
  history: async (secret: string, filters: HistoryFilters, offset = 0) => {
    const query = params(filters); query.set("offset", String(offset));
    return validateHistory(await request<LearningHistory>(`/me/learning-history?${query}`, "GET", undefined, secret));
  },
};
export function progressAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return { summary: (classId?: string) => run(s => progressApi.summary(s, classId)), classes: (offset = 0) => run(s => progressApi.classes(s, offset)),
    history: (filters: HistoryFilters, offset = 0) => run(s => progressApi.history(s, filters, offset)) };
}
export type ProgressAccess = ReturnType<typeof progressAccess>;
