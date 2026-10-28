export const kinds = ["learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"] as const;
export type Counts = Record<(typeof kinds)[number], number>;
export type PerformanceReport = {
  metric_version: "client-reported-activity-v1"; scope: "active-personal-learners";
  as_of: string; window_start: string; days: number; learners: number; learners_with_activity: number;
  counts: Counts; timeline: { date: string; count: number }[];
  items: (Counts & { id: string; username: string; last_activity: string | null })[];
  offset: number; has_more: boolean;
};
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const counts = (v: unknown): v is Counts => !!v && typeof v === "object" && kinds.every(k => count((v as Counts)[k]));
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export function isPerformanceReport(value: unknown): value is PerformanceReport {
  if (!value || typeof value !== "object") return false;
  const v = value as PerformanceReport;
  return v.metric_version === "client-reported-activity-v1" && v.scope === "active-personal-learners"
    && date(v.as_of) && date(v.window_start) && [7, 30, 90].includes(v.days)
    && count(v.learners) && count(v.learners_with_activity) && v.learners_with_activity <= v.learners
    && counts(v.counts) && count(v.offset) && typeof v.has_more === "boolean"
    && Array.isArray(v.items) && v.items.length <= 50 && v.items.every(r => counts(r)
      && typeof r.id === "string" && typeof r.username === "string" && r.username.length <= 32
      && (r.last_activity === null || date(r.last_activity)))
    && Array.isArray(v.timeline) && v.timeline.length <= v.days && v.timeline.every(r => date(r.date) && count(r.count));
}
