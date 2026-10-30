import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import { router } from "expo-router";
import type { ClassDetails } from "../../services/api/classes";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as colors } from "../../theme/personal";

export const classroomIllustration = require("../../../assets/illustrations/instructor-classroom.png");

export function InstructorClassCard({ row }: { row: ClassDetails }) {
  const active = row.status === "active";
  const code = row.join_code ? `${row.join_code.slice(0, 3)} ${row.join_code.slice(3)}` : "No active code";
  return <View style={styles.card}>
    <View style={styles.top}>
      <View style={[styles.art, row.language === "tagalog" && styles.peach]}>
        <Image accessible={false} source={classroomIllustration} resizeMode="contain" style={styles.image} />
      </View>
      <View style={styles.status}><View accessible={false} style={[styles.dot, !active && styles.archivedDot]} />
        <Text style={[styles.statusText, !active && styles.archivedText]}>{active ? "Active" : "Archived"}</Text>
      </View>
    </View>
    <Text accessibilityRole="header" style={styles.name}>{row.class_name}</Text>
    <View style={styles.chips}>
      <View style={styles.chip}><Text style={styles.chipText}>Grade {row.grade_level}</Text></View>
      <View style={[styles.chip, styles.language]}><Text style={[styles.chipText, styles.languageText]}>{row.language === "english" ? "English" : "Tagalog"}</Text></View>
    </View>
    <View style={styles.codeRow}><Text style={styles.codeLabel}>Class code</Text>
      <Text selectable accessibilityLabel={row.join_code ? `Class code ${row.join_code}` : "No active code"}
        style={[styles.code, !row.join_code && styles.noCode]}>{code}</Text>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open class: ${row.class_name}`}
        onPress={() => router.push({ pathname: "/class-details", params: { id: row.id } })}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
        <Text style={styles.openText}>Open class</Text><PersonalIcon name="arrow" size={15} color={colors.teal} />
      </Pressable>
      {active && <Pressable accessibilityRole="button" accessibilityLabel={`Overview: ${row.class_name}`}
        onPress={() => router.push({ pathname: "/instructor-monitoring", params: { classId: row.id } })}
        style={({ pressed }) => [styles.overview, pressed && styles.pressed]}><Text style={styles.overviewText}>Overview</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderRadius: 21 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 11 },
  art: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#E8F1DC" },
  peach: { backgroundColor: "#FFF0DC" }, image: { width: 35, height: 35 },
  status: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4B885B" }, archivedDot: { backgroundColor: colors.muted },
  statusText: { fontSize: 11, lineHeight: 17, color: colors.teal, flexShrink: 1 }, archivedText: { color: colors.muted },
  name: { fontSize: 18, lineHeight: 26, letterSpacing: -0.45, fontWeight: "700", color: colors.ink, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderRadius: 7, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#F0F5E9" },
  chipText: { color: "#476352", fontSize: 11, lineHeight: 16, fontWeight: "500" }, language: { backgroundColor: "#F5F4F0" }, languageText: { color: "#6C6F61" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: "#EDF0EA", paddingTop: 13, marginTop: 15 },
  codeLabel: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  code: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: "600", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  noCode: { color: colors.muted, fontSize: 12, letterSpacing: 0, fontWeight: "400" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 15 },
  open: { flexDirection: "row", flexGrow: 1, flexBasis: 140, alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: 10, borderRadius: 12, backgroundColor: "#EAF2E3" },
  openText: { color: colors.teal, fontSize: 13, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
  overview: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 70, paddingVertical: 10, paddingHorizontal: 2 },
  overviewText: { color: colors.teal, fontSize: 12, lineHeight: 20, fontWeight: "600" }, pressed: { opacity: 0.7 },
});
