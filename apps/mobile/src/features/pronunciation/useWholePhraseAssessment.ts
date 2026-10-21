import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import type { PronunciationAccess, PronunciationActivityView } from "../../services/api/pronunciation";
import { validateWholePhraseScore, type WholePhraseCapability, type WholePhraseScore } from "../../services/api/wholePhrase";
import type { WholePhraseRecording } from "./liveWordTracking";

export function useWholePhraseAssessment(activity: PronunciationActivityView, api?: PronunciationAccess) {
  const [capability, setCapability] = useState<WholePhraseCapability | null>(null);
  const [consent, setConsent] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<WholePhraseScore | null>(null), [assessing, setAssessing] = useState(false);
  const generation = useRef(0), active = useRef(false), busy = useRef(false);
  const capabilityGeneration = useRef(0);
  const attempted = useRef(new WeakSet<WholePhraseRecording>());
  useFocusEffect(useCallback(() => {
    active.current = true;
    generation.current++;
    const current = ++capabilityGeneration.current;
    setCapability(null); setConsent(false); setResult(null); setError(""); setAssessing(false); busy.current = false;
    if (api?.scoringCapabilities) void api.scoringCapabilities(activity.language).then(value => {
      if (active.current && capabilityGeneration.current === current) setCapability(value);
    }).catch(() => { if (active.current && capabilityGeneration.current === current) setError("Genuine scoring availability could not be checked. Local practice is still available; no score will be invented."); });
    const cancel = () => { generation.current++; busy.current = false; setConsent(false); setResult(null); setAssessing(false); };
    const background = AppState.addEventListener("change", state => { if (state !== "active") cancel(); });
    const hidden = () => { if (typeof document !== "undefined" && document.hidden) cancel(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", hidden);
    return () => {
      active.current = false; capabilityGeneration.current++; cancel(); background.remove();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", hidden);
    };
  }, [api, activity]));
  const permitted = consent && capability?.available === true && activity.language === "english" && !!api?.assessWholePhrase;
  const reset = () => { generation.current++; setResult(null); setError(""); };
  const assess = useCallback(async (recording: WholePhraseRecording) => {
    if (!active.current || !permitted || !api?.assessWholePhrase || busy.current || attempted.current.has(recording)) return;
    const current = generation.current;
    attempted.current.add(recording); busy.current = true; setAssessing(true); setError(""); setResult(null);
    try {
      const value = validateWholePhraseScore(await api.assessWholePhrase(activity, recording.audio), activity);
      if (active.current && generation.current === current) setResult(value);
    } catch (cause) {
      if (active.current && generation.current === current) setError(cause instanceof Error ? cause.message : "Whole-sentence scoring did not finish. No score is available.");
    } finally {
      try { await recording.release(); } catch { /* Cleanup must not cause an automatic provider retry. */ }
      if (active.current && generation.current === current) { busy.current = false; setAssessing(false); }
    }
  }, [api, activity, permitted]);
  return { capability, consent, setConsent, permitted, result, assessing, error, assess, reset };
}
