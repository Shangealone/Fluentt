import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { ExpoSpeechRecognitionModuleType } from "expo-speech-recognition/build/ExpoSpeechRecognitionModule.types";
import type { PronunciationLanguage } from "../../services/api/pronunciation";
import type { LiveSpeechCallbacks, LiveSpeechSession, LiveSpeechOptions } from "./liveWordTracking";

async function removeTemporaryRecording(uri: string) {
  const { File } = await import("expo-file-system");
  const file = new File(uri);
  if (file.exists) file.delete();
}

/** Request OS permission before a tracked recording starts. The Android dialog pauses the app. */
export async function requestLiveSpeechPermission(): Promise<void> {
  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
  if (!module) throw new Error("Live speech needs an updated build of this app. It is not available in Expo Go.");
  const permission = await module.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Microphone and speech recognition access are needed. Allow them in your device settings, then retry.");
}

export async function prepareOfflineSpeech(language: PronunciationLanguage): Promise<void> {
  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
  const label = language === "english" ? "English" : "Tagalog";
  if (!module) throw new Error("Offline speech setup needs the updated mobile app. It is not available in Expo Go.");
  if (Platform.OS !== "android") throw new Error(`Install an offline ${label} speech language in your device settings, then return to this phrase.`);
  if (!module.supportsOnDeviceRecognition()) throw new Error("On-device speech recognition is not supported by this Android version or speech service.");

  const matchesLanguage = (value: string) => language === "english"
    ? /^en(?:-|$)/i.test(value.replaceAll("_", "-"))
    : /^(?:fil|tl)(?:-|$)/i.test(value.replaceAll("_", "-"));
  const { locales, installedLocales } = await module.getSupportedLocales({});
  if (installedLocales.some(matchesLanguage)) return;
  const locale = locales.map(value => value.replaceAll("_", "-")).find(matchesLanguage);
  if (!locale) throw new Error(`This device's offline speech service does not list a downloadable ${label} language. Update or enable its speech service, then retry.`);

  let result: Awaited<ReturnType<typeof module.androidTriggerOfflineModelDownload>>;
  try {
    result = await module.androidTriggerOfflineModelDownload({ locale });
  } catch {
    throw new Error(`Android could not start the offline ${label} language download. Check that the device's speech service is enabled and try again.`);
  }
  if (result.status === "opened_dialog") throw new Error(`Android opened the offline ${label} speech download. Approve it, wait for setup to finish, then check the setup here.`);
  if (result.status === "download_scheduled") throw new Error(`Android queued the offline ${label} speech download. Wait for setup to finish, then check the setup here.`);

  const updated = await module.getSupportedLocales({});
  if (!updated.installedLocales.some(matchesLanguage)) throw new Error(`Android started the offline ${label} speech download. Wait for setup to finish, then check the setup here.`);
}

export async function checkOfflineSpeechInstalled(language: PronunciationLanguage): Promise<boolean> {
  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
  if (!module) throw new Error("Offline speech setup needs the updated mobile app. It is not available in Expo Go.");
  if (Platform.OS !== "android") return false;
  if (!module.supportsOnDeviceRecognition()) return false;
  const { installedLocales } = await module.getSupportedLocales({});
  return installedLocales.some(value => language === "english"
    ? /^en(?:-|$)/i.test(value.replaceAll("_", "-"))
    : /^(?:fil|tl)(?:-|$)/i.test(value.replaceAll("_", "-")));
}

/** Native recognition is local-only; missing native builds must fail without crashing Expo Go. */
export function createLiveSpeech(language: PronunciationLanguage, callbacks: LiveSpeechCallbacks, options: LiveSpeechOptions = {}): LiveSpeechSession {
  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
  let disposed = false, started = false, finalized = "";
  const subscriptions: { remove: () => void }[] = [];
  let recordingUri: string | null = null, recordingStart = 0, delivered = false, audioEnded = false, endSeen = false;
  let recordingLocation: { outputDirectory: string; outputFileName: string } | undefined;
  const end = () => { if (!disposed && endSeen && (!options.captureAudio || audioEnded)) callbacks.onEnd(); };
  return {
    async start() {
      if (!module) throw new Error("Live speech needs an updated development build of this app. It is not available in Expo Go.");
      if (!module.isRecognitionAvailable() || !module.supportsOnDeviceRecognition()) throw new Error("On-device speech recognition is unavailable. Enable your device's offline speech service and retry.");
      if (options.captureAudio && !module.supportsRecording()) throw new Error("Whole-sentence scoring needs a device/build that supports speech audio recording. Local word practice is still available.");
      if (await module.getStateAsync() !== "inactive") throw new Error("The previous microphone session is still closing. Please retry in a moment.");
      if (disposed) return;
      const { installedLocales } = await module.getSupportedLocales({});
      if (disposed) return;
      const locale = installedLocales.map(value => value.replaceAll("_", "-")).find(value => language === "english" ? /^en(-|$)/i.test(value) : /^(fil|tl)(-|$)/i.test(value));
      if (!locale) throw new Error(`Install an offline ${language === "english" ? "English" : "Tagalog"} speech recognition language in your device settings, or tap Set up offline speech, then retry.`);
      // Permission dialogs must happen before the tracked session begins: Android briefly
      // backgrounds the app while showing them, and backgrounding cancels live recording.
      const permission = await module.getPermissionsAsync();
      if (disposed) return;
      if (!permission.granted) throw new Error("Microphone and speech recognition access are needed. Allow them in your device settings, then retry.");
      if (options.captureAudio) {
        const [{ File, Paths }, { randomUUID }] = await Promise.all([import("expo-file-system"), import("expo-crypto")]);
        if (disposed) return;
        const outputFileName = `fluentt-whole-phrase-${randomUUID()}.wav`;
        recordingLocation = { outputDirectory: Paths.cache.uri, outputFileName };
        // Know the exact owned cache path before native start, including cancellation before audiostart.
        recordingUri = new File(Paths.cache, outputFileName).uri;
      }
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
        module.addListener("end", () => { started = false; endSeen = true; end(); }),
      );
      if (options.captureAudio) subscriptions.push(
        module.addListener("audiostart", event => { recordingUri = event.uri ?? recordingUri; recordingStart = event.timestamp; }),
        module.addListener("audioend", event => {
          recordingUri = event.uri ?? recordingUri; audioEnded = true;
          if (disposed) { if (recordingUri) void removeTemporaryRecording(recordingUri).catch(() => {}); return; }
          if (!recordingUri || !recordingStart) { callbacks.onError("The complete recording was unavailable. No score was requested."); return; }
          const uri = recordingUri;
          delivered = true;
          callbacks.onRecording?.({ audio: { uri, name: "whole-phrase.wav", type: "audio/wav" },
            durationMs: Math.round(event.timestamp - recordingStart), release: () => removeTemporaryRecording(uri) });
          end();
        }),
      );
      started = true;
      module.start({ lang: locale, interimResults: true, continuous: true, maxAlternatives: 1, requiresOnDeviceRecognition: true,
        recordingOptions: options.captureAudio ? { persist: true, ...recordingLocation, outputSampleRate: 16000, outputEncoding: "pcmFormatInt16" } : { persist: false } });
    },
    stop() { if (!disposed && started) module?.stop(); },
    dispose() {
      disposed = true;
      if (started) { module?.abort(); started = false; }
      subscriptions.forEach(item => item.remove());
      if (!delivered && recordingUri) void removeTemporaryRecording(recordingUri).catch(() => {});
    },
  };
}
