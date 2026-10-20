import { request } from "./client.ts";

export interface FormativeFeedback {
  summary: string;
  corrections: string[];
  suggestions: string[];
  politeness_marker_detected?: boolean | null;
  topic_relevance_score: number;
  confidence: number;
  uncertainty_notice?: string;
}

export interface ConversationTopic {
  id: string;
  lesson_id?: string | null;
  title: string;
  language: string;
  scenario_description: string;
  persona: string;
  target_level: string;
  goal: string;
  vocabulary_hints: string[];
  starter_prompt: string;
  status: string;
  version: number;
}

export interface ConversationTopicsResponse {
  topics: ConversationTopic[];
  total: number;
}

export interface ConversationMessage {
  id: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  sent_at: string;
  feedback?: FormativeFeedback | null;
  pronunciation_score?: number | null;
  transcription?: string | null;
  audio_attempt_id?: string | null;
}

export interface ConversationSession {
  session_id: string;
  topic_id: string;
  topic_title: string;
  language: string;
  persona: string;
  started_at: string;
  ended_at?: string | null;
  status: "active" | "ended" | "failed";
  simulated: boolean;
  model_version: string;
  turns_count: number;
  max_turns: number;
  messages: ConversationMessage[];
}

export interface SendMessageResponse {
  session_id: string;
  user_message: ConversationMessage;
  assistant_message: ConversationMessage;
  turns_count: number;
  max_turns: number;
  is_session_complete: boolean;
  simulated: boolean;
}

export interface ConversationSessionSummary {
  session_id: string;
  status: string;
  turns_completed: number;
  overall_feedback: string;
  strengths: string[];
  recommendations: string[];
  ended_at: string;
}

export function validateTopics(data: unknown): ConversationTopicsResponse {
  if (!data || typeof data !== "object" || !("topics" in data) || !Array.isArray((data as any).topics)) {
    throw new Error("Malformed conversation topics response");
  }
  return data as ConversationTopicsResponse;
}

export const conversationApi = {
  topics: async (token: string, language?: string): Promise<ConversationTopicsResponse> => {
    const query = language ? `?language=${encodeURIComponent(language)}` : "";
    const raw = await request<ConversationTopicsResponse>(`/me/conversation/topics${query}`, "GET", undefined, token);
    return validateTopics(raw);
  },

  topic: async (token: string, topicId: string): Promise<ConversationTopic> => {
    return request<ConversationTopic>(`/me/conversation/topics/${topicId}`, "GET", undefined, token);
  },

  startSession: async (token: string, topicId: string, classId?: string | null): Promise<ConversationSession> => {
    return request<ConversationSession>(
      "/me/conversation/sessions",
      "POST",
      { topic_id: topicId, class_id: classId ?? null },
      token
    );
  },

  getSession: async (token: string, sessionId: string): Promise<ConversationSession> => {
    return request<ConversationSession>(`/me/conversation/sessions/${sessionId}`, "GET", undefined, token);
  },

  sendMessage: async (
    token: string,
    sessionId: string,
    content?: string | null,
    audioAttemptId?: string | null
  ): Promise<SendMessageResponse> => {
    return request<SendMessageResponse>(
      `/me/conversation/sessions/${sessionId}/messages`,
      "POST",
      { content: content ?? null, audio_attempt_id: audioAttemptId ?? null },
      token
    );
  },

  endSession: async (token: string, sessionId: string): Promise<ConversationSessionSummary> => {
    return request<ConversationSessionSummary>(
      `/me/conversation/sessions/${sessionId}/end`,
      "POST",
      {},
      token
    );
  },
};

export interface ConversationAccess {
  topics: (language?: string) => Promise<ConversationTopicsResponse>;
  topic: (topicId: string) => Promise<ConversationTopic>;
  startSession: (topicId: string, classId?: string | null) => Promise<ConversationSession>;
  getSession: (sessionId: string) => Promise<ConversationSession>;
  sendMessage: (sessionId: string, content?: string | null, audioAttemptId?: string | null) => Promise<SendMessageResponse>;
  endSession: (sessionId: string) => Promise<ConversationSessionSummary>;
}

export function conversationAccess(
  runner: <T>(operation: (credential: string) => Promise<T>) => Promise<T>
): ConversationAccess {
  return {
    topics: (language?: string) => runner((token) => conversationApi.topics(token, language)),
    topic: (topicId: string) => runner((token) => conversationApi.topic(token, topicId)),
    startSession: (topicId: string, classId?: string | null) =>
      runner((token) => conversationApi.startSession(token, topicId, classId)),
    getSession: (sessionId: string) => runner((token) => conversationApi.getSession(token, sessionId)),
    sendMessage: (sessionId: string, content?: string | null, audioAttemptId?: string | null) =>
      runner((token) => conversationApi.sendMessage(token, sessionId, content, audioAttemptId)),
    endSession: (sessionId: string) => runner((token) => conversationApi.endSession(token, sessionId)),
  };
}
