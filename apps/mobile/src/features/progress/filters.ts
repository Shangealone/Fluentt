import type { HistoryFilters, SubmissionStatus } from "../../services/api/progress";
function localDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use dates in YYYY-MM-DD format.");
  const [year, month, day] = value.split("-").map(Number), date = new Date(0);
  date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Enter a valid calendar date.");
  return date;
}
export function historyFilters(classId: string | undefined, status: "all" | SubmissionStatus, from: string, through: string): HistoryFilters {
  const start = from ? localDate(from) : null, end = through ? localDate(through) : null;
  if (start && end && start > end) throw new Error("The start date must be on or before the end date.");
  // Inclusive local calendar end -> exclusive next local midnight, including DST changes.
  if (end) end.setDate(end.getDate() + 1);
  return { ...(classId ? { class_id: classId } : {}), status, ...(start ? { since: start.toISOString() } : {}), ...(end ? { before: end.toISOString() } : {}) };
}
