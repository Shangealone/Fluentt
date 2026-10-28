import type { PronunciationLanguage } from "../../services/api/pronunciation";
import type { LiveSpeechCallbacks, LiveSpeechSession, LiveSpeechOptions } from "./liveWordTracking";
import { startWholePhraseCapture } from "./wholePhraseAudio.web";

type Result = { isFinal: boolean; [index: number]: { transcript: string } };
type BrowserRecognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; processLocally?: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = {
  new(): BrowserRecognition;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

export async function prepareOfflineSpeech(language: PronunciationLanguage): Promise<void> {
  const browser = typeof window === "undefined" ? undefined : window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const Constructor = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition;
  if (!Constructor?.available || !Constructor.install) throw new Error("This browser cannot install offline speech. Use a browser that supports on-device recognition or the updated mobile app.");
  const locales = language === "english" ? ["en-US"] : ["fil-PH", "tl-PH"];
  for (const locale of locales) {
    const options = { langs: [locale], processLocally: true };
    const state = await Constructor.available(options);
    if (state === "available") return;
    if (state === "downloadable" || state === "downloading") {
      if (await Constructor.install(options)) return;
      throw new Error("The offline speech download did not finish. Check your connection and retry setup.");
    }
  }
  throw new Error(`This browser does not offer offline ${language === "english" ? "English" : "Tagalog"} recognition. Try the updated mobile app with that language installed.`);
}

/** Never silently enable a browser vendor's remote speech service. */
export function createLiveSpeech(language: PronunciationLanguage, callbacks: LiveSpeechCallbacks, options: LiveSpeechOptions = {}): LiveSpeechSession {
  let recognition: BrowserRecognition | null = null, disposed = false;
  let capture: Awaited<ReturnType<typeof startWholePhraseCapture>> | null = null;
  return {
    async start() {
      const browser = typeof window === "undefined" ? undefined : window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
      const Constructor = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition;
      if (!Constructor) throw new Error("Speech recognition is unavailable in this browser. Open this page in a supported browser such as Chrome or Edge, or use local recording and playback.");
      recognition = new Constructor();
      if (options.browserOnline === true) {
        // Explicit per-visit permission is required by the host UI. No silent fallback.
        recognition.lang = language === "english" ? "en-US" : "fil-PH";
        if ("processLocally" in recognition) recognition.processLocally = false;
      } else {
      if (!("processLocally" in recognition) || !Constructor.available) throw new Error("This browser does not support on-device live speech. Use a supported browser or the updated mobile app.");
      const locale = language === "english" ? "en-US" : "fil-PH";
      const locales = language === "tagalog" ? [locale, "tl-PH"] : [locale];
      let installed: string | undefined;
      for (const value of locales) {
        if (await Constructor.available({ langs: [value], processLocally: true }) === "available") { installed = value; break; }
        if (disposed) return;
      }
      if (disposed) return;
      if (!installed) throw new Error(`Enable or install offline ${language === "english" ? "English" : "Tagalog"} speech recognition in your browser, then retry. This practice does not send your voice to a cloud service.`);
      recognition.lang = installed; recognition.processLocally = true;
      }
      recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives = 1;
      recognition.onstart = () => { if (!disposed) callbacks.onStart(); };
      recognition.onresult = event => {
        if (disposed) return;
        const results = Array.from(event.results);
        callbacks.onResult(results.map(result => result[0]?.transcript ?? "").join(" "), results.every(result => result.isFinal));
      };
      recognition.onerror = event => { if (!disposed) callbacks.onError(event.error === "not-allowed" ? "Microphone access was denied. Allow this site to use the microphone, then retry." : event.error === "no-speech" ? "No speech was heard. Check your microphone and try again." : options.browserOnline ? event.error === "language-not-supported" ? "The browser's online speech service does not support this language. Use local recording and playback, or try another browser." : event.error === "network" ? "The online speech service could not connect. Check your internet connection or try Chrome or Edge. Local recording and playback is still available." : "Online speech recognition stopped. Check your browser's speech service and microphone, then retry." : "Live speech stopped. Check your offline speech language and microphone, then retry."); };
      recognition.onend = () => {
        if (disposed) return;
        if (!capture) { callbacks.onEnd(); return; }
        void capture.finish().then(recording => {
          if (disposed) { void recording.release(); return; }
          callbacks.onRecording?.(recording); callbacks.onEnd();
        }).catch(() => { if (!disposed) { callbacks.onError("The complete audio recording could not be prepared. No score was requested; please record again."); callbacks.onEnd(); } });
      };
      if (options.captureAudio) {
        capture = await startWholePhraseCapture();
        if (disposed) { capture.dispose(); return; }
      }
      recognition.start();
    },
    stop() { recognition?.stop(); },
    dispose() {
      disposed = true;
      capture?.dispose(); capture = null;
      if (recognition) { recognition.onstart = null; recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); recognition = null; }
    },
  };
}
