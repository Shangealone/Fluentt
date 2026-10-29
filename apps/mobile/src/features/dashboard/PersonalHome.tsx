import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import { homeColors } from "../../theme/personal";

const activities = [
  { title: "Learn", description: "Discover new words.", route: "/question-practice", image: require("../../../assets/illustrations/activity-learn.png"), background: "#E7F1CF" },
  { title: "Speak", description: "Listen, then try it out loud.", route: "/pronunciation", image: require("../../../assets/illustrations/activity-speak.png"), background: "#FFF0D4" },
  { title: "Chat", description: "Try everyday conversations.", route: "/conversation", image: require("../../../assets/illustrations/activity-chat.png"), background: "#EDE8FB" },
] as const;

export function PersonalHome() {
  const { profile } = useSession();
  const language = profile?.language === "english" ? "English" : "Tagalog";
  return <View style={styles.page}>
    <View style={styles.hero}>
      <Image accessible={false} source={require("../../../assets/illustrations/home-neighborhood.jpg")} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} />
      <View style={styles.heroCopy}>
        <Text style={styles.greeting}>{language === "Tagalog" ? "Kumusta!" : "Hello there!"} <Text accessible={false}>👋</Text></Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>Let’s learn{"\n"}{language}.</Text>
        <Text style={styles.heroDescription}>Try a few new words today.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Start learning" accessibilityHint="Opens your lessons" onPress={() => router.push("/question-practice")}
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
          <Text style={styles.startLabel}>Start learning</Text>
          <PersonalIcon name="arrow" color="#FFFFFF" size={18} />
        </Pressable>
      </View>
    </View>
    <View style={styles.activities}>
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.heading}>Pick an activity</Text>
        <Text accessible={false} style={styles.flower}>✳</Text>
      </View>
      {activities.map(activity => <Pressable key={activity.route} accessibilityRole="button" accessibilityLabel={activity.title + ". " + activity.description}
        onPress={() => router.push(activity.route)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={[styles.activityArt, { backgroundColor: activity.background }]}>
          <Image accessible={false} source={activity.image} resizeMode="contain" style={styles.activityImage} />
        </View>
        <View style={styles.activityCopy}>
          <Text style={styles.activityTitle}>{activity.title}</Text>
          <Text style={styles.activityDescription}>{activity.description}</Text>
        </View>
        <View style={styles.arrow}><PersonalIcon name="arrow" color="#447162" size={16} /></View>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 22 },
  hero: { minHeight: 272, borderRadius: 22, overflow: "hidden", backgroundColor: "#B9E6FC" },
  heroCopy: { width: "76%", maxWidth: 265, padding: 21, alignItems: "flex-start" },
  greeting: { color: homeColors.ink, fontSize: 14, lineHeight: 21, fontWeight: "600", marginBottom: 8 },
  heroTitle: { color: homeColors.ink, fontSize: 33, lineHeight: 37, fontWeight: "700", letterSpacing: -1.2, marginBottom: 10 },
  heroDescription: { color: "#255754", fontSize: 13, lineHeight: 20, maxWidth: 168, marginBottom: 16 },
  startButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 48, maxWidth: "100%", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: homeColors.coral, borderBottomWidth: 3, borderBottomColor: "#AC3E23" },
  startLabel: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#FFFFFF", flexShrink: 1 },
  pressed: { opacity: 0.8 },
  activities: { gap: 11 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 2 },
  heading: { fontSize: 20, lineHeight: 27, fontWeight: "700", letterSpacing: -0.5, color: homeColors.ink, flexShrink: 1 },
  flower: { fontSize: 24, color: "#D39435" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 92, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: homeColors.line, borderRadius: 19 },
  activityArt: { width: 60, height: 60, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  activityImage: { width: 42, height: 42 },
  activityCopy: { flex: 1, minWidth: 0, gap: 4 },
  activityTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.3, color: homeColors.ink },
  activityDescription: { fontSize: 14, lineHeight: 21, color: homeColors.muted },
  arrow: { width: 27, height: 27, borderRadius: 14, backgroundColor: "#F3F6F1", alignItems: "center", justifyContent: "center" },
});
