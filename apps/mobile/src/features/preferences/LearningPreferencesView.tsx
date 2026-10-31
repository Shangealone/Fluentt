import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { Language } from "../../services/api/identity";

type Props = {
  topics: string; lessons: string; language: Language | null;
  topicsError: string; lessonsError: string; valid: boolean; busy: boolean; error: string;
  onTopics: (value: string) => void; onLessons: (value: string) => void;
  onBack: () => void; onAccount: () => void; onLanguage: () => void; onSave: () => void;
};

function TopicCardsArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
    <View style={[s.sheet, s.backSheet]} /><View style={[s.sheet, s.frontSheet]}><View style={s.sheetTile} /><View style={s.sheetLine} /><View style={[s.sheetLine, s.lastLine]} /></View>
    <View style={s.selection}><Text style={s.check}>✓</Text></View>
  </View>;
}
function FocusField({ kind, value, error, busy, onChange }: {
  kind: "topics" | "lessons"; value: string; error: string; busy: boolean; onChange: (value: string) => void;
}) {
  const topics = kind === "topics", title = topics ? "Topics to explore" : "Lessons to practice";
  return <View style={s.card}>
    <View style={s.row}><View style={[s.tile, !topics && s.lessonTile]}><PersonalIcon name={topics ? "tutor" : "assignments"} size={18} color={topics ? "#4C805F" : "#947043"} /></View><Text accessibilityRole="header" style={[s.heading, s.flex]}>{title}</Text></View>
    <Text style={s.body}>{topics ? "What interests you? Add one topic per line." : "Is there a skill you’d like to work on? Add one per line."}</Text>
    <TextInput accessibilityLabel={title} accessibilityHint="One request per line. Up to 10 requests, 120 characters per request."
      multiline editable={!busy} value={value} onChangeText={onChange} placeholderTextColor="#7B8982" textAlignVertical="top"
      placeholder={topics ? "Everyday conversation\nSchool life" : "Asking politely\nWriting a short paragraph"} style={[s.input, !!error && s.invalid]} />
    <Text style={s.caption}>Up to 10 requests · 120 characters per line</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}

