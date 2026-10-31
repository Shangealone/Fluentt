import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function ProgressAction({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.action, secondary && s.secondary, (pressed || disabled) && s.dim]}>
    <Text style={[s.actionText, secondary && s.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function ProgressDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={s.section}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={s.disclosure}>
    <View style={!open && s.closedChevron}><PersonalIcon name="chevron" size={14} color={c.teal} /></View><Text style={s.label}>{title}</Text>
  </Pressable>{open && children}</View>;
}

export function ProgressState({ title, message, loading = false, onRetry }: { title: string; message?: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={[s.card, s.state]} accessibilityLiveRegion="polite">
    {loading ? <ActivityIndicator color={c.teal} /> : <AssignmentRecordArt />}
    <Text accessibilityRole="header" style={[s.heading, s.center]}>{title}</Text>
    {!!message && <Text accessibilityRole={onRetry ? "alert" : undefined} style={[s.body, s.center]}>{message}</Text>}
    {onRetry && <ProgressAction label="Try again" onPress={onRetry} />}
  </View>;
}

/** Layered assignment sheets, matching the approved pastel illustration. */
export function AssignmentRecordArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.recordArt}>
    <View style={s.recordBack} /><View style={s.recordFront}><View style={s.bookmark} />{[0, 1, 2].map(i => <View key={i} style={[s.recordLine, i === 2 && { width: 9 }]} />)}</View>
    <View style={s.recordSeal}><View style={s.check} /></View>
  </View>;
}

