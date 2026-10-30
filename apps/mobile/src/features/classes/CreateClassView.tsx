import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { Language } from "../../services/api/identity";
import { grades, languages } from "../../components/onboarding";

export type CreateClassFields = { class_name: string; grade_level: number | null; language: Language | null; description: string };
type Props = {
  fields: CreateClassFields; operation: "save" | "check" | null; locked: boolean; error: string;
  mode?: "create" | "edit"; phase?: "loading" | "ready" | "error"; onRetry?: () => void;
  onChange: (fields: CreateClassFields) => void; onSubmit: () => void; onCheckClasses: () => void;
  onBack: () => void; onAccount: () => void;
};

export function CreateClassView({ fields, operation, locked, error, onChange, onSubmit, onCheckClasses, onBack, onAccount, mode = "create", phase = "ready", onRetry }: Props) {
  const editing = mode === "edit";
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const expanded = compact || fontScale > 1.2;
  const busy = operation !== null;
  const disabled = busy || locked;
  const [noteOpen, setNoteOpen] = useState(editing && !!fields.description);
  const submitLabel = operation === "save" ? editing ? "Saving changes…" : "Saving class…" : locked ? "Try saving again" : editing ? "Save changes" : "Create class";
  return <SafeAreaView style={s.screen}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[s.content, compact && s.compact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Back to class" : "Back to classes"} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onBack} style={[s.circle, s.back, busy && s.dim]}>
            <View style={s.backIcon}><PersonalIcon name="chevron" size={19} /></View>
          </Pressable>
          <FluenttLogo size={32} />
          <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onAccount} style={[s.circle, busy && s.dim]}>
            <PersonalIcon name="account" size={20} />
          </Pressable>
        </View>
        <View style={s.hero}>
          <View style={[s.heroRow, expanded && s.heroStack]}>
            <Text accessibilityRole="header" style={s.title}>{editing ? "Edit your\nclass." : "A space for\nyour class."}</Text>
            <View style={s.art}><Image accessible={false} source={require("../../../assets/illustrations/instructor-classroom.png")} resizeMode="contain" style={s.artImage} /></View>
          </View>
          <Text style={s.subtitle}>{editing ? "Keep your class details up to date." : "A few details, then you’re ready to welcome your students."}</Text>
        </View>
        {phase !== "ready" ? <View style={[s.card, s.state]} accessibilityLiveRegion="polite" accessibilityState={{ busy: phase === "loading" }}>
          {phase === "loading" ? <><ActivityIndicator color={c.teal} /><Text style={s.label}>Loading your class…</Text></>
            : <><Text accessibilityRole="header" style={s.label}>We couldn’t load your class</Text><Text accessibilityRole="alert" style={s.stateMessage}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={onRetry} style={s.submit}><Text style={s.submitText}>Try again</Text></Pressable></>}
        </View> : <View style={s.form}>
          <View style={[s.card, compact && s.compactCard]}>
            <Text nativeID="create-class-name" style={s.label}>Class name</Text>
            <TextInput accessibilityLabel="Class name" accessibilityLabelledBy="create-class-name" value={fields.class_name}
              onChangeText={class_name => onChange({ ...fields, class_name })} editable={!disabled} maxLength={150}
              placeholder="e.g. Grade 7 · Mabini" placeholderTextColor="#7D8B82" style={s.input} returnKeyType="done" />
            <View style={s.gradeSection}>
              <Text style={s.label}>Grade level</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Grade level" style={s.grades}>
                {grades.map(grade => {
                  const selected = fields.grade_level === grade;
                  return <Pressable key={grade} accessibilityRole="radio" accessibilityLabel={"Grade " + grade}
                    accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled}
                    onPress={() => onChange({ ...fields, grade_level: grade })}
                    style={[s.grade, expanded ? s.twoColumns : s.threeColumns, selected && s.selected, disabled && s.dim]}>
                    <Text style={[s.gradeText, selected && s.selectedText]}>Grade {grade}</Text>
                  </Pressable>;
                })}
              </View>
            </View>
          </View>
          <View style={[s.card, compact && s.compactCard]}>
            <Text style={s.label}>Learning language</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Learning language" style={[s.languages, fontScale > 1.2 && s.languageStack]}>
              {languages.map(language => {
                const selected = fields.language === language;
                const label = language === "english" ? "English" : "Tagalog";
                return <Pressable key={language} accessibilityRole="radio" accessibilityLabel={label}
                  accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled}
                  onPress={() => onChange({ ...fields, language })} style={[s.language, selected && s.selected, disabled && s.dim]}>
                  <View style={s.languageTop}><Text style={s.languageName}>{label}</Text><View style={[s.radio, selected && s.selectedRadio]}>{selected && <View style={s.radioDot} />}</View></View>
                  <Text style={s.greeting}>{language === "english" ? "Hello!" : "Kumusta!"}</Text>
                </Pressable>;
              })}
            </View>
            {editing && <Text style={s.editHint}>Grade and language can only change before your class has a subject, students, or learning activities.</Text>}
          </View>
          <View style={s.noteCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Class note" : "Add a class note"} accessibilityState={{ expanded: noteOpen, disabled: busy }}
              disabled={busy} onPress={() => setNoteOpen(value => !value)} style={[s.noteToggle, busy && s.dim]}>
              <View style={s.noteLabel}><Text style={s.noteTitle}>{editing ? "Class note" : "Add a class note"}</Text><Text style={s.optional}>Optional</Text></View>
              <View style={noteOpen && s.openNoteIcon}><PersonalIcon name="plus" size={17} color={c.teal} /></View>
            </Pressable>
            {noteOpen && <View style={s.noteBody}>
              <Text nativeID="create-class-note" style={s.label}>What would you like students to know?</Text>
              <TextInput accessibilityLabel="Class note" accessibilityLabelledBy="create-class-note" style={[s.input, s.textarea]} multiline
                value={fields.description} onChangeText={description => onChange({ ...fields, description })} maxLength={500}
                editable={!disabled} placeholder="Add a short description of your class." placeholderTextColor="#7D8B82" textAlignVertical="top" />
            </View>}
          </View>
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
          {locked && <Text accessibilityLiveRegion="polite" style={s.notice}>We couldn’t confirm your class was saved. Try saving again with the same details, or check my classes before starting another class.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: busy, busy: operation === "save" }} disabled={busy} onPress={onSubmit} style={[s.submit, busy && s.dim]}>
            {operation === "save" && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text style={s.submitText}>{submitLabel}</Text>
            {!busy && <PersonalIcon name="arrow" size={17} color="#FFFFFF" />}
          </Pressable>
          <Text style={s.codeHint}>{editing ? "Your class code stays the same." : "You’ll get a class code to share with your students."}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy: operation === "check" }} disabled={busy}
            onPress={onCheckClasses} style={[s.check, busy && s.dim]}>
            {operation === "check" && <ActivityIndicator color={c.teal} size="small" />}
            <Text style={s.checkText}>{editing ? "Cancel" : operation === "check" ? "Checking my classes…" : "Check my classes"}</Text>
          </Pressable>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 27 },
  circle: { width: 44, height: 44, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  back: { borderColor: "transparent", backgroundColor: "#EDF3E8" }, backIcon: { transform: [{ rotate: "90deg" }] },
  hero: { marginBottom: 25 }, heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroStack: { flexDirection: "column-reverse", alignItems: "flex-start", gap: 17 },
  title: { flexShrink: 1, fontSize: 30, lineHeight: 37, fontWeight: "700", letterSpacing: -1.3, color: c.ink },
  art: { width: 96, height: 96, borderRadius: 29, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center" },
  artImage: { width: 76, height: 76 }, subtitle: { marginTop: 12, fontSize: 14, lineHeight: 23, color: c.muted },
  form: { gap: 16 }, card: { padding: 20, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF" }, compactCard: { padding: 16 },
  label: { color: c.ink, fontSize: 14, lineHeight: 21, fontWeight: "700", marginBottom: 10 },
  input: { width: "100%", minHeight: 54, padding: 14, borderWidth: 1, borderColor: "#DEE7DF", borderRadius: 13, color: c.ink, backgroundColor: "#FAFCF8", fontSize: 16, lineHeight: 24 },
  gradeSection: { marginTop: 25 }, grades: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grade: { minHeight: 46, paddingVertical: 8, paddingHorizontal: 3, borderWidth: 1, borderColor: c.line, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexGrow: 1 },
  threeColumns: { flexBasis: "29%" }, twoColumns: { flexBasis: "45%" },
  gradeText: { color: "#50685E", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  selected: { backgroundColor: c.selected, borderColor: c.teal }, selectedText: { color: c.teal },
  languages: { flexDirection: "row", gap: 9 }, languageStack: { flexDirection: "column" },
  language: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: 15, gap: 5, minHeight: 75 },
  languageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 5 },
  languageName: { flexShrink: 1, fontSize: 14, lineHeight: 21, fontWeight: "700", color: c.ink },
  radio: { width: 17, height: 17, borderWidth: 1.5, borderColor: "#A7B8A9", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  selectedRadio: { borderColor: c.teal }, radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.teal },
  greeting: { color: c.muted, fontSize: 12, lineHeight: 18 },
  editHint: { marginTop: 14, color: c.muted, fontSize: 12, lineHeight: 20 },
  state: { gap: 12, alignItems: "stretch" }, stateMessage: { color: c.muted, fontSize: 13, lineHeight: 21 },
  noteCard: { borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF" },
  noteToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 60, paddingVertical: 15, paddingHorizontal: 18 },
  noteLabel: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9 },
  noteTitle: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: c.ink }, optional: { color: c.muted, fontSize: 11, lineHeight: 17 },
  openNoteIcon: { transform: [{ rotate: "45deg" }] }, noteBody: { paddingHorizontal: 18, paddingBottom: 18 }, textarea: { minHeight: 95 },
  error: { padding: 13, borderRadius: 12, backgroundColor: "#FFF0E9", color: "#973921", fontSize: 13, lineHeight: 21 },
  notice: { padding: 13, borderRadius: 12, backgroundColor: "#FFF5E2", color: c.ink, fontSize: 13, lineHeight: 21 },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 56, padding: 14, borderBottomWidth: 3, borderBottomColor: "#AC3E23", borderRadius: 15, backgroundColor: c.coral },
  submitText: { color: "#FFFFFF", fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  codeHint: { marginHorizontal: 10, textAlign: "center", fontSize: 11, lineHeight: 19, color: c.muted },
  check: { minHeight: 44, padding: 10, marginTop: -7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  checkText: { color: c.teal, fontSize: 13, lineHeight: 20, fontWeight: "600", textDecorationLine: "underline", flexShrink: 1 }, dim: { opacity: 0.5 },
});
