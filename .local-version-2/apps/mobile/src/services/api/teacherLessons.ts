import { isClassProficiency, isLegacyClassGrade, type ClassProficiency } from "./classProficiency";
import { ApiError, request, type AuthContext } from "./client";
import { assignmentMethods, type AssignmentMethod, type AssignmentPage, type LessonContext } from "./assignments";
export type LessonSection = { heading: string; body: string };
export type TeacherQuestion = { method: AssignmentMethod; prompt: string; instructions: string | null; difficulty: "easy" | "medium" | "hard"; content: Record<string, unknown>; answer_key: Record<string, unknown> };
export type TeacherLessonInput = { title: string; introduction: string | null; grade: number | null; proficiency_level?: ClassProficiency | null; language: "english" | "tagalog"; subject_id: string; sections: LessonSection[]; questions: TeacherQuestion[] };
export type TeacherLessonSummary = { id: string; version_id: string; lesson_id: string; version: number; title: string; introduction: string | null; grade: number | null; proficiency_level?: ClassProficiency | null; language: "english" | "tagalog"; subject_id: string; subject_name: string; revision: string; status: "draft" | "published" | "archived"; published_at: string | null; question_count: number };
export type TeacherLesson = TeacherLessonSummary & { sections: LessonSection[]; questions: TeacherQuestion[]; versions: TeacherLessonSummary[]; shares: { class_id: string; class_name: string; version_id: string }[] };
export type LessonClass = { id: string; name: string; grade: number | null; proficiency_level: ClassProficiency | null; language: string; eligible: boolean; needs_binding: boolean; shared_version_id: string | null; reason: string | null };
export type SharedLesson = { lesson_id: string; class_id: string; title: string; introduction: string | null; context: LessonContext; version: number; published_at: string; instructor: string; sections: LessonSection[] | null };
export type LessonCommand = { action: "save" | "publish" | "new_version" | "archive" | "share" | "unshare"; version_id: string; draft?: TeacherLessonInput; class_ids?: string[]; confirm?: boolean; bind_subject?: boolean };
function invalid(): never { throw new ApiError(0, "We couldn’t confirm this lesson response. Reload and try again."); }
function brief(row: TeacherLessonSummary) {
  if (!row || typeof row.id !== "string" || typeof row.version_id !== "string" || typeof row.lesson_id !== "string" || typeof row.title !== "string" || !Number.isInteger(row.version) || !/^[a-f0-9]{64}$/.test(row.revision) || !["draft", "published", "archived"].includes(row.status)) invalid();
  return row;
}
function detail(row: TeacherLesson) {
  brief(row);
  if (!Array.isArray(row.sections) || !Array.isArray(row.questions) || !Array.isArray(row.versions) || !Array.isArray(row.shares)) invalid();
  row.versions.forEach(brief);
  if (row.questions.some(q => !assignmentMethods.includes(q.method) || typeof q.prompt !== "string" || !q.content || !q.answer_key)) invalid();
  return row;
}
function shared(row: SharedLesson) {
  if (!row || typeof row.lesson_id !== "string" || typeof row.class_id !== "string" || typeof row.title !== "string" || !row.context || row.context.source !== "teacher" || "questions" in row || "answer_key" in row || "versions" in row) invalid();
  if (row.sections !== null && (!Array.isArray(row.sections) || row.sections.some(s => typeof s.heading !== "string" || typeof s.body !== "string"))) invalid();
  return row;
}
function page<T>(row: AssignmentPage<T>, validate: (item: T) => T) { if (!row || !Array.isArray(row.items) || typeof row.has_more !== "boolean" || !Number.isInteger(row.offset)) invalid(); return { ...row, items: row.items.map(validate) }; }
const rootPath = (id: string) => `/instructor/lessons/${encodeURIComponent(id)}`;
export function teacherLessonAccess(run: <T>(operation: (auth: AuthContext) => Promise<T>) => Promise<T>) {
  return {
    list: (classId = "", offset = 0) => run(async auth => page(await request<AssignmentPage<TeacherLessonSummary>>(`/instructor/lessons?offset=${offset}${classId ? `&class_id=${encodeURIComponent(classId)}` : ""}`, "GET", undefined, auth), brief)),
    get: (id: string, versionId?: string) => run(async auth => detail(await request<TeacherLesson>(`${rootPath(id)}${versionId ? `?version_id=${encodeURIComponent(versionId)}` : ""}`, "GET", undefined, auth))),
    subjects: () => run(async auth => { const rows = await request<{ id: string; name: string }[]>("/instructor/lesson-subjects", "GET", undefined, auth); if (!Array.isArray(rows) || rows.some(row => typeof row.id !== "string" || typeof row.name !== "string")) invalid(); return rows; }),
    create: (body: TeacherLessonInput, key: string) => run(async auth => detail(await request<TeacherLesson>("/instructor/lessons", "POST", body, auth, { "Idempotency-Key": key }))),
    change: (row: TeacherLessonSummary, body: LessonCommand, key: string) => run(async auth => detail(await request<TeacherLesson>(`${rootPath(row.id)}/actions`, "POST", body, auth, { "Idempotency-Key": key, "If-Match": row.revision }))),
    classes: (row: TeacherLessonSummary, offset = 0) => run(async auth => page(await request<AssignmentPage<LessonClass>>(`${rootPath(row.id)}/classes?version_id=${encodeURIComponent(row.version_id)}&offset=${offset}`, "GET", undefined, auth), item => { if (!item || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.eligible !== "boolean" || !isLegacyClassGrade(item.grade) || !isClassProficiency(item.proficiency_level)) invalid(); return item; })),
    shared: (classId: string, offset = 0) => run(async auth => page(await request<AssignmentPage<SharedLesson>>(`/classes/${encodeURIComponent(classId)}/teacher-lessons?offset=${offset}`, "GET", undefined, auth), shared)),
    read: (classId: string, lessonId: string) => run(async auth => shared(await request<SharedLesson>(`/classes/${encodeURIComponent(classId)}/teacher-lessons/${encodeURIComponent(lessonId)}`, "GET", undefined, auth))),
  };
}
export type TeacherLessonAccess = ReturnType<typeof teacherLessonAccess>;
