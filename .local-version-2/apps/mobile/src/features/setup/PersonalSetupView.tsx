import { useEffect, useRef, type ComponentRef } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { a } from "../auth/styles";
import { homeColors as c } from "../../theme/personal";
import { languageChoices, levelChoices, type SetupChoiceValue } from "./preferences";
import type { Language } from "../../services/api/identity";

export type PersonalSetupViewProps = {
  step: 1 | 2;
  language: Language | null;
  value: SetupChoiceValue | null;
  busy: boolean;
  error: string;
  showExit: boolean;
  onSelect: (value: SetupChoiceValue) => void;
  onSave: () => void;
  onBack: () => void;
  onAccount: () => void;
  onStay: () => void;
  onSignOut: () => void;
};

export function PersonalSetupView(props: PersonalSetupViewProps) {
  const stayRef = useRef<ComponentRef<typeof Pressable>>(null);
  const backRef = useRef<ComponentRef<typeof Pressable>>(null);
  const wasExiting = useRef(false);
  useEffect(() => {
    if (props.showExit) stayRef.current?.focus();
    else if (wasExiting.current) backRef.current?.focus();
    wasExiting.current = props.showExit;
  }, [props.showExit]);
  const first = props.step === 1;
  const language = props.language === "tagalog" ? "Tagalog" : "English";
  const choices = first ? languageChoices : levelChoices;
  return <SafeAreaView style={a.safe}>
    <KeyboardAvoidingView style={a.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={a.content}>
        <View style={[a.top, v.header]}>
          <Pressable ref={backRef} accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: props.busy }} disabled={props.busy}
            onPress={props.onBack} style={[a.back, props.busy && a.dim]}><Text accessible={false} style={a.backText}>‹</Text></Pressable>
          <FluenttLogo size={32} />
          <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: props.busy || props.showExit }} disabled={props.busy || props.showExit}
            onPress={props.onAccount} style={[v.account, (props.busy || props.showExit) && a.dim]}><PersonalIcon name="account" size={20} /></Pressable>
        </View>
        <View style={a.intro}>
          <View style={[a.art, first && v.languageArt]}><Image accessible={false} style={a.heroImage}
            source={first ? require("../../../assets/illustrations/activity-chat.png") : require("../../../assets/illustrations/activity-learn.png")} /></View>
          {!props.showExit && <View accessible accessibilityLabel={`Step ${props.step} of 2`} style={v.progress}>
            <Text accessible={false} style={a.hint}>Step {props.step} of 2</Text>
            <View accessible={false} style={v.progressTrack}><View style={[v.progressPart, v.progressDone]} /><View style={[v.progressPart, !first && v.progressDone]} /></View>
          </View>}
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={a.title}>{props.showExit ? "Leave setup?" : first ? "What would you like to practise?" : "How would you like to start?"}</Text>
          <Text style={a.description}>{props.showExit ? "You can come back whenever you’re ready." : first ? "Choose a language for your practice." : `Choose a starting level for your ${language} practice.`}</Text>
        </View>
        {props.showExit ? <View style={a.card}>
          <Text style={a.description}>You’ll sign out on this device and return to the start screen. Your account and learning will stay saved.</Text>
          <Pressable ref={stayRef} accessibilityRole="button" onPress={props.onStay} style={a.submit}><Text style={a.submitText}>Stay here</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={props.onSignOut} style={v.secondary}><Text style={v.secondaryText}>Sign out</Text></Pressable>
        </View> : <View style={a.card}>
          <View accessibilityRole="radiogroup" accessibilityLabel={first ? "Practice language" : "Starting practice level"} style={a.roles}>
            {choices.map(choice => <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={`${choice.label}. ${choice.detail}`}
              accessibilityState={{ checked: props.value === choice.value, disabled: props.busy }} aria-checked={props.value === choice.value}
              disabled={props.busy} onPress={() => props.onSelect(choice.value)}
              style={({ pressed }) => [v.choice, props.value === choice.value && v.selectedChoice, props.busy && a.dim, pressed && !props.busy && v.pressed]}>
              <View style={v.choiceCopy}><Text style={v.choiceTitle}>{choice.label}</Text><Text style={[v.choiceDetail, first && v.greeting]}>{choice.detail}</Text></View>
              <Text accessible={false} style={v.radio}>{props.value === choice.value ? "●" : "○"}</Text>
            </Pressable>)}
          </View>
          {!first && <Text style={a.hint}>You can change this later.</Text>}
          {!!props.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={a.error}>{props.error}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: props.busy || props.value === null, busy: props.busy }}
            disabled={props.busy || props.value === null} onPress={props.onSave}
            style={({ pressed }) => [a.submit, (props.busy || props.value === null) && a.dim, pressed && !props.busy && props.value !== null && v.pressed]}>
            <View style={v.actionRow}>{props.busy && <ActivityIndicator size="small" color="#FFFFFF" />}<Text style={[a.submitText, v.actionText]}>{props.busy ? "Saving…" : first ? "Continue" : "Start learning"}</Text></View>
          </Pressable>
        </View>}
        <Text style={a.footer}>Small steps. More confidence.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const v = StyleSheet.create({
  header: { justifyContent: "space-between", gap: 8 },
  account: { width: 44, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  languageArt: { backgroundColor: "#EDE8FB" },
  progress: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 },
  progressTrack: { flexDirection: "row", gap: 5 },
  progressPart: { width: 27, height: 4, borderRadius: 2, backgroundColor: c.line },
  progressDone: { backgroundColor: c.teal },
  choice: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 86, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF" },
  selectedChoice: { borderColor: c.teal, backgroundColor: c.selected },
  choiceCopy: { flex: 1, minWidth: 0, gap: 4 },
  choiceTitle: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: c.ink },
  choiceDetail: { fontSize: 13, lineHeight: 21, color: c.muted },
  greeting: { color: c.teal, fontSize: 14 },
  radio: { minWidth: 26, fontSize: 24, color: c.teal, textAlign: "center" },
  secondary: { minHeight: 50, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.line, backgroundColor: "#FAFCF7", justifyContent: "center" },
  secondaryText: { fontSize: 14, lineHeight: 21, textAlign: "center", fontWeight: "600", color: c.teal },
  actionRow: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  actionText: { flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
