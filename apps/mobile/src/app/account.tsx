import { Text, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { PersonalScreen } from "../components/PersonalScreen";
import { p } from "../theme/personal";

export default function Account() {
  const session = useSession();
  const [confirm, setConfirm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const profile = session.profile;
  if (!profile) return null;
  const Page = profile.role === "personal_student" ? PersonalScreen : Screen;
  return <Page>
    {profile.role === "personal_student" ? <Text accessibilityRole="header" style={p.title}>My account</Text> : <AppHeader title="My account" back account={false} />}
    <View style={s.card}>
      <Text style={s.heading}>{profile.username}</Text>
      <Text style={s.body}>{profile.role === "personal_student" ? "Personal learner" : profile.role === "school_student" ? "School student" : "Instructor"}</Text>
      <Text style={s.body}>Account state: {profile.profile_status === "active" ? "Setup complete" : "Setup in progress"}</Text>
      {profile.role === "personal_student" && <>
        <Text style={s.body}>Topics: {profile.learning_focus?.topics.join(", ") || "Not selected"}</Text>
        <Text style={s.body}>Lessons: {profile.learning_focus?.lessons.join(", ") || "Not selected"}</Text>
        <Text style={s.body}>Learning language: {profile.language === "english" ? "English" : profile.language === "tagalog" ? "Tagalog" : "Not selected"}</Text>
        {destination(profile) === "/student" && <Button label="Edit learning preferences" secondary onPress={() => router.push("/preferences")} />}
      </>}
      {profile.role !== "personal_student" && <Text style={s.body}>Grade and language come from each class. Personal preference editing is unavailable for this pathway.</Text>}
    </View>
    <Button label={checking ? "Checking account…" : "Refresh account state"} disabled={checking} onPress={() => {
      if (checking) return;
      setChecking(true); setError("");
      void session.refreshProfile().catch((error) => setError(error instanceof Error ? error.message : "Please retry."))
        .finally(() => setChecking(false));
    }} />
    {!!error && <ErrorMessage message={error + " Account details above were last verified earlier."} />}
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Device session</Text>
      <Text style={s.body}>This device stores your access securely. There is no password login or username-based account recovery.</Text>
      {confirm ? <>
        <Text accessibilityRole="alert" style={s.body}>Signing out revokes access on this device. You cannot sign back into this profile using its username. Account recovery is not available.</Text>
        <Button label="Confirm sign out" disabled={checking} onPress={session.logout} />
        <Button label="Keep my session" secondary onPress={() => setConfirm(false)} />
      </> : <Button label="Sign out of this device" secondary disabled={checking} onPress={() => setConfirm(true)} />}
    </View>
  </Page>;
}
