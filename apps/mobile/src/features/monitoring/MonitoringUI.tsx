import { useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { Counts, ResultCounts, MonitoredAssignment } from "../../services/api/monitoring";
import type { HistoryItem, SubmissionStatus } from "../../services/api/progress";

export const classroomArt = require("../../../assets/illustrations/instructor-classroom.png");
const art = { classroom: classroomArt, student: require("../../../assets/illustrations/account-student.png"), assignment: require("../../../assets/illustrations/learn-sentence.png") };
export const submissionLabels: Record<SubmissionStatus, string> = { not_started: "Not started", in_progress: "In progress", submitted: "Submitted" };
export const resultLabels: Record<HistoryItem["result_state"], string> = {
  not_submitted: "No submission yet", submitted: "Waiting for evaluation", awaiting_manual_review: "Waiting for review",
  withheld: "Not shared yet", released: "Shared with students", not_applicable: "No scored result",
};

export function Action({ label, onPress, icon, primary = false, quiet = false, outline = false, disabled = false, accessibilityLabel, expanded }: {
  label: string; onPress: () => void; icon?: PersonalIconName; primary?: boolean; quiet?: boolean; outline?: boolean; disabled?: boolean; accessibilityLabel?: string; expanded?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [m.action, primary && m.primary, quiet && m.quiet, outline && m.outline, disabled && m.disabled, pressed && m.pressed]}>
    {icon && <PersonalIcon name={icon} size={15} color={primary ? "#FFFFFF" : c.teal} />}
    <Text style={[m.actionText, primary && m.primaryText, quiet && m.quietText]}>{label}</Text>
  </Pressable>;
}

export function Hero({ title, subtitle, illustration = "classroom", grade, language }: {
  title: string; subtitle?: string; illustration?: keyof typeof art; grade?: number; language?: "english" | "tagalog";
}) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[m.hero, fontScale > 1.2 && m.heroStack]}>
    <View style={m.heroCopy}>
      <Text style={m.eyebrow}>{illustration === "classroom" ? "Your teaching space" : "Class overview"}</Text>
      <Text accessibilityRole="header" style={[m.title, width < 360 && m.compactTitle]}>{title}</Text>
      {!!subtitle && <Text style={m.intro}>{subtitle}</Text>}
      {(grade !== undefined || language) && <View style={m.chips}>
        {grade !== undefined && <View style={m.chip}><Text style={m.chipText}>Grade {grade}</Text></View>}
        {!!language && <View style={[m.chip, m.neutralChip]}><Text style={m.chipText}>{language === "tagalog" ? "Tagalog" : "English"}</Text></View>}
      </View>}
    </View>
    <View style={[m.heroArt, illustration === "student" && m.studentArt, illustration === "assignment" && m.assignmentArt, width < 360 && m.compactArt]}>
      <Image accessible={false} source={art[illustration]} resizeMode="contain" style={m.heroImage} />
    </View>
  </View>;
}

export function CountsRow({ counts }: { counts: Counts }) {
  const { fontScale } = useWindowDimensions();
  return <View style={[m.counts, fontScale > 1.2 && m.countsStack]}>
    {(["not_started", "in_progress", "submitted"] as const).map((key, index) => <View key={key} style={[m.count, index === 1 && m.progressCount, index === 2 && m.submittedCount, fontScale > 1.2 && m.countStack]}>
      <Text style={m.countValue}>{counts[key]}</Text><Text style={m.countLabel}>{submissionLabels[key]}</Text>
    </View>)}
  </View>;
}

export function AboutNumbers({ counts, results, unit, children }: { counts: Counts; results: ResultCounts; unit: "class" | "student" | "assignment"; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const labels: [keyof ResultCounts, string][] = [["awaiting_evaluation", "Waiting for evaluation"], ["awaiting_manual_review", "Waiting for review"], ["withheld", "Not shared yet"], ["released", "Shared with students"], ["not_applicable", "No scored result"]];
  return <View style={m.about}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [m.aboutToggle, pressed && m.pressed]}>
      <Text style={m.aboutLabel}>About these numbers</Text><View style={expanded && m.up}><PersonalIcon name="chevron" size={14} color={c.teal} /></View>
    </Pressable>
    {expanded && <View style={m.aboutBody}>
      <Text style={m.note}>{unit === "class" ? "Each count is one student and one available assignment. A student can appear in more than one count when there are several assignments." : unit === "student" ? "Each count is one available assignment for this student." : "Each count is one current eligible student for this assignment."} Submitted work includes incomplete submissions. These counts do not measure learning ability or grades.</Text>
      {!counts.available && <Text style={m.note}>There are no available {unit === "class" ? "student–assignment combinations" : unit === "student" ? "assignments" : "students"} in this scope.</Text>}
      {labels.map(([key, label]) => <View key={key} style={m.breakdownRow}><Text style={m.breakdownLabel}>{label}</Text><Text style={m.breakdownValue}>{results[key]}</Text></View>)}
      <Text style={m.note}>Only shared objective points appear here. Result review opens separately and checks your access. No scored result means objective scoring does not apply; it is not zero points.</Text>
      {children}
    </View>}
  </View>;
}

