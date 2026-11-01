import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { PronunciationActivityView } from "../../services/api/pronunciation";
import { Button, ErrorMessage } from "../../components/ui";
import { p } from "../../theme/personal";
import { useAudioRecorder } from "./useAudioRecorder";
import { useLessonSpeech } from "../learning/useLessonSpeech";

/** Recording/playback only. No recognition, completion, history write, or score. */
export function LocalRecordingPractice({ activity, explanation }: { activity: PronunciationActivityView; explanation?: string }) {
  const recorder = useAudioRecorder({ privateTemporary: true, maximumDurationMs: 29000 });
  const speech = useLessonSpeech(activity.language, activity.id);
  const [waiting, setWaiting] = useState(false);
  const starting = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const recording = recorder.status === "recording";
  const reviewing = !!recorder.audioPayload;
  const start = async () => {
    if (starting.current) return;
    starting.current = true; setWaiting(true);
    try { if (await speech.stop() && active.current) await recorder.startRecording(); }
    finally { starting.current = false; if (active.current) setWaiting(false); }
  };
  return <View style={p.card}>
    <Text style={p.heading}>Listen, record and compare</Text>
    <Text style={p.body}>{activity.target_text}</Text>
    <Text style={p.caption}>{explanation ?? 'Your browser cannot recognize this language offline.'} You can still listen to the phrase, record yourself and play it back. This mode does not highlight words, mark the phrase complete or generate a score. FLUENTT does not upload this recording.</Text>
    <Button secondary label="Listen to example" disabled={recording || waiting || recorder.status === "playing"} onPress={() => { void speech.play(activity.target_text); }} />
    <Text style={p.caption}>{(recorder.durationMs / 1000).toFixed(1)} seconds · maximum 29 seconds</Text>
    <Button label={recording ? "Stop recording" : waiting ? "Preparing microphone…" : "Record my voice"} disabled={waiting || speech.speaking || (reviewing && !recording)} onPress={() => { if (recording) void recorder.stopRecording(); else void start(); }} />
    {reviewing && <>
      <Button label={recorder.status === "playing" ? "Pause my recording" : "Play my recording"} onPress={() => { if (recorder.status === "playing") void recorder.pausePlayback(); else void recorder.playRecording(); }} />
      <Button secondary label="Discard recording" onPress={() => { void recorder.discardRecording(); }} />
    </>}
    {!!(recorder.error || speech.error) && <ErrorMessage message={recorder.error || speech.error} />}
  </View>;
}
