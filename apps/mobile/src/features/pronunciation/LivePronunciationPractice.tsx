import { useState } from "react";
import { Platform, Text, View } from "react-native";
import type { PronunciationActivityView } from "../../services/api/pronunciation";
import { Button, ErrorMessage } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import { useLessonSpeech } from "../learning/useLessonSpeech";
import { useLiveWordTracking } from "./useLiveWordTracking";
import { prepareOfflineSpeech } from "./liveSpeech";

export function LivePronunciationPractice({ activity, onDone }: { activity: PronunciationActivityView; onDone: () => void }) {
  const speech = useLessonSpeech(activity.language, activity.id);
  const tracking = useLiveWordTracking(activity.target_text, activity.language);
  const [settingUp, setSettingUp] = useState(false), [setupMessage, setSetupMessage] = useState("");
  const words = activity.target_text.match(/[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu) ?? [];
  const listening = tracking.status === "listening", waiting = tracking.status === "starting" || tracking.status === "stopping", complete = tracking.status === "complete";
  const live = listening || waiting;
  const record = () => { void speech.stop().then(stopped => { if (stopped) return tracking.start(); }); };
  const setup = async () => {
    setSettingUp(true); setSetupMessage("");
    try { await prepareOfflineSpeech(activity.language); setSetupMessage("Offline speech is ready. Press Record again."); }
    catch (cause) { setSetupMessage(cause instanceof Error ? cause.message : "Offline speech setup failed. Please retry."); }
    finally { setSettingUp(false); }
  };
  return <View style={{ gap: 18 }}>
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
      <View accessibilityLiveRegion="polite"><Text style={{ color: complete ? pc.teal : pc.ink, fontSize: 19, fontWeight: "700" }}>{complete ? "✓ Phrase complete!" : listening ? "● Listening…" : tracking.status === "starting" ? "Preparing microphone…" : tracking.status === "stopping" ? "Finishing recognition…" : tracking.status === "paused" ? "Not finished yet — try the phrase again." : "Ready when you are."}</Text></View>
      {!!tracking.transcript && <View style={p.note}><Text style={p.eyebrow}>What was heard</Text><Text style={p.body}>{tracking.transcript}</Text></View>}
      {!!tracking.error && <ErrorMessage message={tracking.error} />}
      {Platform.OS === "web" && !!tracking.error && <Button secondary label={settingUp ? "Setting up offline speech…" : "Set up offline speech"} disabled={settingUp} onPress={() => { void setup(); }} />}
      {!!setupMessage && <Text accessibilityLiveRegion="polite" style={p.body}>{setupMessage}</Text>}
      {complete ? <><Text style={p.body}>You said every word in order. Nice practice!</Text><Button label="Choose another phrase" onPress={onDone} /><Button secondary label="Practise again" disabled={!tracking.settled} onPress={record} /></>
        : <Button icon={listening ? "■" : "♩"} label={listening ? "Stop recording" : waiting ? "Please wait…" : tracking.status === "idle" ? "Record" : "Record again"} disabled={waiting || speech.speaking || settingUp} onPress={() => { if (listening) tracking.stop(); else record(); }} />}
      <Text style={p.caption}>Live recognition uses an installed offline speech language. Audio and this completion stay on this device. Word recognition is not a pronunciation score.</Text>
    </View>
  </View>;
}
