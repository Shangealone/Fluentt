import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c, PersonalDesign } from "../../theme/personal";

/** Learn-only presentation: other activities keep their own layout and behavior. */
export function LearnScreen({ children, onBack, resetKey }: { children: ReactNode; onBack: () => void; resetKey: string }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [resetKey]);
  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={l.screen}>
    <View style={l.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={l.roundButton}>
        <View style={{ transform: [{ rotate: "180deg" }] }}><PersonalIcon name="arrow" size={20} /></View>
      </Pressable>
      <FluenttLogo size={30} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={() => router.push("/account")} style={l.roundButton}><PersonalIcon name="account" size={21} /></Pressable>
    </View>
    <KeyboardAvoidingView style={l.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={l.content}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></PersonalDesign.Provider>;
}

export function LearnButton({ label, onPress, secondary = false, disabled = false, size = "md" }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; size?: "sm" | "md" }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [l.button, size === "sm" && { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9 }, secondary && l.secondaryButton, disabled && l.disabled, pressed && !disabled && l.pressed]}>
    <Text style={[l.buttonText, size === "sm" && { fontSize: 13 }, secondary && l.secondaryButtonText]}>{label}</Text>
  </Pressable>;
}

export function LearnLink({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [l.link, pressed && l.pressed]}>
    <Text style={l.linkText}>‹</Text><Text style={l.linkText}>{label}</Text>
  </Pressable>;
}

export function LearnHero() {
  return <View style={l.hero}>
    <Image accessible={false} source={require("../../../assets/illustrations/activity-learn.png")} resizeMode="contain" style={l.heroImage} />
    <Text accessibilityRole="header" style={l.heroTitle}>Let’s practice!</Text>
    <Text style={l.heroDescription}>A little practice. A little more confidence.</Text>
  </View>;
}

export function LearnProgress({ position, total }: { position: number; total: number }) {
  return <View style={l.progressGroup}>
    <Text style={l.caption}>Question {position} of {total}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Position in this practice set" accessibilityValue={{ min: 0, max: total, now: position }} style={l.progressTrack}>
      <View style={[l.progressFill, { width: `${(position / Math.max(1, total)) * 100}%` }]} />
    </View>
  </View>;
}

export const l = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  roundButton: { width: 40, minHeight: 40, borderRadius: 22, borderWidth: 1, borderColor: "#D7E2DC", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 16, flexGrow: 1 },
  hero: { backgroundColor: c.selected, borderRadius: 18, paddingHorizontal: 15, paddingTop: 18, paddingBottom: 18, alignItems: "center", gap: 8 },
  heroImage: { width: 86, height: 82 }, heroTitle: { fontSize: 28, lineHeight: 35, letterSpacing: -1, fontWeight: "700", color: c.ink, textAlign: "center" },
  heroDescription: { fontSize: 14, lineHeight: 21, color: c.muted, textAlign: "center" },
  title: { fontSize: 23, lineHeight: 30, letterSpacing: -0.6, fontWeight: "700", color: c.ink },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: "700", color: c.ink, letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 22, color: c.muted }, caption: { fontSize: 13, lineHeight: 20, color: c.muted },
  card: { padding: 14, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, gap: 12 },
  activityTop: { flexDirection: "row", alignItems: "center", gap: 14 }, activityCopy: { flex: 1, minWidth: 0, gap: 6 },
  activityArt: { width: 96, height: 98, borderRadius: 13, backgroundColor: "#FBE5DA", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  activityImage: { width: 94, height: 94 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: c.coral, borderRadius: 11, borderWidth: 1, borderColor: c.coral, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  secondaryButton: { backgroundColor: "#FFFFFF" }, secondaryButtonText: { color: c.coral }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.78 },
  link: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, alignSelf: "flex-start" }, linkText: { color: c.teal, fontSize: 14, lineHeight: 22 },
  progressGroup: { gap: 7 }, progressTrack: { height: 8, borderRadius: 5, backgroundColor: "#E7ECE7", overflow: "hidden" }, progressFill: { height: 8, backgroundColor: "#759E62", borderRadius: 5 },
  taskCard: { alignItems: "center", paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 8 },
  taskTitle: { textAlign: "center", fontSize: 24, lineHeight: 31, fontWeight: "700", letterSpacing: -0.8, color: c.ink },
  play: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.coral, alignItems: "center", justifyContent: "center", marginTop: 8 },
  speaker: { width: 46, height: 46, tintColor: "#FFFFFF" }, playLabel: { fontSize: 14, lineHeight: 21, color: c.ink, fontWeight: "700" },
  slow: { minHeight: 40, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: "#CEDBD2", borderRadius: 24, marginTop: 5, justifyContent: "center" },
  wordsButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12 }, wordsText: { fontSize: 13, lineHeight: 20, color: c.teal, textDecorationLine: "underline" },
  answerGroup: { gap: 9 }, answer: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: "#FFFFFF" },
  selectedAnswer: { borderColor: "#84A767", backgroundColor: c.selected }, answerText: { color: c.ink, fontSize: 17, lineHeight: 25, flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#C9D5CE", alignItems: "center", justifyContent: "center" }, checkedRadio: { borderColor: c.teal }, radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.teal },
  feedback: { backgroundColor: c.selected, borderWidth: 1, borderColor: "#C9DDBA", borderRadius: 13, padding: 14, gap: 4 }, retryFeedback: { backgroundColor: "#FFF1E9", borderColor: "#F3D5C4" },
  note: { backgroundColor: "#F1F5EC", padding: 12, borderRadius: 12, gap: 5 },
  levels: { flexDirection: "row", gap: 7, paddingVertical: 2 }, level: { flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 5, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D7E2DC", borderRadius: 22, backgroundColor: "#FFFFFF" },
  selectedLevel: { backgroundColor: "#DFEDCC", borderColor: "#8DAF70" }, levelText: { fontSize: 12, lineHeight: 18, color: c.ink, textAlign: "center", fontWeight: "500" }, selectedLevelText: { fontWeight: "700" },
  search: { minHeight: 48, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", borderRadius: 12, color: c.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  completion: { paddingVertical: 28, alignItems: "center", gap: 14 }, completionImage: { width: 90, height: 90 },
});
