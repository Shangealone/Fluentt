import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { pc } from "../theme/personal";
import { PersonalIcon, type PersonalIconName } from "./PersonalIcon";

const tabs = [
  { label: "Home", name: "Instructor home", route: "/instructor", icon: "home", view: "home" },
  { label: "Classes", name: "Manage classes and assignments", route: "/instructor", icon: "learn", view: "classes" },
  { label: "Messages", name: "Class messages", route: "/communication", icon: "tutor" },
  { label: "Progress", name: "Monitor class progress", route: "/instructor-monitoring", icon: "stats" },
  { label: "Materials", name: "Learning materials", route: "/learning-materials", icon: "learn" },
] as const;

export function InstructorBottomNavigation() {
  const { profile, loading, error } = useSession();
  const path = usePathname(), { view } = useGlobalSearchParams<{ view?: string }>();
  // Keep creation/editing/publication/release forms within their existing Back guards.
  if (loading || error || profile?.role !== "instructor" || destination(profile) !== "/instructor"
    || !["/instructor", "/class-details", "/assignments", "/communication", "/instructor-monitoring", "/learning-materials", "/account", "/notifications"].includes(path)) return null;
  const active = path === "/instructor" ? view === "classes" ? "Classes" : "Home"
    : ["/class-details", "/assignments"].includes(path) ? "Classes" : tabs.find(tab => tab.route === path)?.label;
  return <SafeAreaView edges={["bottom", "left", "right"]} style={styles.surface}>
    <View accessibilityRole="tablist" accessibilityLabel="Instructor classroom navigation" style={styles.row}>
      {tabs.map(tab => {
        const selected = active === tab.label;
        return <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={tab.name}
          accessibilityState={{ selected }} aria-selected={selected}
          onPress={() => { if (!selected || path !== tab.route) router.navigate("view" in tab ? { pathname: tab.route, params: { view: tab.view } } : tab.route); }}
          style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}>
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
