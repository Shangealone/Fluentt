import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/ui";
import { useSession } from "../../session/provider";
import { pc, p } from "../../theme/personal";
import { PersonalIcon } from "../../components/PersonalIcon";
import { startingDifficulty } from "../../services/api/identity";

export function PersonalHome() {
  const { profile } = useSession();
  const language = profile?.language === "english" ? "English" : "Tagalog";
  const focus = [...(profile?.learning_focus?.topics ?? []), ...(profile?.learning_focus?.lessons ?? [])];
  return <View style={{ gap: 28 }}>
    <View style={{ gap: 10 }}>
      <View style={p.row}><View style={p.chip}><Text style={p.chipText}>● {language} · {startingDifficulty(profile?.experience)}</Text></View><View style={[p.chip, { backgroundColor: pc.pink }]}><Text style={[p.chipText, { color: pc.rose }]}>Personal learning</Text></View></View>
      <Text accessibilityRole="header" style={p.title}>{language === "Tagalog" ? "Kumusta" : "Welcome back"}, {profile?.username}</Text>
      <Text style={p.body}>A little practice, a little further. Build confidence with the topics that matter to you.</Text>
    </View>
    <View style={styles.hero}>
      <View style={p.row}><Text style={[p.eyebrow, { color: "#F2D6DF" }]}>Your learning, your pace</Text><View style={styles.heroChip}><Text style={{ fontSize: 10, color: "#E3E8F4" }}>◇ Choose your focus</Text></View></View>
      <Text accessibilityRole="header" style={styles.heroTitle}>Make space for your next breakthrough.</Text>
      <Text style={styles.heroBody}>Explore a lesson. Find the right words. Put them into conversation.</Text>
      <View style={styles.heroMethods}>{(["learn", "voice", "tutor"] as const).map(item => <View key={item} style={{ alignItems: "center", gap: 7, flex: 1 }}><PersonalIcon name={item} color="#F2CBD6" /><Text style={{ color: "white", fontSize: 11 }}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></View>)}</View>
      <Button label="Start learning session" icon="→" style={{ backgroundColor: pc.rose }} onPress={() => router.push("/question-practice")} />
    </View>
    <View style={p.section}>
      <View style={p.row}><Text accessibilityRole="header" style={p.heading}>Your learning studio</Text><Text style={[p.caption, { color: pc.rose }]}>Three ways to practise</Text></View>
      <View style={p.grid}>{[
        { title: "Questions & activities", tag: "LESSONS & TOPICS", text: "Vocabulary, word activities, matching, and flashcards. Find your level with easy, medium, or hard lessons.", icon: "▤", route: "/question-practice", action: "Answer questions", color: pc.teal, bg: pc.aqua },
        { title: "Learn pronunciation", tag: "VOICE STUDIO", text: "Choose a phrase. Record yourself, listen back, and practise clear, confident speech.", icon: "♩", route: "/pronunciation", action: "Practise pronunciation", color: pc.rose, bg: pc.pink },
        { title: "Conversation simulator", tag: "GUIDED ROLE-PLAY", text: "Everyday scenarios. Friendly conversation partners. A place to put your English or Tagalog into practice.", icon: "▱", route: "/conversation", action: "Start a conversation", color: pc.navy, bg: pc.soft },
      ].map(item => <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.action} onPress={() => router.push(item.route as "/question-practice" | "/pronunciation" | "/conversation")} style={({ pressed }) => [p.card, styles.activity, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={p.row}><View style={[styles.activityIcon, { backgroundColor: item.bg }]}><Text style={{ fontSize: 25, color: item.color }}>{item.icon}</Text></View><Text style={[p.eyebrow, { color: item.color, fontSize: 9 }]}>{item.tag}</Text></View>
        <Text accessibilityRole="header" style={p.heading}>{item.title}</Text><Text style={[p.body, { flexGrow: 1 }]}>{item.text}</Text><Text style={{ color: item.color, fontSize: 13, fontWeight: "700" }}>{item.action} →</Text>
      </Pressable>)}</View>
    </View>
    <View style={p.card}><View style={p.row}><Text accessibilityRole="header" style={p.heading}>Made for your interests</Text><Text style={{ color: pc.rose }}>✧</Text></View>
      <Text style={p.body}>Your saved topics and lessons. Choose any difficulty when you practise.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{focus.length ? focus.map((value, index) => <View key={`${index}-${value}`} style={p.chip}><Text style={p.chipText}>{value}</Text></View>) : <Text style={p.body}>Add the topics you would like to explore.</Text>}</View>
      <Button secondary label="Edit learning preferences" onPress={() => router.push("/preferences")} />
    </View>
    <View style={[p.note, { backgroundColor: pc.aqua }]}><Text style={[p.eyebrow, { color: pc.teal }]}>A mindful practice space</Text><Text style={p.body}>Conversation replies and pronunciation feedback currently use a simulator. Practise without pressure; these activities do not certify your ability.</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: pc.navy, borderRadius: 18, padding: 24, gap: 19 },
  heroChip: { backgroundColor: "#2C3653", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "600", lineHeight: 34, letterSpacing: -0.6, maxWidth: 520 },
  heroBody: { color: "#BBC4D8", fontSize: 14, lineHeight: 23, maxWidth: 560 },
  heroMethods: { backgroundColor: "#2B3552", borderRadius: 12, padding: 15, flexDirection: "row" },
  activity: { flexBasis: 260, flexGrow: 1, gap: 13 },
  activityIcon: { width: 45, height: 45, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
