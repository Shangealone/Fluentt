import { createContext } from "react";
import { StyleSheet } from "react-native";

export const PersonalDesign = createContext(false);
export const pc = {
  background: "#F6F9FB", ink: "#1A2440", navy: "#1A2340", rose: "#8D4F60", pink: "#FBECEF",
  teal: "#004653", aqua: "#E8F7FA", muted: "#646773", surface: "#FFFFFF", line: "#E7EBEF", soft: "#EEF1F4",
};
export const p = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -1, color: pc.ink },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "600", letterSpacing: -0.5, color: pc.ink },
  body: { fontSize: 14, lineHeight: 23, color: pc.muted },
  caption: { fontSize: 11, lineHeight: 17, color: pc.muted, letterSpacing: 0.25 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: pc.rose },
  card: { backgroundColor: pc.surface, padding: 22, borderRadius: 18, gap: 14, borderWidth: 1, borderColor: "#F0F2F5" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  chip: { backgroundColor: pc.soft, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11 },
  chipText: { fontSize: 10, letterSpacing: 0.3, fontWeight: "600", color: pc.ink },
  section: { gap: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { backgroundColor: pc.surface, borderRadius: 16, padding: 18, gap: 8, flexBasis: "46%", flexGrow: 1 },
  metricValue: { fontSize: 30, fontWeight: "700", letterSpacing: -1, color: pc.ink },
  rule: { height: 1, backgroundColor: pc.line },
  note: { padding: 15, borderRadius: 12, backgroundColor: pc.soft, gap: 7 },
});
