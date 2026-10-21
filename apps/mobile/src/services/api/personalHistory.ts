import { ApiError, request } from "./client.ts";

export type HistoryKind = "learn_question" | "learn_lesson" | "voice_phrase" | "tutor_reply" | "tutor_session";
export type HistoryArea = "all" | "learn" | "voice" | "tutor";
export type ActivityInput = { kind: HistoryKind; source_id: string; content_version?: number | null; title: string; prompt?: string | null; language: "english" | "tagalog" };
export type HistoryRequest = ActivityInput & { event_key: string };
export type PersonalActivity = HistoryRequest & { id: string; recorded_at: string; evidence: "client-reported-activity-v1" };
export type PersonalHistoryPage = { items: PersonalActivity[]; offset: number; has_more: boolean };
export type PersonalHistoryAccess = { record: (body: HistoryRequest) => Promise<PersonalActivity>; list: (area?: HistoryArea, offset?: number) => Promise<PersonalHistoryPage> };
const kinds: HistoryKind[] = ["learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"];
export function validatePersonalActivity(row: PersonalActivity) {
  if (!row || typeof row.id !== "string" || typeof row.event_key !== "string" || !kinds.includes(row.kind)
    || !["english", "tagalog"].includes(row.language) || typeof row.title !== "string" || !row.title.trim() || Array.from(row.title).length > 200
    || typeof row.source_id !== "string" || (row.prompt != null && (typeof row.prompt !== "string" || Array.from(row.prompt).length > 8000))
    || (row.kind.startsWith("tutor_") && row.prompt != null) || !Number.isFinite(Date.parse(row.recorded_at))
    || row.evidence !== "client-reported-activity-v1" || "answer_key" in row || "audio" in row || "score" in row || "user_id" in row)
    throw new ApiError(0, "Personal history could not be verified. Please refresh.");
  return row;
}
export function personalHistoryAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>): PersonalHistoryAccess {
  return {
    record: body => run(async secret => {
      // A concurrent whole-phrase assessment can hold the authenticated owner lock.
      const row = validatePersonalActivity(await request<PersonalActivity>("/me/personal-history", "POST", body, secret, {}, 45000));
      if (row.event_key !== body.event_key || row.source_id !== body.source_id || row.kind !== body.kind || row.language !== body.language)
        throw new ApiError(0, "The activity receipt did not match this request. Please retry saving History.");
      return row;
    }),
    list: (area = "all", offset = 0) => run(async secret => {
      const page = await request<PersonalHistoryPage>(`/me/personal-history?area=${area}&offset=${offset}`, "GET", undefined, secret, {}, 45000);
      if (!page || !Array.isArray(page.items) || page.items.length > 20 || page.offset !== offset || typeof page.has_more !== "boolean")
        throw new ApiError(0, "Personal history could not be verified. Please refresh.");
      return { ...page, items: page.items.map(validatePersonalActivity) };
    }),
  };
}
