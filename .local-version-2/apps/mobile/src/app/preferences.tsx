import { useState, useRef, useEffect } from "react";
import { BackHandler, Text } from "react-native";
import { router } from "expo-router";
import { Button, ErrorMessage, s } from "../components/ui";
import { PersonalScreen } from "../components/PersonalScreen";
import { p } from "../theme/personal";
import { LearningFocusFields, parseFocus } from "../features/preferences/LearningFocusFields";
import { useSession } from "../session/provider";
import { validLearningFocus } from "../services/api/identity";

export default function Preferences() {
  const session = useSession();
  const [topics, setTopics] = useState(session.profile?.learning_focus?.topics.join("\n") ?? "");
  const [lessons, setLessons] = useState(session.profile?.learning_focus?.lessons.join("\n") ?? "");
  const language = session.profile?.language ?? null;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => subscription.remove();
  }, []);
  const focus = parseFocus(topics, lessons);
  return <PersonalScreen backDisabled={busy}>
    <Text accessibilityRole="header" style={p.title}>Your learning focus</Text>
    <Text style={s.body}>Choose the topics and lessons you need, plus your learning language. Your requests are saved to your profile; they do not create activity or grades.</Text>
    <LearningFocusFields topics={topics} lessons={lessons} onTopics={setTopics} onLessons={setLessons} disabled={busy} />
    <Text accessibilityRole="header" style={s.heading}>◉ Learning language</Text>
    <Text style={s.body}>{language === "english" ? "English" : "Tagalog"}</Text>
    <Button secondary label="Change language or starting level" disabled={busy} onPress={() => router.push("/language")} />
    {!!error && <ErrorMessage message={error} />}
    <Button icon="✓" label={busy ? "Saving preferences…" : "Save preferences"} disabled={busy || !validLearningFocus(focus) || language === null} onPress={() => {
      if (lock.current || !validLearningFocus(focus) || language === null) return;
      lock.current = true; setBusy(true); setError("");
      void session.save({ learning_focus: focus, language }).then(() => { if (router.canGoBack()) router.back(); else router.replace("/student"); })
        .catch(cause => setError(cause instanceof Error ? cause.message : "Please retry."))
        .finally(() => { lock.current = false; setBusy(false); });
    }} />
  </PersonalScreen>;
}
