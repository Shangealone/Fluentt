import { useState, useRef, useEffect, useCallback } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { parseFocus } from "../features/preferences/LearningFocusFields";
import { LearningPreferencesView } from "../features/preferences/LearningPreferencesView";
import { useSession } from "../session/provider";
import { validLearningFocus, type LearningFocus } from "../services/api/identity";

function fieldError(lines: string[]) {
  if (lines.length > 10) return "Keep this list to 10 requests or fewer.";
  if (lines.some(line => Array.from(line).length > 120)) return "Keep each request to 120 characters or fewer.";
  if (new Set(lines).size !== lines.length) return "Each request should be different. Remove the repeated line.";
  return "";
}

export default function Preferences() {
  const { profile } = useSession();
  if (profile?.role !== "personal_student") return null;
  return <PreferenceEditor key={profile.id} initial={profile.learning_focus} />;
}

function PreferenceEditor({ initial }: { initial: LearningFocus | null | undefined }) {
  const session = useSession();
  const [topics, setTopics] = useState(initial?.topics.join("\n") ?? "");
  const [lessons, setLessons] = useState(initial?.lessons.join("\n") ?? "");
  const language = session.profile?.language ?? null;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const active = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    active.current = true;
    setBusy(lock.current);
    return () => { active.current = false; generation.current += 1; };
  }, []));
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => subscription.remove();
  }, []);
  const focus = parseFocus(topics, lessons);
  const valid = validLearningFocus(focus) && language !== null;
  const navigate = (action: () => void) => { if (!lock.current) action(); };
  const save = async () => {
    if (lock.current || !active.current || !valid || language === null) return;
    lock.current = true; setBusy(true); setError("");
    const request = generation.current;
    try {
      await session.save({ learning_focus: focus, language });
      if (active.current && request === generation.current) {
        if (router.canGoBack()) router.back(); else router.replace("/student");
      }
    } catch (cause) {
      if (active.current && request === generation.current) setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  };
  return <LearningPreferencesView topics={topics} lessons={lessons} language={language} valid={valid} busy={busy} error={error}
    topicsError={fieldError(focus.topics)} lessonsError={fieldError(focus.lessons)}
    onTopics={value => { if (!lock.current) { setTopics(value); setError(""); } }}
    onLessons={value => { if (!lock.current) { setLessons(value); setError(""); } }}
    onBack={() => navigate(() => { if (router.canGoBack()) router.back(); else router.replace("/student"); })}
    onAccount={() => navigate(() => router.push("/account"))} onLanguage={() => navigate(() => router.push("/language"))}
    onSave={() => { void save(); }} />;
}
