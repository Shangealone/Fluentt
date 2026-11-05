import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";

export const builderColors = { ink: "#173E3B", muted: "#63766D", teal: "#176556", coral: "#C64A2C", line: "#E1E9E2", background: "#FAFBF7" };
const c = builderColors;
export const b = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, frame: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 22, paddingBottom: 18 },
  circle: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }, back: { backgroundColor: "#EDF2E8", borderColor: "#EDF2E8" },
  content: { padding: 22, paddingTop: 25, paddingBottom: 35, gap: 22 }, stack: { gap: 12 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -1, color: c.ink }, heading: { fontSize: 18, lineHeight: 26, fontWeight: "700", color: c.ink, letterSpacing: -.4 },
  label: { fontSize: 15, lineHeight: 23, fontWeight: "600", color: c.ink }, body: { fontSize: 14, lineHeight: 23, color: c.ink }, muted: { fontSize: 13, lineHeight: 21, color: c.muted }, kicker: { fontSize: 12, lineHeight: 19, color: c.teal, fontWeight: "600" },
  hero: { flexDirection: "row", alignItems: "center", gap: 14 }, heroText: { flex: 1, gap: 7 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 23, padding: 19, gap: 16 },
  input: { fontSize: 16, lineHeight: 24, color: c.ink, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 13, minHeight: 50 }, textarea: { minHeight: 110, textAlignVertical: "top" },
  button: { minHeight: 48, paddingHorizontal: 17, paddingVertical: 12, borderWidth: 1, borderColor: c.line, borderRadius: 15, backgroundColor: c.background, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primary: { backgroundColor: c.coral, borderColor: c.coral }, buttonText: { fontSize: 14, lineHeight: 22, fontWeight: "600", color: c.teal, textAlign: "center", flexShrink: 1 }, white: { color: "#FFFFFF" }, quiet: { backgroundColor: "transparent", borderColor: "transparent" }, disabled: { opacity: .45 }, pressed: { opacity: .75 },
  steps: { flexDirection: "row", gap: 7, paddingHorizontal: 22 }, step: { flex: 1, minHeight: 48, borderBottomWidth: 3, borderBottomColor: "#E4EAE2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 }, stepActive: { borderBottomColor: c.teal }, stepText: { fontSize: 12, lineHeight: 19, color: c.muted, flexShrink: 1 }, stepSelected: { color: c.teal, fontWeight: "600" },
  note: { padding: 15, borderRadius: 16, backgroundColor: "#EEF3E5", gap: 5 }, error: { backgroundColor: "#FFF0EC" }, errorText: { color: "#9C3627" },
  tag: { fontSize: 11, lineHeight: 18, color: "#6B59A0", fontWeight: "600", backgroundColor: "#EFEBFB", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", overflow: "hidden" },
  selected: { backgroundColor: "#EAF2DC", borderColor: c.teal }, choice: { padding: 15, borderRadius: 17, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", flexDirection: "row", gap: 10, alignItems: "center", minHeight: 65 }, choiceText: { flex: 1, gap: 5 }, radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: c.teal }, radioSelected: { backgroundColor: c.teal, borderWidth: 4, borderColor: "#EAF2DC" },
  number: { minWidth: 29, minHeight: 29, padding: 4, borderRadius: 9, backgroundColor: "#EAF2DC", color: c.teal, textAlign: "center", fontWeight: "700", fontSize: 13 }, questionTitle: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, questionCopy: { flex: 1, gap: 7 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, action: { flexGrow: 1, flexBasis: 100 },
  empty: { alignItems: "center", paddingVertical: 28 }, divider: { height: 1, backgroundColor: c.line }, footer: { gap: 8 }, center: { textAlign: "center" },
  art: { width: 84, height: 88, borderRadius: 25, backgroundColor: "#E9EFD8", flexShrink: 0 }, paper: { position: "absolute", top: 13, left: 18, width: 45, height: 60, borderRadius: 5, borderWidth: 2, borderColor: "#57947C", backgroundColor: "#FFFDF0", transform: [{ rotate: "-8deg" }] },
  paperTitle: { position: "absolute", left: 8, top: 8, width: 25, height: 4, borderRadius: 3, backgroundColor: "#66A18A" }, paperLine: { position: "absolute", left: 8, top: 17, width: 25, height: 3, borderRadius: 2, backgroundColor: "#B4C8A6" }, paperRow: { position: "absolute", left: 8, right: 6, flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: "#5A9A82" }, line: { flex: 1, height: 3, backgroundColor: "#B4C8A6" }, pencil: { position: "absolute", right: 15, top: 30, width: 10, height: 49, backgroundColor: "#EAA368", borderWidth: 2, borderColor: "#C47E45", borderTopLeftRadius: 3, borderTopRightRadius: 3, transform: [{ rotate: "26deg" }] }, tip: { position: "absolute", bottom: -9, left: -2, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#6B7663" },
});

export function WorksheetArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={b.art}><View style={b.paper}><View style={b.paperTitle} /><View style={b.paperLine} />{[30, 43].map(top => <View key={top} style={[b.paperRow, { top }]}><View style={b.dot} /><View style={b.line} /></View>)}</View><View style={b.pencil}><View style={b.tip} /></View></View>;
}
export function BuilderButton({ label, onPress, primary = false, disabled = false, quiet = false, busy = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; quiet?: boolean; busy?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [b.button, primary && b.primary, quiet && b.quiet, (disabled || busy) && b.disabled, pressed && b.pressed]}>{busy && <ActivityIndicator size="small" color={primary ? "#FFFFFF" : c.teal} />}<Text style={[b.buttonText, primary && b.white]}>{label}</Text></Pressable>;
}
export function BuilderNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <View accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={[b.note, error && b.error]}><Text style={[b.body, error && b.errorText]}>{children}</Text></View>;
}
export function BuilderHero({ title, description, context }: { title: string; description: string; context?: string }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={b.stack}><View style={[b.hero, (width < 360 || fontScale > 1.2) && b.stacked]}><View style={b.heroText}>{!!context && <Text style={b.kicker}>{context}</Text>}<Text accessibilityRole="header" style={b.title}>{title}</Text></View><WorksheetArt /></View><Text style={b.muted}>{description}</Text></View>;
}
export function BuilderShell({ children, onBack, onAccount, busy = false, step, onStep, resetKey, scrollEnabled = true }: { children: ReactNode; onBack: () => void; onAccount: () => void; busy?: boolean; step?: number; onStep?: (step: number) => void; resetKey?: string; scrollEnabled?: boolean }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { Keyboard.dismiss(); scroll.current?.scrollTo({ y: 0, animated: false }); }, [resetKey]);
  return <SafeAreaView style={b.safe} edges={["top", "bottom"]}><KeyboardAvoidingView style={b.frame} behavior={Platform.OS === "ios" ? "padding" : "height"}><View style={b.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to assignments" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onBack} style={[b.circle, b.back, busy && b.disabled]}><PersonalIcon name="chevron" size={18} /></Pressable><FluenttLogo size={32} /><Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onAccount} style={[b.circle, busy && b.disabled]}><PersonalIcon name="account" size={18} /></Pressable></View>{step !== undefined && <View style={b.steps}>{["Details", "Questions", "Review"].map((label, i) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Step ${i + 1} of 3: ${label}`} accessibilityState={{ selected: i === step, disabled: busy || !onStep }} disabled={busy || !onStep} onPress={() => onStep?.(i)} style={[b.step, step === i && b.stepActive]}><Text style={[b.stepText, step === i && b.stepSelected]}>{i < step ? "✓" : i + 1} {label}</Text></Pressable>)}</View>}<ScrollView ref={scroll} scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled" contentContainerStyle={b.content}>{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
