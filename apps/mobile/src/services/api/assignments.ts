import { request, ApiError } from "./client.ts";
export const assignmentMethods = ["multiple_choice", "true_false", "identification", "fill_in_the_blank", "multiple_select", "flashcards", "error_identification", "word_arrangement", "sentence_arrangement", "matching_type"] as const;
export type AssignmentMethod = typeof assignmentMethods[number];
export type LessonContext = { lesson_id: string; lesson_name: string; curriculum_version_id: string; curriculum_name: string; grade: number; subject_id: string; subject_name: string };
export type AssignmentItem = { id: string; question_id: string; version: number; eligible: boolean;
  definition: { lesson_id: string; method: AssignmentMethod; prompt: string; instructions: string | null; content: Record<string, unknown> } };
export type AssignmentInput = { lesson_id: string; title: string; instructions: string | null; question_revision_ids: string[] };
export type AssignmentDraft = { id: string; class_id: string; version_id: string; revision: string; status: "draft" | "archived" | "published";
  title: string; instructions: string | null; context: LessonContext; questions: AssignmentItem[]; eligible: boolean; editable: boolean; requires_subject: boolean };
export type AssignmentPage<T> = { items: T[]; has_more: boolean; offset: number; limit: number };
export type AssignmentSummary = Pick<AssignmentDraft, "id" | "class_id" | "title" | "status" | "context"> & { question_count: number };
export type PublishedAssignment = Pick<AssignmentDraft, "id" | "class_id" | "version_id" | "title" | "instructions" | "context"> & {
  status: "published"; published_at: string; question_count: number; methods: AssignmentMethod[] };
