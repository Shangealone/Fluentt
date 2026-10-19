import { useRef, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { LearningFocusFields, parseFocus } from "../features/preferences/LearningFocusFields";
import { validLearningFocus } from "../services/api/identity";
import { useSession } from "../session/provider";

export default function LearningFocusSetup() {
  const session = useSession();
  const [topics, setTopics] = useState(session.profile?.learning_focus?.topics.join("\n") ?? "");
  const [lessons, setLessons] = useState(session.profile?.learning_focus?.lessons.join("\n") ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const focus = parseFocus(topics, lessons);
  return <Screen backDisabled={busy}>
    <AppHeader title="What would you like to learn?" account={false} subtitle="Personal setup · 1 of 2" />
    <Text style={s.body}>Tell us the topics and lessons you need. You do not need to choose a grade.</Text>
    <LearningFocusFields topics={topics} lessons={lessons} onTopics={setTopics} onLessons={setLessons} disabled={busy} />
    {!!error && <ErrorMessage message={error} />}
    <Button icon="→" label={busy ? "Saving…" : "Save and continue"} disabled={busy || !validLearningFocus(focus)} onPress={() => {
      if (lock.current || !validLearningFocus(focus)) return;
      lock.current = true; setBusy(true); setError("");
      void session.save({ learning_focus: focus }).then(() => router.push("/language"))
        .catch(cause => setError(cause instanceof Error ? cause.message : "Please retry."))
        .finally(() => { lock.current = false; setBusy(false); });
    }} />
  </Screen>;
}