export function AssignmentTimelineArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.heroArt}>
    <View style={s.timelinePaper}><View style={s.timelineHeading} />{[0, 1, 2].map(i => <View key={i} style={s.timelineRow}>
      {i < 2 && <View style={s.connector} />}<View style={[s.timelineDot, i === 2 && s.unchecked]}>{i < 2 && <View style={s.tinyCheck} />}</View><View style={s.timelineLine} />
    </View>)}</View><View style={s.pencil}><View style={s.pencilTip} /></View>
  </View>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  circle: { width: 44, minHeight: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" },
  backIcon: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", padding: 22, paddingTop: 14, paddingBottom: 30, gap: 26 },
  compact: { paddingHorizontal: 17 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16 },
  stackedHero: { flexDirection: "column-reverse", alignItems: "flex-start" },
  heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  stackedCopy: { flex: 0, width: "100%" },
  title: { color: c.ink, fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -1 },
  heading: { color: c.ink, fontSize: 19, lineHeight: 28, fontWeight: "700", letterSpacing: -0.5 },
  itemTitle: { color: c.ink, fontSize: 17, lineHeight: 25, fontWeight: "700", letterSpacing: -0.3 },
  body: { color: c.muted, fontSize: 14, lineHeight: 24 },
  small: { color: c.muted, fontSize: 12, lineHeight: 21 },
  label: { color: c.teal, fontSize: 13, lineHeight: 21, fontWeight: "600" },
  section: { gap: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  card: { padding: 19, gap: 14, borderWidth: 1, borderColor: c.line, borderRadius: 23, backgroundColor: "#FFFFFF" },
  counts: { flexDirection: "row", gap: 8 },
  countsStacked: { flexDirection: "column" },
  count: { flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 12, backgroundColor: "#F1F4EB", borderRadius: 13, alignItems: "center", gap: 3 },
  countStacked: { flex: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 },
  number: { color: c.ink, fontSize: 25, lineHeight: 33, fontWeight: "700" },
  countLabel: { color: "#52695D", fontSize: 11, lineHeight: 18, textAlign: "center" },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  status: { flexGrow: 1, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: c.line, borderRadius: 24, backgroundColor: "#FFFFFF" },
  narrowStatus: { flexBasis: "45%" },
  selectedStatus: { backgroundColor: c.teal, borderColor: c.teal },
  selectedText: { color: "#FFFFFF" },
  filters: { backgroundColor: "#EFF3E7", padding: 16, paddingTop: 4, borderRadius: 19, gap: 12 },
  disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  closedChevron: { transform: [{ rotate: "-90deg" }] },
  field: { gap: 5 },
  input: { minHeight: 48, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: c.ink, fontSize: 16, lineHeight: 24 },
  action: { minHeight: 49, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#C64A2C", justifyContent: "center", alignItems: "center" },
  actionText: { color: "#FFFFFF", fontSize: 14, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  secondary: { backgroundColor: "#FFFFFF", borderColor: c.line, borderWidth: 1 },
  secondaryText: { color: c.teal },
  quiet: { minHeight: 44, paddingVertical: 8, justifyContent: "center", alignItems: "center" },
  recordTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  recordCopy: { flex: 1, minWidth: 0, gap: 4 },
  badge: { alignSelf: "flex-start", borderRadius: 18, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: "#EDF0E9" },
  started: { backgroundColor: "#F9EFD9" },
  submitted: { backgroundColor: "#E6F1E7" },
  badgeText: { color: "#546C5E", fontSize: 11, lineHeight: 19, fontWeight: "600" },
  result: { backgroundColor: "#F5F7EF", borderRadius: 12, padding: 13, gap: 3 },
  details: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 3 },
  state: { padding: 26, alignItems: "center", gap: 14 },
  center: { textAlign: "center" },
  dim: { opacity: 0.5 },
  error: { color: "#B33428", fontSize: 13, lineHeight: 22 },
  recordArt: { width: 52, height: 55, borderRadius: 17, backgroundColor: "#F5ECD9" },
  recordBack: { position: "absolute", width: 27, height: 34, left: 10, top: 10, backgroundColor: "#DCE7CD", borderWidth: 1.6, borderColor: "#59816B", borderRadius: 4, transform: [{ rotate: "-12deg" }] },
  recordFront: { position: "absolute", width: 28, height: 35, left: 16, top: 8, backgroundColor: "#FFFDF1", borderWidth: 1.6, borderColor: "#59816B", borderRadius: 4, transform: [{ rotate: "5deg" }], paddingTop: 11, paddingHorizontal: 5, gap: 4 },
  bookmark: { position: "absolute", right: 5, top: -1, width: 6, height: 10, backgroundColor: "#E7A078", borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  recordLine: { width: 14, height: 1.6, backgroundColor: "#91AA83", borderRadius: 2 },
  recordSeal: { position: "absolute", right: 4, bottom: 5, width: 17, height: 17, borderWidth: 1.5, borderColor: "#4B7D63", borderRadius: 9, backgroundColor: "#DCEBC9", alignItems: "center", justifyContent: "center" },
  check: { width: 7, height: 4, borderLeftWidth: 1.6, borderBottomWidth: 1.6, borderColor: "#367053", transform: [{ rotate: "-45deg" }, { translateY: -1 }] },
  heroArt: { width: 88, height: 92, borderRadius: 29, backgroundColor: "#E9EFD9", transform: [{ rotate: "3deg" }] },
  timelinePaper: { position: "absolute", left: 16, top: 13, width: 53, height: 66, borderWidth: 2, borderColor: "#58866B", borderRadius: 5, backgroundColor: "#FFFEF4", transform: [{ rotate: "-9deg" }], paddingTop: 9, paddingHorizontal: 7 },
  timelineHeading: { width: 26, height: 3, borderRadius: 3, backgroundColor: "#58866B", marginBottom: 9 },
  timelineRow: { height: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  connector: { position: "absolute", width: 1, height: 7, backgroundColor: "#89A78B", top: 9, left: 4 },
  timelineDot: { width: 10, height: 10, borderWidth: 1, borderColor: "#58866B", borderRadius: 5, backgroundColor: "#DCE8C4", justifyContent: "center", alignItems: "center" },
  tinyCheck: { width: 5, height: 3, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#176556", transform: [{ rotate: "-45deg" }] },
  unchecked: { backgroundColor: "#FFF8E9" },
  timelineLine: { width: 18, height: 2, backgroundColor: "#A2B598", borderRadius: 2 },
  pencil: { position: "absolute", right: 16, bottom: 10, width: 8, height: 39, backgroundColor: "#EFA674", borderWidth: 1.5, borderColor: "#A96946", borderTopLeftRadius: 3, borderTopRightRadius: 3, transform: [{ rotate: "25deg" }] },
  pencilTip: { position: "absolute", bottom: -7, left: -1, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#836345" },
});