function validatePublished(row: PublishedAssignment): PublishedAssignment {
  if (!row || row.status !== "published" || typeof row.id !== "string" || typeof row.class_id !== "string"
    || typeof row.version_id !== "string" || typeof row.title !== "string" || !row.context || typeof row.context.lesson_name !== "string"
    || typeof row.published_at !== "string" || !Number.isInteger(row.question_count) || row.question_count < 1
    || !Array.isArray(row.methods) || row.methods.length !== row.question_count || row.methods.some(method => !assignmentMethods.includes(method))
    || "questions" in row || "answer_key" in row || "content" in row) invalid();
  return row;
}
function invalid(): never { throw new ApiError(0, "Unexpected assignment response. Reload your drafts before retrying."); }
export function validateItem(value: AssignmentItem): AssignmentItem {
  if (!value || typeof value.id !== "string" || typeof value.question_id !== "string" || !Number.isInteger(value.version)
    || typeof value.eligible !== "boolean" || !value.definition || !assignmentMethods.includes(value.definition.method)
    || typeof value.definition.prompt !== "string" || !value.definition.content || typeof value.definition.content !== "object"
    || Array.isArray(value.definition.content) || "answer_key" in value.definition
    || "explanation" in value.definition || "back" in value.definition.content) invalid();
  return value;
}
export function validateAssignment(value: AssignmentDraft): AssignmentDraft {
  if (!value || typeof value.id !== "string" || typeof value.class_id !== "string" || !/^[a-f0-9]{64}$/.test(value.revision)
    || !["draft", "archived", "published"].includes(value.status) || !value.context || typeof value.context.lesson_id !== "string"
    || typeof value.title !== "string" || typeof value.editable !== "boolean" || !Array.isArray(value.questions)) invalid();
  value.questions.forEach(validateItem); return value;
}
function page<T>(value: AssignmentPage<T>, validate: (row: T) => T): AssignmentPage<T> {
  if (!value || !Array.isArray(value.items) || typeof value.has_more !== "boolean" || !Number.isInteger(value.offset)) invalid();
  return { ...value, items: value.items.map(validate) };
}
export const assignmentApi = {
  list: async (secret: string, classId: string, offset = 0) => page(await request<AssignmentPage<AssignmentSummary>>(`/classes/${encodeURIComponent(classId)}/assignments?limit=20&offset=${offset}`, "GET", undefined, secret), row => {
    if (!row || typeof row.id !== "string" || typeof row.title !== "string" || !row.context || !Number.isInteger(row.question_count) || row.question_count < 0) invalid(); return row;
  }),
  get: async (secret: string, id: string) => validateAssignment(await request<AssignmentDraft>(`/assignments/${encodeURIComponent(id)}`, "GET", undefined, secret)),
  lessons: async (secret: string, classId: string, q = "", offset = 0) => page(await request<AssignmentPage<LessonContext>>(`/classes/${encodeURIComponent(classId)}/assignment-lessons?${new URLSearchParams({ q, offset: String(offset), limit: "20" })}`, "GET", undefined, secret), row => {
    if (!row || typeof row.lesson_id !== "string" || typeof row.lesson_name !== "string" || typeof row.subject_name !== "string") invalid(); return row;
  }),
  questions: async (secret: string, classId: string, lessonId: string, q = "", method = "", offset = 0) => page(await request<AssignmentPage<AssignmentItem>>(`/classes/${encodeURIComponent(classId)}/assignment-questions?${new URLSearchParams({ lesson_id: lessonId, q, offset: String(offset), limit: "20", ...(method ? { method } : {}) })}`, "GET", undefined, secret), validateItem),
  create: async (secret: string, classId: string, body: AssignmentInput, key: string) => validateAssignment(await request<AssignmentDraft>(`/classes/${encodeURIComponent(classId)}/assignments`, "POST", body, secret, { "Idempotency-Key": key })),
  save: async (secret: string, row: AssignmentDraft, body: AssignmentInput) => validateAssignment(await request<AssignmentDraft>(`/assignments/${encodeURIComponent(row.id)}`, "PATCH", body, secret, { "If-Match": row.revision })),
  archive: async (secret: string, row: AssignmentDraft) => validateAssignment(await request<AssignmentDraft>(`/assignments/${encodeURIComponent(row.id)}/archive`, "POST", undefined, secret, { "If-Match": row.revision })),
  publish: async (secret: string, row: AssignmentDraft, key: string) => validateAssignment(await request<AssignmentDraft>(`/assignments/${encodeURIComponent(row.id)}/publish`, "POST", { confirm: true, bind_subject_id: row.requires_subject ? row.context.subject_id : null }, secret, { "If-Match": row.revision, "Idempotency-Key": key })),
  published: async (secret: string, classId: string, offset = 0) => page(await request<AssignmentPage<PublishedAssignment>>(`/classes/${encodeURIComponent(classId)}/published-assignments?limit=20&offset=${offset}`, "GET", undefined, secret), validatePublished),
  publishedDetail: async (secret: string, id: string) => validatePublished(await request<PublishedAssignment>(`/assignments/${encodeURIComponent(id)}/published`, "GET", undefined, secret)),
};
export function assignmentAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return { list: (id: string, offset?: number) => run(s => assignmentApi.list(s, id, offset)), get: (id: string) => run(s => assignmentApi.get(s, id)),
    lessons: (id: string, q?: string, offset?: number) => run(s => assignmentApi.lessons(s, id, q, offset)),
    questions: (id: string, lesson: string, q?: string, method?: string, offset?: number) => run(s => assignmentApi.questions(s, id, lesson, q, method, offset)),
    create: (id: string, body: AssignmentInput, key: string) => run(s => assignmentApi.create(s, id, body, key)),
    save: (row: AssignmentDraft, body: AssignmentInput) => run(s => assignmentApi.save(s, row, body)), archive: (row: AssignmentDraft) => run(s => assignmentApi.archive(s, row)),
    publish: (row: AssignmentDraft, key: string) => run(s => assignmentApi.publish(s, row, key)),
    published: (id: string, offset?: number) => run(s => assignmentApi.published(s, id, offset)),
    publishedDetail: (id: string) => run(s => assignmentApi.publishedDetail(s, id)) };
}
export type AssignmentAccess = ReturnType<typeof assignmentAccess>;
