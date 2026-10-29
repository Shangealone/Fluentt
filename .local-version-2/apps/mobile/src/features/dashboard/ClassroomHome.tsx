import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/ui";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import { pc, p } from "../../theme/personal";
import { MyClasses } from "../enrollment/MyClasses";
import { ProgressOverview } from "../progress/ProgressSummary";
import { PathwayOverview } from "./LearningPathwayView";

export function ClassroomHome() {
  const { profile, progress, pathway } = useSession();
  return <View style={{ gap: 28 }}>
    <View style={{ gap: 10 }}>
      <View style={p.row}><View style={p.chip}><Text style={p.chipText}>Learn with your class</Text></View><View style={[p.chip, { backgroundColor: pc.pink }]}><Text style={[p.chipText, { color: pc.rose }]}>Student space</Text></View></View>
      <Text accessibilityRole="header" style={p.title}>Welcome back, {profile?.username}</Text>
      <Text style={p.body}>Your classes, your next lesson, your place to grow. Take it one step at a time.</Text>
    </View>
    <View style={styles.hero}>
      <Text style={[p.eyebrow, { color: "#F2D6DF" }]}>A little further, together</Text>
      <Text accessibilityRole="header" style={styles.heroTitle}>Ready for your next chapter?</Text>
      <Text style={styles.heroBody}>Choose Classes below to find assignments, continue saved work, and connect with your instructor.</Text>
      <View style={styles.methods}>{[
        { icon: "learn", label: "Class lessons" }, { icon: "voice", label: "Speaking practice" }, { icon: "stats", label: "Your progress" },
      ].map(item => <View key={item.icon} style={styles.method}><PersonalIcon name={item.icon as "learn" | "voice" | "stats"} color="#F2CBD6" /><Text style={styles.methodLabel}>{item.label}</Text></View>)}</View>
    </View>

    <MyClasses />

    <View style={[p.note, { backgroundColor: pc.aqua }]}><Text style={[p.eyebrow, { color: pc.teal }]}>Practise without pressure</Text><Text style={p.body}>Use Voice or Tutor below for speaking practice. Conversation and pronunciation feedback currently use a simulator. These activities do not certify your ability.</Text></View>

    <PathwayOverview api={pathway} classroomDesign />
    <View style={p.section}><Text accessibilityRole="header" style={p.heading}>Your assignment progress</Text><ProgressOverview api={progress} classroomDesign /></View>

    <View style={p.card}>
      <Text style={p.eyebrow}>Stay connected</Text><Text accessibilityRole="header" style={p.heading}>Everything else, close by.</Text>
      <Text style={p.body}>Keep up with your class and find the resources you need.</Text>
      <View style={p.grid}>
        <Button secondary label="Learning materials" icon="▤" onPress={() => router.push("/learning-materials")} />
      </View>
    </View>
    <View style={p.note}><Text style={p.eyebrow}>Research participation</Text><Text style={p.body}>View study information and availability. Joining a class does not enroll you in research.</Text><Button secondary label="View Research Studies" icon="◇" onPress={() => router.push("/research")} /></View>
  </View>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: pc.navy, borderRadius: 18, padding: 24, gap: 19 },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "600", lineHeight: 34, letterSpacing: -0.6, maxWidth: 520 },
  heroBody: { color: "#BBC4D8", fontSize: 14, lineHeight: 23, maxWidth: 560 },
  methods: { backgroundColor: "#2B3552", borderRadius: 12, padding: 15, flexDirection: "row", gap: 8 },
  method: { alignItems: "center", gap: 7, flex: 1, minWidth: 0 },
  methodLabel: { color: "white", fontSize: 11, textAlign: "center", lineHeight: 17 },
});
