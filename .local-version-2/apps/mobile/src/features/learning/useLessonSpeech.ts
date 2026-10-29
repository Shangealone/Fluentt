import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import type { Language } from "../../services/api/identity";

export function voiceMatches(language: Language, voiceLanguage: string): boolean {
  const code = voiceLanguage.toLowerCase().replaceAll("_", "-").split("-")[0];
  return language === "english" ? code === "en" : code === "fil" || code === "tl";
}
export function useLessonSpeech(language: Language, exerciseId: string) {
  const [speaking, setSpeaking] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), active = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true; generation.current++; setSpeaking(false); setError("");
    return () => { active.current = false; generation.current++; void Speech.stop().catch(() => {}); };
  // A different language or exercise must cancel queued speech, even while this screen stays focused.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, exerciseId]));
  const play = async (text: string, slow = false): Promise<boolean> => {
    const current = ++generation.current;
    setError("");
    try {
      await Speech.stop();
      if (!active.current || current !== generation.current) return false;
      let voiceTimeout: ReturnType<typeof setTimeout> | undefined;
      const voices = await Promise.race([
        Speech.getAvailableVoicesAsync(),
        new Promise<never>((_, reject) => { voiceTimeout = setTimeout(() => reject(new Error("Device voices did not load. Check your speech settings and retry, or show the transcript to practise reading.")), 5000); }),
      ]).finally(() => clearTimeout(voiceTimeout));
      if (!active.current || current !== generation.current) return false;
      const voice = voices.find(item => voiceMatches(language, item.language));
      if (!voice) throw new Error(`No ${language === "english" ? "English" : "Tagalog"} voice is available on this device. Enable or install a matching text-to-speech voice in your device settings, then retry. You can also show the transcript to practise reading.`);
      setSpeaking(true);
      Speech.speak(text, {
        voice: voice.identifier, language: voice.language, rate: slow ? 0.65 : 0.9,
        onDone: () => { if (active.current && current === generation.current) setSpeaking(false); },
        onStopped: () => { if (active.current && current === generation.current) setSpeaking(false); },
        onError: () => { if (active.current && current === generation.current) { setSpeaking(false); setError("Playback could not finish. Check your sound settings and try again."); } },
      });
      return true;
    } catch (cause) {
      if (active.current && current === generation.current) { setSpeaking(false); setError(cause instanceof Error ? cause.message : "Playback is unavailable. Please retry."); }
      return false;
    }
  };
  const stop = async () => {
    generation.current++; setSpeaking(false);
    try { await Speech.stop(); return true; }
    catch { setError("Audio playback could not stop. Please retry before recording."); return false; }
  };
  return { play, stop, speaking, error };
}
