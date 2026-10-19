import { request, ApiError } from "./client.ts";
import type { AssignmentPage, LessonContext } from "./assignments.ts";
import type { ProgressClass, ProgressSummary, HistoryItem, SubmissionStatus } from "./progress.ts";
export type Counts = NonNullable<ProgressSummary["counts"]>;
export type ResultCounts = { awaiting_evaluation: number; awaiting_manual_review: number; withheld: number; released: number; not_applicable: number };
export type MonitoringFilters = { q?: string; lesson_id?: string; curriculum_version_id?: string; status?: "all" | SubmissionStatus };
export type Overview = { classroom: ProgressClass; as_of: string; available_assignments: number; eligible_students: number; counts: Counts; results: ResultCounts; progress_policy: "submission-counts-v1" };
export type MonitoredStudent = { id: string; username: string; counts: Counts; results: ResultCounts };
export type AssignmentMean = { status: "available" | "unavailable" | "not_comparable"; eligible_results: number; mean_points: string | null; max_points: string | null; engine_version: string | null; policy_version: string | null; mean_policy: "released-assignment-mean-v1" };
export type MonitoredAssignment = { id: string; version_id: string; title: string; context: LessonContext; published_at: string; counts: Counts; results: ResultCounts; mean: AssignmentMean };
export type StudentDetail = AssignmentPage<HistoryItem> & { summary: MonitoredStudent; overview: Overview };
export type StudentOutcome = { id: string; username: string; submission_status: SubmissionStatus; result_state: HistoryItem["result_state"]; attempt_id: string | null; submitted_at: string | null; released_run_id: string | null; earned_points: string | null; possible_points: string | null };
export type AssignmentDetail = AssignmentPage<StudentOutcome> & { summary: MonitoredAssignment; overview: Overview };
export type ContextOption = { id: string; label: string };
const natural = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const invalid = (): never => { throw new ApiError(0, "Unexpected monitoring data. Refresh to verify class activity."); };
export function validateCounts(c: Counts) { if (!c || !Object.values(c).every(natural) || c.available !== c.not_started + c.in_progress + c.submitted || c.pending !== c.not_started + c.in_progress) invalid(); }
export function validateOverview(row: Overview) { validateCounts(row?.counts); if (row.progress_policy !== "submission-counts-v1" || !natural(row.eligible_students) || !natural(row.available_assignments) || row.counts.available !== row.eligible_students * row.available_assignments || !row.classroom?.id) invalid(); return row; }
function validatePage<T>(page: AssignmentPage<T>): AssignmentPage<T> { if (!page || !Array.isArray(page.items) || !natural(page.offset) || !natural(page.limit) || page.limit < 1 || page.limit > 100 || page.items.length > page.limit || typeof page.has_more !== "boolean") invalid(); return page; }
export function validateMean(mean: AssignmentMean) {
  if (!mean || mean.mean_policy !== "released-assignment-mean-v1" || !natural(mean.eligible_results) || !["available", "unavailable", "not_comparable"].includes(mean.status)) invalid();
  if (mean.status === "available" ? !mean.eligible_results || !/^\d+\.\d{2}$/.test(mean.mean_points ?? "") || !/^\d+\.\d{2}$/.test(mean.max_points ?? "") || !mean.engine_version || !mean.policy_version : mean.mean_points !== null || mean.max_points !== null) invalid();
  return mean;
}
function query(filters: MonitoringFilters, offset = 0, kind?: string) { const params = new URLSearchParams({ offset: String(offset) }); for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value); if (kind) params.set("kind", kind); return params; }
const base = (classId: string) => `/classes/${encodeURIComponent(classId)}/monitoring`;
export const monitoringApi = {
  classes: async (secret: string, q = "", offset = 0) => validatePage(await request<AssignmentPage<ProgressClass>>(`/instructor/monitoring/classes?${query({ q }, offset)}`, "GET", undefined, secret)),
  overview: async (secret: string, id: string, filters: MonitoringFilters = {}) => validateOverview(await request<Overview>(`${base(id)}?${query(filters)}`, "GET", undefined, secret)),
  contexts: async (secret: string, id: string, kind: "lesson" | "edition", offset = 0) => validatePage(await request<AssignmentPage<ContextOption>>(`${base(id)}/contexts?${query({}, offset, kind)}`, "GET", undefined, secret)),
  students: async (secret: string, id: string, filters: MonitoringFilters, offset = 0) => validatePage(await request<AssignmentPage<MonitoredStudent>>(`${base(id)}/students?${query(filters, offset)}`, "GET", undefined, secret)),
  assignments: async (secret: string, id: string, filters: MonitoringFilters, offset = 0) => { const page = validatePage(await request<AssignmentPage<MonitoredAssignment>>(`${base(id)}/assignments?${query(filters, offset)}`, "GET", undefined, secret)); page.items.forEach(row => validateMean(row.mean)); return page; },
  student: async (secret: string, id: string, studentId: string, filters: MonitoringFilters, offset = 0) => { const page = await request<StudentDetail>(`${base(id)}/students/${encodeURIComponent(studentId)}?${query(filters, offset)}`, "GET", undefined, secret); validatePage(page); validateOverview(page.overview); return page; },
  assignment: async (secret: string, id: string, assignmentId: string, filters: MonitoringFilters, offset = 0) => { const page = await request<AssignmentDetail>(`${base(id)}/assignments/${encodeURIComponent(assignmentId)}?${query(filters, offset)}`, "GET", undefined, secret); validatePage(page); validateOverview(page.overview); validateMean(page.summary.mean); return page; },
};
export function monitoringAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return {
    classes: (q = "", offset = 0) => run(s => monitoringApi.classes(s, q, offset)),
    overview: (id: string, filters: MonitoringFilters = {}) => run(s => monitoringApi.overview(s, id, filters)),
    contexts: (id: string, kind: "lesson" | "edition", offset = 0) => run(s => monitoringApi.contexts(s, id, kind, offset)),
    students: (id: string, filters: MonitoringFilters, offset = 0) => run(s => monitoringApi.students(s, id, filters, offset)),
    assignments: (id: string, filters: MonitoringFilters, offset = 0) => run(s => monitoringApi.assignments(s, id, filters, offset)),
    student: (id: string, studentId: string, filters: MonitoringFilters, offset = 0) => run(s => monitoringApi.student(s, id, studentId, filters, offset)),
    assignment: (id: string, assignmentId: string, filters: MonitoringFilters, offset = 0) => run(s => monitoringApi.assignment(s, id, assignmentId, filters, offset)),
  };
}
export type MonitoringAccess = ReturnType<typeof monitoringAccess>;
