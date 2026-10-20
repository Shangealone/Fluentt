import { requireOptionalNativeModule } from "expo";
import type { ExpoSpeechRecognitionModuleType } from "expo-speech-recognition/build/ExpoSpeechRecognitionModule.types";
import type { PronunciationLanguage } from "../../services/api/pronunciation";
import type { LiveSpeechCallbacks, LiveSpeechSession } from "./liveWordTracking";

export async function prepareOfflineSpeech(language: PronunciationLanguage): Promise<void> {
  throw new Error(`Install an offline ${language === "english" ? "English" : "Tagalog"} speech language in your device settings, then return to this phrase.`);
}

/** Native recognition is local-only; missing native builds must fail without crashing Expo Go. */
export function createLiveSpeech(language: PronunciationLanguage, callbacks: LiveSpeechCallbacks): LiveSpeechSession {
  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
  let disposed = false, started = false, finalized = "";
  const subscriptions: { remove: () => void }[] = [];
  return {
    async start() {
      if (!module) throw new Error("Live speech needs an updated development build of this app. It is not available in Expo Go.");
      if (!module.isRecognitionAvailable() || !module.supportsOnDeviceRecognition()) throw new Error("On-device speech recognition is unavailable. Enable your device's offline speech service and retry.");
      if (await module.getStateAsync() !== "inactive") throw new Error("The previous microphone session is still closing. Please retry in a moment.");
      if (disposed) return;
      const { installedLocales } = await module.getSupportedLocales({});
      if (disposed) return;
      const locale = installedLocales.map(value => value.replaceAll("_", "-")).find(value => language === "english" ? /^en(-|$)/i.test(value) : /^(fil|tl)(-|$)/i.test(value));
      if (!locale) throw new Error(`Install an offline ${language === "english" ? "English" : "Tagalog"} speech recognition language in your device settings, then retry.`);
      const permission = await module.requestPermissionsAsync();
      if (disposed) return;
      if (!permission.granted) throw new Error("Microphone and speech recognition access are needed. Allow them in your device settings, then retry.");
      subscriptions.push(
        module.addListener("start", () => { if (!disposed) callbacks.onStart(); }),
        module.addListener("result", event => {
          if (disposed) return;
          const segment = event.results[0]?.transcript ?? "";
          const transcript = `${finalized} ${segment}`.trim();
          if (event.isFinal) finalized = transcript;
          callbacks.onResult(transcript, event.isFinal);
        }),
        module.addListener("error", event => { if (!disposed) callbacks.onError(event.error === "not-allowed" ? "Microphone or speech access was denied. Allow access in device settings and retry." : "Speech recognition stopped. Check the offline language and microphone settings, then retry."); }),
        module.addListener("end", () => { started = false; if (!disposed) callbacks.onEnd(); }),
      );
      started = true;
      module.start({ lang: locale, interimResults: true, continuous: true, maxAlternatives: 1, requiresOnDeviceRecognition: true, recordingOptions: { persist: false } });
    },
    stop() { if (!disposed && started) module?.stop(); },
    dispose() { disposed = true; subscriptions.forEach(item => item.remove()); if (started) { module?.abort(); started = false; } },
  };
}
