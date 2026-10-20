import { request, ApiError } from "./client.ts";
import { validateItem, type AssignmentItem } from "./assignments.ts";

export const difficulties = ["easy", "medium", "hard"] as const;
export type Difficulty = typeof difficulties[number];
export type PracticeLesson = { id: string; title: string; topic: string; difficulties: Difficulty[] };
export type PracticeQuestion = AssignmentItem & { definition: AssignmentItem["definition"] & { difficulty: Difficulty } };
export type PracticePage<T> = { items: T[]; has_more: boolean; offset: number };
export type PracticeBack = { revision_id: string; back: string };
export type PracticeAccess = {
  lessons: (q?: string, difficulty?: Difficulty, offset?: number) => Promise<PracticePage<PracticeLesson>>;
  questions: (lessonId: string, difficulty?: Difficulty, offset?: number) => Promise<PracticePage<PracticeQuestion>>;
  reveal: (revisionId: string) => Promise<PracticeBack>;
};
function invalid(): never { throw new ApiError(0, "Practice content could not be verified. Please retry."); }
export function validatePracticePage<T>(value: PracticePage<T>, validate: (row: T) => T): PracticePage<T> {
  if (!value || !Array.isArray(value.items) || value.items.length > 20 || typeof value.has_more !== "boolean" || !Number.isInteger(value.offset) || value.offset < 0) invalid();
  return { items: value.items.map(validate), has_more: value.has_more, offset: value.offset };
}
export function validatePracticeLesson(row: PracticeLesson): PracticeLesson {
  if (!row || typeof row.id !== "string" || typeof row.title !== "string" || typeof row.topic !== "string" || !Array.isArray(row.difficulties)
    || row.difficulties.some(level => !difficulties.includes(level)) || "grade" in row) invalid();
  return row;
}
export function validatePracticeQuestion(row: PracticeQuestion): PracticeQuestion {
  validateItem(row);
  if (!row.eligible || !difficulties.includes(row.definition.difficulty) || "answer_key" in row || "back" in row) invalid();
  return row;
}
export function practiceAccess(run: <T>(operation: (credential: string) => Promise<T>) => Promise<T>): PracticeAccess {
  const query = (difficulty?: Difficulty, offset = 0, q?: string) => new URLSearchParams({ offset: String(offset), ...(difficulty ? { difficulty } : {}), ...(q ? { q } : {}) });
  return {
    lessons: (q = "", difficulty, offset = 0) => run(async secret => validatePracticePage(await request<PracticePage<PracticeLesson>>(`/me/practice/lessons?${query(difficulty, offset, q)}`, "GET", undefined, secret), validatePracticeLesson)),
    questions: (id, difficulty, offset = 0) => run(async secret => validatePracticePage(await request<PracticePage<PracticeQuestion>>(`/me/practice/lessons/${encodeURIComponent(id)}/questions?${query(difficulty, offset)}`, "GET", undefined, secret), validatePracticeQuestion)),
    reveal: id => run(async secret => {
      const row = await request<PracticeBack>(`/me/practice/flashcards/${encodeURIComponent(id)}/reveal`, "POST", undefined, secret);
      if (!row || row.revision_id !== id || typeof row.back !== "string" || "configuration" in row || "explanation" in row) invalid();
      return { revision_id: row.revision_id, back: row.back };
    }),
  };
}
