import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function WritingDisclosure({ label, children, expanded, onToggle }: { label: string; children: ReactNode; expanded?: boolean; onToggle?: () => void }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  return <View style={w.disclosure}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle ?? (() => setLocalOpen(value => !value))} style={w.disclosureButton}><Text style={w.link}>{label}</Text><View style={open && w.up}><PersonalIcon name="chevron" color={c.teal} size={16} /></View></Pressable>{open && <View style={w.stack}>{children}</View>}</View>;
}
export const w = StyleSheet.create({
  stack: { gap: 16 }, intro: { gap: 8 }, title: { fontSize: 28, lineHeight: 37, fontWeight: "700", letterSpacing: -1, color: c.ink }, body: { fontSize: 13, lineHeight: 24, color: c.muted }, small: { fontSize: 11, lineHeight: 21, color: c.muted }, link: { fontSize: 12, lineHeight: 22, color: c.teal, flexShrink: 1 },
  sheet: { padding: 18, gap: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 20 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }, flex: { flex: 1, minWidth: 0 },
  titleInput: { color: c.ink, fontSize: 19, fontWeight: "700", lineHeight: 29, paddingVertical: 6, borderBottomWidth: 1, borderColor: "#EDF0E9" }, writing: { color: c.ink, fontSize: 16, lineHeight: 30, minHeight: 310, padding: 0 },
  menu: { borderWidth: 1, borderColor: c.line, backgroundColor: "#F0F4EB", borderRadius: 14, paddingHorizontal: 13, gap: 4 }, menuItem: { padding: 10, minHeight: 44, borderRadius: 9 }, selected: { backgroundColor: "#FFFFFF" },
  disclosure: { borderTopWidth: 1, borderColor: "#EDF0E9", gap: 4 }, disclosureButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, up: { transform: [{ rotate: "180deg" }] },
  choices: { gap: 5 }, choice: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, borderBottomWidth: 1, borderColor: "#EDF0E9" }, mark: { minWidth: 44, minHeight: 49, alignItems: "center", justifyContent: "center" }, markText: { fontSize: 23, color: c.teal }, choiceInput: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 27, color: c.ink, padding: 10, backgroundColor: "#FAFBF7", borderRadius: 6 },
  typeChoice: { borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: "#FFFFFF", minHeight: 68, padding: 15, gap: 4 }, heading: { color: c.ink, fontSize: 18, lineHeight: 28, fontWeight: "700" },
  error: { color: "#A43A28", fontSize: 12, lineHeight: 22 }, pair: { gap: 10, borderBottomWidth: 1, borderColor: c.line, paddingBottom: 14 }, number: { backgroundColor: "#EDF2E7", color: c.teal, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12 }, steps: { flexDirection: "row", gap: 3, borderBottomWidth: 1, borderColor: c.line, paddingBottom: 9 }, step: { flex: 1, minHeight: 44, borderRadius: 10, padding: 5, justifyContent: "center", alignItems: "center" }, stepSelected: { backgroundColor: "#EDF3E5" }, stepText: { fontSize: 11, lineHeight: 20, color: c.teal, textAlign: "center" },
});
