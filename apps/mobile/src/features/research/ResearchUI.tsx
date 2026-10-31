import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function ResearchArt({ kind = "study" }: { kind?: "study" | "activity" | "complete" }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[r.art, kind === "activity" && r.activityArt, kind === "complete" && r.completeArt]}>
    <View style={[r.paper, r.backPaper]} /><View style={r.paper}><View style={r.artLine} /><View style={[r.artLine, r.shortLine]} /><View style={r.artLine} /></View>
    {kind === "study" ? <View style={r.glass}><View style={r.glassHandle} /></View> : kind === "activity" ? <View style={r.pencil} /> : <View style={r.artSeal}><Text style={r.artCheck}>✓</Text></View>}
  </View>;
}

export function ResearchFrame({ title, description, art, busy, scrollKey, onBack, onAccount, children }: {
  title: string; description: string; art?: "study" | "activity" | "complete"; busy: boolean; scrollKey: number;
  onBack: () => void; onAccount: () => void; children: ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [scrollKey]);
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={r.screen}>
    <View style={[r.header, width < 360 && r.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onBack} style={[r.circle, busy && r.disabled]}><View style={r.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onAccount} style={[r.circle, busy && r.disabled]}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <KeyboardAvoidingView style={r.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[r.content, width < 360 && r.compact]}>
        <View style={[r.hero, (width < 360 || fontScale > 1.2) && r.stacked]}><View style={r.heroCopy}><Text accessibilityRole="header" style={r.title}>{title}</Text><Text style={r.body}>{description}</Text></View><ResearchArt kind={art} /></View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function ResearchButton({ label, onPress, primary = false, disabled = false, quiet = false, danger = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; quiet?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[r.button, primary && r.primary, quiet && r.quiet, disabled && r.disabled]}><Text style={[r.buttonText, primary && r.primaryText, danger && !primary && r.dangerText]}>{label}</Text></Pressable>;
}
export function ResearchBadge({ label, quiet = false }: { label: string; quiet?: boolean }) { return <View style={[r.badge, quiet && r.quietBadge]}><Text style={[r.badgeText, quiet && r.small]}>{label}</Text></View>; }
export function ResearchNotice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <View style={[r.notice, error && r.errorNotice]}><Text accessibilityRole={error ? "alert" : undefined} style={[r.body, error && r.dangerText]}>{children}</Text></View>; }
export function ResearchLoading() { return <View style={r.card}><ActivityIndicator color={c.teal} accessibilityLabel="Loading study information" /><Text accessibilityLiveRegion="polite" style={r.heading}>Loading study information…</Text></View>; }
export function ResearchDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={r.disclosure}><View style={open ? r.openIcon : undefined}><PersonalIcon name="chevron" size={14} /></View><Text style={[r.buttonText, r.flex]}>{title}</Text></Pressable>{open && <View style={r.section}>{children}</View>}</View>;
}
export function ResearchCode({ code }: { code: string }) { return <View style={r.code}><Text style={r.small}>Your participant code</Text><Text selectable style={r.codeValue}>{code}</Text></View>; }
export function ResearchRefresh({ disabled, onPress }: { disabled: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel="Refresh study information" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[r.circle, disabled && r.disabled]}><PersonalIcon name="refresh" size={18} /></Pressable>; }
export function researchDate(value?: string | null) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
export function researchLabel(value: string) { const label = value.replace(/_/g, " "); return label.charAt(0).toUpperCase() + label.slice(1); }

