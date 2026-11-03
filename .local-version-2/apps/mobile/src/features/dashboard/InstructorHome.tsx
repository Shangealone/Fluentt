import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import type { ClassDetails } from "../../services/api/classes";
import { homeColors as colors } from "../../theme/personal";
import type { ListState } from "./paging";
import { classroomIllustration, InstructorClassCard } from "./InstructorClassCard";

type HomeProps = { username: string; state: ListState<ClassDetails>; onRefresh: () => void; onMore: () => void };
const tabs = [
  { route: "/instructor", label: "Home", icon: "home" },
  { route: "/communication", label: "Messages", icon: "tutor" },
  { route: "/notifications", label: "Notifications", icon: "notifications" },
  { route: "/instructor-monitoring", label: "Overview", icon: "overview" },
] as const satisfies readonly { route: string; label: string; icon: PersonalIconName }[];

/** Homepage-only navigation; forms and other role portals retain their own boundaries. */
export function InstructorHomeNavigation() {
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.2 && width < 400;
  return <SafeAreaView edges={["bottom"]} style={styles.navSurface}>
    <View accessibilityRole="tablist" accessibilityLabel="Teaching navigation" style={[styles.navRow, largeText && styles.largeTextNav]}>
      {tabs.map(tab => {
        const selected = tab.route === "/instructor";
        return <Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.label}
          accessibilityState={{ selected }} aria-selected={selected} onPress={() => { if (!selected) router.navigate(tab.route); }}
          style={({ pressed }) => [styles.tab, largeText && styles.largeTextTab, pressed && styles.pressed]}>
          <View style={[styles.tabIcon, largeText && styles.largeTextIcon, selected && styles.selectedIcon]}><PersonalIcon name={tab.icon} size={19} color={selected ? colors.teal : colors.muted} /></View>
          <Text style={[styles.tabLabel, largeText && styles.largeTextLabel, selected && styles.selectedLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

export function InstructorHome({ username, state, onRefresh, onMore }: HomeProps) {
  const compact = useWindowDimensions().width < 360;
  const loading = state.phase === "loading";
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <View style={[styles.header, compact && styles.compactPadding]}>
      <FluenttLogo size={36} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account · Instructor" onPress={() => router.push("/account")}
        style={({ pressed }) => [styles.account, pressed && styles.pressed]}><PersonalIcon name="account" size={20} /></Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.compactPadding]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.greeting}>
        <View style={styles.greetingCopy}>
          <Text style={styles.eyebrow}>Your teaching space</Text>
          <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>Hello, {username || "Teacher"}</Text>
          <Text style={styles.subtitle}>Let’s make room for learning.</Text>
        </View>
        <View style={[styles.teacherArt, compact && styles.compactTeacher]}>
          <Image accessible={false} source={require("../../../assets/illustrations/account-teacher.png")} resizeMode="contain" style={[styles.teacherImage, compact && styles.compactTeacherImage]} />
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/first-class")} style={({ pressed }) => [styles.create, pressed && styles.pressed]}>
        <PersonalIcon name="plus" size={18} color="#FFFFFF" /><Text style={styles.createText}>Create a class</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/instructor-lessons")} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}><Text style={styles.retryText}>My lessons</Text></Pressable>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.heading}>Your classes</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh classes" accessibilityState={{ disabled: loading }} disabled={loading} onPress={onRefresh}
          style={({ pressed }) => [styles.refresh, loading && styles.disabled, pressed && styles.pressed]}><PersonalIcon name="refresh" size={16} color={colors.teal} /></Pressable>
      </View>
      {loading && <View accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={styles.loading}>
        <View style={styles.loadingLabel}><ActivityIndicator color={colors.teal} /><Text style={styles.body}>Loading your classes…</Text></View>
        <View accessible={false} style={styles.skeleton} /><View accessible={false} style={styles.skeleton} />
      </View>}
      {state.phase === "error" && <View accessibilityRole="alert" style={styles.stateCard}>
        <Text accessibilityRole="header" style={styles.stateTitle}>We couldn’t load your classes</Text>
        <Text style={styles.stateDescription}>{state.error || "Please check your connection and try again."}</Text>
        <Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>}
      {state.phase === "ready" && <>
        {state.rows.length === 0 ? <View style={styles.stateCard}>
          <Image accessible={false} source={classroomIllustration} resizeMode="contain" style={styles.emptyArt} />
          <Text accessibilityRole="header" style={styles.stateTitle}>Your first class starts here</Text>
          <Text style={styles.stateDescription}>Create a class, then share its code with your students.</Text>
        </View> : <View style={styles.classList}>{state.rows.map(row => <InstructorClassCard key={row.id} row={row} />)}</View>}
        {state.hasMore && <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}><Text style={styles.retryText}>Load more classes</Text></Pressable>}
        <Text style={styles.footnote}>Share a class code to welcome your students.</Text>
      </>}
    </ScrollView>
    <InstructorHomeNavigation />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  compactPadding: { paddingHorizontal: 16 },
  account: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 }, content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 7, paddingBottom: 22 },
  greeting: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 117, paddingBottom: 9 },
  greetingCopy: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 11, lineHeight: 18, fontWeight: "600", color: colors.teal, marginBottom: 7 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -1.2, color: colors.ink }, compactTitle: { fontSize: 25, lineHeight: 32 },
  subtitle: { fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 8 },
  teacherArt: { width: 82, height: 88, backgroundColor: "#EAF1DA", borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomRightRadius: 32, borderBottomLeftRadius: 17, alignItems: "center", justifyContent: "center", transform: [{ rotate: "3deg" }] },
  compactTeacher: { width: 68, height: 77 }, teacherImage: { width: 71, height: 71, transform: [{ rotate: "-3deg" }] }, compactTeacherImage: { width: 60, height: 60 },
  create: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, padding: 15, minHeight: 55, backgroundColor: colors.coral, borderBottomWidth: 3, borderBottomColor: "#AC3E23", borderRadius: 15, marginTop: 8, marginBottom: 26 },
  createText: { color: "#FFFFFF", fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  heading: { fontSize: 20, lineHeight: 28, letterSpacing: -0.6, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  refresh: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF" },
  classList: { gap: 14 }, footnote: { marginTop: 17, marginHorizontal: 8, fontSize: 11, lineHeight: 18, textAlign: "center", color: colors.muted },
  loading: { gap: 14 }, loadingLabel: { flexDirection: "row", alignItems: "center", gap: 9 }, body: { color: colors.muted, fontSize: 13, lineHeight: 22, flexShrink: 1 },
  skeleton: { height: 180, borderRadius: 21, backgroundColor: "#EEF2E9" },
  stateCard: { paddingVertical: 27, paddingHorizontal: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderRadius: 21, alignItems: "center", gap: 8 },
  emptyArt: { width: 70, height: 70, marginBottom: 6 }, stateTitle: { fontSize: 18, lineHeight: 25, fontWeight: "700", letterSpacing: -0.4, color: colors.ink, textAlign: "center" },
  stateDescription: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "center" },
  retry: { backgroundColor: "#EAF2E3", paddingVertical: 12, paddingHorizontal: 18, minHeight: 44, borderRadius: 12, marginTop: 8, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.teal, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  loadMore: { backgroundColor: "#EAF2E3", borderRadius: 12, padding: 12, minHeight: 44, marginTop: 14, alignItems: "center", justifyContent: "center" },
  navSurface: { backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: colors.line },
  navRow: { width: "100%", maxWidth: 430, alignSelf: "center", flexDirection: "row", paddingHorizontal: 9, paddingTop: 10, paddingBottom: 13 },
  tab: { flex: 1, minWidth: 0, minHeight: 55, alignItems: "center", gap: 5, paddingHorizontal: 1 },
  tabIcon: { width: 49, height: 29, borderRadius: 16, alignItems: "center", justifyContent: "center" }, selectedIcon: { backgroundColor: colors.selected },
  tabLabel: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "500", textAlign: "center", maxWidth: "100%" }, selectedLabel: { color: colors.teal, fontWeight: "700" },
  largeTextNav: { flexWrap: "wrap" },
  largeTextTab: { flex: 0, flexBasis: "50%", flexDirection: "row", justifyContent: "center" },
  largeTextIcon: { width: 32 }, largeTextLabel: { flexShrink: 1 },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.45 },
});
