import { ApiError, request, type AuthContext } from "./client";
import { isClassProficiency, type ClassProficiency } from "./classProficiency";
export type AssessedEvent = { id: string; level: ClassProficiency | null; assessed_on: string | null; recorded_at: string; recorded_by: string };
export type AssessedView = { student_id: string; username: string; language: "english" | "tagalog"; current: AssessedEvent | null; history: AssessedEvent[]; offset: number; has_more: boolean };
export type AssessedInput = { level: ClassProficiency | null; assessed_on: string | null; expected_event_id: string | null };
function validate(row: AssessedView): AssessedView {
  const event = (value: AssessedEvent) => !!value && typeof value.id === "string" && isClassProficiency(value.level)
    && ((value.level === null) === (value.assessed_on === null))
    && (value.assessed_on === null || /^\d{4}-\d{2}-\d{2}$/.test(value.assessed_on)) && typeof value.recorded_at === "string" && typeof value.recorded_by === "string";
  if (!row || typeof row.student_id !== "string" || typeof row.username !== "string" || !["english", "tagalog"].includes(row.language)
      || !Array.isArray(row.history) || row.history.length > 20 || !row.history.every(event) || (row.current !== null && !event(row.current)) || !Number.isInteger(row.offset) || row.offset < 0 || typeof row.has_more !== "boolean") {
    throw new ApiError(0, "We couldn’t confirm this assessment record. Reload and try again.");
  }
  return row;
}
const path = (classId: string, studentId: string) => `/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/assessed-proficiency`;
export function assessedProficiencyAccess(run: <T>(operation: (secret: AuthContext) => Promise<T>) => Promise<T>) {
  return {
    read: (classId: string, studentId: string, offset = 0) => run(async auth => validate(await request<AssessedView>(`${path(classId, studentId)}?offset=${offset}`, "GET", undefined, auth))),
    record: (classId: string, studentId: string, body: AssessedInput, key: string) => run(async auth => validate(await request<AssessedView>(path(classId, studentId), "POST", body, auth, { "Idempotency-Key": key }))),
    mine: (language: "english" | "tagalog", offset = 0) => run(async auth => validate(await request<AssessedView>(`/me/assessed-proficiency?language=${language}&offset=${offset}`, "GET", undefined, auth))),
  };
}
export type AssessedProficiencyAccess = ReturnType<typeof assessedProficiencyAccess>;
