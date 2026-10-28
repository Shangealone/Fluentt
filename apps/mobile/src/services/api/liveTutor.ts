import { request } from "./client";
import type { ConversationTopic } from "./conversation";

export type TutorMessage = { role: "user" | "assistant"; content: string };
export type TutorCapability = { available: boolean; provider: "Groq"; model: string; contract: "local-tutor-groq-v1"; permission: "groq-text-demo-v1"; saved: false; max_replies: number; topics: ConversationTopic[] };
export type TutorReply = { reply: string; coaching: string; provider: "Groq"; model: string; contract: "local-tutor-groq-v1"; saved: false; simulated: false };
export function validateTutorReply(value: TutorReply): TutorReply {
  if (!value || value.simulated !== false || value.saved !== false || value.provider !== "Groq" || value.contract !== "local-tutor-groq-v1" || typeof value.model !== "string" || !value.model || typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 1000 || typeof value.coaching !== "string" || value.coaching.length > 500) throw new Error("No valid generated Tutor reply was received.");
  return value;
}
export const liveTutorApi = {
  async capabilities(): Promise<TutorCapability> {
    const data = await request<TutorCapability>("/demo/tutor/capabilities");
    if (data.contract !== "local-tutor-groq-v1" || data.saved !== false || data.provider !== "Groq" || typeof data.available !== "boolean" || data.permission !== "groq-text-demo-v1" || !Array.isArray(data.topics) || data.topics.some(t => !t.id || !["tagalog", "english"].includes(t.language) || !t.starter_prompt)) throw new Error("Tutor demo configuration could not be verified.");
    return data;
  },
  async reply(topicId: string, history: TutorMessage[]): Promise<TutorReply> {
    return validateTutorReply(await request<TutorReply>("/demo/tutor/reply", "POST", { topic_id: topicId, permission: "groq-text-demo-v1", history }, undefined, {}, 32000));
  },
};
