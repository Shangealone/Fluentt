import { messageNavigation } from "../features/communications/state";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { homeColors } from "../theme/personal";
import { PersonalIcon, type PersonalIconName } from "./PersonalIcon";

const tabs = [
  { route: "/student", label: "Home", name: "Class learning home", icon: "home" },
  { route: "/my-classes", label: "Classes", name: "My classes and assignments", icon: "learn" },
  { route: "/pronunciation", label: "Speak", name: "Pronunciation practice", icon: "voice" },
  { route: "/conversation", label: "Chat", name: "Conversation practice", icon: "tutor" },
  { route: "/learning-history", label: "My progress", name: "Class progress and learning history", icon: "stats" },
] as const;

export function ClassroomBottomNavigation() {
  const { profile, loading, error } = useSession();
  const path = usePathname();
  // Hide outside main destinations, including attempts and forms with unsaved state.
  if (loading || error || profile?.role !== "school_student" || destination(profile) !== "/student"
    || (!tabs.some(tab => tab.route === path) && path !== "/account" && path !== "/notifications" && path !== "/class-code" && path !== "/communication")) return null;
  return <SafeAreaView edges={["bottom", "left", "right"]} style={styles.surface}>
    <View accessibilityRole="tablist" accessibilityLabel="Class learning navigation" style={styles.row}>
      {tabs.map(tab => {
        const selected = path === tab.route || (path === "/class-code" && tab.route === "/my-classes");
        return <Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.name}
          accessibilityState={{ selected }} aria-selected={selected}
          onPress={() => { if (path !== tab.route) messageNavigation.request(() => router.navigate(tab.route)); }} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}>
          <View style={[styles.icon, selected && { backgroundColor: homeColors.selected }]}><PersonalIcon name={tab.icon as PersonalIconName} size={21} color={selected ? homeColors.teal : "#5B7064"} /></View>
          <Text style={[styles.label, selected && { color: homeColors.teal, fontWeight: "700" }]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  surface: { backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: homeColors.line },
  row: { flexDirection: "row", width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 8, paddingVertical: 8 },
  tab: { flex: 1, minWidth: 0, minHeight: 58, gap: 4, alignItems: "center", justifyContent: "center" },
  icon: { width: 54, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  label: { minHeight: 28, fontSize: 11, lineHeight: 14, textAlign: "center", fontWeight: "600", color: "#5B7064" },
});
