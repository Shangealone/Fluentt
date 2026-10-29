import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { pc } from "../theme/personal";
import { PersonalIcon, type PersonalIconName } from "./PersonalIcon";

const tabs = [
  { route: "/student", label: "Home", name: "Class learning home", icon: "home" },
  { route: "/my-classes", label: "Classes", name: "My classes and assignments", icon: "learn" },
  { route: "/pronunciation", label: "Voice", name: "Pronunciation practice", icon: "voice" },
  { route: "/conversation", label: "Tutor", name: "Conversation simulator", icon: "tutor" },
  { route: "/learning-history", label: "Progress", name: "Class progress and learning history", icon: "stats" },
] as const;

export function ClassroomBottomNavigation() {
  const { profile, loading, error } = useSession();
  const path = usePathname();
  // Hide outside main destinations, including attempts and forms with unsaved state.
  if (loading || error || profile?.role !== "school_student" || destination(profile) !== "/student"
    || (!tabs.some(tab => tab.route === path) && path !== "/account")) return null;
  return <SafeAreaView edges={["bottom", "left", "right"]} style={styles.surface}>
    <View accessibilityRole="tablist" accessibilityLabel="Class learning navigation" style={styles.row}>
      {tabs.map(tab => {
        const selected = path === tab.route;
        return <Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.name}
          accessibilityState={{ selected }} aria-selected={selected}
          onPress={() => { if (!selected) router.navigate(tab.route); }} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}>
          <View style={[styles.icon, selected && { backgroundColor: "#EDF0F6" }]}><PersonalIcon name={tab.icon as PersonalIconName} color={selected ? pc.navy : pc.muted} /></View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, selected && { color: pc.navy, fontWeight: "800" }]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  surface: { backgroundColor: pc.background, borderTopWidth: 1, borderTopColor: pc.line },
  row: { flexDirection: "row", width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 6, paddingVertical: 8 },
  tab: { flex: 1, minWidth: 0, minHeight: 58, gap: 4, alignItems: "center", justifyContent: "center" },
  icon: { width: 54, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "600", color: pc.muted },
});
