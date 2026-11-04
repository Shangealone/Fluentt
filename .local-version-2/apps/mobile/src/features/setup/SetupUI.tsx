import { useEffect, useRef, type ComponentRef, type ReactNode, type Ref } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export function SetupArt({ kind }: { kind: "focus" | "language" | "level" }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[u.art, kind === "language" && u.languageArt, kind === "level" && u.levelArt]}>
    {kind === "focus" ? <><View style={u.topicCard}><View style={u.topicLine} /><View style={[u.topicLine, u.topicLineTwo]} /><View style={[u.topicLine, u.topicLineThree]} /></View><View style={u.topicRing} /><View style={u.pencil} /></>
      : kind === "language" ? <><View style={u.greetingCard}><Text allowFontScaling={false} maxFontSizeMultiplier={1} style={u.greetingArtText}>Hello!</Text></View><View style={[u.greetingCard, u.secondGreeting]}><Text allowFontScaling={false} maxFontSizeMultiplier={1} style={[u.greetingArtText, u.secondGreetingText]}>Kumusta!</Text></View></>
        : <><View style={u.stone} /><View style={[u.stone, u.middleStone]} /><View style={[u.stone, u.highStone]} /><View style={u.flagPole}><View style={u.flag} /></View></>}
  </View>;
}

export function SetupFrame({ title, description, art, step, busy, exiting = false, scrollKey = "", backRef, onBack, onAccount, children }: {
  title: string; description: string; art: "focus" | "language" | "level"; step?: 1 | 2; busy: boolean; exiting?: boolean; scrollKey?: string;
  backRef?: Ref<ComponentRef<typeof Pressable>>; onBack: () => void; onAccount: () => void; children: ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [scrollKey]);
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={u.screen}>
    <View style={[u.header, width < 360 && u.compact]}>
      <Pressable ref={backRef} accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onBack} style={[u.circle, busy && u.disabled]}><View style={u.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: busy || exiting }} disabled={busy || exiting} onPress={onAccount} style={[u.circle, (busy || exiting) && u.disabled]}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <KeyboardAvoidingView style={u.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[u.content, width < 360 && u.compact]}>
        <View style={[u.hero, (width < 360 || fontScale > 1.2) && u.stacked]}><View style={u.heroCopy}><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={u.title}>{title}</Text><Text style={u.body}>{description}</Text></View><SetupArt kind={art} /></View>
        {!!step && !exiting && <View accessible accessibilityLabel={`Step ${step} of 2`} style={u.step}><Text accessible={false} style={u.stepText}>Step {step} of 2</Text><View accessible={false} style={u.stepMarks}><View style={[u.stepMark, u.doneMark]} /><View style={[u.stepMark, step === 2 && u.doneMark]} /></View></View>}
        {children}
        <Text style={u.footer}>Small steps. More confidence.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function SetupButton({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[u.button, primary && u.primary, disabled && u.disabled]}><Text style={[u.buttonText, primary && u.primaryText]}>{label}</Text></Pressable>;
}

