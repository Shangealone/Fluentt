import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, s } from "../components/ui";
import { AppHeader, UpcomingLearning } from "../components/navigation";
import { LearningBanner } from "../components/LearningBanner";
import { useSession } from "../session/provider";
import { MyClasses } from "../features/enrollment/MyClasses";
import { ProgressOverview } from "../features/progress/ProgressSummary";
import { PathwayOverview } from "../features/dashboard/LearningPathwayView";
import { PersonalHome } from "../features/dashboard/PersonalHome";
import { PersonalScreen } from "../components/PersonalScreen";

export default function Dashboard() {
  const { profile, progress, pathway } = useSession();
  if (!profile) return null;
  const isSchool = profile.role === "school_student";
  if (!isSchool) return <PersonalScreen><PersonalHome /></PersonalScreen>;
  return <Screen>
    <AppHeader navigation title={`Hello, ${profile.username}`} subtitle={isSchool ? "My classroom" : "My learning space"} />
    <LearningBanner compact title={isSchool ? "Your next step starts here." : "Make room for learning."} description={isSchool ? "Choose your class below to open assignments, pick up saved work, or talk to your instructor." : "Choose the topics and lessons you need while personal learning activities are being prepared."} />
    <PathwayOverview api={pathway} />
    <MyClasses />
    {isSchool && <ProgressOverview api={progress} historyLink />}
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>🎙 Spoken Pronunciation Practice</Text>
      <Text style={s.body}>
        Practice speaking Tagalog and English phrases with real-time audio recording, playback review, and private storage.
      </Text>
      <Button label="Practice Pronunciation" variant="primary" icon="🎙" onPress={() => router.push("/pronunciation")} />
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>💬 AI Conversation Practice</Text>
      <Text style={s.body}>
        Engage in interactive curriculum-linked role-play dialogues in Tagalog and English with educational personas, voice or text input, and formative feedback.
      </Text>
      <Button label="Practice Conversation" variant="primary" icon="💬" onPress={() => router.push("/conversation")} />
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>🔬 Research Participation</Text>
      <Text style={s.body}>
        Participate voluntarily in adaptive learning and pronunciation research studies with informed consent and privacy-isolated participant codes.
      </Text>
      <Button label="View Research Studies" variant="secondary" icon="🔬" onPress={() => router.push("/research")} />
    </View>
    <UpcomingLearning school={isSchool} />
  </Screen>;
}