export function AssignmentMean({ row }: { row: MonitoredAssignment }) {
  const mean = row.mean;
  return <View style={m.mean}>
    <Text style={m.note}>Average shared points</Text>
    <Text style={m.points}>{mean.status === "available" ? `${mean.mean_points} / ${mean.max_points}` : mean.status === "not_comparable" ? "Results can’t be compared" : "Not available"}</Text>
    <Text style={m.note}>{mean.status === "available" ? `Based on ${mean.eligible_results} comparable shared ${mean.eligible_results === 1 ? "result" : "results"} for this assignment.` : mean.status === "not_comparable" ? "The shared results use different scoring settings, so no average is shown." : "There are no comparable shared results yet."}</Text>
  </View>;
}

export function Badge({ label, muted = false, waiting = false }: { label: string; muted?: boolean; waiting?: boolean }) {
  return <View style={[m.badge, muted && m.mutedBadge, waiting && m.waitingBadge]}><Text style={[m.badgeText, muted && m.mutedBadgeText, waiting && m.waitingBadgeText]}>{label}</Text></View>;
}

export function ResultStatus({ state, submission }: { state: HistoryItem["result_state"]; submission: SubmissionStatus }) {
  return <View style={m.badges}><Badge label={submissionLabels[submission]} muted={submission !== "submitted"} />
    {submission === "submitted" && <Badge label={resultLabels[state]} waiting={state === "submitted" || state === "awaiting_manual_review" || state === "withheld"} muted={state === "not_applicable"} />}
  </View>;
}

export function Updated({ value }: { value: string }) {
  return <Text style={m.footer}>Updated {new Date(value).toLocaleString()}{"\n"}Current class membership and published assignments.</Text>;
}

