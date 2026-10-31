import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import { homeColors as c } from "../../theme/personal";
import { SchoolHomeClasses } from "./SchoolHomeClasses";
import { SchoolHomeLearning } from "./SchoolHomeLearning";
import { h, HomeAction, HomeDisclosure } from "./SchoolHomeUI";

const practice = [
  { title: "Speak", description: "Listen, then try it out loud.", route: "/pronunciation", image: require("../../../assets/illustrations/activity-speak.png"), background: "#FFF0D4" },
  { title: "Chat", description: "Try everyday conversations.", route: "/conversation", image: require("../../../assets/illustrations/activity-chat.png"), background: "#EDE8FB" },
] as const;

export function ClassroomHome() {
  const { profile } = useSession();
  const { width, fontScale } = useWindowDimensions();
  return <View style={h.page}>
    <View style={styles.hero}>
      <Image accessible={false} source={require("../../../assets/illustrations/home-neighborhood.jpg")} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} />
      <View style={[styles.heroCopy, width < 360 && styles.narrowHeroCopy, fontScale > 1.2 && styles.largeHeroCopy]}>
        <Text style={styles.greeting}>Hello, {profile?.username} <Text accessible={false}>👋</Text></Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>Let’s learn{"\n"}together.</Text>
        <Text style={styles.heroDescription}>A little learning,{"\n"}a little further.</Text>
        <HomeAction label="View my classes" icon="arrow" variant="primary" onPress={() => router.push("/my-classes")} />
      </View>
    </View>

    <SchoolHomeClasses />

    <View style={h.section}>
      <Text accessibilityRole="header" style={h.heading}>Practice a little more</Text>
      <Text style={h.body}>Make a little room for practice.</Text>
      {practice.map(activity => <Pressable key={activity.route} accessibilityRole="button"
        accessibilityLabel={`${activity.title}. ${activity.description}`} onPress={() => router.push(activity.route)}
        style={({ pressed }) => [styles.activity, pressed && h.dimmed]}>
        <View style={[styles.activityArt, { backgroundColor: activity.background }]}><Image accessible={false} source={activity.image} resizeMode="contain" style={styles.activityImage} /></View>
        <View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={h.small}>{activity.description}</Text></View>
        <PersonalIcon name="arrow" size={16} color={c.teal} />
      </Pressable>)}
      <HomeDisclosure title="About speaking practice">
        <Text style={h.small}>Service information and audio-sharing choices appear in each practice activity. Practice feedback does not certify your language ability.</Text>
      </HomeDisclosure>
    </View>

    <SchoolHomeLearning />

    <View style={styles.resources}>
      <Pressable accessibilityRole="button" onPress={() => router.push("/learning-materials")} style={({ pressed }) => [styles.resource, pressed && h.dimmed]}>
        <PersonalIcon name="assignments" size={19} color={c.teal} /><Text style={[h.link, styles.resourceLabel]}>Learning materials</Text><PersonalIcon name="arrow" size={16} color={c.teal} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/research")} style={({ pressed }) => [styles.resource, pressed && h.dimmed]}>
        <PersonalIcon name="overview" size={19} color={c.teal} /><Text style={[h.link, styles.resourceLabel]}>Research studies</Text><PersonalIcon name="arrow" size={16} color={c.teal} />
      </Pressable>
      <HomeDisclosure title="About research studies"><Text style={h.small}>Joining a class does not enroll you in research. You can read study information separately.</Text></HomeDisclosure>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  hero: { minHeight: 285, borderRadius: 22, overflow: "hidden", backgroundColor: "#B9E6FC", justifyContent: "center" },
  heroCopy: { width: "76%", maxWidth: 265, paddingVertical: 22, paddingHorizontal: 20, alignItems: "flex-start", gap: 11 },
  narrowHeroCopy: { width: "82%", paddingHorizontal: 17 },
  largeHeroCopy: { width: "100%", maxWidth: "100%", backgroundColor: "rgba(207, 236, 249, 0.85)", paddingHorizontal: 18, paddingVertical: 24 },
  greeting: { color: c.ink, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  heroTitle: { color: c.ink, fontSize: 33, lineHeight: 38, fontWeight: "700", letterSpacing: -1.2 },
  heroDescription: { color: "#255754", fontSize: 13, lineHeight: 21 },
  activity: { flexDirection: "row", alignItems: "center", gap: 13, padding: 13, borderWidth: 1, borderColor: c.line, borderRadius: 19, backgroundColor: "#FFFFFF" },
  activityArt: { width: 57, height: 60, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  activityImage: { width: 43, height: 43 }, activityCopy: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: { fontSize: 18, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3, color: c.ink },
  resources: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, gap: 3 },
  resource: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 44, paddingVertical: 10 }, resourceLabel: { flex: 1 },
});
