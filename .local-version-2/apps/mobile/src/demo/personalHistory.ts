import type { HistoryRequest, PersonalActivity, PersonalHistoryAccess } from "../services/api/personalHistory";

/** Empty by default: only actual actions in this explicitly synthetic demo create receipts. */
export function createDemoPersonalHistory(): PersonalHistoryAccess {
  const events = new Map<string, PersonalActivity>();
  const signatures = new Map<string, string>();
  return {
    async record(body: HistoryRequest) {
      const existing = events.get(body.event_key);
      const signature = JSON.stringify([body.kind, body.source_id, body.content_version ?? null, body.title, body.prompt ?? null, body.language]);
      if (existing) {
        if (signatures.get(body.event_key) !== signature) throw new Error("This history request was already used for another activity.");
        return { ...existing };
      }
      const row: PersonalActivity = { ...body, id: body.event_key, recorded_at: new Date().toISOString(), evidence: "client-reported-activity-v1" };
      events.set(body.event_key, row); signatures.set(body.event_key, signature); return { ...row };
    },
    async list(area = "all", offset = 0) {
      const items = [...events.values()].filter(row => area === "all" || row.kind.startsWith(area + "_")).reverse();
      return { items: items.slice(offset, offset + 20).map(row => ({ ...row })), offset, has_more: items.length > offset + 20 };
    },
  };
}
