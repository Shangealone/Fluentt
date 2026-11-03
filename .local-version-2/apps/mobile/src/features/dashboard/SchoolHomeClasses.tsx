import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import { homeColors as c } from "../../theme/personal";
import { usePagedList } from "./usePagedList";
import { h, HomeAction, HomeReadError, SchoolbagIllustration } from "./SchoolHomeUI";

export function SchoolHomeClasses() {
  const { enrollment, refreshProfile } = useSession();
  const { width, fontScale } = useWindowDimensions();
  const fetchPage = useCallback(async (offset: number) => {
    const rows = await enrollment.mine(offset);
    if (offset === 0 && rows.length === 0) await refreshProfile();
    return rows;
  }, [enrollment, refreshProfile]);
  const { state, reload, more } = usePagedList(fetchPage);
  const largeText = fontScale > 1.2;
  return <View style={h.section}>
    <View style={h.row}><Text accessibilityRole="header" style={h.heading}>Your classes</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh classes" disabled={state.phase === "loading"}
        accessibilityState={{ disabled: state.phase === "loading" }} onPress={reload}
        style={({ pressed }) => [styles.refresh, (pressed || state.phase === "loading") && h.dimmed]}><PersonalIcon name="refresh" size={20} color={c.teal} /></Pressable>
    </View>
    <View style={[h.row, styles.joinRow]}><Text style={h.body}>Learn with your teacher.</Text><HomeAction label="Join a class" icon="plus" onPress={() => router.push("/class-code")} /></View>
    {state.phase === "loading" && <View style={h.card} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}><Text style={h.body}>Loading your classes…</Text></View>}
    {state.phase === "error" && <HomeReadError title="We couldn’t load your classes" error={state.error} retry={reload} />}
    {state.phase === "ready" && state.rows.length === 0 && <View style={[h.card, styles.empty]}>
      <SchoolbagIllustration /><Text accessibilityRole="header" style={[h.subheading, styles.center]}>Your class belongs here</Text>
      <Text style={[h.body, styles.center]}>Enter the class code your teacher gave you to start learning together.</Text>
      <HomeAction label="Join a class" icon="plus" variant="primary" onPress={() => router.push("/class-code")} />
    </View>}
    {state.phase === "ready" && state.rows.map(row => <View key={row.id} style={h.card}>
      <View style={[styles.classTop, largeText && width < 360 && styles.stacked]}>
        <SchoolbagIllustration />
        <View style={[styles.classCopy, largeText && width < 360 && styles.stackedCopy]}><Text accessibilityRole="header" style={h.subheading}>{row.class_name}</Text>
          <Text style={h.small}>Grade {row.grade_level} · {row.language === "english" ? "English" : "Tagalog"}</Text>
        </View>
      </View>
      <View style={styles.teacher}><PersonalIcon name="account" size={16} color={c.muted} /><Text style={[h.small, styles.teacherName]}>{row.instructor_display_name || "Instructor"}</Text></View>
      <HomeAction label="Class lessons" icon="learn" variant="secondary" onPress={() => router.push({ pathname: "/class-lessons", params: { classId: row.class_id } })} />
      <View style={[styles.classActions, largeText && styles.stacked]}>
        <View style={!largeText && styles.primarySlot}><HomeAction label="View assignments" variant="primary" onPress={() => router.push({ pathname: "/published-assignments", params: { classId: row.class_id } })} /></View>
        <View style={!largeText && styles.secondarySlot}><HomeAction label="Class messages" icon="tutor" variant="secondary" onPress={() => router.push({ pathname: "/communication", params: { classId: row.class_id } })} /></View>
      </View>
    </View>)}
    {state.phase === "ready" && state.hasMore && <HomeAction label="Load more classes" variant="secondary" onPress={more} />}
  </View>;
}

const styles = StyleSheet.create({
  refresh: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  joinRow: { marginTop: -9, marginBottom: -3 },
  empty: { alignItems: "center", paddingVertical: 24, gap: 14 }, center: { textAlign: "center" },
  classTop: { flexDirection: "row", alignItems: "center", gap: 14 }, classCopy: { flex: 1, minWidth: 0, gap: 5 },
  teacher: { flexDirection: "row", alignItems: "center", gap: 7 }, teacherName: { flex: 1 },
  classActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primarySlot: { flexGrow: 1, flexBasis: 150 }, secondarySlot: { flexGrow: 1, flexBasis: 120 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  stackedCopy: { flex: 0, width: "100%" },
});
