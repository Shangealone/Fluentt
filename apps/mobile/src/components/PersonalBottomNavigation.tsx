import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { pc } from "../theme/personal";
import { PersonalIcon } from "./PersonalIcon";

const tabs = [
  { route: "/student", label: "Home", name: "Home", icon: "⌂" },
  { route: "/question-practice", label: "Learn", name: "Questions and activities", icon: "▤" },
  { route: "/pronunciation", label: "Voice", name: "Pronunciation practice", icon: "♩" },
  { route: "/conversation", label: "Tutor", name: "Conversation simulator", icon: "▱" },
  { route: "/personal-stats", label: "Stats", name: "Personal learning statistics", icon: "⌁" },
] as const;

export function PersonalBottomNavigation() {
  const { profile, loading, error } = useSession();
  const path = usePathname();
  // Keep onboarding and busy preference forms within their existing navigation boundaries.
  if (loading || error || profile?.role !== "personal_student" || destination(profile) !== "/student"
    || (!tabs.some(tab => tab.route === path) && path !== "/account")) return null;
  return <SafeAreaView edges={["bottom", "left", "right"]} style={styles.surface}>
    <View accessibilityRole="tablist" accessibilityLabel="Personal learning navigation" style={styles.row}>
      {tabs.map(tab => {
        const selected = path === tab.route;
        return <Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.name}
          accessibilityState={{ selected }} aria-selected={selected} onPress={() => { if (!selected) router.navigate(tab.route); }}
          style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}>
          <View style={[styles.iconBackground, selected && styles.activeBackground]}>
            <PersonalIcon name={tab.label.toLowerCase() as "home" | "learn" | "voice" | "tutor" | "stats"} color={selected ? pc.navy : pc.muted} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, selected && styles.activeText]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: pc.background, borderTopWidth: 1, borderTopColor: pc.line },
  row: { flexDirection: "row", width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 6, paddingTop: 8, paddingBottom: 8 },
  tab: { flex: 1, minWidth: 0, minHeight: 58, gap: 4, alignItems: "center", justifyContent: "center" },
  iconBackground: { width: 54, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  activeBackground: { backgroundColor: "#EDF0F6" },
  icon: { fontSize: 25, lineHeight: 29, fontWeight: "600", color: pc.muted },
  label: { fontSize: 11, fontWeight: "600", color: pc.muted },
  activeText: { color: pc.navy, fontWeight: "800" },
});
