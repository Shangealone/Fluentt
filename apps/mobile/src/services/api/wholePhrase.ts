import { ApiError, request } from "./client.ts";
import type { AudioUploadPayload, PronunciationActivityView } from "./pronunciation";

export const WHOLE_PHRASE_CONSENT = "azure-whole-phrase-audio-v1";
export type WholePhraseCapability = {
  available: boolean; provider: "azure-speech"; locale: "en-US" | null; maximum_duration_ms: number;
  consent_version: typeof WHOLE_PHRASE_CONSENT;
  reason: "ready" | "disabled" | "not_configured" | "authorization_missing" | "language_unsupported";
};
export type WholePhraseScore = {
  status: "scored"; activity_id: string; activity_version: number; overall_score: number;
  accuracy_score: number; fluency_score: number; completeness_score: number; duration_ms: number;
  provider: "azure-speech"; locale: "en-US"; contract_version: "whole-phrase-azure-rest-v1"; model_version: null; simulated: false;
};

export function validateWholePhraseScore(value: WholePhraseScore, activity: Pick<PronunciationActivityView, "id" | "version">) {
  if (!value || value.status !== "scored" || value.simulated !== false || value.provider !== "azure-speech"
    || value.locale !== "en-US" || value.contract_version !== "whole-phrase-azure-rest-v1"
    || value.activity_id !== activity.id || value.activity_version !== activity.version || value.model_version !== null
    || ![value.overall_score, value.accuracy_score, value.fluency_score, value.completeness_score].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100)
    || !Number.isInteger(value.duration_ms) || value.duration_ms < 500 || value.duration_ms > 30000)
    throw new ApiError(0, "No verified whole-sentence assessment was returned. No score is available.");
  return value;
}

export const wholePhraseApi = {
  async capabilities(secret: string, language: string): Promise<WholePhraseCapability> {
    const value = await request<WholePhraseCapability>(`/me/pronunciation/whole-phrase/capabilities?language=${encodeURIComponent(language)}`, "GET", undefined, secret);
    if (!value || typeof value.available !== "boolean" || value.provider !== "azure-speech"
      || value.consent_version !== WHOLE_PHRASE_CONSENT || value.maximum_duration_ms !== 30000
      || !["ready", "disabled", "not_configured", "authorization_missing", "language_unsupported"].includes(value.reason)
      || value.available !== (value.reason === "ready") || (value.available && value.locale !== "en-US"))
      throw new ApiError(0, "Unable to verify genuine pronunciation scoring availability.");
    return value;
  },
  async assess(secret: string, activity: PronunciationActivityView, audio: AudioUploadPayload): Promise<WholePhraseScore> {
    const form = new FormData();
    form.append("activity_id", activity.id); form.append("activity_version", String(activity.version));
    form.append("cloud_consent_version", WHOLE_PHRASE_CONSENT);
    if (typeof Blob !== "undefined" && audio instanceof Blob) form.append("audio_file", audio, "whole-phrase.wav");
    else form.append("audio_file", audio as unknown as Blob);
    return validateWholePhraseScore(await request<WholePhraseScore>("/me/pronunciation/whole-phrase/assess", "POST", form, secret, {}, 45000), activity);
  },
};
