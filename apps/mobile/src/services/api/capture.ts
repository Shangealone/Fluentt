import { request, ApiError } from "./client.ts";
import { validateItem, type AssignmentItem } from "./assignments.ts";
export type CaptureItem = AssignmentItem & { assignment_question_id: string };
export type CapturedResponse = { assignment_question_id: string; answer: Record<string, unknown> };
export type Progress = { position: number; responses: CapturedResponse[] };
export type Attempt = { id: string; assignment_id: string; class_id: string; version_id: string; title: string; instructions: string | null;
  status: "in_progress" | "submitted"; revision: string; started_at: string; submitted_at: string | null;
  position: number; question_count: number; completed_count: number; questions: CaptureItem[]; responses: CapturedResponse[]; revealed_item_ids: string[] };
export type RevealedBack = { revision_id: string; back: string; attempt_revision: string };
export function validateAttempt(row: Attempt): Attempt {
  if (!row || typeof row.id !== "string" || typeof row.assignment_id !== "string" || typeof row.class_id !== "string"
    || !["in_progress", "submitted"].includes(row.status) || !/^[a-f0-9]{64}$/.test(row.revision)
    || !Array.isArray(row.questions) || !Array.isArray(row.responses) || !Array.isArray(row.revealed_item_ids)
    || !Number.isInteger(row.position) || row.position < 1 || !Number.isInteger(row.question_count) || row.question_count < 1 || row.position > row.question_count
    || (row.status === "in_progress" && row.questions.length !== row.question_count)
    || !Number.isInteger(row.completed_count) || row.completed_count < 0 || row.completed_count > row.question_count
    || (row.status === "submitted" && (row.questions.length > 0 || row.responses.length > 0 || !row.submitted_at))) throw new ApiError(0, "Unexpected attempt data. Reload saved progress.");
  row.questions.forEach(item => { validateItem(item); if (typeof item.assignment_question_id !== "string") throw new ApiError(0, "Invalid question reference."); });
  return row;
}
const path = (id: string) => `/assignments/attempts/${encodeURIComponent(id)}`;
export const captureApi = {
  start: async (secret: string, id: string) => validateAttempt(await request<Attempt>(`/assignments/${encodeURIComponent(id)}/attempt`, "POST", undefined, secret)),
  read: async (secret: string, id: string) => validateAttempt(await request<Attempt>(path(id), "GET", undefined, secret)),
  save: async (secret: string, row: Attempt, body: Progress) => validateAttempt(await request<Attempt>(`${path(row.id)}/progress`, "PUT", body, secret, { "If-Match": row.revision })),
  submit: async (secret: string, row: Attempt, body: Progress, key: string) => validateAttempt(await request<Attempt>(`${path(row.id)}/submit`, "POST", { ...body, confirm: true }, secret, { "If-Match": row.revision, "Idempotency-Key": key })),
  reveal: async (secret: string, row: Attempt, item: CaptureItem) => {
    const back = await request<RevealedBack>(`${path(row.id)}/questions/${encodeURIComponent(item.assignment_question_id)}/reveal`, "POST", undefined, secret, { "If-Match": row.revision });
    if (!back || back.revision_id !== item.id || typeof back.back !== "string" || !/^[a-f0-9]{64}$/.test(back.attempt_revision)) throw new ApiError(0, "Invalid card version. Reload saved progress.");
    return back;
  },
};
export function captureAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return { start: (id: string) => run(s => captureApi.start(s, id)), read: (id: string) => run(s => captureApi.read(s, id)),
    save: (row: Attempt, body: Progress) => run(s => captureApi.save(s, row, body)),
    submit: (row: Attempt, body: Progress, key: string) => run(s => captureApi.submit(s, row, body, key)),
    reveal: (row: Attempt, item: CaptureItem) => run(s => captureApi.reveal(s, row, item)) };
}
export type CaptureAccess = ReturnType<typeof captureAccess>;
