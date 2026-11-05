import { classProficiencyLabel } from "../../services/api/classProficiency";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { ClassDetails } from "../../services/api/classes";
import { CodeCard } from "./CodeCard";

export type ClassAction = "lessons" | "assignments" | "assessments" | "overview" | "messages" | "edit";
type Props = {
  row: ClassDetails | null; phase: "loading" | "ready" | "error"; error: string | null; created: boolean;
  onRetry: () => void; onAction: (action: ClassAction) => void; onBack: () => void; onAccount: () => void;
};
const actions: { id: ClassAction; title: string; description: string; icon: PersonalIconName; background: string; color: string }[] = [
  { id: "lessons", title: "Lessons", description: "Create lessons and share them with your class.", icon: "learn", background: "#E9EFDB", color: "#64866B" },
  { id: "assignments", title: "Assignments", description: "Prepare and share class activities.", icon: "assignments", background: "#EEE8FA", color: "#7863A4" },
  { id: "assessments", title: "Class assessments", description: "Prepare a research pretest or posttest.", icon: "assignments", background: "#EEE8FA", color: "#7863A4" },
  { id: "overview", title: "Overview", description: "View student submissions and released results.", icon: "overview", background: "#FFF0DD", color: "#A87537" },
  { id: "messages", title: "Messages", description: "Send announcements and messages.", icon: "tutor", background: "#E6F2F5", color: "#4C8591" },
];

