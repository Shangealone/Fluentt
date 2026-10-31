import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function HomeAction({ label, onPress, icon, variant = "quiet", disabled = false }: {
  label: string; onPress: () => void; icon?: PersonalIconName;
  variant?: "primary" | "secondary" | "quiet"; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [h.action, variant === "primary" && h.primary, variant === "secondary" && h.secondary,
      (pressed || disabled) && h.dimmed]}>
    {icon && icon !== "arrow" && <PersonalIcon name={icon} size={17} color={variant === "primary" ? "#FFFFFF" : c.teal} />}
    <Text style={[h.actionLabel, variant === "primary" && h.primaryLabel]}>{label}</Text>
    {icon === "arrow" && <PersonalIcon name="arrow" size={17} color={variant === "primary" ? "#FFFFFF" : c.teal} />}
  </Pressable>;
}

export function HomeDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={h.disclosure}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} style={({ pressed }) => [h.disclosureToggle, pressed && h.dimmed]}>
      <Text style={h.link}>{title}</Text>
      <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}><PersonalIcon name="chevron" size={13} color={c.teal} /></View>
    </Pressable>
    {expanded && <View style={h.details}>{children}</View>}
  </View>;
}

/** Native shapes mirror the approved schoolbag-and-notebook artwork. */
export function SchoolbagIllustration() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={art.tile}>
    <View style={art.shadow} /><View style={art.notebook}><View style={art.spine} />
      {[9, 15, 21].map(top => <View key={top} style={[art.line, { top }]} />)}
    </View>
    <View style={art.pencil} /><View style={art.handle} />
    <View style={art.bag}><View style={art.flap} /><View style={art.pocket}><View style={art.clasp} /></View></View>
  </View>;
}

export function HomeReadError({ title, error, retry }: { title: string; error: string | null; retry: () => void }) {
  return <View style={[h.card, h.error]}>
    <Text accessibilityRole="alert" style={h.subheading}>{title}</Text>
    <Text style={h.body}>{error || "Check your connection and try again."}</Text>
    <HomeAction label="Try again" variant="secondary" onPress={retry} />
  </View>;
}

export const h = StyleSheet.create({
  page: { gap: 26 }, section: { gap: 12 }, card: { padding: 17, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", gap: 12 },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "700", letterSpacing: -0.55, color: c.ink },
  subheading: { fontSize: 18, lineHeight: 26, fontWeight: "700", letterSpacing: -0.35, color: c.ink },
  body: { fontSize: 13, lineHeight: 21, color: c.muted }, small: { fontSize: 12, lineHeight: 20, color: c.muted },
  link: { fontSize: 13, lineHeight: 21, fontWeight: "600", color: c.teal, flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primary: { backgroundColor: c.coral, borderRadius: 13, paddingHorizontal: 14, minHeight: 48 },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13 },
  actionLabel: { fontSize: 13, lineHeight: 21, color: c.teal, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  primaryLabel: { color: "#FFFFFF", fontWeight: "700" },
  dimmed: { opacity: 0.65 }, disclosure: { gap: 2 },
  disclosureToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 8 },
  details: { gap: 9, paddingBottom: 6 }, error: { backgroundColor: "#FFF8F2" },
  iconLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
});

const art = StyleSheet.create({
  tile: { width: 66, height: 70, borderRadius: 21, backgroundColor: "#E8F2DC", flexShrink: 0 },
  shadow: { position: "absolute", width: 48, height: 6, bottom: 8, left: 10, backgroundColor: "#C6D8B5", borderRadius: 24 },
  notebook: { position: "absolute", width: 21, height: 34, top: 12, right: 9, backgroundColor: "#FFF8E6", borderWidth: 2, borderColor: "#649372", borderRadius: 3, transform: [{ rotate: "13deg" }] },
  spine: { position: "absolute", top: 0, bottom: 0, left: 4, borderLeftWidth: 2, borderColor: "#A6BE86" },
  line: { position: "absolute", width: 8, height: 2, backgroundColor: "#96B67D", left: 8 },
  pencil: { position: "absolute", width: 5, height: 27, left: 8, top: 17, backgroundColor: "#EAA36C", borderWidth: 1.5, borderColor: "#A66D49", borderRadius: 2, transform: [{ rotate: "-14deg" }] },
  handle: { position: "absolute", width: 16, height: 12, left: 21, top: 12, borderWidth: 2, borderColor: "#578267", borderRadius: 7 },
  bag: { position: "absolute", width: 34, height: 39, left: 12, bottom: 12, backgroundColor: "#EDC69A", borderWidth: 2, borderColor: "#578267", borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, transform: [{ rotate: "-6deg" }] },
  flap: { position: "absolute", top: 5, left: 3, right: 3, height: 13, backgroundColor: "#F7D6AB", borderBottomWidth: 2, borderColor: "#578267", borderRadius: 6 },
  pocket: { position: "absolute", bottom: 4, left: 6, right: 6, height: 11, backgroundColor: "#E0AE80", borderWidth: 1.5, borderColor: "#578267", borderRadius: 4 },
  clasp: { position: "absolute", left: 6, top: 0, width: 3, height: 4, backgroundColor: "#FFF6DC", borderWidth: 1, borderColor: "#578267", borderRadius: 1 },
});
