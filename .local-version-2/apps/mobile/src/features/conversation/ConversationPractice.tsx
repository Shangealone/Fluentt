import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePreventRemove } from "expo-router";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import type { ConversationTopic, ConversationSession, ConversationMessage, ConversationSessionSummary } from "../../services/api/conversation";
import { useAudioRecorder } from "../pronunciation/useAudioRecorder";
import { PracticeButton } from "../pronunciation/PracticeUI";
import { useActivityHistory } from "../history/useActivityHistory";
import { HistorySaveNotice } from "../history/HistorySaveNotice";
import { conversationLevel } from "./levels";
import { ConversationArt, ConversationHelp, ConversationNotice, Disclosure } from "./ConversationUI";
import { cs as s } from "./conversationStyles";
import { homeColors as c } from "../../theme/personal";

export function ConversationPractice({ onDone }: { onDone?: () => void }) {
  const { conversation, pronunciation, profile, activityHistory } = useSession();
  const journal = useActivityHistory(activityHistory, profile?.role === "personal_student" ? profile.id : undefined);
  const personalLanguage = profile?.role === "personal_student" ? profile.language : null;
  const { width, fontScale } = useWindowDimensions();
  const [phase, setPhase] = useState<"topics" | "chat" | "summary">("topics");
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [language, setLanguage] = useState<"all" | "english" | "tagalog">("all");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [ending, setEnding] = useState(false);
  const [error, setError] = useState(""), [leave, setLeave] = useState(false);
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState<ConversationSessionSummary | null>(null);
  const [input, setInput] = useState(""), [mode, setMode] = useState<"text" | "voice">("text");
  const recorder = useAudioRecorder();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scope = useRef({ active: true, generation: 0 }), readGeneration = useRef(0), lock = useRef(false);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const recording = recorder.status === "recording", hasRecording = !!recorder.audioPayload;
  const blocked = busy || ending;
  useEffect(() => {
    const lifecycle = scope.current;
    lifecycle.active = true;
    return () => { lifecycle.active = false; lifecycle.generation++; };
  }, []);
  const current = (generation: number) => scope.current.active && scope.current.generation === generation;
  const loadTopics = useCallback(async () => {
    const generation = ++readGeneration.current;
    setLoading(true); setError(""); setTopics([]);
    try {
      const result = await conversation.topics(personalLanguage ?? (language === "all" ? undefined : language));
      if (scope.current.active && readGeneration.current === generation) setTopics(result.topics.filter(topic => !personalLanguage || topic.language === personalLanguage));
    } catch (cause) {
      if (scope.current.active && readGeneration.current === generation) setError(cause instanceof Error ? cause.message : "We couldn’t load your topics. Please try again.");
    } finally { if (scope.current.active && readGeneration.current === generation) setLoading(false); }
  }, [conversation, personalLanguage, language]);
  useEffect(() => { void loadTopics(); }, [loadTopics]);
  useEffect(() => {
    if (leave) {
      Keyboard.dismiss();
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, leave]);
  useEffect(() => {
    if (phase !== "summary" || blocked || !pendingNavigation.current) return;
    const navigate = pendingNavigation.current; pendingNavigation.current = null; navigate();
  }, [phase, blocked]);
  usePreventRemove(phase === "chat" || blocked, ({ repeat }) => {
    if (lock.current || recording) return;
    pendingNavigation.current = repeat; setLeave(true);
  });
  function navigate(navigation?: () => void) {
    if (lock.current || recording) return;
    if (phase === "chat") { pendingNavigation.current = navigation ?? null; setLeave(true); }
    else if (phase === "summary" && !navigation) backToTopics();
    else (navigation ?? onDone)?.();
  }
  async function startTopic(topicId: string) {
    if (lock.current || !scope.current.active) return;
    lock.current = true; setBusy(true); setError("");
    const generation = ++scope.current.generation;
    try {
      const value = await conversation.startSession(topicId);
      if (!current(generation)) return;
      setSession(value); setMessages([...(value.messages ?? [])]); setInput(""); setMode("text"); setPhase("chat");
    } catch (cause) { if (current(generation)) setError(cause instanceof Error ? cause.message : "We couldn’t start practice. Please try again."); }
    finally { if (current(generation)) { lock.current = false; setBusy(false); } }
  }
  async function finishSession() {
    if (!session || lock.current || recording || !scope.current.active) return;
    lock.current = true; setEnding(true); setError("");
    const generation = scope.current.generation;
    try {
      const value = await conversation.endSession(session.session_id);
      if (!current(generation)) return;
      if (value.turns_completed > 0) journal.recordOnce(`ended-${session.session_id}`, { kind: "tutor_session", source_id: session.session_id, title: session.topic_title, language: session.language === "english" ? "english" : "tagalog" });
      setSummary(value); setLeave(false); setPhase("summary");
    } catch (cause) { if (current(generation)) setError(cause instanceof Error ? cause.message : "We couldn’t finish practice. Please try again."); }
    finally { if (current(generation)) { lock.current = false; setEnding(false); } }
  }
  async function send(voice: boolean) {
    if (!session || lock.current || !scope.current.active || (voice ? !recorder.audioPayload : !input.trim())) return;
    lock.current = true; setBusy(true); setError("");
    const generation = scope.current.generation, text = input.trim();
    try {
      let attemptId: string | null = null;
      if (voice && recorder.audioPayload) {
        const attempt = await pronunciation.submitAttempt(session.topic_id, recorder.audioPayload, recorder.durationMs);
        if (!current(generation)) return;
        attemptId = attempt.attempt_id;
        await recorder.discardRecording();
        if (!current(generation)) return;
      }
      const value = await conversation.sendMessage(session.session_id, voice ? null : text, attemptId);
      if (!current(generation)) return;
      journal.recordOnce(value.user_message.id, { kind: "tutor_reply", source_id: session.session_id, title: session.topic_title, language: session.language === "english" ? "english" : "tagalog" });
      setMessages(previous => [...previous, value.user_message, value.assistant_message]);
      if (!voice) setInput("");
      setSession(previous => previous ? { ...previous, turns_count: value.turns_count, status: value.is_session_complete ? "ended" : previous.status, simulated: value.simulated } : null);
      if (value.is_session_complete) { lock.current = false; await finishSession(); }
    } catch (cause) { if (current(generation)) setError(cause instanceof Error ? cause.message : "Your reply couldn’t be sent. Check the conversation before trying again."); }
    finally { if (current(generation)) { lock.current = false; setBusy(false); } }
  }
  function backToTopics() {
    if (lock.current) return;
    scope.current.generation++; setPhase("topics"); setSession(null); setSummary(null); setMessages([]); setInput(""); setError(""); setLeave(false);
    pendingNavigation.current = null; void recorder.discardRecording(); void loadTopics();
  }
  const statusNotice = session?.simulated ? <ConversationNotice message="Practice replies and tips are currently simulated." /> : null;
  const notices = <>{!!error && <ConversationNotice error message={error} />}<HistorySaveNotice error={journal.error} retry={journal.retry} /></>;
  const leaveCard = leave && <View style={s.card} accessibilityRole="alert"><Text accessibilityRole="header" style={s.heading}>Finish practice?</Text><Text style={s.body}>Your unsent reply won’t be sent.</Text><PracticeButton label="Stay here" disabled={blocked} onPress={() => { pendingNavigation.current = null; setLeave(false); }} /><PracticeButton secondary label={ending ? "Finishing practice…" : "Finish practice"} disabled={blocked || recording} busy={ending} onPress={() => { void finishSession(); }} /></View>;
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={blocked || recording} accessibilityState={{ disabled: blocked || recording }} onPress={() => navigate()} style={[s.circle, s.back, (blocked || recording) && s.disabled]}><PersonalIcon name="chevron" size={18} /></Pressable><FluenttLogo size={32} /><Pressable accessibilityRole="button" accessibilityLabel="My account" disabled={blocked || recording} accessibilityState={{ disabled: blocked || recording }} onPress={() => navigate(() => router.push("/account"))} style={[s.circle, (blocked || recording) && s.disabled]}><PersonalIcon name="account" size={18} /></Pressable></View>
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {phase === "topics" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
        <View style={[s.hero, fontScale > 1.2 && s.stackHero]}><View style={s.copy}><Text accessibilityRole="header" style={s.title}>Let’s start a conversation.</Text></View><ConversationArt /></View><Text style={[s.body, s.muted]}>Choose a topic to practice.</Text>
        {!personalLanguage && <View accessibilityRole="tablist" accessibilityLabel="Topic language" style={s.tabs}>{([ ["all", "All"], ["english", "English"], ["tagalog", "Tagalog"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === language, disabled: busy }} disabled={busy} onPress={() => setLanguage(value)} style={[s.tab, language === value && s.selectedTab]}><Text style={s.label}>{label}</Text></Pressable>)}</View>}
        {notices}
        {loading ? <View style={[s.card, s.state]} accessibilityLiveRegion="polite"><ActivityIndicator color={c.teal} /><Text style={s.body}>Loading your topics…</Text></View> : error && topics.length === 0 ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>We couldn’t load your topics</Text><PracticeButton label="Try again" onPress={() => { void loadTopics(); }} /></View> : !topics.length ? <View style={[s.card, s.state]}><ConversationArt /><Text style={[s.heading, s.centered]}>More topics are on the way</Text><Text style={[s.body, s.muted, s.centered]}>No topics are available for this language yet.</Text></View> : topics.map(topic => <View key={topic.id} style={s.card}><View style={s.row}><View style={s.badge}><Text style={s.badgeText}>{topic.language === "tagalog" ? "Tagalog" : "English"}</Text></View><Text style={s.small}>{conversationLevel(topic.target_level)}</Text></View><Text accessibilityRole="header" style={s.heading}>{topic.title}</Text><Text style={[s.body, s.muted]}>{topic.scenario_description}</Text><Text style={s.small}>Your partner: {topic.persona}</Text><View style={s.goal}><Text style={s.subheading}>Your goal</Text><Text style={s.body}>{topic.goal}</Text></View>{!!topic.vocabulary_hints?.length && <View style={s.stack}><Text style={s.small}>Useful words</Text><View style={s.chips}>{topic.vocabulary_hints.map((hint, index) => <View key={index} style={s.chip}><Text style={s.small}>{hint}</Text></View>)}</View></View>}<PracticeButton label={busy ? "Starting…" : "Start conversation"} disabled={busy} busy={busy} icon="arrow" onPress={() => { void startTopic(topic.id); }} /></View>)}
        <ConversationHelp />
      </ScrollView> : phase === "chat" && session ? leave ? <ScrollView key="finish-confirmation" keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
        {leaveCard}{notices}
      </ScrollView> : <>
        <ScrollView key="conversation-feed" ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.chatContent, width < 360 && s.compact]}>
          <View style={s.stack}><View style={s.row}><View style={s.badge}><Text style={s.badgeText}>{session.language === "tagalog" ? "Tagalog" : "English"}</Text></View><Text style={s.small}>{session.turns_count} of {session.max_turns} replies</Text></View><Text accessibilityRole="header" style={s.heading}>{session.topic_title}</Text><Text style={s.small}>Practicing with {session.persona}</Text><Pressable accessibilityRole="button" disabled={blocked || recording} onPress={() => { pendingNavigation.current = null; setLeave(true); }} style={[s.quiet, (blocked || recording) && s.disabled]}><Text style={s.quietText}>Finish practice</Text></Pressable></View>
          {statusNotice}{notices}
          {messages.map(message => <View key={message.id} style={[s.bubble, message.role === "user" && s.userBubble]}><Text style={s.label}>{message.role === "user" ? "You" : session.persona}</Text>{!!message.audio_attempt_id && <Text style={s.small}>Spoken reply{typeof message.pronunciation_score === "number" && Number.isFinite(message.pronunciation_score) && message.pronunciation_score >= 0 && message.pronunciation_score <= 100 ? ` · Pronunciation: ${Math.round(message.pronunciation_score)}/100` : ""}</Text>}<Text style={s.body}>{message.content}</Text>{message.role === "assistant" && !!message.feedback && <Disclosure title="Practice tips"><Text style={s.small}>{message.feedback.summary}</Text>{message.feedback.politeness_marker_detected && <Text style={s.label}>You used polite words.</Text>}{message.feedback.corrections?.map((tip, index) => <Text key={`c-${index}`} style={s.small}>{tip}</Text>)}{message.feedback.suggestions?.map((tip, index) => <Text key={`s-${index}`} style={s.small}>{tip}</Text>)}{!!message.feedback.uncertainty_notice && <Text style={s.small}>{message.feedback.uncertainty_notice}</Text>}</Disclosure>}</View>)}
          {busy && <View style={s.bubble} accessibilityLiveRegion="polite"><ActivityIndicator color={c.teal} /><Text style={s.small}>Sending your reply…</Text></View>}
          <ConversationHelp />
        </ScrollView>
        {!leave && <View style={[s.composer, width < 360 && s.compact]}><View accessibilityRole="tablist" accessibilityLabel="Reply method" style={s.tabs}>{([ ["text", "Type"], ["voice", "Speak"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === mode, disabled: blocked || recording || hasRecording }} disabled={blocked || recording || hasRecording} onPress={() => setMode(value)} style={[s.tab, mode === value && s.selectedTab]}>{value === "voice" && <PersonalIcon name="voice" size={18} />}<Text style={s.label}>{label}</Text></Pressable>)}</View>
          {mode === "text" ? <><TextInput accessibilityLabel="Your conversation reply" placeholder={session.language === "tagalog" ? "I-type ang iyong sagot…" : "Type your reply…"} placeholderTextColor={c.muted} value={input} onChangeText={setInput} maxLength={1000} multiline editable={!blocked} style={s.input} /><PracticeButton label={busy ? "Sending…" : "Send"} busy={busy} disabled={!input.trim() || blocked} onPress={() => { void send(false); }} /></> : <View style={s.stack}>{!!recorder.error && <ConversationNotice error message={recorder.error} />}<Text style={[s.small, s.centered]}>{recording ? "Recording" : hasRecording ? "Recording ready" : "Your voice, your own pace"} · {(recorder.durationMs / 1000).toFixed(1)}s</Text>{recording ? <PracticeButton label="Finish recording" onPress={() => { void recorder.stopRecording(); }} /> : hasRecording ? <><PracticeButton label={busy ? "Sending recording…" : "Send recording"} busy={busy} disabled={blocked} onPress={() => { void send(true); }} /><PracticeButton secondary label="Record again" disabled={blocked} onPress={() => { void recorder.discardRecording(); }} /></> : <PracticeButton label="Start recording" icon="voice" disabled={blocked} onPress={() => { void recorder.startRecording(); }} />}<Text style={s.small}>{recording ? "Your recording stays here until you send it." : "Sending a recording shares your voice for processing."}</Text></View>}
        </View>}
      </> : <ScrollView contentContainerStyle={[s.content, width < 360 && s.compact]}>
        {notices}<View style={[s.card, s.state]}><ConversationArt complete /><Text accessibilityRole="header" style={[s.title, s.centered]}>Practice finished.</Text><Text style={[s.body, s.muted, s.centered]}>{session?.topic_title}</Text>{summary && <View style={s.badge}><Text style={s.badgeText}>{summary.turns_completed} replies completed</Text></View>}</View>
        {!!summary?.overall_feedback && <View style={s.card}><Text style={s.body}>{summary.overall_feedback}</Text></View>}
        {!!summary?.strengths.length && <View style={s.card}><Text accessibilityRole="header" style={s.heading}>What went well</Text>{summary.strengths.map((tip, index) => <Text key={index} style={s.body}>{tip}</Text>)}</View>}
        {!!summary?.recommendations.length && <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Try next time</Text>{summary.recommendations.map((tip, index) => <Text key={index} style={s.body}>{tip}</Text>)}</View>}
        {statusNotice}<PracticeButton label="Choose another topic" onPress={backToTopics} />{onDone && <PracticeButton secondary label="Back to Home" onPress={onDone} />}<ConversationHelp />
      </ScrollView>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
