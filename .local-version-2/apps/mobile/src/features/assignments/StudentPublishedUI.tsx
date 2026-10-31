import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function StudentAssignmentButton({ label, onPress, primary = false, outlined = false, icon, disabled = false, accessibilityLabel }: {
  label: string; onPress: () => void; primary?: boolean; outlined?: boolean; icon?: PersonalIconName; disabled?: boolean; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [a.button, primary && a.primary, outlined && a.outlined, (pressed || disabled) && a.dimmed]}>
    {icon && icon !== "arrow" && <PersonalIcon name={icon} size={17} color={primary ? "#FFFFFF" : c.teal} />}
    <Text style={[a.buttonText, primary && a.primaryText]}>{label}</Text>
    {icon === "arrow" && <PersonalIcon name="arrow" size={17} color={primary ? "#FFFFFF" : c.teal} />}
  </Pressable>;
}

export function StudentAssignmentDisclosure({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={a.disclosure}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [a.disclosureButton, pressed && a.dimmed]}>
      <Text style={a.buttonText}>About this assignment</Text><View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}><PersonalIcon name="chevron" size={13} color={c.teal} /></View>
    </Pressable>
    {expanded && <View style={a.stack}>{children}</View>}
  </View>;
}

/** Layered activity sheets and a copper paperclip, matching the approved preview. */
export function ActivitySheetsArt({ small = false, compact = false }: { small?: boolean; compact?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[art.tile, compact && art.compact, small && art.small]}>
    <View style={[art.drawing, { transform: [{ scale: small ? 0.68 : compact ? 0.92 : 1 }] }]}>
      <View style={art.back} />
      <View style={art.front}>{[0, 1, 2].map(index => <View key={index} style={art.paperLine}><View style={art.box} /><View style={[art.line, index === 2 && art.shortLine]} /></View>)}</View>
      <View style={art.clip}><View style={art.clipInner} /></View>
    </View>
  </View>;
}

export function publishedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Publication date unavailable" : `Published ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
}

export const a = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", minHeight: 80, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, gap: 22, flexGrow: 1 },
  narrow: { paddingHorizontal: 18 }, narrowHeader: { paddingHorizontal: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16 }, heroCopy: { flex: 1, minWidth: 0, gap: 9 },
  stackedHero: { flexDirection: "column-reverse", alignItems: "flex-start" }, stackedCopy: { flex: 0, width: "100%" },
  title: { fontSize: 28, lineHeight: 35, fontWeight: "700", letterSpacing: -1, color: c.ink },
  heading: { fontSize: 19, lineHeight: 28, fontWeight: "700", letterSpacing: -0.5, color: c.ink },
  cardTitle: { fontSize: 18, lineHeight: 27, fontWeight: "700", letterSpacing: -0.35, color: c.ink },
  body: { fontSize: 13, lineHeight: 23, color: c.muted }, small: { fontSize: 12, lineHeight: 20, color: c.muted },
  eyebrow: { fontSize: 12, lineHeight: 20, fontWeight: "600", color: c.teal }, label: { fontSize: 13, lineHeight: 22, fontWeight: "600", color: c.ink },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  refresh: { borderWidth: 0, backgroundColor: "transparent" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 18, gap: 12 },
  stack: { gap: 10 }, list: { gap: 14 }, actions: { gap: 4 },
  date: { fontSize: 11, lineHeight: 19, color: c.muted, textAlign: "right", flexShrink: 1, flexBasis: 170, flexGrow: 1 },
  dateLeft: { textAlign: "left" }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  lessonRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 }, lessonText: { flex: 1 },
  count: { fontSize: 12, lineHeight: 20, fontWeight: "600", color: c.teal },
  button: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 6 },
  buttonText: { fontSize: 13, lineHeight: 21, fontWeight: "600", color: c.teal, flexShrink: 1, textAlign: "center" },
  primary: { minHeight: 49, borderRadius: 13, backgroundColor: c.coral, paddingVertical: 12, paddingHorizontal: 16 }, primaryText: { fontWeight: "700", color: "#FFFFFF" },
  outlined: { borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: "#FFFFFF", paddingHorizontal: 10 }, dimmed: { opacity: 0.45 },
  pager: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 9, paddingTop: 2 },
  state: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 19, gap: 14 }, center: { textAlign: "center" },
  stateSymbol: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, full: { alignSelf: "stretch" },
  detailIntro: { gap: 12 }, detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  context: { gap: 5, paddingVertical: 15, paddingHorizontal: 17, borderRadius: 15, backgroundColor: "#EFF4E9" },
  lessonTitle: { fontSize: 15, lineHeight: 24, fontWeight: "600", color: c.ink },
  instructions: { fontSize: 13, lineHeight: 24, color: "#52685D" },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, type: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: "#F0F3ED", maxWidth: "100%" },
  typeText: { fontSize: 11, lineHeight: 18, color: "#52685D", flexShrink: 1 },
  disclosure: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 4, gap: 4 },
  disclosureButton: { minHeight: 44, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});

const art = StyleSheet.create({
  tile: { width: 84, height: 86, borderRadius: 27, backgroundColor: "#E8F2DC", flexShrink: 0 },
  compact: { width: 74, height: 78, borderRadius: 24 }, small: { width: 54, height: 55, borderRadius: 17, backgroundColor: "#EEF3E8" },
  drawing: { position: "absolute", width: 64, height: 66, left: "50%", top: "50%", marginLeft: -32, marginTop: -33 },
  back: { position: "absolute", width: 40, height: 51, left: 19, top: 9, borderWidth: 2, borderColor: "#669279", borderRadius: 5, backgroundColor: "#F1CDA6", transform: [{ rotate: "12deg" }] },
  front: { position: "absolute", width: 41, height: 52, left: 8, top: 7, borderWidth: 2, borderColor: "#54876A", borderRadius: 5, backgroundColor: "#FFFCEF", paddingTop: 12, paddingHorizontal: 5, gap: 3, transform: [{ rotate: "-7deg" }] },
  paperLine: { flexDirection: "row", alignItems: "center", gap: 4, height: 8 },
  box: { width: 6, height: 6, borderWidth: 1.5, borderColor: "#699479", borderRadius: 2 },
  line: { width: 15, height: 2, backgroundColor: "#A5BD8A", borderRadius: 3 }, shortLine: { width: 10 },
  clip: { position: "absolute", right: 10, top: 2, width: 12, height: 27, borderWidth: 2.5, borderColor: "#C7845A", borderRadius: 9, transform: [{ rotate: "16deg" }] },
  clipInner: { position: "absolute", top: 3, left: 2, width: 4, height: 17, borderWidth: 1.5, borderTopWidth: 0, borderColor: "#C7845A", borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
});
