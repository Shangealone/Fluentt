import type { PronunciationLanguage } from "../../services/api/pronunciation";

export type OfflineSpeechStatus = "checking" | "available" | "downloadable" | "unavailable";

/** Capability check only: no microphone, download, or remote recognition request. */
export async function browserOfflineSpeechStatus(language: PronunciationLanguage): Promise<OfflineSpeechStatus> {
  const browser = typeof window === "undefined" ? undefined : window as unknown as {
    SpeechRecognition?: { new(): { processLocally?: boolean }; available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string> };
    webkitSpeechRecognition?: { new(): { processLocally?: boolean }; available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string> };
  };
  const Constructor = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition;
  if (!Constructor?.available || !("processLocally" in new Constructor())) return "unavailable";
  let downloadable = false;
  try {
    for (const locale of language === "english" ? ["en-US"] : ["fil-PH", "tl-PH"]) {
      const status = await Constructor.available({ langs: [locale], processLocally: true });
      if (status === "available") return "available";
      if (status === "downloadable" || status === "downloading") downloadable = true;
    }
  } catch { return "unavailable"; }
  return downloadable ? "downloadable" : "unavailable";
}
