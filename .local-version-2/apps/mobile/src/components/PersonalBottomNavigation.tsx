import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { homeColors } from "../theme/personal";
import { PersonalIcon } from "./PersonalIcon";

const tabs = [
  { route: "/student", label: "Home", name: "Home", icon: "home" },
  { route: "/question-practice", label: "Learn", name: "Learn", icon: "learn" },
  { route: "/pronunciation", label: "Speak", name: "Speak", icon: "voice" },
  { route: "/conversation", label: "Chat", name: "Chat", icon: "tutor" },
  { route: "/personal-stats", label: "My progress", name: "My progress", icon: "stats" },
] as const;

export function PersonalBottomNavigation() {
  const { profile, loading, error } = useSession();
  const path = usePathname();
  // Preserve the existing onboarding and busy preference-form boundaries.
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
            <PersonalIcon name={tab.icon} color={selected ? homeColors.teal : "#5B7064"} size={21} />
          </View>
          <Text numberOfLines={2} style={[styles.label, selected && styles.activeText]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: homeColors.line },
  row: { flexDirection: "row", width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },
  tab: { flex: 1, minWidth: 0, minHeight: 58, gap: 4, alignItems: "center", justifyContent: "center" },
  iconBackground: { width: 54, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activeBackground: { backgroundColor: homeColors.selected },
  label: { minHeight: 28, fontSize: 11, lineHeight: 14, textAlign: "center", fontWeight: "600", color: "#5B7064" },
  activeText: { color: homeColors.teal, fontWeight: "700" },
});