export const u = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 }, header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, circle: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, backIcon: { transform: [{ rotate: "90deg" }] }, openIcon: { transform: [{ rotate: "180deg" }] }, content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 28, gap: 20 }, compact: { paddingHorizontal: 16 }, hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 3 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start", gap: 18 }, heroCopy: { flex: 1, minWidth: 0, gap: 11 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "700", letterSpacing: -1, color: c.ink }, heading: { fontSize: 18, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3, color: c.ink }, body: { fontSize: 14, lineHeight: 25, color: c.muted }, small: { fontSize: 12, lineHeight: 22, color: c.muted }, card: { padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 23, backgroundColor: "#FFFFFF", gap: 13 }, field: { gap: 9 }, label: { fontSize: 17, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3, color: c.ink }, input: { width: "100%", minHeight: 118, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 14, backgroundColor: "#FAFBF8", color: c.ink, fontSize: 16, lineHeight: 28, marginTop: 3 }, caption: { fontSize: 11, lineHeight: 20, color: c.muted }, error: { fontSize: 12, lineHeight: 22, color: "#A43A28" }, invalid: { borderColor: "#BE523E", backgroundColor: "#FFFAF8" }, notice: { padding: 14, borderRadius: 15, backgroundColor: "#FFF0E9", gap: 9 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 }, stepText: { fontSize: 12, lineHeight: 22, fontWeight: "600", color: c.teal }, stepMarks: { flexDirection: "row", gap: 5 }, stepMark: { width: 26, height: 4, borderRadius: 2, backgroundColor: "#E1E8DB" }, doneMark: { backgroundColor: "#689574" }, choices: { gap: 12 }, choice: { width: "100%", minHeight: 94, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1, borderColor: c.line, borderRadius: 17, backgroundColor: "#FFFFFF" }, selectedChoice: { backgroundColor: "#F1F6E9", borderColor: "#7E9E79" }, choiceCopy: { flex: 1, minWidth: 0, gap: 5 }, choiceTitle: { fontSize: 19, lineHeight: 29, fontWeight: "700", letterSpacing: -0.3, color: c.ink }, choiceDetail: { fontSize: 13, lineHeight: 23, color: c.muted }, greeting: { fontSize: 16, lineHeight: 27, color: c.teal }, radio: { width: 20, height: 20, borderWidth: 1.5, borderColor: "#9CAF97", borderRadius: 10, alignItems: "center", justifyContent: "center" }, radioSelected: { borderColor: c.teal }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.teal },
  button: { width: "100%", minHeight: 54, alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.background }, buttonText: { fontSize: 14, lineHeight: 25, fontWeight: "600", color: c.teal, textAlign: "center" }, primary: { backgroundColor: c.coral, borderColor: c.coral }, primaryText: { color: "#FFFFFF" }, disabled: { opacity: 0.5 }, guidance: { marginTop: -8, fontSize: 12, lineHeight: 22, color: c.muted, textAlign: "center" }, disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }, footer: { fontSize: 12, lineHeight: 22, color: c.muted, textAlign: "center" },
  art: { width: 92, height: 98, borderRadius: 29, backgroundColor: "#E8EFF3" }, languageArt: { backgroundColor: "#EEE8FA" }, levelArt: { backgroundColor: "#E8F0DA" }, topicCard: { position: "absolute", width: 47, height: 54, left: 20, top: 22, borderWidth: 2, borderColor: "#64896B", borderRadius: 6, backgroundColor: "#FFFDF3", transform: [{ rotate: "-8deg" }] }, topicLine: { position: "absolute", width: 26, height: 4, backgroundColor: "#A9BE91", left: 8, top: 10, borderRadius: 2 }, topicLineTwo: { top: 21, backgroundColor: "#D3DFBC" }, topicLineThree: { top: 32, backgroundColor: "#B4C79E" }, topicRing: { position: "absolute", width: 36, height: 17, borderWidth: 2, borderColor: "#D08D64", borderRadius: 18, left: 28, top: 41, transform: [{ rotate: "-5deg" }] }, pencil: { position: "absolute", left: 63, top: 21, width: 8, height: 49, borderWidth: 1.5, borderColor: "#98734C", borderRadius: 3, backgroundColor: "#F3C496", transform: [{ rotate: "28deg" }] },
  greetingCard: { position: "absolute", width: 59, height: 34, left: 12, top: 20, borderWidth: 1.7, borderColor: "#658B6D", borderRadius: 8, backgroundColor: "#FFFDF3", transform: [{ rotate: "-9deg" }], alignItems: "center", justifyContent: "center" }, secondGreeting: { left: 23, top: 47, backgroundColor: "#DCE8C3", transform: [{ rotate: "7deg" }] }, greetingArtText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: "#658B6D" }, secondGreetingText: { fontSize: 11, lineHeight: 17 }, stone: { position: "absolute", width: 24, height: 13, borderWidth: 1.7, borderColor: "#658B6D", borderRadius: 12, backgroundColor: "#C7DCB1", left: 12, top: 70, transform: [{ rotate: "-10deg" }] }, middleStone: { left: 34, top: 53, backgroundColor: "#F4CFAA", transform: [{ rotate: "5deg" }] }, highStone: { left: 57, top: 35, backgroundColor: "#FFF8E7", transform: [{ rotate: "-7deg" }] }, flagPole: { position: "absolute", left: 67, top: 12, width: 2, height: 30, backgroundColor: "#658B6D" }, flag: { position: "absolute", width: 16, height: 12, top: 0, left: 2, backgroundColor: "#E9B287", borderWidth: 1.5, borderColor: "#9A7E54", borderRadius: 3 },
});
