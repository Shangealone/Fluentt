import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { PronunciationAccess, PronunciationActivityView } from "../../services/api/pronunciation";
import { Button, ErrorMessage } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import { useLessonSpeech } from "../learning/useLessonSpeech";
import { useLiveWordTracking } from "./useLiveWordTracking";
import { prepareOfflineSpeech } from "./liveSpeech";
import { useWholePhraseAssessment } from "./useWholePhraseAssessment";
import type { PersonalHistoryAccess } from "../../services/api/personalHistory";
import { useActivityHistory } from "../history/useActivityHistory";
import { HistorySaveNotice } from "../history/HistorySaveNotice";

export function LivePronunciationPractice({ activity, api, onDone, history, owner }: { activity: PronunciationActivityView; api?: PronunciationAccess; onDone: () => void; history?: PersonalHistoryAccess; owner?: string }) {
  const journal = useActivityHistory(history, owner);
  const recordHistory = journal.recordOnce;
  const [run, setRun] = useState(0);
  const speech = useLessonSpeech(activity.language, activity.id);
  const scoring = useWholePhraseAssessment(activity, api);
  const tracking = useLiveWordTracking(activity.target_text, activity.language, scoring.permitted);
  const [settingUp, setSettingUp] = useState(false), [setupMessage, setSetupMessage] = useState("");
  const words = activity.target_text.match(/[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu) ?? [];
  const listening = tracking.status === "listening", waiting = tracking.status === "starting" || tracking.status === "stopping", complete = tracking.status === "complete";
  const live = listening || waiting;
  const assessWholeRecording = scoring.assess;
  const record = () => { scoring.reset(); void speech.stop().then(stopped => { if (stopped) { setRun(value => value + 1); return tracking.start(); } }); };
  useEffect(() => {
    if ((complete || scoring.result) && tracking.settled) recordHistory(`phrase-${run}`, { kind: "voice_phrase", source_id: activity.id, content_version: activity.version, title: "Pronunciation practice", prompt: activity.target_text, language: activity.language });
  }, [complete, scoring.result, tracking.settled, recordHistory, run, activity]);
  useEffect(() => {
    if (complete && tracking.settled && tracking.recording) void assessWholeRecording(tracking.recording);
  }, [complete, tracking.settled, tracking.recording, assessWholeRecording]);
  const setup = async () => {
    setSettingUp(true); setSetupMessage("");
    try { await prepareOfflineSpeech(activity.language); setSetupMessage("Offline speech is ready. Press Record again."); }
    catch (cause) { setSetupMessage(cause instanceof Error ? cause.message : "Offline speech setup failed. Please retry."); }
    finally { setSettingUp(false); }
  };
  return <View style={{ gap: 18 }}>
    <View style={p.note}>
      <Text style={p.eyebrow}>Whole-sentence assessment</Text>
      <Text style={p.body}>{activity.language === "tagalog" ? "Genuine Tagalog pronunciation scoring is not supported by this provider. You can still practise and follow the live words; no pronunciation score is generated."
        : scoring.capability?.available ? "After you finish, Azure can assess your complete recording together. Green words only mean they were recognized; they are not individual pronunciation scores."
        : "Genuine English scoring needs a configured Azure Speech connection. Local word practice still works, but no pronunciation score is generated until the connection is enabled."}</Text>
      {scoring.capability?.available && <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow Microsoft Azure to assess this English recording"
        accessibilityState={{ checked: scoring.consent, disabled: live || scoring.assessing }} disabled={live || scoring.assessing}
        onPress={() => { scoring.reset(); scoring.setConsent(!scoring.consent); }} style={{ paddingVertical: 10, gap: 8, minHeight: 44 }}>
        <Text style={{ color: pc.ink, fontWeight: "600", lineHeight: 22 }}>{scoring.consent ? "☑" : "☐"} Allow this recording to be sent to Microsoft Azure for English pronunciation assessment.</Text>
        <Text style={p.caption}>Up to 30 seconds. This feature does not save audio or scores to your learning history. Leave unchecked for device-only word practice. Microsoft processes recordings under your app operator’s Azure terms.</Text>
      </Pressable>}
    </View>
    <View style={p.card}><View style={p.row}><Text style={p.eyebrow}>Say it, one word at a time</Text><View style={p.chip}><Text style={p.chipText}>{activity.language === "english" ? "English" : "Tagalog"}</Text></View></View>
      <Text accessibilityRole="header" style={p.heading}>Speak the highlighted phrase</Text>
      <Text style={p.body}>Press Record and read the sentence aloud. Words turn green as they are heard. Keep going until the whole phrase is complete.</Text>
      <View accessibilityLabel={`Practice phrase: ${activity.target_text}`} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {words.map((word, index) => <View key={index} accessibilityLabel={`${word}: ${index < tracking.count ? "heard" : "not yet heard"}`} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 2,
          backgroundColor: index < tracking.count ? pc.aqua : pc.soft, borderColor: index < tracking.count ? pc.teal : index === tracking.count && listening ? pc.rose : pc.soft }}>
          <Text style={{ color: index < tracking.count ? pc.teal : pc.ink, fontSize: 23, fontWeight: "600" }}>{index < tracking.count ? "✓ " : ""}{word}</Text>
        </View>)}
      </View>
      <Text style={p.caption}>{tracking.count} of {words.length} words heard</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button secondary label="Listen to phrase" disabled={live} onPress={() => { void speech.play(activity.target_text); }} />
        <Button secondary label="Listen slowly" disabled={live} onPress={() => { void speech.play(activity.target_text, true); }} />
      </View>
      {!!speech.error && <ErrorMessage message={speech.error} />}
    </View>
    <View style={p.card}>
      <View accessibilityLiveRegion="polite"><Text style={{ color: complete ? pc.teal : pc.ink, fontSize: 19, fontWeight: "700" }}>{complete ? "✓ Phrase complete!" : listening ? "● Listening…" : tracking.status === "starting" ? "Preparing microphone…" : tracking.status === "stopping" ? "Finishing recognition…" : tracking.status === "paused" ? scoring.permitted ? "Recording finished. Ready to assess." : "Not finished yet — try the phrase again." : "Ready when you are."}</Text></View>
      {!!tracking.transcript && <View style={p.note}><Text style={p.eyebrow}>What was heard</Text><Text style={p.body}>{tracking.transcript}</Text></View>}
      {!!tracking.error && <ErrorMessage message={tracking.error} />}
      {Platform.OS === "web" && !!tracking.error && <Button secondary label={settingUp ? "Setting up offline speech…" : "Set up offline speech"} disabled={settingUp} onPress={() => { void setup(); }} />}
      {!!setupMessage && <Text accessibilityLiveRegion="polite" style={p.body}>{setupMessage}</Text>}
      {complete ? <><Text style={p.body}>{scoring.permitted ? "Every word was recognized. The full recording is assessed after recording has stopped." : "Every word was recognized. No pronunciation score has been calculated."}</Text><Button label="Choose another phrase" disabled={scoring.assessing} onPress={onDone} /><Button secondary label="Practise again" disabled={!tracking.settled || scoring.assessing} onPress={record} /></>
        : <Button icon={listening ? "■" : "♩"} label={listening ? "Finish recording" : waiting ? "Please wait…" : tracking.status === "idle" ? "Record" : "Record again"} disabled={waiting || speech.speaking || settingUp || scoring.assessing} onPress={() => { if (listening) tracking.stop(); else record(); }} />}
      {tracking.status === "paused" && tracking.settled && tracking.recording && scoring.permitted && !scoring.result && !scoring.error
        && <><Text style={p.body}>If you finished the sentence, assess this complete recording. The provider checks missing or mispronounced words independently of the live highlights.</Text><Button label="Assess whole recording" disabled={scoring.assessing} onPress={() => { if (tracking.recording) void scoring.assess(tracking.recording); }} /></>}
      <Text style={p.caption}>{scoring.permitted ? "Your full recording is sent only after it ends. No scores are calculated from interim text or green-word counts." : "Live recognition uses an installed offline speech language. Without assessment permission, audio stays on this device. Word recognition is not a pronunciation score."}</Text>
    </View>
    {scoring.assessing && <View accessibilityLiveRegion="polite" style={p.card}><Text style={p.heading}>Assessing your whole sentence…</Text><Text style={p.body}>Listening to the complete recording, not scoring words as you speak.</Text></View>}
    {!!scoring.error && <ErrorMessage message={scoring.error} />}
    <HistorySaveNotice error={journal.error} retry={journal.retry} />
    {scoring.result && <View style={p.card} accessibilityLiveRegion="polite">
      <Text style={p.eyebrow}>Azure Speech · English · Full recording</Text>
      <Text accessibilityRole="header" style={p.heading}>Overall pronunciation score</Text>
      <Text style={p.metricValue}>{scoring.result.overall_score.toFixed(1)} / 100</Text>
      <View style={p.grid}>{[
        ["Accuracy", scoring.result.accuracy_score], ["Fluency", scoring.result.fluency_score], ["Completeness", scoring.result.completeness_score],
      ].map(([label, value]) => <View key={label} style={p.chip}><Text style={p.chipText}>{label}: {Number(value).toFixed(1)}</Text></View>)}</View>
      <Text style={p.caption}>One provider assessment of the whole recording. Scores are learning feedback, not certification or a research outcome.</Text>
    </View>}
  </View>;
}
