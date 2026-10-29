import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/tokens";

/** Decorative, code-native artwork; never represents learner activity. */
export function LearningBanner({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <View style={styles.banner}>
    <View style={styles.copy}>
      {!compact && <Text style={styles.kicker}>A little learning, a little further.</Text>}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
    {!compact && <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
      <View style={styles.orbit} />
      <View style={[styles.word, styles.wordBack]}><Text style={styles.translation}>hello</Text></View>
      <View style={styles.word}><Text style={styles.wordLabel}>LET’S LEARN</Text><Text style={styles.greeting}>kumusta</Text><View style={styles.line} /><Text style={styles.translation}>one word at a time.</Text></View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#203B86", borderRadius: 24, padding: 28, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 24, overflow: "hidden" },
  copy: { flex: 2, flexBasis: 240, gap: 12 },
  kicker: { color: "#CFDBFF", fontSize: 13, fontWeight: "600" },
  title: { color: "#FFFFFF", fontSize: 28, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  description: { color: "#E1E8FB", fontSize: 16, lineHeight: 25, maxWidth: 500 },
  art: { flex: 1, flexBasis: 180, height: 160, alignItems: "center", justifyContent: "center" },
  orbit: { position: "absolute", width: 170, height: 170, borderWidth: 1, borderColor: "#647CB9", borderRadius: 85, transform: [{ scaleX: 1.3 }] },
  word: { backgroundColor: "#FFFFFF", width: 170, padding: 18, borderRadius: 14, gap: 8, transform: [{ rotate: "-7deg" }] },
  wordBack: { position: "absolute", backgroundColor: "#F5CA7D", height: 130, transform: [{ rotate: "12deg" }, { translateX: 12 }] },
  wordLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  greeting: { color: "#203B86", fontSize: 24, fontWeight: "800" },
  line: { height: 3, width: 32, backgroundColor: "#E3A449", borderRadius: 2 },
  translation: { color: "#475569", fontSize: 12 },
});
