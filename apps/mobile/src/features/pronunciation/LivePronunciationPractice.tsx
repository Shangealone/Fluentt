import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import type { PronunciationAccess, PronunciationActivityView, PronunciationAttemptSubmission } from "../../services/api/pronunciation";
import { homeColors as c } from "../../theme/personal";
import { PersonalIcon } from "../../components/PersonalIcon";
import { PracticeButton, PracticeNotice } from "./PracticeUI";
import { practiceStyles as s } from "./practiceStyles";
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

export function LivePronunciationPractice({ activity, api, onDone, history, owner, guidedSubmissionMode = false, onBusyChange }: {
  activity: PronunciationActivityView;
  api?: PronunciationAccess;
  onDone: () => void;
  history?: PersonalHistoryAccess;
  owner?: string;
  guidedSubmissionMode?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const viewGeneration = useRef(0);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    viewGeneration.current++;
    return () => { focused.current = false; viewGeneration.current++; };
  }, []));
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
    const generation = viewGeneration.current;
    setSubmitting(true); setSubmissionError(""); setSubmissionResult(null);
    try {
      const result = await api.submitAttempt(activity.id, recording.audio, recording.durationMs);
      if (focused.current && generation === viewGeneration.current) setSubmissionResult(result);
      try { await recording.release(); } catch { /* The API result remains usable if cache cleanup fails. */ }
    } catch (cause) {
      if (focused.current && generation === viewGeneration.current) setSubmissionError(cause instanceof Error ? cause.message : "The recording could not be submitted. Please retry.");
    } finally {
      if (focused.current && generation === viewGeneration.current) setSubmitting(false);
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
  const busy = live || submitting || scoring.assessing || settingUp || speech.speaking || (complete && !tracking.settled);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const personalScore = validScore(scoring.result?.overall_score);
  const scoringAvailable = !scoring.simulationEnabled && scoring.capability?.available === true && activity.language === "english" && !!api?.assessWholePhrase;
  const consentDisabled = busy || !scoringAvailable;
  const finished = tracking.settled && (complete || tracking.status === "paused");
  const resultVisible = guidedSubmissionMode ? !!submissionResult : !!scoring.result;
  const primaryLabel = submitting ? "Submitting recording…" : scoring.assessing ? "Checking your recording…" : listening ? "Finish recording" : waiting || (complete && !tracking.settled) ? "Please wait…" : finished ? "Try again" : tracking.status === "idle" ? "Start recording" : "Record again";
  const notice = (message: string) => message.replace(/Microsoft Azure|Azure Speech|Azure|WavLM|wav2vec2/gi, "the speech service");
  return <View style={{ gap: 16 }}>
    <View style={s.card}>
      <View style={s.row}><Text accessibilityRole="header" style={s.heading}>Say this phrase</Text><View style={s.badge}><Text style={s.badgeText}>{activity.language === "english" ? "English" : "Tagalog"}</Text></View></View>
      <View accessibilityLabel={`Practice phrase: ${activity.target_text}`} style={s.words}>
        {words.map((word, index) => {
          const match = wordMatches[index] ?? "pending";
          const matched = match === "matched", mismatched = match === "mismatched";
          return <View key={index} accessibilityLabel={`${word}: ${matched ? "word matched" : mismatched ? "try this word again" : "not yet heard"}`} style={[s.word, matched && s.matched, mismatched && s.retryWord, index === nextPendingWord && listening && { borderColor: c.teal }]}>
            <Text style={[s.wordText, matched && s.greenText, mismatched && s.retryText]}>{matched ? "✓ " : mismatched ? "↻ " : ""}{word}</Text>
          </View>;
        })}
      </View>
      <Text style={s.small}>{matchedWords} of {words.length} words matched</Text>
      <View style={s.legend}><Text style={s.legendText}>✓ Word matched</Text><Text style={[s.legendText, s.retryText]}>↻ Try this word again</Text></View>
      <View style={s.actions}>
        <PracticeButton secondary grow label="Listen" disabled={live || submitting || scoring.assessing} icon="voice" onPress={() => { void speech.play(activity.target_text); }} />
        <PracticeButton secondary grow label="Listen slowly" disabled={live || submitting || scoring.assessing} icon="voice" onPress={() => { void speech.play(activity.target_text, true); }} />
      </View>
      {!!speech.error && <PracticeNotice error message={notice(speech.error)} />}
    </View>
    <View style={s.status} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={[s.heading, s.centered]}>{submitting ? "Submitting recording…" : scoring.assessing ? "Checking your recording…" : submissionResult ? "Recording submitted" : resultVisible || finished ? "Recording finished" : listening ? "Listening…" : waiting ? "Preparing your recording…" : "Ready when you are"}</Text>
      <Text style={[s.body, s.centered]}>{live ? "Read the phrase aloud at your own pace." : submitting || scoring.assessing ? "This may take a moment." : finished ? guidedSubmissionMode && !submissionResult ? "Your recording is ready to submit." : "A little practice goes a long way." : "Find a quiet spot and speak clearly."}</Text>
    </View>
    {!!tracking.error && <PracticeNotice error message={notice(tracking.error)} />}
    {((Platform.OS === "web" && !!tracking.error) || (Platform.OS === "android" && (needsOfflineSpeechSetup || offlineSetupPending))) && <PracticeButton secondary label={settingUp ? "Setting up speech…" : offlineSetupPending ? "Check speech setup" : "Set up speech"} disabled={settingUp || live || submitting || scoring.assessing} busy={settingUp} onPress={() => { void setup(); }} />}
    {!!setupMessage && <PracticeNotice message={notice(setupMessage)} />}
    {!finished && !live && !resultVisible && <PracticeNotice message="Your microphone is needed to record your voice." />}
    {!guidedSubmissionMode && !finished && !resultVisible && <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow this recording to be sent for a pronunciation score" accessibilityHint={!scoringAvailable ? "Unavailable until pronunciation scoring is ready" : "Optional"} accessibilityState={{ checked: scoring.consent, disabled: consentDisabled }} disabled={consentDisabled}
        onPress={() => { scoring.reset(); scoring.setConsent(!scoring.consent); }} style={s.consent}>
        <View style={[s.checkbox, consentDisabled && s.disabled, scoring.consent && { backgroundColor: c.teal }]}>{scoring.consent && <Text style={{ color: "#FFFFFF", fontSize: 14 }}>✓</Text>}</View>
        <View style={{ flex: 1, gap: 3 }}><Text style={s.consentText}>Allow this recording to be sent for a pronunciation score.</Text><Text style={s.small}>Optional. You can still practice without requesting a score.</Text></View>
      </Pressable>
      {!scoringAvailable && <Text accessibilityLiveRegion="polite" style={s.small}>{!scoring.capability && !scoring.error && !scoring.simulationEnabled && api?.scoringCapabilities ? "Checking pronunciation scoring…" : "Pronunciation scoring isn’t available right now. You can still practice words."}</Text>}
    </View>}
    {!!submissionError && <PracticeNotice error message={notice(submissionError)} />}
    {guidedSubmissionMode && submissionResult && <View style={s.card} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={s.heading}>Your pronunciation result</Text>
      {submittedScore === null ? <PracticeNotice message="A pronunciation score isn’t available for this recording." /> : <Text style={s.score}>{submittedScore.toFixed(1)}<Text style={s.denominator}> /100</Text></Text>}
      {!!submittedFeedback && <Text style={s.body}>{notice(submittedFeedback)}</Text>}
      {submittedOutputIsSimulated && <Text style={s.small}>This response includes simulated output.</Text>}
      <Text style={s.small}>Word matches show what was heard. A pronunciation score checks how the full phrase was spoken.</Text>
    </View>}
    {!guidedSubmissionMode && !!scoring.error && <PracticeNotice error message={notice(scoring.error)} />}
    {!guidedSubmissionMode && <HistorySaveNotice error={journal.error} retry={journal.retry} />}
    {!guidedSubmissionMode && scoring.result && <View style={s.card} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={s.heading}>Your pronunciation result</Text>
      {personalScore === null ? <PracticeNotice message="A pronunciation score isn’t available for this recording." /> : <View style={s.row}><Text style={s.score}>{personalScore.toFixed(1)}<Text style={s.denominator}> /100</Text></Text><Text style={s.small}>For your full recording</Text></View>}
      {"kind" in scoring.result ? <Text style={s.small}>This is a simulated practice result.</Text> : <View style={s.actions}>{[
        ["Accuracy", scoring.result.accuracy_score], ["Fluency", scoring.result.fluency_score], ["Completeness", scoring.result.completeness_score],
      ].map(([label, value]) => <View key={label} style={s.badge}><Text style={s.badgeText}>{label}: {Number(value).toFixed(1)}</Text></View>)}</View>}
      <Text style={s.small}>Word matches show what was heard. The pronunciation score checks how the full phrase was spoken.</Text>
    </View>}
    {!guidedSubmissionMode && finished && !scoring.result && !scoring.assessing && !scoring.permitted && !scoring.simulationEnabled && <PracticeNotice message="A pronunciation score isn’t available for this recording. You can still practice and check which words matched." />}
    {guidedSubmissionMode && tracking.recording && tracking.settled && !submissionResult && <PracticeButton label={submitting ? "Submitting recording…" : "Submit recording"} busy={submitting} disabled={submitting || !api || live || settingUp} onPress={() => { void submitRecording(); }} />}
    <PracticeButton label={primaryLabel} busy={waiting || submitting || scoring.assessing} icon="voice" secondary={guidedSubmissionMode && !!tracking.recording && !listening}
      disabled={waiting || speech.speaking || settingUp || submitting || scoring.assessing || (complete && !tracking.settled)}
      onPress={() => { if (listening) tracking.stop(); else record(); }} />
    {!guidedSubmissionMode && tracking.status === "paused" && tracking.settled && tracking.recording && scoring.permitted && !scoring.result && !scoring.error && <PracticeButton label="Check pronunciation" disabled={scoring.assessing} onPress={() => { if (tracking.recording) void scoring.assess(tracking.recording); }} />}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onDone} style={[s.quiet, busy && s.disabled]}><Text style={s.quietText}>{finished || resultVisible ? "Choose another phrase" : "Change phrase"}</Text></Pressable>
    <View style={s.disclosure}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(value => !value)} style={s.disclosureButton}><View style={{ transform: [{ rotate: helpOpen ? "180deg" : "0deg" }] }}><PersonalIcon name="chevron" size={16} /></View><Text style={s.quietText}>How practice works</Text></Pressable>
      {helpOpen && <View style={{ gap: 12 }}>
        <Text style={s.body}>Listen to the phrase, then read it aloud. A check means a word matched what was heard. A retry symbol means the word didn’t match or wasn’t heard.</Text>
        {!!tracking.transcript && <View style={s.notice}><Text style={s.eyebrow}>What was heard</Text><Text style={s.body}>{tracking.transcript}</Text></View>}
        <Text style={s.body}>Word matches are different from pronunciation scores. Scores appear only when the scoring service provides a result.</Text>
        <Text style={s.body}>{guidedSubmissionMode ? "Your recording is sent to Fluentt only when you tap Submit recording. A score appears only if the service returns one." : scoring.simulationEnabled ? "Your voice is processed on this device. Recordings and scores are not saved. Practice scores in this mode are simulated." : scoring.capability?.available ? "Optional scoring sends your full recording after it ends, up to 30 seconds. This feature does not save the audio or score to your learning history. Your app operator’s processing terms apply." : "Pronunciation scoring isn’t currently available for this language. You can still practice words when your device supports speech recognition."}</Text>
        {!guidedSubmissionMode && !scoring.simulationEnabled && <Text style={s.body}>Without scoring permission, word practice uses your device’s offline speech service. Word matches are practice feedback, not grades.</Text>}
      </View>}
    </View>
  </View>;
}
