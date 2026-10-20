import { request, ApiError } from "./client.ts";

export type PronunciationLanguage = "tagalog" | "english";

export type PronunciationActivityView = {
  id: string;
  lesson_id: string | null;
  target_text: string;
  language: PronunciationLanguage;
  instructions: string | null;
  reference_audio_metadata: Record<string, unknown>;
  version: number;
};

export type PronunciationActivitiesResponse = {
  activities: PronunciationActivityView[];
  total: number;
};

export type PronunciationAttemptSubmission = {
  attempt_id: string;
  activity_id: string;
  target_text: string;
  language: string;
  attempted_at: string;
  scoring_status: "pending" | "processing" | "scored" | "unsupported" | "failed" | "unscored";
  file_size_bytes: number;
  duration_ms: number;
  mime_type: string;
  simulated: boolean;
  message: string;
  transcription?: string | null;
  transcription_metadata?: Record<string, unknown> | null;
  score?: number | null;
  feedback?: string | null;
  assessment?: PronunciationAssessment | null;
};

export type PronunciationAttemptHistoryItem = {
  attempt_id: string;
  activity_id: string;
  target_text: string;
  language: string;
  attempted_at: string;
  scoring_status: string;
  file_size_bytes: number;
  duration_ms: number;
  transcription?: string | null;
  score?: number | null;
  feedback?: string | null;
};

export type ASRWord = {
  word: string;
  start_time_ms: number;
  end_time_ms: number;
  confidence: number | null;
};

export type TranscriptionResponse = {
  attempt_id: string;
  activity_id: string;
  transcription: string;
  raw_transcript: string;
  normalized_transcript: string;
  detected_language: string;
  prompt_language: string;
  confidence: number | null;
  duration_ms: number;
  processing_time_ms: number;
  model_id: string;
  model_version: string;
  simulated: boolean;
  silence_detected: boolean;
  words: ASRWord[];
  scoring_status: string;
  message: string;
};

export type TranscriptionStatus = {
  attempt_id: string;
  status: string;
  has_transcription: boolean;
  transcription: string | null;
  detected_language: string | null;
  prompt_language: string | null;
  silence_detected: boolean;
  simulated: boolean;
};

export type PhonemeAssessment = {
  phoneme: string;
  accuracy_score: number;
  status: "correct" | "needs_work" | "omitted";
};

export type WordAssessment = {
  word: string;
  target_phonemes: string[];
  accuracy_score: number;
  error_type: "none" | "mispronunciation" | "omission" | "insertion";
  phonemes: PhonemeAssessment[];
  tip?: string | null;
};

export type PronunciationAssessment = {
  overall_score: number;
  accuracy_score: number;
  fluency_score: number;
  completeness_score: number;
  prosody_score: number;
  words: WordAssessment[];
  target_language: string;
  summary_feedback: string;
  actionable_tips: string[];
  model_id: string;
  model_version: string;
  simulated: boolean;
  speech_rate_wpm: number;
  confidence: number;
};

export type PronunciationAssessmentResponse = {
  attempt_id: string;
  activity_id: string;
  scoring_status: string;
  score: number | null;
  feedback: string | null;
  assessment: PronunciationAssessment | null;
  transcription: string | null;
  evaluator_configuration_id: string | null;
  simulated: boolean;
  message: string;
};

export type AudioUploadPayload =
  | Blob
  | {
      uri: string;
      name: string;
      type: string;
    };

export type PronunciationAccess = {
  activities: (language?: string) => Promise<PronunciationActivitiesResponse>;
  activity: (activityId: string) => Promise<PronunciationActivityView>;
  submitAttempt: (
    activityId: string,
    audio: AudioUploadPayload,
    durationMs: number
  ) => Promise<PronunciationAttemptSubmission>;
  attempts: (activityId?: string) => Promise<PronunciationAttemptHistoryItem[]>;
  transcribe: (attemptId: string, force?: boolean) => Promise<TranscriptionResponse>;
  getTranscription: (attemptId: string) => Promise<TranscriptionStatus>;
  evaluate: (attemptId: string) => Promise<PronunciationAssessmentResponse>;
  getAssessment: (attemptId: string) => Promise<PronunciationAssessmentResponse>;
};

function invalid(message?: string): never {
  throw new ApiError(0, message ?? "Unexpected pronunciation response data.");
}

