import { request, ApiError } from "./client.ts";
import type { AssignmentPage } from "./assignments.ts";
export type Person = { id: string; username: string };
export type CommunicationClass = { id: string; class_name: string };
export type CommunicationContext = { classroom: CommunicationClass; instructor: Person; viewer: Person; peer: Person | null; role: "instructor" | "school_student" };
export type Message = { id: string; class_id: string; kind: "announcement" | "direct"; sender: Person; recipient_id: string | null; content: string; sent_at: string; read: boolean };
export type MessagePage<T> = AssignmentPage<T> & { as_of: string };
const base = (id: string) => `/classes/${encodeURIComponent(id)}`;
export function messageError(content: string): string | null {
  const count = [...content].length;
  return count < 1 || count > 4000 || !content.trim() || content.includes("\0") || [...content].some(char => char.length === 1 && char.charCodeAt(0) >= 0xd800 && char.charCodeAt(0) <= 0xdfff) ? "Enter 1–4,000 Unicode characters of plain text." : null;
}
export function validateMessage(row: Message): Message {
  if (!row || typeof row.id !== "string" || !row.sender?.id || typeof row.sender.username !== "string" || !["direct", "announcement"].includes(row.kind)
    || typeof row.content !== "string" || messageError(row.content) || typeof row.read !== "boolean" || !Number.isFinite(Date.parse(row.sent_at))
    || "answer_key" in row || "grade" in row || "read_by" in row) throw new ApiError(0, "Unexpected message data. Refresh to verify communication.");
  return row;
}
function validatePage<T>(page: MessagePage<T>): MessagePage<T> {
  if (!page || !Array.isArray(page.items) || !Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100 || !Number.isSafeInteger(page.offset) || page.offset < 0
    || typeof page.has_more !== "boolean" || page.items.length > page.limit || !Number.isFinite(Date.parse(page.as_of))) throw new ApiError(0, "Unexpected communication page. Refresh before retrying.");
  return page;
}
const query = (offset = 0, q = "", before?: string) => { const params = new URLSearchParams({ offset: String(offset) }); if (q) params.set("q", q); if (before) params.set("before", before); return params; };
export const communicationApi = {
  classes: async (secret: string, q = "", offset = 0) => validatePage(await request<MessagePage<CommunicationClass>>(`/communication/classes?${query(offset, q)}`, "GET", undefined, secret)),
  context: (secret: string, id: string, studentId?: string) => request<CommunicationContext>(`${base(id)}/communication${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ""}`, "GET", undefined, secret),
  participants: async (secret: string, id: string, q = "", offset = 0) => validatePage(await request<MessagePage<Person>>(`${base(id)}/communication/participants?${query(offset, q)}`, "GET", undefined, secret)),
  history: async (secret: string, id: string, studentId?: string, offset = 0, before?: string) => {
    const path = studentId ? `/messages/${encodeURIComponent(studentId)}` : "/announcements";
    const page = validatePage(await request<MessagePage<Message>>(`${base(id)}${path}?${query(offset, "", before)}`, "GET", undefined, secret));
    const ids = new Set<string>(); page.items.forEach(row => { validateMessage(row); if (ids.has(row.id)) throw new ApiError(0, "Duplicate message data. Refresh history."); ids.add(row.id); }); return page;
  },
  send: async (secret: string, id: string, studentId: string | undefined, content: string, key: string) => validateMessage(await request<Message>(`${base(id)}${studentId ? `/messages/${encodeURIComponent(studentId)}` : "/announcements"}`, "POST", { content }, secret, { "Idempotency-Key": key })),
  detail: async (secret: string, id: string, messageId: string) => validateMessage(await request<Message>(`${base(id)}/communication/messages/${encodeURIComponent(messageId)}`, "GET", undefined, secret)),
  read: async (secret: string, id: string, messageId: string) => validateMessage(await request<Message>(`${base(id)}/communication/messages/${encodeURIComponent(messageId)}/read`, "POST", {}, secret)),
};
export function communicationAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return {
    classes: (q = "", offset = 0) => run(s => communicationApi.classes(s, q, offset)),
    context: (id: string, studentId?: string) => run(s => communicationApi.context(s, id, studentId)),
    participants: (id: string, q = "", offset = 0) => run(s => communicationApi.participants(s, id, q, offset)),
    history: (id: string, studentId?: string, offset = 0, before?: string) => run(s => communicationApi.history(s, id, studentId, offset, before)),
    send: (id: string, studentId: string | undefined, content: string, key: string) => run(s => communicationApi.send(s, id, studentId, content, key)),
    detail: (id: string, messageId: string) => run(s => communicationApi.detail(s, id, messageId)),
    read: (id: string, messageId: string) => run(s => communicationApi.read(s, id, messageId)),
  };
}
export type CommunicationAccess = ReturnType<typeof communicationAccess>;
