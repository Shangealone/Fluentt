import { useCallback, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { parseFocus } from "../features/preferences/LearningFocusFields";
import { LearningFocusSetupView } from "../features/setup/LearningFocusSetupView";
import { validLearningFocus, type LearningFocus } from "../services/api/identity";
import { useSession } from "../session/provider";

function fieldError(lines: string[]) {
  if (lines.length > 10) return "Keep this list to 10 requests or fewer.";
  if (lines.some(line => Array.from(line).length > 120)) return "Keep each request to 120 characters or fewer.";
  if (new Set(lines).size !== lines.length) return "Each request should be different. Remove the repeated line.";
  return "";
}
export default function LearningFocusSetup() {
  const { profile } = useSession();
  if (profile?.role !== "personal_student") return null;
  return <FocusEditor key={profile.id} initial={profile.learning_focus} />;
}
function FocusEditor({ initial }: { initial: LearningFocus | null | undefined }) {
  const session = useSession();
  const [topics, setTopics] = useState(initial?.topics.join("\n") ?? "");
  const [lessons, setLessons] = useState(initial?.lessons.join("\n") ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), active = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    active.current = true;
    setBusy(lock.current);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => { active.current = false; generation.current++; subscription.remove(); };
  }, []));
  const focus = parseFocus(topics, lessons);
  const valid = validLearningFocus(focus);
  async function save() {
    if (lock.current || !active.current || !valid) return;
    lock.current = true; setBusy(true); setError("");
    const request = generation.current;
    try {
      await session.save({ learning_focus: focus });
      if (active.current && request === generation.current) router.push("/language");
    } catch (cause) {
      if (active.current && request === generation.current) setError(cause instanceof Error ? cause.message : "Check your connection and try again.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <LearningFocusSetupView topics={topics} lessons={lessons} topicsError={fieldError(focus.topics)} lessonsError={fieldError(focus.lessons)} valid={valid} busy={busy} error={error}
    onTopics={value => { if (!lock.current) { setTopics(value); setError(""); } }}
    onLessons={value => { if (!lock.current) { setLessons(value); setError(""); } }} onSave={() => void save()}
    onBack={() => { if (!lock.current) { if (router.canGoBack()) router.back(); else router.replace("/"); } }}
    onAccount={() => { if (!lock.current) router.push("/account"); }} />;
}
