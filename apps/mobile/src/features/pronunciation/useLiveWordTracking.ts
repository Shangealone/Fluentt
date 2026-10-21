import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import type { PronunciationLanguage } from "../../services/api/pronunciation";
import { createLiveSpeech } from "./liveSpeech";
import { spokenWordCount, speechWords, type LiveSpeechSession, type WholePhraseRecording } from "./liveWordTracking";

type TrackingState = { status: "idle" | "starting" | "listening" | "stopping" | "paused" | "complete" | "error"; transcript: string; count: number; error: string; settled: boolean; recording: WholePhraseRecording | null };
const empty: TrackingState = { status: "idle", transcript: "", count: 0, error: "", settled: true, recording: null };
export function useLiveWordTracking(target: string, language: PronunciationLanguage, captureAudio = false) {
  const [state, setState] = useState<TrackingState>(empty);
  const session = useRef<LiveSpeechSession | null>(null), generation = useRef(0), active = useRef(false), busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recording = useRef<WholePhraseRecording | null>(null);
  const releaseRecording = () => { if (recording.current) void Promise.resolve(recording.current.release()).catch(() => {}); recording.current = null; };
  useFocusEffect(useCallback(() => {
    active.current = true; setState(empty);
    const cancel = () => { generation.current++; clearTimeout(timer.current); busy.current = false; session.current?.dispose(); session.current = null; releaseRecording(); setState(empty); };
    const subscription = AppState.addEventListener("change", value => { if (value !== "active") cancel(); });
    const pageHidden = () => { if (typeof document !== "undefined" && document.hidden) cancel(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", pageHidden);
    return () => { active.current = false; cancel(); subscription.remove(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", pageHidden); };
  // A new phrase/language invalidates all pending recognition callbacks and permission requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, language, captureAudio]));

  const finishStop = () => {
    clearTimeout(timer.current);
    const current = generation.current;
    timer.current = setTimeout(() => {
      if (!active.current || current !== generation.current) return;
      generation.current++; busy.current = false; session.current?.dispose(); session.current = null;
      setState(value => captureAudio && !recording.current
        ? { ...value, settled: true, status: "error", error: "The complete recording could not be prepared. No score was requested. Please record again." }
        : { ...value, settled: true, status: value.status === "complete" ? "complete" : "paused" });
    }, captureAudio ? 15000 : 3000);
  };
  const start = async () => {
    if (!active.current || busy.current) return;
    const current = ++generation.current;
    session.current?.dispose(); session.current = null; busy.current = true;
    releaseRecording();
    clearTimeout(timer.current); setState({ ...empty, status: "starting", settled: false });
    let completed = false, failed = false, requestedStop = false;
    const valid = () => active.current && current === generation.current;
    const next = createLiveSpeech(language, {
      onStart: () => {
        if (!valid() || completed || failed) return;
        setState(value => ({ ...value, status: "listening" }));
        timer.current = setTimeout(() => {
          if (!valid() || completed) return;
          if (captureAudio) { requestedStop = true; setState(value => ({ ...value, status: "stopping" })); finishStop(); next.stop(); }
          else { generation.current++; next.dispose(); busy.current = false; setState(value => ({ ...value, status: "paused", settled: true })); }
        }, captureAudio ? 29000 : 60000);
      },
      onResult: (transcript, final) => {
        if (!valid() || completed || failed) return;
        const count = spokenWordCount(target, transcript), all = speechWords(target).length > 0 && count === speechWords(target).length;
        if (all && final) {
          completed = true; setState(value => ({ ...value, status: "complete", transcript, count, error: "", settled: false })); finishStop(); next.stop();
        } else {
          // Interim recognition can be revised. Never cut off the final syllable on an interim match.
          setState(value => ({ ...value, status: requestedStop ? "stopping" : "listening", transcript, count, error: "", settled: false }));
        }
      },
      onError: message => {
        if (!valid()) return;
        failed = true; clearTimeout(timer.current); busy.current = false; setState(value => ({ ...value, status: "error", error: message, settled: true })); next.dispose();
      },
      onEnd: () => {
        if (!valid()) return;
        clearTimeout(timer.current); busy.current = false;
        setState(value => ({ ...value, settled: true, status: completed || failed ? value.status : "paused" }));
        next.dispose();
      },
      onRecording: clip => {
        if (!valid() || failed) { void Promise.resolve(clip.release()).catch(() => {}); return; }
        recording.current = clip;
        setState(value => ({ ...value, recording: clip }));
      },
    }, { captureAudio });
    session.current = next;
    try { await next.start(); }
    catch (cause) {
      next.dispose();
      if (valid()) { clearTimeout(timer.current); busy.current = false; setState(value => ({ ...value, status: "error", settled: true, error: cause instanceof Error ? cause.message : "Live speech could not start. Please retry." })); }
    }
  };
  const stop = () => { if (busy.current) { setState(value => ({ ...value, status: "stopping" })); finishStop(); session.current?.stop(); } };
  return { ...state, start, stop };
}
