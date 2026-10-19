import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { AppHeader, UpcomingLearning } from "../components/navigation";
import { LearningBanner } from "../components/LearningBanner";
import { useSession } from "../session/provider";
import { MyClasses } from "../features/enrollment/MyClasses";
import { ProgressOverview } from "../features/progress/ProgressSummary";

export default function Dashboard() {
  const { profile, refreshProfile, progress } = useSession();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  if (!profile) return null;
  const isSchool = profile.role === "school_student";
  return <Screen>
    <AppHeader navigation title={`Hello, ${profile.username}`} subtitle={isSchool ? "My classroom" : "My learning space"} />
    <LearningBanner compact title={isSchool ? "Your next step starts here." : "Make room for learning."} description={isSchool ? "Choose your class below to open assignments, pick up saved work, or talk to your instructor." : "Choose the topics and lessons you need while personal learning activities are being prepared."} />
    {isSchool ? <MyClasses /> : <>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>◎ Your learning focus</Text>
        <Text style={s.body}>Topics: {profile.learning_focus?.topics.join(", ") || "Add the topics you need"}</Text>
        <Text style={s.body}>Lessons: {profile.learning_focus?.lessons.join(", ") || "Add the lessons you need"}</Text>
        <Text style={s.body}>{profile.language === "english" ? "English" : profile.language === "tagalog" ? "Tagalog" : "Language not selected"}</Text>
        <Text style={s.body}>These preferences are saved to your profile. Personal practice and activity tracking are not yet available.</Text>
        <Button label="Edit learning preferences" onPress={() => router.push("/preferences")} />
        <Button label={checking ? "Checking preferences…" : "Refresh preferences"} secondary disabled={checking} onPress={() => {
          if (checking) return;
          setChecking(true); setError("");
          void refreshProfile().catch(err => setError(err instanceof Error ? err.message : "Please retry.")).finally(() => setChecking(false));
        }} />
        {!!error && <ErrorMessage message={`${error} The preferences above were previously verified.`} />}
      </View>
    </>}
    {isSchool && <ProgressOverview api={progress} historyLink />}
    <UpcomingLearning school={isSchool} />
  </Screen>;
}