export const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 27 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 27 },
  circle: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 22 },
  back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "90deg" }] }, up: { transform: [{ rotate: "180deg" }] },
  hero: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 22 }, heroStack: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600", marginBottom: 7 }, title: { color: c.ink, fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -1.1 }, compactTitle: { fontSize: 25, lineHeight: 32 },
  intro: { color: c.muted, fontSize: 13, lineHeight: 21, marginTop: 10 },
  heroArt: { width: 76, height: 83, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomRightRadius: 30, borderBottomLeftRadius: 17, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", transform: [{ rotate: "3deg" }] },
  heroImage: { width: 65, height: 65, transform: [{ rotate: "-3deg" }] }, studentArt: { backgroundColor: "#EEE8FA" }, assignmentArt: { backgroundColor: "#FFF0DD" }, compactArt: { width: 65, height: 73 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 }, chip: { backgroundColor: "#EDF3E5", paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 }, neutralChip: { backgroundColor: "#F1F0E9" }, chipText: { fontSize: 11, lineHeight: 17, fontWeight: "500", color: "#496653" },
  card: { padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF" }, summary: { marginBottom: 17 },
  heading: { color: c.ink, fontSize: 19, lineHeight: 28, letterSpacing: -0.5, fontWeight: "700" }, cardTitle: { color: c.ink, fontSize: 15, lineHeight: 23, letterSpacing: -0.3, fontWeight: "700" },
  kicker: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600" },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 15 },
  totals: { flexDirection: "row", gap: 12, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: "#EEF1EB" }, total: { flex: 1, minWidth: 0 }, secondTotal: { borderLeftWidth: 1, borderLeftColor: "#EEF1EB", paddingLeft: 17 },
  totalValue: { color: c.ink, fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -1 }, totalLabel: { color: c.muted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  counts: { flexDirection: "row", gap: 8, marginTop: 16 }, countsStack: { flexDirection: "column" }, count: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 5, alignItems: "center", borderRadius: 12, backgroundColor: "#F4F5F1" },
  countStack: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 }, progressCount: { backgroundColor: "#FFF3E5" }, submittedCount: { backgroundColor: "#EAF2E3" }, countValue: { color: c.ink, fontSize: 20, lineHeight: 28, fontWeight: "700" }, countLabel: { color: "#52685D", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "center", flexShrink: 1 },
  note: { color: c.muted, fontSize: 11, lineHeight: 19 }, noteSpace: { marginTop: 12 },
  about: { marginTop: 11, borderTopWidth: 1, borderTopColor: "#EEF1EB", paddingTop: 5 }, aboutToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, aboutLabel: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600" }, aboutBody: { gap: 9 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }, breakdownLabel: { flex: 1, color: c.muted, fontSize: 11, lineHeight: 18 }, breakdownValue: { color: c.ink, fontSize: 11, lineHeight: 18 },
  mean: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEF1EB", gap: 5 }, points: { color: c.ink, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 5, padding: 5, borderRadius: 14, backgroundColor: "#EDF1E9", marginTop: 6, marginBottom: 18 }, tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10 }, selectedTab: { backgroundColor: "#FFFFFF" }, tabText: { color: c.muted, fontSize: 12, lineHeight: 19, fontWeight: "600", flexShrink: 1, textAlign: "center" }, selectedTabText: { color: c.teal }, tabStack: { flexDirection: "column" },
  search: { gap: 7 }, fieldLabel: { color: c.ink, fontSize: 11, lineHeight: 18, fontWeight: "600" }, searchRow: { flexDirection: "row", gap: 8 }, searchStack: { flexDirection: "column" },
  input: { flex: 1, minWidth: 0, minHeight: 46, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: "#FFFFFF", color: c.ink, fontSize: 16, lineHeight: 23 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#EAF2E3" }, actionText: { color: c.teal, fontSize: 12, lineHeight: 19, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  primary: { backgroundColor: c.coral, borderBottomWidth: 2, borderBottomColor: "#AC3E23", paddingHorizontal: 16, minHeight: 46 }, primaryText: { color: "#FFFFFF", fontWeight: "700" },
  quiet: { backgroundColor: "transparent", paddingHorizontal: 0 }, quietText: { fontSize: 11, lineHeight: 18 }, outline: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, marginBottom: 16 },
  filters: { padding: 16, gap: 12, borderRadius: 17, backgroundColor: "#F0F4EA", marginBottom: 16 }, filterActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, filterText: { color: c.teal, fontSize: 11, lineHeight: 19, marginBottom: 12 }, filterOptions: { gap: 9 },
  list: { gap: 13 }, rowTop: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 }, rowCopy: { flex: 1, minWidth: 0 }, tile: { width: 42, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#EEE8FA" }, avatar: { backgroundColor: "#EAF1DA" }, avatarText: { color: c.teal, fontSize: 14, lineHeight: 22, fontWeight: "700" }, tileImage: { width: 35, height: 35 }, subline: { color: c.muted, fontSize: 11, lineHeight: 19, marginTop: 5 },
  lesson: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 11 }, lessonText: { color: c.muted, fontSize: 11, lineHeight: 19, flex: 1 }, cardAction: { marginTop: 16 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13, marginBottom: 9 }, badge: { borderRadius: 8, backgroundColor: "#EAF2E3", paddingVertical: 5, paddingHorizontal: 9 }, badgeText: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "500" }, mutedBadge: { backgroundColor: "#F0F2EE" }, mutedBadgeText: { color: c.muted }, waitingBadge: { backgroundColor: "#FFF0DD" }, waitingBadgeText: { color: "#8A6735" },
  sectionTitle: { marginTop: 6, marginBottom: 13 }, scopeNote: { marginBottom: 15 }, footer: { color: c.muted, fontSize: 11, lineHeight: 19, textAlign: "center", marginTop: 17 },
  state: { alignItems: "center", paddingVertical: 26, gap: 8 }, stateArt: { width: 64, height: 68, borderRadius: 20, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", marginBottom: 7 }, stateImage: { width: 57, height: 57 }, stateText: { textAlign: "center" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 }, pageLabel: { color: c.muted, fontSize: 11, lineHeight: 19 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