export function ClassDetailsView({ row, phase, error, created, onRetry, onAction, onBack, onAccount }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const stacked = compact || fontScale > 1.2;
  const loaded = phase === "ready" && row;
  return <SafeAreaView style={s.screen}>
    <ScrollView contentContainerStyle={[s.content, compact && s.compact]} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to classes" onPress={onBack} style={({ pressed }) => [s.circle, s.back, pressed && s.pressed]}>
          <View style={s.backIcon}><PersonalIcon name="chevron" size={19} /></View>
        </Pressable>
        <FluenttLogo size={32} />
        <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [s.circle, pressed && s.pressed]}>
          <PersonalIcon name="account" size={20} />
        </Pressable>
      </View>
      {phase === "loading" && <View accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={s.stateCard}>
        <View style={s.loadingArt}><ActivityIndicator color={c.teal} /></View>
        <Text accessibilityRole="header" style={s.stateTitle}>Loading your class…</Text>
        <Text style={s.stateDescription}>Getting the latest class details.</Text>
      </View>}
      {phase === "error" && <View style={s.stateCard}>
        <Text accessibilityRole="header" style={s.stateTitle}>We couldn’t load this class</Text>
        <Text accessibilityRole="alert" style={s.stateDescription}>{error || "Please check your connection and try again."}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [s.retry, pressed && s.pressed]}><Text style={s.retryText}>Try again</Text></Pressable>
      </View>}
      {loaded && <>
        {created && <View accessibilityLiveRegion="polite" style={s.banner}>
          <Text accessible={false} style={s.check}>✓</Text>
          <Text style={s.bannerText}>{row.join_code ? "Your class is ready! Share its code below." : "Your class is ready!"}</Text>
        </View>}
        <View style={s.hero}>
          <View style={[s.heroRow, stacked && s.heroStack]}>
            <View style={s.heroCopy}>
              <Text style={s.eyebrow}>Your classroom</Text>
              <Text accessibilityRole="header" style={s.title}>{row.class_name}</Text>
            </View>
            <View style={s.art}><Image accessible={false} source={require("../../../assets/illustrations/instructor-classroom.png")} resizeMode="contain" style={s.artImage} /></View>
          </View>
          <View style={s.meta}>
            <View style={s.chip}><Text style={s.chipText}>{classProficiencyLabel(row.proficiency_level)}</Text></View>
            <View style={[s.chip, s.languageChip]}><Text style={[s.chipText, s.languageText]}>{row.language === "english" ? "English" : "Tagalog"}</Text></View>
            <View style={s.status}><View style={[s.statusDot, row.status === "archived" && s.archivedDot]} /><Text style={[s.statusText, row.status === "archived" && s.archivedText]}>{row.status === "active" ? "Active" : "Archived"}</Text></View>
          </View>
          {!!row.description && <Text style={s.note}>{row.description}</Text>}
        </View>
        <CodeCard key={row.id + ":" + row.join_code} code={row.join_code} name={row.class_name} />
        <Text accessibilityRole="header" style={s.sectionTitle}>Manage your class</Text>
        <View style={s.actionList}>
          {actions.map((action, index) => {
            const disabled = action.id !== "assignments" && row.status !== "active";
            return <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={action.title}
              accessibilityHint={action.description} accessibilityState={{ disabled }} disabled={disabled}
              onPress={() => onAction(action.id)} style={({ pressed }) => [s.actionRow, index > 0 && s.rowBorder, disabled && s.disabled, pressed && s.pressed]}>
              <View style={[s.actionArt, { backgroundColor: action.background }]}><PersonalIcon name={action.icon} size={21} color={action.color} /></View>
              <View style={s.actionCopy}><Text style={s.actionTitle}>{action.title}</Text><Text style={s.actionDescription}>{action.description}</Text></View>
              <View style={s.rowChevron}><PersonalIcon name="chevron" size={16} color={c.teal} /></View>
            </Pressable>;
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit class" accessibilityState={{ disabled: row.status !== "active" }} disabled={row.status !== "active"}
          onPress={() => onAction("edit")} style={({ pressed }) => [s.edit, row.status !== "active" && s.disabled, pressed && s.pressed]}>
          <PersonalIcon name="settings" size={15} color={c.teal} /><Text style={s.editText}>Edit class</Text>
        </Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 27 },
  circle: { width: 44, height: 44, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  back: { borderColor: "transparent", backgroundColor: "#EDF3E8" }, backIcon: { transform: [{ rotate: "90deg" }] },
  hero: { marginBottom: 23 }, heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15 },
  heroStack: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { marginBottom: 8, color: c.teal, fontSize: 11, lineHeight: 17, fontWeight: "600" },
  title: { color: c.ink, fontSize: 25, lineHeight: 33, letterSpacing: -0.9, fontWeight: "700" },
  art: { width: 72, height: 78, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomRightRadius: 28, borderBottomLeftRadius: 17, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", transform: [{ rotate: "3deg" }] },
  artImage: { width: 58, height: 58, transform: [{ rotate: "-3deg" }] },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 15 },
  chip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: "#EDF3E5" },
  chipText: { color: "#496653", fontSize: 11, lineHeight: 17, fontWeight: "500" }, languageChip: { backgroundColor: "#F1F0E9" }, languageText: { color: "#626757" },
  status: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.teal },
  statusText: { color: c.teal, fontSize: 11, lineHeight: 17 }, archivedDot: { backgroundColor: c.muted }, archivedText: { color: c.muted },
  note: { marginTop: 12, color: c.muted, fontSize: 12, lineHeight: 21 },
  sectionTitle: { marginTop: 25, marginBottom: 12, color: c.ink, fontSize: 17, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  actionList: { borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF", overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 91, paddingVertical: 17, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#EEF1EB" },
  actionArt: { width: 42, height: 45, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0, gap: 4 }, actionTitle: { color: c.ink, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  actionDescription: { color: c.muted, fontSize: 11, lineHeight: 18 }, rowChevron: { transform: [{ rotate: "-90deg" }] },
  edit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, marginTop: 12, padding: 10 },
  editText: { color: c.teal, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 17, borderRadius: 13, backgroundColor: c.selected },
  bannerText: { color: c.teal, fontSize: 12, lineHeight: 19, fontWeight: "600", flex: 1 }, check: { color: c.teal, fontSize: 17 },
  stateCard: { paddingVertical: 28, paddingHorizontal: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 22, alignItems: "center", gap: 10 },
  loadingArt: { width: 53, height: 53, borderRadius: 18, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", marginBottom: 3 },
  stateTitle: { color: c.ink, fontSize: 17, lineHeight: 26, fontWeight: "700", textAlign: "center" },
  stateDescription: { color: c.muted, fontSize: 13, lineHeight: 22, textAlign: "center" },
  retry: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12, backgroundColor: c.coral, justifyContent: "center", marginTop: 5 },
  retryText: { color: "#FFFFFF", fontSize: 13, lineHeight: 20, fontWeight: "600" }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
