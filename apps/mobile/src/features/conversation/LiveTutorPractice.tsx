import { useCallback, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, ErrorMessage } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import { liveTutorApi, type TutorCapability, type TutorMessage } from "../../services/api/liveTutor";
import type { ConversationTopic } from "../../services/api/conversation";
import { useLessonSpeech } from "../learning/useLessonSpeech";
import type { Language } from "../../services/api/identity";

export function LiveTutorPractice({ language, onBack }: { language: Language; onBack: () => void }) {
  const [cap, setCap] = useState<TutorCapability | null>(null), [error, setError] = useState("");
  const [permission, setPermission] = useState(false), [topic, setTopic] = useState<ConversationTopic | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]), [draft, setDraft] = useState("");
  const [coaching, setCoaching] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const active = useRef(false), generation = useRef(0), sending = useRef(false);
  const speech = useLessonSpeech(language, topic?.id ?? "live-tutor");
  useFocusEffect(useCallback(() => {
    active.current = true; generation.current++;
    const clear = () => { generation.current++; sending.current = false; setBusy(false); setLoading(false); setPermission(false); setMessages([]); setDraft(""); setTopic(null); setCoaching(""); setError(""); };
    const background = AppState.addEventListener("change", state => { if (state !== "active") clear(); });
    const hidden = () => { if (typeof document !== "undefined" && document.hidden) clear(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", hidden);
    return () => { active.current = false; clear(); background.remove(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", hidden); };
  }, []));
  const connect = async () => {
    const run = generation.current; setLoading(true); setError(""); setCap(null);
    try { const data = await liveTutorApi.capabilities(); if (active.current && run === generation.current) setCap(data); }
    catch { if (active.current && run === generation.current) setError("Live Tutor is not connected. Start the local backend with Tutor demo enabled and your free Groq key configured, then check again."); }
    finally { if (active.current && run === generation.current) setLoading(false); }
  };
  const choose = (value: ConversationTopic) => { generation.current++; setTopic(value); setMessages([{ role: "assistant", content: value.starter_prompt }]); setCoaching(""); setDraft(""); setError(""); void speech.stop(); };
  const send = async () => {
    if (!topic || !permission || !cap?.available || !draft.trim() || sending.current) return;
    const run = generation.current, text = draft.trim(), pending: TutorMessage[] = [...messages, { role: "user", content: text }];
    sending.current = true; setBusy(true); setError(""); void speech.stop();
    try {
      const value = await liveTutorApi.reply(topic.id, pending);
      if (!active.current || run !== generation.current) return;
      setMessages([...pending, { role: "assistant", content: value.reply }]); setDraft(""); setCoaching(value.coaching);
    } catch (cause) { if (active.current && run === generation.current) setError((cause instanceof Error ? cause.message : "The AI could not reply.") + " Your text is kept below; no scripted replacement was generated."); }
    finally { if (active.current && run === generation.current) { sending.current = false; setBusy(false); } }
  };
  const finished = messages.filter(m => m.role === "user").length >= 9;
  return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <Button secondary label="Back to Tutor modes" onPress={onBack} />
    <View style={p.card}><Text style={p.eyebrow}>Live AI · Laptop demonstration</Text><Text style={p.heading}>A conversation that follows your replies</Text>
      <Text style={p.body}>Choose a setting and practise {language === "english" ? "English" : "Tagalog"}. Groq generates each reply using this conversation. The opening line is authored. AI replies and tips can be mistaken; this is not a language assessment.</Text>
      <Text style={p.caption}>This local demonstration keeps the chat in memory only. It does not create student, classroom, research or learning-history records. Text sent to Groq is processed under its data policy.</Text>
      <Button label={loading ? "Checking connection…" : "Check AI connection"} disabled={loading || busy} onPress={() => { void connect(); }} />
      {cap && <Text style={p.caption}>{cap.available ? "Backend key is configured; the first reply will verify provider access." : "Groq key is missing. Save FLUENTT_TUTOR_GROQ_KEY in the backend .env and restart the API."} Model: {cap.model}</Text>}
    </View>
    {!!error && <ErrorMessage message={error} />}
    {cap?.available && <>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow Groq to process this practice conversation" accessibilityState={{ checked: permission, disabled: busy }} disabled={busy} style={p.note} onPress={() => { setPermission(v => !v); }}><Text style={p.body}>{permission ? "☑" : "☐"} I allow this conversation text to be sent to Groq. I will use fictional details, not personal information.</Text></Pressable>
      {!topic ? cap.topics.filter(t => t.language === language).map(t => <View style={p.card} key={t.id}><Text style={p.heading}>{t.title}</Text><Text style={p.body}>{t.scenario_description}</Text><Text style={p.caption}>{t.persona} · {t.goal}</Text><Button label="Start live conversation" disabled={!permission} onPress={() => choose(t)} /></View>) : <>
        <View style={p.row}><Text style={p.heading}>{topic.persona}</Text><Button secondary label="Change scenario" disabled={busy} onPress={() => { generation.current++; setTopic(null); setMessages([]); setDraft(""); setCoaching(""); void speech.stop(); }} /></View>
        {messages.map((message, i) => <View key={i} style={[p.card, { backgroundColor: message.role === "user" ? pc.aqua : "#ffffff" }]}><Text style={p.eyebrow}>{message.role === "user" ? "You" : i === 0 ? "Partner · Opening line" : "AI partner · Generated reply"}</Text><Text style={p.body}>{message.content}</Text>{message.role === "assistant" && <Button secondary size="sm" label="Listen to reply" disabled={busy} onPress={() => { void speech.play(message.content); }} />}</View>)}
        {!!speech.error && <ErrorMessage message={speech.error} />}
        {!!coaching && <View style={p.note}><Text style={p.eyebrow}>AI practice tip · May be inaccurate</Text><Text style={p.body}>{coaching}</Text></View>}
        {finished ? <Text style={p.body}>Practice finished. Choose another scenario to start a new conversation.</Text> : <View style={p.card}>
          <TextInput accessibilityLabel="Your live AI reply" value={draft} onChangeText={setDraft} editable={!busy && permission} multiline maxLength={1000} placeholder="Type what you would say…" style={{ color: pc.ink, padding: 14, borderWidth: 1, borderColor: pc.line, borderRadius: 14, minHeight: 88 }} />
          <Text style={p.caption}>Reply {messages.filter(m => m.role === "user").length + 1} of 9 · Free service quotas apply. No automatic retries.</Text>
          <Button label={busy ? "AI partner is replying…" : "Send to AI partner"} disabled={!permission || busy || !draft.trim()} onPress={() => { void send(); }} />
        </View>}
      </>}
    </>}
  </ScrollView>;
}
