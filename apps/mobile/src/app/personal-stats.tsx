import { Text, View } from "react-native";
import { router } from "expo-router";
import { PersonalScreen } from "../components/PersonalScreen";
import { Button } from "../components/ui";
import { useSession } from "../session/provider";
import { p, pc } from "../theme/personal";
import { PersonalIcon, type PersonalIconName } from "../components/PersonalIcon";

export default function PersonalStats() {
  const { profile } = useSession();
  if (profile?.role !== "personal_student") return null;
  return <PersonalScreen title="Your learning overview" eyebrow="Personal insights" description="A little perspective on your learning space. Practice freely, without chasing a score.">
    <View style={[p.note, { backgroundColor: pc.aqua }]}><Text style={[p.eyebrow, { color: pc.teal }]}>Personal tracking unavailable</Text>
      <Text style={p.body}>Your personal practice is not yet tracked. Retention, fluency, streaks, and mastery cannot be measured from the activity available here.</Text></View>
    <View style={p.grid}>{[
      { title: "Vocabulary", icon: "learn", note: "Explore lessons and word activities" },
      { title: "Pronunciation", icon: "voice", note: "Record, listen, and practise" },
      { title: "Conversation", icon: "tutor", note: "Try guided everyday scenarios" },
      { title: "Consistency", icon: "stats", note: "Learn at your own pace" },
    ].map(item => <View key={item.title} style={p.metric}><View style={p.row}><PersonalIcon name={item.icon as PersonalIconName} color={pc.rose} /><View style={p.chip}><Text style={p.chipText}>Not measured</Text></View></View>
      <Text style={p.metricValue}>—</Text><Text style={{ color: pc.ink, fontWeight: "600", fontSize: 14 }}>{item.title}</Text><Text style={p.caption}>{item.note}</Text></View>)}</View>
    <View style={p.card}><Text accessibilityRole="header" style={p.heading}>Your learning focus</Text><Text style={p.body}>These are the topics you chose, rather than a prediction about your ability.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[...(profile.learning_focus?.topics ?? []), ...(profile.learning_focus?.lessons ?? [])].map((value, index) => <View style={p.chip} key={`${index}-${value}`}><Text style={p.chipText}>{value}</Text></View>)}</View>
      <Button secondary label="Edit learning preferences" onPress={() => router.push("/preferences")} /></View>
    <View style={[p.card, { backgroundColor: pc.navy, gap: 18 }]}><Text style={[p.eyebrow, { color: "#F2CBD6" }]}>Your next step</Text>
      <Text style={[p.heading, { color: "white" }]}>Keep your curiosity going.</Text><Text style={[p.body, { color: "#BCC5D9" }]}>Choose a lesson or practise an everyday conversation. You decide what comes next.</Text>
      <Button style={{ backgroundColor: pc.rose }} label="Explore lessons" onPress={() => router.push("/question-practice")} /></View>
  </PersonalScreen>;
}
