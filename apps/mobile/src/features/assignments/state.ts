import type { AssignmentInput, AssignmentItem } from "../../services/api/assignments";
export function draftError(body: AssignmentInput, items: AssignmentItem[]): string | null {
  if (!body.title.trim() || Array.from(body.title.trim()).length > 200) return "Enter a title of 1–200 characters.";
  if (Array.from(body.instructions?.trim() ?? "").length > 8000) return "Keep instructions within 8,000 characters.";
  if (!body.lesson_id) return "Choose a published lesson.";
  if (items.length > 200 || new Set(items.map(row => row.question_id)).size !== items.length) return "Use at most 200 distinct questions.";
  if (items.some(row => !row.eligible || row.definition.lesson_id !== body.lesson_id)) return "Remove or replace ineligible items before saving.";
  return null;
}
export function addItem(items: AssignmentItem[], row: AssignmentItem): AssignmentItem[] {
  return items.length < 200 && row.eligible && !items.some(item => item.question_id === row.question_id) ? [...items, row] : items;
}
export function moveItem(items: AssignmentItem[], index: number, delta: number): AssignmentItem[] {
  const target = index + delta;
  if (!Number.isInteger(index) || index < 0 || target < 0 || target >= items.length || index >= items.length) return items;
  const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export class DraftSubmission {
  busy = false;
  pending: { body: AssignmentInput; key: string } | null = null;
  async create(body: AssignmentInput, issue: (body: AssignmentInput, key: string) => Promise<unknown>, key: () => string) {
    if (this.busy) throw new Error("Please wait for the current save.");
    if (this.pending && JSON.stringify(body) !== JSON.stringify(this.pending.body)) throw new Error("Retry the original save or inspect drafts before starting another.");
    this.pending ??= { body: { ...body, question_revision_ids: [...body.question_revision_ids] }, key: key() };
    this.busy = true;
    try { const result = await issue(this.pending.body, this.pending.key); this.pending = null; return result; }
    catch (error) { const status = (error as { status?: number }).status; if (status && status >= 400 && status < 500 && status !== 408) this.pending = null; throw error; }
    finally { this.busy = false; }
  }
}
