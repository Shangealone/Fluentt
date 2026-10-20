import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { PersonalScreen } from "../components/PersonalScreen";
import { Button, ErrorMessage } from "../components/ui";
import { useSession } from "../session/provider";
import { experienceLabels, experienceOptions, startingDifficulty, type LearningExperience } from "../services/api/identity";
import { p, pc } from "../theme/personal";

export default function ExperienceSetup() {
  const session = useSession();
  const [value, setValue] = useState<LearningExperience | null>(session.profile?.experience ?? null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  if (!session.profile?.language) return <Redirect href="/language" />;
  const language = session.profile.language === "english" ? "English" : "Tagalog";
  const detail = { starting_fresh: "Start with essential words and guided basics.", some_words: "Build confidence with familiar words and easy activities.", simple_conversations: "Work with sentences and everyday situations.", comfortable: "Try more challenging language activities." };
  return <PersonalScreen backDisabled={busy} eyebrow="Personal setup · 2 of 2" title={`How much ${language} do you know?`} description="There’s no test here. Choose what feels closest to you and we’ll suggest a starting difficulty.">
    <View accessibilityRole="radiogroup" accessibilityLabel="Your experience">{experienceOptions.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityLabel={experienceLabels[option]} accessibilityState={{ checked: value === option, disabled: busy }} aria-checked={value === option} disabled={busy} onPress={() => setValue(option)}
      style={[p.card, { marginBottom: 12, borderColor: value === option ? pc.rose : pc.line, backgroundColor: value === option ? pc.pink : "white" }]}>
      <Text style={[p.heading, { fontSize: 17 }]}>{value === option ? "◉ " : "○ "}{experienceLabels[option]}</Text><Text style={p.body}>{detail[option]}</Text>
    </Pressable>)}</View>
    {value && <Text style={p.body}>Your starting difficulty: {startingDifficulty(value)}. You can change it whenever you like. This is a preference, not a measured proficiency level.</Text>}
    {!!error && <ErrorMessage message={error} />}
    <Button label={busy ? "Saving…" : "Start learning"} disabled={busy || !value} onPress={() => {
      if (lock.current || !value) return;
      lock.current = true; setBusy(true); setError("");
      void session.save({ language: session.profile!.language!, experience: value }).then(() => router.replace("/student"))
        .catch(cause => setError(cause instanceof Error ? cause.message : "Please retry."))
        .finally(() => { lock.current = false; setBusy(false); });
    }} />
    <Button secondary label="Choose another language" disabled={busy} onPress={() => router.push("/language")} />
  </PersonalScreen>;
}
