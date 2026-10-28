export const sections = ["users", "classes", "algorithms", "analytics", "pronunciation-analytics", "reports", "audit", "settings"] as const;
export type Section = typeof sections[number];
export type View = "summary" | "users" | "classes" | "classwork" | "algorithms" | "speech" | "audit" | "settings";
export const moduleInfo: Record<Section, { title: string; description: string; permission: string; view: View }> = {
  users: { title: "Users", description: "Inspect school student and instructor accounts. Personal accounts and administrator roles are outside these lifecycle controls.", permission: "users.read", view: "users" },
  classes: { title: "Class oversight", description: "Inspect classrooms and assigned activity metadata. Teaching content remains under its instructor’s ownership.", permission: "classrooms.read", view: "classes" },
  algorithms: { title: "Algorithms", description: "Registered implementations and saved configuration versions. A registered adapter does not establish an executable or validated research treatment.", permission: "algorithms.read", view: "algorithms" },
  analytics: { title: "Learning analytics", description: "Current school participation counts. Research outcomes and personal activity retain their separate data contracts.", permission: "oversight.read", view: "summary" },
  "pronunciation-analytics": { title: "Pronunciation analytics", description: "Classroom attempt provenance. Simulated output is separated from measured acoustic evidence; unavailable scores stay N/A.", permission: "speech.read", view: "speech" },
  reports: { title: "Reports & CSV export", description: "Export authorized operational counts. Research observations and exports remain behind the existing study, consent and instrument gates.", permission: "oversight.read", view: "summary" },
  audit: { title: "Audit logs", description: "Retained administrator authentication, operator-permission and oversight events. Sensitive content and metadata are excluded.", permission: "audit.read", view: "audit" },
  settings: { title: "System settings", description: "Read-only configuration readiness. Secrets and deployment settings are managed on the server, never in browser storage.", permission: "dashboard.view", view: "settings" },
};
export type OversightPage = { view: View; metric_version: "admin-school-oversight-v1"; as_of: string;
  items: Record<string, unknown>[]; offset: number; has_more: boolean; summary: Record<string, unknown> };
export function isOversightPage(value: unknown): value is OversightPage {
  if (!value || typeof value !== "object") return false;
  const v = value as OversightPage;
  return ["summary", "users", "classes", "classwork", "algorithms", "speech", "audit", "settings"].includes(v.view)
    && v.metric_version === "admin-school-oversight-v1" && typeof v.as_of === "string" && Number.isFinite(Date.parse(v.as_of))
    && Array.isArray(v.items) && v.items.length <= 50 && v.items.every(r => !!r && typeof r === "object" && !Array.isArray(r))
    && Number.isSafeInteger(v.offset) && v.offset >= 0 && typeof v.has_more === "boolean"
    && !!v.summary && typeof v.summary === "object" && !Array.isArray(v.summary);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function oversightPath(segments: string[], method: string, query: URLSearchParams): string | null {
  if (method === "POST") return segments.length === 3 && segments[0] === "users" && uuid.test(segments[1]) && segments[2] === "status" && !query.size ? `/oversight/users/${segments[1]}/status` : null;
  if (method !== "GET" || segments.length !== 1) return null;
  if (segments[0] === "summary.csv") return query.size ? null : "/oversight/summary.csv";
  if (!["summary", "users", "classes", "classwork", "algorithms", "speech", "audit", "settings"].includes(segments[0])) return null;
  for (const [key, value] of query) {
    if (query.getAll(key).length !== 1) return null;
    if (key === "q" && value.length <= 100 && ["users", "classes"].includes(segments[0])) continue;
    if (key === "role" && ["", "school_student", "instructor"].includes(value) && segments[0] === "users") continue;
    if (key === "status" && ["", "active", "disabled", "onboarding"].includes(value) && segments[0] === "users") continue;
    if (key === "class_id" && uuid.test(value) && segments[0] === "classwork") continue;
    if (key === "offset" && /^\d{1,6}$/.test(value) && Number(value) <= 100000) continue;
    return null;
  }
  if (segments[0] === "classwork" && !query.has("class_id")) return null;
  return `/oversight/${segments[0]}${query.size ? `?${query}` : ""}`;
}
