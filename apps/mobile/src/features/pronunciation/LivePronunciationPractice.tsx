import { useEffect, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import type { PronunciationAccess, PronunciationActivityView, PronunciationAttemptSubmission } from "../../services/api/pronunciation";
import { Button, ErrorMessage } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import { useLessonSpeech } from "../learning/useLessonSpeech";
import { useLiveWordTracking } from "./useLiveWordTracking";
import { alignSpokenWords } from "./liveWordTracking";
import { checkOfflineSpeechInstalled, prepareOfflineSpeech } from "./liveSpeech";
import { useWholePhraseAssessment } from "./useWholePhraseAssessment";
import type { PersonalHistoryAccess } from "../../services/api/personalHistory";
import { useActivityHistory } from "../history/useActivityHistory";
import { HistorySaveNotice } from "../history/HistorySaveNotice";

function validScore(value: unknown): number | null {
  const score = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

export function LivePronunciationPractice({ activity, api, onDone, history, owner, guidedSubmissionMode = false }: {
  activity: PronunciationActivityView;
  api?: PronunciationAccess;
  onDone: () => void;
  history?: PersonalHistoryAccess;
  owner?: string;
  guidedSubmissionMode?: boolean;
}) {
  const journal = useActivityHistory(history, owner);
  const recordHistory = journal.recordOnce;
  const [run, setRun] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<PronunciationAttemptSubmission | null>(null);
  const [submissionError, setSubmissionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [offlineSetupPending, setOfflineSetupPending] = useState(false);
  const speech = useLessonSpeech(activity.language, activity.id);
  const scoring = useWholePhraseAssessment(activity, guidedSubmissionMode ? undefined : api);
  const tracking = useLiveWordTracking(activity.target_text, activity.language, guidedSubmissionMode || scoring.permitted, guidedSubmissionMode ? 60000 : undefined);
  const [settingUp, setSettingUp] = useState(false), [setupMessage, setSetupMessage] = useState("");
  const words = activity.target_text.match(/[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu) ?? [];
  const listening = tracking.status === "listening", waiting = tracking.status === "starting" || tracking.status === "stopping", complete = tracking.status === "complete";
  const wordMatches = alignSpokenWords(activity.target_text, tracking.transcript,
    tracking.settled && ["paused", "complete", "error"].includes(tracking.status));
  const matchedWords = wordMatches.filter(match => match === "matched").length;
  const nextPendingWord = wordMatches.indexOf("pending");
  const needsOfflineSpeechSetup = tracking.error.toLowerCase().includes("offline") && tracking.error.toLowerCase().includes("language");
  const live = listening || waiting;
  const assessWholeRecording = scoring.assess;
  const simulationEnabled = !guidedSubmissionMode && scoring.simulationEnabled;
  const simulateScore = scoring.simulate;
  const record = () => {
    if (submitting) return;
    setSubmissionResult(null); setSubmissionError(""); scoring.reset();
    void speech.stop().then(stopped => { if (stopped) { setRun(value => value + 1); return tracking.start(); } });
  };
  const submitRecording = async () => {
    const recording = tracking.recording;
    if (!guidedSubmissionMode || !recording || !api || submitting) return;
    setSubmitting(true); setSubmissionError(""); setSubmissionResult(null);
    try {
      const result = await api.submitAttempt(activity.id, recording.audio, recording.durationMs);
      setSubmissionResult(result);
      try { await recording.release(); } catch { /* The API result remains usable if cache cleanup fails. */ }
    } catch (cause) {
      setSubmissionError(cause instanceof Error ? cause.message : "The recording could not be submitted. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };
  const submittedScore = validScore(submissionResult?.assessment?.overall_score) ?? validScore(submissionResult?.score);
  const submittedFeedback = submissionResult?.feedback || submissionResult?.assessment?.summary_feedback || submissionResult?.message;
  const submittedOutputIsSimulated = Boolean(submissionResult?.simulated || submissionResult?.assessment?.simulated);
  useEffect(() => {
    if (!guidedSubmissionMode && ((complete || (scoring.result && !("kind" in scoring.result))) && tracking.settled)) recordHistory(`phrase-${run}`, { kind: "voice_phrase", source_id: activity.id, content_version: activity.version, title: "Pronunciation practice", prompt: activity.target_text, language: activity.language });
  }, [complete, guidedSubmissionMode, scoring.result, tracking.settled, recordHistory, run, activity]);
  useEffect(() => {
    if (guidedSubmissionMode) return;
    if (simulationEnabled) {
      if ((complete || tracking.status === "paused") && tracking.settled) simulateScore();
    } else if (complete && tracking.settled && tracking.recording) void assessWholeRecording(tracking.recording);
  }, [complete, guidedSubmissionMode, tracking.status, tracking.settled, tracking.recording, simulationEnabled, simulateScore, assessWholeRecording]);
  const setup = async () => {
    setSettingUp(true); setSetupMessage("");
    try {
      if (Platform.OS === "android" && offlineSetupPending) {
        const ready = await checkOfflineSpeechInstalled(activity.language);
        setOfflineSetupPending(false);
        setSetupMessage(ready ? "The offline speech language is installed. Press Record to start." : "The offline language is not installed yet. If you canceled the Android prompt, tap Set up offline speech to try again.");
        return;
      }
      await prepareOfflineSpeech(activity.language);
      setOfflineSetupPending(false);
      setSetupMessage("The offline speech language is installed. Press Record to start.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Offline speech setup failed. Please retry.";
      setSetupMessage(message);
      if (Platform.OS === "android" && /Android opened the offline|Android queued the offline|Android started the offline/i.test(message)) setOfflineSetupPending(true);
    }
    finally { setSettingUp(false); }
  };
  useEffect(() => {
    if (Platform.OS !== "android" || !offlineSetupPending) return;
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") return;
      void checkOfflineSpeechInstalled(activity.language).then(ready => {
        if (!ready) return;
        setOfflineSetupPending(false);
        setSetupMessage("The offline speech language is installed. Press Record to start.");
      }).catch(() => {});
    });
    return () => subscription.remove();
  }, [activity.language, offlineSetupPending]);
  return <View style={{ gap: 18 }}>
    <View style={p.note}>
      <Text style={p.eyebrow}>{guidedSubmissionMode ? "Guided recording" : "Whole-sentence assessment"}</Text>
      <Text style={p.body}>{guidedSubmissionMode
        ? "Words update as on-device speech recognition hears them. Your temporary recording is uploaded to FLUENTT only when you tap Submit recording."
        : scoring.simulationEnabled ? "After you finish the phrase, an overall pronunciation score appears here."
          : activity.language === "tagalog" ? "Genuine Tagalog pronunciation scoring is not supported by this provider. You can still practise and follow the live words; no pronunciation score is generated."
            : scoring.capability?.available ? "After you finish, Azure can assess your complete recording together. Green words only mean they were recognized; they are not individual pronunciation scores."
              : "Genuine English scoring needs a configured Azure Speech connection. Local word practice still works, but no pronunciation score is generated until the connection is enabled."}</Text>
      {!guidedSubmissionMode && !scoring.simulationEnabled && scoring.capability?.available && <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow Microsoft Azure to assess this English recording"
        accessibilityState={{ checked: scoring.consent, disabled: live || scoring.assessing }} disabled={live || scoring.assessing}
        onPress={() => { scoring.reset(); scoring.setConsent(!scoring.consent); }} style={{ paddingVertical: 10, gap: 8, minHeight: 44 }}>
        <Text style={{ color: pc.ink, fontWeight: "600", lineHeight: 22 }}>{scoring.consent ? "☑" : "☐"} Allow this recording to be sent to Microsoft Azure for English pronunciation assessment.</Text>
        <Text style={p.caption}>Up to 30 seconds. This feature does not save audio or scores to your learning history. Leave unchecked for device-only word practice. Microsoft processes recordings under your app operator’s Azure terms.</Text>
      </Pressable>}
    </View>
    <View style={p.card}><View style={p.row}><Text style={p.eyebrow}>Say it, one word at a time</Text><View style={p.chip}><Text style={p.chipText}>{activity.language === "english" ? "English" : "Tagalog"}</Text></View></View>
      <Text accessibilityRole="header" style={p.heading}>Speak the highlighted phrase</Text>
      <Text style={p.body}>Press Record and read the sentence aloud. Green means speech recognition matched the word; red means it heard a different word or the word was missing after recognition finishes.</Text>
      <View accessibilityLabel={`Practice phrase: ${activity.target_text}`} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {words.map((word, index) => {
          const match = wordMatches[index] ?? "pending";
          const matched = match === "matched", mismatched = match === "mismatched";
          return <View key={index} accessibilityLabel={`${word}: ${matched ? "heard" : mismatched ? "not matched" : "not yet heard"}`} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 2,
            backgroundColor: matched ? pc.aqua : mismatched ? "#FDECEA" : pc.soft,
            borderColor: matched ? pc.teal : mismatched ? "#B3261E" : index === nextPendingWord && listening ? pc.rose : pc.soft }}>
            <Text style={{ color: matched ? pc.teal : mismatched ? "#B3261E" : pc.ink, fontSize: 23, fontWeight: "600" }}>{matched ? "✓ " : mismatched ? "× " : ""}{word}</Text>
          </View>;
        })}
      </View>
      <Text style={p.caption}>{matchedWords} of {words.length} words matched</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button secondary label="Listen to phrase" disabled={live} onPress={() => { void speech.play(activity.target_text); }} />
        <Button secondary label="Listen slowly" disabled={live} onPress={() => { void speech.play(activity.target_text, true); }} />
      </View>
      {!!speech.error && <ErrorMessage message={speech.error} />}
    </View>
    <View style={p.card}>
      <View accessibilityLiveRegion="polite"><Text style={{ color: complete ? pc.teal : pc.ink, fontSize: 19, fontWeight: "700" }}>{guidedSubmissionMode
        ? submitting ? "Submitting recording…" : submissionResult ? "✓ Recording submitted." : listening ? "● Recording in progress…" : waiting || (complete && !tracking.settled) ? "Finishing recognition…" : tracking.recording && tracking.settled ? "Recording ready to submit." : tracking.status === "error" ? "Speech recognition needs attention." : "Ready when you are."
        : complete ? "✓ Phrase complete!" : listening ? "● Listening…" : tracking.status === "starting" ? "Preparing microphone…" : tracking.status === "stopping" ? "Finishing recognition…" : tracking.status === "paused" ? scoring.simulationEnabled ? "Recording finished. Your score is ready." : scoring.permitted ? "Recording finished. Ready to assess." : "Not finished yet — try the phrase again." : "Ready when you are."}</Text></View>
      {!!tracking.transcript && <View style={p.note}><Text style={p.eyebrow}>What was heard</Text><Text style={p.body}>{tracking.transcript}</Text></View>}
      {!!tracking.error && <ErrorMessage message={tracking.error} />}
      {((Platform.OS === "web" && !!tracking.error) || (Platform.OS === "android" && (needsOfflineSpeechSetup || offlineSetupPending))) && <Button secondary label={settingUp ? "Setting up offline speech…" : offlineSetupPending ? "Check offline speech" : "Set up offline speech"} disabled={settingUp} onPress={() => { void setup(); }} />}
      {!!setupMessage && <Text accessibilityLiveRegion="polite" style={p.body}>{setupMessage}</Text>}
      {!!submissionError && <ErrorMessage message={submissionError} />}
      {guidedSubmissionMode ? <>
        {listening ? <Button icon="■" label="Finish recording" disabled={submitting} onPress={() => tracking.stop()} />
          : waiting || (complete && !tracking.settled) ? <Button label="Please wait…" disabled onPress={() => {}} />
            : <>
              {tracking.recording && tracking.settled && !submissionResult && <Button label={submitting ? "Submitting recording…" : "Submit recording"} disabled={submitting || !api} onPress={() => { void submitRecording(); }} />}
              <Button secondary label={tracking.recording ? "Record again" : "Record"} disabled={submitting || speech.speaking || settingUp} onPress={record} />
              {tracking.recording && <Button secondary label="Choose another phrase" disabled={submitting} onPress={onDone} />}
            </>}
      </> : complete ? <><Text style={p.body}>{scoring.simulationEnabled ? "Every word was recognized. Your practice result is ready below." : scoring.permitted ? "Every word was recognized. The full recording is assessed after recording has stopped." : "Every word was recognized. No pronunciation score has been calculated."}</Text><Button label="Choose another phrase" disabled={scoring.assessing} onPress={onDone} /><Button secondary label="Practise again" disabled={!tracking.settled || scoring.assessing} onPress={record} /></>
        : <Button icon={listening ? "■" : "♩"} label={listening ? "Finish recording" : waiting ? "Please wait…" : tracking.status === "idle" ? "Record" : "Record again"} disabled={waiting || speech.speaking || settingUp || scoring.assessing} onPress={() => { if (listening) tracking.stop(); else record(); }} />}
      {tracking.status === "paused" && tracking.settled && tracking.recording && scoring.permitted && !scoring.result && !scoring.error
        && <><Text style={p.body}>If you finished the sentence, assess this complete recording. The provider checks missing or mispronounced words independently of the live highlights.</Text><Button label="Assess whole recording" disabled={scoring.assessing} onPress={() => { if (tracking.recording) void scoring.assess(tracking.recording); }} /></>}
      <Text style={p.caption}>{guidedSubmissionMode
        ? "Words show speech-recognition matches, not acoustic pronunciation grades. A numeric score appears only if FLUENTT returns one after submission."
        : scoring.simulationEnabled ? "Your voice is processed on this device. Recordings and scores are not saved."
          : scoring.permitted ? "Your full recording is sent only after it ends. No scores are calculated from interim text or green-word counts."
            : "Live recognition uses an installed offline speech language. Without assessment permission, audio stays on this device. Word recognition is not a pronunciation score."}</Text>
    </View>
    {guidedSubmissionMode && submissionResult && <View style={p.card} accessibilityLiveRegion="polite">
      <Text style={p.eyebrow}>Recording assessment</Text>
      <Text accessibilityRole="header" style={p.heading}>Overall pronunciation score</Text>
      <Text style={p.metricValue}>{submittedScore === null ? "Score unavailable" : `${submittedScore.toFixed(1)} / 100`}</Text>
      <Text style={p.body}>{submittedFeedback || `The service returned no numeric score. Status: ${submissionResult.scoring_status}.`}</Text>
      {submittedOutputIsSimulated && <Text style={p.caption}>This response includes simulated model output.</Text>}
    </View>}
    {!guidedSubmissionMode && scoring.assessing && <View accessibilityLiveRegion="polite" style={p.card}><Text style={p.heading}>Assessing your whole sentence…</Text><Text style={p.body}>Listening to the complete recording, not scoring words as you speak.</Text></View>}
    {!guidedSubmissionMode && !!scoring.error && <ErrorMessage message={scoring.error} />}
    {!guidedSubmissionMode && <HistorySaveNotice error={journal.error} retry={journal.retry} />}
    {!guidedSubmissionMode && scoring.result && <View style={p.card} accessibilityLiveRegion="polite">
      <Text style={p.eyebrow}>Pronunciation Assessment</Text>
      <Text accessibilityRole="header" style={p.heading}>Overall pronunciation score</Text>
      <Text style={p.metricValue}>{"kind" in scoring.result ? scoring.result.overall_score : scoring.result.overall_score.toFixed(1)} / 100</Text>
      {"kind" in scoring.result ? <Text style={p.caption}>This is a simulated practice result.</Text> : <>
        <View style={p.grid}>{[
          ["Accuracy", scoring.result.accuracy_score], ["Fluency", scoring.result.fluency_score], ["Completeness", scoring.result.completeness_score],
        ].map(([label, value]) => <View key={label} style={p.chip}><Text style={p.chipText}>{label}: {Number(value).toFixed(1)}</Text></View>)}</View>
        <Text style={p.caption}>One provider assessment of the whole recording. Scores are learning feedback, not certification or a research outcome.</Text>
      </>}
    </View>}
  </View>;
}