export function LearningPreferencesView(p: Props) {
  const { width, fontScale } = useWindowDimensions();
  const [about, setAbout] = useState(false);
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={[s.header, width < 360 && s.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: p.busy }} disabled={p.busy} onPress={p.onBack} style={[s.circle, p.busy && s.disabled]}><View style={s.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: p.busy }} disabled={p.busy} onPress={p.onAccount} style={[s.circle, p.busy && s.disabled]}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
        <View style={[s.hero, (width < 360 || fontScale > 1.2) && s.stacked]}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>Your learning focus</Text><Text style={s.subtitle}>Choose what you’d like to practice.</Text></View><TopicCardsArt /></View>
        <FocusField kind="topics" value={p.topics} error={p.topicsError} busy={p.busy} onChange={p.onTopics} />
        <FocusField kind="lessons" value={p.lessons} error={p.lessonsError} busy={p.busy} onChange={p.onLessons} />
        <View style={s.card}><View style={s.row}><View style={s.languageTile}><PersonalIcon name="voice" size={20} color="#7B65A0" /></View><View style={s.flex}><Text accessibilityRole="header" style={s.languageHeading}>Learning language</Text><Text style={s.language}>{p.language === "english" ? "English" : p.language === "tagalog" ? "Tagalog" : "Choose a language"}</Text></View></View><View style={s.divider} />
          <Pressable accessibilityRole="button" disabled={p.busy} accessibilityState={{ disabled: p.busy }} onPress={p.onLanguage} style={[s.linkRow, p.busy && s.disabled]}><Text style={[s.link, s.flex]}>Change language or starting level</Text><PersonalIcon name="arrow" size={17} /></Pressable>
        </View>
        {!!p.error && <View style={s.errorCard}><Text accessibilityRole="alert" style={s.error}>We couldn’t save your preferences. Your changes are still here. {p.error}</Text></View>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: p.busy || !p.valid, busy: p.busy }} disabled={p.busy || !p.valid} onPress={p.onSave} style={[s.save, (p.busy || !p.valid) && s.disabled]}><Text style={s.saveText}>{p.busy ? "Saving preferences…" : "Save preferences"}</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={s.guidance}>{p.busy ? "Please wait while we save your preferences." : !p.topics.trim() && !p.lessons.trim() ? "Add at least one topic or lesson to save." : "You can change your learning focus whenever you like."}</Text>
        <View><Pressable accessibilityRole="button" accessibilityState={{ expanded: about }} onPress={() => setAbout(value => !value)} style={s.about}><View style={about ? s.openIcon : undefined}><PersonalIcon name="chevron" size={14} /></View><Text style={[s.link, s.flex]}>About your learning focus</Text></Pressable>{about && <View style={s.aboutCopy}><Text style={s.body}>Your topics and lessons describe what you’d like to practice. Available lessons may differ.</Text><Text style={s.body}>These choices are saved to your profile. They don’t measure your ability or give you a grade.</Text></View>}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  circle: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, backIcon: { transform: [{ rotate: "90deg" }] }, openIcon: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 17 }, compact: { paddingHorizontal: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0, gap: 12 },
  title: { fontSize: 29, lineHeight: 36, fontWeight: "700", letterSpacing: -1.1, color: c.ink }, subtitle: { fontSize: 14, lineHeight: 24, color: c.muted },
  card: { padding: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 23, gap: 9 }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, heading: { fontSize: 17, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3, color: c.ink },
  tile: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EAF0DB", alignItems: "center", justifyContent: "center" }, lessonTile: { backgroundColor: "#FAECD7" },
  body: { fontSize: 13, lineHeight: 22, color: c.muted }, input: { minHeight: 118, width: "100%", fontSize: 16, lineHeight: 28, color: c.ink, borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 14, backgroundColor: "#FAFBF8", paddingHorizontal: 13, paddingVertical: 12, marginTop: 3 }, invalid: { borderColor: "#BD4D38", backgroundColor: "#FFFAF8" },
  caption: { fontSize: 11, lineHeight: 19, color: c.muted }, error: { fontSize: 13, lineHeight: 23, color: "#AA3728" }, errorCard: { backgroundColor: "#FFF0E9", padding: 14, borderRadius: 15 },
  languageTile: { height: 43, width: 43, backgroundColor: "#EEE8FA", borderRadius: 14, alignItems: "center", justifyContent: "center" }, languageHeading: { fontSize: 15, lineHeight: 24, fontWeight: "700", color: c.ink }, language: { fontSize: 15, lineHeight: 25, color: c.ink, marginTop: 3 },
  divider: { height: 1, backgroundColor: c.line, marginTop: 5 }, linkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 8 }, link: { fontSize: 13, lineHeight: 22, fontWeight: "600", color: c.teal },
  save: { minHeight: 56, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18, backgroundColor: c.coral, alignItems: "center", justifyContent: "center" }, saveText: { fontSize: 15, lineHeight: 25, fontWeight: "700", color: "#FFFFFF", textAlign: "center" }, disabled: { opacity: 0.5 },
  guidance: { fontSize: 12, lineHeight: 21, color: c.muted, textAlign: "center", marginTop: -8 }, about: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9 }, aboutCopy: { gap: 9 },
  art: { position: "relative", width: 94, height: 100, borderRadius: 30, backgroundColor: "#EEE8FA" }, sheet: { position: "absolute", width: 48, height: 59, borderWidth: 2, borderColor: "#538766", borderRadius: 6 }, backSheet: { backgroundColor: "#E2EDC9", left: 17, top: 24, transform: [{ rotate: "-11deg" }] }, frontSheet: { backgroundColor: "#FFFDF3", left: 29, top: 19, transform: [{ rotate: "9deg" }], padding: 8 }, sheetTile: { width: 12, height: 12, backgroundColor: "#F3C18C", borderRadius: 3, marginBottom: 8 }, sheetLine: { width: 25, height: 3, backgroundColor: "#8AAA75" }, lastLine: { marginTop: 5, backgroundColor: "#B5C79C" }, selection: { position: "absolute", bottom: 13, right: 9, width: 27, height: 27, borderRadius: 14, backgroundColor: "#F5B491", borderWidth: 2, borderColor: "#4E7F61", alignItems: "center", justifyContent: "center" }, check: { fontSize: 17, lineHeight: 21, fontWeight: "700", color: "#385F49" },
});