export const r = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 }, header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, circle: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, backIcon: { transform: [{ rotate: "90deg" }] }, openIcon: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 20 }, compact: { paddingHorizontal: 16 }, hero: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 3 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0, gap: 10 }, title: { fontSize: 29, lineHeight: 37, fontWeight: "700", letterSpacing: -1, color: c.ink }, heading: { fontSize: 19, lineHeight: 29, fontWeight: "700", letterSpacing: -0.4, color: c.ink }, subheading: { fontSize: 16, lineHeight: 26, fontWeight: "700", color: c.ink }, body: { fontSize: 14, lineHeight: 26, color: c.muted }, small: { fontSize: 12, lineHeight: 22, color: c.muted },
  card: { padding: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 23, gap: 12 }, section: { gap: 12 }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }, tabs: { flexDirection: "row", backgroundColor: "#EDF1E7", padding: 5, gap: 5, borderRadius: 17 }, tab: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 10 }, selectedTab: { backgroundColor: "#FFFFFF" }, tabText: { fontSize: 13, lineHeight: 23, fontWeight: "600", color: c.teal, textAlign: "center" },
  badge: { alignSelf: "flex-start", maxWidth: "100%", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#EDF3E5" }, badgeText: { color: c.teal, fontSize: 12, lineHeight: 22, fontWeight: "600" }, quietBadge: { backgroundColor: "#EEF0EB" },
  button: { minHeight: 52, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line, borderRadius: 15, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, buttonText: { fontSize: 14, lineHeight: 25, fontWeight: "600", color: c.teal, textAlign: "center" }, primary: { backgroundColor: c.coral, borderColor: c.coral }, primaryText: { color: "#FFFFFF" }, quiet: { backgroundColor: "transparent", borderWidth: 0, minHeight: 44 }, disabled: { opacity: 0.5 }, dangerText: { color: "#A13D2B" },
  notice: { backgroundColor: "#EEF3E7", padding: 15, borderRadius: 17 }, errorNotice: { backgroundColor: "#FFF0E9" }, code: { padding: 13, backgroundColor: "#F2F5EC", borderRadius: 15, gap: 3 }, codeValue: { fontSize: 21, lineHeight: 30, letterSpacing: 0.6, fontWeight: "700", color: c.ink }, disclosure: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 8 },
  choice: { flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 13 }, selectedChoice: { backgroundColor: "#EFF5E8", borderColor: "#79A181" }, choiceMark: { width: 19, height: 19, borderWidth: 1.5, borderColor: c.teal, borderRadius: 10, marginTop: 3, alignItems: "center", justifyContent: "center" }, checkBox: { borderRadius: 4 }, markText: { color: c.teal, fontSize: 12, lineHeight: 16, fontWeight: "700" }, selectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.teal }, input: { minHeight: 54, padding: 13, borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 13, backgroundColor: "#FAFBF8", color: c.ink, fontSize: 16, lineHeight: 28 }, question: { fontSize: 18, lineHeight: 31, fontWeight: "600", color: c.ink }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, action: { flex: 1, minWidth: 95 }, answerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 10 }, points: { fontSize: 32, lineHeight: 45, fontWeight: "700", letterSpacing: -0.7, color: c.ink }, pointsTotal: { fontSize: 18, lineHeight: 28, fontWeight: "500", color: c.muted },
  art: { width: 90, height: 96, borderRadius: 28, backgroundColor: "#E6EFF3" }, activityArt: { backgroundColor: "#EEE9F9" }, completeArt: { backgroundColor: "#E8F0DA" }, paper: { position: "absolute", left: 17, top: 20, width: 46, height: 56, borderWidth: 2, borderColor: "#5E886D", borderRadius: 6, backgroundColor: "#FFFDF3", transform: [{ rotate: "-8deg" }], paddingVertical: 10, paddingHorizontal: 7 }, backPaper: { left: 25, top: 23, backgroundColor: "#DAE6C4", transform: [{ rotate: "8deg" }] }, artLine: { height: 3, width: 27, backgroundColor: "#8AAA7E", marginBottom: 7, borderRadius: 2 }, shortLine: { width: 18, backgroundColor: "#BED0A5" }, glass: { position: "absolute", left: 43, top: 39, width: 28, height: 28, borderWidth: 3, borderColor: "#5E886D", borderRadius: 14, backgroundColor: "#E2EEF0E6" }, glassHandle: { position: "absolute", left: 24, top: 19, width: 9, height: 24, borderWidth: 2, borderColor: "#967348", backgroundColor: "#F3C492", borderRadius: 4, transform: [{ rotate: "-38deg" }] }, artSeal: { position: "absolute", right: 8, bottom: 14, width: 27, height: 27, borderWidth: 2, borderColor: "#5E886D", borderRadius: 14, backgroundColor: "#F4BE98", alignItems: "center", justifyContent: "center" }, artCheck: { color: "#486A4E", fontSize: 18, lineHeight: 22, fontWeight: "700" }, pencil: { position: "absolute", right: 18, top: 26, width: 9, height: 55, backgroundColor: "#F1BC8E", borderWidth: 2, borderColor: "#997449", transform: [{ rotate: "30deg" }], borderRadius: 3 },
});
