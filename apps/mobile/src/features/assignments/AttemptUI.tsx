import { useState, type ReactNode, type Ref } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function AttemptFrame({ children, onBack, onAccount, disabled = false, scrollRef }: {
  children: ReactNode; onBack: () => void; onAccount: () => void; disabled?: boolean; scrollRef?: Ref<ScrollView>;
}) {
  const { width } = useWindowDimensions();
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={a.screen}>
    <View style={[a.header, width < 360 && a.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to assignment" accessibilityState={{ disabled }} disabled={disabled} onPress={onBack} style={[a.circle, disabled && a.dim]}><View style={a.back}><PersonalIcon name="arrow" size={20} color={c.teal} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled }} disabled={disabled} onPress={onAccount} style={[a.circle, disabled && a.dim]}><PersonalIcon name="account" size={20} color={c.ink} /></Pressable>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[a.content, width < 360 && a.compact]}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AttemptButton({ label, onPress, disabled = false, secondary = false, busy = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; busy?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress} style={({ pressed }) => [a.button, secondary && a.secondary, (pressed || disabled) && a.dim]}>
    {busy && <ActivityIndicator color={secondary ? c.teal : "#FFFFFF"} size="small" />}<Text style={[a.buttonText, secondary && a.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function AttemptDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={a.section}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={a.disclosure}>
    <View style={!open && a.closedChevron}><PersonalIcon name="chevron" size={14} color={c.teal} /></View><Text style={a.label}>{label}</Text>
  </Pressable>{open && children}</View>;
}

export function AttemptHero({ title }: { title?: string }) {
  const { fontScale } = useWindowDimensions();
  return <View style={[a.hero, fontScale > 1.2 && a.stack]}><View style={[a.heroCopy, fontScale > 1.2 && a.stackedCopy]}>
    <Text style={a.label}>Your assignment</Text>{!!title && <Text accessibilityRole="header" style={a.title}>{title}</Text>}
  </View><AnswerSheetArt /></View>;
}

export function AnswerSheetArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={a.art}>
    <View style={a.paperBack} /><View style={a.paper}><View style={a.paperHeading} />{[0, 1, 2].map(i => <View key={i} style={a.paperRow}><View style={a.paperBox} /><View style={a.paperLine} /></View>)}</View><View style={a.pencil}><View style={a.pencilTip} /></View>
  </View>;
}

export function SubmissionReceiptArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={a.receiptArt}>
    <View style={a.receiptPaper}>{[0, 1, 2].map(i => <View key={i} style={[a.receiptLine, i === 2 && { width: 16 }]} />)}</View>
    <View style={a.receiptTray} /><View style={a.receiptSeal}><View style={a.receiptCheck} /></View>
  </View>;
}

export const a = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 8 },
  circle: { width: 44, minHeight: 44, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" },
  back: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 28, gap: 20 },
  compact: { paddingHorizontal: 17 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  stack: { flexDirection: "column-reverse", alignItems: "flex-start" },
  stackedCopy: { flex: 0, width: "100%" },
  title: { fontSize: 25, lineHeight: 34, fontWeight: "700", letterSpacing: -0.8, color: c.ink },
  heading: { fontSize: 20, lineHeight: 29, fontWeight: "700", letterSpacing: -0.5, color: c.ink },
  itemTitle: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: c.ink },
  label: { fontSize: 12, lineHeight: 21, fontWeight: "600", color: c.teal },
  body: { fontSize: 14, lineHeight: 24, color: c.muted },
  small: { fontSize: 12, lineHeight: 21, color: c.muted },
  section: { gap: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  card: { borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", borderRadius: 23, padding: 20, gap: 16 },
  meta: { backgroundColor: "#EEF3E6", borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15, gap: 7 },
  dirty: { color: "#91672F" },
  stateLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  button: { minHeight: 51, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: c.coral },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 23, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line },
  secondaryText: { color: c.teal },
  dim: { opacity: 0.45 },
  stepper: { flexDirection: "row", gap: 10 },
  step: { flex: 1, minWidth: 0 },
  stackedStepper: { flexDirection: "column" },
  stackedStep: { flex: 0 },
  disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  closedChevron: { transform: [{ rotate: "-90deg" }] },
  quiet: { minHeight: 44, alignItems: "center", justifyContent: "center", padding: 8 },
  menu: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  jump: { flexBasis: "46%", flexGrow: 1, minWidth: 0, padding: 10, minHeight: 60, borderWidth: 1, borderColor: c.line, borderRadius: 13, backgroundColor: "#FFFFFF", gap: 2 },
  fullJump: { flexBasis: "100%" },
  currentJump: { backgroundColor: c.teal, borderColor: c.teal },
  white: { color: "#FFFFFF" },
  notice: { backgroundColor: "#EDF3E5", borderRadius: 16, padding: 15, gap: 9 },
  warning: { backgroundColor: "#FFF2DF" },
  error: { color: "#AB3D29", fontSize: 13, lineHeight: 23 },
  bottom: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 },
  reviewCounts: { flexDirection: "row", gap: 10 },
  reviewCount: { flex: 1, minWidth: 0, borderRadius: 14, backgroundColor: "#EFF3E8", padding: 13, alignItems: "center", gap: 4 },
  number: { color: c.ink, fontSize: 25, lineHeight: 33, fontWeight: "700" },
  reviewRow: { borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  reviewCopy: { flex: 1, minWidth: 0, gap: 2 },
  reviewLink: { minWidth: 44, minHeight: 44, justifyContent: "center", padding: 8 },
  centered: { alignItems: "center", paddingVertical: 27, gap: 15 },
  centerText: { textAlign: "center" },
  art: { width: 79, height: 86, backgroundColor: "#E8EFD8", borderRadius: 26 },
  paperBack: { position: "absolute", left: 15, top: 14, width: 40, height: 54, backgroundColor: "#D1DFBD", borderWidth: 1.7, borderColor: "#61856B", borderRadius: 5, transform: [{ rotate: "-11deg" }] },
  paper: { position: "absolute", left: 22, top: 11, width: 40, height: 55, backgroundColor: "#FFFDF0", borderWidth: 1.7, borderColor: "#58826A", borderRadius: 5, transform: [{ rotate: "5deg" }], paddingTop: 10, paddingHorizontal: 5 },
  paperHeading: { width: 24, height: 3, borderRadius: 3, backgroundColor: "#73946F", marginBottom: 8 },
  paperRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 },
  paperBox: { width: 6, height: 6, borderWidth: 1, borderColor: "#64886C", borderRadius: 2, backgroundColor: "#E4EBD3" },
  paperLine: { width: 17, height: 2, backgroundColor: "#A7B58F", borderRadius: 2 },
  pencil: { position: "absolute", right: 11, bottom: 8, width: 7, height: 38, borderWidth: 1.4, borderColor: "#AB6D47", borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: "#ECA478", transform: [{ rotate: "28deg" }] },
  pencilTip: { position: "absolute", bottom: -7, left: -1, borderLeftWidth: 3.5, borderLeftColor: "transparent", borderRightWidth: 3.5, borderRightColor: "transparent", borderTopWidth: 7, borderTopColor: "#745F44" },
  receiptArt: { width: 108, height: 108, borderRadius: 34, backgroundColor: "#E9EFD9" },
  receiptPaper: { position: "absolute", left: 28, top: 13, width: 48, height: 70, backgroundColor: "#FFFDF0", borderWidth: 2, borderColor: "#5A826B", borderRadius: 5, transform: [{ rotate: "-7deg" }], paddingTop: 13, paddingHorizontal: 8, gap: 7 },
  receiptLine: { height: 3, backgroundColor: "#9AAC8A", borderRadius: 3 },
  receiptTray: { position: "absolute", left: 21, bottom: 18, width: 65, height: 23, borderWidth: 2, borderColor: "#6E9375", borderRadius: 6, backgroundColor: "#CBDDBC", transform: [{ rotate: "-7deg" }] },
  receiptSeal: { position: "absolute", right: 13, bottom: 23, width: 29, height: 29, borderWidth: 2, borderColor: "#548067", borderRadius: 15, backgroundColor: "#F2C8A8", alignItems: "center", justifyContent: "center" },
  receiptCheck: { width: 12, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: "#426D54", transform: [{ rotate: "-45deg" }, { translateY: -1 }] },
});