export function validateActivities(data: PronunciationActivitiesResponse): PronunciationActivitiesResponse {
  if (!data || !Array.isArray(data.activities) || typeof data.total !== "number") {
    invalid("Malformed pronunciation activities response.");
  }
  for (const act of data.activities) {
    if (!act || typeof act.id !== "string" || typeof act.target_text !== "string" || typeof act.language !== "string") {
      invalid("Malformed pronunciation activity item.");
    }
  }
  return data;
}

export const pronunciationApi = {
  getActivities: async (secret: string, language?: string): Promise<PronunciationActivitiesResponse> => {
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await request<PronunciationActivitiesResponse>(`/me/pronunciation/activities${query}`, "GET", undefined, secret);
    return validateActivities(res);
  },

  getActivity: async (secret: string, activityId: string): Promise<PronunciationActivityView> => {
    return request<PronunciationActivityView>(`/me/pronunciation/activities/${activityId}`, "GET", undefined, secret);
  },

  submitAttempt: async (
    secret: string,
    activityId: string,
    audio: AudioUploadPayload,
    durationMs: number
  ): Promise<PronunciationAttemptSubmission> => {
    const formData = new FormData();
    formData.append("activity_id", activityId);
    formData.append("duration_ms", String(durationMs));

    if (typeof Blob !== "undefined" && audio instanceof Blob) {
      const fileName = audio.type.includes("wav")
        ? "recording.wav"
        : audio.type.includes("mp4") || audio.type.includes("m4a")
        ? "recording.m4a"
        : "recording.webm";
      formData.append("audio_file", audio, fileName);
    } else {
      // React Native file object { uri, name, type }
      formData.append("audio_file", audio as unknown as Blob);
    }

    return request<PronunciationAttemptSubmission>(
      "/me/pronunciation/attempts",
      "POST",
      formData,
      secret
    );
  },

  getAttempts: async (secret: string, activityId?: string): Promise<PronunciationAttemptHistoryItem[]> => {
    const params = new URLSearchParams();
    if (activityId) params.set("activity_id", activityId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<PronunciationAttemptHistoryItem[]>(`/me/pronunciation/attempts${query}`, "GET", undefined, secret);
  },

  transcribeAttempt: async (secret: string, attemptId: string, force?: boolean): Promise<TranscriptionResponse> => {
    const params = new URLSearchParams();
    if (force) params.set("force_retranscribe", "true");
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<TranscriptionResponse>(`/me/pronunciation/attempts/${attemptId}/transcribe${query}`, "POST", undefined, secret);
  },

  getTranscription: async (secret: string, attemptId: string): Promise<TranscriptionStatus> => {
    return request<TranscriptionStatus>(`/me/pronunciation/attempts/${attemptId}/transcription`, "GET", undefined, secret);
  },

  evaluateAttempt: async (secret: string, attemptId: string): Promise<PronunciationAssessmentResponse> => {
    return request<PronunciationAssessmentResponse>(`/me/pronunciation/attempts/${attemptId}/evaluate`, "POST", undefined, secret);
  },

  getAssessment: async (secret: string, attemptId: string): Promise<PronunciationAssessmentResponse> => {
    return request<PronunciationAssessmentResponse>(`/me/pronunciation/attempts/${attemptId}/assessment`, "GET", undefined, secret);
  },
};

export function pronunciationAccess(
  run: <T>(operation: (credential: string) => Promise<T>) => Promise<T>
): PronunciationAccess {
  return {
    activities: (language?: string) => run(secret => pronunciationApi.getActivities(secret, language)),
    activity: (activityId: string) => run(secret => pronunciationApi.getActivity(secret, activityId)),
    submitAttempt: (activityId: string, audio: AudioUploadPayload, durationMs: number) =>
      run(secret => pronunciationApi.submitAttempt(secret, activityId, audio, durationMs)),
    attempts: (activityId?: string) => run(secret => pronunciationApi.getAttempts(secret, activityId)),
    transcribe: (attemptId: string, force?: boolean) => run(secret => pronunciationApi.transcribeAttempt(secret, attemptId, force)),
    getTranscription: (attemptId: string) => run(secret => pronunciationApi.getTranscription(secret, attemptId)),
    evaluate: (attemptId: string) => run(secret => pronunciationApi.evaluateAttempt(secret, attemptId)),
    getAssessment: (attemptId: string) => run(secret => pronunciationApi.getAssessment(secret, attemptId)),
  };
}
